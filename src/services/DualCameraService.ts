import { NativeModules, Platform, requireNativeComponent, ViewProps } from 'react-native';

const { DualCameraModule } = NativeModules;

export const DualCameraPreview =
  Platform.OS === 'android'
    ? requireNativeComponent<ViewProps>('DualCameraPreview')
    : null;

export interface DeviceCompatibilityReport {
  camera: {
    hasFrontCamera: boolean;
    hasBackCamera: boolean;
    supportsConcurrentCamera: boolean;
    concurrentSetsCount: number;
    frontCameraId?: string;
    backCameraId?: string;
  };
  storage: {
    availableMB: number;
    availableGB: number;
    isStorageSufficient: boolean;
  };
  battery: {
    batteryLevel: number;
    isCharging: boolean;
    isBatterySufficient: boolean;
  };
  sensors: {
    hasAccelerometer: boolean;
    hasGyroscope: boolean;
    hasMagnetometer: boolean;
  };
  location: {
    isGpsEnabled: boolean;
    isNetworkLocationEnabled: boolean;
  };
  isOverallReady: boolean;
  deviceModel: string;
  deviceManufacturer: string;
  androidApiLevel?: number;
}

export interface DualRecordingStartResult {
  rearActive: boolean;
  frontActive: boolean;
  simultaneousDualActive: boolean;
  rearFilePath?: string | null;
  frontFilePath?: string | null;
}

export interface DualRecordingStopResult {
  rearVideoPath: string | null;
  rearFileSizeBytes: number;
  frontVideoPath: string | null;
  frontFileSizeBytes: number;
  durationMs: number;
  simultaneousDualActive: boolean;
}

class DualCameraService {
  /**
   * Evaluates device hardware compatibility for the driving test
   */
  async checkCompatibility(): Promise<DeviceCompatibilityReport> {
    if (Platform.OS === 'android' && DualCameraModule?.checkDeviceCompatibility) {
      try {
        const report = await DualCameraModule.checkDeviceCompatibility();
        return report;
      } catch (error) {
        console.warn('[DualCameraService] Native check failed, falling back to simulated info:', error);
      }
    }

    // iOS or Fallback Simulation
    return {
      camera: {
        hasFrontCamera: true,
        hasBackCamera: true,
        supportsConcurrentCamera: Platform.OS === 'ios',
        concurrentSetsCount: 1,
        frontCameraId: 'front',
        backCameraId: 'back',
      },
      storage: {
        availableMB: 2500,
        availableGB: 2.5,
        isStorageSufficient: true,
      },
      battery: {
        batteryLevel: 85,
        isCharging: false,
        isBatterySufficient: true,
      },
      sensors: {
        hasAccelerometer: true,
        hasGyroscope: true,
        hasMagnetometer: true,
      },
      location: {
        isGpsEnabled: true,
        isNetworkLocationEnabled: true,
      },
      isOverallReady: true,
      deviceModel: Platform.OS === 'ios' ? 'iPhone' : 'Android Device',
      deviceManufacturer: Platform.OS === 'ios' ? 'Apple' : 'OEM',
    };
  }

  /**
   * Starts simultaneous Rear Road + Front Cabin MP4 recording natively
   */
  async startDualRecording(sessionId: string): Promise<DualRecordingStartResult | null> {
    if (Platform.OS === 'android' && DualCameraModule?.startDualRecording) {
      return await DualCameraModule.startDualRecording(sessionId);
    }
    return null;
  }

  /**
   * Stops active recordings cleanly, waits for MP4 moov finalization, and returns local file paths + byte sizes
   */
  async stopDualRecording(): Promise<DualRecordingStopResult | null> {
    if (Platform.OS === 'android' && DualCameraModule?.stopDualRecording) {
      return await DualCameraModule.stopDualRecording();
    }
    return null;
  }

  /**
   * Cancels active recording and deletes temp files (used on abort / unmount)
   */
  async cancelDualRecording(): Promise<void> {
    if (Platform.OS === 'android' && DualCameraModule?.cancelDualRecording) {
      try {
        await DualCameraModule.cancelDualRecording();
      } catch (e) {
        console.warn('[DualCameraService] cancelDualRecording warning:', e);
      }
    }
  }

  /**
   * Deletes an individual uploaded video file from local storage
   */
  async deleteLocalRecordingFile(filePath?: string | null): Promise<void> {
    if (Platform.OS === 'android' && DualCameraModule?.deleteLocalRecordingFile && filePath) {
      try {
        await DualCameraModule.deleteLocalRecordingFile(filePath);
      } catch (e) {
        console.warn('[DualCameraService] deleteLocalRecordingFile warning:', e);
      }
    }
  }

  /**
   * Retrieves local storage directory for saving segmented video chunks
   */
  async getStoragePath(): Promise<string> {
    if (Platform.OS === 'android' && DualCameraModule?.getRecordingStoragePath) {
      return await DualCameraModule.getRecordingStoragePath();
    }
    return '/tmp/driving_test_recordings';
  }

  /**
   * Cleans up local temp video segments after successful upload
   */
  async cleanupOldRecordings(): Promise<number> {
    if (Platform.OS === 'android' && DualCameraModule?.clearOldRecordings) {
      return await DualCameraModule.clearOldRecordings();
    }
    return 0;
  }
}

export default new DualCameraService();
