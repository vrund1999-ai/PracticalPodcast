import type { User } from "@prisma/client";
import { prisma } from "../db/client";

export interface UserDTO {
  id: string;
  email: string;
  themePref: string;
  defaultSpeed: number;
  autoplay: boolean;
  emailDigest: boolean;
  breakingAlerts: boolean;
}

export function toUserDTO(u: User): UserDTO {
  return {
    id: u.id,
    email: u.email,
    themePref: u.themePref,
    defaultSpeed: u.defaultSpeed,
    autoplay: u.autoplay,
    emailDigest: u.emailDigest,
    breakingAlerts: u.breakingAlerts,
  };
}

/** Topic slugs the user selected, in topic display order. */
export async function getUserTopicSlugs(userId: string): Promise<string[]> {
  const rows = await prisma.userTopic.findMany({
    where: { userId },
    include: { topic: true },
  });
  return rows
    .sort((a, b) => a.topic.sortOrder - b.topic.sortOrder)
    .map((r) => r.topic.slug);
}

export async function getMePayload(user: User) {
  const topics = await getUserTopicSlugs(user.id);
  return {
    user: toUserDTO(user),
    topics,
    needsOnboarding: user.onboardedAt === null,
  };
}
