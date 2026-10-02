/**
 * backgroundLocationService.ts
 *
 * Production-ready foreground service for Android that keeps
 * location tracking alive when the app is minimised.
 *
 * Features:
 * - Persistent notification: "Trip in progress" during active trips,
 *   "Stay online to receive ride requests" when idle
 * - Updates notification when trip state changes (start/end)
 * - Restarts with new tripId when a new trip begins
 * - Heartbeat to keep the service alive and re-send location
 * - Only emits from background (foreground handled by useLocationTracker)
 */
import BackgroundService from 'react-native-background-actions';
import Geolocation from 'react-native-geolocation-service';
import { AppState } from 'react-native';
import socketService from './socketService';

const BACKGROUND_INTERVAL_MS = 10_000; // 10 seconds

/** Track current service state to detect when updates are needed */
let currentServiceTripId: string | undefined;
let currentServiceDriverId: string | undefined;
let currentServiceMode: 'idle' | 'trip' = 'idle';

interface BackgroundLocationOptions {
  driverId: string;
  tripId?: string;
  highAccuracy?: boolean;
  distanceFilter?: number;
}

/**
 * The task that runs inside the foreground service.
 * Uses watchPosition so it only fires on movement.
 * Falls back to a heartbeat interval for idle drivers.
 */
const locationTask = async (params: {
  driverId: string;
  tripId?: string;
  highAccuracy: boolean;
  distanceFilter: number;
}) => {
  const {driverId, tripId, highAccuracy, distanceFilter} = params;

  let lastLat = 0;
  let lastLng = 0;
  let lastHeading = 0;

  // Start watching position
  const watchId = Geolocation.watchPosition(
    position => {
      const {latitude, longitude, heading} = position.coords;
      lastLat = latitude;
      lastLng = longitude;
      lastHeading = heading || 0;

      // Only emit from background service if app is NOT active
      if (AppState.currentState !== 'active') {
        socketService.emit('driver_location_update', {
          driverId,
          lat: latitude,
          lng: longitude,
        });

        if (tripId) {
          socketService.emitLocationUpdate(tripId, latitude, longitude, position.coords.heading || 0);
        }

        console.log(
          `📍 [BG] Location sent: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
        );
      }
    },
    error => {
      console.warn('📍 [BG] Location error:', error.message);
    },
    {
      enableHighAccuracy: highAccuracy,
      distanceFilter,
      interval: BACKGROUND_INTERVAL_MS,
      fastestInterval: 5000,
      showLocationDialog: false,
      forceRequestLocation: true,
    },
  );

  // Keep the task alive with a heartbeat
  // BackgroundService requires the task function to resolve only when done
  await new Promise<void>(resolve => {
    const heartbeat = setInterval(async () => {
      // Check if we should still be running
      if (!BackgroundService.isRunning()) {
        Geolocation.clearWatch(watchId);
        clearInterval(heartbeat);
        resolve();
        return;
      }

      // Re-send last known location as heartbeat (if no movement)
      if (lastLat !== 0 && lastLng !== 0 && AppState.currentState !== 'active') {
        socketService.emit('driver_location_update', {
          driverId,
          lat: lastLat,
          lng: lastLng,
        });
        if (tripId) {
          socketService.emitLocationUpdate(tripId, lastLat, lastLng, lastHeading);
        }
        console.log(`💓 [BG] Heartbeat sent (${highAccuracy ? 'Trip' : 'Idle'})`);
      }
    }, highAccuracy ? 20_000 : 30_000); // Dynamic heartbeat: 20s for active trip, 30s for idle
  });
};

/**
 * Notification options for the persistent Android notification.
 * Shows different text for idle vs active trip.
 */
const getNotificationConfig = (tripId?: string) => ({
  taskName: 'vDriveLocationTracking',
  taskTitle: tripId ? '🚗 Trip in Progress' : '🚀 Ready to Earn!',
  taskDesc: tripId
    ? 'Your trip is active. Location is being shared with the rider.'
    : 'Stay active and catch your next ride! 💸',
  taskIcon: {
    name: 'ic_launcher',
    type: 'mipmap',
  },
  color: tripId ? '#10B981' : '#6C63FF', // Green for trip, purple for idle
  linkingURI: 'vdrive://',
  foregroundServiceType: ['location'],
  parameters: {},
});

/**
 * Start the background location service.
 * Call this when the driver goes ONLINE or starts a trip.
 */
export const startBackgroundLocation = async (
  options: BackgroundLocationOptions,
) => {
  const isRunning = BackgroundService.isRunning();
  const tripChanged = currentServiceTripId !== options.tripId;
  const driverChanged = currentServiceDriverId !== options.driverId;
  const modeChanged = (options.tripId ? 'trip' : 'idle') !== currentServiceMode;

  // If already running with same params, skip
  if (isRunning && !tripChanged && !driverChanged && !modeChanged) {
    console.log('📍 [BG] Already running with same config, skipping');
    return;
  }

  // If running but params changed (e.g. new trip started), restart
  if (isRunning && (tripChanged || driverChanged || modeChanged)) {
    console.log(`📍 [BG] Config changed (trip: ${currentServiceTripId} → ${options.tripId}), restarting...`);
    try {
      await BackgroundService.stop();
    } catch (e) {
      console.warn('📍 [BG] Error stopping before restart:', e);
    }
  }

  socketService.connect();

  const config = getNotificationConfig(options.tripId);

  try {
    await BackgroundService.start(
      locationTask as unknown as any,
      {
        ...config,
        parameters: {
          driverId: options.driverId,
          tripId: options.tripId,
          highAccuracy: options.highAccuracy ?? true,
          distanceFilter: options.distanceFilter ?? (options.highAccuracy ? 10 : 20),
        },
      } as any
    );

    // Track current state
    currentServiceTripId = options.tripId;
    currentServiceDriverId = options.driverId;
    currentServiceMode = options.tripId ? 'trip' : 'idle';

    console.log(`✅ [BG] Background location service started (${currentServiceMode}, trip: ${options.tripId || 'none'})`);
  } catch (error) {
    console.error('❌ [BG] Failed to start background service:', error);
  }
};

/**
 * Update the foreground notification text without restarting the service.
 * Use this for quick notification updates (e.g. status change within same trip).
 */
export const updateBackgroundNotification = async (tripId?: string) => {
  if (!BackgroundService.isRunning()) return;

  try {
    const config = getNotificationConfig(tripId);
    await BackgroundService.updateNotification({
      taskTitle: config.taskTitle,
      taskDesc: config.taskDesc,
    });
    currentServiceTripId = tripId;
    currentServiceMode = tripId ? 'trip' : 'idle';
    console.log(`📝 [BG] Notification updated (${currentServiceMode})`);
  } catch (error) {
    console.warn('📍 [BG] Failed to update notification:', error);
  }
};

/**
 * Stop the background location service.
 * Call this when the driver goes OFFLINE or trip completes.
 */
export const stopBackgroundLocation = async () => {
  if (!BackgroundService.isRunning()) {
    return;
  }

  try {
    await BackgroundService.stop();
    currentServiceTripId = undefined;
    currentServiceDriverId = undefined;
    currentServiceMode = 'idle';
    console.log('🛑 [BG] Background location service stopped');
  } catch (error) {
    console.error('❌ [BG] Failed to stop background service:', error);
  }
};

/**
 * Check if the background service is currently running.
 */
export const isBackgroundLocationRunning = (): boolean => {
  return BackgroundService.isRunning();
};

/**
 * Get the current service state (for debugging).
 */
export const getBackgroundServiceState = () => ({
  isRunning: BackgroundService.isRunning(),
  tripId: currentServiceTripId,
  driverId: currentServiceDriverId,
  mode: currentServiceMode,
});
