import React from 'react';
import { motion } from 'motion/react';
import { 
  ChevronLeft, 
  ShieldCheck, 
  Sparkles, 
  Star, 
  Users, 
  MapPin, 
  Award, 
  Clock, 
  CheckCircle2, 
  PhoneCall, 
  HelpCircle, 
  FileText, 
  Lock, 
  RotateCcw, 
  Heart, 
  Zap, 
  Building2,
  ThumbsUp
} from 'lucide-react';
import { COMPANY_NAME } from '../types';

interface AboutUsProps {
  onNavigate: (tab: string) => void;
}

export default function AboutUs({ onNavigate }: AboutUsProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.4 }}
      className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-12 sm:space-y-16"
    >
      {/* Top Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <button 
          onClick={() => onNavigate('home')}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-[#050CA6] font-bold text-sm transition-all group cursor-pointer w-fit"
        >
          <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-blue-50 flex items-center justify-center transition-colors">
            <ChevronLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
          </div>
          <span>Back to Home</span>
        </button>

        <div className="flex items-center gap-2 flex-wrap text-xs font-bold text-slate-500">
          <button 
            onClick={() => onNavigate('contact')}
            className="px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200/80 text-slate-700 transition-colors"
          >
            Contact Support
          </button>
          <button 
            onClick={() => onNavigate('help')}
            className="px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200/80 text-slate-700 transition-colors"
          >
            Help Center
          </button>
          <button 
            onClick={() => onNavigate('privacy')}
            className="px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200/80 text-slate-700 transition-colors"
          >
            Privacy Policy
          </button>
        </div>
      </div>

      {/* Hero Banner Section */}
      <div className="bg-gradient-to-br from-[#0a2540] via-[#050CA6] to-indigo-900 rounded-[36px] p-8 sm:p-12 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_70%)] pointer-events-none" />
        
        <div className="relative z-10 max-w-3xl space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-black uppercase tracking-widest text-emerald-300">
            <Sparkles size={14} /> Indore's #1 On-Demand Home Service Platform
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight italic text-white leading-tight">
            Welcome to Zomindia
          </h1>

          <p className="text-base sm:text-lg text-indigo-100/90 font-medium leading-relaxed">
            Officially registered as <strong className="text-white font-bold">{COMPANY_NAME}</strong>, we are based right here in Indore, MP, INDIA. Our mission is simple: to make home life seamless, stress-free, and delightful by connecting you with verified, elite service professionals.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/15 text-xs font-bold text-white">
              <MapPin size={16} className="text-amber-300" />
              <span>Indore, Madhya Pradesh, INDIA</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/15 text-xs font-bold text-white">
              <ShieldCheck size={16} className="text-emerald-300" />
              <span>100% Background Verified Experts</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white p-6 rounded-[28px] border border-slate-200/80 shadow-xs space-y-2 text-center hover:border-blue-200 transition-all">
          <div className="w-12 h-12 bg-blue-50 text-[#050CA6] rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Users size={22} />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">50,000+</p>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Indore Households Served</p>
        </div>

        <div className="bg-white p-6 rounded-[28px] border border-slate-200/80 shadow-xs space-y-2 text-center hover:border-emerald-200 transition-all">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <ShieldCheck size={22} />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">500+</p>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Verified Local Partners</p>
        </div>

        <div className="bg-white p-6 rounded-[28px] border border-slate-200/80 shadow-xs space-y-2 text-center hover:border-amber-200 transition-all">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Star size={22} className="fill-amber-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">4.9★</p>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Average Rating</p>
        </div>

        <div className="bg-white p-6 rounded-[28px] border border-slate-200/80 shadow-xs space-y-2 text-center hover:border-indigo-200 transition-all">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Zap size={22} />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">30 Min</p>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Express Dispatch Time</p>
        </div>
      </div>

      {/* Our Mission & Core Story */}
      <div className="bg-slate-50/70 p-8 sm:p-12 rounded-[36px] border border-slate-200/80 space-y-8">
        <div className="max-w-3xl space-y-4">
          <span className="text-xs font-black uppercase tracking-widest text-[#050CA6] font-mono bg-blue-100/80 px-3 py-1 rounded-full">
            Our Purpose & Vision
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Empowering Indore Homes with Gold-Standard Service Quality
          </h2>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-medium">
            At {COMPANY_NAME}, our mission is to make home services simple, transparent, and completely reliable. Whether you need deep home cleaning, laundry & dry cleaning, plumbing, electrical repairs, painting, or appliance maintenance, we bring skilled, background-checked professionals straight to your doorstep.
          </p>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-medium">
            We recognize that your home is sacred. That's why every service partner on our platform undergoes rigorous identity checks, technical evaluation, and customer care training. No compromises, no hidden charges, and complete peace of mind.
          </p>
        </div>

        {/* Why Choose Zomindia - 6 Grid Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
            <h3 className="font-bold text-slate-900 text-base">100% Safe & Trusted</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Every expert is background-checked, identity-verified, and trained to respect your privacy and property.
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
            <div className="w-10 h-10 bg-blue-50 text-[#050CA6] rounded-xl flex items-center justify-center">
              <Lock size={20} />
            </div>
            <h3 className="font-bold text-slate-900 text-base">OTP Security System</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Services begin only when you share your secret 4-digit OTP code with the assigned partner at your doorstep.
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
              <Award size={20} />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Gold Standard Quality</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              We use eco-friendly detergents, commercial-grade equipment, and certified spare parts for flawless results.
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <Clock size={20} />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Guaranteed On-Time</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              We value your schedule. If our expert gets delayed, you receive real-time GPS tracking and dedicated support.
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
            <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
              <CheckCircle2 size={20} />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Transparent Flat Rates</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Upfront pricing displayed before booking. Zero hidden convenience fees or last-minute surprise charges.
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
            <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
              <RotateCcw size={20} />
            </div>
            <h3 className="font-bold text-slate-900 text-base">100% Free Re-Service</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Not satisfied with the outcome? Contact our support team within 24 hours and we will re-do the job free.
            </p>
          </div>
        </div>
      </div>

      {/* Leadership & Operations Team */}
      <div className="space-y-8">
        <div className="space-y-2">
          <span className="text-xs font-black uppercase tracking-widest text-[#050CA6] font-mono">
            Leadership & Operations
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Meet the Core Team Behind Zomindia
          </h2>
          <p className="text-slate-500 text-sm max-w-2xl font-medium">
            Based in Indore, our executive leadership drives quality assurance, service dispatch protocols, and partner welfare daily.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Leader 1: Ranu */}
          <div className="bg-white p-6 sm:p-8 rounded-[32px] border border-slate-200/80 shadow-xs flex flex-col gap-6 items-start hover:border-blue-200 transition-all">
            <div className="space-y-3 flex-1">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-bold text-slate-900">Ranu</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">Age: 27</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-[#050CA6]">Indore HQ</span>
                </div>
                <p className="text-xs font-black uppercase tracking-wider text-[#050CA6] mt-1">Head of Operations & Management</p>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                A dynamic operational strategist overseeing service quality standards, partner scheduling integrity, and customer satisfaction across Central India.
              </p>
            </div>
          </div>

          {/* Leader 2: Vikass Chopra */}
          <div className="bg-white p-6 sm:p-8 rounded-[32px] border border-slate-200/80 shadow-xs flex flex-col gap-6 items-start hover:border-blue-200 transition-all">
            <div className="space-y-3 flex-1">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-bold text-slate-900">Vikass Chopra</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">Age: 35</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-[#050CA6]">Indore HQ</span>
                </div>
                <p className="text-xs font-black uppercase tracking-wider text-[#050CA6] mt-1">Chief Incharge</p>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                With over a decade of hands-on expertise in field services, Vikass directs technical dispatch protocols, system reliability, and partner escalation resolution.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Quick Action Navigation Grid */}
      <div className="bg-slate-900 text-white p-8 sm:p-12 rounded-[36px] shadow-2xl space-y-8 border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <h3 className="text-2xl font-black italic text-white">Need Assistance or Ready to Book?</h3>
            <p className="text-xs text-slate-300 font-medium max-w-xl">
              Explore our wide variety of home services in Indore or reach out directly to our customer care team anytime.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <button
              onClick={() => onNavigate('home')}
              className="px-6 py-3.5 rounded-2xl bg-[#050CA6] hover:bg-blue-600 text-white font-black text-xs uppercase tracking-wider shadow-lg transition-all"
            >
              Explore Services
            </button>
            <button
              onClick={() => onNavigate('contact')}
              className="px-6 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-black text-xs uppercase tracking-wider border border-slate-700 transition-all"
            >
              Contact Support
            </button>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <button
            onClick={() => onNavigate('help')}
            className="flex items-center gap-2 p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white transition-all text-left font-bold"
          >
            <HelpCircle size={16} className="text-blue-400 shrink-0" />
            <span>Help Center</span>
          </button>

          <button
            onClick={() => onNavigate('privacy')}
            className="flex items-center gap-2 p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white transition-all text-left font-bold"
          >
            <Lock size={16} className="text-emerald-400 shrink-0" />
            <span>Privacy Policy</span>
          </button>

          <button
            onClick={() => onNavigate('terms')}
            className="flex items-center gap-2 p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white transition-all text-left font-bold"
          >
            <FileText size={16} className="text-amber-400 shrink-0" />
            <span>Terms & Conditions</span>
          </button>

          <button
            onClick={() => onNavigate('refund')}
            className="flex items-center gap-2 p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white transition-all text-left font-bold"
          >
            <RotateCcw size={16} className="text-rose-400 shrink-0" />
            <span>Cancellation Policy</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
