import { useState, useEffect } from "react";
import logoPath from "@assets/VidaVoz_1775644489589.png";
import { gazeTracker } from "@/hooks/use-webgazer";

interface SplashProps {
  onDone: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Splash Screen de Entrada — logo PNG oficial, fondo blanco puro
// Aparece como primero que renderiza la app (fase "splash" en App.tsx).
// Desaparece con fade-out 500 ms a los 2500 ms, y llama a onDone a los 3000 ms.
// z-index: 10000 para cubrir todo.
//
// FASE 1 — Autoajuste silencioso del centro:
// Durante los 3 s de splash, si el tracker está activo (cámara y modelo listos
// de una sesión previa), se recogen muestras oculares mientras el paciente mira
// el logo centrado. Justo antes de onDone() se aplica la corrección de offset
// alpha. Si el tracker no está listo, no se hace nada — el splash es siempre
// transparente para el paciente y el perfil de fábrica queda intacto.
// ─────────────────────────────────────────────────────────────────────────────
export default function Splash({ onDone }: SplashProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // ── FASE 1: muestreo silencioso a 10 Hz durante el splash ─────────────────
    // collectSilentCenterSample devuelve false si no hay rostro detectado todavía
    // (cámara no iniciada, sin permiso, o aún calentando) — en ese caso simplemente
    // no se acumulan muestras y la corrección no se aplica.
    const sampler = setInterval(() => {
      gazeTracker.collectSilentCenterSample();
    }, 100);

    const t1 = setTimeout(() => setVisible(false), 2500);
    const t2 = setTimeout(() => {
      // Aplica la corrección de centro antes de avanzar. No-op si no hay
      // suficientes muestras (fresh load sin tracker activo).
      gazeTracker.applySilentCenterCalibration();
      onDone();
    }, 3000);

    return () => {
      clearInterval(sampler);
      clearTimeout(t1);
      clearTimeout(t2);
    };
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
      {/* Logo oficial VidaVoz — tamaño adaptativo basado en vmin (la dimensión
          menor del viewport) para que se vea bien en móvil portrait, móvil
          landscape, tablet portrait y tablet landscape sin desbordar. */}
      <img
        src={logoPath}
        alt="VidaVoz"
        draggable={false}
        style={{
          width: "clamp(160px, 48vmin, 520px)",
          maxWidth: "82vw",
          maxHeight: "62vh",
          height: "auto",
          objectFit: "contain",
          filter: "drop-shadow(0 6px 28px rgba(125,211,168,0.22))",
          userSelect: "none",
          WebkitUserSelect: "none" as const,
        }}
      />

      {/* Barra de progreso verde animada — ancho proporcional al logo */}
      <div
        style={{
          marginTop: "clamp(20px, 4vmin, 44px)",
          width: "clamp(140px, 36vmin, 360px)",
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
