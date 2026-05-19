import React, { useState, useEffect, useRef } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  browserSessionPersistence,
  setPersistence,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult
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

type AuthView = 'initial' | 'email-login' | 'email-register' | 'forgot-password' | 'phone-auth' | 'phone-verify';

function ResendOTPButton({ onResent, phoneNumber, setLoading, setError, confirmationResult, setConfirmationResult }: { 
  onResent: () => void, 
  phoneNumber: string, 
  setLoading: (l: boolean) => void, 
  setError: (e: string | null) => void,
  confirmationResult: ConfirmationResult | null,
  setConfirmationResult: (res: ConfirmationResult) => void
}) {
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleResend = async () => {
    if (timer > 0) return;
    setLoading(true);
    setError(null);
    try {
      const appVerifier = (window as any).recaptchaVerifier;
      if (!appVerifier) {
        const newVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          'size': 'invisible'
        });
        await newVerifier.render();
        (window as any).recaptchaVerifier = newVerifier;
      }
      
      const result = await signInWithPhoneNumber(auth, phoneNumber, (window as any).recaptchaVerifier);
      setConfirmationResult(result);
      setTimer(30);
      onResent();
    } catch (err: any) {
      console.error("Resend Error:", err);
      setError(err.message || "Failed to resend. Please wait a minute and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      disabled={timer > 0}
      onClick={handleResend}
      className={`text-[10px] font-bold uppercase tracking-widest transition-all ${
        timer > 0 ? 'text-slate-300 cursor-not-allowed' : 'text-blue-700 hover:text-blue-800'
      }`}
    >
      {timer > 0 ? `Resend Code in ${timer}s` : "Didn't receive code? Resend"}
    </button>
  );
}

export default function AuthModal({ isOpen, onClose, onSuccess }: Props) {
  const [view, setView] = useState<AuthView>('initial');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const resetForm = () => {
    setView('initial');
    setEmail('');
    setPassword('');
    setDisplayName('');
    setPhoneNumber('');
    setVerificationCode('');
    setConfirmationResult(null);
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
      const initialProfile: any = {
        uid: user.uid,
        displayName,
        email: user.email,
        role: isAdminEmail ? 'admin' : 'customer',
        createdAt: Timestamp.now(),
        referralCode: `ZOM${user.uid.slice(0, 6).toUpperCase()}`,
        walletBalance: 0,
        notificationPreferences: {
          bookingUpdates: true,
          promotionalMessages: true
        }
      };

      if (isAdminEmail) {
        initialProfile.adminSubRole = 'head';
      }

      await setDoc(doc(db, 'users', user.uid), initialProfile);
      
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


  const recaptchaRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (recaptchaRef.current) {
        recaptchaRef.current.clear();
        recaptchaRef.current = null;
      }
    };
  }, []);

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneNumber.length < 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      if (recaptchaRef.current) {
        recaptchaRef.current.clear();
      }
      
      const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
        'callback': () => {}
      });
      await verifier.render();
      recaptchaRef.current = verifier;
      (window as any).recaptchaVerifier = verifier;
      
      const formattedPhone = `+91${phoneNumber}`;
      console.log("Requesting OTP for:", formattedPhone);
      const result = await signInWithPhoneNumber(auth, formattedPhone, verifier);
      setConfirmationResult(result);
      setView('phone-verify');
    } catch (err: any) {
      console.error("Phone Auth Error Details:", err);
      let msg = err.message || 'Failed to send OTP';
      if (err.code === 'auth/invalid-phone-number') msg = 'Invalid phone number format.';
      if (err.code === 'auth/too-many-requests') msg = 'Too many attempts. Please try again later (usually 1-2 hours) or use a different number.';
      if (err.code === 'auth/captcha-check-failed') msg = 'Security check failed. Please refresh and try again.';
      
      setError(msg);
      if (recaptchaRef.current) {
        recaptchaRef.current.clear();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult) return;
    setLoading(true);
    setError(null);
    try {
      const userCredential = await confirmationResult.confirm(verificationCode);
      const user = userCredential.user;

      // Check if profile exists, if not create one
      const profileDoc = await doc(db, 'users', user.uid);
      await setDoc(profileDoc, {
        uid: user.uid,
        displayName: displayName || (user.phoneNumber || 'User'),
        phoneNumber: user.phoneNumber,
        role: 'customer',
        createdAt: Timestamp.now(),
        referralCode: `ZOM${user.uid.slice(0, 6).toUpperCase()}`,
        walletBalance: 0,
        notificationPreferences: {
          bookingUpdates: true,
          promotionalMessages: true
        }
      }, { merge: true });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError('Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view === 'phone-verify' && 'OTPCredential' in window) {
      const ac = new AbortController();
      (navigator as any).credentials.get({
        otp: { transport: ['sms'] },
        signal: ac.signal
      } as any).then((otp: any) => {
        if (otp && otp.code) {
          setVerificationCode(otp.code);
        }
      }).catch((err: any) => {
        console.log('WebOTP Error/Cancelled:', err);
      });
      return () => ac.abort();
    }
  }, [view]);

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
              {view === 'phone-auth' && "Mobile Login"}
              {view === 'phone-verify' && "Verify OTP"}
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
                    onClick={() => setView('phone-auth')}
                    className="w-full flex items-center justify-between p-5 bg-emerald-600 text-white rounded-[24px] font-bold group hover:scale-[1.02] transition-all active:scale-95 shadow-xl shadow-emerald-600/10"
                  >
                    <div className="flex items-center gap-4">
                      <Smartphone size={20} />
                      <span>Continue with Phone</span>
                    </div>
                    <ArrowRight size={18} className="opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </button>

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

            {view === 'phone-auth' && (
              <motion.form 
                key="phone"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handlePhoneSubmit}
                className="space-y-4"
              >
                <button 
                  type="button"
                  onClick={() => setView('initial')}
                  className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 hover:text-blue-700 transition-colors"
                >
                  <ChevronLeft size={14} /> Back
                </button>

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

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Phone Number (India)</label>
                  <div className="relative">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-2 pr-4 border-r border-slate-200">
                      <img src="https://flagcdn.com/w20/in.png" alt="India" className="w-4" />
                      <span className="text-sm font-bold text-slate-900">+91</span>
                    </div>
                    <input 
                      type="tel"
                      required
                      value={phoneNumber}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setPhoneNumber(val);
                      }}
                      placeholder="99999 99999"
                      className="w-full bg-slate-50 border border-transparent focus:border-slate-200 focus:bg-white pl-20 pr-5 py-4 rounded-2xl outline-none transition-all font-medium text-sm tracking-widest"
                    />
                  </div>
                  <p className="mt-2 text-[10px] text-slate-400 font-medium tracking-wide">OTP will be sent via SMS for verification</p>
                </div>

                {error && (
                  <div className="flex items-start gap-3 text-rose-600 bg-rose-50 p-4 rounded-2xl text-xs font-bold border border-rose-100">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span className="leading-tight">{error}</span>
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={loading || phoneNumber.length < 10}
                  className="w-full bg-emerald-600 text-white p-5 rounded-[24px] font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/10 disabled:grayscale disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Smartphone size={20} />
                      Send OTP
                    </>
                  )}
                </button>
              </motion.form>
            )}

            {view === 'phone-verify' && (
              <motion.form 
                key="verify"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleVerifyOTP}
                className="space-y-6"
              >
                <div className="text-center space-y-2">
                  <button 
                    type="button"
                    onClick={() => setView('phone-auth')}
                    className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-widest hover:text-blue-700 transition-colors mx-auto mb-4"
                  >
                    <ChevronLeft size={14} /> Change Number (+91 {phoneNumber})
                  </button>
                  <p className="text-xs text-slate-500 font-medium">We've sent a 6-digit code to your phone</p>
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <input 
                      type="text"
                      required
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="0 0 0 0 0 0"
                      className="w-full bg-slate-50 border border-transparent focus:border-slate-200 focus:bg-white px-5 py-5 rounded-2xl outline-none transition-all font-black text-2xl tracking-[0.5em] text-center"
                    />
                  </div>

                  <div className="flex flex-col items-center gap-3">
                    <ResendOTPButton onResent={() => {}} phoneNumber={`+91${phoneNumber}`} setLoading={setLoading} setError={setError} confirmationResult={confirmationResult} setConfirmationResult={setConfirmationResult} />
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-rose-500 bg-rose-50 p-4 rounded-2xl text-xs font-bold border border-rose-100">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={loading || verificationCode.length < 6}
                  className="w-full bg-blue-700 text-white p-5 rounded-[24px] font-bold hover:bg-blue-800 transition-all shadow-xl shadow-blue-700/10 disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 size={20} />
                      Verify & Log In
                    </>
                  )}
                </button>
              </motion.form>
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
          <div id="recaptcha-container"></div>
        </div>
      </motion.div>
    </div>
  );
}
