import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Suppress errors from WebGazer's internal resource loading.
// WebGazer auto-starts from localStorage and tries to fetch TF.js workers/models
// that may return HTML (404) in some environments, throwing SyntaxError
// "Unexpected token '<'" — this would otherwise crash the whole app.
const suppressWebGazerError = (msg: string) =>
  msg.includes("Unexpected token '<'") ||
  msg.includes('webgazer') ||
  msg.includes('No stream') ||
  msg.includes('TensorFlow') ||
  msg.includes('tfjs');

window.addEventListener('error', (event) => {
  if (suppressWebGazerError(event.message || '')) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true); // capture phase — runs before anything else

window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || String(event.reason || '');
  if (suppressWebGazerError(msg)) {
    event.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
