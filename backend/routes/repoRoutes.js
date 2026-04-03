import { Router } from "express";
import {
  analyzeRepository,
  getDependencies,
  getRepoMap,
  getRepository,
  getUserRepositories,
} from "../controller/repoController.js";

const repoRouter = Router();

repoRouter.post("/analyze", analyzeRepository);
repoRouter.get("/map/:repoId", getRepoMap);
repoRouter.get("/dependencies/:repoId", getDependencies);
repoRouter.get("/user", getUserRepositories);
repoRouter.get("/:repoId", getRepository);

export default repoRouter;
