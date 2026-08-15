import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ShieldCheck,
  Lock,
  Smartphone,
  CreditCard,
  Building2,
  Wallet,
  CheckCircle2,
  AlertCircle,
  QrCode,
  ArrowRight,
  RefreshCw,
  Zap,
  Check,
  ChevronRight,
  Shield,
  Clock,
  Sparkles,
  Info
} from 'lucide-react';

export interface PaymentSuccessData {
  txnId: string;
  method: 'upi' | 'card' | 'netbanking' | 'wallet';
  provider: string;
  amount: number;
  paidAt: string;
}

interface OnlinePaymentGatewayModalProps {
  isOpen: boolean;
  amount: number;
  serviceName: string;
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

type GatewayTab = 'upi' | 'card' | 'netbanking' | 'wallet';
type ProcessingPhase = 'idle' | 'connecting' | 'authorizing' | 'verified' | 'failed';

const POPULAR_BANKS = [
  { id: 'hdfc', name: 'HDFC Bank', code: 'HDFC', badge: 'Popular', icon: '🏛️' },
  { id: 'sbi', name: 'State Bank of India', code: 'SBI', badge: 'Popular', icon: '🏦' },
  { id: 'icici', name: 'ICICI Bank', code: 'ICICI', badge: 'Popular', icon: '🏛️' },
  { id: 'axis', name: 'Axis Bank', code: 'AXIS', badge: 'Popular', icon: '🏦' },
  { id: 'kotak', name: 'Kotak Mahindra', code: 'KOTAK', icon: '🏛️' },
  { id: 'pnb', name: 'Punjab National Bank', code: 'PNB', icon: '🏦' }
];

const ALL_OTHER_BANKS = [
  'Bank of Baroda',
  'Canara Bank',
  'Union Bank of India',
  'IndusInd Bank',
  'IDFC FIRST Bank',
  'Yes Bank',
  'Federal Bank',
  'Bank of India',
  'Central Bank of India',
  'Indian Overseas Bank',
  'RBL Bank'
];

const WALLET_PROVIDERS = [
  { id: 'amazonpay', name: 'Amazon Pay', icon: '📦', offer: 'Get 5% cashback' },
  { id: 'paytm', name: 'Paytm Wallet', icon: '🪙', offer: 'Instant link & pay' },
  { id: 'mobikwik', name: 'MobiKwik', icon: '⚡', offer: 'SuperCash applicable' },
  { id: 'phonepe_wallet', name: 'PhonePe Wallet', icon: '🟣', offer: 'Direct balance debit' }
];

export default function OnlinePaymentGatewayModal({
  isOpen,
  amount,
  serviceName,
  customerName = 'Customer',
  customerPhone = '',
  customerEmail = '',
  bookingDetails,
  onClose,
  onPaymentSuccess,
  onPaymentCancel
}: OnlinePaymentGatewayModalProps) {
  const [activeTab, setActiveTab] = useState<GatewayTab>('upi');
  
  // UPI Sub-states
  const [selectedUpiApp, setSelectedUpiApp] = useState<'gpay' | 'phonepe' | 'paytm' | 'bhim' | 'qr' | 'vpa'>('phonepe');
  const [upiIdInput, setUpiIdInput] = useState('');
  const [upiIdError, setUpiIdError] = useState('');
  const [qrTimer, setQrTimer] = useState(299); // 5 minutes

  // Card Sub-states
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState(customerName || '');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [saveCard, setSaveCard] = useState(true);
  const [cardError, setCardError] = useState('');

  // Netbanking Sub-states
  const [selectedBank, setSelectedBank] = useState<string>('hdfc');
  const [otherBankSelected, setOtherBankSelected] = useState<string>('');

  // Wallet Sub-states
  const [selectedWallet, setSelectedWallet] = useState<string>('amazonpay');

  // Processing Lifecycle States
  const [processingPhase, setProcessingPhase] = useState<ProcessingPhase>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [generatedTxnId, setGeneratedTxnId] = useState('');
  const [simulatedOtp, setSimulatedOtp] = useState('');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [otpTimer, setOtpTimer] = useState(30);

  // QR Code Timer
  useEffect(() => {
    if (!isOpen || selectedUpiApp !== 'qr') return;
    const interval = setInterval(() => {
      setQrTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, selectedUpiApp]);

  // Card brand detection
  const getCardBrand = (num: string) => {
    const clean = num.replace(/\D/g, '');
    if (clean.startsWith('4')) return 'Visa';
    if (clean.startsWith('51') || clean.startsWith('52') || clean.startsWith('53') || clean.startsWith('54') || clean.startsWith('55')) return 'Mastercard';
    if (clean.startsWith('60') || clean.startsWith('65') || clean.startsWith('81') || clean.startsWith('82')) return 'RuPay';
    return null;
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

  // Close handler with incomplete notice
  const handleModalClose = () => {
    if (processingPhase === 'connecting' || processingPhase === 'authorizing') {
      if (!window.confirm("Payment is in progress. Are you sure you want to cancel?")) {
        return;
      }
    }
    if (onPaymentCancel) {
      onPaymentCancel();
    } else {
      onClose();
    }
  };

  // Main Payment Submission Trigger
  const handleInitiatePayment = (providerName: string, methodType: GatewayTab) => {
    // Basic validations
    if (methodType === 'upi') {
      if (selectedUpiApp === 'vpa') {
        if (!upiIdInput.trim() || !upiIdInput.includes('@')) {
          setUpiIdError('Please enter a valid UPI ID (e.g., yourname@oksbi or mobile@paytm)');
          return;
        }
        setUpiIdError('');
      }
    } else if (methodType === 'card') {
      const cleanCard = cardNumber.replace(/\D/g, '');
      if (cleanCard.length < 15) {
        setCardError('Please enter a valid 16-digit card number');
        return;
      }
      if (!cardExpiry || cardExpiry.length < 5) {
        setCardError('Please enter card expiry in MM/YY format');
        return;
      }
      if (!cardCvv || cardCvv.length < 3) {
        setCardError('Please enter a valid 3-digit CVV');
        return;
      }
      setCardError('');
    }

    // Step 1: Connecting to Bank Gateway
    setProcessingPhase('connecting');
    setStatusMessage('Connecting to Secure Bank Gateway...');

    setTimeout(() => {
      // Step 2: Simulating Authorization / OTP / UPI approval
      setProcessingPhase('authorizing');

      if (methodType === 'card' || methodType === 'netbanking') {
        const randomOtp = Math.floor(100000 + Math.random() * 900000).toString();
        setSimulatedOtp(randomOtp);
        setShowOtpScreen(true);
        setStatusMessage('Simulating OTP / Bank 2FA Authorization...');
      } else if (methodType === 'upi') {
        setStatusMessage(`Sending payment request to ${providerName}...`);
        // Auto-approve simulated UPI request after 3.2s
        setTimeout(() => {
          finalizeSuccessfulPayment(methodType, providerName);
        }, 3200);
      } else {
        setStatusMessage(`Authorizing debit of ₹${amount} with ${providerName}...`);
        setTimeout(() => {
          finalizeSuccessfulPayment(methodType, providerName);
        }, 2500);
      }
    }, 1500);
  };

  // Step 3: Verified Successfully
  const finalizeSuccessfulPayment = async (methodType: GatewayTab, providerName: string) => {
    const txnId = `TXN_${Date.now().toString().slice(-8)}_${Math.floor(1000 + Math.random() * 9000)}`;
    setGeneratedTxnId(txnId);
    setShowOtpScreen(false);
    setProcessingPhase('verified');
    setStatusMessage('Payment Verified Successfully!');

    const successData: PaymentSuccessData = {
      txnId,
      method: methodType,
      provider: providerName,
      amount,
      paidAt: new Date().toISOString()
    };

    // Wait 1.6s to display success visual before handing off to booking confirmation
    setTimeout(async () => {
      await onPaymentSuccess(successData);
    }, 1600);
  };

  const handleOtpSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!enteredOtp || enteredOtp.length < 4) {
      alert("Please enter the 6-digit OTP");
      return;
    }
    setShowOtpScreen(false);
    const provider = activeTab === 'card' ? `${getCardBrand(cardNumber) || 'Credit/Debit Card'}` : (selectedBank ? `${selectedBank.toUpperCase()} Net Banking` : 'Net Banking');
    finalizeSuccessfulPayment(activeTab, provider);
  };

  if (!isOpen) return null;

  return (
    <div 
      id="online-payment-gateway-modal"
      className="fixed inset-0 z-[250] flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        transition={{ duration: 0.2 }}
        className="bg-white w-full max-w-2xl rounded-3xl sm:rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200 flex flex-col my-auto max-h-[92vh]"
      >
        {/* GATEWAY TOP SECURE HEADER */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between relative shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-emerald-400 shadow-inner">
              <ShieldCheck size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight text-white flex items-center gap-1.5">
                  Secure Checkout Gateway
                </h3>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Lock size={9} /> 256-Bit SSL
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium">
                Zomindia Services • {serviceName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">Total Payable</span>
              <span className="text-xl font-black text-white">₹{amount}</span>
            </div>
            <button
              type="button"
              onClick={handleModalClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* MOBILE AMOUNT BANNER */}
        <div className="sm:hidden bg-blue-50/80 px-4 py-2.5 border-b border-blue-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-blue-900 text-xs font-bold">
            <Zap size={14} className="text-blue-600 fill-blue-600" />
            <span>Amount to be debited:</span>
          </div>
          <span className="text-lg font-black text-slate-900">₹{amount}</span>
        </div>

        {/* MAIN BODY: SPLIT VIEW ON DESKTOP, TABBED ON MOBILE */}
        <div className="flex-1 overflow-y-auto flex flex-col md:flex-row">
          
          {/* LEFT SIDEBAR: PAYMENT METHOD TABS */}
          <div className="w-full md:w-56 bg-slate-50/90 border-b md:border-b-0 md:border-r border-slate-200 p-2 sm:p-3 flex md:flex-col gap-1.5 overflow-x-auto shrink-0">
            <span className="hidden md:block text-[10px] font-black text-slate-400 uppercase tracking-wider px-2 py-1">
              Payment Modes
            </span>

            {/* Tab 1: UPI */}
            <button
              type="button"
              onClick={() => setActiveTab('upi')}
              className={`flex-1 md:flex-none flex items-center justify-between p-2.5 sm:p-3 rounded-xl sm:rounded-2xl text-left transition-all cursor-pointer whitespace-nowrap md:whitespace-normal ${
                activeTab === 'upi'
                  ? 'bg-[#002e6e] text-white shadow-md font-bold'
                  : 'bg-white md:bg-transparent text-slate-700 hover:bg-slate-100/80 border md:border-transparent border-slate-200/80 font-medium'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                  activeTab === 'upi' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800'
                }`}>
                  <Smartphone size={16} />
                </div>
                <div>
                  <span className="text-xs font-bold block">UPI &amp; QR</span>
                  <span className={`text-[9px] block ${activeTab === 'upi' ? 'text-blue-200' : 'text-slate-400'}`}>GPay, PhonePe, Paytm</span>
                </div>
              </div>
              <ChevronRight size={14} className={`hidden md:block ${activeTab === 'upi' ? 'text-white' : 'text-slate-300'}`} />
            </button>

            {/* Tab 2: Cards */}
            <button
              type="button"
              onClick={() => setActiveTab('card')}
              className={`flex-1 md:flex-none flex items-center justify-between p-2.5 sm:p-3 rounded-xl sm:rounded-2xl text-left transition-all cursor-pointer whitespace-nowrap md:whitespace-normal ${
                activeTab === 'card'
                  ? 'bg-[#002e6e] text-white shadow-md font-bold'
                  : 'bg-white md:bg-transparent text-slate-700 hover:bg-slate-100/80 border md:border-transparent border-slate-200/80 font-medium'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                  activeTab === 'card' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-800'
                }`}>
                  <CreditCard size={16} />
                </div>
                <div>
                  <span className="text-xs font-bold block">Credit / Debit</span>
                  <span className={`text-[9px] block ${activeTab === 'card' ? 'text-blue-200' : 'text-slate-400'}`}>Visa, RuPay, Master</span>
                </div>
              </div>
              <ChevronRight size={14} className={`hidden md:block ${activeTab === 'card' ? 'text-white' : 'text-slate-300'}`} />
            </button>

            {/* Tab 3: Net Banking */}
            <button
              type="button"
              onClick={() => setActiveTab('netbanking')}
              className={`flex-1 md:flex-none flex items-center justify-between p-2.5 sm:p-3 rounded-xl sm:rounded-2xl text-left transition-all cursor-pointer whitespace-nowrap md:whitespace-normal ${
                activeTab === 'netbanking'
                  ? 'bg-[#002e6e] text-white shadow-md font-bold'
                  : 'bg-white md:bg-transparent text-slate-700 hover:bg-slate-100/80 border md:border-transparent border-slate-200/80 font-medium'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                  activeTab === 'netbanking' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  <Building2 size={16} />
                </div>
                <div>
                  <span className="text-xs font-bold block">Net Banking</span>
                  <span className={`text-[9px] block ${activeTab === 'netbanking' ? 'text-blue-200' : 'text-slate-400'}`}>All Indian Banks</span>
                </div>
              </div>
              <ChevronRight size={14} className={`hidden md:block ${activeTab === 'netbanking' ? 'text-white' : 'text-slate-300'}`} />
            </button>

            {/* Tab 4: Wallets */}
            <button
              type="button"
              onClick={() => setActiveTab('wallet')}
              className={`flex-1 md:flex-none flex items-center justify-between p-2.5 sm:p-3 rounded-xl sm:rounded-2xl text-left transition-all cursor-pointer whitespace-nowrap md:whitespace-normal ${
                activeTab === 'wallet'
                  ? 'bg-[#002e6e] text-white shadow-md font-bold'
                  : 'bg-white md:bg-transparent text-slate-700 hover:bg-slate-100/80 border md:border-transparent border-slate-200/80 font-medium'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                  activeTab === 'wallet' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                }`}>
                  <Wallet size={16} />
                </div>
                <div>
                  <span className="text-xs font-bold block">Wallets</span>
                  <span className={`text-[9px] block ${activeTab === 'wallet' ? 'text-blue-200' : 'text-slate-400'}`}>Amazon Pay, Paytm</span>
                </div>
              </div>
              <ChevronRight size={14} className={`hidden md:block ${activeTab === 'wallet' ? 'text-white' : 'text-slate-300'}`} />
            </button>
          </div>

          {/* RIGHT CONTENT AREA: DETAILS PER PAYMENT METHOD */}
          <div className="flex-1 p-4 sm:p-6 space-y-4">
            
            {/* 1. UPI TAB CONTENT */}
            {activeTab === 'upi' && (
              <div className="space-y-4 text-left">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Choose your UPI App</h4>
                    <p className="text-xs text-slate-500">Pay securely without sharing bank account details</p>
                  </div>
                  <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                    Instant Approval
                  </span>
                </div>

                {/* UPI Sub-Apps Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* PhonePe */}
                  <button
                    type="button"
                    onClick={() => setSelectedUpiApp('phonepe')}
                    className={`p-3.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                      selectedUpiApp === 'phonepe'
                        ? 'border-purple-600 bg-purple-50/50 shadow-md ring-2 ring-purple-600/15'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center text-lg font-bold shadow-md shadow-purple-600/20">
                      पे
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-bold text-slate-900 block">PhonePe</span>
                      <span className="text-[9px] text-purple-600 font-semibold">Recommended</span>
                    </div>
                  </button>

                  {/* Google Pay */}
                  <button
                    type="button"
                    onClick={() => setSelectedUpiApp('gpay')}
                    className={`p-3.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                      selectedUpiApp === 'gpay'
                        ? 'border-blue-600 bg-blue-50/50 shadow-md ring-2 ring-blue-600/15'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-lg font-black shadow-md shadow-blue-600/20">
                      G
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-bold text-slate-900 block">Google Pay</span>
                      <span className="text-[9px] text-blue-600 font-semibold">Instant UPI</span>
                    </div>
                  </button>

                  {/* Paytm */}
                  <button
                    type="button"
                    onClick={() => setSelectedUpiApp('paytm')}
                    className={`p-3.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                      selectedUpiApp === 'paytm'
                        ? 'border-sky-500 bg-sky-50/50 shadow-md ring-2 ring-sky-500/15'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-2xl bg-sky-500 text-white flex items-center justify-center text-xs font-black shadow-md shadow-sky-500/20 tracking-tighter">
                      Paytm
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-bold text-slate-900 block">Paytm UPI</span>
                      <span className="text-[9px] text-sky-600 font-semibold">Fast Checkout</span>
                    </div>
                  </button>

                  {/* BHIM */}
                  <button
                    type="button"
                    onClick={() => setSelectedUpiApp('bhim')}
                    className={`p-3.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                      selectedUpiApp === 'bhim'
                        ? 'border-amber-600 bg-amber-50/50 shadow-md ring-2 ring-amber-600/15'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-2xl bg-amber-600 text-white flex items-center justify-center text-xs font-black shadow-md shadow-amber-600/20">
                      BHIM
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-bold text-slate-900 block">BHIM UPI</span>
                      <span className="text-[9px] text-amber-600 font-semibold">Govt Verified</span>
                    </div>
                  </button>
                </div>

                {/* Additional UPI Modes: QR Code & Custom VPA */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {/* Scan QR Code Option */}
                  <button
                    type="button"
                    onClick={() => setSelectedUpiApp('qr')}
                    className={`p-3 rounded-2xl border-2 flex items-center gap-3 transition-all cursor-pointer text-left ${
                      selectedUpiApp === 'qr'
                        ? 'border-emerald-500 bg-emerald-50/40 shadow-sm ring-2 ring-emerald-500/10'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                      <QrCode size={20} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Scan Dynamic QR</span>
                      <span className="text-[10px] text-slate-500">Scan with any UPI scanner app</span>
                    </div>
                  </button>

                  {/* Enter UPI ID */}
                  <button
                    type="button"
                    onClick={() => setSelectedUpiApp('vpa')}
                    className={`p-3 rounded-2xl border-2 flex items-center gap-3 transition-all cursor-pointer text-left ${
                      selectedUpiApp === 'vpa'
                        ? 'border-[#002e6e] bg-blue-50/40 shadow-sm ring-2 ring-[#002e6e]/10'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-900 flex items-center justify-center shrink-0 font-bold text-xs">
                      @
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Enter Custom UPI ID</span>
                      <span className="text-[10px] text-slate-500">e.g., yourname@okhdfcbank</span>
                    </div>
                  </button>
                </div>

                {/* Conditional View: QR Code Display */}
                {selectedUpiApp === 'qr' && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-3">
                    <div className="inline-block p-3 bg-white rounded-2xl shadow-md border border-slate-200">
                      <div className="w-40 h-40 bg-slate-900 rounded-xl flex flex-col items-center justify-center p-2 text-white relative overflow-hidden">
                        {/* Dynamic Stylized QR Matrix Pattern */}
                        <div className="w-full h-full bg-white p-2 rounded-lg flex flex-col items-center justify-between text-slate-900">
                          <div className="flex justify-between w-full">
                            <div className="w-7 h-7 bg-slate-900 rounded-sm p-1"><div className="w-full h-full bg-white p-0.5"><div className="w-full h-full bg-slate-900"></div></div></div>
                            <div className="w-7 h-7 bg-slate-900 rounded-sm p-1"><div className="w-full h-full bg-white p-0.5"><div className="w-full h-full bg-slate-900"></div></div></div>
                          </div>
                          <div className="text-[10px] font-black text-blue-900 tracking-tighter uppercase font-mono">
                            ZOMINDIA-₹{amount}
                          </div>
                          <div className="flex justify-between w-full">
                            <div className="w-7 h-7 bg-slate-900 rounded-sm p-1"><div className="w-full h-full bg-white p-0.5"><div className="w-full h-full bg-slate-900"></div></div></div>
                            <div className="text-[8px] font-bold text-slate-400 uppercase">NPCI UPI</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-800">Scan using GPay, PhonePe, Paytm or BHIM</p>
                      <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1 font-mono">
                        <Clock size={12} className="text-amber-500" /> QR expires in {Math.floor(qrTimer / 60)}:{(qrTimer % 60).toString().padStart(2, '0')}
                      </p>
                    </div>
                  </div>
                )}

                {/* Conditional View: Custom UPI ID Input */}
                {selectedUpiApp === 'vpa' && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <label className="text-xs font-bold text-slate-700 block">Enter Your Virtual Payment Address (VPA / UPI ID)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. mobile@paytm or name@okaxis"
                        value={upiIdInput}
                        onChange={(e) => setUpiIdInput(e.target.value)}
                        className="flex-1 px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#002e6e] focus:border-[#002e6e] outline-none"
                      />
                    </div>
                    {upiIdError && <p className="text-[10px] text-rose-600 font-bold">{upiIdError}</p>}
                    <p className="text-[10px] text-slate-400">A payment collect request will be sent to your UPI app for authorization.</p>
                  </div>
                )}

                {/* Primary Button for UPI */}
                <button
                  type="button"
                  onClick={() => handleInitiatePayment(selectedUpiApp.toUpperCase(), 'upi')}
                  className="w-full py-4 bg-[#002e6e] hover:bg-blue-900 text-white font-black text-sm uppercase tracking-wider rounded-2xl shadow-xl shadow-blue-900/20 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                >
                  <Lock size={15} className="text-emerald-400" /> Pay ₹{amount} via {selectedUpiApp === 'vpa' ? 'UPI Collect' : selectedUpiApp.toUpperCase()} <ArrowRight size={16} />
                </button>
              </div>
            )}

            {/* 2. CARD TAB CONTENT */}
            {activeTab === 'card' && (
              <div className="space-y-4 text-left">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Enter Card Details</h4>
                    <p className="text-xs text-slate-500">Supports all major Credit and Debit cards</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-extrabold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">VISA</span>
                    <span className="text-[9px] font-extrabold bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-200">Mastercard</span>
                    <span className="text-[9px] font-extrabold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">RuPay</span>
                  </div>
                </div>

                {/* Card Inputs Form */}
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
                  {/* Card Number */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Card Number</label>
                    <div className="relative">
                      <input
                        type="text"
                        maxLength={19}
                        placeholder="•••• •••• •••• ••••"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                        className="w-full pl-3.5 pr-20 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold tracking-wider text-slate-900 focus:ring-2 focus:ring-[#002e6e] focus:border-[#002e6e] outline-none"
                      />
                      {getCardBrand(cardNumber) && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black bg-blue-100 text-blue-900 px-2 py-0.5 rounded">
                          {getCardBrand(cardNumber)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Cardholder Name */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Name on Card</label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-[#002e6e] focus:border-[#002e6e] outline-none"
                    />
                  </div>

                  {/* Expiry & CVV Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Valid Thru</label>
                      <input
                        type="text"
                        maxLength={5}
                        placeholder="MM/YY"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-center text-slate-900 focus:ring-2 focus:ring-[#002e6e] focus:border-[#002e6e] outline-none"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-600">CVV / CVC</label>
                        <span className="text-[9px] text-slate-400">3 or 4 digits</span>
                      </div>
                      <input
                        type="password"
                        maxLength={4}
                        placeholder="•••"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-center text-slate-900 focus:ring-2 focus:ring-[#002e6e] focus:border-[#002e6e] outline-none"
                      />
                    </div>
                  </div>

                  {cardError && (
                    <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
                      <AlertCircle size={12} /> {cardError}
                    </p>
                  )}

                  {/* Save Card Checkbox */}
                  <div className="pt-1">
                    <label className="flex items-center gap-2 text-xs text-slate-600 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={saveCard}
                        onChange={(e) => setSaveCard(e.target.checked)}
                        className="rounded text-[#002e6e] focus:ring-[#002e6e]"
                      />
                      <span>Save this card securely as per RBI Tokenization directives</span>
                    </label>
                  </div>
                </div>

                {/* Primary Button for Card */}
                <button
                  type="button"
                  onClick={() => handleInitiatePayment(getCardBrand(cardNumber) || 'Card', 'card')}
                  className="w-full py-4 bg-[#002e6e] hover:bg-blue-900 text-white font-black text-sm uppercase tracking-wider rounded-2xl shadow-xl shadow-blue-900/20 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                >
                  <Lock size={15} className="text-emerald-400" /> Pay ₹{amount} Securely <ArrowRight size={16} />
                </button>
              </div>
            )}

            {/* 3. NET BANKING TAB CONTENT */}
            {activeTab === 'netbanking' && (
              <div className="space-y-4 text-left">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Select Your Bank</h4>
                  <p className="text-xs text-slate-500">You will be redirected to your bank's secure net banking portal</p>
                </div>

                {/* Popular Banks Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {POPULAR_BANKS.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setSelectedBank(b.id);
                        setOtherBankSelected('');
                      }}
                      className={`p-3 rounded-xl border-2 flex items-center gap-2.5 transition-all cursor-pointer text-left ${
                        selectedBank === b.id && !otherBankSelected
                          ? 'border-[#002e6e] bg-blue-50/50 shadow-sm ring-2 ring-[#002e6e]/15'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <span className="text-xl shrink-0">{b.icon}</span>
                      <div className="overflow-hidden">
                        <span className="text-xs font-bold text-slate-900 block truncate">{b.name}</span>
                        <span className="text-[9px] text-slate-400 font-semibold">{b.code}</span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* All Other Banks Dropdown */}
                <div className="pt-2">
                  <label className="text-[11px] font-bold text-slate-600 block mb-1.5">Or choose from other Indian banks:</label>
                  <select
                    value={otherBankSelected}
                    onChange={(e) => {
                      setOtherBankSelected(e.target.value);
                      if (e.target.value) setSelectedBank(e.target.value);
                    }}
                    className="w-full px-3.5 py-3 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#002e6e] focus:border-[#002e6e] outline-none"
                  >
                    <option value="">-- Select from 40+ Other Banks --</option>
                    {ALL_OTHER_BANKS.map((ob) => (
                      <option key={ob} value={ob}>{ob}</option>
                    ))}
                  </select>
                </div>

                {/* Primary Button for Net Banking */}
                <button
                  type="button"
                  onClick={() => handleInitiatePayment(otherBankSelected || selectedBank.toUpperCase(), 'netbanking')}
                  className="w-full py-4 bg-[#002e6e] hover:bg-blue-900 text-white font-black text-sm uppercase tracking-wider rounded-2xl shadow-xl shadow-blue-900/20 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                >
                  <Lock size={15} className="text-emerald-400" /> Pay ₹{amount} via Net Banking <ArrowRight size={16} />
                </button>
              </div>
            )}

            {/* 4. WALLET TAB CONTENT */}
            {activeTab === 'wallet' && (
              <div className="space-y-4 text-left">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Select Wallet Provider</h4>
                  <p className="text-xs text-slate-500">Link your favorite digital wallet for 1-click checkout</p>
                </div>

                <div className="space-y-2.5">
                  {WALLET_PROVIDERS.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setSelectedWallet(w.id)}
                      className={`w-full p-3.5 rounded-2xl border-2 flex items-center justify-between transition-all cursor-pointer ${
                        selectedWallet === w.id
                          ? 'border-[#002e6e] bg-blue-50/50 shadow-sm ring-2 ring-[#002e6e]/15'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{w.icon}</span>
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">{w.name}</span>
                          <span className="text-[10px] text-emerald-600 font-semibold">{w.offer}</span>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedWallet === w.id ? 'border-[#002e6e] bg-[#002e6e]' : 'border-slate-300'
                      }`}>
                        {selectedWallet === w.id && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Primary Button for Wallet */}
                <button
                  type="button"
                  onClick={() => handleInitiatePayment(selectedWallet.toUpperCase(), 'wallet')}
                  className="w-full py-4 bg-[#002e6e] hover:bg-blue-900 text-white font-black text-sm uppercase tracking-wider rounded-2xl shadow-xl shadow-blue-900/20 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                >
                  <Lock size={15} className="text-emerald-400" /> Link &amp; Pay ₹{amount} <ArrowRight size={16} />
                </button>
              </div>
            )}

          </div>
        </div>

        {/* GATEWAY FOOTER BADGES */}
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <Shield size={12} className="text-emerald-600" />
            <span>100% RBI Compliant &amp; NPCI Certified</span>
          </div>
          <div className="flex items-center gap-3 font-semibold">
            <span>Powered by PhonePe Gateway</span>
          </div>
        </div>

        {/* PROCESSING & VERIFICATION OVERLAY (States: Connecting, Authorizing, Verified) */}
        <AnimatePresence>
          {processingPhase !== 'idle' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center text-white"
            >
              {/* State 1: Connecting */}
              {processingPhase === 'connecting' && (
                <div className="space-y-4 max-w-sm">
                  <div className="w-16 h-16 rounded-full border-4 border-blue-400 border-t-white animate-spin mx-auto shadow-lg" />
                  <h3 className="text-lg font-black text-white">Connecting to Bank Gateway...</h3>
                  <p className="text-xs text-slate-300 font-medium">Establishing secure 256-bit encrypted handshake with your banking server</p>
                </div>
              )}

              {/* State 2: Authorizing & Simulating OTP */}
              {processingPhase === 'authorizing' && (
                <div className="space-y-4 max-w-md w-full">
                  {!showOtpScreen ? (
                    <div className="space-y-4">
                      <div className="w-16 h-16 bg-blue-600/30 text-blue-400 rounded-full flex items-center justify-center mx-auto animate-pulse">
                        <Smartphone size={32} />
                      </div>
                      <h3 className="text-lg font-black text-white">Awaiting UPI Authorization</h3>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Please approve the collect request of <b className="text-emerald-400">₹{amount}</b> on your UPI App or notification shade.
                      </p>
                      <div className="p-3 bg-white/10 rounded-xl border border-white/10 text-xs text-slate-300 flex items-center justify-center gap-2">
                        <RefreshCw size={14} className="animate-spin text-blue-300" />
                        <span>Simulating authorization approval...</span>
                      </div>
                    </div>
                  ) : (
                    /* Interactive Simulated OTP Modal for Card / Net Banking */
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-white text-slate-900 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 text-left border border-slate-100"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <ShieldCheck size={20} className="text-emerald-600" />
                          <h4 className="text-sm font-extrabold text-slate-900">Bank 2-Factor Authentication</h4>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                          ₹{amount}
                        </span>
                      </div>

                      {/* Simulated SMS Notification Banner */}
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-center justify-between gap-2">
                        <div className="text-[10px] text-amber-900">
                          <span className="font-bold block">📨 Simulated Bank SMS:</span>
                          <span>OTP for ₹{amount} at Zomindia is <b className="font-mono text-xs">{simulatedOtp}</b></span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEnteredOtp(simulatedOtp)}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold shrink-0 cursor-pointer shadow-xs"
                        >
                          Auto-fill
                        </button>
                      </div>

                      <form onSubmit={handleOtpSubmit} className="space-y-3">
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">
                            Enter 6-digit OTP sent to registered mobile
                          </label>
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="6-digit OTP"
                            value={enteredOtp}
                            onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                            className="w-full px-3 py-2.5 border-2 border-blue-500 rounded-xl text-center text-lg font-mono font-black tracking-widest outline-none focus:ring-2 focus:ring-blue-600"
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                          <span>Resend OTP in 00:{otpTimer > 9 ? otpTimer : `0${otpTimer}`}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
                              setSimulatedOtp(newOtp);
                              setEnteredOtp(newOtp);
                            }}
                            className="text-[#002e6e] font-bold hover:underline cursor-pointer"
                          >
                            Resend OTP
                          </button>
                        </div>

                        <button
                          type="submit"
                          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 size={16} /> Verify &amp; Authorize Payment
                        </button>
                      </form>
                    </motion.div>
                  )}
                </div>
              )}

              {/* State 3: Payment Verified Successfully */}
              {processingPhase === 'verified' && (
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="space-y-4 max-w-sm"
                >
                  <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/30">
                    <Check size={44} className="stroke-[3]" />
                  </div>
                  <h3 className="text-2xl font-black text-white">Payment Verified!</h3>
                  <p className="text-xs text-emerald-300 font-bold">
                    Transaction ID: <span className="font-mono text-white">{generatedTxnId}</span>
                  </p>
                  <p className="text-xs text-slate-300">
                    Successfully debited ₹{amount}. Redirecting to your confirmed booking...
                  </p>
                </motion.div>
              )}

            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
