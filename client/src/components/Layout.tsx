import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { 
  AlertTriangle, 
  MessageSquareText, 
  ActivitySquare, 
  Keyboard as KeyboardIcon, 
  Eye,
  EyeOff
} from "lucide-react";
import { useWebGazer } from "@/hooks/use-webgazer";

const NAV_ITEMS = [
  { path: "/", label: "URGENTE", icon: AlertTriangle, color: "text-red-500", activeBg: "bg-red-500/20" },
  { path: "/mensajes", label: "MENSAJES", icon: MessageSquareText, color: "text-blue-400", activeBg: "bg-blue-500/20" },
  { path: "/escalas", label: "ESCALAS", icon: ActivitySquare, color: "text-yellow-400", activeBg: "bg-yellow-500/20" },
  { path: "/teclado", label: "TECLADO", icon: KeyboardIcon, color: "text-purple-400", activeBg: "bg-purple-500/20" },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { isActive, toggleActive, isScriptLoaded } = useWebGazer();

  return (
    <div className="flex flex-col h-screen max-h-screen bg-slate-950 overflow-hidden">
      
      {/* Top Header / App Bar */}
      <header className="h-24 flex items-center justify-between px-6 md:px-12 bg-slate-900 border-b border-slate-800 shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center">
            <MessageSquareText className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white hidden md:block">
            VozUCI
          </h1>
        </div>

        {/* Eye Tracking Toggle */}
        <button
          onClick={toggleActive}
          disabled={!isScriptLoaded}
          className={`
            flex items-center gap-4 px-6 py-4 rounded-2xl font-bold text-xl transition-all border-2
            ${isActive 
              ? 'bg-red-500/20 text-red-400 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]' 
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {isActive ? <Eye className="w-8 h-8" /> : <EyeOff className="w-8 h-8" />}
          {isActive ? "MIRADA ACTIVA" : "ACTIVAR MIRADA"}
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto no-scrollbar relative z-10">
        {children}
      </main>

      {/* Bottom Navigation Tabs - HUGE targets for tablets */}
      <nav className="h-32 md:h-40 bg-slate-900 border-t border-slate-800 flex shrink-0 z-50 p-2 md:p-4 gap-2">
        {NAV_ITEMS.map((item) => {
          const isActiveTab = location === item.path;
          const Icon = item.icon;
          return (
            <Link 
              key={item.path} 
              href={item.path}
              className={`
                flex-1 flex flex-col items-center justify-center gap-2 md:gap-4 rounded-3xl
                transition-all duration-300 border-2
                ${isActiveTab 
                  ? `${item.activeBg} border-current ${item.color} shadow-inner` 
                  : 'border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }
              `}
            >
              <Icon className={`w-10 h-10 md:w-16 md:h-16 ${isActiveTab ? '' : 'opacity-70'}`} />
              <span className={`font-bold text-lg md:text-2xl tracking-wide ${isActiveTab ? '' : 'opacity-70'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
