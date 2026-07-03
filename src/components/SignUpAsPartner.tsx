import { useState, useEffect } from 'react';
import { doc, setDoc, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Smartphone, 
  User, 
  Briefcase, 
  MapPin, 
  Check, 
  AlertCircle, 
  Sparkles, 
  ChevronRight, 
  CheckCircle2, 
  Mail,
  Lock,
  ArrowRight
} from 'lucide-react';
import { BrandedButtonSpinner } from './LoadingIndicator';

interface Props {
  profile: UserProfile;
  onSuccess: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const INDORE_POSH_SECTORS = [
  'Vijay Nagar, Indore',
  'Palasia, Indore',
  'Saket Colony, Indore',
  'Bhawarkuan, Indore',
  'Bengali Square, Indore',
  'Annapurna Road, Indore',
  'Rajendra Nagar, Indore',
  'LIG Colony, Indore',
  'Chapan Dukan Area, Indore'
];

const AVAILABLE_SERVICES = [
  'AC Repair',
  'Refrigerator Service',
  'RO Purifier',
  'Washing Machine Repair',
  'Home Cleaning Services',
  'Electrician Services',
  'Plumbing Services',
  'Geyser Repair & Installation'
];

export default function SignUpAsPartner({ profile, onSuccess, isOpen = true, onClose }: Props) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  
  // Form State
  const [phone, setPhone] = useState(profile?.phoneNumber || '');
  const [otpCode, setOtpCode] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [fullName, setFullName] = useState(profile?.fullName || profile?.displayName || '');
  const [email, setEmail] = useState('');
  const [selectedArea, setSelectedArea] = useState('Vijay Nagar, Indore');

  // Error & Status States
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [otpLoading, setOtpLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Clean up reCAPTCHA container on unmount
  useEffect(() => {
    return () => {
      const container = document.getElementById('recaptcha-partner-signup-inline');
      if (container) container.innerHTML = '';
    };
  }, []);

  // Secure Web-OTP API auto-detection hook for partner registration
  useEffect(() => {
    if (!otpSent || isOtpVerified) return;

    if (typeof window !== "undefined" && "OTPCredential" in window) {
      const ac = new AbortController();
      navigator.credentials
        .get({
          otp: { transport: ["sms"] },
          signal: ac.signal,
        } as any)
        .then((otpVal: any) => {
          if (otpVal && otpVal.code) {
            const codeDigits = otpVal.code.replace(/\D/g, "").slice(0, 6);
            if (codeDigits.length === 6) {
              console.log(
                "[WebOTP] Auto-detected OTP in SignUpAsPartner:",
                codeDigits
              );
              setOtpCode(codeDigits);

              // Allow user a fraction of a second to visually confirm, then auto-submit the OTP
              setTimeout(() => {
                handleVerifyOTP(codeDigits);
              }, 600);
            }
          }
        })
        .catch((err) => {
          if (
            err.name !== "AbortError" &&
            err.name !== "SecurityError" &&
            !err.message?.toLowerCase().includes("otp-credentials")
          ) {
            console.error(
              "[WebOTP API] SignUpAsPartner error auto-detecting OTP:",
              err
            );
          } else {
            console.log(
              "[WebOTP API] SignUpAsPartner auto-detection bypassed or aborted."
            );
          }
        });

      return () => {
        ac.abort();
      };
    }
  }, [otpSent, isOtpVerified]);

  // Duplicate Check Handler
  const checkDuplicateApplication = async (phoneStr: string): Promise<boolean> => {
    const cleanPhone = phoneStr.trim().replace(/\D/g, '');
    const last10 = cleanPhone.slice(-10);
    const searchFormats = [phoneStr.trim(), last10, `+91${last10}`];

    try {
      // 1. Check partner_applications collection
      for (const format of searchFormats) {
        const qApp = query(collection(db, 'partner_applications'), where('phone', '==', format));
        const snapApp = await getDocs(qApp);
        if (!snapApp.empty) {
          return true;
        }
      }

      // 2. Also check if already approved in partners collection
      for (const format of searchFormats) {
        const qP1 = query(collection(db, 'partners'), where('phoneNumber', '==', format));
        const snapP1 = await getDocs(qP1);
        if (!snapP1.empty) {
          return true;
        }
      }
    } catch (err) {
      console.error("Error verifying registration status:", err);
    }
    return false;
  };

  // OTP Dispatch
  const handleSendOTP = async () => {
    const phoneRegex = /^(?:\+91|91|0)?[6-9]\d{9}$/;
    const cleanPhone = phone.trim().replace(/\s+/g, '');
    
    if (!phone) {
      setErrors({ phone: 'Mobile number is required to proceed.' });
      return;
    }
    if (!phoneRegex.test(cleanPhone)) {
      setErrors({ phone: 'Please enter a valid 10-digit mobile number.' });
      return;
    }

    setOtpLoading(true);
    setErrors({});
    setDuplicateError(null);

    try {
      // Step 1 check: If already exists in partner_applications, hard block
      const hasDuplicate = await checkDuplicateApplication(phone);
      if (hasDuplicate) {
        setDuplicateError("You are already registered for partner and waiting for approval. Please contact customer care (9424456606, email: support@zomindia.com)");
        setOtpLoading(false);
        return;
      }

      const formattedPhone = `+91${cleanPhone.slice(-10)}`;
      
      // Setup dynamic invisible ReCAPTCHA anchor inside portal
      const container = document.getElementById('recaptcha-partner-signup-inline');
      if (container) container.innerHTML = ''; // reset

      const verifier = new RecaptchaVerifier(auth, 'recaptcha-partner-signup-inline', {
        size: 'invisible',
        callback: () => {}
      });
      await verifier.render();

      const result = await signInWithPhoneNumber(auth, formattedPhone, verifier);
      setConfirmationResult(result);
      setOtpSent(true);
    } catch (err: any) {
      console.error("OTP generation failure:", err);
      setErrors({ phone: err.message || "Failed to deliver OTP. Please verify cellular network." });
    } finally {
      setOtpLoading(false);
    }
  };

  // OTP Verification
  const handleVerifyOTP = async (directOtpCode?: string) => {
    const code = directOtpCode || otpCode;
    if (code.length !== 6) {
      setErrors({ otp: "Please enter the complete 6-digit OTP code." });
      return;
    }

    setOtpLoading(true);
    setErrors({});
    
    try {
      if (!confirmationResult) {
        throw new Error("Verification session expired. Please request a new OTP code.");
      }
      await confirmationResult.confirm(code);
      setIsOtpVerified(true);
      setOtpSent(false);
      // Automatically advance to Step 2 upon successful verification
      setCurrentStep(2);
    } catch (err: any) {
      console.error("OTP validation error:", err);
      setErrors({ otp: err.message || "Invalid or expired OTP code. Please retry." });
    } finally {
      setOtpLoading(false);
    }
  };

  const toggleCategory = (cat: string) => {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories(selectedCategories.filter(item => item !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const handleFinalSubmit = async () => {
    if (!fullName.trim()) {
      setErrors({ fullName: "Please enter your full name." });
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const uid = profile?.uid || auth.currentUser?.uid || `partner_app_${Date.now()}`;
      
      const appData = {
        id: uid,
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || "", // blank string strictly passed as empty string "" if left empty
        serviceType: selectedCategories.join(', '),
        skills: selectedCategories,
        area: selectedArea,
        status: "pending",
        role: "partner_applicant",
        createdAt: Timestamp.now()
      };

      await setDoc(doc(db, "partner_applications", uid), appData);

      // Inject the specific indexing flags: isPartner: true and ensure partnerData is fully initialized.
      // Do NOT overwrite or delete existing customerData by using merge: true.
      const partnerDataInit = {
        partnerId: uid,
        bio: `Elite Certified Professional specializing in ${selectedCategories.join(', ') || 'Home Services'} across ${selectedArea || 'Indore'}.`,
        status: "inactive",
        rating: 4.9,
        reviewCount: 0,
        isVerified: false,
        kycStatus: "pending",
        categories: selectedCategories,
        skills: selectedCategories,
        city: "Indore",
        availabilityStatus: "Offline",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        phone: phone.trim(),
        email: email.trim() || "",
        fullName: fullName.trim()
      };

      await setDoc(doc(db, "users", uid), {
        isPartner: true,
        partnerData: partnerDataInit,
        updatedAt: Timestamp.now()
      }, { merge: true });

      setSuccess(true);
    } catch (err: any) {
      console.error("Application upload failed:", err);
      let errMsg = "Failed to submit application. Please check your network.";
      if (err?.code === 'permission-denied' || err?.message?.includes('permission')) {
        errMsg = "Security validation blocked your request. Our systems require authentic details. Please try with correct info or contact support.";
      } else if (err?.message) {
        errMsg = err.message;
      }
      setErrors({ submit: errMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      onSuccess();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center min-h-screen p-4 sm:p-6 md:p-8 overflow-y-auto bg-transparent" id="partner-signup-portal-wrapper">
      {/* Dark blur backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
        id="partner-signup-backdrop"
      />

      {/* Modern High-Contrast Modal Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md sm:max-w-xl bg-[#F8FAFC] rounded-3xl overflow-hidden shadow-[0_25px_60px_rgba(15,23,42,0.25)] border border-slate-200 z-10 max-h-[90vh] flex flex-col text-[#334155] mx-4 sm:mx-0"
        id="partner-signup-container"
      >
        {/* Top Header */}
        <div className="p-6 bg-[#1B4D3E] border-b border-white/10 relative shrink-0 flex justify-between items-start">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#C5A021] font-mono block mb-1">
              Zomindia Internet Technology
            </span>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight font-sans text-white">
              Elite Service Partner Program
            </h3>
            <p className="text-slate-200 text-xs mt-1 leading-relaxed">
              Complete the verification process in 3 easy steps to start receiving direct client bookings.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-200 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all active:scale-95 cursor-pointer border border-white/10"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Dynamic Multi-Step Timeline Indicator */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 text-[10px] font-extrabold uppercase tracking-widest shrink-0 font-mono">
          <div className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] transition-all duration-300 ${
              currentStep === 1 
                ? 'bg-[#1B4D3E] text-white font-black border-2 border-[#C5A021] shadow-sm' 
                : isOtpVerified 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300' 
                  : 'bg-slate-200 text-slate-500'
            }`}>
              {isOtpVerified ? <Check size={10} className="stroke-[3]" /> : "1"}
            </span>
            <span className={currentStep === 1 ? "text-[#1B4D3E] font-black border-b border-[#C5A021]" : "text-slate-400 font-bold"}>Mobile Verification</span>
          </div>
          <div className="h-px bg-slate-200 flex-1 mx-2" />
          <div className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] transition-all duration-300 ${
              currentStep === 2 
                ? 'bg-[#1B4D3E] text-white font-black border-2 border-[#C5A021] shadow-sm' 
                : selectedCategories.length > 0 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300' 
                  : 'bg-slate-200 text-slate-500'
            }`}>
              {selectedCategories.length > 0 ? <Check size={10} className="stroke-[3]" /> : "2"}
            </span>
            <span className={currentStep === 2 ? "text-[#1B4D3E] font-black border-b border-[#C5A021]" : "text-slate-400 font-bold"}>Choose Skills</span>
          </div>
          <div className="h-px bg-slate-200 flex-1 mx-2" />
          <div className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] transition-all duration-300 ${
              currentStep === 3 
                ? 'bg-[#1B4D3E] text-white font-black border-2 border-[#C5A021] shadow-sm' 
                : 'bg-slate-200 text-slate-500'
            }`}>
              3
            </span>
            <span className={currentStep === 3 ? "text-[#1B4D3E] font-black border-b border-[#C5A021]" : "text-slate-400 font-bold"}>Profile Details</span>
          </div>
        </div>

        {/* Scrollable Container Content */}
        <div className="p-6 overflow-y-auto flex-1 select-none bg-[#F8FAFC]">
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success-screen"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-12 text-center flex flex-col items-center justify-center"
              >
                <div className="w-16 h-16 bg-[#1B4D3E]/10 rounded-full flex items-center justify-center text-[#1B4D3E] border border-[#1B4D3E]/20 mb-6 shadow-lg shadow-[#1B4D3E]/10">
                  <CheckCircle2 size={36} className="stroke-[2.5]" />
                </div>
                <h4 className="text-2xl font-black tracking-tight text-slate-900 uppercase italic">
                  Application Logged!
                </h4>
                <p className="text-slate-600 text-sm max-w-sm mt-3 leading-relaxed font-medium">
                  Thank you, <span className="text-[#1B4D3E] font-bold">{fullName}</span>. Your Zomindia Partner application has been received and is currently in <span className="text-amber-600 font-bold">pending approval</span> status.
                </p>
                <div className="mt-6 p-4 bg-white border border-slate-200 rounded-2xl text-left max-w-sm">
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    Our HR verification team will audit your application profile within 24 hours. Once authorized, we will update your registered phone number via WhatsApp.
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="mt-8 px-8 py-3.5 bg-[#1B4D3E] hover:bg-[#143a2e] active:scale-95 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-[#1B4D3E]/20 text-white cursor-pointer border border-[#C5A021]/30"
                >
                  Return to Dashboard
                </button>
              </motion.div>
            ) : (
              <div className="space-y-6">
                {/* Step 1: Mobile Verification */}
                {currentStep === 1 && (
                  <motion.div
                    key="step-phone"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-6"
                  >
                    <div>
                      <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <Smartphone size={16} className="text-[#C5A021]" />
                        Step 1: Mobile Verification
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Verify your identity using instant, secure OTP verification before continuing.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {/* Phone Input */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                          Active Contact Number
                        </label>
                        <div className="flex flex-col sm:flex-row gap-4">
                          <div className="flex gap-3.5 flex-1 w-full">
                            {/* Separated Country Code Box */}
                            <div className="flex items-center justify-center px-5 py-3.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-black text-slate-700 font-mono shrink-0 select-none h-[56px]">
                              +91
                            </div>
                            {/* Full Width Phone Input */}
                            <input
                              type="tel"
                              disabled={isOtpVerified || otpSent || otpLoading}
                              value={phone}
                              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                              placeholder="Enter 10-digit number"
                              className="w-full px-5 py-3.5 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-[#1B4D3E] focus:bg-white focus:ring-1 focus:ring-[#1B4D3E] text-sm font-mono font-bold outline-none transition-all flex-1 h-[56px]"
                            />
                          </div>
                          {!otpSent && !isOtpVerified && (
                            <button
                              type="button"
                              onClick={handleSendOTP}
                              disabled={phone.length !== 10 || otpLoading}
                              className="w-full sm:w-auto px-9 py-3.5 bg-[#C5A021] hover:bg-[#b08e1b] disabled:opacity-40 disabled:hover:bg-[#C5A021] text-xs font-black uppercase tracking-widest rounded-xl transition-all text-white flex items-center justify-center gap-2 shrink-0 active:scale-95 cursor-pointer shadow-md hover:shadow-lg shadow-[#C5A021]/15 h-[56px] leading-none font-black"
                            >
                              {otpLoading ? <BrandedButtonSpinner className="w-3.5 h-3.5" /> : "Send OTP"}
                            </button>
                          )}
                        </div>
                        {errors.phone && (
                          <p className="text-xs font-semibold text-rose-600 mt-2 flex items-center gap-1.5">
                            <AlertCircle size={13} />
                            {errors.phone}
                          </p>
                        )}
                      </div>

                      {/* Recaptcha container target */}
                      <div id="recaptcha-partner-signup-inline" />

                      {/* Hard blocker duplicate flash message */}
                      {duplicateError && (
                        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl">
                          <p className="text-xs font-bold text-rose-700 leading-relaxed flex items-start gap-2.5">
                            <AlertCircle size={16} className="shrink-0 mt-0.5" />
                            <span>{duplicateError}</span>
                          </p>
                        </div>
                      )}

                      {/* OTP Verification Block */}
                      {otpSent && !isOtpVerified && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 bg-slate-100 border border-slate-200 rounded-2xl space-y-4"
                        >
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">
                              Enter 6-Digit OTP Verification Code
                            </label>
                            <div className="flex flex-col sm:flex-row gap-4">
                              <input
                                type="text"
                                maxLength={6}
                                value={otpCode}
                                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                placeholder="******"
                                className="w-full sm:flex-1 px-5 py-3.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-center font-mono text-lg font-black tracking-[0.4em] focus:border-[#1B4D3E] focus:bg-white focus:ring-1 focus:ring-[#1B4D3E] outline-none transition-all h-[56px]"
                              />
                              <button
                                type="button"
                                onClick={() => handleVerifyOTP()}
                                disabled={otpCode.length !== 6 || otpLoading}
                                className="w-full sm:w-auto px-9 py-3.5 bg-[#C5A021] hover:bg-[#b08e1b] disabled:opacity-40 text-xs font-black uppercase tracking-widest rounded-xl transition-all text-white active:scale-95 cursor-pointer flex items-center justify-center gap-2 shadow-md hover:shadow-lg shadow-[#C5A021]/15 h-[56px] leading-none font-black"
                              >
                                {otpLoading ? <BrandedButtonSpinner className="w-3.5 h-3.5" /> : "Verify Code"}
                              </button>
                            </div>
                            {errors.otp && (
                              <p className="text-xs font-semibold text-rose-600 mt-2 flex items-center gap-1.5">
                                <AlertCircle size={13} />
                                {errors.otp}
                              </p>
                            )}
                          </div>
                        </motion.div>
                      )}

                      {/* Verified Badge and advance button */}
                      {isOtpVerified && (
                        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-[#1B4D3E]">
                              <Check size={16} className="stroke-[3]" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-[#1B4D3E] uppercase tracking-widest leading-none">
                                Verified ✓
                              </p>
                              <p className="text-[10px] text-slate-500 mt-1 font-medium">
                                Mobile phone authorization completed successfully.
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => setCurrentStep(2)}
                            className="px-4 py-2.5 bg-[#1B4D3E] hover:bg-[#143a2e] text-[10px] font-black uppercase tracking-widest rounded-xl text-white transition-all active:scale-95 flex items-center gap-1 cursor-pointer border border-[#C5A021]/40"
                          >
                            Continue <ChevronRight size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Choose Skills */}
                {currentStep === 2 && (
                  <motion.div
                    key="step-skills"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-6"
                  >
                    <div>
                      <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <Briefcase size={16} className="text-[#C5A021]" />
                        Step 2: Choose Skills
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Select the service categories you specialize in. You can select multiple.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3" id="partner-skills-multi-select">
                      {AVAILABLE_SERVICES.map((servName) => {
                        const isSelected = selectedCategories.includes(servName);
                        return (
                          <button
                            key={servName}
                            type="button"
                            onClick={() => toggleCategory(servName)}
                            className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all duration-200 cursor-pointer text-xs font-bold border ${
                              isSelected
                                ? 'bg-gradient-to-r from-[#1B4D3E] to-[#12362b] text-white border-[#C5A021] shadow-lg shadow-[#1B4D3E]/15'
                                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                              isSelected ? 'bg-white/20 border-[#C5A021]' : 'bg-transparent border-slate-300'
                            }`}>
                              {isSelected && <Check size={10} className="text-[#C5A021] stroke-[3]" />}
                            </div>
                            <span className="truncate">{servName}</span>
                          </button>
                        );
                      })}
                    </div>

                    {selectedCategories.length === 0 && (
                      <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest flex items-center gap-1.5 justify-center mt-2">
                        ⚠️ Please choose at least one specialization to unlock step 3.
                      </p>
                    )}

                    <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => setCurrentStep(1)}
                        className="px-5 py-3 text-slate-400 hover:text-slate-600 text-xs font-bold uppercase tracking-widest"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        disabled={selectedCategories.length === 0}
                        onClick={() => setCurrentStep(3)}
                        className="px-6 py-3 bg-[#C5A021] hover:bg-[#b08e1b] disabled:opacity-40 text-xs font-black uppercase tracking-widest rounded-xl transition-all text-white flex items-center gap-2"
                      >
                        Continue <ChevronRight size={12} />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Profile Details */}
                {currentStep === 3 && (
                  <motion.div
                    key="step-profile"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-6"
                  >
                    <div>
                      <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <User size={16} className="text-[#C5A021]" />
                        Step 3: Profile Details
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Provide your business name and map your primary territory in Indore.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {/* Full Name */}
                      <div>
                        <label className="block text-[10px] font-bold text-[#334155] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                          <User size={12} />
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Enter your full name"
                          className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-[#1B4D3E] focus:bg-white focus:ring-1 focus:ring-[#1B4D3E] text-sm font-semibold outline-none transition-all"
                        />
                        {errors.fullName && (
                          <p className="text-xs font-semibold text-rose-600 mt-1.5 flex items-center gap-1.5">
                            <AlertCircle size={13} />
                            {errors.fullName}
                          </p>
                        )}
                      </div>

                      {/* Business Email */}
                      <div>
                        <label className="block text-[10px] font-bold text-[#334155] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                          <Mail size={12} />
                          Business Email (Optional)
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Leave blank if none"
                          className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-[#1B4D3E] focus:bg-white focus:ring-1 focus:ring-[#1B4D3E] text-sm font-semibold outline-none transition-all"
                        />
                        <p className="text-[10px] text-slate-400 mt-1 ml-1">
                          No auto-generation. Strictly passed as empty if left blank.
                        </p>
                      </div>

                      {/* City Area Posh Sectors Indore */}
                      <div>
                        <label className="block text-[10px] font-bold text-[#334155] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                          <MapPin size={12} />
                          Primary Indore Territory
                        </label>
                        <div className="relative">
                          <select
                            value={selectedArea}
                            onChange={(e) => setSelectedArea(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 focus:border-[#1B4D3E] focus:ring-1 focus:ring-[#1B4D3E] text-sm font-semibold outline-none cursor-pointer appearance-none animate-none"
                          >
                            {INDORE_POSH_SECTORS.map((sec) => (
                              <option key={sec} value={sec} className="bg-white text-slate-900">
                                {sec}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                            </svg>
                          </div>
                        </div>
                      </div>

                      {errors.submit && (
                        <p className="text-xs font-semibold text-rose-600 mt-2 flex items-center gap-1.5">
                          <AlertCircle size={13} />
                          {errors.submit}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-3 justify-between pt-4 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        className="px-5 py-3 text-slate-400 hover:text-slate-600 text-xs font-bold uppercase tracking-widest"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={handleFinalSubmit}
                        className="px-8 py-3.5 bg-gradient-to-r from-[#C5A021] to-[#b08e1b] hover:from-[#b08e1b] hover:to-[#9c7d14] text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-[#C5A021]/20 text-white active:scale-95 flex items-center gap-2 cursor-pointer font-sans"
                      >
                        {loading ? <BrandedButtonSpinner className="w-3.5 h-3.5" /> : "Submit Application"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
