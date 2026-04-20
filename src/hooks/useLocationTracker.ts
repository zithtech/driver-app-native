/**
 * useLocationTracker – Battery-optimized driver location tracking
 * with background service support.
 *
 * - Uses `watchPosition` with distanceFilter (foreground)
 * - Starts a persistent foreground service (background) via
 *   react-native-background-actions so tracking continues when
 *   the app is minimised
 * - Detects GPS disabled and fires error callbacks
 * - 30s heartbeat for idle drivers
 */
import {useEffect, useRef, useCallback, useState} from 'react';
import {AppState, AppStateStatus, Linking, Platform} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import socketService from '../service/socketService';
import {requestLocationPermission} from '../service/utils/permission';
import {
  startBackgroundLocation,
  stopBackgroundLocation,
  isBackgroundLocationRunning,
} from '../service/backgroundLocationService';

/** Active Trip: 10m / 20s | Idle: 20m / 30s */
const TRACKING_CONFIG = {
  moving: { distance: 10, heartbeat: 20_000 },
  idle: { distance: 20, heartbeat: 30_000 },
  stationary: { distance: 20, heartbeat: 30_000 },
};
/** Alert the UI after this many consecutive failures */
const MAX_CONSECUTIVE_FAILURES = 3;

interface UseLocationTrackerProps {
  /** Driver UUID from Redux */
  driverId: string | undefined;
  /** true when driver is ONLINE / ON_TRIP */
  isTracking: boolean;
  /** 'moving' = high accuracy + 20m filter, 'idle' = low accuracy + 50m filter */
  mode?: 'moving' | 'idle';
  /** Optional: UUID of active trip for real-time progress */
  tripId?: string;
  /** If true, the internal watchPosition will NOT emit. Use this when the UI screen handles its own 'snapped' emission. */
  suppressEmission?: boolean;
  /** Called when location becomes unavailable (GPS off / permission denied) */
  onLocationError?: (error: string) => void;
  /** Called when location is recovered after an error */
  onLocationRecovered?: () => void;
}

export const useLocationTracker = ({
  driverId,
  isTracking,
  tripId,
  suppressEmission = false,
  mode = 'moving',
  onLocationError,
  onLocationRecovered,
}: UseLocationTrackerProps) => {
  const watchIdRef = useRef<number | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMounted = useRef(true);
  const consecutiveFailures = useRef(0);
  const hasReportedError = useRef(false);
  const lastSentAt = useRef<number>(0);
  const lastLocation = useRef<{lat: number; lng: number} | null>(null);
  const [locationDisabled, setLocationDisabled] = useState(false);

  // Emit location to backend via socket
  const emitLocation = useCallback(
    (lat: number, lng: number, heading: number = 0) => {
      if (!driverId || !isMounted.current) {
        return;
      }

      // 1️⃣ Always emit general driver location (heartbeat / online status)
      // Even if suppressEmission is true, we need this for the backend "location check"
      socketService.emit('driver_location_update', {
        driverId,
        lat,
        lng,
      });

      // 2️⃣ Emit trip-specific location (only if not suppressed by screen)
      if (!suppressEmission) {
        // 🏎️ If on an active trip, also emit trip-specific location
        if (tripId) {
          socketService.emitLocationUpdate(tripId, lat, lng, heading);
        }
      }

      lastSentAt.current = Date.now();
      lastLocation.current = {lat, lng};

      // Reset failure counter on success
      if (consecutiveFailures.current > 0) {
        consecutiveFailures.current = 0;
        if (hasReportedError.current) {
          hasReportedError.current = false;
          setLocationDisabled(false);
          onLocationRecovered?.();
        }
      }

      console.log(`📍 Location sent: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    },
    [driverId, onLocationRecovered],
  );

  // Handle location errors
  const handleLocationError = useCallback(
    (error: Geolocation.GeoError) => {
      consecutiveFailures.current += 1;
      console.warn(
        `📍 Location failed (${consecutiveFailures.current}/${MAX_CONSECUTIVE_FAILURES}):`,
        error.message,
      );

      if (
        consecutiveFailures.current >= MAX_CONSECUTIVE_FAILURES &&
        !hasReportedError.current
      ) {
        hasReportedError.current = true;
        setLocationDisabled(true);

        const errorMsg =
          error.code === 1
            ? 'Location permission denied. Please enable it in Settings.'
            : error.code === 2
            ? 'Location services are turned off. Please enable GPS.'
            : 'Unable to get your location. Please check GPS settings.';

        onLocationError?.(errorMsg);
      }
    },
    [onLocationError],
  );

  const permissionRequested = useRef(false);

  // Stop all foreground tracking
  const stopForegroundTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  // Monitor app state:
  // - When app goes to background → start background service
  // - When app comes to foreground → stop background service, resume foreground
  useEffect(() => {
    if (!isTracking || !driverId) {
      return;
    }

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App going to background — start the foreground service
        if (!isBackgroundLocationRunning()) {
          const config = TRACKING_CONFIG[mode] || TRACKING_CONFIG.idle;
          startBackgroundLocation({
            driverId,
            tripId,
            highAccuracy: mode === 'moving',
            distanceFilter: config.distance,
          });
        }
        // Stop foreground watcher (background service handles it now)
        stopForegroundTracking();
      } else if (nextAppState === 'active') {
        // App back to foreground — stop background service, resume foreground
        stopBackgroundLocation();

        // If there was an error, re-check
        if (hasReportedError.current) {
          consecutiveFailures.current = 0;
          Geolocation.getCurrentPosition(
            pos => emitLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.heading || 0),
            () => {},
            {enableHighAccuracy: false, timeout: 5000, maximumAge: 0},
          );
        }

        // Restart foreground watcher
        startForegroundWatcher();
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    return () => subscription.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTracking, driverId, tripId, mode]);

  // Start foreground location watcher
  const startForegroundWatcher = useCallback(() => {
    const config = TRACKING_CONFIG[mode] || TRACKING_CONFIG.idle;
    const isHighAccuracy = mode === 'moving';
    const distanceFilter = config.distance;

    // Clear any existing watcher
    stopForegroundTracking();

    // 1️⃣ Send initial location immediately
    Geolocation.getCurrentPosition(
      pos => emitLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.heading || 0),
      err => handleLocationError(err),
      {
        enableHighAccuracy: isHighAccuracy,
        timeout: 8000,
        maximumAge: 5000,
        showLocationDialog: true,
        forceRequestLocation: true,
      },
    );

    // 2️⃣ Watch for movement
    watchIdRef.current = Geolocation.watchPosition(
      pos => emitLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.heading || 0),
      err => handleLocationError(err),
      {
        enableHighAccuracy: isHighAccuracy,
        distanceFilter: (TRACKING_CONFIG[mode] || TRACKING_CONFIG.idle).distance,
        interval: 10000,
        fastestInterval: 5000,
        showLocationDialog: true,
        forceRequestLocation: true,
      },
    );

    // 3️⃣ Heartbeat for idle drivers
    heartbeatRef.current = setInterval(() => {
      const config = TRACKING_CONFIG[mode] || TRACKING_CONFIG.idle;
      const timeSinceLastSend = Date.now() - lastSentAt.current;
      if (timeSinceLastSend >= config.heartbeat && lastLocation.current) {
        emitLocation(lastLocation.current.lat, lastLocation.current.lng);
        console.log(`💓 Heartbeat (${mode}): re-sent last known location`);
      }
    }, 5000); // Check every 5s
  }, [mode, emitLocation, handleLocationError, stopForegroundTracking]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Main tracking lifecycle
  useEffect(() => {
    if (!isTracking || !driverId) {
      stopForegroundTracking();
      stopBackgroundLocation();
      consecutiveFailures.current = 0;
      hasReportedError.current = false;
      setLocationDisabled(false);
      return;
    }

    // Ensure socket is connected
    socketService.connect();

    requestLocationPermission().then(granted => {
      if (!isMounted.current) {
        return;
      }

      if (!granted) {
        setLocationDisabled(true);
        onLocationError?.(
          'Location permission denied. Please enable it in Settings to continue.',
        );
        return;
      }
      
      permissionRequested.current = true;

      // Only start foreground tracking if app is in foreground
      if (AppState.currentState === 'active') {
        startForegroundWatcher();
      } else {
        // App is already in background (e.g., notification launched tracking)
        const config = TRACKING_CONFIG[mode] || TRACKING_CONFIG.idle;
        startBackgroundLocation({
          driverId,
          tripId,
          highAccuracy: mode === 'moving',
          distanceFilter: config.distance,
        });
      }
    });

    return () => {
      stopForegroundTracking();
      // Note: we do NOT stop background service on unmount
      // because user might navigate between screens while tracking.
      // Background service is stopped explicitly when driver goes offline.
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTracking, driverId, tripId, mode]);

  /** Helper to open device location settings */
  const openLocationSettings = useCallback(() => {
    if (Platform.OS === 'android') {
      Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(
        () => Linking.openSettings(),
      );
    } else {
      Linking.openURL('app-settings:');
    }
  }, []);

  return {locationDisabled, openLocationSettings};
};
