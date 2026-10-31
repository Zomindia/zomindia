import React from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, MapPin } from 'lucide-react';

interface SearchingPartnerAnimationProps {
  variant?: 'default' | 'compact';
  locality?: string;
}

export default function SearchingPartnerAnimation({
  variant = 'default',
  locality = 'Indore',
}: SearchingPartnerAnimationProps) {
  if (variant === 'compact') {
    return (
      <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
        <motion.span
          animate={{ scale: [1, 1.65], opacity: [0.6, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
          className="absolute inset-0 rounded-full bg-blue-500/25 pointer-events-none"
        />
        <motion.span
          animate={{ scale: [1, 1.35], opacity: [0.5, 0] }}
          transition={{ duration: 1.6, delay: 0.4, repeat: Infinity, ease: 'easeOut' }}
          className="absolute inset-0 rounded-full bg-indigo-500/25 pointer-events-none"
        />
        <div className="relative z-10 w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
          <MapPin size={15} className="animate-bounce" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 p-4 sm:p-5 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white rounded-2xl border border-blue-200/70">
      {/* Pulsing Radar Beacon Vector */}
      <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
        {/* Outer Sonar Rings */}
        <motion.div
          animate={{ scale: [0.8, 1.75], opacity: [0.65, 0] }}
          transition={{ duration: 2.0, repeat: Infinity, ease: 'easeOut' }}
          className="absolute inset-2 rounded-full border-2 border-blue-500/40 bg-blue-400/10 pointer-events-none"
        />
        <motion.div
          animate={{ scale: [0.8, 1.45], opacity: [0.5, 0] }}
          transition={{ duration: 2.0, delay: 0.6, repeat: Infinity, ease: 'easeOut' }}
          className="absolute inset-2 rounded-full border border-indigo-500/40 bg-indigo-400/10 pointer-events-none"
        />

        {/* Rotating Radar Sweep */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-1 rounded-full pointer-events-none"
          style={{
            background:
              'conic-gradient(from 0deg, transparent 0deg, rgba(37, 99, 235, 0.28) 90deg, transparent 95deg)',
          }}
        />

        {/* Verified Technician Blips */}
        <motion.span
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white shadow-2xs"
        />
        <motion.span
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 1.8, delay: 0.5, repeat: Infinity }}
          className="absolute bottom-2 left-1.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white shadow-2xs"
        />

        {/* Center Beacon Core */}
        <div className="relative z-10 w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-600/25 ring-2 ring-white">
          <ShieldCheck size={18} />
        </div>
      </div>

      {/* Status Copy */}
      <div className="text-center sm:text-left min-w-0 flex-1">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-100/80 text-blue-800 text-[10px] font-black uppercase tracking-wider mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" />
          <span>Live Radar • {locality}</span>
        </div>
        <h5 className="font-black text-slate-900 text-sm sm:text-base leading-snug">
          Finding the best verified professional for you
        </h5>
        <p className="text-xs text-slate-600 font-medium mt-0.5 leading-relaxed">
          Matching your doorstep request with background-checked Indore specialists nearby.
        </p>
      </div>
    </div>
  );
}
