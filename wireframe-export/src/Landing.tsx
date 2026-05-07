import { Link } from "wouter";

const SCREENS = [
  {
    path: "/urgente",
    title: "Urgente",
    desc: "Cuatro botones de máxima prioridad: aire, dolor, náuseas, sed.",
  },
  {
    path: "/mensajes",
    title: "Mensajes",
    desc: "Necesidades comunes (familia, baño, temperatura, posición…).",
  },
  {
    path: "/escalas",
    title: "Escalas",
    desc: "Escalas clínicas: EVA dolor, Borg disnea y ansiedad (0–10).",
  },
  {
    path: "/teclado",
    title: "Teclado",
    desc: "Entrada de texto QWERTY con salida por síntesis de voz.",
  },
];

export default function Landing() {
  return (
    <div className="wf-landing">
      <div className="wf-landing-inner">
        <div className="wf-landing-mark">VV</div>

        <h1 className="wf-landing-title">VidaVoz · Wireframe</h1>
        <p className="wf-landing-sub">
          Prototipo low-fidelity del asistente de comunicación para
          pacientes en UCI. Anexo del Trabajo Fin de Máster.
        </p>

        <p className="wf-landing-desc">
          Esta versión presenta la arquitectura UX y la navegación
          gaze-driven sin lógica de producción ni acceso a cámara.
          Los botones simulan el dwell de 3 segundos para mostrar la
          experiencia de activación por mirada.
        </p>

        <div className="wf-landing-grid">
          {SCREENS.map((s) => (
            <Link key={s.path} href={s.path} className="wf-landing-card">
              <div className="wf-landing-card-title">{s.title}</div>
              <div className="wf-landing-card-desc">{s.desc}</div>
              <div className="wf-landing-card-cta">Abrir →</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
