import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  Lock, 
  CreditCard, 
  Smartphone, 
  Banknote, 
  Wallet, 
  CheckCircle2, 
  Check, 
  ChevronRight, 
  QrCode, 
  Sparkles, 
  Shield, 
  Zap,
  Building2,
  Info
} from 'lucide-react';

export type PaymentCategoryType = 'upi' | 'card' | 'cash' | 'wallet';
export type UpiSubAppType = 'gpay' | 'phonepe' | 'paytm' | 'bhim' | 'custom_upi';

export interface PaymentSelection {
  category: PaymentCategoryType;
  upiApp?: UpiSubAppType;
  customUpiId?: string;
  cardNetwork?: 'visa' | 'mastercard' | 'rupay';
}

interface PaymentMethodSelectorProps {
  totalBill: number;
  walletBalance?: number;
  useWallet: boolean;
  onToggleWallet: (use: boolean) => void;
  selectedCategory: PaymentCategoryType;
  selectedUpiApp: UpiSubAppType;
  customUpiId: string;
  onSelectCategory: (category: PaymentCategoryType) => void;
  onSelectUpiApp: (app: UpiSubAppType) => void;
  onChangeCustomUpiId: (id: string) => void;
  cardNumber?: string;
  onChangeCardNumber?: (num: string) => void;
  cardExpiry?: string;
  onChangeCardExpiry?: (exp: string) => void;
  cardCvv?: string;
  onChangeCardCvv?: (cvv: string) => void;
  savingsAmount?: number;
}

export default function PaymentMethodSelector({
  totalBill,
  walletBalance = 0,
  useWallet,
  onToggleWallet,
  selectedCategory,
  selectedUpiApp,
  customUpiId,
  onSelectCategory,
  onSelectUpiApp,
  onChangeCustomUpiId,
  cardNumber = '',
  onChangeCardNumber,
  cardExpiry = '',
  onChangeCardExpiry,
  cardCvv = '',
  onChangeCardCvv,
  savingsAmount = 0
}: PaymentMethodSelectorProps) {
  const [activeAccordion, setActiveAccordion] = useState<PaymentCategoryType>(selectedCategory);

  const handleCategoryClick = (cat: PaymentCategoryType) => {
    onSelectCategory(cat);
    setActiveAccordion(cat);
  };

  const walletDeduction = useWallet ? Math.min(walletBalance, totalBill) : 0;
  const remainingPayable = Math.max(0, totalBill - walletDeduction);
  const isWalletFullyCovering = useWallet && walletBalance >= totalBill;

  return (
    <div className="space-y-4 text-left font-sans" id="payment-method-selector-root">
      
      {/* Header with Zomato/Blinkit Style Pill */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Payment Options</span>
          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-200/60 flex items-center gap-1">
            <Zap size={10} className="fill-emerald-600" /> Fast &amp; Secure
          </span>
        </div>
        {savingsAmount > 0 && (
          <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100 animate-pulse">
            🎉 ₹{savingsAmount} Savings Applied
          </span>
        )}
      </div>

      {/* 1. WALLET BALANCE CARD (If user has wallet credits) */}
      {walletBalance > 0 && (
        <motion.div 
          whileHover={{ scale: 1.005 }}
          whileTap={{ scale: 0.995 }}
          onClick={() => onToggleWallet(!useWallet)}
          className={`p-3.5 sm:p-4 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden ${
            useWallet 
              ? 'bg-gradient-to-r from-emerald-50/80 to-teal-50/60 border-emerald-500 shadow-sm ring-2 ring-emerald-500/10' 
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-colors ${
                useWallet ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'bg-slate-100 text-slate-600'
              }`}>
                <Wallet size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight">
                    Zomindia Wallet
                  </h4>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.2 rounded-md">
                    Available: ₹{walletBalance}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  {useWallet 
                    ? isWalletFullyCovering 
                      ? `Full ₹${totalBill} will be paid from wallet`
                      : `₹${walletDeduction} deducted from wallet • Remaining due: ₹${remainingPayable}`
                    : 'Tap checkbox to apply available credits'}
                </p>
              </div>
            </div>

            <div className="flex items-center">
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                useWallet ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' : 'border-slate-300 bg-white'
              }`}>
                {useWallet && <Check size={14} className="stroke-[3]" />}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Main Payment Options Container */}
      {!isWalletFullyCovering && (
        <div className="space-y-3">

          {/* 2. UPI CARD / ACCORDION (Instant & Recommended) */}
          <div 
            className={`rounded-2xl border-2 transition-all overflow-hidden ${
              selectedCategory === 'upi'
                ? 'border-[#002e6e] bg-white shadow-md ring-4 ring-[#002e6e]/5'
                : 'border-slate-200 bg-white hover:border-slate-300 shadow-xs'
            }`}
          >
            {/* UPI Header Card */}
            <div 
              onClick={() => handleCategoryClick('upi')}
              className="p-3.5 sm:p-4 flex items-center justify-between cursor-pointer group bg-gradient-to-r from-transparent via-transparent to-blue-50/20"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all ${
                  selectedCategory === 'upi' 
                    ? 'bg-[#002e6e] text-white shadow-md shadow-[#002e6e]/20' 
                    : 'bg-blue-50 text-blue-700'
                }`}>
                  <Smartphone size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
                      UPI (Google Pay, PhonePe, Paytm, BHIM)
                    </h4>
                    <span className="bg-emerald-500 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-xs">
                      Instant &amp; Recommended
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Pay directly from your bank account with zero extra fees
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-2">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  selectedCategory === 'upi' ? 'border-[#002e6e] bg-[#002e6e]' : 'border-slate-300 bg-white'
                }`}>
                  {selectedCategory === 'upi' && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </div>
            </div>

            {/* UPI Sub-Apps Selector Drawer */}
            <AnimatePresence>
              {selectedCategory === 'upi' && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="border-t border-slate-100 bg-slate-50/70 p-3 sm:p-4 space-y-2.5"
                >
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Select Your Preferred UPI App:
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {/* Google Pay */}
                    <button
                      type="button"
                      onClick={() => {
                        onSelectCategory('upi');
                        onSelectUpiApp('gpay');
                      }}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center cursor-pointer ${
                        selectedUpiApp === 'gpay'
                          ? 'bg-white border-[#002e6e] shadow-sm ring-2 ring-[#002e6e]/15 text-[#002e6e]'
                          : 'bg-white border-slate-200/80 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-sm font-black text-blue-600 shadow-inner">
                        G
                      </div>
                      <span className="text-xs font-extrabold leading-tight">Google Pay</span>
                      {selectedUpiApp === 'gpay' && (
                        <span className="text-[9px] font-bold text-emerald-600 flex items-center gap-0.5">
                          <Check size={10} className="stroke-[3]" /> Selected
                        </span>
                      )}
                    </button>

                    {/* PhonePe */}
                    <button
                      type="button"
                      onClick={() => {
                        onSelectCategory('upi');
                        onSelectUpiApp('phonepe');
                      }}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center cursor-pointer ${
                        selectedUpiApp === 'phonepe'
                          ? 'bg-white border-purple-600 shadow-sm ring-2 ring-purple-600/15 text-purple-700'
                          : 'bg-white border-slate-200/80 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-sm font-black text-purple-700 shadow-inner">
                        पे
                      </div>
                      <span className="text-xs font-extrabold leading-tight">PhonePe</span>
                      {selectedUpiApp === 'phonepe' && (
                        <span className="text-[9px] font-bold text-purple-600 flex items-center gap-0.5">
                          <Check size={10} className="stroke-[3]" /> Selected
                        </span>
                      )}
                    </button>

                    {/* Paytm */}
                    <button
                      type="button"
                      onClick={() => {
                        onSelectCategory('upi');
                        onSelectUpiApp('paytm');
                      }}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center cursor-pointer ${
                        selectedUpiApp === 'paytm'
                          ? 'bg-white border-sky-600 shadow-sm ring-2 ring-sky-600/15 text-sky-700'
                          : 'bg-white border-slate-200/80 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-sky-50 flex items-center justify-center text-xs font-black text-sky-600 shadow-inner tracking-tighter">
                        Paytm
                      </div>
                      <span className="text-xs font-extrabold leading-tight">Paytm UPI</span>
                      {selectedUpiApp === 'paytm' && (
                        <span className="text-[9px] font-bold text-sky-600 flex items-center gap-0.5">
                          <Check size={10} className="stroke-[3]" /> Selected
                        </span>
                      )}
                    </button>

                    {/* BHIM / Any UPI */}
                    <button
                      type="button"
                      onClick={() => {
                        onSelectCategory('upi');
                        onSelectUpiApp('bhim');
                      }}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center cursor-pointer ${
                        selectedUpiApp === 'bhim'
                          ? 'bg-white border-amber-600 shadow-sm ring-2 ring-amber-600/15 text-amber-700'
                          : 'bg-white border-slate-200/80 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-xs font-black text-amber-600 shadow-inner">
                        BHIM
                      </div>
                      <span className="text-xs font-extrabold leading-tight">BHIM UPI</span>
                      {selectedUpiApp === 'bhim' && (
                        <span className="text-[9px] font-bold text-amber-600 flex items-center gap-0.5">
                          <Check size={10} className="stroke-[3]" /> Selected
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Custom UPI ID Input Option */}
                  <div className="pt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectCategory('upi');
                        onSelectUpiApp('custom_upi');
                      }}
                      className={`w-full p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                        selectedUpiApp === 'custom_upi'
                          ? 'bg-white border-[#002e6e] text-[#002e6e] shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <QrCode size={14} className="text-slate-400" />
                        Enter Other UPI ID (e.g. mobile@upi, name@okhdfcbank)
                      </span>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        selectedUpiApp === 'custom_upi' ? 'border-[#002e6e] bg-[#002e6e] text-white' : 'border-slate-300'
                      }`}>
                        {selectedUpiApp === 'custom_upi' && <Check size={10} />}
                      </div>
                    </button>

                    {selectedUpiApp === 'custom_upi' && (
                      <motion.div 
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2"
                      >
                        <input 
                          type="text"
                          value={customUpiId}
                          onChange={(e) => {
                            onSelectCategory('upi');
                            onChangeCustomUpiId(e.target.value);
                          }}
                          placeholder="e.g., 9876543210@paytm or user@okaxis"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#002e6e] focus:border-transparent font-mono"
                        />
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 3. CARDS (Credit / Debit / ATM) */}
          <div 
            className={`rounded-2xl border-2 transition-all overflow-hidden ${
              selectedCategory === 'card'
                ? 'border-[#002e6e] bg-white shadow-md ring-4 ring-[#002e6e]/5'
                : 'border-slate-200 bg-white hover:border-slate-300 shadow-xs'
            }`}
          >
            {/* Cards Header Card */}
            <div 
              onClick={() => handleCategoryClick('card')}
              className="p-3.5 sm:p-4 flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all ${
                  selectedCategory === 'card' 
                    ? 'bg-[#002e6e] text-white shadow-md shadow-[#002e6e]/20' 
                    : 'bg-indigo-50 text-indigo-700'
                }`}>
                  <CreditCard size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
                      Credit / Debit Cards
                    </h4>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-extrabold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                        VISA
                      </span>
                      <span className="text-[9px] font-extrabold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                        Mastercard
                      </span>
                      <span className="text-[9px] font-extrabold bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200">
                        RuPay
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Save securely as per RBI guidelines with tokenized encryption
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-2">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  selectedCategory === 'card' ? 'border-[#002e6e] bg-[#002e6e]' : 'border-slate-300 bg-white'
                }`}>
                  {selectedCategory === 'card' && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </div>
            </div>

            {/* Cards Input Form */}
            <AnimatePresence>
              {selectedCategory === 'card' && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="border-t border-slate-100 bg-slate-50/70 p-3.5 sm:p-4 space-y-3"
                >
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Card Number
                    </label>
                    <div className="relative">
                      <input 
                        type="text"
                        maxLength={19}
                        value={cardNumber}
                        onChange={(e) => onChangeCardNumber && onChangeCardNumber(e.target.value)}
                        placeholder="•••• •••• •••• ••••"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#002e6e] focus:border-transparent placeholder:text-slate-300 tracking-wider"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                        <CreditCard size={16} className="text-slate-400" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Valid Thru (MM/YY)
                      </label>
                      <input 
                        type="text"
                        maxLength={5}
                        value={cardExpiry}
                        onChange={(e) => onChangeCardExpiry && onChangeCardExpiry(e.target.value)}
                        placeholder="MM/YY"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#002e6e] focus:border-transparent placeholder:text-slate-300 text-center tracking-wider"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        CVV / CVC
                      </label>
                      <input 
                        type="password"
                        maxLength={4}
                        value={cardCvv}
                        onChange={(e) => onChangeCardCvv && onChangeCardCvv(e.target.value)}
                        placeholder="•••"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#002e6e] focus:border-transparent placeholder:text-slate-300 text-center tracking-widest"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500">
                    <Lock size={12} className="text-emerald-600 shrink-0" />
                    <span>Card details will be processed securely via PhonePe / PCI-DSS Gateway</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 4. PAY ON ARRIVAL / CASH / AFTER SERVICE */}
          <div 
            className={`rounded-2xl border-2 transition-all overflow-hidden ${
              selectedCategory === 'cash'
                ? 'border-emerald-600 bg-white shadow-md ring-4 ring-emerald-500/10'
                : 'border-slate-200 bg-white hover:border-slate-300 shadow-xs'
            }`}
          >
            {/* Pay on Arrival Header */}
            <div 
              onClick={() => handleCategoryClick('cash')}
              className="p-3.5 sm:p-4 flex items-center justify-between cursor-pointer group bg-gradient-to-r from-transparent via-transparent to-emerald-50/20"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all ${
                  selectedCategory === 'cash' 
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' 
                    : 'bg-emerald-50 text-emerald-700'
                }`}>
                  <Banknote size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
                      Pay on Arrival (Cash or QR)
                    </h4>
                    <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-emerald-200">
                      Zero Advance Needed
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Pay after service completion via Cash or technician's UPI QR code
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-2">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  selectedCategory === 'cash' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 bg-white'
                }`}>
                  {selectedCategory === 'cash' && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </div>
            </div>

            {/* Cash Info Subtext */}
            <AnimatePresence>
              {selectedCategory === 'cash' && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-emerald-100 bg-emerald-50/40 p-3 sm:p-3.5 text-xs text-slate-700 flex items-center gap-2.5"
                >
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <p className="text-[11px] leading-relaxed text-emerald-950 font-medium">
                    Technician will verify the completed job with OTP before requesting settlement.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      )}

      {/* Security Trust Badge */}
      <div className="pt-2">
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 flex items-center justify-center gap-3 text-center">
          <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-[11px]">
            <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
            <span>100% Safe &amp; Secure Payments (256-bit SSL Encrypted)</span>
          </div>
        </div>
      </div>

    </div>
  );
}
