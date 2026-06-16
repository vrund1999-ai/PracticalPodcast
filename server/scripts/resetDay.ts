// Delete a day's episodes (+ child rows + audio files) so the pipeline
// regenerates them from scratch. Usage: tsx scripts/resetDay.ts [YYYY-MM-DD]
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/db/client";
import { PATHS } from "../src/config/env";
import { appToday } from "../src/lib/dates";

async function main() {
  const date = process.argv[2] || appToday();
  const eps = await prisma.episode.findMany({ where: { date }, select: { id: true, lengthMinutes: true } });
  if (!eps.length) {
    console.log(`No episodes for ${date}.`);
    return prisma.$disconnect();
  }
  const ids = eps.map((e) => e.id);
  await prisma.chapter.deleteMany({ where: { episodeId: { in: ids } } });
  await prisma.transcriptLine.deleteMany({ where: { episodeId: { in: ids } } });
  await prisma.episodeArticle.deleteMany({ where: { episodeId: { in: ids } } });
  await prisma.playbackState.deleteMany({ where: { episodeId: { in: ids } } });
  await prisma.episode.deleteMany({ where: { id: { in: ids } } });
  for (const e of eps) {
    const f = path.join(PATHS.audio, `${e.id}.mp3`);
    if (fs.existsSync(f)) fs.rmSync(f, { force: true });
  }
  console.log(`Reset ${eps.length} episode(s) for ${date}.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
