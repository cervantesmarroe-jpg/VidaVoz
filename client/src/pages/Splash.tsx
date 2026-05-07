import { useState, useEffect } from "react";
import logoPath from "@assets/VidaVoz_transparent.png";
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
        // Cubre todo el viewport real del dispositivo (incluida la zona del
        // navegador móvil que entra/sale al hacer scroll).
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100dvh",
        zIndex: 10000,

        // Crema unificado con el resto de la app — ya no hay rectángulo ni
        // bordes, el logo (PNG transparente) se apoya directamente sobre el
        // fondo de la app.
        background: "#FFF8E7",

        // Centrado perfecto vertical y horizontal vía Flexbox.
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",

        // Sin scrollbars durante la transición de carga.
        overflow: "hidden",

        // Fade-out 500 ms al salir.
        opacity: visible ? 1 : 0,
        transition: "opacity 0.5s ease-out",
        pointerEvents: visible ? "all" : "none",
      }}
    >
      {/* Logo oficial VidaVoz — PNG transparente. Tamaño adaptativo basado en
          vmin (la dimensión menor del viewport) para verse proporcionado tanto
          en una tablet de 10" anclada al brazo de la cama como en un móvil. */}
      <img
        src={logoPath}
        alt="VidaVoz"
        draggable={false}
        style={{
          width: "clamp(180px, 55vmin, 560px)",
          maxWidth: "84vw",
          maxHeight: "62vh",
          height: "auto",
          objectFit: "contain",
          userSelect: "none",
          WebkitUserSelect: "none" as const,
          // Funde las zonas blancas del PNG con el fondo beige (#FFF8E7).
          // multiply: blanco × fondo = fondo, así desaparecen los parches
          // blancos tras las ondas de voz; los demás colores se conservan.
          mixBlendMode: "multiply",
        }}
      />

      {/* Barra de progreso verde animada — ancho proporcional al logo */}
      <div
        style={{
          marginTop: "clamp(20px, 4vmin, 44px)",
          width: "clamp(140px, 36vmin, 360px)",
          height: "3px",
          borderRadius: "999px",
          background: "rgba(20, 83, 45, 0.12)",   // verde tenue sobre crema
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
