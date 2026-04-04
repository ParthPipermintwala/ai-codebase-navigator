import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import repoRouter from "./routes/repoRoutes.js";
import authRouter from "./routes/authRoutes.js";
import paymentRouter from "./routes/payment.routes.js";
import { authMiddleware } from "./middleware/authMiddleware.js";
import { aiRouter, chatRouter } from "./routes/aiRoutes.js";

const app = express();
const DEV_ORIGINS = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];
const ENV_ORIGINS = String(process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = Array.from(new Set([...DEV_ORIGINS, ...ENV_ORIGINS]));

app.disable("x-powered-by");
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use("/api/payment", paymentRouter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRouter);
app.use("/api/repo", authMiddleware, repoRouter);
app.use("/api/ai", aiRouter);
app.use("/api", chatRouter);

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    message: err.message || "Something went wrong",
  });
});

export default app;
