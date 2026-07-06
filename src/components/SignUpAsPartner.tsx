import { useState } from "react";
import { doc, updateDoc, Timestamp, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { UserProfile } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, 
  Smartphone, 
  User, 
  Briefcase, 
  Check, 
  AlertCircle, 
  ArrowRight,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";
import { BrandedButtonSpinner } from "./LoadingIndicator";

interface Props {
  profile: UserProfile;
  onSuccess: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const AVAILABLE_SERVICES = [
  "AC Repair",
  "Refrigerator Service",
  "RO Purifier",
  "Washing Machine Repair",
  "Home Cleaning Services",
  "Electrician Services",
  "Plumbing Services",
  "Geyser Repair & Installation"
];

export default function SignUpAsPartner({ profile, onSuccess, isOpen = true, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState(profile?.fullName || profile?.displayName || "");
  const [phone, setPhone] = useState(profile?.phoneNumber || profile?.mobile || "");
  const [selectedCategory, setSelectedCategory] = useState(AVAILABLE_SERVICES[0]);
  
  // Simulated OTP states
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpError, setOtpError] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  const handleSendOTP = () => {
    if (!phone.trim() || phone.length < 10) {
      setErrors({ phone: "Please enter a valid 10-digit mobile number." });
      return;
    }
    setErrors({});
    setOtpSent(true);
    setOtpCode("123456"); // Pre-filled for simulated flow
  };

  const handleVerifyOTP = () => {
    if (otpCode === "123456") {
      setOtpVerified(true);
      setOtpError("");
    } else {
      setOtpError("Incorrect OTP. Please use '123456' for testing.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrors({ fullName: "Full Name is required." });
      return;
    }
    if (!phone.trim()) {
      setErrors({ phone: "Mobile Number is required." });
      return;
    }
    if (otpSent && !otpVerified) {
      setErrors({ otp: "Please verify your mobile number via OTP first." });
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const uid = profile?.uid || auth.currentUser?.uid;
      if (!uid) {
        throw new Error("No active user session found. Please log in.");
      }

      // Initialize partner fields in user profile
      const updateData = {
        isPartner: true,
        approvalStatus: "pending" as const,
        kycStatus: "pending" as const,
        fullName: fullName.trim(),
        displayName: fullName.trim(),
        phoneNumber: phone.trim(),
        mobile: phone.trim(),
        partnerData: {
          partnerId: uid,
          bio: `Elite Partner specializing in ${selectedCategory} in Indore.`,
          status: "pending",
          rating: 4.9,
          reviewCount: 0,
          isVerified: false,
          kycStatus: "pending",
          categories: [selectedCategory],
          skills: [selectedCategory],
          city: "Indore",
          availabilityStatus: "Offline",
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          phone: phone.trim(),
          fullName: fullName.trim(),
        },
        updatedAt: Timestamp.now(),
      };

      await updateDoc(doc(db, "users", uid), updateData);

      // Also ensure we initialize the partner collection record so they exist there too
      try {
        await setDoc(doc(db, "partners", uid), {
          id: uid,
          userId: uid,
          fullName: fullName.trim(),
          phone: phone.trim(),
          categories: [selectedCategory],
          skills: [selectedCategory],
          rating: 4.9,
          reviewCount: 0,
          isVerified: false,
          status: "pending",
          kycStatus: "pending",
          availabilityStatus: "Offline",
          city: "Indore",
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      } catch (err) {
        console.warn("Partners record set warning:", err);
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      console.error("Partner Registration Error:", err);
      setErrors({ submit: err?.message || "Registration failed. Please try again." });
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
    <div className="fixed inset-0 z-[10000] flex items-center justify-center min-h-screen p-4 overflow-y-auto bg-transparent">
      {/* Dark blur backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 z-10 flex flex-col text-slate-800"
      >
        <div className="p-6 bg-blue-900 border-b border-white/10 relative shrink-0 flex justify-between items-start text-white">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-200">Zomindia Indore</span>
            <h3 className="text-xl font-black tracking-tight mt-1">Partner Registration</h3>
            <p className="text-[11px] text-blue-100/80 mt-1 font-medium leading-relaxed">
              Register in seconds and unlock direct client jobs across Indore.
            </p>
          </div>
          <button 
            onClick={handleClose}
            className="p-1.5 hover:bg-white/10 rounded-xl transition-all text-white/80 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {success ? (
            <div className="py-8 text-center flex flex-col items-center justify-center space-y-4">
              <CheckCircle2 size={56} className="text-emerald-500 animate-bounce" />
              <h4 className="text-lg font-black text-slate-900 tracking-tight">Registration Submitted!</h4>
              <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                Your application has been logged on the Indore Admin Portal. Redirecting you to track status...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {errors.submit && (
                <div className="p-3 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl flex items-start gap-2 text-xs">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{errors.submit}</span>
                </div>
              )}

              {/* Name Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                  <User size={12} /> Full Name (As per Aadhaar)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
                {errors.fullName && <p className="text-[10px] text-rose-600 font-bold">{errors.fullName}</p>}
              </div>

              {/* Mobile Number & OTP */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                  <Smartphone size={12} /> Mobile Number (OTP Verification)
                </label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    required
                    placeholder="10-digit mobile number"
                    disabled={otpSent}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  {!otpSent && (
                    <button
                      type="button"
                      onClick={handleSendOTP}
                      className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
                    >
                      Send OTP
                    </button>
                  )}
                </div>
                {errors.phone && <p className="text-[10px] text-rose-600 font-bold">{errors.phone}</p>}

                {otpSent && !otpVerified && (
                  <div className="mt-3 p-3 bg-blue-50/50 border border-blue-100 rounded-xl space-y-2">
                    <p className="text-[10px] font-bold text-blue-800">
                      OTP Sent! Enter <span className="underline">123456</span> to verify.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="Enter 6-digit OTP"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                        className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-center tracking-widest focus:ring-2 focus:ring-blue-500/20 outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyOTP}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all shadow-sm active:scale-95 cursor-pointer"
                      >
                        Verify OTP
                      </button>
                    </div>
                    {otpError && <p className="text-[10px] text-rose-600 font-bold">{otpError}</p>}
                  </div>
                )}

                {otpVerified && (
                  <div className="mt-2 text-emerald-600 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider">
                    <ShieldCheck size={14} /> Mobile verified successfully
                  </div>
                )}
              </div>

              {/* Service Category */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                  <Briefcase size={12} /> Service Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                >
                  {AVAILABLE_SERVICES.map((service) => (
                    <option key={service} value={service}>
                      {service}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={loading || (otpSent && !otpVerified)}
                className="w-full py-3.5 mt-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-55 text-white text-xs font-black uppercase tracking-wider rounded-2xl transition-all shadow-md shadow-blue-700/10 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <BrandedButtonSpinner />
                ) : (
                  <>
                    <span>Submit & Track Application</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
