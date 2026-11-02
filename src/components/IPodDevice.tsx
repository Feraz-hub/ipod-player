import { useEffect, useRef, useState, type ReactNode } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import "../ipod.css";

export default function IPodDevice({
  children,
  controls,
  caption,
  onInteract,
}: {
  children: ReactNode;
  controls: ReactNode;
  caption: string;
  onInteract: () => unknown;
}) {
  const screen = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const element = screen.current!;
    const resize = () => setScale(element.clientWidth / 600);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <main className={`ipod-stage ${expanded ? "display-expanded" : ""}`}>
      <div
        className="ipod-body"
        aria-label="iPod music player"
        onPointerDownCapture={onInteract}
        onKeyDownCapture={onInteract}
      >
        <div className="ipod-hold" aria-hidden="true" />
        <div className="ipod-screen-bezel">
          <div className="ipod-screen" ref={screen} aria-label="iPod display">
            <div
              className="ipod-screen-canvas"
              style={{ transform: `scale(${scale})` }}
            >
              {children}
            </div>
          </div>
        </div>
        <div className="ipod-hardware" aria-label="iPod controls">
          <span className="ipod-wordmark" aria-hidden="true">
            iPod
          </span>
          {controls}
          <span className="ipod-control-caption" role="status">
            {caption}
          </span>
        </div>
        <button
          className="ipod-display-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Return to iPod view" : "Enlarge iPod display"}
          title={expanded ? "Return to iPod" : "Enlarge display"}
        >
          {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>
      <p className="ipod-gesture-hint">
        Circle the wheel to browse · press the center to select
      </p>
    </main>
  );
}
