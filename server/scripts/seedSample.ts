// Sample data so the whole UI works with zero API credits: a few READY
// episodes (today + yesterday) with a coherent two-host transcript, chapters,
// sourced articles, and a copy of the placeholder MP3 per episode.
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/db/client";
import { PATHS } from "../src/config/env";
import { EPISODE_LENGTHS, EPISODE_STATUS, SPEAKER, lengthMeta } from "../src/lib/constants";
import { appToday, addDays } from "../src/lib/dates";

const PLACEHOLDER = path.resolve(process.cwd(), "scripts", "assets", "placeholder.mp3");
const PLACEHOLDER_DURATION = 8; // seconds (matches the generated clip)

interface ArticleSeed {
  headline: string;
  source: string;
  topicSlug: string;
  summary: string;
  minsAgo: number;
}

const ARTICLES_TODAY: ArticleSeed[] = [
  { headline: "Fed signals a pause as inflation cools to 2.4%", source: "Reuters", topicSlug: "finance", summary: "Policymakers held rates steady and hinted the tightening cycle may be over as price growth eased.", minsAgo: 78 },
  { headline: "Markets rally as chipmakers post record quarter", source: "Bloomberg", topicSlug: "markets", summary: "A blowout earnings season for semiconductors lifted indexes to fresh highs.", minsAgo: 255 },
  { headline: "EU and Mercosur finalize landmark trade pact", source: "AP", topicSlug: "geopolitics", summary: "After two decades of talks, the blocs agreed to one of the world's largest free-trade zones.", minsAgo: 102 },
  { headline: "Pacific summit ends with new climate-finance accord", source: "The Guardian", topicSlug: "geopolitics", summary: "Island nations secured fresh funding commitments to adapt to rising seas.", minsAgo: 320 },
  { headline: "New solid-state battery hits 1,000-mile range in trials", source: "The Verge", topicSlug: "technology", summary: "A startup says its prototype cell triples energy density without overheating.", minsAgo: 150 },
  { headline: "Open-source model matches frontier labs on reasoning", source: "Ars Technica", topicSlug: "technology", summary: "A community-trained model posted competitive scores on hard reasoning benchmarks.", minsAgo: 360 },
  { headline: "Webb telescope spots water vapor on a temperate exoplanet", source: "Nature", topicSlug: "science", summary: "Spectra suggest a thin atmosphere on a world in its star's habitable zone.", minsAgo: 200 },
  { headline: "Senate advances bipartisan permitting-reform bill", source: "Politico", topicSlug: "politics", summary: "The measure would speed approvals for transmission lines and clean-energy projects.", minsAgo: 95 },
  { headline: "Regulators publish first cross-border AI safety framework", source: "Financial Times", topicSlug: "ai", summary: "A coalition of agencies released shared evaluation standards for frontier systems.", minsAgo: 410 },
  { headline: "Trial shows once-weekly insulin matches daily dosing", source: "STAT", topicSlug: "health", summary: "A late-stage study reported comparable glucose control with far fewer injections.", minsAgo: 175 },
  { headline: "Grid operators report record solar output this spring", source: "Reuters", topicSlug: "energy", summary: "Midday solar repeatedly met a majority of demand in several regions.", minsAgo: 60 },
  { headline: "Carbon-removal startups cross 1M-ton milestone", source: "The Guardian", topicSlug: "climate", summary: "Direct-air-capture deliveries surpassed a million tons for the first time.", minsAgo: 280 },
  { headline: "Treasury yields slip as traders price in a soft landing", source: "Bloomberg", topicSlug: "finance", summary: "Bond markets moved as recession fears faded after the inflation print.", minsAgo: 48 },
  { headline: "Reusable lunar lander completes first uncrewed test", source: "Ars Technica", topicSlug: "space", summary: "The vehicle touched down and relit its engines for a short hop.", minsAgo: 330 },
];

const ARTICLES_YDAY: ArticleSeed[] = [
  { headline: "Central banks coordinate on digital-currency standards", source: "Reuters", topicSlug: "finance", summary: "A working group published interoperability guidelines for CBDC pilots.", minsAgo: 120 },
  { headline: "High-speed rail corridor breaks ground", source: "AP", topicSlug: "transportation", summary: "Construction began on a long-delayed intercity line.", minsAgo: 240 },
  { headline: "Researchers demo room-temperature quantum error correction", source: "Nature", topicSlug: "science", summary: "A new architecture kept logical qubits stable far longer than before.", minsAgo: 300 },
  { headline: "Defense ministers agree on joint drone-defense program", source: "Financial Times", topicSlug: "defense", summary: "Allied nations pooled funding for counter-UAS systems.", minsAgo: 180 },
  { headline: "Streaming giants report a record content quarter", source: "The Verge", topicSlug: "culture", summary: "Subscriber growth rebounded on a slate of breakout releases.", minsAgo: 90 },
  { headline: "Wind farms set a new overnight generation record", source: "Bloomberg", topicSlug: "energy", summary: "Strong seasonal winds pushed output past previous peaks.", minsAgo: 360 },
];

const LINES = [
  { speaker: SPEAKER.NOVA, startSeconds: 0, text: "Good morning — it's Nova, here with Atlas, and here's what's moving the world today." },
  { speaker: SPEAKER.ATLAS, startSeconds: 1, text: "Thanks, Nova. Top of the list: the Fed signaled a pause as inflation cooled to 2.4 percent." },
  { speaker: SPEAKER.NOVA, startSeconds: 2, text: "Markets liked it — chipmakers posted a record quarter and the rally broadened." },
  { speaker: SPEAKER.ATLAS, startSeconds: 3, text: "On the global front, the EU and Mercosur finalized a landmark trade pact." },
  { speaker: SPEAKER.NOVA, startSeconds: 4, text: "In tech, a new solid-state battery hit a thousand-mile range in early trials." },
  { speaker: SPEAKER.ATLAS, startSeconds: 5, text: "And an open-source model matched the frontier labs on reasoning benchmarks." },
  { speaker: SPEAKER.NOVA, startSeconds: 6, text: "We'll dig into each of these, plus science, health, and energy, in a moment." },
  { speaker: SPEAKER.ATLAS, startSeconds: 7, text: "That's your quick brief — let's get into it." },
];

const CHAPTERS = [
  { title: "Intro & today's headlines", startSeconds: 0, topicsCsv: "Finance,Markets" },
  { title: "The Fed pauses", startSeconds: 3, topicsCsv: "Finance" },
  { title: "Wrap-up & what to watch", startSeconds: 6, topicsCsv: "All topics" },
];

async function upsertArticles(seeds: ArticleSeed[], sourcedDate: string, dayOffset: number) {
  const topics = await prisma.topic.findMany();
  const slugToId = new Map(topics.map((t) => [t.slug, t.id]));
  const ids: string[] = [];
  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i];
    const topicId = slugToId.get(s.topicSlug);
    if (!topicId) continue;
    const url = `https://example.com/${sourcedDate}/${s.topicSlug}/${i}`;
    const publishedAt = new Date(Date.now() - dayOffset * 86_400_000 - s.minsAgo * 60_000);
    const a = await prisma.article.upsert({
      where: { url_sourcedDate: { url, sourcedDate } },
      update: { headline: s.headline, summary: s.summary, source: s.source, topicId, publishedAt, rank: i },
      create: { url, sourcedDate, headline: s.headline, summary: s.summary, source: s.source, topicId, publishedAt, rank: i },
    });
    ids.push(a.id);
  }
  return ids;
}

async function createEpisode(date: string, dayOffset: number, lengthMinutes: number, articleIds: string[]) {
  const meta = lengthMeta(lengthMinutes);
  const generatedAt = new Date(Date.now() - dayOffset * 86_400_000);

  const ep = await prisma.episode.upsert({
    where: { date_lengthMinutes: { date, lengthMinutes } },
    update: {
      title: meta.title,
      coverGlyph: meta.glyph,
      colorClass: meta.colorClass,
      status: EPISODE_STATUS.READY,
      durationSeconds: PLACEHOLDER_DURATION,
      generatedAt,
    },
    create: {
      date,
      lengthMinutes,
      title: meta.title,
      coverGlyph: meta.glyph,
      colorClass: meta.colorClass,
      status: EPISODE_STATUS.READY,
      durationSeconds: PLACEHOLDER_DURATION,
      generatedAt,
    },
  });

  // Reset children for idempotent re-seeds.
  await prisma.chapter.deleteMany({ where: { episodeId: ep.id } });
  await prisma.transcriptLine.deleteMany({ where: { episodeId: ep.id } });
  await prisma.episodeArticle.deleteMany({ where: { episodeId: ep.id } });

  await prisma.chapter.createMany({
    data: CHAPTERS.map((c, i) => ({ episodeId: ep.id, ...c, order: i })),
  });
  await prisma.transcriptLine.createMany({
    data: LINES.map((l, i) => ({ episodeId: ep.id, speaker: l.speaker, startSeconds: l.startSeconds, text: l.text, order: i })),
  });
  const linked = articleIds.slice(0, 8);
  await prisma.episodeArticle.createMany({
    data: linked.map((articleId, i) => ({ episodeId: ep.id, articleId, order: i })),
  });

  await prisma.episode.update({ where: { id: ep.id }, data: { audioUrl: `/api/audio/${ep.id}` } });

  // Copy the placeholder MP3 into storage/audio/<id>.mp3.
  fs.mkdirSync(PATHS.audio, { recursive: true });
  fs.copyFileSync(PLACEHOLDER, path.join(PATHS.audio, `${ep.id}.mp3`));
  return ep.id;
}

export async function seedSampleEpisodes(): Promise<void> {
  if (!fs.existsSync(PLACEHOLDER)) {
    console.warn(`Placeholder MP3 missing at ${PLACEHOLDER}; skipping sample episodes.`);
    return;
  }
  const today = appToday();
  const yesterday = addDays(today, -1);

  const todayArticles = await upsertArticles(ARTICLES_TODAY, today, 0);
  const ydayArticles = await upsertArticles(ARTICLES_YDAY, yesterday, 1);

  for (const len of EPISODE_LENGTHS) {
    await createEpisode(today, 0, len.minutes, todayArticles);
    await createEpisode(yesterday, 1, len.minutes, ydayArticles);
  }

  console.log(`Seeded sample episodes for ${today} and ${yesterday} (${EPISODE_LENGTHS.length} lengths each).`);
}
