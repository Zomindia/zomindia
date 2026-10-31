/**
 * Zomindia Local Audio Alert Engine
 * High-fidelity synthesized Web Audio API & cached WAV buffer fallback service.
 * Runs asynchronously without blocking the main UI thread.
 */

type SoundKey = 'order_success' | 'partner_alert' | 'notification_pop';

let sharedAudioContext: AudioContext | null = null;
const cachedAudioBuffers = new Map<SoundKey, AudioBuffer>();
const cachedWavDataUris = new Map<SoundKey, string>();
let activePartnerRepeatTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Lazily initializes or resumes the shared Web Audio API context.
 */
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!sharedAudioContext) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        sharedAudioContext = new AudioCtx();
      }
    }
    if (sharedAudioContext && sharedAudioContext.state === 'suspended') {
      sharedAudioContext.resume().catch(() => {});
    }
    return sharedAudioContext;
  } catch {
    return null;
  }
}

/**
 * Encodes a mono Float32 PCM array into a base64 data:audio/wav URI for HTMLAudioElement fallback.
 */
function encodeWavDataUri(samples: Float32Array, sampleRate: number): string {
  const numChannels = 1;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true);  // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // 16-bit
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

/**
 * Generates raw PCM samples for each sound profile so both AudioBuffer and HTMLAudioElement
 * share the exact same studio-grade synthesized waveform.
 */
function synthesizeSamples(key: SoundKey, sampleRate: number): Float32Array {
  if (key === 'order_success') {
    // Harmonious dual-tone celebration chime (C5 -> E5 -> G5 -> C6 warm major chord arpeggio)
    const duration = 0.85;
    const totalSamples = Math.floor(sampleRate * duration);
    const data = new Float32Array(totalSamples);
    const notes = [
      { freq: 523.25, subFreq: 1046.5, start: 0.0, length: 0.32, gain: 0.28 },   // C5 + C6 shimmer
      { freq: 659.25, subFreq: 1318.5, start: 0.11, length: 0.34, gain: 0.30 },  // E5 + E6 shimmer
      { freq: 783.99, subFreq: 1567.98, start: 0.22, length: 0.38, gain: 0.32 }, // G5 + G6 shimmer
      { freq: 1046.5, subFreq: 523.25, start: 0.34, length: 0.50, gain: 0.38 },  // C6 + C5 warm root
    ];

    for (const note of notes) {
      const startIdx = Math.floor(note.start * sampleRate);
      const lenSamples = Math.floor(note.length * sampleRate);
      for (let i = 0; i < lenSamples && startIdx + i < totalSamples; i++) {
        const t = i / sampleRate;
        const attack = Math.min(1, t / 0.012);
        const decay = Math.exp(-5.5 * (t / note.length));
        const env = attack * decay * note.gain;
        const fundamental = Math.sin(2 * Math.PI * note.freq * t);
        const harmonic = 0.35 * Math.sin(2 * Math.PI * note.subFreq * t);
        data[startIdx + i] += (fundamental + harmonic) * env;
      }
    }
    return data;
  }

  if (key === 'partner_alert') {
    // High-frequency alternating alert siren for partner order arrival (880Hz <-> 1174.66Hz)
    const duration = 1.1;
    const totalSamples = Math.floor(sampleRate * duration);
    const data = new Float32Array(totalSamples);
    const pulses = [
      { freq: 880.0, start: 0.0, length: 0.22 },
      { freq: 1174.66, start: 0.24, length: 0.22 },
      { freq: 880.0, start: 0.50, length: 0.22 },
      { freq: 1318.51, start: 0.74, length: 0.32 },
    ];

    for (const pulse of pulses) {
      const startIdx = Math.floor(pulse.start * sampleRate);
      const lenSamples = Math.floor(pulse.length * sampleRate);
      for (let i = 0; i < lenSamples && startIdx + i < totalSamples; i++) {
        const t = i / sampleRate;
        const attack = Math.min(1, t / 0.008);
        const release = Math.min(1, (pulse.length - t) / 0.025);
        const env = attack * release * 0.42;
        const wave =
          0.7 * Math.sin(2 * Math.PI * pulse.freq * t) +
          0.3 * Math.sin(2 * Math.PI * (pulse.freq * 1.5) * t);
        data[startIdx + i] += wave * env;
      }
    }
    return data;
  }

  // 'notification_pop': Subtle tactile feedback click/pop for UI chips and tabs
  const duration = 0.075;
  const totalSamples = Math.floor(sampleRate * duration);
  const data = new Float32Array(totalSamples);
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    // Pitch sweep from 620Hz up to 960Hz for a crisp, pleasant pop
    const instantFreq = 620 + (340 * (t / duration));
    const attack = Math.min(1, t / 0.004);
    const decay = Math.exp(-38 * t);
    data[i] = Math.sin(2 * Math.PI * instantFreq * t) * attack * decay * 0.28;
  }
  return data;
}

/**
 * Plays a cached sound buffer asynchronously off the critical UI path.
 */
function playCachedSound(key: SoundKey): void {
  if (typeof window === 'undefined') return;

  // Schedule on microtask queue so UI interactions never stutter
  Promise.resolve().then(() => {
    try {
      const ctx = getAudioContext();
      if (ctx) {
        let buffer = cachedAudioBuffers.get(key);
        if (!buffer) {
          const sampleRate = ctx.sampleRate || 44100;
          const samples = synthesizeSamples(key, sampleRate);
          buffer = ctx.createBuffer(1, samples.length, sampleRate);
          buffer.getChannelData(0).set(samples);
          cachedAudioBuffers.set(key, buffer);
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gainNode = ctx.createGain();
        gainNode.gain.value = 1.0;
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        source.start(0);
        return;
      }
    } catch {
      // Fallback to HTMLAudioElement below if Web Audio API is restricted
    }

    try {
      let dataUri = cachedWavDataUris.get(key);
      if (!dataUri) {
        const samples = synthesizeSamples(key, 22050);
        dataUri = encodeWavDataUri(samples, 22050);
        cachedWavDataUris.set(key, dataUri);
      }
      const audio = new Audio(dataUri);
      audio.volume = key === 'notification_pop' ? 0.35 : 0.75;
      audio.play().catch(() => {});
    } catch {
      // Silent fail if autoplay policy blocks audio prior to user gesture
    }
  });
}

/**
 * Harmonious dual-tone celebration chime for customer booking completion.
 */
export function playOrderSuccessSound(): void {
  playCachedSound('order_success');
}

/**
 * High-frequency alternating alert siren for partner order arrival.
 * Supports optional repeating mode for incoming active orders.
 */
export function playPartnerBookingAlert(options?: {
  repeat?: boolean;
  maxRepeats?: number;
  intervalMs?: number;
}): void {
  stopPartnerBookingAlert();
  playCachedSound('partner_alert');

  if (options?.repeat) {
    const maxRepeats = options.maxRepeats ?? 3;
    const intervalMs = options.intervalMs ?? 2400;
    let count = 1;

    activePartnerRepeatTimer = setInterval(() => {
      if (count >= maxRepeats) {
        stopPartnerBookingAlert();
        return;
      }
      count += 1;
      playCachedSound('partner_alert');
    }, intervalMs);
  }
}

/**
 * Stops any repeating partner booking alert siren.
 */
export function stopPartnerBookingAlert(): void {
  if (activePartnerRepeatTimer) {
    clearInterval(activePartnerRepeatTimer);
    activePartnerRepeatTimer = null;
  }
}

/**
 * Subtle tactile feedback click/pop for UI chips and tabs.
 */
export function playNotificationPop(): void {
  playCachedSound('notification_pop');
}
