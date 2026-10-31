import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Map, useMap } from '@vis.gl/react-google-maps';
import {
  X,
  MapPin,
  Crosshair,
  Loader2,
  Home,
  Briefcase,
  MapPinned,
  AlertCircle,
  Building,
  CheckCircle2,
} from 'lucide-react';
import { GOOGLE_MAPS_MAP_ID } from '../lib/maps-config';
import { reverseGeocode, reverseGeocodeWithGoogle, ReverseGeocodeResult } from '../utils/reverseGeocode';

interface DoorstepPinPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCoords?: { lat: number; lng: number } | null;
  initialAddress?: string;
  initialHouseNumber?: string;
  initialTag?: 'Home' | 'Work' | 'Other';
  onConfirm: (confirmed: {
    coords: { lat: number; lng: number };
    address: string;
    houseNumber: string;
    tag: 'Home' | 'Work' | 'Other';
    fullAddress: string;
  }) => void;
}

const DEFAULT_INDORE_CENTER = { lat: 22.7533, lng: 75.8937 };

// Inner controller that responds to programmatic pan/zoom once per explicit target change
function MapPanController({
  target,
  onPanComplete,
}: {
  target: { center: { lat: number; lng: number }; zoom?: number } | null;
  onPanComplete: () => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (map && target) {
      map.panTo(target.center);
      if (typeof target.zoom === 'number') {
        map.setZoom(target.zoom);
      }
      onPanComplete();
    }
  }, [map, target, onPanComplete]);
  return null;
}

export default function DoorstepPinPickerModal({
  isOpen,
  onClose,
  initialCoords,
  initialAddress = '',
  initialHouseNumber = '',
  initialTag = 'Home',
  onConfirm,
}: DoorstepPinPickerModalProps) {
  // Coordinates being fine-tuned by the center pin
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number }>(() => {
    return initialCoords && typeof initialCoords.lat === 'number' && typeof initialCoords.lng === 'number'
      ? initialCoords
      : DEFAULT_INDORE_CENTER;
  });

  // Programmatic pan target (only set on initial open or explicit GPS button click)
  const [programmaticTarget, setProgrammaticTarget] = useState<{
    center: { lat: number; lng: number };
    zoom?: number;
  } | null>(null);

  // Address text state
  const [detectedAddress, setDetectedAddress] = useState<string>(initialAddress || 'Locating doorstep...');
  const [houseNumber, setHouseNumber] = useState<string>(initialHouseNumber);
  const [addressTag, setAddressTag] = useState<'Home' | 'Work' | 'Other'>(initialTag);

  // UI state
  const [isLocatingDevice, setIsLocatingDevice] = useState<boolean>(false);
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [geoNotice, setGeoNotice] = useState<string | null>(null);

  // Refs for race-condition prevention and debounce
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef<number>(0);
  const latestCoordsRef = useRef<{ lat: number; lng: number }>(currentCoords);
  const wasOpenRef = useRef<boolean>(false);

  const clearProgrammaticTarget = useCallback(() => {
    setProgrammaticTarget(null);
  }, []);

  // Debounced reverse geocoding with monotonic requestIdRef to prevent stale async overwrites
  const runReverseGeocode = useCallback((lat: number, lng: number, immediate = false) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const currentRequestId = ++requestIdRef.current;
    setIsGeocoding(true);

    const executeGeocode = async () => {
      try {
        let result: ReverseGeocodeResult | null = null;

        // 1. Prioritize Google Maps native Geocoder when available
        if (typeof window !== 'undefined' && (window as any).google?.maps?.Geocoder) {
          try {
            result = await reverseGeocodeWithGoogle(lat, lng);
          } catch (gErr) {
            console.warn('[DoorstepMap] Google Geocoder fallback to OSM:', gErr);
          }
        }

        // 2. OpenStreetMap fallback if Google Geocoder wasn't available
        if (!result) {
          result = await reverseGeocode(lat, lng);
        }

        // Discard stale out-of-order response if a newer pin movement occurred
        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        let readable = '';
        if (result.colony) {
          readable = result.colony.toLowerCase().includes('indore')
            ? result.colony
            : `${result.colony}, ${result.city || 'Indore'}`;
        } else {
          readable = result.area || result.fullAddress;
        }

        setDetectedAddress(readable);
      } catch (err) {
        if (currentRequestId === requestIdRef.current) {
          setDetectedAddress(`Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
        }
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setIsGeocoding(false);
        }
      }
    };

    if (immediate) {
      executeGeocode();
    } else {
      debounceTimerRef.current = setTimeout(executeGeocode, 300);
    }
  }, []);

  // Re-center helper with smooth map pan
  const locateDeviceGPS = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoNotice('Geolocation is not supported on this device.');
      return;
    }

    setIsLocatingDevice(true);
    setGeoNotice(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude);
        const lng = Number(pos.coords.longitude);
        const newCoords = { lat, lng };
        latestCoordsRef.current = newCoords;
        setCurrentCoords(newCoords);
        setProgrammaticTarget({ center: newCoords, zoom: 17 });
        setIsLocatingDevice(false);
        runReverseGeocode(lat, lng, true);
      },
      (err) => {
        console.warn('[DoorstepMap] Geolocation error:', err);
        let msg = 'Could not access device GPS. Showing default area.';
        if (err.code === 1) {
          msg = 'Location permission was denied. Drag the map to pinpoint your doorstep.';
        }
        setGeoNotice(msg);
        setIsLocatingDevice(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 9000,
        maximumAge: 10000,
      }
    );
  }, [runReverseGeocode]);

  // Initialize modal state ONLY when transitioning from closed -> open
  // This prevents state updates during pin drop from resetting coordinates or reverting micro-locality
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      setHouseNumber(initialHouseNumber || '');
      setAddressTag(initialTag || 'Home');

      if (initialCoords && typeof initialCoords.lat === 'number' && typeof initialCoords.lng === 'number') {
        latestCoordsRef.current = initialCoords;
        setCurrentCoords(initialCoords);
        setProgrammaticTarget({ center: initialCoords, zoom: 17 });
        if (initialAddress && initialAddress.trim().length > 0) {
          setDetectedAddress(initialAddress);
        }
        // Always resolve hyper-local address for initial pin coordinates
        runReverseGeocode(initialCoords.lat, initialCoords.lng, true);
      } else {
        locateDeviceGPS();
      }
    } else if (!isOpen && wasOpenRef.current) {
      wasOpenRef.current = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    }
  }, [isOpen, initialCoords, initialAddress, initialHouseNumber, initialTag, locateDeviceGPS, runReverseGeocode]);

  // Handle user dragging / panning the map
  const handleCameraChanged = useCallback(
    (ev: any) => {
      const center = ev?.detail?.center;
      if (center && typeof center.lat === 'number' && typeof center.lng === 'number') {
        const lat = Number(center.lat);
        const lng = Number(center.lng);
        const prev = latestCoordsRef.current;
        const dLat = Math.abs(prev.lat - lat);
        const dLng = Math.abs(prev.lng - lng);

        // Ignore micro-jitter (< ~1 meter) so settling animations don't re-trigger redundant calls
        if (dLat < 0.00001 && dLng < 0.00001) {
          return;
        }

        const nextCoords = { lat, lng };
        latestCoordsRef.current = nextCoords;
        setCurrentCoords(nextCoords);
        runReverseGeocode(lat, lng, false);
      }
    },
    [runReverseGeocode]
  );

  // When drag ends, ensure the final settled pin coordinates are resolved accurately
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    const settled = latestCoordsRef.current;
    if (settled && typeof settled.lat === 'number' && typeof settled.lng === 'number') {
      runReverseGeocode(settled.lat, settled.lng, false);
    }
  }, [runReverseGeocode]);

  const handleConfirm = () => {
    const cleanHouse = houseNumber.trim();
    const cleanDetected = detectedAddress.trim() || 'Doorstep Location, Indore';
    const full = [cleanHouse, cleanDetected].filter(Boolean).join(', ');
    onConfirm({
      coords: latestCoordsRef.current || currentCoords,
      address: cleanDetected,
      houseNumber: cleanHouse,
      tag: addressTag,
      fullAddress: full || cleanDetected,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs cursor-pointer"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          onClick={(e) => e.stopPropagation()}
          className="relative bg-white w-full max-w-lg rounded-t-[28px] sm:rounded-[28px] shadow-2xl overflow-hidden flex flex-col z-10 border border-slate-200 max-h-[95vh]"
        >
          {/* Mobile Drag Pill */}
          <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto mt-2.5 sm:hidden" />

          {/* 1. Header */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 flex items-center justify-between border-b border-slate-100 bg-white shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-xs">
                <MapPinned size={17} className="text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 leading-tight">
                  Pin Your Doorstep Location
                </h3>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Drag the map to place the pin directly on your entrance
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="Close Map"
            >
              <X size={15} />
            </button>
          </div>

          {/* Notice banner if GPS error */}
          {geoNotice && (
            <div className="bg-amber-50 border-b border-amber-200 text-amber-800 py-1.5 px-4 text-xs font-medium flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <AlertCircle size={13} className="text-amber-600 shrink-0" />
                <span>{geoNotice}</span>
              </span>
              <button onClick={() => setGeoNotice(null)} className="p-0.5 hover:bg-amber-100 rounded text-amber-700">
                <X size={12} />
              </button>
            </div>
          )}

          {/* 2. Interactive Map Container (Responsive min-height 280px - 340px) */}
          <div className="relative w-full h-[280px] sm:h-[320px] bg-slate-100 overflow-hidden select-none">
            <Map
              defaultCenter={currentCoords}
              defaultZoom={17}
              mapId={GOOGLE_MAPS_MAP_ID}
              gestureHandling="greedy"
              disableDefaultUI
              clickableIcons={false}
              keyboardShortcuts={false}
              onCameraChanged={handleCameraChanged}
              onDragstart={() => setIsDragging(true)}
              onDragend={handleDragEnd}
              className="w-full h-full"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            >
              <MapPanController target={programmaticTarget} onPanComplete={clearProgrammaticTarget} />
            </Map>

            {/* FIXED CENTER ANIMATED PIN (Zomato / Blinkit style) */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
              <div className="relative flex flex-col items-center">
                {/* Floating Tooltip Pill */}
                <div
                  className={`mb-1 px-2.5 py-1 rounded-full bg-slate-900/90 backdrop-blur-xs text-white text-[10px] font-bold shadow-lg flex items-center gap-1 transition-all duration-200 ${
                    isDragging ? '-translate-y-2 scale-105' : 'translate-y-0 scale-100'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Doorstep Pin</span>
                </div>

                {/* Animated Pin Marker with tip anchored to the ground */}
                <div
                  className={`transition-transform duration-200 origin-bottom ${
                    isDragging ? '-translate-y-2 scale-110' : 'translate-y-0 scale-100'
                  }`}
                >
                  <svg
                    width="38"
                    height="48"
                    viewBox="0 0 38 48"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="drop-shadow-xl"
                  >
                    <path
                      d="M19 0C8.50659 0 0 8.50659 0 19C0 31.5 16.5 46.5 18.25 47.75C18.7 48.08 19.3 48.08 19.75 47.75C21.5 46.5 38 31.5 38 19C38 8.50659 29.4934 0 19 0Z"
                      fill="#EF4444"
                    />
                    <circle cx="19" cy="18" r="8" fill="white" />
                    <circle cx="19" cy="18" r="4.5" fill="#EF4444" />
                  </svg>
                </div>

                {/* Ground Shadow & Pulsing Radar Ring underneath the tip */}
                <div className="relative -mt-1 flex items-center justify-center">
                  <div className="w-3.5 h-1.5 bg-slate-900/40 rounded-full blur-[0.5px]" />
                  <div className="absolute w-8 h-3 border-2 border-red-500/40 rounded-full animate-ping" />
                </div>
              </div>
            </div>

            {/* Floating "Locate Me" GPS FAB (Bottom Right) */}
            <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-2">
              <button
                type="button"
                onClick={locateDeviceGPS}
                disabled={isLocatingDevice}
                title="Locate my exact doorstep"
                className="w-10 h-10 rounded-full bg-white text-slate-800 hover:text-blue-600 shadow-lg border border-slate-200/80 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-60"
              >
                {isLocatingDevice ? (
                  <Loader2 size={18} className="animate-spin text-blue-600" />
                ) : (
                  <Crosshair size={18} className="text-blue-600" />
                )}
              </button>
            </div>

            {/* Live Dragging / Geocoding Status Chip (Top Left) */}
            <div className="absolute top-3 left-3 z-20">
              <div className="px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-md text-[10px] font-bold text-slate-700 flex items-center gap-1.5">
                {isGeocoding ? (
                  <>
                    <Loader2 size={11} className="animate-spin text-blue-600" />
                    <span>Resolving address...</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>
                      GPS locked: {currentCoords.lat.toFixed(4)}, {currentCoords.lng.toFixed(4)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 3. Doorstep Details & Confirmation Sheet */}
          <div
            className="flex-1 min-h-0 p-4 sm:p-5 space-y-3.5 bg-white overflow-y-auto overscroll-contain touch-pan-y"
            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
          >
            {/* Detected Address Summary Bar */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Detected Area / Street
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {currentCoords.lat.toFixed(5)}, {currentCoords.lng.toFixed(5)}
                </span>
              </div>
              <p className="text-xs sm:text-sm font-bold text-slate-900 leading-snug break-words">
                {detectedAddress}
              </p>
            </div>

            {/* House / Flat / Landmark Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                House / Flat / Floor & Landmark <span className="text-blue-600">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Building size={14} />
                </div>
                <input
                  type="text"
                  value={houseNumber}
                  onChange={(e) => setHouseNumber(e.target.value)}
                  placeholder="e.g. Flat 302, Royal Palms, Near C21 Mall"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Address Tag Selector */}
            <div className="space-y-1.5">
              <span className="block text-[11px] font-bold text-slate-600">Save address as:</span>
              <div className="flex gap-2">
                {(['Home', 'Work', 'Other'] as const).map((tag) => {
                  const isSelected = addressTag === tag;
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setAddressTag(tag)}
                      className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {tag === 'Home' && <Home size={12} />}
                      {tag === 'Work' && <Briefcase size={12} />}
                      {tag === 'Other' && <MapPin size={12} />}
                      <span>{tag}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Confirm Doorstep Action Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isGeocoding}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99] disabled:opacity-60 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>{isGeocoding ? 'Resolving Exact Location...' : 'Confirm Doorstep Location'}</span>
                <span className="text-blue-200">→</span>
              </button>
              <p className="text-[10px] text-center text-slate-400 font-medium mt-1.5 flex items-center justify-center gap-1">
                <CheckCircle2 size={11} className="text-emerald-500" />
                <span>Exact coordinates will be dispatched to technician navigation</span>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
