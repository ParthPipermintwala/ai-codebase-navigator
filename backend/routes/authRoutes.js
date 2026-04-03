import express from "express";
import {
  register,
  login,
  getMe,
  logout,
} from "../controller/authController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// POST /api/auth/register
router.post("/register", register);

// POST /api/auth/login
router.post("/login", login);

// GET /api/auth/me
router.get("/me", authMiddleware, getMe);

// POST /api/auth/logout
router.post("/logout", authMiddleware, logout);

export default router;
