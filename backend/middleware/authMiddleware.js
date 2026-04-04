import jwt from "jsonwebtoken";
import supabase from "../config/supabase.js";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("Missing JWT_SECRET environment variable");
}

export const authMiddleware = async (req, res, next) => {
  try {
    const cookieToken = req.cookies?.authToken;
    const authHeader = String(req.headers?.authorization || "").trim();
    const bearerToken = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";
    const token = cookieToken || bearerToken;

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if user exists
    const { data: user, error } = await supabase
      .from("users")
      .select("id")
      .eq("id", decoded.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({ message: "Invalid token" });
    }

    // Attach user to request
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid token" });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }
    res.status(500).json({ message: "Internal server error" });
  }
};
