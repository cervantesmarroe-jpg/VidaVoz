import { ReactNode } from "react";
import { Link, useLocation } from "wouter";

interface Props {
  children: ReactNode;
}

const TABS = [
  { path: "/wireframe",          label: "Urgente" },
  { path: "/wireframe/mensajes", label: "Mensajes" },
  { path: "/wireframe/escalas",  label: "Escalas" },
  { path: "/wireframe/teclado",  label: "Teclado" },
];

export function WireframeLayout({ children }: Props) {
  const [location] = useLocation();

  return (
    <div className="wf-shell" data-testid="wireframe-shell">
      {/* Header — placeholder logo + control pills */}
      <div className="wf-header">
        <div className="wf-logo">
          <div className="wf-logo-mark">LOGO</div>
          <span>VidaVoz · Wireframe</span>
        </div>
        <div className="wf-header-controls">
          <span className="wf-pill">Mirada</span>
          <span className="wf-pill">Audio</span>
          <span className="wf-pill">⋯</span>
        </div>
      </div>

      {/* Main content area */}
      <div className="wf-main">
        <div className="wf-content">{children}</div>
      </div>

      {/* Bottom tabs (mirrors FullscreenLayout footer nav) */}
      <nav className="wf-tabs">
        {TABS.map((t) => {
          const isActive =
            t.path === "/wireframe"
              ? location === "/wireframe"
              : location.startsWith(t.path);
          return (
            <Link
              key={t.path}
              href={t.path}
              data-testid={`wf-tab-${t.label.toLowerCase()}`}
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
