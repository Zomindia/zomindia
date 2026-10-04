import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MapPin,
  Crosshair,
  Search,
  X,
  Check,
  ChevronRight,
  Loader2,
  Building2,
  Sparkles,
} from 'lucide-react';
import {
  reverseGeocode,
  findNearestIndoreLocality,
  INDORE_REFERENCE_POINTS,
} from '../utils/reverseGeocode';
import { INDORE_TOP_PRIME_AREAS } from '../utils/indoreDemandAreas';

// 9 Popular Indore localities explicitly required
export const POPULAR_INDORE_LOCALITIES = [
  'Vijay Nagar',
  'Palasia',
  'Bhawarkua',
  'Rajwada',
  'Nipania',
  'Mahalaxmi Nagar',
  'Rau',
  'Annapurna',
  'Super Corridor',
] as const;

// Combined comprehensive list of Indore areas for the search input
const ALL_INDORE_AREAS: string[] = Array.from(
  new Set([
    ...POPULAR_INDORE_LOCALITIES,
    ...INDORE_REFERENCE_POINTS.map((p) => p.name),
    ...INDORE_TOP_PRIME_AREAS,
    'Bengali Square',
    'Sudama Nagar',
    'Geeta Bhawan',
    'Sapna Sangeeta',
    'Tilak Nagar',
    'Saket',
    'Scheme 54',
    'Scheme 78',
    'Scheme 74',
    'Manoramaganj',
    'Bicholi Mardana',
    'LIG Colony',
    'Chhatribagh',
    'Pardesipura',
    'Silicon City',
    'Rajendra Nagar',
    'Kanadia Road',
    'AB Road',
    'Bypass Road',
  ])
).sort((a, b) => a.localeCompare(b));

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLocation: string;
  onSelectLocation: (location: string) => void;
  onOpenCitySelector?: () => void;
}

export function LocationPickerModal({
  isOpen,
  onClose,
  currentLocation,
  onSelectLocation,
  onOpenCitySelector,
}: LocationPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Reset states on open/close
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setGeoError(null);
      setIsDetectingLocation(false);
    }
  }, [isOpen]);

  // Filtered areas based on search input
  const filteredAreas = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return [];
    return ALL_INDORE_AREAS.filter((area) =>
      area.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Safe browser geolocation detection
  const handleUseCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setGeoError('GPS Geolocation is not supported by your browser.');
      return;
    }

    setIsDetectingLocation(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          
          // First try reverse geocode
          const geoResult = await reverseGeocode(latitude, longitude);
          let detectedLocality = '';

          if (geoResult && geoResult.area && !geoResult.area.toLowerCase().includes('indore city')) {
            detectedLocality = geoResult.area;
          } else {
            // High-accuracy fallback to nearest reference locality in Indore
            detectedLocality = findNearestIndoreLocality(latitude, longitude);
          }

          // Clean locality format
          const formattedLocation = detectedLocality.toLowerCase().includes('indore')
            ? detectedLocality
            : `${detectedLocality}, Indore`;

          onSelectLocation(formattedLocation);
          onClose();
        } catch (err) {
          console.warn('[LocationPicker] Reverse geocode error, using default nearest:', err);
          const fallback = 'Vijay Nagar, Indore';
          onSelectLocation(fallback);
          onClose();
        } finally {
          setIsDetectingLocation(false);
        }
      },
      (error) => {
        setIsDetectingLocation(false);
        if (error.code === error.PERMISSION_DENIED) {
          setGeoError('Location permission denied. Please pick your area below.');
        } else if (error.code === error.TIMEOUT) {
          setGeoError('Location detection timed out. Please pick your area below.');
        } else {
          setGeoError('Unable to detect current GPS location. Please pick your area.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 60000,
      }
    );
  };

  const handlePickArea = (area: string) => {
    const formatted = area.toLowerCase().includes('indore') ? area : `${area}, Indore`;
    onSelectLocation(formatted);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            id="location-picker-backdrop"
          />

          {/* Modal / BottomSheet */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="relative w-full sm:max-w-lg bg-white rounded-t-[32px] sm:rounded-[28px] overflow-hidden shadow-2xl flex flex-col max-h-[85vh] z-10 border border-slate-100"
            id="location-picker-container"
          >
            {/* Grab bar on mobile */}
            <div className="sm:hidden flex justify-center pt-3 pb-1">
              <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100/60">
                  <MapPin size={20} className="stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                    Choose Your Location
                  </h3>
                  <p className="text-slate-400 text-xs font-semibold mt-0.5 flex items-center gap-1">
                    <span>Indore, Madhya Pradesh</span>
                    <span className="inline-block w-1 h-1 rounded-full bg-emerald-500" />
                    <span className="text-emerald-600 font-bold">Doorstep Service</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all active:scale-90 cursor-pointer"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-6 flex-1 overscroll-contain">
              {/* Option 1: Use Current Location */}
              <div>
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={isDetectingLocation}
                  className="w-full group flex items-center justify-between p-3.5 bg-emerald-50/70 hover:bg-emerald-100/70 active:bg-emerald-200/60 border border-emerald-200/80 rounded-2xl transition-all cursor-pointer text-left shadow-2xs disabled:opacity-60"
                  id="btn-use-current-location"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                      {isDetectingLocation ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Crosshair size={18} className="stroke-[2.4]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-emerald-950 flex items-center gap-1.5 leading-tight">
                        <span>Use Current Location</span>
                        <span className="bg-emerald-200/80 text-emerald-800 text-[10px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                          GPS
                        </span>
                      </p>
                      <p className="text-xs font-semibold text-emerald-700/90 truncate mt-0.5">
                        {isDetectingLocation
                          ? 'Detecting nearest Indore locality...'
                          : 'Detect precise locality via browser GPS'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-emerald-600 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </button>

                {geoError && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-medium text-amber-800 flex items-start gap-2"
                  >
                    <span className="text-amber-500 font-bold shrink-0">⚠️</span>
                    <span>{geoError}</span>
                  </motion.div>
                )}
              </div>

              {/* Option 2: Search Input for Colonies/Areas */}
              <div>
                <label
                  htmlFor="location-search-input"
                  className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2 pl-1"
                >
                  Search Colony or Area
                </label>
                <div className="relative">
                  <Search
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    size={17}
                  />
                  <input
                    id="location-search-input"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search e.g. Vijay Nagar, Palasia, Nipania..."
                    className="w-full pl-10 pr-10 py-3 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 placeholder:text-slate-400 placeholder:font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-all"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>

                {/* Filtered Search Results Dropdown */}
                {searchQuery.trim().length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 bg-white border border-slate-200 rounded-2xl shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100 p-1"
                  >
                    {filteredAreas.length > 0 ? (
                      filteredAreas.map((area) => (
                        <button
                          key={area}
                          type="button"
                          onClick={() => handlePickArea(area)}
                          className="w-full flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-xl transition-all text-left cursor-pointer group"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <MapPin size={14} className="text-emerald-500 shrink-0" />
                            <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 truncate">
                              {area}
                            </span>
                          </div>
                          <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                            Indore, MP
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center">
                        <p className="text-xs font-bold text-slate-500">
                          No locality matching "{searchQuery}"
                        </p>
                        <button
                          type="button"
                          onClick={() => handlePickArea(searchQuery.trim())}
                          className="mt-2 text-xs font-extrabold text-emerald-600 hover:text-emerald-700 underline"
                        >
                          Use "{searchQuery.trim()}, Indore"
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>

              {/* Option 3: Quick chips for popular Indore localities */}
              <div>
                <div className="flex items-center justify-between mb-2.5 pl-1">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Sparkles size={12} className="text-amber-500" />
                    Popular Indore Localities
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                    Fast Delivery
                  </span>
                </div>

                <div className="flex flex-wrap gap-2" id="popular-indore-chips">
                  {POPULAR_INDORE_LOCALITIES.map((locality) => {
                    const isSelected =
                      currentLocation.toLowerCase().includes(locality.toLowerCase());

                    return (
                      <button
                        key={locality}
                        type="button"
                        onClick={() => handlePickArea(locality)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 border ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-600/20'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border-slate-200/80 hover:border-slate-300'
                        }`}
                      >
                        <MapPin
                          size={12}
                          className={isSelected ? 'text-white' : 'text-slate-400'}
                        />
                        <span>{locality}</span>
                        {isSelected && <Check size={12} className="stroke-[3] ml-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Option 4: Switch City / Other Cities */}
              {onOpenCitySelector && (
                <div className="pt-2 border-t border-slate-100 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCitySelector();
                    }}
                    className="text-xs font-bold text-slate-500 hover:text-blue-700 transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Building2 size={13} />
                    <span>Need service outside Indore? Check other cities</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default LocationPickerModal;
