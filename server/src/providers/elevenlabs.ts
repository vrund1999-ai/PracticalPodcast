import { getPipelineEnv } from "../config/env";
import { HOSTS, type Speaker } from "../lib/constants";

const BASE = "https://api.elevenlabs.io/v1/text-to-speech";
const MODEL = "eleven_multilingual_v2";

function voiceForSpeaker(speaker: Speaker): string {
  const env = getPipelineEnv();
  // Present whenever TTS_PROVIDER="elevenlabs" (validated in config/env).
  return speaker === HOSTS.NOVA.speaker ? env.ELEVENLABS_VOICE_NOVA! : env.ELEVENLABS_VOICE_ATLAS!;
}

/** Synthesize one spoken line to an MP3 buffer using the speaker's voice. */
export async function synthesizeLineElevenLabs(text: string, speaker: Speaker): Promise<Buffer> {
  const ELEVENLABS_API_KEY = getPipelineEnv().ELEVENLABS_API_KEY!;
  const voiceId = voiceForSpeaker(speaker);
  const res = await fetch(`${BASE}/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: MODEL,
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ElevenLabs ${res.status}: ${body.slice(0, 200)}`);
  }
  const arr = await res.arrayBuffer();
  return Buffer.from(arr);
}
