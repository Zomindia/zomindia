import React from 'react';
import { motion } from 'motion/react';
import { 
  ChevronLeft, 
  ShieldCheck, 
  Lock, 
  Smartphone, 
  MapPin, 
  Calendar, 
  Server, 
  Trash2, 
  Mail, 
  CheckCircle2,
  AlertCircle,
  PhoneCall
} from 'lucide-react';
import { COMPANY_NAME } from '../types';

interface PrivacyPolicyProps {
  onBack?: () => void;
  onNavigate?: (tab: string) => void;
}

export default function PrivacyPolicy({ onBack, onNavigate }: PrivacyPolicyProps) {
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (onNavigate) {
      onNavigate('home');
    } else {
      window.location.href = '/';
    }
  };

  const handleNavigate = (tab: string) => {
    if (onNavigate) {
      onNavigate(tab);
    } else {
      window.location.href = `/#${tab}`;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
      className="bg-slate-50 min-h-screen text-slate-900 !bg-slate-50 w-full"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-10">
        
        {/* Top Breadcrumb / Back Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
          <button 
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-[#002e6e] font-bold text-sm transition-all group cursor-pointer w-fit"
            id="privacy-back-button"
          >
            <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-blue-50 flex items-center justify-center transition-colors">
              <ChevronLeft size={18} className="group-hover:-translate-x-0.5 transition-transform text-slate-700 group-hover:text-[#002e6e]" />
            </div>
            <span>Back to Home</span>
          </button>

          <div className="flex items-center gap-2 flex-wrap text-xs font-bold text-slate-500">
            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200/60 px-3 py-1 rounded-full flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-emerald-600" />
              Verified Privacy Standards
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-500">Last updated: August 2026</span>
          </div>
        </div>

        {/* Hero Section */}
        <div className="bg-gradient-to-br from-[#002e6e] to-[#0a438c] rounded-3xl p-8 sm:p-12 text-white shadow-xl shadow-[#002e6e]/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-semibold text-sky-200 border border-white/15">
              <Lock size={13} className="text-sky-300" />
              Transparent & GDPR/IT Act Compliant Data Handling
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              Privacy Policy for {COMPANY_NAME}
            </h1>
            <p className="text-sky-100 text-sm sm:text-base leading-relaxed font-normal">
              At <strong>{COMPANY_NAME}</strong> (operated in Indore, Madhya Pradesh, India), safeguarding your privacy and personal data is our foundational commitment. This policy describes how we collect, handle, store, protect, and process your information when you access or use the <strong>{COMPANY_NAME}</strong> application, website, and doorstep home service marketplace.
            </p>
          </div>
        </div>

        {/* Quick Highlights Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                <Smartphone size={20} />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">Phone & Device Identity</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Utilized strictly for secure instant mobile OTP authentication, fraud prevention, and real-time service updates.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-[11px] font-bold text-blue-700">
              <CheckCircle2 size={13} className="mr-1 text-emerald-600" /> Never sold or rented to 3rd parties
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                <MapPin size={20} />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">Precise Location Access</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Required for doorstep technician navigation, nearby partner discovery, and live arrival distance estimates.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-[11px] font-bold text-emerald-700">
              <CheckCircle2 size={13} className="mr-1 text-emerald-600" /> Only used during active bookings
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                <Trash2 size={20} />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">Your Data Deletion Rights</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Full sovereignty over your profile. Request instant account or data erasure via a single click or email.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-[11px] font-bold text-amber-700">
              <CheckCircle2 size={13} className="mr-1 text-emerald-600" /> support@zomindia.com
            </div>
          </div>
        </div>

        {/* Detailed Policy Sections */}
        <div className="space-y-8">

          {/* Section 1 */}
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/90 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#002e6e] font-black text-sm flex items-center justify-center shrink-0">
                1
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                Information We Collect & Why
              </h2>
            </div>
            <div className="space-y-4 text-slate-700 text-sm leading-relaxed">
              <p>
                To provide safe, dependable, and efficient on-demand home maintenance services across Indore, <strong>{COMPANY_NAME}</strong> collects and processes specific categories of personal data:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                    <Smartphone size={15} className="text-[#002e6e]" />
                    <span>Phone Number & Contact Details</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    We collect your primary mobile telephone number and optional email address. Your mobile number acts as your primary account identifier, enabling fast and password-free OTP logins, automated SMS transaction receipts, and direct technician-to-customer coordination.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                    <MapPin size={15} className="text-[#002e6e]" />
                    <span>Precise Geolocation & Doorstep Address</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    With your explicit permission, we access your device's GPS and network-based location to pinpoint service addresses, display accurate local Indore catalog pricing, calculate technician commute times, and guide the verified service partner directly to your doorstep.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                    <Calendar size={15} className="text-[#002e6e]" />
                    <span>Booking History & Service Records</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    We maintain records of requested services (e.g., AC maintenance, electrical repair, deep cleaning), preferred time slots, address notes, invoiced amounts, payment method preferences, and service completion logs to support warranty claims, re-service guarantees, and dispute resolutions.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                    <Server size={15} className="text-[#002e6e]" />
                    <span>Device & Technical Diagnostics</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    We collect non-identifying technical metadata including browser type, operating system version, PWA installation status, and error crash logs to troubleshoot technical bugs and optimize app performance.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2 */}
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/90 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#002e6e] font-black text-sm flex items-center justify-center shrink-0">
                2
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                Third-Party Services & Infrastructure
              </h2>
            </div>
            <div className="space-y-4 text-slate-700 text-sm leading-relaxed">
              <p>
                <strong>{COMPANY_NAME}</strong> integrates industry-standard, high-security third-party service providers to deliver robust authentication, hosting, push messaging, and map routing:
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/70">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Lock size={15} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Google Cloud Platform & Firebase Services</h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      We utilize <strong>Firebase Authentication</strong> (phone OTP & Google sign-in) for identity security, <strong>Cloud Firestore</strong> for database encryption at rest, and <strong>Firebase Cloud Messaging (FCM)</strong> for real-time dispatch alerts.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/70">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Smartphone size={15} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Google Play Services & Google Maps Platform</h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      On Android and Web environments, <strong>Google Play Services</strong> and <strong>Google Maps APIs</strong> provide geocoding, address autocomplete, reverse geolocation, and routing assistance for on-time partner arrivals.
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-500 italic">
                All third-party partners adhere strictly to global data protection benchmarks and are contractually prohibited from using your data for independent commercial advertising.
              </p>
            </div>
          </div>

          {/* Section 3 */}
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/90 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#002e6e] font-black text-sm flex items-center justify-center shrink-0">
                3
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                Data Retention & Security Safeguards
              </h2>
            </div>
            <div className="space-y-4 text-slate-700 text-sm leading-relaxed">
              <p>
                We implement multi-layered administrative, technical, and physical security measures:
              </p>
              <ul className="space-y-2 text-xs text-slate-600 list-disc list-inside">
                <li><strong className="text-slate-800">Encryption in Transit & at Rest:</strong> All traffic between your device and our servers is encrypted using standard TLS 1.3 cryptographic protocols. Stored data is safeguarded with AES-256 encryption.</li>
                <li><strong className="text-slate-800">Strict Role-Based Access:</strong> Only authenticated personnel with operational need can access system databases under auditable logs.</li>
                <li><strong className="text-slate-800">Retention Horizon:</strong> Booking and transaction logs are maintained only as long as necessary to fulfill service warranties, handle refunds, and comply with applicable statutory accounting and taxation guidelines.</li>
              </ul>
            </div>
          </div>

          {/* Section 4 */}
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/90 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#002e6e] font-black text-sm flex items-center justify-center shrink-0">
                4
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                User Rights & Account / Data Deletion Policy
              </h2>
            </div>
            <div className="space-y-4 text-slate-700 text-sm leading-relaxed">
              <p>
                You maintain complete ownership and control over your personal information. Under applicable privacy regulations, you are entitled to:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70">
                  <span className="font-bold text-xs text-slate-900 block mb-1">Access & Review</span>
                  <p className="text-[11px] text-slate-600">Inspect the personal data, addresses, and past order records associated with your account.</p>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70">
                  <span className="font-bold text-xs text-slate-900 block mb-1">Correction & Updates</span>
                  <p className="text-[11px] text-slate-600">Edit your name, email, saved addresses, and profile details anytime in the app settings.</p>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70">
                  <span className="font-bold text-xs text-slate-900 block mb-1">Complete Data Deletion</span>
                  <p className="text-[11px] text-slate-600">Request irreversible deletion of your profile, address records, and associated user account.</p>
                </div>
              </div>

              <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-xs space-y-2 text-slate-700">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <AlertCircle size={15} className="text-amber-600 shrink-0" />
                  <span>How to Request Account & Data Deletion</span>
                </div>
                <p>
                  To request complete deletion of your account and all associated data, you can:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-1">
                  <li>Navigate to <strong>Profile Settings &gt; Delete Account</strong> within the Zomindia application, or</li>
                  <li>Email our dedicated Privacy &amp; Data Officer at <a href="mailto:support@zomindia.com" className="font-bold text-[#002e6e] underline">support@zomindia.com</a> with the subject line <em>&ldquo;Account Data Deletion Request&rdquo;</em> from your registered phone/email.</li>
                </ol>
                <p className="text-slate-500 text-[11px]">
                  Upon verification, all personal identifiers, addresses, and saved preferences will be permanently wiped within 7 business days, excluding records mandated by Indian financial accounting laws.
                </p>
              </div>
            </div>
          </div>

          {/* Section 5: Contact Information */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 sm:p-10 text-white shadow-lg space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 text-sky-300 font-black text-sm flex items-center justify-center shrink-0">
                5
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                Contact & Grievance Officer
              </h2>
            </div>
            
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              If you have any questions, clarifications, or grievances regarding this Privacy Policy or how your personal information is handled by <strong>{COMPANY_NAME}</strong>, please reach out to our team:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block">Support Email</span>
                <a href="mailto:support@zomindia.com" className="text-sm font-bold text-white hover:text-sky-300 transition-colors flex items-center gap-1.5">
                  <Mail size={14} className="text-sky-400" />
                  support@zomindia.com
                </a>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block">Helpline Phone</span>
                <a href="tel:+919630234563" className="text-sm font-bold text-white hover:text-sky-300 transition-colors flex items-center gap-1.5">
                  <PhoneCall size={14} className="text-sky-400" />
                  +91 9630234563
                </a>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block">Registered Location</span>
                <span className="text-sm font-bold text-white flex items-center gap-1.5">
                  <MapPin size={14} className="text-sky-400" />
                  Indore, MP, INDIA
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Footer Navigation Bar */}
        <div className="pt-6 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleNavigate('terms')}
              className="text-xs font-bold text-slate-600 hover:text-[#002e6e] transition-colors cursor-pointer"
            >
              Terms &amp; Conditions
            </button>
            <span className="text-slate-300">•</span>
            <button
              onClick={() => handleNavigate('refund')}
              className="text-xs font-bold text-slate-600 hover:text-[#002e6e] transition-colors cursor-pointer"
            >
              Cancellation &amp; Refund
            </button>
            <span className="text-slate-300">•</span>
            <button
              onClick={() => handleNavigate('help')}
              className="text-xs font-bold text-slate-600 hover:text-[#002e6e] transition-colors cursor-pointer"
            >
              Help Center
            </button>
          </div>

          <button
            onClick={handleBack}
            className="px-6 py-2.5 bg-[#002e6e] hover:bg-[#003d94] text-white font-bold text-xs rounded-full shadow-md transition-all cursor-pointer"
          >
            Return to Homepage
          </button>
        </div>

      </div>
    </motion.div>
  );
}
