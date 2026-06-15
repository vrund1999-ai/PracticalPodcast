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

const pipelineSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required for the pipeline"),
  NEWSAPI_KEY: z.string().min(1, "NEWSAPI_KEY is required for the pipeline"),
  ELEVENLABS_API_KEY: z.string().min(1, "ELEVENLABS_API_KEY is required for the pipeline"),
  ELEVENLABS_VOICE_NOVA: z.string().min(1, "ELEVENLABS_VOICE_NOVA (female voice id) is required"),
  ELEVENLABS_VOICE_ATLAS: z.string().min(1, "ELEVENLABS_VOICE_ATLAS (male voice id) is required"),
  // Email (Gmail SMTP) is best-effort and validated in the email provider, not here.
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
