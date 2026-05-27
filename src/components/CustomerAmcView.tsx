import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  Timestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AMC, UserProfile, Service, AMCStatus } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { motion, AnimatePresence } from 'motion/react';
import { LoadingScreen } from './LoadingIndicator';
import { 
  Zap, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  ChevronRight, 
  ShieldCheck, 
  Star, 
  ArrowRight,
  Plus,
  ArrowLeft,
  Briefcase
} from 'lucide-react';

interface CustomerAmcViewProps {
  profile: UserProfile;
  onBack?: () => void;
}

export default function CustomerAmcView({ profile, onBack }: CustomerAmcViewProps) {
  const [myAmcs, setMyAmcs] = useState<AMC[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingAmc, setBookingAmc] = useState<Service | null>(null);

  useEffect(() => {
    const unsubAmcs = onSnapshot(
      query(collection(db, 'amcs'), where('customerId', '==', profile.uid), orderBy('createdAt', 'desc')),
      (snap) => {
        setMyAmcs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AMC)));
      }
    );

    const unsubServices = onSnapshot(collection(db, 'services'), (snap) => {
      setServices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Service)));
    });

    setLoading(false);
    return () => {
      unsubAmcs();
      unsubServices();
    };
  }, [profile.uid]);

  const amcPlans = [
    { name: 'Silver Shield', price: 1999, frequency: 2, benefits: ['2 Preventive Maintenances', 'Priority Booking', '10% Discount on Spare Parts'] },
    { name: 'Gold Guard', price: 2999, frequency: 3, benefits: ['3 Preventive Maintenances', 'Free Gas Refill (Partial)', 'Priority Booking', '15% Discount on Spare Parts'] },
    { name: 'Platinum Plus', price: 4999, frequency: 4, benefits: ['4 Preventive Maintenances', 'Full Gas Refill Included', 'Unlimited On-Call Support', '20% Discount on Spare Parts', 'Free Consumables'] },
  ];

  const handlePurchaseAmc = async (plan: typeof amcPlans[0], service: Service) => {
    setLoading(true);
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1);

      // Generate scheduled dates
      const scheduledDates = [];
      const interval = Math.floor(12 / plan.frequency);
      for (let i = 1; i <= plan.frequency; i++) {
        const scheduledDate = new Date();
        scheduledDate.setMonth(scheduledDate.getMonth() + (i * interval));
        scheduledDates.push(Timestamp.fromDate(scheduledDate));
      }

      const newAmc: Omit<AMC, 'id'> = {
        customerId: profile.uid,
        serviceId: service.id,
        planName: plan.name,
        description: `Annual maintenance contract for ${service.name}`,
        frequency: plan.frequency,
        startDate: Timestamp.fromDate(startDate),
        endDate: Timestamp.fromDate(endDate),
        totalPrice: plan.price,
        status: 'active',
        leadSource: 'customer_direct',
        serviceBookingIds: [],
        scheduledDates,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      await addDoc(collection(db, 'amcs'), newAmc);
      setBookingAmc(null);
      alert('Congratulations! Your AMC is now active. You will receive a confirmation shortly.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'amcs');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingScreen message="Initializing premium AMC plans & coverage..." />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           {onBack && (
             <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-blue-700 transition-colors mb-4 group font-bold">
                <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                Back to Dashboard
             </button>
           )}
           <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none mb-4">
             Annual <span className="text-blue-700 underline decoration-blue-700/20 underline-offset-8">Maintenance</span> Contracts
           </h2>
           <p className="text-slate-500 font-medium tracking-wide">Secure your peace of mind with 365 days of priority care.</p>
        </div>
      </div>

      {/* Hero Stats / My AMCs */}
      {myAmcs.length > 0 && (
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/20 p-8">
           <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-slate-900">Your Active Contracts</h3>
              <div className="px-4 py-1.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                 {myAmcs.length} Active
              </div>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {myAmcs.map(amc => {
                const service = services.find(s => s.id === amc.serviceId);
                const endDate = amc.endDate?.toDate ? amc.endDate.toDate() : new Date(amc.endDate);
                return (
                  <div key={amc.id} className="p-6 bg-slate-50/50 rounded-3xl border border-transparent hover:border-blue-200 hover:bg-white hover:shadow-lg transition-all group">
                     <div className="flex justify-between items-start mb-6">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-700 shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
                           <Zap size={24} fill="currentColor" />
                        </div>
                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-widest">
                          {amc.status}
                        </span>
                     </div>
                     <h4 className="font-bold text-slate-900 text-lg mb-1">{amc.planName}</h4>
                     <p className="text-xs text-slate-500 font-medium mb-4">{service?.name || 'Home Maintenance'}</p>
                     
                     <div className="space-y-3 pt-4 border-t border-slate-100">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                           <span className="text-slate-400">Valid Until</span>
                           <span className="text-slate-900">{endDate.toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                           <span className="text-slate-400">Services Left</span>
                           <span className="text-blue-700">{amc.frequency - amc.serviceBookingIds.length} / {amc.frequency}</span>
                        </div>
                     </div>

                     {amc.serviceBookingIds.length > 0 && (
                       <div className="mt-4 pt-4 border-t border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Usage History</p>
                          <div className="space-y-2">
                            {amc.serviceBookingIds.map((bid, i) => (
                              <div key={bid} className="flex justify-between items-center text-[10px] font-bold">
                                <span className="text-slate-500">Service #{i+1}</span>
                                <span className="text-slate-900 font-mono">#{bid.slice(0, 6)}</span>
                              </div>
                            ))}
                          </div>
                       </div>
                     )}
                  </div>
                )
              })}
           </div>
        </div>
      )}

      {/* Available Plans Selector */}
      <div className="space-y-8">
        <div className="text-center max-w-2xl mx-auto">
           <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-6">
              <Star size={12} fill="currentColor" />
              Upgrade Your Home Care
           </div>
           <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-4">Select a Plan to Begin</h3>
           <p className="text-slate-500 font-medium leading-relaxed italic">
             Choose from our curated AMC plans designed to provide maximum value and zero stress for your household.
           </p>
        </div>

        {!bookingAmc ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
             {services.slice(0, 8).map(service => (
               <button 
                 key={service.id}
                 onClick={() => setBookingAmc(service)}
                 className="p-6 bg-white rounded-3xl border border-slate-100 hover:border-blue-700 hover:shadow-xl transition-all group text-left"
               >
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-4 group-hover:bg-blue-700 group-hover:text-white transition-all">
                     <Briefcase size={22} />
                  </div>
                  <h4 className="font-bold text-slate-900 mb-1 group-hover:text-blue-700 transition-colors uppercase tracking-tight">{service.name}</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">View Plans</p>
                  <div className="flex items-center text-blue-700 font-black text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                     Explore <ChevronRight size={14} />
                  </div>
               </button>
             ))}
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <button onClick={() => setBookingAmc(null)} className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-blue-700 transition-all">
                      <ArrowLeft size={20} />
                   </button>
                   <div>
                      <h4 className="text-xl font-bold text-slate-900">{bookingAmc.name}</h4>
                      <p className="text-xs text-slate-500 font-medium tracking-wide italic">Select your annual protection tier</p>
                   </div>
                </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {amcPlans.map((plan, idx) => (
                  <div 
                    key={plan.name} 
                    className={`relative p-8 rounded-[40px] border flex flex-col transition-all ${
                      idx === 1 ? 'bg-slate-900 text-white border-transparent shadow-2xl scale-105' : 'bg-white text-slate-900 border-slate-100'
                    }`}
                  >
                    {idx === 1 && (
                      <div className="absolute top-0 right-12 -translate-y-1/2 px-4 py-1.5 bg-blue-700 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl">
                        Popular Choice
                      </div>
                    )}
                    
                    <div className="mb-8">
                       <h5 className={`text-lg font-bold mb-2 ${idx === 1 ? 'text-blue-400' : 'text-blue-700'}`}>{plan.name}</h5>
                       <p className={`text-[10px] font-black uppercase tracking-widest ${idx === 1 ? 'text-white/40' : 'text-slate-400'}`}>Yearly Coverage</p>
                    </div>

                    <div className="mb-8">
                       <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-black tracking-tighter">₹{plan.price.toLocaleString()}</span>
                          <span className={`text-xs font-bold ${idx === 1 ? 'text-white/40' : 'text-slate-400'}`}>/ year</span>
                       </div>
                    </div>

                    <ul className="space-y-5 mb-10 flex-1">
                       {plan.benefits.map((benefit, bIdx) => (
                         <li key={bIdx} className="flex items-start gap-3">
                            <CheckCircle2 size={16} className={idx === 1 ? 'text-emerald-400 shrink-0' : 'text-blue-700 shrink-0'} />
                            <span className={`text-[11px] font-bold ${idx === 1 ? 'text-white/80' : 'text-slate-600'}`}>{benefit}</span>
                         </li>
                       ))}
                    </ul>

                    <button 
                      onClick={() => handlePurchaseAmc(plan, bookingAmc)}
                      className={`w-full py-5 rounded-[24px] font-black uppercase tracking-[0.2em] text-[10px] transition-all flex items-center justify-center gap-3 ${
                        idx === 1 ? 'bg-blue-700 text-white hover:bg-blue-600 shadow-xl shadow-blue-700/20' : 'bg-slate-900 text-white hover:bg-black'
                      }`}
                    >
                      <Zap size={14} fill="currentColor" />
                      Get Contract
                      <ArrowRight size={14} />
                    </button>
                  </div>
                ))}
             </div>
          </motion.div>
        )}
      </div>

      {/* Trust Badges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12">
         <div className="p-8 bg-blue-50/50 rounded-3xl border border-blue-100 flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-700 mb-4 shadow-sm">
               <ShieldCheck size={24} />
            </div>
            <h5 className="font-bold text-slate-900 mb-2">Authenticated Pros</h5>
            <p className="text-[11px] text-slate-500 font-medium">All AMC visits are handled by our top-rated, background-verified professionals.</p>
         </div>
         <div className="p-8 bg-emerald-50/50 rounded-3xl border border-emerald-100 flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-600 mb-4 shadow-sm">
               <Calendar size={24} />
            </div>
            <h5 className="font-bold text-slate-900 mb-2">Automated Planning</h5>
            <p className="text-[11px] text-slate-500 font-medium">Our system automatically reminds you and schedules your preventive maintenance visits.</p>
         </div>
         <div className="p-8 bg-amber-50/50 rounded-3xl border border-amber-100 flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-amber-600 mb-4 shadow-sm">
               <Clock size={24} />
            </div>
            <h5 className="font-bold text-slate-900 mb-2">Zero Response Delay</h5>
            <p className="text-[11px] text-slate-500 font-medium">AMC holders get VIP priority in booking queues, with emergency support within 4 hours.</p>
         </div>
      </div>
    </div>
  );
}
