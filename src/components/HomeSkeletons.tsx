import React from 'react';

/**
 * Skeleton placeholder for the promotional hero carousel / banner
 */
export function SkeletonHeroBanner() {
  return (
    <div className="relative overflow-hidden bg-slate-900/90 rounded-[32px] min-h-[320px] md:min-h-[380px] py-10 px-6 sm:px-12 flex flex-col items-center justify-center text-center shadow-xl border border-slate-800/40 select-none">
      {/* Gliding Shimmer Effect */}
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent pointer-events-none" />
      
      {/* Top pill placeholder */}
      <div className="w-48 h-6 bg-white/10 rounded-full mb-6 animate-pulse" />
      
      {/* Main Title placeholder */}
      <div className="w-3/4 max-w-xl h-10 sm:h-14 bg-white/15 rounded-2xl mb-4" />
      <div className="w-1/2 max-w-md h-5 sm:h-6 bg-white/10 rounded-xl mb-8" />
      
      {/* Search Bar placeholder */}
      <div className="w-full max-w-2xl h-14 sm:h-16 bg-white/20 rounded-[24px] border border-white/10 flex items-center justify-between p-2">
        <div className="w-48 h-5 bg-white/20 rounded-lg ml-4" />
        <div className="w-12 h-12 bg-white/25 rounded-xl shrink-0" />
      </div>
    </div>
  );
}

/**
 * Skeleton placeholder for the Category Grid items (7 columns on desktop, 4 on mobile)
 */
export function SkeletonCategoryGrid({ count = 14 }: { count?: number }) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-y-6 sm:gap-y-10 gap-x-2 sm:gap-x-4 items-center justify-items-center relative z-10 w-full">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col items-center w-full select-none">
          {/* Circular/rounded card placeholder */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-slate-100/90 rounded-[24px] sm:rounded-[30px] flex items-center justify-center mb-2 sm:mb-3 border border-slate-200/60 relative overflow-hidden shadow-sm">
            {/* Shimmer line */}
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-white/70 to-transparent pointer-events-none" />
            <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full bg-slate-200/60 animate-pulse" />
          </div>
          {/* Text title label line */}
          <div className="w-12 sm:w-16 h-3 bg-slate-200/80 rounded-full animate-pulse mt-1" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton placeholder for Service Cards (matches Popular / Top Rated services layout)
 */
export function SkeletonServiceCardGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 px-1 w-full">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="bg-white rounded-[20px] sm:rounded-[28px] border border-slate-100 p-3 sm:p-5 flex flex-col justify-between text-left relative overflow-hidden h-full shadow-sm select-none"
        >
          {/* Gliding Shimmer Overlay */}
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-slate-100/60 to-transparent pointer-events-none" />

          <div className="flex flex-col w-full min-w-0">
            {/* Image block */}
            <div className="w-full aspect-[4/3] sm:aspect-square rounded-xl sm:rounded-2xl overflow-hidden mb-2.5 sm:mb-4 bg-slate-100 border border-slate-100/80 relative" />

            {/* Badges / Category row */}
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-12 h-3.5 bg-slate-100 rounded-md animate-pulse" />
              <div className="w-8 h-3.5 bg-slate-100 rounded-md animate-pulse" />
            </div>

            {/* Title line */}
            <div className="w-4/5 h-4 sm:h-5 bg-slate-200/80 rounded-lg mb-2 animate-pulse" />

            {/* Description lines */}
            <div className="space-y-1.5 mb-4">
              <div className="w-full h-3 bg-slate-100 rounded animate-pulse" />
              <div className="w-2/3 h-3 bg-slate-100 rounded animate-pulse" />
            </div>
          </div>

          {/* Price & Action footer */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-50 w-full mt-auto">
            <div className="space-y-1">
              <div className="w-10 h-2.5 bg-slate-100 rounded" />
              <div className="w-14 h-4 bg-slate-200 rounded" />
            </div>
            <div className="w-16 h-7 rounded-xl bg-blue-50/70 border border-blue-100/50" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton placeholder for Promotional carousel cards
 */
export function SkeletonPromoCards({ count = 3 }: { count?: number }) {
  return (
    <div className="flex gap-4 sm:gap-6 overflow-x-auto no-scrollbar pb-6 px-2 w-full">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="flex-shrink-0 w-[290px] bg-white border border-slate-150/85 rounded-[24px] p-5 relative overflow-hidden shadow-sm select-none"
        >
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-slate-100/60 to-transparent pointer-events-none" />
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="w-16 h-5 bg-emerald-50 rounded-lg border border-emerald-100" />
            <div className="w-20 h-5 bg-slate-100 rounded-lg" />
          </div>
          <div className="w-3/4 h-5 bg-slate-200 rounded-lg mb-2" />
          <div className="w-full h-3 bg-slate-100 rounded mb-1" />
          <div className="w-4/5 h-3 bg-slate-100 rounded mb-4" />
          <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
            <div className="w-24 h-3 bg-slate-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Full Root Home Bootstrap Skeleton combining Hero, Categories, Highlights, and Services
 * Renders instantly while Firebase Auth and initial Firestore subscriptions resolve.
 */
export function HomeBootstrapSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 select-none animate-in fade-in duration-300">
      {/* Top App Header Placeholder */}
      <div className="bg-white/95 border-b border-slate-100 h-16 sm:h-20 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-600/20 animate-pulse" />
          <div className="w-24 sm:w-32 h-5 bg-slate-200 rounded-lg" />
        </div>
        <div className="hidden md:flex items-center gap-6">
          <div className="w-16 h-4 bg-slate-100 rounded-md" />
          <div className="w-16 h-4 bg-slate-100 rounded-md" />
          <div className="w-16 h-4 bg-slate-100 rounded-md" />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100" />
          <div className="w-20 h-9 rounded-xl bg-blue-600/30" />
        </div>
      </div>

      <div className="space-y-10 sm:space-y-16">
        {/* Hero Placeholder */}
        <div className="bg-blue-700 py-10 md:py-14 px-4 sm:px-6 lg:px-8 relative overflow-hidden flex items-center justify-center">
          <div className="max-w-4xl mx-auto w-full text-center space-y-4">
            <div className="w-3/4 max-w-xl h-10 sm:h-14 bg-white/20 rounded-2xl mx-auto animate-pulse" />
            <div className="w-1/2 max-w-md h-5 bg-blue-100/30 rounded-xl mx-auto" />
            <div className="relative max-w-2xl mx-auto mt-6">
              <div className="w-full h-14 sm:h-16 bg-white rounded-[24px] shadow-2xl p-2 border border-white/20 flex items-center justify-between">
                <div className="w-48 h-4 bg-slate-200 rounded-md ml-4" />
                <div className="w-12 h-12 bg-blue-600 rounded-xl shrink-0" />
              </div>
            </div>
          </div>
        </div>

        {/* Content Container */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-12">
          {/* Category Section Skeleton */}
          <div className="-mt-20 sm:-mt-24 md:-mt-28 relative z-30">
            <div className="bg-white rounded-[40px] border border-slate-100 shadow-[0_24px_50px_-12px_rgba(15,23,42,0.03)] pt-6 px-4 sm:px-8 md:px-10 pb-12">
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
                <div className="w-36 h-6 bg-slate-200 rounded-lg animate-pulse" />
                <div className="w-48 h-8 bg-slate-100 rounded-full hidden sm:block" />
              </div>
              <SkeletonCategoryGrid count={14} />
            </div>
          </div>

          {/* Highlights Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-[32px] p-6 sm:p-8 border border-slate-100 shadow-sm relative overflow-hidden flex items-center justify-between"
              >
                <div className="space-y-3 flex-1">
                  <div className="w-20 h-4 bg-slate-100 rounded-full" />
                  <div className="w-36 h-6 bg-slate-200 rounded-lg" />
                  <div className="w-48 h-3.5 bg-slate-100 rounded" />
                </div>
                <div className="w-16 h-16 rounded-2xl bg-slate-100 shrink-0" />
              </div>
            ))}
          </div>

          {/* Popular Services Section Skeleton */}
          <div className="space-y-6">
            <div className="flex justify-between items-end px-1">
              <div className="space-y-1.5">
                <div className="w-40 h-6 bg-slate-200 rounded-lg animate-pulse" />
                <div className="w-64 h-3.5 bg-slate-100 rounded" />
              </div>
              <div className="w-16 h-6 bg-slate-100 rounded-lg" />
            </div>
            <SkeletonServiceCardGrid count={4} />
          </div>
        </div>
      </div>
    </div>
  );
}
