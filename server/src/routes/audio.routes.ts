import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { streamAudio } from "../controllers/audio.controller";

export const audioRouter = Router();

audioRouter.get("/:episodeId", requireAuth, streamAudio);
