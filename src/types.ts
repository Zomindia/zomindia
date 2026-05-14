export type UserRole = 'customer' | 'partner' | 'admin';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  phoneNumber?: string;
  photoURL?: string;
  address?: string;
  bio?: string;
  notificationPreferences?: {
    bookingUpdates: boolean;
    promotionalMessages: boolean;
  };
  createdAt: any;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  imageURL?: string;
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
  updatedAt?: any;
}

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  message: string;
  status: TicketStatus;
  priority: 'low' | 'medium' | 'high';
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

export type BookingStatus = 'pending' | 'pending_parts' | 'confirmed' | 'assigned' | 'on_the_way' | 'arrived' | 'in_progress' | 'completed' | 'cancelled' | 'finalized' | 'closed';

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
}

export interface Review {
  id: string;
  bookingId: string;
  customerId: string;
  partnerId: string;
  serviceId?: string;
  rating: number;
  comment: string;
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
