import React, { useState, useEffect } from 'react';
import { usePremium } from '../context/PremiumContext';

interface PremiumAvatarProps {
  src?: string | null;
  displayName?: string | null;
  className?: string; // e.g. "w-10 h-10" or "w-16 h-16"
  fallbackClassName?: string;
  onClick?: (e: React.MouseEvent) => void;
  id?: string;
}

export const PremiumAvatar: React.FC<PremiumAvatarProps> = ({
  src,
  displayName,
  className = "w-10 h-10",
  fallbackClassName,
  onClick,
  id
}) => {
  const { isPremium } = usePremium();
  const [imageError, setImageError] = useState(false);

  // Reset image error if src changes
  useEffect(() => {
    setImageError(false);
  }, [src]);

  const containerClass = isPremium ? 'avatar-gold-container' : 'avatar-rgb-container';
  const innerClass = isPremium ? 'avatar-gold-inner avatar-gold-shimmer' : 'avatar-rgb-inner';

  const initial = (displayName || 'U').trim().charAt(0).toUpperCase();

  const hasValidImage = !!src && !imageError;

  return (
    <div 
      className={`${containerClass} ${className} shrink-0 transition-all duration-300 hover:scale-105 active:scale-95`}
      onClick={onClick}
      id={id}
    >
      <div className={`${innerClass} w-full h-full flex items-center justify-center`}>
        {hasValidImage ? (
          <img 
            src={src} 
            alt={displayName || "User"} 
            className="w-full h-full object-cover rounded-full"
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className={`w-full h-full flex items-center justify-center font-black bg-slate-100 text-slate-700 select-none ${fallbackClassName || 'text-[11px]'}`}>
            {initial}
          </div>
        )}
      </div>
    </div>
  );
};
