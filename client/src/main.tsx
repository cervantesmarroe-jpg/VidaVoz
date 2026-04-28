import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
// Inicializar el Cursor Maestro Único ANTES de React: crea #gaze-cursor
// sincrónicamente y lo coloca en el centro de pantalla con opacity:1.
import "@/lib/globalCursor";
// Cargar el corrector opcional de offset de cabeza para que se autoexponga
// en window.headOffsetCorrector (efecto secundario del módulo). No arranca
// nada por sí solo: hay que llamar a start() manualmente desde consola.
import "@/lib/headOffsetCorrector";

createRoot(document.getElementById("root")!).render(<App />);
