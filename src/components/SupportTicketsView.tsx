import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, SupportTicket } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, X, MessageSquare, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';

export default function SupportTicketsView({ profile }: { profile: UserProfile }) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
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
      <div className="flex justify-between items-end mb-12">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Support Tickets</h1>
          <p className="text-slate-500">Need help? Submit an issue to our support team.</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-blue-700 text-white px-6 py-3 rounded-2xl flex items-center gap-2 font-bold text-sm tracking-tight shadow-xl shadow-blue-700/20/10 hover:scale-105 transition-transform"
        >
          {isAdding ? <X size={18} /> : <Plus size={18} />}
          {isAdding ? 'Cancel' : 'New Ticket'}
        </button>
      </div>

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
    </div>
  );
}
