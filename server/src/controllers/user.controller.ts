import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db/client";
import { badRequest } from "../lib/errors";
import { authedUser } from "../middleware/requireAuth";
import { getMePayload, getUserTopicSlugs, toUserDTO } from "../services/user.service";
import { MIN_TOPICS } from "../lib/topics";

export async function getMe(req: Request, res: Response): Promise<void> {
  const user = authedUser(req);
  res.json(await getMePayload(user));
}

export async function getTopics(_req: Request, res: Response): Promise<void> {
  const topics = await prisma.topic.findMany({
    orderBy: { sortOrder: "asc" },
    select: { slug: true, name: true, emoji: true, colorClass: true },
  });
  res.json({ topics });
}

const topicsBody = z.object({ slugs: z.array(z.string()).min(1) });

export async function putTopics(req: Request, res: Response): Promise<void> {
  const user = authedUser(req);
  const parsed = topicsBody.safeParse(req.body);
  if (!parsed.success) throw badRequest("A list of topic slugs is required.");

  // Resolve slugs to topic ids; ignore unknown slugs.
  const slugs = [...new Set(parsed.data.slugs)];
  const topics = await prisma.topic.findMany({ where: { slug: { in: slugs } } });
  if (topics.length < MIN_TOPICS) {
    throw badRequest(`Pick at least ${MIN_TOPICS} topics.`, "TOO_FEW_TOPICS");
  }

  await prisma.$transaction([
    prisma.userTopic.deleteMany({ where: { userId: user.id } }),
    prisma.userTopic.createMany({
      data: topics.map((t) => ({ userId: user.id, topicId: t.id })),
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { onboardedAt: user.onboardedAt ?? new Date() },
    }),
  ]);

  res.json({ topics: await getUserTopicSlugs(user.id) });
}

const settingsBody = z.object({
  themePref: z.enum(["system", "light", "dark"]).optional(),
  defaultSpeed: z.number().optional(),
  autoplay: z.boolean().optional(),
  emailDigest: z.boolean().optional(),
  breakingAlerts: z.boolean().optional(),
});

const ALLOWED_SPEEDS = [1.0, 1.25, 1.5, 2.0];

export async function putSettings(req: Request, res: Response): Promise<void> {
  const user = authedUser(req);
  const parsed = settingsBody.safeParse(req.body);
  if (!parsed.success) throw badRequest("Invalid settings.");
  const data = parsed.data;
  if (data.defaultSpeed !== undefined && !ALLOWED_SPEEDS.includes(data.defaultSpeed)) {
    throw badRequest("Unsupported playback speed.");
  }

  const updated = await prisma.user.update({ where: { id: user.id }, data });
  res.json({ user: toUserDTO(updated) });
}
