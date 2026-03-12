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
    red: "bg-gradient-to-b from-rose-400 to-rose-600 hover:from-rose-300 hover:to-rose-500 border-rose-300/70 shadow-rose-200/80 text-white",
    blue: "bg-gradient-to-b from-sky-400 to-sky-600 hover:from-sky-300 hover:to-sky-500 border-sky-300/70 shadow-sky-200/80 text-white",
    yellow: "bg-gradient-to-b from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 border-amber-300/70 shadow-amber-200/80 text-amber-950",
    purple: "bg-gradient-to-b from-violet-400 to-violet-600 hover:from-violet-300 hover:to-violet-500 border-violet-300/70 shadow-violet-200/80 text-white",
    turquoise: "bg-gradient-to-b from-teal-400 to-teal-600 hover:from-teal-300 hover:to-teal-500 border-teal-300/70 shadow-teal-200/80 text-white",
    slate: "bg-gradient-to-b from-stone-200 to-stone-300 hover:from-stone-100 hover:to-stone-200 border-stone-300/70 shadow-stone-200/80 text-stone-800",
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
        p-4 md:p-8 rounded-3xl border-t-2 border-l-2 shadow-xl
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
