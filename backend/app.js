import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import repoRouter from "./routes/repoRoutes.js";

const app = express();
app.disable("x-powered-by");
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/repo", repoRouter);

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    message: err.message || "Something went wrong",
  });
});

export default app;
