/**
 * Global 12-Hour AM/PM Time Formatter & Ecosystem Time Utilities
 * Standardizes time representations and snaps booking slots to standard platform slots:
 * ['09:00 AM', '11:00 AM', '01:00 PM', '03:00 PM', '05:00 PM', '07:00 PM']
 */

export const STANDARD_BOOKING_SLOTS = [
  '09:00 AM',
  '10:00 AM',
  '11:00 AM',
  '01:00 PM',
  '03:00 PM',
  '05:00 PM',
  '07:00 PM',
  '09:00 PM'
] as const;

export const STANDARD_SLOT_MINUTES = [
  { slot: '09:00 AM', minutes: 9 * 60 },      // 540
  { slot: '10:00 AM', minutes: 10 * 60 },     // 600
  { slot: '11:00 AM', minutes: 11 * 60 },     // 660
  { slot: '01:00 PM', minutes: 13 * 60 },     // 780
  { slot: '03:00 PM', minutes: 15 * 60 },     // 900
  { slot: '05:00 PM', minutes: 17 * 60 },     // 1020
  { slot: '07:00 PM', minutes: 19 * 60 },     // 1140
  { slot: '09:00 PM', minutes: 21 * 60 }      // 1260
] as const;

/**
 * Snaps any timestamp, date, or arbitrary time string to the nearest standard platform booking slot.
 */
export function snapToStandardSlot(timeInput: any): string {
  if (timeInput === null || timeInput === undefined || timeInput === "") {
    return '11:00 AM';
  }

  // If already an exact standard slot
  const strTrim = String(timeInput).trim();
  const exactMatch = STANDARD_BOOKING_SLOTS.find(
    s => s.toLowerCase() === strTrim.toLowerCase()
  );
  if (exactMatch) return exactMatch;

  let totalMinutes = -1;

  // Handle Firestore Timestamp or object with .toDate()
  if (typeof timeInput === "object" && typeof timeInput.toDate === "function") {
    const d: Date = timeInput.toDate();
    totalMinutes = d.getHours() * 60 + d.getMinutes();
  } else if (timeInput instanceof Date) {
    totalMinutes = timeInput.getHours() * 60 + timeInput.getMinutes();
  } else if (typeof timeInput === "object" && typeof timeInput.seconds === "number") {
    const d = new Date(timeInput.seconds * 1000);
    totalMinutes = d.getHours() * 60 + d.getMinutes();
  } else {
    const str = String(timeInput).trim();

    // Check 12-hour AM/PM e.g. "09:48 PM", "9:48 pm", "3:00 PM"
    const amPmMatch = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)$/i);
    if (amPmMatch) {
      let hours = parseInt(amPmMatch[1], 10);
      const minutes = parseInt(amPmMatch[2], 10);
      const isPM = amPmMatch[4].toLowerCase() === 'pm';
      if (isPM && hours < 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;
      totalMinutes = hours * 60 + minutes;
    } else {
      // Check 24-hour "HH:MM" e.g. "15:00", "21:48", "09:00"
      const time24Match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
      if (time24Match) {
        const hours = parseInt(time24Match[1], 10);
        const minutes = parseInt(time24Match[2], 10);
        totalMinutes = hours * 60 + minutes;
      } else if (str.includes("T") || (str.includes("-") && str.includes(":")) || (str.includes("/") && str.includes(":"))) {
        const parsed = new Date(str);
        if (!isNaN(parsed.getTime())) {
          totalMinutes = parsed.getHours() * 60 + parsed.getMinutes();
        }
      }
    }
  }

  if (totalMinutes < 0) {
    return '11:00 AM';
  }

  // Find nearest slot
  let closestSlot: string = STANDARD_BOOKING_SLOTS[0];
  let minDiff = Infinity;

  for (const s of STANDARD_SLOT_MINUTES) {
    const diff = Math.abs(s.minutes - totalMinutes);
    if (diff < minDiff) {
      minDiff = diff;
      closestSlot = s.slot;
    }
  }

  return closestSlot;
}

/**
 * Standardized booking time formatter that strictly resolves all booking times
 * to the platform's standard time slots.
 */
export function formatBookingTime(timeInput: any): string {
  if (timeInput === null || timeInput === undefined || timeInput === "") {
    return '11:00 AM';
  }
  return snapToStandardSlot(timeInput);
}

/**
 * Formats any raw 24-hr time string ("15:00"), ISO date string, Timestamp, or Date instance into "hh:mm A" (12-hour format).
 * Automatically snaps legacy/arbitrary times to standard slots if snapToStandard is true.
 */
export function formatTime12Hour(timeInput: any, snapToStandard: boolean = true): string {
  if (timeInput === null || timeInput === undefined || timeInput === "") return "";

  if (snapToStandard) {
    return snapToStandardSlot(timeInput);
  }

  // Handle Firestore Timestamp or object with .toDate()
  if (typeof timeInput === "object" && typeof timeInput.toDate === "function") {
    const d: Date = timeInput.toDate();
    return formatTime12HourFromDate(d);
  }

  // Handle Date instance
  if (timeInput instanceof Date) {
    return formatTime12HourFromDate(timeInput);
  }

  // Handle seconds timestamp object { seconds: 123456789 }
  if (typeof timeInput === "object" && typeof timeInput.seconds === "number") {
    const d = new Date(timeInput.seconds * 1000);
    return formatTime12HourFromDate(d);
  }

  const str = String(timeInput).trim();
  if (!str) return "";

  // If already formatted like "03:00 PM" or "3:00 pm"
  const amPmMatch = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm|AM|PM)$/i);
  if (amPmMatch) {
    let hours = parseInt(amPmMatch[1], 10);
    const minutes = amPmMatch[2];
    const period = amPmMatch[4].toUpperCase();
    if (hours === 0) hours = 12;
    return `${String(hours).padStart(2, "0")}:${minutes} ${period}`;
  }

  // Check 24-hour time "HH:MM" or "HH:MM:SS" (e.g. "15:00", "21:48", "09:00", "9:30")
  const time24Match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (time24Match) {
    let hours = parseInt(time24Match[1], 10);
    const minutes = time24Match[2];
    const period = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return `${String(hours).padStart(2, "0")}:${minutes} ${period}`;
  }

  // Check ISO string or date-time string (e.g., "2026-08-16T15:00:00" or "2026-08-16 15:00")
  if (str.includes("T") || (str.includes("-") && str.includes(":")) || (str.includes("/") && str.includes(":"))) {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return formatTime12HourFromDate(parsed);
    }
  }

  return str;
}

/**
 * Extracts and formats time from a JavaScript Date in clean 12-Hour AM/PM format
 */
export function formatTime12HourFromDate(d: Date): string {
  if (!d || isNaN(d.getTime())) return "";
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const period = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${String(hours).padStart(2, "0")}:${minutes} ${period}`;
}

/**
 * Formats a timestamp/date into combined readable date + standard 12-hour time (e.g., "Aug 16, 2026 at 03:00 PM")
 */
export function formatDateTime12Hour(input: any): string {
  if (!input && input !== 0) return "";
  let d: Date | null = null;
  if (typeof input?.toDate === "function") {
    d = input.toDate();
  } else if (input instanceof Date) {
    d = input;
  } else if (typeof input?.seconds === "number") {
    d = new Date(input.seconds * 1000);
  } else {
    d = new Date(input);
  }

  if (!d || isNaN(d.getTime())) return String(input || "");
  const datePart = d.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
  const timePart = snapToStandardSlot(d);
  return `${datePart} at ${timePart}`;
}

/**
 * Formats date into readable string like "16 Aug 2026"
 */
export function formatDate(dateInput: any): string {
  if (!dateInput && dateInput !== 0) return "N/A";
  let d: Date;
  if (typeof dateInput === "object" && typeof dateInput.toDate === "function") {
    d = dateInput.toDate();
  } else if (dateInput?.seconds) {
    d = new Date(dateInput.seconds * 1000);
  } else if (dateInput instanceof Date) {
    d = dateInput;
  } else {
    d = new Date(dateInput);
  }

  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Formats notification / relative timestamps (e.g., 'Just now', '5m ago', '2h ago', 'Yesterday', or '16 Aug, 10:30 AM')
 */
export function formatNotificationTime(createdAt: any): string {
  if (!createdAt) return 'Just now';
  let date: Date;
  if (typeof createdAt?.toDate === 'function') {
    date = createdAt.toDate();
  } else if (createdAt?.seconds) {
    date = new Date(createdAt.seconds * 1000);
  } else if (createdAt instanceof Date) {
    date = createdAt;
  } else if (typeof createdAt === 'string' || typeof createdAt === 'number') {
    date = new Date(createdAt);
  } else {
    return 'Just now';
  }

  if (isNaN(date.getTime())) return 'Just now';

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 172800) return 'Yesterday';

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

