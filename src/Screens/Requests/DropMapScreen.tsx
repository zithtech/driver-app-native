import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  Image,
  StatusBar,
  Modal,
  Animated as RNAnimated,
  BackHandler,
  ScrollView,
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, LatLng, AnimatedRegion } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { GOOGLE_MAPS_API_KEY } from '../../constant/config';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect, StackActions } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { useAlert } from '../../context/AlertContext';
import { mS as ms, vS as vs } from '../../lib/scale';
import BottomSheet, { BottomSheetView, BottomSheetBackgroundProps } from '@gorhom/bottom-sheet';
import SwipeButton from '../Dashboard/dashComponents/SwipeButton';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../redux/store';
import { resetUnreadCount } from '../../redux/chatSlice';
import { useLocation } from '../../hooks/useLocation';
import { useDestinationReachedTripMutation, useTriggerSosMutation, useCancelTripMutation, useGetTripByIdQuery } from '../../service/driverApi';
import { clearAcceptedRide } from '../../redux/rideSlice';
import { MapConnectionStatus, CancellationModal } from '../../Components';
import { useLocationTracker } from '../../hooks/useLocationTracker';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useHaptic } from '../../hooks/useHaptic';
import socketService from '../../service/socketService';
import audioService from '../../utils/audioService';
import Clipboard from '@react-native-clipboard/clipboard';
import LinearGradient from 'react-native-linear-gradient';
import { ChatScreen_Nav } from '../../Navigations/navigations';

// Premium Dark Map Style
const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
  { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38414e" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#212a37" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#746855" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] }
];

const DropMapScreen = ({ route }: any) => {
  // 1. Core Hooks
  const { showAlert, hideAlert } = useAlert();
  const { t } = useTranslation();
  const navigation = useNavigation<StackNavigationProp<any>>();
  const theme = useAppTheme().theme;
  const isDark = useAppTheme().isDark;
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { watchLocation, getCurrentLocation } = useLocation();
  const { triggerHaptic } = useHaptic() || {};

  // 2. Redux Store Selectors
  const user = useSelector((state: RootState) => state.userSlice?.user);
  const reduxCurrentRide = useSelector((state: RootState) => state.ride.currentRide);
  const ride = reduxCurrentRide || route?.params?.ride || {};
  const unreadCount = useSelector((state: RootState) => state.chat?.unreadCounts[(ride.trip_id || ride.id)?.toString()] || 0);

  // 3. API Mutation Hooks
  const [destinationReachedApi] = useDestinationReachedTripMutation();
  const [triggerSosApi] = useTriggerSosMutation();
  const [cancelTripApi, { isLoading: isCancelling }] = useCancelTripMutation();

  // 4. Persistence Refs
  const mapRef = useRef<MapView>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const waypointIndexRef = useRef(0);
  const lastEmittedLoc = useRef<LatLng | null>(null);
  const lastEmittedTime = useRef<number>(0);
  const routeCoordsRef = useRef<LatLng[]>([]);
  const lastLocationPos = useRef<LatLng | null>(null);
  const isUserInteracting = useRef(false);
  const markerRotationRef = useRef(0);
  const isSimulatingRef = useRef(false);
  const isArrivedRef = useRef(false);
  const isExitingRef = useRef(false);
  const simInterval = useRef<any>(null);

  // Normalize Drop-off coordinates
  const drop_lat = parseFloat(ride.drop_lat?.toString() || "0");
  const drop_lng = parseFloat(ride.drop_lng?.toString() || "0");
  const hasValidCoords = !!(drop_lat && drop_lng);
  const trip_id = ride?.trip_id || ride?.id || '';

  const initialDistance = useRef(parseFloat(ride.distance_km?.toString()) || 5.0);
  const initialEta = useRef(parseFloat(ride.trip_duration_minutes?.toString()) || 15);

  // === State Declarations ===
  const [driverLocation, setDriverLocation] = useState<LatLng | null>(null);
  const [markerRotation, setMarkerRotation] = useState(0);

  const handleCopyTripCode = useCallback(() => {
    const code = ride.trip_code || ride.booking_code;
    if (code) {
      Clipboard.setString(code);
      triggerHaptic?.(HapticFeedbackTypes.notificationSuccess);
      showAlert({
        title: t('copied') || 'Copied',
        message: t('trip_code_copied') || 'Trip code copied to clipboard',
        singleButton: true,
        icon: 'checkmark-circle-outline',
      });
    }
  }, [ride.trip_code, ride.booking_code, triggerHaptic, showAlert, t]);
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [currentWaypointIndex, setCurrentWaypointIndex] = useState(0);
  const [isTracking, setIsTracking] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [shouldFetchRoute, setShouldFetchRoute] = useState(true);
  const [isAutoFollow, setIsAutoFollow] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [mapMargin, setMapMargin] = useState(1);
  const [distance, setDistance] = useState(initialDistance.current);
  const [eta, setEta] = useState(initialEta.current);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRideDetailsModal, setShowRideDetailsModal] = useState(false);

  const getVehicleInfo = useCallback((type?: string) => {
    const lowerType = type?.toLowerCase() || '';
    if (lowerType.includes('driver_only')) {
      return { icon: 'steering' as const, label: t('service_type_driver_only'), color: '#3B82F6' };
    }
    if (lowerType.includes('premium') || lowerType.includes('sedan') || lowerType.includes('luxury')) {
      return { icon: 'car' as const, label: type || t('premium_sedan'), color: '#3B82F6' };
    }
    if (lowerType.includes('suv') || lowerType.includes('xl')) {
      return { icon: 'car-suv' as const, label: type || 'SUV / XL', color: '#8B5CF6' };
    }
    if (lowerType.includes('hatchback') || lowerType.includes('mini') || lowerType.includes('go')) {
      return { icon: 'car-hatchback' as const, label: type || 'Mini / Hatchback', color: '#10B981' };
    }
    if (lowerType.includes('bike') || lowerType.includes('moto')) {
      return { icon: 'motorbike' as const, label: type || 'Bike / Moto', color: '#F59E0B' };
    }
    return { icon: 'car' as const, label: type || t('standard_service'), color: '#64748B' };
  }, [t]);

  const vehicleInfo = useMemo(() => 
    getVehicleInfo(ride.car_name || ride.vehicle_model || ride.ride_type || ride.service_type),
    [ride.car_name, ride.vehicle_model, ride.ride_type, ride.service_type, getVehicleInfo]
  );

  const driverAnimatedLocation = useRef(new AnimatedRegion({
    latitude: drop_lat || 0,
    longitude: drop_lng || 0,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  })).current;

  const successScale = useSharedValue(0);
  const animatedSuccessStyle = useAnimatedStyle(() => ({
    transform: [{ scale: successScale.value }],
    opacity: successScale.value,
  }));

  // 📍 High-fidelity unified location tracker
  const { locationDisabled } = useLocationTracker({
    driverId: user?.driverId,
    isTracking: isTracking,
    tripId: trip_id,
    mode: 'moving',
    suppressEmission: isTracking && !isSimulating,
  });

  const handleStartTrip = useCallback(() => {
    console.log("🚀 Trip tracking active for:", trip_id);
    setIsTracking(true);
  }, [trip_id]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        showAlert({
          title: t('active_trip'),
          message: t('active_trip_cancel_msg'),
          singleButton: true,
          icon: 'car-outline',
        });
        return true;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      navigation.setOptions({ gestureEnabled: false });

      return () => {
        subscription.remove();
        navigation.setOptions({ gestureEnabled: true });
      };
    }, [showAlert, t, navigation])
  );

  // 🛡️ Guard: Exit screen if ride is cleared from Redux (e.g. by global cancellation)
  useEffect(() => {
    if (!reduxCurrentRide && !showSuccess) {
      console.log('[DropMapScreen] Active ride cleared from Redux, exiting...');
      isExitingRef.current = true;
      navigation.dispatch(StackActions.replace('DashboardScreen'));
    }
  }, [reduxCurrentRide, navigation, showSuccess]);

  useEffect(() => {
    const initLocation = async () => {
      try {
        const pos = await getCurrentLocation();
        const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setDriverLocation(loc);
        driverAnimatedLocation.setValue({ ...loc, latitudeDelta: 0.01, longitudeDelta: 0.01 });
      } catch (err) {
        console.warn('Initial Location Error:', err);
      }
    };
    initLocation();
  }, [getCurrentLocation, driverAnimatedLocation]);

  useEffect(() => {
    // 🛡️ Guard: Only connect if driverId is available
    if (!user?.driverId) return;

    socketService.connect(user.driverId, 'DRIVER');
    const tId = ride.trip_id || ride.id;
    if (tId) {
      socketService.joinTripRoom(tId.toString(), user.driverId, 'DRIVER');
    }
    handleStartTrip();

    setIsTracking(true);

    // Cleanup: Just leave the trip room, stay connected to the general driver room
    return () => {
      console.log('🧹 Cleaning up DropMapScreen room state...');
      socketService.leaveTripRoom();
    };
  }, [ride.trip_id, ride.id, user?.driverId, handleStartTrip]);

  const dropLocation: LatLng = useMemo(() => ({
    latitude: drop_lat,
    longitude: drop_lng,
  }), [drop_lat, drop_lng]);

  const handleSOS = useCallback(() => {
    showAlert({
      title: t('sos'),
      message: t('sos_message') || 'Are you in an emergency?',
      icon: 'alert-circle',
      onConfirm: async () => {
        try {
          await triggerSosApi({ trip_id: trip_id.toString() }).unwrap();
          showAlert({ title: t('sos_triggered'), message: t('sos_triggered_msg'), singleButton: true, icon: 'checkmark-circle' });
        } catch (error) { Linking.openURL('tel:112'); }
      }
    });
    triggerHaptic?.(HapticFeedbackTypes.impactHeavy);
  }, [trip_id, showAlert, t, triggerSosApi, triggerHaptic]);

  const calculateBearing = useCallback((start: LatLng, end: LatLng) => {
    const startLat = (start.latitude * Math.PI) / 180;
    const startLng = (start.longitude * Math.PI) / 180;
    const endLat = (end.latitude * Math.PI) / 180;
    const endLng = (end.longitude * Math.PI) / 180;
    const y = Math.sin(endLng - startLng) * Math.cos(endLat);
    const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  }, []);

  // 📐 Math Helper: Distance between two coordinates in meters
  const getDistanceMeters = useCallback((p1: LatLng, p2: LatLng) => {
    const dLat = p2.latitude - p1.latitude;
    const dLng = p2.longitude - p1.longitude;
    return Math.sqrt(dLat * dLat + dLng * dLng) * 111000;
  }, []);

  // 📐 Math Helper: Project a point onto a line segment (P1 to P2)
  const projectPointOnSegment = useCallback((point: LatLng, p1: LatLng, p2: LatLng) => {
    const L2 = Math.pow(p2.latitude - p1.latitude, 2) + Math.pow(p2.longitude - p1.longitude, 2);
    if (L2 === 0) return p1;

    let t = ((point.latitude - p1.latitude) * (p2.latitude - p1.latitude) +
      (point.longitude - p1.longitude) * (p2.longitude - p1.longitude)) / L2;
    t = Math.max(0, Math.min(1, t));

    return {
      latitude: p1.latitude + t * (p2.latitude - p1.latitude),
      longitude: p1.longitude + t * (p2.longitude - p1.longitude),
    };
  }, []);

  // 📍 Core Logic: Snap raw GPS point to the nearest point on the route polyline
  const snapToRoute = useCallback((rawPoint: LatLng) => {
    if (!routeCoordsRef.current || routeCoordsRef.current.length < 2) {
      return { snappedPoint: rawPoint, bearing: markerRotationRef.current, index: waypointIndexRef.current };
    }

    let minDistance = Infinity;
    let bestPoint = rawPoint;
    let bestIndex = waypointIndexRef.current;
    let bestBearing = markerRotationRef.current;

    // Search window around current progress for performance (Lookahead of 15 segments)
    const start = Math.max(0, waypointIndexRef.current - 2);
    const end = Math.min(routeCoordsRef.current.length - 1, waypointIndexRef.current + 15);

    for (let i = start; i < end; i++) {
      const p1 = routeCoordsRef.current[i];
      const p2 = routeCoordsRef.current[i + 1];
      const projected = projectPointOnSegment(rawPoint, p1, p2);
      const distance = getDistanceMeters(rawPoint, projected);

      if (distance < minDistance) {
        minDistance = distance;
        bestPoint = projected;
        bestIndex = i;
        bestBearing = calculateBearing(p1, p2);
      }
    }

    // Threshold: If raw GPS is > 40m away, don't snap (assume deviation)
    if (minDistance > 40) {
      return { snappedPoint: rawPoint, bearing: markerRotationRef.current, index: waypointIndexRef.current, deviated: true };
    }

    return { snappedPoint: bestPoint, bearing: bestBearing, index: bestIndex, deviated: false };
  }, [calculateBearing, getDistanceMeters, projectPointOnSegment]);

  // 📐 Math Helper: Sum of remaining distance along polyline from current waypoint
  const calculateRemainingDistance = useCallback((index: number, route: LatLng[]) => {
    if (!route || route.length === 0 || index >= route.length - 1) return 0;
    let remaining = 0;
    for (let i = index; i < route.length - 1; i++) {
      remaining += getDistanceMeters(route[i], route[i + 1]);
    }
    return remaining / 1000; // Return in KM
  }, [getDistanceMeters]);

  // Smooth Drive Simulation following the Google Map Route
  const startDriveSimulation = useCallback(() => {
    if (isSimulatingRef.current) {
      if (simInterval.current) clearInterval(simInterval.current);
      isSimulatingRef.current = false;
      setIsSimulating(false);
      handleStartTrip();
      return;
    }

    if (routeCoords.length === 0) {
      console.log("⏳ Route not ready for simulation...");
      return;
    }

    setIsTracking(false);
    isSimulatingRef.current = true;
    setIsSimulating(true);
    let step = waypointIndexRef.current;

    socketService.joinTripRoom(ride?.trip_id || ride?.id, user?.driverId, 'DRIVER');

    simInterval.current = setInterval(() => {
      if (step >= routeCoords.length - 1) {
        setDriverLocation(dropLocation);
        setCurrentWaypointIndex(routeCoords.length - 1);
        if (simInterval.current) {
          clearInterval(simInterval.current);
          simInterval.current = null;
        }
        isSimulatingRef.current = false;
        setIsSimulating(false);
        return;
      }

      const currentPos = routeCoords[step];
      const nextPos = routeCoords[step + 1];
      const heading = calculateBearing(currentPos, nextPos);
      setMarkerRotation(heading);

      step++;
      setDriverLocation(nextPos);
      setCurrentWaypointIndex(step);

      (driverAnimatedLocation as any).timing({
        ...nextPos,
        duration: 1000,
        useNativeDriver: false,
      }).start();

      if (step % 4 === 0 || step >= routeCoords.length - 1) {
        const remainKm = calculateRemainingDistance(step, routeCoords);
        const currentDistance = parseFloat(remainKm.toFixed(1));
        const factor = initialDistance.current > 0 ? (initialEta.current / initialDistance.current) : 4;
        const currentEta = Math.max(1, Math.round(remainKm * factor));

        console.log(`🏎️ [Sim] Emitting Location: [${nextPos.latitude.toFixed(5)}, ${nextPos.longitude.toFixed(5)}] | Heading: ${heading.toFixed(1)} | ETA: ${currentEta} | Dist: ${currentDistance}`);
        socketService.emitLocationUpdate(
          ride?.trip_id || ride?.id,
          nextPos.latitude,
          nextPos.longitude,
          heading,
          currentEta,
          currentDistance
        );

        setDistance(currentDistance);
        setEta(currentEta);
      }

      if (isAutoFollow && mapRef.current) {
        mapRef.current.animateCamera({
          center: nextPos,
          heading: heading,
          pitch: 45,
          zoom: 18,
        }, { duration: 1000 });
      }
    }, 1200);
  }, [routeCoords, dropLocation, ride.trip_id, ride.id, user?.driverId, driverAnimatedLocation, calculateBearing, isAutoFollow, handleStartTrip, calculateRemainingDistance]);

  // Clean up simulation and animation on unmount
  useEffect(() => {
    return () => {
      isExitingRef.current = true;
      if (simInterval.current) {
        clearInterval(simInterval.current);
        simInterval.current = null;
      }
      try {
        (driverAnimatedLocation as any).stopAnimation();
      } catch (e) { }
    };
  }, [driverAnimatedLocation]);

  // 🧭 Real-time Professional Navigation Loop
  useEffect(() => {
    if (isSimulating || !isTracking || isExitingRef.current) return;

    const watchId = watchLocation(
      (pos) => {
        if (isExitingRef.current) return;
        const rawLoc = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };

        const { snappedPoint, bearing, index, deviated } = snapToRoute(rawLoc);

        if (deviated) {
          console.log(`🚦 [Movement] Deviated from route! Raw: [${rawLoc.latitude.toFixed(5)}, ${rawLoc.longitude.toFixed(5)}]`);
        }

        setDriverLocation(snappedPoint);
        setCurrentWaypointIndex(index);

        const distMoved = lastLocationPos.current ? getDistanceMeters(lastLocationPos.current, snappedPoint) : 10;

        if (distMoved > 2) {
          setMarkerRotation(bearing);

          if (isAutoFollow && !isUserInteracting.current && mapRef.current) {
            mapRef.current.animateCamera({
              center: snappedPoint,
              heading: bearing,
              pitch: 45,
              zoom: 18,
            }, { duration: 1000 });
          }
          lastLocationPos.current = snappedPoint;
        } else if (isAutoFollow && !isUserInteracting.current && mapRef.current) {
          mapRef.current.animateCamera({
            center: snappedPoint,
            pitch: 45,
            zoom: 18,
          }, { duration: 1000 });
        }

        (driverAnimatedLocation as any).timing({
          ...snappedPoint,
          duration: 1000,
          useNativeDriver: false,
        }).start();

        const distSinceLastEmit = lastEmittedLoc.current ? getDistanceMeters(lastEmittedLoc.current, snappedPoint) : 20;
        const timeSinceLastEmit = Date.now() - lastEmittedTime.current;

        if (distSinceLastEmit >= 10 || timeSinceLastEmit >= 20000) {
          console.log(`📡 [Socket] Emitting Snapped Location: [${snappedPoint.latitude.toFixed(5)}, ${snappedPoint.longitude.toFixed(5)}] | Bearing: ${bearing.toFixed(1)} | ETA: ${eta} | Dist: ${distance}`);
          socketService.emitLocationUpdate(
            ride?.trip_id || ride?.id,
            snappedPoint.latitude,
            snappedPoint.longitude,
            bearing,
            eta || 0,
            distance || 0
          );
          lastEmittedLoc.current = snappedPoint;
          lastEmittedTime.current = Date.now();
        }

        const remainKm = calculateRemainingDistance(index, routeCoordsRef.current);
        setDistance(parseFloat(remainKm.toFixed(1)));
        const factor = initialDistance.current > 0 ? (initialEta.current / initialDistance.current) : 4;
        setEta(Math.max(1, Math.round(remainKm * factor)));

        if (deviated) {
          const distToPath = getDistanceMeters(rawLoc, snappedPoint);
          if (distToPath > 100) {
            console.log("🚦 Deviation detected! Re-fetching route...");
            setShouldFetchRoute(true);
          }
        }
      },
      (err) => console.warn('Navigation Error:', err),
      {
        enableHighAccuracy: true,
        distanceFilter: 2,
        interval: 1000,
        fastestInterval: 500,
      }
    );

    return () => {
      if (watchId !== null) Geolocation.clearWatch(watchId);
    };
  }, [isTracking, isAutoFollow, isSimulating, watchLocation, driverAnimatedLocation, snapToRoute, getDistanceMeters, calculateRemainingDistance]);

  const handleEndTrip = useCallback(async () => {
    // Calculate final duration in minutes
    const startTimeStr = ride?.started_at || ride?.actual_pickup_time;
    const calculatedDuration = startTimeStr 
        ? Math.max(1, Math.round((Date.now() - new Date(startTimeStr).getTime()) / 60000))
        : (initialEta.current || 15);

    const confirmEndTrip = async () => {
      try {
        await destinationReachedApi(trip_id.toString()).unwrap();
        setShowSuccess(true);
        successScale.value = withSpring(1, { damping: 10, stiffness: 100 });
        triggerHaptic?.(HapticFeedbackTypes.notificationSuccess);
        setTimeout(() => {
          setShowSuccess(false);
          navigation.replace('PaymentCollectionScreen', { 
            ride,
            actualDistance: distance,
            actualDuration: calculatedDuration
          });
        }, 2000);
      } catch (error: any) {
        showAlert({
          title: t('common.error'),
          message: error?.data?.message || t('failed_end_trip') || 'Failed to finish trip',
          singleButton: true,
          icon: 'alert-circle-outline',
        });
      }
    };

    // 🏁 Distance Guard: Check if driver is still far (> 500m) from destination
    if (distance > 0.5) {
      showAlert({
        title: t('far_from_destination') || 'Wait!',
        message: t('far_from_destination_msg') || 'You are still far from the drop-off location. Are you sure the trip has ended?',
        icon: 'location-outline',
        onConfirm: () => confirmEndTrip(),
        onCancel: () => console.log('End trip cancelled by driver'),
      });
    } else {
      confirmEndTrip();
    }
  }, [trip_id, destinationReachedApi, successScale, triggerHaptic, navigation, ride, distance, showAlert, t]);

  const handleCancelTrip = async (reason: string) => {
    const isStandard = [
      'PERSONAL_EMERGENCY',
      'VEHICLE_PROBLEM',
      'PICKUP_TOO_FAR',
      'RIDER_NOT_RESPONDING',
      'RIDER_ASKED_TO_CANCEL',
      'TECHNICAL_ISSUE'
    ].includes(reason);

    try {
      await cancelTripApi({
        tripId: trip_id,
        cancel_reason: isStandard ? reason : 'OTHER',
        cancel_by: 'DRIVER',
        notes: isStandard ? undefined : reason
      }).unwrap();

      setShowCancelModal(false);
      showAlert({
        title: t('trip_cancelled'),
        message: t('trip_cancelled_msg') || 'The trip has been cancelled successfully.',
        singleButton: true,
        icon: 'close-circle-outline',
      });

      setTimeout(() => {
        hideAlert();
        dispatch(clearAcceptedRide());
        navigation.dispatch(StackActions.replace('DashboardScreen'));
      }, 1500);
    } catch (error: any) {
      console.error('Cancellation failed:', error);
      showAlert({
        title: t('common.error'),
        message: error?.data?.message || t('failed_cancel_trip') || 'Failed to cancel trip. Please try again.',
        singleButton: true,
        icon: 'alert-circle-outline',
        onConfirm: error?.status === 500 ? () => {
          dispatch(clearAcceptedRide());
          navigation.dispatch(StackActions.replace('DashboardScreen'));
        } : undefined
      });
    }
  };

  const handleChatPress = () => {
    navigation.navigate(ChatScreen_Nav, {
      rideId: trip_id,
      userId: user?.driverId,
      userName: ride.passenger || ride.passenger_details?.name || ride.passenger_name || ride.customer?.name || t('rider'),
      userImage: ride.passenger_details?.image || ride.riderImage,
      userPhone: ride.phone || ride.riderPhone || ride.customer?.phone || ride.passenger_phone,
    });
    triggerHaptic?.(HapticFeedbackTypes.impactLight);
  };

  const fitToTrip = useCallback(() => {
    if (mapRef.current && driverLocation) {
      mapRef.current.fitToCoordinates([driverLocation, dropLocation], {
        edgePadding: {
          top: vs(120),
          right: ms(50),
          bottom: vs(380),
          left: ms(50),
        },
        animated: true,
      });
    }
  }, [driverLocation, dropLocation]);

  useEffect(() => {
    const timer = setTimeout(fitToTrip, 1000);
    return () => clearTimeout(timer);
  }, []);

  const pulseAnim = useRef(new RNAnimated.Value(1)).current;
  useEffect(() => {
    RNAnimated.loop(RNAnimated.sequence([
      RNAnimated.timing(pulseAnim, { toValue: 1.3, duration: 1200, useNativeDriver: true }),
      RNAnimated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
    ])).start();
  }, [pulseAnim]);

  const snapPoints = useMemo(() => ['42%', '65%'], []);

  const CustomBackground = useCallback(({ style }: BottomSheetBackgroundProps) => (
    <View style={[style, {
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: ms(32),
      borderTopRightRadius: ms(32),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -10 },
      shadowOpacity: 0.1,
      shadowRadius: 15,
      elevation: 24,
    }]} />
  ), [theme.colors.card]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar animated={false} barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <MapConnectionStatus />

      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={[styles.map, { marginBottom: mapMargin }]}
        onMapReady={() => setMapMargin(0)}
        onPanDrag={() => {
          if (isAutoFollow) setIsAutoFollow(false);
          isUserInteracting.current = true;
          setTimeout(() => { isUserInteracting.current = false; }, 1000);
        }}
        initialRegion={{
          latitude: driverLocation?.latitude || drop_lat || 0,
          longitude: driverLocation?.longitude || drop_lng || 0,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        customMapStyle={isDark ? darkMapStyle : []}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {shouldFetchRoute && driverLocation && hasValidCoords && (
          <MapViewDirections
            origin={driverLocation}
            destination={dropLocation}
            apikey={GOOGLE_MAPS_API_KEY}
            strokeWidth={0}
            strokeColor={theme.colors.primary}
            onReady={(result) => {
              setRouteCoords(result.coordinates);
              routeCoordsRef.current = result.coordinates;
              const distSinceLastEmit = lastEmittedLoc.current ? getDistanceMeters(lastEmittedLoc.current, driverLocation) : 20;
              if (distSinceLastEmit > 10) {
                setDistance(parseFloat(result.distance.toFixed(1)));
                setEta(Math.ceil(result.duration));
              }
              setShouldFetchRoute(false);
            }}
          />
        )}

        {routeCoords.length > 0 && (
          <>
            {/* Background "Ghost" Path (Full Route) */}
            <Polyline
              coordinates={routeCoords}
              strokeWidth={vs(6)}
              strokeColor={isDark ? "rgba(239, 68, 68, 0.15)" : "rgba(239, 68, 68, 0.1)"}
              lineCap="round"
              lineJoin="round"
              zIndex={4}
            />
            {/* Active Path (Remaining Route) */}
            {routeCoords.length > currentWaypointIndex && (
              <Polyline
                coordinates={routeCoords.slice(currentWaypointIndex)}
                strokeWidth={vs(6)}
                strokeColor={theme.colors.primary}
                lineCap="round"
                lineJoin="round"
                zIndex={5}
              />
            )}
          </>
        )}

        <Marker.Animated coordinate={driverAnimatedLocation as any} flat anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.markerContainer}>
            <RNAnimated.View style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }], opacity: pulseAnim.interpolate({ inputRange: [1, 1.3], outputRange: [0.6, 0] }) }]} />
            <View style={[styles.driverMarker, { backgroundColor: theme.colors.primary }]}>
              <Ionicons name="car" size={ms(18)} color="#fff" style={{ transform: [{ rotate: `${markerRotation}deg` }] }} />
            </View>
          </View>
        </Marker.Animated>
        <Marker coordinate={dropLocation}>
          <View style={styles.destMarker}>
            <LinearGradient colors={['#EF4444', '#B91C1C']} style={styles.destCircle}>
              <Ionicons name="location" size={ms(20)} color="#fff" />
            </LinearGradient>
          </View>
        </Marker>
      </MapView>

      {/* Top Overlays */}
      <View style={[styles.topOverlay, { top: insets.top + vs(10) }]}>
        <Animated.View
          entering={FadeInDown}
          style={styles.liveIndicator}
        >
          <View style={styles.liveDot} />
          <Text style={styles.liveText} numberOfLines={1} adjustsFontSizeToFit>{t('pickup.live_tracking') || 'Live Tracking Active'}</Text>
        </Animated.View>

        <View style={styles.rightActionsColumn}>
          <TouchableOpacity
            style={[styles.sosButton, { backgroundColor: '#B91C1C' }]}
            onPress={handleSOS}
          >
            <Ionicons name="alert-circle" size={ms(18)} color="#FFF" style={{ marginRight: ms(6) }} />
            <Text style={styles.sosText} numberOfLines={1} adjustsFontSizeToFit>{t('sos') || 'SOS'}</Text>
          </TouchableOpacity>

          {routeCoords.length > 0 && (
            <TouchableOpacity
              style={[styles.recenterFab, { backgroundColor: isSimulating ? theme.colors.error : theme.colors.card, marginTop: vs(10) }]}
              onPress={startDriveSimulation}
            >
              <Ionicons
                name={isSimulating ? "stop-circle" : "play-circle"}
                size={ms(28)}
                color={isSimulating ? "#FFF" : theme.colors.primary}
              />
            </TouchableOpacity>
          )}

          {!isAutoFollow && (
            <TouchableOpacity
              style={[styles.recenterFab, { backgroundColor: theme.colors.card }]}
              onPress={() => setIsAutoFollow(true)}
            >
              <MaterialCommunityIcons name="navigation-variant" size={ms(24)} color={theme.colors.primary} />
            </TouchableOpacity>
          )}

        </View>
      </View>

      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        backgroundComponent={CustomBackground}
      >
        <BottomSheetView style={[styles.bottomSheetContent, { paddingBottom: insets.bottom + vs(20) }]}>
          <>
            {/* Rider Info Card */}
            <View style={styles.riderRow}>
              {ride.passenger_details?.image || ride.riderImage ? (
                <Image 
                  source={{ uri: ride.riderImage || ride.passenger_details?.image }} 
                  style={[styles.riderAvatar, { borderColor: isDark ? '#1E293B' : '#FFF' }]} 
                />
              ) : (
                <View style={[styles.riderAvatar, { backgroundColor: isDark ? '#1E293B' : '#EEF2FF', justifyContent: 'center', alignItems: 'center', borderWidth: 0 }]}>
                  <Text style={[styles.avatarInitials, { color: theme.colors.primary, fontSize: ms(18), fontWeight: '800' }]}>
                    {(ride.passenger || ride.passenger_details?.name || 'P').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.riderMeta}>
                <Text style={[styles.riderName, { color: theme.colors.text }]} numberOfLines={2}>
                  {ride.passenger_details?.name || ride.passenger || ride.passenger_name || ride.customer?.name || 'Passenger'}
                </Text>
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={ms(14)} color="#F59E0B" />
                  <Text style={[styles.ratingText, { color: theme.colors.text + '80' }]}>
                    {ride.passenger_details?.rating || ride.passenger_rating || ride.rating || ride.customer?.rating || '5.0'} • {t('verified') || 'Verified'}
                  </Text>
                </View>
              </View>
              <View style={styles.riderActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6' }]}
                  onPress={() => Linking.openURL(`tel:${ride.phone || ride.riderPhone || ride.passenger_phone || '112'}`)}
                >
                  <Ionicons name="call" size={ms(20)} color={theme.colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6' }]}
                  onPress={handleChatPress}
                >
                  <Ionicons name="chatbubble" size={ms(20)} color={theme.colors.primary} />
                  {unreadCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />


            {/* Trip Stats */}
            <View style={styles.tripInfoRow}>
              <View style={styles.infoBlock}>
                <View style={[styles.infoIconContainer, { backgroundColor: theme.colors.primary + '10' }]}>
                  <Ionicons name="navigate" size={ms(16)} color={theme.colors.primary} />
                </View>
                <Text style={[styles.infoLabel, { color: theme.colors.text }]}>{t('distance')}</Text>
                <Text style={[styles.infoValue, { color: theme.colors.text }]}>{distance} {t('km_unit')}</Text>
              </View>

              <View style={styles.infoBlock}>
                <View style={[styles.infoIconContainer, { backgroundColor: '#FFD70020' }]}>
                  <Ionicons name="time" size={ms(16)} color="#FFB800" />
                </View>
                <Text style={[styles.infoLabel, { color: theme.colors.text }]}>{t('eta')}</Text>
                <Text style={[styles.infoValue, { color: theme.colors.text }]}>{eta} {t('minutes_unit')}</Text>
              </View>

              <View style={styles.infoBlock}>
                <View style={[styles.infoIconContainer, { backgroundColor: theme.colors.primary + '15' }]}>
                  <MaterialCommunityIcons name="shield-check" size={ms(18)} color={theme.colors.success || '#10B981'} />
                </View>
                <Text style={[styles.infoLabel, { color: theme.colors.text }]}>{t('type')}</Text>
                <Text style={[styles.infoValue, { color: theme.colors.text }]}>{ride.trip_type || ride.ride_type || 'ONE_WAY'}</Text>
              </View>
            </View>

            <View style={[styles.addressRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderColor: theme.colors.border }]}>
               <View style={[styles.addressIconBox, { backgroundColor: '#EF444415' }]}>
                <Ionicons name="location" size={ms(20)} color="#EF4444" />
              </View>
              <Text style={[styles.addressText, { color: theme.colors.text }]}>
                {ride.drop_address || ride.drop || t('destination')}
              </Text>
            </View>

            {/* Arrival Action */}
            <View style={styles.actionFooter}>
              <TouchableOpacity 
                style={styles.detailsLink} 
                onPress={() => setShowRideDetailsModal(true)}
              >
                <Text style={[styles.detailsLinkText, { color: theme.colors.primary }]} numberOfLines={1} adjustsFontSizeToFit>{t('view_ride_details') || 'View Ride Details'}</Text>
                <Ionicons name="chevron-forward" size={ms(16)} color={theme.colors.primary} />
              </TouchableOpacity>

              <View style={{ marginBottom: vs(10), width: '100%' }}>
                <SwipeButton
                  title={distance <= 0.1 ? (t('reach_destination') || "Reached Destination") : (t('driving_to_destination') || "Driving to Destination")}
                  onSwipeSuccess={handleEndTrip}
                  activeColor={theme.colors.success || '#10B981'}
                  thumbIcon="chevron-double-right"
                />
              </View>

              <TouchableOpacity
                style={styles.cancelTripBtn}
                onPress={() => setShowCancelModal(true)}
              >
                <Text style={styles.cancelTxt} numberOfLines={1} adjustsFontSizeToFit>{t('pickup.cancel_ride')}</Text>
              </TouchableOpacity>
            </View>
          </>
        </BottomSheetView>
      </BottomSheet>

      {showSuccess && (
        <View style={styles.successOverlay}>
          <Animated.View style={[styles.successCard, animatedSuccessStyle, { backgroundColor: theme.colors.card }]}>
            <View style={styles.successIconOuter}>
              <Ionicons name="checkmark-sharp" size={ms(45)} color="#fff" />
            </View>
            <Text style={[styles.successTitle, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{t('trip_completed') || "Trip Completed!"}</Text>
            <Text style={styles.successSub} numberOfLines={1} adjustsFontSizeToFit>{t('collect_payment') || "Please collect payment from rider"}</Text>
          </Animated.View>
        </View>
      )}

      {/* Ride Details Modal */}
      <Modal
        visible={showRideDetailsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRideDetailsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.detailsModal, { backgroundColor: theme.colors.card }]}>
            <View style={[styles.modalIndicator, { backgroundColor: theme.colors.border }]} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.success || '#10B981' }]} numberOfLines={1} adjustsFontSizeToFit>
                {t('trip_details').toUpperCase() || 'TRIP DETAILS'}
              </Text>
            </View>

            <ScrollView 
              style={styles.detailsContent} 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: vs(20) }}
            >
              {/* Trip Identifiers Box */}
              <View style={[styles.tripIdsBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC', borderColor: theme.colors.border }]}>
                <View style={styles.idColumn}>
                  <Text style={[styles.idLabel, { color: theme.colors.paragraphText }]}>{t('trip_id') || 'TRIP ID'}</Text>
                  <Text style={[styles.idValue, { color: theme.colors.text }]}>#{ride.trip_id || ride.id || 'N/A'}</Text>
                </View>
                <View style={[styles.idDivider, { backgroundColor: theme.colors.border }]} />
                <View style={styles.idColumn}>
                  <Text style={[styles.idLabel, { color: theme.colors.paragraphText }]}>{t('trip_code') || 'TRIP CODE'}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.idValue, { color: theme.colors.primary, fontWeight: '900' }]}>{ride.trip_code || ride.booking_code || '---'}</Text>
                    {(ride.trip_code || ride.booking_code) && (
                      <TouchableOpacity 
                        onPress={handleCopyTripCode}
                        style={{ marginLeft: ms(8), padding: ms(4) }}
                      >
                        <Ionicons name="copy-outline" size={ms(18)} color={theme.colors.primary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>

              {/* Vehicle & Service Info */}
              <View style={[styles.detailsCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F9FAFB', borderColor: theme.colors.border }]}>
                <View style={styles.paymentRow}>
                  <View style={styles.paymentInfo}>
                    <View style={[styles.paymentIconBox, { backgroundColor: vehicleInfo.color + '15' }]}>
                        <MaterialCommunityIcons name={vehicleInfo.icon} size={ms(24)} color={vehicleInfo.color} />
                    </View>
                    <View style={{ marginLeft: ms(12) }}>
                      <Text style={[styles.detailValue, { color: theme.colors.text, fontSize: ms(16), fontWeight: '800' }]}>
                        {ride.car_name || vehicleInfo.label || 'Premium Ride'}
                      </Text>
                      <Text style={[styles.detailLabel, { color: theme.colors.paragraphText, fontSize: ms(11) }]}>
                        {t(`ride_type_${(ride.ride_type || 'one_way').toLowerCase()}`)} • {t(`service_type_${(ride.service_type || (ride.driver_only ? 'driver_only' : 'cab_driver')).toLowerCase()}`)}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.serviceTag, { backgroundColor: theme.colors.primary + '15' }]}>
                    <Text style={[styles.serviceTagText, { color: theme.colors.primary }]} numberOfLines={1} adjustsFontSizeToFit>{t(`booking_type_${(ride.booking_type || 'live').toLowerCase()}`)}</Text>
                  </View>
                </View>
              </View>

              {/* Route Card */}
              <View style={[styles.detailsCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F9FAFB', borderColor: theme.colors.border }]}>
                <View style={[styles.routeItem, { marginBottom: vs(16) }]}>
                  <View style={styles.iconColumn}>
                    <Ionicons name="radio-button-on" size={ms(18)} color={theme.colors.primary} />
                    <View style={[styles.routeLine, { backgroundColor: theme.colors.border, height: vs(25) }]} />
                  </View>
                  <View style={styles.routeTextBody}>
                    <Text style={[styles.detailLabel, { color: theme.colors.primary }]} numberOfLines={1} adjustsFontSizeToFit>{t('pickup_caps') || 'PICKUP'}</Text>
                    <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                      {ride.pickup_address || ride.pickup || t('location_not_available')}
                    </Text>
                  </View>
                </View>

                <View style={styles.routeItem}>
                  <View style={styles.iconColumn}>
                    <Ionicons name="location" size={ms(18)} color="#B91C1C" />
                  </View>
                  <View style={styles.routeTextBody}>
                    <Text style={[styles.detailLabel, { color: '#B91C1C' }]} numberOfLines={1} adjustsFontSizeToFit>{t('drop_caps') || 'DROP-OFF'}</Text>
                    <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                      {ride.drop_address || ride.dropoff || ride.drop || t('location_not_available')}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Stats Row */}
              <View style={styles.detailsStatsRow}>
                <View style={[styles.statBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F9FAFB', borderLeftWidth: 3, borderLeftColor: theme.colors.primary }]}>
                  <Ionicons name="map-outline" size={ms(20)} color={theme.colors.primary} />
                  <Text style={[styles.statValue, { color: theme.colors.text }]}>
                    {distance || '0'} {t('km_unit')}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.colors.paragraphText }]}>{t('distance')}</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F9FAFB', borderLeftWidth: 3, borderLeftColor: '#F59E0B' }]}>
                  <Ionicons name="time-outline" size={ms(20)} color="#F59E0B" />
                  <Text style={[styles.statValue, { color: theme.colors.text }]}>
                    {eta || '0'} {t('minutes_unit')}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.colors.paragraphText }]}>{t('duration')}</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F9FAFB', borderLeftWidth: 3, borderLeftColor: theme.colors.success || '#10B981' }]}>
                  <Ionicons name="wallet-outline" size={ms(20)} color={theme.colors.success || '#10B981'} />
                  <Text style={[styles.statValue, { color: theme.colors.text }]}>₹{ride.total_fare || ride.fare || ride.price || '0'}</Text>
                  <Text style={[styles.statLabel, { color: theme.colors.paragraphText }]}>{t('estimated_fare')}</Text>
                </View>
              </View>

              {/* Payment Info */}
              <View style={[styles.detailsCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F9FAFB', borderColor: theme.colors.border }]}>
                <View style={styles.paymentRow}>
                  <View style={styles.paymentInfo}>
                    <View style={[styles.paymentIconBox, { backgroundColor: (theme.colors.success || '#10B981') + '15' }]}>
                        <MaterialCommunityIcons name="cash-multiple" size={ms(22)} color={theme.colors.success || '#10B981'} />
                    </View>
                    <View style={{ marginLeft: ms(12) }}>
                      <Text style={[styles.detailValue, { color: theme.colors.text, fontSize: ms(15) }]}>
                        {ride.payment_method === 'CASH' || ride.paymentMethod === 'Cash' ? (t('payment_cash') || 'Cash Payment') : (t('payment_online') || 'Online Payment')}
                      </Text>
                      <Text style={[styles.detailLabel, { color: theme.colors.paragraphText, fontSize: ms(11) }]} numberOfLines={1} adjustsFontSizeToFit>{t('collect_from_customer') || 'Collect total amount from customer'}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.closeModalBtn, { backgroundColor: theme.colors.primary }]}
              onPress={() => setShowRideDetailsModal(false)}
            >
              <Text style={[styles.closeModalBtnText, { color: theme.colors.card }]} numberOfLines={1} adjustsFontSizeToFit>{t('close') || 'Close'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <CancellationModal
        isVisible={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancelTrip}
        isSubmitting={isCancelling}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  topOverlay: {
    position: 'absolute',
    left: ms(16),
    right: ms(16),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 900,
  },
  rightActionsColumn: {
    alignItems: 'flex-end',
  },
  sosButton: {
    borderRadius: ms(25),
    elevation: 8,
    shadowColor: '#B91C1C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    paddingHorizontal: ms(16),
    paddingVertical: vs(8),
    marginBottom: vs(12),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosText: { color: '#FFF', fontWeight: 'bold', fontSize: ms(14), letterSpacing: 1 },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: ms(60),
    height: ms(60),
  },
  pulseCircle: {
    position: 'absolute',
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    backgroundColor: '#3B82F6',
  },
  driverMarker: {
    width: ms(28),
    height: ms(28),
    borderRadius: ms(14),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  destMarker: { width: ms(44), height: ms(44), alignItems: 'center', justifyContent: 'center' },
  destCircle: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(60, 60, 83, 0.65)',
    paddingHorizontal: ms(15),
    paddingVertical: vs(10),
    borderRadius: ms(25),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
  },
  liveDot: {
    width: ms(8),
    height: ms(8),
    borderRadius: ms(4),
    backgroundColor: '#22C55E',
    marginRight: ms(8),
  },
  liveText: {
    color: '#FFF',
    fontSize: ms(12),
    fontWeight: '600',
  },
  recenterFab: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(22),
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(12),
  },
  bottomSheetContent: {
    flex: 1,
    paddingHorizontal: ms(20),
    paddingTop: vs(4),
  },
  riderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: vs(16),
  },
  riderAvatar: {
    width: ms(56),
    height: ms(56),
    borderRadius: ms(28),
    backgroundColor: '#E5E7EB',
    borderWidth: 2,
  },
  avatarInitials: {
    fontSize: ms(22),
    fontWeight: '800',
  },
  riderMeta: {
    flex: 1,
    marginLeft: ms(14),
  },
  riderName: { fontSize: ms(20), fontWeight: '800', letterSpacing: -0.5 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: vs(2) },
  ratingText: { fontSize: ms(14), marginLeft: ms(4), fontWeight: '500' },
  riderActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(22),
    marginLeft: ms(12),
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  divider: {
    height: 1.5,
    marginVertical: vs(8),
    opacity: 0.2,
  },
  tripInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: vs(8),
    backgroundColor: 'rgba(0,0,0,0.02)',
    paddingVertical: vs(12),
    borderRadius: ms(16),
  },
  infoBlock: { alignItems: 'center', flex: 1 },
  infoIconContainer: {
    marginBottom: vs(6),
    width: ms(32),
    height: ms(32),
    borderRadius: ms(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: { fontSize: ms(13), textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '700', opacity: 0.6 },
  infoValue: { fontSize: ms(17), fontWeight: '500', marginTop: vs(2) },
  addressRow: {
    flexDirection: 'row',
    padding: ms(16),
    borderRadius: ms(16),
    alignItems: 'center',
    marginBottom: vs(24),
    borderWidth: 1,
  },
  addressIconBox: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressText: { flex: 1, marginLeft: ms(12), fontSize: ms(16), lineHeight: ms(22), fontWeight: '500' },
  actionFooter: { alignItems: 'center', paddingBottom: vs(10) },
  detailsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: vs(4),
    marginBottom: vs(8),
  },
  detailsLinkText: {
    fontSize: ms(14),
    fontWeight: '700',
    marginRight: ms(4),
    textDecorationLine: 'underline',
  },
  cancelTripBtn: { marginTop: vs(12), padding: ms(10), minWidth: ms(150), alignItems: 'center' },
  cancelTxt: { color: '#B91C1C', fontSize: ms(14), fontWeight: '800', letterSpacing: 0.5 },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  successCard: {
    width: '85%',
    padding: ms(30),
    borderRadius: ms(35),
    alignItems: 'center',
    elevation: 24,
  },
  successIconOuter: {
    width: ms(90),
    height: ms(90),
    borderRadius: ms(45),
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(20),
    elevation: 8,
  },
  successTitle: { fontSize: ms(26), fontWeight: '900', marginBottom: vs(8), textAlign: 'center' },
  successSub: { fontSize: ms(14), color: '#64748B', textAlign: 'center', paddingHorizontal: ms(20) },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  detailsModal: {
    borderTopLeftRadius: ms(32),
    borderTopRightRadius: ms(32),
    paddingBottom: Platform.OS === 'ios' ? vs(40) : vs(24),
    paddingHorizontal: ms(20),
    paddingTop: vs(20),
    maxHeight: '92%',
  },
  modalIndicator: {
    width: ms(40),
    height: vs(5),
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: vs(20),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(20),
  },
  modalTitle: {
    fontSize: ms(20),
    fontWeight: '800',
  },
  detailsContent: {
    marginTop: vs(5),
  },
  tripIdsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: ms(16),
    borderRadius: ms(20),
    marginBottom: vs(16),
    borderWidth: 1,
  },
  idColumn: {
    flex: 1,
    alignItems: 'center',
  },
  idDivider: {
    width: 1,
    height: '100%',
    marginHorizontal: ms(8),
  },
  paymentIconBox: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  idLabel: {
    fontSize: ms(11),
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: vs(4),
  },
  idValue: {
    fontSize: ms(16),
    fontWeight: '800',
  },
  serviceTag: {
    paddingHorizontal: ms(10),
    paddingVertical: vs(4),
    borderRadius: ms(8),
  },
  serviceTagText: {
    fontSize: ms(10),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  detailsCard: {
    padding: ms(16),
    borderRadius: ms(20),
    marginBottom: vs(16),
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: vs(10),
  },
  iconColumn: {
    width: ms(24),
    alignItems: 'center',
    paddingTop: vs(6),
  },
  routeLine: {
    width: 2,
    flex: 1,
    marginVertical: vs(2),
  },
  routeTextBody: {
    flex: 1,
    marginLeft: ms(12),
  },
  detailLabel: {
    fontSize: ms(13),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: vs(2),
    color: '#94A3B8',
  },
  detailValue: {
    fontSize: ms(17),
    fontWeight: '500',
    lineHeight: ms(22),
  },
  detailsStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: vs(16),
  },
  statBox: {
    flex: 1,
    marginHorizontal: ms(4),
    padding: ms(12),
    borderRadius: ms(16),
    alignItems: 'center',
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeModalBtn: {
    height: ms(56),
    borderRadius: ms(28),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: vs(10),
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  closeModalBtnText: {
    fontSize: ms(16),
    fontWeight: '800',
  },
  badge: {
    position: 'absolute',
    top: -ms(5),
    right: -ms(5),
    backgroundColor: '#B91C1C',
    borderRadius: ms(10),
    minWidth: ms(18),
    height: ms(18),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
    paddingHorizontal: ms(2),
  },
  badgeText: {
    color: '#FFF',
    fontSize: ms(10),
    fontWeight: 'bold',
  },
  statValue: {
    fontSize: ms(15),
    fontWeight: '800',
    marginTop: vs(6),
  },
  statLabel: {
    fontSize: ms(10),
    fontWeight: '600',
    marginTop: vs(2),
  },
});

export default DropMapScreen;
