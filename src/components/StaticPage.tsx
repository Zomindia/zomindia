import { motion } from 'motion/react';
import { ChevronLeft } from 'lucide-react';

interface Props {
  title: string;
  content: string;
  onBack: () => void;
}

export default function StaticPage({ title, content, onBack }: Props) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto px-4 py-20"
    >
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-blue-700 mb-12 font-semibold transition-colors"
      >
        <ChevronLeft size={20} /> Back
      </button>

      <h1 className="text-5xl font-bold text-slate-900 mb-12 tracking-tight">{title}</h1>
      
      <div className="prose prose-stone max-w-none space-y-8 text-slate-600 leading-relaxed text-lg">
        {content.split('\n\n').map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
    </motion.div>
  );
}
