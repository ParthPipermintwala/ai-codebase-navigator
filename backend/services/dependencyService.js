import { HttpError } from "./githubService.js";

const normalizeStructurePaths = (structure) => {
  if (Array.isArray(structure)) {
    return structure;
  }

  if (structure && typeof structure === "object") {
    if (Array.isArray(structure.selected_files)) {
      return structure.selected_files;
    }
  }

  return [];
};

const detectDependencyFile = (structure) => {
  const paths = normalizeStructurePaths(structure);
  const normalized = new Map();
  const byBasename = new Map();

  for (const path of paths) {
    if (typeof path !== "string" || !path.trim()) {
      continue;
    }

    const cleaned = path.trim();
    const lower = cleaned.toLowerCase();
    if (!normalized.has(lower)) {
      normalized.set(lower, cleaned);
    }

    const base = lower.split("/").pop();
    if (base && !byBasename.has(base)) {
      byBasename.set(base, cleaned);
    }
  }

  const priority = [
    { name: "package.json", type: "node" },
    { name: "pyproject.toml", type: "python" },
    { name: "requirements.txt", type: "python" },
    { name: "pom.xml", type: "java" },
    { name: "build.gradle", type: "java" },
    { name: "composer.json", type: "php" },
    { name: "go.mod", type: "go" },
    { name: "package-lock.json", type: "node", lockfileOnly: true },
  ];

  for (const spec of priority) {
    const exact = normalized.get(spec.name);
    if (exact) {
      return {
        type: spec.type,
        filePath: exact,
        lockfileOnly: spec.lockfileOnly || false,
      };
    }

    const byBase = byBasename.get(spec.name);
    if (byBase) {
      return {
        type: spec.type,
        filePath: byBase,
        lockfileOnly: spec.lockfileOnly || false,
      };
    }
  }

  return { type: "unknown", filePath: null };
};

const getRawGithubFile = async ({ owner, repo, branch, filePath }) => {
  const encodedPath = filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  const branchCandidates = [];
  const seenBranches = new Set();

  for (const candidate of [branch, "main", "master"]) {
    if (typeof candidate !== "string") {
      continue;
    }

    const trimmed = candidate.trim();
    if (!trimmed || seenBranches.has(trimmed)) {
      continue;
    }

    seenBranches.add(trimmed);
    branchCandidates.push(trimmed);
  }

  let lastStatus = 404;
  for (const currentBranch of branchCandidates) {
    const url = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(currentBranch)}/${encodedPath}`;

    let response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "ai-code-nav",
        },
      });
    } catch (error) {
      throw new HttpError(
        `Failed to fetch dependency file: ${error?.message || "network error"}`,
        502,
      );
    }

    if (response.ok) {
      return response.text();
    }

    lastStatus = response.status;
    if (response.status !== 404) {
      throw new HttpError(
        `Failed to fetch dependency file (${response.status})`,
        response.status,
      );
    }
  }

  throw new HttpError(
    `Failed to fetch dependency file (${lastStatus})`,
    lastStatus,
  );
};

const parseNodeDependencies = (content, lockfileOnly = false) => {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new HttpError("Invalid JSON in dependency file", 422);
  }

  const output = [];
  const seen = new Set();

  if (lockfileOnly) {
    const lockDeps = parsed.dependencies || {};
    for (const [name, versionObj] of Object.entries(lockDeps)) {
      if (typeof name === "string" && name.trim()) {
        const version =
          typeof versionObj === "object"
            ? versionObj?.version || ""
            : String(versionObj);
        if (!seen.has(name)) {
          seen.add(name);
          output.push({ name, version: version || null });
        }
      }
    }

    const packages = parsed.packages || {};
    for (const [key, pkgObj] of Object.entries(packages)) {
      if (!key.startsWith("node_modules/")) {
        continue;
      }

      const name = key.slice("node_modules/".length).trim();
      if (!name || seen.has(name)) {
        continue;
      }

      const version =
        typeof pkgObj === "object" ? pkgObj?.version || null : null;
      seen.add(name);
      output.push({ name, version });
    }

    return output.sort((a, b) => a.name.localeCompare(b.name));
  }

  const deps = parsed.dependencies || {};
  const devDeps = parsed.devDependencies || {};

  for (const [name, version] of Object.entries(deps)) {
    if (typeof name === "string" && name.trim() && !seen.has(name)) {
      seen.add(name);
      output.push({ name, version: String(version || "") || null });
    }
  }

  for (const [name, version] of Object.entries(devDeps)) {
    if (typeof name === "string" && name.trim() && !seen.has(name)) {
      seen.add(name);
      output.push({ name, version: String(version || "") || null });
    }
  }

  return output.sort((a, b) => a.name.localeCompare(b.name));
};

const parsePythonDependencies = (content) => {
  const output = [];
  const seen = new Set();
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const withoutComment = rawLine.split("#")[0].trim();
    if (!withoutComment) {
      continue;
    }

    const match = withoutComment.match(/^([a-zA-Z0-9._-]+)(.*)/);
    if (!match) {
      continue;
    }

    const name = match[1].trim();
    const rest = match[2].trim();

    if (!name || seen.has(name)) {
      continue;
    }

    let version = null;
    if (rest) {
      const versionMatch = rest.match(/^[=!<>~]+(.+?)(?:\s|$)/);
      if (versionMatch) {
        version = versionMatch[1].trim().split(/[\s,]/)[0];
      }
    }

    seen.add(name);
    output.push({ name, version: version || null });
  }

  return output.sort((a, b) => a.name.localeCompare(b.name));
};

const parseJavaDependencies = (content) => {
  const output = [];
  const seen = new Set();
  const dependencyBlocks =
    content.match(/<dependency>[\s\S]*?<\/dependency>/g) || [];

  for (const block of dependencyBlocks) {
    const artifactMatch = block.match(/<artifactId>([^<]+)<\/artifactId>/);
    const versionMatch = block.match(/<version>([^<]+)<\/version>/);

    if (!artifactMatch?.[1]) {
      continue;
    }

    const name = artifactMatch[1].trim();
    const version = versionMatch?.[1]?.trim() || null;

    if (!seen.has(name)) {
      seen.add(name);
      output.push({ name, version });
    }
  }

  return output.sort((a, b) => a.name.localeCompare(b.name));
};

const parseGradleDependencies = (content) => {
  const output = [];
  const seen = new Set();
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const withoutComment = rawLine.split("//")[0].trim();
    if (!withoutComment) {
      continue;
    }

    const impMatch = withoutComment.match(
      /(?:implementation|api|testImplementation)\s+['"]([^:'"]+):([^:'"]+):([^'"]+)['"]/,
    );
    if (impMatch) {
      const name = `${impMatch[1]}:${impMatch[2]}`;
      const version = impMatch[3];

      if (!seen.has(name)) {
        seen.add(name);
        output.push({ name, version });
      }
    }
  }

  return output.sort((a, b) => a.name.localeCompare(b.name));
};

const parsePyprojectToml = (content) => {
  const output = [];
  const seen = new Set();

  let inDependencies = false;
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.includes("[project]") || line.includes("[tool.poetry]")) {
      inDependencies = false;
    }

    if (
      line.includes("dependencies") ||
      line.includes("[tool.poetry.dependencies]")
    ) {
      inDependencies = true;
      continue;
    }

    if (line.startsWith("[") && inDependencies) {
      inDependencies = false;
    }

    if (!inDependencies || !line || line.startsWith("#")) {
      continue;
    }

    const match = line.match(/^([a-zA-Z0-9._-]+)\s*=\s*["']([^"']+)["']/);
    if (!match) {
      continue;
    }

    const name = match[1].trim();
    const version = match[2].trim();

    if (!seen.has(name)) {
      seen.add(name);
      output.push({ name, version: version || null });
    }
  }

  return output.sort((a, b) => a.name.localeCompare(b.name));
};

const parseComposerDependencies = (content) => {
  const output = [];
  const seen = new Set();

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    return [];
  }

  const deps = {};
  if (parsed.require && typeof parsed.require === "object") {
    Object.assign(deps, parsed.require);
  }

  if (parsed["require-dev"] && typeof parsed["require-dev"] === "object") {
    Object.assign(deps, parsed["require-dev"]);
  }

  for (const [name, version] of Object.entries(deps)) {
    if (
      typeof name === "string" &&
      name.trim() &&
      !seen.has(name) &&
      !name.startsWith("php")
    ) {
      seen.add(name);
      output.push({ name, version: String(version) || null });
    }
  }

  return output.sort((a, b) => a.name.localeCompare(b.name));
};

const parseGoModDependencies = (content) => {
  const output = [];
  const seen = new Set();
  const lines = content.split(/\r?\n/);

  let inRequire = false;
  for (const line of lines) {
    if (line.trim().startsWith("require (")) {
      inRequire = true;
      continue;
    }

    if (inRequire && line.trim() === ")") {
      inRequire = false;
      continue;
    }

    if (inRequire || line.trim().startsWith("require ")) {
      const cleanLine = line.replace(/^require\s+/, "").trim();
      if (!cleanLine || cleanLine.startsWith("(") || cleanLine === ")") {
        continue;
      }

      const parts = cleanLine.split(/\s+/);
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const version = parts[1].trim();

        if (!seen.has(name)) {
          seen.add(name);
          output.push({ name, version });
        }
      }
    }
  }

  return output.sort((a, b) => a.name.localeCompare(b.name));
};

const extractDependenciesFromRepository = async ({
  owner,
  name,
  defaultBranch,
  structure,
  tech_stack,
}) => {
  let detected = detectDependencyFile(structure);
  const paths = normalizeStructurePaths(structure);
  const hasPythonSource = paths.some((path) =>
    String(path || "")
      .toLowerCase()
      .endsWith(".py"),
  );

  // Fallback: if Python source exists but no dependency file detected, try common paths
  if (!detected.filePath && hasPythonSource) {
    detected = {
      type: "python",
      filePath: "requirements.txt",
      lockfileOnly: false,
    };
  }

  if (!detected.filePath || detected.type === "unknown") {
    return {
      type: "unknown",
      dependencies: [],
    };
  }

  const rawContent = await getRawGithubFile({
    owner,
    repo: name,
    branch: defaultBranch,
    filePath: detected.filePath,
  }).catch((error) => {
    if (Number(error?.statusCode) === 404) {
      return null;
    }

    throw error;
  });

  if (rawContent === null) {
    return {
      type: detected.type,
      dependencies: [],
    };
  }

  let dependencies = [];

  if (detected.type === "node") {
    dependencies = parseNodeDependencies(rawContent, detected.lockfileOnly);
  } else if (detected.type === "python") {
    const fileName = detected.filePath.toLowerCase().split("/").pop();
    if (fileName === "pyproject.toml") {
      dependencies = parsePyprojectToml(rawContent);
    } else {
      dependencies = parsePythonDependencies(rawContent);
    }
  } else if (detected.type === "java") {
    const fileName = detected.filePath.toLowerCase().split("/").pop();
    if (fileName === "build.gradle") {
      dependencies = parseGradleDependencies(rawContent);
    } else {
      dependencies = parseJavaDependencies(rawContent);
    }
  } else if (detected.type === "php") {
    dependencies = parseComposerDependencies(rawContent);
  } else if (detected.type === "go") {
    dependencies = parseGoModDependencies(rawContent);
  }

  return {
    type: detected.type,
    dependencies: dependencies || [],
  };
};

export { extractDependenciesFromRepository };
