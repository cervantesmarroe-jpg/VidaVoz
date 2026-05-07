import { Switch, Route } from "wouter";
import Landing from "./Landing";
import WireframeUrgent from "./pages/WireframeUrgent";
import WireframeMessages from "./pages/WireframeMessages";
import WireframeScales from "./pages/WireframeScales";
import WireframeKeyboard from "./pages/WireframeKeyboard";

export default function App() {
  return (
    <div className="wf-root">
      <div className="wf-tracking-banner">Tracking: estable (simulado)</div>

      <Switch>
        <Route path="/"          component={Landing} />
        <Route path="/urgente"   component={WireframeUrgent} />
        <Route path="/mensajes"  component={WireframeMessages} />
        <Route path="/escalas"   component={WireframeScales} />
        <Route path="/teclado"   component={WireframeKeyboard} />
      </Switch>

      <div className="wf-notice">VidaVoz · Wireframe TFM · Standalone</div>
    </div>
  );
}
