// App-level constants for the "enum-like" String columns (SQLite has no enums)
// plus the fixed per-length and per-host presentation metadata that the
// mockups already encode.

export const EPISODE_STATUS = {
  PENDING: "PENDING",
  GENERATING: "GENERATING",
  READY: "READY",
  FAILED: "FAILED",
} as const;
export type EpisodeStatus = (typeof EPISODE_STATUS)[keyof typeof EPISODE_STATUS];

export const SPEAKER = { NOVA: "NOVA", ATLAS: "ATLAS" } as const;
export type Speaker = (typeof SPEAKER)[keyof typeof SPEAKER];

/** The two AI hosts (constants, not a DB table). */
export const HOSTS = {
  NOVA: {
    speaker: SPEAKER.NOVA,
    name: "Nova",
    role: "female host",
    avatar: "N",
    avatarClass: "avatar--f",
    lineClass: "is-f",
    voiceEnv: "ELEVENLABS_VOICE_NOVA",
  },
  ATLAS: {
    speaker: SPEAKER.ATLAS,
    name: "Atlas",
    role: "male host",
    avatar: "A",
    avatarClass: "avatar--m",
    lineClass: "is-m",
    voiceEnv: "ELEVENLABS_VOICE_ATLAS",
  },
} as const;

export interface LengthMeta {
  minutes: 10 | 30 | 60;
  dataLen: "10" | "30" | "60"; // matches frontend data-card-len
  title: string;
  glyph: string;
  colorClass: string;
  badgeClass: string;
  badgeLabel: string;
  targetWords: number; // ~150 wpm
  maxTokens: number; // Claude max_tokens for this length
}

/** The three daily episodes, in display order, exactly as the mockups present them. */
export const EPISODE_LENGTHS: LengthMeta[] = [
  {
    minutes: 10,
    dataLen: "10",
    title: "The Quick Brief",
    glyph: "🎧",
    colorClass: "cover--mix",
    badgeClass: "badge--short",
    badgeLabel: "10 MIN",
    targetWords: 1500,
    maxTokens: 16000,
  },
  {
    minutes: 30,
    dataLen: "30",
    title: "The Daily Deep Dive",
    glyph: "🎙️",
    colorClass: "cover--tech",
    badgeClass: "badge--mid",
    badgeLabel: "30 MIN",
    targetWords: 4500,
    maxTokens: 32000,
  },
  {
    minutes: 60,
    dataLen: "60",
    title: "The Full Story",
    glyph: "📻",
    colorClass: "cover--science",
    badgeClass: "badge--long",
    badgeLabel: "1 HOUR",
    targetWords: 9000,
    maxTokens: 64000,
  },
];

export function lengthMeta(minutes: number): LengthMeta {
  const m = EPISODE_LENGTHS.find((l) => l.minutes === minutes);
  if (!m) throw new Error(`Unknown episode length: ${minutes}`);
  return m;
}
