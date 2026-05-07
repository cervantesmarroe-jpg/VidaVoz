import { Switch, Route } from "wouter";
import "./wireframe.css";

import WireframeUrgent   from "./pages/WireframeUrgent";
import WireframeMessages from "./pages/WireframeMessages";
import WireframeScales   from "./pages/WireframeScales";
import WireframeKeyboard from "./pages/WireframeKeyboard";

/**
 * Punto de entrada AISLADO de la versión wireframe.
 *
 * Esta rama del árbol React no monta el splash, ni el selector de perfil, ni
 * el tracker de mirada, ni los providers de toasts/tooltips. Sólo router +
 * pantallas low-fi. Todo el CSS está namespaced con `.wf-*` y se importa
 * únicamente al entrar en /wireframe, así no contamina la app real.
 *
 * Banners visibles del estado de tracking + cursor placeholder se muestran
 * decorativamente para reflejar la UX de mirada sin ejecutar lógica real.
 */
export default function WireframeApp() {
  return (
    <div className="wf-root" data-testid="wireframe-root">
      {/* Banner de estado del tracking — siempre visible en wireframe para
          que se vea la UX prevista (en producción sólo aparece cuando hay
          incertidumbre o pérdida de mirada). */}
      <div className="wf-tracking-banner">Tracking: estable</div>

      <Switch>
        <Route path="/wireframe"          component={WireframeUrgent} />
        <Route path="/wireframe/mensajes" component={WireframeMessages} />
        <Route path="/wireframe/escalas"  component={WireframeScales} />
        <Route path="/wireframe/teclado"  component={WireframeKeyboard} />
      </Switch>

      <div className="wf-notice">Wireframe Mode · /wireframe</div>
    </div>
  );
}
