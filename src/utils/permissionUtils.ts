import { Platform, Linking } from 'react-native';
import {
  check,
  request,
  PERMISSIONS,
  RESULTS,
  Permission,
  openSettings,
} from 'react-native-permissions';

/**
 * Result types for permission checks
 */
export type PermissionResult = 'granted' | 'denied' | 'blocked' | 'limited' | 'unavailable';

/**
 * Get the platform-specific camera permission
 */
const getCameraPermission = (): Permission | null => {
  if (Platform.OS === 'android') return PERMISSIONS.ANDROID.CAMERA;
  if (Platform.OS === 'ios') return PERMISSIONS.IOS.CAMERA;
  return null;
};

/**
 * Get the platform-specific photo library permission
 */
const getPhotoLibraryPermission = (): Permission | null => {
  if (Platform.OS === 'android') {
    // Android 13+ (API 33+) uses READ_MEDIA_IMAGES
    if (Platform.Version >= 33) return PERMISSIONS.ANDROID.READ_MEDIA_IMAGES;
    return PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE;
  }
  if (Platform.OS === 'ios') return PERMISSIONS.IOS.PHOTO_LIBRARY;
  return null;
};

/**
 * Request a permission and handle the result
 */
const requestAndHandle = async (permission: Permission): Promise<PermissionResult> => {
  try {
    const result = await request(permission);
    switch (result) {
      case RESULTS.GRANTED:
        return 'granted';
      case RESULTS.LIMITED:
        return 'limited';
      case RESULTS.DENIED:
        return 'denied';
      case RESULTS.BLOCKED:
        return 'blocked';
      case RESULTS.UNAVAILABLE:
        return 'unavailable';
      default:
        return 'denied';
    }
  } catch (error) {
    console.error('Permission Request Error:', error);
    return 'unavailable';
  }
};

/**
 * Check and request Camera permission
 */
export const checkCameraPermission = async (): Promise<boolean> => {
  const permission = getCameraPermission();
  if (!permission) return false;

  const result = await check(permission);
  if (result === RESULTS.GRANTED) return true;
  if (result === RESULTS.LIMITED) return true;

  const requestResult = await requestAndHandle(permission);
  return requestResult === 'granted' || requestResult === 'limited';
};

/**
 * Check and request Photo Library permission
 */
export const checkPhotoLibraryPermission = async (): Promise<boolean> => {
  const permission = getPhotoLibraryPermission();
  if (!permission) return false;

  const result = await check(permission);
  if (result === RESULTS.GRANTED) return true;
  if (result === RESULTS.LIMITED) return true;

  const requestResult = await requestAndHandle(permission);
  return requestResult === 'granted' || requestResult === 'limited';
};

/**
 * Get the platform-specific microphone permission
 */
const getMicrophonePermission = (): Permission | null => {
  if (Platform.OS === 'android') return PERMISSIONS.ANDROID.RECORD_AUDIO;
  if (Platform.OS === 'ios') return PERMISSIONS.IOS.MICROPHONE;
  return null;
};

/**
 * Check and request Microphone permission
 */
export const checkMicrophonePermission = async (): Promise<boolean> => {
  const permission = getMicrophonePermission();
  if (!permission) return false;

  const result = await check(permission);
  if (result === RESULTS.GRANTED || result === RESULTS.LIMITED) return true;

  const requestResult = await requestAndHandle(permission);
  return requestResult === 'granted' || requestResult === 'limited';
};

/**
 * Check and request both Camera & Microphone permissions for Video KYC
 */
export const requestVideoKycPermissions = async (): Promise<{ camera: boolean; microphone: boolean; allGranted: boolean }> => {
  const camera = await checkCameraPermission();
  const microphone = await checkMicrophonePermission();
  return {
    camera,
    microphone,
    allGranted: camera && microphone,
  };
};

/**
 * Opens app settings
 */
export const goToSettings = () => {
  openSettings().catch(() => Linking.openSettings());
};
