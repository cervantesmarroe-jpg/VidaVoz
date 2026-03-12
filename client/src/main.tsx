import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Suppress residual WebGazer internal errors (TF.js workers, stream issues)
// so they never crash the React tree.
const isWebGazerNoise = (msg: string) =>
  msg.includes("Unexpected token '<'") ||
  msg.includes('No stream') ||
  msg.includes('webgazer') ||
  msg.includes('tfjs') ||
  msg.includes('TensorFlow');

window.addEventListener('error', (e) => {
  if (isWebGazerNoise(e.message || '')) { e.preventDefault(); e.stopImmediatePropagation(); }
}, true);

window.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason?.message || String(e.reason || '');
  if (isWebGazerNoise(msg)) e.preventDefault();
});

// Configure WebGazer as soon as it is available on window:
// - Use ridge regression (no TF.js workers, no external CDN fetches)
// - Pause immediately so it doesn't auto-start the camera
function configureWebGazer() {
  try {
    const wg = (window as any).webgazer;
    if (!wg) return;
    wg.setRegression('ridge');       // lightweight, no workers
    wg.showVideoPreview(false);
    wg.params.showFaceOverlay = false;
    wg.params.showFaceFeedbackBox = false;
    // Pause — will be resumed only when user activates calibration
    wg.pause();
  } catch (_) {}
}

if ((window as any).webgazer) {
  configureWebGazer();
} else {
  window.addEventListener('load', configureWebGazer);
}

createRoot(document.getElementById("root")!).render(<App />);
