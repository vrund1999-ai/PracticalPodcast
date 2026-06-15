import type { Request, Response } from "express";
import { z } from "zod";
import { badRequest } from "../lib/errors";
import { authedUser } from "../middleware/requireAuth";
import { listEpisodes, getEpisodeDetail, savePlayback } from "../services/episode.service";

const VALID_LENGTHS = [10, 30, 60];

export async function getEpisodes(req: Request, res: Response): Promise<void> {
  authedUser(req);
  const lengthRaw = req.query.length ? Number(req.query.length) : undefined;
  const lengthMinutes =
    lengthRaw && VALID_LENGTHS.includes(lengthRaw) ? lengthRaw : undefined;
  const topicSlug = typeof req.query.topic === "string" ? req.query.topic : undefined;
  const q = typeof req.query.q === "string" ? req.query.q : undefined;
  res.json(await listEpisodes({ lengthMinutes, topicSlug, q }));
}

export async function getEpisode(req: Request, res: Response): Promise<void> {
  const user = authedUser(req);
  res.json(await getEpisodeDetail(String(req.params.id), user.id));
}

const playbackBody = z.object({ positionSeconds: z.number().min(0) });

export async function putPlayback(req: Request, res: Response): Promise<void> {
  const user = authedUser(req);
  const parsed = playbackBody.safeParse(req.body);
  if (!parsed.success) throw badRequest("positionSeconds is required.");
  await savePlayback(user.id, String(req.params.id), parsed.data.positionSeconds);
  res.status(204).end();
}
