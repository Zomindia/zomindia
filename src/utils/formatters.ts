import { Service } from '../types';

export * from './formatTime';

export const isValidCustomerService = (s: Partial<Service> | null | undefined): boolean => {
  if (!s || !s.name) return false;
  const nameLower = s.name.toLowerCase().trim();
  const price = Number(s.basePrice) || 0;
  if (nameLower.length === 0) return false;
  if (nameLower.includes('chek') || nameLower.includes('check')) return false;
  if (nameLower.includes('jjust') || nameLower.includes('just for')) return false;
  if (nameLower.includes('test') || nameLower.includes('dummy')) return false;
  if (price <= 15) return false;
  return true;
};
