import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Suppress WebGazer's internal noise so it never crashes the React tree.
// These errors come from TF.js workers returning HTML 404 pages (Replit env)
// and from camera permission failures — neither should affect the UI.
const isWebGazerNoise = (msg: string) =>
  msg.includes("Unexpected token '<'") ||
  msg.includes('No stream') ||
  msg.includes('webgazer') ||
  msg.includes('tfjs');

window.addEventListener('error', (e) => {
  if (isWebGazerNoise(e.message || '')) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}, true);

window.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason?.message || String(e.reason || '');
  if (isWebGazerNoise(msg)) e.preventDefault();
});

createRoot(document.getElementById("root")!).render(<App />);
