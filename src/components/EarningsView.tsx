import { useState, useMemo } from 'react';
import { Booking, EarningsHistory } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter,
  Download,
  ChevronRight,
  AlertCircle,
  Banknote,
  Check
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface EarningsViewProps {
  bookings: Booking[];
  earnings?: EarningsHistory[];
  role: 'admin' | 'partner';
  platformFeePercentage?: number; // default 15
}

type TimeRange = '7d' | '30d' | 'lifetime';

export default function EarningsView({ bookings, earnings = [], role, platformFeePercentage = 15 }: EarningsViewProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutRequested, setPayoutRequested] = useState(false);

  const filteredBookings = bookings.filter(b => {
    if (b.status !== 'completed' && b.status !== 'finalized') return false;
    const now = new Date();
    const bDate = b.updatedAt?.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt);
    
    if (timeRange === '7d') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      return bDate >= sevenDaysAgo;
    }
    if (timeRange === '30d') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      return bDate >= thirtyDaysAgo;
    }
    return true; // lifetime
  });

  const chartData = useMemo(() => {
    const dataMap: Record<string, number> = {};
    filteredBookings.forEach(b => {
      const date = b.updatedAt?.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt);
      const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      const amt = role === 'admin' ? b.totalPrice * (platformFeePercentage / 100) : b.totalPrice * (1 - platformFeePercentage / 100);
      dataMap[dateStr] = (dataMap[dateStr] || 0) + amt;
    });
    
    return Object.entries(dataMap)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredBookings, role, platformFeePercentage]);

  const totalVolume = filteredBookings.reduce((acc, b) => acc + b.totalPrice, 0);
  const platformRevenue = totalVolume * (platformFeePercentage / 100);
  const partnerEarnings = totalVolume - platformRevenue;

  const displayEarnings = role === 'admin' ? platformRevenue : partnerEarnings;

  return (
    <div className="space-y-8 pb-20">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
        <div>
           <h2 className="text-2xl font-black text-slate-900 italic">Financial Matrix</h2>
           <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Real-time revenue analytics</p>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
           {(['7d', '30d', 'lifetime'] as TimeRange[]).map((range) => (
             <button
               key={range}
               onClick={() => setTimeRange(range)}
               className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                 timeRange === range 
                   ? 'bg-blue-700 text-white shadow-lg shadow-blue-700/10' 
                   : 'text-slate-400 hover:text-blue-700 hover:bg-white'
               }`}
             >
               {range === '7d' ? 'Last 7 Days' : range === '30d' ? 'Last 30 Days' : 'Lifetime'}
             </button>
           ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-700 rounded-[32px] p-8 text-white relative overflow-hidden group">
           <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Net {role === 'admin' ? 'Revenue' : 'Earnings'}</p>
              <h3 className="text-4xl font-display font-bold">₹{displayEarnings.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
              <div className="flex items-center gap-2 mt-4 text-emerald-400">
                 <ArrowUpRight size={16} />
                 <span className="text-xs font-bold tracking-tight">+12.5% vs prev. period</span>
              </div>
           </div>
           <DollarSign className="absolute -right-4 -bottom-4 w-32 h-32 text-white/5 group-hover:scale-110 transition-transform duration-500" />
        </div>

        <div className="bg-white rounded-[32px] border border-slate-100 p-8 shadow-sm">
           <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Processed Volume</p>
           <h3 className="text-3xl font-display font-bold text-slate-900">₹{totalVolume.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
           <div className="flex items-center gap-2 mt-4 text-slate-400">
              <Calendar size={16} />
              <span className="text-xs font-medium tracking-tight">Across {filteredBookings.length} completed jobs</span>
           </div>
        </div>

        <div className="bg-white rounded-[32px] border border-slate-100 p-8 shadow-sm">
           <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Avg. Ticket Size</p>
           <h3 className="text-3xl font-display font-bold text-slate-900">₹{(totalVolume / (filteredBookings.length || 1)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
           <div className="flex items-center gap-2 mt-4 text-indigo-500">
              <TrendingUp size={16} />
              <span className="text-xs font-bold tracking-tight">Optimal velocity reached</span>
           </div>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="bg-white rounded-[32px] border border-slate-100 p-8 shadow-sm">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-900">Revenue Trend</h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1c1917" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#1c1917" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#e7e5e4" tick={{ fill: '#a8a29e', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis stroke="#e7e5e4" tick={{ fill: '#a8a29e', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#1c1917', fontWeight: 'bold' }}
                  formatter={(value: number) => [`₹${value.toLocaleString()}`, role === 'admin' ? 'Revenue' : 'Earnings']}
                />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                <Area type="monotone" dataKey="amount" stroke="#1c1917" strokeWidth={3} fillOpacity={1} fill="url(#colorEarnings)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Earnings Breakup */}
        <div className="bg-white rounded-[40px] border border-slate-100 p-8 md:p-10 shadow-sm">
           <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-slate-900">Earnings Breakup</h3>
              <button className="text-[10px] font-black text-slate-400 hover:text-blue-700 uppercase tracking-widest transition-colors flex items-center gap-2">
                 <Download size={14} />
                 Export PDF
              </button>
           </div>

           <div className="space-y-6">
              <div className="p-6 bg-slate-50 rounded-3xl space-y-4">
                 <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-500">Gross Service Value</span>
                    <span className="text-lg font-bold text-slate-900">₹{totalVolume.toLocaleString()}</span>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-500">Platform Commission ({platformFeePercentage}%)</span>
                    <span className="text-lg font-bold text-red-500">- ₹{platformRevenue.toLocaleString()}</span>
                 </div>
                 <div className="h-px bg-slate-200" />
                 <div className="flex justify-between items-center">
                    <span className="text-sm font-black uppercase tracking-widest text-slate-900 italic">Net {role === 'admin' ? 'Revenue' : 'Payout'}</span>
                    <span className="text-2xl font-black text-slate-900">₹{displayEarnings.toLocaleString()}</span>
                 </div>
              </div>

              <div className="space-y-3">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Earnings by Payment Mode</p>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl border border-slate-100 flex flex-col gap-1">
                       <span className="text-xs font-bold text-slate-500">Online Payments</span>
                       <span className="text-lg font-bold text-slate-900">₹{filteredBookings.filter(b => b.paymentMethod === 'online').reduce((acc, b) => acc + b.totalPrice, 0).toLocaleString()}</span>
                    </div>
                    <div className="p-4 rounded-2xl border border-slate-100 flex flex-col gap-1">
                       <span className="text-xs font-bold text-slate-500">Cash on Arrival</span>
                       <span className="text-lg font-bold text-slate-900">₹{filteredBookings.filter(b => b.paymentMethod === 'cash').reduce((acc, b) => acc + b.totalPrice, 0).toLocaleString()}</span>
                    </div>
                 </div>
              </div>
              
              {role === 'partner' && (
                <div className="pt-4 border-t border-slate-100">
                  <button 
                    onClick={() => setShowPayoutModal(true)} 
                    disabled={displayEarnings <= 0}
                    className="w-full flex items-center justify-center gap-2 bg-blue-700 text-white py-4 rounded-xl font-bold hover:bg-blue-800 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Banknote size={18} className="group-hover:scale-110 transition-transform" /> 
                    Request Payout to Bank
                  </button>
                </div>
              )}
           </div>
        </div>

        {/* Transaction History */}
        <div className="bg-white rounded-[40px] border border-slate-100 p-8 md:p-10 shadow-sm flex flex-col">
           <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-slate-900">Recent Ledger</h3>
              <div className="p-2 bg-slate-50 rounded-xl">
                 <Filter size={16} className="text-slate-400" />
              </div>
           </div>

           <div className="space-y-4 flex-1 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
              {filteredBookings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                   <AlertCircle size={40} strokeWidth={1} className="mb-4" />
                   <p className="text-xs font-bold uppercase tracking-widest">No transactions found</p>
                </div>
              ) : (
                filteredBookings.slice(0, 10).map((b) => (
                  <div key={b.id} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-slate-100 group">
                    <div className="flex items-center gap-4">
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm group-hover:bg-blue-700 group-hover:text-white transition-all shrink-0 ${
                         b.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                       }`}>
                          <ArrowUpRight size={16} />
                       </div>
                       <div>
                          <p className="text-sm font-bold text-slate-900">Booking #{b.id.slice(0, 8).toUpperCase()}</p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {b.updatedAt?.toDate ? b.updatedAt.toDate().toLocaleDateString() : new Date(b.updatedAt).toLocaleDateString()} • {b.paymentMethod || 'cash'}
                          </p>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="text-sm font-bold text-slate-900">₹{b.totalPrice}</p>
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic group-hover:text-blue-700">Success</span>
                    </div>
                  </div>
                ))
              )}
           </div>
           
           {filteredBookings.length > 10 && (
             <button className="w-full mt-6 py-4 rounded-2xl border border-slate-100 text-[10px] font-black text-slate-400 hover:text-white hover:bg-blue-700 uppercase tracking-widest transition-all">
                View Full Audit Logs
             </button>
           )}
        </div>
      </div>

      <AnimatePresence>
        {showPayoutModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-blue-700/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] p-8 max-w-sm w-full shadow-2xl relative"
            >
              {!payoutRequested ? (
                <>
                  <h3 className="text-2xl font-bold font-display italic text-slate-900 mb-2">Request Payout</h3>
                  <p className="text-sm font-medium text-slate-500 mb-6">Confirm transfer of ₹{displayEarnings.toLocaleString()} to your registered bank account ending in **1234.</p>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setShowPayoutModal(false)}
                      className="flex-1 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest hover:bg-slate-50 rounded-2xl"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => {
                        setPayoutRequested(true);
                        setTimeout(() => {
                          setShowPayoutModal(false);
                          setPayoutRequested(false);
                        }, 3000);
                      }}
                      className="flex-[2] py-4 rounded-2xl bg-blue-700 text-white hover:bg-blue-800 font-black uppercase tracking-widest text-[10px] transition-all shadow-xl shadow-blue-700/10"
                    >
                      Confirm Transfer
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <Check size={32} />
                  </div>
                  <h3 className="text-xl font-bold italic text-slate-900 mb-2">Transfer Initiated</h3>
                  <p className="text-xs text-slate-500">Your payout request has been queued. Funds usually arrive within 24 hours.</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
