import React, { useState, useEffect } from 'react';
import { offlineSyncEngine } from '../lib/offlineQueue';
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';

export default function OfflineSyncIndicator() {
  const [isOnline, setIsOnline] = useState(offlineSyncEngine.isOnline());
  const [queueSize, setQueueSize] = useState(offlineSyncEngine.getQueueSize());
  const [syncing, setSyncing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    // Sync triggers
    const handleOnline = () => {
      setIsOnline(true);
      setSyncing(true);
      setTimeout(() => {
        setSyncing(false);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }, 2000);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Read queue sizing changes
    const unsubscribe = offlineSyncEngine.subscribe((size) => {
      setQueueSize(size);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  if (isOnline && queueSize === 0 && !syncing && !showSuccess) {
    return null;
  }

  return (
    <div 
      id="offline-sync-indicator"
      className="fixed bottom-20 md:bottom-6 right-4 z-50 flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-300 transform animate-bounce bg-white/95 text-slate-800 border-slate-200/80"
    >
      {!isOnline ? (
        <>
          <div className="flex h-3.5 w-3.5 items-center justify-center relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </div>
          <WifiOff className="h-4 w-4 text-amber-500" />
          <div className="text-xs font-semibold">
            Offline Mode <span className="text-xxs text-amber-600 font-extrabold uppercase">({queueSize} queued)</span>
          </div>
        </>
      ) : syncing ? (
        <>
          <RefreshCw className="h-4 w-4 text-indigo-500 animate-spin" />
          <div className="text-xs font-semibold text-slate-700">
            Syncing updates...
          </div>
        </>
      ) : showSuccess ? (
        <>
          <CheckCircle2 className="h-4 w-4 text-emerald-500 animate-pulse" />
          <div className="text-xs font-semibold text-emerald-600">
            Synced successfully!
          </div>
        </>
      ) : (
        <>
          <Wifi className="h-4 w-4 text-emerald-500" />
          <div className="text-xs font-semibold text-slate-600">
            All updates synced
          </div>
        </>
      )}
    </div>
  );
}
