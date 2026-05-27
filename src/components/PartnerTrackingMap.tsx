import React, { useEffect, useState } from 'react';
import { Map, AdvancedMarker, Pin, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PartnerProfile, UserProfile } from '../types';
import { MapPin, Navigation, Smartphone, Star, Phone, RefreshCw, Compass, Plus, Minus, Info, Clock, Maximize2, Minimize2, Globe, Layers, Search, X, Radio } from 'lucide-react';

import { handleMapsError } from '../lib/maps-errors';

interface PartnerTrackingMapProps {
  partnerId: string;
  bookingLocation?: { lat: number; lng: number };
  destinationAddress?: string;
  onClose?: () => void;
}

function MapLogic({ partnerLocation, bookingLocation, destinationAddress, onRouteUpdate, refreshTrigger, userInfo, partnerInfo, onPartnerClick, pulseEnabled }: { 
  partnerLocation: { lat: number; lng: number }, 
  bookingLocation?: { lat: number; lng: number },
  destinationAddress?: string,
  onRouteUpdate?: (eta: string, distance: string) => void,
  refreshTrigger: number,
  userInfo: UserProfile | null,
  partnerInfo: PartnerProfile | null,
  onPartnerClick?: () => void,
  pulseEnabled: boolean
}) {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');
  const routesLib = useMapsLibrary('routes');
  const [destCoords, setDestCoords] = useState<{lat: number, lng: number} | null>(bookingLocation || null);
  const [routePath, setRoutePath] = useState<string[]>([]);
  const [showTooltip, setShowTooltip] = useState(false);

  // 5km visual circle radius overlay around partner location
  useEffect(() => {
    if (!map || !partnerLocation || typeof google === 'undefined') return;

    const circle = new google.maps.Circle({
      map,
      center: partnerLocation,
      radius: 5000, // 5km
      fillColor: '#3b82f6',
      fillOpacity: 0.1,
      strokeColor: '#3b82f6',
      strokeOpacity: 0.35,
      strokeWeight: 1.5,
    });

    return () => {
      circle.setMap(null);
    };
  }, [map, partnerLocation]);

  useEffect(() => {
    if (bookingLocation) {
      setDestCoords(bookingLocation);
    } else if (destinationAddress && mapsLib && typeof google !== 'undefined') {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: destinationAddress }, (results, status) => {
        if (status === 'OK' && results?.[0]) {
          const loc = results[0].geometry.location;
          setDestCoords({ lat: loc.lat(), lng: loc.lng() });
        } else {
          console.error(handleMapsError({ message: `Geocoding failed for ${destinationAddress}`, status }));
        }
      });
    }
  }, [destinationAddress, mapsLib, bookingLocation]);

  useEffect(() => {
    if (!partnerLocation || !destCoords || !routesLib) return;

    const calculateRoute = async () => {
      try {
        const { routes } = await routesLib.Route.computeRoutes({
          origin: partnerLocation,
          destination: destCoords,
          travelMode: 'DRIVE',
          polylineQuality: 'OVERVIEW',
          fields: ['polyline', 'durationMillis', 'distanceMeters'],
        } as any);

        if (routes?.[0]) {
          const route = routes[0] as any;
          if (route.polyline?.encodedPolyline) setRoutePath([route.polyline.encodedPolyline]);
          
          if (onRouteUpdate) {
            const minutes = Math.ceil(Number(route.durationMillis || 0) / 60000);
            const km = (Number(route.distanceMeters) || 0) / 1000;
            onRouteUpdate(`${minutes} min`, `${km.toFixed(1)} km`);
          }
        }
      } catch (err) {
        console.error("Route calculation error:", err);
      }
    };

    calculateRoute();
    const interval = setInterval(calculateRoute, 30000);
    return () => clearInterval(interval);
  }, [partnerLocation, destCoords, routesLib, onRouteUpdate, refreshTrigger]);

  useEffect(() => {
    if (!map || !routePath || routePath.length === 0 || typeof google === 'undefined') return;

    const polylines = routePath.map(path => new google.maps.Polyline({
      path: google.maps.geometry.encoding.decodePath(path),
      geodesic: true,
      strokeColor: '#3b82f6',
      strokeOpacity: 0.8,
      strokeWeight: 4,
    }));

    polylines.forEach(p => p.setMap(map));
    
    if (partnerLocation && destCoords) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(partnerLocation);
      bounds.extend(destCoords);
      map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
    }

    return () => polylines.forEach(p => p.setMap(null));
  }, [map, routePath, partnerLocation, destCoords]);

  const partnerName = userInfo?.displayName || 'Expert Agent';
  const partnerRating = partnerInfo?.rating ? Number(partnerInfo.rating).toFixed(1) : '4.9';
  const partnerReviews = partnerInfo?.reviewCount || 18;
  const partnerPhone = userInfo?.phoneNumber || '555-0199';

  const { isWithinProximity, pulseDuration } = (() => {
    if (!partnerLocation || !destCoords) {
      return { isWithinProximity: false, pulseDuration: '1.5s' };
    }
    const R = 6371e3; // Earth's radius in meters
    const phi1 = (partnerLocation.lat * Math.PI) / 180;
    const phi2 = (destCoords.lat * Math.PI) / 180;
    const deltaPhi = ((destCoords.lat - partnerLocation.lat) * Math.PI) / 180;
    const deltaLambda = ((destCoords.lng - partnerLocation.lng) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) *
      Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const dist = R * c;
    
    // Scale pulse frequency dynamically: pulses faster as they get closer.
    // Near 50 meters or less: 0.35s (rapid pulse)
    // At 1500 meters or more: 2.0s (slow signal)
    const maxReferenceDist = 1500;
    const clampedDist = Math.max(50, Math.min(dist, maxReferenceDist));
    const ratio = (clampedDist - 50) / (maxReferenceDist - 50); // scales from 0 (at 50m) to 1 (at 1500m)
    const dur = 0.35 + ratio * (2.0 - 0.35); // 0.35s to 2.0s duration

    return {
      isWithinProximity: dist <= 500,
      pulseDuration: `${dur.toFixed(2)}s`
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
              e.domEvent?.stopPropagation();
            }
            setShowTooltip(!showTooltip);
            if (onPartnerClick) {
              onPartnerClick();
            }
          }}
        >
          <div className="relative cursor-pointer select-none">
            {pulseEnabled && (
              isWithinProximity ? (
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
              )
            )}
            <div className={`w-10 h-10 ${isWithinProximity && pulseEnabled ? 'bg-emerald-600 shadow-lg shadow-emerald-500/40 animate-pulse ring-4 ring-emerald-500/35 border-emerald-300' : 'bg-blue-700 shadow-blue-700/30'} rounded-2xl flex items-center justify-center text-white shadow-xl border-2 border-white relative z-10 transition-transform hover:scale-105 active:scale-95`}>
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
                
                <p className="text-xs font-black tracking-tight leading-none text-white whitespace-nowrap">{partnerName}</p>
                
                <div className="flex items-center gap-1">
                  <Star size={10} className="fill-amber-400 stroke-amber-400" />
                  <span className="text-[10px] font-bold text-amber-400">{partnerRating}</span>
                  <span className="text-[9px] text-slate-400">({partnerReviews} reviews)</span>
                </div>

                <a 
                  href={`tel:${partnerPhone}`}
                  className="mt-1 w-full flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white py-1.5 px-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-md border border-blue-500 hover:scale-102 active:scale-98"
                >
                  <Phone size={10} className="fill-white" />
                  Call Partner
                </a>
              </div>
            )}
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
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchedLabel, setSearchedLabel] = useState('');
  const [searchedCoords, setSearchedCoords] = useState<{lat: number, lng: number} | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || !map || typeof google === 'undefined') return;

    setSearching(true);
    setErrorMsg('');
    try {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: query }, (results, status) => {
        setSearching(false);
        if (status === 'OK' && results?.[0]) {
          const loc = results[0].geometry.location;
          const coords = { lat: loc.lat(), lng: loc.lng() };
          setSearchedCoords(coords);
          setSearchedLabel(results[0].formatted_address || query);
          map.panTo(coords);
          map.setZoom(15);
        } else {
          setErrorMsg('No results found.');
          setTimeout(() => setErrorMsg(''), 3000);
        }
      });
    } catch (err) {
      setSearching(false);
      setErrorMsg('Search failed.');
      setTimeout(() => setErrorMsg(''), 3000);
    }
  };

  const handleClear = () => {
    setQuery('');
    setSearchedCoords(null);
    setSearchedLabel('');
  };

  return (
    <>
      <div 
        className="absolute top-4 left-16 max-w-[280px] sm:max-w-xs md:max-w-sm w-[calc(100%-140px)] z-20 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSearch} className="relative flex items-center bg-white rounded-2xl border border-slate-100/85 shadow-lg overflow-hidden group">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search landmarks or areas..."
            className="w-full text-xs font-bold text-slate-700 placeholder-slate-400 pl-4 pr-16 py-3 border-none bg-transparent outline-none focus:ring-0"
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
              <Search size={14} className={searching ? 'animate-pulse' : ''} />
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
            <span className="truncate leading-tight">Centered on: {searchedLabel}</span>
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

function CenterToPartnerButton({ partnerLocation, setZoom }: { partnerLocation: { lat: number; lng: number } | null, setZoom: React.Dispatch<React.SetStateAction<number>> }) {
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


export default function PartnerTrackingMap({ partnerId, bookingLocation, destinationAddress, onClose }: PartnerTrackingMapProps) {
  const [partnerLocation, setPartnerLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [animatedLocation, setAnimatedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [partnerInfo, setPartnerInfo] = useState<PartnerProfile | null>(null);
  const [userInfo, setUserInfo] = useState<UserProfile | null>(null);
  const [eta, setEta] = useState<string>('~12 min');
  const [distance, setDistance] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [zoom, setZoom] = useState<number>(13);
  const [showDetailCard, setShowDetailCard] = useState<boolean>(false);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [pulseEnabled, setPulseEnabled] = useState<boolean>(true);

  useEffect(() => {
    if (!partnerId) return;

    const unsubPartner = onSnapshot(doc(db, 'partners', partnerId), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as PartnerProfile;
        if (data.lat && data.lng) {
          setPartnerLocation({ lat: data.lat, lng: data.lng });
        }
        setPartnerInfo(data);
      }
    });

    onSnapshot(doc(db, 'users', partnerId), (snap) => {
      if (snap.exists()) {
        setUserInfo(snap.data() as UserProfile);
      }
    });

    return () => unsubPartner();
  }, [partnerId]);

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
      
      const nextLat = startLocation.lat + (partnerLocation.lat - startLocation.lat) * eased;
      const nextLng = startLocation.lng + (partnerLocation.lng - startLocation.lng) * eased;
      
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
    try {
      const partnerSnap = await getDoc(doc(db, 'partners', partnerId));
      if (partnerSnap.exists()) {
        const data = partnerSnap.data() as PartnerProfile;
        if (data.lat && data.lng) {
          setPartnerLocation({ lat: data.lat, lng: data.lng });
        }
        setPartnerInfo(data);
      }
      const userSnap = await getDoc(doc(db, 'users', partnerId));
      if (userSnap.exists()) {
        setUserInfo(userSnap.data() as UserProfile);
      }
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error("Error manually refreshing partner location:", err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  };

  // Helper to parse and calculate relative last updated time of partner GPS
  const getFormattedLastUpdated = () => {
    if (!partnerInfo) return 'Just now';
    
    let dateObj: Date | null = null;
    try {
      const ts = partnerInfo.updatedAt || partnerInfo.createdAt;
      if (ts) {
        if (typeof ts.toDate === 'function') {
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
      return 'Just now';
    }

    const diffMs = Date.now() - dateObj.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);

    if (diffSecs < 15) return 'Just now';
    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    
    return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!animatedLocation) {
    return (
      <div className="w-full h-64 bg-slate-50 rounded-[32px] flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-slate-200">
        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-300 mb-4 shadow-sm">
          <MapPin size={24} className="animate-bounce" />
        </div>
        <p className="text-sm font-bold text-slate-400">Waiting for professional's signal...</p>
        <p className="text-[10px] text-slate-300 mt-1 uppercase tracking-widest font-black">Connecting Securely</p>
      </div>
    );
  }

  const partnerContactStatus = partnerInfo?.availabilityStatus || 'Available';
  const partnerPhone = userInfo?.phoneNumber || '555-0199';

  const isCloseToDest = (() => {
    if (!animatedLocation || !bookingLocation) return false;
    const R = 6371e3; // Earth's radius in meters
    const phi1 = (animatedLocation.lat * Math.PI) / 180;
    const phi2 = (bookingLocation.lat * Math.PI) / 180;
    const deltaPhi = ((bookingLocation.lat - animatedLocation.lat) * Math.PI) / 180;
    const deltaLambda = ((bookingLocation.lng - animatedLocation.lng) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) *
      Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const dist = R * c;
    return dist <= 500;
  })();

  return (
    <div id="partner-tracking-container" className={`partner-tracking-map-container ${isFullscreen ? 'fixed inset-0 z-[9999] bg-slate-900/95 backdrop-blur-xl p-4 md:p-6 flex flex-col justify-between gap-4 animate-in fade-in duration-300' : 'space-y-4'} ${isCloseToDest ? 'ring-4 ring-emerald-500/20 border-emerald-500/30 transition-all duration-500' : ''}`}>
      {isFullscreen && (
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div>
            <h3 className="text-base font-black text-white tracking-tight">Immersive Tracking Dashboard</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Real-time GPS Monitoring & Signal Feed</p>
          </div>
          <button 
            onClick={() => setIsFullscreen(false)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-widest transition-all shadow-md active:scale-95"
          >
            <Minimize2 size={14} />
            Minimize Map
          </button>
        </div>
      )}

      <div className={`relative w-full rounded-[40px] overflow-hidden border border-slate-150 shadow-2xl transition-all duration-300 group ${isFullscreen ? 'flex-grow' : 'h-[50vh] sm:h-64'}`}>
        <Map
          defaultCenter={animatedLocation}
          center={animatedLocation}
          zoom={zoom}
          onZoomChanged={(ev) => setZoom(ev.detail.zoom)}
          mapId="TRACKING_MAP"
          mapTypeId={mapType}
          gestureHandling="auto"
          disableDefaultUI
          className="w-full h-full"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        >
          <MapLogic 
            partnerLocation={animatedLocation} 
            bookingLocation={bookingLocation} 
            destinationAddress={destinationAddress} 
            onRouteUpdate={(e, d) => { setEta(e); setDistance(d); }}
            refreshTrigger={refreshTrigger}
            userInfo={userInfo}
            partnerInfo={partnerInfo}
            onPartnerClick={() => setShowDetailCard(true)}
            pulseEnabled={pulseEnabled}
          />
          <MapSearchBar />
          <CenterToPartnerButton partnerLocation={animatedLocation} setZoom={setZoom} />
        </Map>

        {/* Custom Zoom +/- Controls */}
        <div id="map-zoom-controls" className="absolute top-4 left-4 flex flex-col gap-1.5 z-10 pointer-events-auto">
          <button
            onClick={() => setZoom(prev => Math.min(prev + 1, 21))}
            className="bg-white hover:bg-slate-50 transition-all w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg border border-slate-100/80 text-slate-700 font-bold hover:scale-105 active:scale-95"
            title="Zoom In"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={() => setZoom(prev => Math.max(prev - 1, 1))}
            className="bg-white hover:bg-slate-50 transition-all w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg border border-slate-100/80 text-slate-700 font-bold hover:scale-105 active:scale-95"
            title="Zoom Out"
          >
            <Minus size={16} />
          </button>
        </div>

        {/* Consolidated Floating Controls Top-Right */}
        <div id="map-action-controls" className="absolute top-4 right-4 flex flex-col gap-1.5 z-10 pointer-events-auto">
          {/* Manual Refresh Button */}
          <button 
            onClick={handleManualRefresh}
            className="bg-white hover:bg-slate-50 transition-all w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg border border-slate-100/80 hover:scale-105 active:scale-95 text-slate-600 disabled:opacity-50"
            title="Refresh partner live signal"
            disabled={isRefreshing}
          >
            <RefreshCw size={16} className={`text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* Map Type Switch Panel (Satellite View <-> default Roadmap View) */}
          <button 
            onClick={() => setMapType(prev => prev === 'roadmap' ? 'satellite' : 'roadmap')}
            className={`transition-all w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg border hover:scale-105 active:scale-95 ${
              mapType === 'satellite' 
                ? 'bg-blue-700 border-blue-800 text-white hover:bg-blue-600' 
                : 'bg-white border-slate-100/80 text-slate-700 hover:bg-slate-50'
            }`}
            title={`Switch to ${mapType === 'roadmap' ? 'Satellite' : 'Roadmap'} View`}
          >
            {mapType === 'roadmap' ? <Layers size={16} /> : <Globe size={16} />}
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

        {/* Detailed Info Card (Spans over map on request / marker click) */}
        {showDetailCard && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-30 flex items-end p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full rounded-3xl p-5 shadow-2xl border border-slate-100 flex flex-col gap-4 animate-in slide-in-from-bottom duration-300 pointer-events-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-slate-800 tracking-tight">{userInfo?.displayName || 'Partner Specialist'}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Live GPS Connection</p>
                </div>
                <button 
                  onClick={() => setShowDetailCard(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-black flex items-center justify-center transition-colors shadow-sm"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 flex flex-col justify-center">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Status</span>
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="text-xs font-black text-slate-800">{partnerContactStatus}</span>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 flex flex-col justify-center">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Last Update</span>
                  <div className="flex items-center gap-1.5 text-slate-800">
                    <Clock size={12} className="text-slate-400" />
                    <span className="text-xs font-black">{getFormattedLastUpdated()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <div className="flex items-center gap-1.5">
                  <Star size={14} className="fill-amber-400 stroke-amber-400" />
                  <span className="text-xs font-black text-slate-800">{partnerInfo?.rating ? Number(partnerInfo.rating).toFixed(1) : '4.9'}</span>
                  <span className="text-[10px] text-slate-400">({partnerInfo?.reviewCount || 18} reviews)</span>
                </div>

                <a 
                  href={`tel:${partnerPhone}`}
                  className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-black py-2.5 px-4 rounded-2xl text-[10px] uppercase tracking-wider transition-all shadow-md border border-blue-500"
                >
                  <Phone size={11} className="fill-white" />
                  Call Professional
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Proximity Pulse Settings Overlay */}
        <div id="partner-proximity-settings" className="absolute bottom-24 left-4 bg-white/95 backdrop-blur-md rounded-2xl px-3 py-2 shadow-lg border border-slate-100 flex items-center gap-2 z-10 pointer-events-auto hover:bg-white transition-all">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={pulseEnabled} 
              onChange={() => setPulseEnabled(p => !p)} 
              className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <div className={`p-1 rounded-lg ${pulseEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'} flex items-center justify-center`}>
              <Radio size={12} className={pulseEnabled ? 'animate-pulse' : ''} />
            </div>
            <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">Pulse Proximity</span>
          </label>
        </div>

        {/* Floating Info Overlay for distance and Estimated Time of Arrival (ETA) to destination */}
        <div className={`absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border flex items-center justify-between gap-4 pointer-events-none transition-all z-10 ${isCloseToDest ? 'border-emerald-400/40 ring-4 ring-emerald-500/10' : 'border-white'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isCloseToDest ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-700'}`}>
              <Compass className="animate-pulse" size={18} />
            </div>
            <div>
              <p className={`text-[9px] font-black uppercase tracking-widest leading-none ${isCloseToDest ? 'text-emerald-650' : 'text-slate-400'}`}>
                {isCloseToDest ? '🌟 Arriving Now' : 'Live Route'}
              </p>
              <p className={`text-[11px] font-bold mt-1 ${isCloseToDest ? 'text-emerald-800 animate-pulse' : 'text-slate-500'}`}>
                {isCloseToDest ? 'Pro is within 500m of you!' : 'On the way to you'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-5 pointer-events-auto">
            {distance && (
              <div className="text-right">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Distance</p>
                <p className="text-xs font-black text-slate-800">{distance}</p>
              </div>
            )}
            <div className="text-right border-l border-slate-100 pl-4">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">ETA</p>
              <p className="text-xs font-black text-blue-700">{eta}</p>
            </div>
          </div>
        </div>
      </div>

      <div 
        onClick={() => setShowDetailCard(true)}
        className="flex items-center justify-between p-6 bg-slate-50 hover:bg-slate-100/80 transition-all rounded-[32px] border border-slate-100 cursor-pointer group"
      >
         <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl border border-slate-200 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
               <Navigation size={20} className="text-blue-700" />
            </div>
            <div>
               <h5 className="text-sm font-black italic">{userInfo?.displayName || 'Expert Agent'}</h5>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                 Live Signal Active
                 <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
               </p>
            </div>
         </div>
         <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">CURRENT ETA</p>
            <p className="text-lg font-black text-slate-900 italic">{eta}</p>
         </div>
      </div>
    </div>
  );
}

