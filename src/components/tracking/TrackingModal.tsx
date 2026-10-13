import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Map,
  AdvancedMarker,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { GOOGLE_MAPS_MAP_ID } from "../../lib/maps-config";
import { CORPORATE_LANDLINE_GATEWAY } from "../../lib/telephony";
import { Booking, PartnerProfile, UserProfile } from "../../types";
import {
  Phone,
  MessageSquare,
  Star,
  ArrowLeft,
  X,
  KeyRound,
  Navigation,
  ShieldCheck,
  MapPin,
  Clock,
} from "lucide-react";

export interface TrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking;
  partnerUser?: UserProfile | PartnerProfile | null;
  serviceName?: string;
  onCallPartner?: () => void;
  onChatPartner?: () => void;
}

// Minimalist Clean Map Styling (Urban Company / Uber Style)
const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f8fafc" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#e2e8f0" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#e0f2fe" }],
  },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

const DEFAULT_INDORE_DESTINATION = { lat: 22.7533, lng: 75.8937 };
const DEFAULT_INDORE_PARTNER = { lat: 22.7196, lng: 75.8577 };

function calculateHaversineDistance(
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function computeBearing(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number }
): number {
  const startLat = (start.lat * Math.PI) / 180;
  const startLng = (start.lng * Math.PI) / 180;
  const endLat = (end.lat * Math.PI) / 180;
  const endLng = (end.lng * Math.PI) / 180;
  const dLng = endLng - startLng;
  const y = Math.sin(dLng) * Math.cos(endLat);
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

function generateCurvedPath(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  numPoints = 25
): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  const midLat = (start.lat + end.lat) / 2;
  const midLng = (start.lng + end.lng) / 2;
  const dLat = end.lat - start.lat;
  const dLng = end.lng - start.lng;
  const curvature = 0.12;
  const controlLat = midLat - dLng * curvature;
  const controlLng = midLng + dLat * curvature;

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const invT = 1 - t;
    const lat = invT * invT * start.lat + 2 * invT * t * controlLat + t * t * end.lat;
    const lng = invT * invT * start.lng + 2 * invT * t * controlLng + t * t * end.lng;
    points.push({ lat, lng });
  }

  return points;
}

function RoutePolyline({ path }: { path: Array<{ lat: number; lng: number }> }) {
  const map = useMap();
  const mapsLib = useMapsLibrary("maps");
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map || !mapsLib || path.length < 2) return;

    if (!polylineRef.current) {
      polylineRef.current = new mapsLib.Polyline({
        strokeColor: "#2563EB",
        strokeOpacity: 0.95,
        strokeWeight: 5,
        map: map,
        zIndex: 9999,
      });
    }
    polylineRef.current.setPath(path);

    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
    };
  }, [map, mapsLib, path]);

  return null;
}

interface SplitMapCanvasProps {
  partnerLocation: { lat: number; lng: number; heading?: number | null } | null;
  destCoords: { lat: number; lng: number } | null;
  onRouteUpdate?: (eta: string, distance: string) => void;
}

function SplitMapCanvas({
  partnerLocation,
  destCoords,
  onRouteUpdate,
}: SplitMapCanvasProps) {
  const map = useMap();
  const onRouteUpdateRef = useRef(onRouteUpdate);
  const [routePath, setRoutePath] = useState<Array<{ lat: number; lng: number }>>([]);
  const lastFitBoundsKeyRef = useRef<string>("");

  useEffect(() => {
    onRouteUpdateRef.current = onRouteUpdate;
  }, [onRouteUpdate]);

  const pLat = partnerLocation?.lat;
  const pLng = partnerLocation?.lng;
  const dLat = destCoords?.lat;
  const dLng = destCoords?.lng;

  // Calculate realistic road distance & transit ETA
  useEffect(() => {
    if (
      typeof pLat !== "number" ||
      typeof pLng !== "number" ||
      typeof dLat !== "number" ||
      typeof dLng !== "number"
    ) {
      setRoutePath([]);
      return;
    }

    const origin = { lat: pLat, lng: pLng };
    const destination = { lat: dLat, lng: dLng };

    const straightKm = calculateHaversineDistance(origin, destination);
    const roadDistanceKm = Math.max(0.4, straightKm * 1.35);
    const durationMin = Math.max(2, Math.ceil((roadDistanceKm / 24) * 60));

    if (onRouteUpdateRef.current) {
      onRouteUpdateRef.current(`~${durationMin} mins`, `${roadDistanceKm.toFixed(1)} km`);
    }

    const curvedPoints = generateCurvedPath(origin, destination, 25);
    setRoutePath(curvedPoints);
  }, [pLat, pLng, dLat, dLng]);

  // Apply map styles
  useEffect(() => {
    if (!map || typeof google === "undefined") return;
    map.setOptions({
      styles: MAP_STYLES,
      disableDefaultUI: true,
      gestureHandling: "greedy",
      keyboardShortcuts: false,
      clickableIcons: false,
      zoomControl: false,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
  }, [map]);

  // Auto-fit bounds between Customer and Partner location
  useEffect(() => {
    if (!map || typeof google === "undefined") return;
    if (!partnerLocation || !destCoords) return;

    const boundsKey = `${partnerLocation.lat.toFixed(4)},${partnerLocation.lng.toFixed(4)}_${destCoords.lat.toFixed(4)},${destCoords.lng.toFixed(4)}`;
    if (lastFitBoundsKeyRef.current === boundsKey) return;
    lastFitBoundsKeyRef.current = boundsKey;

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(partnerLocation);
    bounds.extend(destCoords);
    if (routePath.length > 0) {
      routePath.forEach((pt) => bounds.extend(pt));
    }
    // Padding ensures both markers and route are comfortably visible
    map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
  }, [map, partnerLocation, destCoords, routePath]);

  // Effective bearing
  const effectiveBearing = useMemo(() => {
    if (
      typeof partnerLocation?.heading === "number" &&
      !isNaN(partnerLocation.heading) &&
      partnerLocation.heading !== null
    ) {
      return (partnerLocation.heading % 360 + 360) % 360;
    }
    if (partnerLocation && routePath.length >= 2) {
      const nextPoint =
        routePath.find((pt) => calculateHaversineDistance(partnerLocation, pt) > 0.005) ||
        routePath[1];
      if (nextPoint) {
        return computeBearing(partnerLocation, nextPoint);
      }
    }
    if (partnerLocation && destCoords) {
      return computeBearing(partnerLocation, destCoords);
    }
    return 0;
  }, [partnerLocation, routePath, destCoords]);

  return (
    <>
      <RoutePolyline path={routePath} />

      {/* Customer Doorstep Marker */}
      {destCoords && (
        <AdvancedMarker position={destCoords}>
          <div className="relative flex flex-col items-center select-none">
            <div className="w-9 h-9 rounded-2xl bg-rose-600 border-2 border-white shadow-xl flex items-center justify-center text-white">
              <span className="text-base leading-none">🏠</span>
            </div>
            <div className="mt-1 bg-slate-900 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-md whitespace-nowrap">
              Doorstep
            </div>
          </div>
        </AdvancedMarker>
      )}

      {/* Partner Vehicle Marker */}
      {partnerLocation && (
        <AdvancedMarker position={partnerLocation}>
          <div className="relative flex flex-col items-center select-none cursor-pointer">
            <div
              className="relative w-12 h-12 rounded-full bg-white shadow-2xl border-2 border-blue-600 flex items-center justify-center text-2xl transition-transform duration-500 ease-out"
              style={{
                transform: `rotate(${Math.round(effectiveBearing)}deg)`,
              }}
            >
              <div className="absolute -top-1.5 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[8px] border-b-blue-600" />
              <span className="text-xl leading-none select-none">🛵</span>
            </div>
            <div className="mt-1 bg-slate-900 text-white text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-md whitespace-nowrap">
              Technician
            </div>
          </div>
        </AdvancedMarker>
      )}
    </>
  );
}

export function TrackingModal({
  isOpen,
  onClose,
  booking,
  partnerUser,
  serviceName,
  onCallPartner,
  onChatPartner,
}: TrackingModalProps) {
  const [liveBooking, setLiveBooking] = useState<Booking>(booking);
  const [eta, setEta] = useState<string>("~8 mins");
  const [distance, setDistance] = useState<string>("2.4 km");
  const [partnerProfile, setPartnerProfile] = useState<PartnerProfile | null>(null);

  // Sync prop changes to live state
  useEffect(() => {
    setLiveBooking(booking);
  }, [booking]);

  // Listen to bookings/{id} via onSnapshot for real-time GPS coordinate sync
  useEffect(() => {
    if (!booking?.id) return;
    let isMounted = true;

    const unsubBooking = onSnapshot(
      doc(db, "bookings", booking.id),
      (snap) => {
        if (!isMounted || !snap.exists()) return;
        const data = { id: snap.id, ...snap.data() } as Booking;
        setLiveBooking(data);
      },
      (err) => {
        console.warn("[TrackingModal] Live booking snapshot notice:", err);
      }
    );

    return () => {
      isMounted = false;
      unsubBooking();
    };
  }, [booking?.id]);

  // Listen to partner profile if available
  const activePartnerId = liveBooking.partnerId || (liveBooking as any).assignedPartnerId;
  useEffect(() => {
    if (!activePartnerId) return;
    let isMounted = true;

    const unsubPartner = onSnapshot(
      doc(db, "users", activePartnerId),
      (snap) => {
        if (!isMounted || !snap.exists()) return;
        setPartnerProfile(snap.data() as PartnerProfile);
      },
      (err) => {
        console.warn("[TrackingModal] Partner profile snapshot notice:", err);
      }
    );

    return () => {
      isMounted = false;
      unsubPartner();
    };
  }, [activePartnerId]);

  // Calculate coordinates
  const partnerLocation = useMemo(() => {
    const loc = liveBooking.partnerLocation || (liveBooking as any).expertLocation;
    if (loc && typeof loc.lat === "number" && typeof loc.lng === "number") {
      return {
        lat: Number(loc.lat),
        lng: Number(loc.lng),
        heading: typeof (loc as any).heading === "number" ? (loc as any).heading : null,
      };
    }
    if (partnerProfile && (partnerProfile as any).location?.lat && (partnerProfile as any).location?.lng) {
      return {
        lat: Number((partnerProfile as any).location.lat),
        lng: Number((partnerProfile as any).location.lng),
        heading: null,
      };
    }
    return DEFAULT_INDORE_PARTNER;
  }, [liveBooking.partnerLocation, partnerProfile]);

  const destCoords = useMemo(() => {
    if (typeof liveBooking.lat === "number" && typeof liveBooking.lng === "number") {
      return { lat: liveBooking.lat, lng: liveBooking.lng };
    }
    return DEFAULT_INDORE_DESTINATION;
  }, [liveBooking.lat, liveBooking.lng]);

  const handleRouteUpdate = useCallback((newEta: string, newDist: string) => {
    setEta(newEta);
    setDistance(newDist);
  }, []);

  const partnerName =
    liveBooking.partnerName ||
    (liveBooking as any).assignedPartnerName ||
    partnerUser?.displayName ||
    partnerProfile?.displayName ||
    "Assigned Technician";

  const partnerPhone =
    liveBooking.partnerPhone ||
    (liveBooking as any).assignedPartnerPhone ||
    (partnerUser as any)?.phoneNumber ||
    (partnerUser as any)?.mobile ||
    (partnerProfile as any)?.phoneNumber ||
    (partnerProfile as any)?.mobile ||
    "";

  const partnerAvatar =
    partnerUser?.photoURL ||
    partnerProfile?.photoURL ||
    (partnerProfile as any)?.avatar ||
    "";

  const partnerRating =
    (partnerProfile as any)?.rating ||
    (partnerUser as any)?.rating ||
    4.9;

  // Direct OTP
  const displayOtp =
    liveBooking.serviceOtp ||
    liveBooking.startOTP ||
    (liveBooking as any).completionOtp ||
    (liveBooking.id
      ? (parseInt(liveBooking.id.replace(/\D/g, "").slice(-4), 10) || 4821)
          .toString()
          .padStart(4, "0")
      : "4821");

  const rawStatus = (liveBooking.status || "").toLowerCase();
  const isCompleted = ["completed", "finalized"].includes(rawStatus);
  const isCancelled = rawStatus === "cancelled";
  const showOtpBadge = !liveBooking.otpVerified && !isCompleted && !isCancelled && Boolean(displayOtp);

  // Status label
  const statusLabel = useMemo(() => {
    if (rawStatus === "on_the_way") return "Technician is on the way";
    if (rawStatus === "arrived") return "Technician has arrived at doorstep";
    if (rawStatus === "in_progress") return "Service is in progress";
    if (rawStatus === "assigned") return "Technician assigned & preparing route";
    return "Technician en-route";
  }, [rawStatus]);

  const handleCall = () => {
    if (onCallPartner) {
      onCallPartner();
      return;
    }
    if (partnerPhone) {
      window.location.href = `tel:${partnerPhone}`;
    } else {
      window.location.href = `tel:${CORPORATE_LANDLINE_GATEWAY}`;
    }
  };

  const handleChat = () => {
    if (onChatPartner) {
      onChatPartner();
      return;
    }
    if (typeof (window as any).__openCustomerChat === "function") {
      (window as any).__openCustomerChat(liveBooking.id);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={`tracking-modal-overlay-${liveBooking.id}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 select-none"
      >
        <motion.div
          initial={{ y: "100%", opacity: 0.8 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          className="relative w-full h-[95dvh] sm:h-[88vh] sm:max-w-xl bg-white sm:rounded-[32px] overflow-hidden flex flex-col shadow-2xl border border-slate-200"
        >
          {/* TOP 60% OF VIEWPORT: DEDICATED FULL-WIDTH MAP CONTAINER (z-index: 1) */}
          <div className="relative w-full h-[60%] z-[1] overflow-hidden bg-slate-100">
            {/* Close / Back button pinned at top-left of screen (z-index: 20) */}
            <div className="absolute top-4 left-4 z-20 pointer-events-auto">
              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/95 hover:bg-white text-slate-800 shadow-md flex items-center justify-center border border-slate-200/80 transition-all active:scale-95 cursor-pointer backdrop-blur-xs"
                title="Back / Close Navigation"
                aria-label="Back"
              >
                <ArrowLeft size={18} strokeWidth={2.5} />
              </button>
            </div>

            {/* Map Canvas - No overlapping clutter over map */}
            <Map
              defaultCenter={partnerLocation || destCoords}
              defaultZoom={14}
              mapId={GOOGLE_MAPS_MAP_ID}
              gestureHandling="greedy"
              disableDefaultUI
              keyboardShortcuts={false}
              clickableIcons={false}
              className="w-full h-full"
              internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
            >
              <SplitMapCanvas
                partnerLocation={partnerLocation}
                destCoords={destCoords}
                onRouteUpdate={handleRouteUpdate}
              />
            </Map>
          </div>

          {/* BOTTOM 40% OF VIEWPORT: COMPACT, CLEAN BOTTOM CARD */}
          <div className="relative w-full h-[40%] bg-white border-t border-slate-100 flex flex-col justify-between p-4 sm:p-5 overflow-y-auto">
            {/* 1. Live Status Pill + Distance / ETA */}
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                <span>{statusLabel}</span>
              </div>
              <div className="text-right">
                <span className="text-xs sm:text-sm font-black text-slate-900 block">
                  {eta}
                </span>
                <span className="text-[10px] text-slate-400 font-bold block">
                  {distance} away
                </span>
              </div>
            </div>

            {/* 2. Prominent OTP Badge on Tracking Screen */}
            {showOtpBadge && (
              <div className="my-2 p-2.5 rounded-2xl bg-amber-500/10 border-2 border-amber-400 flex items-center justify-between gap-2 shadow-2xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0">
                    <KeyRound size={14} className="stroke-[2.5]" />
                  </div>
                  <p className="text-[11px] font-bold text-amber-950 leading-tight">
                    Share OTP only after service completion:
                  </p>
                </div>
                <div className="bg-slate-950 text-amber-300 font-mono font-black text-base tracking-[0.2em] px-3 py-1 rounded-xl border border-amber-400/40 shrink-0 select-all">
                  {displayOtp}
                </div>
              </div>
            )}

            {/* 3. Technician Profile & Direct Call / Chat Action Buttons */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  {partnerAvatar ? (
                    <img
                      src={partnerAvatar}
                      alt={partnerName}
                      className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shadow-xs"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-700 to-blue-500 text-white font-black text-base flex items-center justify-center shadow-xs">
                      {partnerName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-sm font-black text-slate-900 truncate">
                      {partnerName}
                    </h4>
                    <span className="inline-flex items-center gap-0.5 text-xs font-black text-amber-500">
                      <Star size={12} className="fill-amber-400 stroke-amber-400" />
                      {partnerRating}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-500 truncate">
                    {serviceName || liveBooking.serviceName || "Certified Professional"}
                  </p>
                </div>
              </div>

              {/* Action Buttons: Direct Call & Chat */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCall}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                  title="Call Technician"
                >
                  <Phone size={14} className="fill-white" />
                  <span>Call</span>
                </button>

                <button
                  type="button"
                  onClick={handleChat}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                  title="Live Chat"
                >
                  <MessageSquare size={14} className="fill-white" />
                  <span>Chat</span>
                </button>
              </div>
            </div>

            {/* 4. Safety & Destination Info Footer */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <div className="flex items-center gap-1 truncate">
                <MapPin size={12} className="text-rose-500 shrink-0" />
                <span className="truncate">{liveBooking.address || "Indore, Madhya Pradesh"}</span>
              </div>
              <div className="flex items-center gap-1 text-emerald-600 font-bold shrink-0">
                <ShieldCheck size={12} />
                <span>Verified</span>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default TrackingModal;
