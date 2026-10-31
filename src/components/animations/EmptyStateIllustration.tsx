import React from 'react';
import { motion } from 'motion/react';
import { Calendar, Bell, Sparkles, ArrowRight } from 'lucide-react';

interface EmptyStateIllustrationProps {
  type?: 'bookings' | 'notifications' | 'history';
  title?: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyStateIllustration({
  type = 'bookings',
  title,
  subtitle,
  actionLabel,
  onAction,
}: EmptyStateIllustrationProps) {
  const resolvedTitle =
    title ||
    (type === 'notifications'
      ? 'Your Inbox is Sparkling Clean!'
      : type === 'history'
      ? 'No Matching Service History'
      : 'No Active Bookings Right Now');

  const resolvedSubtitle =
    subtitle ||
    (type === 'notifications'
      ? 'We will notify you immediately when your technician is on the way or your service is updated.'
      : type === 'history'
      ? 'Completed and past doorstep service appointments will appear here.'
      : 'Your upcoming and in-progress doorstep appointments will appear here with live GPS tracking.');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white border-2 border-dashed border-slate-200/90 rounded-[32px] p-8 sm:p-10 text-center my-4 flex flex-col items-center justify-center max-w-2xl mx-auto shadow-2xs relative overflow-hidden"
    >
      {/* Subtle Ambient Vector Glow */}
      <div className="absolute -top-12 -right-12 w-36 h-36 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Animated Vector Graphic */}
      <div className="relative w-24 h-24 flex items-center justify-center mb-4">
        <motion.div
          animate={{ scale: [1, 1.08, 1], rotate: [0, 3, -3, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-50 via-indigo-50 to-slate-50 border border-blue-100/80 flex items-center justify-center shadow-inner relative"
        >
          {/* Animated SVG Rings & Vector Clipboard/Bell */}
          <svg
            viewBox="0 0 64 64"
            className="w-11 h-11 text-blue-600"
            fill="none"
          >
            <motion.circle
              cx="32"
              cy="32"
              r="26"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              className="text-blue-200"
              animate={{ rotate: 360 }}
              transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
              style={{ transformOrigin: '32px 32px' }}
            />
            {type === 'notifications' ? (
              <motion.path
                d="M32 16C25.373 16 20 21.373 20 28V35L17 39V41H47V39L44 35V28C44 21.373 38.627 16 32 16ZM28 44C28 46.209 29.791 48 32 48C34.209 48 36 46.209 36 44H28Z"
                stroke="currentColor"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0.2 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
            ) : (
              <>
                <rect
                  x="18"
                  y="16"
                  width="28"
                  height="34"
                  rx="6"
                  stroke="currentColor"
                  strokeWidth="2.8"
                />
                <path
                  d="M25 14H39M24 27H40M24 34H35M24 41H31"
                  stroke="currentColor"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                />
              </>
            )}
          </svg>
        </motion.div>

        {/* Floating Vector Sparkle Badges */}
        <motion.div
          animate={{ y: [-3, 3, -3], scale: [0.95, 1.1, 0.95] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-1 -right-1 w-7 h-7 rounded-xl bg-amber-50 border border-amber-200 text-amber-500 flex items-center justify-center shadow-2xs"
        >
          <Sparkles size={13} />
        </motion.div>

        <motion.div
          animate={{ y: [3, -3, 3] }}
          transition={{ duration: 2.8, delay: 0.4, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-1 -left-1 w-7 h-7 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-2xs"
        >
          {type === 'notifications' ? <Bell size={12} /> : <Calendar size={12} />}
        </motion.div>
      </div>

      <h3 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">
        {resolvedTitle}
      </h3>
      <p className="text-xs sm:text-sm text-slate-500 mt-1.5 font-medium max-w-md mx-auto leading-relaxed">
        {resolvedSubtitle}
      </p>

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-sm transition-all active:scale-95 cursor-pointer inline-flex items-center gap-1.5"
        >
          <span>{actionLabel}</span>
          <ArrowRight size={14} />
        </button>
      )}
    </motion.div>
  );
}
