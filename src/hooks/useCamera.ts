import { useState, useEffect, useCallback, useRef } from 'react';

export type CameraPermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported';

export function useCamera() {
  const [permissionState, setPermissionState] = useState<CameraPermissionState>('prompt');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showBlockedModal, setShowBlockedModal] = useState<boolean>(false);
  const streamRef = useRef<MediaStream | null>(null);

  const queryPermission = useCallback(async (): Promise<CameraPermissionState> => {
    if (typeof window === 'undefined' || !navigator.permissions || !navigator.permissions.query) {
      return 'prompt';
    }
    try {
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
      const mapState = (state: string): CameraPermissionState => {
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
      console.warn("navigator.permissions.query failed or is unsupported for 'camera':", err);
      return 'prompt';
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      console.log("Stopping all active camera tracks...");
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log(`Stopped camera track: ${track.label}`);
      });
      streamRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  const startCamera = useCallback(async (customVideoConstraints?: MediaTrackConstraints): Promise<MediaStream> => {
    setError(null);
    stopCamera();

    const currentPerm = await queryPermission();
    if (currentPerm === 'denied') {
      setShowBlockedModal(true);
      const errMsg = "Camera access is blocked. Please unlock your device webcam/camera permissions from site settings.";
      setError(errMsg);
      throw new Error(errMsg);
    }

    if (typeof window === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const errMsg = "Camera recording is not available or unsupported on this device/browser.";
      setError(errMsg);
      throw new Error(errMsg);
    }

    try {
      console.log("Requesting camera stream...");
      const videoConstraints: MediaTrackConstraints = customVideoConstraints || {
        facingMode: 'environment', // standard back camera default
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false, // Do not record audio for camera feeds by default
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setPermissionState('granted');
      return mediaStream;
    } catch (err: any) {
      console.error("Camera getUserMedia failed with error:", err);
      
      let friendlyError = "Failed to launch the camera.";
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        friendlyError = "Camera access denied. Please click the camera icon in your navigation bar to authorize access.";
        setPermissionState('denied');
        setShowBlockedModal(true);
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        friendlyError = "Your webcam hardware is currently being used by another application or video call.";
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        friendlyError = "No camera hardware found on this system.";
      } else {
        friendlyError = `Could not activate camera: ${err.message || err}`;
      }

      setError(friendlyError);
      throw new Error(friendlyError);
    }
  }, [stopCamera, queryPermission]);

  useEffect(() => {
    queryPermission();
    return () => {
      // Automatic robust cleanup on component unmount to prevent resource locks:
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
    startCamera,
    stopCamera,
    refreshPermission: queryPermission,
  };
}
