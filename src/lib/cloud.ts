import { createClient } from "@supabase/supabase-js";
import type { Media, Usage } from "../types";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const cloud =
  url && key && !url.includes("YOUR-") ? createClient(url, key) : null;
export async function api(action: string, payload?: unknown): Promise<any> {
  if (!cloud)
    throw new Error(
      "Connect your free Supabase project to use account features. See README.",
    );
  const token = (await cloud.auth.getSession()).data.session?.access_token;
  const response = await fetch(`${url}/functions/v1/media-gateway/${action}`, {
    method: payload ? "POST" : "GET",
    headers: {
      apikey: key,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(payload ? { "Content-Type": "application/json" } : {}),
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "The cloud request failed. Try again.");
  }
  return action.startsWith("stream/") ? response.blob() : response.json();
}
export async function listCloud(): Promise<Media[]> {
  if (!cloud) return [];
  const { data, error } = await cloud
    .from("media")
    .select("*")
    .neq("status", "deleted")
    .order("created_at");
  if (error) throw error;
  return data || [];
}
export async function usage(): Promise<Usage> {
  return api("usage");
}
export async function uploadCloud(
  file: File,
  metadata: Partial<Media>,
  progress: (n: number) => void,
): Promise<void> {
  if (!cloud) throw new Error("Cloud storage is not configured.");
  const token = (await cloud.auth.getSession()).data.session?.access_token;
  const reservation = await api("reserve", {
    ...metadata,
    size: file.size,
    mime: file.type,
  });
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      "PUT",
      `${url}/functions/v1/media-gateway/upload/${reservation.id}`,
    );
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", key);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.timeout = 160000;
    xhr.ontimeout = () =>
      reject(
        new Error(
          "Upload timed out. Check My account for the retained reservation before retrying.",
        ),
      );
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) progress(Math.round((e.loaded / e.total) * 95));
    };
    xhr.onerror = () =>
      reject(
        new Error(
          "Upload interrupted. Your reservation is kept safely until cleanup; retry or contact the administrator.",
        ),
      );
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        progress(100);
        resolve();
      } else {
        let message = "Upload failed.";
        try {
          message = JSON.parse(xhr.responseText).error || message;
        } catch {}
        reject(new Error(message));
      }
    };
    xhr.send(file);
  });
}
