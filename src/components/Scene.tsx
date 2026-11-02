import { useEffect, useRef } from "react";
import { paintDeepDream } from "./DeepDream";
// Original geometry, no downloaded imagery or copyrighted animation.
export function paintScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
  scene: number,
) {
  if (scene === 6) {
    paintDeepDream(ctx, w, h, time);
    return;
  }
  const rand = (n: number) => {
    const v = Math.sin(n * 127.1 + scene * 31.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const palettes = [
    ["#131b35", "#8d759d", "#637fba"],
    ["#101c27", "#547789", "#a2a5ab"],
    ["#191226", "#9b73c6", "#6279b1"],
    ["#111b2e", "#b8809e", "#526e9c"],
    ["#191b35", "#9b9ebd", "#6d6c9e"],
    ["#0c252b", "#4b9d9c", "#97759a"],
  ];
  const p = palettes[scene % 6];
  ctx.fillStyle = "#090d17";
  ctx.fillRect(0, 0, w, h);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#080b16");
  sky.addColorStop(0.65, p[0]);
  sky.addColorStop(1, "#0a0c14");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  if (scene === 2) {
    for (let j = 0; j < 8; j++) {
      ctx.save();
      ctx.translate(w * 0.5, h * 0.48);
      ctx.rotate(time * 0.018 + j * 0.4);
      ctx.strokeStyle = `${p[1]}${Math.round(15 + j * 6)
        .toString(16)
        .padStart(2, "0")}`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(
        0,
        0,
        w * (0.08 + j * 0.04),
        h * (0.04 + j * 0.028),
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      ctx.restore();
    }
    return;
  }
  const moon = ctx.createRadialGradient(
    w * 0.7,
    h * 0.18,
    3,
    w * 0.7,
    h * 0.18,
    h * 0.22,
  );
  moon.addColorStop(0, "#c7c8de25");
  moon.addColorStop(1, "#c7c8de00");
  ctx.fillStyle = moon;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#afbad283";
  ctx.beginPath();
  ctx.arc(w * 0.7, h * 0.18, h * 0.027, 0, Math.PI * 2);
  ctx.fill();
  for (let layer = 0; layer < 3; layer++) {
    const ground = h * (0.64 + layer * 0.1),
      bw = w / (16 - layer * 4);
    for (let i = -1; i < 20; i++) {
      const drift =
        scene === 3
          ? (time * (layer + 1) * 3) % bw
          : Math.sin(time * 0.025) * 5 * (layer + 1);
      const x = i * bw + drift,
        y = ground - h * (0.08 + rand(i + layer * 23) * (0.23 + layer * 0.09)),
        height = ground - y;
      ctx.fillStyle = ["#111727", "#0c1220", "#080e19"][layer];
      ctx.fillRect(x, y, bw * 0.91, height);
      ctx.strokeStyle = "#39405228";
      ctx.strokeRect(x, y, bw * 0.91, height);
      for (let a = 1; a < 7; a++)
        for (let b = 0; b < Math.floor(height / 12); b++)
          if (rand(i * 123 + a * 14 + b * 3 + layer * 200) > 0.56) {
            ctx.fillStyle = rand(a + b) > 0.5 ? "#b9a58838" : "#7d91bf30";
            ctx.fillRect(x + a * bw * 0.12, y + 10 + b * 12, bw * 0.04, 3);
          }
      if (layer === 2 && rand(i + 8) > 0.58) {
        ctx.shadowColor = p[1];
        ctx.shadowBlur = 12;
        ctx.fillStyle = p[1] + "87";
        ctx.fillRect(x + bw * 0.1, y + 16, 9, Math.min(75, height * 0.6));
        ctx.fillStyle = "#eee0e2a0";
        ctx.font = `${Math.max(8, bw * 0.11)}px monospace`;
        ["夜", "の", "街"].forEach((c, k) =>
          ctx.fillText(c, x + bw * 0.11, y + 30 + k * 14),
        );
        ctx.shadowBlur = 0;
      }
    }
  }
  const road = ctx.createLinearGradient(0, h * 0.72, 0, h);
  road.addColorStop(0, "#12172c00");
  road.addColorStop(1, "#10131f");
  ctx.fillStyle = road;
  ctx.fillRect(0, h * 0.72, w, h * 0.28);
  for (let i = 0; i < 25; i++) {
    const x = rand(i + 70) * w;
    ctx.fillStyle = (i % 2 ? p[1] : p[2]) + "12";
    ctx.fillRect(x, h * 0.8, 2 + rand(i) * 6, h * 0.2);
  }
  ctx.strokeStyle = "#8693b42d";
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 115; i++) {
    const x = (rand(i + 300) * w - time * (15 + rand(i) * 15) + w * 100) % w,
      y = (rand(i + 500) * h + time * (40 + rand(i) * 60)) % h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 3, y + 12 + rand(i) * 20);
    ctx.stroke();
  }
  if (scene === 4) {
    ctx.fillStyle = "#080c15";
    ctx.fillRect(w * 0.79, h * 0.52, w * 0.035, h * 0.3);
    ctx.beginPath();
    ctx.arc(w * 0.808, h * 0.495, h * 0.017, 0, Math.PI * 2);
    ctx.fill();
  }
  const vignette = ctx.createRadialGradient(
    w * 0.5,
    h * 0.45,
    h * 0.1,
    w * 0.5,
    h * 0.5,
    w * 0.75,
  );
  vignette.addColorStop(0, "#00000000");
  vignette.addColorStop(1, "#000000a8");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
}
export default function Scene({
  scene = 0,
  still = false,
  className = "",
}: {
  scene?: number;
  still?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let frame = 0,
      last = 0;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const draw = (now: number) => {
      if (now - last > 45 || still) {
        const rect = canvas.getBoundingClientRect();
        canvas.width = Math.min(1600, Math.max(480, rect.width));
        canvas.height = Math.max(
          270,
          canvas.width * (rect.height / Math.max(1, rect.width)),
        );
        paintScene(
          ctx,
          canvas.width,
          canvas.height,
          still || reduced ? 0 : now / 1000,
          scene,
        );
        last = now;
      }
      if (!still && !reduced) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [scene, still]);
  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
