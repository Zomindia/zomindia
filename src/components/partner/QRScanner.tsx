import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, AlertCircle, Sparkles, Check, X, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface QRScannerProps {
  bookingId: string;
  expectedCode: string;
  onScanSuccess: () => void;
  onClose: () => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({
  bookingId,
  expectedCode,
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
    if (cleanData === expectedCode || cleanData.includes(bookingId)) {
      setScanResult(cleanData);
      setIsScanning(false);
      // Play a short mock success sound or show success state
      setTimeout(() => {
        onScanSuccess();
      }, 1500);
    } else {
      console.warn("Mismatched QR Code scanned:", cleanData);
    }
  };

  // Safe manual bypass simulation for environment testing
  const handleSimulatedScan = () => {
    handleCodeScanned(expectedCode);
  };

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-[40px] p-6 sm:p-8 w-full max-w-md shadow-2xl relative overflow-hidden"
      >
        {/* Subtle decorative background glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-6 right-6 w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-100 shadow-sm">
            <Camera size={22} className={isScanning && cameraState === 'active' ? 'animate-pulse' : ''} />
          </div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">QR Code Verification</h3>
          <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mt-1">
            {expectedCode.includes('start') ? 'Scan Customer Start QR Code' : 'Scan Customer Completion QR Code'}
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
              <div className="absolute inset-4 border-2 border-dashed border-emerald-400/50 rounded-2xl pointer-events-none" />
              <div className="absolute inset-x-4 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse" style={{
                animation: 'pulse 1.5s infinite ease-in-out'
              }} />
            </>
          ) : scanResult ? (
            /* Success State Inside Viewfinder */
            <div className="absolute inset-0 bg-emerald-500/90 flex flex-col items-center justify-center p-6 text-center text-white animate-fade-in">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-16 h-16 bg-white text-emerald-600 rounded-full flex items-center justify-center shadow-lg mb-3"
              >
                <Check size={32} strokeWidth={3} />
              </motion.div>
              <h4 className="text-lg font-black tracking-tight">Verification Success</h4>
              <p className="text-[10px] text-emerald-100 font-extrabold uppercase tracking-wider mt-1">
                {expectedCode.includes('start') ? 'Service Unlocked & Started' : 'Job Finalized Successfully'}
              </p>
            </div>
          ) : (
            /* Camera Unavailable or Loading State */
            <div className="p-6 text-center space-y-4">
              {cameraState === 'requesting' ? (
                <div className="space-y-2">
                  <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-slate-400 font-bold">Requesting camera permissions...</p>
                </div>
              ) : (
                <div className="space-y-2 px-2">
                  <ShieldAlert size={28} className="text-amber-500 mx-auto" />
                  <p className="text-[10px] text-slate-400 leading-relaxed font-bold">
                    Webcam is unavailable in sandbox mode. Use the direct simulator bypass below to proceed.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Assistance / Active Status */}
        <div className="mt-6 text-center">
          <p className="text-[11px] text-slate-500 font-medium">
            This booking ID: <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-1 rounded-md">{bookingId}</span>
          </p>
        </div>

        {/* Symmetrical Simulator / Manual verification block */}
        <div className="mt-6 border-t border-slate-100 pt-5 space-y-3">
          <div className="flex items-center gap-1.5 justify-center text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
            <Sparkles size={11} className="text-yellow-500 animate-spin" />
            <span>Developer Sandbox Controls</span>
          </div>

          <button
            type="button"
            onClick={handleSimulatedScan}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 px-4 rounded-2xl font-black uppercase tracking-widest text-[9px] shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Check size={12} className="text-emerald-400" />
            Simulate Customer QR Code Scan
          </button>
          
          <button
            type="button"
            onClick={onClose}
            className="w-full text-slate-400 hover:text-slate-600 py-2.5 rounded-xl font-bold uppercase tracking-wider text-[9px] transition-all cursor-pointer"
          >
            Cancel and Return
          </button>
        </div>
      </motion.div>
    </div>
  );
};
