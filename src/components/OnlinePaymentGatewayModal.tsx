import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import {
  X,
  ShieldCheck,
  Lock,
  Smartphone,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  QrCode,
  ArrowRight,
  RefreshCw,
  Zap,
  Check,
  Copy,
  ExternalLink,
  Landmark,
  Wallet,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  BadgeCheck,
  Sparkles
} from 'lucide-react';
import {
  POPULAR_UPI_HANDLES,
  validateAndVerifyUpiId,
  UpiVerificationResult,
  COMMON_HANDLE_TYPOS
} from '../utils/upiValidation';
import { playSuccessChime } from '../lib/audio';

export interface PaymentSuccessData {
  txnId: string;
  method: 'upi' | 'card' | 'netbanking' | 'wallet';
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

export type PaymentMethodId = 
  | 'phonepe'
  | 'gpay'
  | 'paytm'
  | 'other_upi'
  | 'qr_code'
  | 'card'
  | 'netbanking'
  | 'wallet';

const POPULAR_BANKS = [
  { id: 'hdfc', name: 'HDFC Bank', code: 'HDFC' },
  { id: 'sbi', name: 'SBI', code: 'SBI' },
  { id: 'icici', name: 'ICICI Bank', code: 'ICICI' },
  { id: 'axis', name: 'Axis Bank', code: 'AXIS' },
  { id: 'kotak', name: 'Kotak Mahindra', code: 'KOTAK' },
  { id: 'pnb', name: 'Punjab National', code: 'PNB' }
];

const UPI_HANDLE_SUGGESTIONS = [
  '@okhdfcbank',
  '@oksbi',
  '@okaxis',
  '@ybl',
  '@paytm',
  '@ibl'
];

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
  const isMobile = typeof window !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // Method selection: default to QR Code on desktop for instant scannability, and PhonePe on mobile
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodId>(!isMobile ? 'qr_code' : 'phonepe');
  const [webCheckoutUrl, setWebCheckoutUrl] = useState<string | null>(null);
  const [qrInstructionApp, setQrInstructionApp] = useState<string>('PhonePe / GPay');

  // Specific method states
  const [customUpiId, setCustomUpiId] = useState('');
  const [upiIdError, setUpiIdError] = useState('');
  const [isVerifyingUpi, setIsVerifyingUpi] = useState(false);
  const [upiVerification, setUpiVerification] = useState<UpiVerificationResult | null>(null);
  const [suggestedSuffix, setSuggestedSuffix] = useState<string | null>(null);
  const [selectedBank, setSelectedBank] = useState('hdfc');

  const selectedBankObj = POPULAR_BANKS.find((b) => b.id === selectedBank) || {
    id: selectedBank,
    name: selectedBank.toUpperCase(),
    code: selectedBank.toUpperCase()
  };

  // Card details
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState(customerName || '');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardError, setCardError] = useState('');

  // QR Code state
  const [qrTimer, setQrTimer] = useState(300);
  const [copiedVpa, setCopiedVpa] = useState(false);
  const [dynamicQrData, setDynamicQrData] = useState<string | null>(null);
  const [isDynamicQr, setIsDynamicQr] = useState(false);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);

  // Processing & status
  const [isProcessing, setIsProcessing] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [activeTxnId, setActiveTxnId] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pollingCountdown, setPollingCountdown] = useState<number>(60);
  const [isPollingTimedOut, setIsPollingTimedOut] = useState<boolean>(false);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const MERCHANT_VPA = (import.meta.env.VITE_MERCHANT_UPI_ID as string || '').trim();
  const MERCHANT_NAME = (import.meta.env.VITE_MERCHANT_NAME as string || 'Zomindia Services').trim();

  // Dynamic standard UPI Intent URI strictly containing complete pa, pn, am, cu, tn, and unique tr
  const currentTxnRef = activeTxnId || `TXN_${Date.now()}`;
  const upiIntentUri = MERCHANT_VPA
    ? `upi://pay?pa=${MERCHANT_VPA}&pn=${encodeURIComponent(
        MERCHANT_NAME
      )}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Service_${serviceName.slice(0, 15).replace(/\s+/g, '_')}`)}&tr=${encodeURIComponent(currentTxnRef)}`
    : '';

  // QR Timer Countdown
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setQrTimer((prev) => (prev > 0 ? prev - 1 : 300));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Stop all status polling and countdown timers
  const stopStatusPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  };

  // Reset state when opening/closing
  useEffect(() => {
    if (isOpen) {
      setPaymentSuccess(false);
      setAwaitingConfirmation(false);
      setIsProcessing(false);
      setErrorMessage(null);
      setQrTimer(300);
      setIsPollingTimedOut(false);
      setPollingCountdown(60);
    } else {
      stopStatusPolling();
    }
  }, [isOpen]);

  // PhonePe Background Status Poller (strictly capped to 60 seconds with countdown and failover)
  const startStatusPolling = (txnId: string) => {
    stopStatusPolling();
    setIsPollingTimedOut(false);
    setPollingCountdown(60);

    // 1. Real-time 1-second countdown ticker
    countdownTimerRef.current = setInterval(() => {
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

    // 2. Status verification requests every 2.5s (max 24 attempts = 60s)
    let attempts = 0;
    const maxAttempts = 24;

    pollingRef.current = setInterval(async () => {
      attempts += 1;
      if (attempts > maxAttempts) {
        stopStatusPolling();
        setIsPollingTimedOut(true);
        setStatusMessage('Payment not detected yet. If money was debited, it will reflect within 10 minutes.');
        return;
      }

      try {
        const res = await fetch(`/api/phonepe/status/${encodeURIComponent(txnId)}?bookingId=${bookingId || ''}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.status === 'SUCCESS' || (data.success && (data.code === 'PAYMENT_SUCCESS' || data.status === 'PAYMENT_SUCCESS'))) {
          stopStatusPolling();
          handlePaymentFinalized(txnId, isDynamicQr ? 'PhonePe Dynamic QR' : 'PhonePe Gateway', 'upi');
        }
      } catch (err) {
        console.warn('[PaymentDrawer Polling Notice]:', err);
      }
    }, 2500);
  };

  // Dynamic PhonePe PG QR Initiation & Status Polling
  const fetchPhonePeDynamicQr = async () => {
    setIsGeneratingQr(true);
    const txnId = `TXN_QR_${Date.now()}`;
    setActiveTxnId(txnId);
    try {
      const res = await fetch('/api/phonepe/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: bookingId || '',
          amount,
          customerPhone: customerPhone || '9999999999',
          customerId: 'customer',
          paymentInstrumentType: 'UPI_QR'
        })
      });
      const data = await res.json();
      if (data.success && data.qrData) {
        setDynamicQrData(data.qrData);
        setIsDynamicQr(Boolean(data.isDynamicQr));
        const activeTxn = data.merchantTransactionId || txnId;
        setActiveTxnId(activeTxn);
        startStatusPolling(activeTxn);
      } else {
        setDynamicQrData(null);
        setIsDynamicQr(false);
        if (!MERCHANT_VPA) {
          setErrorMessage('Merchant UPI ID is not configured (VITE_MERCHANT_UPI_ID missing). Please configure a valid VPA.');
        } else {
          startStatusPolling(txnId);
        }
      }
    } catch (err) {
      console.warn('[OnlinePaymentGatewayModal] Dynamic QR notice:', err);
      setDynamicQrData(null);
      setIsDynamicQr(false);
      if (!MERCHANT_VPA) {
        setErrorMessage('Merchant UPI ID is not configured (VITE_MERCHANT_UPI_ID missing). Please configure a valid VPA.');
      } else {
        startStatusPolling(txnId);
      }
    } finally {
      setIsGeneratingQr(false);
    }
  };

  // Automated dynamic QR generation and status polling when QR code is opened
  useEffect(() => {
    if (!isOpen) return;
    if (selectedMethod === 'qr_code') {
      fetchPhonePeDynamicQr();
    }
  }, [isOpen, selectedMethod]);

  // Handler for selecting UPI Apps with Desktop vs Mobile intelligence
  const handleSelectUpiApp = (method: 'phonepe' | 'gpay' | 'paytm') => {
    if (!isMobile) {
      const appLabel = method === 'phonepe' ? 'PhonePe' : method === 'gpay' ? 'Google Pay' : 'Paytm';
      setQrInstructionApp(appLabel);
      setSelectedMethod('qr_code');
    } else {
      setSelectedMethod(method);
    }
  };

  // Launch PhonePe Web Gateway in a new tab for desktop users
  const handleLaunchWebGateway = async () => {
    setIsProcessing(true);
    setStatusMessage('Launching PhonePe Web Gateway...');
    try {
      const response = await fetch('/api/phonepe/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          bookingId: bookingId || '',
          customerName,
          customerPhone,
          customerEmail,
          serviceName,
          redirectOrigin: window.location.origin
        })
      });
      const data = await response.json();
      const generatedTxn = data.merchantTransactionId || `TXN_${Date.now()}`;
      setActiveTxnId(generatedTxn);
      const checkoutUrl = data.checkoutUrl || data.redirectUrl;

      if (checkoutUrl && /^https?:\/\//i.test(checkoutUrl)) {
        window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
        setWebCheckoutUrl(checkoutUrl);
        if (data.qrData) {
          setDynamicQrData(data.qrData);
          setIsDynamicQr(Boolean(data.isDynamicQr));
        }
        setAwaitingConfirmation(true);
        startStatusPolling(generatedTxn);
      } else {
        if (data.qrData) {
          setDynamicQrData(data.qrData);
          setIsDynamicQr(Boolean(data.isDynamicQr));
        }
        startStatusPolling(generatedTxn);
      }
    } catch (e) {
      console.warn('[OnlinePaymentGatewayModal] Web gateway launch notice:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyVpa = () => {
    if (!MERCHANT_VPA) return;
    navigator.clipboard.writeText(MERCHANT_VPA);
    setCopiedVpa(true);
    setTimeout(() => setCopiedVpa(false), 2000);
  };

  const formatCardNumber = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 16);
    const parts = [];
    for (let i = 0; i < clean.length; i += 4) {
      parts.push(clean.substring(i, i + 4));
    }
    return parts.join(' ');
  };

  const formatExpiry = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 4);
    if (clean.length >= 3) {
      return `${clean.slice(0, 2)}/${clean.slice(2)}`;
    }
    return clean;
  };

  const getCardBrand = (num: string) => {
    const clean = num.replace(/\D/g, '');
    if (clean.startsWith('4')) return 'Visa';
    if (/^5[1-5]/.test(clean)) return 'Mastercard';
    if (/^60|^65|^81|^82/.test(clean)) return 'RuPay';
    return 'Card';
  };

  const handleVerifyUpi = (vpaToTest?: string) => {
    const vpa = (vpaToTest ?? customUpiId).trim();
    setUpiIdError('');
    setSuggestedSuffix(null);

    if (!vpa) {
      setUpiIdError('Please enter a UPI ID to verify');
      setUpiVerification(null);
      return false;
    }

    setIsVerifyingUpi(true);
    const result = validateAndVerifyUpiId(vpa);

    if (result.isValid) {
      setUpiVerification(result);
      setUpiIdError('');
      setSuggestedSuffix(null);
      setIsVerifyingUpi(false);
      return true;
    } else {
      setUpiVerification(null);
      setUpiIdError(result.errorMessage || 'Invalid UPI ID format');
      if (result.suggestedHandle) {
        setSuggestedSuffix(result.suggestedHandle);
      }
      setIsVerifyingUpi(false);
      return false;
    }
  };

  // Trigger Primary Payment
  const handleProceedToPay = async () => {
    setErrorMessage(null);
    setCardError('');
    setUpiIdError('');

    // Method specific validations
    if (selectedMethod === 'other_upi') {
      const isValid = handleVerifyUpi();
      if (!isValid) return;
    }

    if (selectedMethod === 'card') {
      const cleanCard = cardNumber.replace(/\D/g, '');
      if (cleanCard.length < 15) {
        setCardError('Please enter a valid 16-digit card number');
        return;
      }
      if (!cardExpiry || cardExpiry.length < 5) {
        setCardError('Enter expiry in MM/YY format');
        return;
      }
      if (!cardCvv || cardCvv.length < 3) {
        setCardError('Enter 3-digit CVV');
        return;
      }
    }

    setIsProcessing(true);
    setStatusMessage('Initiating secure payment session...');

    try {
      // 1. Call official backend payment gateway endpoint
      const response = await fetch('/api/phonepe/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          bookingId: bookingId || '',
          customerName,
          customerPhone,
          customerEmail,
          serviceName,
          redirectOrigin: window.location.origin,
          paymentMode: selectedMethod,
          bank: selectedBank,
          bankId: selectedBankObj.code,
          bankName: selectedBankObj.name,
          paymentInstrumentType: selectedMethod === 'netbanking' ? 'NET_BANKING' : (selectedMethod === 'qr_code' ? 'UPI_QR' : 'PAY_PAGE'),
          instrumentType: selectedMethod === 'netbanking' ? 'NET_BANKING' : (selectedMethod === 'qr_code' ? 'UPI_QR' : 'PAY_PAGE')
        })
      });

      const data = await response.json();
      const generatedTxn = data.merchantTransactionId || `TXN_${Date.now()}`;
      setActiveTxnId(generatedTxn);

      const isMobile = typeof window !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const checkoutUrl = data.checkoutUrl || data.redirectUrl;
      const isHttpCheckout = Boolean(checkoutUrl && /^https?:\/\//i.test(checkoutUrl));

      // NET BANKING SEAMLESS REDIRECTION (Mobile & Desktop)
      // Immediately redirect current browser tab directly to checkoutUrl (avoids browser popup blocker)
      if (selectedMethod === 'netbanking') {
        if (data.isNetBankingUnavailable || !data.success || !checkoutUrl) {
          setIsProcessing(false);
          setErrorMessage(data.error || 'Net Banking is temporarily unavailable via gateway. Please pay instantly using PhonePe UPI or Dynamic QR.');
          return;
        }

        if (checkoutUrl) {
          setWebCheckoutUrl(checkoutUrl);
          setIsProcessing(false);
          setAwaitingConfirmation(true);
          setStatusMessage(`Connecting to secure ${selectedBankObj.name} Net Banking portal...`);
          startStatusPolling(generatedTxn);

          window.location.href = checkoutUrl;
          return;
        } else {
          setIsProcessing(false);
          setErrorMessage('Net Banking is temporarily unavailable via gateway. Please pay instantly using PhonePe UPI or Dynamic QR.');
          return;
        }
      }

      // 1. MOBILE HANDLING (App deep-links & browser redirect)
      if (isMobile) {
        if (selectedMethod === 'other_upi') {
          if (!MERCHANT_VPA) {
            setIsProcessing(false);
            setErrorMessage('Merchant UPI ID is not configured (VITE_MERCHANT_UPI_ID missing). Please choose Card or Net Banking.');
            return;
          }
          const standardIntentUri = `upi://pay?pa=${MERCHANT_VPA}&pn=${encodeURIComponent(
            MERCHANT_NAME
          )}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Service_${serviceName.slice(0, 15).replace(/\s+/g, '_')}`)}&tr=${encodeURIComponent(generatedTxn)}`;

          window.location.href = standardIntentUri;
          setIsProcessing(false);
          setAwaitingConfirmation(true);
          setStatusMessage('Waiting for payment confirmation from your UPI app... Do not close this screen.');
          startStatusPolling(generatedTxn);
          return;
        }

        if (data.success && checkoutUrl) {
          window.location.href = checkoutUrl;
          setIsProcessing(false);
          setAwaitingConfirmation(true);
          setStatusMessage('Redirecting to secure PhonePe Gateway checkout...');
          startStatusPolling(generatedTxn);
          return;
        }

        if (MERCHANT_VPA) {
          const fallbackIntentUri = `upi://pay?pa=${MERCHANT_VPA}&pn=${encodeURIComponent(
            MERCHANT_NAME
          )}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Service_${serviceName.slice(0, 15).replace(/\s+/g, '_')}`)}&tr=${encodeURIComponent(generatedTxn)}`;

          window.location.href = fallbackIntentUri;
          setIsProcessing(false);
          setAwaitingConfirmation(true);
          setStatusMessage('Waiting for payment confirmation from your UPI app... Do not close this screen.');
          startStatusPolling(generatedTxn);
          return;
        }

        setIsProcessing(false);
        setErrorMessage('Online payment gateway is temporarily unavailable.');
        return;
      }

      // 2. DESKTOP HANDLING (!isMobile)
      // Only enter awaitingConfirmation if web gateway tab was opened OR scannable QR is visibly rendered!
      if (isHttpCheckout) {
        window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
        setWebCheckoutUrl(checkoutUrl);
        if (data.qrData) {
          setDynamicQrData(data.qrData);
          setIsDynamicQr(Boolean(data.isDynamicQr));
        }
        setIsProcessing(false);
        setAwaitingConfirmation(true);
        setStatusMessage('PhonePe Web Gateway opened in a new tab. Please complete payment.');
        startStatusPolling(generatedTxn);
        return;
      }

      // If upstream PhonePe gateway did not return an HTTP URL (e.g. UPI Intent URI or fallback),
      // NEVER enter the blank awaitingConfirmation screen on Desktop!
      // Instead, switch to displaying the PhonePe Dynamic QR Code with clear instructions!
      const resolvedQr = data.qrData || (MERCHANT_VPA ? `upi://pay?pa=${MERCHANT_VPA}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Service_${serviceName.slice(0, 15).replace(/\s+/g, '_')}`)}&tr=${encodeURIComponent(generatedTxn)}` : null);

      if (resolvedQr) {
        setDynamicQrData(resolvedQr);
        setIsDynamicQr(Boolean(data.isDynamicQr || data.qrData));
        setSelectedMethod('qr_code');
        setAwaitingConfirmation(false);
        setIsProcessing(false);
        startStatusPolling(generatedTxn);
        return;
      }

      setIsProcessing(false);
      setErrorMessage('PhonePe gateway checkout is temporarily unavailable. Please try again or select another method.');
    } catch (err: any) {
      console.warn('[PaymentDrawer] API Initiation Warning:', err);
      setIsProcessing(false);
      if (!MERCHANT_VPA) {
        setErrorMessage('Failed to initiate payment session. Please check your connection or choose another method.');
        return;
      }
      const fallbackTxn = `TXN_PPE_${Date.now()}`;
      setActiveTxnId(fallbackTxn);
      const fallbackIntentUri = `upi://pay?pa=${MERCHANT_VPA}&pn=${encodeURIComponent(
        MERCHANT_NAME
      )}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Service_${serviceName.slice(0, 15).replace(/\s+/g, '_')}`)}&tr=${encodeURIComponent(fallbackTxn)}`;

      const isMobile = typeof window !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile) {
        window.location.href = fallbackIntentUri;
        setAwaitingConfirmation(true);
        setStatusMessage('Waiting for payment confirmation from your UPI app... Do not close this screen.');
        startStatusPolling(fallbackTxn);
      } else {
        // On desktop, render the scannable Dynamic QR code directly, never show empty waiting screen
        setDynamicQrData(fallbackIntentUri);
        setSelectedMethod('qr_code');
        setAwaitingConfirmation(false);
        startStatusPolling(fallbackTxn);
      }
    }
  };

  // Finalize payment verification with sound & haptic confirmation
  const handlePaymentFinalized = async (
    txnId: string,
    provider: string,
    methodType: 'upi' | 'card' | 'netbanking' | 'wallet' = 'upi'
  ) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    // Play haptic & sound confirmation immediately
    playSuccessChime();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([100, 50, 100]);
      } catch (e) {}
    }

    setPaymentSuccess(true);
    setIsProcessing(false);
    setAwaitingConfirmation(false);

    const successData: PaymentSuccessData = {
      txnId,
      method: methodType,
      provider,
      amount,
      paidAt: new Date().toISOString()
    };

    setTimeout(async () => {
      await onPaymentSuccess(successData);
    }, 800);
  };

  const handleDrawerClose = () => {
    if (isProcessing) {
      if (!window.confirm('Payment is being processed. Are you sure you want to cancel?')) {
        return;
      }
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (onPaymentCancel) {
      onPaymentCancel();
    } else {
      onClose();
    }
  };

  const getMethodLabel = (id: PaymentMethodId): string => {
    switch (id) {
      case 'phonepe': return 'PhonePe';
      case 'gpay': return 'Google Pay';
      case 'paytm': return 'Paytm UPI';
      case 'other_upi': return 'Other UPI';
      case 'qr_code': return 'UPI QR';
      case 'card': return 'Card Payment';
      case 'netbanking': return `${selectedBank.toUpperCase()} Net Banking`;
      case 'wallet': return 'Wallet';
      default: return 'Online Payment';
    }
  };

  const minutes = Math.floor(qrTimer / 60);
  const seconds = qrTimer % 60;
  const formattedQrTimer = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[250] flex flex-col justify-end sm:items-center sm:justify-end overflow-hidden">
          {/* Backdrop Blur Overlay */}
          <motion.div
            key="payment-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleDrawerClose}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
          />

          {/* Native Slide-up Bottom Sheet Panel */}
          <motion.div
            key="payment-drawer-panel"
            initial={{ y: '100%', opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            className="relative z-10 w-full max-w-lg bg-white rounded-t-[28px] sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] font-sans border-t border-slate-100"
          >
            {/* Grab Handle */}
            <div className="w-12 h-1.5 rounded-full bg-slate-300 mx-auto mt-3 mb-1 shrink-0 cursor-grab active:cursor-grabbing" />

            {/* Header: Title & Secure Badge */}
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    Payment Options
                  </h3>
                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                    <ShieldCheck size={12} className="text-emerald-600" />
                    100% Safe
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5 truncate max-w-[280px]">
                  {serviceName}
                </p>
              </div>

              <button
                type="button"
                onClick={handleDrawerClose}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Total Amount Pill / Summary */}
            <div className="px-5 py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-slate-600">Total Amount to Pay</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-black text-slate-900 tracking-tight">₹{amount}</span>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                  Zero Surcharge
                </span>
              </div>
            </div>

            {/* Main Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-left">
              {errorMessage && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs font-semibold text-rose-800 shadow-xs">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0 text-rose-600" />
                    <span>{errorMessage}</span>
                  </div>
                  {errorMessage.includes('Net Banking') && (
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMessage(null);
                        if (isMobile) {
                          setSelectedMethod('phonepe');
                        } else {
                          setSelectedMethod('qr_code');
                        }
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[11px] font-bold shrink-0 shadow-xs transition-colors cursor-pointer"
                    >
                      Pay via UPI / QR
                    </button>
                  )}
                </div>
              )}

              {/* SUCCESS STATE */}
              {paymentSuccess ? (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xl shadow-emerald-500/30 animate-bounce">
                    <CheckCircle2 size={36} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900">Payment Successful!</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      ₹{amount} paid securely via {getMethodLabel(selectedMethod)}
                    </p>
                    {activeTxnId && (
                      <p className="text-[11px] font-mono text-slate-400 mt-2 bg-slate-50 py-1 px-3 rounded-lg inline-block border border-slate-200">
                        Ref: {activeTxnId}
                      </p>
                    )}
                  </div>
                </div>
              ) : awaitingConfirmation ? (
                /* AWAITING CONFIRMATION SCREEN - ZOMATO/SWIGGY STYLE AUTOMATED CHECKOUT */
                <div className="py-6 space-y-5">
                  <div className="p-6 bg-gradient-to-b from-blue-50/80 via-blue-50/30 to-white border border-blue-200/80 rounded-3xl text-center space-y-4 shadow-sm">
                    {/* Net Banking Portal Redirection State & Desktop Fallback */}
                    {selectedMethod === 'netbanking' ? (
                      <div className="p-5 bg-white border-2 border-blue-200 rounded-2xl shadow-xs space-y-3.5 text-center">
                        <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 shadow-xs flex items-center justify-center mx-auto">
                          <Landmark size={24} />
                        </div>
                        <div className="space-y-1">
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-[11px] font-black uppercase tracking-wider">
                            <span>{selectedBankObj.name} Net Banking</span>
                          </div>
                          <h4 className="text-sm font-black text-slate-900 pt-1">
                            Redirecting to {selectedBankObj.name} Portal...
                          </h4>
                          <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto leading-relaxed">
                            If your browser did not redirect automatically, click below to proceed to your bank's secure portal:
                          </p>
                        </div>
                        {webCheckoutUrl && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                window.location.href = webCheckoutUrl;
                              }}
                              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-105 active:scale-95 text-white rounded-xl text-xs font-black transition-all shadow-md inline-flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <ExternalLink size={14} />
                              <span>Proceed to {selectedBankObj.name} Portal</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* On Desktop: Show Web Checkout status & re-open button if gateway tab was opened */}
                        {!isMobile && webCheckoutUrl && (
                          <div className="p-4 bg-white border-2 border-blue-200 rounded-2xl shadow-xs space-y-2 text-center">
                            <div className="flex items-center justify-center gap-2 text-blue-900 font-bold text-xs">
                              <ExternalLink size={15} className="text-blue-600" />
                              <span>PhonePe Web Gateway opened in a new tab</span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium">
                              Please complete payment in the checkout window. If your browser blocked the tab, click below:
                            </p>
                            <button
                              type="button"
                              onClick={() => window.open(webCheckoutUrl, '_blank', 'noopener,noreferrer')}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <ExternalLink size={13} />
                              <span>Re-open PhonePe Web Checkout</span>
                            </button>
                          </div>
                        )}

                        {/* On Desktop: Scannable Dynamic QR Code visibly rendered on screen */}
                        {!isMobile && (
                          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
                            <div className="py-1 px-3 bg-blue-50 border border-blue-200 rounded-lg inline-block text-blue-900 text-xs font-bold">
                              Scan this QR using your PhonePe / GPay app to pay
                            </div>
                            <div className="p-2 bg-white rounded-xl border border-slate-200 inline-block shadow-xs">
                              {dynamicQrData && (dynamicQrData.startsWith('data:image') || dynamicQrData.startsWith('http')) ? (
                                <img
                                  src={dynamicQrData}
                                  alt="PhonePe Dynamic QR"
                                  className="w-36 h-36 object-contain mx-auto"
                                />
                              ) : (
                                <QRCodeSVG
                                  value={dynamicQrData || upiIntentUri}
                                  size={144}
                                  level="H"
                                  includeMargin={true}
                                />
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium">
                              Scan with PhonePe, Google Pay, Paytm, or BHIM app on your phone
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    {/* Concentric Radar Pulse Ring (on Mobile) */}
                    {isMobile && (
                      <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full bg-blue-400/20 animate-ping" />
                        <div className="absolute -inset-2 rounded-full border-2 border-blue-300 animate-pulse opacity-60" />
                        <div className="relative w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30">
                          <Smartphone size={28} className="animate-pulse" />
                        </div>
                      </div>
                    )}

                    {!isPollingTimedOut ? (
                      <>
                        <div className="space-y-2">
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100/90 text-blue-700 rounded-full text-[11px] font-black uppercase tracking-wider">
                            <RefreshCw size={12} className="animate-spin text-blue-600" />
                            <span>Verifying payment: {pollingCountdown}s remaining</span>
                          </div>
                          <h4 className="text-base font-black text-slate-900 leading-snug">
                            Waiting for payment confirmation... Do not close this screen.
                          </h4>
                          <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
                            Approving payment for <span className="font-bold text-slate-900">₹{amount}</span>. Status updates automatically.
                          </p>
                        </div>

                        {/* Infinite Progress Shimmer */}
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <motion.div
                            className="h-full bg-blue-600 rounded-full"
                            animate={{ x: ['-100%', '100%'] }}
                            transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                          />
                        </div>

                        <div className="flex items-center justify-center gap-3 text-[11px] text-slate-400 font-semibold pt-1">
                          <span>Live status polling every 2.5s ({pollingCountdown}s)</span>
                          <span>•</span>
                          <span>100% Bank Secured</span>
                        </div>
                      </>
                    ) : (
                      /* TIMEOUT FALLBACK UI */
                      <div className="space-y-4 py-2">
                        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
                          <AlertCircle size={24} />
                        </div>
                        <div className="space-y-1.5">
                          <h4 className="text-sm font-black text-slate-900">
                            Payment verification timed out
                          </h4>
                          <p className="text-xs text-slate-600 font-medium max-w-sm mx-auto leading-relaxed">
                            Payment not detected yet. If money was debited, it will reflect within 10 minutes.
                          </p>
                        </div>

                        {/* Clear action buttons */}
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (activeTxnId) {
                                startStatusPolling(activeTxnId);
                              } else {
                                const newTxn = `TXN_${Date.now()}`;
                                setActiveTxnId(newTxn);
                                startStatusPolling(newTxn);
                              }
                            }}
                            className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs inline-flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <RefreshCw size={13} />
                            <span>Check Status Again</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              stopStatusPolling();
                              setAwaitingConfirmation(false);
                              setIsProcessing(false);
                              setIsPollingTimedOut(false);
                            }}
                            className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl text-xs font-bold transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <span>Back to Payment Options</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {!isPollingTimedOut && (
                    <button
                      type="button"
                      onClick={() => {
                        stopStatusPolling();
                        setAwaitingConfirmation(false);
                        setIsProcessing(false);
                        setIsPollingTimedOut(false);
                      }}
                      className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-800 py-2 cursor-pointer transition-colors"
                    >
                      ← Back to Payment Options
                    </button>
                  )}
                </div>
              ) : (
                /* PAYMENT OPTIONS ACCORDION & LIST */
                <div className="space-y-4">
                  {/* SECTION 1: UPI APPS */}
                  <div className="space-y-2.5">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block px-1">
                      UPI Options (Fastest & Zero Fee)
                    </span>

                    {/* Google Pay */}
                    <div
                      onClick={() => handleSelectUpiApp('gpay')}
                      className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                        selectedMethod === 'gpay'
                          ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-center shrink-0">
                          {/* Google G Brand Icon */}
                          <span className="text-lg font-black text-[#1A73E8] tracking-tighter">G</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-black text-slate-900">Google Pay</h4>
                            <span className="bg-blue-100 text-blue-800 text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
                              {!isMobile ? 'Scan QR' : 'Instant'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium">
                            {!isMobile ? 'Scan dynamic QR with Google Pay app' : 'Pay directly via GPay UPI'}
                          </p>
                        </div>
                      </div>

                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selectedMethod === 'gpay' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                      }`}>
                        {selectedMethod === 'gpay' && <Check size={12} className="stroke-[3]" />}
                      </div>
                    </div>

                    {/* PhonePe */}
                    <div
                      onClick={() => handleSelectUpiApp('phonepe')}
                      className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                        selectedMethod === 'phonepe'
                          ? 'border-[#5F259F] bg-purple-50/40 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#5F259F] text-white shadow-xs flex items-center justify-center text-lg font-black shrink-0">
                          पे
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-black text-slate-900">PhonePe</h4>
                            <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
                              Recommended
                            </span>
                          </div>
                          <p className="text-[11px] text-purple-700 font-medium">
                            {!isMobile ? 'Scan dynamic QR or use web checkout' : '1-tap checkout via PhonePe Gateway'}
                          </p>
                        </div>
                      </div>

                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selectedMethod === 'phonepe' ? 'border-[#5F259F] bg-[#5F259F] text-white' : 'border-slate-300'
                      }`}>
                        {selectedMethod === 'phonepe' && <Check size={12} className="stroke-[3]" />}
                      </div>
                    </div>

                    {/* Paytm */}
                    <div
                      onClick={() => handleSelectUpiApp('paytm')}
                      className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                        selectedMethod === 'paytm'
                          ? 'border-[#00BAF2] bg-sky-50/40 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#002970] text-[#00BAF2] shadow-xs flex items-center justify-center text-[10px] font-black tracking-tighter shrink-0">
                          Paytm
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-900">Paytm UPI</h4>
                          <p className="text-[11px] text-slate-500 font-medium">
                            {!isMobile ? 'Scan dynamic QR with Paytm app' : 'Pay via Paytm wallet or bank account'}
                          </p>
                        </div>
                      </div>

                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selectedMethod === 'paytm' ? 'border-[#00BAF2] bg-[#00BAF2] text-white' : 'border-slate-300'
                      }`}>
                        {selectedMethod === 'paytm' && <Check size={12} className="stroke-[3]" />}
                      </div>
                    </div>

                    {/* Other UPI / Custom ID */}
                    <div
                      onClick={() => setSelectedMethod('other_upi')}
                      className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                        selectedMethod === 'other_upi'
                          ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white shadow-xs flex items-center justify-center text-xs font-black shrink-0">
                            UPI
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-slate-900">Other UPI Apps / Enter UPI ID</h4>
                            <p className="text-[11px] text-slate-500 font-medium">BHIM, Cred, Amazon Pay, or custom ID</p>
                          </div>
                        </div>

                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          selectedMethod === 'other_upi' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                        }`}>
                          {selectedMethod === 'other_upi' && <Check size={12} className="stroke-[3]" />}
                        </div>
                      </div>

                      {/* Expandable UPI ID Input */}
                      {selectedMethod === 'other_upi' && (
                        <div className="mt-3 pt-3 border-t border-blue-200/60 space-y-2.5" onClick={(e) => e.stopPropagation()}>
                          <div className="relative flex items-center">
                            <input
                              id="online-modal-upi-input"
                              type="text"
                              placeholder="e.g. 9876543210@paytm or name@oksbi"
                              value={customUpiId}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCustomUpiId(val);
                                if (upiIdError) setUpiIdError('');
                                if (suggestedSuffix) setSuggestedSuffix(null);
                                if (upiVerification) setUpiVerification(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleVerifyUpi();
                                }
                              }}
                              className={`w-full pl-3.5 pr-20 py-2.5 bg-white border rounded-xl text-xs font-medium text-slate-900 outline-none transition-all ${
                                upiVerification
                                  ? 'border-emerald-500 ring-2 ring-emerald-100 bg-emerald-50/20'
                                  : upiIdError
                                  ? 'border-rose-400 ring-2 ring-rose-100'
                                  : 'border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100'
                              }`}
                            />

                            {/* Inline Verify Button / Green Verified Tick */}
                            <div className="absolute right-1.5 flex items-center gap-1.5">
                              {upiVerification ? (
                                <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black tracking-wide border border-emerald-300/80 shadow-2xs">
                                  <BadgeCheck size={13} className="text-emerald-600 stroke-[2.5]" />
                                  <span>VERIFIED</span>
                                </div>
                              ) : (
                                <button
                                  id="online-modal-verify-upi-btn"
                                  type="button"
                                  disabled={isVerifyingUpi || !customUpiId.trim()}
                                  onClick={() => handleVerifyUpi()}
                                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-2xs flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                                >
                                  {isVerifyingUpi ? (
                                    <RefreshCw size={11} className="animate-spin" />
                                  ) : (
                                    <CheckCircle2 size={11} className="stroke-[2.5]" />
                                  )}
                                  <span>Verify</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Green Verified Payee Preview Box */}
                          {upiVerification && (
                            <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="p-2.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between shadow-2xs"
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                                  <Check size={13} className="stroke-[3]" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-[11px] font-black text-emerald-950">{upiVerification.payeeName}</p>
                                    <span className="bg-emerald-600/10 text-emerald-700 text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
                                      NPCI Active
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-emerald-700 font-medium">
                                    Linked Bank: <span className="font-bold text-emerald-900">{upiVerification.bankName}</span>
                                  </p>
                                </div>
                              </div>
                              <span className="text-[10px] text-emerald-600 font-bold hidden sm:inline-block">Ready to Pay</span>
                            </motion.div>
                          )}

                          {/* Invalid Handle Highlight & Quick Auto-Fix */}
                          {suggestedSuffix && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.98 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="p-2 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-[11px]"
                            >
                              <div className="flex items-center gap-1.5 text-amber-900">
                                <AlertCircle size={13} className="text-amber-600 shrink-0" />
                                <span>
                                  Bank suffix unrecognized. Did you mean <span className="font-black text-amber-950 underline">{suggestedSuffix}</span>?
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const prefix = customUpiId.split('@')[0] || '';
                                  const corrected = `${prefix}${suggestedSuffix}`;
                                  setCustomUpiId(corrected);
                                  setSuggestedSuffix(null);
                                  handleVerifyUpi(corrected);
                                }}
                                className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-[10px] font-black shrink-0 transition-colors shadow-2xs"
                              >
                                Use {suggestedSuffix}
                              </button>
                            </motion.div>
                          )}

                          {/* Quick Suffix Chips */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 block">Popular Bank Handles:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {POPULAR_UPI_HANDLES.map((suffix) => (
                                <button
                                  key={suffix}
                                  type="button"
                                  onClick={() => {
                                    const prefix = customUpiId.split('@')[0] || '';
                                    const updated = `${prefix}${suffix}`;
                                    setCustomUpiId(updated);
                                    setSuggestedSuffix(null);
                                    handleVerifyUpi(updated);
                                  }}
                                  className="px-2 py-0.5 bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 rounded-lg text-[10px] font-bold text-slate-600 hover:text-blue-700 transition-all cursor-pointer shadow-2xs"
                                >
                                  {suffix}
                                </button>
                              ))}
                            </div>
                          </div>

                          {upiIdError && !suggestedSuffix && (
                            <div className="flex items-center gap-1.5 text-rose-600 text-[10px] font-bold">
                              <AlertCircle size={12} className="shrink-0" />
                              <p>{upiIdError}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Scan QR Code Option */}
                    <div
                      onClick={() => setSelectedMethod('qr_code')}
                      className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                        selectedMethod === 'qr_code'
                          ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white shadow-xs flex items-center justify-center shrink-0">
                            <QrCode size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-black text-slate-900">Scan QR Code</h4>
                              <span className="bg-slate-100 text-slate-700 text-[9px] font-bold px-1.5 py-0.2 rounded">
                                Desktop / Scanner
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium">Scan and pay using any UPI app</p>
                          </div>
                        </div>

                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          selectedMethod === 'qr_code' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                        }`}>
                          {selectedMethod === 'qr_code' && <Check size={12} className="stroke-[3]" />}
                        </div>
                      </div>

                      {/* Expandable QR Code Container */}
                      {selectedMethod === 'qr_code' && (
                        <div className="mt-3 pt-3 border-t border-blue-200/60 flex flex-col items-center text-center space-y-3" onClick={(e) => e.stopPropagation()}>
                          {!dynamicQrData && !MERCHANT_VPA && !isGeneratingQr ? (
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs text-center space-y-1 w-full">
                              <AlertCircle className="mx-auto text-amber-600 mb-1" size={24} />
                              <p className="font-bold">Merchant UPI ID Not Configured</p>
                              <p className="text-[11px] text-amber-700">Please set VITE_MERCHANT_UPI_ID in environment settings or select Cards / Net Banking to proceed.</p>
                            </div>
                          ) : (
                            <>
                              {!isMobile && (
                                <div className="py-1 px-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-xs font-bold w-full">
                                  Scan this QR using your {qrInstructionApp} app to pay
                                </div>
                              )}

                              <div className="p-3 bg-white rounded-2xl border-2 border-slate-200 shadow-sm inline-block relative">
                                {isGeneratingQr ? (
                                  <div className="w-40 h-40 flex flex-col items-center justify-center gap-2 text-slate-400">
                                    <RefreshCw size={24} className="animate-spin text-blue-600" />
                                    <span className="text-[11px] font-bold">Generating PhonePe QR...</span>
                                  </div>
                                ) : dynamicQrData && (dynamicQrData.startsWith('data:image') || dynamicQrData.startsWith('http')) ? (
                                  <img
                                    src={dynamicQrData}
                                    alt="PhonePe Dynamic QR"
                                    className="w-40 h-40 object-contain mx-auto"
                                  />
                                ) : (
                                  <QRCodeSVG
                                    value={dynamicQrData || upiIntentUri}
                                    size={160}
                                    level="H"
                                    includeMargin={true}
                                  />
                                )}
                              </div>

                              {/* Dynamic vs Standard QR Status Badge */}
                              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                {isDynamicQr ? (
                                  <span className="flex items-center gap-1 text-emerald-700">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Dynamic PhonePe PG QR • Auto-Detect Active
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-slate-600">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                    NPCI Standard UPI QR
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                                <span>Valid for: <strong className="text-slate-800 font-mono">{formattedQrTimer}</strong></span>
                                {MERCHANT_VPA && (
                                  <>
                                    <span>•</span>
                                    <button
                                      type="button"
                                      onClick={handleCopyVpa}
                                      className="text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                                    >
                                      <Copy size={12} /> {copiedVpa ? 'Copied VPA!' : 'Copy UPI ID'}
                                    </button>
                                  </>
                                )}
                              </div>

                              {/* Live automated polling notice */}
                              <div className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-50/90 border border-blue-200/80 rounded-xl text-blue-800 text-[11px] font-semibold">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                                </span>
                                <span>Waiting for payment confirmation from your UPI app... Do not close this screen.</span>
                              </div>

                              {!isMobile && (
                                <div className="w-full pt-1">
                                  <button
                                    type="button"
                                    onClick={handleLaunchWebGateway}
                                    className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                  >
                                    <ExternalLink size={13} />
                                    <span>Prefer browser checkout? Open PhonePe Web Gateway</span>
                                  </button>
                                </div>
                              )}

                              <div className="w-full py-1 text-center">
                                <p className="text-[11px] text-slate-400">
                                  Scan using PhonePe, GPay, Paytm, or any BHIM UPI app. Status verifies automatically.
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SECTION 2: CARDS & NET BANKING */}
                  <div className="space-y-2.5 pt-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block px-1">
                      Cards &amp; Net Banking
                    </span>

                    {/* Credit / Debit Card */}
                    <div
                      onClick={() => setSelectedMethod('card')}
                      className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                        selectedMethod === 'card'
                          ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 shadow-xs flex items-center justify-center shrink-0">
                            <CreditCard size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-black text-slate-900">Credit or Debit Card</h4>
                              <div className="flex gap-1">
                                <span className="text-[8px] font-black px-1 rounded bg-slate-100 text-slate-700">VISA</span>
                                <span className="text-[8px] font-black px-1 rounded bg-slate-100 text-slate-700">MC</span>
                                <span className="text-[8px] font-black px-1 rounded bg-slate-100 text-slate-700">RuPay</span>
                              </div>
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium">Safe 3D Secure checkout</p>
                          </div>
                        </div>

                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          selectedMethod === 'card' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                        }`}>
                          {selectedMethod === 'card' && <Check size={12} className="stroke-[3]" />}
                        </div>
                      </div>

                      {/* Inline Card Input */}
                      {selectedMethod === 'card' && (
                        <div className="mt-3 pt-3 border-t border-blue-200/60 space-y-2.5" onClick={(e) => e.stopPropagation()}>
                          <div>
                            <input
                              type="text"
                              maxLength={19}
                              placeholder="Card Number"
                              value={cardNumber}
                              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              maxLength={5}
                              placeholder="MM / YY"
                              value={cardExpiry}
                              onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                              className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
                            />
                            <input
                              type="password"
                              maxLength={4}
                              placeholder="CVV"
                              value={cardCvv}
                              onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                              className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
                            />
                          </div>

                          {cardError && <p className="text-[10px] text-rose-600 font-bold">{cardError}</p>}
                        </div>
                      )}
                    </div>

                    {/* Net Banking */}
                    <div
                      onClick={() => setSelectedMethod('netbanking')}
                      className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                        selectedMethod === 'netbanking'
                          ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 shadow-xs flex items-center justify-center shrink-0">
                            <Landmark size={20} />
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-slate-900">Net Banking</h4>
                            <p className="text-[11px] text-slate-500 font-medium">All major Indian banks supported</p>
                          </div>
                        </div>

                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          selectedMethod === 'netbanking' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                        }`}>
                          {selectedMethod === 'netbanking' && <Check size={12} className="stroke-[3]" />}
                        </div>
                      </div>

                      {/* Bank Pills */}
                      {selectedMethod === 'netbanking' && (
                        <div className="mt-3 pt-3 border-t border-blue-200/60 space-y-2" onClick={(e) => e.stopPropagation()}>
                          <div className="grid grid-cols-3 gap-1.5">
                            {POPULAR_BANKS.map((b) => (
                              <button
                                key={b.id}
                                type="button"
                                onClick={() => setSelectedBank(b.id)}
                                className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border text-center transition-all ${
                                  selectedBank === b.id
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                {b.code}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Wallets */}
                    <div
                      onClick={() => setSelectedMethod('wallet')}
                      className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                        selectedMethod === 'wallet'
                          ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-xs flex items-center justify-center shrink-0">
                          <Wallet size={20} />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-900">Wallets</h4>
                          <p className="text-[11px] text-slate-500 font-medium">PhonePe Wallet, Paytm Wallet &amp; more</p>
                        </div>
                      </div>

                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selectedMethod === 'wallet' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                      }`}>
                        {selectedMethod === 'wallet' && <Check size={12} className="stroke-[3]" />}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* STICKY BOTTOM ACTION BAR */}
            {!paymentSuccess && !awaitingConfirmation && (
              <div className="p-4 sm:p-5 border-t border-slate-100 bg-white shrink-0 flex items-center justify-between gap-4 shadow-lg">
                <div className="text-left shrink-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block leading-none">
                    TO PAY
                  </span>
                  <span className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
                    ₹{amount}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-bold block leading-none mt-0.5">
                    100% Secured
                  </span>
                </div>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleProceedToPay}
                  className={`flex-1 py-3.5 px-6 rounded-2xl font-black text-sm uppercase tracking-wider text-white transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg active:scale-98 ${
                    selectedMethod === 'phonepe'
                      ? 'bg-gradient-to-r from-[#5F259F] to-[#7B33C7] shadow-purple-600/25 hover:brightness-105'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-600/25 hover:brightness-105'
                  }`}
                >
                  {isProcessing ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    <>
                      <Lock size={15} />
                      <span>Pay ₹{amount}</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
