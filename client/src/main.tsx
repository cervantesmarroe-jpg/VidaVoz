import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Suppress unhandled errors from WebGazer's internal resource loading
// WebGazer fetches TF.js model files that may return HTML (404) in some environments,
// causing a SyntaxError: "Unexpected token '<'" that would otherwise crash the app.
window.addEventListener('error', (event) => {
  if (
    event.message?.includes("Unexpected token '<'") ||
    event.message?.includes('webgazer') ||
    event.filename?.includes('webgazer')
  ) {
    event.preventDefault();
    return;
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || String(event.reason || '');
  if (
    msg.includes("Unexpected token '<'") ||
    msg.includes('webgazer') ||
    msg.includes('No stream')
  ) {
    event.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
