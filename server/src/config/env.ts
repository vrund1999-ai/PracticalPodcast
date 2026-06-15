import path from "node:path";
import { z } from "zod";

// Load ./.env (relative to cwd, which is the server/ dir when started via npm).
// In production the real environment is used; a missing file is not fatal.
try {
  process.loadEnvFile();
} catch {
  /* no .env file — rely on the real environment */
}

/** Parse "true"/"1" as true, everything else false. (z.coerce.boolean treats any
 *  non-empty string as true, so "false" would wrongly become true.) */
const boolish = z.preprocess((v) => {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return ["true", "1", "yes", "on"].includes(v.toLowerCase());
  return false;
}, z.boolean());

const webSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be at least 16 chars"),
  OTP_PEPPER: z.string().min(16, "OTP_PEPPER must be at least 16 chars"),
  APP_TZ: z.string().default("America/New_York"),
  DEV_LOG_OTP: boolish.default(true),
  DEV_MAX_TTS_LINES: z.coerce.number().int().min(0).default(0),
  DEV_ONLY_SHORT: boolish.default(false),
});

function parseWebEnv() {
  const parsed = webSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    console.error(
      `\nInvalid or missing web configuration in server/.env:\n${issues}\n` +
        `Copy server/.env.example to server/.env and fill the required values.\n`
    );
    process.exit(1);
  }
  return parsed.data;
}

export const env = parseWebEnv();

/** Absolute paths derived once. cwd is the server/ dir when launched via npm. */
export const PATHS = {
  mockups: path.resolve(process.cwd(), "..", "mockups"),
  audio: path.resolve(process.cwd(), "storage", "audio"),
};

// ----- Pipeline provider config (validated lazily, only when the pipeline runs) -----

const pipelineSchema = z
  .object({
    // Which model writes the scripts. Each provider's key is required only when selected.
    LLM_PROVIDER: z.enum(["anthropic", "groq"]).default("anthropic"),
    ANTHROPIC_API_KEY: z.string().optional(),
    GROQ_API_KEY: z.string().optional(),
    NEWSAPI_KEY: z.string().min(1, "NEWSAPI_KEY is required for the pipeline"),
    // Text-to-speech provider. "edge" needs no key/quota; "elevenlabs" needs key + voices.
    TTS_PROVIDER: z.enum(["elevenlabs", "edge"]).default("elevenlabs"),
    ELEVENLABS_API_KEY: z.string().optional(),
    ELEVENLABS_VOICE_NOVA: z.string().optional(),
    ELEVENLABS_VOICE_ATLAS: z.string().optional(),
    // Email (Gmail SMTP) is best-effort and validated in the email provider, not here.
  })
  .superRefine((val, ctx) => {
    const missing = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

    // Script provider key.
    if (val.LLM_PROVIDER === "groq") {
      if (!val.GROQ_API_KEY) missing("GROQ_API_KEY", 'GROQ_API_KEY is required when LLM_PROVIDER="groq"');
    } else if (!val.ANTHROPIC_API_KEY) {
      missing("ANTHROPIC_API_KEY", 'ANTHROPIC_API_KEY is required when LLM_PROVIDER="anthropic"');
    }

    // TTS provider config (Edge needs nothing).
    if (val.TTS_PROVIDER === "elevenlabs") {
      if (!val.ELEVENLABS_API_KEY)
        missing("ELEVENLABS_API_KEY", 'ELEVENLABS_API_KEY is required when TTS_PROVIDER="elevenlabs"');
      if (!val.ELEVENLABS_VOICE_NOVA)
        missing("ELEVENLABS_VOICE_NOVA", 'ELEVENLABS_VOICE_NOVA is required when TTS_PROVIDER="elevenlabs"');
      if (!val.ELEVENLABS_VOICE_ATLAS)
        missing("ELEVENLABS_VOICE_ATLAS", 'ELEVENLABS_VOICE_ATLAS is required when TTS_PROVIDER="elevenlabs"');
    }
  });

export type PipelineEnv = z.infer<typeof pipelineSchema>;

/** Returns validated pipeline env or throws a readable error listing the missing keys. */
export function getPipelineEnv(): PipelineEnv {
  const parsed = pipelineSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Pipeline configuration is incomplete:\n${issues}`);
  }
  return parsed.data;
}

/** Optional access to a single provider key without throwing (e.g. email in dev). */
export function getOptionalEnv(key: string): string | undefined {
  const v = process.env[key];
  return v && v.length > 0 ? v : undefined;
}
