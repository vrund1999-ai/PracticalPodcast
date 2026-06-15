import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { getEpisodes, getEpisode, putPlayback } from "../controllers/episode.controller";

export const episodesRouter = Router();

episodesRouter.get("/", requireAuth, getEpisodes);
episodesRouter.get("/:id", requireAuth, getEpisode);
episodesRouter.put("/:id/playback", requireAuth, putPlayback);
