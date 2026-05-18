import React from 'react';
import { motion } from 'motion/react';
import { Promotion, Service } from '../types';

interface MarqueeCarouselProps {
  promotions: Promotion[];
  services: Service[];
  onPromotionClick?: (promo: Promotion) => void;
  onServiceClick?: (service: Service) => void;
}

export default function MarqueeCarousel({ promotions, services, onPromotionClick, onServiceClick }: MarqueeCarouselProps) {
  const items = [
    ...promotions.map(p => ({ type: 'promo' as const, data: p, id: `promo-${p.id}` })),
    ...services.filter(s => s.imageURL).map(s => ({ type: 'service' as const, data: s, id: `service-${s.id}` }))
  ];

  if (items.length === 0) return null;

  // Duplicate items for seamless loop
  const displayItems = [...items, ...items, ...items];

  return (
    <div className="relative w-full overflow-hidden py-10 bg-slate-50/50 rounded-[40px] mb-16 border border-slate-100 shadow-inner">
      <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-white/80 to-transparent z-10" />
      <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-white/80 to-transparent z-10" />
      
      <motion.div 
        className="flex gap-8 px-4"
        animate={{
          x: [0, -100 * items.length],
        }}
        transition={{
          duration: items.length * 10,
          repeat: Infinity,
          ease: "linear",
        }}
        style={{ width: "fit-content" }}
      >
        {displayItems.map((item, idx) => (
          <motion.div
            key={`${item.id}-${idx}`}
            whileHover={{ y: -10, scale: 1.02 }}
            onClick={() => {
              if (item.type === 'promo' && onPromotionClick) onPromotionClick(item.data as Promotion);
              if (item.type === 'service' && onServiceClick) onServiceClick(item.data as Service);
            }}
            className="flex-shrink-0 w-72 sm:w-96 p-4 cursor-pointer"
          >
            <div className={`relative h-48 sm:h-64 rounded-[40px] overflow-hidden shadow-2xl group border-4 border-white`}>
              {(item.type === 'promo' ? (item.data as Promotion).imageUrl : (item.data as Service).imageURL) ? (
                <img 
                  src={item.type === 'promo' ? (item.data as Promotion).imageUrl : (item.data as Service).imageURL} 
                  alt="" 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                  <span className="text-white font-black text-4xl italic uppercase opacity-20">{(item.data as any).name}</span>
                </div>
              )}
              
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
              
              <div className="absolute bottom-0 left-0 p-8 w-full">
                <div className="inline-flex px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[8px] font-black uppercase tracking-[0.2em] text-white mb-3">
                  {item.type === 'promo' ? 'Limited Offer' : 'Popular Service'}
                </div>
                <h4 className="text-xl sm:text-2xl font-black text-white italic tracking-tighter uppercase leading-none mb-2">
                  {(item.data as any).name}
                </h4>
                {item.type === 'promo' && (
                  <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">
                    Code: <span className="text-white">{(item.data as Promotion).code}</span>
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
