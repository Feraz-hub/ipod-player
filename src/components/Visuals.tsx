import { useEffect, useRef, useState } from "react";
import Scene from "./Scene";
import { api } from "../lib/cloud";
import type { Media } from "../types";
export default function Visuals({
  clip,
  paused,
  onError,
  onReady,
}: {
  clip: Media;
  paused: boolean;
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
    async function load() {
      try {
        let url: string | undefined = clip.externalUrl;
        if (!clip.demo) {
          const blob = clip.blob || (await api(`stream/${clip.id}`));
          if (!active) return;
          url = URL.createObjectURL(blob);
          urls.current.add(url);
        }
        if (active)
          setLayers((old) => {
            const previous = [...old]
              .reverse()
              .find((layer) => layer.ready && layer.clip.id !== clip.id);
            old
              .filter((layer) => layer !== previous)
              .forEach((layer) => {
                if (layer.url && urls.current.has(layer.url)) {
                  URL.revokeObjectURL(layer.url);
                  urls.current.delete(layer.url);
                }
              });
            return [
              ...(previous ? [previous] : []),
              { clip, url, key: `${clip.id}-${ticket}`, ready: !url },
            ];
          });
      } catch (e) {
        if (active) onError((e as Error).message);
      }
    }
    void load();
    return () => {
      active = false;
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
              paused={paused}
              onError={onError}
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
            <Scene scene={l.clip.scene || 0} />
          )}
        </div>
      ))}
    </div>
  );
}
function SilentVideo({
  src,
  paused,
  onError,
  onReady,
}: {
  src: string;
  paused: boolean;
  onError: (s: string) => void;
  onReady: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (ref.current && ref.current.readyState < 2) {
        onReady();
        onError(
          "This scene is taking too long to load. Keeping the backdrop until the next scene.",
        );
      }
    }, 15000);
    return () => clearTimeout(timer);
  }, [src]);
  useEffect(() => {
    const v = ref.current!;
    let active = true;
    v.muted = true;
    if (paused) v.pause();
    else
      void v.play().catch((error: DOMException) => {
        if (active && error.name === "NotAllowedError")
          onError(
            "Tap Play to start the clip. Your browser paused automatic video playback.",
          );
      });
    return () => {
      active = false;
    };
  }, [src, paused]);
  return (
    <>
      <div className="video-loading-backdrop" />
      <video
        ref={ref}
        src={src}
        style={{
          position: "absolute",
          inset: 0,
          opacity: ready ? 1 : 0,
          transition: "opacity 1.2s",
        }}
        muted
        loop
        playsInline
        preload="metadata"
        onCanPlay={() => {
          setReady(true);
          onReady();
        }}
        onError={() => {
          setReady(false);
          onReady();
          onError(
            "This clip could not play. Showing the city backdrop until the next clip. Choose another clip or a compatible MP4/WebM.",
          );
        }}
      />
    </>
  );
}
