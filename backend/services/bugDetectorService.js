import { getIssues, getRawFileContent } from "./githubService.js";

const MAX_FILES = 40;
const MAX_FINDINGS = 12;
const ISSUE_SIGNAL_LIMIT = 6;

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
      return structure.selected_files.filter((path) => typeof path === "string");
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

const collectCandidateFiles = (structure, maxFiles = MAX_FILES) => {
  const paths = normalizeStructurePaths(structure);
  const unique = Array.from(new Set(paths));

  return unique
    .filter((path) => SOURCE_EXTENSIONS.has(getFileExtension(path)))
    .map((path) => ({ path, score: scorePath(path) }))
    .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
    .slice(0, maxFiles)
    .map((entry) => entry.path);
};

const linesFromContent = (content) => String(content || "").split(/\r?\n/);

const makeSnippet = (lines, lineNumber, radius = 2) => {
  const start = Math.max(0, lineNumber - 1 - radius);
  const end = Math.min(lines.length, lineNumber + radius);
  return lines
    .slice(start, end)
    .map((line, index) => `${String(start + index + 1).padStart(4, "0")} | ${line}`)
    .join("\n");
};

const createFindingId = (filePath, line, title) =>
  `${String(filePath || "unknown").toLowerCase()}:${line || 0}:${String(title || "finding").toLowerCase()}`;

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

const isHandlingKeywordPresent = (blockText) =>
  /console\.(error|warn|log)|throw|return|setError|logger|notify|report|reject/i.test(blockText);

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

    if (/dangerouslySetInnerHTML/.test(rawLine) || /\binnerHTML\s*=/.test(rawLine)) {
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
      const lookahead = lines.slice(index, Math.min(lines.length, index + 12)).join("\n");
      if (/response\.json\s*\(/.test(lookahead) && !/response\.ok|!response\.ok|throw\s+new\s+Error|status\s*>=\s*400/.test(lookahead)) {
        findings.push(
          createFinding({
            type: "error-handling",
            severity: "medium",
            title: "Fetch response is parsed without status guard",
            description:
              "The request result is consumed without a visible HTTP status check, so non-2xx responses may be parsed as successful data.",
            filePath,
            line: index + 1,
            recommendation:
              "Check response.ok before parsing JSON and surface actionable errors for non-success responses.",
            confidence: "medium",
            evidence: rawLine.trim(),
            snippet: makeSnippet(lines, index + 1),
          }),
        );
      }
    }

    if (/catch\s*\([^)]*\)\s*\{/.test(rawLine) || /^catch\s*\{/.test(line)) {
      const block = extractBlock(lines, index);
      if (!isHandlingKeywordPresent(block.text)) {
        findings.push(
          createFinding({
            type: "error-handling",
            severity: "medium",
            title: "Catch block appears to swallow errors",
            description:
              "This catch block does not visibly report, rethrow, or recover from the failure, which can hide runtime bugs.",
            filePath,
            line: index + 1,
            recommendation:
              "Log the error, rethrow it, or return a recoverable fallback so failures remain visible.",
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
      const lookahead = lines.slice(index + 1, Math.min(lines.length, index + 5)).join("\n");
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
  const labels = summarizeIssueLabels(issue).map((label) => label.toLowerCase());

  return (
    labels.some((label) => label.includes("bug") || label.includes("error")) ||
    /bug|error|crash|fail|broken|exception|issue/.test(title)
  );
};

const severityFromIssue = (issue) => {
  const title = String(issue?.title || "").toLowerCase();
  const labels = summarizeIssueLabels(issue).map((label) => label.toLowerCase());

  if (labels.some((label) => label.includes("critical"))) {
    return "high";
  }

  if (labels.some((label) => label.includes("bug")) || /crash|broken|exception/.test(title)) {
    return "high";
  }

  if (/fail|error/.test(title)) {
    return "medium";
  }

  return "low";
};

const analyzeRepositoryBugs = async (repoData, githubToken) => {
  const owner = String(repoData?.owner || "").trim();
  const repo = String(repoData?.name || "").trim();
  const branch = String(repoData?.default_branch || "main").trim() || "main";
  const structurePaths = normalizeStructurePaths(repoData?.structure);
  const candidateFiles = collectCandidateFiles(repoData?.structure, MAX_FILES);

  const findings = [];
  const fileFindings = [];

  for (const filePath of candidateFiles) {
    try {
      const content = await getRawFileContent(owner, repo, branch, filePath, githubToken);
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
          .filter((issue) => issue?.state === "open" && !issue?.pull_request && isBugLikeIssue(issue))
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
          String(issue.body || "").trim().slice(0, 240) ||
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

  deduped.sort((left, right) => {
    const severityDelta = (SEVERITY_SCORE[right.severity] || 0) - (SEVERITY_SCORE[left.severity] || 0);
    if (severityDelta !== 0) {
      return severityDelta;
    }

    if ((left.filePath || "") !== (right.filePath || "")) {
      return String(left.filePath || "").localeCompare(String(right.filePath || ""));
    }

    return String(left.title || "").localeCompare(String(right.title || ""));
  });

  const topFindings = deduped.slice(0, MAX_FINDINGS);
  const severityCounts = topFindings.reduce(
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
      totalFindings: topFindings.length,
      high: severityCounts.high,
      medium: severityCounts.medium,
      low: severityCounts.low,
      issueSignals: openBugSignals.length,
    },
    findings: topFindings,
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
    metadata: {
      structureFiles: structurePaths.length,
    },
  };
};

export { analyzeRepositoryBugs };