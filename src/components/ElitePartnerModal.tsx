import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { X, CheckCircle, Smartphone, User, Briefcase, MapPin, Send, Check } from 'lucide-react';
import { COMPANY_NAME } from '../types';

interface ElitePartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFullName?: string;
  initialPhone?: string;
}

const SERVICE_TYPES = [
  'AC Repair & Service',
  'RO Water Purifier Service',
  'Home Cleaning Services',
  'Washing Machine Repair',
  'Refrigerator Service',
  'Geyser Repair & Installation',
  'Electrician Services',
  'Plumbing Services',
  'House Painting',
  'Other Home Appliances'
];

const INDORE_AREAS = [
  'Vijay Nagar',
  'Bhawarkuan',
  'Palasia',
  'Rajendra Nagar',
  'Bengali Square',
  'Annapurna Road',
  'Sudama Nagar',
  'LIG Colony',
  'Chapan Dukan Area',
  'Khajrana',
  'Ranjeet Hanuman',
  'Kanadia Road',
  'Other Area (Indore)'
];

export default function ElitePartnerModal({
  isOpen,
  onClose,
  initialFullName = '',
  initialPhone = ''
}: ElitePartnerModalProps) {
  const [fullName, setFullName] = useState(initialFullName);
  const [phone, setPhone] = useState(initialPhone);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [area, setArea] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggleSkill = (skill: string) => {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter(s => s !== skill));
    } else {
      setSelectedSkills([...selectedSkills, skill]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name');
      return;
    }
    if (!phone.trim()) {
      setErrorMsg('Please enter your phone number');
      return;
    }
    if (selectedSkills.length === 0) {
      setErrorMsg('Please select at least one service specialization');
      return;
    }
    if (!area) {
      setErrorMsg('Please select your preferred area in Indore');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const applicationData = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        serviceType: selectedSkills.join(', '), // Satisfies firestore.rules requiring a string
        skills: selectedSkills,                // Stores array safely
        area,
        createdAt: Timestamp.now()
      };

      await addDoc(collection(db, 'partner_applications'), applicationData);
      setIsSuccess(true);
    } catch (err) {
      console.error('Error saving partner application:', err);
      try {
        handleFirestoreError(err, OperationType.WRITE, 'partner_applications');
      } catch (formattedErr: any) {
        setErrorMsg('Failed to submit application. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setFullName(initialFullName);
    setPhone(initialPhone);
    setSelectedSkills([]);
    setArea('');
    setIsSuccess(false);
    setErrorMsg(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleResetAndClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            id="partner-modal-backdrop"
          />

          {/* Modal Container with Glowing colorful glassmorphism */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-lg bg-gradient-to-br from-[#0a2540] via-[#10355a] to-[#1e1b4b] rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.25)] border border-white/10 z-10 max-h-[90vh] flex flex-col bottom-0 sm:bottom-auto text-white"
            id="partner-modal-content"
          >
            {/* Header */}
            <div className="p-6 relative shrink-0 border-b border-white/5">
              <button
                onClick={handleResetAndClose}
                className="absolute top-5 right-5 text-white/75 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-all active:scale-95 cursor-pointer border border-white/5"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
              <span className="text-[10px] tracking-widest font-extrabold text-emerald-400 uppercase block mb-1 font-mono">
                {COMPANY_NAME}
              </span>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight font-sans text-white">
                Elite Service Partner
              </h3>
              <p className="text-slate-300 text-xs mt-1.5 font-medium leading-relaxed">
                Join our premium ecosystem & earn a consistent income with India's most trusted home services platform.
              </p>
            </div>

            {/* Content Area */}
            <div className="p-6 overflow-y-auto flex-1 select-none">
              <AnimatePresence mode="wait">
                {!isSuccess ? (
                  <motion.form
                    key="partner-form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onSubmit={handleSubmit}
                    className="space-y-6"
                    id="partner-application-form"
                  >
                    {errorMsg && (
                      <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs font-semibold flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                        <span>{errorMsg}</span>
                      </div>
                    )}

                    {/* Full Name */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <User size={13} className="text-slate-400" />
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Enter your full name"
                        disabled={isSubmitting}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-400 focus:border-emerald-500 focus:bg-white/10 focus:ring-1 focus:ring-emerald-500 text-sm font-semibold outline-none transition-all"
                        id="partner-input-fullname"
                      />
                    </div>

                    {/* Phone Number */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Smartphone size={13} className="text-slate-400" />
                        Phone Number
                      </label>
                      <input
                        type="number"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Enter your 10-digit mobile number"
                        disabled={isSubmitting}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-400 focus:border-emerald-500 focus:bg-white/10 focus:ring-1 focus:ring-emerald-500 text-sm font-semibold outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        id="partner-input-phone"
                      />
                    </div>

                    {/* Service Type (Multi-select Grid) */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Briefcase size={13} className="text-slate-400" />
                        Skills / Services (Select multiple)
                      </label>
                      <div className="grid grid-cols-2 gap-2 mt-2" id="partner-skills-grid">
                        {SERVICE_TYPES.map((type) => {
                          const isSelected = selectedSkills.includes(type);
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => toggleSkill(type)}
                              disabled={isSubmitting}
                              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all duration-200 cursor-pointer text-xs font-bold border ${
                                isSelected
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-emerald-400 shadow-md shadow-emerald-950/20'
                                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                                isSelected ? 'bg-white/20 border-white/40' : 'bg-transparent border-slate-500'
                              }`}>
                                {isSelected && <Check size={10} className="text-white" />}
                              </div>
                              <span className="truncate">{type}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Area in Indore */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <MapPin size={13} className="text-slate-400" />
                        Area in Indore
                      </label>
                      <div className="relative">
                        <select
                          value={area}
                          onChange={(e) => setArea(e.target.value)}
                          disabled={isSubmitting}
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-emerald-500 focus:bg-[#10355a] focus:ring-1 focus:ring-emerald-500 text-sm font-semibold outline-none transition-all cursor-pointer appearance-none"
                          id="partner-select-area"
                        >
                          <option value="" disabled className="bg-[#10355a] text-slate-400">Select your preferred work area</option>
                          {INDORE_AREAS.map((indoreArea) => (
                            <option key={indoreArea} value={indoreArea} className="bg-[#10355a] text-white font-semibold">
                              {indoreArea}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-300">
                          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full mt-2 bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-2xl text-sm font-black flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-950/20 border border-emerald-400/20"
                      id="partner-submit-button"
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Registering...</span>
                        </>
                      ) : (
                        <>
                          <Send size={15} />
                          <span>Submit Partner Application</span>
                        </>
                      )}
                    </button>
                  </motion.form>
                ) : (
                  <motion.div
                    key="partner-success"
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="py-12 px-4 text-center flex flex-col items-center"
                    id="partner-success-view"
                  >
                    {/* High-end animated checkmark transition with a glowing halo */}
                    <div className="relative mb-6">
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: [1, 1.1, 1], opacity: 1 }}
                        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                        className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl"
                      />
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", damping: 15, stiffness: 200 }}
                        className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center relative z-10 shadow-lg shadow-emerald-500/30"
                      >
                        <Check size={40} className="stroke-[3px]" />
                      </motion.div>
                    </div>

                    {/* Premium particle confetti effect inside container */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                      {[...Array(12)].map((_, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 100, x: 0 }}
                          animate={{ 
                            opacity: [0, 1, 1, 0],
                            y: [100, -200],
                            x: [0, (i % 2 === 0 ? 1 : -1) * (30 + i * 15)]
                          }}
                          transition={{ 
                            duration: 1.5 + Math.random(),
                            delay: Math.random() * 0.5,
                            repeat: Infinity,
                            repeatDelay: 1
                          }}
                          className={`absolute bottom-10 w-2 h-2 rounded-full ${
                            i % 3 === 0 ? 'bg-emerald-400' : i % 3 === 1 ? 'bg-teal-400' : 'bg-yellow-400'
                          }`}
                        />
                      ))}
                    </div>

                    <h4 className="text-2xl font-black text-white tracking-tight">
                      Application Received!
                    </h4>
                    <p className="text-slate-300 text-sm font-semibold leading-relaxed mt-4 max-w-sm">
                      Our onboarding team will call you within 24 hours. Welcome to the elite Zomindia network!
                    </p>
                    <button
                      onClick={handleResetAndClose}
                      className="mt-8 bg-white/10 hover:bg-white/20 text-white border border-white/10 px-8 py-3.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-md"
                      id="partner-success-close-button"
                    >
                      Done
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
