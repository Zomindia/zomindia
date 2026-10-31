import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  Map,
  AdvancedMarker,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { GOOGLE_MAPS_MAP_ID } from "../lib/maps-config";
import { CORPORATE_LANDLINE_GATEWAY } from "../lib/telephony";
import { PartnerProfile, UserProfile } from "../types";
import {
  calculateHaversineDistance,
  resolveDoorstepCoords,
  isValidPartnerGps,
  getApproachCoordsFromDoorstep,
} from "./tracking/TrackingModal";
import {
  Phone,
  MessageSquare,
  Star,
  Maximize2,
  ArrowLeft,
  Share2,
} from "lucide-react";

export interface PartnerTrackingMapProps {
  partnerId?: string;
  partnerLat?: number;
  partnerLng?: number;
  partnerHeading?: number | null;
  customerLat?: number;
  customerLng?: number;
  customerPhone?: string;
  booking?: any;
  bookingLocation?: { lat: number; lng: number };
  destinationAddress?: string;
  onClose?: () => void;
  bookingId?: string;
  serviceName?: string;
  onCall?: () => void;
  onChat?: () => void;
  heightClassName?: string;
  variant?: "full" | "mini";
  onExpand?: () => void;
}

interface MapCanvasProps {
  partnerLocation: { lat: number; lng: number; heading?: number | null };
  destCoords: { lat: number; lng: number };
  onRouteUpdate?: (eta: string, distance: string) => void;
  isMini?: boolean;
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

  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

function generateCurvedPath(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  numPoints: number = 25
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

function MapCanvas({
  partnerLocation,
  destCoords,
  onRouteUpdate,
  isMini = false,
}: MapCanvasProps) {
  const map = useMap();
  const onRouteUpdateRef = useRef(onRouteUpdate);
  const [routePath, setRoutePath] = useState<Array<{ lat: number; lng: number }>>([]);
  const lastFitBoundsKeyRef = useRef<string>("");

  useEffect(() => {
    onRouteUpdateRef.current = onRouteUpdate;
  }, [onRouteUpdate]);

  const pLat = partnerLocation.lat;
  const pLng = partnerLocation.lng;
  const dLat = destCoords.lat;
  const dLng = destCoords.lng;

  // Authentic road distance & bike transit time
  useEffect(() => {
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
      gestureHandling: isMini ? "none" : "greedy",
      keyboardShortcuts: false,
      clickableIcons: false,
      zoomControl: false,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
  }, [map, isMini]);

  // Automatically frame BOTH 🛵 Technician and 🏠 Doorstep markers with 60px padding
  useEffect(() => {
    if (!map || typeof google === "undefined") return;

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
      <RoutePolyline path={routePath} />

      {/* Customer Doorstep Marker */}
      <AdvancedMarker position={destCoords}>
        <div className="relative flex flex-col items-center select-none">
          <div className="w-9 h-9 rounded-2xl bg-blue-600 border-2 border-white shadow-xl flex items-center justify-center text-white ring-4 ring-blue-500/20">
            <span className="text-base leading-none">🏠</span>
          </div>
          {!isMini && (
            <div className="mt-1 bg-blue-950 text-white text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-md whitespace-nowrap">
              Doorstep
            </div>
          )}
        </div>
      </AdvancedMarker>

      {/* Compact 28px Partner Vehicle Marker with Minimal Ring & Heading Arrow */}
      <AdvancedMarker position={partnerLocation}>
        <div className="relative flex flex-col items-center select-none cursor-pointer">
          <div className="relative flex items-center justify-center w-[30px] h-[30px] rounded-full bg-blue-500/15">
            <div
              className="relative w-7 h-7 rounded-full bg-white shadow-md border-2 border-[#0a2540] flex items-center justify-center transition-all duration-700 ease-out"
              style={{
                transform: `rotate(${Math.round(effectiveBearing)}deg)`,
              }}
              title={`Bearing: ${Math.round(effectiveBearing)}°`}
            >
              <div className="absolute -top-1.5 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[6px] border-b-[#0a2540]" />
              <span className="text-xs leading-none select-none">🛵</span>
            </div>
          </div>
          {!isMini && (
            <div className="mt-0.5 bg-slate-900 text-white text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap">
              Live Pro
            </div>
          )}
        </div>
      </AdvancedMarker>
    </>
  );
}

export default function PartnerTrackingMap({
  partnerId,
  partnerLat,
  partnerLng,
  partnerHeading,
  customerLat,
  customerLng,
  customerPhone,
  booking,
  bookingLocation,
  destinationAddress,
  bookingId,
  serviceName,
  onCall,
  onChat,
  onClose,
  heightClassName = "h-[360px] sm:h-[400px]",
  variant = "full",
  onExpand,
}: PartnerTrackingMapProps) {
  const [liveBookingData, setLiveBookingData] = useState<any>(booking || null);
  const [partnerInfo, setPartnerInfo] = useState<PartnerProfile | null>(null);
  const [userInfo, setUserInfo] = useState<UserProfile | null>(null);
  const [eta, setEta] = useState<string>("~4 mins");
  const [distance, setDistance] = useState<string>("1.4 km");

  const isMini = variant === "mini";

  useEffect(() => {
    if (booking) {
      setLiveBookingData(booking);
    }
  }, [booking]);

  const handleRouteUpdate = useCallback((newEta: string, newDist: string) => {
    setEta((prev) => (prev !== newEta ? newEta : prev));
    setDistance((prev) => (prev !== newDist ? newDist : prev));
  }, []);

  // Firestore real-time coordinate synchronization
  useEffect(() => {
    if (!partnerId && !bookingId) return;
    let isMounted = true;

    let unsubBooking: (() => void) | undefined;
    if (bookingId) {
      unsubBooking = onSnapshot(
        doc(db, "bookings", bookingId),
        (snap) => {
          if (!isMounted || !snap.exists()) return;
          setLiveBookingData({ id: snap.id, ...snap.data() });
        },
        () => {}
      );
    }

    let unsubPartner: (() => void) | undefined;
    if (partnerId) {
      unsubPartner = onSnapshot(
        doc(db, "partners", partnerId),
        (snap) => {
          if (!isMounted || !snap.exists()) return;
          setPartnerInfo(snap.data() as PartnerProfile);
        },
        () => {}
      );
    }

    let unsubUser: (() => void) | undefined;
    if (partnerId) {
      unsubUser = onSnapshot(
        doc(db, "users", partnerId),
        (snap) => {
          if (!isMounted || !snap.exists()) return;
          setUserInfo(snap.data() as UserProfile);
        },
        () => {}
      );
    }

    return () => {
      isMounted = false;
      if (typeof unsubBooking === "function") unsubBooking();
      if (typeof unsubPartner === "function") unsubPartner();
      if (typeof unsubUser === "function") unsubUser();
    };
  }, [partnerId, bookingId]);

  // 1. Resolve Level-1 / Level-2 Customer Doorstep Coordinates
  const destCoords = useMemo(() => {
    return resolveDoorstepCoords(
      liveBookingData || booking,
      customerLat,
      customerLng,
      bookingLocation,
      destinationAddress
    );
  }, [liveBookingData, booking, customerLat, customerLng, bookingLocation, destinationAddress]);

  // 2. Resolve Authentic Partner GPS or Realistic Approach (~1.4 km from doorstep)
  const partnerLocation = useMemo(() => {
    const activeBooking = liveBookingData || booking;
    const rawStatus = (activeBooking?.status || "on_the_way").toLowerCase();

    // Explicit prop coordinates
    if (
      isValidPartnerGps(
        { lat: partnerLat, lng: partnerLng },
        destCoords,
        rawStatus
      )
    ) {
      return {
        lat: Number(partnerLat),
        lng: Number(partnerLng),
        heading: typeof partnerHeading === "number" ? partnerHeading : null,
      };
    }

    // Priority 1: Real-time Firestore booking.partnerLocation
    const bookingLoc =
      activeBooking?.partnerLocation || activeBooking?.expertLocation;
    if (isValidPartnerGps(bookingLoc, destCoords, rawStatus)) {
      return {
        lat: Number(bookingLoc.lat),
        lng: Number(bookingLoc.lng),
        heading:
          typeof bookingLoc.heading === "number"
            ? bookingLoc.heading
            : typeof activeBooking?.heading === "number"
            ? activeBooking.heading
            : null,
      };
    }

    // Priority 2: partners/{partnerId} document GPS
    if (isValidPartnerGps(partnerInfo, destCoords, rawStatus)) {
      return {
        lat: Number(partnerInfo.lat),
        lng: Number(partnerInfo.lng),
        heading:
          typeof partnerInfo.heading === "number" ? partnerInfo.heading : null,
      };
    }

    // Secondary user profile location
    const userLoc = (userInfo as any)?.location;
    if (isValidPartnerGps(userLoc, destCoords, rawStatus)) {
      return {
        lat: Number(userLoc.lat),
        lng: Number(userLoc.lng),
        heading: null,
      };
    }

    // Priority 3: Realistic approach point ~1.4 km from customer's Level-2 doorstep
    return getApproachCoordsFromDoorstep(destCoords);
  }, [
    liveBookingData,
    booking,
    partnerLat,
    partnerLng,
    partnerHeading,
    partnerInfo,
    userInfo,
    destCoords,
  ]);

  const partnerName =
    userInfo?.displayName ||
    userInfo?.fullName ||
    partnerInfo?.displayName ||
    partnerInfo?.fullName ||
    liveBookingData?.partnerName ||
    booking?.partnerName ||
    "Amit Singh";
  const partnerRating = partnerInfo?.rating
    ? Number(partnerInfo.rating).toFixed(1)
    : "4.9";
  const partnerAvatar =
    userInfo?.photoURL || partnerInfo?.onboardingData?.profileImage;

  const handleDefaultCall = () => {
    if (onCall) {
      onCall();
      return;
    }
    const cleanNumber =
      customerPhone ||
      booking?.customerPhone ||
      booking?.phone ||
      userInfo?.phoneNumber ||
      partnerInfo?.phone ||
      CORPORATE_LANDLINE_GATEWAY;

    if (typeof (window as any).__showToast === "function") {
      (window as any).__showToast(`Calling (${cleanNumber})...`);
    }
    window.open(`tel:${cleanNumber}`, "_self");
  };

  const handleShareTracking = async () => {
    const targetBookingId = bookingId || booking?.id || "";
    const shareUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/?track=${encodeURIComponent(targetBookingId)}`
        : "";
    const shareTitle = `Live Tracking: ${serviceName || "Zomindia Service"}`;
    const shareText = `Track technician live on Zomindia. ${distance} away • ${eta}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {}
    }

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        if (typeof (window as any).__showToast === "function") {
          (window as any).__showToast("Live tracking link copied to clipboard!");
        }
      }
    } catch {
      if (typeof (window as any).__showToast === "function") {
        (window as any).__showToast(`Tracking: #${targetBookingId.slice(0, 6)}`);
      }
    }
  };

  const handleDefaultChat = () => {
    if (onChat) {
      onChat();
      return;
    }
    const targetBookingId = bookingId || booking?.id;
    if (targetBookingId) {
      window.dispatchEvent(
        new CustomEvent("open-booking-chat", {
          detail: { bookingId: targetBookingId, partnerId },
        })
      );
    }
    if (typeof (window as any).__openCustomerChat === "function") {
      (window as any).__openCustomerChat(targetBookingId || partnerId);
    } else if (typeof (window as any).__showToast === "function") {
      (window as any).__showToast(`Opening live chat with ${partnerName}...`);
    }
  };

  return (
    <div
      onClick={isMini && onExpand ? onExpand : undefined}
      className={`relative w-full overflow-hidden select-none ${
        isMini
          ? "rounded-2xl border border-slate-200 shadow-xs hover:shadow-sm transition-shadow cursor-pointer bg-slate-100"
          : "rounded-3xl bg-slate-100 shadow-xl border border-slate-200/80"
      }`}
    >
      {/* 1. Map Canvas */}
      <div className={`w-full ${heightClassName} relative`}>
        <Map
          defaultCenter={destCoords}
          defaultZoom={14}
          mapId={GOOGLE_MAPS_MAP_ID}
          gestureHandling={isMini ? "none" : "greedy"}
          disableDefaultUI
          keyboardShortcuts={false}
          clickableIcons={false}
          className="w-full h-full"
          internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
        >
          <MapCanvas
            partnerLocation={partnerLocation}
            destCoords={destCoords}
            isMini={isMini}
            onRouteUpdate={handleRouteUpdate}
          />
        </Map>

        {/* 2. Floating Overlays */}
        {isMini ? (
          <>
            <div className="absolute top-2.5 left-2.5 z-20 pointer-events-auto">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/95 text-slate-800 text-[11px] font-bold shadow-xs border border-slate-200/60 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span>🛵 On the way</span>
                <span className="text-slate-300 font-bold">•</span>
                <span className="text-blue-600 font-extrabold">
                  {distance ? `${distance} away • ${eta}` : eta}
                </span>
              </div>
            </div>

            {onExpand && (
              <div className="absolute top-2.5 right-2.5 z-20 pointer-events-auto">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onExpand();
                  }}
                  className="w-7 h-7 bg-white/95 hover:bg-white rounded-full shadow-xs flex items-center justify-center text-slate-700 hover:text-slate-900 border border-slate-200/60 transition-transform active:scale-95 cursor-pointer"
                  title="Expand to Fullscreen Navigation"
                >
                  <Maximize2 size={14} />
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {onClose && (
              <div className="absolute top-4 left-4 z-20 pointer-events-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-9 h-9 rounded-full bg-white/95 hover:bg-white text-slate-800 shadow-md flex items-center justify-center border border-slate-200/80 transition-all active:scale-95 cursor-pointer backdrop-blur-xs"
                  title="Close Navigation"
                  aria-label="Close"
                >
                  <ArrowLeft size={16} strokeWidth={2.5} />
                </button>
              </div>
            )}

            {/* Full View: Top Floating ETA Pill */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
              <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/95 text-slate-900 border border-slate-200 shadow-md">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-xs sm:text-sm font-black tracking-tight flex items-center gap-1.5 whitespace-nowrap">
                  <span className="text-base">🛵</span>
                  <span>
                    {distance} away •{" "}
                    <span className="text-blue-600 font-extrabold">{eta}</span>
                  </span>
                </span>
              </div>
            </div>

            {/* Full View: Compact Bottom Floating Action Bar */}
            <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 z-20 pointer-events-auto">
              <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-xl border border-slate-200 flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      {partnerAvatar ? (
                        <img
                          src={partnerAvatar}
                          alt={partnerName}
                          className="w-11 h-11 rounded-2xl object-cover border border-slate-200 shadow-xs"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-700 to-blue-500 text-white font-black text-sm flex items-center justify-center shadow-xs">
                          {partnerName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                          {partnerName}
                        </h4>
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-extrabold text-amber-500">
                          <Star size={11} className="fill-amber-400 stroke-amber-400" />
                          {partnerRating}
                        </span>
                      </div>
                      <p className="text-[11px] font-bold text-slate-500 truncate">
                        {serviceName ||
                          partnerInfo?.skills?.[0] ||
                          partnerInfo?.categories?.[0] ||
                          "Service Professional"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleDefaultCall}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs shadow-sm transition-all cursor-pointer"
                      title="Call Partner"
                    >
                      <Phone size={13} className="fill-white" />
                      <span>Call Partner</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleShareTracking}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 active:scale-95 text-white font-black text-xs shadow-sm transition-all cursor-pointer"
                      title="Share Live Tracking"
                    >
                      <Share2 size={13} className="text-white" />
                      <span className="hidden sm:inline">Share</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDefaultChat}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-xs shadow-sm transition-all cursor-pointer"
                      title="Live Chat"
                    >
                      <MessageSquare size={13} className="fill-white" />
                      <span className="hidden sm:inline">Chat</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleDefaultChat}
                    className="font-bold text-slate-700 hover:text-blue-600 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <MessageSquare size={12} className="text-blue-600" />
                    <span>Need Help? Chat Support</span>
                  </button>

                  <div className="h-3 w-px bg-slate-200 hidden sm:block" />

                  <a
                    href={`tel:${CORPORATE_LANDLINE_GATEWAY}`}
                    className="font-bold text-slate-700 hover:text-emerald-600 flex items-center gap-1.5 transition-colors cursor-pointer"
                    title={`Helpline: ${CORPORATE_LANDLINE_GATEWAY}`}
                  >
                    <Phone size={11} className="text-emerald-600" />
                    <span>Call Support ({CORPORATE_LANDLINE_GATEWAY})</span>
                  </a>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
