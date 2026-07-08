import React from 'react';

import logoHorizontalFile from '../assets/images/logo-horizontal.png';
import logoIconFile from '../assets/images/logo-icon.png';

// Golden shield logo icon with clean 'Z' text
export const LogoIcon = logoIconFile;

// Horizontal full logo with text
export const LogoHorizontal = logoHorizontalFile;

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
        src={LogoHorizontal}
        alt="ZOMINDIA LOGO"
        className="h-full w-auto max-w-full object-contain transition-all duration-300"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};
