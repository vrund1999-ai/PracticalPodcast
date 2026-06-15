import { prisma } from "../db/client";
import { appToday, dayDisplayDate, timeLabel } from "../lib/dates";

/** Today's (or a given date's) sourced articles, grouped by topic, with a flag
 *  for whether each article fed one of that day's episodes. */
export async function getDiscover(dateArg?: string, topicSlug?: string) {
  const date = dateArg || appToday();

  const articles = await prisma.article.findMany({
    where: {
      sourcedDate: date,
      ...(topicSlug ? { topic: { slug: topicSlug } } : {}),
    },
    include: { topic: true },
    orderBy: [{ rank: "asc" }, { publishedAt: "desc" }],
  });

  // Which articles made it into one of this date's podcasts.
  const usedRows = await prisma.episodeArticle.findMany({
    where: { episode: { date } },
    select: { articleId: true },
  });
  const used = new Set(usedRows.map((r) => r.articleId));

  // Group by topic, preserving topic sort order.
  const groups = new Map<
    string,
    { slug: string; name: string; emoji: string; colorClass: string; sortOrder: number; articles: any[] }
  >();
  for (const a of articles) {
    let g = groups.get(a.topic.slug);
    if (!g) {
      g = {
        slug: a.topic.slug,
        name: a.topic.name,
        emoji: a.topic.emoji,
        colorClass: a.topic.colorClass,
        sortOrder: a.topic.sortOrder,
        articles: [],
      };
      groups.set(a.topic.slug, g);
    }
    g.articles.push({
      id: a.id,
      headline: a.headline,
      summary: a.summary ?? "",
      source: a.source,
      publishedLabel: a.publishedAt ? timeLabel(a.publishedAt) : "",
      url: a.url,
      inTodaysPodcasts: used.has(a.id),
    });
  }

  const topics = [...groups.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ sortOrder, ...rest }) => rest);

  return { date, displayDate: dayDisplayDate(date), topics };
}
