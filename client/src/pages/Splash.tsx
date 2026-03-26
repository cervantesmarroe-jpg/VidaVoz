import { useState, useEffect } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// SVG logo — ojo de línea continua + ondas de voz
// ─────────────────────────────────────────────────────────────────────────────
function VidavozLogo() {
  const mint  = "#7DD3A8";
  const wave  = "#8BA7CC";
  const sw    = 4.5;

  // 18 barras con patrón de onda de voz real: picos y valles irregulares,
  // rango dinámico amplio (2–30 u) para simular la envolvente del habla.
  const bars = [
    { x: 138, h: 4  },   // arranque suave
    { x: 145, h: 14 },   // subida rápida
    { x: 152, h: 7  },   // valle
    { x: 159, h: 22 },   // primer pico
    { x: 166, h: 30 },   // pico dominante
    { x: 173, h: 11 },   // caída
    { x: 180, h: 27 },   // segundo pico alto
    { x: 187, h: 16 },   // descenso parcial
    { x: 194, h: 29 },   // tercer pico
    { x: 201, h: 8  },   // valle profundo
    { x: 208, h: 23 },   // recuperación
    { x: 215, h: 6  },   // valle
    { x: 222, h: 18 },   // cuarto pico menor
    { x: 229, h: 10 },   // descenso
    { x: 236, h: 13 },   // pequeña cresta final
    { x: 243, h: 5  },   // decaimiento
    { x: 250, h: 3  },   // cola
    { x: 257, h: 1  },   // cierre
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
          strokeWidth={4.2}
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
        background: "#FFFFFF",
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
