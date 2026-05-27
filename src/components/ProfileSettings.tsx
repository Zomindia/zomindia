import React, { useState, useEffect, useRef } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { 
  signOut, 
  updateEmail, 
  sendEmailVerification, 
  linkWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult
} from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { handleMapsError } from '../lib/maps-errors';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Bell, 
  Shield, 
  Mail, 
  Smartphone, 
  CheckCircle2, 
  Save,
  MessageSquare,
  Zap,
  LogOut,
  MapPin,
  Calendar,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  Key,
  X,
  Gift,
  Award
} from 'lucide-react';

interface Props {
  profile: UserProfile;
  onUpdate: (updatedProfile: UserProfile) => void;
  setActiveTab: (tab: any) => void;
}

export default function ProfileSettings({ profile, onUpdate, setActiveTab }: Props) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Local state for notification preferences
  const [notifPrefs, setNotifPrefs] = useState({
    bookingUpdates: profile.notificationPreferences?.bookingUpdates ?? true,
    promotionalMessages: profile.notificationPreferences?.promotionalMessages ?? true
  });

  const [displayName, setDisplayName] = useState(profile.displayName);
  const [address, setAddress] = useState(profile.address || '');

  // Verification states
  const [newEmail, setNewEmail] = useState(profile.email || '');
  const [newPhone, setNewPhone] = useState(profile.phoneNumber ? profile.phoneNumber.replace('+91', '') : '');
  const [emailLoading, setEmailLoading] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<any>(null);

  // Tab-based verification modal states
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [activeVerifyTab, setActiveVerifyTab] = useState<'email' | 'phone'>('email');

  const handleSave = async () => {
    setLoading(true);
    setSuccess(false);
    try {
      const updatedProfile = {
        ...profile,
        displayName,
        address,
        notificationPreferences: notifPrefs
      };
      
      await updateDoc(doc(db, 'users', profile.uid), {
        displayName,
        address,
        notificationPreferences: notifPrefs,
        updatedAt: new Date()
      });
      
      onUpdate(updatedProfile);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailVerify = async () => {
    if (!auth.currentUser) return;
    setEmailLoading(true);
    setVerificationError(null);
    try {
      if (newEmail !== auth.currentUser.email) {
        await updateEmail(auth.currentUser, newEmail);
      }
      await sendEmailVerification(auth.currentUser);
      alert("Verification email sent! Please check your inbox.");
    } catch (err: any) {
      setVerificationError(err.message || "Failed to update email");
    } finally {
      setEmailLoading(false);
    }
  };

  const handlePhoneVerifyClick = async () => {
    if (!auth.currentUser || !newPhone) return;
    setPhoneLoading(true);
    setVerificationError(null);
    try {
      if (recaptchaRef.current) {
        recaptchaRef.current.clear();
      }
      const verifier = new RecaptchaVerifier(auth, 'profile-recaptcha', {
        'size': 'invisible'
      });
      await verifier.render();
      recaptchaRef.current = verifier;

      const formattedPhone = `+91${newPhone.replace(/\D/g, '')}`;
      const result = await linkWithPhoneNumber(auth.currentUser, formattedPhone, verifier);
      setConfirmationResult(result);
      setShowOtpInput(true);
    } catch (err: any) {
      console.error("Phone link error:", err);
      setVerificationError(err.message || "Failed to send OTP");
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleConfirmOtp = async () => {
    if (!confirmationResult || !otp) return;
    setPhoneLoading(true);
    setVerificationError(null);
    try {
      await confirmationResult.confirm(otp);
      
      // Update Firestore
      await updateDoc(doc(db, 'users', profile.uid), {
        phoneNumber: `+91${newPhone.replace(/\D/g, '')}`,
        phoneNumberVerified: true
      });

      onUpdate({
        ...profile,
        phoneNumber: `+91${newPhone.replace(/\D/g, '')}`,
        phoneNumberVerified: true
      });
      
      setShowOtpInput(false);
      setIsVerifyModalOpen(false);
      alert("Phone number verified and linked!");
    } catch (err: any) {
      setVerificationError("Invalid OTP code");
    } finally {
      setPhoneLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-16">
      <div className="mb-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Profile Settings</h1>
        <p className="text-slate-500">Manage your account details and notification preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left Column: Personal Info */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-900">
                <User size={20} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Personal Information</h3>
            </div>

            <div className="space-y-6">
              {/* Full Name Input Column (Perfect alignment) */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Full Name</label>
                <input 
                  type="text" 
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 px-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-700/10 focus:bg-white transition-all font-semibold text-slate-800"
                />
              </div>

              {/* Symmetrical Security Credentials Fields triggering unified Verify Popup */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Email Verification Box */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Email Address</label>
                  <div 
                    onClick={() => {
                      setActiveVerifyTab('email');
                      setVerificationError(null);
                      setIsVerifyModalOpen(true);
                    }}
                    className="bg-slate-50 border border-slate-100 p-4 rounded-2xl cursor-pointer hover:bg-slate-100/70 hover:border-slate-200 transition-all group flex flex-col justify-between min-h-[104px]"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-slate-600 truncate max-w-[140px] md:max-w-none">{newEmail || 'Not Associated'}</p>
                      {auth.currentUser?.emailVerified && newEmail === profile.email ? (
                        <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0">
                          <CheckCircle2 size={10} /> Verified
                        </span>
                      ) : (
                        <span className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0">
                          Unverified
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-black text-blue-700 uppercase tracking-widest mt-2">
                      <span>Click to Verify/Change</span>
                      <ChevronRight size={12} className="transform group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>

                {/* Phone Verification Box */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Primary Phone</label>
                  <div 
                    onClick={() => {
                      setActiveVerifyTab('phone');
                      setVerificationError(null);
                      setIsVerifyModalOpen(true);
                    }}
                    className="bg-slate-50 border border-slate-100 p-4 rounded-2xl cursor-pointer hover:bg-slate-100/70 hover:border-slate-200 transition-all group flex flex-col justify-between min-h-[104px]"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-slate-600">
                        {newPhone ? `+91 ${newPhone.substring(0, 5)} ${newPhone.substring(5)}` : 'Not Linked'}
                      </p>
                      {profile.phoneNumberVerified || profile.phoneNumber ? (
                        <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0">
                          <CheckCircle2 size={10} /> Verified
                        </span>
                      ) : (
                        <span className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0">
                          Unverified
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-black text-blue-700 uppercase tracking-widest mt-2">
                      <span>Click to Verify/Change</span>
                      <ChevronRight size={12} className="transform group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2 ml-1">
                  <label className="block text-xs font-bold text-slate-400 uppercase">Saved Address</label>
                  <button 
                    onClick={async () => {
                      if (navigator.permissions) {
                        try {
                          const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
                          if (permissionStatus.state === 'denied') {
                            alert("Location permission is blocked. Please enable it in your browser/device settings.");
                            return;
                          }
                        } catch (e) {
                          // Ignore implementation error
                        }
                      }
                      if ("geolocation" in navigator) {
                        setLoading(true);
                        
                        const successCallback = async (pos: GeolocationPosition) => {
                          const lat = pos.coords.latitude;
                          const lng = pos.coords.longitude;
                          let resolvedAddress = '';

                          // 1. Try Nominatim FIRST (unrestricted, reliable, no console auth errors)
                          try {
                            const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
                            const res = await fetch(url, {
                              headers: {
                                'Accept-Language': 'en',
                                'User-Agent': 'zomindia-app-preview'
                              }
                            });
                            if (res.ok) {
                              const data = await res.json();
                              if (data && data.display_name) {
                                resolvedAddress = data.display_name;
                              }
                            }
                          } catch (err) {
                            console.warn("OSM Nominatim fallback failed in settings, trying Google Maps:", err);
                          }

                          // 2. Fallback to Google Maps Geocoder
                          if (!resolvedAddress && typeof google !== 'undefined' && google.maps) {
                            try {
                              const geocoder = new google.maps.Geocoder();
                              const response = await geocoder.geocode({ location: { lat, lng } });
                              if (response.results && response.results[0]) {
                                resolvedAddress = response.results[0].formatted_address;
                              }
                            } catch (e) {
                              console.warn("Google Maps Geocoder failed or restricted in settings:", e);
                            }
                          }

                          // 3. Coordinate fallback
                          if (!resolvedAddress) {
                            resolvedAddress = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                          }

                          setAddress(resolvedAddress);
                          setLoading(false);
                        };

                        const errorCallback = (err: GeolocationPositionError) => {
                          alert(handleMapsError(err));
                          setLoading(false);
                        };

                        navigator.geolocation.getCurrentPosition(
                          successCallback,
                          (err) => {
                            if (err.code === err.TIMEOUT || err.code === err.POSITION_UNAVAILABLE) {
                              navigator.geolocation.getCurrentPosition(
                                successCallback,
                                errorCallback,
                                { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
                              );
                            } else {
                              errorCallback(err);
                            }
                          },
                          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
                        );
                      } else {
                        alert("Geolocation is not supported by your browser.");
                      }
                    }}
                    className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-900 border-b border-blue-700/10 hover:border-blue-700 transition-all"
                  >
                    <MapPin size={10} /> Use Current Location
                  </button>
                </div>
                <textarea 
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Your default service address..."
                  rows={3}
                  className="w-full bg-slate-50 px-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all font-medium resize-none shadow-inner"
                />
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-900">
                <Bell size={20} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Notifications</h3>
            </div>

            <div className="space-y-4">
              <label className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl cursor-pointer group hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-900">
                    <MessageSquare size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">Booking Updates</p>
                    <p className="text-xs text-slate-500">Get notified about status changes and partner assignments.</p>
                  </div>
                </div>
                <input 
                  type="checkbox" 
                  checked={notifPrefs.bookingUpdates}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, bookingUpdates: e.target.checked })}
                  className="w-5 h-5 rounded-md border-slate-300 text-slate-900 focus:ring-slate-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl cursor-pointer group hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-900">
                    <Zap size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">Promotional Messages</p>
                    <p className="text-xs text-slate-500">Receive special offers, discounts and service announcements.</p>
                  </div>
                </div>
                <input 
                  type="checkbox" 
                  checked={notifPrefs.promotionalMessages}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, promotionalMessages: e.target.checked })}
                  className="w-5 h-5 rounded-md border-slate-300 text-slate-900 focus:ring-slate-500"
                />
              </label>
            </div>
          </div>

          {/* AMC Section */}
          <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-700">
                <Calendar size={20} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Maintenance Contracts</h3>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 flex items-center justify-between group hover:bg-blue-50 transition-all cursor-pointer border border-transparent hover:border-blue-100" onClick={() => setActiveTab('amcs')}>
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-700 shadow-sm">
                     <Shield size={22} />
                  </div>
                  <div>
                     <p className="font-bold text-slate-900">Annual Protection Plans</p>
                     <p className="text-xs text-slate-500">Manage your active AMCs or browse new yearly contracts.</p>
                  </div>
               </div>
               <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-400 group-hover:text-blue-700 group-hover:bg-white transition-all shadow-sm">
                 <ChevronRight size={20} />
               </div>
            </div>
          </div>
        </div>

        {/* Right Column: Profile Summary & Action */}
        <div className="space-y-6">
          <div className="bg-blue-700 rounded-[32px] p-8 text-white text-center shadow-xl shadow-slate-200">
            <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/20">
              {profile.photoURL ? (
                <img src={profile.photoURL} alt="" className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <User size={48} className="text-white/20" />
              )}
            </div>
            <h4 className="text-xl font-bold mb-1">{profile.displayName}</h4>
            <p className="text-[10px] uppercase font-black tracking-widest text-white/40 mb-8">{profile.role}</p>
            
            <button 
              onClick={handleSave}
              disabled={loading}
              className="w-full bg-white text-slate-900 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-100 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save size={20} />
              )}
              Save Changes
            </button>
            
            {success && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex items-center justify-center gap-2 text-emerald-400 text-xs font-bold"
              >
                <CheckCircle2 size={16} />
                Profile updated successfully
              </motion.div>
            )}
          </div>

          {profile.role === 'admin' && (
             <div className="bg-purple-50 rounded-[32px] p-8 border border-purple-100 flex flex-col gap-4">
               <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center">
                 <Shield size={24} />
               </div>
               <div>
                 <h4 className="font-bold text-purple-900 mb-1">Administration</h4>
                 <p className="text-xs text-purple-700 leading-relaxed opacity-80">
                   You have high-level privileges. Access the global platform terminal.
                 </p>
               </div>
               <button 
                 onClick={() => setActiveTab('admin')}
                 className="w-full bg-purple-600 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-purple-700 transition-all active:scale-95 shadow-lg shadow-purple-200"
               >
                 Open Admin Panel
               </button>
             </div>
          )}

          {/* Moved from desktop nav to profile section */}
          <div className="bg-gradient-to-br from-pink-500 to-rose-600 rounded-[32px] p-8 text-white space-y-4 shadow-xl shadow-rose-500/10">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
              <Gift size={24} />
            </div>
            <div>
              <h4 className="font-extrabold text-lg text-white leading-tight uppercase tracking-tight">Refer & Earn ₹100</h4>
              <p className="text-xs text-rose-50/80 leading-relaxed mt-1">
                Share zomindia with your friends. They get a ₹100 signup bonus, and you unlock dynamic discount vouchers!
              </p>
            </div>
            <button 
              onClick={() => setActiveTab('referrals')}
              className="w-full bg-white text-rose-600 py-3 rounded-2xl font-black text-center text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95"
            >
              Open Referral Console
            </button>
          </div>

          {profile.role !== 'partner' && (
            <div className="bg-[#050CA6]/5 border border-[#050CA6]/10 rounded-[32px] p-8 space-y-4">
              <div className="w-12 h-12 bg-[#050CA6] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/10">
                <Award size={24} />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 leading-tight">Become Zomindia Partner</h4>
                <p className="text-xs text-slate-500 leading-relaxed mt-1">
                  Join our elite task force of background-verified, high-earning service professionals delivering quality care across India.
                </p>
              </div>
              <button 
                onClick={() => setActiveTab('partner-signup')}
                className="w-full bg-[#050CA6] hover:bg-blue-600 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-blue-200"
              >
                Join as Partner
              </button>
            </div>
          )}

          <div className="bg-amber-50 rounded-[32px] p-8 border border-amber-100 mb-6">
            <Shield size={24} className="text-amber-600 mb-4" />
            <h4 className="font-bold text-amber-900 mb-2">Privacy Control</h4>
            <p className="text-xs text-amber-800 leading-relaxed opacity-80">
              Your personal data is encrypted and never shared with partners until a booking is confirmed. 
            </p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-[32px] p-8 space-y-4">
            <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/10">
              <MessageSquare size={24} />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-1">🤖 AI Support Chat</h4>
              <p className="text-xs text-slate-600 leading-relaxed opacity-90">
                Get instant support with your active bookings, change requests, or payment issues directly.
              </p>
            </div>
            <button 
              onClick={() => {
                window.dispatchEvent(new CustomEvent('toggle-ai-chat', { detail: { open: true } }));
              }}
              className="w-full bg-blue-700 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-800 transition-all active:scale-95 shadow-md shadow-blue-200"
            >
              Open AI Chat
            </button>
          </div>

          <div className="p-8 bg-rose-50 border border-rose-100 rounded-[32px] space-y-4">
            <h4 className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-2">
              <AlertCircle size={14} /> Account Actions
            </h4>
            <p className="text-xs text-rose-800/60 font-medium">Session management and security controls.</p>
            <button 
              onClick={() => signOut(auth)}
              className="w-full flex items-center justify-between p-5 bg-white border border-rose-200 text-rose-600 rounded-2xl font-bold hover:bg-rose-600 hover:text-white transition-all group scale-100 active:scale-95 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <LogOut size={20} className="group-hover:rotate-12 transition-transform" />
                <span>Log out of Session</span>
              </div>
              <ChevronRight size={18} className="opacity-40 group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabbed Verification Modal Popup */}
      <AnimatePresence>
        {isVerifyModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!emailLoading && !phoneLoading) {
                  setIsVerifyModalOpen(false);
                  setVerificationError(null);
                }
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden z-10 border border-slate-100 flex flex-col"
            >
              {/* Header */}
              <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black italic text-slate-950">Verify Credentials</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Secure your platform account</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsVerifyModalOpen(false);
                    setVerificationError(null);
                  }}
                  disabled={emailLoading || phoneLoading}
                  className="p-2 hover:bg-slate-50 border border-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Verify Tabs Indicator */}
              <div className="flex border-b border-slate-100 bg-slate-50/55 p-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveVerifyTab('email');
                    setVerificationError(null);
                  }}
                  className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-2xl transition-all flex items-center justify-center gap-2 ${
                    activeVerifyTab === 'email'
                      ? 'bg-white shadow-sm text-blue-700 border border-slate-100'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Mail size={14} /> Email Tab
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveVerifyTab('phone');
                    setVerificationError(null);
                  }}
                  className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-2xl transition-all flex items-center justify-center gap-2 ${
                    activeVerifyTab === 'phone'
                      ? 'bg-white shadow-sm text-blue-700 border border-slate-100'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Smartphone size={14} /> Phone Tab
                </button>
              </div>

              {/* Tab Contents */}
              <div className="p-6 space-y-4">
                {activeVerifyTab === 'email' ? (
                  <div className="space-y-4">
                    <div className="text-center py-2">
                      <div className="w-12 h-12 bg-blue-50 text-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md shadow-blue-100">
                        <Mail size={22} />
                      </div>
                      <p className="text-xs text-slate-500 font-medium">Verify your email address to receive secure status notifications, booking progress updates, and receipts.</p>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Email Address</label>
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="email@example.com"
                        className="w-full bg-slate-50 border border-slate-100 px-5 py-3.5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-semibold text-slate-800"
                      />
                    </div>

                    {auth.currentUser?.emailVerified && newEmail === profile.email ? (
                      <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-3">
                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                        <p className="text-[11px] font-bold text-emerald-800">Your email address is fully verified.</p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleEmailVerify}
                        disabled={emailLoading || !newEmail}
                        className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold tracking-widest text-xs uppercase py-4 rounded-2xl transition-all shadow-lg shadow-blue-200 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {emailLoading ? <RefreshCw size={14} className="animate-spin" /> : 'Send Verification Link'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-center py-2">
                      <div className="w-12 h-12 bg-blue-50 text-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md shadow-blue-100">
                        <Smartphone size={22} />
                      </div>
                      <p className="text-xs text-slate-500 font-medium">Link and verify your mobile number to get instant updates about active service requests and phone notifications.</p>
                    </div>

                    {!showOtpInput ? (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Primary Phone (India)</label>
                          <div className="relative">
                            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-sm font-bold border-r border-slate-100 pr-3 text-slate-500">+91</span>
                            <input
                              type="tel"
                              value={newPhone}
                              onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                              placeholder="99999 99999"
                              className="w-full bg-slate-50 border border-slate-100 pl-[80px] pr-5 py-3.5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-semibold tracking-wider text-slate-800"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handlePhoneVerifyClick}
                          disabled={phoneLoading || newPhone.length < 10}
                          className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold tracking-widest text-xs uppercase py-4 rounded-2xl transition-all shadow-lg shadow-blue-200 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {phoneLoading ? <RefreshCw size={14} className="animate-spin" /> : 'Send OTP via SMS'}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100 space-y-4">
                          <div className="flex items-center gap-2 text-xs font-bold text-blue-700 uppercase tracking-widest">
                            <Key size={14} /> Enter 6-digit OTP code
                          </div>
                          <div className="flex gap-3">
                            <input
                              type="text"
                              value={otp}
                              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              placeholder="0 0 0 0 0 0"
                              className="flex-1 bg-white border border-blue-200 px-5 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-center tracking-[0.4em] font-black text-lg"
                            />
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setShowOtpInput(false);
                              setOtp('');
                            }}
                            className="flex-1 border text-slate-700 border-slate-200 font-bold tracking-widest text-[10px] uppercase py-3.5 rounded-2xl hover:bg-slate-50 transition-all"
                          >
                            Back
                          </button>
                          <button
                            type="button"
                            onClick={handleConfirmOtp}
                            disabled={phoneLoading || otp.length < 6}
                            className="flex-1 bg-blue-700 hover:bg-blue-800 text-white font-bold tracking-widest text-[10px] uppercase py-3.5 rounded-2xl transition-all shadow-lg shadow-blue-200 disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {phoneLoading ? <RefreshCw size={14} className="animate-spin" /> : 'Confirm Code'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Error Banner */}
                {verificationError && (
                  <div className="flex items-start gap-2 bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-2xl text-[10px] font-black leading-normal italic animate-fade-in">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{verificationError}</span>
                  </div>
                )}

                {/* Recaptcha Container */}
                <div id="profile-recaptcha" className="mt-4 flex justify-center"></div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
