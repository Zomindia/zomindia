import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  X,
  Send,
  Camera,
  CheckCircle2,
  Clock,
  User,
  AlertTriangle,
  FileText,
  Sparkles,
  ExternalLink,
  Phone,
  MessageSquare,
} from "lucide-react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Booking, Service, UserProfile, PartnerProfile, SupportTicket } from "../types";
import { formatTime12Hour } from "../utils/formatTime";

interface WarrantySupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  service?: Service;
  partnerUser?: UserProfile | null;
  partnerDetail?: PartnerProfile | null;
  customerProfile: UserProfile | null;
  activeTicket?: SupportTicket | null;
  onTicketCreated?: (ticket: SupportTicket) => void;
}

const ISSUE_CATEGORIES = [
  {
    id: "Warranty Claim (30-day)",
    label: "30-Day Warranty Claim",
    badge: "Free Rework",
    description: "Appliance not working properly or post-service defect within 30 days",
    priority: "high" as const,
    icon: ShieldCheck,
  },
  {
    id: "Post-service issue",
    label: "Post-Service Issue",
    badge: "Inspection",
    description: "Unresolved symptoms or minor adjustments needed after completion",
    priority: "medium" as const,
    icon: AlertTriangle,
  },
  {
    id: "Billing discrepancy",
    label: "Billing / Payment Discrepancy",
    badge: "Finance",
    description: "Questions regarding extra parts, coupon adjustments, or cash receipts",
    priority: "medium" as const,
    icon: FileText,
  },
  {
    id: "Technician feedback",
    label: "Technician / Partner Feedback",
    badge: "Service Quality",
    description: "Feedback regarding technician behavior, punctuality, or work quality",
    priority: "medium" as const,
    icon: User,
  },
];

export const WarrantySupportModal: React.FC<WarrantySupportModalProps> = ({
  isOpen,
  onClose,
  booking,
  service,
  partnerUser,
  partnerDetail,
  customerProfile,
  activeTicket,
  onTicketCreated,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("Warranty Claim (30-day)");
  const [issueDetails, setIssueDetails] = useState<string>("");
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showNewTicketForm, setShowNewTicketForm] = useState<boolean>(false);

  if (!isOpen || !booking) return null;

  const serviceTitle = service?.name || booking.serviceName || "Service Booking";
  const bookingCode = booking.id.slice(-6).toUpperCase();

  // Booking date calculation
  const getBookingDate = (b: Booking): Date | null => {
    if (b.scheduledAt) {
      if (typeof b.scheduledAt.toDate === "function") return b.scheduledAt.toDate();
      return new Date(b.scheduledAt);
    }
    if ((b as any).dateTime) return new Date((b as any).dateTime);
    if (b.createdAt) {
      if (typeof b.createdAt.toDate === "function") return b.createdAt.toDate();
      return new Date(b.createdAt);
    }
    return null;
  };

  const bookingDateObj = getBookingDate(booking);
  const dateDisplay = bookingDateObj
    ? bookingDateObj.toLocaleDateString("en-IN", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Recent Booking";
  const timeDisplay = formatTime12Hour(booking.scheduledAt) || "10:00 AM";

  // Calculate 30-day warranty expiry
  let isWithinWarranty = true;
  let warrantyDaysRemaining = 30;
  if (bookingDateObj) {
    const daysSince = Math.floor(
      (Date.now() - bookingDateObj.getTime()) / (1000 * 60 * 60 * 24)
    );
    warrantyDaysRemaining = Math.max(0, 30 - daysSince);
    isWithinWarranty = daysSince <= 30;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueDetails.trim() || !customerProfile) return;

    setIsSubmitting(true);
    try {
      const isWarranty = selectedCategory.includes("Warranty");
      const priority = isWarranty ? "high" : "medium";

      const ticketPayload = {
        userId: customerProfile.uid,
        customerId: customerProfile.uid,
        bookingId: booking.id,
        partnerId: booking.partnerId || "",
        partnerName: partnerUser?.displayName || (booking as any).partnerName || "Assigned Specialist",
        customerName: booking.customerBookedName || customerProfile.displayName || "Customer",
        customerPhone: booking.customerBookedPhone || customerProfile.phoneNumber || "",
        serviceName: serviceTitle,
        category: selectedCategory,
        subject: `${selectedCategory} - Booking #${bookingCode}`,
        message: issueDetails.trim(),
        photoUrl: photoUrl.trim() || "",
        status: "open" as const,
        priority: priority as "low" | "medium" | "high",
        warrantyClaim: isWarranty,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, "support_tickets"), ticketPayload);

      if (onTicketCreated) {
        onTicketCreated({
          id: docRef.id,
          ...ticketPayload,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as SupportTicket);
      }

      if (typeof (window as any).__showToast === "function") {
        (window as any).__showToast("Support ticket created! Our team will resolve this under warranty.");
      }

      setIssueDetails("");
      setPhotoUrl("");
      setShowNewTicketForm(false);
      onClose();
    } catch (err) {
      console.error("Failed to create support ticket:", err);
      if (typeof (window as any).__showToast === "function") {
        (window as any).__showToast("Failed to create support ticket. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasActiveExistingTicket = activeTicket && activeTicket.status !== "closed";

  return (
    <AnimatePresence>
      <div
        id="warranty-support-modal-backdrop"
        className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92dvh]"
        >
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-[#002e6e] via-[#00429d] to-[#002e6e] text-white p-5 sm:p-6 relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-40 h-40 bg-white/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-start justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-amber-300 shrink-0 shadow-inner">
                  <ShieldCheck size={26} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded-full border border-amber-300/30">
                      30-Day Guarantee
                    </span>
                    <span className="text-[10px] text-sky-200 font-mono">
                      #{bookingCode}
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-white mt-1 tracking-tight">
                    Warranty Claim & Support
                  </h3>
                  <p className="text-xs text-sky-100 font-medium">
                    Priority resolution desk & zero-cost rework coverage
                  </p>
                </div>
              </div>
              <button
                id="close-warranty-modal-btn"
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer border border-white/20 shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-slate-800">
            {/* Booking & Partner Info Card */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Covered Service
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {serviceTitle}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                  <Clock size={13} className="text-slate-400" />
                  <span>{dateDisplay} at {timeDisplay}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 border-t sm:border-t-0 sm:border-l border-slate-200 pt-3 sm:pt-0 sm:pl-4 w-full sm:w-auto">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-800 font-black text-sm shrink-0">
                  {partnerUser?.displayName?.[0] || <User size={18} />}
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Assigned Partner
                  </div>
                  <div className="text-xs font-bold text-slate-800 truncate max-w-[140px]">
                    {partnerUser?.displayName || "Verified Specialist"}
                  </div>
                  <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle2 size={11} /> Verified Pro
                  </div>
                </div>
              </div>
            </div>

            {/* Warranty Status Banner */}
            <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
              isWithinWarranty
                ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                : "bg-amber-50/80 border-amber-200 text-amber-900"
            }`}>
              <div className="flex items-center gap-2.5">
                <ShieldCheck className={isWithinWarranty ? "text-emerald-600 shrink-0" : "text-amber-600 shrink-0"} size={18} />
                <div>
                  <div className="font-bold">
                    {isWithinWarranty
                      ? "100% Zero-Cost Service Warranty Active"
                      : "Standard Post-Warranty Support"}
                  </div>
                  <div className="text-[11px] opacity-80">
                    {isWithinWarranty
                      ? `${warrantyDaysRemaining} days remaining in your 30-day rework warranty`
                      : "Our customer success team will assist with standard support"}
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-white border shrink-0">
                {isWithinWarranty ? "Guaranteed" : "Assisted"}
              </span>
            </div>

            {/* Active Ticket Status Card (if ticket exists) */}
            {hasActiveExistingTicket && !showNewTicketForm && (
              <div className="bg-amber-50/60 rounded-2xl p-5 border border-amber-200 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                    <span className="text-xs font-black uppercase tracking-wider text-amber-900">
                      Active Support Ticket
                    </span>
                    <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                      #{activeTicket.id.slice(0, 8).toUpperCase()}
                    </span>
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                    activeTicket.status === "open"
                      ? "bg-amber-100 text-amber-800 border border-amber-300"
                      : activeTicket.status === "in_progress"
                        ? "bg-blue-100 text-blue-800 border border-blue-300"
                        : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  }`}>
                    {activeTicket.status === "open" ? "In Review" : activeTicket.status.replace("_", " ")}
                  </span>
                </div>

                <div className="bg-white/80 rounded-xl p-3.5 border border-amber-200/60 space-y-2">
                  <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span>{activeTicket.subject}</span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {activeTicket.createdAt?.toDate?.()
                        ? activeTicket.createdAt.toDate().toLocaleDateString()
                        : "Today"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {activeTicket.message}
                  </p>
                  {activeTicket.photoUrl && (
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <a
                        href={activeTicket.photoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-blue-600 font-bold hover:underline inline-flex items-center gap-1"
                      >
                        <Camera size={12} /> View Attached Photo Reference
                      </a>
                    </div>
                  )}
                </div>

                {/* Admin Response Box */}
                {activeTicket.adminResponse ? (
                  <div className="bg-blue-50 rounded-xl p-3.5 border border-blue-200 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-blue-800">
                      <Sparkles size={12} className="text-blue-600" />
                      <span>Official Resolution Team Response</span>
                    </div>
                    <p className="text-xs text-blue-900 italic font-medium leading-relaxed">
                      "{activeTicket.adminResponse}"
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-amber-800 font-medium bg-amber-100/50 p-2.5 rounded-xl">
                    <Clock size={14} className="shrink-0 text-amber-600" />
                    <span>Our warranty resolution team is actively reviewing your request (Avg. response: &lt; 2 hrs).</span>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setShowNewTicketForm(true)}
                    className="text-xs font-bold text-[#002e6e] hover:underline"
                  >
                    + Submit Additional Issue / Update
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    Close Window
                  </button>
                </div>
              </div>
            )}

            {/* Ticket Submission Form */}
            {(!hasActiveExistingTicket || showNewTicketForm) && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {showNewTicketForm && (
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-xs font-bold text-slate-700">Submit New Warranty Ticket</span>
                    <button
                      type="button"
                      onClick={() => setShowNewTicketForm(false)}
                      className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                    >
                      Back to Active Ticket
                    </button>
                  </div>
                )}

                {/* Category Selection */}
                <div className="space-y-2">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500">
                    Select Issue Category <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ISSUE_CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      const isSelected = selectedCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedCategory(cat.id)}
                          className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between gap-1 cursor-pointer ${
                            isSelected
                              ? "bg-blue-50/80 border-blue-600 text-blue-950 ring-1 ring-blue-600"
                              : "bg-white border-slate-200 hover:border-slate-300 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-1.5 font-bold text-xs">
                              <Icon size={14} className={isSelected ? "text-blue-700" : "text-slate-400"} />
                              <span>{cat.label}</span>
                            </div>
                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                              isSelected ? "bg-blue-200/80 text-blue-900" : "bg-slate-100 text-slate-500"
                            }`}>
                              {cat.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">
                            {cat.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Issue Details Textarea */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500">
                    Describe the issue in detail <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    value={issueDetails}
                    onChange={(e) => setIssueDetails(e.target.value)}
                    placeholder="Describe symptoms, when the issue started, or what assistance you need..."
                    rows={4}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-700 focus:bg-white transition-all font-sans font-medium"
                  />
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span>Be as specific as possible to expedite rework dispatch.</span>
                    <span>{issueDetails.length} chars</span>
                  </div>
                </div>

                {/* Optional Photo Attachment */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Camera size={13} className="text-slate-400" />
                      <span>Attach Photo Reference (Optional)</span>
                    </span>
                    <span className="text-slate-400 font-normal lowercase">url link</span>
                  </label>
                  <input
                    type="url"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    placeholder="https://... (Image link of the appliance or issue)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-700 focus:bg-white transition-all font-sans font-medium"
                  />
                  {photoUrl.trim() && (
                    <div className="mt-2 relative w-24 h-24 rounded-xl border border-slate-200 overflow-hidden bg-slate-100">
                      <img
                        src={photoUrl}
                        alt="Photo preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as any).style.display = "none";
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Submit Action */}
                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-1/3 py-3 rounded-2xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    id="submit-warranty-ticket-btn"
                    type="submit"
                    disabled={isSubmitting || !issueDetails.trim()}
                    className="w-2/3 py-3 rounded-2xl bg-gradient-to-r from-[#002e6e] to-[#00429d] hover:from-[#002255] hover:to-[#002e6e] text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-950/15 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Submitting Ticket...</span>
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        <span>Submit Warranty Ticket</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
