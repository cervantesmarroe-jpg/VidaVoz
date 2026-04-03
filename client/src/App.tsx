import { Component, ReactNode, useState, useCallback } from "react";
import { ScanningProvider } from "@/context/ScanningContext";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

// Pages
import Urgent from "./pages/Urgent";
import Messages from "./pages/Messages";
import Scales from "./pages/Scales";
import Keyboard from "./pages/Keyboard";
import Splash from "./pages/Splash";
import ProfileSelect from "./pages/ProfileSelect";

// Error boundary to prevent white screen crashes
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("VozUCI caught an error:", error.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-amber-50 text-stone-700 p-8 gap-6">
          <p className="text-3xl font-bold text-center">Algo salió mal</p>
          <p className="text-xl text-center text-stone-500">Por favor, recargue la página.</p>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
            className="bg-teal-500 text-white font-bold text-2xl px-10 py-5 rounded-2xl shadow-md"
          >
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Urgent} />
      <Route path="/mensajes" component={Messages} />
      <Route path="/escalas" component={Scales} />
      <Route path="/teclado" component={Keyboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Flujo de arranque:  splash (3s) → profile-select (elegir dispositivo + QuickSync) → ready (app)
type AppPhase = "splash" | "profile" | "ready";

function App() {
  const [phase, setPhase] = useState<AppPhase>("splash");

  const handleSplashDone  = useCallback(() => setPhase("profile"), []);
  const handleProfileDone = useCallback(() => setPhase("ready"),   []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ScanningProvider>
          <TooltipProvider>
            <Toaster />

            {/* 1. Splash animado */}
            {phase === "splash" && (
              <Splash onDone={handleSplashDone} />
            )}

            {/* 2. Selección de perfil + QuickSync */}
            {phase === "profile" && (
              <ProfileSelect onDone={handleProfileDone} />
            )}

            {/* 3. App principal (solo cuando perfil+sync completados) */}
            {phase === "ready" && <Router />}
          </TooltipProvider>
        </ScanningProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
