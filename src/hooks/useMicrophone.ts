import { useState, useEffect, useCallback, useRef } from 'react';

export type MicPermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported';

export function useMicrophone() {
  const [permissionState, setPermissionState] = useState<MicPermissionState>('prompt');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showBlockedModal, setShowBlockedModal] = useState<boolean>(false);
  const streamRef = useRef<MediaStream | null>(null);

  const queryPermission = useCallback(async (): Promise<MicPermissionState> => {
    if (typeof window === 'undefined' || !navigator.permissions || !navigator.permissions.query) {
      return 'prompt';
    }
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      const mapState = (state: string): MicPermissionState => {
        if (state === 'granted') return 'granted';
        if (state === 'denied') return 'denied';
        return 'prompt';
      };
      setPermissionState(mapState(result.state));
      result.onchange = () => {
        setPermissionState(mapState(result.state));
      };
      return mapState(result.state);
    } catch (err) {
      console.warn("navigator.permissions.query failed or is unsupported for 'microphone':", err);
      return 'prompt';
    }
  }, []);

  const stopMicrophone = useCallback(() => {
    if (streamRef.current) {
      console.log("Stopping active microphone tracks...");
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log(`Stopped audio track: ${track.label}`);
      });
      streamRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  const startMicrophone = useCallback(async (): Promise<MediaStream> => {
    setError(null);
    stopMicrophone();

    const currentPerm = await queryPermission();
    if (currentPerm === 'denied') {
      setShowBlockedModal(true);
      const errMsg = "Microphone access is blocked. Please unlock your device microphone settings manually from site settings.";
      setError(errMsg);
      throw new Error(errMsg);
    }

    if (typeof window === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const errMsg = "Microphone input is not available or unsupported on this device/browser.";
      setError(errMsg);
      throw new Error(errMsg);
    }

    try {
      console.log("Requesting microphone stream...");
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      streamRef.current = audioStream;
      setStream(audioStream);
      setPermissionState('granted');
      return audioStream;
    } catch (err: any) {
      console.error("Microphone getUserMedia failed with error:", err);
      
      let friendlyError = "Failed to launch the microphone.";
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        friendlyError = "Microphone access denied. Please click the microphone icon in your navigation bar to authorize access.";
        setPermissionState('denied');
        setShowBlockedModal(true);
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        friendlyError = "Your microphone hardware is currently locked or in-use by another application/tab.";
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        friendlyError = "No audio input hardware found on this system.";
      } else {
        friendlyError = `Could not activate microphone: ${err.message || err}`;
      }

      setError(friendlyError);
      throw new Error(friendlyError);
    }
  }, [stopMicrophone, queryPermission]);

  useEffect(() => {
    queryPermission();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [queryPermission]);

  return {
    permissionState,
    stream,
    error,
    showBlockedModal,
    setShowBlockedModal,
    startMicrophone,
    stopMicrophone,
    refreshPermission: queryPermission,
  };
}
