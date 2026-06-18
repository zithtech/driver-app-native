import React, { useEffect, useState, useRef } from "react";
import { SocketContext } from "./SocketContext";
import socketService from "../service/socketService";
import { ISocketContext } from "./socket.types";
import { useDispatch, useSelector } from "react-redux";
import { incrementUnreadCount } from "../redux/chatSlice";
import { navigationRef } from "../Navigations/navigationRef";
import { RootState, AppDispatch } from "../redux/store";
import { clearAcceptedRide } from "../redux/rideSlice";
import { useAlert } from "../context/AlertContext";
import { StackActions } from "@react-navigation/native";
import audioService from "../utils/audioService";
import { setUser } from "../redux/userSlice";
import { driverApi } from "../service/driverApi";

interface Props {
    children: React.ReactNode;
}

export const SocketProvider: React.FC<Props> = ({ children }) => {
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [socketId, setSocketId] = useState<string | null>(null);
    const dispatch = useDispatch<AppDispatch>();
    const { showAlert } = useAlert();
    const currentRide = useSelector((state: RootState) => state.ride.currentRide);
    const driverId = useSelector((state: RootState) => state.userSlice.user?.driverId);
    const role = useSelector((state: RootState) => state.userSlice.user?.role) || 'driver';
    
    const currentRideRef = useRef(currentRide);

    // Keep ref in sync for socket listeners to avoid closure issues
    useEffect(() => {
        currentRideRef.current = currentRide;
    }, [currentRide]);

    useEffect(() => {
        // 🔄 Use the centralized socket service
        socketService.connect(driverId, role);
        
        const connectionListener = (connected: boolean) => {
            setIsConnected(connected);
            // Optionally update socketId if needed from socketService
        };
        
        socketService.addConnectionListener(connectionListener);

        socketService.on("receiveChatMessage", (data: any) => {
            const { rideId } = data;
            
            // Check if user is currently looking at this specific chat
            const currentRoute = navigationRef.isReady() ? navigationRef.getCurrentRoute() : null;
            const isOnChatScreen = currentRoute?.name === 'ChatScreen';
            const lookingAtSameRide = currentRoute?.params && (currentRoute.params as any).rideId === rideId;

            if (!(isOnChatScreen && lookingAtSameRide)) {
                dispatch(incrementUnreadCount(rideId));
            }
        });

        // 🛡️ Global Ride Cancellation Listener
        const handleGlobalCancellation = (data: any) => {
            const cancelledTripId = data.trip_id || data.id || data.rideId || data.tripId || data.trip?.trip_id || data.trip?.id;
            const status = data.status || data.trip_status || data.trip?.status || data.trip?.trip_status;
            const activeRide = currentRideRef.current;
            
            console.log('[SocketProvider] Cancellation event received:', { cancelledTripId, status, activeRideId: activeRide?.trip_id });

            // Only care if it matches our active ride
            if (activeRide && (activeRide.trip_id === cancelledTripId || activeRide.trip_id?.toString() === cancelledTripId?.toString())) {
                // 🛡️ CRITICAL FIX: Only treat explicit cancellation statuses as such.
                // Previously, !status was incorrectly treated as a cancellation, which triggered 
                // every time a trip update (like location) was received without the full status object.
                const isCancellation = status === 'CANCELLED' || status === 'CANCEL' || status === 'MID_CANCELLED';

                if (isCancellation) {
                    // 🔊 Announce voice alert
                    audioService.speak('The rider has cancelled the trip');
                    
                    dispatch(clearAcceptedRide());
                    
                    // Show global alert
                    showAlert({
                        title: 'Ride Cancelled',
                        message: 'The rider has cancelled the trip.',
                        singleButton: true,
                        icon: 'close-circle-outline',
                        onConfirm: () => {
                            if (navigationRef.isReady()) {
                                navigationRef.dispatch(StackActions.replace('DashboardScreen'));
                            }
                        }
                    });
                }
            }
        };

        socketService.on("trip_updated", handleGlobalCancellation);
        socketService.on("TRIP_CANCELLED", handleGlobalCancellation);
        socketService.on("rider_cancelled", handleGlobalCancellation);
        socketService.on("SCHEDULED_RIDE_CANCELLED", handleGlobalCancellation);

        // 🛡️ Document Status Update Listener
        socketService.on("DOCUMENT_STATUS_UPDATE", (data: any) => {
            console.log('[SocketProvider] Document status update received:', data);
            if (driverId) {
                // Invalidate RTK Query cache so documents & profile refetch with latest data
                dispatch(driverApi.util.invalidateTags(['Documents', 'Driver']));

                if (data.status === 'rejected' || data.status === 'REJECTED') {
                    dispatch(setUser({ onboarding_status: 'DOCS_REJECTED' }));
                }

                // Fetch latest profile from API to get authoritative onboarding_status
                dispatch(driverApi.endpoints.getDriverProfile.initiate(undefined, { forceRefetch: true }))
                    .unwrap()
                    .then((profileResult: any) => {
                        const profile = profileResult?.data || profileResult;
                        if (profile?.onboarding_status) {
                            dispatch(setUser(profile));
                        }
                    })
                    .catch(() => {});
            }
        });

        // 🛡️ Account Status Update Listener (Block/Suspend)
        socketService.on("ACCOUNT_STATUS_UPDATE", (data: any) => {
            console.log('[SocketProvider] Account status update received:', data);
            dispatch(setUser({
                status: data.status,
                status_reason: data.status_reason,
                status_updated_at: data.status_updated_at
            }));

            if (data.status === 'blocked' || data.status === 'suspended') {
                audioService.speak('Your account status has been updated. Please check the app for details.');
            }
        });

        return () => {
            socketService.removeConnectionListener(connectionListener);
            socketService.off("receiveChatMessage");
            socketService.off("trip_updated", handleGlobalCancellation);
            socketService.off("TRIP_CANCELLED", handleGlobalCancellation);
            socketService.off("rider_cancelled", handleGlobalCancellation);
            socketService.off("SCHEDULED_RIDE_CANCELLED", handleGlobalCancellation);
            socketService.off("ACCOUNT_STATUS_UPDATE");
            socketService.off("DOCUMENT_STATUS_UPDATE");
            // Do NOT disconnect the service here as it might be used globally
        };
    }, [driverId, role]);

    const value: ISocketContext = {
        socket: (socketService as any).socket, // Access underlying socket if needed
        isConnected,
        socketId,
    };

    return (
        <SocketContext.Provider value={value} >
            {children}
        </SocketContext.Provider>
    );
};