import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// ─── Suppress WebGazer / TF.js noise ────────────────────────────────────────
// WebGazer spawns TF.js Web Workers whose scripts return HTML in restricted
// environments (Replit, iframes). The resulting SyntaxError bubbles through
// multiple channels; we suppress every one of them.

const NOISE = [
  "Unexpected token '<'",
  'No stream',
  'webgazer',
  'tfjs',
  'TensorFlow',
  'face-landmarks',
];
const isNoise = (msg: string) => NOISE.some((n) => msg.includes(n));

// 1. window.onerror — returning `true` is the browser-standard way to
//    suppress an error and prevent the runtime-error overlay.
window.onerror = (msg, _src, _line, _col, _err) => {
  if (isNoise(String(msg ?? ''))) return true;  // suppress
  return false;
};

// 2. window.onunhandledrejection — same idea for Promise rejections.
window.onunhandledrejection = (e: PromiseRejectionEvent) => {
  const msg = e.reason?.message ?? String(e.reason ?? '');
  if (isNoise(msg)) { e.preventDefault(); }
};

// 3. capture-phase addEventListener as an extra belt-and-suspenders guard.
window.addEventListener('error', (e) => {
  if (isNoise(e.message ?? '')) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}, true);

window.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason?.message ?? String(e.reason ?? '');
  if (isNoise(msg)) { e.preventDefault(); e.stopImmediatePropagation(); }
}, true);

// ────────────────────────────────────────────────────────────────────────────

createRoot(document.getElementById("root")!).render(<App />);
