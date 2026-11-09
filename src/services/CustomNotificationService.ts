import { NativeModules, Platform } from 'react-native';

const { CustomNotificationModule } = NativeModules;

export interface CustomNotificationData {
  tripId: string;
  distance: string;
  fare: string;
}

export const displayCustomNotification = (data: CustomNotificationData) => {
  if (Platform.OS === 'android' && CustomNotificationModule) {
    CustomNotificationModule.displayCustomNotification(data);
  }
};

const rejectedTrips = new Set<string>();

export const cancelCustomNotification = (tripId: string) => {
  rejectedTrips.add(tripId);
  if (Platform.OS === 'android' && CustomNotificationModule) {
    CustomNotificationModule.cancelNotification(tripId);
  }
};

export const isRideNotificationRejected = (tripId: string) => {
  return rejectedTrips.has(tripId);
};

export const getInitialRideRequest = async (): Promise<any | null> => {
  if (Platform.OS === 'android' && CustomNotificationModule) {
    return await CustomNotificationModule.getInitialRideRequest();
  }
  return null;
};
