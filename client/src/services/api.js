const API_BASE_URL = "http://localhost:3000/api";

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

const toApiErrorMessage = (status, data) => {
  const backendMessage = data?.error || data?.message;
  if (backendMessage) {
    return backendMessage;
  }

  if (status === 404) {
    return "Repo not found";
  }

  if (status === 429) {
    return "Daily limit reached";
  }

  if (status >= 500) {
    return "Server error";
  }

  return "Request failed";
};

const buildHeaders = (headers, body) => {
  const nextHeaders = new Headers(headers || {});

  if (body !== undefined && !nextHeaders.has("Content-Type")) {
    nextHeaders.set("Content-Type", "application/json");
  }

  return nextHeaders;
};

const apiRequest = async (path, options = {}) => {
  const { body, headers, ...restOptions } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: buildHeaders(headers, body),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...restOptions,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new ApiError(
      toApiErrorMessage(response.status, data),
      response.status,
      data,
    );
  }

  return data;
};

export const login = (payload) =>
  apiRequest("/auth/login", {
    method: "POST",
    body: payload,
  });

export const register = (payload) =>
  apiRequest("/auth/register", {
    method: "POST",
    body: payload,
  });

export const getCurrentUser = () =>
  apiRequest("/auth/me", {
    method: "GET",
  });

export const logout = () =>
  apiRequest("/auth/logout", {
    method: "POST",
  });

export const analyzeRepository = (repoUrl) =>
  apiRequest("/repo/analyze", {
    method: "POST",
    body: { repoUrl },
  });

export const getRepository = (repoId) =>
  apiRequest(`/repo/${encodeURIComponent(repoId)}`, {
    method: "GET",
  });

export const getRepositoryMap = (repoId) =>
  apiRequest(`/repo/map/${encodeURIComponent(repoId)}`, {
    method: "GET",
  });

export const getDependencies = (repoId) =>
  apiRequest(`/repo/dependencies/${encodeURIComponent(repoId)}`, {
    method: "GET",
  });
