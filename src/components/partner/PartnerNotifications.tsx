import { NotificationType } from '../../lib/notifications';
import { motion } from 'motion/react';
import { Bell, Clock, Briefcase, Wallet, Star, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { useState, useEffect } from 'react';
import { UserProfile } from '../../types';

interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  bookingId?: string;
  read: boolean;
  createdAt: any;
}

interface Props {
  profile: UserProfile;
  onNavigate: (screen: 'home' | 'jobs' | 'wallet' | 'settings' | 'notifications') => void;
}

export default function PartnerNotifications({ profile, onNavigate }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', profile.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    return onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
      setLoading(false);
    });
  }, [profile.uid]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'new_booking': return <Briefcase className="text-slate-900" />;
      case 'payment_received': return <Wallet className="text-emerald-500" />;
      case 'booking_cancelled': return <ShieldAlert className="text-rose-500" />;
      case 'promotional': return <Star className="text-amber-500" />;
      default: return <Bell className="text-slate-400" />;
    }
  };

  return (
    <div className="p-6 space-y-8 pb-32">
       <section>
          <h2 className="text-2xl font-black italic text-slate-900 leading-tight">Live Alerts</h2>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Real-time system updates</p>
       </section>

       <section className="space-y-4">
          {loading ? (
            <div className="p-12 text-center text-slate-400 font-black uppercase tracking-widest text-[10px]">Synchronizing...</div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center bg-white border border-dashed border-slate-200 rounded-[40px]">
               <p className="text-sm font-black italic text-slate-300">All quiet for now.</p>
            </div>
          ) : (
            notifications.map((n, i) => (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                key={n.id} 
                onClick={() => n.bookingId && onNavigate('jobs')}
                className={`bg-white p-6 rounded-[32px] border border-slate-50 flex gap-6 group transition-all cursor-pointer ${!n.read ? 'ring-2 ring-blue-700/5 bg-slate-50/30' : ''}`}
              >
                 <div className="w-12 h-12 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center shrink-0">
                    {getIcon(n.type)}
                 </div>
                 <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                       <h4 className={`text-sm font-bold text-slate-900 italic leading-tight truncate ${!n.read ? 'font-black' : ''}`}>{n.title}</h4>
                       <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest pl-2">
                          {n.createdAt?.toDate?.()?.toLocaleDateString([], { month: 'numeric', day: 'numeric' }) || 'Today'}
                       </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-medium line-clamp-2">{n.message}</p>
                 </div>
              </motion.div>
            ))
          )}
       </section>
    </div>
  );
}
