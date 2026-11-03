import { useState } from "react";

export default function Cover({
  index = 0,
  seed,
  src,
  className = "",
}: {
  index?: number;
  seed?: string;
  src?: string;
  className?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  if (src) return <img className={`cover ${className}`} src={src} alt="" />;
  let hash = 2166136261;
  for (const character of seed || String(index)) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  const number = (hash >>> 0) % 20 + 1;
  if (!imageFailed) return (
    <img
      className={`cover fallback-cover ${className}`}
      src={`${import.meta.env.BASE_URL}covers/fallback-${String(number).padStart(2, "0")}.jpg`}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setImageFailed(true)}
    />
  );
  const palettes = [
    ["#1a2540", "#b1abc5", "#a95767"],
    ["#513645", "#c9bcb0", "#c48478"],
    ["#203b38", "#c0ceba", "#608b83"],
    ["#2d3054", "#b6b4d0", "#b89ab3"],
    ["#33303e", "#bcb29d", "#7c7b91"],
  ];
  const p = palettes[index % 5];
  return (
    <svg
      className={`cover ${className}`}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`c${index}`} x2=".8" y2="1">
          <stop stopColor={p[0]} />
          <stop offset="1" stopColor={p[2]} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#c${index})`} />
      {index % 3 === 0 ? (
        <>
          <circle cx="69" cy="28" r="14" fill={p[1]} opacity=".55" />
          {Array.from({ length: 9 }, (_, i) => (
            <rect
              key={i}
              x={i * 13 - 5}
              y={45 + ((i * 17) % 29)}
              width="11"
              height="65"
              fill="#0d1423"
              opacity=".7"
            />
          ))}
          <path d="M0 92L70 68 100 80" fill="none" stroke={p[1]} opacity=".4" />
        </>
      ) : index % 3 === 1 ? (
        <>
          <rect
            x="18"
            y="12"
            width="64"
            height="76"
            fill="none"
            stroke={p[1]}
            opacity=".35"
          />
          <ellipse cx="50" cy="47" rx="20" ry="28" fill={p[1]} opacity=".4" />
          <path d="M18 88L49 25 85 88" fill={p[0]} opacity=".8" />
          <circle cx="50" cy="44" r="9" fill={p[1]} opacity=".6" />
        </>
      ) : (
        <>
          {Array.from({ length: 8 }, (_, i) => (
            <ellipse
              key={i}
              cx="50"
              cy="50"
              rx={10 + i * 5}
              ry={8 + i * 3.8}
              transform={`rotate(${i * 16} 50 50)`}
              fill="none"
              stroke={p[1]}
              opacity=".5"
              strokeWidth=".7"
            />
          ))}
        </>
      )}
      <text
        x="8"
        y="13"
        fill={p[1]}
        fontSize="4"
        letterSpacing="2"
        fontFamily="monospace"
      >
        NIGHTSHIFT
      </text>
      <text
        x="8"
        y="94"
        fill={p[1]}
        fontSize="4"
        letterSpacing="1"
        fontFamily="monospace"
      >
        VOL. 0{index + 1}
      </text>
    </svg>
  );
}
