import { UserProfile } from "../types";

export function buildDualPersonaUserDoc(profile: Partial<UserProfile> & { uid: string }) {
  const rawBal = profile.walletBalance !== undefined ? Number(profile.walletBalance) : 101;
  const resolvedWalletBalance = (isNaN(rawBal) || rawBal === 600) ? 101 : rawBal;
  const customerData = {
    fullName: profile.fullName || profile.displayName || "User",
    email: profile.email || "",
    phoneNumber: profile.phoneNumber || "",
    mobile: profile.mobile || profile.phoneNumber || "",
    walletBalance: resolvedWalletBalance,
    welcomeBonusClaimed: true,
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
      walletBalance: resolvedWalletBalance,
      welcomeBonusClaimed: true,
      isPartner: true,
      currentMode: profile.currentMode || 'partner',
      customerData,
      partnerData
    };
  } else {
    const { partnerData, ...rest } = profile;
    return {
      ...rest,
      walletBalance: resolvedWalletBalance,
      welcomeBonusClaimed: true,
      isPartner: false,
      currentMode: profile.currentMode || 'customer',
      customerData
    };
  }
}
