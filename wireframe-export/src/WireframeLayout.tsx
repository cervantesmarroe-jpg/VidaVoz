import { ReactNode } from "react";
import { Link, useLocation } from "wouter";

interface Props { children: ReactNode }

const TABS = [
  { path: "/urgente",  label: "Urgente"  },
  { path: "/mensajes", label: "Mensajes" },
  { path: "/escalas",  label: "Escalas"  },
  { path: "/teclado",  label: "Teclado"  },
];

export function WireframeLayout({ children }: Props) {
  const [location] = useLocation();

  return (
    <div className="wf-shell">
      <div className="wf-header">
        <div className="wf-logo">
          <Link href="/" className="wf-logo-mark wf-logo-link">VV</Link>
          <span>VidaVoz · Wireframe</span>
        </div>
        <div className="wf-header-controls">
          <span className="wf-pill">Mirada</span>
          <span className="wf-pill">Audio</span>
          <span className="wf-pill">⋯</span>
        </div>
      </div>

      <div className="wf-main">
        <div className="wf-content">{children}</div>
      </div>

      <nav className="wf-tabs">
        {TABS.map((t) => {
          const isActive = location === t.path;
          return (
            <Link
              key={t.path}
              href={t.path}
              className={`wf-tab ${isActive ? "is-active" : ""}`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
