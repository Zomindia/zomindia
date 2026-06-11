import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'English' | 'Hindi' | 'Marathi' | 'Tamil';

export interface Translations {
  appName: string;
  subtitle: string;
  searchPlaceholder: string;
  bookNow: string;
  bookings: string;
  profile: string;
  history: string;
  notification: string;
  home: string;
  category: string;
  wallet: string;
  amcContracts: string;
  referrals: string;
  helpSupport: string;
  activeStatus: string;
  verifiedPartner: string;
  kycPending: string;
  enterOtp: string;
  startJob: string;
  finishJob: string;
  collectPayment: string;
  ratingReviews: string;
  aboutUs: string;
  termsPrivacy: string;
  saveChanges: string;
  supportTicket: string;
  priceStart: string;
  bookingStatus: {
    pending: string;
    confirmed: string;
    assigned: string;
    on_the_way: string;
    arrived: string;
    in_progress: string;
    completed: string;
    cancelled: string;
  };
  categories: {
    [key: string]: string;
  };
}

const translations: Record<Language, Translations> = {
  English: {
    appName: "zomindia",
    subtitle: "Premium Professional Home Services on Demand",
    searchPlaceholder: "Search for AC service, cleaning, painters, plumbers...",
    bookNow: "Book Now",
    bookings: "My Bookings",
    profile: "Profile Settings",
    history: "Service History",
    notification: "Notifications",
    home: "Home",
    category: "Categories",
    wallet: "ZomIndia Wallet",
    amcContracts: "AMC Contracts",
    referrals: "Refer & Earn",
    helpSupport: "Help & Tickets",
    activeStatus: "Active",
    verifiedPartner: "Verified Practitioner Pro",
    kycPending: "KYC Pending Verification",
    enterOtp: "Enter Start OTP",
    startJob: "Verify & Start Job",
    finishJob: "Mark As Completed",
    collectPayment: "Process Settlement",
    ratingReviews: "Ratings & Customer Reviews",
    aboutUs: "About Us",
    termsPrivacy: "Terms & Privacy Policy",
    saveChanges: "Save Changes",
    supportTicket: "Raise New Help Ticket",
    priceStart: "Starts from",
    bookingStatus: {
      pending: "Awaiting Confirmation",
      confirmed: "Scheduled",
      assigned: "Partner Assigned",
      on_the_way: "Partner En Route",
      arrived: "Partner Arrived",
      in_progress: "Servicing In Progress",
      completed: "Completed & Closed",
      cancelled: "Cancelled"
    },
    categories: {
      "cleaning": "Cleaning & Pest Control",
      "appliances": "AC & Appliance Repair",
      "carpentry": "Carpentry & Repairs",
      "electrical": "Electrician Services",
      "plumbing": "Professional Plumbing",
      "painting": "Home Painting & Decorating"
    }
  },
  Hindi: {
    appName: "ज़ोमइंडिया",
    subtitle: "मांग पर प्रीमियम पेशेवर गृह सेवाएं",
    searchPlaceholder: "एसी सर्विस, सफाई, पेंटर, प्लंबर खोजें...",
    bookNow: "अभी बुक करें",
    bookings: "मेरी बुकिंग",
    profile: "प्रोफ़ाइल सेटिंग्स",
    history: "सेवा इतिहास",
    notification: "सूचनाएं",
    home: "मुख्य पृष्ठ",
    category: "श्रेणियां",
    wallet: "ज़ोमइंडिया वॉलेट",
    amcContracts: "एएमसी वार्षिक अनुबंध",
    referrals: "रेफर करें और कमाएं",
    helpSupport: "सहायता और टिकट",
    activeStatus: "सक्रिय",
    verifiedPartner: "सत्यापित पेशेवर पार्टनर",
    kycPending: "केवाईसी सत्यापन लंबित",
    enterOtp: "स्टार्ट ओटीपी दर्ज करें",
    startJob: "ओटीपी सत्यापित करें",
    finishJob: "कार्य पूर्ण चिह्नित करें",
    collectPayment: "भुगतान प्राप्त करें",
    ratingReviews: "रेटिंग और ग्राहक समीक्षाएं",
    aboutUs: "हमारे बारे में",
    termsPrivacy: "नियम और गोपनीयता नीति",
    saveChanges: "परिवर्तन सहेजें",
    supportTicket: "नया सहायता टिकट बनाएं",
    priceStart: "शुरुआती कीमत",
    bookingStatus: {
      pending: "पुष्टि की प्रतीक्षा है",
      confirmed: "निर्धारित समय",
      assigned: "पार्टनर आवंटित",
      on_the_way: "पार्टनर रास्ते में है",
      arrived: "पार्टनर पहुँच गया है",
      in_progress: "सेवा चल रही है",
      completed: "पूर्ण और बंद",
      cancelled: "रद्द किया गया"
    },
    categories: {
      "cleaning": "सफाई और कीट नियंत्रण",
      "appliances": "एसी और उपकरण मरम्मत",
      "carpentry": "बढ़ईगीरी और मरम्मत",
      "electrical": "इलेक्ट्रीशियन सेवाएं",
      "plumbing": "व्यावसायिक प्लंबिंग",
      "painting": "घर की पेंटिंग और सजावट"
    }
  },
  Marathi: {
    appName: "झोमइंडिया",
    subtitle: "मागणीनुसार प्रीमियम व्यावसायिक घरगुती सेवा",
    searchPlaceholder: "एसी सर्व्हिस, साफसफाई, पेंटर, प्लंबर शोधा...",
    bookNow: "आता बुक करा",
    bookings: "माझ्या बुकिंग्स",
    profile: "प्रोफाइल सेटिंग्ज",
    history: "सेवा इतिहास",
    notification: "सूचना",
    home: "मुख्य पान",
    category: "श्रेणी",
    wallet: "झोमइंडिया वॉलेट",
    amcContracts: "एएमसी वार्षिक करार",
    referrals: "रेफर करा आणि कमवा",
    helpSupport: "मदत आणि तिकिटे",
    activeStatus: "सक्रिय",
    verifiedPartner: "प्रमाणित व्यावसायिक भागीदार",
    kycPending: "केवायसी पडताळणी प्रलंबित",
    enterOtp: "स्टार्ट ओटीपी टाका",
    startJob: "ओटीपी पडताळणी करा",
    finishJob: "काम पूर्ण घोषित करा",
    collectPayment: "पेमेंट गोळा करा",
    ratingReviews: "रेटिंग आणि ग्राहक पुनरावलोकने",
    aboutUs: "आमच्याबद्दल",
    termsPrivacy: "नियम आणि गोपनीयता धोरण",
    saveChanges: "बदल जतन करा",
    supportTicket: "नवीन मदत तिकीट तयार करा",
    priceStart: "पासून सुरुवात",
    bookingStatus: {
      pending: "पुष्टीकरणाची प्रतीक्षा आहे",
      confirmed: "नियोजित",
      assigned: "भागीदार नियुक्त",
      on_the_way: "भागीदार येत आहे",
      arrived: "भागीदार पोहोचला आहे",
      in_progress: "सेवा सुरू आहे",
      completed: "पूर्ण आणि बंद",
      cancelled: "रद्द केले"
    },
    categories: {
      "cleaning": "साफसफाई आणि कीटक नियंत्रण",
      "appliances": "एसी आणि उपकरणे दुरुस्ती",
      "carpentry": "सुतारकाम आणि दुरुस्ती",
      "electrical": "इलेक्ट्रीशियन सेवा",
      "plumbing": "व्यावसायिक प्लंबिंग",
      "painting": "घरची पेंटिंग आणि सजावट"
    }
  },
  Tamil: {
    appName: "ஜோம்இந்தியா",
    subtitle: "தேவையின் பேரில் பிரீமியம் தொழில்முறை வீட்டு சேவைகள்",
    searchPlaceholder: "ஏசி சேவை, துப்புரவு, பெயிண்டர்கள், பிளம்பர்கள் தேடுக...",
    bookNow: "இப்போது பதிவு செய்க",
    bookings: "என் பதிவுகள்",
    profile: "சுயவிவர அமைப்புகள்",
    history: "சேவை வரலாறு",
    notification: "அறிவிப்புகள்",
    home: "முகப்பு",
    category: "வகைகள்",
    wallet: "ஜோம்இந்தியா வாலட்",
    amcContracts: "ஏஎம்சி ஒப்பந்தங்கள்",
    referrals: "பரிந்துரைத்து சம்பாதிக்க",
    helpSupport: "உதவி & டிக்கெட்டுகள்",
    activeStatus: "செயலில் உள்ளது",
    verifiedPartner: "சரிபார்க்கப்பட்ட தொழில்முறை நிபுணர்",
    kycPending: "கேஒய்சி சரிபார்ப்பு நிலுவையில் உள்ளது",
    enterOtp: "தொடங்குவதற்கான ஒடிபி உள்ளிடுக",
    startJob: "ஒடிபி சரிபார்த்து தொடங்குக",
    finishJob: "முடிந்தது என குறிக்கவும்",
    collectPayment: "கட்டணம் பெறவும்",
    ratingReviews: "மதிப்பீடுகள் & விமர்சனங்கள்",
    aboutUs: "எங்களைப் பற்றி",
    termsPrivacy: "விதிமுறைகள் மற்றும் தனியுரிமைக் கொள்கை",
    saveChanges: "மாற்றங்களைச் சேமிக்கவும்",
    supportTicket: "புதிய உதவி டிக்கெட்டை உருவாக்கவும்",
    priceStart: "இருந்து தொடங்குகிறது",
    bookingStatus: {
      pending: "உறுதிப்படுத்தலுக்காக காத்திருக்கிறது",
      confirmed: "திட்டமிடப்பட்டது",
      assigned: "பங்குதாரர் நியமிக்கப்பட்டார்",
      on_the_way: "பங்குதாரர் வழியில் உள்ளார்",
      arrived: "பங்குதாரர் வந்து சேர்ந்தார்",
      in_progress: "சேவை நடந்து கொண்டிருக்கிறது",
      completed: "நிறைவடைந்தது & மூடப்பட்டது",
      cancelled: "ரத்து செய்யப்பட்டது"
    },
    categories: {
      "cleaning": "சுத்தம் செய்தல் மற்றும் பூச்சி கட்டுப்பாடு",
      "appliances": "ஏசி மற்றும் வீட்டு உபயோக சாதனங்கள் பழுதுபார்ப்பு",
      "carpentry": "தச்சன் வேலை மற்றும் பழுதுபார்ப்பு",
      "electrical": "மின்சார சேவைகள்",
      "plumbing": "தொழில்முறை பிளம்பிங்",
      "painting": "வீட்டு வண்ணம் பூசுதல் & அலங்காரம்"
    }
  }
};

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language] = useState<Language>('English');

  const setLanguage = (lang: Language) => {
    // Multi-Language Swapping is removed; keep it as a no-op to prevent typescript errors
  };

  const t = translations.English;

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
};

// Simple visual picker
export const LanguagePicker: React.FC = () => {
  return null;
};
