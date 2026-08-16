/**
 * Global 12-Hour AM/PM Time Formatter & Ecosystem Time Utilities
 * Standardizes time representations (e.g. "15:00" -> "03:00 PM", "21:48" -> "09:48 PM", "09:00" -> "09:00 AM")
 */

/**
 * Formats any raw 24-hr time string ("15:00"), ISO date string, Timestamp, or Date instance into "hh:mm A" (12-hour format).
 */
export function formatTime12Hour(timeInput: any): string {
  if (timeInput === null || timeInput === undefined || timeInput === "") return "";

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
 * Formats a timestamp/date into combined readable date + 12-hour time (e.g., "Aug 16, 2026 at 03:00 PM")
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
  const timePart = formatTime12HourFromDate(d);
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
