import { useState, useCallback, useRef, useEffect } from 'react';
import Geolocation from 'react-native-geolocation-service';

import { useLocation } from './useLocation';


// Default coordinates removed (was Chennai)

interface UseDashboardMapProps {
    isOnline: boolean;
}

export const useDashboardMap = ({ isOnline }: UseDashboardMapProps) => {
    const { watchLocation, getCurrentLocation, getAddressFromCoords } = useLocation();

    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number; heading: number | null } | null>(null);
    const [currentAddress, setCurrentAddress] = useState<string>('');
    const [locationError, setLocationError] = useState<string | null>(null);

    const watchId = useRef<number | null>(null);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    const updateAddress = useCallback(
        async (lat: number, lng: number) => {
            try {
                const addr = await getAddressFromCoords(lat, lng);
                if (addr) {
                    setCurrentAddress(addr.street || addr.formattedAddress || '');
                }
            } catch (err) {
                console.log('Address fetch error:', err);
            }
        },
        [getAddressFromCoords]
    );

    const stopLocationUpdates = useCallback(() => {
        if (watchId.current !== null) {
            Geolocation.clearWatch(watchId.current);
            watchId.current = null;
        }
    }, []);

    const startLocationUpdates = useCallback(() => {
        stopLocationUpdates();

        if (!isMounted.current) return;

        getCurrentLocation()
            .then((pos: Geolocation.GeoPosition) => {
                if (!isMounted.current) return;
                const { latitude, longitude, heading } = pos.coords;
                setUserLocation({ latitude, longitude, heading });
                updateAddress(latitude, longitude);
                setLocationError(null);

                // 2. ONLY start watching after successfully getting initial position
                // (which confirms permission was granted)
                watchId.current = watchLocation(
                    (watchPos: Geolocation.GeoPosition) => {
                        if (!isMounted.current) return;
                        const { latitude: lat, longitude: lng, heading: head } = watchPos.coords;
                        setUserLocation((prev) => {
                            const latDiff = prev ? Math.abs(prev.latitude - lat) : 1;
                            const lngDiff = prev ? Math.abs(prev.longitude - lng) : 1;
                            if (latDiff > 0.0005 || lngDiff > 0.0005) {
                                updateAddress(lat, lng);
                            }
                            return { latitude: lat, longitude: lng, heading: head };
                        });
                    },
                    (error: Geolocation.GeoError) => {
                        console.log('Dashboard Watch Error:', error);
                        setLocationError(error.message || 'Lost location signal');
                    }
                );
            })
            .catch((err: any) => {
                console.log('Initial Location Error:', err);
                setLocationError(err.message || 'Failed to fetch location');
            });
    }, [getCurrentLocation, watchLocation, updateAddress, stopLocationUpdates]);

    // Always fetch initial location on mount (so map is contextual even offline)
    useEffect(() => {
        if (!userLocation) {
            getCurrentLocation()
                .then((pos: Geolocation.GeoPosition) => {
                    if (!isMounted.current) return;
                    const { latitude, longitude, heading } = pos.coords;
                    setUserLocation({ latitude, longitude, heading });
                    updateAddress(latitude, longitude);
                })
                .catch(() => {
                    // Silent — no location available yet
                });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (isOnline) {
            startLocationUpdates();
        } else {
            stopLocationUpdates();
            // Retain last known location — do NOT reset to null
            // This keeps the map showing the driver's last position (dimmed) when offline
            setLocationError(null);
        }
        return () => stopLocationUpdates();
    }, [isOnline, startLocationUpdates, stopLocationUpdates]);

    return {
        userLocation,
        currentAddress,
        locationError,
    };
};
