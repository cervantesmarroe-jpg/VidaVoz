import { useEffect, useState } from "react";
import {
  CONFIRM_ACTIVATIONS,
  subscribePending,
  confirmPending,
  rejectPending,
} from "@/lib/irisWeightSync";

// ── Confirmación de cuidador tras cada activación por mirada (TEMPORAL) ─────
// Aviso discreto en la parte inferior: "¿Era este el botón correcto?". Solo
// "✓ Sí" guarda la activación en Supabase (ver irisWeightSync.confirmPending);
// "✗ No" o 5 s sin respuesta la descartan. Se activa/desactiva con
// CONFIRM_ACTIVATIONS en irisWeightSync.ts.
//
// Igual que FeedbackSurveyCard, NO usa data-gaze-target: el cursor de
// mirada/parpadeo no puede hacer dwell sobre estos botones, así que solo
// responde el cuidador por toque o ratón. data-scan-panel se añade por
// coherencia con el resto de paneles, pero hoy no tiene consumidor activo.

const btnStyle = {
  fontFamily: "'Lexend',sans-serif",
  fontWeight: 700,
  fontSize: ".75rem",
  borderRadius: 8,
  padding: "6px 12px",
  cursor: "pointer",
} as const;

export function ActivationConfirmPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => (CONFIRM_ACTIVATIONS ? subscribePending(setVisible) : undefined), []);

  if (!CONFIRM_ACTIVATIONS || !visible) return null;

  return (
    <div
      data-scan-panel="true"
      data-testid="prompt-activation-confirm"
      style={{
        position: "absolute",
        left: "50%",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)",
        transform: "translateX(-50%)",
        zIndex: 410,
        background: "rgba(255,255,255,0.95)",
        border: "1px solid #E2E8F0",
        borderRadius: 12,
        boxShadow: "0 6px 18px rgba(0,0,0,0.14)",
        padding: "8px 10px 8px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <span
        style={{
          fontFamily: "'Lexend',sans-serif",
          fontSize: ".78rem",
          fontWeight: 600,
          color: "#334155",
          whiteSpace: "nowrap",
        }}
      >
        ¿Era este el botón correcto?
      </span>
      <button
        onClick={confirmPending}
        data-testid="button-activation-confirm-yes"
        style={{ ...btnStyle, background: "#14B8A6", color: "#FFFFFF", border: "none" }}
      >
        ✓ Sí
      </button>
      <button
        onClick={rejectPending}
        data-testid="button-activation-confirm-no"
        style={{ ...btnStyle, background: "transparent", color: "#64748B", border: "1px solid #CBD5E1" }}
      >
        ✗ No
      </button>
    </div>
  );
}
