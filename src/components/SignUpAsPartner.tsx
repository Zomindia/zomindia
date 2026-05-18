import { useState, useEffect } from 'react';
import { doc, updateDoc, setDoc, Timestamp, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, Category } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Briefcase, 
  CheckCircle2, 
  ShieldCheck, 
  HeartHandshake, 
  ChevronRight, 
  ChevronLeft,
  User,
  LayoutGrid,
  FileText,
  AlertCircle,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import AdminUpload from './AdminUpload';

interface Props {
  profile: UserProfile;
  onSuccess: () => void;
}

type Step = 1 | 2 | 3 | 4;

export default function SignUpAsPartner({ profile, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Form State
  const [formData, setFormData] = useState({
    bio: profile.bio || '',
    phoneNumber: profile.phoneNumber || '',
    selectedCategories: [] as string[],
    kycIdUrl: '',
    kycAddressUrl: ''
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'categories'), (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
    });
    return unsub;
  }, []);

  const validateStep = (step: Step): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.bio || formData.bio.length < 20) {
        newErrors.bio = 'Bio must be at least 20 characters long.';
      }
      const phoneRegex = /^(?:\+91|91|0)?[6-9]\d{9}$/;
      if (!formData.phoneNumber) {
        newErrors.phoneNumber = 'Phone number is required.';
      } else if (!phoneRegex.test(formData.phoneNumber.replace(/\s+/g, ''))) {
        newErrors.phoneNumber = 'Please enter a valid 10-digit phone number.';
      }
    }

    if (step === 2) {
      if (formData.selectedCategories.length === 0) {
        newErrors.selectedCategories = 'Please select at least one specialization.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignUp = async () => {
    if (!validateStep(3)) return;
    setLoading(true);
    try {
      // 1. Update user role and basic info
      await updateDoc(doc(db, 'users', profile.uid), {
        role: 'partner',
        bio: formData.bio,
        phoneNumber: formData.phoneNumber
      });

      // 2. Create partner document with pending status
      await setDoc(doc(db, 'partners', profile.uid), {
        userId: profile.uid,
        categories: formData.selectedCategories,
        bio: formData.bio,
        rating: 5.0,
        reviewCount: 0,
        isVerified: false,
        status: 'pending',
        kycStatus: 'pending',
        kycDocuments: [
          { type: 'Identity Proof', url: formData.kycIdUrl || 'https://images.unsplash.com/photo-1557683316-973673baf926', status: 'pending' },
          { type: 'Address Proof', url: formData.kycAddressUrl || 'https://images.unsplash.com/photo-1557683316-973673baf926', status: 'pending' }
        ],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      setCurrentStep(4);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`);
      console.error('Failed to register application.');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => (prev < 4 ? (prev + 1) as Step : prev));
    }
  };
  const prevStep = () => {
    setErrors({});
    setCurrentStep(prev => (prev > 1 ? (prev - 1) as Step : prev));
  };

  const toggleCategory = (catName: string) => {
    setFormData(prev => ({
      ...prev,
      selectedCategories: prev.selectedCategories.includes(catName)
        ? prev.selectedCategories.filter(c => c !== catName)
        : [...prev.selectedCategories, catName]
    }));
    if (errors.selectedCategories) setErrors(prev => ({ ...prev, selectedCategories: '' }));
  };

  if (currentStep === 4) {
    return (
      <div className="max-w-xl mx-auto py-32 px-6 text-center">
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-[32px] flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-emerald-100"
        >
          <CheckCircle2 size={48} />
        </motion.div>
        <h2 className="text-4xl font-black text-slate-900 mb-6 tracking-tighter italic uppercase">Application Logged.</h2>
        <p className="text-slate-500 mb-12 text-lg font-medium leading-relaxed">
          Your partner profile is now being reviewed by our verification team. 
          Expect a response within 24-48 hours. You can already access your dashboard in read-only mode.
        </p>
        <button 
          onClick={onSuccess}
          className="bg-blue-700 text-white px-12 py-5 rounded-[24px] font-black uppercase tracking-[0.2em] text-xs hover:bg-blue-800 transition-all shadow-2xl shadow-blue-700/20 active:scale-95"
        >
          Enter Control Center
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 py-20 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
          
          {/* Progress Sidebar */}
          <div className="lg:col-span-4 space-y-12">
            <div>
               <div className="bg-blue-700 text-white p-4 rounded-3xl w-fit mb-8 shadow-xl shadow-blue-700/10">
                  <Briefcase size={32} />
               </div>
               <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tighter leading-tight uppercase italic">
                 Scale with <span className="text-slate-300 not-italic">zomindia.</span>
               </h1>
               <p className="text-slate-500 font-medium leading-relaxed">
                  Join India's most synchronized service ecosystem. Start your professional application today.
               </p>
            </div>

            <div className="space-y-4">
               {[
                 { step: 1, label: 'Profile Registry', icon: User },
                 { step: 2, label: 'Specializations', icon: LayoutGrid },
                 { step: 3, label: 'Verification Docs', icon: FileText }
               ].map((item) => (
                 <div key={item.step} className="flex items-center gap-4 group">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                      currentStep === item.step ? 'bg-blue-700 text-white shadow-lg' : 
                      currentStep > item.step ? 'bg-emerald-500 text-white' : 'bg-white text-slate-300 border border-slate-100'
                    }`}>
                       {currentStep > item.step ? <ShieldCheck size={18} /> : <item.icon size={18} />}
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest transition-all ${currentStep === item.step ? 'text-slate-900' : 'text-slate-300'}`}>
                       {item.label}
                    </span>
                 </div>
               ))}
            </div>

            {/* Trust Footer */}
            <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
               <div className="flex items-center gap-3 text-amber-500 mb-4">
                  <ShieldCheck size={24} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">Verified Marketplace</span>
               </div>
               <p className="text-xs text-slate-400 font-medium leading-relaxed">
                  Every professional on zomindia is vetted for quality and trust. Your data is encrypted and handled with care.
               </p>
            </div>
          </div>

          {/* Form Area */}
          <div className="lg:col-span-8">
            <motion.div 
               key={currentStep}
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               className="bg-white rounded-[60px] p-10 md:p-16 border border-slate-100 shadow-sm min-h-[600px] flex flex-col justify-between"
            >
               <div>
                  <AnimatePresence mode="wait">
                    {currentStep === 1 && (
                      <motion.div key="step1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-12">
                        <div>
                           <h2 className="text-3xl font-black text-slate-900 mb-2 uppercase italic">Profile Registry.</h2>
                           <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em]">Basic business identification</p>
                        </div>
                        
                        <div className="space-y-8">
                            <div className="group">
                              <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest px-1">Professional Bio</label>
                              <textarea 
                                value={formData.bio}
                                onChange={(e) => {
                                  setFormData({...formData, bio: e.target.value});
                                  if (errors.bio) setErrors({...errors, bio: ''});
                                }}
                                placeholder="Describe your experience, team size, and service philosophy..."
                                className={`w-full bg-slate-50 border-2 rounded-[32px] p-8 text-sm font-medium focus:ring-4 focus:ring-blue-700/5 transition-all outline-none h-40 resize-none italic ${errors.bio ? 'border-rose-100 bg-rose-50/30' : 'border-transparent'}`}
                              />
                              {errors.bio && (
                                <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mt-2 ml-4 flex items-center gap-2">
                                  <AlertCircle size={12} /> {errors.bio}
                                </p>
                              )}
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div>
                                 <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest px-1">Active Contact (Phone)</label>
                                 <input 
                                   type="tel"
                                   value={formData.phoneNumber}
                                   onChange={(e) => {
                                     setFormData({...formData, phoneNumber: e.target.value});
                                     if (errors.phoneNumber) setErrors({...errors, phoneNumber: ''});
                                   }}
                                   placeholder="+91 XXXXX XXXXX"
                                   className={`w-full bg-slate-50 border-2 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-blue-700/5 transition-all outline-none ${errors.phoneNumber ? 'border-rose-100 bg-rose-50/30' : 'border-transparent'}`}
                                 />
                                 {errors.phoneNumber && (
                                   <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mt-2 ml-1 flex items-center gap-2">
                                     <AlertCircle size={12} /> {errors.phoneNumber}
                                   </p>
                                 )}
                              </div>
                              <div>
                                 <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest px-1">Business Email</label>
                                 <input 
                                   type="email"
                                   value={profile.email}
                                   disabled
                                   className="w-full bg-slate-100 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-400 cursor-not-allowed"
                                 />
                              </div>
                           </div>
                        </div>
                      </motion.div>
                    )}

                    {currentStep === 2 && (
                      <motion.div key="step2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-12">
                         <div>
                           <h2 className="text-3xl font-black text-slate-900 mb-2 uppercase italic">Specializations.</h2>
                           <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em]">Select your field of operation</p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                           {categories.map((cat) => (
                              <button
                                key={cat.id}
                                onClick={() => toggleCategory(cat.name)}
                                className={`p-6 rounded-[32px] border-2 transition-all flex flex-col items-center text-center gap-4 group ${
                                  formData.selectedCategories.includes(cat.name)
                                    ? 'border-blue-700 bg-slate-50'
                                    : 'border-slate-50 hover:border-slate-200'
                                }`}
                              >
                                 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                                   formData.selectedCategories.includes(cat.name) ? 'bg-blue-700 text-white' : 'bg-slate-50 text-slate-400'
                                 }`}>
                                    <Sparkles size={20} />
                                 </div>
                                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">{cat.name}</span>
                              </button>
                           ))}
                        </div>

                        {errors.selectedCategories && (
                          <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex gap-3">
                             <AlertCircle size={16} className="text-rose-500 shrink-0" />
                             <p className="text-[10px] font-bold text-rose-800 uppercase tracking-widest">{errors.selectedCategories}</p>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {currentStep === 3 && (
                      <motion.div key="step3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-12">
                         <div>
                           <h2 className="text-3xl font-black text-slate-900 mb-2 uppercase italic">Verification.</h2>
                           <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em]">High-integrity document repository</p>
                        </div>

                        <div className="space-y-8">
                           <div className="bg-slate-50 p-4 rounded-[40px] border border-slate-100/50">
                              <label className="block text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest ml-4">Identity Proof</label>
                              <AdminUpload 
                                label="Upload ID Proof (Aadhar/PAN/DL)"
                                onUpload={(url) => setFormData({...formData, kycIdUrl: url})}
                                value={formData.kycIdUrl}
                                type="file"
                                accept=".jpg,.jpeg,.png,.pdf"
                                placeholder="Select or drop file..."
                              />
                           </div>

                           <div className="bg-slate-50 p-4 rounded-[40px] border border-slate-100/50">
                              <label className="block text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest ml-4">Address Verification</label>
                              <AdminUpload 
                                label="Upload Address Proof (Utility Bill/Rental)"
                                onUpload={(url) => setFormData({...formData, kycAddressUrl: url})}
                                value={formData.kycAddressUrl}
                                type="file"
                                accept=".jpg,.jpeg,.png,.pdf"
                                placeholder="Select or drop file..."
                              />
                           </div>

                           <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100 flex items-center justify-between gap-4">
                              <div className="flex gap-4">
                                <ShieldCheck className="text-indigo-500 shrink-0" size={20} />
                                <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest italic leading-relaxed">
                                  You can skip this and upload documents later.
                                </p>
                              </div>
                              <button 
                                onClick={handleSignUp}
                                className="px-6 py-3 bg-white text-indigo-700 border border-indigo-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center gap-2 whitespace-nowrap"
                              >
                                Skip & Continue <ArrowRight size={14} />
                              </button>
                           </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
               </div>

               <div className="flex gap-4 pt-12 border-t border-slate-50 mt-12">
                  {currentStep > 1 && (
                    <button 
                      onClick={prevStep}
                      className="flex-1 py-5 text-slate-400 font-bold hover:bg-slate-50 rounded-[28px] transition-all uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
                    >
                      <ChevronLeft size={16} /> Previous
                    </button>
                  )}
                  <button 
                    onClick={currentStep === 3 ? handleSignUp : nextStep}
                    disabled={
                      loading ||
                      (currentStep === 1 && (!formData.bio || !formData.phoneNumber)) ||
                      (currentStep === 2 && formData.selectedCategories.length === 0)
                    }
                    className="flex-[2] bg-blue-700 text-white py-5 rounded-[28px] font-black uppercase tracking-[0.2em] text-[10px] hover:bg-blue-800 transition-all shadow-2xl shadow-blue-700/20 disabled:opacity-50 flex items-center justify-center gap-3 italic"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      currentStep === 3 ? 'Dispatch Application' : 'Continue'
                    )}
                    {currentStep < 3 && !loading && <ChevronRight size={16} />}
                  </button>
               </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
