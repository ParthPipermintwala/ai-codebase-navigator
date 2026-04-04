import { Router } from "express";
import { getSummary, chatWithRepo } from "../controller/aiController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const aiRouter = Router();
const chatRouter = Router();

aiRouter.post("/summary/:repoId", authMiddleware, getSummary);
chatRouter.post("/chat/:repoId", authMiddleware, chatWithRepo);

export { aiRouter, chatRouter };
