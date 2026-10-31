import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc, deleteDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, WalletTransaction } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { Wallet, CreditCard, ArrowDownLeft, ArrowUpRight, Copy, Share2 } from 'lucide-react';

const isCorruptMockTransaction = (tx: any): boolean => {
  const payId = String(tx?.paymentId || '').trim();
  const refId = String(tx?.referenceId || '').trim();
  const ordId = String(tx?.orderId || '').trim();
  const reason = String(tx?.reason || '').toLowerCase();
  return (
    payId.startsWith('pay_sim_') ||
    payId.startsWith('pay_mock_') ||
    payId.startsWith('sim_pay_') ||
    refId.startsWith('pay_sim_') ||
    refId.startsWith('pay_mock_') ||
    refId.startsWith('sim_pay_') ||
    ordId.startsWith('order_mock_') ||
    reason.includes('mock') ||
    tx?.isMock === true
  );
};

export default function WalletView({ profile, setActiveTab }: { profile: UserProfile, setActiveTab?: (tab: any) => void }) {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [copied, setCopied] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasSanitizedRef = useRef(false);

  const displayMessage = (msg: string, isError = false) => {
    if (isError) {
      setErrorMessage(msg);
      setSuccessMessage(null);
    } else {
      setSuccessMessage(msg);
      setErrorMessage(null);
    }
    setTimeout(() => {
      setSuccessMessage(null);
      setErrorMessage(null);
    }, 4500);
  };

  useEffect(() => {
    if (!profile?.uid) return;
    fetch('/api/wallet/sanitize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: profile.uid })
    }).catch(() => {});
  }, [profile?.uid]);

  useEffect(() => {
    let isMounted = true;
    const q = query(
      collection(db, 'walletTransactions'), 
      where('userId', '==', profile.uid)
    );
    const unsubscribe = onSnapshot(
      q,
      async (snap) => {
        if (!isMounted) return;
        const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() } as WalletTransaction & Record<string, any>));
        const corruptDocs = allDocs.filter(isCorruptMockTransaction);
        const genuineDocs = allDocs.filter(tx => !isCorruptMockTransaction(tx));

        genuineDocs.sort((a, b) => {
          const timeA = typeof (a.createdAt as any)?.toMillis === 'function' ? (a.createdAt as any).toMillis() : ((a.createdAt as any)?.seconds ? (a.createdAt as any).seconds * 1000 : (a.createdAt ? new Date(a.createdAt as any).getTime() : 0));
          const timeB = typeof (b.createdAt as any)?.toMillis === 'function' ? (b.createdAt as any).toMillis() : ((b.createdAt as any)?.seconds ? (b.createdAt as any).seconds * 1000 : (b.createdAt ? new Date(b.createdAt as any).getTime() : 0));
          return timeB - timeA;
        });
        setTransactions(genuineDocs);

        // Purge any corrupt mock transactions and recalculate authentic user wallet balance
        if (corruptDocs.length > 0 || !hasSanitizedRef.current) {
          hasSanitizedRef.current = true;
          for (const badTx of corruptDocs) {
            try {
              await deleteDoc(doc(db, 'walletTransactions', badTx.id));
            } catch {
              // Handled by backend sanitation or admin rules
            }
          }

          if (genuineDocs.length === 0 && profile.uid) {
            try {
              const welcomeRef = doc(db, 'walletTransactions', `welcome_bonus_${profile.uid}`);
              const welcomeSnap = await getDoc(welcomeRef);
              if (!welcomeSnap.exists()) {
                await setDoc(welcomeRef, {
                  userId: profile.uid,
                  amount: 101,
                  type: 'credit',
                  reason: 'Zomindia ₹101 Welcome Reward',
                  status: 'completed',
                  createdAt: serverTimestamp()
                });
              }
            } catch {
              // Handled by backend /api/wallet/sanitize if already exists
            }
            return;
          }

          const verifiedBalance = Math.max(
            0,
            genuineDocs.reduce((acc, tx) => {
              if (tx.status && tx.status !== 'completed') return acc;
              const amt = Number(tx.amount) || 0;
              return tx.type === 'credit' ? acc + amt : acc - amt;
            }, 0)
          );

          const currentProfileBalance = Number(profile.walletBalance || 0);
          if (corruptDocs.length > 0 || currentProfileBalance !== verifiedBalance) {
            try {
              await updateDoc(doc(db, 'users', profile.uid), {
                walletBalance: verifiedBalance
              });
            } catch {
              // Handled by backend /api/wallet/sanitize
            }
          }
        }
      },
      (err) => {
        if (!isMounted) return;
        handleFirestoreError(err, OperationType.LIST, 'walletTransactions');
      }
    );

    return () => {
      isMounted = false;
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [profile.uid, profile.walletBalance]);

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

  const verifiedBalance = transactions.length > 0
    ? Math.max(
        0,
        transactions.reduce((acc, tx) => {
          if (tx.status && tx.status !== 'completed') return acc;
          const amt = Number(tx.amount) || 0;
          return tx.type === 'credit' ? acc + amt : acc - amt;
        }, 0)
      )
    : (profile.walletBalance ?? 101);

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
                <div className="text-4xl font-bold font-display tracking-tight">₹{verifiedBalance}</div>
              </div>
            </div>

            <div className="relative z-10 mt-6 pt-6 border-t border-white/10">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
                <span>★ ₹101 Indore Welcome Bonus</span>
              </div>
              <p className="text-xs text-white/70 mt-1">
                Your promotional balance is auto-applied at checkout. Manual deposits are disabled.
              </p>
            </div>
          </div>

          {/* Subscription Card */}
          <div className={`border rounded-[40px] p-8 text-center flex flex-col items-center shadow-lg relative overflow-hidden transition-all duration-500 ${
            profile.isPremium 
              ? "premium-gold-card" 
              : "bg-gradient-to-br from-indigo-900 to-purple-900 border-indigo-500"
          }`}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
            <h3 className={`text-xl font-black mb-2 italic tracking-tight ${profile.isPremium ? 'text-amber-950' : 'text-white'}`}>
              ZomIndia <span className={profile.isPremium ? 'text-amber-800' : 'text-indigo-300'}>PRIME</span>
            </h3>
            <p className={`text-sm mb-6 text-balance ${profile.isPremium ? 'text-amber-900/95 font-bold' : 'text-indigo-200'}`}>
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
              className={`font-bold px-8 py-3 rounded-2xl transition-colors w-full ${
                profile.isPremium 
                  ? 'bg-amber-950 text-amber-100 border border-amber-900 shadow-md cursor-default' 
                  : 'bg-white text-indigo-900 hover:bg-indigo-50 shadow-xl'
              }`}
            >
              {profile.isPremium ? '✓ Active Member' : 'Join Prime @ ₹999/yr'}
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
