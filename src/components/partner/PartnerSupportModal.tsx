import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Headphones, 
  X, 
  Phone, 
  MessageCircle, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Send,
  Building,
  Navigation,
  FileText
} from 'lucide-react';
import { UserProfile, PartnerProfile } from '../../types';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { CORPORATE_LANDLINE_GATEWAY } from '../../lib/telephony';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  partner?: PartnerProfile | null;
}

export default function PartnerSupportModal({ isOpen, onClose, profile, partner }: Props) {
  const [activeTab, setActiveTab] = useState<'hotline' | 'ticket' | 'sos'>('hotline');
  const [ticketCategory, setTicketCategory] = useState<string>('payment');
  const [ticketDescription, setTicketDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const partnerId = partner?.id || partner?.userId || profile.uid || 'UNKNOWN';
  const partnerName = profile.displayName || partner?.name || 'Partner';
  const partnerPhone = profile.phoneNumber || partner?.phone || '';

  const indoreHelplineNumber = "+918819991904";
  const whatsappNumber = "918819991904";
  const prefilledWhatsappMsg = encodeURIComponent(
    `Hello Zomindia Partner Dispatch Team,\n\nI am technician ${partnerName} (ID: PRO-${partnerId.slice(0, 6).toUpperCase()}).\nPhone: ${partnerPhone}\n\nI need operational assistance in Indore.`
  );

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketDescription.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'support_tickets'), {
        partnerId,
        partnerName,
        partnerPhone,
        userId: profile.uid,
        category: ticketCategory,
        description: ticketDescription.trim(),
        role: 'partner',
        status: 'open',
        priority: ticketCategory === 'safety' ? 'urgent' : 'normal',
        hub: 'Indore',
        createdAt: serverTimestamp()
      });

      setSubmitSuccess(true);
      setTicketDescription('');
      setTimeout(() => {
        setSubmitSuccess(false);
        setActiveTab('hotline');
      }, 2500);
    } catch (err) {
      console.error('Failed to submit partner ticket:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs">
        {/* Backdrop click */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0"
        />

        {/* Modal / Sheet Container */}
        <motion.div
          initial={{ y: '100%', opacity: 0.8 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative bg-white w-full max-w-lg rounded-t-[32px] sm:rounded-3xl shadow-2xl z-10 overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Top Notch on mobile */}
          <div className="sm:hidden flex justify-center pt-3 pb-1">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
          </div>

          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                <Headphones size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">Partner Help & Helpline</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                  Indore Hub 24/7 Operations Support
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-full transition-all active:scale-95"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation Pill Tabs */}
          <div className="flex p-2 bg-slate-100/80 border-b border-slate-200/60 gap-1 text-xs">
            <button
              onClick={() => setActiveTab('hotline')}
              className={`flex-1 py-2 px-3 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'hotline'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Phone size={13} className="text-blue-600" />
              <span>Instant Helpline</span>
            </button>

            <button
              onClick={() => setActiveTab('ticket')}
              className={`flex-1 py-2 px-3 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'ticket'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText size={13} className="text-amber-600" />
              <span>Log Ticket</span>
            </button>

            <button
              onClick={() => setActiveTab('sos')}
              className={`flex-1 py-2 px-3 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'sos'
                  ? 'bg-rose-600 text-white shadow-xs shadow-rose-600/20'
                  : 'text-rose-600 hover:bg-rose-50'
              }`}
            >
              <ShieldAlert size={13} />
              <span>SOS / Safety</span>
            </button>
          </div>

          {/* Body Content */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-4 no-scrollbar">
            {activeTab === 'hotline' && (
              <div className="space-y-3.5">
                {/* Indore Direct Operations Call */}
                <a
                  href={`tel:${indoreHelplineNumber}`}
                  className="p-4 bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200/80 rounded-2xl flex items-center justify-between transition-all group active:scale-98"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20 group-hover:scale-105 transition-transform">
                      <Phone size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900">Indore Dispatch Manager</span>
                        <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-black rounded-md">Live</span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">+91 8819991904 (Indore HQ)</p>
                    </div>
                  </div>
                  <span className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-wider">
                    Call Now
                  </span>
                </a>

                {/* WhatsApp Quick Assist */}
                <a
                  href={`https://wa.me/${whatsappNumber}?text=${prefilledWhatsappMsg}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200/80 rounded-2xl flex items-center justify-between transition-all group active:scale-98"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform">
                      <MessageCircle size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900">WhatsApp Quick-Assist</span>
                        <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-black rounded-md">Instant</span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">Chat directly with Indore dispatch team</p>
                    </div>
                  </div>
                  <span className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider">
                    Chat
                  </span>
                </a>

                {/* Enterprise Corporate Telephony */}
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-slate-800 text-slate-200 flex items-center justify-center">
                      <Building size={20} />
                    </div>
                    <div>
                      <span className="text-xs font-black text-slate-800">Corporate Landline Gateway</span>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">{CORPORATE_LANDLINE_GATEWAY} (Toll-Free)</p>
                    </div>
                  </div>
                  <a
                    href={`tel:${CORPORATE_LANDLINE_GATEWAY.replace(/-/g, '')}`}
                    className="px-3 py-1.5 bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-900 transition-colors"
                  >
                    Dial
                  </a>
                </div>

                {/* Physical Hub Location */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-150 flex items-start gap-2.5 text-xs text-slate-600">
                  <Navigation size={15} className="text-blue-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-black text-slate-800 block">Indore Operations & Verification Hub</span>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Zomindia Internet Technology, Scheme 54, PU-4 Commercial, Vijay Nagar, Indore, Madhya Pradesh 452010.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ticket' && (
              <form onSubmit={handleSubmitTicket} className="space-y-3.5">
                {submitSuccess ? (
                  <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
                    <CheckCircle2 size={32} className="text-emerald-600 mx-auto" />
                    <h4 className="text-sm font-black text-slate-900">Support Ticket Logged!</h4>
                    <p className="text-xs text-slate-600">
                      Our Indore operations team has received your request and will call you on {partnerPhone || 'your registered mobile'}.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                        Issue Category
                      </label>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {[
                          { id: 'payment', label: 'Payment / Payout' },
                          { id: 'booking', label: 'Booking Cancel / Fake' },
                          { id: 'customer', label: 'Customer Unreachable' },
                          { id: 'app', label: 'App / GPS Glitch' },
                        ].map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setTicketCategory(cat.id)}
                            className={`p-2.5 rounded-xl border text-left font-bold transition-all ${
                              ticketCategory === cat.id
                                ? 'bg-blue-50 border-blue-600 text-blue-900'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                        Describe the problem
                      </label>
                      <textarea
                        rows={3}
                        required
                        value={ticketDescription}
                        onChange={(e) => setTicketDescription(e.target.value)}
                        placeholder="e.g. Booking #ABC customer not answering door, or payment of ₹450 pending..."
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting || !ticketDescription.trim()}
                      className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-98 flex items-center justify-center gap-2"
                    >
                      <Send size={14} />
                      <span>{isSubmitting ? 'Submitting Ticket...' : 'Submit Support Ticket'}</span>
                    </button>
                  </>
                )}
              </form>
            )}

            {activeTab === 'sos' && (
              <div className="space-y-4">
                <div className="p-4 bg-rose-50 border-2 border-rose-200 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-rose-700">
                    <ShieldAlert size={20} className="animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-wider">Field Safety & SOS Protocol</span>
                  </div>
                  <p className="text-xs text-rose-950 font-medium leading-relaxed">
                    If you are experiencing any harassment, threat, or accident at a customer location in Indore, initiate emergency contact immediately.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <a
                    href="tel:112"
                    className="p-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl flex flex-col items-center justify-center text-center gap-1 shadow-lg shadow-red-600/30 active:scale-95 transition-all"
                  >
                    <ShieldAlert size={28} />
                    <span className="text-sm font-black uppercase tracking-tight mt-1">Police Emergency: 112</span>
                    <span className="text-[10px] opacity-80 font-bold">Direct MP Police Dispatch</span>
                  </a>

                  <a
                    href={`tel:${indoreHelplineNumber}`}
                    className="p-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl flex flex-col items-center justify-center text-center gap-1 shadow-lg shadow-slate-900/20 active:scale-95 transition-all"
                  >
                    <Phone size={28} className="text-amber-400" />
                    <span className="text-sm font-black uppercase tracking-tight mt-1">HQ Emergency Desk</span>
                    <span className="text-[10px] text-slate-400 font-bold">Zomindia Incident Team</span>
                  </a>
                </div>

                <div className="p-3 bg-slate-100 rounded-xl text-[10px] text-slate-500 font-bold flex items-center gap-2">
                  <Clock size={13} className="text-slate-400 shrink-0" />
                  <span>Your live GPS coordinates and customer booking ID will be transmitted to dispatch.</span>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
