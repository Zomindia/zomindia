import React, { useRef, useState } from 'react';
import { Upload, X, Link as LinkIcon, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminFileUploadProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  placeholder?: string;
  accept?: string;
}

export default function AdminFileUpload({ value, onChange, label = "File", placeholder = "Paste URL or upload file", accept = "*/*" }: AdminFileUploadProps) {
  const [tab, setTab] = useState<'url' | 'upload'>('upload');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    try {
      const file = files[0];
      // Convert to DataURL for "upload" simulation in this environment
      const reader = new FileReader();
      reader.onload = (event) => {
        onChange(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Failed to process file.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
         fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="w-full">
      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest ml-1">{label}</label>
      
      <div className="flex bg-slate-100 p-1 rounded-2xl mb-3">
         <button
           type="button"
           onClick={() => setTab('upload')}
           className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${tab === 'upload' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
         >
            Upload
         </button>
         <button
           type="button"
           onClick={() => setTab('url')}
           className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${tab === 'url' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
         >
            External URL
         </button>
      </div>

      <AnimatePresence mode="wait">
         {tab === 'url' ? (
           <motion.div key="url" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} className="relative">
              <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-700 transition-all shadow-inner outline-none"
                placeholder={placeholder}
              />
              {value && (
                 <button type="button" onClick={() => onChange('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500">
                    <X size={16} />
                 </button>
              )}
           </motion.div>
         ) : (
           <motion.div key="upload" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept={accept} 
              />
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full bg-slate-50 border-2 border-dashed border-slate-200 hover:border-slate-400 hover:bg-slate-100 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all outline-none"
              >
                 {isUploading ? (
                   <div className="w-5 h-5 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />
                 ) : (
                   <>
                     <Upload size={20} className="text-slate-400" />
                     <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest leading-none">Choose {label}</span>
                   </>
                 )}
              </button>
           </motion.div>
         )}
      </AnimatePresence>

      {/* Preview/Indicator */}
      {value && (
         <div className="mt-4 flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-2xl">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-white rounded-lg shadow-sm border border-slate-200 flex items-center justify-center text-blue-600">
                  <FileText size={20} />
               </div>
               <div>
                  <span className="block text-[10px] uppercase font-black tracking-widest text-emerald-500">File Attached</span>
                  <p className="text-[9px] text-slate-400 truncate max-w-[150px]">{value.startsWith('data:') ? 'Embedded Document' : value}</p>
               </div>
            </div>
            <button type="button" onClick={() => onChange('')} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
               <X size={14} />
            </button>
         </div>
      )}
    </div>
  );
}
