import React, { useState, useRef, useEffect } from 'react';
import { useGeolocation } from '../hooks/useGeolocation';
import { useCamera } from '../hooks/useCamera';
import { useMicrophone } from '../hooks/useMicrophone';
import { 
  Navigation, 
  Camera, 
  Mic, 
  Cpu, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  MapPin, 
  Lock, 
  Video, 
  VideoOff, 
  StopCircle,
  Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function HardwarePermissionDiagnoser() {
  const geo = useGeolocation();
  const cam = useCamera();
  const mic = useMicrophone();

  // Test states
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [geoMode, setGeoMode] = useState<'high' | 'standard' | 'manual' | null>(null);
  const [geoLog, setGeoLog] = useState<string[]>([]);
  
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [isMicActive, setIsMicActive] = useState(false);
  const [voiceVolume, setVoiceVolume] = useState<number>(0);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const micIntervalRef = useRef<any>(null);

  // Hook stream into video element when cam.stream updates
  useEffect(() => {
    if (isCameraActive && cam.stream && videoRef.current) {
      videoRef.current.srcObject = cam.stream;
      videoRef.current.play().catch(err => {
        console.error("Video play failed:", err);
      });
    }
  }, [isCameraActive, cam.stream]);

  // Cleanup mic interval on disable
  useEffect(() => {
    if (!isMicActive && micIntervalRef.current) {
      clearInterval(micIntervalRef.current);
      micIntervalRef.current = null;
    }
  }, [isMicActive]);

  // Symmetrical logger for GPS actions
  const logGeoMessage = (msg: string) => {
    setGeoLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 9)]);
  };

  // 1. Geolocation Tester
  const handleTestGPS = async (accuracyMode: 'high' | 'standard') => {
    setGeoMode(accuracyMode);
    logGeoMessage(`Querying permission states & initializing GPS request...`);
    try {
      const isHigh = accuracyMode === 'high';
      logGeoMessage(`Requesting location coords (High Accuracy: ${isHigh ? 'Enabled' : 'Disabled'})...`);
      
      const pos = await geo.getCurrentLocation({
        enableHighAccuracy: isHigh,
        timeout: isHigh ? 8000 : 15000
      });

      setCoords(pos);
      logGeoMessage(`Success! Latitude: ${pos.lat.toFixed(5)}, Longitude: ${pos.lng.toFixed(5)}`);
    } catch (err: any) {
      logGeoMessage(`Error: ${err.message || err}`);
      if (accuracyMode === 'high') {
        logGeoMessage(`Attempting auto fallback to standard cellular accuracy...`);
        try {
          setGeoMode('standard');
          const fallbackPos = await geo.getCurrentLocation({
            enableHighAccuracy: false,
            timeout: 10000
          });
          setCoords(fallbackPos);
          logGeoMessage(`Fallback Success! Lat: ${fallbackPos.lat.toFixed(5)}, Lng: ${fallbackPos.lng.toFixed(5)}`);
        } catch (fallbackErr: any) {
          logGeoMessage(`Fallback also failed: ${fallbackErr.message || fallbackErr}`);
          logGeoMessage(`Toggling UI manual lookup. Manual Address Search is ready.`);
          setGeoMode('manual');
        }
      } else {
        setGeoMode('manual');
      }
    }
  };

  // 2. Camera Stream & Grab Photo
  const handleToggleCamera = async () => {
    if (isCameraActive) {
      cam.stopCamera();
      setIsCameraActive(false);
      setCapturedPhotoUrl(null);
    } else {
      try {
        setIsCameraActive(true);
        setCapturedPhotoUrl(null);
        await cam.startCamera({ facingMode: 'environment' });
      } catch (err) {
        setIsCameraActive(false);
      }
    }
  };

  const handleCapturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        setCapturedPhotoUrl(dataUrl);
        // Cleanly stop tracks after capturing photo to avoid memory leaks
        cam.stopCamera();
        setIsCameraActive(false);
      }
    }
  };

  // 3. Microphone & Volume Simulation
  const handleToggleMic = async () => {
    if (isMicActive) {
      mic.stopMicrophone();
      setIsMicActive(false);
      setVoiceVolume(0);
      setRecordingSeconds(0);
    } else {
      try {
        await mic.startMicrophone();
        setIsMicActive(true);
        setRecordingSeconds(0);
        
        // Setup volume generator simulating sound amplitude
        micIntervalRef.current = setInterval(() => {
          setRecordingSeconds(prev => prev + 1);
          setVoiceVolume(Math.floor(Math.random() * 85) + 15);
        }, 1000);
      } catch (err) {
        setIsMicActive(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Overview header */}
      <div className="flex flex-col gap-1.5">
        <h3 className="text-xl font-extrabold text-neutral-900 tracking-tight flex items-center gap-2">
          <Cpu className="text-[#050CA6] stroke-[2.5]" size={22} />
          App Permissions & Safety
        </h3>
        <p className="text-xs text-neutral-500 font-semibold leading-relaxed">
          Verify and configure permissions safely. Granting these permissions ensures accurate dispatch routing, live order navigation, and instant customer verification.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* SENSOR 1: HOME LOCATION (GPS) */}
        <div className="bg-white border border-neutral-150 rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                  <MapPin size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-neutral-800">Home Location (GPS)</h4>
                  <p className="text-[10px] text-neutral-400 font-semibold">Technician & Order Routing</p>
                </div>
              </div>
              <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider ${
                geo.permissionState === 'granted' 
                  ? 'bg-emerald-50 text-emerald-700' 
                  : geo.permissionState === 'denied' 
                    ? 'bg-rose-50 text-rose-700' 
                    : 'bg-amber-50 text-amber-700'
              }`}>
                {geo.permissionState}
              </span>
            </div>

            <p className="text-xs text-neutral-500 font-semibold leading-relaxed">
              Your location is protected. Standard browser lookup triggers if high-accuracy fails or requests take too long.
            </p>

            {coords && (
              <div className="bg-neutral-50 rounded-2xl p-3.5 border border-neutral-100 text-xs font-semibold text-neutral-700 grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[9px] uppercase font-bold text-neutral-400 block tracking-wider">Latitude</span>
                  <span className="font-mono text-neutral-800">{coords.lat.toFixed(6)}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-neutral-400 block tracking-wider">Longitude</span>
                  <span className="font-mono text-neutral-800">{coords.lng.toFixed(6)}</span>
                </div>
              </div>
            )}

            {/* GPS Activity Logs */}
            <div className="bg-neutral-900 border border-neutral-950 rounded-2xl p-3 h-28 overflow-y-auto text-[10px] font-mono text-emerald-400 space-y-1 block text-left">
              <span className="text-neutral-500 block uppercase font-bold text-[8px] tracking-wider mb-1">Location Logs</span>
              {geoLog.length === 0 ? (
                <span className="text-neutral-500 italic block">Ready... Trigger test sequence below.</span>
              ) : (
                geoLog.map((log, index) => <div key={index} className="leading-relaxed">{log}</div>)
              )}
            </div>
          </div>

          <div className="flex gap-2.5 pt-1">
            <button
              onClick={() => handleTestGPS('high')}
              disabled={geo.isFetching}
              className="flex-1 bg-[#050CA6] hover:bg-[#040980] text-white py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {geo.isFetching && geoMode === 'high' ? (
                <RefreshCw size={12} className="animate-spin" />
              ) : (
                <Navigation size={12} />
              )}
              <span>High Accuracy</span>
            </button>
            <button
              onClick={() => handleTestGPS('standard')}
              disabled={geo.isFetching}
              className="flex-1 bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-200 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {geo.isFetching && geoMode === 'standard' ? (
                <RefreshCw size={12} className="animate-spin" />
              ) : (
                <MapPin size={12} />
              )}
              <span>Standard GPS</span>
            </button>
          </div>
        </div>

        {/* SENSOR 2: CAMERA ACCESS */}
        <div className="bg-white border border-neutral-150 rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                  <Camera size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-neutral-800">Camera Access</h4>
                  <p className="text-[10px] text-neutral-400 font-semibold">QR Scanning & Photo Uploads</p>
                </div>
              </div>
              <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider ${
                cam.permissionState === 'granted' 
                  ? 'bg-emerald-50 text-emerald-700' 
                  : cam.permissionState === 'denied' 
                    ? 'bg-rose-50 text-rose-700' 
                    : 'bg-amber-50 text-amber-700'
              }`}>
                {cam.permissionState}
              </span>
            </div>

            <p className="text-xs text-neutral-500 font-semibold leading-relaxed">
              Required for scanning job QR codes and uploading work completion photos. Safe and secure.
            </p>

            {/* Video preview / Frozen Photo Frame */}
            <div className="w-full h-40 bg-neutral-950 rounded-2xl overflow-hidden relative border border-neutral-900 group flex items-center justify-center">
              {isCameraActive ? (
                <>
                  <video 
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    autoPlay
                    playsInline
                    muted
                  />
                  <div className="absolute top-2 left-2 bg-emerald-500/90 text-white text-[8px] font-bold py-0.5 px-2 rounded-full uppercase animate-pulse flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white block" /> Camera Preview
                  </div>
                  <button 
                    onClick={handleCapturePhoto}
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white/90 hover:bg-white text-neutral-900 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-transform hover:scale-105 shadow"
                  >
                    Capture Photo
                  </button>
                </>
              ) : capturedPhotoUrl ? (
                <>
                  <img 
                    src={capturedPhotoUrl} 
                    alt="Captured test check" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 bg-neutral-900/95 text-[#050CA6] border border-[#050CA6] text-[8.5px] font-black py-0.5 px-2 rounded-full uppercase">
                    Stored Image
                  </div>
                </>
              ) : (
                <div className="text-center p-4 text-neutral-600 flex flex-col items-center gap-2">
                  <VideoOff size={18} className="text-neutral-500" />
                  <p className="text-[10px] font-semibold">Camera is currently inactive.</p>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleToggleCamera}
            className={`w-full py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              isCameraActive 
                ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100' 
                : 'bg-[#050CA6] text-white hover:bg-[#040980]'
            }`}
          >
            {isCameraActive ? (
              <>
                <VideoOff size={12} />
                <span>Turn Off Camera</span>
              </>
            ) : (
              <>
                <Video size={12} />
                <span>Test Camera Connection</span>
              </>
            )}
          </button>
        </div>

        {/* SENSOR 3: MICROPHONE ACCESS */}
        <div className="bg-white border border-neutral-150 rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-4 md:col-span-2">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-50 text-rose-700 rounded-xl">
                  <Mic size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-neutral-800">Microphone Access</h4>
                  <p className="text-[10px] text-neutral-400 font-semibold">Voice Notes & Customer Support</p>
                </div>
              </div>
              <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider ${
                mic.permissionState === 'granted' 
                  ? 'bg-emerald-50 text-emerald-700' 
                  : mic.permissionState === 'denied' 
                    ? 'bg-rose-50 text-rose-700' 
                    : 'bg-amber-50 text-amber-700'
              }`}>
                {mic.permissionState}
              </span>
            </div>

            <p className="text-xs text-neutral-500 font-semibold leading-relaxed">
              Verify your mic connection. Audio permission is required to send voice notes or speak with customer support in emergencies.
            </p>

            {/* Audio Signal Visualizer and status bar */}
            <div className="bg-neutral-50 border border-neutral-100 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-3.5 h-3.5 rounded-full bg-neutral-300 relative flex items-center justify-center">
                  <span className={`w-2.5 h-2.5 rounded-full ${isMicActive ? 'bg-rose-600 animate-pulse' : 'bg-neutral-400'}`} />
                </div>
                <div>
                  <p className="text-xs font-bold text-neutral-700">
                    {isMicActive ? `Recording audio preview...` : `Microphone is currently inactive.`}
                  </p>
                  <p className="text-[10px] text-neutral-400 font-semibold">
                    {isMicActive ? `Elapsed: ${recordingSeconds}s` : 'Press below to test your audio.'}
                  </p>
                </div>
              </div>

              {/* Decibel signal visualizer animation */}
              {isMicActive && (
                <div className="flex items-center gap-1 h-6">
                  {[...Array(8)].map((_, i) => {
                    const h = Math.floor(Math.random() * 24) + 4;
                    return (
                      <div 
                        key={i} 
                        className="w-1 bg-[#050CA6] rounded-full transition-all duration-200" 
                        style={{ height: `${h}px` }} 
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleToggleMic}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              isMicActive 
                ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100' 
                : 'bg-[#050CA6] text-white hover:bg-[#040980]'
            }`}
          >
            {isMicActive ? (
              <>
                <StopCircle size={12} />
                <span>Stop Audio Recording</span>
              </>
            ) : (
              <>
                <Mic size={12} />
                <span>Initialize Microphone Test</span>
              </>
            )}
          </button>
        </div>

      </div>

      {/* BLOCKED PERMISSION DETECTED - CUSTOM IN-APP MODAL OVERLAYS */}
      <AnimatePresence>
        {(geo.showBlockedModal || cam.showBlockedModal || mic.showBlockedModal) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-neutral-900/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-xs"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white max-w-sm w-full rounded-[32px] p-6 text-center space-y-4 border border-neutral-100 shadow-xl"
            >
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <Lock size={20} className="stroke-[2.5]" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-base font-black text-neutral-900 leading-normal">
                  Hardware Sensor Access Blocked
                </h4>
                <p className="text-xs text-neutral-500 font-semibold leading-relaxed">
                  You previously denied this PWA permission. To restore high-accuracy tracking and scanner features, follow these native manual steps:
                </p>
              </div>

              {/* Custom manual permission restore tutorial depending on OS */}
              <div className="bg-neutral-50 rounded-2xl p-3 border border-neutral-100 text-[10px] text-neutral-600 font-semibold text-left space-y-2">
                <div className="flex gap-2">
                  <span className="bg-neutral-200 text-neutral-700 w-4 h-4 rounded-full flex items-center justify-center font-bold shrink-0">1</span>
                  <p>Click the **Sensor Settings Icon** in your browser's address bar (or padlock icon next to app URL).</p>
                </div>
                <div className="flex gap-2">
                  <span className="bg-neutral-200 text-neutral-700 w-4 h-4 rounded-full flex items-center justify-center font-bold shrink-0">2</span>
                  <p>Toggle permissions for **Location, Camera, or Microphone** back to **"Allow"**.</p>
                </div>
                <div className="flex gap-2">
                  <span className="bg-neutral-200 text-neutral-700 w-4 h-4 rounded-full flex items-center justify-center font-bold shrink-0">3</span>
                  <p>Refresh or restart the application to enable high-accuracy locks.</p>
                </div>
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  onClick={() => {
                    geo.setShowBlockedModal(false);
                    cam.setShowBlockedModal(false);
                    mic.setShowBlockedModal(false);
                  }}
                  className="w-full bg-[#050CA6] text-white hover:bg-[#040980] py-2 px-4 rounded-xl text-xs font-black cursor-pointer uppercase tracking-wider"
                >
                  Acknowledge & Dismiss
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
