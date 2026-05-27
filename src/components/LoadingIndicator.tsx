import { motion } from 'motion/react';
import { Sparkles, Shield, Compass, CheckCircle } from 'lucide-react';

/**
 * Premium full-screen loading overlay with modern radial ambient glow, 
 * rotating multi-layer rings, pulsing logo, and clean staggered loading subtitles.
 */
export function LoadingScreen({ 
  message = "Initializing zomindia pro services..." 
}: { 
  message?: string 
}) {
  return (
    <div className="fixed inset-0 min-h-screen bg-slate-900 flex flex-col items-center justify-center overflow-hidden z-50 select-none">
      {/* Dynamic ambient radial gradients */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] animate-pulse delay-1000" />
      
      <div className="relative flex flex-col items-center max-w-sm px-6 text-center">
        {/* Modern Rotating Outer Rings */}
        <div className="relative w-28 h-28 mb-8 flex items-center justify-center">
          {/* Outermost dotted circular path */}
          <motion.div 
            className="absolute inset-0 rounded-full border-2 border-dashed border-indigo-500/30"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, ease: "linear", duration: 15 }}
          />
          
          {/* Middle glowing gradient arc */}
          <motion.div 
            className="absolute inset-2 rounded-full border-t-2 border-b-2 border-transparent border-t-indigo-400 border-b-blue-400"
            animate={{ rotate: -360 }}
            transition={{ repeat: Infinity, ease: "linear", duration: 3 }}
          />

          {/* Innermost gradient pulsing halo */}
          <motion.div 
            className="absolute inset-4 rounded-full bg-gradient-to-tr from-indigo-500/10 to-blue-500/10 filter blur-[4px]"
            animate={{ scale: [0.95, 1.05, 0.95] }}
            transition={{ repeat: Infinity, ease: "easeInOut", duration: 2 }}
          />

          {/* Premium zomindia 'Z' Logo Shield */}
          <motion.div 
            className="absolute w-14 h-14 bg-gradient-to-br from-[#050CA6] to-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/40 border border-indigo-400/30"
            initial={{ scale: 0.8, rotate: -15 }}
            animate={{ 
              scale: [1, 1.08, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ 
              repeat: Infinity, 
              duration: 3, 
              ease: "easeInOut" 
            }}
          >
            <span className="font-sans font-black tracking-tighter text-white text-3xl">Z</span>
          </motion.div>
        </div>

        {/* Loading Indicators & Progress */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/50 backdrop-blur-md shadow-inner">
            <motion.div 
              className="w-1.5 h-1.5 rounded-full bg-indigo-400"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 1, delay: 0 }}
            />
            <motion.div 
              className="w-1.5 h-1.5 rounded-full bg-blue-400"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
            />
            <motion.div 
              className="w-1.5 h-1.5 rounded-full bg-emerald-400"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
            />
            <span className="text-[10px] uppercase tracking-widest font-black text-slate-400 font-mono ml-1">Secure Load</span>
          </div>

          <p className="text-slate-100 font-sans text-lg font-bold tracking-tight px-1 italic">
            {message}
          </p>
          
          {/* Subtle micro-badges swapping gracefully */}
          <div className="flex items-center justify-center gap-4 text-[11px] text-slate-400 font-medium">
            <span className="flex items-center gap-1"><Shield size={12} className="text-indigo-400" /> Insured Pros</span>
            <span className="w-1 h-1 rounded-full bg-slate-700" />
            <span className="flex items-center gap-1"><Sparkles size={12} className="text-amber-400" /> Premium Care</span>
          </div>
        </motion.div>
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
