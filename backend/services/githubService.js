const GITHUB_API_BASE = "https://api.github.com";
const RELEVANT_EXTENSIONS = new Set([".js", ".ts", ".py", ".json"]);
const IGNORED_SEGMENTS = new Set(["node_modules", "dist", "build"]);

class HttpError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

const githubHeaders = () => {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "ai-code-nav",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
};

const normalizeRepoUrl = (repoUrl) => {
  if (typeof repoUrl !== "string") {
    throw new HttpError("repoUrl must be a string", 400);
  }

  const trimmed = repoUrl.trim();
  if (!trimmed) {
    throw new HttpError("repoUrl is required", 400);
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new HttpError("Invalid GitHub repository URL", 400);
  }

  if (!/(^|\.)github\.com$/i.test(parsed.hostname)) {
    throw new HttpError("repoUrl must be a github.com URL", 400);
  }

  const parts = parsed.pathname.replace(/\/+$/, "").split("/").filter(Boolean);

  if (parts.length < 2) {
    throw new HttpError("repoUrl must include owner and repository name", 400);
  }

  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, "");

  if (!owner || !repo) {
    throw new HttpError("Unable to extract owner/repo from repoUrl", 400);
  }

  return { owner, repo };
};

const githubRequest = async (path) => {
  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    method: "GET",
    headers: githubHeaders(),
  });

  if (!response.ok) {
    const message =
      response.status === 404
        ? "Repository not found"
        : `GitHub API error (${response.status})`;
    throw new HttpError(message, response.status);
  }

  return response.json();
};

const getRepoMetadata = async (owner, repo) => {
  return githubRequest(`/repos/${owner}/${repo}`);
};

const getContributors = async (owner, repo) => {
  return githubRequest(`/repos/${owner}/${repo}/contributors?per_page=10`);
};

const getCommits = async (owner, repo) => {
  return githubRequest(`/repos/${owner}/${repo}/commits?per_page=10`);
};

const getIssues = async (owner, repo) => {
  return githubRequest(`/repos/${owner}/${repo}/issues?state=all&per_page=10`);
};

const getLanguages = async (owner, repo) => {
  return githubRequest(`/repos/${owner}/${repo}/languages`);
};

const getRepoTree = async (owner, repo, branch) => {
  return githubRequest(
    `/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
  );
};

const hasRelevantExtension = (filePath) => {
  const lower = filePath.toLowerCase();
  for (const ext of RELEVANT_EXTENSIONS) {
    if (lower.endsWith(ext)) {
      return true;
    }
  }
  return false;
};

const hasIgnoredSegment = (filePath) => {
  const segments = filePath.split("/");
  return segments.some((segment) =>
    IGNORED_SEGMENTS.has(segment.toLowerCase()),
  );
};

const isInSrcFolder = (filePath) => {
  const normalized = filePath.toLowerCase();
  return (
    normalized === "src" ||
    normalized.startsWith("src/") ||
    normalized.includes("/src/")
  );
};

const filterRelevantFiles = (tree = [], maxFiles = 50) => {
  const candidates = [];

  for (const item of tree) {
    if (item?.type !== "blob" || !item.path) {
      continue;
    }

    if (hasIgnoredSegment(item.path)) {
      continue;
    }

    if (!hasRelevantExtension(item.path)) {
      continue;
    }

    candidates.push({
      path: item.path,
      sha: item.sha,
      isSrc: isInSrcFolder(item.path),
    });
  }

  candidates.sort((left, right) => {
    if (left.isSrc !== right.isSrc) {
      return left.isSrc ? -1 : 1;
    }

    return left.path.localeCompare(right.path);
  });

  return candidates.slice(0, maxFiles).map(({ isSrc, ...file }) => file);
};

const detectTechStack = (tree = []) => {
  const stack = new Set();

  for (const item of tree) {
    if (item?.type !== "blob" || !item.path) {
      continue;
    }

    const lowerPath = item.path.toLowerCase();
    if (lowerPath === "package.json" || lowerPath.endsWith("/package.json")) {
      stack.add("Node.js");
    }
    if (
      lowerPath === "requirements.txt" ||
      lowerPath.endsWith("/requirements.txt")
    ) {
      stack.add("Python");
    }
    if (lowerPath.endsWith(".java")) {
      stack.add("Java");
    }
  }

  return Array.from(stack);
};

const getRawFileContent = async (owner, repo, branch, filePath) => {
  const encodedPath = filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${encodedPath}`;
  try {
    const response = await fetch(rawUrl, {
      method: "GET",
      headers: {
        "User-Agent": "ai-code-nav",
      },
    });

    if (!response.ok) {
      return null;
    }

    return response.text();
  } catch (error) {
    throw new HttpError(
      `Failed to fetch file: ${filePath} (${error?.message || "network error"})`,
      502,
    );
  }
};

export {
  HttpError,
  normalizeRepoUrl,
  getRepoMetadata,
  getContributors,
  getCommits,
  getIssues,
  getLanguages,
  getRepoTree,
  filterRelevantFiles,
  detectTechStack,
  getRawFileContent,
};
