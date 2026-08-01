import { useState, useEffect, useRef, useCallback } from "react";
import { FullscreenLayout } from "@/components/FullscreenLayout";
import { SpeakColor as Volume2, ClearColor as Trash2, BackspaceColor as Delete, SpaceColor as Space } from "@/components/icons/ColorIcons";
import { Lock, ArrowLeftRight, ArrowLeft } from "lucide-react";
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

// ── Modo GRUPOS: rangos de letras para escaneo secuencial ────────────────────
// Nota: el grupo "O-T" incluye la O (si no, se quedaría sin grupo — el resto
// de rangos ya reparten las 27 letras del alfabeto español sin huecos).
type LetterGroup = { id: string; label: string; letters: string[] };
const LETTER_GROUPS: LetterGroup[] = [
  { id: "g1", label: "A-E", letters: ["A","B","C","D","E"] },
  { id: "g2", label: "F-J", letters: ["F","G","H","I","J"] },
  { id: "g3", label: "K-Ñ", letters: ["K","L","M","N","Ñ"] },
  { id: "g4", label: "O-T", letters: ["O","P","Q","R","S","T"] },
  { id: "g5", label: "U-Z", letters: ["U","V","W","X","Y","Z"] },
];

type KeyboardMode = "grupos" | "qwerty";

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

// ── Tecla de letra (modo QWERTY) ──────────────────────────────────────────────
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

// ── Ficha grande (modo GRUPOS): grupo, letra o "volver" ──────────────────────
interface BigTileProps {
  label:      string;
  icon?:      React.ReactNode;
  isFocused:  boolean;
  progress:   number;
  fontSize?:  string;
  bg?:        string;
  border?:    string;
  textColor?: string;
  onEnter:    () => void;
  onLeave:    () => void;
  onClick:    () => void;
  testId:     string;
}

function BigTile({
  label, icon, isFocused, progress,
  fontSize = "clamp(1.4rem,5vw,2.6rem)",
  bg = "#FFFFFF", border = "#E0E0E0", textColor = "#333333",
  onEnter, onLeave, onClick, testId,
}: BigTileProps) {
  return (
    <button
      className="gaze-target"
      data-gaze-target="true"
      data-testid={testId}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      onClick={onClick}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        borderRadius: 16,
        background: isFocused ? "#FEF9C3" : bg,
        border: isFocused ? "3px solid #F59E0B" : `2px solid ${border}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        cursor: "default",
        userSelect: "none",
        overflow: "hidden",
        touchAction: "manipulation",
        transition: "background .12s, border-color .12s",
        minWidth: 0,
        minHeight: 0,
        padding: 8,
        boxSizing: "border-box",
        boxShadow: isFocused ? "0 0 14px rgba(245,158,11,0.3)" : "0 1px 3px rgba(0,0,0,0.06)",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {icon && (
        <span style={{ color: isFocused ? "#92400E" : textColor, display: "flex", pointerEvents: "none" }}>
          {icon}
        </span>
      )}
      <span style={{
        fontFamily: "'Lexend',sans-serif",
        fontWeight: 800,
        fontSize,
        color: isFocused ? "#92400E" : textColor,
        lineHeight: 1.1,
        textAlign: "center",
        transition: "color .12s",
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
          background: "#F59E0B",
          borderRadius: "0 3px 0 0",
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

// ── Selector de modo (control del cuidador — visible, no accesible al escaneo) ─
// Sin data-gaze-target: el cursor de mirada y el escaneo GUIADO jamás lo ven,
// así el paciente no puede alcanzarlo ni por mirada ni por pulsador externo.
// Con data-scan-panel="true": el toque físico del cuidador no se confunde con
// una confirmación de escaneo (ver el capturador de pointerdown en
// FullscreenLayout). El estilo (candado + "CONTROL DEL CUIDADOR") lo marca
// visualmente como un control ajeno a las teclas del paciente.
function ModeToggleBar({ mode, onToggle }: { mode: KeyboardMode; onToggle: () => void }) {
  return (
    <button
      data-scan-panel="true"
      data-testid="button-mode-toggle"
      onClick={onToggle}
      aria-label={mode === "grupos" ? "Cambiar a teclado QWERTY (control del cuidador)" : "Cambiar a teclado por grupos (control del cuidador)"}
      style={{
        flexShrink: 0,
        width: "100%",
        height: 44,
        borderRadius: 10,
        background: "#F1F5F9",
        border: "1.5px dashed #94A3B8",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: "0 14px",
        boxSizing: "border-box",
        cursor: "pointer",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <Lock size={14} color="#64748B" style={{ flexShrink: 0 }} />
        <span style={{
          fontFamily: "'Lexend',sans-serif",
          fontWeight: 700,
          fontSize: ".62rem",
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "#64748B",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          Control del cuidador
        </span>
      </span>

      <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{
          fontFamily: "'Lexend',sans-serif",
          fontWeight: 900,
          fontSize: "clamp(.8rem,2.4vw,1rem)",
          letterSpacing: ".03em",
          color: "#334155",
          whiteSpace: "nowrap",
        }}>
          {mode === "grupos" ? "MODO GRUPOS" : "MODO QWERTY"}
        </span>
        <ArrowLeftRight size={18} color="#475569" style={{ flexShrink: 0 }} />
      </span>
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

  const [mode, setMode]             = useState<KeyboardMode>("grupos");
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [message, setMessage]       = useState("");
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [focusedTile, setFocusedTile] = useState<string | null>(null);
  const [focusedAct, setFocusedAct] = useState<"speak" | "clear" | "space" | null>(null);
  const [showTip, setShowTip]       = useState(false);

  const justActivatedRef     = useRef<string | null>(null);
  const justActivatedTileRef = useRef<string | null>(null);
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

  // Reinicia el escaneo cada vez que cambia la vista (QWERTY ↔ GRUPOS, o
  // grupo raíz ↔ letras de un grupo) para que siempre empiece por la
  // primera ficha visible, en lugar de conservar un índice que ya no
  // corresponde al nuevo conjunto de fichas en pantalla.
  useEffect(() => {
    if (!scanActive) return;
    scanEnable();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, activeGroup]);

  // ── Teclas (modo QWERTY y acciones compartidas) ──────────────────────────────
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

  const handleKeyEnter = useCallback((key: string) => {
    if (scanActive) return;
    if (justActivatedRef.current === key) return;
    setFocusedKey(key);
  }, [scanActive]);

  const handleKeyLeave = useCallback((key: string) => {
    setFocusedKey((k) => (k === key ? null : k));
  }, []);

  // ── Fichas grandes (modo GRUPOS): grupo, letra o volver ──────────────────────
  const activateTile = useCallback((id: string) => {
    if (id === "backspace-top") { handleKeyPress("⌫"); return; }
    if (id === "back") { setActiveGroup(null); return; }
    if (id.startsWith("letter:")) { handleKeyPress(id.slice(7)); setActiveGroup(null); return; }
    setActiveGroup(id);
  }, [handleKeyPress]);

  const onTileComplete = useCallback((id: string) => {
    justActivatedTileRef.current = id;
    setFocusedTile(null);
    activateTile(id);
    setTimeout(() => { justActivatedTileRef.current = null; }, 600);
  }, [activateTile]);

  const tileProgress = useDwellProgress(focusedTile, KEY_DWELL_MS, onTileComplete);

  const handleTileClick = useCallback((id: string) => {
    if (justActivatedTileRef.current === id) return;
    activateTile(id);
  }, [activateTile]);

  const handleTileEnter = useCallback((id: string) => {
    if (scanActive) return;
    if (justActivatedTileRef.current === id) return;
    setFocusedTile(id);
  }, [scanActive]);

  const handleTileLeave = useCallback((id: string) => {
    setFocusedTile((t) => (t === id ? null : t));
  }, []);

  // ── Acciones ─────────────────────────────────────────────────────────────────
  const onActionComplete = useCallback((act: string) => {
    setFocusedAct(null);
    if (act === "clear") setMessage("");
    else if (act === "space") setMessage((m) => m + " ");
  }, []);

  const actionProgress = useDwellProgress(focusedAct, ACTION_DWELL_MS, onActionComplete);

  const handleActionClick = useCallback((act: "speak" | "clear" | "space") => {
    setFocusedAct(null);
    if (act === "speak") {
      if (!message.trim()) return;
      speak(message);
    } else if (act === "clear") {
      setMessage("");
    } else if (act === "space") {
      setMessage((m) => m + " ");
    }
  }, [message, speak]);

  // ── Cambio de modo (solo cuidador) ────────────────────────────────────────────
  const handleModeToggle = useCallback(() => {
    setMode((m) => (m === "grupos" ? "qwerty" : "grupos"));
    setActiveGroup(null);
    setFocusedKey(null);
    setFocusedTile(null);
  }, []);

  const currentGroup = activeGroup ? LETTER_GROUPS.find((g) => g.id === activeGroup) ?? null : null;

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

        {/* Selector de modo — control visible del cuidador, fuera del alcance del escaneo */}
        <ModeToggleBar mode={mode} onToggle={handleModeToggle} />

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

        {mode === "qwerty" ? (
          <>
            {/* Teclado QWERTY */}
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
            <div style={{ flexShrink: 0, height: isLandscape ? 60 : 72, display: "flex", gap: 8 }}>
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
          </>
        ) : (
          <>
            {/* Teclado por GRUPOS */}
            {currentGroup ? (
              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{
                  fontFamily: "'Lexend',sans-serif",
                  fontWeight: 700,
                  fontSize: ".7rem",
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  color: "#999999",
                  textAlign: "center",
                }}>
                  Grupo {currentGroup.label}
                </span>
                {(() => {
                  const cells: { id: string; label: string; icon?: React.ReactNode; bg?: string; border?: string; textColor?: string; fontSize?: string }[] = [
                    ...currentGroup.letters.map((letter) => ({
                      id: `letter:${letter}`,
                      label: letter,
                      fontSize: "clamp(2.2rem,9vw,4.5rem)",
                    })),
                    {
                      id: "back",
                      label: "VOLVER",
                      icon: <ArrowLeft size={isLandscape ? 22 : 26} />,
                      bg: "#E0E7FF",
                      border: "#C7D2FE",
                      textColor: "#3730A3",
                      fontSize: "clamp(.85rem,3vw,1.15rem)",
                    },
                  ];
                  const cols = isLandscape ? 4 : 3;
                  const rows = Math.ceil(cells.length / cols);
                  return (
                    <div style={{
                      flex: 1,
                      minHeight: 0,
                      display: "grid",
                      gridTemplateColumns: `repeat(${cols}, 1fr)`,
                      gridTemplateRows: `repeat(${rows}, 1fr)`,
                      gap: isLandscape ? 8 : 10,
                    }}>
                      {cells.map((cell) => (
                        <BigTile
                          key={cell.id}
                          label={cell.label}
                          icon={cell.icon}
                          bg={cell.bg}
                          border={cell.border}
                          textColor={cell.textColor}
                          fontSize={cell.fontSize}
                          isFocused={focusedTile === cell.id}
                          progress={focusedTile === cell.id ? tileProgress : 0}
                          onEnter={() => handleTileEnter(cell.id)}
                          onLeave={() => handleTileLeave(cell.id)}
                          onClick={() => handleTileClick(cell.id)}
                          testId={`tile-${cell.id.replace(":", "-").toLowerCase()}`}
                        />
                      ))}
                    </div>
                  );
                })()}
              </div>
            ) : (
              (() => {
                const cells = [
                  ...LETTER_GROUPS.map((g) => ({
                    id: g.id,
                    label: g.label,
                    fontSize: "clamp(1.3rem,5vw,2.4rem)" as string,
                    icon: undefined as React.ReactNode,
                    bg: undefined as string | undefined,
                    border: undefined as string | undefined,
                    textColor: undefined as string | undefined,
                  })),
                  {
                    id: "backspace-top",
                    label: "BORRAR",
                    fontSize: "clamp(.85rem,3vw,1.15rem)",
                    icon: <Delete size={isLandscape ? 24 : 28} /> as React.ReactNode,
                    bg: "#FEE2E2",
                    border: "#FCA5A5",
                    textColor: "#991B1B",
                  },
                ];
                const cols = isLandscape ? 3 : 2;
                const rows = Math.ceil(cells.length / cols);
                return (
                  <div style={{
                    flex: 1,
                    minHeight: 0,
                    display: "grid",
                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                    gridTemplateRows: `repeat(${rows}, 1fr)`,
                    gap: isLandscape ? 8 : 10,
                  }}>
                    {cells.map((cell) => (
                      <BigTile
                        key={cell.id}
                        label={cell.label}
                        icon={cell.icon}
                        bg={cell.bg}
                        border={cell.border}
                        textColor={cell.textColor}
                        fontSize={cell.fontSize}
                        isFocused={focusedTile === cell.id}
                        progress={focusedTile === cell.id ? tileProgress : 0}
                        onEnter={() => handleTileEnter(cell.id)}
                        onLeave={() => handleTileLeave(cell.id)}
                        onClick={() => handleTileClick(cell.id)}
                        testId={`tile-${cell.id.toLowerCase()}`}
                      />
                    ))}
                  </div>
                );
              })()
            )}

            {/* Botones de acción */}
            <div style={{ flexShrink: 0, height: isLandscape ? 60 : 72, display: "flex", gap: 8 }}>
              <ActionBtn
                label="Espacio"
                icon={<Space size={isLandscape ? 20 : 24} />}
                bg="#E0E7FF"
                textColor="#3730A3"
                isFocused={focusedAct === "space"}
                progress={focusedAct === "space" ? actionProgress : 0}
                onEnter={() => { if (!scanActive) setFocusedAct("space"); }}
                onLeave={() => setFocusedAct((a) => (a === "space" ? null : a))}
                onClick={() => handleActionClick("space")}
                testId="button-space"
              />
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
          </>
        )}
      </div>
    </FullscreenLayout>
  );
}
