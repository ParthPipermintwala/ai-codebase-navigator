import { getRepositoryForAi } from "./supabaseService.js";
import { getRawFileContent } from "./githubService.js";

const OPENROUTER_CHAT_ENDPOINT =
  process.env.OPENROUTER_CHAT_URL ||
  "https://openrouter.ai/api/v1/chat/completions";

const OPENROUTER_CHAT_MODEL =
  process.env.OPENROUTER_CHAT_MODEL || "openai/gpt-4o-mini";

const TOUR_CODE_MAX_CHARS = Number(process.env.TOUR_CODE_MAX_CHARS || 0);

const buildHeaders = () => {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is required for AI features");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    ...(process.env.OPENROUTER_SITE_URL
      ? { "HTTP-Referer": process.env.OPENROUTER_SITE_URL }
      : {}),
    ...(process.env.OPENROUTER_APP_NAME
      ? { "X-Title": process.env.OPENROUTER_APP_NAME }
      : {}),
  };
};

const callChatCompletion = async (messages, options = {}) => {
  const response = await fetch(OPENROUTER_CHAT_ENDPOINT, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({
      model: options.model || OPENROUTER_CHAT_MODEL,
      messages,
      temperature: 0.2,
      max_tokens: Number(options.maxTokens || 300),
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `OpenRouter chat API failed: ${response.status} ${details}`,
    );
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || "";
};

const normalizeStructurePaths = (structure) => {
  if (Array.isArray(structure)) {
    return structure;
  }

  if (structure && typeof structure === "object") {
    if (Array.isArray(structure.selected_files)) {
      return structure.selected_files;
    }

    if (Array.isArray(structure.paths)) {
      return structure.paths;
    }
  }

  return [];
};

const generateSummary = async (repoData) => {
  const structurePaths = normalizeStructurePaths(repoData?.structure);
  const dependencies = repoData?.dependencies || {};
  const limitedDependencies = Object.fromEntries(
    Object.entries(dependencies).slice(0, 200),
  );
  const techStack = Array.isArray(repoData?.tech_stack)
    ? repoData.tech_stack
    : [];

  const prompt = [
    "You are an expert software architect.",
    "Generate a concise and structured codebase summary with these sections:",
    "1) Architecture Overview",
    "2) Key Modules",
    "3) Tech Stack",
    "4) Entry Points",
    "5) Risks / Observations",
    "Use plain text with short bullet points.",
    "",
    `Repository: ${repoData?.owner || "unknown"}/${repoData?.name || "unknown"}`,
    `Description: ${repoData?.description || "N/A"}`,
    `Tech stack: ${techStack.join(", ") || "N/A"}`,
    `Dependencies: ${JSON.stringify(limitedDependencies).slice(0, 4000)}`,
    `Structure sample: ${JSON.stringify(structurePaths.slice(0, 120)).slice(0, 6000)}`,
  ].join("\n");

  return callChatCompletion(
    [
      {
        role: "system",
        content: "You summarize repositories for engineering teams.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    { maxTokens: 300 },
  );
};

const generateChatAnswer = async (
  question,
  context,
  repoData = {},
  questionHints = "",
) => {
  const deps = repoData?.dependencies || {};
  const limitedDeps = Object.fromEntries(Object.entries(deps).slice(0, 200));
  const techStack = Array.isArray(repoData?.tech_stack)
    ? repoData.tech_stack
    : [];

  const prompt = [
    "You are a codebase analyzer.",
    "Use ONLY:",
    "* file content",
    "* detected technologies",
    "* dependencies",
    "",
    "DO NOT guess.",
    "If not found, say: 'Not found in code.'",
    "If answer is from file, mention file name in Source.",
    "Answer in clean readable text with this exact format:",
    "Summary:",
    "One short paragraph.",
    "",
    "Key Points:",
    "- point 1",
    "- point 2",
    "",
    "Source:",
    "- filename",
    "Section title lines must NOT start with '*' or '•'.",
    "",
    "Do not return raw JSON.",
    "Do not return objects.",
    "",
    questionHints ? `Question guidance: ${questionHints}` : "",
    `Question: ${question}`,
    "",
    "Context:",
    context || "No context available.",
    "",
    "Detected Tech Stack:",
    techStack.length > 0 ? techStack.join(", ") : "No detected tech stack.",
    "",
    "Dependencies:",
    JSON.stringify(limitedDeps),
  ].join("\n");

  return callChatCompletion(
    [
      {
        role: "system",
        content: "You are a strict codebase analyzer.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    { maxTokens: 120 },
  );
};

const pickImportantFiles = (structure, maxFiles = 8) => {
  const paths = normalizeStructurePaths(structure);
  if (!paths.length) {
    return [];
  }

  const prioritized = [];
  const seen = new Set();

  const pushIfUnique = (filePath) => {
    const normalized = String(filePath || "").trim();
    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    prioritized.push(normalized);
  };

  const orderedRules = [
    (path) => path.endsWith("main.py"),
    (path) => path.endsWith("app.py"),
    (path) => path.endsWith("index.js") || path.endsWith("index.ts"),
    (path) => path.startsWith("src/") || path.includes("/src/"),
    (path) => path.startsWith("ui/") || path.includes("/ui/"),
    (path) => /(^|\/)(main|app|index)/.test(path),
  ];

  const lowerPaths = paths.map((path) => String(path).toLowerCase());

  for (const rule of orderedRules) {
    for (let i = 0; i < lowerPaths.length; i += 1) {
      if (rule(lowerPaths[i])) {
        pushIfUnique(paths[i]);
        if (prioritized.length >= maxFiles) {
          return prioritized;
        }
      }
    }
  }

  for (const path of paths) {
    pushIfUnique(path);
    if (prioritized.length >= maxFiles) {
      break;
    }
  }

  return prioritized;
};

const extractJsonPayload = (text) => {
  if (!text || typeof text !== "string") {
    return null;
  }

  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
      } catch {
        return null;
      }
    }

    return null;
  }
};

const buildTourFallback = (repoData, importantFiles) => {
  const techStack = Array.isArray(repoData?.tech_stack)
    ? repoData.tech_stack
    : [];

  return {
    steps: [
      {
        title: "Project Overview",
        description:
          String(repoData?.description || "No description available.").trim() ||
          "No description available.",
        files: importantFiles.slice(0, 2),
        primaryFile: importantFiles[0] || "",
      },
      {
        title: "Technology Stack",
        description:
          techStack.length > 0
            ? `Detected stack: ${techStack.join(", ")}`
            : "No technology stack detected.",
        files: importantFiles.slice(0, 3),
        primaryFile: importantFiles[1] || importantFiles[0] || "",
      },
      {
        title: "Important Entry Files",
        description: "Start exploration from these key files.",
        files: importantFiles.slice(0, 5),
        primaryFile: importantFiles[0] || "",
      },
    ],
  };
};

const buildCodePreviewMap = async (repoData, filePaths) => {
  const owner = repoData?.owner;
  const repo = repoData?.name;
  const branch = repoData?.default_branch || "main";

  if (!owner || !repo || !Array.isArray(filePaths) || filePaths.length === 0) {
    return {};
  }

  const previews = {};
  const candidates = filePaths.slice(0, 8);

  for (const filePath of candidates) {
    try {
      const raw = await getRawFileContent(owner, repo, branch, filePath);
      const text = String(raw || "").trim();
      if (!text) {
        continue;
      }

      // 0 means no truncation so Full Tour mode can display complete file content.
      previews[filePath] =
        TOUR_CODE_MAX_CHARS > 0 ? text.slice(0, TOUR_CODE_MAX_CHARS) : text;
    } catch {
      // Best-effort preview generation only.
    }
  }

  return previews;
};

const pickPrimaryFileForStep = (stepFiles, importantFiles, previewMap) => {
  const candidates = Array.isArray(stepFiles) ? stepFiles : [];

  for (const filePath of candidates) {
    if (previewMap[filePath]) {
      return filePath;
    }
  }

  for (const filePath of candidates) {
    if (filePath) {
      return filePath;
    }
  }

  for (const filePath of importantFiles) {
    if (previewMap[filePath]) {
      return filePath;
    }
  }

  return importantFiles[0] || "";
};

const IMPACT_AREAS = new Set(["UI", "API", "Core", "Database"]);
const IMPACT_SEVERITIES = new Set(["high", "medium", "low"]);

const sanitizeImpactItem = (item, allowedFiles = []) => {
  const areaRaw = String(item?.area || "Core").trim();
  const severityRaw = String(item?.severity || "medium")
    .trim()
    .toLowerCase();
  const rawFiles = Array.isArray(item?.files)
    ? item.files.map((file) => String(file || "").trim()).filter(Boolean)
    : [];

  const allowedLower = new Set(
    allowedFiles.map((f) =>
      String(f || "")
        .trim()
        .toLowerCase(),
    ),
  );

  // Strict filtering: only include files from allowedFiles if provided and non-empty
  const files =
    allowedFiles && allowedFiles.length > 0
      ? rawFiles
          .filter((file) => allowedLower.has(file.toLowerCase()))
          .slice(0, 6)
      : rawFiles.slice(0, 6); // Allow raw files only if allowedFiles is empty (couldn't extract target)

  return {
    area: IMPACT_AREAS.has(areaRaw) ? areaRaw : "Core",
    description: String(item?.description || "No impact details available.")
      .trim()
      .slice(0, 300),
    severity: IMPACT_SEVERITIES.has(severityRaw) ? severityRaw : "medium",
    files,
  };
};

const extractRelatedFiles = (structure, target, maxFiles = 10) => {
  const paths = normalizeStructurePaths(structure)
    .map((path) => String(path || "").trim())
    .filter(Boolean);
  if (!paths.length) {
    return [];
  }

  const normalizedTarget = String(target || "")
    .trim()
    .toLowerCase();

  // Normalize target to always end with / for directory matching
  let targetDir = normalizedTarget.endsWith("/")
    ? normalizedTarget
    : normalizedTarget + "/";

  const result = [];
  const seen = new Set();

  // First pass: exact match with full path
  for (const path of paths) {
    const pathLower = path.toLowerCase();
    const isExactMatch = pathLower === normalizedTarget;
    const isUnderDir = pathLower.startsWith(targetDir);

    if ((isExactMatch || isUnderDir) && !seen.has(path)) {
      result.push(path);
      seen.add(path);
      if (result.length >= maxFiles) break;
    }
  }

  // Second pass: if no exact match, try matching with just the last segments
  if (result.length === 0) {
    const targetSegments = normalizedTarget.split("/").filter(Boolean);
    if (targetSegments.length > 1) {
      // Try matching with fewer parent segments (in case repo name is included)
      for (let i = 1; i < targetSegments.length; i++) {
        const shortTarget = targetSegments.slice(i).join("/").toLowerCase();
        const shortTargetDir = shortTarget + "/";

        for (const path of paths) {
          const pathLower = path.toLowerCase();
          if (
            (pathLower === shortTarget ||
              pathLower.startsWith(shortTargetDir)) &&
            !seen.has(path)
          ) {
            result.push(path);
            seen.add(path);
            if (result.length >= maxFiles) break;
          }
        }

        if (result.length >= maxFiles) break;
      }
    }
  }

  return result;
};

const buildImpactFallback = (target, relatedFiles) => {
  return {
    target,
    impact: [
      {
        area: "Core",
        description:
          "Could not generate AI impact details. Review dependent modules manually.",
        severity: "medium",
        files: relatedFiles.slice(0, 4),
      },
    ],
  };
};

const getRepoImpactService = async (repoId, target) => {
  const normalizedRepoId = String(repoId || "").trim();
  const normalizedTarget = String(target || "").trim();

  if (!normalizedRepoId) {
    throw new Error("repoId is required");
  }

  if (!normalizedTarget) {
    throw new Error("target is required");
  }

  const repoData = await getRepositoryForAi(normalizedRepoId);
  if (!repoData) {
    throw new Error("Repository not found");
  }

  const techStack = Array.isArray(repoData?.tech_stack)
    ? repoData.tech_stack
    : [];
  const relatedFiles = extractRelatedFiles(
    repoData?.structure,
    normalizedTarget,
    10,
  );

  const context = [
    `Repository: ${repoData?.name || "Unknown"}`,
    `Target: ${normalizedTarget}`,
    `Tech Stack: ${techStack.join(", ") || "N/A"}`,
    `Relevant Files (ONLY use these files in your response): ${relatedFiles.join(", ") || "N/A"}`,
  ].join("\n");

  const prompt = [
    "Return ONLY JSON in this exact shape:",
    '{"target":"string","impact":[{"area":"UI / API / Core / Database","description":"what will break or change","severity":"high | medium | low","files":["file1","file2"]}]}',
    "Rules:",
    "- No markdown",
    "- No explanation outside JSON",
    "- Keep answer concise",
    "- Max 5 impact points",
    "- Must be specific to target",
    "- CRITICAL: Only reference files from the 'Relevant Files' list. Do NOT invent files outside this list.",
    "- Use only provided context",
    "",
    context,
  ].join("\n");

  try {
    const responseText = await callChatCompletion(
      [
        {
          role: "system",
          content: "You output strict JSON for repository impact analysis.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      {
        model: "openai/gpt-4o-mini",
        maxTokens: 400,
      },
    );

    const parsed = extractJsonPayload(responseText);
    const rawItems = Array.isArray(parsed?.impact)
      ? parsed.impact.slice(0, 5)
      : [];
    const impact = rawItems
      .map((item) => sanitizeImpactItem(item, relatedFiles))
      .filter((item) => item.description);

    if (impact.length > 0) {
      return {
        target:
          String(parsed?.target || normalizedTarget).trim() || normalizedTarget,
        impact,
      };
    }
  } catch (error) {
    console.error("[getRepoImpactService] AI generation failed", {
      repoId: normalizedRepoId,
      target: normalizedTarget,
      message: error?.message || String(error),
    });
  }

  return buildImpactFallback(normalizedTarget, relatedFiles);
};

const generateRepoTour = async (repoId) => {
  const repoData = await getRepositoryForAi(String(repoId));
  if (!repoData) {
    throw new Error("Repository not found");
  }

  const repository = {
    owner: String(repoData?.owner || "").trim(),
    name: String(repoData?.name || "").trim(),
    branch: String(repoData?.default_branch || "main").trim() || "main",
  };

  const importantFiles = pickImportantFiles(repoData?.structure, 8);
  const techStack = Array.isArray(repoData?.tech_stack)
    ? repoData.tech_stack
    : [];
  let previewMap = await buildCodePreviewMap(repoData, importantFiles);

  const context = [
    `Project: ${repoData?.name || "Unknown"}`,
    `Description: ${repoData?.description || "N/A"}`,
    `Tech stack: ${techStack.join(", ") || "N/A"}`,
    `Important files: ${importantFiles.join(", ") || "N/A"}`,
  ].join("\n");

  const prompt = [
    "Create a concise codebase walkthrough.",
    "Return ONLY this JSON format with no markdown and no extra text:",
    '{"steps":[{"title":"Entry Point","description":"...","files":["..."]}]}',
    "Rules:",
    "- Max 5 steps",
    "- Keep steps concise",
    "- No explanation outside JSON",
    "- Use only provided context",
    "",
    context,
  ].join("\n");

  try {
    const responseText = await callChatCompletion(
      [
        {
          role: "system",
          content: "You output strict JSON for repository tours.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      {
        model: "openai/gpt-4o-mini",
        maxTokens: 400,
      },
    );

    const parsed = extractJsonPayload(responseText);
    let steps = Array.isArray(parsed?.steps)
      ? parsed.steps
          .slice(0, 5)
          .map((step) => {
            const files = Array.isArray(step?.files)
              ? step.files
                  .map((file) => String(file).trim())
                  .filter(Boolean)
                  .slice(0, 5)
              : [];
            const primaryFile = pickPrimaryFileForStep(
              files,
              importantFiles,
              previewMap,
            );

            return {
              title: String(step?.title || "Untitled Step").trim(),
              description: String(
                step?.description || "No description.",
              ).trim(),
              files,
              primaryFile,
              code: primaryFile ? previewMap[primaryFile] || "" : "",
            };
          })
          .filter((step) => step.title)
      : [];

    if (steps.length > 0) {
      const stepFiles = steps.flatMap((step) =>
        Array.isArray(step.files) ? step.files : [],
      );
      const missingFiles = Array.from(
        new Set(stepFiles.filter((filePath) => !previewMap[filePath])),
      );

      if (missingFiles.length > 0) {
        const additionalPreviewMap = await buildCodePreviewMap(
          repoData,
          missingFiles,
        );
        previewMap = {
          ...previewMap,
          ...additionalPreviewMap,
        };

        steps = steps.map((step) => {
          const primaryFile = pickPrimaryFileForStep(
            step.files,
            importantFiles,
            previewMap,
          );

          return {
            ...step,
            primaryFile,
            code: primaryFile
              ? previewMap[primaryFile] || step.code || ""
              : step.code || "",
          };
        });
      }
    }

    if (steps.length > 0) {
      return {
        steps,
        repository,
      };
    }
  } catch (error) {
    console.error("[generateRepoTour] AI generation failed", {
      message: error?.message || String(error),
    });
  }

  const fallback = buildTourFallback(repoData, importantFiles);
  fallback.steps = fallback.steps.map((step) => {
    const primaryFile = pickPrimaryFileForStep(
      step.files,
      importantFiles,
      previewMap,
    );
    return {
      ...step,
      primaryFile,
      code: primaryFile ? previewMap[primaryFile] || "" : "",
    };
  });

  return {
    ...fallback,
    repository,
  };
};

export {
  generateSummary,
  generateChatAnswer,
  normalizeStructurePaths,
  generateRepoTour,
  getRepoImpactService,
};
