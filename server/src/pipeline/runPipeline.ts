import fs from "node:fs";
import path from "node:path";
import { prisma } from "../db/client";
import { env, getPipelineEnv, PATHS } from "../config/env";
import { appToday, dayDisplayDate } from "../lib/dates";
import { EPISODE_LENGTHS, EPISODE_STATUS, lengthMeta, type LengthMeta } from "../lib/constants";
import { fetchTopicArticles } from "../providers/newsapi";
import { generateScript, type ScriptArticle } from "../providers/llm";
import { synthesizeLine } from "../providers/tts";
import { writeBuffer, probeDuration, concatToFile } from "../providers/audio";
import { sendDigestEmail } from "../providers/email";

interface SelectedStory extends ScriptArticle {
  id: string;
}

const TARGET_STORIES = 14;

/** Step 1 — pull top articles per topic and persist them (idempotent via the
 *  @@unique([url, sourcedDate]) constraint). */
async function sourceNews(date: string): Promise<number> {
  const topics = await prisma.topic.findMany({ orderBy: { sortOrder: "asc" } });
  for (const t of topics) {
    let sourced;
    try {
      sourced = await fetchTopicArticles(t);
    } catch (e) {
      console.warn(`  sourcing ${t.slug} failed: ${(e as Error).message}`);
      continue;
    }
    let rank = 0;
    for (const a of sourced) {
      try {
        await prisma.article.upsert({
          where: { url_sourcedDate: { url: a.url, sourcedDate: date } },
          update: { headline: a.headline, summary: a.summary, source: a.source, publishedAt: a.publishedAt },
          create: {
            url: a.url,
            sourcedDate: date,
            headline: a.headline,
            summary: a.summary,
            source: a.source,
            topicId: t.id,
            publishedAt: a.publishedAt,
            rank,
          },
        });
        rank++;
      } catch {
        /* duplicate url for the day (already sourced under another topic) — skip */
      }
    }
  }
  return prisma.article.count({ where: { sourcedDate: date } });
}

/** Step 2 — round-robin the top-ranked article from each topic for breadth. */
async function selectStories(date: string): Promise<SelectedStory[]> {
  const arts = await prisma.article.findMany({
    where: { sourcedDate: date },
    include: { topic: true },
    orderBy: [{ topic: { sortOrder: "asc" } }, { rank: "asc" }],
  });
  const byTopic = new Map<string, typeof arts>();
  for (const a of arts) {
    if (!byTopic.has(a.topicId)) byTopic.set(a.topicId, [] as typeof arts);
    byTopic.get(a.topicId)!.push(a);
  }
  const selected: SelectedStory[] = [];
  let progressed = true;
  while (selected.length < TARGET_STORIES && progressed) {
    progressed = false;
    for (const list of byTopic.values()) {
      const a = list.shift();
      if (!a) continue;
      progressed = true;
      selected.push({ id: a.id, headline: a.headline, source: a.source, topicName: a.topic.name, summary: a.summary });
      if (selected.length >= TARGET_STORIES) break;
    }
  }
  return selected;
}

/** Steps 3–4 — generate the script, synthesize each line, assemble the MP3. */
async function generateEpisode(
  date: string,
  meta: LengthMeta,
  selected: SelectedStory[],
  dateDisplay: string
): Promise<void> {
  const key = { date_lengthMinutes: { date, lengthMinutes: meta.minutes } };
  await prisma.episode.update({ where: key, data: { status: EPISODE_STATUS.GENERATING, errorMessage: null } });
  const ep = await prisma.episode.findUniqueOrThrow({ where: key });
  const epId = ep.id;

  // 3. Script
  const script = await generateScript(
    selected.map((s) => ({ headline: s.headline, source: s.source, topicName: s.topicName, summary: s.summary })),
    meta,
    dateDisplay
  );
  await prisma.episode.update({ where: { id: epId }, data: { scriptJson: script as any } });

  // Flatten lines (carry segment index for chapter start times).
  const flat: { speaker: "NOVA" | "ATLAS"; text: string; segIndex: number }[] = [];
  script.segments.forEach((seg, si) => seg.lines.forEach((l) => flat.push({ ...l, segIndex: si })));
  let lines = flat;
  if (env.DEV_MAX_TTS_LINES > 0 && flat.length > env.DEV_MAX_TTS_LINES) {
    lines = flat.slice(0, env.DEV_MAX_TTS_LINES);
    console.log(`  DEV_MAX_TTS_LINES: capping ${flat.length} lines to ${lines.length}`);
  }

  // 4. Synthesize each line, track cumulative timing.
  const partDir = path.join(PATHS.audio, "_parts", epId);
  fs.mkdirSync(partDir, { recursive: true });
  const parts: string[] = [];
  const lineRows: { episodeId: string; speaker: string; startSeconds: number; text: string; order: number }[] = [];
  const segStart = new Map<number, number>();
  let cumulative = 0;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const buf = await synthesizeLine(l.text, l.speaker);
    const p = path.join(partDir, `${i}.mp3`);
    writeBuffer(buf, p);
    parts.push(p);
    const start = Math.round(cumulative);
    lineRows.push({ episodeId: epId, speaker: l.speaker, startSeconds: start, text: l.text, order: i });
    if (!segStart.has(l.segIndex)) segStart.set(l.segIndex, start);
    cumulative += await probeDuration(p);
  }

  // Assemble.
  const outPath = path.join(PATHS.audio, `${epId}.mp3`);
  await concatToFile(parts, outPath);
  const totalDuration = Math.round(await probeDuration(outPath));

  const chapterRows = script.segments
    .map((seg, si) => ({ seg, si }))
    .filter(({ si }) => segStart.has(si))
    .map(({ seg, si }, order) => ({
      episodeId: epId,
      title: seg.chapterTitle,
      startSeconds: segStart.get(si)!,
      topicsCsv: seg.topics.join(","),
      order,
    }));

  // Persist (reset children so re-runs are clean).
  await prisma.chapter.deleteMany({ where: { episodeId: epId } });
  await prisma.transcriptLine.deleteMany({ where: { episodeId: epId } });
  await prisma.episodeArticle.deleteMany({ where: { episodeId: epId } });
  await prisma.chapter.createMany({ data: chapterRows });
  await prisma.transcriptLine.createMany({ data: lineRows });
  await prisma.episodeArticle.createMany({
    data: selected.map((s, i) => ({ episodeId: epId, articleId: s.id, order: i })),
  });
  await prisma.episode.update({
    where: { id: epId },
    data: {
      status: EPISODE_STATUS.READY,
      audioUrl: `/api/audio/${epId}`,
      durationSeconds: totalDuration,
      generatedAt: new Date(),
    },
  });

  fs.rmSync(partDir, { recursive: true, force: true });
  console.log(`  ${meta.minutes}m READY — ${lineRows.length} lines, ${chapterRows.length} chapters, ${totalDuration}s`);
}

/** Step 5 — email opted-in users. */
async function notifyDigest(date: string, dateDisplay: string): Promise<void> {
  const users = await prisma.user.findMany({ where: { emailDigest: true } });
  if (!users.length) return;
  const eps = await prisma.episode.findMany({
    where: { date, status: EPISODE_STATUS.READY },
    include: { articles: { include: { article: { include: { topic: true } } } } },
    orderBy: { lengthMinutes: "asc" },
  });
  const digestEps = eps.map((ep) => {
    const names = [...new Set(ep.articles.map((ea) => ea.article.topic.name))];
    return { title: ep.title, badgeLabel: lengthMeta(ep.lengthMinutes).badgeLabel, topicNames: names };
  });
  const baseUrl = `http://localhost:${env.PORT}`;
  for (const u of users) {
    try {
      await sendDigestEmail(u.email, dateDisplay, digestEps, baseUrl);
    } catch (e) {
      console.warn(`  digest to ${u.email} failed: ${(e as Error).message}`);
    }
  }
}

/** End-to-end daily run. Idempotent per app-local date. */
export async function runPipeline(dateArg?: string): Promise<void> {
  getPipelineEnv(); // fail fast with a clear message if any provider key is missing
  const date = dateArg || appToday();
  const dateDisplay = dayDisplayDate(date);
  const lengths = env.DEV_ONLY_SHORT ? EPISODE_LENGTHS.filter((l) => l.minutes === 10) : EPISODE_LENGTHS;

  console.log(`\n=== PracticalPodcast pipeline — ${date} (${dateDisplay}) ===`);
  if (env.DEV_ONLY_SHORT) console.log("DEV_ONLY_SHORT: generating only the 10-minute episode.");

  // Step 0 — idempotency gate + ensure episode rows exist.
  const readyCount = await prisma.episode.count({ where: { date, status: EPISODE_STATUS.READY } });
  if (readyCount >= lengths.length) {
    console.log("Today's episodes already generated. Nothing to do.");
    return;
  }
  for (const meta of lengths) {
    await prisma.episode.upsert({
      where: { date_lengthMinutes: { date, lengthMinutes: meta.minutes } },
      update: {},
      create: {
        date,
        lengthMinutes: meta.minutes,
        title: meta.title,
        coverGlyph: meta.glyph,
        colorClass: meta.colorClass,
        status: EPISODE_STATUS.PENDING,
      },
    });
  }

  // Step 1–2
  const count = await sourceNews(date);
  console.log(`Sourced ${count} articles.`);
  const selected = await selectStories(date);
  console.log(`Selected ${selected.length} stories for the day.`);
  if (selected.length === 0) throw new Error("No stories sourced — cannot generate episodes.");

  // Step 3–4 per length (independent failure)
  for (const meta of lengths) {
    const ep = await prisma.episode.findUnique({
      where: { date_lengthMinutes: { date, lengthMinutes: meta.minutes } },
    });
    if (ep?.status === EPISODE_STATUS.READY) {
      console.log(`  ${meta.minutes}m already ready — skipping.`);
      continue;
    }
    console.log(`Generating ${meta.minutes}-minute episode…`);
    try {
      await generateEpisode(date, meta, selected, dateDisplay);
    } catch (err) {
      console.error(`  ${meta.minutes}m FAILED: ${(err as Error).message}`);
      await prisma.episode.update({
        where: { date_lengthMinutes: { date, lengthMinutes: meta.minutes } },
        data: { status: EPISODE_STATUS.FAILED, errorMessage: String((err as Error).message).slice(0, 500) },
      });
    }
  }

  // Step 5
  await notifyDigest(date, dateDisplay);
  console.log("=== Pipeline complete ===\n");
}

// Scheduling note: to run automatically each morning, wrap runPipeline() in
// node-cron with `cron.schedule("0 6 * * *", () => runPipeline(), { timezone: env.APP_TZ })`.
// Idempotency makes a missed or duplicate tick safe.
