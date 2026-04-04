import { Router } from "express";
import {
  analyzeRepository,
  getDependencies,
  getRepoImpact,
  getRepoMap,
  getRepoTour,
  getRepository,
  getUserRepositories,
} from "../controller/repoController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const repoRouter = Router();

repoRouter.post("/analyze", authMiddleware, analyzeRepository);
repoRouter.get("/map/:repoId", getRepoMap);
repoRouter.get("/dependencies/:repoId", getDependencies);
repoRouter.get("/tour/:repoId", authMiddleware, getRepoTour);
repoRouter.post("/impact/:repoId", authMiddleware, getRepoImpact);
repoRouter.get("/user", authMiddleware, getUserRepositories);
repoRouter.get("/:repoId", getRepository);

export default repoRouter;
