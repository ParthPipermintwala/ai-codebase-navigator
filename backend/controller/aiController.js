import { getCachedJson, setCachedJson } from "../services/redisService.js";
import {
  getRepositoryForAi,
  updateRepositorySummary,
  getUserById,
} from "../services/supabaseService.js";
import {
  generateSummary,
  generateChatAnswer,
  generateGeneralAnswer,
} from "../services/aiService.js";
import { createEmbedding, queryVectors } from "../services/vectorService.js";
import { getRawFileContent } from "../services/githubService.js";

const CACHE_TTL_SECONDS = 3600;
const MAX_CONTEXT_CHARS = 900;
const MAX_DIRECT_FILE_CANDIDATES = 12;
const MAX_DIRECT_FILE_READS = 3;
const MAX_FILE_SNIPPET_CHARS = 1500;

const INTENT_KEYWORDS = {
  ui: ["ui", "frontend", "tkinter", "react", "electron", "vue", "qt"],
  db: [
    "database",
    "db",
    "mongoose",
    "sql",
    "postgres",
    "sqlite",
    "prisma",
    "sequelize",
  ],
  api: ["api", "backend", "express", "flask", "router", "app.get", "endpoint"],
  dependencies: [
    "dependency",
    "dependencies",
    "package",
    "requirements",
    "library",
  ],
  structure: [
    "structure",
    "architecture",
    "module",
    "layout",
    "folder",
    "design",
  ],
};

const PRIORITY_FILE_HINTS = [
  "main.py",
  "app.py",
  "index.js",
  "package.json",
  "requirements.txt",
];

const REPO_SCOPE_HINTS = [
  "this repo",
  "this repository",
  "this project",
  "our code",
  "in codebase",
  "in this code",
  "in this app",
  "in this file",
  "module",
  "folder",
  "repo",
  "repository",
  "codebase",
  "used in",
  "where in",
];

const GENERIC_IMPLEMENTATION_HINTS = [
  "give me code",
  "give code",
  "write code",
  "implement",
  "example",
  "sample",
  "snippet",
  "how to",
  "build ",
  "create ",
  "animated component",
];

const BUG_ANALYSIS_HINTS = [
  "find bug",
  "find bugs",
  "bug",
  "bugs",
  "debug",
  "issue",
  "issues",
  "error",
  "errors",
  "failing",
  "failure",
  "broken",
  "crash",
  "fix bug",
  "locate bug",
];

const detectIntent = (question) => {
  const normalized = String(question || "").toLowerCase();

  if (normalized.includes("ui") || normalized.includes("frontend")) {
    return "ui";
  }

  if (normalized.includes("database") || normalized.includes("db")) {
    return "db";
  }

  if (normalized.includes("api") || normalized.includes("backend")) {
    return "api";
  }

  if (normalized.includes("dependency") || normalized.includes("package")) {
    return "dependencies";
  }

  if (normalized.includes("structure") || normalized.includes("architecture")) {
    return "structure";
  }

  return "general";
};

const buildQuestionHints = (question, intent = "general") => {
  const normalized = String(question || "").toLowerCase();
  const hints = [];

  if (normalized.includes("project")) {
    hints.push("Explain project purpose from summary.");
  }

  if (normalized.includes("tech") || normalized.includes("stack")) {
    hints.push("List technologies from dependencies.");
  }

  if (normalized.includes("db") || normalized.includes("database")) {
    hints.push("Focus ONLY on the database used.");
  }

  if (normalized.includes("dependency")) {
    hints.push("List dependencies only.");
  }

  if (intent === "ui" || normalized.includes("desktop")) {
    hints.push("Answer using detected UI libraries only.");
  }

  if (intent === "db") {
    hints.push(
      "Answer using database libraries, models, and configuration only.",
    );
  }

  if (intent === "api") {
    hints.push("Focus on API handlers, routes, and backend service files.");
  }

  if (intent === "structure") {
    hints.push(
      "Explain codebase layout and major modules from files and summary.",
    );
  }

  return hints.join(" ");
};

const isRepoScopedQuestion = (question, intent = "general") => {
  const normalized = String(question || "").toLowerCase();
  if (!normalized) {
    return true;
  }

  if (BUG_ANALYSIS_HINTS.some((hint) => normalized.includes(hint))) {
    return true;
  }

  if (REPO_SCOPE_HINTS.some((hint) => normalized.includes(hint))) {
    return true;
  }

  const looksGenericImplementation = GENERIC_IMPLEMENTATION_HINTS.some((hint) =>
    normalized.includes(hint),
  );

  if (intent === "general" && looksGenericImplementation) {
    return false;
  }

  if (
    /^(what is|define|explain)\b/.test(normalized) &&
    !looksGenericImplementation
  ) {
    return false;
  }

  return intent !== "general";
};

const getStructurePaths = (structure) => {
  if (Array.isArray(structure)) {
    return structure.filter((path) => typeof path === "string");
  }

  if (structure && typeof structure === "object") {
    if (Array.isArray(structure.selected_files)) {
      return structure.selected_files.filter(
        (path) => typeof path === "string",
      );
    }
  }

  return [];
};

const getQuestionKeywords = (question) => {
  const normalized = String(question || "").toLowerCase();
  const intent = detectIntent(normalized);
  const keywords = new Set(
    normalized.split(/[^a-z0-9_]+/).filter((part) => part && part.length > 2),
  );

  if (intent !== "general") {
    for (const keyword of INTENT_KEYWORDS[intent] || []) {
      keywords.add(keyword);
    }
  }

  if (normalized.includes("desktop")) {
    keywords.add("tkinter");
    keywords.add("qt");
  }

  return Array.from(keywords);
};

const scorePathPriority = (filePath, keywords = []) => {
  const lower = String(filePath || "").toLowerCase();
  let score = 0;

  if (lower.endsWith("main.py")) score += 120;
  if (lower.endsWith("app.py")) score += 110;
  if (lower.endsWith("index.js")) score += 100;
  if (lower.endsWith("package.json") || lower.endsWith("requirements.txt")) {
    score += 95;
  }
  if (lower.startsWith("ui/") || lower.includes("/ui/")) score += 80;
  if (lower.startsWith("src/") || lower.includes("/src/")) score += 60;
  if (lower.startsWith("components/") || lower.includes("/components/")) {
    score += 60;
  }
  if (lower.includes("ui") || lower.includes("app") || lower.includes("main"))
    score += 35;

  for (const priorityFile of PRIORITY_FILE_HINTS) {
    if (lower.endsWith(priorityFile)) {
      score += 50;
    }
  }

  for (const keyword of keywords) {
    if (keyword && lower.includes(keyword)) {
      score += 8;
    }
  }

  return score;
};

const prioritizeFilePaths = (structurePaths, question) => {
  const keywords = getQuestionKeywords(question);
  const uniquePaths = Array.from(new Set(structurePaths));

  return uniquePaths
    .map((path) => ({ path, score: scorePathPriority(path, keywords) }))
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_DIRECT_FILE_CANDIDATES)
    .map((entry) => entry.path);
};

const extractImportsFromContent = (content) => {
  const source = String(content || "");
  const imports = new Set();

  for (const match of source.matchAll(/^\s*import\s+([a-zA-Z0-9_.,\s]+)/gm)) {
    const names = String(match[1] || "")
      .split(",")
      .map((part) => part.trim().split(/\s+as\s+/i)[0])
      .map((part) => part.split(".")[0])
      .filter(Boolean);
    for (const name of names) imports.add(name);
  }

  for (const match of source.matchAll(
    /^\s*from\s+([a-zA-Z0-9_.]+)\s+import\s+/gm,
  )) {
    const name = String(match[1] || "").split(".")[0];
    if (name) imports.add(name);
  }

  for (const match of source.matchAll(/require\((['"`])([^'"`]+)\1\)/g)) {
    const name = String(match[2] || "").split("/")[0];
    if (name && !name.startsWith(".") && !name.startsWith("/"))
      imports.add(name);
  }

  for (const match of source.matchAll(
    /import\s+(?:[^'"`]+\s+from\s+)?(['"`])([^'"`]+)\1/g,
  )) {
    const specifier = String(match[2] || "");
    const root = specifier.startsWith("@")
      ? specifier.split("/").slice(0, 2).join("/")
      : specifier.split("/")[0];
    if (root && !root.startsWith(".") && !root.startsWith("/"))
      imports.add(root);
  }

  return Array.from(imports).sort((left, right) => left.localeCompare(right));
};

const buildFileAwareContext = async (repoData, question, githubToken) => {
  const owner = repoData?.owner;
  const repo = repoData?.name;
  const branch = repoData?.default_branch || "main";
  const structurePaths = getStructurePaths(repoData?.structure);

  if (!owner || !repo || structurePaths.length === 0) {
    return { context: "", matches: [] };
  }

  const prioritized = prioritizeFilePaths(structurePaths, question);
  const keywords = getQuestionKeywords(question);
  const intent = detectIntent(question);
  const fileMatches = [];
  let reads = 0;

  for (const filePath of prioritized) {
    if (reads >= MAX_DIRECT_FILE_READS) {
      break;
    }

    let content = "";
    try {
      content =
        (await getRawFileContent(owner, repo, branch, filePath, githubToken)) ||
        "";
    } catch {
      continue;
    }

    if (!content.trim()) {
      continue;
    }

    reads += 1;
    const lowerContent = content.toLowerCase();
    const hasKeywordHit =
      keywords.length === 0 ||
      keywords.some((keyword) => lowerContent.includes(keyword));

    if (!hasKeywordHit) {
      continue;
    }

    const imports = extractImportsFromContent(content);
    const functionNames = Array.from(
      new Set(
        [
          ...content.matchAll(/^\s*def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm),
          ...content.matchAll(/^\s*function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm),
          ...content.matchAll(
            /(?:const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*\(/g,
          ),
        ]
          .map((match) => (Array.isArray(match) ? match[1] : ""))
          .filter(Boolean),
      ),
    ).slice(0, 8);

    const frameworks = [
      "react",
      "electron",
      "vue",
      "tkinter",
      "flask",
      "express",
      "fastapi",
      "qt",
    ].filter((fw) => lowerContent.includes(fw));

    fileMatches.push({
      filePath,
      content: content.slice(0, MAX_FILE_SNIPPET_CHARS),
      imports,
      frameworks,
      functionNames,
      intent,
    });
  }

  if (!fileMatches.length) {
    return { context: "", matches: [] };
  }

  const relevantFiles = fileMatches.map((item) => item.filePath).join(", ");
  const context = [
    "Relevant Files:",
    relevantFiles || "None",
    "",
    ...fileMatches.map((item) => {
      const importsLine = item.imports.length
        ? `Imports: ${item.imports.join(", ")}`
        : "Imports: none detected";
      const frameworkLine = item.frameworks.length
        ? `Frameworks: ${item.frameworks.join(", ")}`
        : "Frameworks: none detected";
      const functionsLine = item.functionNames.length
        ? `Functions: ${item.functionNames.join(", ")}`
        : "Functions: none detected";
      return `File: ${item.filePath}\n${importsLine}\n${frameworkLine}\n${functionsLine}\n${item.content}`;
    }),
  ]
    .flat()
    .join("\n\n");

  return { context, matches: fileMatches };
};

const isTechQuestion = (question) => {
  const normalized = String(question || "").toLowerCase();
  return (
    normalized.includes("tech") ||
    normalized.includes("stack") ||
    normalized.includes("ui") ||
    normalized.includes("desktop")
  );
};

const getSummary = async (req, res) => {
  try {
    const { repoId } = req.params || {};
    if (!repoId) {
      return res.status(400).json({ message: "repoId is required" });
    }

    const cacheKey = `repo:summary:${repoId}`;
    const cached = await getCachedJson(cacheKey);
    if (cached?.summary) {
      return res.status(200).json({ summary: cached.summary, source: "cache" });
    }

    const repoData = await getRepositoryForAi(String(repoId));
    if (!repoData) {
      return res.status(404).json({ message: "Repository not found" });
    }

    if (repoData.summary && String(repoData.summary).trim()) {
      const existingSummary = String(repoData.summary).trim();
      await setCachedJson(
        cacheKey,
        { summary: existingSummary },
        CACHE_TTL_SECONDS,
      );

      return res
        .status(200)
        .json({ summary: existingSummary, source: "database" });
    }

    const summary = await generateSummary(repoData);
    await updateRepositorySummary(String(repoId), summary);
    await setCachedJson(cacheKey, { summary }, CACHE_TTL_SECONDS);

    return res.status(200).json({ summary, source: "llm" });
  } catch (error) {
    console.error("[getSummary] error", {
      message: error?.message || String(error),
      stack: error?.stack,
    });
    return res.status(500).json({ message: "Failed to generate summary" });
  }
};

const buildContextFromMatches = (matches = []) => {
  let context = "";

  for (const [index, match] of matches.entries()) {
    const metadata = match?.metadata || {};
    const filePath = metadata.filePath || metadata.file || "unknown-file";
    const snippet = metadata.snippet || metadata.text || "";
    const segment = `Source ${index + 1}: ${filePath}\n${snippet}\n\n`;

    if ((context + segment).length > MAX_CONTEXT_CHARS) {
      break;
    }

    context += segment;
  }

  return context.trim();
};

const buildFallbackContext = (repoData = {}) => {
  const summary = String(repoData?.summary || "").trim();
  const dependencies = repoData?.dependencies || {};

  return [
    "Summary:",
    summary || "No summary available.",
    "",
    "Dependencies:",
    JSON.stringify(dependencies || {}),
  ].join("\n");
};

const buildTechContext = (repoData = {}) => {
  const techStack = Array.isArray(repoData?.tech_stack)
    ? repoData.tech_stack
    : [];
  const dependencies = repoData?.dependencies || {};
  return [
    "Tech Stack:",
    techStack.length > 0 ? techStack.join(", ") : "Not found in code.",
    "",
    "Dependencies:",
    JSON.stringify(dependencies || {}),
  ].join("\n");
};

const normalizeAnswerText = (value) => {
  if (value == null) {
    return "";
  }

  if (typeof value !== "string") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.entries(parsed)
        .map(([key, entryValue]) => {
          if (entryValue == null || entryValue === "") {
            return `- ${key}`;
          }

          if (typeof entryValue === "object") {
            return `- ${key}: ${JSON.stringify(entryValue)}`;
          }

          return `- ${key} (${entryValue})`;
        })
        .join("\n");
    }
  } catch {
    // already plain text
  }

  return trimmed;
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

const extractSources = (matches = []) => {
  const unique = new Set();
  for (const match of matches) {
    const metadata = match?.metadata || {};
    const filePath = metadata.filePath || metadata.file;
    if (filePath) {
      unique.add(filePath);
    }
  }
  return Array.from(unique);
};

const inferDatabasesFromRepoData = (repoData = {}, fileMatches = []) => {
  const hits = new Set();
  const addHit = (value) => {
    const normalized = String(value || "").toLowerCase();
    if (!normalized) return;
    if (normalized.includes("supabase")) hits.add("Supabase (PostgreSQL)");
    if (normalized.includes("postgres") || normalized.includes("pg"))
      hits.add("PostgreSQL");
    if (normalized.includes("redis")) hits.add("Redis");
    if (normalized.includes("pinecone") || normalized.includes("pincone"))
      hits.add("Pinecone (vector database)");
    if (normalized.includes("mongodb") || normalized.includes("mongoose"))
      hits.add("MongoDB");
    if (normalized.includes("sqlite")) hits.add("SQLite");
    if (normalized.includes("mysql")) hits.add("MySQL");
  };

  const techStack = Array.isArray(repoData?.tech_stack)
    ? repoData.tech_stack
    : [];
  for (const tech of techStack) addHit(tech);

  const dependencies =
    repoData?.dependencies && typeof repoData.dependencies === "object"
      ? repoData.dependencies
      : {};
  for (const depName of Object.keys(dependencies)) addHit(depName);

  const structurePaths = getStructurePaths(repoData?.structure);
  for (const path of structurePaths) addHit(path);

  for (const match of fileMatches) {
    addHit(match?.filePath);
    for (const imported of Array.isArray(match?.imports) ? match.imports : []) {
      addHit(imported);
    }
    addHit(match?.content);
  }

  return Array.from(hits);
};

const buildDatabaseFallbackAnswer = (repoData = {}, fileMatches = []) => {
  const databases = inferDatabasesFromRepoData(repoData, fileMatches);
  if (databases.length === 0) {
    return "Not found in code.";
  }

  return [
    "Summary:",
    `Detected databases/services: ${databases.join(", ")}.`,
    "",
    "Key Points:",
    ...databases.map((db) => `- ${db}`),
    "",
    "Source:",
    "- tech_stack/dependencies/config files",
  ].join("\n");
};

const buildDeterministicAnswer = ({
  intent = "general",
  question = "",
  repoData = {},
  directMatches = [],
  vectorMatches = [],
}) => {
  if (intent === "db") {
    return buildDatabaseFallbackAnswer(repoData, directMatches);
  }

  const techStack = Array.isArray(repoData?.tech_stack)
    ? repoData.tech_stack
    : [];
  const dependencies =
    repoData?.dependencies && typeof repoData.dependencies === "object"
      ? repoData.dependencies
      : {};
  const dependencyNames = Object.keys(dependencies).slice(0, 15);
  const structurePaths = getStructurePaths(repoData?.structure).slice(0, 8);
  const directFiles = Array.isArray(directMatches)
    ? directMatches
        .map((item) => item?.filePath)
        .filter(Boolean)
        .slice(0, 6)
    : [];
  const vectorFiles = extractSources(vectorMatches).slice(0, 6);
  const sourceFiles = directFiles.length > 0 ? directFiles : vectorFiles;

  if (intent === "dependencies") {
    return [
      "Summary:",
      dependencyNames.length
        ? `Detected ${dependencyNames.length} dependencies from repository metadata.`
        : "Not found in code.",
      "",
      "Key Points:",
      ...(dependencyNames.length
        ? dependencyNames.map((name) => `- ${name}`)
        : ["- No dependencies found"]),
      "",
      "Source:",
      "- repository dependencies metadata",
    ].join("\n");
  }

  if (intent === "structure") {
    return [
      "Summary:",
      structurePaths.length
        ? "Repository structure inferred from analyzed file paths."
        : "Not found in code.",
      "",
      "Key Points:",
      ...(structurePaths.length
        ? structurePaths.map((path) => `- ${path}`)
        : ["- No structure paths available"]),
      "",
      "Source:",
      "- repository structure metadata",
    ].join("\n");
  }

  const summaryLine =
    String(repoData?.summary || "").trim() || "Not found in code.";

  return [
    "Summary:",
    summaryLine,
    "",
    "Key Points:",
    `- Intent: ${intent || "general"}`,
    techStack.length > 0
      ? `- Tech stack: ${techStack.join(", ")}`
      : "- Tech stack: Not found in code.",
    sourceFiles.length > 0
      ? `- Relevant files: ${sourceFiles.join(", ")}`
      : "- Relevant files: Not found in code.",
    dependencyNames.length > 0
      ? `- Dependencies sample: ${dependencyNames.slice(0, 5).join(", ")}`
      : "- Dependencies: Not found in code.",
    question ? `- Question: ${question}` : "",
    "",
    "Source:",
    "- repository metadata and indexed context",
  ]
    .filter(Boolean)
    .join("\n");
};

const chatWithRepo = async (req, res) => {
  try {
    const { repoId } = req.params || {};
    const question = req.body?.question;

    if (!repoId) {
      return res.status(400).json({ message: "repoId is required" });
    }

    if (!question || typeof question !== "string" || !question.trim()) {
      return res.status(400).json({ message: "question is required" });
    }

    const normalizedQuestion = question.trim();
    const intent = detectIntent(normalizedQuestion);
    const repoScoped = isRepoScopedQuestion(normalizedQuestion, intent);
    const cacheKey = `repo:chat:v4:${repoId}:${encodeURIComponent(normalizedQuestion)}`;
    const cached = await getCachedJson(cacheKey);
    if (cached?.answer) {
      return res.status(200).json({
        ...cached,
        source: "cache",
      });
    }

    let repoData = await getRepositoryForAi(String(repoId));
    if (!repoData && repoScoped) {
      return res.status(404).json({ message: "Repository not found" });
    }

    if (!repoData) {
      repoData = {
        structure: [],
        tech_stack: [],
        dependencies: {},
        summary: "",
      };
    }

    if (!repoScoped) {
      let answer = "";
      try {
        answer = await generateGeneralAnswer(normalizedQuestion, {
          techStack: repoData?.tech_stack || [],
        });
      } catch (error) {
        console.warn("[chatWithRepo] general LLM answer failed", {
          repoId,
          message: error?.message || String(error),
        });
        answer =
          "Summary:\nI could not reach the language model for a full answer.\n\nKey Points:\n- Please retry in a moment.\n- If you want code, include stack and component requirements.\n\nSource:\n- fallback";
      }

      const payload = {
        answer:
          normalizeAnswerText(answer) || "No clear answer could be generated.",
        confidence: "medium",
        type: "inferred",
        source: "general_llm",
      };
      await setCachedJson(cacheKey, payload, CACHE_TTL_SECONDS);
      return res.status(200).json(payload);
    }

    // Deterministic fast path for DB questions to avoid external provider failures.
    if (intent === "db") {
      const answer = buildDatabaseFallbackAnswer(repoData, []);
      const payload = {
        answer,
        confidence: answer === "Not found in code." ? "low" : "high",
        type: "context",
        source: "deterministic",
      };
      await setCachedJson(cacheKey, payload, CACHE_TTL_SECONDS);
      return res.status(200).json(payload);
    }

    const user = repoData?.user_id
      ? await getUserById(String(repoData.user_id))
      : null;
    const githubToken = String(user?.github_token || "").trim() || null;

    const directFileSearch = await buildFileAwareContext(
      repoData,
      normalizedQuestion,
      githubToken,
    );
    const directContext = directFileSearch.context;
    const hasDirectContext = Boolean(directContext);

    let matches = [];
    let pineconeContext = "";
    if (!hasDirectContext) {
      try {
        const questionEmbedding = await createEmbedding(normalizedQuestion);
        matches = await queryVectors(String(repoId), questionEmbedding, 2);
        pineconeContext = buildContextFromMatches(matches);
      } catch (error) {
        console.warn("[chatWithRepo] vector context unavailable", {
          repoId,
          message: error?.message || String(error),
        });
        matches = [];
        pineconeContext = "";
      }
    }

    const hasPineconeContext = Boolean(pineconeContext);
    const hasCodeContext = hasDirectContext || hasPineconeContext;
    const hasTechStack =
      Array.isArray(repoData?.tech_stack) && repoData.tech_stack.length > 0;
    const hasDependencies =
      repoData?.dependencies &&
      typeof repoData.dependencies === "object" &&
      Object.keys(repoData.dependencies).length > 0;
    const hasSummary = Boolean(String(repoData?.summary || "").trim());
    const hasRealRepoData =
      hasCodeContext || hasTechStack || hasDependencies || hasSummary;
    const techQuestion = isTechQuestion(normalizedQuestion);
    const codeContext = hasDirectContext ? directContext : pineconeContext;
    const context = hasCodeContext
      ? [
          "Relevant Files:",
          hasDirectContext
            ? directFileSearch.matches.map((item) => item.filePath).join(", ")
            : extractSources(matches).join(", ") || "Not found in code.",
          "",
          "Tech Stack:",
          Array.isArray(repoData?.tech_stack) && repoData.tech_stack.length > 0
            ? repoData.tech_stack.join(", ")
            : "Not found in code.",
          "",
          "Dependencies:",
          JSON.stringify(repoData?.dependencies || {}),
          "",
          "Relevant Code:",
          codeContext,
        ].join("\n")
      : [
          "Relevant Files:",
          "Not found in code.",
          "",
          "Tech Stack:",
          Array.isArray(repoData?.tech_stack) && repoData.tech_stack.length > 0
            ? repoData.tech_stack.join(", ")
            : "Not found in code.",
          "",
          "Dependencies:",
          JSON.stringify(repoData?.dependencies || {}),
          "",
          "Summary:",
          String(repoData?.summary || "").trim() || "No summary available.",
        ].join("\n");

    let answerText = "";
    let aiFallbackUsed = false;
    try {
      answerText = await generateChatAnswer(
        normalizedQuestion,
        context,
        {
          structure: repoData?.structure,
          tech_stack: repoData?.tech_stack || [],
          dependencies: repoData?.dependencies || {},
          summary: repoData?.summary || "",
        },
        buildQuestionHints(normalizedQuestion, intent),
      );
    } catch (aiError) {
      aiFallbackUsed = true;
      answerText = buildDeterministicAnswer({
        intent,
        question: normalizedQuestion,
        repoData,
        directMatches: directFileSearch.matches || [],
        vectorMatches: matches || [],
      });
      console.warn("[chatWithRepo] AI fallback used", {
        repoId,
        intent,
        message: aiError?.message || String(aiError),
      });
    }

    if (!answerText || !String(answerText).trim()) {
      aiFallbackUsed = true;
      answerText = buildDeterministicAnswer({
        intent,
        question: normalizedQuestion,
        repoData,
        directMatches: directFileSearch.matches || [],
        vectorMatches: matches || [],
      });
    }

    const normalizedAnswer =
      normalizeAnswerText(answerText || "") ||
      buildDeterministicAnswer({
        intent,
        question: normalizedQuestion,
        repoData,
        directMatches: directFileSearch.matches || [],
        vectorMatches: matches || [],
      });
    const confidence = techQuestion
      ? hasCodeContext ||
        (Array.isArray(repoData?.tech_stack) && repoData.tech_stack.length > 0)
        ? "high"
        : "low"
      : hasCodeContext
        ? "high"
        : "medium";
    let type = "inferred";
    if (hasRealRepoData && context && context.length > 50) {
      type = "context";
    }

    const source = aiFallbackUsed
      ? "deterministic"
      : techQuestion && hasTechStack
        ? "tech_stack"
        : hasDirectContext
          ? "file_match"
          : hasPineconeContext
            ? "code"
            : hasDependencies
              ? "dependencies"
              : hasSummary
                ? "summary"
                : "inferred";

    const payload = {
      answer: normalizedAnswer,
      confidence,
      type,
      source,
    };
    await setCachedJson(cacheKey, payload, CACHE_TTL_SECONDS);

    return res.status(200).json(payload);
  } catch (error) {
    console.error("[chatWithRepo] error", {
      message: error?.message || String(error),
      stack: error?.stack,
    });
    return res
      .status(500)
      .json({ message: "Failed to generate chat response" });
  }
};

export { getSummary, chatWithRepo };
