import React, { useEffect, useState } from 'react';
import { Map, AdvancedMarker, Pin, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PartnerProfile, UserProfile } from '../types';
import { MapPin, Navigation, Smartphone } from 'lucide-react';

import { handleMapsError } from '../lib/maps-errors';

interface PartnerTrackingMapProps {
  partnerId: string;
  bookingLocation?: { lat: number; lng: number };
  destinationAddress?: string;
  onClose?: () => void;
}

function MapLogic({ partnerLocation, bookingLocation, destinationAddress, onRouteUpdate }: { 
  partnerLocation: { lat: number; lng: number }, 
  bookingLocation?: { lat: number; lng: number },
  destinationAddress?: string,
  onRouteUpdate?: (eta: string, distance: string) => void
}) {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');
  const routesLib = useMapsLibrary('routes');
  const [destCoords, setDestCoords] = useState<{lat: number, lng: number} | null>(bookingLocation || null);
  const [routePath, setRoutePath] = useState<string[]>([]);

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
  }, [partnerLocation, destCoords, routesLib, onRouteUpdate]);

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

  return (
    <>
      {partnerLocation && (
        <AdvancedMarker position={partnerLocation}>
          <div className="relative">
            <div className="absolute -inset-4 bg-blue-500/20 rounded-full animate-ping"></div>
            <div className="w-10 h-10 bg-blue-700 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-700/30 border-2 border-white relative z-10">
              <Navigation size={20} className="rotate-45" />
            </div>
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

export default function PartnerTrackingMap({ partnerId, bookingLocation, destinationAddress, onClose }: PartnerTrackingMapProps) {
  const [partnerLocation, setPartnerLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [partnerInfo, setPartnerInfo] = useState<PartnerProfile | null>(null);
  const [userInfo, setUserInfo] = useState<UserProfile | null>(null);
  const [eta, setEta] = useState<string>('~12 min');
  const [distance, setDistance] = useState<string>('');

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

  if (!partnerLocation) {
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

  return (
    <div className="space-y-4">
      <div className="relative w-full h-64 rounded-[40px] overflow-hidden border border-slate-100 shadow-xl shadow-blue-900/5 group">
        <Map
          defaultCenter={partnerLocation}
          center={partnerLocation}
          defaultZoom={13}
          mapId="TRACKING_MAP"
          gestureHandling="auto"
          disableDefaultUI
          className="w-full h-full"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        >
          <MapLogic 
            partnerLocation={partnerLocation} 
            bookingLocation={bookingLocation} 
            destinationAddress={destinationAddress} 
            onRouteUpdate={(e, d) => { setEta(e); setDistance(d); }}
          />
        </Map>

        {/* Floating Info Overlay */}
        <div className="absolute top-4 left-4 right-4 flex justify-between gap-3 pointer-events-none">
          <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl border border-white/50 flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-white shadow-md">
                <Smartphone size={14} />
             </div>
             <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">Status</p>
                <p className="text-xs font-bold text-slate-900">Moving</p>
             </div>
          </div>
          {distance && (
            <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl border border-white/50 flex items-center gap-3">
               <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none text-right">Distance</p>
                  <p className="text-xs font-bold text-slate-900 text-right">{distance}</p>
               </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[32px] border border-slate-100">
         <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl border border-slate-200 flex items-center justify-center shadow-sm">
               <Navigation size={20} className="text-blue-700" />
            </div>
            <div>
               <h5 className="text-sm font-black italic">{userInfo?.displayName || 'Expert Agent'}</h5>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Signal Active</p>
            </div>
         </div>
         <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">ETA</p>
            <p className="text-lg font-black text-slate-900 italic">{eta}</p>
         </div>
      </div>
    </div>
  );
}
