import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  BatteryFull,
  Check,
  ChevronRight,
  Disc3,
  Film,
  Headphones,
  HelpCircle,
  LoaderCircle,
  Maximize,
  Minimize,
  MoreHorizontal,
  Music2,
  Pause,
  Play,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Shuffle,
  SkipForward,
  Sparkles,
  UserRound,
  Volume2,
  Wifi,
  X,
  Repeat,
  Trash2,
  Pencil,
  Flag,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { Media, Usage } from "./types";
import { demos, starters, categories } from "./data";
import { api, cloud, listCloud, usage } from "./lib/cloud";
import {
  deleteLocal,
  getSetting,
  localLibrary,
  saveLocal,
  setSetting,
} from "./lib/local";
import { clamp, CLOUD_CHUNK, STORAGE_CAP } from "./lib/rules.mjs";
import { createDemoAudio } from "./lib/audio";
import useWheelSound from "./lib/useWheelSound";
import ClickWheel from "./components/ClickWheel";
import IPodDevice from "./components/IPodDevice";
import Cover from "./components/Cover";
import Dialog from "./components/Dialog";
import Scene from "./components/Scene";
import UploadDialog from "./components/Upload";
import HomeScreen from "./components/HomeScreen";
import Visuals from "./components/Visuals";
import {
  AlleyBackground,
  RetroLibrary,
  RetroStatus,
  RetroDock,
  RetroPlayback,
} from "./components/RetroPlayer";
import "./retro.css";

const time = (n: number) =>
  `${Math.floor((Number.isFinite(n) ? n : 0) / 60)}:${String(Math.floor((Number.isFinite(n) ? n : 0) % 60)).padStart(2, "0")}`;
const mb = (n: number) =>
  `${(n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0)} MB`;
const errorText = (e: unknown) =>
  e instanceof Error
    ? e.message
    : typeof e === "object" && e && "message" in e
      ? String(e.message)
      : "Something went wrong. Please try again.";
const DEFAULT_IPOD_COLOR = "#c6cbc5";
const validIpodColor = (value: unknown) =>
  typeof value === "string" && /^#[\da-f]{6}$/i.test(value)
    ? value
    : DEFAULT_IPOD_COLOR;

export default function App() {
  const wheelSound = useWheelSound();
  const [boot, setBoot] = useState(true),
    [loaded, setLoaded] = useState(false),
    [media, setMedia] = useState<Media[]>([]),
    [user, setUser] = useState<User | null>(null),
    [view, setView] = useState<"library" | "community" | "trailers">("library"),
    [tab, setTab] = useState("All tracks"),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState(0),
    [current, setCurrent] = useState<Media | null>(null),
    [playing, setPlaying] = useState(false),
    [cinema, setCinema] = useState(false),
    [loading, setLoading] = useState(false),
    [position, setPosition] = useState(0),
    [duration, setDuration] = useState(0),
    [volume, setVolume] = useState(0.55),
    [ipodColor, setIpodColor] = useState(DEFAULT_IPOD_COLOR),
    [dimmer, setDimmer] = useState(0.25),
    [shuffle, setShuffle] = useState(false),
    [repeat, setRepeat] = useState(false),
    [favorites, setFavorites] = useState<string[]>([]),
    [modal, setModal] = useState<"auth" | "settings" | "help" | null>(null),
    [upload, setUpload] = useState<"music" | "clip" | null>(null),
    [toast, setToast] = useState(""),
    [mood, setMood] = useState("All moods"),
    [clipIndex, setClipIndex] = useState(0),
    [clipSession, setClipSession] = useState(0),
    [readyClipId, setReadyClipId] = useState(""),
    [chosenClip, setChosenClip] = useState<Media | null>(null),
    [edit, setEdit] = useState<Media | null>(null),
    [detail, setDetail] = useState<Media | null>(null),
    [deleteTarget, setDeleteTarget] = useState<Media | null>(null),
    [storage, setStorage] = useState<Usage>({
      used: 0,
      cap: STORAGE_CAP,
      egress: 0,
      egressCap: 4_000_000_000,
    }),
    [clock, setClock] = useState(new Date()),
    [syncing, setSyncing] = useState(false),
    [mod, setMod] = useState(false),
    [modView, setModView] = useState(false),
    [full, setFull] = useState(false),
    [menuIndex, setMenuIndex] = useState(0),
    [searchOpen, setSearchOpen] = useState(false),
    [menuOpen, setMenuOpen] = useState(false),
    [chromeVisible, setChromeVisible] = useState(true);
  const audio = useRef<HTMLAudioElement | null>(null),
    audioContext = useRef<AudioContext | null>(null),
    audioGain = useRef<GainNode | null>(null),
    audioUrl = useRef(""),
    playTicket = useRef(0),
    keyHandler = useRef<(event: KeyboardEvent) => void>(() => {}),
    endedHandler = useRef<() => void>(() => {}),
    restore = useRef<{ id?: string; position?: number } | null>(null),
    latest = useRef({
      current,
      position,
      volume,
      ipodColor,
      dimmer,
      shuffle,
      repeat,
      favorites,
      selected,
      tab,
    }),
    stateReady = useRef(false),
    accountId = useRef<string | null>(null),
    refreshTicket = useRef(0);
  const stopPlayback = useCallback(() => {
    playTicket.current++;
    audio.current?.pause();
    setPlaying(false);
    setLoading(false);
  }, []);
  latest.current = {
    current,
    position,
    volume,
    ipodColor,
    dimmer,
    shuffle,
    repeat,
    favorites,
    selected,
    tab,
  };
  const notify = useCallback((s: string) => setToast(s), []);
  const refresh = useCallback(async () => {
    const ticket = ++refreshTicket.current;
    setSyncing(true);
    try {
      const local = await localLibrary();
      if (ticket === refreshTicket.current) {
        setMedia(local);
        setLoaded(true);
      }
      const remote = cloud ? await listCloud() : [];
      if (ticket !== refreshTicket.current) return;
      setMedia([...local, ...remote]);
      let u: Usage = {
        used: local.reduce((s, m) => s + m.size, 0),
        cap: STORAGE_CAP,
        egress: 0,
        egressCap: 4_000_000_000,
      };
      if (cloud) u = await usage();
      if (ticket !== refreshTicket.current) return;
      setStorage(u);
    } catch (e) {
      notify(errorText(e));
    } finally {
      if (ticket === refreshTicket.current) {
        setSyncing(false);
        setLoaded(true);
      }
    }
  }, [notify]);
  useEffect(() => {
    const t = setTimeout(() => setBoot(false), 350);
    const clockTimer = setInterval(() => setClock(new Date()), 30000);
    void getSetting("player")
      .then((s) => {
        if (s) {
          restore.current = s;
          setVolume(s.volume ?? 0.55);
          setIpodColor(validIpodColor(s.ipodColor));
          setDimmer(s.dimmer ?? 0.25);
          setShuffle(!!s.shuffle);
          setRepeat(!!s.repeat);
          setFavorites(s.favorites || []);
          setSelected(s.selected || 0);
          setTab(s.tab || "All tracks");
        }
        stateReady.current = true;
      })
      .catch(() => {
        stateReady.current = true;
      });
    void refresh();
    const subscription = cloud?.auth.onAuthStateChange((event, session) => {
      const nextId = session?.user.id || null;
      if (nextId === accountId.current) return;
      accountId.current = nextId;
      stopPlayback();
      setUser(session?.user || null);
      setCinema(false);
      setCurrent(null);
      setMod(false);
      setModView(false);
      setMedia((old) => old.filter((m) => m.local));
      if (event === "SIGNED_IN") {
        setModal("auth");
        notify(`Signed in as ${session?.user.email || "your account"}. Your account library is syncing.`);
      }
      // Auth callbacks run under Supabase's session lock. Start API calls
      // after the callback returns so getSession() cannot wait on that lock.
      setTimeout(() => {
        if (accountId.current !== nextId) return;
        void refresh();
        if (session)
          void api("me")
            .then((d) => {
              if (accountId.current === nextId) setMod(d.moderator);
            })
            .catch((e) => notify(errorText(e)));
      }, 0);
    });
    return () => {
      clearTimeout(t);
      clearInterval(clockTimer);
      subscription?.data.subscription.unsubscribe();
    };
  }, [refresh, notify, stopPlayback]);
  useEffect(() => {
    const a = new Audio();
    a.preload = "auto";
    a.loop = false;
    // Storage URLs are cross-origin. A media element must request CORS before
    // entering a Web Audio graph or browsers output silence for that source.
    a.crossOrigin = "anonymous";
    a.volume = volume;
    audio.current = a;
    const update = () => {
      setPosition(a.currentTime);
      setDuration(Number.isFinite(a.duration) ? a.duration : 0);
    };
    const ended = () => {
      setPlaying(false);
      window.dispatchEvent(new Event("nightshift-ended"));
    };
    a.addEventListener("timeupdate", update);
    a.addEventListener("loadedmetadata", update);
    a.addEventListener("ended", ended);
    a.addEventListener("pause", () => setPlaying(false));
    a.addEventListener("play", () => setPlaying(true));
    a.addEventListener("error", () => {
      setLoading(false);
      notify(
        "This track could not play. Its codec may not be supported by this browser.",
      );
    });
    return () => {
      a.pause();
      a.removeAttribute("src");
      a.load();
      void audioContext.current?.close();
      audioContext.current = null;
      audioGain.current = null;
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
      audio.current = null;
    };
  }, [notify]);
  useEffect(() => {
    if (audioGain.current) audioGain.current.gain.value = volume;
    else if (audio.current) audio.current.volume = volume;
  }, [volume]);
  useEffect(() => {
    const persist = () => {
      if (!stateReady.current) return;
      const s = latest.current;
      const state = { ...s, current: undefined, id: s.current?.id };
      void setSetting("player", state).catch(() => {});
      if (cloud && user) void api("state", { state }).catch(() => {});
    };
    const timer = setInterval(persist, 8000);
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", persist);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", persist);
      persist();
    };
  }, [user]);
  useEffect(() => {
    if (!stateReady.current) return;
    const s = latest.current;
    const state = { ...s, current: undefined, id: s.current?.id };
    void setSetting("player", state).catch(() => {});
    if (cloud && user) void api("state", { state }).catch(() => {});
  }, [ipodColor]);
  useEffect(() => {
    if (user)
      void api("state")
        .then((d) => {
          if (d?.state) {
            const s = d.state;
            restore.current = s;
            setFavorites(s.favorites || []);
            setVolume(s.volume ?? 0.55);
            setIpodColor(validIpodColor(s.ipodColor));
            setShuffle(!!s.shuffle);
            setRepeat(!!s.repeat);
            setDimmer(s.dimmer ?? 0.25);
            setSelected(s.selected || 0);
            setTab(s.tab || "All tracks");
          }
        })
        .catch((e) => notify(errorText(e)));
  }, [user, notify]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  const ownedTracks = media.filter(
    (m) => m.kind === "music" && (m.local || m.status === "private"),
  );
  const baseTracks =
    tab === "Demo collection"
      ? demos
      : tab === "Favorites"
        ? [...ownedTracks, ...demos].filter((m) => favorites.includes(m.id))
        : ownedTracks.length
          ? ownedTracks
          : demos;
  const tracks = baseTracks.filter((m) =>
    `${m.title} ${m.artist}`.toLowerCase().includes(search.toLowerCase()),
  );
  const highlighted =
    tracks[Math.min(selected, Math.max(0, tracks.length - 1))];
  const cloudClips = media.filter(
    (m) => m.kind === "clip" && (m.status === "approved" || m.local),
  );
  const clips = useMemo(() => {
    const pool = [
      ...starters.filter(
        (clip) => clip.externalUrl || clip.id === "scene-deep-dream",
      ),
      ...media.filter(
        (m) => m.kind === "clip" && (m.status === "approved" || m.local),
      ),
    ];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    // Start on a compact source while longer scenes buffer later in the montage.
    const fast = pool.findIndex((clip) =>
      clip.externalUrl?.startsWith("https://assets.mixkit.co/"),
    );
    if (fast > 0) [pool[0], pool[fast]] = [pool[fast], pool[0]];
    return pool;
  }, [media, clipSession]);
  const communityClips = [...starters, ...cloudClips];
  const activeClip =
    chosenClip || clips[clipIndex % clips.length] || starters[0];
  useEffect(() => {
    if (!cinema || !playing || chosenClip || readyClipId !== activeClip.id)
      return;
    const t = setTimeout(() => setClipIndex((i) => i + 1), 4000);
    return () => clearTimeout(t);
  }, [cinema, playing, chosenClip, readyClipId, activeClip.id]);

  async function start(track?: Media) {
    if (!track) {
      notify("Add music or select a demo track first.");
      return;
    }
    const ticket = ++playTicket.current;
    setLoading(true);
    try {
      const a = audio.current!;
      if (!audioContext.current && typeof AudioContext !== "undefined") {
        let context: AudioContext | null = null;
        try {
          context = new AudioContext();
          const gain = context.createGain();
          gain.gain.value = volume;
          context
            .createMediaElementSource(a)
            .connect(gain)
            .connect(context.destination);
          a.volume = 1;
          audioContext.current = context;
          audioGain.current = gain;
        } catch {
          void context?.close();
          a.volume = volume;
        }
      }
      // Resume during the Play gesture, before any network request yields.
      if (audioContext.current?.state === "suspended")
        void audioContext.current.resume().catch(() => {});
      if (current?.id !== track.id || !a.src) {
        a.pause();
        const source = track.demo
          ? await createDemoAudio(track.scene || 0)
          : track.blob || (track.size <= CLOUD_CHUNK && track.kind === "music"
              ? (await api("stream-url", { id: track.id })).url as string
              : await api(`stream/${track.id}`));
        if (ticket !== playTicket.current) return;
        const nextUrl = typeof source === "string" ? source : URL.createObjectURL(source);
        a.src = nextUrl;
        const old = audioUrl.current;
        audioUrl.current = typeof source === "string" ? "" : nextUrl;
        if (old) URL.revokeObjectURL(old);
        setCurrent(track);
        setDuration(track.duration);
        setPosition(0);
        if (restore.current?.id === track.id) {
          a.currentTime = restore.current.position || 0;
          restore.current = null;
        }
      }
      await a.play();
      if (ticket !== playTicket.current) return;
      if (!cinema || current?.id !== track.id) {
        setClipSession((s) => s + 1);
        setClipIndex(0);
      }
      setCinema(true);
      setView("library");
      setChosenClip(null);
    } catch (e) {
      if (ticket !== playTicket.current) return;
      notify(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Your browser needs another tap. Press Play to allow audio."
          : errorText(e),
      );
    } finally {
      if (ticket === playTicket.current) setLoading(false);
    }
  }
  function togglePlay() {
    if (playing || loading) {
      stopPlayback();
    } else void start(cinema ? current || highlighted : highlighted);
  }
  function next(direction = 1) {
    if (!tracks.length) return;
    const old = tracks.findIndex((t) => t.id === current?.id);
    const index = shuffle
      ? Math.floor(Math.random() * tracks.length)
      : (Math.max(0, old) + direction + tracks.length) % tracks.length;
    setSelected(index);
    void start(tracks[index]);
  }
  endedHandler.current = () => {
    if (repeat) {
      if (audio.current) audio.current.currentTime = 0;
      void start(current || undefined);
    } else next();
  };
  useEffect(() => {
    const ended = () => endedHandler.current();
    window.addEventListener("nightshift-ended", ended);
    return () => window.removeEventListener("nightshift-ended", ended);
  }, []);
  function rotate(delta: number) {
    if (cinema || (menuOpen && view === "library") || tracks.length > 1)
      wheelSound.beep();
    if (menuOpen && !cinema && view === "library") {
      setMenuIndex((i) => (i + delta + deviceMenu.length) % deviceMenu.length);
    } else if (cinema) {
      setVolume((v) => clamp(v + delta * 0.035));
    } else {
      setSelected((i) =>
        tracks.length ? (i + delta + tracks.length) % tracks.length : 0,
      );
    }
  }
  function back() {
    wheelSound.beep("back");
    if (cinema) setCinema(false);
    else if (view !== "library") {
      setView("library");
      setSearch("");
    } else {
      setMenuOpen((v) => !v);
      setMenuIndex(0);
    }
  }
  keyHandler.current = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("input,textarea,select,dialog") ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey
    )
      return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (cinema)
        setVolume((v) => clamp(v + (e.key === "ArrowUp" ? 0.035 : -0.035)));
      else rotate(e.key === "ArrowDown" ? 1 : -1);
    }
    if (e.key === "Enter" && !target.closest("button,a")) {
      e.preventDefault();
      selectHighlighted();
    }
    if (e.code === "Space" && !target.closest("button")) {
      e.preventDefault();
      togglePlay();
    }
    if (e.key === "Escape") back();
    if (e.key === "ArrowRight") {
      e.preventDefault();
      if (cinema && audio.current)
        audio.current.currentTime = Math.min(duration, position + 5);
      else rotate(1);
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (cinema && audio.current)
        audio.current.currentTime = Math.max(0, position - 5);
      else rotate(-1);
    }
    if (e.key === "+" || e.key === "=") setVolume((v) => clamp(v + 0.05));
    if (e.key === "-") setVolume((v) => clamp(v - 0.05));
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  async function remove(m: Media) {
    try {
      if (m.local) await deleteLocal(m.id);
      else await api("delete", { id: m.id });
      if (current?.id === m.id) {
        stopPlayback();
        setCurrent(null);
        setCinema(false);
      }
      if (chosenClip?.id === m.id) setChosenClip(null);
      setDeleteTarget(null);
      await refresh();
      notify("Upload deleted.");
    } catch (e) {
      notify(errorText(e));
    }
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setFull(false);
      } else {
        await document.documentElement.requestFullscreen();
        setFull(true);
      }
    } catch {
      notify(
        "Full-screen is unavailable in this browser. The player still fills the page.",
      );
    }
  }
  const chooseView = (v: typeof view) => {
    setView(v);
    setCinema(false);
    setSearch("");
    setSelected(0);
  };
  const capacity =
    storage.used >= storage.cap || storage.egress >= storage.egressCap;
  const demoView = baseTracks.some((t) => t.demo);
  const deviceMenu = [
    ...["All tracks", "Favorites", "Demo collection"].map((label) => ({
      label,
      action: () => {
        setTab(label);
        setSelected(0);
      },
    })),
    { label: "Add music", action: () => setUpload("music") },
    {
      label: `Shuffle: ${shuffle ? "On" : "Off"}`,
      action: () => setShuffle((v) => !v),
    },
    {
      label: `Repeat: ${repeat ? "On" : "Off"}`,
      action: () => setRepeat((v) => !v),
    },
    { label: "Community clips", action: () => chooseView("community") },
    { label: "My account", action: () => setModal("auth") },
    { label: "Settings", action: () => setModal("settings") },
    { label: "Official trailers", action: () => chooseView("trailers") },
    { label: "Controls / help", action: () => setModal("help") },
  ];
  function chooseMenu(index: number) {
    wheelSound.beep("select");
    deviceMenu[index]?.action();
    setMenuOpen(false);
  }
  function selectHighlighted() {
    if (!menuOpen) wheelSound.beep("select");
    if (menuOpen && !cinema && view === "library") chooseMenu(menuIndex);
    else if (cinema) togglePlay();
    else if (view !== "library") chooseView("library");
    else void start(highlighted);
  }
  const focusWheel = () =>
    document
      .querySelector<HTMLButtonElement>(".ipod-hardware .wheel-center")
      ?.focus();

  const chromeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealChrome = useCallback(() => {
    setChromeVisible(true);
    if (chromeTimer.current) clearTimeout(chromeTimer.current);
    chromeTimer.current = setTimeout(() => setChromeVisible(false), 2200);
  }, []);
  useEffect(() => {
    if (cinema) {
      setMenuOpen(false);
      revealChrome();
    } else setChromeVisible(true);
    return () => {
      if (chromeTimer.current) clearTimeout(chromeTimer.current);
    };
  }, [cinema, revealChrome]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest("input,textarea,select,dialog"))
        return;
      if (event.key.toLowerCase() === "w") focusWheel();
      if (cinema) revealChrome();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [cinema, revealChrome]);
  return (
    <IPodDevice
      shellColor={ipodColor}
      onInteract={wheelSound.unlock}
      caption={
        cinema
          ? `VOLUME ${Math.round(volume * 100)}%`
          : menuOpen
            ? "SCROLL · CHOOSE A MENU ITEM"
            : "SCROLL · SELECT A SONG"
      }
      controls={
        <ClickWheel
          playing={playing}
          volumeMode={cinema}
          onRotate={rotate}
          onSelect={selectHighlighted}
          onMenu={back}
          onPrevious={() => (cinema ? next(-1) : rotate(-1))}
          onNext={() => (cinema ? next() : rotate(1))}
          onSeekBack={() => {
            if (audio.current?.src) {
              audio.current.currentTime = Math.max(0, audio.current.currentTime - 10);
              setPosition(audio.current.currentTime);
            }
          }}
          onSeekForward={() => {
            if (audio.current?.src) {
              audio.current.currentTime = Math.min(duration || Infinity, audio.current.currentTime + 10);
              setPosition(audio.current.currentTime);
            }
          }}
          onPlay={togglePlay}
        />
      }
    >
      <div
        className={`app retro-player ${cinema ? "is-cinema" : ""} ${
          cinema && !playing ? "is-paused" : ""
        } ${chromeVisible ? "chrome-visible" : ""}`}
        onPointerMove={() => {
          if (cinema) revealChrome();
        }}
        onPointerDown={() => {
          if (cinema) revealChrome();
        }}
      >
        <AlleyBackground />
        {cinema && (
          <Visuals
            clip={activeClip}
            paused={!!current && !playing && !chosenClip}
            onError={notify}
            onReady={setReadyClipId}
          />
        )}
        <div
          className="cinema-dimmer"
          style={{ background: `rgba(0,0,0,${cinema ? dimmer : 0})` }}
        />
        <div className="retro-scanlines" aria-hidden="true" />
        <div className="grain" />
        <RetroStatus
          date={clock}
          cinema={cinema}
          visible={chromeVisible}
          accountEmail={user?.email}
          onAccount={() => setModal("auth")}
          onBack={() => {
            if (cinema) back();
            else setMenuOpen((v) => !v);
          }}
        />
        {!cinema ? (
          view === "library" ? (
            <RetroLibrary
              tracks={tracks}
              selected={selected}
              loaded={loaded}
              starting={loading}
              search={search}
              setSearch={setSearch}
              setSelected={(index) => {
                if (index !== selected) wheelSound.beep();
                setSelected(index);
              }}
              onPlay={(m) => void start(m)}
              onOptions={setDetail}
              onUpload={() => setUpload("music")}
              onRotate={rotate}
              tab={tab}
              setTab={setTab}
              searchOpen={searchOpen}
              setSearchOpen={setSearchOpen}
              menuOpen={menuOpen}
              setMenuOpen={setMenuOpen}
              menuItems={deviceMenu.map((item) => item.label)}
              menuIndex={menuIndex}
              onMenuChoose={chooseMenu}
              onMenuHighlight={setMenuIndex}
              shuffle={shuffle}
              repeat={repeat}
              toggleShuffle={() => setShuffle((v) => !v)}
              toggleRepeat={() => setRepeat((v) => !v)}
              onSettings={() => setModal("settings")}
              onTrailers={() => chooseView("trailers")}
              onHelp={() => setModal("help")}
            />
          ) : (
            <main className="retro-secondary">
              <button
                className="retro-secondary-back"
                onClick={() => chooseView("library")}
              >
                <ArrowLeft size={17} />
                Music
              </button>
              {view === "community" ? (
                <section className="community">
                  <div className="section-intro">
                    <div>
                      <div className="eyebrow">
                        A WINDOW INTO SOMEWHERE ELSE
                      </div>
                      <h1>
                        Shared scenes.
                        <br />
                        <span>Individual escapes.</span>
                      </h1>
                      <p>
                        {starters.filter((clip) => clip.externalUrl).length}{" "}
                        licensed videos ·{" "}
                        {starters.filter((clip) => !clip.externalUrl).length}{" "}
                        original scenes
                      </p>
                    </div>
                    <button
                      className="outline"
                      onClick={() => setUpload("clip")}
                    >
                      <Plus size={16} /> Submit a clip
                    </button>
                  </div>
                  <div className="community-tools">
                    <div className="mood-filters">
                      {categories.map((c) => (
                        <button
                          className={mood === c ? "active" : ""}
                          onClick={() => setMood(c)}
                          key={c}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    {mod && (
                      <button
                        className="outline"
                        onClick={() => setModView((v) => !v)}
                      >
                        <ShieldCheck size={15} />
                        {modView ? "Show approved" : "Moderation queue"}
                      </button>
                    )}
                  </div>
                  <div className="clip-grid">
                    {(modView
                      ? media.filter(
                          (m) =>
                            m.kind === "clip" &&
                            ["pending", "hidden"].includes(m.status || ""),
                        )
                      : communityClips
                    )
                      .filter(
                        (c) => mood === "All moods" || c.category === mood,
                      )
                      .map((c, i) => (
                        <article className="clip-card" key={c.id}>
                          <button
                            className="clip-preview"
                            aria-label={`Watch ${c.title}`}
                            onClick={() => {
                              setChosenClip(c);
                              setCinema(true);
                            }}
                          >
                            {c.externalUrl && c.cover ? (
                              <img
                                src={c.cover}
                                alt={`${c.title} video preview`}
                                loading="lazy"
                              />
                            ) : (
                              <Scene scene={c.scene ?? i % 6} still />
                            )}
                            <span className="clip-badge">
                              {c.externalUrl
                                ? "LICENSED VIDEO"
                                : c.demo
                                  ? "ORIGINAL SCENE"
                                  : c.status?.toUpperCase()}
                            </span>
                            <span className="clip-play">
                              <Play size={20} fill="currentColor" />
                            </span>
                            <span className="clip-time">
                              {time(c.duration)}
                            </span>
                          </button>
                          <div className="clip-card-heading">
                            <div>
                              <strong>{c.title}</strong>
                              <span>
                                {c.category} <i>·</i> {c.artist}
                              </span>
                            </div>
                            <button
                              className="icon-button"
                              aria-label={`Details for ${c.title}`}
                              onClick={() => setDetail(c)}
                            >
                              <MoreHorizontal size={18} />
                            </button>
                          </div>
                          {modView && (
                            <div className="moderation-actions">
                              <button
                                className="outline"
                                onClick={() =>
                                  void api("moderate", {
                                    id: c.id,
                                    status: "approved",
                                  })
                                    .then(() => refresh())
                                    .catch((e) => notify(errorText(e)))
                                }
                              >
                                Approve
                              </button>
                              <button
                                className="outline"
                                onClick={() =>
                                  void api("moderate", {
                                    id: c.id,
                                    status: "hidden",
                                  })
                                    .then(() => refresh())
                                    .catch((e) => notify(errorText(e)))
                                }
                              >
                                Hide
                              </button>
                            </div>
                          )}
                        </article>
                      ))}
                  </div>
                  {!modView && (
                    <div className="community-note">
                      <ShieldCheck size={18} />
                      <p>
                        Original scenes are rendered on your device. Community
                        videos are shared once, reviewed, and streamed silently
                        behind your music.
                      </p>
                    </div>
                  )}
                  {media.some(
                    (m) => m.kind === "clip" && m.status === "pending",
                  ) && (
                    <p className="muted">
                      Your submitted clips appear after moderator approval. Find
                      pending uploads in My account.
                    </p>
                  )}
                  <StorageMeter storage={storage} local={!cloud} />
                </section>
              ) : (
                <section className="trailers">
                  <div className="eyebrow">STORIES WORTH STEPPING INTO</div>
                  <h1>
                    A different kind
                    <br />
                    <span>of escape.</span>
                  </h1>
                  <p className="muted">
                    Official trailers, straight from their creators. Open the
                    original player, with its own sound.
                  </p>
                  <a
                    className="trailer-card"
                    href="https://gkids.com/studio-ghibli/trailers/"
                    target="_blank"
                    rel="noreferrer"
                    onClick={stopPlayback}
                  >
                    <Scene scene={4} still />
                    <div>
                      <span className="eyebrow">GKIDS / STUDIO GHIBLI</span>
                      <h2>Worlds beyond the everyday.</h2>
                      <p>The Boy and the Heron · Spirited Away · and more</p>
                      <span>
                        Explore official anime trailers{" "}
                        <ArrowUpRight size={17} />
                      </span>
                    </div>
                  </a>
                  <p className="small muted">
                    Trailers open on the official distributor’s site. They are
                    never downloaded or used as background footage.
                  </p>
                  <a
                    className="text-link"
                    href="https://pixabay.com/videos/ai-generated-young-woman-anime-girl-267774/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Discover a licensed anime-style stock scene by SYG_Anime{" "}
                    <ArrowUpRight size={15} />
                  </a>
                </section>
              )}
            </main>
          )
        ) : (
          <RetroPlayback
            track={current}
            clip={activeClip}
            playing={playing}
            position={position}
            duration={duration}
            visible={chromeVisible}
            onPlay={togglePlay}
            onSeek={(n) => {
              if (audio.current) audio.current.currentTime = n;
              setPosition(n);
            }}
            onPrevious={() => next(-1)}
            onNext={() => next()}
            onCredits={() => setDetail(activeClip)}
          />
        )}
        {capacity && !cinema && (
          <div className="retro-capacity" role="alert">
            {!cloud
              ? "Device library is full. Free browser storage to add more music."
              : storage.used >= storage.cap
              ? "Cloud storage is full. You can still save music on this device."
              : "Monthly cloud bandwidth reached. You can still save music on this device."}
          </div>
        )}
        <RetroDock
          view={view}
          cinema={cinema}
          visible={chromeVisible}
          wheelOpen={true}
          onWheel={focusWheel}
          onHome={() => chooseView("library")}
          onMusic={() => {
            if (cinema) setCinema(false);
            setView("library");
            setMenuOpen((v) => !v);
          }}
          onSearch={() => {
            chooseView("library");
            setSearchOpen((v) => !v);
          }}
          onCommunity={() => chooseView("community")}
          onAccount={() => setModal("auth")}
          accountEmail={user?.email}
          onSettings={() => setModal("settings")}
          onFullscreen={() => void fullscreen()}
          onTrailers={() => chooseView("trailers")}
        />
        {toast && (
          <div className="toast" role="status">
            <span>{toast}</span>
            <button
              onClick={() => setToast("")}
              aria-label="Dismiss notification"
            >
              <X size={16} />
            </button>
          </div>
        )}
        {upload && (
          <UploadDialog
            kind={upload}
            account={!!user}
            cloudStorageRemaining={Math.max(0, storage.cap - storage.used)}
            cloudBandwidthRemaining={Math.max(0, storage.egressCap - storage.egress)}
            onClose={() => setUpload(null)}
            onSignIn={() => {
              setUpload(null);
              setModal("auth");
            }}
            onDone={(destination) => {
              void refresh();
              notify(
                destination === "cloud" && upload === "clip"
                  ? "Clip submitted for moderation."
                  : destination === "cloud"
                    ? "Saved to your private account library."
                    : "Imported on this device. Keep your original file.",
              );
            }}
            onError={notify}
          />
        )}
        {modal === "auth" && (
          <Account
            user={user}
            onClose={() => setModal(null)}
            media={media}
            onDelete={(m) => setDeleteTarget(m)}
            notify={notify}
            storage={storage}
          />
        )}
        {modal === "settings" && (
          <Dialog title="Make it your own." onClose={() => setModal(null)}>
            <HomeScreen />
            <div className="ipod-color-setting">
              <label htmlFor="ipod-shell-color">iPod color</label>
              <div className="ipod-color-picker">
                <input
                  id="ipod-shell-color"
                  type="color"
                  aria-label="iPod color"
                  value={ipodColor}
                  onChange={(e) => setIpodColor(e.target.value)}
                />
                <output>{ipodColor.toUpperCase()}</output>
              </div>
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={wheelSound.enabled}
                onChange={(e) => wheelSound.setEnabled(e.target.checked)}
              />
              Wheel sounds
            </label>
            <label>
              Music volume · {Math.round(volume * 100)}%
              <input
                aria-label="Music volume"
                type="range"
                min="0"
                max="1"
                step=".01"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
              />
            </label>
            <label>
              Scene dimmer · {Math.round(dimmer * 100)}%
              <input
                aria-label="Scene dimmer"
                type="range"
                min=".1"
                max=".8"
                step=".01"
                value={dimmer}
                onChange={(e) => setDimmer(Number(e.target.value))}
              />
            </label>
            <StorageMeter storage={storage} local={!cloud} />
            <p className="small muted">
              {cloud
                ? "Cloud uploads pause at the shared storage or media bandwidth cap. Saving on this device remains available."
                : "This session saves files on this browser. Clearing site data removes them. Keep a copy of your originals."}
            </p>
          </Dialog>
        )}
        {modal === "help" && (
          <Dialog title="A familiar feeling." onClose={() => setModal(null)}>
            <p className="muted">
              A little like your first music player. A little like being
              somewhere else.
            </p>
            <div className="help-row">
              <Disc3 />
              <div>
                <strong>Turn to explore</strong>
                <p>
                  Drag around the wheel or scroll over it to move through songs.
                  During playback, clockwise turns the music up.
                </p>
              </div>
            </div>
            <div className="help-row">
              <Play />
              <div>
                <strong>Press to escape</strong>
                <p>
                  Select a song, then press the center. Your music plays over
                  quiet, cinematic scenes. MENU brings you back.
                </p>
              </div>
            </div>
            <div className="key-grid">
              <span>Browse / volume</span>
              <kbd>↑ ↓</kbd>
              <span>Play / pause</span>
              <kbd>Space</kbd>
              <span>Select track</span>
              <kbd>Enter</kbd>
              <span>Seek 5 seconds</span>
              <kbd>← →</kbd>
              <span>Volume</span>
              <kbd>+ −</kbd>
              <span>Return to music</span>
              <kbd>Esc</kbd>
            </div>
            <button className="primary full" onClick={() => setModal(null)}>
              Find my frequency <ArrowUpRight size={16} />
            </button>
          </Dialog>
        )}
        {detail && (
          <Dialog title={detail.title} onClose={() => setDetail(null)}>
            <p className="muted">
              {detail.artist}
              {detail.kind === "clip" ? ` · ${detail.category}` : ""}
            </p>
            {detail.kind === "music" ? (
              <>
                <button
                  className="action-row"
                  onClick={() => {
                    setFavorites((f) =>
                      f.includes(detail.id)
                        ? f.filter((id) => id !== detail.id)
                        : [...f, detail.id],
                    );
                  }}
                >
                  <Sparkles size={18} />
                  {favorites.includes(detail.id)
                    ? "Remove from favorites"
                    : "Save to favorites"}
                  {favorites.includes(detail.id) && <Check size={15} />}
                </button>
                {!detail.demo && (
                  <button
                    className="action-row"
                    onClick={() => {
                      setEdit(detail);
                      setDetail(null);
                    }}
                  >
                    <Pencil size={18} />
                    Edit title and artist
                  </button>
                )}
                <button
                  className="action-row"
                  onClick={() => {
                    void start(detail);
                    setDetail(null);
                  }}
                >
                  <Play size={18} />
                  Play track
                </button>
              </>
            ) : (
              <>
                <p className="license-info">{detail.permission}</p>
                {mod && !detail.demo && !detail.local && (
                  <ClipReports id={detail.id} />
                )}
                {detail.source?.startsWith("https://") ? (
                  <a
                    className="text-link"
                    href={detail.source}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Original source <ArrowUpRight size={15} />
                  </a>
                ) : (
                  <p className="small muted">{detail.source}</p>
                )}
                {!detail.demo && !detail.local && (
                  <button
                    className="action-row"
                    onClick={() => {
                      setEdit({ ...detail, title: "Report clip" });
                      setDetail(null);
                    }}
                  >
                    <Flag size={17} />
                    Report this clip
                  </button>
                )}
              </>
            )}
            {!detail.demo &&
              (detail.local ||
                detail.owner_id === user?.id ||
                (mod && detail.kind === "clip")) && (
                <button
                  className="action-row danger"
                  onClick={() => {
                    setDeleteTarget(detail);
                    setDetail(null);
                  }}
                >
                  <Trash2 size={17} />
                  Delete my upload
                </button>
              )}
          </Dialog>
        )}
        {edit && (
          <EditDialog
            media={edit}
            onClose={() => setEdit(null)}
            onSave={async (values) => {
              try {
                if (edit.title === "Report clip") {
                  await api("report", { id: edit.id, reason: values.reason });
                  notify(
                    "Report received. Thank you for keeping this space safe.",
                  );
                } else if (edit.local) await saveLocal({ ...edit, ...values });
                else await api("edit", { id: edit.id, ...values });
                setEdit(null);
                await refresh();
              } catch (e) {
                notify(errorText(e));
                throw e;
              }
            }}
          />
        )}
        {deleteTarget && (
          <Dialog
            title="Delete this upload?"
            onClose={() => setDeleteTarget(null)}
          >
            <p className="muted">
              “{deleteTarget.title}” will be removed from{" "}
              {deleteTarget.local ? "this browser" : "storage and the library"}.
              Keep your original file if you want to add it again.
            </p>
            <div className="dialog-buttons">
              <button className="outline" onClick={() => setDeleteTarget(null)}>
                Keep it
              </button>
              <button
                className="primary danger-bg"
                onClick={() => void remove(deleteTarget)}
              >
                <Trash2 size={16} />
                Delete upload
              </button>
            </div>
          </Dialog>
        )}
        {boot && (
          <div className="retro-boot">
            <span className="retro-boot-disc" />
            <span>Loading…</span>
            <div className="retro-boot-progress" />
          </div>
        )}
      </div>
    </IPodDevice>
  );
}

function ClipReports({ id }: { id: string }) {
  const [reports, setReports] = useState<{ id: string; reason: string }[]>([]);
  useEffect(() => {
    let active = true;
    void cloud
      ?.from("clip_reports")
      .select("id,reason")
      .eq("clip_id", id)
      .then(({ data }) => {
        if (active) setReports(data || []);
      });
    return () => {
      active = false;
    };
  }, [id]);
  return reports.length ? (
    <div className="report-list">
      <h3>{reports.length} community reports</h3>
      {reports.map((r) => (
        <p className="small muted" key={r.id}>
          {r.reason}
        </p>
      ))}
    </div>
  ) : null;
}

function StorageMeter({ storage, local }: { storage: Usage; local: boolean }) {
  return (
    <div className="storage-meter">
      <div>
        <span>{local ? "BROWSER STORAGE" : "SHARED STORAGE"}</span>
        <strong>
          {mb(storage.used)} <span>/ {mb(storage.cap)}</span>
        </strong>
      </div>
      <progress value={storage.used} max={storage.cap} />
      {storage.used >= storage.cap ? (
        <p className="form-error">
          {local
            ? "Device library full. Free browser storage to add more music."
            : "Cloud library full. Cloud uploads are paused. Existing files are kept."}
        </p>
      ) : (
        <p>
          {local
            ? "Local files remain on this device."
            : `${(storage.egress / 1e9).toFixed(2)} / ${(storage.egressCap / 1e9).toFixed(1)} GB reserved media bandwidth this month`}
        </p>
      )}
      {storage.egress >= storage.egressCap && (
        <p className="form-error">
          Monthly media bandwidth reached. Cloud streaming and uploads resume
          next month. You can still save music on this device.
        </p>
      )}
    </div>
  );
}
function Account({
  user,
  onClose,
  media,
  onDelete,
  notify,
  storage,
}: {
  user: User | null;
  onClose: () => void;
  media: Media[];
  onDelete: (m: Media) => void;
  notify: (s: string) => void;
  storage: Usage;
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [passwordSaved, setPasswordSaved] = useState(false),
    [error, setError] = useState("");
  async function passwordSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!cloud) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await cloud.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setPassword("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!cloud) return;
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error } = await cloud.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setConfirmPassword("");
      setPasswordSaved(true);
      notify("Password saved. You can now sign in on your other devices.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={user ? "Your own little world." : "Keep your music close."}
      onClose={onClose}
    >
      {user ? (
        <>
          <p className="muted">Signed in as {user.email}</p>
          <StorageMeter storage={storage} local={false} />
          <h3>Your uploads</h3>
          <div className="account-uploads">
            {media
              .filter((m) => m.owner_id === user.id)
              .map((m) => (
                <div key={m.id}>
                  <span>
                    <strong>{m.title}</strong>
                    <small>
                      {m.kind === "music" ? "Private music" : m.status}
                    </small>
                  </span>
                  <button
                    className="icon-button"
                    aria-label={`Delete ${m.title}`}
                    onClick={() => onDelete(m)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            {!media.some((m) => m.owner_id === user.id) && (
              <p className="muted">
                Your account library is empty. Local files stay in this browser
                until you upload them while signed in.
              </p>
            )}
          </div>
          <h3>Sign in on any device</h3>
          <p className="muted small">
            Set a password for this account, then use the same email and password
            in the player on your phone. Your private uploads will appear there.
          </p>
          <form onSubmit={savePassword}>
            <label>
              New password
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label>
              Confirm new password
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            {passwordSaved && <p role="status">Password saved for this account.</p>}
            <button className="primary full" disabled={busy}>
              {busy ? "Saving…" : "Set account password"}
            </button>
          </form>
          <button
            className="outline full"
            onClick={() =>
              void cloud?.auth.signOut().then(({ error }) => {
                if (error) notify(error.message);
                else onClose();
              })
            }
          >
            Sign out
          </button>
        </>
      ) : cloud ? (
        <>
          <p className="muted">
            Sign in to your private library. Music uploaded to your account on
            one device appears on your other devices too.
          </p>
          <form onSubmit={passwordSignIn}>
              <label>
                Email address
                <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </label>
              <label>
                Password
                <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
              {error && <p role="alert" className="form-error">{error}</p>}
              <button className="primary full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          </form>
        </>
      ) : (
        <>
          <p className="muted">
            You’re in a local session. Add music, save favorites, and enjoy
            every player control right here.
          </p>
          <div className="setup-note">
            <ShieldCheck size={22} />
            <strong>Ready for your free cloud.</strong>
            <p>
              Account sync and community submissions become available when you
              connect a Supabase Free project. Follow the setup in the project
              README, add the public environment variables, and restart the app.
            </p>
          </div>
          <button className="primary full" onClick={onClose}>
            Keep exploring <ArrowUpRight size={16} />
          </button>
        </>
      )}
    </Dialog>
  );
}
function EditDialog({
  media,
  onClose,
  onSave,
}: {
  media: Media;
  onClose: () => void;
  onSave: (v: {
    title?: string;
    artist?: string;
    reason?: string;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState(media.title),
    [artist, setArtist] = useState(media.artist),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const report = media.title === "Report clip";
  return (
    <Dialog
      title={report ? "Help keep it a good place." : "Give it the right name."}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          void onSave(report ? { reason } : { title, artist })
            .catch((e) => setError(errorText(e)))
            .finally(() => setBusy(false));
        }}
      >
        {report ? (
          <label>
            Reason for reporting
            <textarea
              required
              minLength={10}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Tell the moderator what’s wrong. Include a source if this is a rights issue."
            />
          </label>
        ) : (
          <>
            <label>
              Track title
              <input
                required
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              Artist
              <input
                required
                maxLength={120}
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
              />
            </label>
          </>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button className="primary full" disabled={busy}>
          {busy ? "Saving…" : report ? "Submit report" : "Save changes"}
          <Check size={16} />
        </button>
      </form>
    </Dialog>
  );
}
