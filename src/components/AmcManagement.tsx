import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc, 
  doc, 
  Timestamp, 
  getDocs,
  where
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AMC, UserProfile, Service, AMCStatus } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  Plus, 
  Search, 
  Filter, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  Briefcase,
  Phone,
  Mail,
  Zap,
  MoreVertical,
  X,
  CreditCard,
  History,
  MessageSquare
} from 'lucide-react';

interface AmcManagementProps {
  amcs: AMC[];
  users: UserProfile[];
  services: Service[];
  onUpdateStatus: (amcId: string, status: AMCStatus) => void;
}

export default function AmcManagement({ amcs, users, services, onUpdateStatus }: AmcManagementProps) {
  const [activeFilter, setActiveFilter] = useState<AMCStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedAmc, setSelectedAmc] = useState<AMC | null>(null);

  // New AMC Form State
  const [formData, setFormData] = useState({
    customerId: '',
    serviceId: '',
    planName: 'Platinum Plus',
    frequency: 4,
    totalPrice: 4999,
    leadSource: 'admin_manual' as AMC['leadSource'],
    notes: '',
    duration: 12, // months
  });

  const filteredAmcs = amcs.filter(amc => {
    const matchesFilter = activeFilter === 'all' || amc.status === activeFilter;
    const customer = users.find(u => u.uid === amc.customerId);
    const service = services.find(s => s.id === amc.serviceId);
    const matchesSearch = 
      amc.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer?.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleCreateAmc = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + formData.duration);

      // Generate scheduled dates based on frequency
      const scheduledDates = [];
      const interval = Math.floor(formData.duration / formData.frequency);
      for (let i = 1; i <= formData.frequency; i++) {
        const scheduledDate = new Date();
        scheduledDate.setMonth(scheduledDate.getMonth() + (i * interval));
        scheduledDates.push(Timestamp.fromDate(scheduledDate));
      }

      const newAmc: Omit<AMC, 'id'> = {
        customerId: formData.customerId,
        serviceId: formData.serviceId,
        planName: formData.planName,
        description: `Annual maintenance contract for ${services.find(s => s.id === formData.serviceId)?.name || 'Service'}`,
        frequency: formData.frequency,
        startDate: Timestamp.fromDate(startDate),
        endDate: Timestamp.fromDate(endDate),
        totalPrice: formData.totalPrice,
        status: 'active',
        leadSource: formData.leadSource,
        serviceBookingIds: [],
        scheduledDates,
        notes: formData.notes,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      await addDoc(collection(db, 'amcs'), newAmc);
      setShowCreateModal(false);
      // Reset form
      setFormData({
        customerId: '',
        serviceId: '',
        planName: 'Platinum Plus',
        frequency: 4,
        totalPrice: 4999,
        leadSource: 'admin_manual',
        notes: '',
        duration: 12
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'amcs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Stats */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">AMC Lifecycle Management</h2>
          <p className="text-slate-500 font-medium tracking-wide italic">Monitor contracts, process leads and manage renewals</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3.5 bg-blue-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-800 transition-all shadow-xl shadow-blue-700/20 flex items-center gap-2"
          >
            <Plus size={18} />
            Create Manual AMC
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
            <div className="w-10 h-10 bg-blue-50 text-blue-700 rounded-xl flex items-center justify-center mb-4">
               <Zap size={20} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Contracts</p>
            <p className="text-2xl font-bold text-slate-900">{amcs.filter(a => a.status === 'active').length}</p>
         </div>
         <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-4">
               <Clock size={20} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Expiring Soon</p>
            <p className="text-2xl font-bold text-slate-900">0</p>
         </div>
         <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
               <CheckCircle2 size={20} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Partner Leads</p>
            <p className="text-2xl font-bold text-slate-900">{amcs.filter(a => a.leadSource === 'partner_lead').length}</p>
         </div>
         <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
            <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mb-4">
               <History size={20} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Renewals Req.</p>
            <p className="text-2xl font-bold text-slate-900">{amcs.filter(a => a.status === 'pending_renewal').length}</p>
         </div>
      </div>

      {/* Main List */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/20 overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6 overflow-x-auto pb-2 md:pb-0">
             {['all', 'active', 'pending_renewal', 'expired', 'cancelled'].map((f) => (
                <button 
                  key={f}
                  onClick={() => setActiveFilter(f as any)}
                  className={`text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                    activeFilter === f ? 'text-blue-700' : 'text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {f.replace('_', ' ')}
                </button>
             ))}
          </div>
          <div className="relative" onTouchStartCapture={(e) => e.stopPropagation()} onMouseDownCapture={(e) => e.stopPropagation()}>
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
             <input 
               type="text" 
               inputMode="text"
               enterKeyHint="search"
               placeholder="Search by ID or Name..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="pl-12 pr-6 py-3 bg-slate-50 rounded-2xl text-sm font-medium border-none focus:ring-2 focus:ring-blue-700 transition-all w-full md:w-64"
             />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Customer & Plan</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Service Coverage</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Timeline</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Volume</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Source</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredAmcs.map((amc) => {
                const customer = users.find(u => u.uid === amc.customerId);
                const service = services.find(s => s.id === amc.serviceId);
                const startDate = amc.startDate?.toDate ? amc.startDate.toDate() : new Date(amc.startDate);
                const endDate = amc.endDate?.toDate ? amc.endDate.toDate() : new Date(amc.endDate);

                return (
                  <tr key={amc.id} className="group hover:bg-slate-50/50 transition-all">
                    <td className="px-8 py-6">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 overflow-hidden shrink-0">
                             {customer?.photoURL ? <img src={customer.photoURL} alt="" /> : <User size={20} />}
                          </div>
                          <div>
                             <p className="text-sm font-bold text-slate-900 leading-none mb-1">{customer?.displayName || 'Unknown Customer'}</p>
                             <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">{amc.planName}</p>
                          </div>
                       </div>
                    </td>
                    <td className="px-8 py-6">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-50 text-blue-700 rounded-lg flex items-center justify-center shrink-0">
                             <Briefcase size={14} />
                          </div>
                          <p className="text-sm font-medium text-slate-600">{service?.name || 'N/A'}</p>
                       </div>
                    </td>
                    <td className="px-8 py-6">
                       <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                             <Clock size={12} className="text-slate-400" />
                             <span className="text-[11px] font-bold text-slate-900">{startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}</span>
                          </div>
                          <div className="w-24 h-1 bg-slate-100 rounded-full overflow-hidden">
                             <div 
                               className="h-full bg-blue-700 rounded-full" 
                               style={{ width: `${Math.min(100, (Date.now() - startDate.getTime()) / (endDate.getTime() - startDate.getTime()) * 100)}%` }}
                             />
                          </div>
                       </div>
                    </td>
                    <td className="px-8 py-6">
                       <p className="text-sm font-bold text-slate-900">₹{amc.totalPrice.toLocaleString()}</p>
                       <p className="text-[10px] text-slate-400 font-medium italic">{amc.serviceBookingIds.length} / {amc.frequency} Services</p>
                    </td>
                    <td className="px-8 py-6">
                       <div className="relative group/status inline-block">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            amc.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 
                            amc.status === 'pending_renewal' ? 'bg-amber-100 text-amber-600' :
                            amc.status === 'expired' ? 'bg-rose-100 text-rose-600' :
                            amc.status === 'cancelled' ? 'bg-slate-200 text-slate-600' :
                            'bg-slate-100 text-slate-500'
                          }`}>
                            {amc.status.replace('_', ' ')}
                          </span>
                       </div>
                    </td>
                    <td className="px-8 py-6">
                       <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg ${
                            amc.leadSource === 'partner_lead' ? 'bg-indigo-50 text-indigo-600' :
                            amc.leadSource === 'admin_manual' ? 'bg-slate-50 text-slate-600' :
                            'bg-blue-50 text-blue-700'
                          }`}>
                            {amc.leadSource === 'partner_lead' ? <Zap size={14} /> : 
                             amc.leadSource === 'admin_manual' ? <Phone size={14} /> : 
                             <User size={14} />}
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{amc.leadSource.split('_').pop()}</span>
                       </div>
                    </td>
                    <td className="px-8 py-6">
                       <div className="flex items-center gap-2">
                          {amc.status === 'active' && (
                            <button 
                              onClick={() => {
                                if (window.confirm("Cancel this AMC? Information regarding refunds must be handled manually.")) {
                                  onUpdateStatus(amc.id, 'cancelled');
                                }
                              }}
                              className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                              title="Cancel AMC"
                            >
                              <X size={16} />
                            </button>
                          )}
                          {amc.status === 'pending_renewal' && (
                            <button 
                              onClick={() => onUpdateStatus(amc.id, 'active')}
                              className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
                              title="Set Active (Renewed)"
                            >
                              <CheckCircle2 size={16} />
                            </button>
                          )}
                          <button 
                            onClick={() => setSelectedAmc(amc)}
                            className="p-2 text-slate-400 hover:text-blue-700 transition-colors"
                            title="View History"
                          >
                            <History size={16} />
                          </button>
                       </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredAmcs.length === 0 && (
            <div className="p-20 text-center">
               <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300 mx-auto mb-4">
                  <Calendar size={32} />
               </div>
               <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No AMC Records Found</p>
            </div>
          )}
        </div>
      </div>

      {/* Create AMC Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Create New AMC Contract</h3>
                  <p className="text-xs text-slate-500 font-medium tracking-wide">Enter details for manual lead generation</p>
                </div>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateAmc} className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Customer Selection */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Select Customer</label>
                    <select 
                      required
                      value={formData.customerId}
                      onChange={(e) => setFormData(prev => ({ ...prev, customerId: e.target.value }))}
                      className="w-full h-14 bg-slate-50 border-none rounded-2xl px-6 font-bold text-slate-900 focus:ring-2 focus:ring-blue-700 transition-all appearance-none"
                    >
                      <option value="">Choose a user...</option>
                      {users.filter(u => u.role === 'customer').map(u => (
                        <option key={u.uid} value={u.uid}>{u.displayName} ({u.email})</option>
                      ))}
                    </select>
                  </div>

                  {/* Service Selection */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Select Service</label>
                    <select 
                      required
                      value={formData.serviceId}
                      onChange={(e) => setFormData(prev => ({ ...prev, serviceId: e.target.value }))}
                      className="w-full h-14 bg-slate-50 border-none rounded-2xl px-6 font-bold text-slate-900 focus:ring-2 focus:ring-blue-700 transition-all appearance-none"
                    >
                      <option value="">Choose a service...</option>
                      {services.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Lead Source */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Lead Source</label>
                    <div className="grid grid-cols-2 gap-3">
                       {[
                         { id: 'admin_manual', label: 'Phone Call', icon: Phone },
                         { id: 'admin_email', label: 'Email Lead', icon: Mail },
                         { id: 'admin_whatsapp', label: 'WhatsApp', icon: MessageSquare },
                         { id: 'partner_lead', label: 'Partner lead', icon: Zap }
                       ].map((source: any) => (
                         <button
                           key={source.id}
                           type="button"
                           onClick={() => setFormData(prev => ({ ...prev, leadSource: source.id }))}
                           className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                             formData.leadSource === source.id ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'
                           }`}
                         >
                           <source.icon size={18} />
                           <span className="text-[10px] font-black uppercase tracking-widest text-left">{source.label}</span>
                         </button>
                       ))}
                    </div>
                  </div>

                  {/* Pricing & Frequency */}
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Plan Pricing (₹)</label>
                      <input 
                        required
                        type="number"
                        value={formData.totalPrice}
                        onChange={(e) => setFormData(prev => ({ ...prev, totalPrice: parseInt(e.target.value) }))}
                        className="w-full h-14 bg-slate-50 border-none rounded-2xl px-6 font-bold text-slate-900 focus:ring-2 focus:ring-blue-700 transition-all shadow-inner"
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Services Per Year</label>
                      <div className="flex items-center gap-2">
                         {[2, 3, 4, 6, 12].map(val => (
                           <button 
                             key={val}
                             type="button"
                             onClick={() => setFormData(prev => ({ ...prev, frequency: val }))}
                             className={`w-12 h-12 rounded-xl font-bold transition-all ${
                               formData.frequency === val ? 'bg-blue-700 text-white shadow-lg shadow-blue-700/20' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                             }`}
                           >
                             {val}
                           </button>
                         ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Internal Admin Notes</label>
                  <textarea 
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Reference for phone call or lead source details..."
                    className="w-full h-32 bg-slate-50 border-none rounded-[24px] p-6 font-medium text-slate-600 focus:ring-2 focus:ring-blue-700 transition-all resize-none shadow-inner"
                  />
                </div>

                <button 
                  disabled={loading}
                  type="submit"
                  className="w-full py-5 bg-blue-700 text-white rounded-[24px] font-black uppercase tracking-[0.2em] text-xs hover:bg-blue-800 transition-all shadow-2xl shadow-blue-700/30 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {loading ? 'Activating Contract...' : (
                    <>
                      <CheckCircle2 size={18} />
                      Generate Official Contract
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* AMC Info Modal */}
      <AnimatePresence>
        {selectedAmc && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-lg bg-white rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-50 flex justify-between items-center text-slate-900 font-bold">
                 <h3>AMC Details & History</h3>
                 <button onClick={() => setSelectedAmc(null)} className="p-2 bg-slate-50 rounded-xl"><X size={18}/></button>
              </div>
              <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                 <div className="bg-slate-50 p-6 rounded-3xl border border-dashed border-slate-200">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Internal ID</p>
                    <p className="font-mono text-xs text-blue-700 font-bold">{selectedAmc.id}</p>
                 </div>

                 <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Service Booking History</h4>
                    <div className="space-y-3">
                       {selectedAmc.serviceBookingIds.length > 0 ? selectedAmc.serviceBookingIds.map((bid, i) => (
                         <div key={bid} className="flex justify-between items-center p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                            <div className="flex items-center gap-3">
                               <div className="w-8 h-8 bg-blue-50 text-blue-700 rounded-lg flex items-center justify-center font-bold text-[10px]">{i+1}</div>
                               <span className="text-xs font-bold text-slate-900 leading-none">Booking #{bid.slice(0, 8).toUpperCase()}</span>
                            </div>
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Used</span>
                         </div>
                       )) : (
                         <div className="p-6 text-center bg-slate-50 rounded-3xl text-xs text-slate-400 italic">No services used yet under this contract.</div>
                       )}
                    </div>
                 </div>

                 <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Scheduled Maintenance Windows</h4>
                    <div className="grid grid-cols-2 gap-3">
                        {selectedAmc.scheduledDates.map((d: any, i) => (
                          <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
                             <Calendar size={14} className="text-slate-400" />
                             <span className="text-xs font-bold text-slate-900">{d.toDate ? d.toDate().toLocaleDateString() : new Date(d).toLocaleDateString()}</span>
                          </div>
                        ))}
                    </div>
                 </div>

                 {selectedAmc.notes && (
                   <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Admin Notes</h4>
                      <p className="text-sm text-slate-600 leading-relaxed italic bg-amber-50/50 p-4 rounded-2xl border border-amber-100">{selectedAmc.notes}</p>
                   </div>
                 )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
