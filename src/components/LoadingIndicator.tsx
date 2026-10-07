import React from 'react';
import { LogoIcon } from './BrandLogo';

/**
 * Premium full-screen loading overlay with modern radial ambient glow, 
 * rotating multi-layer rings, pulsing logo, and clean staggered loading subtitles.
 * Engineered with pure CSS hardware acceleration for zero CPU churn, zero hook dependency,
 * and reliable rendering during initial application boot.
 */
export function LoadingScreen({ 
  message = "Initializing zomindia pro services..." 
}: { 
  message?: string 
}) {
  const stairs = [
    { color: 'blue', left: 30, bottom: 40, pulse: "steadyPulseBlue 2s infinite ease-in-out", bg: "bg-gradient-to-b from-blue-400 to-blue-600 border border-blue-300" },
    { color: 'green', left: 100, bottom: 80, pulse: "steadyPulseGreen 2s infinite ease-in-out", bg: "bg-gradient-to-b from-emerald-400 to-emerald-600 border border-emerald-300" },
    { color: 'yellow', left: 170, bottom: 120, pulse: "steadyPulseYellow 2s infinite ease-in-out", bg: "bg-gradient-to-b from-amber-400 to-amber-600 border border-amber-300" },
    { color: 'red', left: 240, bottom: 160, pulse: "steadyPulseRed 2s infinite ease-in-out", bg: "bg-gradient-to-b from-rose-400 to-rose-600 border border-rose-300" }
  ];

  return (
    <div className="fixed inset-0 min-h-screen bg-slate-50 flex flex-col items-center justify-center overflow-hidden z-[9999] select-none">
      <style>{`
        @keyframes steadyPulseBlue {
          0%, 100% { box-shadow: 0 0 15px rgba(59, 130, 246, 0.4); }
          50% { box-shadow: 0 0 30px rgba(59, 130, 246, 0.85); }
        }
        @keyframes steadyPulseGreen {
          0%, 100% { box-shadow: 0 0 15px rgba(16, 185, 129, 0.4); }
          50% { box-shadow: 0 0 30px rgba(16, 185, 129, 0.85); }
        }
        @keyframes steadyPulseYellow {
          0%, 100% { box-shadow: 0 0 15px rgba(245, 158, 11, 0.4); }
          50% { box-shadow: 0 0 30px rgba(245, 158, 11, 0.85); }
        }
        @keyframes steadyPulseRed {
          0%, 100% { box-shadow: 0 0 15px rgba(244, 63, 94, 0.4); }
          50% { box-shadow: 0 0 30px rgba(244, 63, 94, 0.85); }
        }
        @keyframes stairJumperLoop {
          0%, 10% {
            left: 38px;
            bottom: 56px;
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
          14% {
            left: 73px;
            bottom: 115px;
            transform: scale(1.25) rotate(15deg);
            opacity: 1;
          }
          22%, 32% {
            left: 108px;
            bottom: 96px;
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
          36% {
            left: 143px;
            bottom: 155px;
            transform: scale(1.25) rotate(15deg);
            opacity: 1;
          }
          44%, 54% {
            left: 178px;
            bottom: 136px;
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
          58% {
            left: 213px;
            bottom: 195px;
            transform: scale(1.25) rotate(15deg);
            opacity: 1;
          }
          66%, 76% {
            left: 248px;
            bottom: 176px;
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
          84% {
            left: 248px;
            bottom: 176px;
            transform: scale(1.35) rotate(0deg);
            opacity: 0;
          }
          88%, 96% {
            left: 38px;
            bottom: 56px;
            transform: scale(0) rotate(0deg);
            opacity: 0;
          }
          100% {
            left: 38px;
            bottom: 56px;
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }
        @keyframes goldBurstLoop {
          0%, 75% {
            transform: scale(0.1);
            opacity: 0;
          }
          76% {
            transform: scale(0.2);
            opacity: 1;
          }
          86% {
            transform: scale(2.2);
            opacity: 0;
          }
          87%, 100% {
            transform: scale(0.1);
            opacity: 0;
          }
        }
        @keyframes topLogoPulse {
          0%, 75% {
            box-shadow: 0 0 15px rgba(255, 215, 0, 0.35), inset 0 0 10px rgba(255, 215, 0, 0.15);
            border-color: #ffd700;
            transform: scale(1);
          }
          80% {
            box-shadow: 0 0 50px rgba(255, 215, 0, 0.95), inset 0 0 25px rgba(255, 215, 0, 0.6);
            border-color: #fffbcf;
            transform: scale(1.08);
          }
          90%, 100% {
            box-shadow: 0 0 15px rgba(255, 215, 0, 0.35), inset 0 0 10px rgba(255, 215, 0, 0.15);
            border-color: #ffd700;
            transform: scale(1);
          }
        }
      `}</style>

      {/* Blurred Background Image - Rajwada Palace Indore */}
      <div 
        className="absolute inset-0 bg-cover bg-center scale-105 filter blur-[12px] opacity-15 mix-blend-multiply"
        style={{ 
          backgroundImage: `url('https://images.unsplash.com/photo-1627308595229-7830a5c91f9f?q=80&w=1200&auto=format&fit=crop')` 
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-slate-50/80 to-slate-50/40" />

      <div className="relative flex flex-col items-center justify-center font-sans text-center z-10 max-w-md w-full px-6">
        
        {/* Fixed gold-bordered brand logo at top center */}
        <div
          style={{ animation: 'topLogoPulse 4.8s infinite ease-in-out' }}
          className="w-24 h-24 rounded-3xl bg-white border-2 flex items-center justify-center p-3 relative mb-8 shadow-2xl transition-transform"
        >
          <div className="absolute inset-0.5 rounded-[22px] border border-amber-500/25 pointer-events-none" />
          <img 
            src={LogoIcon} 
            alt="zomindia brand" 
            className="w-[68px] h-[68px] object-contain select-none animate-pulse"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Stair animation container */}
        <div className="relative w-[320px] h-[240px] flex items-center justify-center mb-6">
          
          {/* Static solid-box RGB stairs */}
          {stairs.map((step) => (
            <div
              key={step.color}
              className={`absolute w-14 h-4 rounded-lg shadow-lg ${step.bg}`}
              style={{
                left: `${step.left}px`,
                bottom: `${step.bottom}px`,
                animation: step.pulse
              }}
            />
          ))}

          {/* Gold splash burst when landing on Red step */}
          <div
            style={{
              left: "241px",
              bottom: "167px",
              animation: "goldBurstLoop 4.8s infinite ease-out"
            }}
            className="absolute w-14 h-14 bg-amber-400 rounded-full blur-md pointer-events-none"
          />

          {/* Moving Element: Smaller Zomindia logo with gold glow */}
          <div
            style={{
              animation: "stairJumperLoop 4.8s infinite ease-in-out"
            }}
            className="absolute w-10 h-10 rounded-xl bg-white border border-[#ffd700] flex items-center justify-center p-1.5 shadow-[0_0_15px_rgba(255,215,0,0.65)]"
          >
            <img 
              src={LogoIcon} 
              alt="zomindia mini" 
              className="w-full h-full object-contain select-none"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        {/* Brand Shield & Info */}
        <div className="space-y-2 mt-4 text-center">
          <h2 className="text-slate-900 text-sm font-black uppercase tracking-[0.25em] flex items-center justify-center gap-2">
            <svg 
              className="text-[#ffd700] w-4 h-4 fill-[#ffd700]/15 shrink-0" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.8 17 5 19 5a1 1 0 0 1 1 1z" />
            </svg>
            Zomindia Trust Shield
          </h2>
          <p className="text-slate-600 text-[9px] font-black uppercase tracking-[0.2em] min-h-[16px]">
            {message}
          </p>
        </div>
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
