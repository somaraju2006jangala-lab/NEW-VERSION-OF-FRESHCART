import React from 'react';
import { Sparkles } from 'lucide-react';

interface FloatingAssistantButtonProps {
  onClick: () => void;
  isOpen: boolean;
}

export const FloatingAssistantButton: React.FC<FloatingAssistantButtonProps> = ({
  onClick,
  isOpen,
}) => {
  if (isOpen) return null;

  return (
    <div
      id="ai-assistant-toggle-wrapper"
      className="fixed bottom-5 right-20 sm:bottom-6 sm:right-24 z-50 pointer-events-auto"
    >
      <button
        id="floating-ai-assistant-btn"
        type="button"
        onClick={onClick}
        aria-label="FreshCart AI Assistant"
        title="Open FreshCart AI Assistant (Voice & Chat Shopping)"
        className="group relative flex items-center gap-2 p-2 sm:p-2.5 rounded-2xl bg-[#0b1726]/90 hover:bg-[#0f2238] border border-emerald-500/40 hover:border-emerald-400 text-white shadow-2xl backdrop-blur-xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
        style={{
          boxShadow: '0 8px 30px rgba(0, 107, 44, 0.35), 0 0 15px rgba(16, 185, 129, 0.25)',
        }}
      >
        {/* Avatar with animated glowing ring */}
        <div className="relative shrink-0">
          <img
            src="/assets/ai-avatar.jpg"
            alt="AI Assistant"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover ring-2 ring-emerald-400/80 shadow-md"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          {/* Online green pulsing dot */}
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#070d14] rounded-full">
            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
          </span>
        </div>

        {/* Text Label on larger screens */}
        <div className="hidden md:flex flex-col text-left pr-2">
          <span className="text-[12px] font-bold text-white tracking-wide flex items-center gap-1 leading-tight">
            AI Assistant
            <Sparkles className="w-3 h-3 text-emerald-400" />
          </span>
          <span className="text-[10px] text-emerald-400/90 font-medium leading-none">
            Voice & Chat
          </span>
        </div>
      </button>
    </div>
  );
};

export default FloatingAssistantButton;
