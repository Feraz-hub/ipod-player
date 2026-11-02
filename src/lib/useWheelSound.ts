import { useCallback, useEffect, useRef, useState } from "react";
import { getSetting, setSetting } from "./local";

type Beep = "scroll" | "select" | "back";

export default function useWheelSound() {
  const [enabled, setEnabled] = useState(true);
  const enabledNow = useRef(enabled);
  enabledNow.current = enabled;
  const context = useRef<AudioContext | null>(null);
  const lastBeep = useRef(-Infinity);
  const request = useRef(0);
  const edited = useRef(false);
  useEffect(() => {
    let active = true;
    void getSetting("wheel-sounds")
      .then((value) => {
        if (active && !edited.current && typeof value === "boolean")
          setEnabled(value);
      })
      .catch(() => {});
    return () => {
      active = false;
      request.current++;
      void context.current?.close();
      context.current = null;
    };
  }, []);

  // Called only by a pointer/key gesture or an explicit control action.
  const unlock = useCallback(() => {
    if (!enabledNow.current) return null;
    try {
      if (!context.current) {
        const Audio =
          window.AudioContext ||
          (
            window as unknown as {
              webkitAudioContext: typeof AudioContext;
            }
          ).webkitAudioContext;
        if (!Audio) return null;
        context.current = new Audio();
      }
      if (context.current.state === "suspended")
        void context.current.resume().catch(() => {});
      return context.current;
    } catch {
      return null;
    }
  }, []);

  const beep = useCallback(
    (kind: Beep = "scroll") => {
      const ctx = unlock();
      if (!ctx) return;
      const ticket = ++request.current;
      const requestedAt = performance.now();
      const play = () => {
        if (
          !enabledNow.current ||
          ticket !== request.current ||
          ctx.state !== "running" ||
          performance.now() - requestedAt > 150 ||
          performance.now() - lastBeep.current < 30
        )
          return;
        lastBeep.current = performance.now();
        const duration = kind === "select" ? 0.055 : 0.032;
        const tone = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime;
        tone.type = "sine";
        tone.frequency.setValueAtTime(
          kind === "select" ? 2600 : kind === "back" ? 1400 : 2100,
          start,
        );
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.055, start + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        tone.connect(gain).connect(ctx.destination);
        tone.onended = () => {
          tone.disconnect();
          gain.disconnect();
        };
        tone.start(start);
        tone.stop(start + duration + 0.005);
      };
      if (ctx.state === "running") play();
      else
        void ctx
          .resume()
          .then(play)
          .catch(() => {});
    },
    [unlock],
  );

  const changeEnabled = (value: boolean) => {
    edited.current = true;
    enabledNow.current = value;
    setEnabled(value);
    request.current++;
    void setSetting("wheel-sounds", value).catch(() => {});
  };
  return { beep, unlock, enabled, setEnabled: changeEnabled };
}
