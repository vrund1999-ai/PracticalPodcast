import { getPipelineEnv } from "../config/env";

export interface SourcedArticle {
  headline: string;
  summary: string | null;
  source: string;
  url: string;
  publishedAt: Date | null;
}

interface NewsApiArticle {
  title: string | null;
  description: string | null;
  url: string;
  publishedAt: string | null;
  source: { name: string | null };
}

interface TopicQuery {
  slug: string;
  newsapiCategory: string | null;
  newsapiQuery: string | null;
}

const BASE = "https://newsapi.org/v2";
const PER_TOPIC = 6;

async function fetchJson(url: string, apiKey: string): Promise<NewsApiArticle[]> {
  const res = await fetch(url, { headers: { "X-Api-Key": apiKey, "User-Agent": "PracticalPodcast/1.0" } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`NewsAPI ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { status: string; articles?: NewsApiArticle[]; message?: string };
  if (data.status !== "ok") throw new Error(`NewsAPI error: ${data.message ?? "unknown"}`);
  return data.articles ?? [];
}

function normalize(a: NewsApiArticle): SourcedArticle | null {
  if (!a.url || !a.title || a.title === "[Removed]") return null;
  return {
    headline: a.title.trim(),
    summary: a.description ? a.description.trim() : null,
    source: a.source?.name?.trim() || "Unknown",
    url: a.url,
    publishedAt: a.publishedAt ? new Date(a.publishedAt) : null,
  };
}

/** Fetch top articles for one topic via its category (top-headlines) or query (everything). */
export async function fetchTopicArticles(topic: TopicQuery): Promise<SourcedArticle[]> {
  const { NEWSAPI_KEY } = getPipelineEnv();
  let url: string;
  if (topic.newsapiCategory) {
    url = `${BASE}/top-headlines?category=${encodeURIComponent(topic.newsapiCategory)}&language=en&pageSize=${PER_TOPIC}`;
  } else if (topic.newsapiQuery) {
    url = `${BASE}/everything?q=${encodeURIComponent(topic.newsapiQuery)}&language=en&sortBy=publishedAt&pageSize=${PER_TOPIC}`;
  } else {
    return [];
  }
  const raw = await fetchJson(url, NEWSAPI_KEY);
  const seen = new Set<string>();
  const out: SourcedArticle[] = [];
  for (const a of raw) {
    const n = normalize(a);
    if (!n) continue;
    if (seen.has(n.url)) continue;
    seen.add(n.url);
    out.push(n);
  }
  return out;
}
