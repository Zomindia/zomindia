import React from "react";

interface AvatarProps {
  photoURL?: string | null;
  displayName?: string | null;
  email?: string | null;
  isPremium?: boolean;
  sizeClass?: string; // e.g. "w-14 h-14 sm:w-20 sm:h-20" or "w-10 h-10"
}

export default function Avatar({
  photoURL,
  displayName,
  email,
  isPremium,
  sizeClass = "w-10 h-10",
}: AvatarProps) {
  const isFounder = email?.toLowerCase().trim() === "sarthakwebtech@gmail.com";
  const hasSpecialGlow = isFounder || isPremium;

  return (
    <div className={`relative shrink-0 rounded-full select-none p-[3.5px] ${sizeClass} overflow-hidden`}>
      {/* Outer Border Background (rotating conic gradient) */}
      <div
        className={`absolute inset-0 rounded-full ${
          hasSpecialGlow
            ? "animate-spin-gold conic-gold-bg scale-110"
            : "animate-spin-rgb conic-rgb-bg scale-110"
        }`}
      />

      {/* Shimmer Wipe overlay for Founder / Premium users */}
      {hasSpecialGlow && (
        <div className="absolute inset-0 rounded-full animate-shimmer-wipe bg-shimmer-wipe mix-blend-overlay z-10 pointer-events-none" />
      )}

      {/* Inner Image/Fallback container (keeps face photo 100% sharp and clear) */}
      <div className="relative w-full h-full rounded-full overflow-hidden bg-slate-900 flex items-center justify-center z-20">
        {photoURL ? (
          <img
            src={photoURL}
            alt=""
            className="w-full h-full object-cover rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full bg-slate-800 text-slate-300 flex items-center justify-center font-black text-xs">
            {displayName ? displayName.slice(0, 2).toUpperCase() : "Z"}
          </div>
        )}
      </div>
    </div>
  );
}
