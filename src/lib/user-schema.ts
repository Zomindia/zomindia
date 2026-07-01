import { UserProfile } from "../types";

export function buildDualPersonaUserDoc(profile: Partial<UserProfile> & { uid: string }) {
  const customerData = {
    fullName: profile.fullName || profile.displayName || "User",
    email: profile.email || "",
    phoneNumber: profile.phoneNumber || "",
    mobile: profile.mobile || profile.phoneNumber || "",
    walletBalance: profile.walletBalance !== undefined ? profile.walletBalance : 100,
    address: profile.address || "",
    gender: profile.gender || "",
    languagePreference: profile.languagePreference || "English",
    houseType: profile.houseType || "Apartment",
    bhkSize: profile.bhkSize || "2 BHK",
    preferredTimeSlot: profile.preferredTimeSlot || "Anytime",
    secondaryPhone: profile.secondaryPhone || "",
    referralCode: profile.referralCode || `ZOM${profile.uid.slice(0, 6).toUpperCase()}`
  };

  const partnerData = {
    partnerId: profile.partnerId || profile.uid || "",
    bio: profile.bio || "",
    status: profile.role === 'partner' ? 'active' : 'inactive',
    rating: 4.9,
    reviewCount: 0,
    isVerified: profile.role === 'partner' || false,
    kycStatus: profile.role === 'partner' ? 'verified' : 'pending'
  };

  return {
    ...profile,
    currentMode: profile.currentMode || (profile.role === 'partner' ? 'partner' : 'customer'),
    customerData,
    partnerData
  };
}
