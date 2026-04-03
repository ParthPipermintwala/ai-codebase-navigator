import { Router } from "express";
import {
  analyzeRepository,
  getRepository,
  getUserRepositories,
} from "../controller/repoController.js";

const repoRouter = Router();

repoRouter.post("/analyze", analyzeRepository);
repoRouter.get("/user", getUserRepositories);
repoRouter.get("/:repoId", getRepository);

export default repoRouter;
