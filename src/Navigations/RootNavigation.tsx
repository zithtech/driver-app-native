
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

/* ---------- NAVIGATION CONSTANTS ---------- */

import {
  Auth_Nav,
  Onboarding_Nav,
  OnboardingSos_Nav,
  Dashboard_Nav,
  PickupMapScreen_Nav,
  DriverPerformance_Nav,
  HelpCenter_Nav,
  ContactSupport_Nav,
  AboutApp_Nav,
  EmergencySupport_Nav,
  LegalAgreements_Nav,
  DocumentScreen_Nav,
  DocumentUploadScreen_Nav,
  SmartSelfieScreen_Nav,
  PersonalDetails_Nav,
  AddressDetails_Nav,
  ProfileDetails_Nav,
  ProfileDocuments_Nav,
  SosContacts_Nav,
  PickupOTPScreen_Nav,
  DropMapScreen_Nav,
  ChatScreen_Nav,
  ScheduledRides_Nav,
  Blocked_Nav,
  ReferEarn_Nav,
} from './navigations';

import { navigationRef } from './navigationRef';

/* ---------- STACKS ---------- */

import AuthNavigation from './AuthNavigation';
import DriverTabs from './DriverTabs';

/* ---------- SCREENS ---------- */

import Onboarding from '../Screens/Onboarding/Onboarding';
import OnboardingSosScreen from '../Screens/Onboarding/OnboardingSosScreen';


import ScheduledRidesScreen from '../Screens/Requests/ScheduledRidesScreen';

import ProfileDetailsScreen from '../Screens/Profile/ProfileDetailsScreen';
import DriverPerformanceScreen from '../Screens/Profile/DriverPerformanceScreen';

import EarningsScreen from '../Screens/Profile/EarningsScreen';
import RideActivityScreen from '../Screens/Profile/RideActivityScreen';
import RideDetailScreen from '../Screens/Profile/RideDetailScreen';
import ProfileDocumentsScreen from '../Screens/Profile/ProfileDocumentsScreen';
import SosContactsScreen from '../Screens/Profile/SosContactsScreen';
import ProfileSettingsScreen from '../Screens/Profile/ProfileSettingsScreen';
import RechargePlanScreen from '../Screens/Profile/SubscriptionPlanScreen';
import MySubscriptionScreen from '../Screens/Profile/MySubscriptionScreen';
import WalletScreen from '../Screens/Profile/WalletScreen';
import ReferEarnScreen from '../Screens/Profile/ReferEarnScreen';
import SubscriptionSuccessScreen from '../Screens/Profile/SubscriptionSuccessScreen';

import PickupMapScreen from '../Screens/Requests/PickupMapScreen';
import PickupOTPScreen from '../Screens/Requests/PickupOTPScreen';
import DropMapScreen from '../Screens/Requests/DropMapScreen';
import PaymentCollectionScreen from '../Screens/Requests/PaymentCollectionScreen';

import HelpCenterScreen from '../Screens/Profile/Support/HelpCenterScreen';
import ContactSupportScreen from '../Screens/Profile/Support/ContactSupportScreen';
import AboutAppScreen from '../Screens/Profile/Support/AboutAppScreen';
import EmergencySupportScreen from '../Screens/Profile/Support/EmergencySupportScreen';
import LegalAgreementsScreen from '../Screens/Profile/Support/LegalAgreementsScreen';
import DocumentScreen from '../Screens/Auth/DocumentScreen';
import DocumentUploadScreen from '../Screens/Auth/DocumentUploadScreen';
import SmartSelfieScreen from '../Screens/Auth/SmartSelfieScreen';
import PersonalDetails from '../Screens/Auth/PersonalDetails';
import AddressDetails from '../Screens/Auth/AddressDetails';
import VehicleVerificationScreen from '../Screens/Requests/VehicleVerificationScreen';
import NavigationScreen from '../Screens/Navigation/NavigationScreen';
import ChatScreen from '../Screens/Chatscreen';
import BlockedScreen from '../Screens/Auth/BlockedScreen';

import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../redux/store';
import { useAuthBootstrap } from '../hooks/useAuthBootstrap';
import AnimationWithImperativeApi from '../Screens/Splash/SplashScreen';
import { useCallback, useEffect, useRef } from 'react';
import { useAlert } from '../context/AlertContext';
import { useTranslation } from 'react-i18next';
import { useGetTripByIdQuery } from '../service/driverApi';
import { clearAcceptedRide } from '../redux/rideSlice';
import socketService from '../service/socketService';
import audioService from '../utils/audioService';
import { StackActions } from '@react-navigation/native';
import { globalEmitter, EVENTS as GLOBAL_EVENTS } from '../utils/EventEmitter';

const Stack = createStackNavigator();

const RootNavigation = () => {
  // 1. Core Hooks (Always called, always in same order)
  const { isBootstrapping } = useAuthBootstrap();
  const user = useSelector((state: RootState) => state.userSlice.user);
  const currentRide = useSelector((state: RootState) => state.ride.currentRide);
  const dispatch = useDispatch();
  const { showAlert } = useAlert();
  const { t } = useTranslation();
  const isHandlingCancellation = useRef(false);

  const tripId = currentRide?.trip_id || (currentRide as any)?.id;
  const isAuthenticated = !!user?.accessToken;
  const onboardingStatus = user?.onboarding_status;

  // 2. API Hooks (RTK Query)
  const { data: tripData } = useGetTripByIdQuery(tripId || '', {
    skip: !tripId || !isAuthenticated,
    pollingInterval: 30000,
  });

  // 3. Callback Hooks
  const handleCancellation = useCallback((data: any) => {
    if (isHandlingCancellation.current) return;
    isHandlingCancellation.current = true;

    console.log('[RootNavigation] Trip cancellation detected:', data);

    const cancelledBy = data?.cancelledBy || 'USER';
    let voiceKey = 'rider_cancelled_voice';
    let msgKey = 'rider_cancelled_msg';

    if (cancelledBy === 'DRIVER') {
      voiceKey = 'driver_cancelled_voice';
      msgKey = 'driver_cancelled_msg';
    } else if (cancelledBy === 'ADMIN') {
      voiceKey = 'admin_cancelled_voice';
      msgKey = 'admin_cancelled_msg';
    }

    // 1. Voice alert
    audioService.speak(t(voiceKey) || 'The ride has been cancelled');

    // 2. Clear Redux State Immediately
    dispatch(clearAcceptedRide());

    // 3. Show Alert and Redirect
    showAlert({
      title: t('ride_cancelled') || 'Ride Cancelled',
      message: t(msgKey) || 'The ride has been cancelled.',
      singleButton: true,
      icon: 'close-circle-outline',
      onConfirm: () => {
        isHandlingCancellation.current = false; // Reset for future rides
        // Force immediate redirection for better UX
        if (navigationRef.isReady()) {
          navigationRef.dispatch(StackActions.replace(Dashboard_Nav));
        }
      }
    });
  }, [dispatch, showAlert, t]);

  // 2. Socket Listeners & Room Management
  useEffect(() => {
    if (!tripId || !isAuthenticated) return;

    // 📡 Global Room Management: Ensure we are always in the trip room
    console.log(`[RootNavigation] Ensuring driver is in room for trip: ${tripId}`);
    socketService.joinTripRoom(tripId, user?.driverId, 'DRIVER');

    console.log(`[RootNavigation] Monitoring active trip ${tripId} for cancellations...`);

    const events = [
        'trip_updated', 
        'TRIP_CANCELLED', 
        'rider_cancelled', 
        'SCHEDULED_RIDE_CANCELLED', 
        'trip_cancelled', 
        'CANCEL_RIDE',
        'RIDE_CANCELLED',
        'BOOKING_CANCELLED'
    ];

    const cancellationHandler = (data: any, eventName?: string) => {
      console.log(`[RootNavigation] Event reached cancellation handler: ${eventName}`, data);
      const status = data?.trip_status || data?.status;
      const isExplicitCancellationEvent = eventName && [
        'TRIP_CANCELLED', 
        'rider_cancelled', 
        'SCHEDULED_RIDE_CANCELLED', 
        'trip_cancelled', 
        'CANCEL_RIDE',
        'RIDE_CANCELLED',
        'BOOKING_CANCELLED'
      ].includes(eventName);

      if (isExplicitCancellationEvent || status === 'CANCELLED' || status === 'CANCEL' || status === 'MID_CANCELLED') {
        handleCancellation(data);
      }
    };

    events.forEach(event => {
      socketService.on(event, (data) => cancellationHandler(data, event));
    });

    // 📱 FCM Bridge: Handle cancellations received via Push Notifications
    const unsubscribeFCM = globalEmitter.on(GLOBAL_EVENTS.TRIP_CANCELLED, (data) => {
       console.log('[RootNavigation] Received cancellation via FCM bridge');
       handleCancellation(data);
    });

    return () => {
      console.log('[RootNavigation] Cleaning up listeners/room for trip:', tripId);
      events.forEach(event => socketService.off(event, cancellationHandler));
      unsubscribeFCM();
    };
  }, [tripId, user?.driverId, isAuthenticated, handleCancellation]);

  // 3. Polling Result Watcher
  useEffect(() => {
    if (tripData?.data) {
      const status = tripData.data.trip_status || tripData.data.status;
      if (status === 'CANCELLED' || status === 'CANCEL' || status === 'MID_CANCELLED') {
        handleCancellation(tripData.data);
      }
    }
  }, [tripData, handleCancellation]);

  /* ================= NAVIGATION LOGIC ================= */

  if (isBootstrapping) {
    if (__DEV__) { console.log('[RootNav] Waiting for bootstrap (Auth + Profile + ActiveTrip)...'); }
    return <AnimationWithImperativeApi />;
  }

  // Determine initial route based on authentication and onboarding progress
  let initialRoute = Auth_Nav;
  if (isAuthenticated) {
    const hasIdentity = !!(user?.first_name?.trim() && user?.last_name?.trim());
    const hasAddress = !!(user?.address?.street?.trim() && user?.address?.city?.trim());

    const isActiveUser =
      onboardingStatus === 'DOCUMENTS_APPROVED' ||
      onboardingStatus === 'DOCUMENTS_VERIFIED' ||
      onboardingStatus === 'SUBSCRIPTION_ACTIVE' ||
      onboardingStatus === 'ACTIVE';

    if (__DEV__) {
      console.log('[RootNav] onboarding_status:', onboardingStatus, '| isActive:', isActiveUser);
      console.log('[RootNav] Identity check:', { first: !!user?.first_name, last: !!user?.last_name, hasIdentity });
      console.log('[RootNav] Address check:', { street: !!user?.address?.street, city: !!user?.address?.city, hasAddress });
    }

    // 🛡️ 0. ACCOUNT STATUS GUARD (HIGHEST PRIORITY)
    // If account is blocked or suspended, stay on Blocked screen
    if (user?.status === 'blocked' || user?.status === 'suspended') {
        initialRoute = Blocked_Nav;
    } 
    // 🛡️ 1. TRIP RECOVERY
    else if (currentRide) {
      const rawStatus = (currentRide.trip_status || (currentRide as any).status || '').toUpperCase();
      const isScheduled = (currentRide as any)?.booking_type === 'SCHEDULED' || (currentRide as any)?.is_scheduled;

      if (
        (['ARRIVING', 'ARRIVED'].includes(rawStatus)) || 
        (rawStatus === 'ACCEPTED' && !isScheduled)
      ) {
        initialRoute = PickupMapScreen_Nav;
      } else if (rawStatus === 'VERIFICATION_PENDING') {
        initialRoute = 'VehicleVerificationScreen';
      } else if (['LIVE', 'STARTED', 'ON_TRIP', 'DESTINATION_REACHED'].includes(rawStatus)) {
        initialRoute = DropMapScreen_Nav;
      }
      
      // If a route was determined by recovery, we can skip standard onboarding checks
      if (initialRoute !== Auth_Nav) {
        if (__DEV__) { console.log('[RootNav] 🚖 Trip Recovery Active | Status:', rawStatus, '| Target:', initialRoute); }
      }
    }

    // 🛡️ 2. STANDARD ONBOARDING & DASHBOARD FLOW
    // Only proceed if Trip Recovery didn't already set a destination
    if (initialRoute === Auth_Nav) {
      if (isActiveUser) {
        initialRoute = Dashboard_Nav;
      } else if (onboardingStatus === 'PHONE_VERIFIED' || !onboardingStatus) {
        initialRoute = PersonalDetails_Nav;
      } else if (onboardingStatus === 'PROFILE_COMPLETED') {
        initialRoute = AddressDetails_Nav;
      } else if (onboardingStatus === 'ADDRESS_COMPLETED') {
        initialRoute = Onboarding_Nav;
      } else if (
        onboardingStatus === 'DOCS_SUBMITTED' ||
        onboardingStatus === 'DOCS_UPLOADING' ||
        onboardingStatus === 'DOCS_REJECTED'
      ) {
        initialRoute = DocumentScreen_Nav;
      } else if (!hasIdentity) {
        initialRoute = PersonalDetails_Nav;
      } else if (!hasAddress) {
        initialRoute = AddressDetails_Nav;
      } else {
        initialRoute = Dashboard_Nav;
      }
    }

    if (__DEV__) { 
      console.log('[RootNav] Bootstrap Complete | route:', initialRoute); 
    }
  }

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false }}
    >
      {/* -------- AUTH -------- */}
      {!isAuthenticated ? (
        <Stack.Screen name={Auth_Nav} component={AuthNavigation} />
      ) : (
        <>
          {/* -------- SIGNUP FLOW (POST-AUTH) -------- */}
          <Stack.Screen name={PersonalDetails_Nav} component={PersonalDetails} />
          <Stack.Screen name={AddressDetails_Nav} component={AddressDetails} />
          {/* -------- ONBOARDING -------- */}
          <Stack.Screen name={Onboarding_Nav} component={Onboarding} />
          <Stack.Screen name={OnboardingSos_Nav} component={OnboardingSosScreen} />

          {/* -------- DOCUMENTS -------- */}
          <Stack.Screen name={DocumentScreen_Nav} component={DocumentScreen} />
          <Stack.Screen name={DocumentUploadScreen_Nav} component={DocumentUploadScreen} />
          <Stack.Screen name={SmartSelfieScreen_Nav} component={SmartSelfieScreen} options={{ headerShown: false, presentation: 'modal' }} />

          {/* -------- DASHBOARD -------- */}
          <Stack.Screen name={Dashboard_Nav} component={DriverTabs} />

          {/* -------- REQUEST -------- */}
          <Stack.Screen name={ScheduledRides_Nav} component={ScheduledRidesScreen} />

          {/* -------- PROFILE -------- */}
          <Stack.Screen name={ProfileDetails_Nav} component={ProfileDetailsScreen} />
          <Stack.Screen name={DriverPerformance_Nav} component={DriverPerformanceScreen} />

          <Stack.Screen name="EarningsScreen" component={EarningsScreen} />
          <Stack.Screen name="RideActivityScreen" component={RideActivityScreen} />
          <Stack.Screen name="RideDetailScreen" component={RideDetailScreen} />
          <Stack.Screen name={ProfileDocuments_Nav} component={ProfileDocumentsScreen} />
          <Stack.Screen name={SosContacts_Nav} component={SosContactsScreen} />
          <Stack.Screen name="ProfileSettingsScreen" component={ProfileSettingsScreen} />
          <Stack.Screen name={HelpCenter_Nav} component={HelpCenterScreen} />
          <Stack.Screen name={ContactSupport_Nav} component={ContactSupportScreen} />
          <Stack.Screen name={AboutApp_Nav} component={AboutAppScreen} />
          <Stack.Screen name={EmergencySupport_Nav} component={EmergencySupportScreen} />
          <Stack.Screen name={LegalAgreements_Nav} component={LegalAgreementsScreen} />
          <Stack.Screen name="RechargePlanScreen" component={RechargePlanScreen} />
          <Stack.Screen name="MySubscriptionScreen" component={MySubscriptionScreen} />
          <Stack.Screen name="SubscriptionSuccessScreen" component={SubscriptionSuccessScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="WalletScreen" component={WalletScreen} />
          <Stack.Screen name={ReferEarn_Nav} component={ReferEarnScreen} />

          {/* -------- TRIP FLOW -------- */}
          <Stack.Screen name={PickupMapScreen_Nav} component={PickupMapScreen} />
          <Stack.Screen name="VehicleVerificationScreen" component={VehicleVerificationScreen} />
          <Stack.Screen name="DropMapScreen" component={DropMapScreen} />
          <Stack.Screen name="PaymentCollectionScreen" component={PaymentCollectionScreen} />
          <Stack.Screen name="NavigationScreen" component={NavigationScreen} />
          <Stack.Screen name={ChatScreen_Nav} component={ChatScreen} />

          {/* -------- ACCOUNT STATUS -------- */}
          <Stack.Screen name={Blocked_Nav} component={BlockedScreen} options={{ gestureEnabled: false }} />
        </>
      )}
    </Stack.Navigator>
  );
};

export default RootNavigation;
