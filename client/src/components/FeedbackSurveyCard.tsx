import { useEffect, useState } from "react";
import { useLocation } from "wouter";

// ── Aviso flotante de encuesta de validación (evaluador profesional) ────────
// Tarjeta no invasiva que invita al profesional que está probando la app a
// dejar su valoración. Aparece cuando lleva TIME_THRESHOLD_MS navegando O ha
// visitado al menos SCREENS_THRESHOLD pantallas distintas (lo que ocurra
// primero). "Seguir probando" solo la posterga SNOOZE_MS: vuelve a aparecer
// pasado ese tiempo, tantas veces como se pulse. Solo "Dar mi opinión
// profesional" la descarta para el resto de la sesión. No usa
// data-gaze-target, así que el cursor de mirada/parpadeo nunca puede
// "engancharse" ni hacer dwell sobre ella (mismo criterio que el botón
// informativo de modo pulsador en FullscreenLayout). data-scan-panel se
// mantiene por compatibilidad con el selector `[data-scan-panel="true"]` que
// usaba el extinto modo GUIADO de escaneo secuencial (ver 24bddda); hoy no
// tiene ningún consumidor activo, así que la exclusión real depende de no
// llevar data-gaze-target.

const FORM_URL = "https://forms.gle/8kHpcDxxGxxG5ywo8";
const TIME_THRESHOLD_MS = 10_000;
const SCREENS_THRESHOLD = 2;
const SNOOZE_MS = 7_000;

const START_KEY = "vozuci-survey-start-ts";
const SCREENS_KEY = "vozuci-survey-screens";
const DISMISSED_KEY = "vozuci-survey-dismissed-v1";
const SNOOZE_UNTIL_KEY = "vozuci-survey-snooze-until";

function getStartTs(): number {
  const stored = sessionStorage.getItem(START_KEY);
  if (stored) return Number(stored);
  const now = Date.now();
  sessionStorage.setItem(START_KEY, String(now));
  return now;
}

function recordScreen(path: string): number {
  let screens: string[] = [];
  try {
    screens = JSON.parse(sessionStorage.getItem(SCREENS_KEY) ?? "[]");
  } catch {
    screens = [];
  }
  if (!screens.includes(path)) {
    screens.push(path);
    sessionStorage.setItem(SCREENS_KEY, JSON.stringify(screens));
  }
  return screens.length;
}

const isDismissed = () => sessionStorage.getItem(DISMISSED_KEY) === "1";

export function FeedbackSurveyCard() {
  const [location] = useLocation();
  const [visible, setVisible] = useState(false);

  // FullscreenLayout se remonta en cada navegación (cada página lo envuelve
  // por su cuenta), así que el "ya se mostró / descartada / en snooze" vive
  // en sessionStorage (timestamps absolutos), no en estado local de React.
  useEffect(() => {
    if (isDismissed()) return;

    const snoozeUntil = Number(sessionStorage.getItem(SNOOZE_UNTIL_KEY) ?? "0");
    const now = Date.now();

    // Se pulsó "Seguir probando" y el snooze de SNOOZE_MS todavía no termina.
    if (snoozeUntil > now) {
      const timer = setTimeout(() => {
        if (!isDismissed()) setVisible(true);
      }, snoozeUntil - now);
      return () => clearTimeout(timer);
    }

    // Ya hubo al menos un snooze y ya expiró (incluso si fue en una
    // navegación anterior): reaparece sin volver a comprobar tiempo/pantallas.
    if (snoozeUntil > 0) {
      setVisible(true);
      return;
    }

    // Primera aparición de la sesión: condición original de tiempo/pantallas.
    const startTs = getStartTs();
    const screenCount = recordScreen(location);
    const elapsed = now - startTs;

    if (elapsed >= TIME_THRESHOLD_MS || screenCount >= SCREENS_THRESHOLD) {
      setVisible(true);
      return;
    }

    const timer = setTimeout(() => {
      if (!isDismissed()) setVisible(true);
    }, TIME_THRESHOLD_MS - elapsed);

    return () => clearTimeout(timer);
  }, [location]);

  if (!visible) return null;

  const dismissForever = () => {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  };

  const snooze = () => {
    sessionStorage.setItem(SNOOZE_UNTIL_KEY, String(Date.now() + SNOOZE_MS));
    setVisible(false);
  };

  const handleOpinionClick = () => {
    window.open(FORM_URL, "_blank", "noopener,noreferrer");
    dismissForever();
  };

  return (
    <div
      data-scan-panel="true"
      data-testid="card-feedback-survey"
      style={{
        position: "absolute",
        left: "50%",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)",
        transform: "translateX(-50%)",
        zIndex: 400,
        width: "min(92vw, 420px)",
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: 14,
        boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <span
        style={{
          fontFamily: "'Lexend',sans-serif",
          fontSize: ".85rem",
          fontWeight: 600,
          color: "#334155",
          lineHeight: 1.35,
        }}
      >
        ¿Has terminado tu prueba? Ayúdanos a validar VidaVoz en UCI con tu
        valoración (1 min).
      </span>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={handleOpinionClick}
          data-testid="button-survey-opinion"
          style={{
            flex: "1 1 auto",
            background: "#14B8A6",
            color: "#FFFFFF",
            fontFamily: "'Lexend',sans-serif",
            fontWeight: 700,
            fontSize: ".8rem",
            border: "none",
            borderRadius: 10,
            padding: "10px 14px",
            cursor: "pointer",
          }}
        >
          Dar mi opinión profesional
        </button>
        <button
          onClick={snooze}
          data-testid="button-survey-dismiss"
          style={{
            flex: "1 1 auto",
            background: "transparent",
            color: "#64748B",
            fontFamily: "'Lexend',sans-serif",
            fontWeight: 600,
            fontSize: ".8rem",
            border: "1px solid #CBD5E1",
            borderRadius: 10,
            padding: "10px 14px",
            cursor: "pointer",
          }}
        >
          Seguir probando
        </button>
      </div>
    </div>
  );
}
