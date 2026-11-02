import { openDB } from "idb";
import type { Media } from "../types";
const db = openDB("nightshift-library", 1, {
  upgrade(d) {
    d.createObjectStore("media", { keyPath: "id" });
    d.createObjectStore("settings");
  },
});
export async function localLibrary(): Promise<Media[]> {
  return (await (await db).getAll("media")).sort((a, b) =>
    (a.created_at || "").localeCompare(b.created_at || ""),
  );
}
export async function saveLocal(media: Media) {
  await (await db).put("media", media);
}
export async function deleteLocal(id: string) {
  await (await db).delete("media", id);
}
export async function getSetting(key: string) {
  return (await db).get("settings", key);
}
export async function setSetting(key: string, value: unknown) {
  await (await db).put("settings", value, key);
}
