import { useState, useCallback } from 'react';
import Geolocation from 'react-native-geolocation-service';
import { requestLocationPermission } from '../service/utils/permission';
// import Config from 'react-native-config';

let GOOGLE_MAPS_API_KEY = 'AIzaSyCWGzSmu6tKxCRSan4p0z_7juXDNdZcG3s';
// const GOOGLE_MAPS_APIKEY = Config.GOOGLE_MAPS_API_KEY;
// console.log("DEBUG_LOCATION: GOOGLE_MAPS_APIKEY", GOOGLE_MAPS_APIKEY);



export interface StructuredAddress {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
    formattedAddress: string;
}

export const useLocation = () => {
    const [loading, setLoading] = useState(false);

    const getCurrentLocation = useCallback((): Promise<Geolocation.GeoPosition> => {
        return new Promise(async (resolve, reject) => {
            try {
                console.log('DEBUG_LOCATION: Requesting permission...');
                const hasPermission = await requestLocationPermission();
                if (!hasPermission) {
                    return reject('Permission denied');
                }

                setLoading(true);
                const options = {
                    enableHighAccuracy: true,
                    timeout: 20000,
                    maximumAge: 10000,
                    distanceFilter: 0,
                    forceRequestLocation: true,
                    showLocationDialog: true,
                };

                Geolocation.getCurrentPosition(
                    (pos) => {
                        setLoading(false);
                        resolve(pos);
                    },
                    (err) => {
                        if (err.code === 3 || err.code === 2) {
                            Geolocation.getCurrentPosition(
                                (fallbackPos) => {
                                    setLoading(false);
                                    resolve(fallbackPos);
                                },
                                (fallbackErr) => {
                                    setLoading(false);
                                    reject(fallbackErr);
                                },
                                { ...options, enableHighAccuracy: false }
                            );
                        } else {
                            setLoading(false);
                            reject(err);
                        }
                    },
                    options
                );
            } catch (error) {
                setLoading(false);
                reject(error);
            }
        });
    }, []);

    const getAddressFromCoords = useCallback(async (lat: number, lng: number): Promise<StructuredAddress | null> => {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data.status === 'OK' && data.results.length > 0) {
                const components = data.results[0].address_components;
                let street = '';
                let city = '';
                let state = '';
                let pincode = '';
                let country = '';

                components.forEach((c: any) => {
                    if (c.types.includes('route') || c.types.includes('street_number') || c.types.includes('sublocality')) {
                        street = street ? `${street}, ${c.long_name}` : c.long_name;
                    }
                    if (c.types.includes('locality') || c.types.includes('administrative_area_level_2')) {
                        if (!city) { city = c.long_name; }
                    }
                    if (c.types.includes('administrative_area_level_1')) {
                        state = c.long_name;
                    }
                    if (c.types.includes('postal_code')) {
                        pincode = c.long_name;
                    }
                    if (c.types.includes('country')) {
                        country = c.long_name;
                    }
                });

                if (!street) {
                    street = components.find((c: any) => c.types.includes('route'))?.long_name || data.results[0].formatted_address.split(',')[0];
                }

                return {
                    street: street || '',
                    city: city || '',
                    state,
                    pincode,
                    country,
                    formattedAddress: data.results[0].formatted_address,
                };
            }
            return null;
        } catch (error) {
            console.error('Network error:', error);
            return null;
        }
    }, []);

    const watchLocation = useCallback((
        onSuccess: (pos: Geolocation.GeoPosition) => void,
        onError: (err: Geolocation.GeoError) => void,
        optionsOverride: any = {}
    ): number | null => {
        const options = {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 10000,
            distanceFilter: 10,
            showLocationDialog: true,
            forceRequestLocation: true,
            ...optionsOverride
        };

        return Geolocation.watchPosition(
            onSuccess,
            (err) => {
                console.error('DEBUG_LOCATION: Watch error', err);
                onError(err);
            },
            { 
                ...options, 
                interval: 5000, 
                fastestInterval: 2000 
            }
        );
    }, []);

    return { getCurrentLocation, getAddressFromCoords, watchLocation, loading };
};
