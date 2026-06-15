// The 16 topics from the onboarding mockup. `colorClass` maps each topic onto
// the 9 cover gradients that actually exist in mockups/styles.css
// (finance, tech, science, politics, geo, transport, health, ai, mix).
// `newsapiCategory` is set when NewsAPI has a native /top-headlines category;
// otherwise `newsapiQuery` drives /v2/everything.

export interface TopicSeed {
  slug: string;
  name: string;
  emoji: string;
  colorClass: string;
  newsapiCategory?: string;
  newsapiQuery?: string;
  sortOrder: number;
}

export const TOPICS: TopicSeed[] = [
  { slug: "finance", name: "Finance", emoji: "💰", colorClass: "cover--finance", newsapiCategory: "business", sortOrder: 0 },
  { slug: "technology", name: "Technology", emoji: "💻", colorClass: "cover--tech", newsapiCategory: "technology", sortOrder: 1 },
  { slug: "science", name: "Science", emoji: "🔬", colorClass: "cover--science", newsapiCategory: "science", sortOrder: 2 },
  { slug: "ai", name: "AI", emoji: "🤖", colorClass: "cover--ai", newsapiQuery: "artificial intelligence OR machine learning OR LLM OR OpenAI OR Anthropic", sortOrder: 3 },
  { slug: "politics", name: "Politics", emoji: "🏛️", colorClass: "cover--politics", newsapiQuery: "politics OR election OR congress OR senate OR legislation", sortOrder: 4 },
  { slug: "geopolitics", name: "Geopolitics", emoji: "🌍", colorClass: "cover--geo", newsapiQuery: "geopolitics OR diplomacy OR foreign policy OR sanctions OR treaty", sortOrder: 5 },
  { slug: "transportation", name: "Transportation", emoji: "🚆", colorClass: "cover--transport", newsapiQuery: "transportation OR aviation OR railway OR shipping OR electric vehicles", sortOrder: 6 },
  { slug: "markets", name: "Markets", emoji: "📈", colorClass: "cover--finance", newsapiQuery: "stock market OR markets OR S&P 500 OR Nasdaq OR bonds OR earnings", sortOrder: 7 },
  { slug: "health", name: "Health", emoji: "🩺", colorClass: "cover--health", newsapiCategory: "health", sortOrder: 8 },
  { slug: "climate", name: "Climate", emoji: "🌱", colorClass: "cover--science", newsapiQuery: "climate change OR emissions OR global warming OR carbon", sortOrder: 9 },
  { slug: "energy", name: "Energy", emoji: "⚡", colorClass: "cover--transport", newsapiQuery: "energy OR oil OR natural gas OR renewable OR power grid OR nuclear", sortOrder: 10 },
  { slug: "business", name: "Business", emoji: "🏗️", colorClass: "cover--finance", newsapiCategory: "business", sortOrder: 11 },
  { slug: "defense", name: "Defense", emoji: "🛡️", colorClass: "cover--geo", newsapiQuery: "defense OR military OR NATO OR weapons OR Pentagon", sortOrder: 12 },
  { slug: "culture", name: "Culture", emoji: "🎬", colorClass: "cover--mix", newsapiCategory: "entertainment", sortOrder: 13 },
  { slug: "sports", name: "Sports", emoji: "⚽", colorClass: "cover--mix", newsapiCategory: "sports", sortOrder: 14 },
  { slug: "space", name: "Space", emoji: "🚀", colorClass: "cover--science", newsapiQuery: "space OR NASA OR SpaceX OR rocket OR satellite OR astronomy", sortOrder: 15 },
];

/** Topic slugs pre-selected in the onboarding mockup (and used by "Skip for now"). */
export const DEFAULT_TOPIC_SLUGS = ["finance", "technology", "science", "ai"];

export const MIN_TOPICS = 3;
