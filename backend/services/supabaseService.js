import supabase from "../config/supabase.js";
import { HttpError } from "./githubService.js";

const REPOSITORY_DETAIL_FIELDS =
  "id, user_id, repo_url, name, owner, default_branch, description, stars, forks, watchers, open_issues, tech_stack, languages, structure, created_at";
const REPOSITORY_LIST_FIELDS =
  "id, user_id, repo_url, name, owner, default_branch, description, stars, forks, watchers, open_issues, tech_stack, languages, created_at";

const insertRepository = async ({
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
}) => {
  const payload = {
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
  };

  const { data, error } = await supabase
    .from("repositories")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new HttpError(`Supabase insert failed: ${error.message}`, 500);
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

export {
  insertRepository,
  bulkInsertContributors,
  bulkInsertCommits,
  bulkInsertIssues,
  getRepositoryById,
  getRepositoriesByUserId,
};
