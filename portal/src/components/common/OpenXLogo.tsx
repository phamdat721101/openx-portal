import React from 'react';

interface OpenXLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
  subText?: string;
}

export function OpenXLogo({ size = 26, className = '', showText = true, subText }: OpenXLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="relative flex items-center justify-center shrink-0">
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="transition-transform duration-300 hover:scale-105"
        >
          {/* Top Diamond Stack Layer */}
          <path
            d="M12 2L2 7L12 12L22 7L12 2Z"
            stroke="var(--primary)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Bottom Diamond Stack Layer */}
          <path
            d="M2 17L12 22L22 17"
            stroke="var(--primary)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Middle Diamond Stack Layer */}
          <path
            d="M2 12L12 17L22 12"
            stroke="var(--primary)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Central Cryptographic Microchip Core */}
          <rect
            x="9"
            y="9"
            width="6"
            height="6"
            fill="var(--primary)"
            fillOpacity="0.15"
            stroke="var(--primary)"
            strokeWidth="1"
          />
          <path
            d="M12 9V15M9 12H15"
            stroke="var(--primary)"
            strokeWidth="1"
            strokeLinecap="round"
          />
        </svg>
        {/* Ambient Cyan Glow */}
        <div
          className="absolute inset-0 -z-10 rounded-full blur-md opacity-35 bg-primary"
          style={{ transform: 'scale(0.8)' }}
        />
      </div>

      {showText && (
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 leading-none">
            <span className="font-headline text-lg font-bold tracking-tight text-on-surface">
              Open<span className="text-primary">X</span>
            </span>
            <span className="rounded bg-agent-accent/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-agent-accent border border-agent-accent/30 tracking-wider uppercase">
              Agent Portal
            </span>
          </div>
          {subText && (
            <span className="text-[11px] text-on-surface-variant truncate font-normal mt-0.5">
              {subText}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
