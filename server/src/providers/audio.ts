import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

export function writeBuffer(buf: Buffer, filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buf);
}

/** Duration of an audio file in seconds (via ffprobe). */
export function probeDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      const d = data?.format?.duration;
      resolve(typeof d === "number" ? d : 0);
    });
  });
}

/** Concatenate MP3 parts into one file, re-encoding to a uniform stream so the
 *  result has a correct duration and is seekable (byte concat would not). */
export function concatToFile(inputs: string[], outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (inputs.length === 0) return reject(new Error("No audio parts to concatenate."));
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-merge-"));
    const cmd = ffmpeg();
    for (const f of inputs) cmd.input(f);
    cmd
      .audioCodec("libmp3lame")
      .audioBitrate("128k")
      .audioChannels(2)
      .audioFrequency(44100)
      .on("error", (err) => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        reject(err);
      })
      .on("end", () => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        resolve();
      })
      .mergeToFile(outPath, tmpDir);
  });
}
