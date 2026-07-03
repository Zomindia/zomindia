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

  const isPartner = profile.isPartner === true || profile.role === 'partner';

  if (isPartner) {
    const partnerData = {
      partnerId: profile.partnerId || profile.uid || "",
      bio: profile.bio || "",
      status: profile.role === 'partner' ? 'active' : 'inactive',
      rating: 4.9,
      reviewCount: 0,
      isVerified: profile.role === 'partner' || false,
      kycStatus: profile.partnerData?.kycStatus || (profile.role === 'partner' ? 'verified' : 'pending'),
      ...profile.partnerData
    };

    return {
      ...profile,
      isPartner: true,
      currentMode: profile.currentMode || 'partner',
      customerData,
      partnerData
    };
  } else {
    const { partnerData, ...rest } = profile;
    return {
      ...rest,
      isPartner: false,
      currentMode: profile.currentMode || 'customer',
      customerData
    };
  }
}
