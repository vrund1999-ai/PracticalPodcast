import type { LengthMeta } from "../lib/constants";

/** One day's selected story, as handed to whichever LLM writes the script. */
export interface ScriptArticle {
  headline: string;
  source: string;
  topicName: string;
  summary?: string | null;
}

/** The user-turn prompt: the day's stories + the per-length target. Provider-
 *  agnostic, so Anthropic and Groq send the identical instruction. */
export function buildUserMessage(
  articles: ScriptArticle[],
  meta: LengthMeta,
  dateDisplay: string
): string {
  const list = articles
    .map(
      (a, i) =>
        `${i + 1}. [${a.topicName}] "${a.headline}" — ${a.source}${a.summary ? ` — ${a.summary}` : ""}`
    )
    .join("\n");
  return (
    `Write the "${meta.title}" episode — ${meta.minutes} minutes, target about ${meta.targetWords} words.\n\n` +
    `Today is ${dateDisplay}.\n\n` +
    `Today's sourced stories, most important first:\n${list}\n\n` +
    `Use the exact episode title "${meta.title}". Cover the stories at a depth appropriate to a ${meta.minutes}-minute episode.`
  );
}

/** Plain-text description of the required JSON shape, appended to the system
 *  prompt for providers that take JSON-mode rather than a schema object
 *  (Anthropic gets the real schema via output_config instead). */
export const SCRIPT_JSON_INSTRUCTIONS = `OUTPUT FORMAT

Return ONLY a single JSON object — no markdown, no code fences, no commentary before or after. It must match exactly this shape:

{
  "title": "the episode title",
  "segments": [
    {
      "chapterTitle": "short chapter label, a few words",
      "topics": ["Finance", "Markets"],
      "lines": [
        { "speaker": "NOVA", "text": "one spoken line of plain prose" },
        { "speaker": "ATLAS", "text": "one spoken line of plain prose" }
      ]
    }
  ]
}

Rules: every "speaker" is exactly "NOVA" or "ATLAS". Every "text" is plain spoken prose — no markdown, no stage directions, no speaker labels inside the text. Produce an opening segment, one segment per major story, and a closing wrap-up segment, in that order. Do not wrap the JSON in code fences.`;
