const REPO_ID_KEY = "repoId";

export const setRepoId = (repoId) => {
  if (!repoId) {
    return;
  }

  localStorage.setItem(REPO_ID_KEY, String(repoId));
};

export const getRepoId = () => {
  return localStorage.getItem(REPO_ID_KEY);
};

export const clearRepoId = () => {
  localStorage.removeItem(REPO_ID_KEY);
};
