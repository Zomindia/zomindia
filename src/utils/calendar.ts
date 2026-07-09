/**
 * Helper to format Date objects into ISO 8601 basic format (YYYYMMDDTHHmmSSZ)
 */
export function formatToISO8601Basic(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * Generates a Google Calendar template URL
 */
export function generateGoogleCalendarUrl(params: {
  title: string;
  startDate: Date;
  endDate: Date;
  description: string;
  location: string;
}): string {
  const startStr = formatToISO8601Basic(params.startDate);
  const endStr = formatToISO8601Basic(params.endDate);
  
  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.append('action', 'TEMPLATE');
  url.searchParams.append('text', params.title);
  url.searchParams.append('dates', `${startStr}/${endStr}`);
  url.searchParams.append('details', params.description);
  url.searchParams.append('location', params.location);
  
  return url.toString();
}

export interface ICSEvent {
  title: string;
  description: string;
  location: string;
  startTime: Date;
  endTime: Date;
}

/**
 * Native client-side iCalendar (.ics) generator for Zomindia bookings.
 * RFC 5545 compliant, handles escaping, and triggers native client-side browser download.
 */
export function downloadICSFile(event: ICSEvent, filename: string = 'zomindia-booking.ics') {
  const startStr = formatToISO8601Basic(event.startTime);
  const endStr = formatToISO8601Basic(event.endTime);
  const stampStr = formatToISO8601Basic(new Date());
  const uid = `zomindia-${Date.now()}@zomindia.com`;

  // Escape special ICS characters (RFC 5545)
  const escapeIcsText = (text: string | undefined | null) => {
    if (!text) return '';
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  };

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Zomindia//Home Services//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stampStr}`,
    `DTSTART:${startStr}`,
    `DTEND:${endStr}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(event.description)}`,
    `LOCATION:${escapeIcsText(event.location)}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ];

  const icsContent = icsLines.join('\r\n');
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads a standard .ics calendar file for Apple Calendar or Outlook (legacy adapter)
 */
export function downloadIcsFile(params: {
  title: string;
  startDate: Date;
  endDate: Date;
  description: string;
  location: string;
  filename: string;
}) {
  downloadICSFile({
    title: params.title,
    description: params.description,
    location: params.location,
    startTime: params.startDate,
    endTime: params.endDate
  }, params.filename);
}

