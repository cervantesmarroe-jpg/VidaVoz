import { useState, useEffect } from "react";
import logoPath from "@assets/VidaVoz_1775644489589.png";

interface SplashProps {
  onDone: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Splash Screen de Entrada — logo PNG oficial, fondo blanco puro
// Aparece como primero que renderiza la app (fase "splash" en App.tsx).
// Desaparece con fade-out 500 ms a los 2500 ms, y llama a onDone a los 3000 ms.
// z-index: 10000 para cubrir todo.
// ─────────────────────────────────────────────────────────────────────────────
export default function Splash({ onDone }: SplashProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(false), 2500);
    const t2 = setTimeout(() => onDone(), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <div
      data-testid="splash-screen"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "#FFFFFF",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        opacity: visible ? 1 : 0,
        transition: "opacity 0.5s ease-out",
        pointerEvents: visible ? "all" : "none",
      }}
    >
      {/* Logo oficial VidaVoz — símbolo + texto "VidaVoz" */}
      <img
        src={logoPath}
        alt="VidaVoz"
        draggable={false}
        style={{
          width: "min(260px, 62vw)",
          height: "auto",
          objectFit: "contain",
          filter: "drop-shadow(0 6px 28px rgba(125,211,168,0.22))",
          userSelect: "none",
          WebkitUserSelect: "none" as const,
        }}
      />

      {/* Barra de progreso verde animada */}
      <div
        style={{
          marginTop: "32px",
          width: "min(200px, 48vw)",
          height: "3px",
          borderRadius: "999px",
          background: "#E5E7EB",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            borderRadius: "999px",
            background: "linear-gradient(90deg, #86efac, #4ade80)",
            animation: "splash-progress 2.2s ease-in-out forwards",
          }}
        />
      </div>
    </div>
  );
}
