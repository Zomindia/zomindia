import { useState } from "react";
import { doc, updateDoc, Timestamp, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { User, ShieldCheck, CreditCard, Landmark, Users, CheckCircle2, AlertCircle } from "lucide-react";
import { motion } from "motion/react";

interface UnifiedKYCFormProps {
  partnerId: string;
  mode: "online" | "admin_manual";
  onSuccess: () => void;
  onClose?: () => void;
}

export default function UnifiedKYCForm({ partnerId, mode, onSuccess, onClose }: UnifiedKYCFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form states
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [aadhaarPhoto, setAadhaarPhoto] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [panPhoto, setPanPhoto] = useState("");

  // Bank
  const [bankHolder, setBankHolder] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");

  // Ref 1 (Zomindia Partner)
  const [ref1Name, setRef1Name] = useState("");
  const [ref1Mobile, setRef1Mobile] = useState("");
  const [ref1Address, setRef1Address] = useState("");
  const [ref1Aadhaar, setRef1Aadhaar] = useState("");

  // Ref 2 (Blood Relative)
  const [ref2Name, setRef2Name] = useState("");
  const [ref2Mobile, setRef2Mobile] = useState("");
  const [ref2Address, setRef2Address] = useState("");
  const [ref2Relation, setRef2Relation] = useState("");
  const [ref2Aadhaar, setRef2Aadhaar] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Basic Validation
    if (!aadhaarNumber || !aadhaarPhoto || !panNumber || !panPhoto) {
      setError("Please fill in both Aadhaar and PAN details with image URLs.");
      setLoading(false);
      return;
    }
    if (!bankHolder || !bankAccount || !bankIfsc) {
      setError("Please fill in your bank details.");
      setLoading(false);
      return;
    }
    if (!ref1Name || !ref1Mobile || !ref1Address || !ref1Aadhaar) {
      setError("Reference 1 (Zomindia Partner) is fully mandatory.");
      setLoading(false);
      return;
    }
    if (!ref2Name || !ref2Mobile || !ref2Address || !ref2Relation || !ref2Aadhaar) {
      setError("Reference 2 (Blood Relative) is fully mandatory.");
      setLoading(false);
      return;
    }

    try {
      const targetKycStatus = mode === "admin_manual" ? "verified" : "pending_review";
      const isEliteValue = mode === "admin_manual" ? true : false;

      const payload = {
        kycStatus: targetKycStatus,
        isElite: isEliteValue,
        aadhaarNumber,
        aadhaarPhoto,
        panNumber,
        panPhoto,
        ref1Name,
        ref1Mobile,
        ref1Address,
        ref1Aadhaar,
        ref2Name,
        ref2Mobile,
        ref2Address,
        ref2Relation,
        ref2Aadhaar,
        bankDetails: {
          accountHolder: bankHolder,
          accountNumber: bankAccount,
          ifscCode: bankIfsc,
        },
        partnerData: {
          kycStatus: targetKycStatus,
          isVerified: targetKycStatus === "verified",
          isElite: isEliteValue,
          bankDetails: {
            accountHolder: bankHolder,
            accountNumber: bankAccount,
            ifscCode: bankIfsc,
          }
        },
        updatedAt: Timestamp.now(),
      };

      // Update User Doc
      const userRef = doc(db, "users", partnerId);
      await updateDoc(userRef, payload);

      // Also try to update Partners Doc if exists
      try {
        const partnerRef = doc(db, "partners", partnerId);
        const partnerSnap = await getDoc(partnerRef);
        if (partnerSnap.exists()) {
          await updateDoc(partnerRef, {
            kycStatus: targetKycStatus,
            isVerified: targetKycStatus === "verified",
            isElite: isEliteValue,
            aadhaarNumber,
            aadhaarPhoto,
            panNumber,
            panPhoto,
            ref1Name,
            ref1Mobile,
            ref1Address,
            ref1Aadhaar,
            ref2Name,
            ref2Mobile,
            ref2Address,
            ref2Relation,
            ref2Aadhaar,
            bankDetails: {
              accountHolder: bankHolder,
              accountNumber: bankAccount,
              ifscCode: bankIfsc,
            },
            onboardingCompleted: true,
            updatedAt: Timestamp.now(),
          });
        }
      } catch (err) {
        console.warn("Failed to update partner collection document: ", err);
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      console.error("KYC save failed:", err);
      setError(err?.message || "Failed to submit KYC. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center space-y-4 min-h-[400px]">
        <CheckCircle2 size={56} className="text-emerald-500 animate-bounce" />
        <h3 className="text-xl font-black text-slate-900 tracking-tight">KYC Completed!</h3>
        <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
          {mode === "admin_manual" 
            ? "Partner account verified and upgraded to Elite status successfully!" 
            : "Your KYC details have been sent to Indore Admin for verification."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-left p-1">
      {error && (
        <div className="p-3 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl flex items-start gap-2 text-xs">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Mode Header */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
        <div>
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">KYC Verification Form</span>
          <h4 className="text-sm font-bold text-slate-900 capitalize">{mode.replace("_", " ")} Mode</h4>
        </div>
        <ShieldCheck className="text-blue-600 w-8 h-8" />
      </div>

      {/* Identity Proofs */}
      <div className="space-y-4">
        <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
          <CreditCard size={12} /> Identity Documents
        </h5>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Aadhaar Card Number</label>
            <input 
              type="text" 
              maxLength={12}
              required
              placeholder="e.g. 543210987654"
              value={aadhaarNumber} 
              onChange={e => setAadhaarNumber(e.target.value.replace(/\D/g, "").slice(0, 12))}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Aadhaar Card Photo URL</label>
            <input 
              type="text" 
              required
              placeholder="Paste photo URL / data URI"
              value={aadhaarPhoto} 
              onChange={e => setAadhaarPhoto(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">PAN Card Number</label>
            <input 
              type="text" 
              maxLength={10}
              required
              placeholder="e.g. ABCDE1234F"
              value={panNumber} 
              onChange={e => setPanNumber(e.target.value.toUpperCase().slice(0, 10))}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">PAN Card Photo URL</label>
            <input 
              type="text" 
              required
              placeholder="Paste photo URL / data URI"
              value={panPhoto} 
              onChange={e => setPanPhoto(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Bank details */}
      <div className="space-y-4 pt-2 border-t border-slate-100">
        <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
          <Landmark size={12} /> Bank Settlement Details
        </h5>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">A/C Holder Name</label>
            <input 
              type="text" 
              required
              placeholder="Account holder's name"
              value={bankHolder} 
              onChange={e => setBankHolder(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Account Number</label>
            <input 
              type="text" 
              required
              placeholder="Bank account number"
              value={bankAccount} 
              onChange={e => setBankAccount(e.target.value.replace(/\D/g, ""))}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">IFSC Code</label>
            <input 
              type="text" 
              maxLength={11}
              required
              placeholder="11 digit IFSC code"
              value={bankIfsc} 
              onChange={e => setBankIfsc(e.target.value.toUpperCase().slice(0, 11))}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Reference 1: Zomindia Partner */}
      <div className="space-y-4 pt-2 border-t border-slate-100">
        <h5 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1">
          <Users size={12} /> Reference 1: Zomindia Active Partner (Mandatory)
        </h5>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Partner Full Name</label>
            <input 
              type="text" 
              required
              placeholder="Reference partner's name"
              value={ref1Name} 
              onChange={e => setRef1Name(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Partner Mobile Number</label>
            <input 
              type="text" 
              required
              placeholder="10-digit mobile number"
              value={ref1Mobile} 
              onChange={e => setRef1Mobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Partner Indore Address</label>
            <input 
              type="text" 
              required
              placeholder="Partner's complete local address"
              value={ref1Address} 
              onChange={e => setRef1Address(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Partner Aadhaar Card Number</label>
            <input 
              type="text" 
              required
              maxLength={12}
              placeholder="Reference's 12-digit Aadhaar"
              value={ref1Aadhaar} 
              onChange={e => setRef1Aadhaar(e.target.value.replace(/\D/g, "").slice(0, 12))}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Reference 2: Blood Relative */}
      <div className="space-y-4 pt-2 border-t border-slate-100">
        <h5 className="text-[10px] font-black uppercase tracking-widest text-rose-600 flex items-center gap-1">
          <Users size={12} /> Reference 2: Blood Relative (Mandatory)
        </h5>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Relative Name</label>
            <input 
              type="text" 
              required
              placeholder="Relative's name"
              value={ref2Name} 
              onChange={e => setRef2Name(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Relationship</label>
            <input 
              type="text" 
              required
              placeholder="e.g. Father, Brother, Mother"
              value={ref2Relation} 
              onChange={e => setRef2Relation(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Relative Mobile Number</label>
            <input 
              type="text" 
              required
              placeholder="Relative's mobile"
              value={ref2Mobile} 
              onChange={e => setRef2Mobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Relative's Address</label>
            <input 
              type="text" 
              required
              placeholder="Relative's complete address"
              value={ref2Address} 
              onChange={e => setRef2Address(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Relative's Aadhaar Number</label>
            <input 
              type="text" 
              required
              maxLength={12}
              placeholder="Relative's 12-digit Aadhaar"
              value={ref2Aadhaar} 
              onChange={e => setRef2Aadhaar(e.target.value.replace(/\D/g, "").slice(0, 12))}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
            />
          </div>
        </div>
      </div>

      <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-blue-700/10 active:scale-95 cursor-pointer disabled:opacity-55"
        >
          {loading ? "Saving Details..." : mode === "admin_manual" ? "Verify & Approve Instantly" : "Submit KYC Details"}
        </button>
      </div>
    </form>
  );
}
