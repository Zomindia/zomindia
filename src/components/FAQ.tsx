import React, { useState } from 'react';
import { FAQ as FAQType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, HelpCircle, Folder, ThumbsUp, ThumbsDown, Check } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';

interface FAQProps {
  faqs: FAQType[];
  className?: string;
  searchQuery?: string;
}

// Escapes special characters for use in RegExp
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Highlights matching query words in the text
function highlightText(text: string, search: string) {
  if (!search || !search.trim()) return text;
  const parts = text.split(new RegExp(`(${escapeRegExp(search)})`, 'gi'));
  return (
    <>
      {parts.map((part, index) => 
        part.toLowerCase() === search.toLowerCase() ? (
          <mark key={index} className="bg-yellow-200 text-slate-900 rounded-[3px] px-1 py-0.5 font-bold">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

export default function FAQ({ faqs, className = '', searchQuery = '' }: FAQProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Sorting options: 'recent' or 'popular'
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent');

  // Input area visibility and content for helpfulness/No feedback
  const [showNoFeedbackForm, setShowNoFeedbackForm] = useState<Record<string, boolean>>({});
  const [noFeedbackTexts, setNoFeedbackTexts] = useState<Record<string, string>>({});

  // Local state for user votes on helpfulness
  const [feedback, setFeedback] = useState<Record<string, 'helpful' | 'not_helpful'>>(() => {
    try {
      const stored = localStorage.getItem('faq_feedback');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const handleFeedback = async (faqId: string, type: 'helpful' | 'not_helpful', detailText?: string) => {
    const updated = { ...feedback, [faqId]: type };
    setFeedback(updated);
    try {
      localStorage.setItem('faq_feedback', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }

    // Try to increment the count in Firestore, catching permission errors gracefully
    try {
      const docRef = doc(db, 'faqs', faqId);
      const updates: Record<string, any> = {
        [type === 'helpful' ? 'helpfulCount' : 'notHelpfulCount']: increment(1)
      };
      if (detailText && detailText.trim()) {
        updates.lastFeedbackNotes = detailText.trim();
      }
      await updateDoc(docRef, updates);
    } catch (err) {
      console.warn("Could not save vote to Firestore (typical for non-admin client)", err);
    }
  };

  // 1. Real-time filter matching questions or answers
  const queryText = searchQuery.trim().toLowerCase();
  const filteredFaqs = queryText 
    ? faqs.filter(faq => 
        faq.question.toLowerCase().includes(queryText) || 
        faq.answer.toLowerCase().includes(queryText)
      )
    : faqs;

  // 2. Extract Featured FAQs (most viewed or top-rated by popularity scores)
  // Let's pull up to 4 FAQs that have a popularity score over 0
  const featuredFaqs = [...filteredFaqs]
    .filter(f => typeof f.popularity === 'number' && f.popularity > 0)
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, 4);

  // Group filtered FAQs by user-defined category, falling back to 'Other'
  const grouped = filteredFaqs.reduce<Record<string, FAQType[]>>((acc, faq) => {
    const rawCategory = faq.category?.trim();
    const categoryName = rawCategory ? rawCategory : 'Other';
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(faq);
    return acc;
  }, {});

  // Generate sorted standard categories list
  const standardCategories = Object.keys(grouped).sort((a, b) => {
    if (a === 'Other') return 1; // Always place 'Other' last
    if (b === 'Other') return -1;
    return a.localeCompare(b);
  });

  // Inject featured virtual category at top if there are popular FAQs
  if (featuredFaqs.length > 0) {
    grouped['Featured'] = featuredFaqs;
  }

  const categories = featuredFaqs.length > 0
    ? ['Featured', ...standardCategories.filter(c => c !== 'Featured')]
    : standardCategories;

  // Extract dynamically available categories from database loaded FAQs for selector
  const availableCategories = Array.from(new Set(faqs.map(f => f.category?.trim() || 'General'))).filter(Boolean);

  const getTimestamp = (val: any) => {
    if (!val) return 0;
    if (typeof val.toMillis === 'function') return val.toMillis();
    if (typeof val.seconds === 'number') return val.seconds * 1000;
    if (val instanceof Date) return val.getTime();
    if (typeof val === 'string' || typeof val === 'number') return new Date(val).getTime();
    return 0;
  };

  const sortFaqItems = (items: FAQType[]) => {
    return [...items].sort((a, b) => {
      if (sortBy === 'popular') {
        const popA = typeof a.popularity === 'number' ? a.popularity : 0;
        const popB = typeof b.popularity === 'number' ? b.popularity : 0;
        return popB - popA;
      } else {
        return getTimestamp(b.createdAt) - getTimestamp(a.createdAt);
      }
    });
  };

  if (filteredFaqs.length === 0) {
    return (
      <div className="text-center py-16 bg-slate-50/50 rounded-[40px] border-2 border-dashed border-slate-100 p-8">
        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mx-auto mb-4">
          <HelpCircle size={20} />
        </div>
        <p className="text-sm font-black uppercase tracking-widest text-slate-400 mb-1">Knowledge Directory</p>
        <p className="text-slate-500 text-sm">No matching FAQ articles found for "{searchQuery}".</p>
      </div>
    );
  }

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Category Badges for topic identification */}
      <div id="faq-categories" className="flex flex-wrap items-center gap-1.5 p-3.5 bg-slate-50 border border-slate-100/70 rounded-2xl animate-in fade-in duration-300">
        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mr-1.5 select-none font-sans">Available Topics:</span>
        {availableCategories.map((catName) => (
          <span
            key={catName}
            className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-blue-700 bg-blue-50/60 border border-blue-100/50 uppercase tracking-tight"
          >
            {catName}
          </span>
        ))}
      </div>

      {/* List controls: Sorting dropdown */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Articles ({filteredFaqs.length})
        </span>
        <div className="flex items-center gap-2">
          <label htmlFor="faq-sorting-select" className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Sort by:
          </label>
          <select
            id="faq-sorting-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'recent' | 'popular')}
            className="bg-white border border-slate-200/80 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-700/5 focus:border-blue-700 cursor-pointer select-none"
          >
            <option value="recent">Most Recent</option>
            <option value="popular">Most Popular</option>
          </select>
        </div>
      </div>

      {/* FAQ Articles Container wrapper */}
      <div className="faq-list-container space-y-12">
        {categories.map((category) => {
          const categoryFaqs = sortFaqItems(grouped[category]);
          return (
            <div key={category} className="space-y-6">
              <div className="flex items-center gap-2.5 px-2">
                <div className={`p-1.5 rounded-lg border ${category === 'Featured' ? 'bg-amber-50 text-amber-600 border-amber-100/50' : 'bg-blue-50 text-blue-700 border-blue-100/50'}`}>
                  <Folder size={14} />
                </div>
                <h3 className={`text-sm font-black uppercase tracking-wider ${category === 'Featured' ? 'text-amber-600' : 'text-slate-500'}`}>
                  {category === 'Featured' ? '★ Featured & Popular' : category}
                </h3>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${category === 'Featured' ? 'text-amber-600 bg-amber-50 border-amber-100/35' : 'text-blue-700 bg-blue-50 border-blue-100/35'}`}>
                  {categoryFaqs.length}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categoryFaqs.map((faq) => {
                  const isExpanded = expandedId === `${category}-${faq.id}`;
                  return (
                    <div
                      key={`${category}-${faq.id}`}
                      className="bg-white border border-slate-100 hover:border-slate-200 rounded-[28px] overflow-hidden transition-all duration-300 shadow-xs flex flex-col"
                    >
                      <button
                        type="button"
                        onClick={() => toggleExpand(`${category}-${faq.id}`)}
                        className="w-full text-left p-6 flex justify-between items-start gap-4 outline-none select-none cursor-pointer hover:bg-slate-50/20 transition-all duration-250"
                      >
                        <div className="flex gap-3">
                          <div className={`mt-1 shrink-0 ${category === 'Featured' ? 'text-amber-500' : 'text-blue-700'}`}>
                            <HelpCircle size={18} />
                          </div>
                          <span className="font-bold text-slate-900 text-sm tracking-tight leading-snug">
                            {highlightText(faq.question, searchQuery)}
                          </span>
                        </div>
                        <motion.div
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                          className="text-slate-400 shrink-0 mt-1"
                        >
                          <ChevronDown size={18} />
                        </motion.div>
                      </button>

                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: 'easeInOut' }}
                            className="overflow-hidden"
                          >
                            <div className="px-6 pb-6 pt-0 text-sm font-medium leading-relaxed text-slate-500 border-t border-slate-100/40 flex flex-col gap-4">
                              <div className="pt-4 font-normal text-slate-600 leading-relaxed font-sans">
                                {highlightText(faq.answer, searchQuery)}
                              </div>

                              {/* Helpfulness Feedback Section */}
                              <div className="faq-article-feedback border-t border-slate-100 pt-3 mt-2 text-xs flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-400 font-bold">Was this article helpful?</span>
                                  <div className="flex items-center gap-2">
                                    {feedback[faq.id] ? (
                                      <span className="text-emerald-600 font-bold flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100/50 animate-in zoom-in-95 duration-200">
                                        <Check size={12} />
                                        {feedback[faq.id] === 'helpful' ? 'Thank you!' : 'Thanks for your feedback!'}
                                      </span>
                                    ) : showNoFeedbackForm[faq.id] ? (
                                      <span className="text-slate-400 font-bold italic animate-pulse">Entering feedback...</span>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handleFeedback(faq.id, 'helpful')}
                                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 cursor-pointer font-bold transition-all"
                                        >
                                          <ThumbsUp size={12} />
                                          Yes
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setShowNoFeedbackForm(prev => ({ ...prev, [faq.id]: true }))}
                                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 cursor-pointer font-bold transition-all"
                                        >
                                          <ThumbsDown size={12} />
                                          No
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {showNoFeedbackForm[faq.id] && !feedback[faq.id] && (
                                  <motion.div
                                    initial={{ opacity: 0, y: -8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 flex flex-col gap-2.5 animate-in fade-in duration-200"
                                  >
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block font-sans">
                                      How can we improve this answer?
                                    </label>
                                    <textarea
                                      value={noFeedbackTexts[faq.id] || ''}
                                      onChange={(e) => setNoFeedbackTexts(prev => ({ ...prev, [faq.id]: e.target.value }))}
                                      placeholder="Tell us what was missing or incorrect..."
                                      rows={2}
                                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-rose-500/5 focus:border-rose-500/40 resize-none font-sans"
                                    />
                                    <div className="flex gap-2 justify-end">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setShowNoFeedbackForm(prev => ({ ...prev, [faq.id]: false }));
                                          setNoFeedbackTexts(prev => ({ ...prev, [faq.id]: '' }));
                                        }}
                                        className="px-2.5 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const text = noFeedbackTexts[faq.id] || '';
                                          handleFeedback(faq.id, 'not_helpful', text);
                                          setShowNoFeedbackForm(prev => ({ ...prev, [faq.id]: false }));
                                        }}
                                        className="px-3 py-1 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all active:scale-95 shadow-sm"
                                      >
                                        Submit Feedback
                                      </button>
                                    </div>
                                  </motion.div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
