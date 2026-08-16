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
