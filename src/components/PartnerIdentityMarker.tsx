import React from 'react';

interface PartnerIdentityMarkerProps {
  status: 'Available' | 'On Job' | 'In Transit';
  isClosest?: boolean;
  isSelected?: boolean;
  name?: string;
  distanceText?: string;
}

export default function PartnerIdentityMarker({
  status,
  isClosest = false,
  isSelected = false,
  name,
  distanceText
}: PartnerIdentityMarkerProps) {
  
  // Choose core colors based on status
  // Available: Emerald green (ready to accept work)
  // On Job: Slate/Blue (actively busy working inside a customer's location)
  // In Transit: Amber/Orange/Red (flying/speeding to a job site)
  let statusColor = '#10b981'; // emerald
  let statusGlow = 'rgba(16, 185, 129, 0.4)';
  if (status === 'On Job') {
    statusColor = '#3b82f6'; // blue
    statusGlow = 'rgba(59, 130, 246, 0.3)';
  } else if (status === 'In Transit') {
    statusColor = '#f59e0b'; // amber
    statusGlow = 'rgba(245, 158, 11, 0.5)';
  }

  // Highlight modifier colors if closest or selected
  if (isClosest) {
    statusColor = '#f59e0b'; // Gold / Amber
    statusGlow = 'rgba(245, 158, 11, 0.6)';
  }
  if (isSelected) {
    statusColor = '#3b82f6'; // Bright active blue
    statusGlow = 'rgba(59, 130, 246, 0.6)';
  }

  const animationClass = status === 'In Transit' ? 'animate-z-flight' : 'animate-z-idle';

  return (
    <div className="relative flex flex-col items-center select-none cursor-pointer">
      {/* Dynamic Keyframes Injection */}
      <style>{`
        @keyframes zFlight {
          0%, 100% { transform: translateY(0) rotate(-12deg); }
          50% { transform: translateY(-5px) rotate(-16deg); }
        }
        @keyframes zIdle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        @keyframes zStream {
          0% { stroke-dashoffset: 24; opacity: 0.3; }
          50% { opacity: 0.8; }
          100% { stroke-dashoffset: 0; opacity: 0.3; }
        }
        .animate-z-flight {
          animation: zFlight 2s ease-in-out infinite;
        }
        .animate-z-idle {
          animation: zIdle 3s ease-in-out infinite;
        }
        .animate-z-stream {
          stroke-dasharray: 8 4;
          animation: zStream 1.5s linear infinite;
        }
      `}</style>

      {/* Ripple/Glow Circle Backdrop */}
      <div 
        className="absolute w-12 h-12 -top-1 rounded-full transition-all duration-500 scale-110 active:scale-95" 
        style={{
          boxShadow: `0 0 20px 6px ${statusGlow}`,
          background: `radial-gradient(circle, ${statusGlow} 0%, transparent 70%)`
        }} 
      />

      {/* Main Avatar Drawing Container */}
      <div className={`relative ${animationClass} z-10 transition-transform duration-300 filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.3)]`}>
        {status === 'In Transit' ? (
          /* =========================================================================
             FLYING PARTNER SVG: Leaning forward, speed trails, cape flying, Z suit emblem!
             ========================================================================= */
          <svg width="52" height="52" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Speed trails background */}
            <path d="M4 36H16" stroke={statusColor} strokeWidth="1.5" strokeLinecap="round" className="animate-z-stream" />
            <path d="M7 44H20" stroke={statusColor} strokeWidth="2" strokeLinecap="round" className="animate-z-stream" style={{ animationDelay: '0.4s' }} />
            <path d="M2 28H14" stroke={statusColor} strokeWidth="1.5" strokeLinecap="round" className="animate-z-stream" style={{ animationDelay: '0.2s' }} />

            {/* Flying cape/wind-swoop stream */}
            <path 
              d="M18 36 C10 18, 5 32, 2 30" 
              stroke={statusColor} 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              fill="none" 
              className="opacity-70"
            />

            {/* Flying Man Body Structure */}
            {/* Torso/Suit (Tock tilted forward) */}
            <path 
              d="M22 42 L42 22 C45 19, 48 24, 44 28 L28 46 Z" 
              fill={statusColor} 
              stroke="#ffffff" 
              strokeWidth="2" 
              strokeLinejoin="round" 
            />

            {/* Jetpack/Cape pack on back */}
            <rect x="22" y="24" width="8" height="12" rx="4" transform="rotate(-35 22 24)" fill="#1f2937" stroke="#ffffff" strokeWidth="1" />
            <polygon points="18,36 12,40 16,44" fill="#ef4444" className="animate-pulse" /> {/* Small back rocket flame */}

            {/* Head inside streamlined helmet */}
            <circle cx="46" cy="18" r="7" fill={statusColor} stroke="#ffffff" strokeWidth="2" />
            {/* Dark glass visor of the helmet */}
            <path d="M44 14 C48 14, 52 18, 51 21" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" fill="none" />

            {/* Trailing Flight Legs */}
            <path d="M22 42 L11 48 L8 46" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M22 42 L13 54 L11 52" stroke={statusColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

            {/* Reaching Out Flying Arms */}
            <path d="M38 24 L52 20" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
            
            {/* Glowing circular Z-Shield on chest */}
            <circle cx="34" cy="31" r="9" fill="#1e293b" stroke="#ffffff" strokeWidth="1.5" className="shadow-lg" />
            {/* Bold energetic stylized Z Logo in center */}
            <path d="M30 27.5 H37.5 L30.5 34.5 H38" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          /* =========================================================================
             STANDING PARTNER SVG: Stately, solid ground stance, professional Z corporate badge!
             ========================================================================= */
          <svg width="46" height="46" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Circular ground aura/shadow beneath standing feet */}
            <ellipse cx="32" cy="58" rx="14" ry="4" fill="#000000" fillOpacity="0.25" />

            {/* Standing human torso / heavy duty specialist jumpsuit */}
            {/* Professional shoulder flare */}
            <path 
              d="M18 32 C18 24, 46 24, 46 32 L40 50 H24 Z" 
              fill={statusColor} 
              stroke="#ffffff" 
              strokeWidth="2" 
              strokeLinejoin="round" 
            />

            {/* Standing Legs with safety boots */}
            <line x1="26" y1="50" x2="25" y2="57" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
            <line x1="38" y1="50" x2="39" y2="57" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
            {/* Boots */}
            <path d="M22 57 H27" stroke="#111827" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M37 57 H42" stroke="#111827" strokeWidth="3.5" strokeLinecap="round" />

            {/* Stylized rounded helmet with reflecting safety glass */}
            <circle cx="32" cy="18" r="8" fill={statusColor} stroke="#ffffff" strokeWidth="2" />
            {/* Safety Visor */}
            <path d="M29 16 H35 C36 16, 36 21, 35 21 H29 C28 21, 28 16, 29 16 Z" fill="#1e293b" />
            <circle cx="31" cy="17" r="1" fill="#ffffff" /> {/* Visor glaze dot */}

            {/* Corporate Tool Belt / Utility Pack */}
            <rect x="23" y="47" width="18" height="4" rx="1" fill="#1f2937" stroke="white" strokeWidth="1" />
            
            {/* Huge bold metallic Z-Shield emblem flat on standing chest */}
            <circle cx="32" cy="34" r="9.5" fill="#111827" stroke="#ffffff" strokeWidth="1.8" className="shadow" />
            <path d="M28 30 H36 L28.5 38 H36.5" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* Structured Label Badge below the figure */}
      {name && (
        <div className="absolute top-11 bg-slate-900/95 border border-slate-700/80 text-white rounded-lg px-2 py-0.5 text-[8px] font-black tracking-tight shadow-md flex items-center gap-1 select-none pointer-events-none whitespace-nowrap opacity-90 transition-all duration-300">
          <span className="max-w-[70px] truncate">{name.split(' ')[0]}</span>
          {distanceText && <span className="text-yellow-400 font-extrabold text-[7.5px] border-l border-slate-700 pl-1">{distanceText}</span>}
          <div 
            className="w-1.5 h-1.5 rounded-full" 
            style={{ 
              backgroundColor: status === 'Available' ? '#10b981' : status === 'On Job' ? '#3b82f6' : '#f59e0b',
              boxShadow: `0 0 4px ${status === 'Available' ? '#10b981' : status === 'On Job' ? '#3b82f6' : '#f59e0b'}`
            }} 
          />
        </div>
      )}
    </div>
  );
}
