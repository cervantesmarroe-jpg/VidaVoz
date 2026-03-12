import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// ─── Monitor de errores de WebGazer ─────────────────────────────────────────
// WebGazer / TF.js generan varios tipos de errores en entornos restringidos:
//   • SyntaxError "Unexpected token '<'" — el worker recibe HTML en vez de JS
//   • TypeError "t is not a function"    — rechazo de Promesa del modelo TF.js
//   • "No stream"                        — cámara no disponible
// Los suprimimos todos para que nunca aparezcan como overlay de error en la UI.

// Definimos quién es el "paciente conocido" que suele dar problemas
const isWebGazerSource = (src?: string | null) =>
  !!(src && (src.includes('webgazer') || src.includes('ridgeWorker')));

const isWebGazerMessage = (msg: string) =>
  msg.includes("Unexpected token '<'") ||
  msg.includes('No stream') ||
  msg.includes('webgazer') ||
  msg.includes('ridgeWorker') ||
  msg.includes('thread starting');

// 1. Instalamos el monitor de errores global
//    Devolver `true` significa: "Todo bajo control, no muestres el overlay"
window.onerror = (msg, src, _line, _col, err) => {
  if (isWebGazerSource(src) || isWebGazerMessage(String(msg ?? ''))) {
    console.warn('WebGazer detectó un error de carga en el entorno de desarrollo, pero lo hemos contenido.');
    return true;
  }
  if (err?.stack && isWebGazerSource(err.stack)) {
    console.warn('WebGazer detectó un error de carga en el entorno de desarrollo, pero lo hemos contenido.');
    return true;
  }
  return false;
};

// 2. Rechazos de Promesas sin manejar — cubre begin() y fallos del modelo TF.js
window.onunhandledrejection = (e: PromiseRejectionEvent) => {
  const msg   = e.reason?.message ?? String(e.reason ?? '');
  const stack = e.reason?.stack   ?? '';
  if (isWebGazerMessage(msg) || isWebGazerSource(stack)) {
    console.warn('WebGazer detectó un error de carga en el entorno de desarrollo, pero lo hemos contenido.');
    e.preventDefault();
  }
};

// 3. Escuchadores en fase de captura como capa adicional de seguridad
window.addEventListener('error', (e) => {
  if (isWebGazerSource(e.filename) || isWebGazerMessage(e.message ?? '')) {
    console.warn('WebGazer detectó un error de carga en el entorno de desarrollo, pero lo hemos contenido.');
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}, true);

window.addEventListener('unhandledrejection', (e) => {
  const msg   = e.reason?.message ?? String(e.reason ?? '');
  const stack = e.reason?.stack   ?? '';
  if (isWebGazerMessage(msg) || isWebGazerSource(stack)) {
    console.warn('WebGazer detectó un error de carga en el entorno de desarrollo, pero lo hemos contenido.');
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}, true);

// ────────────────────────────────────────────────────────────────────────────

createRoot(document.getElementById("root")!).render(<App />);
