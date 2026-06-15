import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { getMe, getTopics, putTopics, putSettings } from "../controllers/user.controller";

export const meRouter = Router();

meRouter.get("/me", requireAuth, getMe);
meRouter.get("/topics", requireAuth, getTopics);
meRouter.put("/me/topics", requireAuth, putTopics);
meRouter.put("/me/settings", requireAuth, putSettings);
