import {
  HttpError,
  normalizeRepoUrl,
  getRepoMetadata,
  getContributors,
  getCommits,
  getIssues,
  getLanguages,
  getRepoTree,
  filterRelevantFiles,
  getRawFileContent,
} from "../services/githubService.js";
import { getCachedJson, setCachedJson } from "../services/redisService.js";
import {
  insertRepository,
  bulkInsertContributors,
  bulkInsertCommits,
  bulkInsertIssues,
  getUserById,
  getRepositoryById,
  getRepositoriesByUserId,
  getRepositoryStructureById,
  getRepositoryDependencyDataById,
  getRepositoryForAi,
  getLatestRepositoryByOwnerAndName,
} from "../services/supabaseService.js";
import { generateEmbedding, upsertVectors } from "../services/vectorService.js";
import { buildRepositoryMap } from "../services/mapService.js";
import { extractDependenciesFromRepository } from "../services/dependencyService.js";
import {
  generateRepoTour,
  getRepoImpactService,
} from "../services/aiService.js";
import { analyzeRepositoryBugs } from "../services/bugDetectorService.js";

const CACHE_TTL_SECONDS = 60 * 60;
const TOUR_CACHE_VERSION = 3;
const MAX_FILES = 30;
const FILE_PROCESS_BATCH_SIZE = 10;

const NODE_MODULE_CORE_SKIP = new Set([
  "fs",
  "path",
  "os",
  "url",
  "http",
  "https",
  "crypto",
  "stream",
  "events",
  "util",
  "buffer",
  "child_process",
  "zlib",
  "net",
  "tls",
  "dns",
  "assert",
  "querystring",
  "timers",
  "readline",
  "process",
]);

const SOURCE_EXTENSIONS = new Set([
  ".py",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
]);

const safeArrayResult = async (request) => {
  try {
    const result = await request();
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
};

const safeObjectResult = async (request) => {
  try {
    const result = await request();
    return result && typeof result === "object" ? result : {};
  } catch {
    return {};
  }
};

const createStructurePayload = (tree, selectedFiles) => {
  const rootDirs = new Set();
  for (const item of tree) {
    if (!item?.path) {
      continue;
    }

    const topLevel = item.path.split("/")[0];
    if (topLevel) {
      rootDirs.add(topLevel);
    }
  }

  return {
    total_items: tree.length,
    selected_files_count: selectedFiles.length,
    selected_files: selectedFiles.map((file) => file.path),
    root_directories: Array.from(rootDirs),
  };
};

const toDependencyObject = (dependencyResponse) => {
  const result = {};
  const list = Array.isArray(dependencyResponse?.dependencies)
    ? dependencyResponse.dependencies
    : [];

  for (const item of list) {
    if (!item?.name) {
      continue;
    }

    result[item.name] = item.version || null;
  }

  return result;
};

const runInBatches = async (items, batchSize, handler) => {
  const output = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const current = items.slice(i, i + batchSize);
    const currentResults = await Promise.allSettled(current.map(handler));

    for (const result of currentResults) {
      if (result.status === "fulfilled" && result.value) {
        output.push(result.value);
      }
    }
  }

  return output;
};

const getFileExtension = (filePath) => {
  const lower = String(filePath || "").toLowerCase();
  const dotIndex = lower.lastIndexOf(".");
  return dotIndex === -1 ? "" : lower.slice(dotIndex);
};

const normalizeNodeImportName = (specifier) => {
  const value = String(specifier || "").trim();
  if (!value || value.startsWith(".") || value.startsWith("/")) {
    return null;
  }

  if (value.startsWith("node:")) {
    return null;
  }

  const root = value.startsWith("@")
    ? value.split("/").slice(0, 2).join("/")
    : value.split("/")[0];

  if (!root || NODE_MODULE_CORE_SKIP.has(root)) {
    return null;
  }

  return root;
};

const normalizePythonImportName = (specifier) => {
  const value = String(specifier || "").trim();
  if (!value) {
    return null;
  }

  return value.split(".")[0] || null;
};

const extractTechFromSource = (filePath, content, stack) => {
  const ext = getFileExtension(filePath);
  const source = String(content || "");

  if (!SOURCE_EXTENSIONS.has(ext) || !source.trim()) {
    return;
  }

  if (ext === ".py") {
    const lines = source.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.split("#")[0].trim();
      if (!line) {
        continue;
      }

      const importMatch = line.match(/^import\s+(.+)$/);
      if (importMatch?.[1]) {
        const parts = importMatch[1].split(",");
        for (const part of parts) {
          const name = normalizePythonImportName(part.split(/\s+as\s+/i)[0]);
          if (name) {
            stack.add(name);
          }
        }
      }

      const fromMatch = line.match(/^from\s+([a-zA-Z0-9_.]+)\s+import\s+/);
      if (fromMatch?.[1]) {
        const name = normalizePythonImportName(fromMatch[1]);
        if (name) {
          stack.add(name);
        }
      }
    }

    return;
  }

  const requireMatches = [...source.matchAll(/require\((['"`])([^'"`]+)\1\)/g)];
  for (const match of requireMatches) {
    const name = normalizeNodeImportName(match[2]);
    if (name) {
      stack.add(name);
    }
  }

  const importMatches = [
    ...source.matchAll(/import\s+(?:[^'"`]+\s+from\s+)?(['"`])([^'"`]+)\1/g),
  ];
  for (const match of importMatches) {
    const name = normalizeNodeImportName(match[2]);
    if (name) {
      stack.add(name);
    }
  }
};

const collectActualTechStack = async (
  files,
  owner,
  repo,
  defaultBranch,
  githubToken,
) => {
  const stack = new Set();
  const list = Array.isArray(files) ? files.slice(0, MAX_FILES) : [];

  await runInBatches(list, FILE_PROCESS_BATCH_SIZE, async (file) => {
    if (!file?.path) {
      return null;
    }

    const ext = getFileExtension(file.path);
    if (!SOURCE_EXTENSIONS.has(ext)) {
      return null;
    }

    try {
      const content = await getRawFileContent(
        owner,
        repo,
        defaultBranch,
        file.path,
        githubToken,
      );
      if (!content) {
        return null;
      }

      extractTechFromSource(file.path, content, stack);
    } catch (error) {
      console.warn(
        `[repo:${owner}/${repo}] tech detection failed for ${file.path}: ${error?.message || String(error)}`,
      );
    }

    return null;
  });

  return Array.from(stack).sort((left, right) => left.localeCompare(right));
};

const analyzeRepository = async (req, res) => {
  try {
    const userId = req?.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { repoUrl } = req.body || {};
    const { owner, repo } = normalizeRepoUrl(repoUrl);
    const cacheKey = `repo:user:${userId}:${owner}:${repo}`;
    const sharedCacheKey = `repo:shared:${owner}:${repo}`;
    const user = await getUserById(userId);
    const githubToken = String(user?.github_token || "").trim() || null;

    const cached = await getCachedJson(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    const sharedCached = await getCachedJson(sharedCacheKey);
    if (sharedCached) {
      await setCachedJson(cacheKey, sharedCached, CACHE_TTL_SECONDS);
      return res.status(200).json(sharedCached);
    }

    const [metadata, contributors, commits, issues, languages] =
      await Promise.all([
        getRepoMetadata(owner, repo, githubToken),
        safeArrayResult(() => getContributors(owner, repo, githubToken)),
        safeArrayResult(() => getCommits(owner, repo, githubToken)),
        safeArrayResult(() => getIssues(owner, repo, githubToken)),
        safeObjectResult(() => getLanguages(owner, repo, githubToken)),
      ]);

    const defaultBranch = metadata.default_branch;
    if (!defaultBranch) {
      throw new HttpError("Repository default branch not found", 422);
    }

    const treeResponse = await getRepoTree(
      owner,
      repo,
      defaultBranch,
      githubToken,
    );
    const fullTree = treeResponse?.tree || [];
    const totalFiles = fullTree.filter(
      (item) => item?.type === "blob" && item?.path,
    ).length;

    const selectedFiles = filterRelevantFiles(fullTree, MAX_FILES);
    const structurePayload = createStructurePayload(fullTree, selectedFiles);

    const structurePaths = fullTree
      .filter((item) => item?.type === "blob" && item?.path)
      .map((item) => item.path);

    const dependencyResponse = await extractDependenciesFromRepository({
      owner,
      name: repo,
      defaultBranch,
      structure: structurePaths,
      githubToken,
    }).catch((error) => {
      console.warn("[analyzeRepository] dependency extraction failed", {
        owner,
        repo,
        message: error?.message || String(error),
      });

      return { type: "unknown", dependencies: [] };
    });

    const dependencies = toDependencyObject(dependencyResponse);
    const techStack = await collectActualTechStack(
      selectedFiles,
      owner,
      repo,
      defaultBranch,
      githubToken,
    );

    console.log(
      `[repo:${owner}/${repo}] file selection total=${totalFiles} filtered=${selectedFiles.length}`,
    );

    const repositoryRow = await insertRepository({
      userId,
      repoUrl,
      name: repo,
      owner,
      defaultBranch,
      description: metadata.description,
      stars: metadata.stargazers_count,
      forks: metadata.forks_count,
      watchers: metadata.watchers_count,
      openIssues: metadata.open_issues_count,
      techStack,
      languages,
      structure: structurePayload,
      dependencies,
    });

    const repoId = String(repositoryRow.id);

    const contributorRows = contributors.map((item) => ({
      repo_id: repoId,
      username: item.login,
      contributions: Number(item.contributions || 0),
      avatar_url: item.avatar_url || null,
    }));

    const commitRows = commits
      .filter((item) => item?.sha && item?.commit)
      .map((item) => ({
        repo_id: repoId,
        message: item.commit.message || "",
        author: item.commit.author?.name || item.author?.login || "unknown",
        commit_hash: item.sha,
        date: item.commit.author?.date || null,
      }));

    const issueRows = issues
      .filter((item) => !item.pull_request)
      .map((item) => ({
        repo_id: repoId,
        title: item.title || "",
        state: item.state || "unknown",
        issue_number: Number(item.number || 0),
        created_at: item.created_at || null,
      }));

    await Promise.all([
      bulkInsertContributors(contributorRows),
      bulkInsertCommits(commitRows),
      bulkInsertIssues(issueRows),
    ]);

    const vectorCandidates = await runInBatches(
      selectedFiles,
      FILE_PROCESS_BATCH_SIZE,
      async (file) => {
        try {
          let content;
          try {
            content = await getRawFileContent(
              owner,
              repo,
              defaultBranch,
              file.path,
              githubToken,
            );
          } catch (error) {
            const message = error?.message || String(error);
            console.warn(
              `[repo:${owner}/${repo}] fetch failed for ${file.path}: ${message}`,
            );
            return null;
          }

          if (!content) {
            console.warn(
              `[repo:${owner}/${repo}] skipping file ${file.path}: empty or unavailable content`,
            );
            return null;
          }

          const snippet = (content || "").slice(0, 500);

          if (!snippet) {
            return null;
          }

          let embedding;
          try {
            embedding = await generateEmbedding(snippet);
          } catch (error) {
            const message = error?.message || String(error);
            console.warn(
              `[repo:${owner}/${repo}] embedding failed for ${file.path}: ${message}`,
            );
            return null;
          }

          if (!Array.isArray(embedding) || embedding.length === 0) {
            return null;
          }

          return {
            id: `${repoId}:${file.path}`,
            values: embedding,
            metadata: {
              file: file.path,
              snippet,
            },
          };
        } catch (error) {
          const message = error?.message || String(error);
          console.warn(
            `[repo:${owner}/${repo}] skipping file ${file.path}: ${message}`,
          );
          return null;
        }
      },
    );

    const vectors = vectorCandidates.filter(Boolean);
    console.log(`[repo:${owner}/${repo}] vectors created=${vectors.length}`);

    if (vectors.length > 0) {
      await upsertVectors(repoId, vectors);
    } else {
      console.log(
        `[repo:${owner}/${repo}] skipping Pinecone upsert because no vectors were created`,
      );
    }

    const { structure, created_at, ...safeRepositoryRow } = repositoryRow;
    const responsePayload = {
      repoId: String(safeRepositoryRow.id),
      message: "Repository analyzed successfully",
      remaining: "unlimited",
      ...safeRepositoryRow,
    };

    await setCachedJson(cacheKey, responsePayload, CACHE_TTL_SECONDS);
    await setCachedJson(sharedCacheKey, responsePayload, CACHE_TTL_SECONDS);
    return res.status(200).json(responsePayload);
  } catch (error) {
    const message = error?.message || "Repository analysis failed";
    const statusCode = Number(error?.statusCode) || 500;

    if (
      statusCode === 429 &&
      typeof req?.body?.repoUrl === "string" &&
      req?.body?.repoUrl.trim()
    ) {
      try {
        const { owner, repo } = normalizeRepoUrl(req.body.repoUrl);
        const existing = await getLatestRepositoryByOwnerAndName(owner, repo);

        if (existing) {
          const { structure, created_at, ...safeExisting } = existing;
          const responsePayload = {
            repoId: String(safeExisting.id),
            message:
              "Repository loaded from cache while GitHub rate limit is active",
            remaining: "unlimited",
            ...safeExisting,
          };

          await setCachedJson(
            `repo:user:${req?.user?.userId}:${owner}:${repo}`,
            responsePayload,
            CACHE_TTL_SECONDS,
          );
          await setCachedJson(
            `repo:shared:${owner}:${repo}`,
            responsePayload,
            CACHE_TTL_SECONDS,
          );

          return res.status(200).json(responsePayload);
        }
      } catch (fallbackError) {
        console.warn("[analyzeRepository] rate-limit fallback failed", {
          message: fallbackError?.message || String(fallbackError),
        });
      }
    }

    console.error("[analyzeRepository] unhandled error", {
      message,
      statusCode,
      stack: error?.stack,
      repoUrl: req?.body?.repoUrl,
    });

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
};

const getRepository = async (req, res) => {
  try {
    const { repoId } = req.params || {};
    if (!repoId) {
      return res.status(400).json({
        success: false,
        message: "repoId is required",
      });
    }

    const cacheKey = `repo:${repoId}`;
    const cached = await getCachedJson(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        data: cached,
        source: "cache",
      });
    }

    const repository = await getRepositoryById(repoId);
    if (!repository) {
      return res.status(404).json({
        success: false,
        message: "Repository not found",
      });
    }

    await setCachedJson(cacheKey, repository, CACHE_TTL_SECONDS);

    return res.status(200).json({
      success: true,
      data: repository,
      source: "database",
    });
  } catch (error) {
    const message = error?.message || "Failed to fetch repository";
    const statusCode = Number(error?.statusCode) || 500;

    console.error("[getRepository] error", {
      message,
      statusCode,
      stack: error?.stack,
      repoId: req?.params?.repoId,
    });

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
};

const getUserRepositories = async (req, res) => {
  try {
    const userId = req?.user?.userId || req?.query?.userId;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    const cacheKey = `repos:user:${userId}`;
    const cached = await getCachedJson(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        data: cached,
        source: "cache",
      });
    }

    const repositories = await getRepositoriesByUserId(userId);
    await setCachedJson(cacheKey, repositories, CACHE_TTL_SECONDS);

    return res.status(200).json({
      success: true,
      data: repositories,
      source: "database",
    });
  } catch (error) {
    const message = error?.message || "Failed to fetch user repositories";
    const statusCode = Number(error?.statusCode) || 500;

    console.error("[getUserRepositories] error", {
      message,
      statusCode,
      stack: error?.stack,
      userId: req?.user?.userId || req?.query?.userId,
    });

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
};

const getRepoMap = async (req, res) => {
  try {
    const { repoId } = req.params || {};

    if (!repoId) {
      return res.status(400).json({
        success: false,
        message: "repoId is required",
      });
    }

    const cacheKey = `repo:map:${repoId}`;
    const cached = await getCachedJson(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    const repository = await getRepositoryStructureById(repoId);
    if (!repository) {
      return res.status(404).json({
        success: false,
        message: "Repository not found",
      });
    }

    const map = buildRepositoryMap(repository.structure);
    await setCachedJson(cacheKey, map, CACHE_TTL_SECONDS);

    return res.status(200).json(map);
  } catch (error) {
    const message = error?.message || "Failed to build repository map";
    const statusCode = Number(error?.statusCode) || 500;

    console.error("[getRepoMap] error", {
      message,
      statusCode,
      stack: error?.stack,
      repoId: req?.params?.repoId,
      userId: req?.user?.userId,
    });

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
};

const getDependencies = async (req, res) => {
  try {
    const { repoId } = req.params || {};

    if (!repoId) {
      return res.status(400).json({
        success: false,
        message: "repoId is required",
      });
    }

    const cacheKey = `repo:deps:${repoId}`;
    const cached = await getCachedJson(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    const repository = await getRepositoryDependencyDataById(repoId);
    if (!repository) {
      return res.status(404).json({
        success: false,
        message: "Repository not found",
      });
    }

    const dependencyUser = repository?.user_id
      ? await getUserById(String(repository.user_id))
      : null;
    const responsePayload = await extractDependenciesFromRepository({
      ...repository,
      githubToken: String(dependencyUser?.github_token || "").trim() || null,
    });
    await setCachedJson(cacheKey, responsePayload, CACHE_TTL_SECONDS);

    return res.status(200).json(responsePayload);
  } catch (error) {
    const message = error?.message || "Failed to extract dependencies";
    const statusCode = Number(error?.statusCode) || 500;

    console.error("[getDependencies] error", {
      message,
      statusCode,
      stack: error?.stack,
      repoId: req?.params?.repoId,
    });

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
};

const getRepoTour = async (req, res) => {
  try {
    const { repoId } = req.params || {};
    if (!repoId) {
      return res.status(400).json({
        success: false,
        message: "repoId is required",
      });
    }

    const cacheKey = `repo:tour:v${TOUR_CACHE_VERSION}:${repoId}`;
    const cached = await getCachedJson(cacheKey);
    if (cached?.steps) {
      return res.status(200).json({
        success: true,
        tour: cached,
        source: "cache",
      });
    }

    const tour = await generateRepoTour(String(repoId));
    await setCachedJson(cacheKey, tour, CACHE_TTL_SECONDS);

    return res.status(200).json({
      success: true,
      tour,
      source: "llm",
    });
  } catch (error) {
    const message = error?.message || "Failed to generate repository tour";
    const statusCode =
      message.includes("not found") || message.includes("Repository")
        ? 404
        : Number(error?.statusCode) || 500;

    console.error("[getRepoTour] error", {
      message,
      statusCode,
      stack: error?.stack,
      repoId: req?.params?.repoId,
    });

    const fallbackTour = {
      steps: [
        {
          title: "Repository Tour Unavailable",
          description:
            "Tour generation failed. Try running analysis again in a moment.",
          files: [],
        },
      ],
    };

    if (statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: "Repository not found",
      });
    }

    return res.status(200).json({
      success: true,
      tour: fallbackTour,
      source: "fallback",
    });
  }
};

const getRepoImpact = async (req, res) => {
  try {
    const { repoId } = req.params || {};
    const rawTarget = req?.body?.target;
    const target = String(rawTarget || "").trim();

    if (!repoId) {
      return res.status(400).json({
        success: false,
        message: "repoId is required",
      });
    }

    if (!target) {
      return res.status(400).json({
        success: false,
        message: "target is required",
      });
    }

    const cacheKey = `repo:impact:v2:${repoId}:${target.toLowerCase()}`;
    const cached = await getCachedJson(cacheKey);
    if (cached?.target && Array.isArray(cached?.impact)) {
      return res.status(200).json({
        success: true,
        impact: cached,
        source: "cache",
      });
    }

    const impact = await getRepoImpactService(String(repoId), target);
    await setCachedJson(cacheKey, impact, CACHE_TTL_SECONDS);

    return res.status(200).json({
      success: true,
      impact,
      source: impact?.source || "analysis",
    });
  } catch (error) {
    const message = error?.message || "Failed to analyze repository impact";
    const normalizedMessage = String(message).toLowerCase();
    const statusCode =
      normalizedMessage.includes("not found") ||
      normalizedMessage.includes("repository")
        ? 404
        : normalizedMessage.includes("target not found")
          ? 400
          : Number(error?.statusCode) || 500;

    console.error("[getRepoImpact] error", {
      message,
      statusCode,
      stack: error?.stack,
      repoId: req?.params?.repoId,
      target: req?.body?.target,
    });

    if (statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: "Repository not found",
      });
    }

    if (statusCode === 400) {
      return res.status(400).json({
        success: false,
        message,
      });
    }

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
};

const getRepoBugs = async (req, res) => {
  try {
    const { repoId } = req.params || {};
    const includeTestFixture = Boolean(
      req?.body?.includeTestFixture || req?.query?.includeTestFixture,
    );
    if (!repoId) {
      return res.status(400).json({
        success: false,
        message: "repoId is required",
      });
    }

    const cacheKey = `repo:bugs:v6:${repoId}:${includeTestFixture ? "fixture" : "real"}`;
    const cached = await getCachedJson(cacheKey);
    if (cached?.findings) {
      return res.status(200).json({
        success: true,
        bugReport: cached,
        source: "cache",
      });
    }

    const repoData = await getRepositoryForAi(String(repoId));
    if (!repoData) {
      return res.status(404).json({
        success: false,
        message: "Repository not found",
      });
    }

    const user = repoData?.user_id
      ? await getUserById(String(repoData.user_id))
      : null;
    const githubToken = String(user?.github_token || "").trim() || null;

    const bugReport = await analyzeRepositoryBugs(repoData, githubToken, {
      includeTestFixture,
    });
    await setCachedJson(cacheKey, bugReport, CACHE_TTL_SECONDS);

    return res.status(200).json({
      success: true,
      bugReport,
      source: "repository-scan",
    });
  } catch (error) {
    const message = error?.message || "Failed to analyze repository bugs";
    const normalizedMessage = String(message).toLowerCase();
    const statusCode = normalizedMessage.includes("not found")
      ? 404
      : Number(error?.statusCode) || 500;

    console.error("[getRepoBugs] error", {
      message,
      statusCode,
      stack: error?.stack,
      repoId: req?.params?.repoId,
    });

    if (statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: "Repository not found",
      });
    }

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
};

export {
  analyzeRepository,
  getRepository,
  getUserRepositories,
  getRepoMap,
  getDependencies,
  getRepoTour,
  getRepoImpact,
  getRepoBugs,
};
