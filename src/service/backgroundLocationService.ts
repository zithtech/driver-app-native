/**
 * backgroundLocationService.ts
 *
 * Wraps react-native-background-actions to run a persistent foreground
 * service on Android. This keeps location tracking alive even when the
 * driver minimises the app.
 *
 * On Android, a persistent notification is shown:
 *   "vDrive is tracking your location"
 */
import BackgroundService from 'react-native-background-actions';
import Geolocation from 'react-native-geolocation-service';
import { AppState } from 'react-native';
import socketService from './socketService';

const BACKGROUND_INTERVAL_MS = 10_000; // 10 seconds

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
        console.log(`💓 [BG] Heartbeat sent (${highAccuracy ? 'Moving' : 'Idle'})`);
      }
    }, highAccuracy ? 20_000 : 30_000); // Dynamic heartbeat: 20s for active trip, 30s for idle
  });
};

/**
 * Notification options for the persistent Android notification.
 */
const getNotificationConfig = () => ({
  taskName: 'vDriveLocationTracking',
  taskTitle: 'vDrive Online',
  taskDesc: 'Stay online to receive ride requests',
  taskIcon: {
    name: 'ic_launcher',
    type: 'mipmap',
  },
  color: '#6C63FF',
  linkingURI: 'vdrive://',
  foregroundServiceType: ['location'],
  parameters: {},
});

/**
 * Start the background location service.
 * Call this when the driver goes ONLINE.
 */
export const startBackgroundLocation = async (
  options: BackgroundLocationOptions,
) => {
  if (BackgroundService.isRunning()) {
    console.log('📍 [BG] Already running, skipping start');
    return;
  }

  socketService.connect();

  const config = getNotificationConfig();

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
    console.log('✅ [BG] Background location service started');
  } catch (error) {
    console.error('❌ [BG] Failed to start background service:', error);
  }
};

/**
 * Stop the background location service.
 * Call this when the driver goes OFFLINE.
 */
export const stopBackgroundLocation = async () => {
  if (!BackgroundService.isRunning()) {
    return;
  }

  try {
    await BackgroundService.stop();
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
