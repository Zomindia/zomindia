import React, { useState } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  browserSessionPersistence,
  setPersistence
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Mail, 
  Smartphone, 
  Lock, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  ChevronLeft,
  UserPlus,
  LogIn
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type AuthView = 'initial' | 'email-login' | 'email-register' | 'forgot-password';

export default function AuthModal({ isOpen, onClose, onSuccess }: Props) {
  const [view, setView] = useState<AuthView>('initial');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const resetForm = () => {
    setView('initial');
    setEmail('');
    setPassword('');
    setDisplayName('');
    setError(null);
    setSuccessMsg(null);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Google login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await setPersistence(auth, browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email, password);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName) return setError('Name is required');
    setLoading(true);
    setError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Initial Profile Creation
      const isAdminEmail = user.email?.toLowerCase().trim() === 'sarthakwebtech@gmail.com';
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        displayName,
        email: user.email,
        role: isAdminEmail ? 'admin' : 'customer',
        adminSubRole: isAdminEmail ? 'head' : undefined,
        createdAt: Timestamp.now(),
        referralCode: `ZOM${user.uid.slice(0, 6).toUpperCase()}`,
        walletBalance: 0,
        notificationPreferences: {
          bookingUpdates: true,
          promotionalMessages: true
        }
      });
      
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMsg('Reset link sent to your email.');
    } catch (err: any) {
      setError('Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-blue-700/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md bg-white rounded-[32px] md:rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 md:p-8 pb-0 flex justify-between items-start shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-5 bg-blue-700 rounded-full flex items-center justify-center -rotate-12">
                <span className="text-white text-[10px] font-black rotate-12">Z</span>
              </div>
              <span className="font-bold tracking-tighter text-slate-900">zomindia</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 italic tracking-tighter">
              {view === 'initial' && "Begin Journey"}
              {view === 'email-login' && "Access Account"}
              {view === 'email-register' && "Join zomindia"}
              {view === 'forgot-password' && "Recovery"}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-50 rounded-full transition-colors"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="p-6 md:p-8 overflow-y-auto no-scrollbar">
          <AnimatePresence mode="wait">
            {view === 'initial' && (
              <motion.div 
                key="initial"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center shrink-0 text-slate-900 font-bold text-xs">1</div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Choose Method</p>
                      <p className="text-xs text-slate-500">Sign in with email or social accounts.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <button 
                    onClick={() => setView('email-login')}
                    className="w-full flex items-center justify-between p-5 bg-blue-700 text-white rounded-[24px] font-bold group hover:scale-[1.02] transition-all active:scale-95 shadow-xl shadow-blue-700/10"
                  >
                    <div className="flex items-center gap-4">
                      <Mail size={20} />
                      <span>Continue with Email</span>
                    </div>
                    <ArrowRight size={18} className="opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </button>

                  <div className="py-2 flex items-center gap-4">
                    <div className="flex-1 h-px bg-slate-100" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Fast Pass</span>
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>

                  <button 
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 p-4 bg-slate-50 text-slate-600 rounded-[24px] font-bold hover:bg-slate-100 transition-all active:scale-95"
                  >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-5 h-5" />
                    <span>Quick Login with Google</span>
                  </button>
                </div>

                <p className="text-center text-[11px] text-slate-400 font-medium px-4">
                  By continuing, you agree to zomindia's <span className="text-slate-900 font-bold underline">Terms</span> & <span className="text-slate-900 font-bold underline">Privacy Policy</span>.
                </p>
              </motion.div>
            )}

            {(view === 'email-login' || view === 'email-register') && (
              <motion.form 
                key={view}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={view === 'email-login' ? handleEmailLogin : handleRegister}
                className="space-y-4"
              >
                <button 
                  type="button"
                  onClick={() => setView('initial')}
                  className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 hover:text-blue-700 transition-colors"
                >
                  <ChevronLeft size={14} /> Back
                </button>

                {view === 'email-register' && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Full Name</label>
                    <input 
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full bg-slate-50 border border-transparent focus:border-slate-200 focus:bg-white px-5 py-4 rounded-2xl outline-none transition-all font-medium text-sm"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Email Address</label>
                  <input 
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full bg-slate-50 border border-transparent focus:border-slate-200 focus:bg-white px-5 py-4 rounded-2xl outline-none transition-all font-medium text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Password</label>
                  <input 
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-transparent focus:border-slate-200 focus:bg-white px-5 py-4 rounded-2xl outline-none transition-all font-medium text-sm font-mono"
                  />
                </div>

                {view === 'email-login' && (
                  <button 
                    type="button"
                    onClick={() => setView('forgot-password')}
                    className="text-xs font-bold text-slate-400 hover:text-blue-700 ml-1 transition-colors"
                  >
                    Forgot Password?
                  </button>
                )}

                {error && (
                  <div className="flex items-center gap-2 text-rose-500 bg-rose-50 p-4 rounded-2xl text-xs font-bold border border-rose-100">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-700 text-white p-5 rounded-[24px] font-bold hover:bg-blue-800 transition-all shadow-xl shadow-blue-700/10 disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      {view === 'email-login' ? <LogIn size={20} /> : <UserPlus size={20} />}
                      {view === 'email-login' ? 'Sign In' : 'Create Account'}
                    </>
                  )}
                </button>

                <p className="text-center text-xs text-slate-400 font-medium pt-2">
                  {view === 'email-login' ? "Don't have an account?" : "Already have an account?"}
                  <button 
                    type="button"
                    onClick={() => setView(view === 'email-login' ? 'email-register' : 'email-login')}
                    className="text-slate-900 font-black ml-1 uppercase tracking-widest text-[10px]"
                  >
                    {view === 'email-login' ? 'Register Now' : 'Login Here'}
                  </button>
                </p>
              </motion.form>
            )}

            {view === 'forgot-password' && (
              <motion.form 
                key="forgot"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleForgotPassword}
                className="space-y-4"
              >
                <button 
                  type="button"
                  onClick={() => setView('email-login')}
                  className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 hover:text-blue-700 transition-colors"
                >
                  <ChevronLeft size={14} /> Back
                </button>

                <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                  Enter your registered email and we'll send you a link to reset your password.
                </p>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Email Address</label>
                  <input 
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full bg-slate-50 border border-transparent focus:border-slate-200 focus:bg-white px-5 py-4 rounded-2xl outline-none transition-all font-medium text-sm"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-rose-500 bg-rose-50 p-4 rounded-2xl text-xs font-bold border border-rose-100">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}

                {successMsg && (
                  <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 p-4 rounded-2xl text-xs font-bold border border-emerald-100">
                    <CheckCircle2 size={16} />
                    {successMsg}
                  </div>
                )}

                {!successMsg && (
                   <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-700 text-white p-5 rounded-[24px] font-bold hover:bg-blue-800 transition-all shadow-xl shadow-blue-700/10 disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Send Reset Link'
                    )}
                  </button>
                )}
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
