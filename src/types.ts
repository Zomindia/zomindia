export type UserRole = 'customer' | 'partner' | 'admin' | 'anon';
export type AdminSubRole = 'head' | 'accounts' | 'hr' | 'manager' | 'support' | 'editor' | 'moderator' | 'marketing' | 'sales' | 'logistics' | 'developer' | 'owner' | 'field_manager';

export interface UserProfile {
  uid: string;
  displayName: string;
  fullName?: string;
  email: string;
  role: 'customer' | 'partner' | 'admin'; // Keep strictly roles for profile
  adminSubRole?: AdminSubRole;
  phoneNumber?: string;
  phoneNumberVerified?: boolean;
  emailVerified?: boolean;
  photoURL?: string;
  address?: string;
  city?: string;
  bio?: string;
  walletBalance?: number;
  referralCode?: string;
  referredBy?: string;
  referralCreditPending?: boolean;
  isPremium?: boolean;
  subscriptionExpiry?: any;
  notificationPreferences?: {
    bookingUpdates: boolean;
    promotionalMessages: boolean;
  };
  gender?: string;
  languagePreference?: string;
  houseType?: string;
  bhkSize?: string;
  preferredTimeSlot?: string;
  secondaryPhone?: string;
  createdAt: any;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  iconURL?: string;
  imageURL?: string;
  images?: string[];
  description?: string;
  order?: number;
}

export interface Service {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  basePrice: number;
  duration: string;
  imageURL?: string;
  images?: string[];
  priceListPDF?: string;
  rating?: number;
  reviewCount?: number;
  predefinedTasks?: string[];
  createdAt?: any;
}

export interface WorkingHours {
  day: string; // 'Monday', 'Tuesday', etc.
  startTime: string; // '09:00'
  endTime: string; // '18:00'
  enabled: boolean;
}

export interface KYCDocument {
  type: string;
  url: string;
  status: 'pending' | 'verified' | 'rejected';
}

export interface PartnerProfile {
  id: string;
  userId: string;
  categories: string[];
  bio?: string;
  rating: number;
  reviewCount: number;
  isVerified: boolean;
  status: 'active' | 'inactive' | 'pending';
  availabilityStatus?: 'Available' | 'Busy' | 'Offline';
  statusReason?: string;
  kycStatus?: 'not_submitted' | 'pending' | 'verified' | 'rejected';
  kycRejectReason?: string;
  kycDocuments?: KYCDocument[];
  totalEarnings?: number;
  rewardCredits?: number;
  workingHours?: WorkingHours[];
  lat?: number;
  lng?: number;
  createdAt?: any;
  updatedAt?: any;
  locationDisconnected?: boolean;
  disconnectReason?: string;
}

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  message: string;
  status: TicketStatus;
  priority: 'low' | 'medium' | 'high';
  category?: string;
  adminResponse?: string;
  createdAt: any;
  updatedAt: any;
}

export interface EarningsHistory {
  id: string;
  type: 'booking_earning' | 'reward_credit' | 'adjustment';
  amount: number;
  credits: number;
  reason?: string;
  bookingId?: string;
  createdAt: any;
}

export type BookingStatus = 'pending' | 'pending_parts' | 'confirmed' | 'assigned' | 'on_the_way' | 'arrived' | 'in_progress' | 'completed' | 'cancelled' | 'finalized' | 'closed' | 'payment_pending' | 'pending_acceptance' | 'Pending - Customer Unresponsive';

export interface AdditionalCharge {
  amount: number;
  reason: string;
  createdAt: any;
}

export interface Booking {
  id: string;
  customerId: string;
  partnerId?: string;
  serviceId: string;
  status: BookingStatus;
  paymentStatus: 'unpaid' | 'paid';
  paymentMethod?: 'online' | 'cash';
  paymentIntentId?: string;
  scheduledAt: any; // Firestore Timestamp
  address: string;
  lat?: number;
  lng?: number;
  totalPrice: number; // This will now represent the base price + any approved/added charges
  additionalCharges?: AdditionalCharge[];
  cancellationReason?: string;
  pendingReason?: string;
  pendingResolveDate?: any;
  pendingResolveDuration?: string;
  previousStatus?: BookingStatus;
  serviceOtp?: string;
  otpVerified?: boolean;
  createdAt: any;
  updatedAt: any;
  partnerPriority?: 'high' | 'medium' | 'low';
  completedTasks?: string[];
  adminNotes?: string;
  isPriority?: boolean;
  notes?: string;
  discountApplied?: number;
  promoCode?: string | null;
  isAmcBooking?: boolean;
  amcId?: string | null;
  activeCall?: ActiveCallInfo | null;
  completionPhotos?: string[];
  secondaryContact?: string;
}

export interface ActiveCallInfo {
  callerId: string;
  callerName: string;
  status: 'ringing' | 'connected' | 'ended';
  timestamp: any;
  endedBy?: string;
}

export interface Promotion {
  id: string;
  name: string;
  code: string;
  discountType: 'percent' | 'flat';
  discountValue: number;
  description: string;
  expiryDate?: any;
  usageLimit?: number;
  usageCount?: number;
  imageUrl?: string;
  active: boolean;
  applicableCategories?: string[];
  applicableServices?: string[];
  targetAudience?: 'customer' | 'partner' | 'all';
  createdAt: any;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  order?: number;
  isPublished: boolean;
  createdAt: any;
  popularity?: number;
  helpfulCount?: number;
  notHelpfulCount?: number;
}

export interface Review {
  id: string;
  bookingId: string;
  customerId: string;
  partnerId: string;
  serviceId?: string;
  rating: number;
  comment: string;
  photos?: string[];
  partnerReply?: string;
  partnerReplyCreatedAt?: any;
  createdAt: any;
}

export interface Redemption {
  id: string;
  userId: string;
  promotionId: string;
  redeemedAt: any;
  status: 'active' | 'used';
  appliedCategoryId?: string;
  appliedServiceId?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: any;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  amount: number;
  type: 'credit' | 'debit';
  reason: string;
  referenceId?: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: any;
}

export type AMCStatus = 'active' | 'expired' | 'pending_renewal' | 'cancelled' | 'pending_payment';

export interface AMC {
  id: string;
  customerId: string;
  partnerId?: string; // Lead generator
  serviceId: string;
  planName: string;
  description: string;
  frequency: number; // number of services per year
  startDate: any;
  endDate: any;
  totalPrice: number;
  status: AMCStatus;
  leadSource: 'customer_direct' | 'partner_lead' | 'admin_manual';
  partnerCommission?: number;
  serviceBookingIds: string[]; // List of bookings completed under this AMC
  scheduledDates: any[]; // Expected dates for preventive maintenance
  notes?: string;
  createdAt: any;
  updatedAt: any;
}
