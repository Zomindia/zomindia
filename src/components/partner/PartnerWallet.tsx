import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, 
  TrendingUp, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  BarChart2,
  Calendar,
  Zap,
  Star,
  X
} from 'lucide-react';
import { PartnerProfile, EarningsHistory } from '../../types';
import { collection, query, orderBy, onSnapshot, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';

interface Props {
  partner: PartnerProfile | null;
}

export default function PartnerWallet({ partner }: Props) {
  const [history, setHistory] = useState<EarningsHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');

  useEffect(() => {
    if (!partner) return;
    
    const q = query(
      collection(db, 'partners', partner.id, 'earningsHistory'), 
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snap) => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as EarningsHistory)));
      setLoading(false);
    });
  }, [partner?.id]);

  const isKycVerified = partner?.kycStatus === 'verified' || partner?.kycStatus === 'approved';
  let isGracePeriodExpired = false;
  if (partner?.gracePeriodEnd && !isKycVerified) {
    let targetMs = 0;
    const graceEnd = partner.gracePeriodEnd;
    if (typeof graceEnd === 'string') {
      targetMs = new Date(graceEnd).getTime();
    } else if (graceEnd?.seconds) {
      targetMs = graceEnd.seconds * 1000;
    } else if (graceEnd?.toDate) {
      targetMs = graceEnd.toDate().getTime();
    } else if (typeof graceEnd === 'number') {
      targetMs = graceEnd;
    } else {
      targetMs = new Date(graceEnd).getTime();
    }
    isGracePeriodExpired = Date.now() > targetMs;
  }

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partner) return;
    if (isGracePeriodExpired) {
      alert("KYC submission required to unlock payouts.");
      return;
    }
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0 || amount > (partner.totalEarnings || 0)) {
      alert("Invalid withdraw amount.");
      return;
    }
    
    try {
      await addDoc(collection(db, 'payoutRequests'), {
        partnerId: partner.userId,
        amount,
        status: 'pending',
        createdAt: Timestamp.now()
      });
      alert('Withdrawal request submitted successfully! Admin will process this soon.');
      setShowWithdraw(false);
      setWithdrawAmount('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'payoutRequests');
    }
  };

  return (
    <div className="p-6 space-y-8">
      {/* Wallet Card */}
      <section className="bg-blue-700 rounded-[48px] p-10 text-white relative overflow-hidden shadow-2xl">
         <div className="relative z-10">
            <div className="flex items-center gap-2 mb-10 opacity-50">
               <Wallet size={16} />
               <span className="text-[10px] font-black uppercase tracking-[0.2em]">Partner Balance</span>
            </div>
            
            <p className="text-5xl font-black italic tracking-tighter mb-2">₹{partner?.totalEarnings?.toLocaleString() || '0'}</p>
            <div className="flex items-center gap-2 text-emerald-400">
               <TrendingUp size={14} />
               <span className="text-[10px] font-black uppercase tracking-widest">+12% from last week</span>
            </div>

            <div className="mt-12 flex flex-col gap-2">
               <div className="flex gap-4">
                  {isGracePeriodExpired ? (
                    <button 
                      disabled
                      className="flex-1 bg-slate-400 text-slate-100 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-not-allowed opacity-70"
                      title="KYC submission required to unlock payouts"
                    >
                       Withdraw (Locked)
                    </button>
                  ) : (
                    <button 
                      onClick={() => setShowWithdraw(true)}
                      className="flex-1 bg-white text-slate-900 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-700/40 active:scale-95 transition-all"
                    >
                       Withdraw
                    </button>
                  )}
                  <button className="flex-1 bg-white/10 border border-white/20 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">
                     Tax Details
                  </button>
               </div>
               
               {isGracePeriodExpired && (
                 <p className="text-[9px] text-amber-300 font-extrabold mt-2 text-center uppercase tracking-wider">
                   KYC submission required to unlock payouts.
                 </p>
               )}
            </div>
         </div>
         <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl" />
      </section>

      {/* Withdraw Modal */}
      <AnimatePresence>
        {showWithdraw && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex flex-col items-center justify-end sm:justify-center backdrop-blur-sm"
          >
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              className="bg-white w-full sm:w-[480px] rounded-t-[40px] sm:rounded-[40px] p-8 shadow-2xl relative"
            >
              <button 
                onClick={() => setShowWithdraw(false)}
                className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
              >
                <X size={20} className="text-slate-500" />
              </button>
              
              <h3 className="text-2xl font-black text-slate-900 mb-8 italic">Request Withdrawal</h3>
              
              <form onSubmit={handleWithdraw} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Amount to withdraw (₹)</label>
                  <input 
                    type="number"
                    max={partner?.totalEarnings || 0}
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 text-xl font-bold focus:border-blue-700 focus:ring-4 focus:ring-blue-700/5 outline-none transition-all placeholder:text-slate-300"
                    placeholder="0.00"
                    required
                  />
                  <p className="mt-2 text-xs font-bold text-slate-400 ml-1">Available to withdraw: ₹{partner?.totalEarnings || 0}</p>
                </div>
                
                <button 
                  type="submit"
                  className="w-full bg-blue-700 text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-800 active:scale-95 transition-all shadow-xl shadow-blue-700/20"
                >
                  Confirm Request
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rewards Overview */}
      <section className="bg-amber-500 rounded-[32px] p-8 text-white flex justify-between items-center shadow-xl shadow-amber-500/10 active:scale-98 transition-transform">
         <div>
            <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">Loyalty Credits</p>
            <p className="text-2xl font-black italic">{partner?.rewardCredits || '0'} Points</p>
         </div>
         <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
            <Star fill="currentColor" size={24} />
         </div>
      </section>

      {/* Transaction History */}
      <section className="space-y-6">
         <div className="flex justify-between items-center px-1">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Transaction History</h3>
         </div>

         <div className="space-y-3">
            {history.length === 0 ? (
               <div className="p-12 text-center bg-white border border-slate-100 rounded-[40px] border-dashed">
                  <p className="text-sm font-black italic text-slate-300">No transactions recorded yet.</p>
               </div>
            ) : (
               history.map((item) => (
                  <div key={item.id} className="bg-white p-6 rounded-[32px] border border-slate-50 flex justify-between items-center group active:scale-98 transition-transform shadow-sm">
                     <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                          item.type === 'booking_earning' ? 'bg-blue-700 text-white shadow-lg' : 
                          item.type === 'reward_credit' ? 'bg-amber-100 text-amber-600' : 
                          'bg-slate-50 text-slate-600'
                        }`}>
                           {item.type === 'booking_earning' ? <ArrowDownLeft size={20} /> : <Zap size={20} />}
                        </div>
                        <div className="min-w-0">
                           <p className="text-sm font-black text-slate-900 leading-tight italic truncate">{item.reason}</p>
                           <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                             {item.createdAt?.toDate?.()?.toLocaleDateString([], { month: 'short', day: 'numeric' }) || 'Recent'}
                           </p>
                        </div>
                     </div>
                     <div className="text-right flex-shrink-0">
                        {item.amount > 0 && <p className="text-lg font-black text-slate-900 italic">+₹{item.amount}</p>}
                        {item.credits > 0 && <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">+{item.credits} Reward Pts</p>}
                     </div>
                  </div>
               ))
            )}
         </div>
      </section>
    </div>
  );
}
