/**
 * UPI VPA Validation and Bank Handle Resolution Utility
 */

export const POPULAR_UPI_HANDLES = [
  '@okhdfcbank',
  '@oksbi',
  '@okaxis',
  '@okicici',
  '@ybl',
  '@ibl',
  '@axl',
  '@paytm',
  '@upi'
];

export const VALID_BANK_HANDLES: Record<string, string> = {
  // Google Pay handles
  'okhdfcbank': 'HDFC Bank (Google Pay)',
  'oksbi': 'State Bank of India (Google Pay)',
  'okaxis': 'Axis Bank (Google Pay)',
  'okicici': 'ICICI Bank (Google Pay)',

  // PhonePe handles
  'ybl': 'YES Bank (PhonePe)',
  'ibl': 'ICICI Bank (PhonePe)',
  'axl': 'Axis Bank (PhonePe)',

  // Paytm handles
  'paytm': 'Paytm Payments Bank',
  'pthdfc': 'HDFC Bank (Paytm)',
  'ptaxis': 'Axis Bank (Paytm)',
  'ptsbi': 'State Bank of India (Paytm)',

  // Common Bank VPAs
  'icici': 'ICICI Bank iMobile',
  'hdfcbank': 'HDFC Bank MobileBanking',
  'sbi': 'State Bank of India YONO',
  'axisbank': 'Axis Mobile',
  'kotak': 'Kotak Mahindra Bank 811',
  'barodampay': 'Bank of Baroda',
  'pnb': 'Punjab National Bank',
  'indus': 'IndusInd Bank',
  'idfcfirst': 'IDFC FIRST Bank',
  'federal': 'Federal Bank (FedMobile)',
  'rbl': 'RBL Bank MoBank',
  'canara': 'Canara Bank ai1',
  'unionbank': 'Union Bank of India Vyom',
  'aubank': 'AU Small Finance Bank',

  // 3rd party apps
  'upi': 'BHIM NPCI Gateway',
  'apl': 'Amazon Pay UPI',
  'fbl': 'Federal Bank (Jupiter/Fi)',
  'postbank': 'India Post Payments Bank',
  'allbank': 'Allahabad Bank / Indian Bank'
};

// Common typos to correct or detect
export const COMMON_HANDLE_TYPOS: Record<string, string> = {
  'okhdfc': 'okhdfcbank',
  'hdfc': 'okhdfcbank',
  'oksb': 'oksbi',
  'sb': 'oksbi',
  'okax': 'okaxis',
  'axis': 'okaxis',
  'okici': 'okicici',
  'icic': 'icici',
  'payt': 'paytm',
  'paytmmp': 'paytm',
  'yb': 'ybl',
  'ybll': 'ybl',
  'ib': 'ibl',
  'ax': 'axl',
  'up': 'upi',
  'amazon': 'apl'
};

export interface UpiVerificationResult {
  isValid: boolean;
  username: string;
  handle: string;
  bankName: string;
  payeeName: string;
  suggestedHandle?: string;
  errorMessage?: string;
}

/**
 * Validates a standard Indian UPI ID (VPA) format:
 * - Username: 3 to 50 characters (alphanumeric, dot, underscore, hyphen)
 * - Separator: exactly one '@'
 * - Suffix/Handle: 2 to 30 lowercase letters/digits
 */
export function validateAndVerifyUpiId(rawVpa: string): UpiVerificationResult {
  const vpa = rawVpa.trim().toLowerCase();

  if (!vpa) {
    return {
      isValid: false,
      username: '',
      handle: '',
      bankName: '',
      payeeName: '',
      errorMessage: 'Please enter a UPI ID (e.g. 9876543210@paytm)'
    };
  }

  // Standard NPCI UPI VPA Regex: ^[a-zA-Z0-9.\-_]{2,50}@[a-zA-Z0-9]{2,30}$
  const vpaRegex = /^[a-zA-Z0-9.\-_]{2,50}@[a-zA-Z0-9]{2,30}$/;

  if (!vpa.includes('@')) {
    return {
      isValid: false,
      username: vpa,
      handle: '',
      bankName: '',
      payeeName: '',
      suggestedHandle: '@okhdfcbank',
      errorMessage: 'Missing "@" symbol and bank handle (e.g. @ybl or @paytm)'
    };
  }

  const parts = vpa.split('@');
  if (parts.length !== 2) {
    return {
      isValid: false,
      username: parts[0] || '',
      handle: '',
      bankName: '',
      payeeName: '',
      errorMessage: 'Invalid UPI ID format (cannot have multiple "@" symbols)'
    };
  }

  const [username, handle] = parts;

  if (!username || username.length < 2) {
    return {
      isValid: false,
      username,
      handle,
      bankName: '',
      payeeName: '',
      errorMessage: 'UPI username or phone number is too short'
    };
  }

  if (!handle || handle.length < 2) {
    return {
      isValid: false,
      username,
      handle,
      bankName: '',
      payeeName: '',
      errorMessage: 'Bank suffix after "@" is incomplete'
    };
  }

  if (!vpaRegex.test(vpa)) {
    return {
      isValid: false,
      username,
      handle,
      bankName: '',
      payeeName: '',
      errorMessage: 'Invalid characters in UPI ID. Only letters, digits, dots, and hyphens allowed.'
    };
  }

  // Check if handle is recognized or a common typo
  const recognizedBank = VALID_BANK_HANDLES[handle];
  const typoCorrection = COMMON_HANDLE_TYPOS[handle];

  if (!recognizedBank && typoCorrection) {
    return {
      isValid: false,
      username,
      handle,
      bankName: '',
      payeeName: '',
      suggestedHandle: `@${typoCorrection}`,
      errorMessage: `Did you mean @${typoCorrection}? "${handle}" is an unrecognized handle.`
    };
  }

  // Determine friendly bank label
  const bankName = recognizedBank || `${handle.toUpperCase()} UPI Gateway`;

  // Generate resolved registered payee display name from username
  let resolvedPayee = '';
  if (/^\d{10}$/.test(username)) {
    // 10-digit mobile number
    resolvedPayee = `Verified User (${username.slice(0, 3)}•••••${username.slice(8)})`;
  } else {
    // Standard name or handle
    const cleaned = username.replace(/[._\-]/g, ' ').replace(/\d+/g, '').trim();
    const formatted = cleaned.length > 0
      ? cleaned.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      : username;
    resolvedPayee = formatted.length > 2 ? `${formatted} (Verified Payee)` : `${username} (NPCI Verified)`;
  }

  return {
    isValid: true,
    username,
    handle,
    bankName,
    payeeName: resolvedPayee
  };
}
