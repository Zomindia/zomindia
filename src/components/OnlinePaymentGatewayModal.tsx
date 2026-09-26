import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Zap,
  ArrowRight,
  ShieldAlert,
  CreditCard,
  Banknote
} from 'lucide-react';
import { getCashfreeInstance, CashfreeMode } from '../utils/cashfreeClient';
import { playSuccessChime } from '../lib/audio';
import confetti from 'canvas-confetti';

export interface PaymentSuccessData {
  txnId: string;
  method: 'upi' | 'card' | 'netbanking' | 'wallet' | 'online';
  provider: string;
  amount: number;
  paidAt: string;
}

export interface OnlinePaymentGatewayModalProps {
  isOpen: boolean;
  amount: number;
  serviceName: string;
  bookingId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  bookingDetails?: {
    date: string;
    time: string;
    address: string;
  };
  onClose: () => void;
  onPaymentSuccess: (data: PaymentSuccessData) => Promise<void> | void;
  onPaymentCancel?: () => void;
}

export default function OnlinePaymentGatewayModal({
  isOpen,
  amount,
  serviceName,
  bookingId,
  customerName = 'Customer',
  customerPhone = '',
  customerEmail = '',
  bookingDetails,
  onClose,
  onPaymentSuccess,
  onPaymentCancel
}: OnlinePaymentGatewayModalProps) {
  const [isInitializing, setIsInitializing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sdkBlocked, setSdkBlocked] = useState(false);
  const [isSimulation, setIsSimulation] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [paymentSessionId, setPaymentSessionId] = useState<string | null>(null);
  const [cashfreeMode, setCashfreeMode] = useState<CashfreeMode>('production');
  const [hostedCheckoutUrl, setHostedCheckoutUrl] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [pollingCountdown, setPollingCountdown] = useState<number>(60);
  const [isPollingActive, setIsPollingActive] = useState(false);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Stop polling helper
  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setIsPollingActive(false);
  };

  // Safe mount tracker and back-navigation listener to prevent frozen UI on mobile/PWA
  useEffect(() => {
    isMountedRef.current = true;

    const handlePageShow = () => {
      if (isMountedRef.current && activeOrderId) {
        checkOrderStatusOnce(activeOrderId);
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('popstate', handlePageShow);

    return () => {
      isMountedRef.current = false;
      stopPolling();
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('popstate', handlePageShow);
    };
  }, [activeOrderId]);

  // Reset and auto-initialize when opened
  useEffect(() => {
    if (isOpen) {
      setPaymentSuccess(false);
      setErrorMessage(null);
      setSdkBlocked(false);
      setIsSimulation(false);
      setPaymentSessionId(null);
      initiateCashfreePayment();
    } else {
      stopPolling();
      setActiveOrderId(null);
      setPaymentSessionId(null);
      setIsSimulation(false);
    }
  }, [isOpen]);

  // Single-attempt status check (used on pageshow / manual check)
  const checkOrderStatusOnce = async (orderId: string) => {
    try {
      const res = await fetch(`/api/cashfree/status/${encodeURIComponent(orderId)}`);
      const data = await res.json();
      if (data.order_status === 'PAID' || data.status === 'SUCCESS' || (data.success && data.status === 'PAID')) {
        handleFinalSuccess(orderId);
      }
    } catch (e) {
      console.warn('[Cashfree Status Check Notice]:', e);
    }
  };

  // Status poller (60s countdown)
  const startStatusPolling = (orderId: string) => {
    stopPolling();
    if (!isMountedRef.current) return;
    setIsPollingActive(true);
    setPollingCountdown(60);

    countdownTimerRef.current = setInterval(() => {
      if (!isMountedRef.current) {
        stopPolling();
        return;
      }
      setPollingCountdown((prev) => {
        if (prev <= 1) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    let attempts = 0;
    const maxAttempts = 24;

    pollingRef.current = setInterval(async () => {
      if (!isMountedRef.current) {
        stopPolling();
        return;
      }
      attempts += 1;
      if (attempts > maxAttempts) {
        stopPolling();
        return;
      }

      try {
        const res = await fetch(`/api/cashfree/status/${encodeURIComponent(orderId)}`);
        const data = await res.json();
        if (data.order_status === 'PAID' || data.status === 'SUCCESS' || (data.success && data.status === 'PAID')) {
          stopPolling();
          handleFinalSuccess(orderId);
        }
      } catch (err) {
        console.warn('[Cashfree Polling Notice]:', err);
      }
    }, 2500);
  };

  // Final Success Handler
  const handleFinalSuccess = (orderId: string) => {
    stopPolling();
    if (!isMountedRef.current) return;

    playSuccessChime();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([100, 50, 100]);
      } catch (e) {}
    }

    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });
    } catch (e) {}

    setPaymentSuccess(true);

    setTimeout(() => {
      if (isMountedRef.current) {
        onPaymentSuccess({
          txnId: orderId,
          method: 'online',
          provider: 'Cashfree',
          amount,
          paidAt: new Date().toISOString()
        });
      }
    }, 1400);
  };

  // Trigger Cashfree JS SDK's checkout method strictly upon receiving valid payment_session_id
  const triggerSdkCheckout = async (
    sessionId: string, 
    target: '_modal' | '_self' = '_modal',
    explicitMode?: CashfreeMode
  ) => {
    // Session Verification Before Checkout: Do not proceed if session is empty or missing
    if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
      setErrorMessage('Cashfree payment session is invalid or empty. Checkout could not be launched.');
      return;
    }

    try {
      const modeToUse: CashfreeMode = explicitMode || cashfreeMode;
      const cashfree = await getCashfreeInstance(modeToUse);

      if (!cashfree) {
        setSdkBlocked(true);
        setErrorMessage('Cashfree Checkout SDK could not load. Please check browser extensions or launch hosted checkout.');
        return;
      }

      if (typeof cashfree.checkout === 'function') {
        cashfree.checkout({
          paymentSessionId: sessionId.trim(),
          redirectTarget: target
        });
      } else if (hostedCheckoutUrl) {
        window.location.href = hostedCheckoutUrl;
      }
    } catch (err: any) {
      console.warn('[Cashfree Trigger Checkout Warning]:', err);
      if (hostedCheckoutUrl) {
        window.location.href = hostedCheckoutUrl;
      }
    }
  };

  // Initialize Cashfree Order: Fetch payment_session_id from backend
  const initiateCashfreePayment = async () => {
    setIsInitializing(true);
    setErrorMessage(null);
    setSdkBlocked(false);
    setIsSimulation(false);
    setPaymentSessionId(null);

    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const res = await fetch('/api/cashfree/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          bookingId: bookingId || '',
          customerPhone: customerPhone || '9999999999',
          customerEmail: customerEmail || 'customer@zomindia.com',
          customerName: customerName || 'Zomindia Customer',
          serviceName,
          redirectOrigin: origin
        })
      });

      const data = await res.json();

      // Guard: Session Verification Before Checkout
      const hasValidSession = 
        res.ok && 
        data && 
        data.success && 
        typeof data.payment_session_id === 'string' && 
        data.payment_session_id.trim().length > 10;

      if (!hasValidSession) {
        setIsInitializing(false);
        const errMsg = data?.error || 'Cashfree payment session could not be initialized. Please configure API keys or pay via Pay After Service.';
        setErrorMessage(errMsg);
        
        // Dev / Test simulation fallback when keys are empty or mock
        if (data?.isSimulation || (!data?.payment_session_id && ((import.meta as any).env?.DEV || (import.meta as any).env?.MODE !== 'production'))) {
          setIsSimulation(true);
          setActiveOrderId(data?.order_id || `ORDER_SIM_${Date.now()}`);
        }
        return; // DO NOT call cashfree.checkout()
      }

      // Valid session ID confirmed from backend
      const sessionId = data.payment_session_id.trim();
      const serverMode: CashfreeMode = data.mode === 'sandbox' || data.environment === 'sandbox' ? 'sandbox' : 'production';
      setCashfreeMode(serverMode);

      const orderId = data.order_id || data.merchantTransactionId;
      setActiveOrderId(orderId);
      setPaymentSessionId(sessionId);
      if (data.checkoutUrl) {
        setHostedCheckoutUrl(data.checkoutUrl);
      }
      setIsSimulation(false);
      setIsInitializing(false);

      // Start status verification polling
      startStatusPolling(orderId);

      // Strictly invoke Cashfree JS SDK's checkout method with matched mode
      await triggerSdkCheckout(sessionId, '_modal', serverMode);
    } catch (err: any) {
      console.error('[Cashfree Init Error]:', err);
      setIsInitializing(false);
      setErrorMessage('Cashfree payment session could not be initialized. Please configure API keys or pay via Pay After Service.');
    }
  };

  // Launch Cashfree checkout on user action
  const handleLaunchCheckout = (target: '_modal' | '_self' = '_modal') => {
    if (isSimulation) {
      handleFinalSuccess(activeOrderId || `ORDER_SIM_${Date.now()}`);
      return;
    }

    if (!paymentSessionId || !paymentSessionId.trim()) {
      setErrorMessage('No active payment session found. Retrying initialization...');
      initiateCashfreePayment();
      return;
    }

    triggerSdkCheckout(paymentSessionId, target, cashfreeMode);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs">
      <div 
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cashfree-modal-title"
      >
        {/* Header with Official Cashfree Branding & Security */}
        <div className="relative bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-5 py-4 sm:px-6 sm:py-5 border-b border-indigo-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white text-indigo-900 flex items-center justify-center font-black text-sm shadow-md shrink-0">
                CF
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 id="cashfree-modal-title" className="text-base font-black tracking-tight text-white">
                    Cashfree Payments
                  </h3>
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ShieldCheck size={10} className="stroke-[3]" />
                    Verified Gateway
                  </span>
                </div>
                <p className="text-xs text-indigo-200/80 flex items-center gap-1.5 mt-0.5 font-medium">
                  <Lock size={11} className="text-emerald-400" />
                  Official Checkout SDK • 256-bit SSL Encrypted
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                stopPolling();
                if (onPaymentCancel) onPaymentCancel();
                onClose();
              }}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close payment modal"
            >
              <X size={18} />
            </button>
          </div>

          {/* Amount and Service Summary Pill */}
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
            <div>
              <span className="text-indigo-200/70 block text-[11px] font-medium uppercase tracking-wider">Service Order</span>
              <span className="font-bold text-white line-clamp-1">{serviceName}</span>
            </div>
            <div className="text-right">
              <span className="text-indigo-200/70 block text-[11px] font-medium uppercase tracking-wider">Total Payable</span>
              <span className="text-lg font-black text-emerald-300">₹{amount}</span>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Ad-blocker Alert */}
          {sdkBlocked && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex flex-col gap-3 text-xs text-amber-900 shadow-xs">
              <div className="flex items-start gap-3">
                <ShieldAlert size={20} className="shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <h4 className="font-bold text-amber-950 text-sm">Checkout Script Blocked by Browser</h4>
                  <p className="text-xs text-amber-800 font-normal mt-1 leading-relaxed">
                    An ad-blocker or privacy extension is preventing Cashfree Checkout from opening.
                    Please disable shields for this site or use the button below to complete your payment on Cashfree's page.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleLaunchCheckout('_self')}
                  className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <ExternalLink size={14} />
                  Open Hosted Checkout
                </button>
                <button
                  type="button"
                  onClick={initiateCashfreePayment}
                  className="py-2.5 px-4 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw size={13} />
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Graceful Error Notification */}
          {errorMessage && !sdkBlocked && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col gap-3 text-xs text-rose-900 shadow-xs">
              <div className="flex items-start gap-2.5">
                <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-rose-950">Payment Initialization Notice</h4>
                  <p className="text-rose-800 leading-relaxed font-medium">
                    {errorMessage}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={initiateCashfreePayment}
                  className="py-2 px-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shrink-0 shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw size={12} />
                  Retry Online Payment
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopPolling();
                    if (onPaymentCancel) onPaymentCancel();
                    onClose();
                  }}
                  className="py-2 px-3.5 bg-white border border-rose-200 hover:bg-rose-100 text-rose-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Choose Another Method
                </button>
              </div>
            </div>
          )}

          {/* Dev / Test Fallback Simulation Option */}
          {isSimulation && !paymentSuccess && (
            <div className="p-5 bg-gradient-to-br from-indigo-50/90 via-sky-50/70 to-emerald-50/70 border-2 border-indigo-200/80 rounded-3xl space-y-4 text-center shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-md">
                <Sparkles size={24} />
              </div>
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-100 text-indigo-800 text-[11px] font-black rounded-full mb-1">
                  <span>Preview & Test Sandbox Mode ({cashfreeMode})</span>
                </div>
                <h4 className="text-base font-black text-slate-900">Cashfree Simulation Active</h4>
                <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                  Cashfree live credentials are not configured in this preview environment. You can simulate the verified payment flow to test end-to-end booking confirmation without errors.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => handleFinalSuccess(activeOrderId || `ORDER_SIM_${Date.now()}`)}
                  className="w-full sm:w-auto px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Zap size={15} />
                  <span>Simulate Successful Payment (₹{amount})</span>
                </button>
              </div>
            </div>
          )}

          {/* Payment Success View */}
          {paymentSuccess ? (
            <div className="py-10 px-4 text-center space-y-4 animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 size={36} className="stroke-[2.5]" />
              </div>
              <div>
                <h4 className="text-xl font-black text-slate-900">Payment Completed!</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Cashfree Transaction Reference: <span className="font-mono font-bold text-slate-700">{activeOrderId}</span>
                </p>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-800 text-xs font-bold">
                <Sparkles size={14} className="text-emerald-600" />
                Confirmed ₹{amount} • Finalizing Booking...
              </div>
            </div>
          ) : (
            <>
              {/* Loading State when fetching session */}
              {isInitializing && (
                <div className="min-h-[240px] w-full rounded-2xl border border-slate-200 bg-white flex flex-col items-center justify-center p-6 text-center space-y-3 shadow-xs">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center animate-bounce shadow-sm">
                    <CreditCard size={24} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-slate-900">Initializing Cashfree Checkout</h4>
                    <p className="text-xs text-slate-500">Connecting to secure gateway ({cashfreeMode})...</p>
                  </div>
                  <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="w-full h-full bg-indigo-600 animate-pulse" />
                  </div>
                </div>
              )}

              {/* Active Session Card - Clean popup trigger without premature inline iframes */}
              {paymentSessionId && !isSimulation && !errorMessage && (
                <div className="p-6 bg-gradient-to-br from-indigo-50/70 via-slate-50 to-white border border-indigo-100 rounded-2xl space-y-5 text-center shadow-xs">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-md">
                    <CreditCard size={28} />
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="text-base font-black text-slate-900">Payment Window Ready</h4>
                    <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                      Cashfree payment session is active ({cashfreeMode} mode). Choose your preferred checkout display below to pay with UPI, Credit/Debit Card, or NetBanking.
                    </p>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleLaunchCheckout('_modal')}
                      className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
                    >
                      <Zap size={14} />
                      <span>Open Cashfree Checkout • ₹{amount}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLaunchCheckout('_self')}
                      className="w-full sm:w-auto px-4 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ExternalLink size={13} />
                      <span>Full Page Checkout</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Polling / Real-time Status Notice */}
              {isPollingActive && (
                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-center justify-between text-xs text-indigo-900">
                  <div className="flex items-center gap-2">
                    <RefreshCw size={13} className="animate-spin text-indigo-600 shrink-0" />
                    <span className="font-medium">
                      Verifying payment status in real-time... ({pollingCountdown}s)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => activeOrderId && checkOrderStatusOnce(activeOrderId)}
                    className="font-bold text-indigo-600 hover:text-indigo-800 underline text-[11px] cursor-pointer"
                  >
                    Check Now
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Verified Security Badges Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 font-medium">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-slate-700 font-bold">
              <ShieldCheck size={13} className="text-emerald-600" />
              PCI-DSS Compliant
            </span>
            <span className="hidden sm:inline text-slate-300">•</span>
            <span className="hidden sm:inline">RBI Licensed Payment Aggregator</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <span>UPI • Cards • NetBanking</span>
          </div>
        </div>
      </div>
    </div>
  );
}
