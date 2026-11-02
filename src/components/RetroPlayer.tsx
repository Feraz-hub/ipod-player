import { useEffect, useRef, useState } from "react";
import {
  BatteryFull,
  Home,
  Search,
  Wifi,
  MessageCircle,
  Plane,
  Disc3,
  Music2,
  Plus,
  X,
  Play,
  Pause,
  ArrowLeft,
  SkipBack,
  SkipForward,
  Settings2,
  MoreHorizontal,
  Film,
  Shuffle,
  Repeat,
} from "lucide-react";
import type { Media } from "../types";
import Cover from "./Cover";
import ClickWheel from "./ClickWheel";

export function AlleyBackground() {
  return (
    <div className="alley-background" aria-hidden="true">
      <div className="alley-image" />
      <div className="alley-haze" />
      <div className="alley-rain" />
      <div className="alley-vignette" />
    </div>
  );
}

export function HoloDisc() {
  return (
    <div className="retro-disc-float" aria-hidden="true">
      <div className="retro-disc">
        <div className="retro-disc-spin">
          <div className="retro-disc-surface" />
          <div className="retro-disc-grooves" />
          <div className="retro-disc-hole" />
        </div>
        <svg viewBox="0 0 240 240" className="retro-music-note">
          <defs>
            <linearGradient id="note-metal" x1="0" y1="0" x2=".4" y2="1">
              <stop stopColor="#83e4ba" />
              <stop offset=".2" stopColor="#238e74" />
              <stop offset=".48" stopColor="#8fcdbe" />
              <stop offset=".68" stopColor="#647ecb" />
              <stop offset=".84" stopColor="#699cdd" />
              <stop offset="1" stopColor="#acb5d0" />
            </linearGradient>
          </defs>
          <path
            d="M94 146C75 141 61 153 67 165C73 179 99 175 104 158V91L163 77V132C140 127 125 139 132 152C139 166 165 159 174 144V53L94 73Z"
            transform="translate(4 6)"
            fill="#182f36"
            stroke="#75949b"
            strokeWidth="2"
          />
          <path
            d="M94 146C75 141 61 153 67 165C73 179 99 175 104 158V91L163 77V132C140 127 125 139 132 152C139 166 165 159 174 144V53L94 73Z"
            fill="url(#note-metal)"
            stroke="#bdd8d2"
            strokeWidth="1.8"
          />
          <path
            d="M98 79L168 60M100 85V146M168 81V137"
            stroke="#e2f6e7"
            strokeWidth="1.3"
            opacity=".7"
            fill="none"
          />
        </svg>
      </div>
    </div>
  );
}

type LibraryProps = {
  tracks: Media[];
  selected: number;
  loaded: boolean;
  starting: boolean;
  search: string;
  setSearch: (s: string) => void;
  setSelected: (n: number) => void;
  onPlay: (m?: Media) => void;
  onOptions: (m: Media) => void;
  onUpload: () => void;
  onRotate: (n: number) => void;
  tab: string;
  setTab: (s: string) => void;
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
  menuItems: string[];
  menuIndex: number;
  onMenuChoose: (index: number) => void;
  onMenuHighlight: (index: number) => void;
  shuffle: boolean;
  repeat: boolean;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  capacity: boolean;
  onSettings: () => void;
  onTrailers: () => void;
  onHelp: () => void;
};
export function RetroLibrary(p: LibraryProps) {
  const list = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const swipeY = useRef<number | null>(null),
    swiped = useRef(false);
  const [height, setHeight] = useState(382);
  const rowHeight = 140;
  const index = Math.min(p.selected, Math.max(0, p.tracks.length - 1));
  useEffect(() => {
    const update = () => {
      if (list.current) {
        setHeight(list.current.clientHeight);
      }
    };
    update();
    const ro = new ResizeObserver(update);
    if (list.current) ro.observe(list.current);
    return () => ro.disconnect();
  }, [p.loaded]);
  useEffect(() => {
    menu.current
      ?.querySelector('[aria-current="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [p.menuIndex, p.menuOpen]);
  useEffect(() => {
    const element = list.current;
    if (!element) return;
    let last = 0;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const now = performance.now();
      if (now - last > 95) {
        p.onRotate(e.deltaY > 0 ? 1 : -1);
        last = now;
      }
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [p.onRotate]);
  return (
    <main
      className={`retro-library ${p.starting ? "is-starting" : ""}`}
      aria-label="Music library"
      aria-busy={p.starting}
    >
      <div
        className="retro-song-window"
        ref={list}
        role="listbox"
        aria-label="Choose a track"
        onPointerDown={(e) => {
          if (e.pointerType === "touch") {
            swipeY.current = e.clientY;
            swiped.current = false;
            (
              (e.target as HTMLElement).closest("button") || e.currentTarget
            ).setPointerCapture(e.pointerId);
          }
        }}
        onPointerMove={(e) => {
          if (swipeY.current === null) return;
          const delta = e.clientY - swipeY.current;
          if (Math.abs(delta) > 35) {
            swiped.current = true;
            p.onRotate(delta < 0 ? 1 : -1);
            swipeY.current = e.clientY;
          }
        }}
        onPointerUp={() => {
          swipeY.current = null;
          setTimeout(() => {
            swiped.current = false;
          }, 0);
        }}
        onPointerCancel={() => {
          swipeY.current = null;
          swiped.current = false;
        }}
        onClickCapture={(e) => {
          if (swiped.current) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        {!p.loaded ? (
          <div className="retro-empty">Loading…</div>
        ) : p.tracks.length ? (
          <div
            className="retro-song-reel"
            style={{
              transform: `translateY(${height * 0.46 - rowHeight * (index + 0.5)}px)`,
            }}
          >
            {p.tracks.map((m, i) => {
              const distance = Math.abs(i - index);
              return (
                <div
                  key={m.id}
                  className={`retro-song ${i === index ? "selected" : ""}`}
                  style={{
                    height: rowHeight,
                    opacity:
                      distance > 2
                        ? 0.08
                        : distance === 2
                          ? 0.27
                          : distance === 1
                            ? 0.68
                            : 1,
                  }}
                >
                  <button
                    className="retro-song-select"
                    role="option"
                    aria-selected={i === index}
                    onClick={() => p.setSelected(i)}
                    onDoubleClick={() => p.onPlay(m)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.stopPropagation();
                        p.onPlay(m);
                      }
                    }}
                  >
                    <Cover src={m.cover} index={m.scene ?? i} />
                    <span className="retro-song-label">
                      <strong>{m.title}</strong>
                      <small>{m.artist}</small>
                    </span>
                  </button>
                  <button
                    className="retro-track-options"
                    onClick={() => p.onOptions(m)}
                    aria-label={`Options for ${m.title}`}
                  >
                    <MoreHorizontal size={19} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="retro-empty">
            <Music2 size={27} />
            <p>
              {p.search
                ? "No tracks found."
                : p.tab === "Favorites"
                  ? "No favorites yet."
                  : "Your music goes here."}
            </p>
            <button onClick={p.onUpload}>
              <Plus size={15} />
              Add music
            </button>
          </div>
        )}
      </div>
      <div className="retro-graphic">
        <button
          onClick={() => p.onPlay(p.tracks[index])}
          aria-label="Play selected song"
        >
          <HoloDisc />
        </button>
      </div>
      <span className="retro-key-hint">
        scroll to browse · center / enter to play
      </span>
      {p.searchOpen && (
        <div className="retro-search-box">
          <Search size={17} />
          <input
            autoFocus
            aria-label="Search your tracks"
            value={p.search}
            placeholder="Search music"
            onChange={(e) => {
              p.setSearch(e.target.value);
              p.setSelected(0);
            }}
          />
          <button
            aria-label="Close search"
            onClick={() => {
              p.setSearchOpen(false);
              p.setSearch("");
            }}
          >
            <X size={17} />
          </button>
        </div>
      )}
      {p.menuOpen && (
        <div
          className="retro-music-menu"
          ref={menu}
          aria-label="iPod music menu"
        >
          <span className="retro-menu-title">Music</span>
          {p.menuItems.map((label, i) => (
            <button
              className={p.menuIndex === i ? "selected" : ""}
              aria-current={p.menuIndex === i ? "true" : undefined}
              key={i}
              onClick={() => p.onMenuChoose(i)}
              onPointerEnter={() => p.onMenuHighlight(i)}
              disabled={label === "Add music" && p.capacity}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </main>
  );
}

export function RetroStatus({
  date,
  cinema,
  visible,
  onBack,
}: {
  date: Date;
  cinema: boolean;
  visible: boolean;
  onBack: () => void;
}) {
  const clock = date
    .toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/\s/g, "");
  return (
    <header
      className={`retro-status ${cinema ? "in-playback" : ""} ${visible ? "visible" : ""}`}
    >
      <button
        className="retro-back"
        onClick={onBack}
        aria-label="Menu / return to library"
      >
        {cinema ? <ArrowLeft size={20} /> : <Music2 size={17} />}
      </button>
      <span>
        {date.getMonth() + 1}/{date.getDate()} {clock}
        <BatteryFull size={25} aria-label="Device-style battery indicator" />
      </span>
    </header>
  );
}

type DockProps = {
  view: string;
  cinema: boolean;
  visible: boolean;
  wheelOpen: boolean;
  onWheel: () => void;
  onMusic: () => void;
  onHome: () => void;
  onSearch: () => void;
  onCommunity: () => void;
  onAccount: () => void;
  onSettings: () => void;
  onFullscreen: () => void;
  onTrailers: () => void;
};
export function RetroDock(p: DockProps) {
  return (
    <nav
      className={`retro-dock ${p.cinema ? "in-playback" : ""} ${p.visible ? "visible" : ""}`}
      aria-label="Player navigation"
    >
      <button
        aria-label="Enter full screen"
        title="Full screen"
        onClick={p.onFullscreen}
      >
        <Plane size={21} />
      </button>
      <button aria-label="My music" title="My music" onClick={p.onHome}>
        <Home
          size={21}
          fill={p.view === "library" && !p.cinema ? "currentColor" : "none"}
        />
      </button>
      <button aria-label="Search music" title="Search" onClick={p.onSearch}>
        <Search size={21} />
      </button>
      <button
        aria-label="Music collection"
        title="Music collection"
        onClick={p.onMusic}
      >
        <Music2 size={21} />
      </button>
      <button
        aria-label="Community clips"
        title="Community clips"
        onClick={p.onCommunity}
      >
        <Wifi size={21} />
      </button>
      <button aria-label="My account" title="Account" onClick={p.onAccount}>
        <MessageCircle size={21} fill="currentColor" />
      </button>
      <button
        className={p.wheelOpen ? "active" : ""}
        aria-label="Focus iPod controls"
        title="Click wheel (W)"
        onClick={p.onWheel}
      >
        <Disc3 size={23} />
      </button>
      <div className="retro-extra-controls">
        <button
          aria-label="Player settings"
          title="Settings"
          onClick={p.onSettings}
        >
          <Settings2 size={19} />
        </button>
        <button
          aria-label="Official trailers"
          title="Official trailers"
          onClick={p.onTrailers}
        >
          <Film size={19} />
        </button>
      </div>
    </nav>
  );
}

export function RetroWheel({
  open,
  playing,
  volume,
  cinema,
  onRotate,
  onSelect,
  onBack,
  onPrevious,
  onNext,
  onPlay,
  onClose,
}: {
  open: boolean;
  playing: boolean;
  volume: number;
  cinema: boolean;
  onRotate: (n: number) => void;
  onSelect: () => void;
  onBack: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onPlay: () => void;
  onClose: () => void;
}) {
  return open ? (
    <aside className="retro-wheel-tray" aria-label="iPod click wheel">
      <button
        className="retro-wheel-close"
        onClick={onClose}
        aria-label="Hide click wheel"
      >
        <X size={15} />
      </button>
      <ClickWheel
        playing={playing}
        onRotate={onRotate}
        onSelect={onSelect}
        onMenu={onBack}
        onPrevious={onPrevious}
        onNext={onNext}
        onPlay={onPlay}
      />
      <span className="retro-wheel-caption">
        {cinema ? `VOLUME ${Math.round(volume * 100)}%` : "SCROLL · SELECT"}
      </span>
    </aside>
  ) : null;
}

export function RetroPlayback({
  track,
  clip,
  playing,
  position,
  duration,
  visible,
  onPlay,
  onSeek,
  onPrevious,
  onNext,
  onCredits,
}: {
  track: Media | null;
  clip: Media;
  playing: boolean;
  position: number;
  duration: number;
  visible: boolean;
  onPlay: () => void;
  onSeek: (n: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onCredits: () => void;
}) {
  const time = (n: number) =>
    `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
  return (
    <main
      className={`retro-playback ${visible ? "visible" : ""}`}
      aria-label="Cinematic playback"
    >
      <div className="retro-playing-info">
        <strong>{track?.title || clip.title}</strong>
        <span>{track?.artist || "Silent clip preview"}</span>
        <div className="retro-transport">
          <button onClick={onPrevious} aria-label="Previous track">
            <SkipBack size={17} fill="currentColor" />
          </button>
          <button
            onClick={onPlay}
            aria-label={playing ? "Pause music" : "Play music"}
          >
            {playing ? (
              <Pause size={18} fill="currentColor" />
            ) : (
              <Play size={18} fill="currentColor" />
            )}
          </button>
          <button onClick={onNext} aria-label="Next track">
            <SkipForward size={17} fill="currentColor" />
          </button>
          <span>
            {time(position)} / {time(duration)}
          </span>
          <button onClick={onCredits} aria-label="Scene credits">
            <Film size={16} />
          </button>
        </div>
        <input
          type="range"
          aria-label="Seek track"
          min="0"
          max={duration || 1}
          step=".1"
          value={Math.min(position, duration || 1)}
          disabled={!track}
          onChange={(e) => onSeek(Number(e.target.value))}
        />
      </div>
    </main>
  );
}
