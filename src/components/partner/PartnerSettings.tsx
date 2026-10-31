import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  ShieldCheck, 
  Clock, 
  ChevronRight, 
  Camera, 
  Check,
  AlertCircle,
  Briefcase,
  Zap,
  Wallet,
  LogOut,
  ArrowLeft,
  HelpCircle,
  Star,
  User,
  CreditCard,
  Phone,
  MapPin,
  Building2,
  FileText,
  Headphones,
  CheckCircle2
} from 'lucide-react';
import { PartnerProfile, UserProfile, Category, Booking, Service, Review } from '../../types';
import { LogoIcon } from '../BrandLogo';
import { collection, getDocs, doc, updateDoc, Timestamp, setDoc, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db, auth, storage } from '../../lib/firebase';
import { signOutUser } from '../../services/authService';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';
import AdminUpload from '../AdminUpload';
import { sendNotification } from '../../lib/notifications';
import { normalizeCategories, DEFAULT_CATEGORIES, isPurgedCategoryOrService } from '../../utils/formatters';

export type PartnerSettingsSection = 'profile' | 'bank' | 'kyc' | 'earnings' | 'skills' | 'faq' | 'performance' | null;

interface Props {
  partner: PartnerProfile | null;
  profile: UserProfile;
  onNavigate: (tab: any, targetId?: string | null) => void;
  onLogout?: () => void;
  bookings?: Booking[];
  services?: Service[];
  users?: UserProfile[];
  initialSection?: PartnerSettingsSection;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DEFAULT_HOURS = DAYS.map(day => ({ day, startTime: '09:00', endTime: '18:00', enabled: true }));

export default function PartnerSettings({
  partner,
  profile,
  onNavigate,
  onLogout,
  bookings = [],
  services = [],
  initialSection = null
}: Props) {
  const [activeSub, setActiveSub] = useState<PartnerSettingsSection>(initialSection);
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  useEffect(() => {
    if (initialSection !== undefined) {
      setActiveSub(initialSection);
    }
  }, [initialSection]);

  const [partnerReviews, setPartnerReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);

  useEffect(() => {
    const partnerId = partner?.id || partner?.userId || profile.uid;
    if (!partnerId) return;

    let isMounted = true;
    let unsubPrimary: (() => void) | null = null;
    let unsubFallback: (() => void) | null = null;

    const q = query(
      collection(db, "reviews"),
      where("partnerId", "in", [partnerId, profile.uid, partner?.id || profile.uid].filter((v, i, a) => a.indexOf(v) === i && !!v))
    );

    unsubPrimary = onSnapshot(
      q,
      (snapshot) => {
        if (!isMounted) return;
        const fetched: Review[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Review[];
        fetched.sort((a, b) => {
          const timeA = a.createdAt?.toDate?.()?.getTime() || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const timeB = b.createdAt?.toDate?.()?.getTime() || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return timeB - timeA;
        });
        setPartnerReviews(fetched);
        setLoadingReviews(false);
      },
      (err) => {
        if (!isMounted) return;
        console.warn("Reviews snapshot listener in settings fallback:", err);
        const fallbackQ = query(collection(db, "reviews"), orderBy("createdAt", "desc"));
        unsubFallback = onSnapshot(
          fallbackQ,
          (snap) => {
            if (!isMounted) return;
            const pId = partner?.id || profile.uid;
            const matched = snap.docs
              .map((d) => ({ id: d.id, ...d.data() } as Review))
              .filter((r) => r.partnerId === pId || r.partnerId === profile.uid);
            setPartnerReviews(matched);
            setLoadingReviews(false);
          },
          () => {
            if (isMounted) setLoadingReviews(false);
          }
        );
      }
    );

    return () => {
      isMounted = false;
      if (typeof unsubPrimary === "function") unsubPrimary();
      if (typeof unsubFallback === "function") unsubFallback();
    };
  }, [partner?.id, partner?.userId, profile.uid]);

  const handleOpenSection = (section: PartnerSettingsSection) => {
    setActiveSub(section);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePartnerLogout = async () => {
    try {
      await signOutUser();
    } catch (err) {
      console.warn('Signout warning:', err);
    }
    if (onLogout) {
      onLogout();
    } else {
      window.location.href = '/partner';
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>(() => {
    const uid = auth.currentUser?.uid || profile.uid;
    return localStorage.getItem(`partner_avatar_${uid}`) || profile.photoURL || (partner as any)?.photoURL || '';
  });

  useEffect(() => {
    const uid = auth.currentUser?.uid || profile.uid;
    const localAvatar = localStorage.getItem(`partner_avatar_${uid}`);
    if (localAvatar) {
      setAvatarUrl(localAvatar);
    } else if (profile.photoURL) {
      setAvatarUrl(profile.photoURL);
    }
  }, [profile.photoURL, profile.uid]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Url = reader.result as string;
        const uid = auth.currentUser?.uid || profile.uid;
        const targetPartnerId = partner?.id || (profile as any)?.partnerId || uid;

        setAvatarUrl(base64Url);
        setEditForm(prev => ({ ...prev, photoURL: base64Url }));
        localStorage.setItem(`partner_avatar_${uid}`, base64Url);
        window.dispatchEvent(new CustomEvent('partner-avatar-updated', { detail: { photoURL: base64Url } }));

        setUploadingAvatar(true);
        try {
          const storageRef = ref(storage, `partners/${uid}/avatar.jpg`);
          const snapshot = await uploadBytes(storageRef, file);
          const downloadUrl = await getDownloadURL(snapshot.ref);

          setAvatarUrl(downloadUrl);
          setEditForm(prev => ({ ...prev, photoURL: downloadUrl }));
          localStorage.removeItem(`partner_avatar_${uid}`);

          await updateDoc(doc(db, 'users', uid), {
            photoURL: downloadUrl,
            "partnerData.photoURL": downloadUrl
          }).catch(() => {});

          if (targetPartnerId) {
            await setDoc(doc(db, 'partners', targetPartnerId), {
              photoURL: downloadUrl,
              updatedAt: Timestamp.now()
            }, { merge: true }).catch(() => {});
          }

          window.dispatchEvent(new CustomEvent('partner-avatar-updated', { detail: { photoURL: downloadUrl } }));
          window.dispatchEvent(new CustomEvent('show-partner-toast', { detail: { message: 'Profile photo updated!' } }));
        } catch (uploadErr) {
          console.warn("Firebase Storage fallback to local persistent avatar:", uploadErr);
          window.dispatchEvent(new CustomEvent('show-partner-toast', { detail: { message: 'Profile photo saved locally!' } }));
        } finally {
          setUploadingAvatar(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (readerErr) {
      console.error("FileReader failed:", readerErr);
    }
  };

  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(false);

  // Extract existing bank details from partner or user profile
  const existingBank = (partner as any)?.bankDetails || (profile as any)?.bankDetails || (profile as any)?.partnerData?.bankDetails || {};
  const existingUpi = existingBank.upiId || (partner as any)?.upiId || (profile as any)?.upiId || (profile as any)?.partnerData?.upiId || '';

  const [editForm, setEditForm] = useState({
    displayName: profile.displayName || (partner as any)?.name || '',
    phoneNumber: profile.phoneNumber || profile.mobile || (partner as any)?.phone || '',
    city: (partner as any)?.city || (profile as any)?.city || 'Indore',
    photoURL: profile.photoURL || (partner as any)?.photoURL || '',
    bio: partner?.bio || (profile as any)?.partnerData?.bio || '',
    selectedCategories: (partner?.categories || (profile as any)?.partnerData?.categories || []).filter(
      (c: string) => !isPurgedCategoryOrService(c)
    ),
    workingHours: partner?.workingHours || DEFAULT_HOURS
  });

  const [bankForm, setBankForm] = useState({
    upiId: existingUpi,
    accountHolder: existingBank.accountHolder || profile.displayName || '',
    accountNumber: existingBank.accountNumber || '',
    ifscCode: existingBank.ifscCode || '',
    bankName: existingBank.bankName || ''
  });

  // KYC state
  const [aadhaarNumber, setAadhaarNumber] = useState<string>(
    (partner as any)?.aadhaarNumber || (profile as any)?.aadhaarNumber || (profile as any)?.partnerData?.aadhaarNumber || ''
  );
  const [panNumber, setPanNumber] = useState<string>(
    (partner as any)?.panNumber || (profile as any)?.panNumber || (profile as any)?.partnerData?.panNumber || ''
  );
  const [kycIdUrl, setKycIdUrl] = useState<string>(
    partner?.kycDocuments?.[0]?.url || (profile as any)?.partnerData?.kycDocuments?.[0]?.url || ''
  );
  const [kycAddressUrl, setKycAddressUrl] = useState<string>(
    partner?.kycDocuments?.[1]?.url || (profile as any)?.partnerData?.kycDocuments?.[1]?.url || ''
  );
  const [kycLoading, setKycLoading] = useState(false);

  useEffect(() => {
    setEditForm(prev => ({
      ...prev,
      displayName: profile.displayName || (partner as any)?.name || prev.displayName,
      phoneNumber: profile.phoneNumber || profile.mobile || (partner as any)?.phone || prev.phoneNumber,
      city: (partner as any)?.city || (profile as any)?.city || prev.city || 'Indore',
      photoURL: profile.photoURL || (partner as any)?.photoURL || prev.photoURL,
      bio: partner?.bio || (profile as any)?.partnerData?.bio || prev.bio,
      selectedCategories: partner?.categories?.length
        ? partner.categories.filter((c: string) => !isPurgedCategoryOrService(c))
        : prev.selectedCategories.filter((c: string) => !isPurgedCategoryOrService(c)),
      workingHours: partner?.workingHours?.length ? partner.workingHours : prev.workingHours
    }));

    const latestBank = (partner as any)?.bankDetails || (profile as any)?.bankDetails || (profile as any)?.partnerData?.bankDetails || {};
    const latestUpi = latestBank.upiId || (partner as any)?.upiId || (profile as any)?.upiId || (profile as any)?.partnerData?.upiId || '';
    setBankForm(prev => ({
      upiId: latestUpi || prev.upiId,
      accountHolder: latestBank.accountHolder || prev.accountHolder || profile.displayName || '',
      accountNumber: latestBank.accountNumber || prev.accountNumber,
      ifscCode: latestBank.ifscCode || prev.ifscCode,
      bankName: latestBank.bankName || prev.bankName
    }));
  }, [partner, profile]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const snap = await getDocs(collection(db, 'categories'));
        const rawCategories = snap.docs.map(d => ({ id: d.id, ...d.data() } as Category));
        const normalized = normalizeCategories(rawCategories);
        if (normalized.length > 0) {
          setCategories(normalized);
        }
      } catch (err) {
        console.warn("Using default categories in PartnerSettings:", err);
      }
    };
    fetchCategories();
  }, []);

  const hasLinkedBankOrUpi = Boolean(
    bankForm.upiId?.trim() || (bankForm.accountNumber?.trim() && bankForm.ifscCode?.trim())
  );

  const isKycVerified = Boolean(
    partner?.isVerified ||
    partner?.kycStatus === 'verified' ||
    (partner as any)?.kycStatus === 'approved' ||
    (profile as any)?.kycStatus === 'verified' ||
    (profile as any)?.kycStatus === 'approved'
  );

  const handleSaveProfile = async () => {
    const activeUid = auth.currentUser?.uid || profile.uid;
    const targetPartnerId = partner?.id || (profile as any)?.partnerId || activeUid;
    if (!activeUid) return;

    setLoading(true);
    try {
      const cleanName = editForm.displayName.trim() || profile.displayName || 'Verified Partner';
      const cleanPhone = editForm.phoneNumber.trim();
      const cleanCity = editForm.city.trim() || 'Indore';
      const cleanBio = editForm.bio.trim();
      const cleanPhoto = editForm.photoURL && !editForm.photoURL.startsWith('data:image') ? editForm.photoURL : (profile.photoURL || '');

      // 1. Sync to users collection (read by Admin & Customer)
      await setDoc(doc(db, 'users', activeUid), {
        displayName: cleanName,
        fullName: cleanName,
        phoneNumber: cleanPhone,
        mobile: cleanPhone,
        city: cleanCity,
        ...(cleanPhoto ? { photoURL: cleanPhoto } : {}),
        partnerData: {
          ...((profile as any)?.partnerData || {}),
          name: cleanName,
          fullName: cleanName,
          phone: cleanPhone,
          phoneNumber: cleanPhone,
          city: cleanCity,
          bio: cleanBio,
          ...(cleanPhoto ? { photoURL: cleanPhoto } : {}),
          updatedAt: Timestamp.now()
        },
        updatedAt: Timestamp.now()
      }, { merge: true });

      // 2. Sync to partners collection (read by Admin & Live Dispatch)
      if (targetPartnerId) {
        await setDoc(doc(db, 'partners', targetPartnerId), {
          userId: activeUid,
          uid: activeUid,
          name: cleanName,
          fullName: cleanName,
          displayName: cleanName,
          phone: cleanPhone,
          phoneNumber: cleanPhone,
          city: cleanCity,
          bio: cleanBio,
          ...(cleanPhoto ? { photoURL: cleanPhoto } : {}),
          updatedAt: Timestamp.now()
        }, { merge: true });
      }

      // 3. Sync active customer bookings so Customer Booking Card & Live Tracking reflect updated partner details immediately
      const activeBookings = bookings.filter(b =>
        (b.partnerId === activeUid || b.partnerId === targetPartnerId) &&
        ['assigned', 'confirmed', 'on_the_way', 'arrived', 'in_progress'].includes(b.status)
      );
      for (const b of activeBookings) {
        await updateDoc(doc(db, 'bookings', b.id), {
          partnerName: cleanName,
          ...(cleanPhone ? { partnerPhone: cleanPhone } : {}),
          ...(cleanPhoto ? { partnerPhoto: cleanPhoto } : {}),
          updatedAt: Timestamp.now()
        }).catch(() => {});
      }

      window.dispatchEvent(new CustomEvent('show-partner-toast', {
        detail: { message: 'Personal details saved & synced!' }
      }));
      setActiveSub(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'users');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBankDetails = async () => {
    const activeUid = auth.currentUser?.uid || profile.uid;
    const targetPartnerId = partner?.id || (profile as any)?.partnerId || activeUid;
    if (!activeUid) return;

    const cleanUpi = bankForm.upiId.trim();
    const cleanAcc = bankForm.accountNumber.trim();
    const cleanIfsc = bankForm.ifscCode.trim().toUpperCase();
    const cleanHolder = bankForm.accountHolder.trim() || editForm.displayName || profile.displayName;
    const cleanBankName = bankForm.bankName.trim();

    if (!cleanUpi && (!cleanAcc || !cleanIfsc)) {
      window.dispatchEvent(new CustomEvent('show-partner-toast', {
        detail: { message: 'Please enter a valid UPI ID or Bank Account + IFSC.' }
      }));
      return;
    }

    setLoading(true);
    try {
      const bankPayload = {
        upiId: cleanUpi,
        accountHolder: cleanHolder,
        accountNumber: cleanAcc,
        ifscCode: cleanIfsc,
        bankName: cleanBankName,
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', activeUid), {
        upiId: cleanUpi,
        bankDetails: bankPayload,
        "partnerData.upiId": cleanUpi,
        "partnerData.bankDetails": bankPayload,
        updatedAt: Timestamp.now()
      }, { merge: true });

      if (targetPartnerId) {
        await setDoc(doc(db, 'partners', targetPartnerId), {
          userId: activeUid,
          upiId: cleanUpi,
          bankDetails: bankPayload,
          updatedAt: Timestamp.now()
        }, { merge: true });
      }

      window.dispatchEvent(new CustomEvent('show-partner-toast', {
        detail: { message: 'Bank & UPI payout details saved!' }
      }));
      setActiveSub(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'partners');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSkillsAndSchedule = async () => {
    const activeUid = auth.currentUser?.uid || profile.uid;
    const targetPartnerId = partner?.id || (profile as any)?.partnerId || activeUid;
    if (!activeUid) return;

    setLoading(true);
    const cleanedSkills = editForm.selectedCategories.filter(
      (c: string) => !isPurgedCategoryOrService(c)
    );
    try {
      await setDoc(doc(db, 'users', activeUid), {
        categories: cleanedSkills,
        skills: cleanedSkills,
        "partnerData.categories": cleanedSkills,
        "partnerData.skills": cleanedSkills,
        "partnerData.workingHours": editForm.workingHours,
        updatedAt: Timestamp.now()
      }, { merge: true });

      if (targetPartnerId) {
        await setDoc(doc(db, 'partners', targetPartnerId), {
          userId: activeUid,
          categories: cleanedSkills,
          skills: cleanedSkills,
          workingHours: editForm.workingHours,
          updatedAt: Timestamp.now()
        }, { merge: true });
      }

      window.dispatchEvent(new CustomEvent('show-partner-toast', {
        detail: { message: 'Service skills & schedule updated!' }
      }));
      setActiveSub(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'partners');
    } finally {
      setLoading(false);
    }
  };

  const handleKYCSubmit = async () => {
    const activeUid = auth.currentUser?.uid || profile.uid;
    const targetPartnerId = partner?.id || (profile as any)?.partnerId || activeUid;
    if (!activeUid) return;

    setKycLoading(true);
    try {
      const docsList = [
        ...(kycIdUrl ? [{ type: 'Identity Proof', url: kycIdUrl, status: 'pending' as const }] : []),
        ...(kycAddressUrl ? [{ type: 'Address Proof', url: kycAddressUrl, status: 'pending' as const }] : [])
      ];

      const kycPayload: Record<string, any> = {
        aadhaarNumber: aadhaarNumber.trim(),
        panNumber: panNumber.trim().toUpperCase(),
        ...(docsList.length > 0 ? { kycDocuments: docsList } : {}),
        ...(!isKycVerified ? { kycStatus: 'pending' } : {}),
        updatedAt: Timestamp.now()
      };

      if (targetPartnerId) {
        await setDoc(doc(db, 'partners', targetPartnerId), kycPayload, { merge: true });
      }

      await setDoc(doc(db, 'users', activeUid), {
        ...kycPayload,
        "partnerData.aadhaarNumber": aadhaarNumber.trim(),
        "partnerData.panNumber": panNumber.trim().toUpperCase(),
        ...(docsList.length > 0 ? { "partnerData.kycDocuments": docsList } : {}),
      }, { merge: true });

      await sendNotification(
        profile.uid,
        'Identity Details Updated',
        'Your KYC & verification records have been synced with the Indore operations desk.',
        'promotional'
      ).catch(() => {});

      await sendNotification(
        'sarthakwebtech@gmail.com',
        'Partner KYC Updated',
        `Partner ${editForm.displayName || profile.displayName} updated KYC verification details.`,
        'promotional'
      ).catch(() => {});

      window.dispatchEvent(new CustomEvent('show-partner-toast', {
        detail: { message: 'KYC verification details submitted!' }
      }));
      setActiveSub(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `partners/${targetPartnerId}`);
    } finally {
      setKycLoading(false);
    }
  };

  const completedBookings = bookings.filter(b =>
    (b.partnerId === profile.uid || b.partnerId === partner?.id) &&
    ['completed', 'finalized'].includes(b.status)
  );
  const totalNetEarned = completedBookings.reduce((sum, b) => {
    const gross = Number(b.totalPrice ?? (b as any).finalPrice ?? (b as any).basePrice ?? 0);
    if (isNaN(gross) || gross <= 0) return sum;
    const platformFee = Math.round(gross * 0.20);
    const gstOnFee = Math.round(platformFee * 0.18);
    return sum + Math.max(0, gross - (platformFee + gstOnFee));
  }, 0);
  const syncedPartnerBalance = totalNetEarned > 0 ? totalNetEarned : (partner?.walletBalance ?? 0);

  return (
    <div className="p-4 sm:p-6 space-y-5 pb-28 max-w-xl mx-auto">
      {activeSub !== null && (
        <button 
          onClick={() => handleOpenSection(null)}
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700 bg-white hover:bg-slate-100 border border-slate-200/80 px-3.5 py-2 rounded-xl transition-all active:scale-95 cursor-pointer shadow-2xs"
        >
          <ArrowLeft size={14} />
          <span>Back to Account</span>
        </button>
      )}

      {activeSub === null && (
        <>
          {/* Sleek Partner Identity Header Card */}
          <section className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div 
                onClick={handleAvatarClick} 
                className="relative group cursor-pointer transition-transform active:scale-95 shrink-0"
                title="Tap to update profile photo"
              >
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 border-2 border-emerald-500 shadow-xs flex items-center justify-center relative">
                  {uploadingAvatar && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  <img
                    src={(avatarUrl || profile.photoURL) && !(avatarUrl || profile.photoURL)?.includes('googleusercontent.com/image_collection') ? (avatarUrl || profile.photoURL) : LogoIcon}
                    referrerPolicy="no-referrer"
                    alt={editForm.displayName || profile.displayName}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <Camera size={16} />
                  </div>
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-600 border-2 border-white rounded-full flex items-center justify-center text-white shadow-xs">
                  <Check size={11} strokeWidth={3} />
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-black text-slate-900 tracking-tight truncate">
                    {editForm.displayName || profile.displayName || 'Zomindia Partner'}
                  </h2>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80">
                    <Star size={10} className="fill-amber-500 text-amber-500" />
                    {Number(partner?.averageRating || partner?.rating || 4.9).toFixed(1)}
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-500 truncate mt-0.5">
                  {editForm.phoneNumber ? `+91 ${editForm.phoneNumber.replace(/^\+91\s*/, '')}` : (profile.email || 'Indore Hub Partner')}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    ID: PRO-{(profile.uid || '').slice(0, 6).toUpperCase()}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-[10px] font-bold text-blue-600">
                    {editForm.city || 'Indore'} Hub
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleOpenSection('profile')}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-bold transition-colors shrink-0 cursor-pointer active:scale-95"
            >
              Edit
            </button>

            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleAvatarChange} 
            />
          </section>

          {/* Compact KYC Alert Banner if not yet verified */}
          {!isKycVerified && (
            <section className={`p-4 rounded-3xl border flex items-center justify-between gap-3 ${
              partner?.kycStatus === 'rejected'
                ? 'bg-rose-50/70 border-rose-200'
                : 'bg-amber-50/80 border-amber-200'
            }`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  partner?.kycStatus === 'rejected' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'
                }`}>
                  <AlertCircle size={18} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-black text-slate-900">
                    {partner?.kycStatus === 'rejected' ? 'KYC Document Needs Attention' : 'KYC Verification Pending'}
                  </h4>
                  <p className="text-[11px] text-slate-600 truncate">
                    {partner?.kycRejectReason || 'Complete Aadhaar & PAN check for uninterrupted payouts'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleOpenSection('kyc')}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0 cursor-pointer active:scale-95"
              >
                Verify
              </button>
            </section>
          )}

          {/* Redesigned Account & Preferences Card (Sleek Zomato/Swiggy Partner Standard) */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            {/* Card Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 tracking-tight">Account & Preferences</h3>
                <p className="text-[11px] font-medium text-slate-500">Manage your profile, payouts & documents</p>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Active Partner
              </span>
            </div>

            {/* Interactive Options List */}
            <div className="divide-y divide-slate-100/80">
              {/* 1. Personal Details */}
              <button
                type="button"
                onClick={() => handleOpenSection('profile')}
                className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/80 active:bg-slate-100/60 transition-colors text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <User size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900">Personal Details</p>
                    <p className="text-[11px] text-slate-500 truncate">Name, mobile & display picture</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>

              {/* 2. Bank & Payout Details */}
              <button
                type="button"
                onClick={() => handleOpenSection('bank')}
                className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/80 active:bg-slate-100/60 transition-colors text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <CreditCard size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-900">Bank & Payout Details</p>
                      {hasLinkedBankOrUpi ? (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                          ✓ Linked
                        </span>
                      ) : (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                          Add UPI / Bank
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">
                      {bankForm.upiId ? `UPI: ${bankForm.upiId}` : 'UPI ID & settlement bank account'}
                    </p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>

              {/* 3. Identity & Verification (KYC) */}
              <button
                type="button"
                onClick={() => handleOpenSection('kyc')}
                className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/80 active:bg-slate-100/60 transition-colors text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <ShieldCheck size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-900">Identity & Verification</p>
                      <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                        isKycVerified
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {isKycVerified ? '✓ Verified' : 'Pending'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">Aadhaar, PAN & KYC documents</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>

              {/* 4. Service Skills & Schedule */}
              <button
                type="button"
                onClick={() => handleOpenSection('skills')}
                className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/80 active:bg-slate-100/60 transition-colors text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Briefcase size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-900">Service Skills & Schedule</p>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                        {editForm.selectedCategories.length || 1} Active
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">Trade categories & working hours</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>

              {/* 5. Partner Wallet & Earnings Ledger */}
              <button
                type="button"
                onClick={() => handleOpenSection('earnings')}
                className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/80 active:bg-slate-100/60 transition-colors text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Wallet size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-900">Earnings & Payout Passbook</p>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-teal-50 text-teal-700">
                        ₹{syncedPartnerBalance.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">Completed job payouts & passbook ledger</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>

              {/* 6. Ratings & Quality Performance */}
              <button
                type="button"
                onClick={() => handleOpenSection('performance')}
                className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/80 active:bg-slate-100/60 transition-colors text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Star size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-900">Ratings & Quality Scorecard</p>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
                        {Number(partner?.averageRating || partner?.rating || 4.9).toFixed(1)} ★
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">Customer reviews & 4-pillar quality scores</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>

              {/* 7. Help & Support Desk */}
              <button
                type="button"
                onClick={() => handleOpenSection('faq')}
                className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/80 active:bg-slate-100/60 transition-colors text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <HelpCircle size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900">Partner Help & Support</p>
                    <p className="text-[11px] text-slate-500 truncate">FAQs & 24/7 Indore dispatch helpline</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            </div>
          </div>

          {/* Sign Out Card */}
          <button 
            type="button"
            onClick={handlePartnerLogout}
            className="w-full bg-white hover:bg-rose-50/60 px-5 py-4 rounded-3xl border border-rose-100 flex justify-between items-center active:scale-98 transition-all group cursor-pointer shadow-2xs"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-colors">
                <LogOut size={18} />
              </div>
              <div className="text-left">
                <p className="font-bold text-rose-600 text-xs">Log Out of Partner App</p>
                <p className="text-[11px] text-slate-400">Safely end your current session</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-rose-400 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </>
      )}

      {/* SUB-VIEW 1: PERSONAL DETAILS ('profile') */}
      {activeSub === 'profile' && (
        <motion.div
          key="sub-profile"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 space-y-6 shadow-xs"
        >
          <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">Personal Details</h3>
              <p className="text-xs text-slate-500 mt-0.5">Synced in real time with Admin & Customer bookings</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <User size={18} />
            </div>
          </div>

          {/* Avatar Upload Row */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
            <div
              onClick={handleAvatarClick}
              className="w-16 h-16 rounded-2xl overflow-hidden bg-white border-2 border-emerald-500 shrink-0 relative group cursor-pointer"
            >
              <img
                src={(editForm.photoURL || avatarUrl || profile.photoURL) && !(editForm.photoURL || avatarUrl || profile.photoURL)?.includes('googleusercontent.com/image_collection') ? (editForm.photoURL || avatarUrl || profile.photoURL) : LogoIcon}
                referrerPolicy="no-referrer"
                alt=""
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={14} />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h5 className="text-xs font-bold text-slate-900">Display Picture</h5>
              <p className="text-[11px] text-slate-500 mt-0.5">Shown to customers on their booking card when you are assigned.</p>
              <button
                type="button"
                onClick={handleAvatarClick}
                className="mt-2 px-3 py-1.5 bg-white hover:bg-slate-100 text-blue-700 border border-slate-200 rounded-xl text-[11px] font-bold transition-colors cursor-pointer"
              >
                {uploadingAvatar ? 'Uploading...' : 'Change Photo'}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1.5">Full Name</label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={editForm.displayName}
                  onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                  placeholder="Enter your full name"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1.5">Registered Mobile Number</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  value={editForm.phoneNumber}
                  onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                  placeholder="+91 9876543210"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1.5">Primary Hub / City</label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={editForm.city}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  placeholder="Indore"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1.5">Professional Summary / Bio</label>
              <textarea
                rows={3}
                value={editForm.bio}
                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                placeholder="e.g. 6+ years experience in RO, AC & Refrigerator repair in Indore..."
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={loading}
            className="w-full py-3.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white rounded-2xl font-black uppercase tracking-wider text-xs shadow-md active:scale-98 transition-all cursor-pointer"
          >
            {loading ? 'Saving & Syncing...' : 'Save Personal Details'}
          </button>
        </motion.div>
      )}

      {/* SUB-VIEW 2: BANK & PAYOUT DETAILS ('bank') */}
      {activeSub === 'bank' && (
        <motion.div
          key="sub-bank"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 space-y-6 shadow-xs"
        >
          <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">Bank & Payout Details</h3>
              <p className="text-xs text-slate-500 mt-0.5">Configure your UPI ID & bank account for direct 80% payouts</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CreditCard size={18} />
            </div>
          </div>

          {/* Instant UPI Configuration */}
          <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800">Instant UPI Settlement (Recommended)</span>
              {bankForm.upiId && (
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">Active</span>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Primary UPI ID (GPay / PhonePe / Paytm)</label>
              <input
                type="text"
                value={bankForm.upiId}
                onChange={(e) => setBankForm({ ...bankForm, upiId: e.target.value })}
                placeholder="e.g. 9876543210@ybl or name@okaxis"
                className="w-full px-3.5 py-3 bg-white border border-emerald-200 rounded-xl text-xs font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Direct Bank Transfer (NEFT / IMPS) */}
          <div className="space-y-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Bank Account Details (NEFT / IMPS)</h4>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Account Holder Name</label>
              <input
                type="text"
                value={bankForm.accountHolder}
                onChange={(e) => setBankForm({ ...bankForm, accountHolder: e.target.value })}
                placeholder="Name as per bank passbook"
                className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Account Number</label>
                <input
                  type="text"
                  value={bankForm.accountNumber}
                  onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                  placeholder="Enter account number"
                  className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">IFSC Code</label>
                <input
                  type="text"
                  value={bankForm.ifscCode}
                  onChange={(e) => setBankForm({ ...bankForm, ifscCode: e.target.value.toUpperCase() })}
                  placeholder="e.g. SBIN0001234"
                  className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold uppercase text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Bank Name</label>
              <div className="relative">
                <Building2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={bankForm.bankName}
                  onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                  placeholder="e.g. State Bank of India, HDFC Bank"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={handleSaveBankDetails}
              disabled={loading}
              className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-2xl font-black uppercase tracking-wider text-xs shadow-md active:scale-98 transition-all cursor-pointer"
            >
              {loading ? 'Saving Payout Info...' : 'Save Payout Details'}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('wallet')}
              className="px-4 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Wallet size={15} />
              <span>Open Passbook</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* SUB-VIEW 3: IDENTITY & VERIFICATION ('kyc') */}
      {activeSub === 'kyc' && (
        <motion.div
          key="sub-kyc"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 space-y-6 shadow-xs"
        >
          <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">Identity & Verification (KYC)</h3>
              <p className="text-xs text-slate-500 mt-0.5">Government ID & address verification for Indore technicians</p>
            </div>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
              isKycVerified
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {isKycVerified ? '✓ Verified' : 'Verification Pending'}
            </span>
          </div>

          {/* Aadhaar & PAN Numbers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Aadhaar Card Number</label>
              <div className="relative">
                <FileText size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  maxLength={14}
                  value={aadhaarNumber}
                  onChange={(e) => setAadhaarNumber(e.target.value)}
                  placeholder="XXXX XXXX XXXX"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">PAN Card Number</label>
              <div className="relative">
                <FileText size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  maxLength={10}
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold uppercase text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Document Uploads */}
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1.5">Identity Document (Aadhaar / PAN / Driving License)</label>
              <AdminUpload 
                label="Upload Identity Proof"
                onUpload={(url) => setKycIdUrl(url)}
                value={kycIdUrl}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
              />
              {kycIdUrl && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-bold border border-emerald-200">
                  <CheckCircle2 size={12} />
                  <span>Identity Proof Attached</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1.5">Address Proof (Aadhaar Back / Utility Bill)</label>
              <AdminUpload 
                label="Upload Address Proof"
                onUpload={(url) => setKycAddressUrl(url)}
                value={kycAddressUrl}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
              />
              {kycAddressUrl && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-bold border border-emerald-200">
                  <CheckCircle2 size={12} />
                  <span>Address Proof Attached</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={handleKYCSubmit}
              disabled={kycLoading}
              className="flex-1 py-3.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white rounded-2xl font-black uppercase tracking-wider text-xs shadow-md active:scale-98 transition-all cursor-pointer"
            >
              {kycLoading ? 'Submitting KYC...' : 'Save & Submit KYC'}
            </button>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-kyc-modal'))}
              className="px-4 py-3.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-2xl font-bold text-xs transition-all cursor-pointer"
            >
              Full KYC Wizard
            </button>
          </div>
        </motion.div>
      )}

      {/* SUB-VIEW 4: SERVICE SKILLS & SCHEDULE ('skills') */}
      {activeSub === 'skills' && (
        <motion.div
          key="sub-skills"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 space-y-6 shadow-xs"
        >
          <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">Service Skills & Schedule</h3>
              <p className="text-xs text-slate-500 mt-0.5">Select your active repair categories & weekly duty hours</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Briefcase size={18} />
            </div>
          </div>

          {/* Specializations Grid */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">Active Trade Categories</h4>
            <div className="grid grid-cols-2 gap-2.5">
              {categories.map(cat => {
                const isSelected = editForm.selectedCategories.includes(cat.id) || editForm.selectedCategories.includes(cat.name);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      const current = editForm.selectedCategories;
                      const next = isSelected
                        ? current.filter(id => id !== cat.id && id !== cat.name)
                        : [...current, cat.id];
                      setEditForm({ ...editForm, selectedCategories: next });
                    }}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-blue-700 border-blue-700 text-white shadow-xs'
                        : 'bg-slate-50 border-slate-200/80 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-xs font-bold leading-snug line-clamp-2">{cat.name}</span>
                    {isSelected && <Check size={14} className="text-emerald-300 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Weekly Schedule */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">Weekly Shift Timings</h4>
            <div className="space-y-2.5">
              {editForm.workingHours.map((wh, idx) => (
                <div key={wh.day} className="p-3.5 bg-slate-50 border border-slate-200/70 rounded-2xl flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-900">{wh.day}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...editForm.workingHours];
                        next[idx] = { ...next[idx], enabled: !next[idx].enabled };
                        setEditForm({ ...editForm, workingHours: next });
                      }}
                      className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                        wh.enabled ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full transition-transform shadow-2xs ${
                        wh.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                  {wh.enabled && (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={wh.startTime}
                        onChange={(e) => {
                          const next = [...editForm.workingHours];
                          next[idx] = { ...next[idx], startTime: e.target.value };
                          setEditForm({ ...editForm, workingHours: next });
                        }}
                        className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                      />
                      <span className="text-xs text-slate-400 font-bold">to</span>
                      <input
                        type="time"
                        value={wh.endTime}
                        onChange={(e) => {
                          const next = [...editForm.workingHours];
                          next[idx] = { ...next[idx], endTime: e.target.value };
                          setEditForm({ ...editForm, workingHours: next });
                        }}
                        className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveSkillsAndSchedule}
            disabled={loading}
            className="w-full py-3.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white rounded-2xl font-black uppercase tracking-wider text-xs shadow-md active:scale-98 transition-all cursor-pointer"
          >
            {loading ? 'Updating Schedule...' : 'Save Skills & Schedule'}
          </button>
        </motion.div>
      )}

      {/* SUB-VIEW 5: EARNINGS & PASSBOOK LEDGER ('earnings') */}
      {activeSub === 'earnings' && (
        <motion.div
          key="sub-earnings"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 space-y-6 shadow-xs"
        >
          <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">Earnings & Payout Summary</h3>
              <p className="text-xs text-slate-500 mt-0.5">80% direct partner take-home on every completed service</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('wallet')}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Full Wallet →
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="p-4 bg-emerald-50 border border-emerald-200/80 rounded-2xl">
              <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-black">Net Earned (After Fee & GST)</p>
              <p className="text-2xl font-black text-emerald-950 mt-1">
                ₹{totalNetEarned.toLocaleString('en-IN')}
              </p>
              <p className="text-[10px] mt-1 font-semibold text-emerald-700">
                {completedBookings.length} Completed Jobs
              </p>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200/80 rounded-2xl">
              <p className="text-[10px] uppercase tracking-wider text-amber-800 font-black">Wallet Balance</p>
              <p className="text-2xl font-black text-amber-950 mt-1">
                ₹{syncedPartnerBalance.toLocaleString('en-IN')}
              </p>
              <button
                type="button"
                onClick={() => handleOpenSection('bank')}
                className="text-[10px] mt-1 font-bold text-amber-800 underline cursor-pointer"
              >
                {hasLinkedBankOrUpi ? '✓ Payout Account Linked' : 'Link UPI / Bank →'}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Recent Job Ledger</h4>
            {(() => {
              const myHistory = bookings.filter(b => b.partnerId === profile.uid || b.partnerId === partner?.id);
              if (myHistory.length === 0) {
                return (
                  <div className="p-6 text-center text-xs text-slate-400 font-semibold bg-slate-50 border border-slate-100 rounded-2xl">
                    Completed bookings and payouts will appear here automatically.
                  </div>
                );
              }
              return (
                <div className="space-y-2.5">
                  {myHistory.slice(0, 15).map(b => {
                    const svc = services.find(s => s.id === b.serviceId);
                    const bill = Number(b.totalPrice ?? (b as any).finalPrice ?? (b as any).basePrice ?? 0);
                    const fee = Math.round(bill * 0.20);
                    const gst = Math.round(fee * 0.18);
                    const netPayout = Math.max(0, bill - (fee + gst));
                    return (
                      <div key={b.id} className="p-3.5 bg-slate-50 border border-slate-200/70 rounded-2xl flex justify-between items-center">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 text-xs truncate">
                            {svc?.name || b.serviceName || 'Technical Service'}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            #{b.id.slice(-6).toUpperCase()} • {b.scheduledAt?.toDate?.()?.toLocaleDateString() || 'Indore'}
                          </p>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className="text-xs font-black text-emerald-700">₹{netPayout} Net</p>
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded mt-0.5 inline-block ${
                            b.status === 'completed' || b.status === 'finalized'
                              ? 'bg-emerald-50 text-emerald-700'
                              : b.status === 'cancelled'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}>
                            {b.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </motion.div>
      )}

      {/* SUB-VIEW 6: RATINGS & QUALITY SCORECARD ('performance') */}
      {activeSub === 'performance' && (
        <motion.div
          key="sub-performance"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 space-y-6 shadow-xs"
        >
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-black text-slate-900 tracking-tight">Ratings & Quality Scorecard</h3>
            <p className="text-xs text-slate-500 mt-0.5">Real-time customer feedback & 4-pillar service quality</p>
          </div>

          <div className="bg-gradient-to-br from-blue-700 to-indigo-800 rounded-3xl p-5 text-white shadow-md flex items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-200">Overall Rating</span>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black tracking-tight">
                  {Number(partner?.averageRating || partner?.rating || 4.9).toFixed(1)}
                </span>
                <span className="text-xs font-bold text-blue-200">/ 5.0</span>
              </div>
              <div className="flex items-center gap-1 text-amber-300 pt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star 
                    key={star} 
                    size={15} 
                    fill={star <= Math.round(Number(partner?.averageRating || partner?.rating || 5)) ? "currentColor" : "none"} 
                  />
                ))}
              </div>
            </div>

            <div className="bg-white/10 border border-white/15 rounded-2xl p-3.5 text-right shrink-0">
              <p className="text-xl font-black">{partner?.totalReviews || partner?.reviewCount || partnerReviews.length || 0}</p>
              <p className="text-[10px] uppercase font-bold tracking-wider text-blue-200">Verified Reviews</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
              <p className="text-[10px] font-bold text-slate-500">Hygiene & Kit</p>
              <p className="text-base font-black text-slate-900 mt-1 flex items-center gap-1">
                <Star size={13} className="text-amber-500 fill-amber-500" />
                {partner?.feedbackScores?.hygiene ? Number(partner.feedbackScores.hygiene).toFixed(1) : '4.9'}
              </p>
            </div>
            <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
              <p className="text-[10px] font-bold text-slate-500">Safety & SOPs</p>
              <p className="text-base font-black text-slate-900 mt-1 flex items-center gap-1">
                <Star size={13} className="text-amber-500 fill-amber-500" />
                {partner?.feedbackScores?.safety ? Number(partner.feedbackScores.safety).toFixed(1) : '5.0'}
              </p>
            </div>
            <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
              <p className="text-[10px] font-bold text-slate-500">Service Skill</p>
              <p className="text-base font-black text-slate-900 mt-1 flex items-center gap-1">
                <Star size={13} className="text-amber-500 fill-amber-500" />
                {partner?.feedbackScores?.process ? Number(partner.feedbackScores.process).toFixed(1) : '4.8'}
              </p>
            </div>
            <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
              <p className="text-[10px] font-bold text-slate-500">Punctuality</p>
              <p className="text-base font-black text-slate-900 mt-1 flex items-center gap-1">
                <Star size={13} className="text-amber-500 fill-amber-500" />
                {partner?.feedbackScores?.appExperience ? Number(partner.feedbackScores.appExperience).toFixed(1) : '4.9'}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Customer Reviews ({partnerReviews.length})</h4>
            {loadingReviews ? (
              <div className="p-6 text-center text-xs text-slate-400 font-bold animate-pulse">
                Loading verified reviews...
              </div>
            ) : partnerReviews.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 font-medium bg-slate-50 border border-slate-100 rounded-2xl">
                Customer reviews from your completed jobs will appear here automatically.
              </div>
            ) : (
              <div className="space-y-2.5">
                {partnerReviews.map((rev) => {
                  const revDate = rev.createdAt?.toDate ? rev.createdAt.toDate() : (rev.createdAt ? new Date(rev.createdAt) : new Date());
                  const formattedDate = revDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
                  return (
                    <div key={rev.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-900">{rev.customerName || 'Verified Customer'}</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-900 rounded-lg text-[10px] font-black">
                          <Star size={10} className="fill-amber-500 text-amber-500" />
                          {rev.rating || 5}.0
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">{formattedDate}</p>
                      {(rev.reviewText || rev.comment || rev.review) && (
                        <p className="text-xs text-slate-700 bg-white p-2.5 rounded-xl border border-slate-100">
                          "{rev.reviewText || rev.comment || rev.review}"
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* SUB-VIEW 7: HELP & SUPPORT DESK ('faq') */}
      {activeSub === 'faq' && (
        <motion.div
          key="sub-faq"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 space-y-6 shadow-xs"
        >
          <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">Partner Help & Support Desk</h3>
              <p className="text-xs text-slate-500 mt-0.5">Indore operations dispatch support & payout rules</p>
            </div>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-partner-support'))}
              className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Headphones size={14} />
              <span>Call Helpline</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {[
              { q: "How do I receive my job earnings?", a: "Your 80% net partner share is settled directly to the UPI ID or Bank Account saved under 'Bank & Payout Details'. Daily settlements are processed at 8:00 PM IST." },
              { q: "What is the platform commission split?", a: "Zomindia retains a flat 20% platform fee to cover customer acquisition, Indore dispatch routing, and partner accident insurance. You keep 80% of every bill." },
              { q: "How do I update my service categories or timings?", a: "Open 'Service Skills & Schedule' in Account & Preferences to enable/disable trade categories or adjust your shift timings." },
              { q: "What if a customer is unreachable at the doorstep?", a: "Use the 'Call Customer' button on your active job card. If unreachable after 3 attempts, tap the Help button in the top bar to alert Indore Dispatch." }
            ].map((item, idx) => (
              <div key={idx} className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 text-left">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === item.q ? null : item.q)}
                  className="w-full flex justify-between items-center cursor-pointer font-bold text-slate-900 text-xs text-left"
                >
                  <span>{item.q}</span>
                  <ChevronRight size={15} className={`text-slate-400 transition-transform shrink-0 ${openFaq === item.q ? 'rotate-90' : ''}`} />
                </button>
                {openFaq === item.q && (
                  <p className="text-xs text-slate-600 leading-relaxed mt-2.5 pt-2.5 border-t border-slate-200/60">
                    {item.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
