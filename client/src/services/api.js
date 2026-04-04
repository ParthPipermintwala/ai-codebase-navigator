const API_BASE_URL =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : "https://ai-codebase-navigator-bpxc.onrender.com/api";

const API_SERVER_URL =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
    ? String(import.meta.env.VITE_API_URL)
    : "https://ai-codebase-navigator-bpxc.onrender.com";

const AUTH_TOKEN_STORAGE_KEY = "ai_code_nav_auth_token";

const getStoredAuthToken = () => {
  try {
    if (typeof window === "undefined") {
      return "";
    }
    return String(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || "").trim();
  } catch {
    return "";
  }
};

export const setStoredAuthToken = (token) => {
  try {
    if (typeof window === "undefined") {
      return;
    }

    const trimmed = String(token || "").trim();
    if (!trimmed) {
      window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, trimmed);
  } catch {
    // Ignore storage exceptions.
  }
};

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

  if (status === 402) {
    return "Subscription required";
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
  const token = getStoredAuthToken();

  if (body !== undefined && !nextHeaders.has("Content-Type")) {
    nextHeaders.set("Content-Type", "application/json");
  }

  if (token && !nextHeaders.has("Authorization")) {
    nextHeaders.set("Authorization", `Bearer ${token}`);
  }

  return nextHeaders;
};

const withTimeoutSignal = (timeoutMs = 12000) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, timeoutId };
};

const apiRequest = async (path, options = {}) => {
  const { body, headers, ...restOptions } = options;
  const { signal, timeoutId } = withTimeoutSignal();

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
      headers: buildHeaders(headers, body),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
      ...restOptions,
    });
  } catch (error) {
    window.clearTimeout(timeoutId);
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("Request timed out. Please try again.", 408, null);
    }
    throw error;
  }

  window.clearTimeout(timeoutId);

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (data?.token && typeof data.token === "string") {
    setStoredAuthToken(data.token);
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

export const loginWithGoogleCode = (code) =>
  apiRequest("/auth/google", {
    method: "POST",
    body: { code },
  });

export const loginWithGoogleAccessToken = (accessToken) =>
  apiRequest("/auth/google", {
    method: "POST",
    body: { accessToken },
  });

export const getGithubLoginUrl = () =>
  `${API_SERVER_URL}/api/auth/github/start`;

export const register = (payload) =>
  apiRequest("/auth/register", {
    method: "POST",
    body: payload,
  });

export const getCurrentUser = () =>
  apiRequest("/auth/me", {
    method: "GET",
  });

export const updateCurrentUser = (payload) =>
  apiRequest("/auth/me", {
    method: "PATCH",
    body: payload,
  });

export const verifyGithubToken = (token) =>
  apiRequest("/auth/verify-github", {
    method: "POST",
    body: { token },
  });

export const logout = () =>
  apiRequest("/auth/logout", {
    method: "POST",
  }).finally(() => {
    setStoredAuthToken("");
  });

export const createCheckoutSession = () =>
  apiRequest("/payment/create-checkout-session", {
    method: "POST",
  });

export const confirmCheckoutSession = (sessionId) =>
  apiRequest(
    `/payment/confirm-session?session_id=${encodeURIComponent(sessionId)}`,
    {
      method: "GET",
    },
  );

export const analyzeRepository = (repoUrl) =>
  apiRequest("/repo/analyze", {
    method: "POST",
    body: { repoUrl },
  });

export const getRepository = (repoId) =>
  apiRequest(`/repo/${encodeURIComponent(repoId)}`, {
    method: "GET",
  });

export const getUserRepositories = () =>
  apiRequest(`/repo/user`, {
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

export const getRepoTour = (repoId) =>
  apiRequest(`/repo/tour/${encodeURIComponent(repoId)}`, {
    method: "GET",
  });

export const getRepoImpact = (repoId, target) =>
  apiRequest(`/repo/impact/${encodeURIComponent(repoId)}`, {
    method: "POST",
    body: { target },
  });

export const getRepoBugs = (repoId, options = {}) =>
  apiRequest(`/repo/bugs/${encodeURIComponent(repoId)}`, {
    method: "POST",
    body: options,
  });

export const chatWithRepository = (repoId, question) =>
  apiRequest(`/chat/${encodeURIComponent(repoId)}`, {
    method: "POST",
    body: { question },
  });
