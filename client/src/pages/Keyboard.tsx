import { useState, useEffect, useRef, useCallback } from "react";
import { FullscreenLayout } from "@/components/FullscreenLayout";
import { SpeakColor as Volume2, ClearColor as Trash2, BackspaceColor as Delete, SpaceColor as Space } from "@/components/icons/ColorIcons";
import { useTTS } from "@/hooks/use-tts";
import { useScanning } from "@/context/ScanningContext";
import { setCursorVisible } from "@/lib/globalCursor";

// ── Constantes de dwell ───────────────────────────────────────────────────────
import { DWELL_MS } from "@/lib/dwell";
const KEY_DWELL_MS    = DWELL_MS;
const ACTION_DWELL_MS = DWELL_MS;

const QWERTY_ROWS = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L","Ñ"],
  ["Z","X","C","V","B","N","M"],
];

// ── Hook: orientación ─────────────────────────────────────────────────────────
function useIsLandscape() {
  const [landscape, setLandscape] = useState(
    () => typeof window !== "undefined" && window.innerWidth > window.innerHeight,
  );
  useEffect(() => {
    const update = () => setLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return landscape;
}

// ── Hook de dwell con RAF ─────────────────────────────────────────────────────
function useDwellProgress(
  activeKey: string | null,
  dwell: number,
  onComplete: (key: string) => void,
): number {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (!activeKey) { setProgress(0); return; }
    const start = Date.now();
    const tick = () => {
      const pct = Math.min(1, (Date.now() - start) / dwell);
      setProgress(pct);
      if (pct < 1) { rafRef.current = requestAnimationFrame(tick); }
      else { rafRef.current = null; onComplete(activeKey); }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, dwell]);

  return progress;
}

// ── Tecla de letra ────────────────────────────────────────────────────────────
interface KeyBtnProps {
  label:     string;
  isFocused: boolean;
  progress:  number;
  wide?:     boolean;
  icon?:     React.ReactNode;
  fontSize?: string;
  onEnter:   () => void;
  onLeave:   () => void;
  onClick:   () => void;
}

function KeyBtn({
  label, isFocused, progress, wide = false, icon,
  fontSize = "clamp(.9rem,2.2vw,1.4rem)",
  onEnter, onLeave, onClick,
}: KeyBtnProps) {
  return (
    <button
      className="gaze-target"
      data-gaze-target="true"
      data-testid={`key-${label.toLowerCase()}`}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      onClick={onClick}
      style={{
        flex: wide ? 2 : 1,
        position: "relative",
        borderRadius: 12,
        background: isFocused ? "#FEF9C3" : "#FFFFFF",
        border: isFocused ? "2px solid #F59E0B" : "1.5px solid #E0E0E0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "default",
        userSelect: "none",
        overflow: "hidden",
        touchAction: "manipulation",
        transition: "background .12s, border-color .12s",
        minWidth: 0,
        minHeight: 0,
        padding: 0,
        boxShadow: isFocused ? "0 0 10px rgba(245,158,11,0.25)" : "0 1px 3px rgba(0,0,0,0.06)",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {icon ? (
        <span style={{ color: isFocused ? "#92400E" : "#555555", display: "flex", pointerEvents: "none" }}>
          {icon}
        </span>
      ) : (
        <span style={{
          fontFamily: "'Lexend',sans-serif",
          fontWeight: 800,
          fontSize,
          color: isFocused ? "#92400E" : "#333333",
          lineHeight: 1,
          transition: "color .12s",
          pointerEvents: "none",
        }}>
          {label}
        </span>
      )}

      <div
        className="gaze-progress-bar"
        style={{
          position: "absolute",
          bottom: 0, left: 0,
          height: 4,
          width: isFocused && progress > 0 ? `${progress * 100}%` : "0%",
          background: "#F59E0B",
          borderRadius: "0 2px 0 0",
          transition: "none",
          pointerEvents: "none",
        }}
      />
    </button>
  );
}

// ── Botón de acción ───────────────────────────────────────────────────────────
interface ActionBtnProps {
  label:      string;
  icon:       React.ReactNode;
  bg:         string;
  textColor:  string;
  isFocused:  boolean;
  progress:   number;
  onEnter:    () => void;
  onLeave:    () => void;
  onClick:    () => void;
  testId:     string;
}

function ActionBtn({
  label, icon, bg, textColor,
  isFocused, progress,
  onEnter, onLeave, onClick, testId,
}: ActionBtnProps) {
  return (
    <button
      className="gaze-target"
      data-gaze-target="true"
      data-testid={testId}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      onClick={onClick}
      style={{
        flex: 1,
        position: "relative",
        borderRadius: 14,
        background: bg,
        border: isFocused ? "3px solid #fbbf24" : "1.5px solid #E0E0E0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        cursor: "default",
        userSelect: "none",
        overflow: "hidden",
        touchAction: "manipulation",
        minHeight: 0,
        padding: 0,
        boxShadow: isFocused ? "0 0 18px rgba(251,191,36,0.45)" : "none",
        transition: "border-color .15s, box-shadow .15s",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span style={{ color: textColor, display: "flex", pointerEvents: "none" }}>{icon}</span>
      <span style={{
        fontFamily: "'Lexend',sans-serif",
        fontWeight: 900,
        fontSize: "clamp(.75rem,2vw,1.1rem)",
        color: textColor,
        letterSpacing: ".05em",
        textTransform: "uppercase",
        pointerEvents: "none",
      }}>
        {label}
      </span>

      <div
        className="gaze-progress-bar"
        style={{
          position: "absolute",
          bottom: 0, left: 0,
          height: 5,
          width: isFocused && progress > 0 ? `${progress * 100}%` : "0%",
          background: "#fbbf24",
          borderRadius: "0 3px 0 0",
          transition: "none",
          pointerEvents: "none",
        }}
      />
    </button>
  );
}

// ── Tooltip para el cuidador ──────────────────────────────────────────────────
function ScanTooltip({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      // data-scan-panel excluye este div del manejador de toque del modo GUIADO,
      // así el cuidador puede tocar aquí sin activar la letra resaltada.
      data-scan-panel="true"
      onClick={onDismiss}
      style={{
        position: "absolute",
        top: 0, left: 0, right: 0,
        zIndex: 50,
        background: "rgba(15, 23, 42, 0.93)",
        color: "#FFFFFF",
        padding: "14px 18px 16px",
        borderRadius: "12px 12px 0 0",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        backdropFilter: "blur(6px)",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: "1.3rem", lineHeight: 1 }}>▶</span>
        <span style={{
          fontFamily: "'Lexend', sans-serif",
          fontWeight: 800,
          fontSize: ".65rem",
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: "#34D399",
        }}>
          MODO GUIADO ACTIVADO — para el cuidador
        </span>
      </div>

      <p style={{
        fontFamily: "'Lexend', sans-serif",
        fontWeight: 500,
        fontSize: "clamp(.88rem, 2.2vw, 1.05rem)",
        lineHeight: 1.55,
        margin: 0,
        color: "#E2E8F0",
      }}>
        El escaneo va resaltando cada letra. Pulsa en <strong style={{ color: "#FFFFFF" }}>cualquier parte de la pantalla</strong> o usa el <strong style={{ color: "#FFFFFF" }}>pulsador externo</strong> para seleccionar la letra resaltada.
      </p>

      <span style={{
        fontFamily: "'Lexend', sans-serif",
        fontSize: ".6rem",
        color: "#64748B",
        textAlign: "right",
        letterSpacing: ".04em",
      }}>
        Toca aquí para cerrar
      </span>
    </div>
  );
}

// ── PÁGINA PRINCIPAL ──────────────────────────────────────────────────────────
export default function Keyboard() {
  const isLandscape = useIsLandscape();
  const keyFontSize = isLandscape
    ? "clamp(.9rem,2vw,1.5rem)"
    : "clamp(.8rem,3vw,1.4rem)";

  const { speak } = useTTS();
  const { active: scanActive, enable: scanEnable, disable: scanDisable } = useScanning();

  const [message, setMessage]       = useState("");
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [focusedAct, setFocusedAct] = useState<"speak" | "clear" | null>(null);
  const [showTip, setShowTip]       = useState(false);

  const justActivatedRef = useRef<string | null>(null);
  // Estado de GUIADO antes de entrar al Teclado — para restaurar al salir.
  const prevScanRef = useRef<boolean>(scanActive);

  // ── Al montar: desactivar gaze, activar GUIADO, mostrar tooltip ─────────────
  useEffect(() => {
    // Capturar estado previo ANTES de habilitarlo nosotros.
    prevScanRef.current = scanActive;

    // 1. Ocultar cursor de eye-tracking y deshabilitar snap + dwell.
    setCursorVisible(false);
    (window as any).__gazeKeyboardMode = true;

    // 2. Activar GUIADO si no estaba ya activo.
    if (!scanActive) scanEnable();

    // 3. Mostrar tooltip de instrucciones al cuidador.
    setShowTip(true);

    return () => {
      // Restaurar cursor.
      setCursorVisible(true);
      (window as any).__gazeKeyboardMode = false;

      // Restaurar estado previo de GUIADO.
      if (!prevScanRef.current) scanDisable();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-cerrar tooltip tras 7 s.
  useEffect(() => {
    if (!showTip) return;
    const t = setTimeout(() => setShowTip(false), 7000);
    return () => clearTimeout(t);
  }, [showTip]);

  // ── Teclas ──────────────────────────────────────────────────────────────────
  const handleKeyPress = useCallback((key: string) => {
    if (key === "ESP") setMessage((m) => m + " ");
    else if (key === "⌫") setMessage((m) => m.slice(0, -1));
    else                  setMessage((m) => m + key);
  }, []);

  const onKeyComplete = useCallback((key: string) => {
    justActivatedRef.current = key;
    setFocusedKey(null);
    handleKeyPress(key);
    setTimeout(() => { justActivatedRef.current = null; }, 600);
  }, [handleKeyPress]);

  const keyProgress = useDwellProgress(focusedKey, KEY_DWELL_MS, onKeyComplete);

  const handleKeyClick = useCallback((key: string) => {
    if (justActivatedRef.current === key) return;
    handleKeyPress(key);
  }, [handleKeyPress]);

  // ── Acciones ─────────────────────────────────────────────────────────────────
  const onActionComplete = useCallback((act: string) => {
    setFocusedAct(null);
    if (act === "clear") setMessage("");
  }, []);

  const actionProgress = useDwellProgress(focusedAct, ACTION_DWELL_MS, onActionComplete);

  const handleActionClick = useCallback((act: "speak" | "clear") => {
    setFocusedAct(null);
    if (act === "speak") {
      if (!message.trim()) return;
      speak(message);
    } else if (act === "clear") {
      setMessage("");
    }
  }, [message, speak]);

  // ── Hover: en modo GUIADO no arrancamos el dwell visual manual ───────────────
  const handleKeyEnter = useCallback((key: string) => {
    if (scanActive) return;
    if (justActivatedRef.current === key) return;
    setFocusedKey(key);
  }, [scanActive]);

  const handleKeyLeave = useCallback((key: string) => {
    setFocusedKey((k) => (k === key ? null : k));
  }, []);

  return (
    <FullscreenLayout>
      <style>{`
        @keyframes blink { 50% { opacity: 0; } }
        button.gaze-target.gaze-hover {
          background: #FEF9C3 !important;
          border-color: #F59E0B !important;
          box-shadow: 0 0 12px rgba(245,158,11,0.3) !important;
        }
        button.gaze-target.gaze-hover span { color: #92400E !important; }
        button.gaze-target.blink-activated {
          background: #D1FAE5 !important;
          border-color: #34D399 !important;
        }
      `}</style>

      <div style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "10px",
        gap: "8px",
        boxSizing: "border-box",
        background: "#FAFAFA",
      }}>

        {/* Tooltip para el cuidador — aparece al entrar, se cierra en 7 s */}
        {showTip && <ScanTooltip onDismiss={() => setShowTip(false)} />}

        {/* Visor de mensaje */}
        <div
          data-testid="text-message-display"
          style={{
            flexShrink: 0,
            minHeight: isLandscape ? 64 : 88,
            maxHeight: isLandscape ? 88 : 120,
            background: "#FFFFFF",
            borderRadius: 14,
            border: "1.5px solid #E0E0E0",
            padding: "10px 18px",
            display: "flex",
            alignItems: "center",
            overflow: "hidden",
            boxSizing: "border-box",
            boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
          }}
        >
          <span style={{
            fontFamily: "'Lexend',sans-serif",
            fontWeight: 700,
            fontSize: isLandscape ? "clamp(1rem,3vw,1.8rem)" : "clamp(1.15rem,4.5vw,2rem)",
            color: message ? "#333333" : "#BBBBBB",
            letterSpacing: ".02em",
            wordBreak: "break-all",
            lineHeight: 1.3,
          }}>
            {message || "El mensaje aparecerá aquí…"}
          </span>
          {message && (
            <span style={{
              display: "inline-block",
              width: 3, height: "1.2em",
              background: "#F59E0B",
              marginLeft: 4,
              verticalAlign: "middle",
              animation: "blink 1s step-end infinite",
            }} />
          )}
        </div>

        {/* Teclado */}
        <div style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          gap: isLandscape ? 5 : 7,
        }}>
          {QWERTY_ROWS.map((row, ri) => (
            <div key={ri} style={{ flex: 1, display: "flex", gap: isLandscape ? 5 : 7, minHeight: 0 }}>
              {row.map((letter) => (
                <KeyBtn
                  key={letter}
                  label={letter}
                  fontSize={keyFontSize}
                  isFocused={focusedKey === letter}
                  progress={focusedKey === letter ? keyProgress : 0}
                  onEnter={() => handleKeyEnter(letter)}
                  onLeave={() => handleKeyLeave(letter)}
                  onClick={() => handleKeyClick(letter)}
                />
              ))}
            </div>
          ))}

          {/* Fila: Espacio + Borrar */}
          <div style={{ flex: 1, display: "flex", gap: isLandscape ? 5 : 7, minHeight: 0 }}>
            <KeyBtn
              label="ESP"
              wide
              fontSize={keyFontSize}
              icon={<Space size={isLandscape ? 20 : 24} />}
              isFocused={focusedKey === "ESP"}
              progress={focusedKey === "ESP" ? keyProgress : 0}
              onEnter={() => handleKeyEnter("ESP")}
              onLeave={() => handleKeyLeave("ESP")}
              onClick={() => handleKeyClick("ESP")}
            />
            <KeyBtn
              label="⌫"
              fontSize={keyFontSize}
              icon={<Delete size={isLandscape ? 20 : 24} />}
              isFocused={focusedKey === "⌫"}
              progress={focusedKey === "⌫" ? keyProgress : 0}
              onEnter={() => handleKeyEnter("⌫")}
              onLeave={() => handleKeyLeave("⌫")}
              onClick={() => handleKeyClick("⌫")}
            />
          </div>
        </div>

        {/* Botones de acción */}
        <div style={{
          flexShrink: 0,
          height: isLandscape ? 60 : 72,
          display: "flex",
          gap: 8,
        }}>
          <ActionBtn
            label="Reproducir mensaje"
            icon={<Volume2 size={isLandscape ? 20 : 24} />}
            bg="#DDF5E0"
            textColor="#1A5C2A"
            isFocused={focusedAct === "speak"}
            progress={focusedAct === "speak" ? actionProgress : 0}
            onEnter={() => { if (!scanActive) setFocusedAct("speak"); }}
            onLeave={() => setFocusedAct((a) => (a === "speak" ? null : a))}
            onClick={() => handleActionClick("speak")}
            testId="button-speak"
          />
          <ActionBtn
            label="Borrar todo"
            icon={<Trash2 size={isLandscape ? 20 : 22} />}
            bg="#FEE2E2"
            textColor="#991B1B"
            isFocused={focusedAct === "clear"}
            progress={focusedAct === "clear" ? actionProgress : 0}
            onEnter={() => { if (!scanActive) setFocusedAct("clear"); }}
            onLeave={() => setFocusedAct((a) => (a === "clear" ? null : a))}
            onClick={() => handleActionClick("clear")}
            testId="button-clear"
          />
        </div>
      </div>
    </FullscreenLayout>
  );
}
