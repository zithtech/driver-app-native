import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from 'react-native-geolocation-service';

export const requestLocationPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'ios') {
        try {
            const auth = await Geolocation.requestAuthorization('whenInUse');
            return auth === 'granted';
        } catch (error) {
            console.warn('IOS Permission Error:', error);
            return false;
        }
    }

    if (Platform.OS === 'android') {
        try {
            // 1. Notification Permission (Android 13+)
            if (Platform.Version >= 33) {
                await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
                );
            }

            // 2. Default Location Permission (Foreground)
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
            );

            return granted === PermissionsAndroid.RESULTS.GRANTED;
        } catch (err) {
            console.warn('Android Permission Error:', err);
            return false;
        }
    }

    return false;
};
