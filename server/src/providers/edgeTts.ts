import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { getOptionalEnv } from "../config/env";
import { HOSTS, type Speaker } from "../lib/constants";

// Microsoft Edge "Read Aloud" neural voices — free, no API key, no quota. The
// package handles the Sec-MS-GEC security token, so it works server-side.
const FORMAT = OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3;

// Defaults: a warm female lead (Nova) and a measured male analyst (Atlas).
const DEFAULT_NOVA = "en-US-AriaNeural";
const DEFAULT_ATLAS = "en-US-ChristopherNeural";

function voiceFor(speaker: Speaker): string {
  return speaker === HOSTS.NOVA.speaker
    ? getOptionalEnv("EDGE_VOICE_NOVA") ?? DEFAULT_NOVA
    : getOptionalEnv("EDGE_VOICE_ATLAS") ?? DEFAULT_ATLAS;
}

// The SSML template interpolates the text directly (no escaping), so escape the
// XML metacharacters ourselves — news copy contains "S&P", "AT&T", etc.
function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// One reused connection per voice (Nova/Atlas) across all of a run's lines.
const instances: Partial<Record<Speaker, MsEdgeTTS>> = {};

async function getInstance(speaker: Speaker): Promise<MsEdgeTTS> {
  let tts = instances[speaker];
  if (!tts) {
    tts = new MsEdgeTTS();
    await tts.setMetadata(voiceFor(speaker), FORMAT);
    instances[speaker] = tts;
  }
  return tts;
}

async function collect(tts: MsEdgeTTS, text: string): Promise<Buffer> {
  const { audioStream } = await tts.toStream(escapeXml(text));
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let settled = false;
    const done = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err);
      else if (!chunks.length) reject(new Error("Edge TTS produced no audio"));
      else resolve(Buffer.concat(chunks));
    };
    const timer = setTimeout(() => done(new Error("Edge TTS timed out")), 45_000);
    audioStream.on("data", (d: Buffer) => chunks.push(Buffer.from(d)));
    audioStream.on("end", () => done());
    audioStream.on("close", () => done());
    audioStream.on("error", (e: Error) => done(e));
  });
}

/** Synthesize one spoken line to an MP3 buffer using a free Edge neural voice. */
export async function synthesizeLineEdge(text: string, speaker: Speaker): Promise<Buffer> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const tts = await getInstance(speaker);
      return await collect(tts, text);
    } catch (e) {
      lastErr = e;
      // Drop a possibly-dead connection so the retry reconnects fresh.
      try {
        instances[speaker]?.close();
      } catch {
        /* ignore */
      }
      delete instances[speaker];
    }
  }
  throw lastErr;
}
