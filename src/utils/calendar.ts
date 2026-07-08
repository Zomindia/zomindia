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

/**
 * Downloads a standard .ics calendar file for Apple Calendar or Outlook
 */
export function downloadIcsFile(params: {
  title: string;
  startDate: Date;
  endDate: Date;
  description: string;
  location: string;
  filename: string;
}) {
  const startStr = formatToISO8601Basic(params.startDate);
  const endStr = formatToISO8601Basic(params.endDate);
  const stampStr = formatToISO8601Basic(new Date());
  const uid = `zomindia-${Date.now()}@zomindia.com`;

  // Escape special ICS characters
  const escapeIcsText = (text: string) => {
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
    `SUMMARY:${escapeIcsText(params.title)}`,
    `DESCRIPTION:${escapeIcsText(params.description)}`,
    `LOCATION:${escapeIcsText(params.location)}`,
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
  link.setAttribute('download', params.filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
