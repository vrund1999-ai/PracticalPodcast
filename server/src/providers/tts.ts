import { getPipelineEnv } from "../config/env";
import type { Speaker } from "../lib/constants";
import { synthesizeLineElevenLabs } from "./elevenlabs";
import { synthesizeLineEdge } from "./edgeTts";

/** Dispatch a single line's TTS to the configured provider (TTS_PROVIDER in
 *  .env). The pipeline calls only this; both adapters return an MP3 Buffer. */
export async function synthesizeLine(text: string, speaker: Speaker): Promise<Buffer> {
  const { TTS_PROVIDER } = getPipelineEnv();
  return TTS_PROVIDER === "edge"
    ? synthesizeLineEdge(text, speaker)
    : synthesizeLineElevenLabs(text, speaker);
}
