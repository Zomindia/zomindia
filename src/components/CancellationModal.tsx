import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ShieldAlert,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { Booking } from "../types";

export interface CancellationModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onConfirmCancel: (booking: Booking, reason: string) => Promise<void>;
  secondsRemaining?: number;
  onOpenSupport?: (booking: Booking) => void;
}

const DEFAULT_REASONS = [
  "Booked by mistake",
  "Need different time slot",
  "Price issue",
  "Found another service",
  "Technician taking too long",
  "Other",
];

const CancellationModalDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  booking: Booking;
  onConfirmCancel: (booking: Booking, reason: string) => Promise<void>;
  secondsRemaining?: number;
  onOpenSupport?: (booking: Booking) => void;
}> = ({
  isOpen,
  onClose,
  booking,
  onConfirmCancel,
  secondsRemaining = 0,
  onOpenSupport,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>("Booked by mistake");
  const [customReason, setCustomReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedReason("Booked by mistake");
    setCustomReason("");
    setIsSubmitting(false);
    setError(null);
  }, [booking?.id]);

  const shortBookingId = booking.id ? booking.id.slice(-6).toUpperCase() : "ZOMINDIA";
  const serviceName = (booking as any)?.serviceName || "Service Booking";
  const bookingTotal = booking.totalPrice || (booking as any)?.totalAmount || 345;
  const isFreeWindowActive = secondsRemaining > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason =
      selectedReason === "Other"
        ? customReason.trim() || "Cancelled by customer (Other)"
        : selectedReason;

    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirmCancel(booking, finalReason);
      onClose();
    } catch (err: any) {
      console.error("[CancellationModal] Error cancelling booking:", err);
      setError(err?.message || "Failed to cancel booking. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleSupportClick = () => {
    onClose();
    if (onOpenSupport) {
      onOpenSupport(booking);
    } else if (typeof (window as any).__openSupportChat === "function") {
      (window as any).__openSupportChat(booking);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={!isSubmitting ? onClose : undefined}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
        />

        {/* Modal Sheet */}
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.96 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={16} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 leading-tight">
                  Cancel Booking
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  #{shortBookingId} • {serviceName} • ₹{bookingTotal}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
              title="Close"
            >
              <X size={15} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
            {/* Live Grace Period Badge */}
            {isFreeWindowActive ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-900 shadow-2xs">
                <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Clock size={13} className="animate-spin" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 font-black text-emerald-950 text-xs">
                    <span>100% Free Instant Cancellation</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-200 text-emerald-900 text-[10px] font-bold">
                      {secondsRemaining}s left
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed mt-0.5">
                    Zero cancellation penalty. 100% of any advance payment is credited back immediately.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-950 shadow-2xs">
                <div className="w-6 h-6 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldAlert size={13} />
                </div>
                <div>
                  <span className="font-extrabold text-xs block text-amber-950">
                    Partner Allocation in Progress
                  </span>
                  <p className="text-[11px] text-amber-900 leading-relaxed mt-0.5">
                    Our team is already dedicating a certified technician in your Indore sector. If you need a different time or want help, Priority Support can reschedule this for free.
                  </p>
                  <button
                    type="button"
                    onClick={handleSupportClick}
                    className="mt-2 text-[11px] font-bold text-amber-900 hover:text-amber-950 bg-amber-200/80 hover:bg-amber-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <MessageSquare size={11} />
                    <span>Chat with Priority Support Instead</span>
                    <ArrowRight size={10} />
                  </button>
                </div>
              </div>
            )}

            {/* Reason Selection */}
            <div>
              <label className="block text-xs font-black text-slate-800 mb-2 uppercase tracking-wider">
                Please select a cancellation reason:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DEFAULT_REASONS.map((reason) => {
                  const isSelected = selectedReason === reason;
                  return (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setSelectedReason(reason)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border text-left transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? "bg-rose-50 border-rose-400 text-rose-900 shadow-xs"
                          : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                      }`}
                    >
                      <span className="truncate">{reason}</span>
                      {isSelected && (
                        <CheckCircle2 size={13} className="text-rose-600 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedReason === "Other" && (
                <textarea
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Please specify your reason..."
                  rows={2}
                  className="mt-2.5 w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-rose-500 font-medium"
                />
              )}
            </div>

            {error && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 flex items-center gap-2.5">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl font-bold text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer text-center"
              >
                Don't Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-xl font-black text-xs text-white bg-rose-600 hover:bg-rose-700 active:scale-95 transition-all shadow-md shadow-rose-600/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <span>Confirm Cancellation</span>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export const CancellationModal: React.FC<CancellationModalProps> = (props) => {
  if (!props.isOpen || !props.booking) return null;
  return <CancellationModalDialog {...props} booking={props.booking} />;
};

export default CancellationModal;
