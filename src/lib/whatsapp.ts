
export function getWhatsAppBookingLink(bookingId: string, serviceName: string, date: string, time: string) {
  const supportNumber = import.meta.env.VITE_WHATSAPP_SUPPORT_NUMBER || '';
  const template = import.meta.env.VITE_WHATSAPP_BOOKING_TEMPLATE || 'Hello, I have a booking confirmation for {service} on {date} at {time}. Booking ID: {id}';

  if (!supportNumber) return null;

  const text = template
    .replace('{service}', serviceName)
    .replace('{date}', date)
    .replace('{time}', time)
    .replace('{id}', bookingId.slice(0, 8).toUpperCase());

  return `https://wa.me/${supportNumber.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

export function getWhatsAppSupportLink(message?: string) {
  const supportNumber = import.meta.env.VITE_WHATSAPP_SUPPORT_NUMBER || '';
  if (!supportNumber) return null;

  const text = message || 'Hello, I need help with my zomindia service.';
  return `https://wa.me/${supportNumber.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}
