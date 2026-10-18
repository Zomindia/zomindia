import React from 'react';
import { motion } from 'motion/react';
import { Star, ArrowRight } from 'lucide-react';
import { Service } from '../types';

interface ServiceCardProps {
  service: Service;
  categoryName?: string;
  onSelect: (serviceId: string) => void;
  idx?: number;
  className?: string;
}

export const getCategoryBadgeClass = (categoryName?: string) => {
  const lower = (categoryName || '').toLowerCase();
  if (lower.includes('ac') || lower.includes('cool') || lower.includes('air') || lower.includes('freeze')) {
    return 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200/70';
  }
  if (lower.includes('clean') || lower.includes('wash') || lower.includes('maid') || lower.includes('pest')) {
    return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70';
  }
  if (lower.includes('electr') || lower.includes('wire') || lower.includes('power') || lower.includes('light')) {
    return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/70';
  }
  if (lower.includes('plumb') || lower.includes('pipe') || lower.includes('water') || lower.includes('ro') || lower.includes('leak')) {
    return 'bg-blue-50 text-blue-700 ring-1 ring-blue-200/70';
  }
  return 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/60';
};

export default function ServiceCard({
  service,
  categoryName,
  onSelect,
  idx = 0,
  className = '',
}: ServiceCardProps) {
  const originalMrp = (service as any).originalPrice || (service as any).mrp || Math.round(service.basePrice * 1.25);
  const ratingValue = Number(service.rating || 4.8).toFixed(1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.25, delay: idx * 0.04 }}
      className={`bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-3 sm:p-4 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl hover:border-blue-200/80 cursor-pointer group flex flex-col justify-between text-left shadow-xs ${className}`}
      onClick={() => onSelect(service.id)}
    >
      <div className="flex flex-col w-full min-w-0">
        {/* Exact Dimensions & Media Frame with Zomato/Swiggy Rating Badge */}
        <div className="w-full aspect-[4/3] rounded-xl sm:rounded-2xl overflow-hidden mb-2.5 sm:mb-3 bg-slate-100 relative shadow-inner">
          <img
            src={
              service.imageURL ||
              'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&q=80&w=400'
            }
            alt={service.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
            referrerPolicy="no-referrer"
            loading="lazy"
          />
          {/* Zomato-style emerald green rating pill */}
          <div className="absolute top-2 left-2 bg-emerald-600 text-white font-bold text-xs px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-sm backdrop-blur-xs z-10 select-none">
            <Star size={10} className="fill-white text-white shrink-0" />
            <span>{ratingValue}</span>
          </div>
        </div>

        {/* Category Tag: Vibrant Mini-Pill Badge */}
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider inline-flex items-center gap-1 w-fit mb-1.5 ${getCategoryBadgeClass(
            categoryName
          )}`}
        >
          {categoryName || 'Home Service'}
        </span>

        {/* Title: High-Contrast Dark Slate with Smooth Blue Hover Transition */}
        <h4 className="text-slate-900 font-extrabold text-sm sm:text-base line-clamp-1 group-hover:text-blue-600 transition-colors duration-200 leading-snug">
          {service.name}
        </h4>

        {/* Description: Clean and readable */}
        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 mb-2.5 font-medium leading-relaxed">
          {service.description}
        </p>
      </div>

      {/* Price Section & Zomato/Swiggy Gradient "Book" Button */}
      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
        <div className="min-w-0">
          <span className="text-[10px] font-medium text-slate-400 tracking-wider uppercase block leading-tight mb-0.5">
            STARTS AT
          </span>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-emerald-600 font-black text-base tracking-tight">
              ₹{service.basePrice}
            </span>
            {originalMrp > service.basePrice && (
              <span className="text-[11px] text-slate-400 line-through font-semibold">
                ₹{originalMrp}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(service.id);
          }}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs py-1.5 px-3.5 rounded-lg shadow-md hover:shadow-blue-500/25 active:scale-95 transition-all duration-200 flex items-center gap-1 shrink-0 cursor-pointer select-none"
        >
          <span>Book</span>
          <ArrowRight size={12} className="stroke-[3]" />
        </button>
      </div>
    </motion.div>
  );
}
