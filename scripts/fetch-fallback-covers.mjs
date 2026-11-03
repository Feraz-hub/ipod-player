import { readFile, mkdir, writeFile } from "node:fs/promises";

const clips = JSON.parse(await readFile(new URL("../src/licensed-clips.json", import.meta.url)));
const chosen = [0, 3, 4, 5, 7, 9, 10, 11, 14, 15, 18, 19, 22, 23, 24, 25, 26, 27, 28, 29];
const directory = new URL("../public/covers/", import.meta.url);
await mkdir(directory, { recursive: true });
await Promise.all(chosen.map(async (index, position) => {
  const clip = clips[index];
  const source = new URL(clip.cover);
  if (source.hostname === "images.pexels.com") {
    source.search = "?auto=compress&w=360&h=360&fit=crop";
  }
  const response = await fetch(source, { signal: AbortSignal.timeout(30000) });
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) {
    throw new Error(`Could not fetch image ${position + 1}: ${response.status}`);
  }
  const file = `fallback-${String(position + 1).padStart(2, "0")}.jpg`;
  await writeFile(new URL(file, directory), Buffer.from(await response.arrayBuffer()));
  return { file, title: clip.title, source: clip.source, license: clip.permission };
})).then(async (entries) => {
  await writeFile(new URL("SOURCES.json", directory), JSON.stringify(entries, null, 2) + "\n");
  console.log(`Saved ${entries.length} licensed cover images.`);
});
