// Remove FAILED episode rows (and any child rows) so they don't show as broken
// cards in the library. Safe: the pipeline recreates them on the next run.
import { prisma } from "../src/db/client";
import { EPISODE_STATUS } from "../src/lib/constants";

async function main() {
  const failed = await prisma.episode.findMany({
    where: { status: EPISODE_STATUS.FAILED },
    select: { id: true, date: true, lengthMinutes: true },
  });
  if (!failed.length) {
    console.log("No FAILED episodes to prune.");
    return prisma.$disconnect();
  }
  const ids = failed.map((e) => e.id);
  await prisma.chapter.deleteMany({ where: { episodeId: { in: ids } } });
  await prisma.transcriptLine.deleteMany({ where: { episodeId: { in: ids } } });
  await prisma.episodeArticle.deleteMany({ where: { episodeId: { in: ids } } });
  await prisma.playbackState.deleteMany({ where: { episodeId: { in: ids } } });
  await prisma.episode.deleteMany({ where: { id: { in: ids } } });
  for (const e of failed) console.log(`  pruned FAILED ${e.date} ${e.lengthMinutes}m`);
  console.log(`Pruned ${failed.length} FAILED episode(s).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
