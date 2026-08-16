import React, { useState } from 'react';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Booking, UserProfile } from '../types';
import { formatTime12Hour } from '../utils/formatTime';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  CreditCard, 
  Lock, 
  ShieldCheck, 
  AlertCircle, 
  Smartphone, 
  Wallet, 
  Banknote, 
  CheckCircle2, 
  Check, 
  QrCode, 
  Zap,
  ArrowRight
} from 'lucide-react';
import PaymentMethodSelector, { PaymentCategoryType, UpiSubAppType } from './PaymentMethodSelector';
import OnlinePaymentGatewayModal, { PaymentSuccessData } from './OnlinePaymentGatewayModal';

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
  const [showOnlineGateway, setShowOnlineGateway] = useState(false);

  // Payment Selection States
  const [selectedCategory, setSelectedCategory] = useState<PaymentCategoryType>(
    booking.paymentMethod === 'cash' ? 'cash' : 'upi'
  );
  const [selectedUpiApp, setSelectedUpiApp] = useState<UpiSubAppType>('gpay');
  const [customUpiId, setCustomUpiId] = useState('');
  const [useWallet, setUseWallet] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  const handleSelectCategory = (cat: PaymentCategoryType) => {
    setSelectedCategory(cat);
    setError(null);
  };

  const handleSelectUpiApp = (app: UpiSubAppType) => {
    setSelectedUpiApp(app);
    setSelectedCategory('upi');
    setError(null);
  };

  const totalBill = booking.totalPrice || 0;
  const walletDeduction = useWallet ? Math.min(profile?.walletBalance || 0, totalBill) : 0;
  const finalPayable = Math.max(0, totalBill - walletDeduction);
  const isWalletFullyCovering = useWallet && (profile?.walletBalance || 0) >= totalBill;

  const handleWalletPayment = async () => {
    if (!profile.walletBalance || profile.walletBalance < totalBill) {
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
      }, 2000);

    } catch (err: any) {
       console.error("Wallet Payment Error:", err);
       setError(err.message || 'Wallet payment failed');
       setProcessing(false);
    }
  };

  const handleSwitchToCOD = async () => {
    setProcessing(true);
    setError(null);
    try {
      const bRef = doc(db, 'bookings', booking.id);
      await updateDoc(bRef, {
        paymentMethod: 'cash',
        paymentStatus: 'unpaid',
        status: 'confirmed',
        updatedAt: Timestamp.now()
      });
      setShowSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      console.error("Error switching to COD:", err);
      setError("Failed to switch payment mode.");
      setProcessing(false);
    }
  };

  const handlePhonePePayment = async () => {
    setProcessing(true);
    setError(null);

    try {
      const resolvedMobile = (profile as any).phoneNumber || (profile as any).mobile || '';
      const response = await fetch('/api/phonepe/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: finalPayable,
          bookingId: booking.id,
          customerUid: profile.uid,
          mobileNumber: resolvedMobile
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to initiate PhonePe payment');
      }

      // Call verify endpoint to set status to paid in Firestore
      try {
        await fetch('/api/phonepe/verify-and-confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId: booking.id,
            customerUid: profile.uid,
            merchantTransactionId: data.merchantTransactionId,
            amount: finalPayable
          })
        });

        // Also update local firestore record for instant UI reactivity
        const bRef = doc(db, 'bookings', booking.id);
        await updateDoc(bRef, {
          paymentStatus: 'paid',
          paymentMethod: 'online',
          status: booking.status === 'pending' ? 'confirmed' : booking.status,
          updatedAt: Timestamp.now()
        });
      } catch (confirmErr) {
        console.warn("Direct confirm notice:", confirmErr);
      }

      if (data.redirectUrl && !data.isSimulation) {
        window.location.href = data.redirectUrl;
      } else {
        setShowSuccess(true);
        setTimeout(() => {
          onSuccess();
        }, 1200);
      }
    } catch (err: any) {
      console.error("PhonePe Payment Error:", err);
      setError(err.message || 'Payment initiation failed');
      setProcessing(false);
    }
  };

  const handleOnlinePaymentConfirmed = async (paymentData: PaymentSuccessData) => {
    setProcessing(true);
    setError(null);
    setShowOnlineGateway(false);

    try {
      // Direct update in Firestore
      const bRef = doc(db, 'bookings', booking.id);
      await updateDoc(bRef, {
        paymentStatus: 'paid',
        paymentMethod: walletDeduction > 0 ? 'wallet+online' : 'online',
        transactionId: paymentData.txnId,
        onlinePaymentProvider: paymentData.provider,
        onlinePaymentMethod: paymentData.method,
        paidAmount: paymentData.amount,
        status: booking.status === 'pending' ? 'confirmed' : booking.status,
        updatedAt: Timestamp.now()
      });

      // If partial wallet deduction was used, debit wallet
      if (walletDeduction > 0) {
        try {
          await fetch('/api/pay-via-wallet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId: booking.id, userId: profile.uid, amount: walletDeduction }),
          });
        } catch (walletErr) {
          console.warn("Wallet partial debit notice:", walletErr);
        }
      }

      // Send confirmation bill email
      try {
        await fetch('/api/send-final-bill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId: booking.id, requesterUid: profile.uid }),
        });
      } catch (billErr) {
        console.warn("Final bill trigger notice:", billErr);
      }

      setShowSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      console.error("Payment Confirmation Error:", err);
      setError(err.message || "Failed to confirm payment on server.");
      setProcessing(false);
    }
  };

  const handleExecutePayment = () => {
    if (isWalletFullyCovering) {
      handleWalletPayment();
      return;
    }

    if (selectedCategory === 'cash') {
      handleSwitchToCOD();
      return;
    }

    // UPI or Card -> Proceed to Payment Gateway Checkout Modal
    setShowOnlineGateway(true);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm" 
      />
      
      <motion.div 
        initial={{ opacity: 0, y: 50, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.98 }}
        className="relative bg-white w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] z-10"
      >
        <AnimatePresence>
          {showSuccess && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[110] bg-white flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/20">
                <ShieldCheck size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">Payment Confirmed</h3>
              <p className="text-slate-500 font-medium mb-8 leading-relaxed">
                {selectedCategory === 'cash' ? 'Pay on arrival selected! Your booking is confirmed.' : 'Transaction successful! Your booking is confirmed.'}
              </p>
              <div className="w-16 h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                  className="w-full h-full bg-emerald-500"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal Header */}
        <div className="p-4 sm:p-5 pb-3 flex justify-between items-center border-b border-slate-100 shrink-0 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center font-bold">
              <CreditCard size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 leading-tight">
                Select Payment Mode
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Booking #{booking.id.slice(-6).toUpperCase()}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-full transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto no-scrollbar space-y-4 pb-24">
          
          {error && (
            <div className="text-rose-600 text-xs font-semibold bg-rose-50 border border-rose-200 p-3.5 rounded-2xl flex gap-2 items-center">
              <AlertCircle size={16} className="shrink-0 text-rose-500" /> 
              <span>{error}</span>
            </div>
          )}

          {/* Payment Method Selector Component */}
          <PaymentMethodSelector 
            totalBill={totalBill}
            walletBalance={profile?.walletBalance || 0}
            useWallet={useWallet}
            onToggleWallet={(val) => {
              setUseWallet(val);
              setError(null);
            }}
            selectedCategory={selectedCategory}
            selectedUpiApp={selectedUpiApp}
            customUpiId={customUpiId}
            onSelectCategory={handleSelectCategory}
            onSelectUpiApp={handleSelectUpiApp}
            onChangeCustomUpiId={(id) => {
              setCustomUpiId(id);
              handleSelectCategory('upi');
            }}
            cardNumber={cardNumber}
            onChangeCardNumber={(num) => {
              setCardNumber(num);
              handleSelectCategory('card');
            }}
            cardExpiry={cardExpiry}
            onChangeCardExpiry={(exp) => {
              setCardExpiry(exp);
              handleSelectCategory('card');
            }}
            cardCvv={cardCvv}
            onChangeCardCvv={(cvv) => {
              setCardCvv(cvv);
              handleSelectCategory('card');
            }}
          />
        </div>

        {/* Modern Sticky Bottom Action Bar (Zomato/Blinkit Style) */}
        <div className="absolute bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-150 p-4 shadow-[0_-8px_25px_rgba(15,23,42,0.06)] z-20 flex items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block leading-none mb-0.5">
              {useWallet && finalPayable === 0 ? "Paid from wallet" : "To Pay"}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-slate-900 tracking-tight">
                ₹{finalPayable}
              </span>
              {walletDeduction > 0 && (
                <span className="text-[10px] font-bold text-emerald-600">
                  (-₹{walletDeduction} wallet)
                </span>
              )}
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.96 }}
            disabled={processing}
            onClick={handleExecutePayment}
            className={`flex-1 py-3.5 px-5 rounded-2xl font-black text-xs sm:text-sm tracking-wide transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
              isWalletFullyCovering
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                : selectedCategory === 'cash'
                ? 'bg-slate-900 hover:bg-black text-white shadow-slate-900/20'
                : 'bg-[#002e6e] hover:bg-blue-900 text-white shadow-blue-900/20'
            }`}
          >
            {processing ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Processing...
              </span>
            ) : isWalletFullyCovering ? (
              <>
                <Wallet size={16} /> Pay ₹{totalBill} via Wallet &amp; Confirm
              </>
            ) : selectedCategory === 'cash' ? (
              <>
                <Banknote size={16} /> Confirm Booking (Pay on Arrival)
              </>
            ) : (
              <>
                <Lock size={14} className="text-emerald-300" /> Proceed to Payment Gateway (₹{finalPayable}) <ArrowRight size={14} />
              </>
            )}
          </motion.button>
        </div>

        {/* Centralized Online Payment Gateway Checkout Modal */}
        <OnlinePaymentGatewayModal
          isOpen={showOnlineGateway}
          amount={finalPayable}
          serviceName={(booking as any).serviceName || 'Home Service'}
          customerName={booking.customerName || (booking as any).customerBookedName || profile.fullName || 'Customer'}
          customerPhone={booking.customerMobile || (booking as any).customerBookedPhone || (profile as any).phoneNumber || (profile as any).mobile || ''}
          customerEmail={(booking as any).customerEmail || (booking as any).customerBookedEmail || profile.email || ''}
          bookingDetails={{
            date: booking.scheduledAt?.toDate?.() ? booking.scheduledAt.toDate().toLocaleDateString('en-IN') : 'Scheduled Slot',
            time: formatTime12Hour(booking.scheduledAt),
            address: booking.address || ''
          }}
          onClose={() => {
            setShowOnlineGateway(false);
            setError("Payment incomplete. Please try again.");
          }}
          onPaymentCancel={() => {
            setShowOnlineGateway(false);
            setError("Payment incomplete. Please try again.");
          }}
          onPaymentSuccess={handleOnlinePaymentConfirmed}
        />

      </motion.div>
    </div>
  );
}
