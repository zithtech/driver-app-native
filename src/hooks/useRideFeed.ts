import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import socketService from '../service/socketService';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { TripStatus } from '../types/trip';
import { useLazyGetTripByIdQuery, useLazyGetIncomingTripsQuery } from '../service/driverApi';
import { useAlert } from '../context/AlertContext';
import { useTranslation } from 'react-i18next';
import { globalEmitter, EVENTS } from '../utils/EventEmitter';
import { useNavigation } from '@react-navigation/native';
import { ScheduledRides_Nav } from '../Navigations/navigations';



export type RideItem = {
    id: string;
    trip_id: string;
    trip_code?: string;
    pickup: string;
    drop: string;
    price: string;
    remaining: number;
    distance?: string;
    eta?: string;
    ride_type?: string;
    notes?: string;
    passenger?: string;
    rating?: number;
    phone?: string;
    booking_type?: 'LIVE' | 'SCHEDULED';
    scheduled_start_time?: string;
    trip_status?: TripStatus | string;
    otp?: string;
    pickupLat?: number;
    pickupLng?: number;
    dropLat?: number;
    dropLng?: number;
    tripType?: string;
    paymentMethod?: string;
    noVibrate?: boolean;
    isAssigned?: boolean;
    [key: string]: any;
};

interface UseRideFeedProps {
    isOnline: boolean;
    showConfirmModal: boolean;
    acceptedRide: RideItem | null;
}

export const useRideFeed = ({ isOnline, showConfirmModal, acceptedRide }: UseRideFeedProps) => {
    const [rideQueue, setRideQueue] = useState<RideItem[]>([]);
    const user = useSelector((state:RootState ) => state.userSlice?.user);
    const currentRide = useSelector((state: RootState) => state.ride?.currentRide);
    const [triggerGetTrip] = useLazyGetTripByIdQuery();
    const { showAlert } = useAlert();
    const { t } = useTranslation();
    const [triggerGetIncoming] = useLazyGetIncomingTripsQuery();
    const navigation = useNavigation<any>();
    const appStateRef = useRef(AppState.currentState);

    const isBlockingLiveRequests = useMemo(() => {
        if (!currentRide || currentRide.booking_type !== 'SCHEDULED') return false;
        
        const startTime = new Date(currentRide.scheduled_start_time).getTime();
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        
        // Block if we are within the "active window" (24 hours before until trip finishes)
        const diff = startTime - now;
        return diff <= oneDay && diff > -3600000; // Block from 24h before until 1h after start
    }, [currentRide]);
    
    const handleIncomingRide = useCallback((raw: any) => {
        // Standardize: backend might send nested trip/data object
        const data = raw.trip || raw.data || raw;
        const rawType = (raw.type || data.type || "").toString().toUpperCase();
        
        // Log standardized structure
        console.log('🚨 [useRideFeed] Incoming Ride standardized:', JSON.stringify(data, null, 2));

        const tripId = String(data?.trip_id || data?.tripId || data?.bookingId || data?.id || "");
        if (!tripId) {
            console.warn('Ignoring ride request with no valid ID');
            return;
        }
        
        const standardizedStatus = (data?.trip_status || data?.status || "").toString().toUpperCase();
        
        // Rides assigned directly by admin, waiting for driver to accept
        const isAssigned = 
            rawType === 'ASSIGNED_RIDE' || 
            rawType === 'TRIP_ASSIGNED' || 
            rawType === 'ASSIGNED' ||
            standardizedStatus === 'ASSIGNED';
            
        // Rides the driver has already accepted
        const isAcceptedOrActive = 
            standardizedStatus === 'ACCEPTED' ||
            standardizedStatus === 'ARRIVING';

        const isDirectAssignment = isAssigned || isAcceptedOrActive;

        // 🕒 [Time Sync] Calculate true remaining time
        let calculatedRemaining = isDirectAssignment ? 99999 : 20;
        if (!isDirectAssignment && data?.createdAt) {
            const createdAt = new Date(data.createdAt).getTime();
            const now = Date.now();
            const elapsed = Math.floor((now - createdAt) / 1000);
            calculatedRemaining = Math.min(20, Math.max(0, 20 - elapsed));
            
            console.log(`[useRideFeed] Timer Sync: CreatedAt: ${data.createdAt}, Now: ${new Date().toISOString()}, Elapsed: ${elapsed}s, Calculated: ${calculatedRemaining}s`);
            
            if (calculatedRemaining <= 0) {
                console.log(`[useRideFeed] Ride ${tripId} already expired (elapsed: ${elapsed}s), skipping.`);
                return;
            }
        }

        const isCancelledOrCompleted = ['CANCELLED', 'CANCEL', 'COMPLETED', 'REJECTED', 'DELETED'].includes(standardizedStatus);
        
        if (isCancelledOrCompleted) {
            console.log(`[useRideFeed] Ride ${tripId} is cancelled/completed/deleted (Status: ${standardizedStatus}), removing from queue.`);
            setRideQueue(prev => prev.filter(r => String(r.id) !== String(tripId) && String(r.trip_id) !== String(tripId)));
            return;
        }

        const newRide: RideItem = {
            ...data,
            id: tripId,
            trip_id: tripId,
            trip_code: data?.trip_code || data?.booking_code,
            pickup: data?.pickup_address || data?.pickup || 'Pickup Location',
            drop: data?.drop_address || data?.drop || 'Drop Location',
            price: data?.fare ? `₹${data.fare}` : data?.total_fare ? `₹${data.total_fare}` : '₹--',
            noVibrate: raw?.noVibrate === true || data?.noVibrate === true || data?.noVibrate === 'true',
            remaining: calculatedRemaining,
            distance: data?.distance_km 
                ? (data.distance_km.toString().includes('km') ? data.distance_km : `${data.distance_km} km`)
                : data?.distanceToUser ? (data.distanceToUser > 1000 ? `${(data.distanceToUser/1000).toFixed(1)} km` : `${data.distanceToUser} m`) : '--',
            eta: data?.trip_duration_minutes 
                ? (data.trip_duration_minutes.toString().includes('min') ? data.trip_duration_minutes : `${data.trip_duration_minutes} min`)
                : data?.eta ? (data.eta.toString().includes('min') ? data.eta : `${data.eta} min`) : '--',
            passenger: data?.user_details?.full_name || data?.user_details?.first_name || data?.passenger_details?.name || data?.passenger || data?.passengerName || data?.passenger_name || data?.customer?.name || 'Passenger',
            rating: data?.rating ? parseFloat(data.rating) : undefined,
            ride_type: data?.ride_type || 'ONE_WAY',
            booking_type: (data?.booking_type || 'LIVE').toString().toUpperCase() as any,
            scheduled_start_time: data?.scheduled_start_time,
            trip_status: isAssigned ? TripStatus.ASSIGNED : (data?.trip_status || data?.status || TripStatus.REQUESTED),
            otp: data?.otp,
            pickupLat: data?.pickup_lat != null ? parseFloat(data.pickup_lat.toString()) : undefined,
            pickupLng: data?.pickup_lng != null ? parseFloat(data.pickup_lng.toString()) : undefined,
            dropLat: data?.drop_lat != null ? parseFloat(data.drop_lat.toString()) : undefined,
            dropLng: data?.drop_lng != null ? parseFloat(data.drop_lng.toString()) : undefined,
            phone: data?.passenger_details?.phone || data?.phone || data?.customer?.phone || data?.passenger_phone || undefined,
            tripType: data?.service_type || data?.ride_type || undefined,
            paymentMethod: data?.payment_method || 'Cash',
            isAssigned: isAssigned,
        };

        setRideQueue(prev => {
            // [STRICT SEPARATION] Dashboard handles LIVE rides and UNACCEPTED Assigned rides.
            // UNACCEPTED Scheduled requests are filtered out and managed via the Scheduled Rides screen.
            const isScheduledRequest = newRide.booking_type === 'SCHEDULED' && !isAssigned;
            if (isScheduledRequest) {
                console.log(`[useRideFeed] Ignoring SCHEDULED request ${newRide.id} for dashboard queue.`);
                return prev;
            }
            
            // ACCEPTED Scheduled rides should NOT be in the floating dashboard queue.
            // They are handled by the native 'nextScheduledRide' widget on the dashboard.
            if (newRide.booking_type === 'SCHEDULED' && isAcceptedOrActive) {
                console.log(`[useRideFeed] Ignoring ACCEPTED SCHEDULED ride ${newRide.id} for dashboard queue.`);
                return prev;
            }

            // ACCEPTED Live rides should NOT be in the dashboard queue either, 
            // RootNavigation redirects them to PickupMapScreen.
            if (newRide.booking_type !== 'SCHEDULED' && isAcceptedOrActive) {
                console.log(`[useRideFeed] Ignoring ACCEPTED/ARRIVING LIVE ride ${newRide.id} for dashboard queue.`);
                return prev;
            }

            // Block LIVE requests if a scheduled ride is starting soon
            if (isBlockingLiveRequests && newRide.booking_type === 'LIVE') {
                console.log('[useRideFeed] Blocking LIVE request due to upcoming scheduled ride');
                return prev;
            }

            const existingIndex = prev.findIndex(r => String(r.id) === String(newRide.id));
            let nextQueue: RideItem[];
            if (existingIndex !== -1) {
                // UPDATE existing ride (e.g. status changed from REQUESTED to ASSIGNED)
                console.log(`[useRideFeed] Updating existing ride ${newRide.id} in queue.`);
                
                const wasAssigned = 
                    prev[existingIndex].trip_status === TripStatus.ASSIGNED || 
                    prev[existingIndex].isAssigned === true;
                
                const nowAssigned = isAssigned || wasAssigned;
                
                const updatedItem = { 
                    ...prev[existingIndex], 
                    ...newRide,
                    trip_status: nowAssigned ? TripStatus.ASSIGNED : newRide.trip_status,
                    remaining: nowAssigned ? 99999 : newRide.remaining,
                    isAssigned: nowAssigned
                };

                nextQueue = [...prev];
                nextQueue[existingIndex] = updatedItem;

                // If it just became assigned, move it to top (override sort later)
                if (nowAssigned && !wasAssigned) {
                    const filtered = nextQueue.filter(r => String(r.id) !== String(newRide.id));
                    nextQueue = [updatedItem, ...filtered];
                }
            } else {
                // ADD new ride to top
                console.log(`[useRideFeed] Adding new ride ${newRide.id} to queue. Status: ${newRide.trip_status}`);
                nextQueue = [newRide, ...prev].slice(0, 5);
            }

            // SORT: Prioritize ASSIGNED rides at the top, then by "remaining" time
            return [...nextQueue].sort((a, b) => {
                const aAssigned = a.trip_status === TripStatus.ASSIGNED || a.isAssigned;
                const bAssigned = b.trip_status === TripStatus.ASSIGNED || b.isAssigned;
                if (aAssigned && !bAssigned) return -1;
                if (!aAssigned && bAssigned) return 1;
                return (b.remaining || 0) - (a.remaining || 0);
            });
        });
    }, [isBlockingLiveRequests]);

    // NOTE: Foreground FCM handling has been consolidated into setupForegroundHandler()
    // in notificationService.ts. That handler correctly suppresses system tray notifications
    // for ride events. Socket.IO is the primary delivery mechanism for foreground ride events.
    // Having a second onMessage listener here caused duplicate ride processing.
    // The rideQueueRef is still used by the socket listener and AppState resume check.

    // Listen for notification opens (from background or quit state)
    useEffect(() => {
        let isMounted = true;
        
        // 1. Check if the app was opened via a notification (Quit State Recovery)
        const { consumeInitialNotification } = require('../services/notificationService');
        const remoteMessage = consumeInitialNotification();

        if (remoteMessage?.data) {
            const data = remoteMessage.data;
            const type = data?.type?.toString().toUpperCase();
            if (
                type === 'RIDE_REQUEST' || 
                type === 'NEW_RIDE_REQUEST' || 
                type === 'ASSIGNED_RIDE' || 
                type === 'TRIP_ASSIGNED' || 
                data?.type === 'assigned_ride'
            ) {
                console.log('📬 [useRideFeed] Initial notification found in cache, verifying:', data);
                
                const tripId = data?.trip_id || data?.tripId || data?.bookingId;
                if (tripId) {
                    (async () => {
                        try {
                            const result = await triggerGetTrip(String(tripId)).unwrap();
                            const status = (result?.data?.trip_status || result?.data?.status || "").toString().toUpperCase();

                            if (status === 'REQUESTED' || status === 'ASSIGNED' || status === 'ACCEPTED') {
                                console.log(`[useRideFeed] Cold-start Ride ${tripId} is valid (Status: ${status}).`);
                                
                                const bookingType = (result?.data?.booking_type || data?.booking_type || "").toString().toUpperCase();
                                const isAssignedStatus = (status === 'ASSIGNED' || status === 'ACCEPTED' || status === 'ARRIVING');
                                
                                if (bookingType === 'SCHEDULED' && !isAssignedStatus) {
                                    navigation.navigate(ScheduledRides_Nav);
                                } else {
                                    handleIncomingRide({ ...data, ...result.data, noVibrate: true });
                                }
                            } else {
                                console.log(`[useRideFeed] Cold-start Ride ${tripId} is no longer available.`);
                            }
                        } catch (err) {
                            console.error('[useRideFeed] Failed to verify cold-start ride:', err);
                            handleIncomingRide({ ...data, noVibrate: true });
                        }
                    })();
                }
            }
        }

        // 2. Listen for notifications opened while the app is in background
        const unsubOpened = globalEmitter.on(EVENTS.NOTIFICATION_OPENED, async (data: any) => {
            console.log('📬 App opened via notification, checking ride status:', data);
            
            const tripId = data?.trip_id || data?.tripId || data?.bookingId;
            if (!tripId) return;

            try {
                // Verify if trip is still available
                const result = await triggerGetTrip(String(tripId)).unwrap();
                const status = (result?.data?.trip_status || result?.data?.status || "").toString().toUpperCase();

                if (status === 'REQUESTED' || status === 'ASSIGNED' || status === 'ACCEPTED') {
                    console.log(`[useRideFeed] Ride ${tripId} is still valid (Status: ${status}).`);
                    
                    const bookingType = (result?.data?.booking_type || data?.booking_type || "").toString().toUpperCase();
                    const isAssignedStatus = (status === 'ASSIGNED' || status === 'ACCEPTED' || status === 'ARRIVING');
                    
                    if (bookingType === 'SCHEDULED' && !isAssignedStatus) {
                        navigation.navigate(ScheduledRides_Nav);
                    } else {
                        handleIncomingRide({ ...data, ...result.data, noVibrate: true });
                    }
                } else {
                    console.log(`[useRideFeed] Ride ${tripId} is no longer available (Status: ${status})`);
                    showAlert({
                        title: t('ride_expired_title') || 'Ride Expired',
                        message: t('ride_expired_msg') || 'This ride is no longer available or has been accepted by another driver.',
                        singleButton: true,
                        icon: 'timer-off-outline'
                    });
                }
            } catch (err) {
                console.error('[useRideFeed] Failed to verify ride status:', err);
                // Fallback: show anyway if error, handleIncomingRide will handle expiry if createdAt is present
                handleIncomingRide({ ...data, noVibrate: true });
            }
        });
 
        return () => {
            isMounted = false;
            unsubOpened();
        };
    }, [handleIncomingRide, triggerGetTrip, showAlert, t]);

    // ── AppState Resume Check ──
    // When the driver switches back to the app (without tapping notification),
    // check for any pending ASSIGNED or REQUESTED rides that arrived while backgrounded.
    const rideQueueRef = useRef(rideQueue);
    rideQueueRef.current = rideQueue; // Always keep ref in sync

    useEffect(() => {
        if (!isOnline || !user?.driverId) return;

        const handleAppStateChange = async (nextState: string) => {
            const wasBackground = appStateRef.current.match(/inactive|background/);
            appStateRef.current = nextState as any;

            if (wasBackground && nextState === 'active') {
                console.log('[useRideFeed] App resumed from background, checking for pending rides...');
                try {
                    const result = await triggerGetIncoming(undefined).unwrap();
                    const trips = result?.data || result || [];

                    if (Array.isArray(trips)) {
                        const currentQueue = rideQueueRef.current;
                        trips.forEach((trip: any) => {
                            const status = (trip.trip_status || '').toString().toUpperCase();
                            const tripId = trip.trip_id || trip.id;

                            // Skip rides already in the queue (uses ref for fresh state)
                            const alreadyInQueue = currentQueue.some(
                                r => String(r.id) === String(tripId) || String(r.trip_id) === String(tripId)
                            );
                            if (alreadyInQueue) return;

                            const isAssignedStatus = 
                                status === 'ASSIGNED' || 
                                status === 'ACCEPTED' || 
                                status === 'ARRIVING';

                            // Assigned/Accepted rides for this driver — always show (no timer)
                            if (isAssignedStatus && trip.driver_id === user.driverId) {
                                console.log(`[useRideFeed] Resume: Found ${status} ride ${tripId}`);
                                const overrideType = status === 'ASSIGNED' ? 'ASSIGNED_RIDE' : 'RESUMED_RIDE';
                                handleIncomingRide({ ...trip, type: overrideType, noVibrate: true });
                                return;
                            }

                            // REQUESTED (live broadcast) rides — show only if not expired
                            if (status === 'REQUESTED') {
                                const createdAt = trip.created_at || trip.createdAt;
                                if (createdAt) {
                                    const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
                                    if (elapsed >= 20) {
                                        console.log(`[useRideFeed] Resume: REQUESTED ride ${tripId} expired (${elapsed}s old), skipping.`);
                                        return;
                                    }
                                }
                                console.log(`[useRideFeed] Resume: Found REQUESTED ride ${tripId}`);
                                handleIncomingRide({ ...trip, noVibrate: true });
                            }
                        });
                    }
                } catch (err) {
                    console.warn('[useRideFeed] Failed to check pending rides on resume:', err);
                }
            }
        };

        const sub = AppState.addEventListener('change', handleAppStateChange);
        return () => sub.remove();
    }, [isOnline, user?.driverId, handleIncomingRide, triggerGetIncoming]);

    // ── Countdown ──
    useEffect(() => {
        const timer = setInterval(() => {
            setRideQueue(prev =>
                prev.map(r => {
                    const standardizedStatus = r.trip_status?.toString().toUpperCase();
                    const isAssigned = 
                        standardizedStatus === 'ASSIGNED' || 
                        standardizedStatus === 'TRIP_ASSIGNED' ||
                        standardizedStatus === 'ASSIGNED_RIDE' ||
                        standardizedStatus === 'ACCEPTED' ||
                        standardizedStatus === 'ARRIVING';
                    return isAssigned ? r : { ...r, remaining: r.remaining - 1 };
                })
                    .filter(r => r.remaining > 0)
            );
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const rejectRide = (id: number | string) => {
        setRideQueue(prev => prev.filter(r => r.id !== id));
    };

    const acceptRide = (id: number | string) => {
        setRideQueue(prev => prev.filter(r => r.id !== id));
    };

    // ── Real-time Ride Feed (Socket.IO Consolidated) ──
    useEffect(() => {
        if (!isOnline || !user?.driverId) return;

        console.log(`[useRideFeed] Connecting & Setting up listeners for driver_${user.driverId}`);
        socketService.connect(user.driverId, 'DRIVER');
        socketService.joinDriverRoom(user.driverId);
        
        console.log("Socket Connected & Room Joined for driver", user.driverId);
        const onNewTripRequest = (data: any) => {
            const isBlocked = showConfirmModal || (acceptedRide && acceptedRide.booking_type === 'LIVE') || isBlockingLiveRequests;
            if (isBlocked) return;
            
            // Standardize format: backend might emit { trip: {...} }
            const tripData = data.trip || data;
            
            console.log("🚨 Socket New Trip Alert Received!", tripData);
            handleIncomingRide(tripData);
        };

        const onTripRemoved = (data: { tripId: string }) => {
            setRideQueue(prev => prev.filter(r => r.id !== data.tripId && r.trip_id !== data.tripId));
        };

        let isMounted = true;

        socketService.on('NEW_TRIP_REQUEST', onNewTripRequest);
        socketService.on('TRIP_ASSIGNED', (data: any) => {
            const tripData = data.trip || data;
            console.log("🚨 Socket TRIP_ASSIGNED Received!", tripData);
            handleIncomingRide({ ...tripData, type: 'assigned_ride' });
        });
        socketService.on('TRIP_REMOVED', onTripRemoved);
        
        // Refresh ride data on scheduled reminders
        socketService.on('SCHEDULED_REMINDER', async (data: any) => {
            console.log("⏰ Scheduled Reminder Received!", data);
            const tripId = data.trip_id || data.tripId;
            if (tripId) {
                try {
                    const result = await triggerGetTrip(String(tripId)).unwrap();
                    if (result?.data) handleIncomingRide({ ...result.data, noVibrate: true });
                } catch (e) { console.error('Failed to refresh scheduled ride:', e); }
            }
        });

        // 🛡️ Sync queue on Reconnect
        socketService.addConnectionListener(async (connected) => {
            if (connected && isMounted) {
                console.log('[useRideFeed] Socket reconnected, syncing pending rides...');
                try {
                    const result = await triggerGetIncoming(undefined).unwrap();
                    const trips = result?.data || result || [];
                    if (Array.isArray(trips)) {
                        trips.forEach(trip => handleIncomingRide({ ...trip, noVibrate: true }));
                    }
                } catch (e) { console.error('Failed to sync rides on reconnect:', e); }
            }
        });

        return () => {
            isMounted = false;
            console.log('[useRideFeed] Cleaning up socket listeners');
            socketService.off('NEW_TRIP_REQUEST');
            socketService.off('TRIP_ASSIGNED');
            socketService.off('TRIP_REMOVED');
            socketService.off('SCHEDULED_REMINDER');
        };
    }, [isOnline, user?.driverId, showConfirmModal, acceptedRide, handleIncomingRide]);

    return {
        rideQueue,
        rejectRide,
        acceptRide,
        setRideQueue,
    };
};
