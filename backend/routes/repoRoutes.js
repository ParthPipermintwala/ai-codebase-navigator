import { Router } from "express";
import {
  analyzeRepository,
  getDependencies,
  getRepoImpact,
  getRepoBugs,
  getRepoMap,
  getRepoTour,
  getRepository,
  getUserRepositories,
} from "../controller/repoController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { subscriptionMiddleware } from "../middleware/subscriptionMiddleware.js";

const repoRouter = Router();

repoRouter.post("/analyze", authMiddleware, analyzeRepository);
repoRouter.get("/map/:repoId", getRepoMap);
repoRouter.get("/dependencies/:repoId", getDependencies);
repoRouter.get(
  "/tour/:repoId",
  authMiddleware,
  subscriptionMiddleware,
  getRepoTour,
);
repoRouter.post(
  "/impact/:repoId",
  authMiddleware,
  subscriptionMiddleware,
  getRepoImpact,
);
repoRouter.post("/bugs/:repoId", authMiddleware, getRepoBugs);
repoRouter.get("/user", authMiddleware, getUserRepositories);
repoRouter.get("/:repoId", getRepository);

export default repoRouter;
