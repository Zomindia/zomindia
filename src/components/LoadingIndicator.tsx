import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Shield, Compass, CheckCircle } from 'lucide-react';
import LogoIcon from '../assets/logo-icon.png';

/**
 * Premium full-screen loading overlay with modern radial ambient glow, 
 * rotating multi-layer rings, pulsing logo, and clean staggered loading subtitles.
 */
export function LoadingScreen({ 
  message = "Initializing zomindia pro services..." 
}: { 
  message?: string 
}) {
  const [imgError, setImgError] = useState(false);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (phase === 0) {
      // 1. Idle on Blue step: Pause for 0.5s
      timer = setTimeout(() => setPhase(1), 500);
    } else if (phase === 1) {
      // 2. Jump from Blue to Green: 0.6s animation
      timer = setTimeout(() => setPhase(2), 600);
    } else if (phase === 2) {
      // 3. Landed on Green: Pause for 0.5s
      timer = setTimeout(() => setPhase(3), 500);
    } else if (phase === 3) {
      // 4. Jump from Green to Yellow: 0.6s animation
      timer = setTimeout(() => setPhase(4), 600);
    } else if (phase === 4) {
      // 5. Landed on Yellow: Pause for 0.5s
      timer = setTimeout(() => setPhase(5), 500);
    } else if (phase === 5) {
      // 6. Jump from Yellow to Red: 0.6s animation
      timer = setTimeout(() => setPhase(6), 600);
    } else if (phase === 6) {
      // 7. Landed on Red: Pause for 0.5s before vanishing
      timer = setTimeout(() => setPhase(7), 500);
    } else if (phase === 7) {
      // 8. Vanish in gold burst: 0.5s animation (Triumphant glow phase 1)
      timer = setTimeout(() => setPhase(8), 500);
    } else if (phase === 8) {
      // 9. gone / reset stage: 0.5s animation (Triumphant glow phase 2)
      timer = setTimeout(() => setPhase(0), 500);
    }
    return () => clearTimeout(timer);
  }, [phase]);

  const getJumperAnimation = () => {
    switch (phase) {
      case 0: // Idle on Blue
        return { left: 38, bottom: 56, opacity: 1, scale: 1, rotate: 0 };
      case 1: // Jump from Blue to Green
        return {
          left: [38, 108],
          bottom: [56, 115, 96],
          scale: [1, 1.25, 0.9, 1],
          rotate: [0, 15, 0],
          opacity: 1
        };
      case 2: // Landed on Green
        return { left: 108, bottom: 96, opacity: 1, scale: 1, rotate: 0 };
      case 3: // Jump from Green to Yellow
        return {
          left: [108, 178],
          bottom: [96, 155, 136],
          scale: [1, 1.25, 0.9, 1],
          rotate: [0, 15, 0],
          opacity: 1
        };
      case 4: // Landed on Yellow
        return { left: 178, bottom: 136, opacity: 1, scale: 1, rotate: 0 };
      case 5: // Jump from Yellow to Red
        return {
          left: [178, 248],
          bottom: [136, 195, 176],
          scale: [1, 1.25, 0.9, 1],
          rotate: [0, 15, 0],
          opacity: 1
        };
      case 6: // Landed on Red (Pause)
        return { left: 248, bottom: 176, opacity: 1, scale: 1, rotate: 0 };
      case 7: // Vanishing in gold light burst
        return {
          left: 248,
          bottom: 176,
          opacity: [1, 0],
          scale: [1, 1.35, 0],
          rotate: 0
        };
      case 8: // Gone, resetting
        return { left: 38, bottom: 56, opacity: 0, scale: 0, rotate: 0 };
      default:
        return {};
    }
  };

  const getJumperTransition = (): any => {
    if (phase === 1 || phase === 3 || phase === 5) {
      return {
        duration: 0.6,
        ease: "easeInOut",
      };
    }
    if (phase === 7) {
      return {
        duration: 0.5,
        ease: "easeOut",
      };
    }
    if (phase === 0 || phase === 8) {
      return { duration: 0.1, ease: "easeOut" };
    }
    return { duration: 0.15, ease: "linear" };
  };

  const stairs = [
    { color: 'blue', left: 30, bottom: 40, pulse: "steadyPulseBlue 2s infinite ease-in-out", bg: "bg-gradient-to-b from-blue-400 to-blue-600 border border-blue-300" },
    { color: 'green', left: 100, bottom: 80, pulse: "steadyPulseGreen 2s infinite ease-in-out", bg: "bg-gradient-to-b from-emerald-400 to-emerald-600 border border-emerald-300" },
    { color: 'yellow', left: 170, bottom: 120, pulse: "steadyPulseYellow 2s infinite ease-in-out", bg: "bg-gradient-to-b from-amber-400 to-amber-600 border border-amber-300" },
    { color: 'red', left: 240, bottom: 160, pulse: "steadyPulseRed 2s infinite ease-in-out", bg: "bg-gradient-to-b from-rose-400 to-rose-600 border border-rose-300" }
  ];

  const isMainLogoGlowing = phase === 7 || phase === 8;

  return (
    <div className="fixed inset-0 min-h-screen bg-slate-950 flex flex-col items-center justify-center overflow-hidden z-[9999] select-none">
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
      `}</style>

      {/* Blurred Background Image - Rajwada Palace Indore */}
      <div 
        className="absolute inset-0 bg-cover bg-center scale-105 filter blur-[12px] opacity-35 mix-blend-lighten"
        style={{ 
          backgroundImage: `url('https://images.unsplash.com/photo-1627308595229-7830a5c91f9f?q=80&w=1200&auto=format&fit=crop')` 
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-950/40" />

      <div className="relative flex flex-col items-center justify-center font-sans text-center z-10 max-w-md w-full px-6">
        
        {/* Fixed gold-bordered brand logo at top center */}
        <motion.div
          animate={{
            boxShadow: isMainLogoGlowing
              ? "0 0 60px rgba(255, 215, 0, 1), inset 0 0 30px rgba(255, 215, 0, 0.7)"
              : "0 0 15px rgba(255, 215, 0, 0.35), inset 0 0 10px rgba(255, 215, 0, 0.15)",
            borderColor: isMainLogoGlowing ? "#fffbcf" : "#ffd700",
            scale: isMainLogoGlowing ? [1, 1.15, 1.08] : 1
          }}
          transition={{
            duration: isMainLogoGlowing ? 0.8 : 0.8,
            ease: "easeInOut"
          }}
          className="w-24 h-24 rounded-3xl bg-slate-900 border-2 flex items-center justify-center p-3 relative mb-8 shadow-2xl"
        >
          <div className="absolute inset-0.5 rounded-[22px] border border-amber-500/25 pointer-events-none" />
          {!imgError ? (
            <img 
              src={LogoIcon} 
              alt="zomindia brand" 
              className="w-[68px] h-[68px] object-contain"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="text-[#ffd700] text-3xl font-black">Z</span>
          )}
        </motion.div>

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

          {/* Gold splash burst when landing on Red step (phase 7) */}
          {phase === 7 && (
            <motion.div
              initial={{ scale: 0.1, opacity: 1 }}
              animate={{ scale: 2.2, opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="absolute w-14 h-14 bg-amber-400 rounded-full blur-md pointer-events-none"
              style={{
                left: "241px", // Centered near the red step center (240 + 28 - 28)
                bottom: "167px", // Centered on the red step top (160 + 7)
              }}
            />
          )}

          {/* Moving Element: Smaller Zomindia logo with gold glow */}
          <motion.div
            animate={getJumperAnimation()}
            transition={getJumperTransition()}
            className="absolute w-10 h-10 rounded-xl bg-slate-900/95 border border-[#ffd700] flex items-center justify-center p-1.5 shadow-[0_0_15px_rgba(255,215,0,0.65)]"
          >
            {!imgError ? (
              <img 
                src={LogoIcon} 
                alt="zomindia mini" 
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
              />
            ) : (
              <span className="text-[#ffd700] text-lg font-black leading-none">Z</span>
            )}
          </motion.div>
        </div>

        {/* Brand Shield & Info */}
        <div className="space-y-2 mt-4 text-center">
          <h2 className="text-white text-sm font-black uppercase tracking-[0.25em] flex items-center justify-center gap-2">
            <Shield className="text-[#ffd700] w-4 h-4 fill-[#ffd700]/15" />
            Zomindia Trust Shield
          </h2>
          <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] opacity-80 min-h-[16px]">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * A highly reusable, beautifully responsive inline spinner using multi-ring CSS-motion 
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
        <motion.div 
          className={`absolute inset-0 rounded-full border-solid ${sizeClasses[size]} ${ringColorClasses}`}
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, ease: "linear", duration: 0.8 }}
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
        className="w-full h-full object-contain select-none z-0 animate-pulse"
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

