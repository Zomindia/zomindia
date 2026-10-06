import React from 'react';
import { motion } from 'motion/react';
import { COMPANY_NAME } from '../types';
import { Logo } from './BrandLogo';
import { Service } from '../types';
import { MapPin, ShieldCheck, Heart } from 'lucide-react';

interface FooterProps {
  activeTab?: string;
  onNavigate: (tab: string) => void;
  onOpenPartnerModal?: () => void;
  mostRecentAppService?: Service | null;
  onSelectService?: (id: string) => void;
}

export default function Footer({
  activeTab = 'home',
  onNavigate,
  onOpenPartnerModal,
  mostRecentAppService,
  onSelectService
}: FooterProps) {

  const handleLinkClick = (e: React.MouseEvent, tabKey: string) => {
    e.preventDefault();
    onNavigate(tabKey);
  };

  return (
    <motion.footer
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="bg-white border-t border-slate-200/80 pt-8 sm:pt-10 pb-36 sm:pb-14 mt-4 sm:mt-6 relative z-10"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-14 mb-14 items-start">
          
          {/* Col 1: Brand Info & Mission */}
          <div className="col-span-1 md:col-span-2 space-y-5">
            <div
              onClick={(e) => handleLinkClick(e, 'home')}
              className="inline-block cursor-pointer select-none"
              id="footer-logo-container"
            >
              <img src="/logo-horizontal.png" alt="Zomindia" className="h-8 sm:h-9 w-auto object-contain" />
            </div>

            <p className="text-slate-500 text-sm max-w-md leading-relaxed font-medium">
              Indore's premier on-demand home services platform. We connect verified local experts for deep home cleaning, laundry, plumbing, repairs, and appliance maintenance with absolute quality and transparent pricing.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs font-bold text-slate-600">
              <span className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-full text-slate-700">
                <MapPin size={13} className="text-[#050CA6]" />
                Indore, MP, INDIA
              </span>
              <span className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-full text-emerald-800">
                <ShieldCheck size={13} className="text-emerald-600" />
                100% Background Verified
              </span>
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div className="space-y-4">
            <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-widest font-mono">Company & Links</h4>
            <ul className="space-y-2.5 text-xs font-bold text-slate-600">
              <li>
                <a
                  href="/about-us"
                  onClick={(e) => handleLinkClick(e, 'about')}
                  className="hover:text-[#050CA6] hover:translate-x-1 transition-all duration-200 inline-block cursor-pointer"
                >
                  About Us
                </a>
              </li>
              <li>
                <a
                  href="/contact-us"
                  onClick={(e) => handleLinkClick(e, 'contact')}
                  className="hover:text-[#050CA6] hover:translate-x-1 transition-all duration-200 inline-block cursor-pointer"
                >
                  Contact Support
                </a>
              </li>
              <li>
                <a
                  href="/exclusive-offers"
                  onClick={(e) => handleLinkClick(e, 'offers')}
                  className="hover:text-[#050CA6] hover:translate-x-1 transition-all duration-200 inline-block cursor-pointer"
                >
                  Exclusive Offers
                </a>
              </li>
              {onOpenPartnerModal && (
                <li>
                  <button
                    type="button"
                    onClick={onOpenPartnerModal}
                    className="text-emerald-700 font-extrabold hover:text-emerald-800 hover:translate-x-1 transition-all duration-200 inline-block cursor-pointer"
                    id="footer-join-partner-link"
                  >
                    Join as Elite Partner
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Col 3: Support & Legal */}
          <div className="space-y-4">
            <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-widest font-mono">Support & Legal</h4>
            <ul className="space-y-2.5 text-xs font-bold text-slate-600">
              <li>
                <a
                  href="/help-center"
                  onClick={(e) => handleLinkClick(e, 'help')}
                  className="hover:text-[#050CA6] hover:translate-x-1 transition-all duration-200 inline-block cursor-pointer"
                >
                  Help Center
                </a>
              </li>
              <li>
                <a
                  href="/terms-and-conditions"
                  onClick={(e) => handleLinkClick(e, 'terms')}
                  className="hover:text-[#050CA6] hover:translate-x-1 transition-all duration-200 inline-block cursor-pointer"
                >
                  Terms & Conditions
                </a>
              </li>
              <li>
                <a
                  href="/privacy-policy"
                  onClick={(e) => handleLinkClick(e, 'privacy')}
                  className="hover:text-[#050CA6] hover:translate-x-1 transition-all duration-200 inline-block cursor-pointer"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <a
                  href="/refund-policy"
                  onClick={(e) => handleLinkClick(e, 'refund')}
                  className="hover:text-[#050CA6] hover:translate-x-1 transition-all duration-200 inline-block cursor-pointer"
                >
                  Cancellation & Refund
                </a>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="border-t border-slate-100 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-semibold text-slate-400">
          <p>© 2026 {COMPANY_NAME}. All rights reserved.</p>
          <div className="flex items-center gap-2">
            <span>Crafted with</span>
            <Heart size={12} className="text-rose-500 fill-rose-500" />
            <span>for Indore, MP</span>
          </div>
        </div>
      </div>
    </motion.footer>
  );
}
