/**
 * Firebase Cloud Messaging — Notification Service (Production-Ready)
 *
 * Handles:
 *  • Requesting notification permission (Android 13+)
 *  • Retrieving the device FCM token
 *  • Foreground notification display via Notifee
 *  • Background / Quit-state notification handling
 *  • Token refresh listener
 *  • Cold-start notification caching for useRideFeed recovery
 *  • Deduplication: No duplicate system notifications for ride events
 */

import {
    FirebaseMessagingTypes,
    getMessaging,
    getToken,
    onMessage,
    requestPermission,
    setBackgroundMessageHandler,
    onTokenRefresh as firebaseOnTokenRefresh,
    onNotificationOpenedApp,
    getInitialNotification,
    AuthorizationStatus,
} from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { globalEmitter, EVENTS } from '../utils/EventEmitter';

/* ================================================================
   CONSTANTS
   ================================================================ */

const CHANNEL_ID = 'ride_requests';
const GENERAL_CHANNEL_ID = 'general';

/** Notification types that represent ride-related events (handled by in-app UI) */
const RIDE_NOTIFICATION_TYPES = new Set([
    'RIDE_REQUEST',
    'NEW_RIDE_REQUEST',
    'ASSIGNED_RIDE',
    'TRIP_ASSIGNED',
]);

/** Notification types that represent trip cancellations */
const CANCELLATION_TYPES = new Set([
    'RIDER_CANCELLED',
    'TRIP_CANCELLED',
    'SCHEDULED_RIDE_CANCELLED',
    'CANCEL_RIDE',
    'MID_CANCELLED',
    'RIDE_CANCELLED',
    'BOOKING_CANCELLED',
]);

/* ================================================================
   COLD-START CACHE
   Stores the initial notification that launched the app so hooks
   can consume it even if they mount after the notification is read.
   ================================================================ */

let cachedInitialNotification: FirebaseMessagingTypes.RemoteMessage | null = null;

/**
 * 📦 Consume the cached initial notification (one-time read).
 * Used by useRideFeed to recover ride state after a cold start.
 */
export function consumeInitialNotification() {
    const msg = cachedInitialNotification;
    cachedInitialNotification = null;
    return msg;
}

/* ================================================================
   HELPERS
   ================================================================ */

/** Normalize the notification type to uppercase for consistent matching */
function getNotificationType(data?: Record<string, string>): string {
    return (data?.type || data?.status || '').toString().toUpperCase();
}

/** Check if a notification data represents a valid ride event (must have type AND tripId) */
function isValidRideNotification(data?: Record<string, string>): boolean {
    const type = getNotificationType(data);
    const hasType = RIDE_NOTIFICATION_TYPES.has(type) || type === 'ASSIGNED_RIDE';
    const hasId = !!(data?.trip_id || data?.id || data?.tripId || data?.bookingId);
    return hasType && hasId;
}

/* ================================================================
   CHANNEL — Android requires a notification channel (8.0+)
   ================================================================ */

async function ensureChannel(): Promise<string> {
    return await notifee.createChannel({
        id: CHANNEL_ID,
        name: 'Ride Requests',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
    });
}

/* ================================================================
   REQUEST PERMISSION
   ================================================================ */

export async function requestNotificationPermission(): Promise<boolean> {
    const authStatus = await requestPermission(getMessaging());

    const enabled =
        authStatus === AuthorizationStatus.AUTHORIZED ||
        authStatus === AuthorizationStatus.PROVISIONAL;

    if (enabled) {
        console.log('✅ Notification permission granted');
    } else {
        console.log('❌ Notification permission denied');
    }

    return enabled;
}

/* ================================================================
   GET FCM TOKEN
   ================================================================ */

export async function getFCMToken(): Promise<string | null> {
    try {
        const token = await getToken(getMessaging());
        if (__DEV__) {
            console.log('🔑 FCM TOKEN:', token);
            try {
                const { store } = require('../redux/store');
                console.log('--- DEBUG INFO ---');
                console.log('DRIVER ID:', store.getState().userSlice.user?.driverId);
                console.log('-----------------');
            } catch (_) { /* Redux not ready yet */ }
        }
        return token;
    } catch (error: any) {
        console.warn('⚠️ FCM token retrieval failed:', error?.message || error);
        return null;
    }
}

/* ================================================================
   FOREGROUND HANDLER — display notification when app is open
   ================================================================ */

export function setupForegroundHandler(): () => void {
    const unsubscribe = onMessage(
        getMessaging(),
        async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
            console.log('📩 Foreground message:', JSON.stringify(remoteMessage.data));

            const type = getNotificationType(remoteMessage.data as Record<string, string>);

            // 1. Handle cancellations — emit event for dashboard to react
            if (CANCELLATION_TYPES.has(type)) {
                try {
                    globalEmitter.emit(EVENTS.TRIP_CANCELLED, remoteMessage.data);
                } catch (err) {
                    console.error('❌ Failed to emit cancellation event:', err);
                }
                // Still show the cancellation notification in the tray
            }

            // 2. Skip system notification for ride/assigned events when app is OPEN
            //    The socket event already triggers the in-app card UI directly.
            if (isValidRideNotification(remoteMessage.data as Record<string, string>)) {
                console.log('📩 [Foreground] Valid ride notification handled in-app, skipping system tray.');
                return;
            }

            // For data-only messages, read title/body from data field
            const title = remoteMessage.notification?.title ?? (remoteMessage.data as any)?.title ?? 'New Notification';
            const body = remoteMessage.notification?.body ?? (remoteMessage.data as any)?.body ?? '';

            // 3. Display all other notifications in the system tray
            const { store } = require('../redux/store');
            const isVibrationEnabled = store.getState()?.userSlice?.user?.isVibrationEnabled ?? true;
            const channelId = await ensureChannel();

            await notifee.displayNotification({
                id: (remoteMessage.data?.trip_id || remoteMessage.data?.id || remoteMessage.data?.tripId || Date.now()).toString(),
                title,
                body,
                android: {
                    channelId,
                    importance: AndroidImportance.HIGH,
                    smallIcon: 'ic_launcher',
                    pressAction: { id: 'default' },
                    sound: 'default',
                    vibrationPattern: isVibrationEnabled ? [300, 500] : [],
                },
                ios: {
                    foregroundPresentationOptions: {
                        badge: true,
                        sound: true,
                        banner: true,
                    },
                    sound: 'default',
                },
                data: remoteMessage.data,
            });
        },
    );

    return unsubscribe;
}

/* ================================================================
   BACKGROUND / QUIT-STATE HANDLER
   Must be registered at index.js (top-level)
   ================================================================ */

/** Notification types that represent DIRECT ride assignments (must show in background) */
const ASSIGNMENT_TYPES = new Set([
    'ASSIGNED_RIDE',
    'RIDE_ASSIGNED',
    'TRIP_ASSIGNED',
]);

export function setupBackgroundHandler(): void {
    setBackgroundMessageHandler(getMessaging(), async remoteMessage => {
        console.log('📩 Background message:', JSON.stringify(remoteMessage.data));

        const type = getNotificationType(remoteMessage.data as Record<string, string>);

        // 🛡️ For BROADCAST ride requests (NEW_RIDE_REQUEST), skip system notification.
        // These expire in ~15 seconds and the socket/AppState resume will handle them.
        // But for DIRECT ASSIGNMENTS (ASSIGNED_RIDE/TRIP_ASSIGNED), we MUST show
        // a notification because socket is disconnected in background/killed state
        // and the driver needs to be alerted immediately.
        if (isValidRideNotification(remoteMessage.data as Record<string, string>)) {
            if (!ASSIGNMENT_TYPES.has(type)) {
                console.log('📩 [Background] Broadcast ride notification — skipping system tray.');
                return;
            }
            console.log('📩 [Background] Direct ride ASSIGNMENT — showing system notification.');
        }

        const channelId = await ensureChannel();

        // For data-only messages, read title/body from data field
        const title = String(remoteMessage.notification?.title ?? remoteMessage.data?.title ?? 'New Notification');
        const body = String(remoteMessage.notification?.body ?? remoteMessage.data?.body ?? '');

        await notifee.displayNotification({
            id: String(remoteMessage.data?.trip_id || remoteMessage.data?.id || remoteMessage.data?.tripId || Date.now()),
            title,
            body,
            android: {
                channelId,
                importance: AndroidImportance.HIGH,
                smallIcon: 'ic_launcher',
                pressAction: { id: 'default' },
                sound: 'default',
            },
            ios: {
                sound: 'default',
            },
            data: remoteMessage.data,
        });
    });
}

/* ================================================================
   TOKEN REFRESH LISTENER
   ================================================================ */

export function onTokenRefresh(
    callback: (token: string) => void,
): () => void {
    return firebaseOnTokenRefresh(getMessaging(), callback);
}

/* ================================================================
   NOTIFICATION OPENED HANDLER (Foregrounding App on Tap)
   
   Two scenarios:
   1. Background → user taps notification → app comes to foreground
   2. Quit state → user taps notification → app cold-starts
   ================================================================ */

// 2. App was completely killed, user taps notification
// Capture this as early as possible (at file load) to avoid missing it due to race conditions
getInitialNotification(getMessaging())
    .then(remoteMessage => {
        if (!remoteMessage) return;

        console.log('✅ [Quit→Launch] Early capture of initial notification:', JSON.stringify(remoteMessage.data));
        
        // Cache for hooks like useRideFeed
        cachedInitialNotification = remoteMessage;

        const type = getNotificationType(remoteMessage.data as Record<string, string>);

        // Emit after a short delay to ensure app navigation and listeners are ready
        if (isValidRideNotification(remoteMessage.data as Record<string, string>) || type === 'PLAN_EXPIRY_REMINDER' || type === 'SCHEDULED_REMINDER') {
            setTimeout(() => {
                // 🛡️ Prevent duplicate processing: Only emit if it hasn't been consumed directly by a hook
                if (cachedInitialNotification) {
                    globalEmitter.emit(EVENTS.NOTIFICATION_OPENED, remoteMessage?.data);
                    cachedInitialNotification = null; // Clear after emitting
                } else {
                    console.log('✅ [Quit→Launch] Initial notification already consumed, skipping delayed emit.');
                }
            }, 1500);
        }
    })
    .catch(err => console.warn('[notificationService] Early capture error:', err));

export function setupNotificationOpenedHandler(
    navigate: (screen: string, params?: any) => void,
) {
    const handleNotificationAction = (data: any) => {
        const type = getNotificationType(data as Record<string, string>);
        console.log('🔔 Handling notification action for type:', type);

        if (isValidRideNotification(data as Record<string, string>)) {
            // Emit so useRideFeed can verify the trip and show the card
            globalEmitter.emit(EVENTS.NOTIFICATION_OPENED, data);
        } else if (type === 'SCHEDULED_REMINDER') {
            navigate('ScheduledRides');
        } else if (type === 'PLAN_EXPIRY_REMINDER') {
            navigate('RechargePlanScreen');
        } else if (type === 'SUPPORT_REPLY') {
            navigate('HelpCenter_Nav', { openChat: true });
        }
    };

    // 1. App is running in background, user taps notification
    const unsubscribeFCM = onNotificationOpenedApp(getMessaging(), remoteMessage => {
        console.log('✅ [Background→Foreground] Notification opened:', JSON.stringify(remoteMessage.data));
        handleNotificationAction(remoteMessage.data);
    });

    // 2. App was cold-started (getInitialNotification emitted this via globalEmitter)
    const unsubscribeEmitter = globalEmitter.on(EVENTS.NOTIFICATION_OPENED, (data) => {
        const type = getNotificationType(data as Record<string, string>);
        // Only handle non-ride notifications here to avoid conflict with useRideFeed
        if (type === 'PLAN_EXPIRY_REMINDER' || type === 'SCHEDULED_REMINDER') {
            console.log('✅ [Emitter] Handling cold-start navigation for:', type);
            handleNotificationAction(data);
        }
    });

    return () => {
        unsubscribeFCM();
        unsubscribeEmitter();
    };
}
