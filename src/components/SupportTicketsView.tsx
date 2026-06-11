import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, SupportTicket, FAQ as FAQType } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, X, MessageSquare, AlertCircle, Clock, CheckCircle2, HelpCircle, Search } from 'lucide-react';
import FAQList from './FAQ';

export default function SupportTicketsView({ profile }: { profile: UserProfile }) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [faqs, setFaqs] = useState<FAQType[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'faqs' | 'tickets'>('faqs');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newTicket, setNewTicket] = useState({ subject: '', message: '', priority: 'low' as 'low' | 'medium' | 'high', category: 'Booking Issue' });

  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'tickets'), where('userId', '==', profile.uid));
    const unsubscribe = onSnapshot(q, (snap) => {
      const ts = snap.docs.map(d => ({ id: d.id, ...d.data() } as SupportTicket));
      // Sort in JS instead of compound query to save on index creation unless scaling
      ts.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
      setTickets(ts);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'tickets'));

    return () => unsubscribe();
  }, [profile.uid]);

  useEffect(() => {
    const q = query(collection(db, 'faqs'), where('isPublished', '==', true));
    const unsubscribe = onSnapshot(q, (snap) => {
      const ts = snap.docs.map(d => ({ id: d.id, ...d.data() } as FAQType));
      ts.sort((a, b) => (a.order || 0) - (b.order || 0));
      setFaqs(ts);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'faqs'));

    return () => unsubscribe();
  }, []);

  const handleSubmit = async () => {
    if (!newTicket.subject || !newTicket.message) return;
    setIsSubmitting(true);
    try {
      const payload = {
        ...newTicket,
        userId: profile.uid,
        status: 'open',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      await addDoc(collection(db, 'tickets'), payload);
      setNewTicket({ subject: '', message: '', priority: 'low', category: 'Booking Issue' });
      setIsAdding(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'tickets');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'open') return 'bg-amber-100 text-amber-700 border-amber-200';
    if (status === 'in_progress') return 'bg-blue-100 text-blue-700 border-blue-200';
    if (status === 'resolved') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    return 'bg-slate-100 text-slate-500 border-slate-200';
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-16">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 mb-12">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Support & Help Desk</h1>
          <p className="text-slate-500">How can we assist you today? Browse FAQs or raise a support ticket.</p>
        </div>
        <button 
          onClick={() => {
            setActiveSubTab('tickets');
            setIsAdding(!isAdding);
          }}
          className="bg-blue-700 text-white px-6 py-3 rounded-2xl flex items-center gap-2 font-bold text-sm tracking-tight shadow-xl shadow-blue-700/10 hover:scale-105 transition-transform"
        >
          {isAdding && activeSubTab === 'tickets' ? <X size={18} /> : <Plus size={18} />}
          {isAdding && activeSubTab === 'tickets' ? 'Cancel' : 'New Ticket'}
        </button>
      </div>

      {/* Sub-tabs bar */}
      <div className="flex border-b border-slate-100 mb-8 pb-px gap-4">
        <button
          onClick={() => { setActiveSubTab('faqs'); setIsAdding(false); }}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 font-bold text-sm select-none cursor-pointer transition-all ${activeSubTab === 'faqs' ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          <HelpCircle size={16} />
          Help Center & FAQs
        </button>
        <button
          onClick={() => setActiveSubTab('tickets')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 font-bold text-sm select-none cursor-pointer transition-all ${activeSubTab === 'tickets' ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          <MessageSquare size={16} />
          My Support Tickets ({tickets.length})
        </button>
      </div>

      {activeSubTab === 'faqs' ? (
        <div className="space-y-8 animate-in fade-in duration-200">
          <div className="relative" onTouchStartCapture={(e) => e.stopPropagation()} onMouseDownCapture={(e) => e.stopPropagation()}>
            <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-400">
              <Search size={18} />
            </span>
            <input
              type="text"
              inputMode="text"
              enterKeyHint="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search knowledge base articles, questions, or replies..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-blue-700/50 rounded-2xl pl-11 pr-12 py-4 text-sm font-bold focus:ring-2 focus:ring-blue-700/10 outline-none transition-all placeholder:text-slate-400 font-sans"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-slate-600 cursor-pointer select-none"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <FAQList faqs={faqs} searchQuery={searchQuery} />
        </div>
      ) : (
        <>
          <AnimatePresence>
            {isAdding && (
              <motion.div 
                initial={{ opacity: 0, y: -20, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -20, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm mb-12">
                  <h3 className="text-xl font-bold mb-6">Describe your issue</h3>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2 ml-1">Subject</label>
                      <input 
                        type="text" 
                        value={newTicket.subject}
                        onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                        placeholder="Brief summary of the issue"
                        className="w-full bg-slate-50 px-5 py-4 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-700 transition-all font-sans"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2 ml-1">Priority</label>
                      <select 
                        value={newTicket.priority}
                        onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value as any })}
                        className="w-full bg-slate-50 px-5 py-4 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-700 transition-all font-sans"
                      >
                        <option value="low">Low - General inquiry</option>
                        <option value="medium">Medium - Service issue</option>
                        <option value="high">High - Urgent escalation</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2 ml-1">Category</label>
                      <select 
                        value={newTicket.category}
                        onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
                        className="w-full bg-slate-50 px-5 py-4 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-700 transition-all font-sans"
                      >
                        <option value="Booking Issue">Booking Issue</option>
                        <option value="Payment Problem">Payment Problem</option>
                        <option value="Account Inquiry">Account Inquiry</option>
                        <option value="Feedback">Feedback</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2 ml-1">Message</label>
                      <textarea 
                        value={newTicket.message}
                        onChange={(e) => setNewTicket({ ...newTicket, message: e.target.value })}
                        rows={4}
                        placeholder="Provide details..."
                        className="w-full bg-slate-50 px-5 py-4 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-700 transition-all font-sans resize-none"
                      />
                    </div>
                    <button 
                      onClick={handleSubmit}
                      disabled={isSubmitting || !newTicket.subject || !newTicket.message}
                      className="w-full bg-blue-700 text-white py-4 rounded-2xl font-bold hover:bg-blue-800 transition-all disabled:opacity-50 tracking-wide"
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit Support Ticket'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-6">
            {tickets.length === 0 ? (
              <div className="text-center bg-white rounded-[40px] border border-slate-200 p-16">
                <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-6">
                  <MessageSquare size={24} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">No Support Tickets</h3>
                <p className="text-slate-500">You haven't submitted any tickets yet.</p>
              </div>
            ) : (
              tickets.map(ticket => (
                <div key={ticket.id} className="bg-white border border-slate-200 rounded-[32px] p-6 sm:p-8 hover:border-blue-700 transition-colors group">
                  <div className="flex flex-col md:flex-row justify-between gap-6 mb-6">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(ticket.status)}`}>
                          {ticket.status.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {ticket.createdAt?.toDate?.()?.toLocaleDateString()}
                        </span>
                        {ticket.category && (
                          <span className="px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-purple-100 text-purple-700 border-purple-200 border">
                            {ticket.category}
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">{ticket.subject}</h3>
                      <p className="text-slate-500 text-sm leading-relaxed">{ticket.message}</p>
                    </div>
                    <div className="shrink-0 bg-slate-50 px-4 py-3 rounded-xl border border-slate-100 self-start">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Priority</p>
                      <p className="text-sm font-bold text-slate-900 capitalize">{ticket.priority}</p>
                    </div>
                  </div>

                  {ticket.adminResponse && (
                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-6 relative overflow-hidden">
                      <div className="flex items-center gap-3 mb-3 relative z-10">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                          <CheckCircle2 size={16} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Admin Response</p>
                          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                            {ticket.updatedAt?.toDate?.()?.toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-slate-700 font-medium relative z-10 leading-relaxed shadow-sm">
                        {ticket.adminResponse}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
