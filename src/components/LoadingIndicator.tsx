import React from 'react';
import { LogoIcon } from './BrandLogo';

/**
 * Premium full-screen loading overlay with modern radial ambient glow, 
 * rotating multi-layer rings, pulsing logo, and clean staggered loading subtitles.
 * Engineered with pure CSS hardware acceleration for zero CPU churn, zero hook dependency,
 * and reliable rendering during initial application boot.
 */
export function LoadingScreen({ 
  message = "Loading verified home services..." 
}: { 
  message?: string 
}) {
  return (
    <div className="fixed inset-0 min-h-screen bg-slate-50 flex flex-col items-center justify-center overflow-hidden z-[9999] select-none">
      <div className="relative flex flex-col items-center justify-center font-sans text-center max-w-sm w-full px-6">
        {/* Subtle Ambient Glow */}
        <div className="absolute w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -top-12" />

        {/* Pulsing Zomindia Brand Icon Frame */}
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-2xl bg-white shadow-lg border border-slate-100 flex items-center justify-center p-3 relative transition-transform">
            <img 
              src={LogoIcon} 
              alt="Zomindia" 
              className="w-12 h-12 object-contain select-none animate-pulse"
              referrerPolicy="no-referrer"
            />
          </div>
          {/* Subtle Outer Ping Ring */}
          <div className="absolute inset-0 rounded-2xl border-2 border-blue-500/20 animate-ping pointer-events-none opacity-40" />
        </div>

        {/* Zomindia Full Horizontal Logo */}
        <div className="mb-4">
          <img
            src="/logo-horizontal.png"
            alt="Zomindia"
            className="h-8 w-auto object-contain mx-auto"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Minimal Progress Bar */}
        <div className="w-40 h-1 bg-slate-200/80 rounded-full overflow-hidden mb-3">
          <div className="w-full h-full bg-blue-600 rounded-full origin-left animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600" />
        </div>

        {/* Clean Subtitle */}
        <p className="text-slate-500 text-xs font-semibold tracking-wide">
          {message}
        </p>
      </div>
    </div>
  );
}

/**
 * A highly reusable, beautifully responsive inline spinner using multi-ring CSS
 * which scales seamlessly based on size props.
 */
export function LoadingSpinner({ 
  size = "md", 
  light = false 
}: { 
  size?: "xs" | "sm" | "md" | "lg", 
  light?: boolean 
}) {
  const sizeClasses = {
    xs: "w-4 h-4 border",
    sm: "w-6 h-6 border-2",
    md: "w-10 h-10 border-[3px]",
    lg: "w-14 h-14 border-4",
  };

  const ringColorClasses = light 
    ? "border-white/25 border-t-white" 
    : "border-slate-200 border-t-indigo-600";

  return (
    <div className="flex items-center justify-center">
      <div className={`relative ${size === "xs" ? "w-4 h-4" : size === "sm" ? "w-6 h-6" : size === "md" ? "w-10 h-10" : "w-14 h-14"}`}>
        <div 
          className={`absolute inset-0 rounded-full border-solid animate-spin ${sizeClasses[size]} ${ringColorClasses}`}
        />
      </div>
    </div>
  );
}

/**
 * A beautifully branded button spinner which spins the custom Zomindia triangle icon.
 */
export function BrandedButtonSpinner({ 
  className = "w-4 h-4" 
}: { 
  className?: string 
}) {
  return (
    <div className={`relative ${className} flex items-center justify-center shrink-0`}>
      <img
        src={LogoIcon}
        alt="loading..."
        className="w-full h-full object-contain select-none z-0 animate-spin"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

/**
 * Skeletal loading component for lists and grids of cards.
 * Combines high-fidelity structural mimicry with slow modern shimmer.
 */
export function ShimmerCard({ 
  type = "default" 
}: { 
  type?: "default" | "job" | "ticket" | "profile" 
}) {
  return (
    <div className="relative overflow-hidden bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
      {/* High-contrast moving linear-gradient background */}
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-slate-100/60 to-transparent" />
      
      {type === "job" ? (
        <div className="space-y-4">
          <div className="flex justify-between items-start">
            <div className="w-12 h-12 rounded-2xl bg-slate-100" />
            <div className="w-20 h-6 rounded-full bg-slate-100" />
          </div>
          <div className="space-y-2">
            <div className="w-3/4 h-5 rounded-lg bg-slate-100" />
            <div className="w-1/2 h-4 rounded-lg bg-slate-100" />
          </div>
          <div className="pt-4 border-t border-slate-50 flex justify-between gap-4">
            <div className="w-1/3 h-8 rounded-xl bg-slate-100" />
            <div className="w-1/3 h-8 rounded-xl bg-slate-100" />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="w-1/4 h-4 rounded-full bg-slate-100" />
          <div className="w-full h-8 rounded-2xl bg-slate-100" />
          <div className="w-1/2 h-4 rounded-full bg-slate-100" />
        </div>
      )}
    </div>
  );
}

/**
 * Shimmering skeleton screen mirroring the exact visual layout of
 * a professional service card to improve perceived performance.
 */
export function ServiceCardSkeleton() {
  return (
    <div className="relative overflow-hidden bg-white border-2 border-slate-50 rounded-[48px] p-8 sm:p-10 shadow-sm flex flex-col h-full select-none">
      {/* Gliding Shimmer Overlay */}
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-slate-100/40 to-transparent pointer-events-none" />
      
      {/* Visual Service Image Box Mimic */}
      <div className="w-full h-48 sm:h-56 rounded-[32px] bg-slate-100 mb-8" />
      
      {/* Title & Badge Row Mimic */}
      <div className="flex justify-between items-start mb-4 gap-4">
        <div className="w-2/3 h-8 rounded-full bg-slate-100" />
        <div className="w-14 h-7 rounded-full bg-slate-100 shrink-0" />
      </div>
      
      {/* Description Mimic */}
      <div className="space-y-2.5 mb-10 flex-1">
        <div className="w-full h-4 rounded-full bg-slate-100" />
        <div className="w-11/12 h-4 rounded-full bg-slate-100" />
        <div className="w-3/4 h-4 rounded-full bg-slate-100" />
      </div>
      
      {/* Bottom price tags & buttons block mimicking exactly the border and alignments */}
      <div className="flex justify-between items-center pt-8 border-t border-slate-100 mt-auto">
        <div className="space-y-2">
          <div className="w-16 h-3 rounded bg-slate-100" />
          <div className="w-20 h-9 rounded-2xl bg-slate-100" />
        </div>
        <div className="w-32 h-14 rounded-[22px] bg-slate-100" />
      </div>
    </div>
  );
}
