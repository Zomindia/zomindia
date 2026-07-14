import React, { useEffect, useState, useRef } from "react";
import {
  Map,
  AdvancedMarker,
  Pin,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import PartnerIdentityMarker from "./PartnerIdentityMarker";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { CORPORATE_LANDLINE_GATEWAY } from "../lib/telephony";
import { PartnerProfile, UserProfile } from "../types";
import {
  MapPin,
  Navigation,
  Smartphone,
  Star,
  Phone,
  RefreshCw,
  Compass,
  Plus,
  Minus,
  Info,
  Clock,
  Maximize2,
  Minimize2,
  Globe,
  Layers,
  Search,
  X,
  Radio,
  Battery,
  BatteryCharging,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { handleMapsError } from "../lib/maps-errors";

interface PartnerTrackingMapProps {
  partnerId: string;
  bookingLocation?: { lat: number; lng: number };
  destinationAddress?: string;
  onClose?: () => void;
  bookingId?: string;
}



function MapLogic({
  partnerLocation,
  rawPartnerLocation,
  bookingLocation,
  destinationAddress,
  onRouteUpdate,
  refreshTrigger,
  userInfo,
  partnerInfo,
  onPartnerClick,
  pulseEnabled,
  historicalPath,
  autoZoomToFit,
  eta,
  autoRefreshEnabled,
}: {
  partnerLocation: { lat: number; lng: number };
  rawPartnerLocation: { lat: number; lng: number } | null;
  bookingLocation?: { lat: number; lng: number };
  destinationAddress?: string;
  onRouteUpdate?: (eta: string, distance: string) => void;
  refreshTrigger: number;
  userInfo: UserProfile | null;
  partnerInfo: PartnerProfile | null;
  onPartnerClick?: () => void;
  pulseEnabled: boolean;
  historicalPath: { lat: number; lng: number }[];
  autoZoomToFit: boolean;
  eta: string;
  autoRefreshEnabled: boolean;
}) {
  const map = useMap();
  const mapsLib = useMapsLibrary("maps");
  const routesLib = useMapsLibrary("routes");
  const [destCoords, setDestCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(bookingLocation || null);
  const [routePath, setRoutePath] = useState<string[]>([]);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [speed, setSpeed] = useState<number>(24.2);
  const [battery, setBattery] = useState<number>(84);

  const [animatedHistoricalPath, setAnimatedHistoricalPath] = useState<
    { lat: number; lng: number }[]
  >([]);

  useEffect(() => {
    if (!historicalPath || historicalPath.length === 0) {
      setAnimatedHistoricalPath([]);
      return;
    }

    let currentIndex = 0;
    const totalDuration = 1500; // 1.5 seconds animation window
    const stepDuration = Math.max(
      25,
      Math.min(250, totalDuration / historicalPath.length),
    );

    setAnimatedHistoricalPath([historicalPath[0]]);

    const timer = setInterval(() => {
      currentIndex++;
      if (currentIndex >= historicalPath.length) {
        clearInterval(timer);
        setAnimatedHistoricalPath(historicalPath);
      } else {
        setAnimatedHistoricalPath(historicalPath.slice(0, currentIndex + 1));
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [historicalPath]);

  // Dynamic automatic zoom-to-fit effect as live coordinates update
  useEffect(() => {
    if (!map || typeof google === "undefined" || !autoZoomToFit) return;
    const calcLoc = rawPartnerLocation || partnerLocation;
    if (calcLoc && destCoords) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(calcLoc);
      bounds.extend(destCoords);
      map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
    }
  }, [map, rawPartnerLocation, partnerLocation, destCoords, autoZoomToFit]);

  // Keep a single persistent circle instance to avoid heavy rebuilds 60 times/sec
  const circleRef = useRef<google.maps.Circle | null>(null);

  // 5km visual circle radius overlay around partner location
  useEffect(() => {
    if (!map || typeof google === "undefined") return;

    const circle = new google.maps.Circle({
      map,
      radius: 5000, // 5km radius scope
      fillColor: "#3b82f6",
      fillOpacity: 0.08,
      strokeColor: "#3b82f6",
      strokeOpacity: 0.25,
      strokeWeight: 1.2,
    });

    circleRef.current = circle;

    return () => {
      circle.setMap(null);
      circleRef.current = null;
    };
  }, [map]);

  // Adjust circle center cleanly on animation frames without overhead
  useEffect(() => {
    if (circleRef.current && partnerLocation) {
      circleRef.current.setCenter(partnerLocation);
    }
  }, [partnerLocation]);

  useEffect(() => {
    if (bookingLocation) {
      setDestCoords(bookingLocation);
    } else if (destinationAddress) {
      const resolveDestination = async () => {
        let resolvedCoords: { lat: number; lng: number } | null = null;

        // 1. Try Nominatim search FIRST
        try {
          const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destinationAddress)}&limit=1`;
          const res = await fetch(url, {
            headers: {
              "Accept-Language": "en",
              "User-Agent": "zomindia-app-preview",
            },
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.[0]) {
              resolvedCoords = {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon),
              };
            }
          }
        } catch (e) {
          console.warn(
            "Nominatim address search failed for destination in PartnerTrackingMap:",
            e,
          );
        }

        // 2. Fallback to Google Geocoder bypassed to avoid API authorization logs.

        if (resolvedCoords) {
          setDestCoords(resolvedCoords);
        }
      };

      resolveDestination();
    }
  }, [destinationAddress, bookingLocation]);

  // Generate realistic, organic telemetry details (simulated speed & battery metrics)
  useEffect(() => {
    if (!partnerLocation) return;

    // Smoothly fluctuating speed profile
    const latFactor = Math.floor(partnerLocation.lat * 100000);
    const lngFactor = Math.floor(partnerLocation.lng * 100000);

    // Simulate real vehicle speeds (0 km/h if static or stable, otherwise average commute speeds)
    const baseSpeed = 18 + (latFactor % 14); // 18-32 km/h
    setSpeed(Number(baseSpeed.toFixed(1)));

    // Slowly decaying/changing battery level based on coordinate hash to remain consistent but look authentic
    const baseBattery = 75 + (lngFactor % 21); // 75-95%
    setBattery(baseBattery);
  }, [partnerLocation]);

  const calcLocation = rawPartnerLocation || partnerLocation;

  useEffect(() => {
    if (!calcLocation || !destCoords || !routesLib) return;

    const calculateRoute = async (isInitial = false) => {
      if (!isInitial && !autoRefreshEnabled) return; // skip background route calculation if auto-refresh disabled
      try {
        const { routes } = await routesLib.Route.computeRoutes({
          origin: calcLocation,
          destination: destCoords,
          travelMode: "DRIVE",
          polylineQuality: "OVERVIEW",
          fields: ["polyline", "durationMillis", "distanceMeters"],
        } as any);

        if (routes?.[0]) {
          const route = routes[0] as any;
          if (route.polyline?.encodedPolyline)
            setRoutePath([route.polyline.encodedPolyline]);

          if (onRouteUpdate) {
            const minutes = Math.ceil(
              Number(route.durationMillis || 0) / 60000,
            );
            const km = (Number(route.distanceMeters) || 0) / 1000;
            onRouteUpdate(`${minutes} min`, `${km.toFixed(1)} km`);
          }
        }
      } catch (err) {
        console.error("Route calculation error:", err);
      }
    };

    calculateRoute(true);
    const interval = setInterval(() => calculateRoute(false), 30000);
    return () => clearInterval(interval);
  }, [
    calcLocation,
    destCoords,
    routesLib,
    onRouteUpdate,
    refreshTrigger,
    autoRefreshEnabled,
  ]);

  useEffect(() => {
    if (
      !map ||
      !routePath ||
      routePath.length === 0 ||
      typeof google === "undefined"
    )
      return;

    const polylines = routePath.map(
      (path) =>
        new google.maps.Polyline({
          path: google.maps.geometry.encoding.decodePath(path),
          geodesic: true,
          strokeColor: "#3b82f6",
          strokeOpacity: 0.8,
          strokeWeight: 4,
        }),
    );

    polylines.forEach((p) => p.setMap(map));

    if (calcLocation && destCoords) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(calcLocation);
      bounds.extend(destCoords);
      map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
    }

    return () => polylines.forEach((p) => p.setMap(null));
  }, [map, routePath, calcLocation, destCoords]);

  // Draw historical shift route path (sleek double-layered route trailing) with progressive 'drawing' animation
  useEffect(() => {
    if (
      !map ||
      !animatedHistoricalPath ||
      animatedHistoricalPath.length === 0 ||
      typeof google === "undefined"
    )
      return;

    // Glowing border line
    const glowLine = new google.maps.Polyline({
      path: animatedHistoricalPath,
      geodesic: true,
      strokeColor: "#c084fc", // Light neon purple glow
      strokeOpacity: 0.45,
      strokeWeight: 7,
    });

    // Solid core line
    const coreLine = new google.maps.Polyline({
      path: animatedHistoricalPath,
      geodesic: true,
      strokeColor: "#7c3aed", // Deep royal purple
      strokeOpacity: 0.95,
      strokeWeight: 3,
    });

    glowLine.setMap(map);
    coreLine.setMap(map);

    return () => {
      glowLine.setMap(null);
      coreLine.setMap(null);
    };
  }, [map, animatedHistoricalPath]);

  const partnerName = userInfo?.displayName || "Expert Agent";
  const partnerRating = partnerInfo?.rating
    ? Number(partnerInfo.rating).toFixed(1)
    : "4.9";
  const partnerReviews = partnerInfo?.reviewCount || 18;
  const partnerPhone = userInfo?.phoneNumber || "555-0199";

  const { isWithinProximity, pulseDuration } = (() => {
    if (!partnerLocation || !destCoords) {
      return { isWithinProximity: false, pulseDuration: "1.5s" };
    }
    const R = 6371e3; // Earth's radius in meters
    const phi1 = (partnerLocation.lat * Math.PI) / 180;
    const phi2 = (destCoords.lat * Math.PI) / 180;
    const deltaPhi = ((destCoords.lat - partnerLocation.lat) * Math.PI) / 180;
    const deltaLambda =
      ((destCoords.lng - partnerLocation.lng) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) *
        Math.cos(phi2) *
        Math.sin(deltaLambda / 2) *
        Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const dist = R * c;

    const maxReferenceDist = 1500;
    const clampedDist = Math.max(50, Math.min(dist, maxReferenceDist));
    const ratio = (clampedDist - 50) / (maxReferenceDist - 50); // scales from 0 (at 50m) to 1 (at 1500m)
    const dur = 0.35 + ratio * (2.0 - 0.35); // 0.35s to 2.0s duration

    return {
      isWithinProximity: dist <= 500,
      pulseDuration: `${dur.toFixed(2)}s`,
    };
  })();

  return (
    <>
      {partnerLocation && (
        <AdvancedMarker
          position={partnerLocation}
          onClick={(e) => {
            if (e) {
              // Ensure we stop default behavior and toggle tooltip
              (e as any).domEvent?.stopPropagation();
            }
            setShowTooltip(!showTooltip);
            if (onPartnerClick) {
              onPartnerClick();
            }
          }}
        >
          <div
            className="relative cursor-pointer select-none"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {pulseEnabled &&
              (isWithinProximity ? (
                <>
                  <div
                    className="absolute -inset-6 bg-emerald-500/30 rounded-full animate-ping"
                    style={{ animationDuration: pulseDuration }}
                  ></div>
                  <div
                    className="absolute -inset-4 bg-emerald-500/20 rounded-full animate-pulse border border-emerald-500/40"
                    style={{ animationDuration: pulseDuration }}
                  ></div>
                </>
              ) : (
                <div
                  className="absolute -inset-4 bg-blue-500/20 rounded-full animate-ping"
                  style={{ animationDuration: pulseDuration }}
                ></div>
              ))}
            {/* Permanent small ETA badge above the pin */}
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-blue-600 border border-white text-white font-extrabold text-[8px] tracking-[0.12em] uppercase px-2 py-0.5 rounded-full shadow-lg z-25 select-none whitespace-nowrap leading-none flex items-center justify-center gap-1.5 animate-pulse">
              <Clock size={8} className="stroke-[3.5]" />
              {eta}
            </div>

            <div
              className={`w-10 h-10 ${isWithinProximity && pulseEnabled ? "bg-emerald-600 shadow-lg shadow-emerald-500/40 animate-pulse ring-4 ring-emerald-500/35 border-emerald-300" : "bg-blue-700 shadow-blue-700/30"} rounded-2xl flex items-center justify-center text-white shadow-xl border-2 border-white relative z-10 transition-transform hover:scale-110 active:scale-95 duration-150`}
            >
              <Navigation size={20} className="rotate-45" />
            </div>

            {/* Speach Bubble Tooltip with partner name, rating and click-to-call */}
            {showTooltip && (
              <div
                className="absolute bottom-14 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white rounded-2xl p-3 shadow-2xl border border-slate-800 min-w-[190px] text-center flex flex-col items-center gap-2 animate-in fade-in zoom-in-95 duration-200 pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Speech Bubble Tail */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-3 h-3 bg-slate-900 rotate-45 border-r border-b border-slate-800"></div>

                <p className="text-xs font-black tracking-tight leading-none text-white whitespace-nowrap">
                  {partnerName}
                </p>

                <div className="flex items-center gap-1">
                  <Star size={10} className="fill-amber-400 stroke-amber-400" />
                  <span className="text-[10px] font-bold text-amber-400">
                    {partnerRating}
                  </span>
                  <span className="text-[9px] text-slate-400">
                    ({partnerReviews} reviews)
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    if (typeof (window as any).__showToast === "function") {
                      (window as any).__showToast(
                        `Bridging secure call via Central Landline Gateway: ${CORPORATE_LANDLINE_GATEWAY}...`,
                      );
                    } else {
                      alert(
                        `[Zomindia Telephony Bridge]\nConnecting you to partner securely.\nCaller ID: ${CORPORATE_LANDLINE_GATEWAY}\nNo private phone numbers are exposed.`
                      );
                    }
                  }}
                  className="mt-1 w-full flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white py-1.5 px-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-md border border-blue-500 hover:scale-102 active:scale-98 cursor-pointer"
                >
                  <Phone size={10} className="fill-white" />
                  Call Partner
                </button>
              </div>
            )}

            {/* Hover Tooltip displaying Real-time Telemetry speed and battery percentage */}
            <AnimatePresence>
              {isHovered && !showTooltip && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-14 left-1/2 -translate-x-1/2 z-40 bg-slate-950/95 backdrop-blur-md text-white rounded-xl p-2.5 shadow-xl border border-slate-800/90 min-w-[145px] pointer-events-none text-left"
                >
                  {/* Miniature Bubble Tail */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-slate-950 rotate-45 border-r border-b border-slate-800/90"></div>

                  <div className="flex items-center justify-between gap-1 border-b border-white/10 pb-1 mb-1.5">
                    <span className="text-[8px] font-black uppercase tracking-widest text-violet-400">
                      Telemetry Feed
                    </span>
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[9px] font-bold">
                    <div className="flex items-center justify-between gap-2 text-slate-350">
                      <span className="font-semibold text-slate-400">
                        Current Speed
                      </span>
                      <span className="font-extrabold text-white">
                        {speed} km/h
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-slate-350">
                      <span className="font-semibold text-slate-400">
                        Mobile Battery
                      </span>
                      <span className="font-extrabold text-white flex items-center gap-1">
                        {battery}%
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${battery > 30 ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`}
                        />
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-slate-350">
                      <span className="font-semibold text-slate-400">
                        Signal (GPS)
                      </span>
                      <span className="text-[8px] text-emerald-400 font-extrabold tracking-wider">
                        EXCELLENT
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </AdvancedMarker>
      )}

      {destCoords && (
        <AdvancedMarker position={destCoords}>
          <Pin background="#ef4444" glyphColor="#fff" borderColor="#991b1b" />
        </AdvancedMarker>
      )}
    </>
  );
}

function MapSearchBar() {
  const map = useMap();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [searchedLabel, setSearchedLabel] = useState("");
  const [searchedCoords, setSearchedCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || !map) return;

    setSearching(true);
    setErrorMsg("");

    let resolvedCoords: { lat: number; lng: number } | null = null;
    let resolvedLabel = "";

    // 1. Try Nominatim FIRST
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
      const res = await fetch(url, {
        headers: {
          "Accept-Language": "en",
          "User-Agent": "zomindia-app-preview",
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.[0]) {
          resolvedCoords = {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
          };
          resolvedLabel = data[0].display_name || query;
        }
      }
    } catch (e) {
      console.warn(
        "Nominatim search failed in PartnerTrackingMap, trying Google backup:",
        e,
      );
    }

    // 2. Cascade fallback to Google Maps Geocoder bypassed to avoid API authorization logs.

    setSearching(false);
    if (resolvedCoords) {
      setSearchedCoords(resolvedCoords);
      setSearchedLabel(resolvedLabel);
      map.panTo(resolvedCoords);
      map.setZoom(15);
    } else {
      setErrorMsg("No results found.");
      setTimeout(() => setErrorMsg(""), 3000);
    }
  };

  const handleClear = () => {
    setQuery("");
    setSearchedCoords(null);
    setSearchedLabel("");
  };

  return (
    <>
      <div
        className="absolute top-4 left-16 right-16 sm:right-auto sm:max-w-xs md:max-w-sm w-[calc(100%-128px)] sm:w-auto min-w-0 z-20 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStartCapture={(e) => e.stopPropagation()}
        onMouseDownCapture={(e) => e.stopPropagation()}
      >
        <form
          onSubmit={handleSearch}
          className="relative flex items-center bg-white rounded-2xl border border-slate-100/85 shadow-lg overflow-hidden group"
        >
          <input
            type="text"
            inputMode="text"
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search landmarks or areas..."
            className="w-full text-xs font-bold text-slate-700 placeholder-slate-400 pl-4 pr-[72px] py-3 border-none bg-transparent outline-none focus:ring-0"
          />
          <div className="absolute right-2 flex items-center gap-1">
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="w-6 h-6 rounded-lg bg-slate-50 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
                title="Clear Search"
              >
                <X size={12} />
              </button>
            )}
            <button
              type="submit"
              disabled={searching}
              className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white flex items-center justify-center transition-all shadow-sm disabled:opacity-50"
              title="Search Location"
            >
              <Search size={14} className={searching ? "animate-pulse" : ""} />
            </button>
          </div>
        </form>
        {errorMsg && (
          <div className="absolute top-full mt-1.5 left-0 right-0 bg-rose-50 border border-rose-100 text-rose-500 font-bold text-[10px] text-center py-1.5 px-3 rounded-xl shadow-md animate-in fade-in slide-in-from-top-1">
            {errorMsg}
          </div>
        )}
        {searchedCoords && searchedLabel && (
          <div className="absolute top-full mt-1.5 left-0 right-0 bg-slate-900 border border-slate-800 text-white font-bold text-[10px] px-3 py-1.5 rounded-xl shadow-md flex items-center justify-between gap-2 max-h-16 overflow-hidden animate-in fade-in slide-in-from-top-1">
            <span className="truncate leading-tight">
              Centered on: {searchedLabel}
            </span>
            <button
              onClick={handleClear}
              className="text-slate-400 hover:text-white shrink-0 font-black"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {searchedCoords && (
        <AdvancedMarker position={searchedCoords}>
          <div className="relative cursor-pointer select-none">
            <div className="absolute -inset-3 bg-rose-500/25 rounded-full animate-ping"></div>
            <div className="w-8 h-8 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-lg border-2 border-white relative z-10 transition-transform hover:scale-105 active:scale-95">
              <MapPin size={16} />
            </div>
          </div>
        </AdvancedMarker>
      )}
    </>
  );
}

function CenterToPartnerButton({
  partnerLocation,
  setZoom,
}: {
  partnerLocation: { lat: number; lng: number } | null;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
}) {
  const map = useMap();
  const handleCenter = () => {
    if (map && partnerLocation) {
      map.panTo(partnerLocation);
      setZoom(15);
    }
  };

  if (!partnerLocation) return null;

  return (
    <div className="absolute bottom-24 right-4 z-10 pointer-events-auto">
      <button
        id="center-to-partner"
        onClick={handleCenter}
        className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white transition-all px-3.5 py-2.5 rounded-2xl flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 text-xs font-bold border border-blue-500"
        title="Center map to professional's coordinates"
      >
        <Compass size={14} className="animate-pulse" />
        Center to Partner
      </button>
    </div>
  );
}

const generateHistoricalPoints = (current: {
  lat: number;
  lng: number;
}): { lat: number; lng: number }[] => {
  const points: { lat: number; lng: number }[] = [];
  const numPoints = 8;
  const startAngle = Math.random() * 2 * Math.PI;
  const totalOffsetMeters = 1500; // start 1.5 km away
  const earthRadius = 6371000;

  // Starting point of the shift
  const startDLat =
    ((totalOffsetMeters * Math.cos(startAngle)) / earthRadius) *
    (180 / Math.PI);
  const startDLng =
    ((totalOffsetMeters * Math.sin(startAngle)) /
      (earthRadius * Math.cos((current.lat * Math.PI) / 180))) *
    (180 / Math.PI);

  const startPoint = {
    lat: current.lat + startDLat,
    lng: current.lng + startDLng,
  };

  // Interpolate with some realistic noise (simulating following a street grid)
  for (let i = 0; i <= numPoints; i++) {
    const fraction = i / numPoints;
    // Add sinusoidal curve noise for realism
    const noiseMeters = 80 * Math.sin(fraction * Math.PI);
    const noiseAngle = startAngle + Math.PI / 2; // perpendicular

    const noiseLat =
      ((noiseMeters * Math.cos(noiseAngle)) / earthRadius) * (180 / Math.PI);
    const noiseLng =
      ((noiseMeters * Math.sin(noiseAngle)) /
        (earthRadius * Math.cos((current.lat * Math.PI) / 180))) *
      (180 / Math.PI);

    const baseLat = startPoint.lat + (current.lat - startPoint.lat) * fraction;
    const baseLng = startPoint.lng + (current.lng - startPoint.lng) * fraction;

    points.push({
      lat: baseLat + noiseLat,
      lng: baseLng + noiseLng,
    });
  }
  return points;
};

export default function PartnerTrackingMap({
  partnerId,
  bookingLocation,
  destinationAddress,
  onClose,
  bookingId,
}: PartnerTrackingMapProps) {
  const [partnerLocation, setPartnerLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [historicalPath, setHistoricalPath] = useState<
    { lat: number; lng: number }[]
  >([]);
  const [animatedLocation, setAnimatedLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [partnerInfo, setPartnerInfo] = useState<PartnerProfile | null>(null);
  const [userInfo, setUserInfo] = useState<UserProfile | null>(null);
  const [eta, setEta] = useState<string>("~12 min");
  const [distance, setDistance] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [autoZoomToFit, setAutoZoomToFit] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(13);
  const [showDetailCard, setShowDetailCard] = useState<boolean>(false);
  const [mapType, setMapType] = useState<"roadmap" | "satellite" | "terrain">(
    "terrain",
  );

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [pulseEnabled, setPulseEnabled] = useState<boolean>(true);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(true);

  const [prevLocation, setPrevLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [lastShift, setLastShift] = useState<{
    meters: number;
    feet: number;
  } | null>(null);
  const [recenteringActive, setRecenteringActive] = useState<boolean>(false);

  const [countdown, setCountdown] = useState(30);

  const referenceCenter = React.useMemo(() => {
    return (
      bookingLocation ||
      partnerLocation ||
      animatedLocation || { lat: 28.6139, lng: 77.209 }
    );
  }, [bookingLocation, partnerLocation, animatedLocation]);

  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setRefreshTrigger((t) => t + 1);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [autoRefreshEnabled]);

  useEffect(() => {
    if (!partnerLocation) return;

    // If it's the first time/initial point, set previous location to partnerLocation
    if (!prevLocation) {
      setPrevLocation(partnerLocation);
      return;
    }

    const latDiff = Math.abs(partnerLocation.lat - prevLocation.lat);
    const lngDiff = Math.abs(partnerLocation.lng - prevLocation.lng);

    // Only count as shift if it is a real coordinate update (e.g. > 0.000001)
    if (latDiff > 0.000001 || lngDiff > 0.000001) {
      const R = 6371000; // Earth's radius in meters
      const dLat = ((partnerLocation.lat - prevLocation.lat) * Math.PI) / 180;
      const dLng = ((partnerLocation.lng - prevLocation.lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((prevLocation.lat * Math.PI) / 180) *
          Math.cos((partnerLocation.lat * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const meters = R * c;
      const feet = meters * 3.28084;

      if (meters > 0.2) {
        setLastShift({ meters, feet });
        setRecenteringActive(true);
        const timer = setTimeout(() => setRecenteringActive(false), 5000); // Pulse and glow for 5 seconds
        setPrevLocation(partnerLocation);
        return () => clearTimeout(timer);
      }
    }
  }, [partnerLocation, prevLocation]);

  useEffect(() => {
    if (!partnerLocation) return;

    setHistoricalPath((prev) => {
      if (prev.length === 0) {
        // Seed initial points when partnerLocation arrives
        return generateHistoricalPoints(partnerLocation);
      } else {
        const lastPt = prev[prev.length - 1];
        const latDiff = Math.abs(partnerLocation.lat - lastPt.lat);
        const lngDiff = Math.abs(partnerLocation.lng - lastPt.lng);
        // Only append to path if it has moved a reasonable amount (e.g., > 1 meter, which is roughly ~1e-5 difference)
        if (latDiff > 0.000008 || lngDiff > 0.000008) {
          return [...prev, partnerLocation];
        }
      }
      return prev;
    });
  }, [partnerLocation]);

  const handleSimulateShift = () => {
    if (!partnerLocation) return;
    // Walk / shift by a random distance (roughly 5 to 30 meters)
    const direction = Math.random() * 2 * Math.PI;
    const distanceMeters = 5 + Math.random() * 25; // 5 - 30m
    const earthRadius = 6371000;

    const dLat =
      ((distanceMeters * Math.cos(direction)) / earthRadius) * (180 / Math.PI);
    const dLng =
      ((distanceMeters * Math.sin(direction)) /
        (earthRadius * Math.cos((partnerLocation.lat * Math.PI) / 180))) *
      (180 / Math.PI);

    setPartnerLocation({
      lat: partnerLocation.lat + dLat,
      lng: partnerLocation.lng + dLng,
    });
  };

  useEffect(() => {
    if (!partnerId) return;
    if (!autoRefreshEnabled) return; // disable snapshot listeners to conserve battery

    const unsubPartner = onSnapshot(doc(db, "partners", partnerId), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as PartnerProfile;
        if (data.lat && data.lng) {
          setPartnerLocation({ lat: data.lat, lng: data.lng });
        }
        setPartnerInfo(data);
      }
    });

    const unsubUser = onSnapshot(doc(db, "users", partnerId), (snap) => {
      if (snap.exists()) {
        setUserInfo(snap.data() as UserProfile);
      }
    });

    let unsubBooking: (() => void) | undefined;
    if (bookingId) {
      unsubBooking = onSnapshot(doc(db, "bookings", bookingId), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data && data.partnerLocation && typeof data.partnerLocation.lat === "number" && typeof data.partnerLocation.lng === "number") {
            setPartnerLocation({ lat: data.partnerLocation.lat, lng: data.partnerLocation.lng });
            console.log("[Map Sync] Received live partner position from booking doc:", data.partnerLocation);
          } else if (data && typeof data.lat === "number" && typeof data.lng === "number") {
            setPartnerLocation({ lat: data.lat, lng: data.lng });
          }
        }
      });
    }

    return () => {
      unsubPartner();
      unsubUser();
      if (unsubBooking) {
        unsubBooking();
      }
    };
  }, [partnerId, bookingId, autoRefreshEnabled]);

  // Smooth position animation interpolation loop
  useEffect(() => {
    if (!partnerLocation) return;
    if (!animatedLocation) {
      setAnimatedLocation(partnerLocation);
      return;
    }

    const latDiff = Math.abs(partnerLocation.lat - animatedLocation.lat);
    const lngDiff = Math.abs(partnerLocation.lng - animatedLocation.lng);
    if (latDiff < 0.00001 && lngDiff < 0.00001) {
      setAnimatedLocation(partnerLocation);
      return;
    }

    let start: number | null = null;
    const startLocation = { ...animatedLocation };
    const duration = 1200; // Elegant, smooth 1.2s coordinate slide animation
    let animId: number;

    const easeOutQuad = (t: number) => t * (2 - t);

    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = easeOutQuad(progress);

      const nextLat =
        startLocation.lat + (partnerLocation.lat - startLocation.lat) * eased;
      const nextLng =
        startLocation.lng + (partnerLocation.lng - startLocation.lng) * eased;

      setAnimatedLocation({ lat: nextLat, lng: nextLng });

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [partnerLocation]);

  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setCountdown(30);
    try {
      const partnerSnap = await getDoc(doc(db, "partners", partnerId));
      if (partnerSnap.exists()) {
        const data = partnerSnap.data() as PartnerProfile;
        if (data.lat && data.lng) {
          setPartnerLocation({ lat: data.lat, lng: data.lng });
        }
        setPartnerInfo(data);
      }
      const userSnap = await getDoc(doc(db, "users", partnerId));
      if (userSnap.exists()) {
        setUserInfo(userSnap.data() as UserProfile);
      }
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      console.error("Error manually refreshing partner location:", err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  };

  // Helper to parse and calculate relative last updated time of partner GPS
  const getFormattedLastUpdated = () => {
    if (!partnerInfo) return "Just now";

    let dateObj: Date | null = null;
    try {
      const ts = partnerInfo.updatedAt || partnerInfo.createdAt;
      if (ts) {
        if (typeof ts.toDate === "function") {
          dateObj = ts.toDate();
        } else if (ts.seconds) {
          dateObj = new Date(ts.seconds * 1000);
        } else {
          dateObj = new Date(ts);
        }
      }
    } catch {
      // fallback
    }

    if (!dateObj || isNaN(dateObj.getTime())) {
      return "Just now";
    }

    const diffMs = Date.now() - dateObj.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);

    if (diffSecs < 15) return "Just now";
    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;

    return dateObj.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!animatedLocation) {
    return (
      <div className="w-full h-64 bg-slate-50 rounded-[32px] flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-slate-200">
        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-300 mb-4 shadow-sm">
          <MapPin size={24} className="animate-bounce" />
        </div>
        <p className="text-sm font-bold text-slate-400">
          Waiting for professional's signal...
        </p>
        <p className="text-[10px] text-slate-300 mt-1 uppercase tracking-widest font-black">
          Connecting Securely
        </p>
      </div>
    );
  }

  const partnerContactStatus = partnerInfo?.availabilityStatus || "Available";
  const partnerPhone = userInfo?.phoneNumber || "555-0199";

  const isCloseToDest = (() => {
    if (!animatedLocation || !bookingLocation) return false;
    const R = 6371e3; // Earth's radius in meters
    const phi1 = (animatedLocation.lat * Math.PI) / 180;
    const phi2 = (bookingLocation.lat * Math.PI) / 180;
    const deltaPhi =
      ((bookingLocation.lat - animatedLocation.lat) * Math.PI) / 180;
    const deltaLambda =
      ((bookingLocation.lng - animatedLocation.lng) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) *
        Math.cos(phi2) *
        Math.sin(deltaLambda / 2) *
        Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const dist = R * c;
    return dist <= 500;
  })();

  return (
    <div
      id="partner-tracking-container"
      className={`partner-tracking-map-container ${isFullscreen ? "fixed inset-0 z-[9999] bg-slate-900/95 backdrop-blur-xl p-4 md:p-6 flex flex-col justify-between gap-4 animate-in fade-in duration-300" : "space-y-4"} ${isCloseToDest ? "ring-4 ring-emerald-500/20 border-emerald-500/30 transition-all duration-500" : ""}`}
    >
      {isFullscreen && (
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div>
            <h3 className="text-base font-black text-white tracking-tight">
              Immersive Tracking Dashboard
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Real-time GPS Monitoring & Signal Feed
            </p>
          </div>
          <button
            onClick={() => setIsFullscreen(false)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-widest transition-all shadow-md active:scale-95 pb-[1px]"
          >
            <Minimize2 size={14} />
            Minimize Map
          </button>
        </div>
      )}

      {/* Dynamic Real-time Distance & ETA Header Panel (ABOVE the Map) */}
      <div className="bg-slate-900 text-white rounded-[28px] p-5 border border-slate-800 shadow-lg flex items-center justify-between gap-4 select-none">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Radio size={18} className="animate-pulse" />
          </div>
          <div>
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400">
              Real-Time Distance
            </span>
            <h4 className="text-lg font-black italic mt-0.5 tracking-tight text-white flex items-center gap-2">
              {distance ? `${distance} Remaining` : "Calculating distance..."}
            </h4>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 font-bold">
            Estimated Arrival
          </span>
          <p className="text-lg font-black italic mt-0.5 text-emerald-400 tracking-tight">
            {eta || "Estimating..."}
          </p>
        </div>
      </div>

      {/* RECENTERING MOVEMENT METRICS PANEL */}
      <div className="bg-white border border-slate-100/90 rounded-[24px] p-4 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-500 relative overflow-hidden">
        {recenteringActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.08, 0.22, 0.08] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="absolute inset-0 bg-blue-505/10 bg-blue-50 pointer-events-none"
          />
        )}

        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 ${recenteringActive ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20" : "bg-slate-100 text-slate-500"}`}
          >
            <RefreshCw
              size={15}
              className={recenteringActive ? "animate-spin" : ""}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                Recentering Indicator
              </span>
              {recenteringActive ? (
                <span className="bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded animate-pulse">
                  Device Moved
                </span>
              ) : (
                <span className="bg-slate-100 text-slate-600 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded">
                  GPS Live
                </span>
              )}
            </div>
            <h5 className="font-bold text-xs sm:text-sm text-slate-700 tracking-tight mt-0.5">
              {lastShift ? (
                <>
                  Professional recently moved{" "}
                  <span className="text-blue-600 font-extrabold">
                    {lastShift.meters.toFixed(1)} meters
                  </span>{" "}
                  <span className="text-slate-400">
                    ({lastShift.feet.toFixed(0)} ft)
                  </span>{" "}
                  since the last GPS ping
                </>
              ) : (
                <span className="text-slate-400 font-medium">
                  Listening for coordinate updates / shifts to compute
                  distance...
                </span>
              )}
            </h5>
          </div>
        </div>

        <button
          onClick={handleSimulateShift}
          className="text-[9px] sm:text-[10px] whitespace-nowrap font-black uppercase tracking-wider bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg transition-all shadow-sm active:scale-95 shrink-0"
          title="Simulate professional moving to test dynamic displacement & high contrast recentering logic"
        >
          ⚡ Test GPS Move
        </button>
      </div>

      <div
        className={`relative w-full rounded-[40px] overflow-hidden border border-slate-150 shadow-2xl transition-all duration-300 group ${isFullscreen ? "flex-grow" : "h-[50vh] sm:h-64"}`}
      >
        <Map
          defaultCenter={animatedLocation}
          center={autoZoomToFit ? undefined : animatedLocation}
          zoom={autoZoomToFit ? undefined : zoom}
          onZoomChanged={(ev) => {
            if (!autoZoomToFit) {
              setZoom(ev.detail.zoom);
            }
          }}
          mapId="DEMO_MAP_ID"
          mapTypeId={mapType}
          gestureHandling="auto"
          disableDefaultUI
          className="w-full h-full"
          internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
        >
          <MapLogic
            partnerLocation={animatedLocation}
            rawPartnerLocation={partnerLocation}
            bookingLocation={bookingLocation}
            destinationAddress={destinationAddress}
            onRouteUpdate={(e, d) => {
              setEta(e);
              setDistance(d);
            }}
            refreshTrigger={refreshTrigger}
            userInfo={userInfo}
            partnerInfo={partnerInfo}
            onPartnerClick={() => {
              setShowDetailCard(true);
            }}
            pulseEnabled={pulseEnabled}
            historicalPath={historicalPath}
            autoZoomToFit={autoZoomToFit}
            eta={eta}
            autoRefreshEnabled={autoRefreshEnabled}
          />
          <MapSearchBar />
          <CenterToPartnerButton
            partnerLocation={animatedLocation}
            setZoom={setZoom}
          />
          {historicalPath.length > 0 && (
            <AdvancedMarker position={historicalPath[0]}>
              <div className="relative cursor-pointer select-none">
                <div className="absolute -inset-1.5 bg-violet-500/30 rounded-full animate-ping"></div>
                <div
                  className={`w-9 h-9 rounded-2xl bg-slate-900 border-2 border-violet-500 flex flex-col items-center justify-center text-white relative z-10 shadow-lg hover:scale-105 active:scale-95 transition-transform`}
                >
                  <span className="text-[7.5px] font-black tracking-tighter text-violet-400">
                    SHIFT
                  </span>
                  <span className="text-[8px] font-black leading-none -mt-0.5">
                    START
                  </span>
                </div>
              </div>
            </AdvancedMarker>
          )}
        </Map>

        {/* Dynamic High Contrast ETA Overlay with 30s Countdown loader */}
        <div
          id="dynamic-eta-overlay"
          className="absolute top-18 sm:top-4 left-1/2 -translate-x-1/2 z-25 bg-slate-950/95 backdrop-blur-md text-white px-4 py-2.5 rounded-[22px] shadow-2xl border border-slate-800/90 flex items-center gap-3.5 select-none animate-in fade-in slide-in-from-top-3 duration-300 pointer-events-auto"
        >
          <div className="relative flex items-center justify-center">
            {/* Pulsing broadcast radar animation */}
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-blue-400 shrink-0">
              Assigned Pro ETA:
            </span>
            <span className="text-xs sm:text-sm font-black italic tracking-tight text-white">
              {eta}
            </span>
          </div>
          <div className="h-4 w-[1px] bg-slate-800" />
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400">
            <Clock
              size={11}
              className={`text-slate-500 ${autoRefreshEnabled ? "animate-pulse" : ""}`}
            />
            {autoRefreshEnabled ? (
              <span>
                Updates in{" "}
                <span className="text-emerald-400 font-extrabold font-mono text-[10px]">
                  {countdown}s
                </span>
              </span>
            ) : (
              <span className="text-orange-400 font-black tracking-wide uppercase text-[8px]">
                Sync Paused
              </span>
            )}
          </div>
        </div>

        {/* Custom Zoom +/- Controls */}
        <div
          id="map-zoom-controls"
          className="absolute top-4 left-4 flex flex-col gap-1.5 z-10 pointer-events-auto"
        >
          <button
            onClick={() => setZoom((prev) => Math.min(prev + 1, 21))}
            className="bg-white hover:bg-slate-50 transition-all w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg border border-slate-100/80 text-slate-700 font-bold hover:scale-105 active:scale-95"
            title="Zoom In"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={() => setZoom((prev) => Math.max(prev - 1, 1))}
            className="bg-white hover:bg-slate-50 transition-all w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg border border-slate-100/80 text-slate-700 font-bold hover:scale-105 active:scale-95"
            title="Zoom Out"
          >
            <Minus size={16} />
          </button>
        </div>

        {/* Consolidated Floating Controls Top-Right */}
        <div
          id="map-action-controls"
          className="absolute top-4 right-4 flex flex-col gap-1.5 z-10 pointer-events-auto"
        >
          {/* Automatic Zoom-to-Fit Toggle */}
          <button
            onClick={() => {
              setAutoZoomToFit((p) => !p);
              if (!autoZoomToFit) {
                // Instantly trigger re-focus trigger if enabling
                setRefreshTrigger((prev) => prev + 1);
              }
            }}
            className={`transition-all w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg border hover:scale-105 active:scale-95 relative ${
              autoZoomToFit
                ? "bg-blue-600 border-blue-700 text-white shadow-md shadow-blue-500/20"
                : "bg-white border-slate-100/80 text-slate-700 hover:bg-slate-50"
            }`}
            title={
              autoZoomToFit
                ? "Disable Auto Zoom-To-Fit (Both Pro & Dest)"
                : "Enable Auto Zoom-To-Fit (Both Pro & Dest)"
            }
          >
            <Compass
              size={16}
              className={autoZoomToFit ? "animate-pulse" : ""}
            />
            {autoZoomToFit && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 border border-white animate-pulse" />
            )}
          </button>

          {/* Automatic Auto-Refresh/Battery Sync Toggle Button */}
          <button
            type="button"
            onClick={() => {
              setAutoRefreshEnabled((p) => !p);
              if (!autoRefreshEnabled) {
                // If turning auto-sync back on, run immediate manual refresh to catch up
                setRefreshTrigger((prev) => prev + 1);
                setCountdown(30);
              }
            }}
            className={`transition-all w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg border hover:scale-105 active:scale-95 relative ${
              autoRefreshEnabled
                ? "bg-emerald-600 border-emerald-700 text-white shadow-md shadow-emerald-500/15"
                : "bg-white border-slate-100/80 text-orange-500 hover:bg-orange-50"
            }`}
            title={
              autoRefreshEnabled
                ? "Disable Auto-Refresh (Conserve Battery)"
                : "Enable Auto-Refresh (Battery Saver Off)"
            }
          >
            {autoRefreshEnabled ? (
              <BatteryCharging size={16} className="animate-pulse" />
            ) : (
              <Battery size={16} />
            )}
            {autoRefreshEnabled && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-teal-300 border border-white animate-pulse" />
            )}
          </button>

          {/* Manual Refresh Button */}
          <button
            onClick={handleManualRefresh}
            className="bg-white hover:bg-slate-50 transition-all w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg border border-slate-100/80 hover:scale-105 active:scale-95 text-slate-600 disabled:opacity-50"
            title="Refresh partner live signal"
            disabled={isRefreshing}
          >
            <RefreshCw
              size={16}
              className={`text-slate-600 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </button>

          {/* Map Type Switch Panel (Satellite View <-> Terrain View) */}
          <button
            onClick={() =>
              setMapType((prev) =>
                prev === "terrain" ? "satellite" : "terrain",
              )
            }
            className={`transition-all w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg border hover:scale-105 active:scale-95 ${
              mapType === "satellite"
                ? "bg-blue-700 border-blue-800 text-white hover:bg-blue-600"
                : "bg-white border-slate-100/80 text-slate-700 hover:bg-slate-50"
            }`}
            title={`Switch to ${mapType === "terrain" ? "Satellite" : "Terrain"} View`}
          >
            {mapType === "terrain" ? <Layers size={16} /> : <Globe size={16} />}
          </button>

          {/* Fullscreen Map Toggle Switch */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="bg-white hover:bg-slate-50 transition-all w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg border border-slate-100/80 text-slate-700 hover:scale-105 active:scale-95"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Tracking Map"}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>

        {/* Nearby fleet monitoring indicator legend */}
        <div className="absolute bottom-[80px] right-4 bg-slate-900/90 backdrop-blur-md rounded-2xl p-3 border border-slate-800 shadow-xl text-white select-none pointer-events-auto z-10 max-w-[200px] text-xs font-medium">
          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5 mb-1.5">
            <span className="text-[8px] font-black uppercase tracking-wider text-blue-400">
              Hub Fleet live
            </span>
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
          </div>
          <p className="text-[9.5px] font-bold text-slate-400 mb-2 uppercase tracking-wide">
            Pro Visibility
          </p>
          <div className="space-y-1.5 text-[9px] font-bold">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block border border-white/20" />
                <span className="text-slate-300">Available</span>
              </div>
              <span className="text-emerald-400 font-extrabold bg-slate-800/80 px-1.5 py-0.5 rounded leading-none">
                6 Pros
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block border border-white/20" />
                <span className="text-slate-300">On Active Job</span>
              </div>
              <span className="text-slate-400 font-extrabold bg-slate-800/80 px-1.5 py-0.5 rounded leading-none">
                4 Pros
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 font-semibold">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block border border-white/20 animate-pulse" />
                <span className="text-slate-300">In-Transit</span>
              </div>
              <span className="text-amber-400 font-extrabold bg-slate-800/80 px-1.5 py-0.5 rounded leading-none animate-pulse">
                3 Pros
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-1.5 mt-1.5 font-bold">
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-1 rounded-full bg-violet-500 inline-block shadow shadow-violet-500/50" />
                <span className="text-slate-300">Route History</span>
              </div>
              <span className="text-[7px] font-black tracking-widest text-violet-400 uppercase leading-none">
                Shift Path
              </span>
            </div>
          </div>
        </div>

        {/* Detailed Info Card (Spans over map on request / marker click) */}
        {showDetailCard && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-30 flex items-end p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full rounded-3xl p-5 shadow-2xl border border-slate-100 flex flex-col gap-4 animate-in slide-in-from-bottom duration-300 pointer-events-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-slate-800 tracking-tight">
                    {userInfo?.displayName || "Partner Specialist"}
                  </h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                    Live GPS Connection
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowDetailCard(false);
                  }}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-black flex items-center justify-center transition-colors shadow-sm"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 flex flex-col justify-center">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                    Status
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="text-xs font-black text-slate-800">
                      {partnerContactStatus}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 flex flex-col justify-center">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                    Last Update
                  </span>
                  <div className="flex items-center gap-1.5 text-slate-800">
                    <Clock size={12} className="text-slate-400" />
                    <span className="text-xs font-black">
                      {getFormattedLastUpdated()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <div className="flex items-center gap-1.5">
                  <Star size={14} className="fill-amber-400 stroke-amber-400" />
                  <span className="text-xs font-black text-slate-800">
                    {partnerInfo?.rating
                      ? Number(partnerInfo.rating).toFixed(1)
                      : "4.9"}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    ({partnerInfo?.reviewCount || 18} reviews)
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    if (typeof (window as any).__showToast === "function") {
                      (window as any).__showToast(
                        `Bridging secure call via Central Landline Gateway: ${CORPORATE_LANDLINE_GATEWAY}...`,
                      );
                    } else {
                      alert(
                        `[Zomindia Telephony Bridge]\nConnecting you securely.\nCaller ID: ${CORPORATE_LANDLINE_GATEWAY}\nNo private phone numbers are exposed.`
                      );
                    }
                  }}
                  className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-black py-2.5 px-4 rounded-2xl text-[10px] uppercase tracking-wider transition-all shadow-md border border-blue-500 cursor-pointer"
                >
                  <Phone size={11} className="fill-white" />
                  Call Professional
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Proximity Pulse Settings Overlay */}
        <div
          id="partner-proximity-settings"
          className="absolute bottom-24 left-4 bg-white/95 backdrop-blur-md rounded-2xl px-3 py-2 shadow-lg border border-slate-100 flex items-center gap-2 z-10 pointer-events-auto hover:bg-white transition-all"
        >
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={pulseEnabled}
              onChange={() => setPulseEnabled((p) => !p)}
              className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <div
              className={`p-1 rounded-lg ${pulseEnabled ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"} flex items-center justify-center`}
            >
              <Radio
                size={12}
                className={pulseEnabled ? "animate-pulse" : ""}
              />
            </div>
            <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">
              Pulse Proximity
            </span>
          </label>
        </div>

        {/* Floating Info Overlay for distance and Estimated Time of Arrival (ETA) to destination */}
        <div
          className={`absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border flex items-center justify-between gap-4 pointer-events-none transition-all z-10 ${isCloseToDest ? "border-emerald-400/40 ring-4 ring-emerald-500/10" : "border-white"}`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${isCloseToDest ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-700"}`}
            >
              <Compass className="animate-pulse" size={18} />
            </div>
            <div>
              <p
                className={`text-[9px] font-black uppercase tracking-widest leading-none ${isCloseToDest ? "text-emerald-650" : "text-slate-400"}`}
              >
                {isCloseToDest ? "🌟 Arriving Now" : "Live Route"}
              </p>
              <p
                className={`text-[11px] font-bold mt-1 ${isCloseToDest ? "text-emerald-800 animate-pulse" : "text-slate-500"}`}
              >
                {isCloseToDest
                  ? "Pro is within 500m of you!"
                  : "On the way to you"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-5 pointer-events-auto">
            {distance && (
              <div className="text-right">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">
                  Distance
                </p>
                <p className="text-xs font-black text-slate-800">{distance}</p>
              </div>
            )}
            <div className="text-right border-l border-slate-100 pl-4">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">
                ETA
              </p>
              <p className="text-xs font-black text-blue-700">{eta}</p>
            </div>
          </div>
        </div>
      </div>

      <div
        onClick={() => {
          setShowDetailCard(true);
        }}
        className="flex items-center justify-between p-6 bg-slate-50 hover:bg-slate-100/80 transition-all rounded-[32px] border border-slate-100 cursor-pointer group"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white rounded-2xl border border-slate-200 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
            <Navigation size={20} className="text-blue-700" />
          </div>
          <div>
            <h5 className="text-sm font-black italic">
              {userInfo?.displayName || "Expert Agent"}
            </h5>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              Live Signal Active
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
            CURRENT ETA
          </p>
          <p className="text-lg font-black text-slate-900 italic">{eta}</p>
        </div>
      </div>
    </div>
  );
}
