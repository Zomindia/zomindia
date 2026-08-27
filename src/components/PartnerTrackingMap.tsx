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
  Phone,
  MessageSquare,
  Star,
  Maximize2,
} from "lucide-react";

export interface PartnerTrackingMapProps {
  partnerId?: string;
  partnerLat?: number;
  partnerLng?: number;
  customerLat?: number;
  customerLng?: number;
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
  partnerLocation: { lat: number; lng: number } | null;
  destCoords: { lat: number; lng: number } | null;
  onRouteUpdate?: (eta: string, distance: string) => void;
  isMini?: boolean;
}

// Minimalist Map Styling
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

// Default coordinates around Indore (Vijay Nagar / Anil Nagar) for guaranteed fallbacks
const DEFAULT_INDORE_DESTINATION = { lat: 22.7533, lng: 75.8937 };
const DEFAULT_INDORE_PARTNER = { lat: 22.7196, lng: 75.8577 };

// Calculate Haversine direct distance in kilometers
function calculateHaversineDistance(
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number }
): number {
  const R = 6371; // Earth radius in km
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

// Generate a realistic curved path connecting the two coordinates
function generateCurvedPath(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  numPoints: number = 25
): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  const midLat = (start.lat + end.lat) / 2;
  const midLng = (start.lng + end.lng) / 2;

  const dLat = end.lat - start.lat;
  const dLng = end.lng - start.lng;
  const perpLat = -dLng * 0.15;
  const perpLng = dLat * 0.15;

  const controlPoint = {
    lat: midLat + perpLat,
    lng: midLng + perpLng,
  };

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const invT = 1 - t;
    const lat =
      invT * invT * start.lat +
      2 * invT * t * controlPoint.lat +
      t * t * end.lat;
    const lng =
      invT * invT * start.lng +
      2 * invT * t * controlPoint.lng +
      t * t * end.lng;
    points.push({ lat, lng });
  }

  return points;
}

// Dedicated React Google Maps Polyline Component
function RoutePolyline({ path }: { path: Array<{ lat: number; lng: number }> }) {
  const map = useMap();
  const mapsLib = useMapsLibrary("maps");
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map || !mapsLib || path.length < 2) return;

    if (!polylineRef.current) {
      polylineRef.current = new mapsLib.Polyline({
        strokeColor: "#2563EB", // Royal Blue
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
  const hasInitialFittedRef = useRef(false);
  const onRouteUpdateRef = useRef(onRouteUpdate);

  useEffect(() => {
    onRouteUpdateRef.current = onRouteUpdate;
  }, [onRouteUpdate]);

  const pLat = partnerLocation?.lat;
  const pLng = partnerLocation?.lng;
  const dLat = destCoords?.lat;
  const dLng = destCoords?.lng;

  // 1. Compute stable static array of route points immediately (25 interpolated points)
  const routePath = useMemo(() => {
    if (
      typeof pLat !== "number" ||
      typeof pLng !== "number" ||
      typeof dLat !== "number" ||
      typeof dLng !== "number"
    ) {
      return [];
    }
    const start = { lat: pLat, lng: pLng };
    const end = { lat: dLat, lng: dLng };
    const curved = generateCurvedPath(start, end, 25);
    return curved.length >= 2 ? curved : [start, end];
  }, [pLat, pLng, dLat, dLng]);

  // Update ETA once when points are calculated
  useEffect(() => {
    if (
      typeof pLat === "number" &&
      typeof pLng === "number" &&
      typeof dLat === "number" &&
      typeof dLng === "number"
    ) {
      const straightKm = calculateHaversineDistance(
        { lat: pLat, lng: pLng },
        { lat: dLat, lng: dLng }
      );
      const roadDistanceKm = Math.max(0.4, straightKm * 1.35);
      const durationMin = Math.max(2, Math.ceil((roadDistanceKm / 24) * 60));
      if (onRouteUpdateRef.current) {
        onRouteUpdateRef.current(`~${durationMin} mins`, `${roadDistanceKm.toFixed(1)} km`);
      }
    }
  }, [pLat, pLng, dLat, dLng]);

  // 2. Apply static Map Options once
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

  // 3. Stabilize Map Camera & FitBounds strictly once on initial mount
  useEffect(() => {
    if (!map || typeof google === "undefined" || hasInitialFittedRef.current) return;

    if (partnerLocation && destCoords) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(partnerLocation);
      bounds.extend(destCoords);
      if (routePath.length > 0) {
        routePath.forEach((pt) => bounds.extend(pt));
      }
      map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
      hasInitialFittedRef.current = true;
    } else if (partnerLocation) {
      map.panTo(partnerLocation);
      map.setZoom(15);
      hasInitialFittedRef.current = true;
    } else if (destCoords) {
      map.panTo(destCoords);
      map.setZoom(15);
      hasInitialFittedRef.current = true;
    }
  }, [map, partnerLocation, destCoords, routePath]);

  return (
    <>
      {/* 🛣️ Royal Blue Navigation Route Line */}
      <RoutePolyline path={routePath} />

      {/* Static Destination Marker: Red rounded badge with home pin */}
      {destCoords && (
        <AdvancedMarker position={destCoords}>
          <div className="relative flex flex-col items-center select-none">
            <div className="w-8 h-8 rounded-xl bg-[#E11D48] border-2 border-white shadow-md flex items-center justify-center text-white">
              <span className="text-base leading-none">🏠</span>
            </div>
            {!isMini && (
              <div className="mt-1 bg-slate-900 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap">
                Doorstep
              </div>
            )}
          </div>
        </AdvancedMarker>
      )}

      {/* Static Delivery Bike Marker: Clean white circular container */}
      {partnerLocation && (
        <AdvancedMarker position={partnerLocation}>
          <div className="relative flex flex-col items-center select-none cursor-pointer">
            <div className="w-9 h-9 rounded-full bg-white shadow-md border border-slate-200 flex items-center justify-center text-lg">
              🛵
            </div>
            {!isMini && (
              <div className="mt-1 bg-slate-900 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap">
                Partner
              </div>
            )}
          </div>
        </AdvancedMarker>
      )}
    </>
  );
}

export default function PartnerTrackingMap({
  partnerId,
  partnerLat,
  partnerLng,
  customerLat,
  customerLng,
  bookingLocation,
  destinationAddress,
  bookingId,
  serviceName,
  onCall,
  onChat,
  heightClassName = "h-[360px] sm:h-[400px]",
  variant = "full",
  onExpand,
}: PartnerTrackingMapProps) {
  const [partnerLocation, setPartnerLocation] = useState<{ lat: number; lng: number }>(() => {
    if (typeof partnerLat === "number" && typeof partnerLng === "number") {
      return { lat: partnerLat, lng: partnerLng };
    }
    return DEFAULT_INDORE_PARTNER;
  });
  const [partnerInfo, setPartnerInfo] = useState<PartnerProfile | null>(null);
  const [userInfo, setUserInfo] = useState<UserProfile | null>(null);
  const [eta, setEta] = useState<string>("~2 mins");
  const [distance, setDistance] = useState<string>("");
  const [destCoords, setDestCoords] = useState<{ lat: number; lng: number }>(() => {
    if (typeof customerLat === "number" && typeof customerLng === "number") {
      return { lat: customerLat, lng: customerLng };
    }
    if (bookingLocation && typeof bookingLocation.lat === "number" && typeof bookingLocation.lng === "number") {
      return bookingLocation;
    }
    if (typeof partnerLat === "number" && typeof partnerLng === "number") {
      return { lat: partnerLat + 0.012, lng: partnerLng + 0.015 };
    }
    return DEFAULT_INDORE_DESTINATION;
  });

  const isMini = variant === "mini";

  const handleRouteUpdate = useCallback((newEta: string, newDist: string) => {
    setEta((prev) => (prev !== newEta ? newEta : prev));
    setDistance((prev) => (prev !== newDist ? newDist : prev));
  }, []);

  // Sync prop changes for explicit coordinates with equality guards
  useEffect(() => {
    if (typeof partnerLat === "number" && typeof partnerLng === "number") {
      setPartnerLocation((prev) => {
        if (prev && prev.lat === partnerLat && prev.lng === partnerLng) return prev;
        return { lat: partnerLat, lng: partnerLng };
      });
    }
  }, [partnerLat, partnerLng]);

  useEffect(() => {
    if (typeof customerLat === "number" && typeof customerLng === "number") {
      setDestCoords((prev) => {
        if (prev && prev.lat === customerLat && prev.lng === customerLng) return prev;
        return { lat: customerLat, lng: customerLng };
      });
    }
  }, [customerLat, customerLng]);

  const bookingLat = bookingLocation?.lat;
  const bookingLng = bookingLocation?.lng;

  // Geocode address fallback if coordinates missing
  useEffect(() => {
    if (typeof customerLat === "number" && typeof customerLng === "number") {
      setDestCoords((prev) => {
        if (prev && prev.lat === customerLat && prev.lng === customerLng) return prev;
        return { lat: customerLat, lng: customerLng };
      });
      return;
    }
    if (typeof bookingLat === "number" && typeof bookingLng === "number") {
      setDestCoords((prev) => {
        if (prev && prev.lat === bookingLat && prev.lng === bookingLng) return prev;
        return { lat: bookingLat, lng: bookingLng };
      });
      return;
    }

    if (destinationAddress && destinationAddress.trim().length > 0) {
      let isMounted = true;
      const resolveAddress = async () => {
        try {
          const query = destinationAddress.toLowerCase().includes("indore")
            ? destinationAddress
            : `${destinationAddress}, Indore, Madhya Pradesh, India`;

          const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            query
          )}&limit=1`;
          const res = await fetch(url, {
            headers: {
              "Accept-Language": "en",
              "User-Agent": "zomindia-app-preview",
            },
          });
          if (res.ok && isMounted) {
            const data = await res.json();
            if (data?.[0]) {
              const newLat = parseFloat(data[0].lat);
              const newLng = parseFloat(data[0].lon);
              if (!isNaN(newLat) && !isNaN(newLng)) {
                setDestCoords((prev) => {
                  if (prev && prev.lat === newLat && prev.lng === newLng) return prev;
                  return { lat: newLat, lng: newLng };
                });
                return;
              }
            }
          }
        } catch {
          // Fallback handled gracefully
        }
        // If geocoding didn't resolve, ensure fallback coordinate
        if (isMounted) {
          setDestCoords((prev) => {
            if (prev) return prev;
            return typeof partnerLat === "number" && typeof partnerLng === "number"
              ? { lat: partnerLat + 0.012, lng: partnerLng + 0.015 }
              : DEFAULT_INDORE_DESTINATION;
          });
        }
      };
      resolveAddress();
      return () => {
        isMounted = false;
      };
    } else {
      // Default nearby destination if no address provided
      setDestCoords((prev) => {
        if (prev) return prev;
        return typeof partnerLat === "number" && typeof partnerLng === "number"
          ? { lat: partnerLat + 0.012, lng: partnerLng + 0.015 }
          : DEFAULT_INDORE_DESTINATION;
      });
    }
  }, [customerLat, customerLng, bookingLat, bookingLng, destinationAddress, partnerLat, partnerLng]);

  // Firestore real-time coordinate synchronization
  useEffect(() => {
    if (!partnerId) return;

    const unsubPartner = onSnapshot(
      doc(db, "partners", partnerId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as PartnerProfile;
          if (data.lat && data.lng) {
            setPartnerLocation((prev) => {
              if (prev && prev.lat === data.lat && prev.lng === data.lng) return prev;
              return { lat: data.lat, lng: data.lng };
            });
          }
          setPartnerInfo(data);
        }
      },
      (err) => {
        console.warn("[Tracking] Partner snapshot warning:", err?.message);
      }
    );

    const unsubUser = onSnapshot(
      doc(db, "users", partnerId),
      (snap) => {
        if (snap.exists()) {
          setUserInfo(snap.data() as UserProfile);
        }
      },
      (err) => {
        console.warn("[Tracking] User snapshot warning:", err?.message);
      }
    );

    let unsubBooking: (() => void) | undefined;
    if (bookingId) {
      unsubBooking = onSnapshot(
        doc(db, "bookings", bookingId),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (
              data?.partnerLocation &&
              typeof data.partnerLocation.lat === "number" &&
              typeof data.partnerLocation.lng === "number"
            ) {
              setPartnerLocation((prev) => {
                if (
                  prev &&
                  prev.lat === data.partnerLocation.lat &&
                  prev.lng === data.partnerLocation.lng
                )
                  return prev;
                return {
                  lat: data.partnerLocation.lat,
                  lng: data.partnerLocation.lng,
                };
              });
            }
          }
        },
        (err) => {
          console.warn("[Tracking] Booking snapshot warning:", err?.message);
        }
      );
    }

    return () => {
      unsubPartner();
      unsubUser();
      if (unsubBooking) unsubBooking();
    };
  }, [partnerId, bookingId]);

  const partnerName = userInfo?.displayName || userInfo?.fullName || partnerInfo?.displayName || partnerInfo?.fullName || "Assigned Expert";
  const partnerRating = partnerInfo?.rating ? Number(partnerInfo.rating).toFixed(1) : "4.9";
  const partnerAvatar = userInfo?.photoURL || partnerInfo?.onboardingData?.profileImage;

  const handleDefaultCall = () => {
    if (onCall) {
      onCall();
      return;
    }
    if (typeof (window as any).__showToast === "function") {
      (window as any).__showToast(
        `Bridging secure call via Central Landline Gateway: ${CORPORATE_LANDLINE_GATEWAY}...`
      );
    } else {
      window.open(`tel:${userInfo?.phoneNumber || CORPORATE_LANDLINE_GATEWAY}`);
    }
  };

  const handleDefaultChat = () => {
    if (onChat) {
      onChat();
      return;
    }
    if (typeof (window as any).__openCustomerChat === "function") {
      (window as any).__openCustomerChat(bookingId || partnerId);
    } else if (typeof (window as any).__showToast === "function") {
      (window as any).__showToast(`Opening live chat with ${partnerName}...`);
    }
  };

  const initialCenter = useMemo(() => {
    return (
      partnerLocation ||
      bookingLocation ||
      destCoords || { lat: 22.7196, lng: 75.8577 }
    );
  }, [partnerLocation, bookingLocation, destCoords]);

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
          defaultCenter={initialCenter}
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
            {/* Top-Left Floating Pill: 🛵 On the way • ~2 mins away */}
            <div className="absolute top-2.5 left-2.5 z-20 pointer-events-auto">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/95 text-slate-800 text-[11px] font-bold shadow-xs border border-slate-200/60 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span>🛵 On the way</span>
                <span className="text-slate-300 font-bold">•</span>
                <span className="text-blue-600 font-extrabold">{eta ? `${eta} away` : "~2 mins away"}</span>
              </div>
            </div>

            {/* Top-Right Expand Trigger: Minimalist round button with Maximize2 size={14} */}
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
            {/* Full View: Top Floating ETA Pill */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
              <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/95 text-slate-900 border border-slate-200 shadow-md">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-xs sm:text-sm font-black tracking-tight flex items-center gap-1.5">
                  <span className="text-base">🛵</span>
                  <span>Arriving in <span className="text-blue-600 font-extrabold">{eta}</span></span>
                  {distance && (
                    <span className="text-slate-400 font-medium text-[11px] ml-1">
                      ({distance})
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Full View: Compact Bottom Floating Action Bar */}
            <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 z-20 pointer-events-auto">
              <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-xl border border-slate-200 flex items-center justify-between gap-3">
                {/* Technician Info */}
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
                      {serviceName || partnerInfo?.skills?.[0] || partnerInfo?.categories?.[0] || "Service Professional"}
                    </p>
                  </div>
                </div>

                {/* Direct Action Buttons: [ 📞 Call Pro ] and [ 💬 Chat ] */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleDefaultCall}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs shadow-sm transition-all cursor-pointer"
                    title="Call Professional"
                  >
                    <Phone size={13} className="fill-white" />
                    <span className="hidden sm:inline">Call Pro</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDefaultChat}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-xs shadow-sm transition-all cursor-pointer"
                    title="Live Chat"
                  >
                    <MessageSquare size={13} className="fill-white" />
                    <span className="hidden sm:inline">Chat</span>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
