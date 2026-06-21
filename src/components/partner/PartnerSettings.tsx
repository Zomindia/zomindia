import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  ShieldCheck, 
  Clock, 
  MapPin, 
  ChevronRight, 
  Camera, 
  Check,
  X,
  FileText,
  AlertCircle,
  Briefcase,
  Zap,
  Globe,
  Bell,
  Wallet,
  Bot,
  LogOut,
  ArrowLeft,
  HelpCircle
} from 'lucide-react';
import { PartnerProfile, UserProfile, Category, WorkingHours, Booking, Service } from '../../types';
import { collection, getDocs, doc, updateDoc, Timestamp, setDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';
import AdminUpload from '../AdminUpload';
import { sendNotification } from '../../lib/notifications';

interface Props {
  partner: PartnerProfile | null;
  profile: UserProfile;
  onNavigate: (tab: any) => void;
  bookings?: Booking[];
  services?: Service[];
  users?: UserProfile[];
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DEFAULT_HOURS = DAYS.map(day => ({ day, startTime: '09:00', endTime: '18:00', enabled: true }));

export default function PartnerSettings({ partner, profile, onNavigate, bookings = [], services = [], users = [] }: Props) {
  const [activeSub, setActiveSub] = useState<'kyc' | 'earnings' | 'skills' | 'faq' | null>(null);
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const handleSelectSub = (sub: 'kyc' | 'earnings' | 'skills' | 'faq' | null) => {
    setActiveSub(sub);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const [isEditing, setIsEditing] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isKYCModalOpen, setIsKYCModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // KYC custom fields state
  const [kycIdUrl, setKycIdUrl] = useState(partner?.kycDocuments?.[0]?.url || '');
  const [kycAddressUrl, setKycAddressUrl] = useState(partner?.kycDocuments?.[1]?.url || '');
  const [kycSubmitSuccess, setKycSubmitSuccess] = useState(false);
  const [kycLoading, setKycLoading] = useState(false);

  const [editForm, setEditForm] = useState({
    displayName: profile.displayName,
    photoURL: profile.photoURL || '',
    bio: partner?.bio || '',
    selectedCategories: partner?.categories || [],
    workingHours: partner?.workingHours || DEFAULT_HOURS
  });

  useEffect(() => {
    const fetchCategories = async () => {
      const snap = await getDocs(collection(db, 'categories'));
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
    };
    fetchCategories();
  }, []);

  const handleSave = async () => {
    if (!partner) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        displayName: editForm.displayName,
        fullName: editForm.displayName,
        photoURL: editForm.photoURL
      });
      await updateDoc(doc(db, 'partners', partner.id), {
        bio: editForm.bio,
        categories: editForm.selectedCategories,
        workingHours: editForm.workingHours,
        updatedAt: Timestamp.now()
      });
      setIsEditing(false);
      setActiveSub(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'profile');
    } finally {
      setLoading(false);
    }
  };

  const handleKYCSubmit = async () => {
    if (!partner) return;
    setKycLoading(true);
    try {
      await updateDoc(doc(db, 'partners', partner.id), {
        kycStatus: 'pending',
        kycDocuments: [
          { type: 'Identity Proof', url: kycIdUrl || 'https://images.unsplash.com/photo-1557683316-973673baf926', status: 'pending' },
          { type: 'Address Proof', url: kycAddressUrl || 'https://images.unsplash.com/photo-1557683316-973673baf926', status: 'pending' }
        ],
        updatedAt: Timestamp.now()
      });
      
      // Notify partner
      await sendNotification(
        profile.uid,
        'Identity Documents Uploaded!',
        'We have received your profile details. Checking usually takes 4 to 8 hours.',
        'promotional'
      );
      
      // Notify Admin
      await sendNotification(
        'sarthakwebtech@gmail.com',
        'New Partner KYC Submitted',
        `Partner ${profile.displayName} (${profile.email}) uploaded KYC documents. Approval needed.`,
        'promotional'
      );
      
      setKycSubmitSuccess(true);
      setTimeout(() => {
        setIsKYCModalOpen(false);
        setActiveSub(null);
        setKycSubmitSuccess(false);
      }, 2500);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `partners/${partner.id}`);
    } finally {
      setKycLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-8 pb-32">
      {activeSub !== null && (
        <button 
          onClick={() => handleSelectSub(null)}
          className="mb-6 inline-flex items-center gap-2 text-xs font-black uppercase text-blue-700 bg-blue-50/75 hover:bg-blue-100/75 px-4 py-2.5 rounded-xl transition-all active:scale-95 cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>← Back to Menu</span>
        </button>
      )}

      {activeSub === null && (
        <>
          {/* Profile Header */}
          <section className="flex items-center gap-6">
             <div className="relative group italic">
                <div className="w-20 h-20 rounded-3xl overflow-hidden bg-slate-100 border border-slate-200 shadow-inner">
                   <img src={profile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.displayName}`} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-700 border-4 border-slate-50 rounded-full flex items-center justify-center text-white">
                   <Check size={12} />
                </div>
             </div>
             <div>
                <h2 className="text-2xl font-black text-slate-900 leading-tight">{profile.displayName}</h2>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Verified Partner</p>
             </div>
          </section>

          {/* KYC Status Banner */}
          <section className={`p-6 rounded-[32px] border ${partner?.isVerified ? 'bg-emerald-50 border-emerald-200' : partner?.kycStatus === 'pending' ? 'bg-indigo-50/50 border-indigo-200' : partner?.kycStatus === 'rejected' ? 'bg-rose-50/50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                   <div className={`p-3 rounded-2xl ${partner?.isVerified ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : partner?.kycStatus === 'pending' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : partner?.kycStatus === 'rejected' ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' : 'bg-amber-500 text-white shadow-lg shadow-amber-200'}`}>
                       {partner?.isVerified ? <ShieldCheck size={20} /> : <AlertCircle size={20} />}
                   </div>
                   <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        {partner?.isVerified ? 'Verified Partner' : partner?.kycStatus === 'pending' ? 'Checking your details' : partner?.kycStatus === 'rejected' ? 'Identity Check Rejected' : 'Verification Required'}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">
                        {partner?.isVerified ? 'Active & ready for bookings' : partner?.kycStatus === 'pending' ? 'Waiting for admin approval' : partner?.kycStatus === 'rejected' ? 'Please upload correct documents' : 'Some features are locked'}
                      </p>
                   </div>
                </div>
                {!partner?.isVerified && (
                   <button 
                     onClick={() => handleSelectSub('kyc')}
                     className={`px-4 py-2 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-xl ${partner?.kycStatus === 'pending' ? 'bg-indigo-600 shadow-indigo-500/20' : partner?.kycStatus === 'rejected' ? 'bg-rose-600 shadow-rose-500/20' : 'bg-amber-500 shadow-amber-500/20'}`}
                   >
                     {partner?.kycStatus === 'pending' ? 'Review Docs' : 'Verify Now'}
                   </button>
                )}
             </div>
             {partner?.kycStatus === 'rejected' && partner?.kycRejectReason && (
                <div className="mt-4 p-4 bg-rose-50/50 rounded-2xl border border-rose-100/50 flex gap-3 text-rose-800 animate-fade-in">
                   <AlertCircle size={14} className="shrink-0 mt-0.5" />
                   <div className="text-left">
                      <p className="text-[9px] font-black uppercase tracking-wider mb-0.5">Disapproval Reason:</p>
                      <p className="text-[11px] font-bold leading-normal">{partner.kycRejectReason}</p>
                   </div>
                </div>
             )}
          </section>

          {/* Symmetrical Security Credentials Channels */}
          <section className="bg-white p-6 rounded-[32px] border border-slate-100/80 space-y-4">
             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Authentication Channels</h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Email Card */}
                <div className="bg-slate-50/60 border border-slate-100/60 p-4 rounded-2xl flex flex-col justify-between min-h-[82px]">
                   <div className="flex items-center justify-between">
                      <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Email Address</span>
                      {(() => {
                        const isMobileOTP = auth.currentUser?.providerData.some(p => p.providerId === 'phone') || (!!auth.currentUser?.phoneNumber && !auth.currentUser?.email);
                        const isGoogleOrEmail = auth.currentUser?.providerData.some(p => p.providerId === 'google.com' || p.providerId === 'password') || (!!auth.currentUser?.email && !auth.currentUser?.phoneNumber);
                        
                        if (isMobileOTP && !auth.currentUser?.emailVerified) {
                           return <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider flex items-center gap-1">Not Verified ⚠️</span>;
                        } else if (isGoogleOrEmail || auth.currentUser?.emailVerified) {
                           return <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider flex items-center gap-1"><ShieldCheck size={10} /> Verified ✓</span>;
                        } else {
                           return <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider">Not Verified ⚠️</span>;
                        }
                      })()}
                   </div>
                   <p className="text-xs font-semibold text-slate-700 mt-2 truncate">{profile?.email || 'N/A'}</p>
                </div>

                {/* Mobile Card */}
                <div className="bg-slate-50/60 border border-slate-100/60 p-4 rounded-2xl flex flex-col justify-between min-h-[82px]">
                   <div className="flex items-center justify-between">
                      <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Registered Mobile</span>
                      {(() => {
                        const isMobileOTP = auth.currentUser?.providerData.some(p => p.providerId === 'phone') || (!!auth.currentUser?.phoneNumber && !auth.currentUser?.email);
                        const hasVerifiedPhone = !!auth.currentUser?.phoneNumber || !!profile?.phoneNumberVerified;
                        
                        if (isMobileOTP || hasVerifiedPhone) {
                           return <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider flex items-center gap-1"><ShieldCheck size={10} /> Verified ✓</span>;
                        } else {
                           return <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider flex items-center gap-1">Not Verified ⚠️</span>;
                        }
                      })()}
                   </div>
                   <p className="text-xs font-semibold text-slate-700 mt-2">
                      {profile?.phoneNumber ? `+91 •••••• ${profile.phoneNumber.replace('+91', '').slice(-4)}` : 'N/A'}
                   </p>
                </div>
             </div>
          </section>

          {/* Navigation Options */}
          <section className="space-y-3">
             <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2 mb-4">Account Settings</h3>
             
             {[
               { icon: Wallet, label: 'Partner Wallet & Payouts', value: `₹${profile.walletBalance || 0}`, onClick: () => handleSelectSub('earnings') },
               { icon: Briefcase, label: 'Service Skills & Schedule', value: `${partner?.categories.length || 0} active`, onClick: () => handleSelectSub('skills') },
               { icon: HelpCircle, label: 'Help & FAQ Desk', value: 'Onboarding & Pay', onClick: () => handleSelectSub('faq') },
               { icon: Bot, label: '🤖 AI Support Assistant', value: 'Online Assistance', onClick: () => window.dispatchEvent(new CustomEvent('toggle-ai-chat', { detail: { open: true } })) },
             ].map((opt, idx) => (
               <button 
                 key={idx}
                 onClick={opt.onClick}
                 className="w-full bg-white p-5 rounded-[28px] border border-slate-50 flex justify-between items-center active:scale-98 transition-transform group"
               >
                  <div className="flex items-center gap-4">
                     <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center group-hover:bg-blue-700 group-hover:text-white transition-colors">
                        <opt.icon size={18} />
                     </div>
                     <span className="font-bold text-slate-900 text-sm italic">{opt.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                     <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{opt.value}</span>
                     <ChevronRight size={16} className="text-slate-300" />
                  </div>
               </button>
             ))}

             <button 
               onClick={() => signOut(auth)}
               className="w-full bg-rose-50/50 p-5 rounded-[28px] border border-rose-100 flex justify-between items-center active:scale-98 transition-all group mt-2"
             >
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 bg-rose-500 text-white rounded-xl flex items-center justify-center shadow-md shadow-rose-200 group-hover:scale-105 transition-transform">
                      <LogOut size={16} />
                   </div>
                   <span className="font-extrabold text-rose-600 text-sm italic">Log Out of App</span>
                </div>
                <div className="flex items-center gap-3">
                   <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest">End Session</span>
                   <ChevronRight size={16} className="text-rose-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
             </button>
          </section>
        </>
      )}

      {activeSub === 'kyc' && (
        <motion.div
          key="sub-kyc"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="bg-white rounded-[32px] border border-slate-100 p-6 space-y-6">
            <div className="border-b border-sidebar pb-4">
              <h3 className="text-xl font-black italic text-slate-900">KYC Verification</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Symmetrical Verification Status Bench</p>
            </div>

            {/* Verified Email & Phone Credentials */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 flex flex-col justify-between">
                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Email Channel</span>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs font-semibold text-slate-800 truncate max-w-[150px]">{profile?.email || 'N/A'}</span>
                  <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0"><ShieldCheck size={10} /> Verified ✓</span>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 flex flex-col justify-between">
                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Registered Mobile</span>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs font-semibold text-slate-800">{profile?.phoneNumber ? `+91 •••••• ${profile.phoneNumber.replace('+91', '').slice(-4)}` : 'N/A'}</span>
                  <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0"><ShieldCheck size={10} /> Verified ✓</span>
                </div>
              </div>
            </div>

            {/* Profile Photo Uploader */}
            <div className="p-5 bg-blue-50/40 rounded-2xl border border-blue-100 flex flex-col sm:flex-row items-center gap-5">
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-inner shrink-0 relative group">
                <img src={editForm.photoURL || profile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.displayName}`} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera size={14} />
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <h5 className="text-xs font-extrabold text-slate-950">Partner Identity Photo</h5>
                <p className="text-[10px] text-slate-400 font-medium">Add a clear profile photo (no sunglasses/caps) so customers can recognize you.</p>
                <AdminUpload 
                  label="Upload New Photo"
                  onUpload={(url) => setEditForm({ ...editForm, photoURL: url })}
                  value={editForm.photoURL}
                  type="image"
                  accept=".jpg,.jpeg,.png"
                />
              </div>
            </div>

            {/* Government IDs */}
            <div className={`p-6 rounded-[28px] border flex flex-col justify-between md:flex-row md:items-center gap-4 ${partner?.isVerified ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900' : 'bg-amber-50/50 border-amber-200 text-amber-900'}`}>
              <div>
                <h4 className="text-sm font-extrabold flex items-center gap-1.5 leading-none">
                  <ShieldCheck size={16} />
                  {partner?.isVerified ? 'Government Documents Verified ✓' : 'Add Identity Documents'}
                </h4>
                <p className="text-[10px] opacity-75 mt-1.5 font-semibold">We verify your Aadhaar/PAN Card to keep the platform 100% safe.</p>
              </div>
              {!partner?.isVerified && (
                <button
                  onClick={() => setIsKYCModalOpen(true)}
                  className="px-4 py-2.5 bg-blue-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-xl shrink-0"
                >
                  Configure Docs
                </button>
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full bg-[#050CA6] text-white py-4.5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl hover:bg-opacity-90 active:scale-95 transition-all text-center flex items-center justify-center gap-2"
            >
              {loading ? 'Updating Credentials...' : 'Save & Propagate Photo'}
            </button>
          </div>
        </motion.div>
      )}

      {activeSub === 'earnings' && (
        <motion.div
          key="sub-earnings"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="bg-white rounded-[32px] border border-slate-100 p-6 space-y-6">
            <div className="border-b border-sidebar pb-4">
              <h3 className="text-xl font-black italic text-slate-900">My Earnings</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Earnings, Pending Payments & Payout History</p>
            </div>

            {/* Quick Metrics display */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-5 bg-emerald-50 border border-emerald-150 rounded-[24px]">
                <p className="text-[9px] uppercase tracking-wider text-emerald-700 font-black">Total Earned</p>
                <p className="text-3xl font-black text-emerald-950 mt-2 font-display">₹{(() => {
                  const completed = bookings.filter(b => b.partnerId === profile.uid && ['completed', 'finalized'].includes(b.status));
                  return completed.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
                })().toLocaleString()}</p>
                <p className="text-[8px] mt-1 font-bold text-emerald-600 uppercase tracking-wider">Completed Duties</p>
              </div>

              <div className="p-5 bg-amber-50 border border-amber-150 rounded-[24px]">
                <p className="text-[9px] uppercase tracking-wider text-amber-700 font-black">Pending Payments</p>
                <p className="text-3xl font-black text-amber-950 mt-2 font-display">₹{(() => {
                  const pending = bookings.filter(b => b.partnerId === profile.uid && ['payment_pending', 'completed'].includes(b.status) && b.paymentStatus !== 'paid');
                  const val = pending.reduce((sum, b) => sum + (b.totalPrice || 0), 0) * 0.85; // Net partner payout after platform split
                  return Math.round(val);
                })().toLocaleString()}</p>
                <p className="text-[8px] mt-1 font-bold text-amber-600 uppercase tracking-wider">In Settlement Queue</p>
              </div>
            </div>

            {/* Service History Segment */}
            <div className="space-y-4">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Duty & Service History</h4>
              {(() => {
                const myHistory = bookings.filter(b => b.partnerId === profile.uid);
                if (myHistory.length === 0) {
                  return (
                    <div className="p-8 text-center text-xs text-slate-400 font-bold italic bg-slate-50 border border-slate-100 rounded-2xl">
                      No customer bookings found in the history ledger.
                    </div>
                  );
                }
                return (
                  <div className="space-y-3">
                    {myHistory.map(b => {
                      const svc = services.find(s => s.id === b.serviceId);
                      return (
                        <div key={b.id} className="p-4 bg-slate-50 border border-slate-100/80 rounded-2xl flex justify-between items-center hover:bg-slate-100/50 transition-colors">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 text-sm truncate italic">{svc?.name || 'Technical Service'}</p>
                            <p className="text-[9px] text-slate-400 mt-1 uppercase font-semibold">
                              Booking: #{b.id.slice(0, 8).toUpperCase()} · {b.scheduledAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                            </p>
                          </div>
                          <div className="text-right shrink-0 ml-4">
                            <p className="font-mono text-sm font-black text-slate-900">₹{b.totalPrice}</p>
                            <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md mt-1 inline-block ${
                              b.status === 'completed' || b.status === 'finalized' ? 'bg-emerald-50 text-emerald-700' :
                              b.status === 'cancelled' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                            }`}>{b.status}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </motion.div>
      )}

      {activeSub === 'faq' && (
        <motion.div
          key="sub-faq"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="bg-white rounded-[32px] border border-slate-100 p-6 space-y-6">
            <div className="border-b border-sidebar pb-4">
              <h3 className="text-xl font-black italic text-slate-900">Partner Help Desk</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Frequently Asked Questions & Support Rules</p>
            </div>

            <div className="space-y-3">
              {[
                { q: "How do I withdraw my earnings?", a: "Your earnings are transferred directly using the bank account or UPI information configured in your payouts channel. Payouts are parsed and processed daily at 8:00 PM IST." },
                { q: "What is the platform service fee?", a: "zomindia only charges a standard 15% booking brokerage fee to support platform hosting, map coordinates billing, cloud syncing, and emergency technician insurance." },
                { q: "How to handle a customer dispute?", a: "If there is a dispute or if customers request out-of-scope manual labor, do not proceed. Contact our live AI support or dial the administrator hotline immediately." },
                { q: "Why is my KYC document rejected?", a: "Documents are usually rejected for blurry photographs, mismatched Aadhaar/PAN names, or expired address proof certificates. Re-upload a clean scan under the KYC sub-page." }
              ].map((item, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-100/60 rounded-2xl p-4 text-left">
                  <header 
                    onClick={() => setOpenFaq(openFaq === item.q ? null : item.q)}
                    className="flex justify-between items-center cursor-pointer font-bold text-slate-900 text-sm italic"
                  >
                    <span>{item.q}</span>
                    <ChevronRight size={16} className={`text-slate-400 transform transition-transform ${openFaq === item.q ? 'rotate-90' : ''}`} />
                  </header>
                  {openFaq === item.q && (
                    <p className="text-xs text-slate-500 font-medium leading-relaxed mt-2 pt-2 border-t border-slate-200/40 animate-fade-in">{item.a}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {activeSub === 'skills' && (
        <motion.div
          key="sub-skills"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="bg-white rounded-[32px] border border-slate-100 p-6 space-y-6">
            <div className="border-b border-sidebar pb-4">
              <h3 className="text-xl font-black italic text-slate-900">Service Specializations</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Update your professional active categories</p>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-500 font-medium">Click the button below to update your operational calendar hours and active service skill categories.</p>
              <button
                onClick={() => setIsEditing(true)}
                className="w-full bg-[#050CA6] text-white py-4.5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:bg-opacity-95 shadow-lg active:scale-95 transition-all text-center flex items-center justify-center gap-2"
              >
                Launch Professional Config
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Full Screen Editing Layer */}
      <AnimatePresence>
         {isEditing && (
           <div className="fixed inset-0 z-[100] bg-white pt-safe overflow-y-auto no-scrollbar">
              <header className="sticky top-0 bg-white/80 backdrop-blur-md px-6 py-6 border-b border-slate-100 flex justify-between items-center z-10">
                 <div>
                    <h3 className="text-xl font-bold italic">Professional Config</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Update your work profile</p>
                 </div>
                 <button onClick={() => setIsEditing(false)} className="p-2 bg-slate-100 rounded-full"><X size={20} /></button>
              </header>

              <div className="p-8 space-y-10 pb-32">
                 {/* Basic Info */}
                 <div className="space-y-4">
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Identity Info</h4>
                    <div className="space-y-4">
                       <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 ml-1">Profile Name</label>
                          <input 
                            type="text" 
                            className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-sm"
                            value={editForm.displayName}
                            onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                          />
                       </div>
                    </div>
                 </div>

                 {/* Skills */}
                 <div className="space-y-4">
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Specializations</h4>
                    <div className="grid grid-cols-2 gap-3">
                       {categories.map(cat => (
                         <button 
                           key={cat.id}
                           onClick={() => {
                             const current = editForm.selectedCategories;
                             const next = current.includes(cat.id) ? current.filter(id => id !== cat.id) : [...current, cat.id];
                             setEditForm({ ...editForm, selectedCategories: next });
                           }}
                           className={`p-4 rounded-2xl border text-left transition-all ${
                             editForm.selectedCategories.includes(cat.id) 
                               ? 'bg-blue-700 border-blue-700 text-white shadow-lg' 
                               : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-200'
                           }`}
                         >
                            <p className="text-xs font-black uppercase tracking-tighter italic leading-tight">{cat.name}</p>
                            {editForm.selectedCategories.includes(cat.id) && <Check size={14} className="mt-2 text-emerald-400" />}
                         </button>
                       ))}
                    </div>
                 </div>

                 {/* Working Hours */}
                 <div className="space-y-4">
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Calendar Availabilty</h4>
                    <div className="space-y-3">
                        {editForm.workingHours.map((wh, idx) => (
                           <div key={wh.day} className="p-4 bg-slate-50 rounded-2xl flex flex-col gap-4">
                              <div className="flex justify-between items-center">
                                 <span className="text-xs font-bold text-slate-900">{wh.day}</span>
                                 <div 
                                   onClick={() => {
                                      const next = [...editForm.workingHours];
                                      next[idx].enabled = !next[idx].enabled;
                                      setEditForm({ ...editForm, workingHours: next });
                                   }}
                                   className={`w-12 h-6 rounded-full p-1 transition-all ${wh.enabled ? 'bg-blue-700' : 'bg-slate-200'}`}
                                 >
                                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${wh.enabled ? 'translate-x-6' : 'translate-x-0'}`} />
                                 </div>
                              </div>
                              {wh.enabled && (
                                <div className="flex gap-4 items-center">
                                   <input 
                                     type="time" 
                                     className="flex-1 bg-white border-none rounded-xl p-3 text-xs font-black"
                                     value={wh.startTime}
                                     onChange={(e) => {
                                        const next = [...editForm.workingHours];
                                        next[idx].startTime = e.target.value;
                                        setEditForm({ ...editForm, workingHours: next });
                                     }}
                                   />
                                   <Zap size={14} className="text-slate-200" />
                                   <input 
                                     type="time" 
                                     className="flex-1 bg-white border-none rounded-xl p-3 text-xs font-black"
                                     value={wh.endTime}
                                     onChange={(e) => {
                                        const next = [...editForm.workingHours];
                                        next[idx].endTime = e.target.value;
                                        setEditForm({ ...editForm, workingHours: next });
                                     }}
                                   />
                                </div>
                              )}
                           </div>
                        ))}
                    </div>
                 </div>
              </div>

              <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-slate-100 flex justify-center max-w-md mx-auto">
                 <button 
                   disabled={loading || editForm.selectedCategories.length === 0}
                   onClick={handleSave}
                   className="w-full bg-blue-700 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl active:scale-95 transition-all"
                 >
                    {loading ? 'Propagating Changes...' : 'Validate & Update'}
                 </button>
              </div>
           </div>
         )}
      </AnimatePresence>

      {/* KYC Submit and Verification Modal */}
      <AnimatePresence>
         {isKYCModalOpen && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[120] bg-slate-900/80 backdrop-blur-md flex flex-col justify-end sm:justify-center items-center p-4 overflow-y-auto"
            >
               <motion.div 
                 initial={{ y: '100%' }} 
                 animate={{ y: 0 }} 
                 exit={{ y: '100%' }}
                 className="bg-white w-full max-w-md rounded-t-[48px] sm:rounded-[48px] p-8 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
               >
                  <button 
                    onClick={() => setIsKYCModalOpen(false)} 
                    className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 rounded-full transition-all"
                  >
                     <X size={20} />
                  </button>

                  <div className="mb-6 shrink-0 mt-2">
                     <h3 className="text-2xl font-black italic text-slate-900 leading-none">Confirm Identity</h3>
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">
                       {partner?.kycStatus === 'pending' ? 'Documents Under Active Check' : 'Secure Identity Upload'}
                     </p>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-6 pr-1 no-scrollbar pb-6">
                     {kycSubmitSuccess ? (
                        <div className="p-10 text-center space-y-4">
                           <div className="w-16 h-16 bg-emerald-500 text-white rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20">
                              <ShieldCheck size={36} />
                           </div>
                           <h4 className="text-lg font-black italic">Uploaded Successfully!</h4>
                           <p className="text-xs text-slate-500 font-bold tracking-tight">Your documents have been submitted. Our team will review them soon.</p>
                        </div>
                     ) : (
                        <>
                           <div className="space-y-2 flex-1">
                              {partner?.kycStatus === 'pending' && (
                                 <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex gap-3 text-blue-800 shrink-0 mb-4 animate-fade-in">
                                    <Clock size={16} className="shrink-0 mt-0.5" />
                                    <span className="text-xs font-bold leading-normal">
                                      Your application is currently pending and visible to administrators. Uploading new documents will refresh your file queue.
                                    </span>
                                 </div>
                              )}
                              
                              <div className="space-y-4">
                                 <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Identity proof (PAN / Aadhaar / DL)</label>
                                    <AdminUpload 
                                      label="Drop or Select Identity Document"
                                      onUpload={(url) => setKycIdUrl(url)}
                                      value={kycIdUrl}
                                      type="file"
                                      accept=".jpg,.jpeg,.png,.pdf"
                                    />
                                    {kycIdUrl && (
                                       <div className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-xl max-w-max border border-emerald-100">
                                          <Check size={12} strokeWidth={3} />
                                          <span className="text-[9px] font-bold uppercase tracking-wider">Identity Document Loaded</span>
                                       </div>
                                    )}
                                 </div>

                                 <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Address Proof (Utility Bill / Land Agreement)</label>
                                    <AdminUpload 
                                      label="Drop or Select Address Document"
                                      onUpload={(url) => setKycAddressUrl(url)}
                                      value={kycAddressUrl}
                                      type="file"
                                      accept=".jpg,.jpeg,.png,.pdf"
                                    />
                                    {kycAddressUrl && (
                                       <div className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-xl max-w-max border border-emerald-100">
                                          <Check size={12} strokeWidth={3} />
                                          <span className="text-[9px] font-bold uppercase tracking-wider">Address Document Loaded</span>
                                       </div>
                                    )}
                                 </div>
                              </div>
                           </div>
                        </>
                     )}
                  </div>

                  {!kycSubmitSuccess && (
                     <div className="pt-4 border-t border-slate-100 shrink-0">
                        <button
                          disabled={kycLoading || !kycIdUrl || !kycAddressUrl}
                          onClick={handleKYCSubmit}
                          className="w-full bg-blue-700 disabled:opacity-50 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                        >
                           {kycLoading ? (
                             <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                           ) : (
                             'Submit for Approval'
                           )}
                        </button>
                     </div>
                  )}
               </motion.div>
            </motion.div>
         )}
      </AnimatePresence>
    </div>
  );
}
