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
  KeyRound,
  ShieldCheck,
  MapPin,
} from "lucide-react";

export interface TrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking;
  partnerUser?: UserProfile | PartnerProfile | null;
  serviceName?: string;
  customerLat?: number;
  customerLng?: number;
  bookingLocation?: { lat: number; lng: number };
  destinationAddress?: string;
  partnerId?: string;
  bookingId?: string;
  onCallPartner?: () => void;
  onChatPartner?: () => void;
}

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

export function calculateHaversineDistance(
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

function isLegacyCityDefault(lat?: number | null, lng?: number | null): boolean {
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  const isRajwada = Math.abs(lat - 22.7196) < 0.002 && Math.abs(lng - 75.8577) < 0.002;
  const isVijayNagar = Math.abs(lat - 22.7533) < 0.002 && Math.abs(lng - 75.8937) < 0.002;
  return isRajwada || isVijayNagar;
}

function matchLevel2MicroLocality(addressStr: string): { lat: number; lng: number } | null {
  const normalized = (addressStr || "").toLowerCase();
  if (!normalized) return null;

  if (normalized.includes("anil nagar") || normalized.includes("barfani dham")) {
    return { lat: 22.7482, lng: 75.8978 };
  }
  if (normalized.includes("manoj nayar nagar")) {
    return { lat: 22.7915, lng: 75.8932 };
  }
  if (normalized.includes("mahalaxmi nagar")) {
    return { lat: 22.7562, lng: 75.9015 };
  }
  if (normalized.includes("scheme 78") || normalized.includes("scheme 54")) {
    return { lat: 22.7548, lng: 75.8865 };
  }
  return null;
}

function matchLevel1MacroLocality(addressStr: string): { lat: number; lng: number } | null {
  const normalized = (addressStr || "").toLowerCase();
  if (!normalized) return null;

  if (normalized.includes("vijay nagar")) {
    return { lat: 22.7533, lng: 75.8937 };
  }
  if (normalized.includes("palasia")) {
    return { lat: 22.7244, lng: 75.8839 };
  }
  return null;
}

/**
 * Resolves customer doorstep coordinates using strict Level-1 / Level-2 hierarchy:
 * 1. Priority 1 (Exact Coords): customerLocation -> coords -> explicit props -> booking.lat/lng
 * 2. Priority 2 (Level-2 Micro-Locality Fallback): Anil Nagar / Barfani Dham, Manoj Nayar Nagar, Mahalaxmi Nagar, Scheme 78 / Scheme 54
 * 3. Priority 3 (Level-1 Macro-Locality Fallback): Vijay Nagar, Palasia
 */
export function resolveDoorstepCoords(
  booking?: any,
  customerLat?: number,
  customerLng?: number,
  bookingLocation?: { lat: number; lng: number },
  destinationAddress?: string
): { lat: number; lng: number } {
  const addressText =
    destinationAddress ||
    booking?.address ||
    booking?.fullAddress ||
    booking?.customerAddress ||
    "";

  const level2Match = matchLevel2MicroLocality(addressText);
  const level1Match = matchLevel1MacroLocality(addressText);

  const candidates: Array<{ lat?: any; lng?: any }> = [
    booking?.customerLocation,
    booking?.coords,
    bookingLocation,
    { lat: customerLat, lng: customerLng },
    { lat: booking?.lat, lng: booking?.lng },
  ];

  for (const c of candidates) {
    const lat = Number(c?.lat);
    const lng = Number(c?.lng);
    if (
      typeof c?.lat !== "undefined" &&
      typeof c?.lng !== "undefined" &&
      !isNaN(lat) &&
      !isNaN(lng) &&
      lat !== 0 &&
      lng !== 0
    ) {
      if (isLegacyCityDefault(lat, lng) && (level2Match || level1Match)) {
        return (level2Match || level1Match)!;
      }
      return { lat, lng };
    }
  }

  if (level2Match) return level2Match;
  if (level1Match) return level1Match;

  return { lat: 22.7196, lng: 75.8577 };
}

/**
 * Validates whether a partner GPS coordinate is an authentic live reading
 * within Greater Indore bounds (without rejecting distant partners > 5 km).
 */
export function isValidPartnerGps(
  candidate: { lat?: any; lng?: any } | null | undefined,
  _destCoords?: { lat: number; lng: number },
  _status?: string
): candidate is { lat: number; lng: number; heading?: number | null } {
  if (!candidate) return false;
  const lat = Number(candidate.lat);
  const lng = Number(candidate.lng);
  if (
    typeof lat !== "number" ||
    isNaN(lat) ||
    !isFinite(lat) ||
    typeof lng !== "number" ||
    isNaN(lng) ||
    !isFinite(lng) ||
    lat === 0 ||
    lng === 0
  ) {
    return false;
  }

  // Greater Indore geographic sanity bounds
  if (lat < 22.5 || lat > 23.0 || lng < 75.6 || lng > 76.1) {
    return false;
  }

  return true;
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
  if (start.lat === end.lat && start.lng === end.lng) {
    return [start, end];
  }
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
    const lat =
      invT * invT * start.lat + 2 * invT * t * controlLat + t * t * end.lat;
    const lng =
      invT * invT * start.lng + 2 * invT * t * controlLng + t * t * end.lng;
    points.push({ lat, lng });
  }

  return points;
}

function RoutePolyline({ path }: { path: Array<{ lat: number; lng: number }> }) {
  const map = useMap();
  const mapsLib = useMapsLibrary("maps");
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map || !mapsLib || path.length < 2) {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
      return;
    }

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
  destCoords: { lat: number; lng: number };
  onRouteUpdate?: (eta: string | null, distance: string | null) => void;
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

  const pLat = partnerLocation?.lat ?? null;
  const pLng = partnerLocation?.lng ?? null;
  const dLat = destCoords.lat;
  const dLng = destCoords.lng;

  // Authentic road distance & bike transit time calculation ONLY when verified partnerLocation exists
  useEffect(() => {
    if (pLat === null || pLng === null) {
      setRoutePath([]);
      if (onRouteUpdateRef.current) {
        onRouteUpdateRef.current(null, null);
      }
      return;
    }

    const origin = { lat: pLat, lng: pLng };
    const destination = { lat: dLat, lng: dLng };

    const straightKm = calculateHaversineDistance(origin, destination);
    const roadDistanceKm = Number((straightKm * 1.32).toFixed(1));
    const durationMin = Math.max(1, Math.ceil((roadDistanceKm / 22) * 60));

    if (onRouteUpdateRef.current) {
      onRouteUpdateRef.current(`~${durationMin} mins`, `${roadDistanceKm.toFixed(1)} km`);
    }

    const curvedPoints = generateCurvedPath(origin, destination, 25);
    setRoutePath(curvedPoints);
  }, [pLat, pLng, dLat, dLng]);

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

  // Automatically frame markers when partnerLocation is present, or center on doorstep
  useEffect(() => {
    if (!map || typeof google === "undefined") return;

    if (!partnerLocation) {
      const centerKey = `doorstep_${destCoords.lat.toFixed(4)},${destCoords.lng.toFixed(4)}`;
      if (lastFitBoundsKeyRef.current === centerKey) return;
      lastFitBoundsKeyRef.current = centerKey;
      map.setCenter(destCoords);
      map.setZoom(15);
      return;
    }

    const boundsKey = `${partnerLocation.lat.toFixed(4)},${partnerLocation.lng.toFixed(4)}_${destCoords.lat.toFixed(4)},${destCoords.lng.toFixed(4)}`;
    if (lastFitBoundsKeyRef.current === boundsKey) return;
    lastFitBoundsKeyRef.current = boundsKey;

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(partnerLocation);
    bounds.extend(destCoords);
    if (routePath.length > 0) {
      routePath.forEach((pt) => bounds.extend(pt));
    }
    map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
  }, [map, partnerLocation, destCoords, routePath]);

  const effectiveBearing = useMemo(() => {
    if (!partnerLocation) return 0;
    if (
      typeof partnerLocation.heading === "number" &&
      !isNaN(partnerLocation.heading) &&
      partnerLocation.heading !== null
    ) {
      return ((partnerLocation.heading % 360) + 360) % 360;
    }
    if (routePath.length >= 2) {
      const nextPoint =
        routePath.find((pt) => calculateHaversineDistance(partnerLocation, pt) > 0.005) ||
        routePath[1];
      if (nextPoint) {
        return computeBearing(partnerLocation, nextPoint);
      }
    }
    return computeBearing(partnerLocation, destCoords);
  }, [partnerLocation, routePath, destCoords]);

  return (
    <>
      {partnerLocation && routePath.length >= 2 && <RoutePolyline path={routePath} />}

      {/* Customer Doorstep Marker */}
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

      {/* Authentic Partner Vehicle Marker — Rendered ONLY when partnerLocation is present */}
      {partnerLocation && (
        <AdvancedMarker position={partnerLocation}>
          <div className="relative flex flex-col items-center select-none cursor-pointer">
            <div className="relative flex items-center justify-center w-[30px] h-[30px] rounded-full bg-blue-500/15">
              <div
                className="relative w-7 h-7 rounded-full bg-white shadow-md border-2 border-[#0a2540] flex items-center justify-center transition-transform duration-500 ease-out"
                style={{
                  transform: `rotate(${Math.round(effectiveBearing)}deg)`,
                }}
              >
                <div className="absolute -top-1.5 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[6px] border-b-[#0a2540]" />
                <span className="text-xs leading-none select-none">🛵</span>
              </div>
            </div>
            <div className="mt-0.5 bg-slate-900 text-white text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap">
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
  customerLat,
  customerLng,
  bookingLocation,
  destinationAddress,
  partnerId: propPartnerId,
  bookingId: propBookingId,
  onCallPartner,
  onChatPartner,
}: TrackingModalProps) {
  const [liveBooking, setLiveBooking] = useState<Booking>(booking);
  const [eta, setEta] = useState<string | null>(null);
  const [distance, setDistance] = useState<string | null>(null);
  const [partnerDoc, setPartnerDoc] = useState<PartnerProfile | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<PartnerProfile | null>(null);

  useEffect(() => {
    setLiveBooking(booking);
  }, [booking]);

  const targetBookingId = propBookingId || booking?.id;

  // 1. Real-time Firestore stream on bookings/{id}
  useEffect(() => {
    if (!targetBookingId) return;
    let isMounted = true;

    const unsubBooking = onSnapshot(
      doc(db, "bookings", targetBookingId),
      (snap) => {
        if (!isMounted || !snap.exists()) return;
        const data = { id: snap.id, ...snap.data() } as Booking;
        setLiveBooking(data);
      },
      () => {}
    );

    return () => {
      isMounted = false;
      unsubBooking();
    };
  }, [targetBookingId]);

  // 2. Real-time Firestore stream on partners/{partnerId} and users/{partnerId}
  const activePartnerId =
    propPartnerId ||
    liveBooking.partnerId ||
    (liveBooking as any).assignedPartnerId;

  useEffect(() => {
    if (!activePartnerId) {
      setPartnerDoc(null);
      setPartnerProfile(null);
      return;
    }
    let isMounted = true;

    const unsubPartnerDoc = onSnapshot(
      doc(db, "partners", activePartnerId),
      (snap) => {
        if (!isMounted || !snap.exists()) return;
        setPartnerDoc(snap.data() as PartnerProfile);
      },
      () => {}
    );

    const unsubUserDoc = onSnapshot(
      doc(db, "users", activePartnerId),
      (snap) => {
        if (!isMounted || !snap.exists()) return;
        setPartnerProfile(snap.data() as PartnerProfile);
      },
      () => {}
    );

    return () => {
      isMounted = false;
      unsubPartnerDoc();
      unsubUserDoc();
    };
  }, [activePartnerId]);

  // Resolve Level-1 / Level-2 Doorstep Coordinates
  const destCoords = useMemo(() => {
    return resolveDoorstepCoords(
      liveBooking,
      customerLat,
      customerLng,
      bookingLocation,
      destinationAddress
    );
  }, [liveBooking, customerLat, customerLng, bookingLocation, destinationAddress]);

  const rawStatus = (liveBooking.status || "pending").toLowerCase();

  // Resolve Authentic Partner GPS ONLY — returns null if no verified partner coordinates exist in Firestore
  const partnerLocation = useMemo((): {
    lat: number;
    lng: number;
    heading: number | null;
  } | null => {
    const isTripActive = [
      "on_the_way",
      "in_transit",
      "pro_en_route",
      "arrived",
      "in_progress",
    ].includes(rawStatus);

    if (!activePartnerId || !isTripActive) {
      return null;
    }

    // Priority 1: Real-time booking.partnerLocation
    const bookingLoc =
      liveBooking.partnerLocation || (liveBooking as any).expertLocation;
    if (isValidPartnerGps(bookingLoc, destCoords, rawStatus)) {
      return {
        lat: Number(bookingLoc.lat),
        lng: Number(bookingLoc.lng),
        heading:
          typeof (bookingLoc as any).heading === "number"
            ? (bookingLoc as any).heading
            : null,
      };
    }

    // Priority 2: partners/{partnerId} document GPS
    if (isValidPartnerGps(partnerDoc, destCoords, rawStatus)) {
      return {
        lat: Number(partnerDoc.lat),
        lng: Number(partnerDoc.lng),
        heading:
          typeof partnerDoc.heading === "number" ? partnerDoc.heading : null,
      };
    }

    // Secondary user profile location
    const userLoc = (partnerProfile as any)?.location;
    if (isValidPartnerGps(userLoc, destCoords, rawStatus)) {
      return {
        lat: Number(userLoc.lat),
        lng: Number(userLoc.lng),
        heading: null,
      };
    }

    return null;
  }, [
    activePartnerId,
    liveBooking.partnerLocation,
    (liveBooking as any).expertLocation,
    rawStatus,
    partnerDoc,
    partnerProfile,
    destCoords,
  ]);

  const handleRouteUpdate = useCallback(
    (newEta: string | null, newDist: string | null) => {
      setEta(newEta);
      setDistance(newDist);
    },
    []
  );

  const partnerName: string | null =
    liveBooking.partnerName ||
    (liveBooking as any).assignedPartnerName ||
    partnerUser?.displayName ||
    partnerDoc?.displayName ||
    partnerProfile?.displayName ||
    null;

  const partnerPhone =
    liveBooking.partnerPhone ||
    (liveBooking as any).assignedPartnerPhone ||
    (partnerUser as any)?.phoneNumber ||
    (partnerUser as any)?.mobile ||
    (partnerDoc as any)?.phone ||
    (partnerProfile as any)?.phoneNumber ||
    (partnerProfile as any)?.mobile ||
    "";

  const partnerAvatar =
    partnerUser?.photoURL ||
    partnerProfile?.photoURL ||
    (partnerDoc as any)?.onboardingData?.profileImage ||
    (partnerProfile as any)?.avatar ||
    "";

  const rawPartnerRating =
    (partnerDoc as any)?.rating ??
    (partnerProfile as any)?.rating ??
    (partnerUser as any)?.rating ??
    (liveBooking as any).partnerRating ??
    null;

  const partnerRating: number | null =
    typeof rawPartnerRating === "number" &&
    !isNaN(rawPartnerRating) &&
    rawPartnerRating > 0
      ? rawPartnerRating
      : null;

  const displayOtp: string | null =
    liveBooking.serviceOtp ||
    liveBooking.startOTP ||
    (liveBooking as any).startOtp ||
    (liveBooking as any).otp ||
    null;

  const isCompleted = ["completed", "finalized"].includes(rawStatus);
  const isCancelled = rawStatus === "cancelled";
  const showOtpBadge =
    !liveBooking.otpVerified &&
    rawStatus !== "in_progress" &&
    !isCompleted &&
    !isCancelled &&
    Boolean(displayOtp);

  const statusLabel = useMemo(() => {
    if (rawStatus === "pending") return "Searching for Nearby Partner";
    if (rawStatus === "assigned" || rawStatus === "confirmed") {
      return "Technician Assigned • Awaiting Departure";
    }
    if (rawStatus === "on_the_way") return "🛵 Technician is on the way";
    if (rawStatus === "arrived") return "📍 Technician has arrived at doorstep";
    if (rawStatus === "in_progress") return "⚡ Service in progress";
    if (isCompleted) return "✓ Service completed";
    if (isCancelled) return "✕ Booking cancelled";
    return "Awaiting Live Status Update";
  }, [rawStatus, isCompleted, isCancelled]);

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
          {/* TOP 60% OF VIEWPORT: DEDICATED FULL-WIDTH MAP CONTAINER */}
          <div className="relative w-full h-[60%] z-[1] overflow-hidden bg-slate-100">
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

            {!partnerLocation && (
              <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-none">
                <div className="bg-slate-900/90 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-lg border border-slate-700/80 flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                  <p className="text-xs font-semibold leading-snug">
                    Waiting for technician to start trip. Live GPS will broadcast as soon as the partner is en-route.
                  </p>
                </div>
              </div>
            )}

            <Map
              defaultCenter={destCoords}
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
            {/* 1. Live Status Pill + Authentic Distance / ETA */}
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                <span>{statusLabel}</span>
              </div>
              {partnerLocation && distance && eta ? (
                <div className="text-right">
                  <span className="text-xs sm:text-sm font-black text-slate-900 block">
                    {distance} away • {eta}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold block">
                    Live GPS Route
                  </span>
                </div>
              ) : (
                <div className="text-right">
                  <span className="text-[11px] font-bold text-slate-500 block">
                    Awaiting Live GPS
                  </span>
                </div>
              )}
            </div>

            {/* 2. Prominent Start OTP Badge on Tracking Screen */}
            {showOtpBadge && displayOtp && (
              <div className="my-2 p-2.5 rounded-2xl bg-blue-50 border border-blue-200/80 flex items-center justify-between gap-2 shadow-2xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black shrink-0">
                    <KeyRound size={14} className="stroke-[2.5]" />
                  </div>
                  <p className="text-[11px] font-bold text-slate-800 leading-tight">
                    Share Start OTP with partner at doorstep:
                  </p>
                </div>
                <div className="bg-white text-blue-700 font-mono font-bold text-sm tracking-[0.2em] px-3 py-1 rounded-xl border border-blue-200/80 shrink-0 select-all">
                  OTP: {displayOtp}
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
                      alt={partnerName || "Technician"}
                      className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shadow-xs"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-700 to-blue-500 text-white font-black text-base flex items-center justify-center shadow-xs">
                      {(partnerName || "P").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-sm font-black text-slate-900 truncate">
                      {partnerName || "Assigned Technician"}
                    </h4>
                    {partnerRating !== null && (
                      <span className="inline-flex items-center gap-0.5 text-xs font-black text-amber-500">
                        <Star size={12} className="fill-amber-400 stroke-amber-400" />
                        {Number(partnerRating).toFixed(1)}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-bold text-slate-500 truncate">
                    {serviceName || liveBooking.serviceName || "Certified Professional"}
                  </p>
                </div>
              </div>

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
                <span className="truncate">
                  {destinationAddress ||
                    liveBooking.address ||
                    (liveBooking as any).fullAddress ||
                    "147, Anil Nagar, Barfani Dham, Indore"}
                </span>
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
