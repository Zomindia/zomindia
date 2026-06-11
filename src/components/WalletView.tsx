import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, WalletTransaction } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { motion } from 'motion/react';
import { Wallet, CreditCard, ArrowDownLeft, ArrowUpRight, Copy, Share2 } from 'lucide-react';

export default function WalletView({ profile, setActiveTab }: { profile: UserProfile, setActiveTab?: (tab: any) => void }) {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [topupAmount, setTopupAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const displayMessage = (msg: string, isError = false) => {
    if (isError) setErrorMessage(msg);
    else setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage(null);
      setErrorMessage(null);
    }, 4000);
  };

  useEffect(() => {
    const q = query(
      collection(db, 'walletTransactions'), 
      where('userId', '==', profile.uid)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const txs = snap.docs.map(d => ({ id: d.id, ...d.data() } as WalletTransaction));
      txs.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
      setTransactions(txs);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'walletTransactions'));

    return () => unsubscribe();
  }, [profile.uid]);

  const handleTopup = async () => {
    const amount = Number(topupAmount);
    if (isNaN(amount) || amount < 100) {
      displayMessage("Minimum topup is ₹100", true);
      return;
    }

    setLoading(true);
    try {
      // Direct integration to mock payment in the iframe
      const res = await fetch('/api/add-funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.uid,
          amount: amount,
          paymentId: `sim_pay_${Date.now()}`
        })
      });
      const data = await res.json();
      if (data.success) {
        setTopupAmount('');
        displayMessage("Wallet recharged successfully!");
      } else {
        displayMessage("Failed to add funds: " + data.error, true);
      }
    } catch (err) {
      console.error(err);
      displayMessage("Failed to initiate payment", true);
    } finally {
      setLoading(false);
    }
  };

  const copyReferralCode = () => {
    const code = profile.referralCode || `ZOM${profile.uid.slice(0, 6).toUpperCase()}`;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const [inputCode, setInputCode] = useState('');
  const [applyingCode, setApplyingCode] = useState(false);

  const applyReferral = async () => {
    if (!inputCode) return;
    setApplyingCode(true);
    try {
      const res = await fetch('/api/apply-referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.uid, referralCode: inputCode })
      });
      const data = await res.json();
      if (data.success) {
        displayMessage(data.message);
        setInputCode('');
      } else {
        displayMessage(data.error, true);
      }
    } catch (err) {
      displayMessage("Failed to apply code.", true);
    } finally {
      setApplyingCode(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:py-16 relative">
      {/* Messages */}
      {successMessage && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-blue-700 text-white px-6 py-3 rounded-full text-sm font-bold z-50 shadow-xl">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-rose-500 text-white px-6 py-3 rounded-full text-sm font-bold z-50 shadow-xl">
          {errorMessage}
        </div>
      )}

      <div className="flex justify-between items-end mb-12">
        <div>
          {setActiveTab && (
            <button 
              type="button"
              onClick={() => setActiveTab('profile')}
              className="flex items-center gap-1.5 text-xs font-bold uppercase text-[#050CA6] hover:text-[#040980] bg-[#050CA6]/5 hover:bg-[#050CA6]/10 px-4 py-2 rounded-xl transition-all mb-5 cursor-pointer max-w-xs focus:outline-hidden"
            >
              &larr; Back to Profile Settings
            </button>
          )}
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Wallet & Rewards</h1>
          <p className="text-slate-500">Manage your balance and referrals.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-8">
          {/* Main Card */}
          <div className="bg-blue-700 text-white p-8 rounded-[40px] shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            
            <div className="flex items-center gap-4 mb-12 relative z-10">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                <Wallet className="text-amber-400" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-white/50">Current Balance</p>
                <div className="text-4xl font-bold font-display tracking-tight">₹{profile.walletBalance || 0}</div>
              </div>
            </div>

            <div className="relative z-10">
              <label className="block text-[10px] uppercase tracking-widest font-bold text-white/50 mb-3 ml-2">Quick Topup</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(e.target.value)}
                    placeholder="1000"
                    className="w-full bg-white/10 text-white pl-8 pr-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all font-bold"
                  />
                </div>
                <button
                  onClick={handleTopup}
                  disabled={loading || !topupAmount}
                  className="bg-amber-400 text-slate-900 px-6 py-3 rounded-2xl font-bold hover:bg-amber-300 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Add'}
                </button>
              </div>
            </div>
          </div>

          {/* Subscription Card */}
          <div className="bg-gradient-to-br from-indigo-900 to-purple-900 border border-indigo-500 rounded-[40px] p-8 text-center flex flex-col items-center shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
            <h3 className="text-xl font-black text-white mb-2 italic tracking-tight">ZomIndia <span className="text-indigo-300">PRIME</span></h3>
            <p className="text-sm text-indigo-200 mb-6 text-balance">
              {profile.isPremium ? 'You are currently enjoying Prime benefits!' : 'Get 15% OFF all services and ZERO surge pricing for 1 year.'}
            </p>
            
            <button 
              onClick={async () => {
                if (profile.isPremium) {
                  displayMessage("You are already a Prime member!", true);
                  return;
                }
                // Directly simulate without confirm to avoid iframe block
                try {
                  const res = await fetch('/api/subscribe-prime', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: profile.uid })
                  });
                  const data = await res.json();
                  if (data.success) {
                    displayMessage("Welcome to ZomIndia PRIME! Enjoy 15% off forever.");
                  } else {
                    displayMessage(data.error, true);
                  }
                } catch (err) {
                  displayMessage('Subscription failed', true);
                }
              }}
              disabled={profile.isPremium}
              className={`font-bold px-8 py-3 rounded-2xl transition-colors w-full ${profile.isPremium ? 'bg-indigo-900/50 text-indigo-300 border border-indigo-700 cursor-not-allowed' : 'bg-white text-indigo-900 hover:bg-indigo-50 shadow-xl'}`}
            >
              {profile.isPremium ? 'Active Member' : 'Join Prime @ ₹999/yr'}
            </button>
          </div>

          {/* Referral Card */}
          <div className="bg-emerald-50 border border-emerald-100 rounded-[40px] p-8 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-6">
              <Share2 size={24} />
            </div>
            <h3 className="text-xl font-bold text-emerald-900 mb-2">Refer & Earn</h3>
            <p className="text-sm text-emerald-700/80 mb-6 text-balance leading-relaxed">
              Get <strong className="font-black text-emerald-900">₹100/- cash reward credit</strong> inside your wallet for every friend who completes their first service!
            </p>
            
            <button 
              onClick={copyReferralCode}
              className="bg-white border-2 border-emerald-200 text-emerald-800 font-bold px-8 py-3 rounded-2xl hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2 mb-4 w-full"
            >
              <Copy size={16} />
              {copied ? 'Copied to Clipboard!' : (profile.referralCode || `ZOM${profile.uid.slice(0, 6).toUpperCase()}`)}
            </button>

            {setActiveTab && (
              <button
                onClick={() => setActiveTab('referrals')}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-8 py-3 rounded-2xl transition-all shadow-md shadow-emerald-700/10 active:scale-95 text-xs uppercase tracking-wider mb-6 w-full cursor-pointer"
              >
                Track Invitations & Friends List
              </button>
            )}

            {!profile.referredBy && (
              <div className="w-full pt-6 border-t border-emerald-100">
                <label className="block text-xs font-bold text-emerald-900 mb-2">Have a Referral Code?</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    placeholder="ENTER CODE"
                    className="flex-1 bg-white border border-emerald-200 text-emerald-900 px-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold placeholder:text-emerald-300"
                  />
                  <button
                    onClick={applyReferral}
                    disabled={!inputCode || applyingCode}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 text-sm"
                  >
                    {applyingCode ? '...' : 'Apply'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-[40px] p-8 min-h-full">
            <h3 className="text-xl font-bold mb-8">Transaction History</h3>

            {transactions.length === 0 ? (
              <div className="text-center text-slate-400 py-12">
                <CreditCard size={48} className="mx-auto mb-4 opacity-50" />
                <p>No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {transactions.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-3xl border border-slate-100 hover:border-slate-300 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                        tx.type === 'credit' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                      }`}>
                        {tx.type === 'credit' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-slate-900">{tx.reason}</p>
                        <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mt-1">
                          {tx.createdAt?.toDate?.()?.toLocaleDateString() || 'Pending'} • {tx.status}
                        </p>
                      </div>
                    </div>
                    <div className={`font-display font-bold text-lg ${
                      tx.type === 'credit' ? 'text-emerald-600' : 'text-slate-900'
                    }`}>
                      {tx.type === 'credit' ? '+' : '-'}₹{tx.amount}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
