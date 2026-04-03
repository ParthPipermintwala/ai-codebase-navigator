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
  detectTechStack,
  getRawFileContent,
} from "../services/githubService.js";
import { getCachedJson, setCachedJson } from "../services/redisService.js";
import {
  insertRepository,
  bulkInsertContributors,
  bulkInsertCommits,
  bulkInsertIssues,
  getRepositoryById,
  getRepositoriesByUserId,
  getRepositoryStructureById,
  getRepositoryDependencyDataById,
} from "../services/supabaseService.js";
import { generateEmbedding, upsertVectors } from "../services/vectorService.js";
import { buildRepositoryMap } from "../services/mapService.js";
import { extractDependenciesFromRepository } from "../services/dependencyService.js";

const CACHE_TTL_SECONDS = 60 * 60;
const MAX_FILES = 30;
const FILE_PROCESS_BATCH_SIZE = 10;

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

const analyzeRepository = async (req, res) => {
  try {
    const { repoUrl } = req.body || {};
    const { owner, repo } = normalizeRepoUrl(repoUrl);
    const cacheKey = `repo:${owner}:${repo}`;

    const cached = await getCachedJson(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    const [metadata, contributors, commits, issues, languages] =
      await Promise.all([
        getRepoMetadata(owner, repo),
        safeArrayResult(() => getContributors(owner, repo)),
        safeArrayResult(() => getCommits(owner, repo)),
        safeArrayResult(() => getIssues(owner, repo)),
        safeObjectResult(() => getLanguages(owner, repo)),
      ]);

    const defaultBranch = metadata.default_branch;
    if (!defaultBranch) {
      throw new HttpError("Repository default branch not found", 422);
    }

    const treeResponse = await getRepoTree(owner, repo, defaultBranch);
    const fullTree = treeResponse?.tree || [];
    const totalFiles = fullTree.filter(
      (item) => item?.type === "blob" && item?.path,
    ).length;

    const selectedFiles = filterRelevantFiles(fullTree, MAX_FILES);
    const techStack = detectTechStack(fullTree);

    console.log(
      `[repo:${owner}/${repo}] file selection total=${totalFiles} filtered=${selectedFiles.length}`,
    );

    const repositoryRow = await insertRepository({
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
      structure: createStructurePayload(fullTree, selectedFiles),
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
    return res.status(200).json(responsePayload);
  } catch (error) {
    const message = error?.message || "Repository analysis failed";
    const statusCode = Number(error?.statusCode) || 500;

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
    const userId = req?.user?.id || req?.query?.userId;
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
      userId: req?.user?.id || req?.query?.userId,
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
      userId: req?.user?.id,
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

    const responsePayload = await extractDependenciesFromRepository(repository);
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

export {
  analyzeRepository,
  getRepository,
  getUserRepositories,
  getRepoMap,
  getDependencies,
};
