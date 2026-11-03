export const MAX_FILE = 100_000_000;
export const CLOUD_CHUNK = 40_000_000;
export const STORAGE_CAP = 850_000_000;
export const AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
  "audio/webm",
];
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
export function validateFile(file, kind) {
  if (!file.size) throw new Error("This file is empty. Choose another file.");
  if (file.size > MAX_FILE)
    throw new Error(
      "Choose a file no larger than 100 MB. Compress your clip or track first.",
    );
  if (!(kind === "music" ? AUDIO_TYPES : VIDEO_TYPES).includes(file.type))
    throw new Error(
      kind === "music"
        ? "Unsupported audio. Try MP3, M4A, AAC, OGG, WAV, FLAC or WebM."
        : "Unsupported video. Try MP4 (H.264) or WebM. MOV works only when your browser supports its codec.",
    );
}
export function angleDelta(previous, current) {
  return ((current - previous + 540) % 360) - 180;
}
export function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}
