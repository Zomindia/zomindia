import React, { useState } from 'react';
import { Upload, X, Check, Image as ImageIcon, FileText, Link as LinkIcon, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminUploadProps {
  onUpload: (url: string) => void;
  onMultipleChange?: (urls: string[]) => void;
  accept?: string;
  label?: string;
  type?: 'image' | 'file';
  compressImages?: boolean;
  placeholder?: string;
  value?: string;
  maxWidth?: number;
}

export default function AdminUpload({ 
  onUpload, 
  onMultipleChange,
  accept = "image/*", 
  label = "Upload Asset", 
  type = 'image',
  compressImages = true,
  placeholder = "https://example.com/asset.jpg",
  value = "",
  maxWidth = 1200
}: AdminUploadProps) {
  const [tab, setTab] = useState<'upload' | 'url'>('upload');
  const [url, setUrl] = useState(value);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(value || null);

  const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = maxWidth;
          const MAX_HEIGHT = maxWidth;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);
    try {
      if (onMultipleChange) {
        const fileList: File[] = Array.from(files);
        const processed = await Promise.all(
          fileList.map(async (file: File) => {
            if (type === 'image' && compressImages) {
              return await compressImage(file);
            }
            return await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.readAsDataURL(file);
              reader.onload = () => resolve(reader.result as string);
            });
          })
        );
        onMultipleChange(processed);
        setPreview(processed[0]);
      } else {
        const file: File = files[0];
        let finalData: string;
        if (type === 'image' && compressImages) {
          finalData = await compressImage(file);
        } else {
          finalData = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
          });
        }
        setPreview(finalData);
        onUpload(finalData);
      }
    } catch (err) {
      setError("Failed to process file");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
      <div className="flex bg-white rounded-2xl p-1 mb-6 shadow-sm border border-slate-100">
        <button 
          onClick={() => setTab('upload')}
          className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'upload' ? 'bg-blue-700 text-white shadow-lg' : 'text-slate-400 hover:text-blue-700'}`}
        >
          {type === 'image' ? <ImageIcon size={14} className="inline mr-2" /> : <FileText size={14} className="inline mr-2" />}
          File Upload
        </button>
        <button 
          onClick={() => setTab('url')}
          className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'url' ? 'bg-blue-700 text-white shadow-lg' : 'text-slate-400 hover:text-blue-700'}`}
        >
          <LinkIcon size={14} className="inline mr-2" />
          Direct URL
        </button>
      </div>

      <AnimatePresence mode="wait">
        {tab === 'upload' ? (
          <motion.div 
            key="upload"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="relative">
              <input 
                type="file" 
                accept={accept}
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                disabled={uploading}
              />
              <div className="border-2 border-dashed border-slate-200 rounded-3xl py-10 flex flex-col items-center justify-center bg-white hover:border-blue-700 hover:bg-blue-50/30 transition-all group">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mb-4 group-hover:bg-blue-700 group-hover:text-white transition-all">
                  {uploading ? <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Upload size={20} />}
                </div>
                <p className="text-xs font-bold text-slate-900">{label}</p>
                <p className="text-[10px] text-slate-400 font-medium mt-1 uppercase tracking-widest">DRAG & DROP OR TAP</p>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="url"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="relative">
              <LinkIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
              <input 
                type="url" 
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/asset.jpg"
                className="w-full bg-white border border-slate-100 rounded-2xl pl-12 pr-4 py-4 text-sm font-medium focus:ring-2 focus:ring-blue-700 transition-all shadow-sm"
              />
            </div>
            <button 
              onClick={() => {
                if (url) {
                  onUpload(url);
                  setPreview(url);
                }
              }}
              className="w-full bg-slate-900 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-lg"
            >
              Verify & Sync
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="mt-4 flex items-center gap-2 p-3 bg-rose-50 rounded-xl text-rose-600 border border-rose-100 italic">
          <AlertCircle size={14} />
          <span className="text-[10px] font-bold">{error}</span>
        </div>
      )}

      {preview && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-6 flex items-center gap-4 p-4 bg-emerald-50 rounded-3xl border border-emerald-100"
        >
          {type === 'image' ? (
            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-emerald-200 shrink-0">
              <img src={preview} alt="Preview" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
              <FileText size={20} />
            </div>
          )}
          <div className="flex-1">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">Upload Ready</p>
            <p className="text-xs font-bold text-slate-900 truncate max-w-[150px]">Asset Synced Successfully</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Check size={16} strokeWidth={3} />
          </div>
        </motion.div>
      )}
    </div>
  );
}
