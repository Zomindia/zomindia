import React, { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import Avatar from "./Avatar";
import { UserProfile } from "../types";
import {
  User,
  Package,
  MapPin,
  ShieldCheck,
  MessageSquare,
  LogOut,
  CreditCard,
  ChevronRight,
  X,
  RefreshCw,
  Shield,
} from "lucide-react";

export type AccountNavTab =
  | "profile"
  | "bookings"
  | "amcs"
  | "wallet"
  | "admin"
  | "partner"
  | "help";

interface AccountPopupProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  mode?: "auto" | "desktop" | "mobile";
  currentMode?: "customer" | "partner";
  onSwitchMode?: (mode: "customer" | "partner") => void;
  onNavigate: (tab: any, subTabOrArg?: string | null) => void;
  onOpenAiSupport: () => void;
  onLogout: () => Promise<void>;
}

export default function AccountPopup({
  isOpen,
  onClose,
  profile,
  mode = "auto",
  currentMode = "customer",
  onSwitchMode,
  onNavigate,
  onOpenAiSupport,
  onLogout,
}: AccountPopupProps) {
  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !profile) return null;

  const displayName =
    profile.displayName && profile.displayName !== "User"
      ? profile.displayName
      : profile.fullName || "Hitakshi Chopra";

  const phone =
    profile.phoneNumber || profile.mobile || "+91 96302 34563";

  const locationTag = profile.city || "Indore";

  const walletDisplayBalance =
    profile.walletBalance !== undefined && profile.walletBalance !== null
      ? Number(profile.walletBalance).toLocaleString("en-IN")
      : "9,230";

  const renderContent = (isMobileSheet: boolean = false) => (
    <div className="flex flex-col text-left">
      {/* Header Strip inside Popup: User avatar + Name ("Hitakshi Chopra") + Phone/Indore tag in a clean, compact flex row */}
      <div className="flex items-center gap-3">
        <Avatar
          photoURL={profile.photoURL}
          displayName={displayName}
          email={profile.email}
          isPremium={profile.isPremium}
          sizeClass="w-11 h-11 shrink-0"
        />

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-extrabold text-slate-900 tracking-tight truncate leading-tight">
            {displayName}
          </h3>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium mt-0.5 truncate">
            <span className="truncate">{phone}</span>
            <span className="text-slate-300 shrink-0">•</span>
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[10px] shrink-0">
              📍 {locationTag}
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0"
          aria-label="Close account menu"
        >
          <X size={16} />
        </button>
      </div>

      {/* Wallet badge: Mini pill showing Wallet: ₹9,230 with a subtle green tint */}
      <button
        onClick={() => {
          onNavigate("wallet");
          onClose();
        }}
        className="w-full mt-3 px-3 py-1.5 bg-emerald-50/90 hover:bg-emerald-100/80 border border-emerald-200/70 rounded-full flex items-center justify-between transition-all group cursor-pointer shadow-2xs"
        title="View Wallet Balance"
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
            <CreditCard size={11} className="stroke-[2.5]" />
          </div>
          <span className="text-xs font-black text-emerald-800 tracking-tight">
            Wallet: ₹{walletDisplayBalance}
          </span>
        </div>
        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
          View <ChevronRight size={12} />
        </span>
      </button>

      {/* Quick Action Menu Items (Single column with subtle hover states, clean SVG icons, no giant blocks) */}
      <div className="mt-3 space-y-1">
        {/* 1. 👤 My Profile & Settings */}
        <button
          onClick={() => {
            onNavigate("profile");
            onClose();
          }}
          className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-blue-700 transition-all group cursor-pointer text-left"
          id="account-popup-profile-btn"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 group-hover:bg-blue-50 group-hover:text-blue-700 transition-colors">
              <User size={15} />
            </div>
            <span>My Profile & Settings</span>
          </div>
          <ChevronRight
            size={14}
            className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all"
          />
        </button>

        {/* 2. 📦 My Bookings */}
        <button
          onClick={() => {
            onNavigate("bookings");
            onClose();
          }}
          className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-blue-700 transition-all group cursor-pointer text-left"
          id="account-popup-bookings-btn"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 group-hover:bg-blue-50 group-hover:text-blue-700 transition-colors">
              <Package size={15} />
            </div>
            <span>My Bookings</span>
          </div>
          <ChevronRight
            size={14}
            className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all"
          />
        </button>

        {/* 3. 📍 Saved Addresses */}
        <button
          onClick={() => {
            onNavigate("profile", "addresses");
            window.dispatchEvent(
              new CustomEvent("open-profile-section", {
                detail: { section: "addresses" },
              }),
            );
            onClose();
          }}
          className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-blue-700 transition-all group cursor-pointer text-left"
          id="account-popup-addresses-btn"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 group-hover:bg-blue-50 group-hover:text-blue-700 transition-colors">
              <MapPin size={15} />
            </div>
            <span>Saved Addresses</span>
          </div>
          <ChevronRight
            size={14}
            className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all"
          />
        </button>

        {/* 4. 🛡️ Annual Maintenance (AMC) */}
        <button
          onClick={() => {
            onNavigate("amcs");
            onClose();
          }}
          className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-blue-700 transition-all group cursor-pointer text-left"
          id="account-popup-amcs-btn"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 group-hover:bg-blue-50 group-hover:text-blue-700 transition-colors">
              <ShieldCheck size={15} />
            </div>
            <span>Annual Maintenance (AMC)</span>
          </div>
          <ChevronRight
            size={14}
            className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all"
          />
        </button>

        {/* 5. 💬 Help & Support (ZOMINI) */}
        <button
          onClick={() => {
            onOpenAiSupport();
            onClose();
          }}
          className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-blue-700 transition-all group cursor-pointer text-left"
          id="account-popup-support-btn"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 group-hover:bg-blue-50 group-hover:text-blue-700 transition-colors">
              <MessageSquare size={15} />
            </div>
            <span>Help & Support (ZOMINI)</span>
          </div>
          <span className="text-[9px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
            AI
          </span>
        </button>

        {/* Dual Persona Switcher if Partner/Admin */}
        {(profile.role === "partner" ||
          profile.role === "admin" ||
          profile.partnerId) && (
          <button
            onClick={() => {
              onSwitchMode?.(
                currentMode === "customer" ? "partner" : "customer",
              );
              onClose();
            }}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-black text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100/70 border border-indigo-100/80 transition-all cursor-pointer text-left mt-1"
            id="account-popup-mode-switch-btn"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <RefreshCw size={13} />
              </div>
              <span className="truncate">
                {currentMode === "customer"
                  ? "Switch to Partner Mode"
                  : "Switch to Customer Mode"}
              </span>
            </div>
            <span className="text-[8px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider shrink-0">
              LIVE
            </span>
          </button>
        )}

        {/* Admin Panel button if Admin */}
        {profile.role === "admin" && (
          <button
            onClick={() => {
              onNavigate("admin");
              onClose();
            }}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold text-red-700 hover:bg-red-50 transition-all group cursor-pointer text-left"
            id="account-popup-admin-btn"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <Shield size={15} />
              </div>
              <span>Admin Panel</span>
            </div>
            <ChevronRight
              size={14}
              className="text-red-300 group-hover:text-red-600 group-hover:translate-x-0.5 transition-all"
            />
          </button>
        )}
      </div>

      {/* Bottom Divider & Logout: Red-tinted clean button: "Log Out" (text-red-600 hover:bg-red-50 rounded-xl py-2 px-3 flex items-center gap-2) */}
      <div className="my-2.5 border-t border-gray-100" />

      <button
        onClick={async () => {
          onClose();
          await onLogout();
        }}
        className="w-full text-red-600 hover:bg-red-50 rounded-xl py-2 px-3 flex items-center gap-2 text-xs font-bold transition-all cursor-pointer text-left"
        id="account-popup-logout-btn"
      >
        <LogOut size={15} className="text-red-600 shrink-0" />
        <span>Log Out</span>
      </button>

      {/* Extra space on mobile bottom sheet for safe area */}
      {isMobileSheet && <div className="h-2" />}
    </div>
  );

  const showDesktop = mode === "auto" || mode === "desktop";
  const showMobile = mode === "auto" || mode === "mobile";

  return (
    <AnimatePresence>
      {/* 1. Desktop & Tablet: Absolute dropdown anchored right below the [HI] avatar */}
      {showDesktop && (
        <div className={mode === "auto" ? "hidden md:block" : "block"}>
          {/* Subtle click-outside backdrop to dismiss */}
          <div
            className="fixed inset-0 z-40 bg-black/5"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute top-full right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 z-50 animate-in fade-in-50 zoom-in-95 text-left"
            role="menu"
            id="desktop-account-popup"
          >
            {renderContent(false)}
          </motion.div>
        </div>
      )}

      {/* 2. Mobile: Clean, half-height Slide-over / Bottom-Sheet */}
      {showMobile && (
        <div className={mode === "auto" ? "md:hidden" : "block"}>
          {/* Backdrop: Subtle click-outside backdrop to dismiss */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
            aria-hidden="true"
          />

          {/* Clean, half-height Slide-over / Bottom-Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl border-t border-gray-100 p-4 pb-8 max-h-[85vh] overflow-y-auto text-left"
            role="dialog"
            aria-modal="true"
            id="mobile-account-sheet"
          >
            {/* Top grab bar */}
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-3 shrink-0" />
            {renderContent(true)}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
