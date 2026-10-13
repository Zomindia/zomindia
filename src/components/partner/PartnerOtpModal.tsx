import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShieldCheck, Lock } from "lucide-react";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";

export interface PartnerOtpModalProps {
  isOpen: boolean;
  bookingId: string | null;
  expectedOtp?: string;
  onClose: () => void;
  onSuccess: (bookingId: string) => Promise<void> | void;
}

/**
 * Strict Security Partner OTP Verification Modal
 * Strictly renders blank 4-digit numeric input boxes without previews, placeholders, or bypasses.
 */
export function PartnerOtpModal({
  isOpen,
  bookingId,
  expectedOtp,
  onClose,
  onSuccess,
}: PartnerOtpModalProps) {
  const [otpInput, setOtpInput] = useState("");
  const [otpError, setOtpError] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setOtpInput("");
      setOtpError(false);
      setLoading(false);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen, bookingId]);

  const handleVerify = async () => {
    if (!bookingId || otpInput.length < 4) return;
    setLoading(true);
    setOtpError(false);

    const cleanedInput = otpInput.trim();
    const targetOtp = (expectedOtp || "").trim();

    // Strict verification against stored OTP
    if (!targetOtp || targetOtp !== cleanedInput) {
      setOtpError(true);
      setLoading(false);
      return;
    }

    try {
      // Update Firestore directly on unified db
      const bRef = doc(db, "bookings", bookingId);
      await updateDoc(bRef, {
        status: "in_progress",
        otpVerified: true,
        updatedAt: Timestamp.now(),
      });

      await onSuccess(bookingId);
      onClose();
    } catch (err) {
      console.error("[PartnerOtpModal] Verification update error:", err);
      setOtpError(true);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !bookingId) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={`partner-otp-modal-${bookingId}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-md select-none"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-[36px] p-8 sm:p-10 w-full max-w-sm text-center shadow-2xl border border-slate-200"
        >
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner ring-4 ring-blue-500/10">
            <ShieldCheck size={32} />
          </div>

          <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-1">
            Service Security Lock
          </h3>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-6">
            Ask customer for the 4-digit OTP verbally
          </p>

          <div className="space-y-6">
            <motion.div
              animate={
                otpError
                  ? {
                      x: [-8, 8, -8, 8, -4, 4, -2, 2, 0],
                      scale: [1, 1.01, 0.99, 1],
                    }
                  : {}
              }
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="relative my-4"
            >
              <input
                ref={inputRef}
                autoFocus
                type="tel"
                maxLength={4}
                value={otpInput}
                onChange={(e) => {
                  setOtpError(false);
                  setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 4));
                }}
                className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer text-center"
                inputMode="numeric"
                autoComplete="one-time-code"
              />

              {/* 4 Blank Numeric Input Boxes - Strictly No Placeholders or Previews */}
              <div className="flex items-center justify-center gap-3">
                {[0, 1, 2, 3].map((idx) => {
                  const digit = otpInput[idx] || "";
                  const isCurrent = otpInput.length === idx;
                  return (
                    <div
                      key={idx}
                      className={`w-14 h-16 rounded-2xl border-2 flex items-center justify-center text-3xl font-black font-mono transition-all select-none ${
                        otpError
                          ? "border-rose-500 bg-rose-50/60 text-rose-600 shadow-rose-200"
                          : digit
                          ? "border-blue-600 bg-blue-50/40 text-slate-900 shadow-sm"
                          : isCurrent
                          ? "border-blue-500 bg-white ring-4 ring-blue-500/10"
                          : "border-slate-200 bg-slate-50 text-slate-400"
                      }`}
                    >
                      {digit ? digit : ""}
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {otpError && (
              <p className="text-[11px] font-black text-rose-500 uppercase tracking-wider animate-bounce">
                Incorrect OTP. Please enter valid 4 digits.
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-4 text-slate-400 hover:text-slate-600 font-black uppercase tracking-wider text-xs rounded-2xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVerify}
                disabled={loading || otpInput.length < 4}
                className="flex-[2] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white py-4 rounded-2xl font-black uppercase tracking-wider text-xs shadow-lg shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
              >
                {loading ? "Verifying..." : "Verify & Unlock"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default PartnerOtpModal;
