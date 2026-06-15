// Run the daily generation pipeline once, now. Usage:
//   npm run pipeline            (generates for today, app timezone)
//   npm run pipeline -- 2026-06-13   (generate for a specific date)
import { prisma } from "../src/db/client";
import { runPipeline } from "../src/pipeline/runPipeline";

const dateArg = process.argv[2] && /^\d{4}-\d{2}-\d{2}$/.test(process.argv[2]) ? process.argv[2] : undefined;

runPipeline(dateArg)
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("\nPipeline error:", err.message || err);
    await prisma.$disconnect();
    process.exit(1);
  });
