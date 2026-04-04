import express from "express";
import {
  register,
  login,
  getMe,
  logout,
  updateMe,
  verifyGithubToken,
  googleLogin,
  startGithubLogin,
  githubCallback,
} from "../controller/authController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// POST /api/auth/register
router.post("/register", register);

// POST /api/auth/login
router.post("/login", login);

// POST /api/auth/google
router.post("/google", googleLogin);

// GET /api/auth/github/start
router.get("/github/start", startGithubLogin);

// GET /api/auth/github/callback
router.get("/github/callback", githubCallback);

// GET /api/auth/me
router.get("/me", authMiddleware, getMe);

// PATCH /api/auth/me
router.patch("/me", authMiddleware, updateMe);

// POST /api/auth/verify-github
router.post("/verify-github", verifyGithubToken);

// POST /api/auth/logout
router.post("/logout", authMiddleware, logout);

export default router;
