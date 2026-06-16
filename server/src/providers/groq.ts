import { getPipelineEnv, getOptionalEnv } from "../config/env";
import type { LengthMeta } from "../lib/constants";
import { SCRIPT_SYSTEM_PROMPT } from "../pipeline/prompts/system";
import type { GeneratedScript, ScriptSegment } from "../pipeline/prompts/schema";
import { buildUserMessage, SCRIPT_JSON_INSTRUCTIONS, type ScriptArticle } from "./script-shared";

// Groq exposes an OpenAI-compatible chat-completions endpoint, so a plain fetch
// (matching the NewsAPI provider) is enough — no extra SDK.
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

// Llama 3.3 writes a roughly fixed amount per call regardless of the asked
// length, so we hit a long word target by making MORE calls (each covering
// fewer stories in more depth) rather than one big call. These also keep every
// request well under the free tier's 12k tokens-per-minute cap.
const MAX_CALL_OUTPUT = 8000; // hard ceiling on a single request's max_tokens
const WORDS_PER_CHUNK = 600; // ~ how many words one call reliably yields
const TOKENS_PER_WORD = 2.2; // words -> max_tokens (incl. JSON overhead), with headroom
const ASK_BOOST = 1.25; // ask for more than the share, to counter terseness

// Simple fixed-window rate pacer for Groq's free 12k TPM. Counts prompt +
// max_tokens (what Groq charges against the limit) and waits when the window
// would overflow. Module-level so it spans all calls in one pipeline run.
const TPM_LIMIT = 11_000; // safety margin under 12k
const PROMPT_TOKEN_EST = 2_800; // system + chunk prompt, generous estimate
let winStart = 0;
let winTokens = 0;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function pace(estTokens: number) {
  const now = Date.now();
  if (winStart === 0 || now - winStart >= 60_000) {
    winStart = now;
    winTokens = 0;
  }
  if (winTokens + estTokens > TPM_LIMIT) {
    const waitMs = 60_000 - (now - winStart) + 250;
    console.log(`  (Groq TPM pacing) waiting ${Math.ceil(waitMs / 1000)}s…`);
    await sleep(waitMs);
    winStart = Date.now();
    winTokens = 0;
  }
  winTokens += estTokens;
}

/** Strip an accidental ```json … ``` fence if the model adds one despite JSON mode. */
function stripFence(s: string): string {
  const t = s.trim();
  if (t.startsWith("```")) return t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  return t;
}

/** Split items into n order-preserving, roughly-even groups (drops empties). */
function splitEvenly<T>(arr: T[], n: number): T[][] {
  const groups: T[][] = Array.from({ length: n }, () => []);
  const per = Math.ceil(arr.length / n) || 1;
  arr.forEach((item, i) => groups[Math.min(n - 1, Math.floor(i / per))].push(item));
  return groups.filter((g) => g.length > 0);
}

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

/** One Groq chat-completion call returning the parsed JSON object. Handles rate
 *  limits (429, wait), oversize requests (413, fatal), truncation, and bad JSON
 *  with bounded retries. */
async function callGroq(
  messages: ChatMessage[],
  maxTokens: number,
  label: string,
  model: string,
  apiKey: string
): Promise<{ title?: string; segments?: ScriptSegment[] }> {
  await pace(PROMPT_TOKEN_EST + maxTokens);

  const body = {
    model,
    max_tokens: maxTokens,
    temperature: 0.6, // grounded news copy — keep it from drifting
    response_format: { type: "json_object" },
    messages,
  };

  let lastErr: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after")) || 30;
      console.warn(`  Groq rate-limited (429) on ${label}; waiting ${retryAfter}s…`);
      await sleep(retryAfter * 1000);
      winStart = 0; // reset the pacer window after a forced wait
      winTokens = 0;
      continue;
    }
    if (res.status === 413) {
      const t = await res.text().catch(() => "");
      throw new Error(`Groq request too large (413) on ${label}: ${t.slice(0, 200)}`);
    }
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      lastErr = new Error(`Groq ${res.status} on ${label}: ${t.slice(0, 200)}`);
      console.warn(`  ${(lastErr as Error).message}`);
      continue;
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const choice = data.choices?.[0];
    const content = choice?.message?.content;
    if (!content) {
      lastErr = new Error(`Groq returned no content on ${label}.`);
      console.warn(`  ${(lastErr as Error).message}`);
      continue;
    }
    if (choice?.finish_reason === "length") {
      lastErr = new Error(`${label} truncated (max_tokens ${maxTokens}).`);
      console.warn(`  ${(lastErr as Error).message}`);
      continue;
    }

    let parsed: { title?: string; segments?: ScriptSegment[] };
    try {
      parsed = JSON.parse(stripFence(content));
    } catch {
      lastErr = new Error(`${label} returned invalid JSON.`);
      console.warn(`  ${(lastErr as Error).message}`);
      continue;
    }
    const u = data.usage ?? {};
    console.log(`  Groq ${label}: in=${u.prompt_tokens ?? "?"} out=${u.completion_tokens ?? "?"}`);
    return parsed;
  }
  throw lastErr ?? new Error(`Groq failed on ${label}`);
}

/** How many of the day's stories a given length should actually cover (the
 *  Quick Brief covers the top handful; the Full Story covers them all). */
function storyCountFor(meta: LengthMeta, available: number): number {
  const byWords = Math.round(meta.targetWords / 250); // ~250 words per story
  return Math.max(3, Math.min(available, byWords));
}

/** Build the user turn for one part of a (possibly chunked) script. */
function buildPartMessage(
  all: ScriptArticle[],
  chunk: ScriptArticle[],
  meta: LengthMeta,
  dateDisplay: string,
  part: { index: number; total: number; isFirst: boolean; isLast: boolean; askWords: number }
): string {
  const lineup = all.map((a, i) => `${i + 1}. [${a.topicName}] "${a.headline}"`).join("\n");
  const detail = chunk
    .map((a) => `- [${a.topicName}] "${a.headline}" — ${a.source}${a.summary ? ` — ${a.summary}` : ""}`)
    .join("\n");

  let role: string;
  if (part.isFirst && part.isLast) {
    role = `Write the COMPLETE "${meta.title}" episode: an opening segment, one segment for EACH story below, and a closing wrap-up.`;
  } else if (part.isFirst) {
    role = `This is PART 1 of ${part.total} of the "${meta.title}" episode. Write the OPENING segment (Nova welcomes listeners and previews the day), then one segment for EACH story assigned to this part below. Do NOT write a closing wrap-up — later parts continue the episode.`;
  } else if (part.isLast) {
    role = `This is PART ${part.index + 1} of ${part.total} (the FINAL part) of the "${meta.title}" episode, already in progress. Do NOT write an opening. Write one segment for EACH story assigned to this part below, then end with the CLOSING wrap-up segment where the hosts recap the day and sign off.`;
  } else {
    role = `This is PART ${part.index + 1} of ${part.total} of the "${meta.title}" episode, already in progress. Do NOT write an opening or a closing. Write one segment for EACH story assigned to this part below.`;
  }

  return (
    `${role}\n\n` +
    `Today is ${dateDisplay}.\n\n` +
    `The full day's lineup (context for the opening/closing only — only write full segments for your assigned stories):\n${lineup}\n\n` +
    `Stories assigned to THIS part — write a substantial segment for each:\n${detail}\n\n` +
    `LENGTH: this part should run to approximately ${part.askWords} words. Be thorough, not terse. For each story go well beyond the headline — explain what happened, the key facts and figures, why it matters and who is affected, and the context or what to watch next — woven as a natural back-and-forth between Nova and Atlas with several exchanges per story.\n\n` +
    `Use the exact episode title "${meta.title}".`
  );
}

/** Generate one episode's structured two-host script via Groq (Llama 3.3 70B,
 *  JSON mode). Covers an appropriate number of stories and scales the call count
 *  to the word target so the audio actually approaches the nominal length, while
 *  staying under the free-tier per-minute token cap. Same signature as the
 *  Anthropic adapter — the pipeline is provider-agnostic. */
export async function generateScriptGroq(
  articles: ScriptArticle[],
  meta: LengthMeta,
  dateDisplay: string
): Promise<GeneratedScript> {
  const { GROQ_API_KEY } = getPipelineEnv();
  const model = getOptionalEnv("GROQ_MODEL") ?? DEFAULT_MODEL;
  const system = `${SCRIPT_SYSTEM_PROMPT}\n\n${SCRIPT_JSON_INSTRUCTIONS}`;

  const stories = articles.slice(0, storyCountFor(meta, articles.length));
  const chunks = Math.max(1, Math.min(stories.length, Math.ceil(meta.targetWords / WORDS_PER_CHUNK)));
  const groups = splitEvenly(stories, chunks);
  const total = groups.length;
  const askWords = Math.round((meta.targetWords / total) * ASK_BOOST);
  const chunkMax = Math.min(MAX_CALL_OUTPUT, Math.round(askWords * TOKENS_PER_WORD) + 400);

  console.log(
    `  Groq ${meta.minutes}m: ${stories.length} stories across ${total} part(s), ~${askWords} words each.`
  );

  let title = meta.title;
  const segments: ScriptSegment[] = [];

  for (let i = 0; i < total; i++) {
    const part = {
      index: i,
      total,
      isFirst: i === 0,
      isLast: i === total - 1,
      askWords,
    };
    const messages: ChatMessage[] = [
      { role: "system", content: system },
      {
        role: "user",
        content:
          total === 1
            ? buildUserMessage(groups[i], meta, dateDisplay)
            : buildPartMessage(stories, groups[i], meta, dateDisplay, part),
      },
    ];
    const label = total === 1 ? `${meta.minutes}m` : `${meta.minutes}m part ${i + 1}/${total}`;
    const res = await callGroq(messages, chunkMax, label, model, GROQ_API_KEY!);
    if (!res.segments?.length) throw new Error(`Groq ${label}: no segments returned.`);
    if (i === 0 && res.title) title = res.title;
    segments.push(...res.segments);
  }

  const lineCount = segments.reduce((n, s) => n + s.lines.length, 0);
  console.log(`  Groq ${meta.minutes}m: ${segments.length} segments, ${lineCount} lines total.`);
  return { title, segments };
}
