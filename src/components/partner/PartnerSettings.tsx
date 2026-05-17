import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  ShieldCheck, 
  Clock, 
  MapPin, 
  LogOut, 
  ChevronRight, 
  Camera, 
  Check,
  X,
  FileText,
  AlertCircle,
  Briefcase,
  Zap,
  Globe,
  Bell
} from 'lucide-react';
import { PartnerProfile, UserProfile, Category, WorkingHours } from '../../types';
import { collection, getDocs, doc, updateDoc, Timestamp, setDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { signOut } from 'firebase/auth';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';

interface Props {
  partner: PartnerProfile | null;
  profile: UserProfile;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DEFAULT_HOURS = DAYS.map(day => ({ day, startTime: '09:00', endTime: '18:00', enabled: true }));

export default function PartnerSettings({ partner, profile }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isKYCModalOpen, setIsKYCModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

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
        photoURL: editForm.photoURL
      });
      await updateDoc(doc(db, 'partners', partner.id), {
        bio: editForm.bio,
        categories: editForm.selectedCategories,
        workingHours: editForm.workingHours,
        updatedAt: Timestamp.now()
      });
      setIsEditing(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'profile');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    signOut(auth);
    window.location.reload();
  };

  return (
    <div className="p-6 space-y-8 pb-32">
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
            <h2 className="text-2xl font-black italic text-slate-900 leading-tight">{profile.displayName}</h2>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Certified Professional</p>
         </div>
      </section>

      {/* KYC Status Banner */}
      <section className={`p-6 rounded-[32px] border ${partner?.isVerified ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
         <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
               <div className={`p-3 rounded-2xl ${partner?.isVerified ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-amber-500 text-white shadow-lg shadow-amber-200'}`}>
                   {partner?.isVerified ? <ShieldCheck size={20} /> : <AlertCircle size={20} />}
               </div>
               <div>
                  <h4 className="text-sm font-bold text-slate-900">{partner?.isVerified ? 'Partner Verified' : 'KYC Required'}</h4>
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">{partner?.isVerified ? 'Access to Elite Jobs' : 'Some features locked'}</p>
               </div>
            </div>
            {!partner?.isVerified && (
               <button 
                 onClick={() => setIsKYCModalOpen(true)}
                 className="px-4 py-2 bg-amber-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-xl shadow-amber-500/20"
               >
                 Verify
               </button>
            )}
         </div>
      </section>

      {/* Navigation Options */}
      <section className="space-y-3">
         <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2 mb-4">Account Control</h3>
         
         {[
           { icon: Briefcase, label: 'Service Skills', value: `${partner?.categories.length || 0} active`, onClick: () => setIsEditing(true) },
           { icon: Clock, label: 'Work Schedule', value: 'Customizable', onClick: () => setIsEditing(true) },
           { icon: Bell, label: 'Notifications', value: 'Enabled', onClick: () => {} },
           { icon: Globe, label: 'Service Areas', value: 'City Wide', onClick: () => {} },
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
           onClick={logout}
           className="w-full bg-rose-50 p-5 rounded-[28px] border border-rose-100 flex justify-between items-center active:scale-98 transition-transform group mt-10"
         >
            <div className="flex items-center gap-4 text-rose-600">
               <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
                  <LogOut size={18} />
               </div>
               <span className="font-bold text-sm italic">Disconnect Account</span>
            </div>
            <ChevronRight size={16} className="text-rose-300" />
         </button>
      </section>

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

      {/* KYC Modal placeholder logic would go here, omitting for brevity in favor of core app flow */}
    </div>
  );
}
