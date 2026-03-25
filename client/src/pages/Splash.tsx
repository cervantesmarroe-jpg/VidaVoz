import { useState, useEffect } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// SVG logo — ojo de línea continua + ondas de voz
// ─────────────────────────────────────────────────────────────────────────────
function VidavozLogo() {
  const mint  = "#7DD3A8";
  const wave  = "#8BA7CC";
  const sw    = 4.5;

  // 16 barras con sus medias-alturas (crecen y decrecen hacia la derecha)
  const bars = [
    { x: 143, h: 6  },
    { x: 150, h: 9  },
    { x: 157, h: 13 },
    { x: 164, h: 17 },
    { x: 171, h: 21 },
    { x: 178, h: 24 },
    { x: 185, h: 26 },
    { x: 192, h: 24 },
    { x: 199, h: 21 },
    { x: 206, h: 17 },
    { x: 213, h: 13 },
    { x: 220, h: 10 },
    { x: 227, h: 7  },
    { x: 234, h: 5  },
    { x: 241, h: 3  },
  ];

  return (
    <svg
      viewBox="0 0 300 160"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "30vw", maxWidth: 200, minWidth: 130 }}
      aria-hidden="true"
    >
      {/* Contorno exterior del ojo */}
      <path
        d="M 22 80 C 75 14, 225 14, 278 80 C 225 146, 75 146, 22 80 Z"
        fill="none"
        stroke={mint}
        strokeWidth={sw}
        strokeLinejoin="round"
      />

      {/* Arco interior en C (abierto a la derecha, simula el iris) */}
      <path
        d="M 125 48 A 32 32 0 1 0 125 112"
        fill="none"
        stroke={mint}
        strokeWidth={sw}
        strokeLinecap="round"
      />

      {/* Pupila rellena */}
      <circle cx="124" cy="80" r="13" fill={mint} />

      {/* Ondas de voz — barras verticales animadas */}
      {bars.map(({ x, h }, i) => (
        <line
          key={x}
          x1={x} y1={80 - h}
          x2={x} y2={80 + h}
          stroke={wave}
          strokeWidth={3.8}
          strokeLinecap="round"
          className="wave-bar"
          style={{ animationDelay: `${i * 28}ms` }}
        />
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Splash Screen
// ─────────────────────────────────────────────────────────────────────────────
interface SplashProps {
  onDone: () => void;
}

export default function Splash({ onDone }: SplashProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Comienza fade-out a los 2 500 ms
    const t1 = setTimeout(() => setVisible(false), 2500);
    // Llama a onDone tras completar la transición (500 ms de fade)
    const t2 = setTimeout(() => onDone(), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <div
      data-testid="splash-screen"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#FDF2E2",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "20px",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.5s ease-out",
        pointerEvents: visible ? "all" : "none",
      }}
    >
      <VidavozLogo />

      <p
        style={{
          fontFamily: "'Lexend', 'Inter', sans-serif",
          fontWeight: 400,
          fontSize: "clamp(28px, 7vw, 38px)",
          color: "#333333",
          letterSpacing: "0.04em",
          margin: 0,
        }}
      >
        Vidavoz
      </p>
    </div>
  );
}
