import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Banknote, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  Search, 
  X, 
  Phone, 
  Building, 
  FileText, 
  TrendingUp,
  ShieldAlert,
  RotateCw,
  Receipt
} from 'lucide-react';
import { PartnerProfile, UserProfile } from '../../types';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface Props {
  partners?: PartnerProfile[];
  adminProfile?: UserProfile | null;
}

export default function DailyCashRemittanceManager({ partners = [], adminProfile }: Props) {
  const [livePartners, setLivePartners] = useState<PartnerProfile[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'overdue' | 'standard'>('all');

  // Modal State
  const [selectedPartner, setSelectedPartner] = useState<PartnerProfile | null>(null);
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [cashierNotes, setCashierNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live subscription to partners with cash
  useEffect(() => {
    let isMounted = true;
    try {
      const q = query(
        collection(db, 'partners'),
        where('unsettledCashInHand', '>', 0)
      );

      const unsubscribe = onSnapshot(
        q,
        (snap) => {
          if (!isMounted) return;
          const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PartnerProfile));
          setLivePartners(list);
        },
        (err) => {
          console.warn("Live partners query notification:", err);
          if (isMounted) {
            // Fallback to prop partners
            setLivePartners(partners.filter(p => Number(p.unsettledCashInHand || 0) > 0));
          }
        }
      );

      return () => {
        isMounted = false;
        unsubscribe();
      };
    } catch (e) {
      setLivePartners(partners.filter(p => Number(p.unsettledCashInHand || 0) > 0));
    }
  }, [partners]);

  // Load recent cash deposits
  useEffect(() => {
    let isMounted = true;
    try {
      setLoadingTx(true);
      const q = query(
        collection(db, 'platformTransactions'),
        where('type', '==', 'office_cash_deposit'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );

      const unsubscribe = onSnapshot(
        q,
        (snap) => {
          if (!isMounted) return;
          setRecentTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          setLoadingTx(false);
        },
        (err) => {
          console.warn("Recent transactions note:", err);
          if (isMounted) setLoadingTx(false);
        }
      );

      return () => {
        isMounted = false;
        unsubscribe();
      };
    } catch (e) {
      setLoadingTx(false);
    }
  }, []);

  // Compute time since collection
  const getTimeElapsed = (timestamp: any) => {
    if (!timestamp) return { text: 'Recently', isOverdue: false, hours: 0 };
    let ms = 0;
    if (typeof timestamp === 'string') ms = new Date(timestamp).getTime();
    else if (timestamp?.seconds) ms = timestamp.seconds * 1000;
    else if (timestamp?.toDate) ms = timestamp.toDate().getTime();
    else if (typeof timestamp === 'number') ms = timestamp;

    if (!ms) return { text: 'Recently', isOverdue: false, hours: 0 };
    const diffHours = (Date.now() - ms) / (1000 * 60 * 60);

    if (diffHours < 1) return { text: '< 1 hr ago', isOverdue: false, hours: diffHours };
    if (diffHours < 24) return { text: `${Math.floor(diffHours)}h ago`, isOverdue: false, hours: diffHours };
    
    const days = Math.floor(diffHours / 24);
    const remHours = Math.floor(diffHours % 24);
    return { 
      text: `${days}d ${remHours}h ago (Overdue)`, 
      isOverdue: true, 
      hours: diffHours 
    };
  };

  // Filtered partners
  const displayedPartners = useMemo(() => {
    return livePartners.filter(p => {
      const name = (p.name || p.fullName || '').toLowerCase();
      const phone = (p.phone || '').toLowerCase();
      const term = searchTerm.toLowerCase();
      const match = name.includes(term) || phone.includes(term);
      if (!match) return false;

      const cash = Number(p.unsettledCashInHand || 0);
      const timeInfo = getTimeElapsed(p.lastCashCollectedAt);
      const isOverdue = p.isCashBlocked || cash > 2000 || timeInfo.isOverdue;

      if (filterMode === 'overdue') return isOverdue;
      if (filterMode === 'standard') return !isOverdue;
      return true;
    });
  }, [livePartners, searchTerm, filterMode]);

  // Aggregate Metrics
  const totalCashInField = useMemo(() => {
    return livePartners.reduce((acc, p) => acc + Number(p.unsettledCashInHand || 0), 0);
  }, [livePartners]);

  const overdueCount = useMemo(() => {
    return livePartners.filter(p => {
      const timeInfo = getTimeElapsed(p.lastCashCollectedAt);
      return p.isCashBlocked || Number(p.unsettledCashInHand || 0) > 2000 || timeInfo.isOverdue;
    }).length;
  }, [livePartners]);

  const totalPlatformCut = Math.round(totalCashInField * 0.20);

  const openClearanceModal = (p: PartnerProfile) => {
    setSelectedPartner(p);
    const cash = Number(p.unsettledCashInHand || 0);
    setAmountReceived(String(cash));
    setPaymentRef(`REC-COUNTER-${Date.now().toString().slice(-6)}`);
    setCashierNotes(`Physical currency verified at Zomindia office counter.`);
  };

  const handleClearCash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartner) return;
    const amt = parseFloat(amountReceived);
    if (!amt || amt <= 0) {
      alert("Please enter a valid cash amount received.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/clear-partner-cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId: selectedPartner.id || selectedPartner.userId,
          amountReceived: amt,
          paymentRef: paymentRef.trim() || `OFFICE-${Date.now()}`,
          cashierNotes: cashierNotes.trim(),
          adminUid: adminProfile?.uid || 'admin'
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to process counter clearance");
      }

      const resData = await res.json();
      alert(`Success: ₹${amt} cash remittance received and cleared! Partner credited ₹${resData.creditedEarnings} (80%).`);
      setSelectedPartner(null);
    } catch (err: any) {
      console.error("Clear partner cash failed:", err);
      alert(err.message || "Failed to process cash counter deposit.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Title */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-[36px] p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-blue-500/20 rounded-xl text-blue-400">
                  <Banknote size={22} />
                </span>
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-300">
                  Daily Cash Remittance Engine
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black italic tracking-tight">
                Daily Cash Remittances (COD Counter)
              </h2>
              <p className="text-xs text-slate-300 font-medium max-w-2xl">
                Technicians collect 100% COD cash from customers and remit it daily at the Zomindia office.
                Clear physical cash deposits here to unlock and disburse the partner's 80% earnings.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-auto">
              <div className="px-4 py-2 bg-black/40 border border-white/10 rounded-2xl text-center backdrop-blur-md">
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Office Deadline</p>
                <p className="text-xs font-black text-amber-300">Daily by 11:00 AM</p>
              </div>
            </div>
          </div>

          {/* Metric Summary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-4 border-t border-white/10">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                Total Physical Cash in Field
              </span>
              <p className="text-2xl font-black text-white italic">
                ₹{totalCashInField.toLocaleString()}
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                Technicians with Outstanding Cash
              </span>
              <p className="text-2xl font-black text-amber-400 italic">
                {livePartners.length} Partners
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                Overdue / Job Assignment Paused
              </span>
              <p className="text-2xl font-black text-rose-400 italic">
                {overdueCount} Accounts
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                Platform Commission Share (20%)
              </span>
              <p className="text-2xl font-black text-emerald-400 italic">
                ₹{totalPlatformCut.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by partner name, phone..."
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setFilterMode('all')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              filterMode === 'all' 
                ? 'bg-slate-900 text-white shadow-md' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Pending ({livePartners.length})
          </button>
          <button 
            onClick={() => setFilterMode('overdue')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              filterMode === 'overdue' 
                ? 'bg-rose-600 text-white shadow-md' 
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            Overdue / Paused ({overdueCount})
          </button>
          <button 
            onClick={() => setFilterMode('standard')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              filterMode === 'standard' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            Standard Window ({livePartners.length - overdueCount})
          </button>
        </div>
      </div>

      {/* Main Partners Table / Grid */}
      <div className="bg-white rounded-[36px] p-6 border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-base font-black text-slate-900 italic">
            Outstanding Cash In Hand List
          </h3>
          <span className="text-xs font-bold text-slate-400">
            Showing {displayedPartners.length} of {livePartners.length} partner liabilities
          </span>
        </div>

        {displayedPartners.length === 0 ? (
          <div className="p-16 text-center border-2 border-dashed border-slate-200 rounded-3xl">
            <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-3" />
            <h4 className="text-base font-black text-slate-800">No Unsettled Cash Liabilities</h4>
            <p className="text-xs text-slate-400 mt-1">All collected customer cash has been cleared at the office counter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <th className="py-3 px-4">Technician / Partner</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Pending Cash In Hand</th>
                  <th className="py-3 px-4">Time Since Collection</th>
                  <th className="py-3 px-4">Remittance Status</th>
                  <th className="py-3 px-4 text-right">Counter Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedPartners.map(p => {
                  const cash = Number(p.unsettledCashInHand || 0);
                  const timeInfo = getTimeElapsed(p.lastCashCollectedAt);
                  const isBlocked = p.isCashBlocked || cash > 2000 || timeInfo.isOverdue;

                  return (
                    <tr key={p.id || p.userId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-black text-sm">
                            {(p.name || p.fullName || 'P').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 leading-tight">
                              {p.name || p.fullName || 'Partner'}
                            </p>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ID: #{String(p.userId || p.id).slice(0, 8)}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4 font-bold text-slate-600 font-mono">
                        {p.phone || 'N/A'}
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1 text-slate-900">
                          <span className="font-black text-sm text-rose-600">
                            ₹{cash.toLocaleString()}
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-400 font-bold block">
                          80% Share: ₹{Math.round(cash * 0.80).toLocaleString()}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <span className="font-bold text-slate-700">{timeInfo.text}</span>
                      </td>

                      <td className="py-4 px-4">
                        {isBlocked ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full font-black text-[10px] uppercase tracking-wide">
                            <ShieldAlert size={12} />
                            Overdue / Paused
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-black text-[10px] uppercase tracking-wide">
                            <Clock size={12} />
                            Due by 11:00 AM
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-right">
                        <button 
                          onClick={() => openClearanceModal(p)}
                          className="inline-flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all shadow-sm shadow-blue-700/20"
                        >
                          <Building size={14} />
                          Receive Cash at Office
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Office Cash Deposits Ledger */}
      {recentTransactions.length > 0 && (
        <div className="bg-white rounded-[36px] p-6 border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <Receipt size={18} className="text-blue-600" />
              <h3 className="text-base font-black text-slate-900 italic">
                Recent Office Cash Receipts Audit Trail
              </h3>
            </div>
            <span className="text-xs font-bold text-slate-400">Latest Counter Deposits</span>
          </div>

          <div className="divide-y divide-slate-100">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="py-3 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900">{tx.partnerName || 'Partner'}</span>
                    <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                      Ref: {tx.paymentRef || tx.id}
                    </span>
                    {tx.depositMethod === 'razorpay_digital' && (
                      <span className="text-[9px] font-black uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        Digital / Razorpay
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-[11px] font-medium">{tx.cashierNotes || 'Counter Deposit'}</p>
                </div>

                <div className="flex items-center gap-4 text-right">
                  <div>
                    <span className="font-black text-emerald-600 text-sm block">
                      +₹{Number(tx.amountReceived || 0).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold block">
                      Partner 80%: ₹{Number(tx.partnerCreditedShare || 0).toLocaleString()}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {tx.createdAt?.toDate?.()?.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) || 'Recent'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Office Clearance Modal */}
      <AnimatePresence>
        {selectedPartner && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-[36px] p-8 shadow-2xl relative"
            >
              <button 
                onClick={() => setSelectedPartner(null)}
                className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-blue-50 rounded-2xl text-blue-700">
                  <Building size={24} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cash Remittance Desk</span>
                  <h3 className="text-xl font-black text-slate-900 italic">Receive Cash at Office Counter</h3>
                </div>
              </div>

              {/* Partner Summary Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-5 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="font-bold text-slate-500">Technician:</span>
                  <span className="font-black text-slate-900">{selectedPartner.name || selectedPartner.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-slate-500">Contact:</span>
                  <span className="font-mono font-bold text-slate-800">{selectedPartner.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-slate-500">Outstanding Liability:</span>
                  <span className="font-black text-rose-600 text-sm">
                    ₹{Number(selectedPartner.unsettledCashInHand || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              <form onSubmit={handleClearCash} className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5 ml-1">
                    Cash Amount Received (₹)
                  </label>
                  <input 
                    type="number"
                    min="1"
                    max={Number(selectedPartner.unsettledCashInHand || 0)}
                    value={amountReceived}
                    onChange={e => setAmountReceived(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 text-xl font-black text-slate-900 focus:outline-none focus:border-blue-700 transition-all"
                    placeholder="0.00"
                    required
                  />
                  <div className="flex gap-2 mt-2">
                    <button 
                      type="button"
                      onClick={() => setAmountReceived(String(selectedPartner.unsettledCashInHand || 0))}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-black uppercase tracking-wider text-slate-700"
                    >
                      Full Amount (₹{Number(selectedPartner.unsettledCashInHand || 0).toLocaleString()})
                    </button>
                  </div>
                </div>

                {/* Calculation Breakdown Preview */}
                {Number(amountReceived) > 0 && (
                  <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-3.5 space-y-1.5 text-xs">
                    <div className="flex justify-between font-bold text-slate-600">
                      <span>Platform Commission Retained (20%):</span>
                      <span className="font-black text-slate-900">₹{Math.round(Number(amountReceived) * 0.20).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold text-emerald-800">
                      <span>Credit to Partner Withdrawable Balance (80%):</span>
                      <span className="font-black text-sm">₹{Math.round(Number(amountReceived) * 0.80).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-500 text-[11px] pt-1 border-t border-emerald-200/60">
                      <span>Remaining Cash Liability:</span>
                      <span className="font-black text-slate-800">
                        ₹{Math.max(0, Number(selectedPartner.unsettledCashInHand || 0) - Number(amountReceived)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5 ml-1">
                    Receipt / Voucher Reference
                  </label>
                  <input 
                    type="text"
                    value={paymentRef}
                    onChange={e => setPaymentRef(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-700"
                    placeholder="e.g. REC-COUNTER-10492"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5 ml-1">
                    Cashier / Desk Notes
                  </label>
                  <input 
                    type="text"
                    value={cashierNotes}
                    onChange={e => setCashierNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-700"
                    placeholder="e.g. Physical cash verified and locked in cash drawer"
                  />
                </div>

                <div className="pt-2">
                  <button 
                    type="submit"
                    disabled={isSubmitting || !amountReceived || Number(amountReceived) <= 0}
                    className="w-full bg-blue-700 hover:bg-blue-800 text-white py-4 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-blue-700/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 size={18} />
                        <span>Confirm Cash Receipt & Credit 80%</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
