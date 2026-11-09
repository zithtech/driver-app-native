import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { FloatingOverlayModule } = NativeModules;
const overlayEmitter = new NativeEventEmitter(FloatingOverlayModule);

export const FloatingOverlayService = {
  checkPermission: async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      return await FloatingOverlayModule.checkPermission();
    }
    return true; // iOS doesn't have system-level overlay permission like Android
  },
  
  requestPermission: () => {
    if (Platform.OS === 'android') {
      FloatingOverlayModule.requestPermission();
    }
  },
  
  start: (state: string = 'DEFAULT') => {
    if (Platform.OS === 'android') {
      FloatingOverlayModule.startOverlay(state);
    }
  },
  
  updateState: (state: string) => {
    if (Platform.OS === 'android') {
      FloatingOverlayModule.updateState(state);
    }
  },
  
  stop: () => {
    if (Platform.OS === 'android') {
      FloatingOverlayModule.stopOverlay();
    }
  },
  
  onTap: (callback: () => void) => {
    return overlayEmitter.addListener('onFloatingButtonTapped', callback);
  },
};
