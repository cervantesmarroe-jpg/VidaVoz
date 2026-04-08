import { useCallback } from "react";
import { gazeTracker } from "@/hooks/use-webgazer";
import { GAZE_PROFILES, type ProfileId } from "@/config/gazeProfiles";

// ─── Icono Tablet SVG ──────────────────────────────────────────────────────────
function TabletIcon({ size = 56, color = "#4B5563" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <rect x="6" y="4" width="44" height="48" rx="5" stroke={color} strokeWidth="3.5" />
      <circle cx="28" cy="46" r="2.5" fill={color} />
      <rect x="14" y="10" width="28" height="30" rx="2" stroke={color} strokeWidth="2.5" />
    </svg>
  );
}

// ─── Icono Móvil SVG ───────────────────────────────────────────────────────────
function MobileIcon({ size = 48, color = "#4B5563" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 56" fill="none" aria-hidden="true">
      <rect x="5" y="3" width="38" height="50" rx="6" stroke={color} strokeWidth="3.5" />
      <circle cx="24" cy="48" r="2.5" fill={color} />
      <rect x="15" y="2" width="18" height="4" rx="2" fill={color} opacity="0.35" />
      <rect x="11" y="11" width="26" height="28" rx="2" stroke={color} strokeWidth="2.5" />
    </svg>
  );
}

// ─── ProfileSelect ─────────────────────────────────────────────────────────────
interface ProfileSelectProps {
  onDone: () => void;
}

export default function ProfileSelect({ onDone }: ProfileSelectProps) {
  // Solo guarda el perfil de sensibilidad y entra en la app.
  // La cámara NO se inicializa aquí — se activa cuando el usuario pulse "Activar Mirada".
  const handlePick = useCallback((id: ProfileId) => {
    gazeTracker.loadProfile(GAZE_PROFILES[id]);
    onDone();
  }, [onDone]);

  return (
    <div
      data-testid="profile-select-screen"
      style={{
        position: "fixed", inset: 0, zIndex: 9998,
        background: "#FAF6EE",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        fontFamily: "'Lexend', 'Inter', sans-serif",
        userSelect: "none",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .profile-card {
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
        }
        .profile-card:active {
          transform: scale(0.96) !important;
        }
        .profile-card:hover {
          border-color: #7DD3A8 !important;
          box-shadow: 0 4px 24px rgba(125,211,168,0.18) !important;
        }
      `}</style>

      <div style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: 36,
        animation: "fadeUp .4s ease both",
        padding: "0 24px", width: "100%", maxWidth: 520,
      }}>
        {/* Título */}
        <div style={{ textAlign: "center" }}>
          <p style={{
            fontSize: "clamp(1.1rem,3.5vw,1.5rem)",
            fontWeight: 700, color: "#333333", margin: 0,
            letterSpacing: "0.02em",
          }}>
            ¿Qué dispositivo estás usando?
          </p>
          <p style={{
            fontSize: "clamp(.78rem,2.3vw,.95rem)",
            color: "#888888", marginTop: 8, marginBottom: 0, lineHeight: 1.5,
          }}>
            Esto ajusta la sensibilidad de la mirada.
            <br />Puedes usar la app con el dedo sin activar la cámara.
          </p>
        </div>

        {/* Tarjetas */}
        <div style={{
          display: "flex", gap: 20,
          width: "100%", justifyContent: "center",
          flexWrap: "wrap",
        }}>
          {/* Tablet */}
          <button
            data-testid="button-profile-tablet"
            className="profile-card"
            onClick={() => handlePick("tablet")}
            style={{
              flex: "1 1 160px", maxWidth: 220,
              background: "#FFFFFF",
              border: "2.5px solid #E5E0D8",
              borderRadius: 20,
              padding: "28px 20px 24px",
              display: "flex", flexDirection: "column",
              alignItems: "center", gap: 14,
              cursor: "pointer",
              boxShadow: "0 2px 14px rgba(0,0,0,0.06)",
            }}
          >
            <TabletIcon color="#7DD3A8" size={60} />
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "1.05rem", fontWeight: 800, color: "#333333", margin: 0 }}>
                Modo Tablet
              </p>
              <p style={{ fontSize: ".75rem", color: "#AAAAAA", marginTop: 4, marginBottom: 0 }}>
                ~40 cm de distancia
              </p>
            </div>
          </button>

          {/* Móvil */}
          <button
            data-testid="button-profile-mobile"
            className="profile-card"
            onClick={() => handlePick("mobile")}
            style={{
              flex: "1 1 160px", maxWidth: 220,
              background: "#FFFFFF",
              border: "2.5px solid #E5E0D8",
              borderRadius: 20,
              padding: "28px 20px 24px",
              display: "flex", flexDirection: "column",
              alignItems: "center", gap: 14,
              cursor: "pointer",
              boxShadow: "0 2px 14px rgba(0,0,0,0.06)",
            }}
          >
            <MobileIcon color="#8BA7CC" size={52} />
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "1.05rem", fontWeight: 800, color: "#333333", margin: 0 }}>
                Modo Móvil
              </p>
              <p style={{ fontSize: ".75rem", color: "#AAAAAA", marginTop: 4, marginBottom: 0 }}>
                ~25 cm de distancia
              </p>
            </div>
          </button>
        </div>

        {/* Nota informativa */}
        <p style={{
          fontSize: ".72rem", color: "#BBBBBB",
          textAlign: "center", maxWidth: 300, lineHeight: 1.6, margin: 0,
        }}>
          La cámara solo se activa si pulsas <strong style={{ color: "#888" }}>Activar Mirada</strong> dentro de la app.
        </p>
      </div>
    </div>
  );
}
