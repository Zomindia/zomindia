import React from "react";
import PartnerTrackingMap, { PartnerTrackingMapProps } from "./PartnerTrackingMap";
import { X, ShieldCheck, Navigation } from "lucide-react";

export interface CustomerLiveTrackerProps extends PartnerTrackingMapProps {
  isOpen?: boolean;
  onClose?: () => void;
  status?: string;
  customerAddress?: string;
}

export default function CustomerLiveTracker({
  isOpen = true,
  onClose,
  partnerId,
  bookingLocation,
  destinationAddress,
  customerAddress,
  bookingId,
  serviceName,
  onCall,
  onChat,
  status,
  heightClassName = "h-[420px] sm:h-[460px]",
}: CustomerLiveTrackerProps) {
  if (!isOpen) return null;

  const targetAddress = customerAddress || destinationAddress;

  return (
    <div className="w-full space-y-3 select-none">
      {/* Tracker Header Bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
            <Navigation size={14} className="animate-pulse" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
              Live Partner Tracking
            </h4>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Real-Time GPS Sync</span>
              {status && (
                <>
                  <span>•</span>
                  <span className="text-blue-600 uppercase font-black">{status}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center text-xs transition-colors cursor-pointer"
            title="Close Live Tracker"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Main Full-Bleed Map Canvas with Glass Floating Pill and Bottom Action Bar */}
      <PartnerTrackingMap
        partnerId={partnerId}
        bookingLocation={bookingLocation}
        destinationAddress={targetAddress}
        bookingId={bookingId}
        serviceName={serviceName}
        onCall={onCall}
        onChat={onChat}
        heightClassName={heightClassName}
      />

      {/* Safety & Trust Badge */}
      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-150 text-[11px] text-slate-600 font-medium">
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={13} className="text-emerald-600 shrink-0" />
          <span>Background verified professional with encrypted communication.</span>
        </div>
      </div>
    </div>
  );
}
