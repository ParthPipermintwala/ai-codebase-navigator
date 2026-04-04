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

const generateGeneralAnswer = async (question, options = {}) => {
  const techStack = Array.isArray(options?.techStack) ? options.techStack : [];
  const prompt = [
    "You are a senior software engineer helping with implementation questions.",
    "Provide a direct, practical answer.",
    "When the user asks for code, include runnable code.",
    "Prefer concise explanations and production-friendly defaults.",
    "If relevant, mention trade-offs and next steps briefly.",
    "Use plain text sections when useful:",
    "Summary:",
    "Key Points:",
    "Code:",
    "",
    `Question: ${String(question || "").trim()}`,
    "",
    "Optional project hint (may be unrelated):",
    techStack.length > 0
      ? `Detected tech stack: ${techStack.join(", ")}`
      : "Detected tech stack: N/A",
  ].join("\n");

  return callChatCompletion(
    [
      {
        role: "system",
        content:
          "You are a practical coding assistant. Provide useful implementation-ready answers.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    { maxTokens: 500 },
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

const SOURCE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".py",
]);

const splitPath = (value) =>
  String(value || "")
    .split("/")
    .filter(Boolean);

const getDirectoryPath = (path) => {
  const segments = splitPath(path);
  return segments.slice(0, -1).join("/");
};

const getFileExtension = (path) => {
  const fileName = splitPath(path).pop() || "";
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex === -1 ? "" : fileName.slice(dotIndex).toLowerCase();
};

const normalizeSlashes = (value) =>
  String(value || "")
    .replace(/\\/g, "/")
    .trim();

const toPathVariants = (candidate) => {
  const normalized = normalizeSlashes(candidate);
  if (!normalized) {
    return [];
  }

  const variants = new Set([normalized]);
  const hasExtension = Boolean(getFileExtension(normalized));

  if (!hasExtension) {
    for (const ext of SOURCE_EXTENSIONS) {
      variants.add(`${normalized}${ext}`);
      variants.add(`${normalized}/index${ext}`);
    }
  }

  return Array.from(variants);
};

const resolveLocalImportPath = (fromFile, importPath, knownFilesSet) => {
  const trimmed = String(importPath || "").trim();
  if (!trimmed.startsWith(".")) {
    return null;
  }

  const fromDir = getDirectoryPath(fromFile);
  const fromSegments = splitPath(fromDir);
  const importSegments = splitPath(trimmed);
  const stack = [...fromSegments];

  for (const segment of importSegments) {
    if (segment === ".") {
      continue;
    }
    if (segment === "..") {
      stack.pop();
      continue;
    }
    stack.push(segment);
  }

  const baseCandidate = stack.join("/");
  const variants = toPathVariants(baseCandidate);
  for (const variant of variants) {
    if (knownFilesSet.has(variant)) {
      return variant;
    }
  }

  return null;
};

const extractImportSpecifiers = (filePath, content) => {
  const specs = new Set();
  const text = String(content || "");
  const ext = getFileExtension(filePath);

  if ([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"].includes(ext)) {
    const importFromRegex =
      /(?:import|export)\s+(?:[^"'`]+?\s+from\s+)?["'`]([^"'`]+)["'`]/g;
    const requireRegex = /require\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
    const dynamicImportRegex = /import\(\s*["'`]([^"'`]+)["'`]\s*\)/g;

    for (const regex of [importFromRegex, requireRegex, dynamicImportRegex]) {
      let match;
      while ((match = regex.exec(text)) !== null) {
        const spec = String(match[1] || "").trim();
        if (spec) specs.add(spec);
      }
    }
  }

  if (ext === ".py") {
    const pyImportRegex = /^\s*import\s+([a-zA-Z0-9_\.]+)/gm;
    const pyFromRegex = /^\s*from\s+([a-zA-Z0-9_\.]+)\s+import\s+/gm;

    let match;
    while ((match = pyImportRegex.exec(text)) !== null) {
      const spec = String(match[1] || "").trim();
      if (spec) specs.add(spec);
    }
    while ((match = pyFromRegex.exec(text)) !== null) {
      const spec = String(match[1] || "").trim();
      if (spec) specs.add(spec);
    }
  }

  return Array.from(specs);
};

const isSourceFile = (filePath) =>
  SOURCE_EXTENSIONS.has(getFileExtension(filePath));

const resolveTargetFiles = (structure, target, maxFiles = 8) => {
  const paths = normalizeStructurePaths(structure)
    .map((path) => normalizeSlashes(path))
    .filter(Boolean);

  if (!paths.length) {
    return [];
  }

  const normalizedTarget = normalizeSlashes(target).toLowerCase();
  const isDirectoryHint =
    normalizedTarget.endsWith("/") || !getFileExtension(normalizedTarget);
  const withoutTrailingSlash = normalizedTarget.replace(/\/+$/, "");
  const targetBase =
    splitPath(withoutTrailingSlash).pop() || withoutTrailingSlash;

  const matches = [];
  const seen = new Set();
  const push = (path) => {
    if (!path || seen.has(path)) return;
    seen.add(path);
    matches.push(path);
  };

  for (const path of paths) {
    const lower = path.toLowerCase();
    if (lower === normalizedTarget || lower.endsWith(`/${normalizedTarget}`)) {
      push(path);
    }
  }

  if (isDirectoryHint) {
    const dirPrefix = `${withoutTrailingSlash}/`;
    for (const path of paths) {
      const lower = path.toLowerCase();
      if (lower.startsWith(dirPrefix) || lower.includes(`/${dirPrefix}`)) {
        push(path);
      }
    }
  }

  if (matches.length === 0 && targetBase) {
    for (const path of paths) {
      const lower = path.toLowerCase();
      if (lower.endsWith(`/${targetBase}`) || lower === targetBase) {
        push(path);
      }
    }
  }

  return matches.slice(0, maxFiles);
};

const inferAreaFromPath = (filePath) => {
  const lower = String(filePath || "").toLowerCase();
  if (
    lower.startsWith("client/") ||
    lower.includes("/components/") ||
    lower.endsWith(".tsx") ||
    lower.endsWith(".jsx")
  ) {
    return "UI";
  }

  if (
    lower.includes("/routes/") ||
    lower.includes("/controller/") ||
    lower.includes("/middleware/") ||
    lower.includes("server") ||
    lower.includes("api")
  ) {
    return "API";
  }

  if (
    lower.includes("/config/") ||
    lower.includes("/models/") ||
    lower.includes("redis") ||
    lower.includes("supabase") ||
    lower.includes("database") ||
    lower.includes("db")
  ) {
    return "Database";
  }

  return "Core";
};

const makeImpactDescription = ({
  directCount,
  dependentCount,
  dependencyCount,
}) => {
  const parts = [];
  parts.push(
    `${directCount} direct target file${directCount === 1 ? "" : "s"}`,
  );
  if (dependentCount > 0) {
    parts.push(
      `${dependentCount} upstream dependent file${dependentCount === 1 ? "" : "s"}`,
    );
  }
  if (dependencyCount > 0) {
    parts.push(
      `${dependencyCount} direct dependency file${dependencyCount === 1 ? "" : "s"}`,
    );
  }
  return `${parts.join(", ")} detected from repository imports.`;
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

  const structurePaths = normalizeStructurePaths(repoData?.structure)
    .map((path) => normalizeSlashes(path))
    .filter(Boolean);

  const targetFiles = resolveTargetFiles(structurePaths, normalizedTarget, 10);
  if (targetFiles.length === 0) {
    throw new Error(
      `Target not found in repository structure: ${normalizedTarget}`,
    );
  }

  const candidateFiles = structurePaths.filter(isSourceFile).slice(0, 180);
  const knownFilesSet = new Set(candidateFiles);

  const graph = new Map();
  const reverseGraph = new Map();
  for (const filePath of candidateFiles) {
    graph.set(filePath, new Set());
    reverseGraph.set(filePath, new Set());
  }

  const owner = String(repoData?.owner || "").trim();
  const repo = String(repoData?.name || "").trim();
  const branch = String(repoData?.default_branch || "main").trim() || "main";

  for (const filePath of candidateFiles) {
    try {
      const content = await getRawFileContent(owner, repo, branch, filePath);
      const specs = extractImportSpecifiers(filePath, content);
      for (const spec of specs) {
        const resolved = resolveLocalImportPath(filePath, spec, knownFilesSet);
        if (!resolved || !graph.has(filePath) || !reverseGraph.has(resolved)) {
          continue;
        }
        graph.get(filePath).add(resolved);
        reverseGraph.get(resolved).add(filePath);
      }
    } catch {
      // Skip unreadable files and keep best-effort graph.
    }
  }

  const dependentFiles = new Set();
  const queue = [...targetFiles];
  const visited = new Set(queue);

  while (queue.length > 0) {
    const current = queue.shift();
    const parents = reverseGraph.get(current) || new Set();
    for (const parent of parents) {
      if (visited.has(parent)) {
        continue;
      }
      visited.add(parent);
      dependentFiles.add(parent);
      queue.push(parent);
    }
  }

  const directDependencies = new Set();
  for (const targetFile of targetFiles) {
    const deps = graph.get(targetFile) || new Set();
    for (const dep of deps) {
      if (!targetFiles.includes(dep)) {
        directDependencies.add(dep);
      }
    }
  }

  const allTouched = Array.from(
    new Set([
      ...targetFiles,
      ...Array.from(dependentFiles),
      ...Array.from(directDependencies),
    ]),
  );

  const areaGroups = new Map();
  for (const filePath of allTouched) {
    const area = inferAreaFromPath(filePath);
    if (!areaGroups.has(area)) {
      areaGroups.set(area, []);
    }
    areaGroups.get(area).push(filePath);
  }

  const areaOrder = ["Core", "API", "UI", "Database"];
  const impact = [];
  for (const area of areaOrder) {
    const files = (areaGroups.get(area) || []).slice(0, 6);
    if (files.length === 0) {
      continue;
    }

    const severity =
      area === "Core"
        ? "high"
        : dependentFiles.size >= 5
          ? "high"
          : dependentFiles.size >= 2
            ? "medium"
            : "low";

    impact.push({
      area,
      description: makeImpactDescription({
        directCount: targetFiles.length,
        dependentCount: dependentFiles.size,
        dependencyCount: directDependencies.size,
      }),
      severity,
      files,
    });
  }

  const normalizedImpact = impact
    .slice(0, 5)
    .map((item) => sanitizeImpactItem(item, structurePaths));

  if (normalizedImpact.length === 0) {
    throw new Error(
      "No dependency-based impact could be computed for this target",
    );
  }

  return {
    target: normalizedTarget,
    impact: normalizedImpact,
    source: "dependency-graph",
    meta: {
      targetFiles,
      dependentFiles: Array.from(dependentFiles).slice(0, 30),
      directDependencies: Array.from(directDependencies).slice(0, 30),
      analyzedSourceFiles: candidateFiles.length,
    },
  };
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
  generateGeneralAnswer,
  normalizeStructurePaths,
  generateRepoTour,
  getRepoImpactService,
};
