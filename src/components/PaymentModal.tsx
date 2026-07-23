import React, { useState } from 'react';
import { doc, updateDoc, Timestamp, getDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Booking, UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { motion, AnimatePresence } from 'motion/react';
import { X, CreditCard, Lock, ShieldCheck, AlertCircle, Smartphone, Wallet } from 'lucide-react';

declare const Razorpay: any;

const RAZORPAY_KEY_ID = (import.meta as any).env.VITE_RAZORPAY_KEY_ID || '';

interface PaymentModalProps {
  booking: Booking;
  profile: UserProfile;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PaymentModal({ booking, profile, onClose, onSuccess }: PaymentModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Auto-redirect if already requested to pay via wallet from booking modal?
  // No, if they chose wallet in booking modal it was stored as paymentMethod: 'wallet', but status is still 'unpaid'.
  
  const handleWalletPayment = async () => {
    if (!profile.walletBalance || profile.walletBalance < booking.totalPrice) {
      setError("Insufficient wallet balance.");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/pay-via-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id, userId: profile.uid }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to process wallet payment');
      }

      // Trigger final bill email
      try {
        await fetch('/api/send-final-bill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId: booking.id, requesterUid: profile.uid }),
        });
      } catch (billErr) {
        console.error("Failed to trigger final bill email:", billErr);
      }

      setShowSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 2500);

    } catch (err: any) {
       console.error("Wallet Payment Error:", err);
       setError(err.message || 'Wallet payment failed');
       setProcessing(false);
    }
  };

  const handleRazorpayPayment = async () => {
    if (!RAZORPAY_KEY_ID) {
      setError("Payment system is not configured. (Missing Key ID)");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // 1. Create order on server
      const response = await fetch('/api/create-razorpay-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: booking.totalPrice, bookingId: booking.id }),
      });

      const order = await response.json();

      if (!order.id) {
        throw new Error(order.error || 'Failed to create payment order');
      }

      // 2. Open Razorpay Checkout
      const options = {
        key: RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "zomindia",
        description: `Service Booking: ${booking.serviceId}`,
        order_id: order.id,
        handler: async function (response: any) {
          // This function executes after a successful payment
          try {
            await updateDoc(doc(db, 'bookings', booking.id), {
              paymentStatus: 'paid',
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
              status: 'completed',
              updatedAt: Timestamp.now()
            });

            // Credit the partner's earnings & rewards (including 20% surge rate to partner wallet)
            if (booking.partnerId) {
              const partnerRef = doc(db, 'partners', booking.partnerId);
              const partnerSnap = await getDoc(partnerRef);
              if (partnerSnap.exists()) {
                const partnerData = partnerSnap.data();
                const rewardPts = 10;
                
                // Determine if 20% surge rate applies (Removed)
                const creditAmount = booking.totalPrice;

                await updateDoc(partnerRef, {
                  totalEarnings: (partnerData.totalEarnings || 0) + creditAmount,
                  rewardCredits: (partnerData.rewardCredits || 0) + rewardPts,
                  updatedAt: Timestamp.now()
                });

                // Also update the partner's User profile walletBalance
                if (partnerData.userId) {
                  const partnerUserRef = doc(db, 'users', partnerData.userId);
                  const partnerUserSnap = await getDoc(partnerUserRef);
                  if (partnerUserSnap.exists()) {
                    await updateDoc(partnerUserRef, {
                      walletBalance: (partnerUserSnap.data()?.walletBalance || 0) + creditAmount,
                      updatedAt: Timestamp.now()
                    });
                  }
                }

                await addDoc(collection(db, 'partners', booking.partnerId, 'earningsHistory'), {
                  type: 'booking_earning',
                  amount: creditAmount,
                  credits: rewardPts,
                  bookingId: booking.id,
                  reason: `Completed service (Razorpay online)`,
                  createdAt: Timestamp.now()
                });
              }
            }

            // Trigger final bill email
            try {
              await fetch('/api/send-final-bill', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingId: booking.id, requesterUid: profile.uid }),
              });
            } catch (billErr) {
              console.error("Failed to trigger final bill email:", billErr);
            }

            setShowSuccess(true);
            setTimeout(() => {
              onSuccess();
            }, 2500);
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `bookings/${booking.id}`);
            setError('Payment succeeded but failed to update record. Please contact support.');
          }
        },
        prefill: {
          name: "", // Can add user name from profile if available
          email: "",
          contact: ""
        },
        theme: {
          color: "#1c1917"
        },
        modal: {
          ondismiss: function() {
            setProcessing(false);
          }
        }
      };

      const rzp = new Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        setError(response.error.description || 'Payment failed');
        setProcessing(false);
      });
      rzp.open();

    } catch (err: any) {
      console.error("Payment Error:", err);
      setError(err.message || 'Payment initialization failed');
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        // Disabled backdrop dismissal to prevent accidental screen close on keyboard mistouches (e.g. typing payment details)
        onClick={undefined}
        className="absolute inset-0 bg-blue-700/60 backdrop-blur-sm" 
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-white w-full max-w-lg rounded-[32px] md:rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <AnimatePresence>
          {showSuccess && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[110] bg-white flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mb-6 shadow-xl">
                <ShieldCheck size={40} />
              </div>
              <h3 className="text-3xl font-display font-bold text-slate-900 italic mb-2">Payment Confirmed</h3>
              <p className="text-slate-500 font-medium mb-8 leading-relaxed">Transaction successful! Your booking is now finalized.</p>
              <div className="w-12 h-1 bg-emerald-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                  className="w-full h-full bg-emerald-500"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-6 md:p-8 pb-4 flex justify-between items-center border-b border-slate-100 shrink-0">
          <h3 className="font-bold text-lg md:text-xl text-slate-900 flex items-center gap-2">
            <CreditCard size={20} className="text-slate-400" />
            Payment Gateway
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 md:p-8 overflow-y-auto no-scrollbar">
          <div className="space-y-6">
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
              <div className="flex justify-between items-center mb-6">
                <p className="text-xs text-slate-400 uppercase font-bold tracking-widest">Amount to Pay</p>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-900">₹{booking.totalPrice}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Inclusive of all taxes</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                  <Smartphone size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">UPI / Cards / Netbanking</p>
                  <p className="text-xs text-slate-500">Secure Indian payment methods</p>
                </div>
              </div>
            </div>

            {error && (
              <div className="text-rose-500 text-sm font-semibold bg-rose-50 p-4 rounded-2xl flex gap-2 items-center">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <div className="flex flex-col gap-4">
              {profile.walletBalance && profile.walletBalance >= booking.totalPrice ? (
                <button
                  onClick={handleWalletPayment}
                  disabled={processing}
                  className="w-full bg-emerald-500 text-white py-5 rounded-2xl font-black text-lg hover:bg-emerald-600 transition-all flex justify-center items-center gap-3 shadow-xl shadow-emerald-500/20 disabled:opacity-50 active:scale-95"
                >
                  <Wallet size={20} />
                  {processing ? 'Processing...' : `Pay from Wallet (Bal: ₹${profile.walletBalance})`}
                </button>
              ) : null}

              <button
                onClick={handleRazorpayPayment}
                disabled={processing}
                className="w-full bg-blue-700 text-white py-5 rounded-2xl font-black text-lg hover:bg-blue-800 transition-all flex justify-center items-center gap-3 shadow-xl shadow-blue-700/20 disabled:opacity-50 active:scale-95"
              >
                <CreditCard size={20} />
                {processing ? 'Launching Gateway...' : `Proceed to Pay ₹${booking.totalPrice}`}
              </button>
              
              <div className="flex items-center justify-center gap-6 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                 <div className="flex items-center gap-1.5"><ShieldCheck size={12} /> Secure</div>
                 <div className="flex items-center gap-1.5"><Lock size={12} /> Encrypted</div>
                 <div className="flex items-center gap-1.5"><CreditCard size={12} /> Indian Gateway</div>
              </div>

              <div className="pt-4 text-center">
                <p className="text-[10px] text-slate-300 font-medium">Powered by Razorpay</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
