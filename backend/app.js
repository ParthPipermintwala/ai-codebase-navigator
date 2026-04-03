import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// app.use("/auth", directoryRoutes);
// app.use("/repo", fileRoutes);
// app.use("/chat", authRoutes);

app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ message: "something went wrong" });
});

app.use(
  cors({
    origin: "http://localhost:5173",
  }),
);

export default app;
