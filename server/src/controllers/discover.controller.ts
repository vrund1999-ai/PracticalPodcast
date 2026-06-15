import type { Request, Response } from "express";
import { authedUser } from "../middleware/requireAuth";
import { getDiscover } from "../services/article.service";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function getDiscoverHandler(req: Request, res: Response): Promise<void> {
  authedUser(req);
  const date = typeof req.query.date === "string" && DATE_RE.test(req.query.date)
    ? req.query.date
    : undefined;
  const topicSlug = typeof req.query.topic === "string" ? req.query.topic : undefined;
  res.json(await getDiscover(date, topicSlug));
}
