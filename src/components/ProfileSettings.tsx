import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { motion } from 'motion/react';
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
  MapPin
} from 'lucide-react';

interface Props {
  profile: UserProfile;
  onUpdate: (updatedProfile: UserProfile) => void;
}

export default function ProfileSettings({ profile, onUpdate }: Props) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Local state for notification preferences
  const [notifPrefs, setNotifPrefs] = useState({
    bookingUpdates: profile.notificationPreferences?.bookingUpdates ?? true,
    promotionalMessages: profile.notificationPreferences?.promotionalMessages ?? true
  });

  const [displayName, setDisplayName] = useState(profile.displayName);
  const [address, setAddress] = useState(profile.address || '');

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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-16">
      <div className="mb-12">
        <h1 className="text-3xl font-bold text-stone-900 mb-2">Profile Settings</h1>
        <p className="text-stone-500">Manage your account details and notification preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left Column: Personal Info */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white border border-stone-200 rounded-[32px] p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center text-stone-900">
                <User size={20} />
              </div>
              <h3 className="text-xl font-bold text-stone-900">Personal Information</h3>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase mb-2 ml-1">Full Name</label>
                  <input 
                    type="text" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-stone-50 px-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-stone-500 transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase mb-2 ml-1">Email Address</label>
                  <div className="w-full bg-stone-100/50 px-5 py-4 rounded-2xl font-medium text-stone-400 flex items-center justify-between">
                    {profile.email}
                    <Shield size={16} />
                  </div>
                </div>
              </div>

              {!import.meta.env.DEV && (
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase mb-2 ml-1">Primary Phone</label>
                  <div className="w-full bg-stone-100/50 px-5 py-4 rounded-2xl font-medium text-stone-900 flex items-center gap-3">
                    <Smartphone size={18} className="text-stone-400" />
                    {profile.phoneNumber || 'Not Linked'}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2 ml-1">
                  <label className="block text-xs font-bold text-stone-400 uppercase">Saved Address</label>
                  <button 
                    onClick={() => {
                      if ("geolocation" in navigator) {
                        setLoading(true);
                        navigator.geolocation.getCurrentPosition((pos) => {
                          setAddress(`[Location detected: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}]`);
                          setLoading(false);
                        }, (err) => {
                          console.error(err);
                          setLoading(false);
                        });
                      }
                    }}
                    className="flex items-center gap-1.5 text-[10px] font-black uppercase text-stone-900 border-b border-stone-900/10 hover:border-stone-900 transition-all"
                  >
                    <MapPin size={10} /> Use Current Location
                  </button>
                </div>
                <textarea 
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Your default service address..."
                  rows={3}
                  className="w-full bg-stone-50 px-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-stone-500 transition-all font-medium resize-none shadow-inner"
                />
              </div>
            </div>
          </div>

          <div className="bg-white border border-stone-200 rounded-[32px] p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center text-stone-900">
                <Bell size={20} />
              </div>
              <h3 className="text-xl font-bold text-stone-900">Notifications</h3>
            </div>

            <div className="space-y-4">
              <label className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl cursor-pointer group hover:bg-stone-100 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-stone-900">
                    <MessageSquare size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-stone-900">Booking Updates</p>
                    <p className="text-xs text-stone-500">Get notified about status changes and partner assignments.</p>
                  </div>
                </div>
                <input 
                  type="checkbox" 
                  checked={notifPrefs.bookingUpdates}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, bookingUpdates: e.target.checked })}
                  className="w-5 h-5 rounded-md border-stone-300 text-stone-900 focus:ring-stone-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl cursor-pointer group hover:bg-stone-100 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-stone-900">
                    <Zap size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-stone-900">Promotional Messages</p>
                    <p className="text-xs text-stone-500">Receive special offers, discounts and service announcements.</p>
                  </div>
                </div>
                <input 
                  type="checkbox" 
                  checked={notifPrefs.promotionalMessages}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, promotionalMessages: e.target.checked })}
                  className="w-5 h-5 rounded-md border-stone-300 text-stone-900 focus:ring-stone-500"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Profile Summary & Action */}
        <div className="space-y-6">
          <div className="bg-stone-900 rounded-[32px] p-8 text-white text-center shadow-xl shadow-stone-200">
            <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/20">
              {profile.photoURL ? (
                <img src={profile.photoURL} alt="" className="w-full h-full object-cover rounded-full" />
              ) : (
                <User size={48} className="text-white/20" />
              )}
            </div>
            <h4 className="text-xl font-bold mb-1">{profile.displayName}</h4>
            <p className="text-[10px] uppercase font-black tracking-widest text-white/40 mb-8">{profile.role}</p>
            
            <button 
              onClick={handleSave}
              disabled={loading}
              className="w-full bg-white text-stone-900 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-stone-100 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-stone-900 border-t-transparent rounded-full animate-spin" />
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

            <button 
              onClick={() => signOut(auth)}
              className="mt-3 w-full bg-stone-800 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-rose-600 transition-all active:scale-95 border border-stone-700"
            >
              <LogOut size={20} />
              Logout
            </button>
          </div>

          <div className="bg-amber-50 rounded-[32px] p-8 border border-amber-100">
            <Shield size={24} className="text-amber-600 mb-4" />
            <h4 className="font-bold text-amber-900 mb-2">Privacy Control</h4>
            <p className="text-xs text-amber-800 leading-relaxed opacity-80">
              Your personal data is encrypted and never shared with partners until a booking is confirmed. 
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
