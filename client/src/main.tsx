import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Suppress any remaining WebGazer console noise (camera denial, stream issues)
// so they never surface as runtime errors in the UI.
const NOISE = ['No stream', 'webgazer', 'ridgeWorker', 'thread starting'];
const isNoise = (msg: string) => NOISE.some((n) => msg.includes(n));

window.onerror = (msg) => {
  if (isNoise(String(msg ?? ''))) return true;
  return false;
};
window.onunhandledrejection = (e: PromiseRejectionEvent) => {
  const msg = e.reason?.message ?? String(e.reason ?? '');
  if (isNoise(msg)) e.preventDefault();
};

createRoot(document.getElementById("root")!).render(<App />);
