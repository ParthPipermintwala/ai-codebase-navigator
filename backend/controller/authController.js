import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import supabase from "../config/supabase.js";
import { getUserById, updateUserById } from "../services/supabaseService.js";
import { githubRequest } from "../services/githubService.js";

const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_SECRET = process.env.COOKIE_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "postmessage";
const GITHUB_OAUTH_CLIENT_ID = process.env.GITHUB_OAUTH_CLIENT_ID;
const GITHUB_OAUTH_CLIENT_SECRET = process.env.GITHUB_OAUTH_CLIENT_SECRET;
const normalizeGithubRedirectUri = (value) => {
  const fallback = "http://localhost:3000/api/auth/github/callback";
  const rawValue = String(value || "").trim();

  if (!rawValue) {
    return fallback;
  }

  try {
    const parsed = new URL(rawValue);
    if (parsed.pathname === "/auth/github/callback") {
      parsed.pathname = "/api/auth/github/callback";
    }
    return parsed.toString();
  } catch {
    return fallback;
  }
};
const GITHUB_OAUTH_REDIRECT_URI = normalizeGithubRedirectUri(
  process.env.GITHUB_OAUTH_REDIRECT_URI,
);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:8080";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const IS_HTTPS_FRONTEND = String(FRONTEND_URL).trim().startsWith("https://");
const USE_CROSS_SITE_AUTH_COOKIE = IS_PRODUCTION || IS_HTTPS_FRONTEND;

if (!JWT_SECRET || !COOKIE_SECRET) {
  throw new Error("Missing JWT_SECRET or COOKIE_SECRET environment variables");
}

// Helper function to validate email
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const normalizeEmail = (email) =>
  String(email || "")
    .trim()
    .toLowerCase();

const createAuthToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: "7d",
  });
};

const setAuthCookie = (res, userId) => {
  const token = createAuthToken(userId);

  // Cross-site frontend/backend deployments require SameSite=None with Secure.
  const cookieOptions = {
    httpOnly: true,
    secure: USE_CROSS_SITE_AUTH_COOKIE,
    sameSite: USE_CROSS_SITE_AUTH_COOKIE ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  };

  res.cookie("authToken", token, {
    ...cookieOptions,
  });

  return token;
};

const ensureUserByEmail = async ({ email, name }) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedName = String(name || "").trim() || "User";

  const { data: existingUser, error: findError } = await supabase
    .from("users")
    .select("id, name, email")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (findError) {
    throw new Error(`Failed to lookup user: ${findError.message}`);
  }

  if (existingUser) {
    return existingUser;
  }

  const generatedPassword = crypto.randomBytes(24).toString("hex");
  const hashedPassword = await bcrypt.hash(generatedPassword, 10);

  const { data: newUser, error: insertError } = await supabase
    .from("users")
    .insert([
      {
        name: normalizedName,
        email: normalizedEmail,
        password: hashedPassword,
        is_subscribed: false,
      },
    ])
    .select("id, name, email")
    .single();

  if (insertError) {
    throw new Error(`Failed to create user: ${insertError.message}`);
  }

  return newUser;
};

const sanitizeUser = (user) => {
  if (!user) {
    return null;
  }

  const subscriptionStatus = String(user.subscription_status || "")
    .trim()
    .toLowerCase();
  const plan = String(user.plan || "")
    .trim()
    .toLowerCase();
  const isSubscribed =
    Boolean(user.is_subscribed) ||
    subscriptionStatus === "active" ||
    subscriptionStatus === "pro" ||
    subscriptionStatus === "premium" ||
    plan === "pro" ||
    plan === "premium";

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    hasGithubToken: Boolean(String(user.github_token || "").trim()),
    isSubscribed,
  };
};

// Register user
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate inputs
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ message: "Name is required" });
    }
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ message: "Valid email is required" });
    }
    if (!password || password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters long" });
    }

    // Check if user already exists
    const { data: existingUser, error: existingError } = await supabase
      .from("users")
      .select("id")
      .eq("email", email);

    if (existingUser && existingUser.length > 0) {
      return res.status(409).json({ message: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const { data, error } = await supabase
      .from("users")
      .insert([
        {
          name: name.trim(),
          email,
          password: hashedPassword,
          is_subscribed: false,
        },
      ])
      .select("id, name, email")
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ message: "Failed to create user" });
    }

    res
      .status(201)
      .json({ message: "User registered successfully", user: data });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Login user
export const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = normalizeEmail(email);

    // Validate inputs
    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: "Valid email is required" });
    }
    if (typeof password !== "string" || !password.trim()) {
      return res.status(400).json({ message: "Password is required" });
    }
    if (password.length < 6 || password.length > 128) {
      return res
        .status(400)
        .json({ message: "Password must be between 6 and 128 characters" });
    }

    // Find user
    const { data: user, error } = await supabase
      .from("users")
      .select("id, name, email, password")
      .eq("email", normalizedEmail)
      .single();

    if (error || !user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Compare password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = setAuthCookie(res, user.id);

    // Return user info
    const fullUser = await getUserById(String(user.id));
    res.json({ user: sanitizeUser(fullUser || user), token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const googleLogin = async (req, res) => {
  try {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res
        .status(500)
        .json({ message: "Google OAuth is not configured" });
    }

    const { code, accessToken: directAccessToken } = req.body || {};
    let accessToken =
      typeof directAccessToken === "string" ? directAccessToken.trim() : "";

    if (!accessToken) {
      if (!code || typeof code !== "string") {
        return res.status(400).json({
          message: "Google authorization code or access token is required",
        });
      }

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: code.trim(),
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: GOOGLE_REDIRECT_URI,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        let errorMessage = "Failed to exchange Google authorization code";

        try {
          const parsed = JSON.parse(errorText);
          const reason = parsed?.error || parsed?.error_description;
          if (reason) {
            errorMessage = `Failed to exchange Google authorization code: ${reason}`;
          }
        } catch {
          if (errorText) {
            errorMessage = `Failed to exchange Google authorization code: ${errorText}`;
          }
        }

        return res.status(401).json({ message: errorMessage });
      }

      const tokenData = await tokenResponse.json();
      accessToken = String(tokenData?.access_token || "").trim();
    }

    if (!accessToken) {
      return res
        .status(401)
        .json({ message: "Google access token is missing" });
    }

    const userResponse = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!userResponse.ok) {
      return res
        .status(401)
        .json({ message: "Unable to fetch Google user profile" });
    }

    const googleUser = await userResponse.json();
    const email = normalizeEmail(googleUser?.email);
    const name = String(
      googleUser?.name || googleUser?.given_name || "User",
    ).trim();

    if (!email || !isValidEmail(email)) {
      return res
        .status(400)
        .json({ message: "Google account does not provide a valid email" });
    }

    const user = await ensureUserByEmail({ email, name });
    const fullUser = await getUserById(String(user.id));
    const token = setAuthCookie(res, user.id);

    return res.json({
      message: "Google login successful",
      user: sanitizeUser(fullUser || user),
      token,
    });
  } catch (error) {
    console.error("Google login error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const startGithubLogin = async (req, res) => {
  try {
    if (!GITHUB_OAUTH_CLIENT_ID || !GITHUB_OAUTH_CLIENT_SECRET) {
      return res
        .status(500)
        .json({ message: "GitHub OAuth is not configured" });
    }

    const state = crypto.randomBytes(24).toString("hex");
    res.cookie("github_oauth_state", state, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 10 * 60 * 1000,
    });

    const authUrl = new URL("https://github.com/login/oauth/authorize");
    authUrl.searchParams.set("client_id", GITHUB_OAUTH_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", GITHUB_OAUTH_REDIRECT_URI);
    authUrl.searchParams.set("scope", "read:user user:email");
    authUrl.searchParams.set("state", state);

    return res.redirect(authUrl.toString());
  } catch (error) {
    console.error("Start GitHub login error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const githubCallback = async (req, res) => {
  try {
    if (!GITHUB_OAUTH_CLIENT_ID || !GITHUB_OAUTH_CLIENT_SECRET) {
      return res.redirect(`${FRONTEND_URL}/login?oauth=github_not_configured`);
    }

    const { code, state } = req.query || {};
    const expectedState = req.cookies?.github_oauth_state;

    if (!code || typeof code !== "string") {
      return res.redirect(`${FRONTEND_URL}/login?oauth=github_code_missing`);
    }

    if (
      !state ||
      typeof state !== "string" ||
      !expectedState ||
      state !== expectedState
    ) {
      return res.redirect(`${FRONTEND_URL}/login?oauth=github_state_invalid`);
    }

    res.clearCookie("github_oauth_state", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    });

    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: GITHUB_OAUTH_CLIENT_ID,
          client_secret: GITHUB_OAUTH_CLIENT_SECRET,
          code,
          redirect_uri: GITHUB_OAUTH_REDIRECT_URI,
          state,
        }),
      },
    );

    if (!tokenResponse.ok) {
      return res.redirect(
        `${FRONTEND_URL}/login?oauth=github_token_exchange_failed`,
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData?.access_token;
    if (!accessToken) {
      return res.redirect(
        `${FRONTEND_URL}/login?oauth=github_access_token_missing`,
      );
    }

    const ghHeaders = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "ai-code-nav",
    };

    const profileResponse = await fetch("https://api.github.com/user", {
      headers: ghHeaders,
    });

    if (!profileResponse.ok) {
      return res.redirect(`${FRONTEND_URL}/login?oauth=github_profile_failed`);
    }

    const profile = await profileResponse.json();
    let email = normalizeEmail(profile?.email);

    if (!email) {
      const emailResponse = await fetch("https://api.github.com/user/emails", {
        headers: ghHeaders,
      });

      if (emailResponse.ok) {
        const emailList = await emailResponse.json();
        if (Array.isArray(emailList)) {
          const preferred =
            emailList.find(
              (item) => item?.primary && item?.verified && item?.email,
            ) ||
            emailList.find((item) => item?.verified && item?.email) ||
            emailList.find((item) => item?.email);
          email = normalizeEmail(preferred?.email);
        }
      }
    }

    if (!email || !isValidEmail(email)) {
      return res.redirect(`${FRONTEND_URL}/login?oauth=github_email_missing`);
    }

    const name = String(profile?.name || profile?.login || "User").trim();
    const user = await ensureUserByEmail({ email, name });
    await updateUserById(String(user.id), { githubToken: String(accessToken) });
    const token = setAuthCookie(res, user.id);
    const redirectUrl = new URL(`${FRONTEND_URL}/oauth/callback`);
    redirectUrl.hash = `token=${encodeURIComponent(token)}&next=${encodeURIComponent("/analyze")}`;

    return res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error("GitHub callback error:", error);
    return res.redirect(`${FRONTEND_URL}/login?oauth=github_failed`);
  }
};

// Get current user
export const getMe = async (req, res) => {
  try {
    const user = await getUserById(req.user.userId);

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update current user profile
export const updateMe = async (req, res) => {
  try {
    const { name, githubApiKey } = req.body || {};
    const updates = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: "Display name is required" });
      }

      updates.name = name.trim();
    }

    if (githubApiKey !== undefined) {
      if (typeof githubApiKey !== "string") {
        return res.status(400).json({
          message: "GitHub API key must be a string",
        });
      }

      const trimmedKey = githubApiKey.trim();

      // Validate GitHub token format
      if (
        trimmedKey &&
        !trimmedKey.startsWith("ghp_") &&
        !trimmedKey.startsWith("github_pat_")
      ) {
        return res.status(400).json({
          message: "Invalid token format. use 'ghp_' or 'github_pat_' tokens",
        });
      }

      // Validate token length (GitHub tokens are typically 36+ characters)
      if (trimmedKey && trimmedKey.length < 20) {
        return res.status(400).json({
          message: "Token appears too short. Please check and try again",
        });
      }

      updates.githubToken = trimmedKey || null;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No settings provided" });
    }

    const updatedUser = await updateUserById(req.user.userId, updates);

    res.json({
      message:
        githubApiKey !== undefined && !githubApiKey.trim()
          ? "GitHub token removed successfully"
          : githubApiKey !== undefined
            ? "GitHub token saved successfully"
            : "Profile updated successfully",
      user: sanitizeUser(updatedUser),
    });
  } catch (error) {
    console.error("Update me error:", error);
    res.status(error?.statusCode || 500).json({
      message: error?.message || "Internal server error",
    });
  }
};

// Verify GitHub token
export const verifyGithubToken = async (req, res) => {
  try {
    const { token } = req.body || {};

    if (!token || typeof token !== "string") {
      return res.status(400).json({
        message: "GitHub token is required",
        valid: false,
      });
    }

    const trimmedToken = token.trim();

    if (!trimmedToken) {
      return res.status(400).json({
        message: "Token cannot be empty",
        valid: false,
      });
    }

    if (
      !trimmedToken.startsWith("ghp_") &&
      !trimmedToken.startsWith("github_pat_")
    ) {
      return res.status(400).json({
        message: "Invalid token format. Use 'ghp_' or 'github_pat_' tokens",
        valid: false,
      });
    }

    if (trimmedToken.length < 20) {
      return res.status(400).json({
        message: "Token appears to be incomplete",
        valid: false,
      });
    }

    try {
      const response = await githubRequest("/user", trimmedToken);

      if (response?.login) {
        return res.json({
          message: "GitHub token is valid",
          valid: true,
          github_user: response.login,
          github_name: response.name,
        });
      }

      return res.status(401).json({
        message: "Token is invalid or expired",
        valid: false,
      });
    } catch (error) {
      const errorMsg = error?.message || "Failed to verify token with GitHub";
      return res.status(401).json({
        message: errorMsg.includes("404")
          ? "GitHub API error: please check your token"
          : errorMsg,
        valid: false,
      });
    }
  } catch (error) {
    console.error("Verify GitHub token error:", error);
    res.status(500).json({
      message: "Internal server error",
      valid: false,
    });
  }
};

// Logout user
export const logout = async (req, res) => {
  try {
    const cookieOptions = {
      httpOnly: true,
      secure: USE_CROSS_SITE_AUTH_COOKIE,
      sameSite: USE_CROSS_SITE_AUTH_COOKIE ? "none" : "lax",
      path: "/",
    };

    res.clearCookie("authToken", {
      ...cookieOptions,
    });

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
