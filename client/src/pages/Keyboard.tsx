import { useState, useEffect, useRef, useCallback } from "react";
import { FullscreenLayout } from "@/components/FullscreenLayout";
import { Volume2, Trash2, Delete, Space } from "lucide-react";

const KEY_DWELL_MS    = 2000;
const ACTION_DWELL_MS = 2000;

// Filas en landscape (3×9 — diseño original)
const ROWS_LANDSCAPE = [
  ["A","B","C","D","E","F","G","H","I"],
  ["J","K","L","M","N","O","P","Q","R"],
  ["S","T","U","V","W","X","Y","Z","Ñ"],
];

// Filas en portrait (4×7 — tipo teclado móvil)
const ROWS_PORTRAIT = [
  ["A","B","C","D","E","F","G"],
  ["H","I","J","K","L","M","N"],
  ["O","P","Q","R","S","T","U"],
  ["V","W","X","Y","Z","Ñ"],
];

// ─────────────────────────────────────────────────────────────────────────────
// Hook: detecta orientación landscape
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Hook de dwell con RAF
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Tecla de letra
// ─────────────────────────────────────────────────────────────────────────────
interface KeyBtnProps {
  label: string;
  isFocused: boolean;
  progress: number;
  wide?: boolean;
  icon?: React.ReactNode;
  fontSize?: string;
  onEnter: () => void;
  onLeave: () => void;
}

function KeyBtn({ label, isFocused, progress, wide = false, icon, fontSize = "clamp(.9rem,2.2vw,1.4rem)", onEnter, onLeave }: KeyBtnProps) {
  return (
    <div
      data-gaze-target="true"
      data-testid={`key-${label.toLowerCase()}`}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
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
        touchAction: "none",
        transition: "background .12s, border-color .12s",
        minWidth: 0,
        boxShadow: isFocused ? "0 0 10px rgba(245,158,11,0.25)" : "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      {icon ? (
        <span style={{ color: isFocused ? "#92400E" : "#555555", display: "flex" }}>
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
        }}>
          {label}
        </span>
      )}

      {isFocused && progress > 0 && (
        <div style={{
          position: "absolute",
          bottom: 0, left: 0,
          height: 4,
          width: `${progress * 100}%`,
          background: "#F59E0B",
          borderRadius: "0 2px 0 0",
          transition: "none",
        }} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Botón de acción (HABLAR / BORRAR TODO)
// ─────────────────────────────────────────────────────────────────────────────
interface ActionBtnProps {
  label: string;
  icon: React.ReactNode;
  bg: string;
  textColor: string;
  isFocused: boolean;
  progress: number;
  onEnter: () => void;
  onLeave: () => void;
  testId: string;
}

function ActionBtn({ label, icon, bg, textColor, isFocused, progress, onEnter, onLeave, testId }: ActionBtnProps) {
  return (
    <div
      data-gaze-target="true"
      data-testid={testId}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
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
        touchAction: "none",
        boxShadow: isFocused ? "0 0 18px rgba(251,191,36,0.45)" : "none",
        transition: "border-color .15s, box-shadow .15s",
      }}
    >
      <span style={{ color: textColor, display: "flex" }}>{icon}</span>
      <span style={{
        fontFamily: "'Lexend',sans-serif",
        fontWeight: 900,
        fontSize: "clamp(.75rem,2vw,1.1rem)",
        color: textColor,
        letterSpacing: ".05em",
        textTransform: "uppercase",
      }}>
        {label}
      </span>

      {isFocused && progress > 0 && (
        <div style={{
          position: "absolute",
          bottom: 0, left: 0,
          height: 5,
          width: `${progress * 100}%`,
          background: "#fbbf24",
          borderRadius: "0 3px 0 0",
          transition: "none",
        }} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function Keyboard() {
  const isLandscape = useIsLandscape();

  const rows         = isLandscape ? ROWS_LANDSCAPE : ROWS_PORTRAIT;
  const keyFontSize  = isLandscape
    ? "clamp(.9rem,2.2vw,1.4rem)"   // 9 cols — teclas más estrechas
    : "clamp(1.1rem,3.8vw,1.7rem)"; // 7 cols — teclas más anchas

  const [message, setMessage]       = useState("");
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [focusedAct, setFocusedAct] = useState<"speak" | "clear" | null>(null);
  const justActivatedRef = useRef<string | null>(null);

  const onKeyComplete = useCallback((key: string) => {
    justActivatedRef.current = key;
    setFocusedKey(null);
    if (key === "ESP") setMessage((m) => m + " ");
    else if (key === "⌫")  setMessage((m) => m.slice(0, -1));
    else                   setMessage((m) => m + key);
    setTimeout(() => { justActivatedRef.current = null; }, 600);
  }, []);

  const keyProgress = useDwellProgress(focusedKey, KEY_DWELL_MS, onKeyComplete);

  const onActionComplete = useCallback((act: string) => {
    setFocusedAct(null);
    if (act === "speak") {
      if (!message.trim()) return;
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(message);
      utt.lang = "es-ES";
      utt.rate = 0.9;
      window.speechSynthesis.speak(utt);
    } else if (act === "clear") {
      setMessage("");
    }
  }, [message]);

  const actionProgress = useDwellProgress(focusedAct, ACTION_DWELL_MS, onActionComplete);

  const handleKeyEnter = useCallback((key: string) => {
    if (justActivatedRef.current === key) return;
    setFocusedKey(key);
  }, []);

  const handleKeyLeave = useCallback((key: string) => {
    setFocusedKey((k) => (k === key ? null : k));
  }, []);

  return (
    <FullscreenLayout>
      <div style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "10px",
        gap: "8px",
        boxSizing: "border-box",
        background: "#FAFAFA",
      }}>

        {/* ── Visor de mensaje ────────────────────────────────────────────── */}
        <div style={{
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
        }}>
          <span style={{
            fontFamily: "'Lexend',sans-serif",
            fontWeight: 700,
            fontSize: isLandscape
              ? "clamp(1rem,3vw,1.8rem)"
              : "clamp(1.15rem,4.5vw,2rem)",
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
              width: 3,
              height: "1.2em",
              background: "#F59E0B",
              marginLeft: 4,
              verticalAlign: "middle",
              animation: "blink 1s step-end infinite",
            }} />
          )}
        </div>

        {/* ── Teclado ─────────────────────────────────────────────────────── */}
        <div style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          gap: isLandscape ? 5 : 7,
        }}>
          {rows.map((row, ri) => (
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
            />
            <KeyBtn
              label="⌫"
              fontSize={keyFontSize}
              icon={<Delete size={isLandscape ? 20 : 24} />}
              isFocused={focusedKey === "⌫"}
              progress={focusedKey === "⌫" ? keyProgress : 0}
              onEnter={() => handleKeyEnter("⌫")}
              onLeave={() => handleKeyLeave("⌫")}
            />
          </div>
        </div>

        {/* ── Botones de acción ──────────────────────────────────────────── */}
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
            onEnter={() => setFocusedAct("speak")}
            onLeave={() => setFocusedAct((a) => (a === "speak" ? null : a))}
            testId="button-speak"
          />
          <ActionBtn
            label="Borrar todo"
            icon={<Trash2 size={isLandscape ? 20 : 22} />}
            bg="#FEE2E2"
            textColor="#991B1B"
            isFocused={focusedAct === "clear"}
            progress={focusedAct === "clear" ? actionProgress : 0}
            onEnter={() => setFocusedAct("clear")}
            onLeave={() => setFocusedAct((a) => (a === "clear" ? null : a))}
            testId="button-clear"
          />
        </div>
      </div>

      <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
    </FullscreenLayout>
  );
}
