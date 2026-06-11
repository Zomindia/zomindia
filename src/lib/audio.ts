/**
 * Utility to play a beautiful, synthesized success chime using the Web Audio API.
 * This is perfect, highly responsive, doesn't require any network loading, and works offline.
 */
export function playSuccessChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    const now = ctx.currentTime;
    
    // Play a beautiful 3-note ascending chime
    const playNote = (freq: number, start: number, duration: number, type: OscillatorType = 'sine') => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      
      // Envelope
      gainNode.gain.setValueAtTime(0, start);
      // Soft fast attack (0.04s) to avoid pops, full volume quickly
      gainNode.gain.linearRampToValueAtTime(0.3, start + 0.04);
      // Long beautiful decay/release
      gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start(start);
      osc.stop(start + duration);
    };

    // Ascending chime: E5 (659.25Hz) -> A5 (880.00Hz) -> C#6 (1109.73Hz)
    playNote(659.25, now, 0.4); 
    playNote(880.00, now + 0.08, 0.4); 
    playNote(1109.73, now + 0.16, 0.6); 
  } catch (error) {
    console.error('Audio chime failed to play:', error);
  }
}
