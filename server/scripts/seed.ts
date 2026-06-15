import { prisma } from "../src/db/client";
import { TOPICS } from "../src/lib/topics";
import { seedSampleEpisodes } from "./seedSample";

async function seedTopics() {
  for (const t of TOPICS) {
    await prisma.topic.upsert({
      where: { slug: t.slug },
      update: {
        name: t.name,
        emoji: t.emoji,
        colorClass: t.colorClass,
        newsapiCategory: t.newsapiCategory ?? null,
        newsapiQuery: t.newsapiQuery ?? null,
        sortOrder: t.sortOrder,
      },
      create: {
        slug: t.slug,
        name: t.name,
        emoji: t.emoji,
        colorClass: t.colorClass,
        newsapiCategory: t.newsapiCategory ?? null,
        newsapiQuery: t.newsapiQuery ?? null,
        sortOrder: t.sortOrder,
      },
    });
  }
  console.log(`Seeded ${TOPICS.length} topics.`);
}

async function main() {
  const withSample = process.argv.includes("--sample");
  await seedTopics();
  if (withSample) {
    await seedSampleEpisodes();
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
