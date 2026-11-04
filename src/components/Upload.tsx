import { useEffect, useState } from "react";
import {
  UploadCloud,
  FileAudio,
  Film,
  Check,
  LoaderCircle,
} from "lucide-react";
import Dialog from "./Dialog";
import { validateFile, STORAGE_CAP } from "../lib/rules.mjs";
import { saveLocal, localLibrary } from "../lib/local";
import { cloud, uploadCloud } from "../lib/cloud";
import type { Media } from "../types";
export default function Upload({
  kind,
  account,
  cloudStorageRemaining,
  cloudBandwidthRemaining,
  onClose,
  onDone,
  onSignIn,
  onError,
}: {
  kind: "music" | "clip";
  account: boolean;
  cloudStorageRemaining: number;
  cloudBandwidthRemaining: number;
  onClose: () => void;
  onDone: (destination: "cloud" | "device") => void;
  onSignIn: () => void;
  onError: (s: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [title, setTitle] = useState(""),
    [artist, setArtist] = useState(""),
    [cover, setCover] = useState<string | undefined>(),
    [duration, setDuration] = useState(0),
    [category, setCategory] = useState("Neon city"),
    [source, setSource] = useState(""),
    [permission, setPermission] = useState(""),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [reading, setReading] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState("");
  const accountStorage = account && !!cloud;
  const [destination, setDestination] = useState<"cloud" | "device">(
    accountStorage ? "cloud" : "device",
  );
  const cloudLimitReason = file
    ? file.size > cloudStorageRemaining
      ? "Cloud storage is full for this file. Save it on this device instead."
      : file.size * 3 + 16_384 > cloudBandwidthRemaining
        ? "The monthly cloud bandwidth budget is too low for this file. Save it on this device instead."
        : null
    : null;
  useEffect(() => {
    if (destination === "cloud" && (!accountStorage || cloudLimitReason))
      setDestination("device");
  }, [accountStorage, cloudLimitReason, destination]);
  async function choose(f?: File) {
    if (!f) return;
    setReading(true);
    setError("");
    try {
      validateFile(f, kind);
      const el = document.createElement(kind === "music" ? "audio" : "video");
      if (!el.canPlayType(f.type))
        throw new Error(
          "Your browser cannot play this format. Convert to MP3 for audio or H.264 MP4 for video.",
        );
      const objectUrl = URL.createObjectURL(f);
      try {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(
            () =>
              reject(
                new Error("Could not read this file. Try a different format."),
              ),
            12000,
          );
          el.preload = "metadata";
          el.onloadedmetadata = () => {
            clearTimeout(timer);
            setDuration(Number.isFinite(el.duration) ? el.duration : 0);
            resolve();
          };
          el.onerror = () => {
            clearTimeout(timer);
            reject(
              new Error(
                "The file is damaged or its codec is not supported by this browser.",
              ),
            );
          };
          el.src = objectUrl;
        });
      } finally {
        el.removeAttribute("src");
        el.load();
        URL.revokeObjectURL(objectUrl);
      }
      setFile(f);
      if (
        accountStorage &&
        (f.size > cloudStorageRemaining ||
          f.size * 3 + 16_384 > cloudBandwidthRemaining)
      )
        setDestination("device");
      setTitle(f.name.replace(/\.[^.]+$/, ""));
      setArtist("Unknown artist");
      setCover(undefined);
      if (kind === "music") {
        try {
          const { parseBlob } = await import("music-metadata");
          const meta = await parseBlob(f, { duration: true });
          setTitle(meta.common.title || f.name.replace(/\.[^.]+$/, ""));
          setArtist(meta.common.artist || "Unknown artist");
          if (meta.format.duration) setDuration(meta.format.duration);
          const p = meta.common.picture?.[0];
          if (
            p &&
            p.data.length < 120_000 &&
            ["image/jpeg", "image/png", "image/webp"].includes(p.format)
          ) {
            const data = new Uint8Array(p.data);
            const b = new Blob([data]);
            const reader = new FileReader();
            reader.onload = () =>
              setCover(
                (reader.result as string).replace(
                  "application/octet-stream",
                  p.format,
                ),
              );
            reader.readAsDataURL(b);
          }
        } catch {
          /* Display fields remain editable when tags cannot be read. */
        }
      }
    } catch (e) {
      setFile(null);
      setError((e as Error).message);
    } finally {
      setReading(false);
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    if (destination === "cloud" && (!accountStorage || cloudLimitReason))
      return;
    setBusy(true);
    setError("");
    try {
      const metadata: Partial<Media> = {
        kind,
        title: title.trim(),
        artist: kind === "music" ? artist.trim() : "Community member",
        duration,
        cover,
        category,
        source,
        permission,
        rights_confirmed: consent,
      };
      if (!metadata.title) throw new Error("Add a title.");
      if (kind === "clip" && (!consent || !permission.trim() || !source.trim()))
        throw new Error(
          "Add a source, permission details and confirm your sharing rights.",
        );
      if (destination === "cloud") {
        await uploadCloud(file, metadata, setProgress);
      } else {
        await navigator.storage?.persist?.().catch(() => false);
        const entries = await localLibrary();
        const used = entries.reduce((s, m) => s + m.size, 0);
        const estimate = await navigator.storage?.estimate();
        const cap = Math.min(
          STORAGE_CAP,
          estimate?.quota ? Math.floor(estimate.quota * 0.8) : STORAGE_CAP,
        );
        if (
          used + file.size > cap ||
          (estimate?.quota &&
            (estimate.usage || 0) + file.size > estimate.quota * 0.8)
        )
          throw new Error(
            "Local library full. Delete one of your uploads or free browser storage before adding more.",
          );
        setProgress(25);
        await saveLocal({
          ...metadata,
          id: crypto.randomUUID(),
          size: file.size,
          mime: file.type,
          blob: file,
          local: true,
          status: kind === "clip" ? "local" : "private",
          created_at: new Date().toISOString(),
        } as Media);
        setProgress(100);
      }
      onDone(destination);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={
        kind === "music"
          ? "Bring your own soundtrack."
          : "Share a little atmosphere."
      }
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="muted">
        {destination === "cloud"
          ? kind === "music"
            ? "Saved privately to your account and available on your other signed-in devices."
            : "Clips enter a moderation queue before everyone can watch them."
          : "Saved in this browser on this device only. It will not appear on your other devices, and clearing browser data may remove it."}
      </p>
      <fieldset className="storage-choice">
        <legend>Save {kind === "music" ? "music" : "clip"} to</legend>
        <label
          className={`storage-option ${destination === "device" ? "selected" : ""}`}
        >
          <input
            type="radio"
            name="upload-destination"
            checked={destination === "device"}
            onChange={() => setDestination("device")}
            disabled={busy}
          />
          <span>
            <strong>This device</strong>
            <small>
              Works without cloud bandwidth · stays on this phone or computer
            </small>
          </span>
        </label>
        {accountStorage && (
          <label
            className={`storage-option ${destination === "cloud" ? "selected" : ""}`}
          >
            <input
              type="radio"
              name="upload-destination"
              checked={destination === "cloud"}
              onChange={() => setDestination("cloud")}
              disabled={busy || !!cloudLimitReason}
            />
            <span>
              <strong>My account</strong>
              <small>Private cloud library · available on all signed-in devices</small>
            </span>
          </label>
        )}
        {accountStorage && cloudLimitReason && (
          <p className="storage-limit" role="status">
            {cloudLimitReason}
          </p>
        )}
      </fieldset>
      {!accountStorage && (
        <div className="storage-signin">
          <button type="button" className="primary full" onClick={onSignIn}>
            <UploadCloud size={17} /> Sign in to save to your account
          </button>
        </div>
      )}
      <form onSubmit={submit}>
        <label
          className={`drop-zone ${reading ? "reading" : ""}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!busy) void choose(e.dataTransfer.files[0]);
          }}
        >
          {reading ? (
            <LoaderCircle className="spin" size={28} />
          ) : file ? (
            <Check size={28} />
          ) : (
            <UploadCloud size={28} />
          )}
          <strong>
            {reading
              ? "Reading your file…"
              : file
                ? file.name
                : "Drop a file, or choose one"}
          </strong>
          <span>
            {kind === "music"
              ? "MP3, M4A, AAC, OGG, WAV, FLAC, WebM"
              : "MP4, WebM, compatible MOV"}{" "}
            · up to 100 MB
          </span>
          <input
            aria-label={
              kind === "music" ? "Choose audio file" : "Choose video clip"
            }
            type="file"
            accept={
              kind === "music"
                ? "audio/*"
                : "video/mp4,video/webm,video/quicktime"
            }
            onChange={(e) => void choose(e.target.files?.[0])}
            disabled={busy || reading}
          />
        </label>
        <label>
          Title
          <input
            required
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give it a name"
          />
        </label>
        {kind === "music" ? (
          <label>
            Artist
            <input
              required
              maxLength={120}
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Who’s behind the music?"
            />
          </label>
        ) : (
          <>
            <label>
              Mood
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {[
                  "Neon city",
                  "Rain",
                  "Abstract",
                  "Night drive",
                  "Animation",
                  "Cyberpunk",
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Original source
              <input
                required
                type="url"
                maxLength={500}
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="https://your-original-source…"
              />
            </label>
            <label>
              License / permission
              <textarea
                required
                maxLength={1500}
                value={permission}
                onChange={(e) => setPermission(e.target.value)}
                placeholder="For example: My original footage, shared under CC BY 4.0. Include evidence of permission."
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              I own this clip or have permission to share and stream it
              publicly.
            </label>
          </>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {busy && (
          <div className="upload-progress">
            <progress value={progress} max="100" />
            <span>
              {progress < 95
                ? `${destination === "cloud" ? "Uploading" : "Saving"} ${progress}%`
                : "Finishing and saving…"}
            </span>
          </div>
        )}
        <button
          className="primary full"
          disabled={
            !file ||
            reading ||
            busy ||
            (destination === "cloud" &&
              (!accountStorage || !!cloudLimitReason))
          }
          type="submit"
        >
          {busy ? (
            <LoaderCircle className="spin" size={17} />
          ) : kind === "music" ? (
            <FileAudio size={17} />
          ) : (
            <Film size={17} />
          )}{" "}
          {busy
            ? "Saving…"
            : destination === "cloud"
              ? kind === "music"
                ? "Upload to my account"
                : "Submit for review"
              : "Import on this device"}
        </button>
      </form>
    </Dialog>
  );
}
