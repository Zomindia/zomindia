import React, { useState, useEffect, useRef } from 'react';
import { Upload, RotateCcw, Image as ImageIcon, Sparkles, AlertCircle, Check, Trash2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface ManageBrandViewProps {
  onNotify?: (message: string) => void;
}

export default function ManageBrandView({ onNotify }: ManageBrandViewProps) {
  const [currentLogo, setCurrentLogo] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const defaultLogoUrl = "https://ik.imagekit.io/zomindia/zomindia%20logo%20H.png?updatedAt=1781064945841";

  const [walletJoiningBonus, setWalletJoiningBonus] = useState<number>(100);
  const [savingSettings, setSavingSettings] = useState(false);

  const loadLogo = () => {
    try {
      const stored = localStorage.getItem('custom_zomindia_brand_logo');
      setCurrentLogo(stored);
    } catch (e) {
      console.error("Failed to read brand logo from storage:", e);
    }
  };

  useEffect(() => {
    loadLogo();
    window.addEventListener('storage', loadLogo);
    return () => {
      window.removeEventListener('storage', loadLogo);
    };
  }, []);

  useEffect(() => {
    const fetchGlobalSettings = async () => {
      try {
        const docRef = doc(db, 'system_config', 'global');
        const snap = await getDoc(docRef);
        if (snap.exists() && snap.data().walletJoiningBonus !== undefined) {
          setWalletJoiningBonus(snap.data().walletJoiningBonus);
        }
      } catch (err) {
        console.error("Error loading welcome bonus setting:", err);
      }
    };
    fetchGlobalSettings();
  }, []);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const docRef = doc(db, 'system_config', 'global');
      await setDoc(docRef, { walletJoiningBonus }, { merge: true });
      if (onNotify) {
        onNotify("Wallet Joining Bonus updated successfully! 💰");
      }
    } catch (err) {
      console.error("Error saving welcome bonus:", err);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleLogoData = (dataUrl: string) => {
    try {
      localStorage.setItem('custom_zomindia_brand_logo', dataUrl);
      window.dispatchEvent(new Event('storage'));
      loadLogo();
      if (onNotify) {
        onNotify("Brand logo updated successfully! 🎨");
      }
    } catch (err) {
      console.error(err);
      setFileError("The image selected is too large. Standard images should be under 1MB.");
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setFileError("Unsupported file type. Please upload a PNG, JPG, or SVG image.");
      return;
    }
    setFileError(null);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        handleLogoData(reader.result);
      }
    };
    reader.onerror = () => {
      setFileError("Error reading file.");
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleReset = () => {
    if (confirm("Are you sure you want to restore the official default ZomIndia logo branding?")) {
      try {
        localStorage.removeItem('custom_zomindia_brand_logo');
        window.dispatchEvent(new Event('storage'));
        loadLogo();
        if (onNotify) {
          onNotify("Logo restored to default successfully! ✨");
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Overview Block */}
      <div className="bg-white rounded-[32px] border border-slate-150 p-8 md:p-10 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full -mr-20 -mt-20 z-0 opacity-40" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider mb-1">
              <Sparkles size={11} className="animate-pulse" /> White-Label Settings
            </span>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Manage Site Identity</h2>
            <p className="text-sm text-slate-500 max-w-xl">
              As a head administrator, you can replace the default branding logo with custom company logo assets. These will be dynamically propagated across headers, footers, notification modals, and application launchers.
            </p>
          </div>
          {currentLogo && (
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-5 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shrink-0 border border-rose-100/30 active:scale-[0.98]"
            >
              <RotateCcw size={13} />
              Reset To Default
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Preview Panel */}
        <div className="lg:col-span-5 bg-white border border-slate-150 rounded-[32px] p-6 md:p-8 shadow-sm flex flex-col justify-between">
          <div className="space-y-6">
            <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Active Logo asset</h3>
            
            <div className="aspect-[4/3] bg-linear-to-br from-slate-50 to-slate-100 border border-slate-200/50 rounded-2xl flex flex-col items-center justify-center p-8 relative overflow-hidden group">
              <img 
                src={currentLogo || defaultLogoUrl} 
                alt="Active Branding Logo" 
                className="max-h-24 max-w-full object-contain transition-transform duration-500 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
              <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-xs text-white text-[9px] font-black px-2.5 py-1 rounded-full tracking-wider uppercase">
                {currentLogo ? "Custom Upload" : "Official Default"}
              </div>
            </div>
            
            <div className="space-y-3.5">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs shrink-0 mt-0.5">
                  <Check size={11} strokeWidth={3} />
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Automatically scaling across responsive headers & mobile layout views.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs shrink-0 mt-0.5">
                  <Check size={11} strokeWidth={3} />
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Preserves optimal horizontal layout proportion to prevent menu displacement.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs shrink-0 mt-0.5">
                  <Check size={11} strokeWidth={3} />
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  SVG vectors or PNG transparencies fit optimally on standard light background layouts.
                </p>
              </div>
            </div>
          </div>
          
          <div className="border-t border-slate-100 pt-6 mt-8">
            <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest leading-normal">
              Direct Storage Registry
            </p>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              All branding variables map dynamically to individual standalone app caches for instantaneous live delivery.
            </p>
          </div>
        </div>

        {/* Upload Zone */}
        <div className="lg:col-span-7 bg-white border border-slate-150 rounded-[32px] p-6 md:p-8 shadow-sm space-y-6">
          <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Configure New Asset</h3>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all flex flex-col items-center justify-center min-h-[220px] relative overflow-hidden group cursor-pointer ${
              dragOver 
                ? 'border-blue-600 bg-blue-50/50' 
                : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50/40'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept="image/*" 
            />

            <div className="w-14 h-14 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-2xl flex items-center justify-center mb-4 border border-slate-100 group-hover:scale-110 active:scale-95 transition-all shadow-sm">
              <Upload size={22} className={dragOver ? 'animate-bounce text-blue-650' : 'text-slate-500'} />
            </div>

            <p className="text-sm font-bold text-slate-900 tracking-tight">
              Drag over your branding asset here
            </p>
            <p className="text-xs text-slate-400 font-medium mt-1 uppercase tracking-widest text-[10px]">
              Or choose local file browser path
            </p>
            <p className="text-[10px] text-slate-405 font-bold mt-4 text-slate-400">
              Optimal: SVG, Transparent PNG (max size 1MB)
            </p>
          </div>

          <AnimatePresence>
            {fileError && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl text-[11px] font-bold flex items-center gap-2.5"
              >
                <AlertCircle size={14} className="shrink-0" />
                <span>{fileError}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick tips panel */}
          <div className="bg-slate-50/55 rounded-2xl p-5 border border-slate-100/50">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800 mb-2">Tips for Professional Branding:</h4>
            <ul className="space-y-1.5 text-xs text-slate-650 list-disc list-inside">
              <li>Use a landscape/horizontal aspect ratio rather than square.</li>
              <li>A transparent background ensures perfect compatibility with standard page header background properties.</li>
              <li>Always check responsive headers, footers, and app install popup blocks after modifying settings.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Global Operational Settings */}
      <div className="bg-white rounded-[32px] border border-slate-150 p-8 md:p-10 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Sparkles size={18} className="text-amber-500 animate-pulse" /> Operational & Global Settings
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">Configure systemic multipliers, financial bonuses, and default welcome assets.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400">Wallet Joining Bonus (INR)</label>
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
              The welcome signup promotional credit instantly deposited into a new customer's active wallet balance.
            </p>
            <div className="flex gap-3 max-w-sm pt-1">
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs font-mono">₹</span>
                <input 
                  type="number"
                  min="0"
                  value={walletJoiningBonus}
                  onChange={(e) => setWalletJoiningBonus(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-2xl pl-8 pr-4 py-3 text-xs font-black text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-700 outline-none transition-all shadow-sm"
                />
              </div>
              <button 
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="bg-[#050CA6] hover:bg-[#040980] disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-2xl transition-all shadow-md active:scale-95 shrink-0 cursor-pointer"
              >
                {savingSettings ? "Saving Settings..." : "Save Config"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
