import { getIssues, getRawFileContent } from "./githubService.js";

const MAX_FILES = Number(process.env.BUG_DETECTOR_MAX_FILES || 0);
const MAX_FINDINGS = Number(process.env.BUG_DETECTOR_MAX_FINDINGS || 0);
const ISSUE_SIGNAL_LIMIT = 6;
const TEST_FIXTURE_FILE = "test-fixture/bug-detector";

const SOURCE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".py",
  ".json",
  ".yml",
  ".yaml",
  ".html",
]);

const SEVERITY_SCORE = {
  high: 3,
  medium: 2,
  low: 1,
};

const normalizeStructurePaths = (structure) => {
  if (Array.isArray(structure)) {
    return structure.filter((path) => typeof path === "string");
  }

  if (structure && typeof structure === "object") {
    if (Array.isArray(structure.selected_files)) {
      return structure.selected_files.filter(
        (path) => typeof path === "string",
      );
    }

    if (Array.isArray(structure.paths)) {
      return structure.paths.filter((path) => typeof path === "string");
    }
  }

  return [];
};

const getFileExtension = (filePath) => {
  const lower = String(filePath || "").toLowerCase();
  const dotIndex = lower.lastIndexOf(".");
  return dotIndex === -1 ? "" : lower.slice(dotIndex);
};

const scorePath = (filePath) => {
  const lower = String(filePath || "").toLowerCase();
  let score = 0;

  if (lower.includes("/src/")) score += 70;
  if (lower.startsWith("src/")) score += 60;
  if (lower.includes("/app/")) score += 30;
  if (lower.includes("/components/")) score += 50;
  if (lower.includes("/pages/")) score += 45;
  if (lower.includes("/routes/")) score += 45;
  if (lower.includes("/controllers/")) score += 45;
  if (lower.includes("/controller/")) score += 45;
  if (lower.includes("/services/")) score += 35;
  if (lower.includes("/utils/")) score += 25;
  if (lower.includes("/config/")) score += 40;
  if (lower.endsWith("package.json")) score += 90;
  if (lower.endsWith("requirements.txt")) score += 90;
  if (lower.endsWith("pyproject.toml")) score += 90;

  return score;
};

const getFileName = (filePath) => {
  const parts = String(filePath || "").split(/[\\/]/);
  return parts[parts.length - 1].toLowerCase();
};

const isEnvironmentFile = (filePath) => {
  const fileName = getFileName(filePath);
  return (
    fileName === ".env" ||
    fileName.startsWith(".env.") ||
    fileName === ".npmrc" ||
    fileName === "credentials.json" ||
    fileName === "service-account.json"
  );
};

const isConfigOrSecretFile = (filePath) => {
  const ext = getFileExtension(filePath);
  return (
    isEnvironmentFile(filePath) ||
    [".json", ".yml", ".yaml", ".ini", ".toml"].includes(ext)
  );
};

const isIgnoredNoisePath = (filePath) => {
  const lower = String(filePath || "").toLowerCase();
  const fileName = getFileName(filePath);
  return (
    /(^|[\\/])node_modules([\\/]|$)/.test(lower) ||
    /(^|[\\/])\.git([\\/]|$)/.test(lower) ||
    fileName === "package-lock.json" ||
    fileName === "yarn.lock" ||
    fileName === "pnpm-lock.yaml" ||
    fileName === "bun.lockb"
  );
};

const collectCandidateFiles = (structure, maxFiles = MAX_FILES) => {
  const paths = normalizeStructurePaths(structure);
  const unique = Array.from(new Set(paths));

  const ranked = unique
    .filter((path) => !isIgnoredNoisePath(path))
    .filter(
      (path) =>
        SOURCE_EXTENSIONS.has(getFileExtension(path)) ||
        isConfigOrSecretFile(path),
    )
    .map((path) => ({ path, score: scorePath(path) }))
    .sort(
      (left, right) =>
        (isEnvironmentFile(right.path) ? 40 : 0) -
          (isEnvironmentFile(left.path) ? 40 : 0) ||
        right.score - left.score ||
        left.path.localeCompare(right.path),
    );

  return (
    Number(maxFiles) > 0 ? ranked.slice(0, Number(maxFiles)) : ranked
  ).map((entry) => entry.path);
};

const linesFromContent = (content) => String(content || "").split(/\r?\n/);

const makeSnippet = (lines, lineNumber, radius = 2) => {
  const start = Math.max(0, lineNumber - 1 - radius);
  const end = Math.min(lines.length, lineNumber + radius);
  return lines
    .slice(start, end)
    .map(
      (line, index) =>
        `${String(start + index + 1).padStart(4, "0")} | ${line}`,
    )
    .join("\n");
};

const createFindingId = (filePath, line, title) =>
  `${String(filePath || "unknown").toLowerCase()}:${line || 0}:${String(title || "finding").toLowerCase()}`;

const TYPE_PRIORITY = {
  "environment-exposure": 50,
  "secret-exposure": 45,
  security: 40,
  "information-disclosure": 35,
  repo_issue: 20,
  logic: 10,
  maintenance: 5,
  "error-handling": 1,
};

const createFinding = ({
  type,
  severity,
  title,
  description,
  filePath,
  line,
  recommendation,
  confidence = "medium",
  evidence,
  snippet,
  issueNumber = null,
  labels = [],
}) => ({
  id: createFindingId(filePath, line, title),
  type,
  severity,
  title,
  description,
  filePath: filePath || null,
  line: Number(line || 0) || null,
  recommendation,
  confidence,
  evidence: evidence || null,
  snippet: snippet || null,
  issueNumber,
  labels,
});

const isPlaceholderSecretValue = (value) => {
  const text = String(value || "").trim();
  if (!text) {
    return true;
  }

  return /^(<.*>|your[-_ ]?||changeme|change_me|example|sample|test|dummy|placeholder|replace_me|replace-me|xxx+|__.+__|\$\{.+\})$/i.test(
    text,
  );
};

const isSensitiveConfigKey = (key) =>
  /(^|[_-])(api[_-]?key|secret|password|private[_-]?key|client[_-]?secret|access[_-]?token|auth[_-]?token|webhook[_-]?secret|token)([_-]|$)/i.test(
    String(key || ""),
  );

const MONGODB_URI_PATTERN = /mongodb(?:\+srv)?:\/\/[^\s"'`]+/i;
const MONGODB_URI_WITH_CREDENTIALS_PATTERN =
  /mongodb(?:\+srv)?:\/\/[^\s"'`:@]+:[^\s"'`@]+@/i;

const hasMongoConnectionString = (text) =>
  MONGODB_URI_PATTERN.test(String(text || ""));
const hasMongoCredentialsInUri = (text) =>
  MONGODB_URI_WITH_CREDENTIALS_PATTERN.test(String(text || ""));

const scanConfigLikeFile = (filePath, content) => {
  const lines = linesFromContent(content);
  const findings = [];
  const fileName = getFileName(filePath);

  if (isEnvironmentFile(filePath) && !fileName.startsWith(".env.example")) {
    const secretLine = lines.findIndex((rawLine) => {
      const line = rawLine.trim();
      return (
        line &&
        !line.startsWith("#") &&
        /\b[A-Z0-9_]+\s*=\s*.+/.test(line) &&
        !/\b(?:example|sample|placeholder|your[_-]?|changeme|change_me)\b/i.test(
          line,
        )
      );
    });

    findings.push(
      createFinding({
        type: "environment-exposure",
        severity: "high",
        title: "Environment file committed to repository",
        description:
          "This repository contains a live environment file or secret config file, which can expose API keys, tokens, or credentials.",
        filePath,
        line: secretLine >= 0 ? secretLine + 1 : 1,
        recommendation:
          "Remove real secrets from the repo, replace them with placeholder values, and keep the actual values only in deployment environment settings.",
        confidence: "high",
        evidence: fileName,
        snippet: makeSnippet(lines, secretLine >= 0 ? secretLine + 1 : 1),
      }),
    );

    return findings;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();

    if (!line || line.startsWith("#") || line.startsWith("//")) {
      continue;
    }

    const envMatch = line.match(/^([A-Z0-9_\-]+)\s*=\s*(.+)$/);
    const jsonMatch = line.match(
      /^"?([A-Za-z0-9_\-]+)"?\s*:\s*"?([^",}#]+)"?,?$/,
    );

    const key = String((envMatch || jsonMatch)?.[1] || "").toLowerCase();
    const value = String((envMatch || jsonMatch)?.[2] || "").trim();

    if (!key || isPlaceholderSecretValue(value)) {
      continue;
    }

    if (hasMongoConnectionString(value)) {
      findings.push(
        createFinding({
          type: "secret-exposure",
          severity: hasMongoCredentialsInUri(value) ? "high" : "medium",
          title: hasMongoCredentialsInUri(value)
            ? "MongoDB URI includes embedded username/password"
            : "Hardcoded MongoDB URI in config",
          description: hasMongoCredentialsInUri(value)
            ? "The MongoDB connection string contains plaintext credentials in source-controlled config."
            : "A MongoDB connection string is hardcoded in config and should typically be sourced from environment variables.",
          filePath,
          line: index + 1,
          recommendation:
            "Move the full MongoDB URI to an environment variable (for example MONGODB_URI) and never commit credentials to repository files.",
          confidence: "high",
          evidence: line,
          snippet: makeSnippet(lines, index + 1),
        }),
      );
      continue;
    }

    if (
      isSensitiveConfigKey(key) ||
      /-----begin [a-z ]*private key-----/i.test(value) ||
      /(ghp_|github_pat_|sk-[a-z0-9]{16,}|AIza[0-9A-Za-z\-_]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[0-9A-Za-z-]+|eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})/.test(
        value,
      )
    ) {
      findings.push(
        createFinding({
          type: "secret-exposure",
          severity: "high",
          title: "Secret-like value is stored in a config file",
          description:
            "This config file contains a secret-like value that should usually live in a deployment secret store or environment variable instead of source control.",
          filePath,
          line: index + 1,
          recommendation:
            "Replace the value with a placeholder and load the real secret from an environment variable or secret manager at runtime.",
          confidence: "high",
          evidence: line,
          snippet: makeSnippet(lines, index + 1),
        }),
      );
    }
  }

  return findings;
};

const createTestFixtureFinding = () =>
  createFinding({
    type: "security",
    severity: "high",
    title: "Synthetic bug fixture enabled",
    description:
      "This is a deliberately injected bug fixture used to verify the Bug Detector UI, filtering, and severity rendering.",
    filePath: TEST_FIXTURE_FILE,
    line: 42,
    recommendation:
      "Disable the fixture flag after testing and rely on real repository findings for normal scans.",
    confidence: "high",
    evidence: "fixture=true",
    snippet:
      "0040 | // synthetic fixture\n0041 | // used for UI testing\n0042 | const bugFixture = true;\n0043 | // remove after testing",
  });

const isHandlingKeywordPresent = (blockText) =>
  /console\.(error|warn|log|info)|throw|logger|notify|report|reject|next\s*\(|res\.(status|json|send|end|redirect)/i.test(
    blockText,
  );

const SENSITIVE_IDENTIFIER_PATTERN =
  /(api[_-]?key|secret|token|password|private[_-]?key|client[_-]?secret|access[_-]?token|auth[_-]?token)/i;

const LEAK_CHANNEL_PATTERN =
  /(console\.(log|info|warn|error)|res\.(json|send|status)|return\s+res\.|localStorage\.setItem|sessionStorage\.setItem|document\.cookie|window\.)/i;

const isLikelySecretExposure = (line) => {
  const text = String(line || "");
  return (
    SENSITIVE_IDENTIFIER_PATTERN.test(text) &&
    LEAK_CHANNEL_PATTERN.test(text) &&
    /(=|:)/.test(text) &&
    !/process\.env\.|import\.meta\.env\.|os\.environ|os\.getenv/i.test(text)
  );
};

const isLikelyDisclosureMessage = (line) => {
  const text = String(line || "");
  return (
    /(errorMessage|message|details|reason)\s*[:=]/i.test(text) &&
    /(error\.message|errorText|stack|response\.data|responseText|reason|findError\.message|insertError\.message)/i.test(
      text,
    )
  );
};

const isLikelyErrorLeak = (line) => {
  const text = String(line || "");
  return (
    /(res\.(json|send|status)|return\s+res\.|throw\s+new\s+Error|console\.(log|warn|error)|logger\.(error|warn))/i.test(
      text,
    ) &&
    /(error\.message|errorText|stack|details|reason|response\.data|responseText|findError\.message|insertError\.message)/i.test(
      text,
    )
  );
};

const isHardcodedMongoUriLine = (line) => {
  const text = String(line || "");
  return (
    hasMongoConnectionString(text) &&
    !/process\.env\.|import\.meta\.env\./i.test(text)
  );
};

const extractBlock = (lines, startIndex) => {
  const collected = [];
  let started = false;
  let depth = 0;

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index];
    collected.push(line);

    for (const char of line) {
      if (char === "{") {
        started = true;
        depth += 1;
      } else if (char === "}") {
        depth -= 1;
      }
    }

    if (started && depth <= 0) {
      return {
        text: collected.join("\n"),
        endIndex: index,
      };
    }
  }

  return {
    text: collected.join("\n"),
    endIndex: lines.length - 1,
  };
};

const scanJavaScriptLikeFile = (filePath, content) => {
  const lines = linesFromContent(content);
  const findings = [];

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();

    if (!line || line.startsWith("//") || line.startsWith("*")) {
      continue;
    }

    if (
      /dangerouslySetInnerHTML/.test(rawLine) ||
      /\binnerHTML\s*=/.test(rawLine)
    ) {
      findings.push(
        createFinding({
          type: "security",
          severity: "high",
          title: "Unsafe HTML rendering path",
          description:
            "This file injects HTML directly, which can expose the application to XSS if the content is not fully sanitized.",
          filePath,
          line: index + 1,
          recommendation:
            "Prefer escaped text rendering or sanitize the HTML through a trusted, audited sanitizer before insertion.",
          confidence: "high",
          evidence: rawLine.trim(),
          snippet: makeSnippet(lines, index + 1),
        }),
      );
    }

    if (isHardcodedMongoUriLine(rawLine)) {
      findings.push(
        createFinding({
          type: "secret-exposure",
          severity: hasMongoCredentialsInUri(rawLine) ? "high" : "medium",
          title: hasMongoCredentialsInUri(rawLine)
            ? "MongoDB URI includes embedded username/password"
            : "Hardcoded MongoDB connection URI",
          description: hasMongoCredentialsInUri(rawLine)
            ? "This MongoDB connection string includes plaintext credentials directly in code."
            : "This code line hardcodes a MongoDB URI instead of loading it from environment variables.",
          filePath,
          line: index + 1,
          recommendation:
            "Store MongoDB URI in environment variables and keep credentials out of source code and logs.",
          confidence: "high",
          evidence: rawLine.trim(),
          snippet: makeSnippet(lines, index + 1),
        }),
      );
    }

    if (isLikelySecretExposure(rawLine)) {
      findings.push(
        createFinding({
          type: "security",
          severity: "high",
          title: "Secret or API key may be exposed",
          description:
            "This line appears to send, log, or persist a sensitive credential such as an API key, token, password, or private key.",
          filePath,
          line: index + 1,
          recommendation:
            "Keep secrets server-side only. Do not log them, return them to the client, or store them in browser-accessible state.",
          confidence: "high",
          evidence: rawLine.trim(),
          snippet: makeSnippet(lines, index + 1),
        }),
      );
    }

    if (isLikelyDisclosureMessage(rawLine) || isLikelyErrorLeak(rawLine)) {
      findings.push(
        createFinding({
          type: "information-disclosure",
          severity: "high",
          title: "Sensitive error details may be disclosed",
          description:
            "This line appears to expose internal error details, upstream service reasons, or stack data to logs or user-facing responses.",
          filePath,
          line: index + 1,
          recommendation:
            "Return a generic user-facing message, keep detailed diagnostics in server logs, and avoid forwarding raw exception text or stack traces.",
          confidence: "high",
          evidence: rawLine.trim(),
          snippet: makeSnippet(lines, index + 1),
        }),
      );
    }

    if (/\beval\s*\(/.test(rawLine) || /\bnew Function\s*\(/.test(rawLine)) {
      findings.push(
        createFinding({
          type: "security",
          severity: "high",
          title: "Dynamic code execution detected",
          description:
            "Dynamic evaluation can execute arbitrary code and is usually unsafe in application code.",
          filePath,
          line: index + 1,
          recommendation:
            "Replace dynamic evaluation with explicit parsing, configuration maps, or vetted interpreters.",
          confidence: "high",
          evidence: rawLine.trim(),
          snippet: makeSnippet(lines, index + 1),
        }),
      );
    }

    if (/\bfetch\s*\(/.test(rawLine)) {
      const lookahead = lines
        .slice(index, Math.min(lines.length, index + 12))
        .join("\n");

      // ✅ Enhanced detection: .json() called BEFORE .ok check
      const jsonIndex = lookahead.indexOf(".json()");
      const okCheckIndex =
        lookahead.indexOf("response.ok") + lookahead.indexOf("!response.ok");
      const hasGuard =
        /response\.ok|!response\.ok|throw\s+new\s+Error|status\s*>=\s*400|response\.status/.test(
          lookahead,
        );

      // Only flag if .json() is found and NO guard exists before it
      if (jsonIndex > -1 && !hasGuard) {
        findings.push(
          createFinding({
            type: "error-handling",
            severity: "high",
            title: "❌ CRITICAL: Fetch returns JSON before checking status",
            description:
              "EXACT ISSUE: Line calls .json() on response BEFORE checking if response.ok is true. If server returns error (4xx/5xx), parsing error HTML as JSON will crash the app.\n\nPROBLEM LINE: response.json() is called unconditionally\nSHOULD BE: Check if(response.ok) FIRST, then call response.json()",
            filePath,
            line: index + 1,
            recommendation:
              "IMMEDIATE FIX:\n1. Check: if (!response.ok) { throw new Error(...) }\n2. Then: const data = await response.json()\n\nExample:\nconst res = await fetch(...)\nif (!res.ok) throw new Error(`API failed: ${res.status}`)\nconst data = await res.json()",
            confidence: "high",
            evidence: rawLine.trim(),
            snippet: makeSnippet(lines, index + 1),
          }),
        );
      }
    }

    if (/catch\s*\([^)]*\)\s*\{/.test(rawLine) || /^catch\s*\{/.test(line)) {
      const block = extractBlock(lines, index);
      const blockText = block.text;
      const hasMeaningfulHandling = isHandlingKeywordPresent(blockText);
      const isEffectivelyEmpty = !/\S/.test(
        blockText.replace(/catch\s*\([^)]*\)\s*\{|catch\s*\{/g, ""),
      );

      if (!hasMeaningfulHandling && isEffectivelyEmpty) {
        findings.push(
          createFinding({
            type: "error-handling",
            severity: "medium",
            title: "Empty catch block hides failures",
            description:
              "This catch block does not log, rethrow, or recover from the failure, so the runtime error can disappear without a trace.",
            filePath,
            line: index + 1,
            recommendation:
              "Log the error, rethrow it, or return a safe fallback so the failure stays visible.",
            confidence: "high",
            evidence: block.text.split(/\r?\n/)[0].trim(),
            snippet: makeSnippet(lines, index + 1),
          }),
        );
      }
      index = block.endIndex;
      continue;
    }

    if (/\bTODO\b|\bFIXME\b|\bHACK\b/.test(rawLine)) {
      findings.push(
        createFinding({
          type: "maintenance",
          severity: "low",
          title: "Unresolved implementation note",
          description:
            "The file contains a TODO/FIXME/HACK marker that may hide an unfinished or risky path.",
          filePath,
          line: index + 1,
          recommendation:
            "Track the marker as a task or replace it with a concrete implementation before release.",
          confidence: "medium",
          evidence: rawLine.trim(),
          snippet: makeSnippet(lines, index + 1),
        }),
      );
    }
  }

  return findings;
};

const scanPythonFile = (filePath, content) => {
  const lines = linesFromContent(content);
  const findings = [];

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    if (/^except\s*:/.test(line)) {
      findings.push(
        createFinding({
          type: "error-handling",
          severity: "high",
          title: "Bare except hides runtime failures",
          description:
            "A bare except clause can mask exceptions that should be handled explicitly.",
          filePath,
          line: index + 1,
          recommendation:
            "Catch explicit exception types and handle or re-raise them with useful context.",
          confidence: "high",
          evidence: rawLine.trim(),
          snippet: makeSnippet(lines, index + 1),
        }),
      );
    }

    if (
      /(api[_-]?key|secret|token|password|private[_-]?key|client[_-]?secret|access[_-]?token|auth[_-]?token)\s*[:=]\s*['"`][^'"`]{8,}['"`]/i.test(
        line,
      ) &&
      !/process\.env\.|os\.environ|os\.getenv/i.test(line)
    ) {
      findings.push(
        createFinding({
          type: "security",
          severity: "high",
          title: "Hardcoded secret detected",
          description:
            "A credential-like value appears to be hardcoded directly in the source code.",
          filePath,
          line: index + 1,
          recommendation:
            "Move secrets into environment variables or a secret manager and load them server-side only.",
          confidence: "high",
          evidence: rawLine.trim(),
          snippet: makeSnippet(lines, index + 1),
        }),
      );
    }

    if (
      /(res\.(json|send)|return\s+res\.|throw\s+new\s+Error|console\.(log|warn|error))/i.test(
        rawLine,
      ) &&
      /(error\.message|errorText|stack|details|reason|response\.data|responseText|findError\.message|insertError\.message)/i.test(
        rawLine,
      )
    ) {
      findings.push(
        createFinding({
          type: "information-disclosure",
          severity: "high",
          title: "Sensitive error details may be disclosed",
          description:
            "This line appears to expose internal exception text or upstream service details in logs or a user-facing response.",
          filePath,
          line: index + 1,
          recommendation:
            "Use a generic user-facing message and keep the detailed error only in server logs.",
          confidence: "high",
          evidence: rawLine.trim(),
          snippet: makeSnippet(lines, index + 1),
        }),
      );
    }

    if (/^def\s+\w+\s*\([^)]*\w+\s*=\s*(\[\]|\{\})/.test(line)) {
      findings.push(
        createFinding({
          type: "logic",
          severity: "high",
          title: "Mutable default argument detected",
          description:
            "Using a list or dict as a default function argument can cause state to leak between calls.",
          filePath,
          line: index + 1,
          recommendation:
            "Use None as the default value and create a new list or dict inside the function.",
          confidence: "high",
          evidence: rawLine.trim(),
          snippet: makeSnippet(lines, index + 1),
        }),
      );
    }

    if (/^except\s+Exception(?:\s+as\s+\w+)?\s*:/.test(line)) {
      const lookahead = lines
        .slice(index + 1, Math.min(lines.length, index + 5))
        .join("\n");
      if (/^\s*pass\s*$/m.test(lookahead)) {
        findings.push(
          createFinding({
            type: "error-handling",
            severity: "medium",
            title: "Exception is ignored with pass",
            description:
              "This exception handler swallows errors and may hide a failure that should be surfaced or logged.",
            filePath,
            line: index + 1,
            recommendation:
              "Log the exception or raise a domain-specific error instead of using pass.",
            confidence: "medium",
            evidence: rawLine.trim(),
            snippet: makeSnippet(lines, index + 1),
          }),
        );
      }
    }
  }

  return findings;
};

const scanTextFile = (filePath, content) => {
  const ext = getFileExtension(filePath);
  if (isConfigOrSecretFile(filePath)) {
    return scanConfigLikeFile(filePath, content);
  }

  if ([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"].includes(ext)) {
    return scanJavaScriptLikeFile(filePath, content);
  }

  if (ext === ".py") {
    return scanPythonFile(filePath, content);
  }

  return [];
};

const summarizeIssueLabels = (issue) =>
  Array.isArray(issue?.labels)
    ? issue.labels
        .map((label) => String(label?.name || label || "").trim())
        .filter(Boolean)
    : [];

const isBugLikeIssue = (issue) => {
  const title = String(issue?.title || "").toLowerCase();
  const labels = summarizeIssueLabels(issue).map((label) =>
    label.toLowerCase(),
  );

  return (
    labels.some((label) => label.includes("bug") || label.includes("error")) ||
    /bug|error|crash|fail|broken|exception|issue/.test(title)
  );
};

const severityFromIssue = (issue) => {
  const title = String(issue?.title || "").toLowerCase();
  const labels = summarizeIssueLabels(issue).map((label) =>
    label.toLowerCase(),
  );

  if (labels.some((label) => label.includes("critical"))) {
    return "high";
  }

  if (
    labels.some((label) => label.includes("bug")) ||
    /crash|broken|exception/.test(title)
  ) {
    return "high";
  }

  if (/fail|error/.test(title)) {
    return "medium";
  }

  return "low";
};

const analyzeRepositoryBugs = async (repoData, githubToken, options = {}) => {
  const owner = String(repoData?.owner || "").trim();
  const repo = String(repoData?.name || "").trim();
  const branch = String(repoData?.default_branch || "main").trim() || "main";
  const structurePaths = normalizeStructurePaths(repoData?.structure);
  const maxFiles =
    Number.isFinite(Number(options?.maxFiles)) && Number(options?.maxFiles) > 0
      ? Number(options.maxFiles)
      : MAX_FILES;
  const maxFindings =
    Number.isFinite(Number(options?.maxFindings)) &&
    Number(options?.maxFindings) > 0
      ? Number(options.maxFindings)
      : MAX_FINDINGS;

  const candidateFiles = collectCandidateFiles(repoData?.structure, maxFiles);
  const includeTestFixture = Boolean(options?.includeTestFixture);

  const findings = [];
  const fileFindings = [];

  for (const filePath of candidateFiles) {
    try {
      const content = await getRawFileContent(
        owner,
        repo,
        branch,
        filePath,
        githubToken,
      );
      if (!content || !String(content).trim()) {
        continue;
      }

      const nextFindings = scanTextFile(filePath, content);
      if (nextFindings.length > 0) {
        fileFindings.push(filePath);
        findings.push(...nextFindings);
      }
    } catch {
      // Ignore unreadable files and keep scanning.
    }
  }

  let openBugSignals = [];
  try {
    const issues = await getIssues(owner, repo, githubToken);
    openBugSignals = Array.isArray(issues)
      ? issues
          .filter(
            (issue) =>
              issue?.state === "open" &&
              !issue?.pull_request &&
              isBugLikeIssue(issue),
          )
          .slice(0, ISSUE_SIGNAL_LIMIT)
      : [];
  } catch {
    openBugSignals = [];
  }

  for (const issue of openBugSignals) {
    const labels = summarizeIssueLabels(issue);
    const severity = severityFromIssue(issue);
    findings.push(
      createFinding({
        type: "repo_issue",
        severity,
        title: `Open GitHub issue #${issue.number}: ${String(issue.title || "Untitled issue")}`,
        description:
          String(issue.body || "")
            .trim()
            .slice(0, 240) ||
          "This open issue is tagged or worded like a bug signal in the repository.",
        filePath: null,
        line: null,
        recommendation:
          "Review this issue alongside the relevant code path and reproduce it locally before shipping changes.",
        confidence: "high",
        evidence: `state=${issue.state}; labels=${labels.join(", ") || "none"}`,
        snippet: null,
        issueNumber: Number(issue.number || 0) || null,
        labels,
      }),
    );
  }

  const deduped = [];
  const seen = new Set();
  for (const finding of findings) {
    const key = `${finding.type}:${finding.filePath || "issue"}:${finding.line || 0}:${finding.title}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(finding);
  }

  if (includeTestFixture) {
    deduped.unshift(createTestFixtureFinding());
  }

  deduped.sort((left, right) => {
    const leftPriority = TYPE_PRIORITY[left.type] || 0;
    const rightPriority = TYPE_PRIORITY[right.type] || 0;
    if (rightPriority !== leftPriority) {
      return rightPriority - leftPriority;
    }

    const severityDelta =
      (SEVERITY_SCORE[right.severity] || 0) -
      (SEVERITY_SCORE[left.severity] || 0);
    if (severityDelta !== 0) {
      return severityDelta;
    }

    if ((left.filePath || "") !== (right.filePath || "")) {
      return String(left.filePath || "").localeCompare(
        String(right.filePath || ""),
      );
    }

    return String(left.title || "").localeCompare(String(right.title || ""));
  });

  const finalFindings =
    maxFindings > 0 ? deduped.slice(0, maxFindings) : deduped;
  const severityCounts = finalFindings.reduce(
    (accumulator, finding) => {
      accumulator[finding.severity] = (accumulator[finding.severity] || 0) + 1;
      return accumulator;
    },
    { high: 0, medium: 0, low: 0 },
  );

  return {
    repository: {
      owner,
      name: repo,
      branch,
    },
    summary: {
      scannedFiles: candidateFiles.length,
      sourceFiles: fileFindings.length,
      totalFindings: finalFindings.length,
      high: severityCounts.high,
      medium: severityCounts.medium,
      low: severityCounts.low,
      issueSignals: openBugSignals.length,
      testFixtureEnabled: includeTestFixture,
    },
    findings: finalFindings,
    filesScanned: candidateFiles,
    sourceFiles: fileFindings,
    issueSignals: openBugSignals.slice(0, ISSUE_SIGNAL_LIMIT).map((issue) => ({
      number: issue.number,
      title: issue.title,
      labels: summarizeIssueLabels(issue),
      state: issue.state,
      url: issue.html_url || null,
    })),
    source: "repository-scan",
    testFixtureEnabled: includeTestFixture,
    metadata: {
      structureFiles: structurePaths.length,
      scanLimits: {
        maxFiles: maxFiles > 0 ? maxFiles : "all",
        maxFindings: maxFindings > 0 ? maxFindings : "all",
      },
    },
  };
};

export { analyzeRepositoryBugs };
