import { motion } from 'motion/react';
import { ChevronLeft } from 'lucide-react';

interface Props {
  title: string;
  content: string;
  onBack: () => void;
}

export default function StaticPage({ title, content, onBack, children }: Props & { children?: React.ReactNode }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="bg-slate-50 min-h-screen text-slate-900 !bg-slate-50 w-full"
    >
      <div className="max-w-4xl mx-auto px-4 py-10 sm:py-16">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 hover:text-blue-700 mb-8 sm:mb-10 font-bold transition-colors cursor-pointer"
        >
          <ChevronLeft size={20} /> Back
        </button>

        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 mb-8 tracking-tight">{title}</h1>
        
        <div className="space-y-6 text-slate-700 leading-relaxed text-base sm:text-lg mb-12">
          {content.split('\n\n').map((paragraph, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8">
              <p className="text-slate-800 leading-relaxed font-medium">{paragraph}</p>
            </div>
          ))}
        </div>

        {children}
      </div>
    </motion.div>
  );
}

