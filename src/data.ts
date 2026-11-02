import extraLicensedClips from "./licensed-clips.json";
import type { Media } from "./types";
export const demos: Media[] = [
  {
    id: "demo-0",
    kind: "music",
    title: "After the last train",
    artist: "Nightshift Originals",
    duration: 96,
    size: 0,
    mime: "audio/wav",
    demo: true,
    scene: 0,
  },
  {
    id: "demo-1",
    kind: "music",
    title: "Somewhere, 2:17 AM",
    artist: "Nightshift Originals",
    duration: 104,
    size: 0,
    mime: "audio/wav",
    demo: true,
    scene: 1,
  },
  {
    id: "demo-2",
    kind: "music",
    title: "Soft signal",
    artist: "Nightshift Originals",
    duration: 88,
    size: 0,
    mime: "audio/wav",
    demo: true,
    scene: 2,
  },
  {
    id: "demo-3",
    kind: "music",
    title: "Blue hour drive",
    artist: "Nightshift Originals",
    duration: 112,
    size: 0,
    mime: "audio/wav",
    demo: true,
    scene: 3,
  },
  {
    id: "demo-4",
    kind: "music",
    title: "Leave the city on",
    artist: "Nightshift Originals",
    duration: 92,
    size: 0,
    mime: "audio/wav",
    demo: true,
    scene: 4,
  },
];
export const scenes = [
  "Tokyo afterhours",
  "Rain on the window",
  "Violet frequency",
  "Midnight express",
  "Moonlit rooftops",
  "Electric dreams",
];
export const sceneCategories = [
  "Neon city",
  "Rain",
  "Abstract",
  "Night drive",
  "Animation",
  "Cyberpunk",
];
export const categories = [
  "All moods",
  ...new Set([
    ...sceneCategories,
    ...extraLicensedClips.map((clip) => clip.category),
    "Fantasy",
  ]),
];
export const starters: Media[] = [0, 1, 2, 3, 4, 5].map((i) => ({
  id: `scene-${i}`,
  kind: "clip" as const,
  title: scenes[i],
  artist: "Nightshift Studio",
  category: sceneCategories[i],
  duration: 24,
  size: 0,
  mime: "application/x-nightshift-scene",
  demo: true,
  scene: i,
  status: "approved",
  source: "Original procedural animation · source included in this project",
  permission:
    "CC0-1.0 · original code-rendered scene; no third-party film footage",
}));
starters.unshift({
  id: "mixkit-50989",
  kind: "clip",
  title: "Through the city, after dark",
  artist: "Mixkit",
  category: "Night drive",
  duration: 16,
  size: 0,
  mime: "video/mp4",
  demo: true,
  externalUrl: "https://assets.mixkit.co/videos/50989/50989-360.mp4",
  cover: `${import.meta.env.BASE_URL}city-night.jpg`,
  status: "approved",
  source:
    "https://mixkit.co/free-stock-video/timelapse-of-a-drive-through-the-city-streets-at-night-50989/",
  permission:
    "Mixkit Stock Video Free License. Free commercial and personal use in creative projects. External preview; not a community download. Verified 2026-11-02. https://mixkit.co/license/#videoFree",
});

starters.push(...(extraLicensedClips as Media[]));
starters.push({
  id: "scene-deep-dream",
  kind: "clip",
  title: "Below the sleeping sea",
  artist: "Nightshift Studio · original animation",
  category: "Fantasy",
  duration: 24,
  size: 0,
  mime: "application/x-nightshift-scene",
  demo: true,
  scene: 6,
  status: "approved",
  source:
    "Original hand-drawn-style canvas animation · src/components/DeepDream.ts",
  permission:
    "CC0-1.0. Original fantasy diver, giant jellyfish, submerged ruins and drifting particles. No film, anime franchise or downloaded character artwork.",
});
