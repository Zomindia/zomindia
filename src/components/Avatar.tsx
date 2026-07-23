import React from "react";
import { LogoIcon } from "./BrandLogo";
import { User } from "lucide-react";

interface AvatarProps {
  photoURL?: string | null;
  displayName?: string | null;
  email?: string | null;
  isPremium?: boolean;
  sizeClass?: string; // e.g. "w-14 h-14 sm:w-20 sm:h-20" or "w-10 h-10"
  isPartner?: boolean;
  role?: string;
  className?: string;
}

export default function Avatar({
  photoURL,
  displayName,
  email,
  isPremium,
  sizeClass = "w-10 h-10",
  isPartner = false,
  role,
  className = "",
}: AvatarProps) {
  const isFounder = email?.toLowerCase().trim() === "sarthakwebtech@gmail.com";
  const hasSpecialGlow = isFounder || isPremium;
  const isPartnerRole = isPartner || role === 'partner' || role === 'provider';

  const isValidPhoto = Boolean(
    photoURL &&
    typeof photoURL === 'string' &&
    photoURL.trim().length > 0 &&
    !photoURL.includes("googleusercontent.com/image_collection")
  );

  return (
    <div className={`relative shrink-0 rounded-full select-none p-[3.5px] ${sizeClass} ${className} overflow-hidden`}>
      {/* Outer Border Background (rotating conic gradient) */}
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] rounded-full origin-center ${
          hasSpecialGlow
            ? "animate-spin-gold conic-gold-bg"
            : "animate-spin-rgb conic-rgb-bg"
        }`}
      />

      {/* Shimmer Wipe overlay for Founder / Premium users */}
      {hasSpecialGlow && (
        <div className="absolute inset-0 rounded-full animate-shimmer-wipe bg-shimmer-wipe mix-blend-overlay z-30 pointer-events-none" />
      )}

      {/* Inner Image/Fallback container (keeps face photo 100% sharp and clear) */}
      <div className="relative w-full h-full rounded-full overflow-hidden bg-slate-900 flex items-center justify-center z-20">
        {isValidPhoto ? (
          <img
            src={photoURL!}
            alt={displayName || "Avatar"}
            className="w-full h-full object-cover rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : isPartnerRole ? (
          /* Partner fallback: Default to ZomIndia Logo Icon */
          <div className="w-full h-full bg-slate-950 flex items-center justify-center p-1">
            <img
              src={LogoIcon}
              alt="Partner Logo"
              className="w-full h-full object-contain rounded-full"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : (
          /* Customer fallback: Default Customer Avatar */
          <div className="w-full h-full bg-gradient-to-br from-emerald-600 to-teal-800 text-white flex items-center justify-center font-black text-xs uppercase tracking-wider">
            {displayName ? displayName.trim().slice(0, 2).toUpperCase() : <User size={16} className="text-white/90" />}
          </div>
        )}
      </div>
    </div>
  );
}
