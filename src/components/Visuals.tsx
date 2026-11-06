import { useEffect, useRef, useState } from "react";
import Scene from "./Scene";
import { api } from "../lib/cloud";
import type { Media } from "../types";
export default function Visuals({
  clip,
  onError,
  onReady,
}: {
  clip: Media;
  onError: (s: string) => void;
  onReady: (id: string) => void;
}) {
  const [layers, setLayers] = useState<
      { clip: Media; url?: string; key: string; ready: boolean }[]
    >([]),
    seq = useRef(0);
  const urls = useRef(new Set<string>());
  useEffect(() => {
    const last = layers.at(-1);
    if (last?.ready && last.clip.id === clip.id) onReady(clip.id);
  }, [layers, clip.id, onReady]);
  useEffect(() => {
    const ticket = ++seq.current;
    let active = true;
    let settled = false;
    function show(url?: string) {
      if (!active || settled) return;
      settled = true;
      setLayers((old) => {
        const previous = [...old]
          .reverse()
          .find((layer) => layer.ready && layer.clip.id !== clip.id);
        old.filter((layer) => layer !== previous).forEach((layer) => {
          if (layer.url && urls.current.delete(layer.url)) {
            URL.revokeObjectURL(layer.url);
          }
        });
        return [
          ...(previous ? [previous] : []),
          { clip, url, key: `${clip.id}-${ticket}`, ready: !url },
        ];
      });
    }
    const deadline = setTimeout(() => show(), 8000);
    async function load() {
      try {
        if (clip.demo) {
          show(clip.externalUrl);
          return;
        }
        if (clip.local && !clip.blob) throw new Error("Import this clip again to restore its device copy.");
        const blob = clip.blob || (await api(`stream/${clip.id}`));
        if (!active || settled) return;
        const url = URL.createObjectURL(blob);
        urls.current.add(url);
        show(url);
      } catch (e) {
        if (active && !settled && clip.local) onError((e as Error).message);
        show();
      } finally {
        clearTimeout(deadline);
      }
    }
    void load();
    return () => {
      active = false;
      clearTimeout(deadline);
    };
  }, [clip.id]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (layers.length > 1 && layers.at(-1)?.ready)
        setLayers((old) => {
          const removed = old.slice(0, -1);
          removed.forEach((l) => {
            if (l.url) {
              URL.revokeObjectURL(l.url);
              urls.current.delete(l.url);
            }
          });
          return old.slice(-1);
        });
    }, 1300);
    return () => clearTimeout(t);
  }, [layers]);
  useEffect(
    () => () => {
      urls.current.forEach(URL.revokeObjectURL);
      urls.current.clear();
    },
    [],
  );
  return (
    <div className="playback-visuals">
      {!layers.some((layer) => layer.ready) && (
        <div className="visual-layer"><Scene scene={2} /></div>
      )}
      {layers.map((l, index) => (
        <div
          key={l.key}
          className="visual-layer"
          style={{
            animation: "none",
            opacity: l.ready || index === 0 ? 1 : 0,
            transition: "opacity 1.2s ease",
          }}
        >
          {l.url ? (
            <SilentVideo
              src={l.url}
              onFailure={() => {
                if (l.clip.local) onError("This device clip could not play. Try importing a compatible MP4.");
                if (l.url && urls.current.delete(l.url)) URL.revokeObjectURL(l.url);
                setLayers((old) => old.map((layer) =>
                  layer.key === l.key ? { ...layer, url: undefined, ready: true } : layer,
                ));
              }}
              onReady={() =>
                setLayers((old) =>
                  old.map((layer) =>
                    layer.key === l.key && !layer.ready
                      ? { ...layer, ready: true }
                      : layer,
                  ),
                )
              }
            />
          ) : (
            <Scene scene={l.clip.scene ?? 2} />
          )}
        </div>
      ))}
    </div>
  );
}
function SilentVideo({
  src,
  onFailure,
  onReady,
}: {
  src: string;
  onFailure: () => void;
  onReady: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const deadline = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const callbacks = useRef({ onFailure, onReady });
  callbacks.current = { onFailure, onReady };

  function waitForFrames() {
    clearTimeout(deadline.current);
    deadline.current = setTimeout(() => callbacks.current.onFailure(), 8000);
  }

  useEffect(() => {
    const video = ref.current!;
    let active = true;
    video.muted = true;
    waitForFrames();
    void video.play().catch((error: DOMException) => {
      if (active && error.name !== "AbortError") callbacks.current.onFailure();
    });
    return () => {
      active = false;
      clearTimeout(deadline.current);
    };
  }, [src]);

  return (
    <video
      ref={ref}
      src={src}
      muted
      autoPlay
      loop
      playsInline
      preload="auto"
      onPlaying={() => {
        clearTimeout(deadline.current);
        callbacks.current.onReady();
      }}
      onWaiting={waitForFrames}
      onError={() => callbacks.current.onFailure()}
    />
  );
}
