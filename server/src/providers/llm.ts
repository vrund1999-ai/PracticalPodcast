import { getPipelineEnv } from "../config/env";
import type { LengthMeta } from "../lib/constants";
import type { GeneratedScript } from "../pipeline/prompts/schema";
import { type ScriptArticle } from "./script-shared";
import { generateScriptAnthropic } from "./anthropic";
import { generateScriptGroq } from "./groq";

export type { ScriptArticle };

/** Dispatch script generation to the configured provider (LLM_PROVIDER in .env).
 *  The rest of the pipeline is provider-agnostic and calls only this. */
export async function generateScript(
  articles: ScriptArticle[],
  meta: LengthMeta,
  dateDisplay: string
): Promise<GeneratedScript> {
  const { LLM_PROVIDER } = getPipelineEnv();
  switch (LLM_PROVIDER) {
    case "groq":
      return generateScriptGroq(articles, meta, dateDisplay);
    case "anthropic":
    default:
      return generateScriptAnthropic(articles, meta, dateDisplay);
  }
}
