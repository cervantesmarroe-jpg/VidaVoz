import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
// Inicializar el Cursor Maestro Único ANTES de React: crea #gaze-cursor
// sincrónicamente y lo coloca en el centro de pantalla con opacity:1.
import "@/lib/globalCursor";
// Side-effect: expone window.headOffsetCorrector. No arranca nada por sí solo.
import "@/lib/headOffsetCorrector";
// Side-effect: cursor de apoyo táctil que aparece sobre el toque cuando el
// eye-tracking está activo. Expone window.touchSupportCursor.
import "@/lib/touchSupportCursor";

createRoot(document.getElementById("root")!).render(<App />);
