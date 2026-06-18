import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';



const ACCESS_KEY = 'ACCESS_TOKEN';
const REFRESH_KEY = 'REFRESH_TOKEN';

export const storage = {
    // Save Access Token
    async setAccessToken(token: string) {
        await Keychain.setGenericPassword(ACCESS_KEY, token, {
            service: ACCESS_KEY,
        });
    },

    // Retrieve Access Token
    async getAccessToken() {
        const creds = await Keychain.getGenericPassword({ service: ACCESS_KEY });
        return creds ? creds.password : null;
    },

    // Delete Access Token
    async removeAccessToken() {
        await Keychain.resetGenericPassword({ service: ACCESS_KEY });
    },

    // Save Refresh Token
    async setRefreshToken(token: string) {
        await Keychain.setGenericPassword(REFRESH_KEY, token, {
            service: REFRESH_KEY,
        });
    },

    // Get Refresh Token
    async getRefreshToken() {
        const creds = await Keychain.getGenericPassword({ service: REFRESH_KEY });
        return creds ? creds.password : null;
    },

    // Delete Refresh Token
    async removeRefreshToken() {
        await Keychain.resetGenericPassword({ service: REFRESH_KEY });
    },

    // Clear all tokens
    async clearAll() {
        try {
            await Keychain.resetGenericPassword({ service: ACCESS_KEY });
        } catch (e) {
            console.log('[Storage] Failed to reset ACCESS_KEY', e);
        }
        try {
            await Keychain.resetGenericPassword({ service: REFRESH_KEY });
        } catch (e) {
            console.log('[Storage] Failed to reset REFRESH_KEY', e);
        }
        try {
            await AsyncStorage.clear();
        } catch (e) {
            console.log('[Storage] Failed to clear AsyncStorage', e);
        }
        try {
            await AsyncStorage.removeItem('persist:root');
        } catch (e) {
            console.log('[Storage] Failed to remove persist:root', e);
        }
        try {
            await AsyncStorage.removeItem('persist:userSlice');
        } catch (e) {
            console.log('[Storage] Failed to remove persist:userSlice', e);
        }
        try {
            await AsyncStorage.removeItem('DRIVER_ID');
        } catch (e) {
            console.log('[Storage] Failed to remove DRIVER_ID', e);
        }
    },

    // General Storage (AsyncStorage)
    async set(key: string, value: any) {
        try {
            const jsonValue = JSON.stringify(value);
            await AsyncStorage.setItem(key, jsonValue);
        } catch (e) {
            console.error('Error saving data', e);
        }
    },

    async get(key: string) {
        try {
            const jsonValue = await AsyncStorage.getItem(key);
            return jsonValue != null ? JSON.parse(jsonValue) : null;
        } catch (e) {
            console.error('Error reading data', e);
            return null;
        }
    },

    async remove(key: string) {
        try {
            await AsyncStorage.removeItem(key);
        } catch (e) {
            console.error('Error removing data', e);
        }
    },

    // Driver ID Storage
    async setDriverId(id: string) {
        await this.set('DRIVER_ID', id);
    },

    async getDriverId() {
        return await this.get('DRIVER_ID');
    },
};
