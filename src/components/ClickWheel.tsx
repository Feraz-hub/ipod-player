import { useRef, useState } from "react";
import { SkipBack, SkipForward, Play, Pause } from "lucide-react";
import { angleDelta } from "../lib/rules.mjs";
export default function ClickWheel({
  onRotate,
  onSelect,
  onMenu,
  onPrevious,
  onNext,
  onPlay,
  playing,
  volumeMode = false,
}: {
  onRotate: (n: number) => void;
  onSelect: () => void;
  onMenu: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onPlay: () => void;
  playing: boolean;
  volumeMode?: boolean;
}) {
  const gesture = useRef<{
    angle: number;
    total: number;
    dragged: boolean;
  } | null>(null);
  const suppress = useRef(false);
  const [active, setActive] = useState(false);
  const [angle, setAngle] = useState(0);
  const getAngle = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    return (
      (Math.atan2(
        e.clientY - r.top - r.height / 2,
        e.clientX - r.left - r.width / 2,
      ) *
        180) /
      Math.PI
    );
  };
  return (
    <div className="wheel-wrap">
      <div
        className={`click-wheel ${active ? "turning" : ""}`}
        onKeyDown={(e) => {
          if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
          e.preventDefault();
          e.stopPropagation();
          onRotate(
            volumeMode
              ? e.key === "ArrowUp"
                ? 1
                : -1
              : e.key === "ArrowDown"
                ? 1
                : -1,
          );
        }}
        onWheel={(e) => {
          e.stopPropagation();
          onRotate(e.deltaY > 0 ? 1 : -1);
        }}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest(".wheel-center")) return;
          const captureTarget =
            (e.target as HTMLElement).closest("button") || e.currentTarget;
          captureTarget.setPointerCapture(e.pointerId);
          gesture.current = { angle: getAngle(e), total: 0, dragged: false };
          setActive(true);
        }}
        onPointerMove={(e) => {
          const g = gesture.current;
          if (!g) return;
          const current = getAngle(e),
            delta = angleDelta(g.angle, current);
          g.angle = current;
          g.total += delta;
          setAngle((v) => v + delta);
          if (Math.abs(g.total) > 16) {
            g.dragged = true;
            suppress.current = true;
            onRotate(Math.sign(g.total));
            g.total = 0;
          }
        }}
        onPointerUp={() => {
          gesture.current = null;
          setActive(false);
          setTimeout(() => {
            suppress.current = false;
          }, 0);
        }}
        onPointerCancel={() => {
          gesture.current = null;
          setActive(false);
          suppress.current = false;
        }}
        onClickCapture={(e) => {
          if (suppress.current) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        <div
          className="wheel-glint"
          style={{ transform: `rotate(${angle}deg)` }}
        />
        <button
          className="wheel-menu"
          onClick={onMenu}
          aria-label="Menu / return to library"
        >
          MENU
        </button>
        <button
          className="wheel-previous"
          onClick={onPrevious}
          aria-label="Previous track"
        >
          <SkipBack size={21} fill="currentColor" />
        </button>
        <button className="wheel-next" onClick={onNext} aria-label="Next track">
          <SkipForward size={21} fill="currentColor" />
        </button>
        <button
          className="wheel-play"
          onClick={onPlay}
          aria-label={playing ? "Pause music" : "Play music"}
        >
          {playing ? (
            <Pause size={19} fill="currentColor" />
          ) : (
            <>
              <Play size={17} fill="currentColor" />
              <Pause size={14} fill="currentColor" />
            </>
          )}
        </button>
        <button
          className="wheel-center"
          onClick={onSelect}
          aria-label="Select highlighted song"
        >
          <span />
        </button>
      </div>
    </div>
  );
}
