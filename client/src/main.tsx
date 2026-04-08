import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
// Inicializar el Cursor Maestro Único ANTES de React: crea #gaze-cursor
// sincrónicamente y lo coloca en el centro de pantalla con opacity:1.
import "@/lib/globalCursor";

createRoot(document.getElementById("root")!).render(<App />);
