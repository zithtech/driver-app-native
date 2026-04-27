import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import socketService from '../service/socketService';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { TripStatus } from '../types/trip';


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
};

interface UseRideFeedProps {
    isOnline: boolean;
    showConfirmModal: boolean;
    acceptedRide: RideItem | null;
}

export const useRideFeed = ({ isOnline, showConfirmModal, acceptedRide }: UseRideFeedProps) => {
    const [rideQueue, setRideQueue] = useState<RideItem[]>([]);
    const user = useSelector((state:RootState ) => state.userSlice?.user);
    const processedIds = useRef(new Set<string>());
    const currentRide = useSelector((state: RootState) => state.ride?.currentRide);

    const isBlockingLiveRequests = useMemo(() => {
        if (!currentRide || currentRide.booking_type !== 'SCHEDULED') return false;
        
        const startTime = new Date(currentRide.scheduled_start_time).getTime();
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        
        // Block if we are within the "active window" (24 hours before until trip finishes)
        return (startTime - now) <= oneDay;
    }, [currentRide]);
    
    const handleIncomingRide = useCallback((data: any) => {
        // Log to verify incoming structure
        console.log('Incoming Ride Request Data:', data);

        const uniqueId = String(data?.trip_id || data?.tripId || Date.now());
        
        // Prevent processing the exact same notification payload twice
        if (processedIds.current.has(uniqueId)) {
            console.log('Duplicate ride request blocked (processedIds):', uniqueId);
            return;
        }
        processedIds.current.add(uniqueId);

        const newRide: RideItem = {
            id: uniqueId,
            trip_id: data?.trip_id || data?.tripId,
            trip_code: data?.trip_code || data?.booking_code,
            pickup: data?.pickup_address||data?.pickup || 'Pickup Location',
            drop: data?.drop_address||data?.drop || 'Drop Location',
            price: data?.fare? `₹${data.fare}` : data?.total_fare ? `₹${data.total_fare}` : '₹--',
            remaining: (data?.trip_status === 'ASSIGNED' || data?.trip_status === TripStatus.ASSIGNED) ? 99999 : 15,
            distance: data?.distance_km ? `${data.distance_km} km` : data?.distanceToUser ? `${data.distanceToUser} m` : '--',
            eta: data?.trip_duration_minutes ? `${data.trip_duration_minutes} min` : data?.eta ? `${data.eta} min` : '--',
            passenger: data?.passenger_details?.name || data?.passenger || data?.passengerName || data?.passenger_name || data?.customer?.name || 'Passenger',
            rating: data?.rating ? parseFloat(data.rating) : undefined,
            ride_type: data?.ride_type || 'ONE_WAY',
            booking_type: data?.booking_type || 'LIVE',
            scheduled_start_time: data?.scheduled_start_time,
            trip_status: data?.trip_status || TripStatus.REQUESTED,
            otp: data?.otp,
            pickupLat: data?.pickup_lat ? parseFloat(data.pickup_lat) : undefined,
            pickupLng: data?.pickup_lng ? parseFloat(data.pickup_lng) : undefined,
            dropLat: data?.drop_lat ? parseFloat(data.drop_lat) : undefined,
            dropLng: data?.drop_lng ? parseFloat(data.drop_lng) : undefined,
            phone: data?.passenger_details?.phone || data?.phone || data?.customer?.phone || data?.passenger_phone || undefined,
            tripType: data?.service_type || data?.ride_type || undefined,
            paymentMethod: data?.payment_method || 'Cash',
        };

        setRideQueue(prev => {
            // Isolation: dashboard alert card only handles LIVE rides
            if (newRide.booking_type === 'SCHEDULED') {
                return prev;
            }

            // EXTRA: Block LIVE requests if a scheduled ride is starting soon
            if (isBlockingLiveRequests && newRide.booking_type === 'LIVE') {
                console.log('Blocking LIVE request due to upcoming scheduled ride');
                return prev;
            }

            const rideExists = prev.find(
                 ride => String(ride.id) === String(newRide.id)
            );
            if (rideExists) {
                return prev;
            }
            return [newRide, ...prev].slice(0, 5);
        });
    }, [isBlockingLiveRequests]);

    // ── Real-time Ride Feed (Firebase Messaging) ──
    useEffect(() => {
        if (!isOnline) { return; }

        let isMounted = true;
        let unsubscribe: (() => void) | undefined;

        import('@react-native-firebase/messaging').then(({ getMessaging, onMessage }) => {
            if (!isMounted) return;
            unsubscribe = onMessage(getMessaging(), async (remoteMessage) => {
                const isBlocked = showConfirmModal || (acceptedRide && acceptedRide.booking_type === 'LIVE') || isBlockingLiveRequests;
                if (AppState.currentState !== 'active' || isBlocked) return;

                // Check if this is a ride request
                if (remoteMessage.data?.type === 'ride_request' || remoteMessage.data?.type === 'assigned_ride' || remoteMessage.data?.type === 'SCHEDULED_REMINDER') {
                    console.log('FCM Ride Request Received:', remoteMessage.data);
                    handleIncomingRide(remoteMessage.data);
                }
            });
        }).catch(err => console.error('Failed to load @react-native-firebase/messaging', err));

        return () => {
            isMounted = false;
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [isOnline, showConfirmModal, acceptedRide, handleIncomingRide]);

    // ── Countdown ──
    useEffect(() => {
        const timer = setInterval(() => {
            setRideQueue(prev =>
                prev.map(r => (r.trip_status === 'ASSIGNED' || r.trip_status === TripStatus.ASSIGNED ? r : { ...r, remaining: r.remaining - 1 }))
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
        socketService.emit('JOIN_DRIVER_ROOM', user.driverId);
        
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

        socketService.on('NEW_TRIP_REQUEST', onNewTripRequest);
        socketService.on('TRIP_ASSIGNED', onNewTripRequest); // Use same handler
        socketService.on('TRIP_REMOVED', onTripRemoved);

        return () => {
            console.log('[useRideFeed] Cleaning up socket listeners');
            socketService.off('NEW_TRIP_REQUEST');
            socketService.off('TRIP_ASSIGNED');
            socketService.off('TRIP_REMOVED');
        };
    }, [isOnline, user?.driverId, showConfirmModal, acceptedRide, handleIncomingRide]);

    return {
        rideQueue,
        rejectRide,
        acceptRide,
        setRideQueue,
    };
};
