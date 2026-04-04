import supabase from "../config/supabase.js";
import { HttpError } from "./githubService.js";

const REPOSITORY_DETAIL_FIELDS =
  "id, user_id, repo_url, name, owner, default_branch, description, stars, forks, watchers, open_issues, tech_stack, languages, structure, dependencies, summary, created_at";
const REPOSITORY_LIST_FIELDS =
  "id, user_id, repo_url, name, owner, default_branch, description, stars, forks, watchers, open_issues, tech_stack, languages, dependencies, summary, created_at";
const USER_FIELDS = "*";

const insertRepository = async ({
  userId,
  repoUrl,
  name,
  owner,
  defaultBranch,
  description,
  stars,
  forks,
  watchers,
  openIssues,
  techStack,
  languages,
  structure,
  dependencies,
}) => {
  const payload = {
    user_id: userId,
    repo_url: repoUrl,
    name,
    owner,
    default_branch: defaultBranch,
    description: description || null,
    stars: Number(stars || 0),
    forks: Number(forks || 0),
    watchers: Number(watchers || 0),
    open_issues: Number(openIssues || 0),
    tech_stack: techStack,
    languages,
    structure,
    dependencies: dependencies || {},
  };

  const { data, error } = await supabase
    .from("repositories")
    .upsert(payload, { onConflict: "repo_url" })
    .select()
    .single();

  if (error) {
    throw new Error(`Supabase upsert failed: ${error.message}`);
  }

  return data;
};

const bulkInsertContributors = async (contributors) => {
  if (!contributors.length) {
    return;
  }

  const { error } = await supabase.from("contributors").insert(contributors);
  if (error) {
    throw new HttpError(
      `Supabase contributors insert failed: ${error.message}`,
      500,
    );
  }
};

const bulkInsertCommits = async (commits) => {
  if (!commits.length) {
    return;
  }

  const { error } = await supabase.from("commits").insert(commits);
  if (error) {
    throw new HttpError(
      `Supabase commits insert failed: ${error.message}`,
      500,
    );
  }
};

const bulkInsertIssues = async (issues) => {
  if (!issues.length) {
    return;
  }

  const { error } = await supabase.from("issues").insert(issues);
  if (error) {
    throw new HttpError(`Supabase issues insert failed: ${error.message}`, 500);
  }
};

const getRepositoryById = async (repoId) => {
  const { data, error } = await supabase
    .from("repositories")
    .select(REPOSITORY_DETAIL_FIELDS)
    .eq("id", repoId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }

    throw new HttpError(
      `Supabase repository fetch failed: ${error.message}`,
      500,
    );
  }

  return data;
};

const getRepositoriesByUserId = async (userId) => {
  const { data, error } = await supabase
    .from("repositories")
    .select(REPOSITORY_LIST_FIELDS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new HttpError(
      `Supabase repositories fetch failed: ${error.message}`,
      500,
    );
  }

  return Array.isArray(data) ? data : [];
};

const getRepositoryStructureById = async (repoId) => {
  const { data, error } = await supabase
    .from("repositories")
    .select("id, name, owner, description, structure, dependencies, summary")
    .eq("id", repoId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }

    throw new HttpError(
      `Supabase repository structure fetch failed: ${error.message}`,
      500,
    );
  }

  return data;
};

const getRepositoryDependencyDataById = async (repoId) => {
  if (!repoId || typeof repoId !== "string" || !repoId.trim()) {
    throw new HttpError("Invalid repoId provided", 400);
  }

  const query = supabase
    .from("repositories")
    .select(
      "user_id, owner, name, default_branch, structure, tech_stack, dependencies, summary",
    )
    .eq("id", repoId);

  const { data, error } = await query.single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }

    const message = error?.message || "Unknown error";
    throw new HttpError(
      `Supabase repository dependency fetch failed: ${message} (repoId: ${repoId})`,
      500,
    );
  }

  return data;
};

const getRepositoryForAi = async (repoId) => {
  if (!repoId || typeof repoId !== "string" || !repoId.trim()) {
    throw new HttpError("Invalid repoId provided", 400);
  }

  const { data, error } = await supabase
    .from("repositories")
    .select(
      "id, user_id, name, owner, description, structure, dependencies, summary, tech_stack, default_branch, repo_url",
    )
    .eq("id", repoId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }

    throw new HttpError(
      `Supabase repository AI fetch failed: ${error.message}`,
      500,
    );
  }

  return data;
};

const getUserById = async (userId) => {
  if (!userId || typeof userId !== "string" || !userId.trim()) {
    throw new HttpError("Invalid userId provided", 400);
  }

  const { data, error } = await supabase
    .from("users")
    .select(USER_FIELDS)
    .eq("id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }

    throw new HttpError(`Supabase user fetch failed: ${error.message}`, 500);
  }

  return data;
};

const updateUserById = async (userId, updates = {}) => {
  if (!userId || typeof userId !== "string" || !userId.trim()) {
    throw new HttpError("Invalid userId provided", 400);
  }

  const payload = {};

  if (Object.prototype.hasOwnProperty.call(updates, "name")) {
    payload.name = updates.name;
  }

  if (Object.prototype.hasOwnProperty.call(updates, "githubToken")) {
    payload.github_token = updates.githubToken;
  }

  const { data, error } = await supabase
    .from("users")
    .update(payload)
    .eq("id", userId)
    .select(USER_FIELDS)
    .single();

  if (error) {
    throw new HttpError(`Supabase user update failed: ${error.message}`, 500);
  }

  return data;
};

const updateRepositorySummary = async (repoId, summary) => {
  const { data, error } = await supabase
    .from("repositories")
    .update({ summary: summary || null })
    .eq("id", repoId)
    .select("id, summary")
    .single();

  if (error) {
    throw new HttpError(
      `Supabase repository summary update failed: ${error.message}`,
      500,
    );
  }

  return data;
};

export {
  insertRepository,
  bulkInsertContributors,
  bulkInsertCommits,
  bulkInsertIssues,
  getRepositoryById,
  getRepositoriesByUserId,
  getRepositoryStructureById,
  getRepositoryDependencyDataById,
  getRepositoryForAi,
  getUserById,
  updateUserById,
  updateRepositorySummary,
};
