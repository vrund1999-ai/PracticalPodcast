import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { getDiscoverHandler } from "../controllers/discover.controller";

export const discoverRouter = Router();

discoverRouter.get("/discover", requireAuth, getDiscoverHandler);
