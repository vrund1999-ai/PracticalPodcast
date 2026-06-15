import { prisma } from "../db/client";
import { notFound } from "../lib/errors";
import { lengthMeta, HOSTS, EPISODE_STATUS } from "../lib/constants";
import {
  appToday,
  dayLabel,
  dayDisplayDate,
  shortDate,
  mediumDate,
  timeLabel,
} from "../lib/dates";
import { fmtClock } from "../lib/format";

export interface EpisodeFilters {
  lengthMinutes?: number;
  topicSlug?: string;
  q?: string;
}

// Shape of an episode loaded with its articles + topics for card/detail building.
const episodeInclude = {
  articles: {
    orderBy: { order: "asc" as const },
    include: { article: { include: { topic: true } } },
  },
} as const;

/** Distinct topic names across an episode's articles, in EpisodeArticle order. */
function topicNames(ep: any): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const ea of ep.articles) {
    const n = ea.article.topic.name;
    if (!seen.has(n)) {
      seen.add(n);
      names.push(n);
    }
  }
  return names;
}

function generatedLabel(ep: any, today: string): string {
  if (!ep.generatedAt) return "Not generated yet";
  const t = timeLabel(ep.generatedAt);
  return ep.date === today ? `Generated ${t}` : `${shortDate(ep.date)} · ${t}`;
}

function toCard(ep: any, today: string) {
  const meta = lengthMeta(ep.lengthMinutes);
  const tags = topicNames(ep);
  const headlines = ep.articles.map((ea: any) => ea.article.headline).join(" ");
  return {
    id: ep.id,
    lengthMinutes: ep.lengthMinutes,
    dataLen: meta.dataLen,
    title: ep.title,
    coverGlyph: ep.coverGlyph,
    colorClass: ep.colorClass,
    badgeClass: meta.badgeClass,
    badgeLabel: meta.badgeLabel,
    status: ep.status,
    durationSeconds: ep.durationSeconds ?? null,
    generatedLabel: generatedLabel(ep, today),
    tags,
    // Everything the search box should match (title + topics + article headlines).
    searchText: `${ep.title} ${tags.join(" ")} ${headlines}`.toLowerCase(),
  };
}

export async function listEpisodes(filters: EpisodeFilters) {
  const today = appToday();
  const where: any = {};
  if (filters.lengthMinutes) where.lengthMinutes = filters.lengthMinutes;
  if (filters.topicSlug) {
    where.articles = { some: { article: { topic: { slug: filters.topicSlug } } } };
  }

  let episodes = await prisma.episode.findMany({
    where,
    include: episodeInclude,
    orderBy: [{ date: "desc" }, { lengthMinutes: "asc" }],
  });

  // Case-insensitive search across title, tags, and article headlines (SQLite
  // `contains` is case-sensitive, so filter in JS over the small result set).
  if (filters.q) {
    const q = filters.q.trim().toLowerCase();
    if (q) {
      episodes = episodes.filter((ep) => {
        if (ep.title.toLowerCase().includes(q)) return true;
        if (topicNames(ep).some((n) => n.toLowerCase().includes(q))) return true;
        return ep.articles.some((ea: any) =>
          ea.article.headline.toLowerCase().includes(q)
        );
      });
    }
  }

  // Bucket by date (already date-desc, length-asc).
  const byDate = new Map<string, any[]>();
  for (const ep of episodes) {
    if (!byDate.has(ep.date)) byDate.set(ep.date, []);
    byDate.get(ep.date)!.push(toCard(ep, today));
  }

  const days = [...byDate.entries()].map(([date, cards]) => ({
    date,
    label: dayLabel(date, today),
    displayDate: dayDisplayDate(date),
    episodes: cards,
  }));

  return { days };
}

export async function getEpisodeDetail(id: string, userId: string) {
  const ep = await prisma.episode.findUnique({
    where: { id },
    include: {
      ...episodeInclude,
      chapters: { orderBy: { order: "asc" } },
      lines: { orderBy: { order: "asc" } },
    },
  });
  if (!ep) throw notFound("Episode not found.");

  const today = appToday();
  const meta = lengthMeta(ep.lengthMinutes);
  const isToday = ep.date === today;

  const hosts = [HOSTS.NOVA, HOSTS.ATLAS].map((h) => ({
    speaker: h.speaker,
    name: h.name,
    role: h.role,
    avatar: h.avatar,
    avatarClass: h.avatarClass,
  }));

  const chapters = ep.chapters.map((c) => ({
    title: c.title,
    startSeconds: c.startSeconds,
    timecode: fmtClock(c.startSeconds),
    topics: c.topicsCsv ? c.topicsCsv.split(",").map((t) => t.trim()).filter(Boolean) : [],
  }));

  const lines = ep.lines.map((l) => {
    const host = l.speaker === HOSTS.NOVA.speaker ? HOSTS.NOVA : HOSTS.ATLAS;
    return {
      speaker: l.speaker,
      name: host.name,
      lineClass: host.lineClass,
      startSeconds: l.startSeconds,
      timecode: fmtClock(l.startSeconds),
      text: l.text,
    };
  });

  const sources = ep.articles.map((ea: any) => ({
    headline: ea.article.headline,
    topicName: ea.article.topic.name,
    source: ea.article.source,
    timeLabel: ea.article.publishedAt ? timeLabel(ea.article.publishedAt) : "",
    url: ea.article.url,
  }));

  const pb = await prisma.playbackState.findUnique({
    where: { userId_episodeId: { userId, episodeId: id } },
  });

  return {
    episode: {
      id: ep.id,
      title: ep.title,
      lengthMinutes: ep.lengthMinutes,
      badgeLabel: meta.badgeLabel,
      coverGlyph: ep.coverGlyph,
      colorClass: ep.colorClass,
      status: ep.status,
      audioUrl: ep.status === EPISODE_STATUS.READY ? `/api/audio/${ep.id}` : null,
      durationSeconds: ep.durationSeconds ?? null,
      dateMeta: `${isToday ? "Today" : dayLabel(ep.date, today)} · ${mediumDate(ep.date)}`,
      sourceCount: sources.length,
    },
    hosts,
    chapters,
    lines,
    sources,
    playback: { positionSeconds: pb?.positionSeconds ?? 0 },
  };
}

export async function savePlayback(userId: string, episodeId: string, positionSeconds: number) {
  const ep = await prisma.episode.findUnique({ where: { id: episodeId }, select: { id: true } });
  if (!ep) throw notFound("Episode not found.");
  await prisma.playbackState.upsert({
    where: { userId_episodeId: { userId, episodeId } },
    update: { positionSeconds: Math.max(0, Math.floor(positionSeconds)) },
    create: { userId, episodeId, positionSeconds: Math.max(0, Math.floor(positionSeconds)) },
  });
}
