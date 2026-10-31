export * from './formatTime';
export {
  isValidCustomerService,
  sanitizeCatalogText,
  DEFAULT_CATEGORIES,
  DEFAULT_SERVICES,
  getCanonicalCategoryKey,
  normalizeCategories,
  normalizeServiceItem,
  normalizeServicesList,
  getServiceRatingBadgeInfo,
  isFridgeService,
  isWashingMachineService,
  healFirestoreCatalogIfNeeded,
} from '../data/services';
