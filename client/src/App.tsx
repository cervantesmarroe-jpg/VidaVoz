import { Switch, Route, Redirect } from "wouter";
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Urgent} />
      <Route path="/mensajes" component={Messages} />
      <Route path="/escalas" component={Scales} />
      <Route path="/teclado" component={Keyboard} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
