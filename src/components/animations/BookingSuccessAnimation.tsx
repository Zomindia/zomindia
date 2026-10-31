import React from 'react';
import { motion } from 'motion/react';
import { Check, ShieldCheck, Sparkles } from 'lucide-react';

interface BookingSuccessAnimationProps {
  title?: string;
  subtitle?: string;
  bookingId?: string;
  serviceName?: string;
  onComplete?: () => void;
  fullScreen?: boolean;
}

const CONFETTI_PARTICLES = [
  { id: 1, x: -78, y: -68, color: '#10b981', size: 8, rotate: 45, delay: 0.05 },
  { id: 2, x: 82, y: -64, color: '#3b82f6', size: 7, rotate: -35, delay: 0.08 },
  { id: 3, x: -94, y: 12, color: '#f59e0b', size: 9, rotate: 20, delay: 0.1 },
  { id: 4, x: 96, y: 18, color: '#ec4899', size: 8, rotate: -60, delay: 0.12 },
  { id: 5, x: -58, y: 74, color: '#6366f1', size: 7, rotate: 55, delay: 0.14 },
  { id: 6, x: 64, y: 72, color: '#10b981', size: 8, rotate: -25, delay: 0.16 },
  { id: 7, x: 0, y: -92, color: '#f59e0b', size: 6, rotate: 15, delay: 0.06 },
  { id: 8, x: -38, y: -84, color: '#06b6d4', size: 7, rotate: -40, delay: 0.09 },
  { id: 9, x: 42, y: -82, color: '#8b5cf6', size: 8, rotate: 30, delay: 0.11 },
  { id: 10, x: -84, y: -32, color: '#34d399', size: 6, rotate: -15, delay: 0.13 },
  { id: 11, x: 86, y: -28, color: '#fbbf24', size: 7, rotate: 50, delay: 0.15 },
  { id: 12, x: 0, y: 88, color: '#3b82f6', size: 6, rotate: -45, delay: 0.17 },
];

export default function BookingSuccessAnimation({
  title = 'Booking Confirmed!',
  subtitle = 'Your verified Indore professional is being assigned.',
  bookingId,
  serviceName,
  onComplete,
  fullScreen = false,
}: BookingSuccessAnimationProps) {
  const content = (
    <div className="flex flex-col items-center justify-center text-center p-6 sm:p-8 select-none">
      {/* Vector Checkmark + Confetti Burst Stage */}
      <div className="relative w-32 h-32 flex items-center justify-center mb-5">
        {/* Outer Expanding Emerald Pulse Rings */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0.8 }}
          animate={{ scale: 1.75, opacity: 0 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
          className="absolute inset-4 rounded-full bg-emerald-400/25 pointer-events-none"
        />
        <motion.div
          initial={{ scale: 0.7, opacity: 0.6 }}
          animate={{ scale: 1.45, opacity: 0 }}
          transition={{ duration: 1.4, delay: 0.35, repeat: Infinity, ease: 'easeOut' }}
          className="absolute inset-4 rounded-full bg-teal-400/25 pointer-events-none"
        />

        {/* Vector Confetti Particles */}
        {CONFETTI_PARTICLES.map((p) => (
          <motion.span
            key={p.id}
            initial={{ x: 0, y: 0, scale: 0, rotate: 0, opacity: 1 }}
            animate={{
              x: p.x,
              y: p.y,
              scale: [0, 1.25, 0.9],
              rotate: p.rotate,
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 1.15,
              delay: p.delay,
              repeat: Infinity,
              repeatDelay: 0.8,
              ease: 'easeOut',
            }}
            style={{
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
            }}
            className="absolute rounded-xs pointer-events-none shadow-2xs"
          />
        ))}

        {/* Main Animated Checkmark Badge */}
        <motion.div
          initial={{ scale: 0.3, rotate: -15, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 16 }}
          className="relative z-10 w-22 h-22 rounded-3xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-xl shadow-emerald-500/30 ring-4 ring-emerald-50"
        >
          <svg
            viewBox="0 0 52 52"
            className="w-12 h-12 text-white overflow-visible"
            fill="none"
          >
            <motion.circle
              cx="26"
              cy="26"
              r="22"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="2.5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            />
            <motion.path
              d="M15 27.5L22.5 35L37.5 18.5"
              stroke="currentColor"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.4, delay: 0.2, ease: 'easeOut' }}
            />
          </svg>
        </motion.div>
      </div>

      {/* Verified Pill */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-widest mb-2.5"
      >
        <ShieldCheck size={13} className="text-emerald-600" />
        <span>100% Verified Zomindia Dispatch</span>
      </motion.div>

      <motion.h3
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight"
      >
        {title}
      </motion.h3>

      {serviceName && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-xs font-extrabold text-blue-600 mt-1 flex items-center justify-center gap-1"
        >
          <Sparkles size={12} />
          <span>{serviceName}</span>
          {bookingId ? (
            <span className="font-mono text-slate-500">
              • #{bookingId.slice(-6).toUpperCase()}
            </span>
          ) : null}
        </motion.p>
      )}

      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-xs sm:text-sm text-slate-500 font-medium max-w-xs mx-auto mt-2 leading-relaxed"
      >
        {subtitle}
      </motion.p>

      {onComplete && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          onClick={onComplete}
          className="mt-6 w-full max-w-xs py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
        >
          <Check size={15} strokeWidth={3} />
          <span>Track Live Status</span>
        </motion.button>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 16 }}
          className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden"
        >
          {content}
        </motion.div>
      </div>
    );
  }

  return content;
}
