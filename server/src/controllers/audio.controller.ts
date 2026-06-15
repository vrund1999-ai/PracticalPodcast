import fs from "node:fs";
import path from "node:path";
import type { Request, Response } from "express";
import { PATHS } from "../config/env";
import { prisma } from "../db/client";
import { notFound } from "../lib/errors";
import { EPISODE_STATUS } from "../lib/constants";

/** Streams an episode MP3 with HTTP Range support so <audio> seeking works. */
export async function streamAudio(req: Request, res: Response): Promise<void> {
  const episodeId = String(req.params.episodeId);
  const ep = await prisma.episode.findUnique({
    where: { id: episodeId },
    select: { status: true },
  });
  if (!ep || ep.status !== EPISODE_STATUS.READY) throw notFound("Audio not available.");

  const filePath = path.join(PATHS.audio, `${episodeId}.mp3`);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    throw notFound("Audio file missing.");
  }

  const fileSize = stat.size;
  const range = req.headers.range;
  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "no-cache");

  if (!range) {
    res.setHeader("Content-Length", fileSize);
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  const m = /bytes=(\d*)-(\d*)/.exec(range);
  let start = m && m[1] ? parseInt(m[1], 10) : 0;
  let end = m && m[2] ? parseInt(m[2], 10) : fileSize - 1;
  if (Number.isNaN(start)) start = 0;
  if (Number.isNaN(end) || end >= fileSize) end = fileSize - 1;

  if (start > end || start >= fileSize) {
    res.status(416);
    res.setHeader("Content-Range", `bytes */${fileSize}`);
    res.end();
    return;
  }

  res.status(206);
  res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
  res.setHeader("Content-Length", end - start + 1);
  fs.createReadStream(filePath, { start, end }).pipe(res);
}
