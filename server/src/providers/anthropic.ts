import Anthropic from "@anthropic-ai/sdk";
import { getPipelineEnv } from "../config/env";
import type { LengthMeta } from "../lib/constants";
import { SCRIPT_SYSTEM_PROMPT } from "../pipeline/prompts/system";
import { SCRIPT_SCHEMA, type GeneratedScript } from "../pipeline/prompts/schema";
import { buildUserMessage, type ScriptArticle } from "./script-shared";

export type { ScriptArticle };

let client: Anthropic | null = null;
function getClient(): Anthropic {
  const env = getPipelineEnv();
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY! });
  return client;
}

/** Generate one episode's structured two-host script via Claude (streaming,
 *  adaptive thinking, prompt-cached system prompt, structured JSON output). */
export async function generateScriptAnthropic(
  articles: ScriptArticle[],
  meta: LengthMeta,
  dateDisplay: string
): Promise<GeneratedScript> {
  const c = getClient();
  const userText = buildUserMessage(articles, meta, dateDisplay);

  const params = {
    model: "claude-opus-4-8",
    max_tokens: meta.maxTokens,
    thinking: { type: "adaptive" },
    // Cached, byte-stable system prompt + structured JSON output + effort.
    output_config: { effort: "high", format: { type: "json_schema", schema: SCRIPT_SCHEMA } },
    system: [
      { type: "text", text: SCRIPT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: userText }],
  };

  let lastErr: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      // Stream to avoid HTTP timeouts on the multi-thousand-token output.
      const stream = c.messages.stream(params as any);
      const msg = await stream.finalMessage();

      if (msg.stop_reason === "max_tokens") {
        throw new Error(`Script for ${meta.minutes}m hit max_tokens (${meta.maxTokens}); output truncated.`);
      }
      const textBlock = msg.content.find((b) => b.type === "text") as { text: string } | undefined;
      if (!textBlock?.text) throw new Error("Claude returned no text block.");

      const script = JSON.parse(textBlock.text) as GeneratedScript;
      if (!script.segments?.length) throw new Error("Generated script has no segments.");

      const u: any = msg.usage;
      console.log(
        `  Claude ${meta.minutes}m: in=${u.input_tokens} cacheRead=${u.cache_read_input_tokens ?? 0} cacheWrite=${u.cache_creation_input_tokens ?? 0} out=${u.output_tokens}`
      );
      return script;
    } catch (err) {
      lastErr = err;
      console.warn(`  Claude attempt ${attempt} for ${meta.minutes}m failed: ${(err as Error).message}`);
    }
  }
  throw lastErr;
}
