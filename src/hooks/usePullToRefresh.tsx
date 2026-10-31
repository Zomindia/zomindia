import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  maxPull?: number;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 65,
  maxPull = 115,
}: UsePullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startYRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const isRefreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    const getScrollTop = () => {
      return (
        window.scrollY ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0
      );
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (isRefreshingRef.current) return;
      if (getScrollTop() > 0) {
        startYRef.current = null;
        isPullingRef.current = false;
        return;
      }

      // Do not trigger pull-to-refresh when scrolling inside modals or nested scroll containers
      const target = e.target as HTMLElement | null;
      if (target && target.closest('[role="dialog"], [aria-modal="true"], .overscroll-contain')) {
        startYRef.current = null;
        isPullingRef.current = false;
        return;
      }

      const touch = e.touches[0];
      if (!touch) return;

      startYRef.current = touch.clientY;
      startXRef.current = touch.clientX;
      isPullingRef.current = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPullingRef.current || startYRef.current === null || isRefreshingRef.current) {
        return;
      }

      if (getScrollTop() > 0) {
        isPullingRef.current = false;
        startYRef.current = null;
        if (pullDistanceRef.current > 0) {
          pullDistanceRef.current = 0;
          setPullDistance(0);
        }
        return;
      }

      const touch = e.touches[0];
      if (!touch) return;

      const deltaY = touch.clientY - startYRef.current;
      const deltaX = startXRef.current !== null ? Math.abs(touch.clientX - startXRef.current) : 0;

      // If user is swiping horizontally more than vertically, ignore pull-to-refresh
      if (deltaX > Math.abs(deltaY) && pullDistanceRef.current === 0) {
        isPullingRef.current = false;
        startYRef.current = null;
        return;
      }

      if (deltaY > 0) {
        // Apply smooth rubber-band resistance curve
        const damped = Math.min(maxPull, deltaY * 0.52);
        pullDistanceRef.current = damped;
        setPullDistance(damped);
      } else if (pullDistanceRef.current > 0) {
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
    };

    const finishPull = async () => {
      if (!isPullingRef.current) return;
      isPullingRef.current = false;
      startYRef.current = null;
      startXRef.current = null;

      const currentPull = pullDistanceRef.current;
      if (currentPull >= threshold && !isRefreshingRef.current) {
        isRefreshingRef.current = true;
        setIsRefreshing(true);
        pullDistanceRef.current = threshold;
        setPullDistance(threshold);

        try {
          await Promise.all([
            Promise.resolve(onRefreshRef.current()),
            new Promise((resolve) => setTimeout(resolve, 550)),
          ]);
        } catch (err) {
          console.warn('[PullToRefresh] Refresh error:', err);
        } finally {
          isRefreshingRef.current = false;
          setIsRefreshing(false);
          pullDistanceRef.current = 0;
          setPullDistance(0);
        }
      } else {
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', finishPull, { passive: true });
    window.addEventListener('touchcancel', finishPull, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', finishPull);
      window.removeEventListener('touchcancel', finishPull);
    };
  }, [threshold, maxPull]);

  return {
    pullDistance,
    isRefreshing,
    isReadyToRefresh: pullDistance >= threshold,
  };
}

export const PullToRefreshIndicator: React.FC<{
  pullDistance: number;
  isRefreshing: boolean;
  threshold?: number;
}> = ({ pullDistance, isRefreshing, threshold = 65 }) => {
  if (pullDistance <= 4 && !isRefreshing) return null;

  const progress = Math.min(1, pullDistance / threshold);
  const translateY = isRefreshing ? 16 : Math.min(pullDistance - 28, 56);
  const rotation = Math.round(progress * 300);

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9990] flex justify-center pointer-events-none"
      style={{
        transform: `translate3d(0, ${translateY}px, 0)`,
        opacity: isRefreshing ? 1 : Math.min(1, Math.max(0.15, progress)),
        transition: isRefreshing || pullDistance === 0 ? 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.22s ease' : 'none',
      }}
      aria-live="polite"
    >
      <div className="w-10 h-10 rounded-full bg-white shadow-lg border border-slate-200/90 flex items-center justify-center text-blue-600">
        <RefreshCw
          size={18}
          className={isRefreshing ? 'animate-spin text-blue-600' : 'text-blue-600 transition-transform duration-75'}
          style={!isRefreshing ? { transform: `rotate(${rotation}deg)` } : undefined}
        />
      </div>
    </div>
  );
};
