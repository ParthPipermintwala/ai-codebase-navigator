import supabase from "../config/supabase.js";

const extractToken = (req) => {
  const authHeader = req.headers?.authorization || "";
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  const cookieToken = req.cookies?.access_token || req.cookies?.token;
  if (typeof cookieToken === "string" && cookieToken.trim()) {
    return cookieToken.trim();
  }

  return null;
};

const authMiddleware = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.id) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      });
    }

    req.user = {
      id: data.user.id,
      email: data.user.email || null,
    };

    return next();
  } catch {
    return res.status(500).json({
      success: false,
      error: "Authentication failed",
    });
  }
};

export default authMiddleware;
