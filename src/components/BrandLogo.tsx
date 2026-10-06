import React from 'react';

// Square icon logo (512x512)
export const LogoIcon = '/icon-512.png';

// Horizontal full logo with text
export const LogoHorizontal = '/logo-horizontal.png';

interface LogoProps {
  size?: number;
  className?: string;
}

// React component wrapper for standard responsive rendering
export const Logo = ({ size = 20, className = "" }: LogoProps) => {
  const heightStyle = size && !className ? { height: size * 1.6 } : undefined;

  return (
    <div
      className={`relative flex items-center justify-start select-none ${className}`}
      style={heightStyle}
    >
      <img
        src="/logo-horizontal.png"
        alt="Zomindia"
        className="h-9 sm:h-10 w-auto object-contain -ml-1 scale-105 origin-left transition-all duration-300"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

