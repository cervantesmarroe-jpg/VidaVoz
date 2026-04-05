import { useState, useEffect, useRef, useCallback } from "react";
import { gazeTracker, useWebGazerStore } from "@/hooks/use-webgazer";
import { GAZE_PROFILES, type ProfileId, type GazeProfile } from "@/config/gazeProfiles";

// ─── Constantes del QuickSync ─────────────────────────────────────────────────
const DWELL_MS      = 3000;
const COLLECT_MS    = 50;
const WARMUP_MS     = 400;
const SUCCESS_MS    = 1300;

const R_RING    = 68;
const CIRCUMF   = 2 * Math.PI * R_RING;

// ─── Icono Tablet SVG ─────────────────────────────────────────────────────────
function TabletIcon({ size = 56, color = "#4B5563" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <rect x="6" y="4" width="44" height="48" rx="5" stroke={color} strokeWidth="3.5" />
      <circle cx="28" cy="46" r="2.5" fill={color} />
      <rect x="14" y="10" width="28" height="30" rx="2" stroke={color} strokeWidth="2.5" />
    </svg>
  );
}

// ─── Icono Móvil SVG ──────────────────────────────────────────────────────────
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


// ─── Anillo SVG de progreso (QuickSync) ───────────────────────────────────────
function SyncRing({ progress }: { progress: number }) {
  const offset = CIRCUMF * (1 - Math.min(progress, 1));
  const sz     = (R_RING + 14) * 2;
  return (
    <svg
      width={sz} height={sz}
      style={{
        position: "absolute",
        top: "50%", left: "50%",
        transform: "translate(-50%,-50%) rotate(-90deg)",
        pointerEvents: "none",
      }}
    >
      <circle cx={sz / 2} cy={sz / 2} r={R_RING}
        fill="none" stroke="rgba(125,211,168,0.2)" strokeWidth={8} />
      <circle cx={sz / 2} cy={sz / 2} r={R_RING}
        fill="none" stroke="#7DD3A8" strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={CIRCUMF}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.06s linear" }}
      />
    </svg>
  );
}

// ─── ProfileSelect ────────────────────────────────────────────────────────────
interface ProfileSelectProps {
  onDone: () => void;
}

type Phase = "pick" | "loading" | "sync" | "success";

export default function ProfileSelect({ onDone }: ProfileSelectProps) {
  const [phase, setPhase]         = useState<Phase>("pick");
  const [profile, setProfile]     = useState<GazeProfile | null>(null);
  const [progress, setProgress]   = useState(0);
  const [samples, setSamples]     = useState(0);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const ivs    = useRef<ReturnType<typeof setInterval>[]>([]);

  const clearAll = useCallback(() => {
    timers.current.forEach(clearTimeout);
    ivs.current.forEach(clearInterval);
    timers.current = [];
    ivs.current    = [];
  }, []);

  // ── Selección de perfil → iniciar cámara ──────────────────────────────────
  const handlePick = useCallback(async (id: ProfileId) => {
    const chosen = GAZE_PROFILES[id];
    setProfile(chosen);
    setPhase("loading");

    gazeTracker.loadProfile(chosen);
    gazeTracker.clearCalibration();

    if (!gazeTracker.hasFaceModel) await gazeTracker.init();
    await gazeTracker.startCamera();
    gazeTracker.startDetection();

    setPhase("sync");
  }, []);

  // ── Fase sync: recoger 3 s de muestras en el centro ──────────────────────
  useEffect(() => {
    if (phase !== "sync") return;
    setProgress(0);
    setSamples(0);

    const cx = window.innerWidth  / 2;
    const cy = window.innerHeight / 2;
    const t0 = Date.now();
    let collecting = false;

    const warmup = setTimeout(() => { collecting = true; }, WARMUP_MS);
    timers.current.push(warmup);

    const collector = setInterval(() => {
      if (!collecting) return;
      const ok = gazeTracker.recordCalibrationPoint(cx, cy);
      if (ok) setSamples(s => s + 1);
    }, COLLECT_MS);
    ivs.current.push(collector);

    const progressIv = setInterval(() => {
      setProgress(Math.min((Date.now() - t0) / DWELL_MS, 1));
    }, 40);
    ivs.current.push(progressIv);

    const done = setTimeout(() => {
      clearAll();
      const ok = gazeTracker.quickCenterCalibrate();
      if (ok) {
        setPhase("success");
      } else {
        setPhase("sync");
      }
    }, DWELL_MS);
    timers.current.push(done);

    return clearAll;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Fase success → marcar sync completo y pasar a la app ─────────────────
  useEffect(() => {
    if (phase !== "success") return;
    const t = setTimeout(() => {
      useWebGazerStore.getState().setSyncCompleted();
      gazeTracker.stopCamera();
      onDone();
    }, SUCCESS_MS);
    return () => clearTimeout(t);
  }, [phase, onDone]);

  // ── Render ────────────────────────────────────────────────────────────────
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
        @keyframes heartbeat-ps {
          0%,100% { transform: scale(1); }
          14%      { transform: scale(1.2); }
          28%      { transform: scale(1); }
          42%      { transform: scale(1.12); }
          70%      { transform: scale(1); }
        }
        @keyframes popInPS {
          0%   { transform: scale(0.4); opacity: 0; }
          70%  { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .profile-card {
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .profile-card:active {
          transform: scale(0.96) !important;
        }
      `}</style>

      {/* ── PICK: elegir modo ─────────────────────────────────────────────── */}
      {phase === "pick" && (
        <div style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 40,
          animation: "fadeUp .45s ease both",
          padding: "0 24px", width: "100%", maxWidth: 520,
        }}>
          {/* Título */}
          <div style={{ textAlign: "center" }}>
            <p style={{
              fontSize: "clamp(1.1rem,3.5vw,1.5rem)",
              fontWeight: 700,
              color: "#333333",
              margin: 0,
              letterSpacing: "0.02em",
            }}>
              ¿Qué dispositivo estás usando?
            </p>
            <p style={{
              fontSize: "clamp(.8rem,2.5vw,1rem)",
              color: "#888888",
              marginTop: 8, marginBottom: 0,
            }}>
              Elige el perfil para calibrar la mirada
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
                flex: "1 1 180px", maxWidth: 230,
                background: "#FFFFFF",
                border: "2.5px solid #E5E0D8",
                borderRadius: 20,
                padding: "32px 20px 28px",
                display: "flex", flexDirection: "column",
                alignItems: "center", gap: 16,
                cursor: "pointer",
                boxShadow: "0 2px 18px rgba(0,0,0,0.07)",
              }}
            >
              <TabletIcon color="#7DD3A8" size={64} />
              <div style={{ textAlign: "center" }}>
                <p style={{
                  fontSize: "1.1rem", fontWeight: 800,
                  color: "#333333", margin: 0,
                }}>
                  Modo Tablet
                </p>
                <p style={{
                  fontSize: ".78rem", color: "#AAAAAA",
                  marginTop: 4, marginBottom: 0,
                }}>
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
                flex: "1 1 180px", maxWidth: 230,
                background: "#FFFFFF",
                border: "2.5px solid #E5E0D8",
                borderRadius: 20,
                padding: "32px 20px 28px",
                display: "flex", flexDirection: "column",
                alignItems: "center", gap: 16,
                cursor: "pointer",
                boxShadow: "0 2px 18px rgba(0,0,0,0.07)",
              }}
            >
              <MobileIcon color="#8BA7CC" size={56} />
              <div style={{ textAlign: "center" }}>
                <p style={{
                  fontSize: "1.1rem", fontWeight: 800,
                  color: "#333333", margin: 0,
                }}>
                  Modo Móvil
                </p>
                <p style={{
                  fontSize: ".78rem", color: "#AAAAAA",
                  marginTop: 4, marginBottom: 0,
                }}>
                  ~25 cm de distancia
                </p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ── LOADING: iniciando cámara ─────────────────────────────────────── */}
      {phase === "loading" && (
        <div style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 20,
          animation: "fadeUp .3s ease both",
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            border: "4px solid rgba(125,211,168,0.2)",
            borderTop: "4px solid #7DD3A8",
            animation: "spin 0.9s linear infinite",
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ fontSize: ".95rem", color: "#888888", margin: 0 }}>
            Iniciando cámara…
          </p>
          {profile && (
            <p style={{ fontSize: ".8rem", color: "#BBBBBB", margin: 0 }}>
              Perfil: <strong style={{ color: "#7DD3A8" }}>{profile.label}</strong>
            </p>
          )}
        </div>
      )}

      {/* ── SYNC: círculo verde en el centro ─────────────────────────────── */}
      {phase === "sync" && (
        <>
          <p style={{
            position: "absolute", top: "16%",
            left: 0, right: 0, textAlign: "center",
            fontSize: "clamp(1rem,3.5vw,1.3rem)",
            fontWeight: 600, color: "#555555",
            animation: "fadeUp .4s ease both",
          }}>
            Sincronización Rápida
          </p>
          <p style={{
            position: "absolute", top: "calc(16% + 2.6rem)",
            left: 0, right: 0, textAlign: "center",
            fontSize: "clamp(.8rem,2.5vw,.95rem)",
            color: "#AAAAAA",
            animation: "fadeUp .5s ease .08s both",
          }}>
            Mira el círculo verde sin mover la cabeza
          </p>
          {profile && (
            <p style={{
              position: "absolute", top: "calc(16% + 5rem)",
              left: 0, right: 0, textAlign: "center",
              fontSize: ".78rem", color: "#7DD3A8",
              fontWeight: 600, letterSpacing: ".06em",
            }}>
              {profile.label} · {profile.distanceCm} cm
            </p>
          )}
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <SyncRing progress={progress} />
            <div style={{
              position: "absolute",
              width: 120, height: 120, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(125,211,168,0.12) 0%, transparent 70%)",
            }} />
            <div style={{
              width: 58, height: 58, borderRadius: "50%",
              background: "radial-gradient(circle at 38% 38%, #a8e8c8 0%, #7DD3A8 55%, #4db88a 100%)",
              boxShadow: "0 0 36px rgba(125,211,168,0.5), 0 0 8px rgba(125,211,168,0.3)",
              animation: "heartbeat-ps 1.1s ease-in-out infinite",
              position: "relative", zIndex: 2,
            }} />
          </div>
          {samples > 0 && (
            <p style={{
              position: "absolute", bottom: "20%",
              fontSize: ".68rem", color: "rgba(125,211,168,0.4)",
              letterSpacing: ".08em",
            }}>
              {samples} muestras
            </p>
          )}
        </>
      )}

      {/* ── SUCCESS ───────────────────────────────────────────────────────── */}
      {phase === "success" && (
        <div style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 20,
          animation: "popInPS .45s cubic-bezier(.34,1.56,.64,1) both",
        }}>
          <div style={{
            width: 88, height: 88, borderRadius: "50%",
            background: "radial-gradient(circle at 38% 38%, #a8e8c8 0%, #7DD3A8 60%, #4db88a 100%)",
            boxShadow: "0 0 40px rgba(125,211,168,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width={42} height={42} viewBox="0 0 42 42" fill="none">
              <polyline points="8,22 17,31 34,12"
                stroke="#fff" strokeWidth={4}
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p style={{
            fontSize: "clamp(1.1rem,3vw,1.45rem)",
            fontWeight: 800, color: "#333333",
            margin: 0,
          }}>
            ¡Listo!
          </p>
          <p style={{ fontSize: ".85rem", color: "#AAAAAA", margin: 0 }}>
            Abriendo Vidavoz…
          </p>
        </div>
      )}
    </div>
  );
}
