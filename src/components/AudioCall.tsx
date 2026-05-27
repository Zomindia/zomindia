import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, Mic, MicOff, PhoneOff, User } from 'lucide-react';
import { UserProfile } from '../types';

interface AudioCallProps {
  otherUser: UserProfile | null;
  onEndCall: () => void;
  isIncoming?: boolean;
  bookingId?: string;
  activeCall?: any;
  onAnswer?: () => void;
}

export default function AudioCall({ 
  otherUser, 
  onEndCall, 
  isIncoming = false,
  bookingId,
  activeCall,
  onAnswer
}: AudioCallProps) {
  const [callState, setCallState] = useState<'connecting' | 'ringing' | 'connected' | 'ended'>(
    isIncoming ? 'ringing' : 'connecting'
  );
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);

  // Sync state if activeCall prop is provided via Firestore
  useEffect(() => {
    if (activeCall) {
      if (activeCall.status === 'connected') {
        setCallState('connected');
      } else if (activeCall.status === 'ended') {
        setCallState('ended');
        const endTimer = setTimeout(onEndCall, 1500);
        return () => clearTimeout(endTimer);
      }
    }
  }, [activeCall, onEndCall]);

  useEffect(() => {
    let timer: any;
    if (callState === 'connecting') {
      if (bookingId) {
        // Coordinated call rings immediately once Firestore doc is updated
        setCallState('ringing');
      } else {
        timer = setTimeout(() => setCallState('ringing'), 1500);
      }
    } else if (callState === 'ringing' && !isIncoming) {
      if (!bookingId) {
        // automatically "answer" after 3 seconds for offline demo fallback purposes
        timer = setTimeout(() => setCallState('connected'), 3000);
      }
    } else if (callState === 'connected') {
      timer = setInterval(() => setDuration(d => d + 1), 1000);
    }
    return () => {
      clearTimeout(timer);
      clearInterval(timer);
    };
  }, [callState, isIncoming, bookingId]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleEndCall = () => {
    setCallState('ended');
    setTimeout(onEndCall, 1000);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-blue-700/90 backdrop-blur-xl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="w-full max-w-sm bg-slate-950 rounded-[48px] overflow-hidden shadow-2xl relative border border-blue-600"
      >
        {/* Animated background rings for calling state */}
        {(callState === 'connecting' || callState === 'ringing') && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="w-48 h-48 bg-emerald-500/10 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-500/5 rounded-full animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
          </div>
        )}

        <div className="p-10 flex flex-col items-center justify-between min-h-[500px] relative z-10">
          
          <div className="flex flex-col items-center mt-8">
            <div className="w-32 h-32 rounded-full overflow-hidden mb-6 border-4 border-blue-600 shadow-2xl relative">
              {otherUser?.photoURL ? (
                <img src={otherUser.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full bg-blue-600 flex items-center justify-center">
                  <User size={48} className="text-slate-500" />
                </div>
              )}
            </div>
            
            <h2 className="text-2xl font-black text-white tracking-tighter mb-2">
              {otherUser?.displayName || 'Support Partner'}
            </h2>
            
            <p className="text-sm font-bold text-slate-400 tracking-widest uppercase mb-8">
              {callState === 'connecting' && 'Connecting...'}
              {callState === 'ringing' && 'Ringing...'}
              {callState === 'connected' && <span className="text-emerald-400">{formatDuration(duration)}</span>}
              {callState === 'ended' && 'Call Ended'}
            </p>
          </div>

          <div className="flex items-center gap-6 mb-8">
            {callState === 'ringing' && isIncoming ? (
              <>
                <button 
                  onClick={handleEndCall}
                  className="w-16 h-16 bg-rose-500 text-white rounded-full flex items-center justify-center hover:bg-rose-600 transition-all shadow-xl shadow-rose-500/20 active:scale-90"
                >
                  <PhoneOff size={24} />
                </button>
                <button 
                  onClick={() => {
                    if (onAnswer) {
                      onAnswer();
                    } else {
                      setCallState('connected');
                    }
                  }}
                  className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 active:scale-90 animate-bounce"
                >
                  <Phone size={24} className="animate-pulse" />
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={() => setIsMuted(!isMuted)}
                  disabled={callState !== 'connected'}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-90 ${
                    isMuted 
                      ? 'bg-white text-slate-900 border border-slate-200' 
                      : 'bg-blue-600 text-slate-300 border border-slate-700 hover:bg-slate-700'
                  } ${callState !== 'connected' && 'opacity-50 cursor-not-allowed'}`}
                >
                  {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                </button>
                <button 
                  onClick={handleEndCall}
                  className="w-16 h-16 bg-rose-500 text-white rounded-full flex items-center justify-center hover:bg-rose-600 transition-all shadow-xl shadow-rose-500/20 active:scale-90"
                >
                  <PhoneOff size={24} />
                </button>
              </>
            )}
          </div>

        </div>
      </motion.div>
    </div>
  );
}
