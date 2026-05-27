import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, AlertCircle, Sparkles, Check, X, ShieldAlert, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Booking } from '../types';

interface CustomerPaymentScannerProps {
  bookings: Booking[];
  onScanSuccess: (bookingId: string) => void;
  onClose: () => void;
}

export const CustomerPaymentScanner: React.FC<CustomerPaymentScannerProps> = ({
  bookings,
  onScanSuccess,
  onClose
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [cameraState, setCameraState] = useState<'requesting' | 'active' | 'failed'>('requesting');
  const streamRef = useRef<MediaStream | null>(null);

  // Filter out unpaid/completed/finalized bookings that are valid targets for payment
  const unpaidBookings = bookings.filter(b => b.paymentStatus !== 'paid');
  const [selectedSimBookingId, setSelectedSimBookingId] = useState<string>(
    unpaidBookings[0]?.id || ''
  );

  useEffect(() => {
    let animationFrameId: number;

    const startCamera = async () => {
      try {
        setCameraState('requesting');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS
          videoRef.current.play();
          setHasCamera(true);
          setCameraState('active');
        }
      } catch (err: any) {
        console.warn('Camera access denied or failed:', err);
        setHasCamera(false);
        setCameraState('failed');
        setErrorMessage(
          err.name === 'NotAllowedError' 
            ? 'Camera access denied. Please grant permissions or use the simulator below.' 
            : 'No camera found, or permission blocked in this iframe environment.'
        );
      }
    };

    startCamera();

    const tick = () => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const canvas = canvasRef.current;
        const video = videoRef.current;

        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert'
            });

            if (code && code.data) {
              handleCodeScanned(code.data);
              return; // Stop scanning once match is found
            }
          }
        }
      }
      
      if (isScanning && !scanResult) {
        animationFrameId = requestAnimationFrame(tick);
      }
    };

    // Delay start of frame analysis slightly to allow video feed initialization
    const timer = setTimeout(() => {
      if (cameraState === 'active' || hasCamera) {
        animationFrameId = requestAnimationFrame(tick);
      }
    }, 1000);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(animationFrameId);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [isScanning, scanResult, cameraState, hasCamera]);

  const handleCodeScanned = (data: string) => {
    const cleanData = data.trim();
    // Expected QR formats:
    // zomindia_payment:<bookingId>:<totalPrice> OR includes active bookingId
    let foundBookingId = '';
    
    if (cleanData.startsWith('zomindia_payment:')) {
      const parts = cleanData.split(':');
      foundBookingId = parts[1];
    } else {
      // Look for any of current user's booking ids included in scanned text
      const matchedB = bookings.find(b => cleanData.includes(b.id));
      if (matchedB) {
        foundBookingId = matchedB.id;
      }
    }

    if (foundBookingId) {
      setScanResult(cleanData);
      setIsScanning(false);
      setTimeout(() => {
        onScanSuccess(foundBookingId);
      }, 1500);
    } else {
      console.warn("No matching booking ID found in scanned QR code data:", cleanData);
    }
  };

  const handleSimulatedScan = () => {
    if (!selectedSimBookingId) return;
    const matchedB = bookings.find(b => b.id === selectedSimBookingId);
    if (matchedB) {
      const mockQRData = `zomindia_payment:${matchedB.id}:${matchedB.totalPrice}`;
      handleCodeScanned(mockQRData);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-[40px] p-6 sm:p-8 w-full max-w-md shadow-2xl relative overflow-hidden"
      >
        {/* Decorative subtle background glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-6 right-6 w-10 h-10 rounded-full bg-slate-105 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-blue-50 text-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-105 shadow-sm">
            <Camera size={22} className={isScanning && cameraState === 'active' ? 'animate-pulse' : ''} />
          </div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Scan Partner Payment QR</h3>
          <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mt-1">
            Pay for your service instant and securely
          </p>
        </div>

        {/* Viewfinder Canvas Section */}
        <div className="relative aspect-square w-full max-w-[280px] mx-auto bg-slate-950 rounded-3xl overflow-hidden border border-slate-800 shadow-inner flex flex-col items-center justify-center">
          {cameraState === 'active' && !scanResult ? (
            <>
              {/* Actual Video and Canvas */}
              <video
                ref={videoRef}
                className="hidden"
                playsInline
                muted
              />
              <canvas
                ref={canvasRef}
                className="w-full h-full object-cover"
              />

              {/* Viewfinder Overlay border & laser effect */}
              <div className="absolute inset-4 border-2 border-dashed border-blue-400/50 rounded-2xl pointer-events-none" />
              <div className="absolute inset-x-4 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-pulse" />
            </>
          ) : scanResult ? (
            /* Success State Inside Viewfinder */
            <div className="absolute inset-0 bg-emerald-500/90 flex flex-col items-center justify-center p-6 text-center text-white">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-16 h-16 bg-white text-emerald-600 rounded-full flex items-center justify-center shadow-lg mb-3"
              >
                <Check size={32} strokeWidth={3} />
              </motion.div>
              <h4 className="text-lg font-black tracking-tight">QR Recognized</h4>
              <p className="text-[10px] text-emerald-100 font-extrabold uppercase tracking-wider mt-1">
                Launcing Secure Payment Gateway...
              </p>
            </div>
          ) : (
            /* Camera Unavailable or Loading State */
            <div className="p-6 text-center space-y-4">
              {cameraState === 'requesting' ? (
                <div className="space-y-2">
                  <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-slate-400 font-bold">Requesting camera permissions...</p>
                </div>
              ) : (
                <div className="space-y-2 px-2">
                  <ShieldAlert size={28} className="text-amber-500 mx-auto" />
                  <p className="text-[10px] text-slate-400 leading-relaxed font-bold">
                    Webcam is unavailable in sandbox mode. Use the developer simulator below to test the UPI flow.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dynamic Sandbox Controls */}
        <div className="mt-6 border-t border-slate-100 pt-5 space-y-3">
          <div className="flex items-center gap-1.5 justify-center text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
            <Sparkles size={11} className="text-yellow-500 animate-spin" />
            <span>Developer Sandbox Controls</span>
          </div>

          <div className="flex flex-col gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <p className="text-[8.5px] font-black uppercase text-slate-400 tracking-wider text-left pl-1">Target Booking to unpaid</p>
            {unpaidBookings.length > 0 ? (
              <select
                value={selectedSimBookingId}
                onChange={(e) => setSelectedSimBookingId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl text-xs px-3 py-2 font-bold focus:outline-none focus:border-blue-700 font-sans"
              >
                {unpaidBookings.map(b => (
                  <option key={b.id} value={b.id}>
                    ID: {b.id.toUpperCase().slice(0, 8)} (₹{b.totalPrice})
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-[10px] text-slate-450 font-bold italic py-1 pl-1">No unpaid bookings found.</p>
            )}
          </div>

          <button
            type="button"
            onClick={handleSimulatedScan}
            disabled={!selectedSimBookingId}
            className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white py-4 px-4 rounded-2xl font-black uppercase tracking-widest text-[9px] shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer font-sans"
          >
            <CreditCard size={12} className="text-emerald-400" />
            Simulate Scan Partner's Payment QR
          </button>
        </div>
      </motion.div>
    </div>
  );
};
