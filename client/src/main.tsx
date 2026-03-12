import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// ─── Comprehensive WebGazer error suppression ────────────────────────────────
// WebGazer / TF.js generate several categories of errors in restricted envs:
//   • SyntaxError "Unexpected token '<'" — worker script URL returns HTML
//   • TypeError "t is not a function"    — TF.js face-model Promise rejection
//   • "No stream"                        — camera unavailable
// We suppress ALL of them so they never surface as a runtime error overlay.

const isWebGazerSource = (src?: string | null) =>
  !!(src && (src.includes('webgazer') || src.includes('ridgeWorker')));

const isWebGazerMessage = (msg: string) =>
  msg.includes("Unexpected token '<'") ||
  msg.includes('No stream') ||
  msg.includes('webgazer') ||
  msg.includes('ridgeWorker') ||
  msg.includes('thread starting');

// 1. window.onerror — returning true suppresses the browser runtime-error overlay
window.onerror = (msg, src, _line, _col, err) => {
  if (isWebGazerSource(src) || isWebGazerMessage(String(msg ?? ''))) return true;
  // Also suppress if the error's stack trace mentions webgazer.js
  if (err?.stack && isWebGazerSource(err.stack)) return true;
  return false;
};

// 2. Unhandled Promise rejections — covers begin() / TF.js model fetch failures
window.onunhandledrejection = (e: PromiseRejectionEvent) => {
  const msg   = e.reason?.message ?? String(e.reason ?? '');
  const stack = e.reason?.stack   ?? '';
  if (isWebGazerMessage(msg) || isWebGazerSource(stack)) {
    e.preventDefault();
  }
};

// 3. Capture-phase addEventListener as belt-and-suspenders
window.addEventListener('error', (e) => {
  if (isWebGazerSource(e.filename) || isWebGazerMessage(e.message ?? '')) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}, true);

window.addEventListener('unhandledrejection', (e) => {
  const msg   = e.reason?.message ?? String(e.reason ?? '');
  const stack = e.reason?.stack   ?? '';
  if (isWebGazerMessage(msg) || isWebGazerSource(stack)) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}, true);

// ────────────────────────────────────────────────────────────────────────────

createRoot(document.getElementById("root")!).render(<App />);
