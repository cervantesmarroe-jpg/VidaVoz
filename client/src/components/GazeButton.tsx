import { ReactNode, ButtonHTMLAttributes } from 'react';
import { useTTS } from '@/hooks/use-tts';

interface GazeButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  speakText?: string;
  className?: string;
  theme?: 'red' | 'blue' | 'yellow' | 'purple' | 'turquoise' | 'slate';
}

export function GazeButton({ 
  children, 
  speakText, 
  className = "", 
  onClick, 
  theme = 'slate',
  ...props 
}: GazeButtonProps) {
  const { speak } = useTTS();

  const themeClasses = {
    red: "bg-gradient-to-b from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 border-red-400/50 shadow-red-900/50 text-red-50",
    blue: "bg-gradient-to-b from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 border-blue-400/50 shadow-blue-900/50 text-blue-50",
    yellow: "bg-gradient-to-b from-yellow-500 to-yellow-700 hover:from-yellow-400 hover:to-yellow-600 border-yellow-300/50 shadow-yellow-900/50 text-yellow-950",
    purple: "bg-gradient-to-b from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 border-purple-400/50 shadow-purple-900/50 text-purple-50",
    turquoise: "bg-gradient-to-b from-teal-500 to-teal-700 hover:from-teal-400 hover:to-teal-600 border-teal-300/50 shadow-teal-900/50 text-teal-50",
    slate: "bg-gradient-to-b from-slate-700 to-slate-900 hover:from-slate-600 hover:to-slate-800 border-slate-600/50 shadow-black/50 text-slate-50",
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (speakText) {
      speak(speakText);
    }
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <button
      data-gaze-target="true"
      onClick={handleClick}
      className={`
        gaze-target relative w-full h-full flex flex-col items-center justify-center 
        p-4 md:p-8 rounded-3xl border-t-2 border-l-2 shadow-2xl
        transition-all duration-200 active:scale-95 select-none
        ${themeClasses[theme]} ${className}
      `}
      {...props}
    >
      <div className="z-10 flex flex-col items-center justify-center text-center gap-4">
        {children}
      </div>
      <div className="gaze-progress-bar"></div>
    </button>
  );
}
