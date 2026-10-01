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
  Pressable,
  Share,
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
import { resolveImageUrl } from '../../utils/imageUtils';
import { useAppTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { useAlert } from '../../context/AlertContext';
import { mS as ms, vS as vs, s } from '../../lib/scale';
import BottomSheet, { BottomSheetView, BottomSheetBackgroundProps } from '@gorhom/bottom-sheet';
import SwipeButton from '../Dashboard/dashComponents/SwipeButton';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../redux/store';
import { resetUnreadCount } from '../../redux/chatSlice';
import { useLocation } from '../../hooks/useLocation';
import { useArrivedTripMutation, useCancelTripMutation, useTriggerSosMutation, useGetTripByIdQuery } from '../../service/driverApi';
import { clearAcceptedRide, setCurrentRide } from '../../redux/rideSlice';
import { CancellationModal, MapConnectionStatus } from '../../Components';
// UserLocationMarker removed
import { useLocationTracker } from '../../hooks/useLocationTracker';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { ChatScreen_Nav, ScheduledRideDetails_Nav, PickupOTPScreen_Nav } from '../../Navigations/navigations';
import { useHaptic } from '../../hooks/useHaptic';
import socketService from '../../service/socketService';
import audioService from '../../utils/audioService';
import Clipboard from '@react-native-clipboard/clipboard';
import notifee, { AndroidImportance } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';




const PickupMapScreen = ({ route }: any) => {
  // 1. Core Hooks (Always called, always in same order)
  const { showAlert, hideAlert } = useAlert();
  const { showToast } = useToast();
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
  const [arrivedTripApi] = useArrivedTripMutation();
  const [triggerSosApi] = useTriggerSosMutation();
  const [cancelTripApi, { isLoading: isCancelling }] = useCancelTripMutation();

  // 4. Persistence Refs
  const mapRef = useRef<MapView>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const waypointIndexRef = useRef(0);
  const lastEmittedLoc = useRef<LatLng | null>(null);
  const lastEmittedTime = useRef<number>(0);
  const hasNotifiedArrivalRef = useRef<boolean>(false);
  const routeCoordsRef = useRef<LatLng[]>([]);
  const lastLocationPos = useRef<LatLng | null>(null);
  const isUserInteracting = useRef(false);
  const markerRotationRef = useRef(0);
  const isSimulatingRef = useRef(false);
  const isArrivedRef = useRef(false);
  const isExitingRef = useRef(false);
  const hasNotifiedArrival = useRef(false);
  const simInterval = useRef<any>(null);

  // Normalize coordinates
  const pickup_lat = parseFloat(ride.pickup_lat?.toString() || "0");
  const pickup_lng = parseFloat(ride.pickup_lng?.toString() || "0");
  const hasValidCoords = !!(pickup_lat && pickup_lng);
  const trip_id = ride?.trip_id || ride?.id || '';

  const initialDistance = useRef(parseFloat(ride.distance_km?.toString()) || 2.4);
  const initialEta = useRef(parseFloat(ride.trip_duration_minutes?.toString()) || 8);
  const hasNotifiedArrivalVoiceRef = useRef<boolean>(false);

  // === State Declarations ===
  const [driverLocation, setDriverLocation] = useState<LatLng | null>(null);
  const [markerRotation, setMarkerRotation] = useState(0);

  const pickupLocation: LatLng = useMemo(() => ({
    latitude: pickup_lat || 0,
    longitude: pickup_lng || 0,
  }), [pickup_lat, pickup_lng]);

  const handleCopyTripCode = useCallback(() => {
    const code = ride.trip_code || ride.booking_code;
    if (code) {
      Clipboard.setString(code);
      triggerHaptic?.(HapticFeedbackTypes.notificationSuccess);
    }
  }, [ride, triggerHaptic]);

  const handleCopyTripId = useCallback(() => {
    const id = String(ride.trip_id || ride.id || '');
    if (id) {
      Clipboard.setString(id);
      triggerHaptic?.(HapticFeedbackTypes.notificationSuccess);
    }
  }, [ride, triggerHaptic]);
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [currentWaypointIndex, setCurrentWaypointIndex] = useState(0);
  const [isTracking, setIsTracking] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [shouldFetchRoute, setShouldFetchRoute] = useState(true);
  const [isAutoFollow, setIsAutoFollow] = useState(true);
  const [isArrived, setIsArrived] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [mapMargin, setMapMargin] = useState(1);
  const [distance, setDistance] = useState(0);
  const [eta, setEta] = useState(0);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showArriveConfirmModal, setShowArriveConfirmModal] = useState(false);
  const [showHelpDropdown, setShowHelpDropdown] = useState(false);

  const openExternalGoogleMap = useCallback(() => {
    if (driverLocation && pickupLocation) {
      const url = `https://www.google.com/maps/dir/?api=1&origin=${driverLocation.latitude},${driverLocation.longitude}&destination=${pickupLocation.latitude},${pickupLocation.longitude}&travelmode=driving`;
      Linking.openURL(url).catch(err => {
        console.error("Failed to open Google Maps", err);
        showAlert({
          title: t('common.error') || 'Error',
          message: t('failed_to_open_maps') || 'Failed to open external maps.',
          singleButton: true,
          icon: 'alert-circle-outline'
        });
      });
    } else {
      showAlert({
        title: t('common.error') || 'Error',
        message: t('location_not_ready') || 'Location not ready yet.',
        singleButton: true,
        icon: 'alert-circle-outline'
      });
    }
  }, [driverLocation, pickupLocation, showAlert, t]);

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

  // 🏎️ Smooth Animated Region for Marker
  const driverAnimatedLocation = useRef(new AnimatedRegion({
    latitude: pickup_lat || 0,
    longitude: pickup_lng || 0,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  })).current;

  // 📍 High-fidelity unified location tracker
  const { locationDisabled } = useLocationTracker({
    driverId: user?.driverId,
    isTracking: isTracking,
    tripId: trip_id,
    mode: 'moving',
    suppressEmission: isTracking && !isSimulating,
  });

  // 🛡️ Navigation Guard: Prevent back button during active trip
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        navigation.navigate('DashboardScreen');
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      navigation.setOptions({ gestureEnabled: false });

      return () => {
        subscription.remove();
        navigation.setOptions({ gestureEnabled: true });
      };
    }, [navigation, showAlert, t])
  );

  // 📍 Initial Location Fetch
  useEffect(() => {
    const initLocation = async () => {
      try {
        const pos = await getCurrentLocation();
        const loc = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setDriverLocation(loc);
        driverAnimatedLocation.setValue({
          ...loc,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      } catch (err) {
        console.warn('Initial Location Error:', err);
      }
    };
    initLocation();
  }, [getCurrentLocation, driverAnimatedLocation]);

  const handleStartTrip = useCallback(() => {
    console.log("🚀 Trip tracking active for:", trip_id);
    setIsTracking(true);
  }, [trip_id]);

  // 🛡️ Guard: Exit screen if ride is cleared from Redux (e.g. by global cancellation)
  // Uses hadRideRef to avoid false triggers during Redux rehydration on app restart
  const hadRideRef = useRef(!!reduxCurrentRide);
  useEffect(() => {
    if (reduxCurrentRide) {
      hadRideRef.current = true;
    } else if (hadRideRef.current && !reduxCurrentRide && !showSuccess) {
      console.log('[PickupMapScreen] Active ride cleared from Redux, exiting...');
      // No Alert here — RootNavigation handles the global UI alert.
      // This avoids the double-alert race condition in Fabric.
      isExitingRef.current = true;
      navigation.reset({ index: 0, routes: [{ name: 'DashboardScreen' }] });
    }
  }, [reduxCurrentRide, navigation, showSuccess]);


  useEffect(() => {
    // 🛡️ Guard: Only connect if driverId is available
    if (!user?.driverId) return;

    socketService.connect(user.driverId, 'DRIVER');
    const tId = ride.trip_id || ride.id;
    if (tId) {
      socketService.joinTripRoom(tId.toString(), user.driverId, 'DRIVER');

      // 📡 [Point 2] Immediately notify both backend and rider that we are en-route
      console.log(`📡 [PickupMapScreen] Emitting EN_ROUTE status for trip: ${tId}`);
      socketService.emitEnRoute(tId.toString(), user.driverId);
    }
    handleStartTrip();

    setIsTracking(true);

    // Cleanup: Just leave the trip room, stay connected to the general driver room
    return () => {
      console.log('🧹 Cleaning up PickupMapScreen room state...');
      socketService.leaveTripRoom();
    };
  }, [ride.trip_id, ride.id, user?.driverId, handleStartTrip]);



  const handleSosPress = useCallback(() => {
    showAlert({
      title: t('sos'),
      message: t('sos_message') || 'Are you in an emergency? This will notify our security team immediately.',
      icon: 'alert-circle',
      onConfirm: async () => {
        try {
          await triggerSosApi({ trip_id: (ride.trip_id || ride.id)?.toString() }).unwrap();
          showAlert({
            title: t('sos_triggered'),
            message: t('sos_triggered_msg') || 'Emergency signal sent. Help is on the way.',
            singleButton: true,
            icon: 'checkmark-circle',
            onConfirm: () => Linking.openURL('tel:112')
          });
        } catch (error) {
          Linking.openURL('tel:112');
        }
      }
    });
  }, [ride.trip_id, ride.id, showAlert, t, triggerSosApi]);

  const handleSOS = useCallback(() => {
    handleSosPress();
    triggerHaptic?.(HapticFeedbackTypes.impactHeavy);
  }, [handleSosPress, triggerHaptic]);

  // Sync refs with state
  useEffect(() => {
    waypointIndexRef.current = currentWaypointIndex;
  }, [currentWaypointIndex]);

  useEffect(() => {
    routeCoordsRef.current = routeCoords;
  }, [routeCoords]);

  useEffect(() => {
    isArrivedRef.current = isArrived;
  }, [isArrived]);

  useEffect(() => {
    markerRotationRef.current = markerRotation;
  }, [markerRotation]);

  // Custom hook usage if needed for haptics (imported if available, otherwise just optional chain)

  // Helper to calculate bearing between two points
  const calculateBearing = useCallback((start: LatLng, end: LatLng) => {
    const startLat = (start.latitude * Math.PI) / 180;
    const startLng = (start.longitude * Math.PI) / 180;
    const endLat = (end.latitude * Math.PI) / 180;
    const endLng = (end.longitude * Math.PI) / 180;

    const y = Math.sin(endLng - startLng) * Math.cos(endLat);
    const x =
      Math.cos(startLat) * Math.sin(endLat) -
      Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
    const bearing = (Math.atan2(y, x) * 180) / Math.PI;
    return (bearing + 360) % 360;
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
      return { snappedPoint: rawPoint, bearing: markerRotationRef.current, index: waypointIndexRef.current, deviated: true, distanceToPath: minDistance };
    }

    return { snappedPoint: bestPoint, bearing: bestBearing, index: bestIndex, deviated: false, distanceToPath: minDistance };
  }, [calculateBearing, getDistanceMeters, projectPointOnSegment]);

  // 📐 Math Helper: Sum of remaining distance along polyline from current waypoint
  const calculateRemainingDistance = useCallback((index: number, route: LatLng[]) => {
    if (!route || route.length === 0 || index >= route.length - 1) return 0;
    let remaining = 0;
    // Remainder of current segment (optional, but good for precision)
    // For simplicity, we sum from the next waypoint index to the end
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
      // Resume real tracking when simulation stops
      handleStartTrip();
      return;
    }

    if (routeCoords.length === 0) {
      console.log("⏳ Route not ready for simulation...");
      return;
    }

    // Stop real tracking before starting simulation to avoid conflicts
    setIsTracking(false);

    isSimulatingRef.current = true;
    setIsSimulating(true);
    let step = waypointIndexRef.current;

    // Start socket interaction
    socketService.joinTripRoom(ride?.trip_id || ride?.id, user?.driverId, 'DRIVER');

    simInterval.current = setInterval(() => {
      if (step >= routeCoords.length - 1) {
        setDriverLocation(pickupLocation);
        setCurrentWaypointIndex(routeCoords.length - 1);
        if (simInterval.current) clearInterval(simInterval.current);
        isSimulatingRef.current = false;
        setIsSimulating(false);
        return;
      }

      const currentPos = routeCoords[step];
      const nextPos = routeCoords[step + 1];

      // Update heading
      const heading = calculateBearing(currentPos, nextPos);
      setMarkerRotation(heading);

      step++;
      setDriverLocation(nextPos);
      setCurrentWaypointIndex(step);

      // Animate Marker Smoothly
      (driverAnimatedLocation as any).timing({
        ...nextPos,
        duration: 1000,
        useNativeDriver: false,
      }).start();

      // Emit simulated location via socket every ~5 seconds (every 4 steps @ 1.2s each)
      if (step % 4 === 0 || step >= routeCoords.length - 1) {
        // ⏲️ Update dynamic distance/ETA during simulation
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

      // Smoothly follow driver
      if (isAutoFollow && mapRef.current) {
        mapRef.current.animateCamera({
          center: nextPos,
          heading: heading,
          pitch: 45,
          zoom: 16,
        }, { duration: 1000 });
      }
    }, 1200); // 1.2s intervals for smooth movement synchronization
  }, [routeCoords, pickupLocation, ride.trip_id, ride.id, user?.driverId, driverAnimatedLocation, calculateBearing, isAutoFollow]);


  // Clean up simulation and animation on unmount
  useEffect(() => {
    return () => {
      isExitingRef.current = true;
      if (simInterval.current) {
        clearInterval(simInterval.current);
        simInterval.current = null;
      }
      try {
        // Force stop any pending animations to avoid Fabric viewState errors
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

        // 🧠 Core: Snap the raw GPS coordinate to the closest point on the route
        const { snappedPoint, bearing, index, deviated, distanceToPath } = snapToRoute(rawLoc);

        if (deviated) {
          console.log(`🚦 [Movement] Deviated from route! Raw: [${rawLoc.latitude.toFixed(5)}, ${rawLoc.longitude.toFixed(5)}]`);
        }

        // Update local state for marker positioning
        setDriverLocation(snappedPoint);
        setCurrentWaypointIndex(index);

        // 🛡️ Jitter Filter: Only update rotation if moved > 2 meters
        const distMoved = lastLocationPos.current ? getDistanceMeters(lastLocationPos.current, snappedPoint) : 10;

        if (distMoved > 2) {
          setMarkerRotation(bearing);

          // 🎥 High-End Camera Animation (Auto-Follow)
          if (isAutoFollow && !isUserInteracting.current && mapRef.current) {
            mapRef.current.animateCamera({
              center: snappedPoint,
              heading: bearing,
              pitch: 45, // Professional 3D view
              zoom: 18,   // Detailed street level
            }, { duration: 1000 });
          }
          lastLocationPos.current = snappedPoint;
        } else if (isAutoFollow && !isUserInteracting.current && mapRef.current) {
          // Still follow position even if not rotating
          mapRef.current.animateCamera({
            center: snappedPoint,
            pitch: 45,
            zoom: 18,
          }, { duration: 1000 });
        }

        // 🚗 Smooth Marker Transition (AnimatedRegion)
        (driverAnimatedLocation as any).timing({
          ...snappedPoint,
          duration: 1000,
          useNativeDriver: false,
        }).start();

        // ⏲️ [Point 3] Update Dynamic Distance & ETA Calculation Accuracy
        // No more hardcoded * 3. We use the dynamic factor calculated once route is ready.
        const remainKm = calculateRemainingDistance(index, routeCoordsRef.current);
        const currentDistance = parseFloat(remainKm.toFixed(1));
        const factor = initialDistance.current > 0 ? (initialEta.current / initialDistance.current) : 4;
        const currentEta = Math.max(1, Math.round(remainKm * factor));

        // Voice Alert (10 meters)
        if (remainKm <= 0.01 && !hasNotifiedArrivalVoiceRef.current && !isArrivedRef.current) {
          hasNotifiedArrivalVoiceRef.current = true;
          audioService.speak(t('reached_pickup_voice') || 'You have reached the pickup location');
        }

        // Update local state for UI (renders after this loop ends)
        setDistance(currentDistance);
        setEta(currentEta);

        // 📡 [Point 1] High-Fidelity Snapped Emission (using LOCAL values to avoid state lag)
        const distSinceLastEmit = lastEmittedLoc.current ? getDistanceMeters(lastEmittedLoc.current, snappedPoint) : 20;
        const timeSinceLastEmit = Date.now() - lastEmittedTime.current;

        if (distSinceLastEmit >= 10 || timeSinceLastEmit >= 20000) {
          console.log(`📡 [Socket] Emitting Snapped Location: [${snappedPoint.latitude.toFixed(5)}, ${snappedPoint.longitude.toFixed(5)}] | Bearing: ${bearing.toFixed(1)} | ETA: ${currentEta} | Dist: ${currentDistance}`);
          socketService.emitLocationUpdate(
            ride?.trip_id || ride?.id,
            snappedPoint.latitude,
            snappedPoint.longitude,
            bearing,
            currentEta || 0,
            currentDistance || 0
          );
          lastEmittedLoc.current = snappedPoint;
          lastEmittedTime.current = Date.now();
        }

        // 📡 Deviation Check: If deviated > 100m from path, trigger re-route fetch
        if (deviated) {
          if (distanceToPath > 100 && !isArrivedRef.current) {
            console.log("🚦 Deviation detected! Re-fetching route...");
            setShouldFetchRoute(true);
          }
        }
      },
      (err) => console.warn('Navigation Error:', err),
      {
        enableHighAccuracy: true,
        distanceFilter: 2, // smooth updates every 2 meters
        interval: 1000,
        fastestInterval: 500,
      }
    );

    return () => {
      if (watchId !== null) Geolocation.clearWatch(watchId);
    };
  }, [isTracking, isAutoFollow, isSimulating, watchLocation, driverAnimatedLocation, snapToRoute, getDistanceMeters]);


  // Animation values
  const successScale = useSharedValue(0);

  // Map Marker Pulse (Standard Animated to prevent MapView crash on Android)
  const pulseAnim = useRef(new RNAnimated.Value(1)).current;

  // Shared snap points for Bottom Sheet
  const snapPoints = useMemo(() => ['15%', '45%'], []);

  // Pulse animation for driver marker (using standard RNAnimated)
  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 1200,
          useNativeDriver: true,
        }),
        RNAnimated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  // Auto-show OTP Modal if status is already ARRIVED (e.g., on app reload)
  useEffect(() => {
    const checkOTPStatus = async () => {
      if (ride.trip_status === 'ARRIVED') {
        setIsArrived(true);
        const tripId = ride.trip_id || ride.id;
        if (tripId) {
          try {
            const isOTPVerified = await AsyncStorage.getItem(`otp_verified_${tripId}`);
            if (isOTPVerified === 'true') {
              // Automatically go to vehicle verification if OTP was already verified
              navigation.replace('VehicleVerificationScreen', { ride });
              return;
            }
          } catch (e) {
            console.log('Failed to check OTP status:', e);
          }
        }

        // Show success animation before navigating
        setShowSuccess(true);
        successScale.value = withSpring(1, { damping: 10, stiffness: 100 });
        setTimeout(() => {
          setShowSuccess(false);
          navigation.navigate(PickupOTPScreen_Nav, { ride });
        }, 2000);
      }
    };
    checkOTPStatus();
  }, [ride.trip_status]);


  const animatedPulseStyle = {
    transform: [{ scale: pulseAnim }],
    opacity: pulseAnim.interpolate({
      inputRange: [1, 1.3],
      outputRange: [0.8, 0],
    }),
  };




  const animatedSuccessStyle = useAnimatedStyle(() => ({
    transform: [{ scale: successScale.value }],
    opacity: successScale.value,
  }));





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
        tripId: ride.trip_id || ride.id,
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
        dispatch(setCurrentRide(null));
        navigation.reset({ index: 0, routes: [{ name: 'DashboardScreen' }] });
      }, 1500);
    } catch (error: any) {
      console.error('Cancellation failed:', error);

      const errorMessage = (error?.data?.message || error?.message || '').toLowerCase();
      const isAlreadyCancelled = errorMessage.includes('already cancelled');
      const isCouldNotCancel = errorMessage.includes('could not cancel trip');
      const isServerError = error?.status === 500;

      // If already cancelled or backend failed with a generic "Could not cancel", allow driver to proceed back to dashboard
      const shouldAllowForceClear = isAlreadyCancelled || isCouldNotCancel || isServerError;

      showAlert({
        title: isAlreadyCancelled ? t('ride_cancelled') : t('common.error'),
        message: isAlreadyCancelled
          ? (t('rider_cancelled_msg') || 'The rider has cancelled this trip.')
          : (error?.data?.message || t('failed_cancel_trip') || 'Failed to cancel trip. Please try again.'),
        singleButton: true,
        icon: isAlreadyCancelled ? 'close-circle-outline' : 'alert-circle-outline',
        onConfirm: shouldAllowForceClear ? () => {
          dispatch(clearAcceptedRide());
          dispatch(setCurrentRide(null));
          navigation.reset({ index: 0, routes: [{ name: 'DashboardScreen' }] });
        } : undefined
      });
    }
  };

  const handleShareTrip = async () => {
    try {
      const passengerName = ride?.passenger_details?.name || ride?.user_details?.full_name || ride?.user_details?.first_name || ride?.passenger || ride?.passenger_name || ride?.customer?.name || 'Passenger';
      const vehicle = `${ride?.car_name || ride?.vehicle_model || 'Vehicle'}${ride?.vehicle_type ? ` (${ride.vehicle_type})` : ''}`.trim();
      const carNumber = ride?.vehicle_number || ride?.car_number || '';
      const tripCode = ride?.trip_code || ride?.booking_code || ride?.trip_id || ride?.id || '';

      const shareMessage = `🚗 Track my T2Drive Trip!\n\n` +
        (tripCode ? `🆔 Trip Code: ${tripCode}\n` : '') +
        `👤 Passenger: ${passengerName}\n` +
        `📍 Pickup: ${ride?.pickup_address || ride?.pickup || 'Not available'}\n` +
        `🏁 Drop: ${ride?.drop_address || ride?.drop || 'Not available'}\n` +
        (vehicle !== 'Vehicle' ? `🚙 Vehicle: ${vehicle} ${carNumber ? `[${carNumber}]` : ''}\n` : '') +
        `\nTrack the ride status live in the T2Drive app!`;

      await Share.share({
        message: shareMessage,
      });
    } catch (error) {
      console.log('Error sharing trip:', error);
    }
  };

  const handleChatPress = () => {
    navigation.navigate(ChatScreen_Nav, {
      rideId: ride.trip_id || ride.id,
      userId: user?.driverId, // The "me" ID (Driver)
      userName: ride.passenger_details?.name || ride.user_details?.full_name || ride.user_details?.first_name || ride.passenger || ride.passenger_name || ride.customer?.name || t('rider'), // Header name (Rider)
      userImage: ride.passenger_details?.image || ride.riderImage,
      userPhone: ride.phone || ride.riderPhone || ride.customer?.phone || ride.passenger_phone,
    });
  };

  const confirmArriveComplete = useCallback(async () => {
    setShowArriveConfirmModal(false);
    try {
      await arrivedTripApi(ride?.trip_id).unwrap();
      dispatch(setCurrentRide({ ...ride, trip_status: 'ARRIVED' }));
      setIsArrived(true);
      setShowSuccess(true);
      successScale.value = withSpring(1, { damping: 10, stiffness: 100 });
      setTimeout(() => {
        setShowSuccess(false);
        navigation.navigate(PickupOTPScreen_Nav, { ride });
      }, 2000);
    } catch (error: any) {
      showToast({
        message: error?.data?.message || t('failed_arrive_pickup') || 'Failed to signify arrival at pickup',
        type: 'error',
      });
    }
  }, [ride, arrivedTripApi, successScale, showToast, t]);

  const handleArriveComplete = useCallback(() => {
    // 🏁 Distance Guard: Check if driver is still far (> 500m) from pickup
    if (distance > 0.5) {
      setShowArriveConfirmModal(true);
    } else {
      confirmArriveComplete();
    }
  }, [distance, confirmArriveComplete]);


  // Calculate Distance and ETA dynamically based on REMAINING route
  useEffect(() => {
    if (routeCoords && currentWaypointIndex < routeCoords.length) {
      // 📐 [Point 3] Standardized Logic: Use the high-fidelity helper instead of rough *111 math
      const remainKm = calculateRemainingDistance(currentWaypointIndex, routeCoords);
      const dist = parseFloat(remainKm.toFixed(2));
      const factor = initialDistance.current > 0 ? (initialEta.current / initialDistance.current) : 4;
      const calculatedEta = Math.max(1, Math.round(remainKm * factor));

      setDistance(parseFloat(remainKm.toFixed(1)));
      setEta(calculatedEta);

      // Real-World Proximity Logic: Auto-expand bottom sheet at 10m (0.01km)
      if (dist <= 0.01 && !isArrived) {
        bottomSheetRef.current?.snapToIndex(1); // Expand to 45% (top)
        if (!hasNotifiedArrival.current) {

          hasNotifiedArrival.current = true;
        }
      }
    } else if (!routeCoords || routeCoords.length === 0) {
      // Fallback to ride data if route not ready
      if (ride.distance_km) setDistance(parseFloat(ride.distance_km));
      if (ride.trip_duration_minutes) setEta(Math.ceil(parseFloat(ride.trip_duration_minutes)));
    }
  }, [routeCoords, currentWaypointIndex, isArrived, ride.distance_km, ride.trip_duration_minutes, showToast, t]);

  const swipeTitle = useMemo(() => {
    if (distance <= 0.1) return t('pickup.reached_at_pickup') || "Reached at Pickup";
    if (distance <= 1.0) return t('pickup.arriving_soon') || "Arriving Soon...";
    return t('pickup.driving_to_pickup') || "Driving to Pickup";
  }, [distance, t]);
  const fitToTrip = useCallback(() => {
    if (mapRef.current && driverLocation) {
      mapRef.current.fitToCoordinates([driverLocation, pickupLocation], {
        edgePadding: {
          top: vs(120),
          right: ms(50),
          bottom: vs(380),
          left: ms(50),
        },
        animated: true,
      });
    }
  }, [driverLocation, pickupLocation]);

  useEffect(() => {
    // Only fit to trip initially to avoid fighting with manual user interaction
    const timer = setTimeout(fitToTrip, 1000);
    return () => clearTimeout(timer);
  }, []); // Run ONCE at mount to avoid auto-snapping during movement




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


  const renderArriveConfirmModal = () => (
    <Modal visible={showArriveConfirmModal} transparent animationType="slide">
      <Pressable style={styles.modalOverlay} onPress={() => setShowArriveConfirmModal(false)}>
        <View style={[styles.bottomSheet, { backgroundColor: isDark ? theme.colors.card : '#FFFFFF' }]}>
          <View style={styles.dragHandle} />

          <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>
            {t('far_from_pickup') || 'Wait!'}
          </Text>
          <Text style={[styles.sheetSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280', textAlign: 'center', marginHorizontal: ms(20) }]}>
            {t('far_from_pickup_msg') || 'You are still far from the pickup location. Are you sure you have arrived?'}
          </Text>

          <View style={styles.sheetButtonsRow}>
            <TouchableOpacity
              style={styles.sheetCancelBtn}
              onPress={() => setShowArriveConfirmModal(false)}
            >
              <Text style={styles.sheetCancelBtnText}>{t('common.cancel') || 'Cancel'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetConfirmBtn, { backgroundColor: theme.colors.primary }]}
              onPress={confirmArriveComplete}
            >
              <Text style={styles.sheetConfirmBtnText}>{t('confirm') || 'Confirm'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Modal>
  );

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
          // Set timeout to reset interaction flag after pan ends
          setTimeout(() => { isUserInteracting.current = false; }, 1000);
        }}
        initialRegion={{
          latitude: driverLocation?.latitude || pickupLocation.latitude || 0,
          longitude: driverLocation?.longitude || pickupLocation.longitude || 0,
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
            destination={pickupLocation}
            apikey={GOOGLE_MAPS_API_KEY}
            strokeWidth={0}
            strokeColor={theme.colors.primary}
            optimizeWaypoints={true}
            onReady={(result) => {
              console.log('✅ Directions Ready | Dist:', result.distance, 'km | ETA:', result.duration, 'min');
              setRouteCoords(result.coordinates);
              routeCoordsRef.current = result.coordinates;

              // 🧪 Update dynamic stats for the tracking card
              setDistance(parseFloat(result.distance.toFixed(1)));
              setEta(Math.ceil(result.duration));

              // 📐 Update calibration refs for simulation/smoothing
              initialDistance.current = result.distance;
              initialEta.current = result.duration;

              setCurrentWaypointIndex(0);
              setShouldFetchRoute(false);
              if (mapRef.current) {
                mapRef.current.fitToCoordinates(result.coordinates, {
                  edgePadding: { top: vs(120), right: ms(50), bottom: vs(380), left: ms(50) },
                  animated: true,
                });
              }
            }}
            onError={(errorMessage) => {
              console.error('❌ Directions Error on GMAPS route request:', errorMessage);
              console.log('📍 Origin:', driverLocation);
              console.log('📍 Destination:', pickupLocation);
              setShouldFetchRoute(false);
            }}
          />
        )}

        {shouldFetchRoute && driverLocation && !hasValidCoords && (() => {
          console.log('⏳ Waiting for valid pickup coordinates before fetching route...');
          return null;
        })()}

        {driverLocation && (
          <Marker.Animated
            coordinate={driverAnimatedLocation as any}
            flat
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={10}
          >
            <View style={styles.markerContainer}>
              <Image
                source={require('../../assets/images/car.png')}
                style={{
                  width: ms(40),
                  height: ms(40),
                  resizeMode: 'contain',
                  transform: [{ rotate: `${markerRotation}deg` }]
                }}
              />
              {!isArrived && (
                <View style={styles.etaPillAbsolute}>
                  <Text style={styles.etaText}>{eta} {t('minutes_unit')}</Text>
                </View>
              )}
            </View>
          </Marker.Animated>
        )}

        <Marker coordinate={pickupLocation} anchor={{ x: 0.5, y: 0.9 }}>
          <View style={styles.pickupMarkerContainer}>
            <Ionicons name="location" size={ms(34)} color={theme.colors.error || '#B91C1C'} />
          </View>
        </Marker>

        {/* Default Polyline */}
        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeWidth={vs(6)}
            strokeColor={theme.colors.primary}
            lineCap="round"
            lineJoin="round"
            zIndex={5}
          />
        )}
      </MapView>



      {/* Top Banner (Full Width) */}
      <View style={[styles.topHeaderBanner, { paddingTop: insets.top + vs(10), paddingBottom: vs(10), paddingHorizontal: ms(16), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'transparent' }]}>

        {/* Left: Menu Dropdown */}
        <View style={{ position: 'relative', zIndex: 100 }}>
          <TouchableOpacity
            style={{ width: ms(44), height: ms(44), backgroundColor: isDark ? theme.colors.card : '#FFF', borderRadius: ms(12), justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#F1F5F9' }}
            onPress={() => setShowOptionsMenu(!showOptionsMenu)}
          >
            <Ionicons name="menu" size={ms(24)} color={theme.colors.text} />
          </TouchableOpacity>

          {showOptionsMenu && (
            <View style={[styles.helpDropdown, { left: 0, top: ms(50) }, isDark && { backgroundColor: theme.colors.card, borderColor: 'rgba(255,255,255,0.1)' }]}>
              <TouchableOpacity style={styles.helpDropdownItem} onPress={() => { setShowOptionsMenu(false); navigation.navigate(ScheduledRideDetails_Nav, { ride, isLiveRide: true }); }}>
                <Ionicons name="document-text-outline" size={ms(18)} color={theme.colors.text} style={{ marginRight: ms(8) }} />
                <Text style={[styles.helpDropdownText, { color: theme.colors.text }]}>Ride Details</Text>
              </TouchableOpacity>
              <View style={styles.dropdownDivider} />
              <TouchableOpacity style={styles.helpDropdownItem} onPress={() => { setShowOptionsMenu(false); handleShareTrip(); }}>
                <Ionicons name="share-social-outline" size={ms(18)} color={theme.colors.text} style={{ marginRight: ms(8) }} />
                <Text style={[styles.helpDropdownText, { color: theme.colors.text }]}>Share Trip</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Center: Title */}
        <View style={{ flex: 1, alignItems: 'center', marginHorizontal: ms(12) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: ms(8), height: ms(8), borderRadius: ms(4), backgroundColor: '#10B981', marginRight: ms(6) }} />
            <Text style={{ fontSize: ms(16), fontWeight: '700', color: theme.colors.text }}>Way to Pickup</Text>
          </View>
          <TouchableOpacity onPress={handleCopyTripCode} style={{ flexDirection: 'row', alignItems: 'center', marginTop: vs(2) }}>
            <Text style={{ fontSize: ms(12), color: isDark ? '#9CA3AF' : '#64748B', fontWeight: '600' }}>
              {ride?.trip_code || ride?.booking_code ? `Trip Code: ${ride.trip_code || ride.booking_code}` : `Trip ID: #${ride?.trip_id || ride?.id}`}
            </Text>
            <Ionicons name="copy-outline" size={ms(12)} color={isDark ? '#9CA3AF' : '#64748B'} style={{ marginLeft: ms(4) }} />
          </TouchableOpacity>
        </View>

        {/* Right: Help */}
        <View style={{ position: 'relative', zIndex: 100 }}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? theme.colors.card : '#FFF', paddingHorizontal: ms(12), height: ms(44), borderRadius: ms(12), shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#F1F5F9' }}
            onPress={() => setShowHelpDropdown(!showHelpDropdown)}
          >
            <Ionicons name="headset-outline" size={ms(18)} color={theme.colors.text} style={{ marginRight: ms(6) }} />
            <Text style={{ fontSize: ms(14), fontWeight: '600', color: theme.colors.text }}>Help</Text>
          </TouchableOpacity>

          {showHelpDropdown && (
            <View style={[styles.helpDropdown, { right: 0, top: ms(50) }, isDark && { backgroundColor: theme.colors.card, borderColor: 'rgba(255,255,255,0.1)' }]}>
              <TouchableOpacity style={styles.helpDropdownItem} onPress={() => { setShowHelpDropdown(false); }}>
                <Ionicons name="help-circle-outline" size={ms(18)} color={theme.colors.text} style={{ marginRight: ms(8) }} />
                <Text style={[styles.helpDropdownText, { color: theme.colors.text }]}>Helpcenter</Text>
              </TouchableOpacity>
              <View style={styles.dropdownDivider} />
              <TouchableOpacity style={styles.helpDropdownItem} onPress={() => { setShowHelpDropdown(false); handleSosPress(); }}>
                <Ionicons name="warning-outline" size={ms(18)} color="#EF4444" style={{ marginRight: ms(8) }} />
                <Text style={[styles.helpDropdownText, { color: '#EF4444' }]}>SOS</Text>
              </TouchableOpacity>
              <View style={styles.dropdownDivider} />
              <TouchableOpacity style={styles.helpDropdownItem} onPress={() => { setShowHelpDropdown(false); setShowCancelModal(true); }}>
                <Ionicons name="close-circle-outline" size={ms(18)} color="#EF4444" style={{ marginRight: ms(8) }} />
                <Text style={[styles.helpDropdownText, { color: '#EF4444' }]}>Cancel Ride</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Floating Stats Card */}
      <View style={[styles.floatingStatsCard, { top: insets.top + vs(85), backgroundColor: isDark ? theme.colors.card : '#FFF' }]}>
        <View style={styles.floatingStatItem}>
          <View style={[styles.floatingStatIcon, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF' }]}>
            <Ionicons name="git-commit-outline" size={ms(16)} color="#3B82F6" />
          </View>
          <View style={styles.floatingStatTextCol}>
            <Text style={[styles.floatingStatValue, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{distance || '0'} km</Text>
            <Text style={[styles.floatingStatLabel, { color: isDark ? '#9CA3AF' : '#64748B' }]} numberOfLines={1}>Distance to pickup</Text>
          </View>
        </View>

        <View style={[styles.floatingStatDivider, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]} />

        <View style={styles.floatingStatItem}>
          <View style={[styles.floatingStatIcon, { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.2)' : '#F0FDF4' }]}>
            <Ionicons name="time-outline" size={ms(16)} color="#22C55E" />
          </View>
          <View style={styles.floatingStatTextCol}>
            <Text style={[styles.floatingStatValue, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{eta || '0'} min</Text>
            <Text style={[styles.floatingStatLabel, { color: isDark ? '#9CA3AF' : '#64748B' }]} numberOfLines={1}>Est. time to reach</Text>
          </View>
        </View>

        <View style={[styles.floatingStatDivider, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]} />

        <View style={styles.floatingStatItem}>
          <View style={[styles.floatingStatIcon, { backgroundColor: isDark ? 'rgba(71, 85, 105, 0.2)' : '#F8FAFC' }]}>
            <Ionicons name="wallet-outline" size={ms(16)} color={isDark ? '#94A3B8' : '#0F172A'} />
          </View>
          <View style={styles.floatingStatTextCol}>
            <Text style={[styles.floatingStatValue, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>₹{ride.estimated_fare || ride.amount || '0'}</Text>
            <Text style={[styles.floatingStatLabel, { color: isDark ? '#9CA3AF' : '#64748B' }]} numberOfLines={1}>Estimated fare</Text>
          </View>
        </View>
      </View>

      {/* Floating Action Buttons */}
      <View style={[styles.topOverlay, { top: insets.top + vs(155) }]}>
        <View style={{ flex: 1 }} />
        <View style={styles.rightActionsColumn}>

          <TouchableOpacity
            style={[styles.recenterFab, { backgroundColor: theme.colors.card }]}
            onPress={() => {
              setIsAutoFollow(true);
              if (mapRef.current && driverLocation) {
                mapRef.current.animateCamera({
                  center: driverLocation,
                  heading: markerRotationRef.current,
                  pitch: 45,
                  zoom: 18,
                }, { duration: 500 });
              }
            }}
          >
            <MaterialCommunityIcons
              name="crosshairs-gps"
              size={ms(24)}
              color={isAutoFollow ? theme.colors.primary : (isDark ? "#9CA3AF" : "#6B7280")}
            />
          </TouchableOpacity>

        </View>
      </View>


      {/* Dynamic Bottom Sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        backgroundComponent={CustomBackground}
        handleIndicatorStyle={{ backgroundColor: isDark ? '#4B5563' : '#D1D5DB', width: ms(40) }}
      >
        <BottomSheetView style={[styles.bottomSheetContent, { paddingBottom: insets.bottom + vs(20) }]}>
          <>
            {/* Rider Info Card */}
            <View style={styles.riderRow}>
              {resolveImageUrl(ride.passenger_details?.image || ride.passenger_details?.profile_picture || ride.user_details?.profile_url || ride.user_details?.profile_picture || ride.riderImage || ride.customer?.profile_url || ride.customer?.profile_picture || ride.customer?.image) ? (
                <Image
                  source={{ uri: resolveImageUrl(ride.passenger_details?.image || ride.passenger_details?.profile_picture || ride.user_details?.profile_url || ride.user_details?.profile_picture || ride.riderImage || ride.customer?.profile_url || ride.customer?.profile_picture || ride.customer?.image) }}
                  style={[styles.riderAvatar, { borderColor: isDark ? '#1E293B' : '#FFF' }]}
                />
              ) : (
                <View style={[styles.riderAvatar, { backgroundColor: isDark ? '#1E293B' : '#EEF2FF', justifyContent: 'center', alignItems: 'center', borderWidth: 0 }]}>
                  <Text style={[styles.avatarInitials, { color: theme.colors.primary, fontSize: ms(18), fontWeight: '800' }]}>
                    {String(ride.passenger_details?.name || ride.user_details?.full_name || ride.user_details?.first_name || ride.passenger || ride.passenger_name || ride.customer?.name || 'P').trim().substring(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.riderMeta}>
                <Text style={[styles.riderName, { color: theme.colors.text }]} numberOfLines={1}>
                  {ride.passenger_details?.name || ride.user_details?.full_name || ride.user_details?.first_name || ride.passenger || ride.passenger_name || ride.customer?.name || 'Passenger'}
                </Text>
                <View style={styles.ratingRow}>
                  <Text style={[styles.ratingText, { color: '#F59E0B', marginLeft: 0 }]}>
                    {Number(ride.passenger_details?.rating ?? ride.user_details?.rating ?? ride.passenger_rating ?? ride.rating ?? ride.customer?.rating ?? 0).toFixed(1)}
                  </Text>
                  <Ionicons name="star" size={ms(12)} color="#F59E0B" style={{ marginHorizontal: ms(4) }} />
                  <Text style={[styles.ratingText, { color: isDark ? '#9CA3AF' : '#64748B', marginLeft: 0 }]}>
                    ({ride.passenger_details?.total_rides ?? ride.user_details?.total_rides ?? ride.total_rides ?? ride.customer?.total_rides ?? 0} rides)
                  </Text>
                </View>
              </View>

              <View style={styles.riderActions}>
                <View style={styles.actionBtnContainer}>
                  <TouchableOpacity
                    style={[styles.actionBtnRound, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F8FAFC' }]}
                    onPress={handleChatPress}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={ms(20)} color={theme.colors.text} />
                    {unreadCount > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <Text style={styles.actionBtnLabel}>{t('chat') || 'Chat'}</Text>
                </View>

                <View style={styles.actionBtnContainer}>
                  <TouchableOpacity
                    style={[styles.actionBtnRound, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F8FAFC' }]}
                    onPress={() => Linking.openURL(`tel:${ride?.phone || ride?.passenger_phone || ride?.user_details?.phone_number || ride?.passenger_details?.phone || ride?.customer?.phone || ride?.customer?.phone_number || ride?.riderPhone || ride?.user_phone || '112'}`)}
                  >
                    <Ionicons name="call-outline" size={ms(20)} color={theme.colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.actionBtnLabel}>{t('call') || 'Call'}</Text>
                </View>
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB', marginVertical: vs(4), marginHorizontal: ms(20) }} />

            <View style={[styles.addressRow, { backgroundColor: 'transparent', borderColor: 'transparent', marginHorizontal: ms(20), paddingHorizontal: 0, alignItems: 'flex-start' }]}>
              <View style={{ alignItems: 'center', marginRight: ms(8), marginTop: vs(4) }}>
                <Image source={require('../../assets/images/pickuppoint.png')} style={{ width: ms(24), height: ms(24), marginLeft: -ms(4) }} resizeMode="contain" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.addressText, { color: theme.colors.text, fontSize: ms(14), fontWeight: '500', lineHeight: vs(20) }]} numberOfLines={2}>
                  {ride.pickup_address || ride.pickup || t('location_not_available')}
                </Text>
              </View>
              <View style={{ backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF', paddingHorizontal: ms(12), paddingVertical: vs(6), borderRadius: ms(8), marginLeft: ms(8) }}>
                <Text style={{ color: '#3B82F6', fontSize: ms(11), fontWeight: '600' }}>Pickup</Text>
              </View>
            </View>

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC', marginHorizontal: ms(20), marginTop: vs(14), marginBottom: vs(8), padding: ms(10), borderRadius: ms(12), borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0' }}
              onPress={openExternalGoogleMap}
            >
              <Image source={require('../../assets/images/map.png')} style={{ width: ms(28), height: ms(28), marginRight: ms(12) }} resizeMode="contain" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.text, fontSize: ms(14), fontWeight: '600' }}>Open in Google Maps</Text>
                <Text style={{ color: isDark ? '#9CA3AF' : '#64748B', fontSize: ms(12), marginTop: vs(2) }}>Tap to navigate to pickup</Text>
              </View>
              <Ionicons name="open-outline" size={ms(20)} color={isDark ? '#9CA3AF' : '#64748B'} />
            </TouchableOpacity>

            {/* Arrival Action */}
            <View style={[styles.actionFooter, { borderTopWidth: 0, paddingHorizontal: ms(20) }]}>
              {distance <= 0.01 && (
                <View style={{ alignItems: 'center', marginBottom: vs(16), marginTop: vs(4) }}>
                  <Text style={{ fontSize: ms(22), fontWeight: '900', color: isDark ? '#FFFFFF' : '#0F172A', letterSpacing: -0.5, marginBottom: vs(6) }}>
                    You've reached the <Text style={{ color: '#E11D48' }}>pickup!</Text>
                  </Text>
                  <Text style={{ fontSize: ms(13), color: isDark ? '#9CA3AF' : '#64748B', fontWeight: '500' }} numberOfLines={1} adjustsFontSizeToFit>
                    Please confirm with the rider and start the trip journey.
                  </Text>
                </View>
              )}
              <View style={{ width: '100%' }}>
                <SwipeButton
                  title={swipeTitle}
                  onSwipeSuccess={handleArriveComplete}
                  activeColor={theme.colors.success || '#10B981'}
                  thumbIcon="chevron-double-right"
                />
              </View>
            </View>
          </>
        </BottomSheetView>
      </BottomSheet>

      {/* Success Animation Overlay */}
      {showSuccess && (
        <View style={[styles.successOverlay, { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255,255,255,0.95)' }]}>
          <Animated.View style={[styles.successCircle, animatedSuccessStyle, { backgroundColor: theme.colors.success || '#10B981', shadowColor: isDark ? '#FFF' : '#10B981' }]}>
            <Ionicons name="checkmark" size={ms(80)} color="#FFF" />
          </Animated.View>
          <Text style={[styles.successText, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
            {t('pickup.arrived_at_pickup')}
          </Text>
        </View>
      )}



      <CancellationModal
        isVisible={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancelTrip}
        isSubmitting={isCancelling}
        hiddenReasonIds={['VEHICLE_PROBLEM']}
      />

      {renderArriveConfirmModal()}
    </View>
  );
};


const styles = StyleSheet.create({
  card: {
    borderRadius: ms(16),
    padding: ms(16),
    marginBottom: vs(16),
    borderWidth: 1,
  },
  timeSubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ms(12),
    paddingVertical: vs(6),
    borderRadius: ms(12),
    marginBottom: vs(8),
    gap: ms(6),
  },
  dateSubHeaderText: {
    fontSize: ms(14),
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  timeSubHeaderText: {
    fontSize: ms(14),
    fontWeight: '800',
  },
  statsDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginHorizontal: ms(2),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: vs(8),
    marginTop: 0,
  },
  cardHeaderText: {
    fontSize: ms(12),
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(6),
    marginTop: vs(8),
    flexWrap: 'wrap',
  },
  miniTag: {
    paddingHorizontal: ms(8),
    paddingVertical: vs(4),
    borderRadius: ms(8),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  miniTagText: {
    fontSize: ms(12),
    fontWeight: '700',
  },
  priceBig: {
    fontSize: ms(24),
    fontWeight: '800',
  },
  locationContainer: {
    flexDirection: 'row',
    marginBottom: vs(12),
  },
  locationIndicator: {
    alignItems: 'center',
    marginRight: ms(14),
    paddingTop: vs(6), // Re-aligned with the PICKUP/DROP headings
    paddingBottom: vs(10),
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: vs(2),
  },
  addresses: {
    flex: 1,
  },
  addressBox: {
    justifyContent: 'center',
  },
  addrLabel: {
    fontSize: ms(13),
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: vs(2),
  },
  addrText: {
    fontSize: ms(15),
    fontWeight: '500',
  },
  rideStatsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: ms(12),
    paddingVertical: vs(10),
    borderRadius: ms(12),
    marginBottom: vs(16),
    gap: ms(8),
  },
  statItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(6),
  },
  rideStatsText: {
    fontSize: ms(13),
    fontWeight: '500',
  },
  ecoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(4),
  },
  ecoBadgeText: {
    fontSize: ms(6),
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  vehicleInfoContainer: {
    alignItems: 'center',
    paddingVertical: vs(12),
    marginHorizontal: ms(12),
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    marginBottom: vs(6),
  },
  vehicleNameText: {
    fontSize: ms(16),
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: vs(4),
  },
  vehicleBadgeRow: {
    flexDirection: 'row',
    gap: ms(8),
  },
  vehicleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ms(8),
    paddingVertical: vs(2),
    borderRadius: ms(8),
    gap: ms(4),
  },
  vehicleBadgeText: {
    fontSize: ms(10),
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  passengerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: vs(26),
  },
  passengerMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: ms(12),
  },
  avatarText: {
    fontSize: ms(15),
    fontWeight: '800',
  },
  psgrName: {
    fontSize: ms(15),
    fontWeight: '800',
  },
  psgrDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
    marginTop: vs(2),
  },
  psgrDetail: {
    fontSize: ms(12),
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(3),
  },
  floatCallBtn: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(22),
    backgroundColor: '#152D5E',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#152D5E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
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
  topHeaderBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ms(16),
    paddingBottom: vs(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    zIndex: 950,
  },
  headerLeft: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingRight: ms(8),
  },
  headerTitle: {
    fontSize: ms(18),
    fontWeight: '800',
    marginBottom: vs(2),
  },
  headerSubtitle: {
    fontSize: ms(11),
    fontWeight: '500',
  },
  helpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: ms(12),
    paddingVertical: vs(6),
    borderRadius: ms(20),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  helpBtnText: {
    fontSize: ms(13),
    fontWeight: '700',
  },
  helpDropdown: {
    position: 'absolute',
    top: vs(40),
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: ms(12),
    width: ms(130),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    zIndex: 9999,
  },
  helpDropdownItem: {
    paddingVertical: vs(12),
    paddingHorizontal: ms(16),
    flexDirection: 'row',
    alignItems: 'center',
  },
  helpDropdownText: {
    fontSize: ms(14),
    fontWeight: '600',
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  floatingStatsCard: {
    position: 'absolute',
    left: ms(16),
    right: ms(16),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: ms(12),
    borderRadius: ms(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 900,
  },
  floatingStatItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ms(2),
  },
  floatingStatIcon: {
    width: ms(28),
    height: ms(28),
    borderRadius: ms(8),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: ms(6),
  },
  floatingStatTextCol: {
    justifyContent: 'center',
    flex: 1,
  },
  floatingStatValue: {
    fontSize: ms(14),
    fontWeight: '800',
  },
  floatingStatLabel: {
    fontSize: ms(9),
    fontWeight: '600',
    marginTop: vs(2),
  },
  floatingStatDivider: {
    width: 1,
    height: '80%',
    marginHorizontal: ms(4),
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
    width: ms(100),
    height: ms(110),
  },
  etaPillAbsolute: {
    position: 'absolute',
    bottom: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: ms(12),
    paddingVertical: vs(6),
    borderRadius: ms(20),
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    elevation: 10,
    alignSelf: 'center',
    minWidth: ms(65),
    alignItems: 'center',
    marginBottom: vs(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  etaText: { color: '#FFF', fontSize: ms(11), fontWeight: '800' },
  driverMarker: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    borderWidth: 3,
    borderColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  pulseCircle: {
    position: 'absolute',
    width: ms(64),
    height: ms(64),
    borderRadius: ms(32),
    zIndex: 1,
  },
  pickupMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  navigateFabTop: {
    borderRadius: ms(22),
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    width: ms(44),
    height: ms(44),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(12),
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
    paddingHorizontal: ms(20),
    paddingTop: vs(4),
  },
  riderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: vs(4),
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
  riderName: { fontSize: ms(16), fontWeight: '500', letterSpacing: -0.5 },
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
  actionBtnContainer: {
    alignItems: 'center',
    marginLeft: ms(16),
  },
  actionBtnRound: {
    width: ms(42),
    height: ms(42),
    borderRadius: ms(21),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: vs(4),
  },
  actionBtnLabel: {
    fontSize: ms(11),
    fontWeight: '600',
    color: '#64748B',
  },
  divider: {
    height: 1.5,
    marginVertical: vs(8),
    opacity: 0.2,
  },
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
  tripInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginTop: vs(8),
    marginBottom: vs(16),
    backgroundColor: 'transparent',
    paddingVertical: 0,
    width: '100%',
  },
  infoBlock: { alignItems: 'center', width: '30%' },
  infoIconContainer: {
    marginBottom: vs(6),
    width: ms(32),
    height: ms(32),
    borderRadius: ms(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: { fontSize: ms(11), textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700', opacity: 0.6 },
  infoValue: { fontSize: ms(17), fontWeight: '700', marginTop: vs(2) },
  infoUnit: { fontSize: ms(13), fontWeight: '600' },
  addressRow: {
    flexDirection: 'row',
    padding: ms(8),
    borderRadius: ms(16),
    alignItems: 'center',
    marginBottom: vs(8),
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
  cancelTripBtn: { marginTop: vs(12), padding: ms(10), minWidth: ms(150), alignItems: 'center' },
  cancelTxt: { color: '#B91C1C', fontSize: ms(14), fontWeight: '800', letterSpacing: 0.5 },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  successCircle: {
    width: ms(120),
    height: ms(120),
    borderRadius: ms(60),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: vs(20),
    elevation: 15,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  successText: { fontSize: ms(24), fontWeight: '900', textAlign: 'center' },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    zIndex: 2000,
  },
  reasonModal: {
    borderTopLeftRadius: ms(32),
    borderTopRightRadius: ms(32),
    paddingBottom: Platform.OS === 'ios' ? vs(40) : vs(24),
    paddingHorizontal: ms(20),
    paddingTop: vs(16),
    maxHeight: '85%',
  },
  modalIndicator: {
    width: ms(40),
    height: vs(4.5),
    borderRadius: ms(3),
    alignSelf: 'center',
    marginBottom: vs(12),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: vs(16),
  },
  modalContactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: vs(10),
    borderRadius: ms(12),
    marginBottom: vs(18),
  },
  modalContactBtnText: {
    fontSize: ms(14),
    fontWeight: '700',
    marginLeft: ms(8),
  },
  modalTitle: {
    fontSize: ms(20),
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  modalSubtitle: {
    fontSize: ms(13),
    opacity: 0.6,
    fontWeight: '600',
    marginTop: vs(2),
  },
  reasonsScrollView: {
    maxHeight: vs(280),
  },
  reasonsList: {
    marginBottom: vs(5),
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: vs(14),
    paddingHorizontal: ms(16),
    borderRadius: ms(16),
    borderWidth: 1.5,
    borderColor: 'transparent',
    marginBottom: vs(8),
  },
  activeReasonPenalty: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderColor: '#B91C1C',
  },
  activeReasonNoPenalty: {
    backgroundColor: 'rgba(33, 150, 243, 0.05)',
    borderColor: '#2196F3',
  },
  reasonText: {
    fontSize: ms(15),
    fontWeight: '700',
  },
  otherInputContainer: {
    marginTop: vs(4),
    marginBottom: vs(12),
  },
  otherTextInput: {
    height: vs(80),
    borderWidth: 1.5,
    borderRadius: ms(16),
    padding: ms(14),
    fontSize: ms(14),
    fontWeight: '600',
    textAlignVertical: 'top',
  },
  radioCircle: {
    width: ms(22),
    height: ms(22),
    borderRadius: ms(11),
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: ms(12),
    height: ms(12),
    borderRadius: ms(6),
  },
  penaltyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: ms(16),
    borderRadius: ms(16),
    marginBottom: vs(28),
  },
  penaltyText: {
    fontSize: ms(13),
    marginLeft: ms(10),
    flex: 1,
    fontWeight: '600',
    lineHeight: ms(18),
  },
  confirmCancelBtn: {
    height: ms(60),
    borderRadius: ms(30),
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  confirmCancelBtnText: {
    fontSize: ms(18),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  navModal: {
    borderTopLeftRadius: ms(32),
    borderTopRightRadius: ms(32),
    paddingBottom: vs(40),
    paddingHorizontal: ms(24),
    paddingTop: vs(16),
  },
  navOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: vs(20),
    paddingHorizontal: ms(12),
    borderBottomWidth: 1.5,
  },
  navOptionText: { fontSize: ms(17), marginLeft: ms(16), fontWeight: '700' },
  closeBtn: { marginTop: vs(24), alignItems: 'center', padding: ms(10) },

  /* Ride Details Modal Styles */
  detailsModal: {
    borderTopLeftRadius: ms(32),
    borderTopRightRadius: ms(32),
    paddingBottom: Platform.OS === 'ios' ? vs(40) : vs(24),
    paddingHorizontal: ms(20),
    paddingTop: vs(20),
    maxHeight: '92%',
  },
  detailsContent: {
    marginTop: vs(5),
  },
  modalRideIdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(16),
  },
  rideIdText: {
    fontSize: ms(13),
    fontWeight: '600',
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
  },
  iconColumn: {
    width: ms(24),
    alignItems: 'center',
    paddingTop: vs(6), // Re-aligned with the headings
  },
  dotMarker: {
    width: ms(10),
    height: ms(10),
    borderRadius: ms(5),
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
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentIconBox: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(12),
    alignItems: 'center',
    justifyContent: 'center',
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
  optionsMenuContainer: {
    width: '80%',
    borderRadius: ms(16),
    overflow: 'hidden',
    paddingVertical: vs(8),
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: vs(12),
    paddingHorizontal: s(20),
    gap: s(10),
  },
  optionIconContainer: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(18),
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    fontSize: ms(16),
    fontWeight: '600',
  },
  optionDivider: {
    height: 1,
    width: '100%',
  },
  bottomSheet: {
    padding: ms(24),
    paddingTop: ms(12),
    borderTopLeftRadius: ms(24),
    borderTopRightRadius: ms(24),
    alignItems: 'center',
    width: '100%',
  },
  dragHandle: {
    width: ms(40),
    height: ms(4),
    backgroundColor: '#E2E8F0',
    borderRadius: ms(2),
    marginBottom: vs(16),
  },
  sheetTitle: {
    fontSize: ms(20),
    fontWeight: '700',
    marginBottom: vs(8),
    textAlign: 'center',
  },
  sheetSubtitle: {
    fontSize: ms(14),
    marginBottom: vs(24),
    lineHeight: vs(20),
  },
  sheetButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: ms(12),
  },
  sheetCancelBtn: {
    flex: 1,
    paddingVertical: vs(14),
    backgroundColor: '#F3F4F6',
    borderRadius: ms(12),
    alignItems: 'center',
  },
  sheetCancelBtnText: {
    color: '#374151',
    fontSize: ms(16),
    fontWeight: '700',
  },
  sheetConfirmBtn: {
    flex: 1,
    paddingVertical: vs(14),
    borderRadius: ms(12),
    alignItems: 'center',
  },
  sheetConfirmBtnText: {
    color: '#FFFFFF',
    fontSize: ms(16),
    fontWeight: '700',
  },
});

const darkMapStyle = [
  { 'elementType': 'geometry', 'stylers': [{ 'color': '#212121' }] },
  { 'elementType': 'labels.icon', 'stylers': [{ 'visibility': 'off' }] },
  { 'elementType': 'labels.text.fill', 'stylers': [{ 'color': '#757575' }] },
  { 'elementType': 'labels.text.stroke', 'stylers': [{ 'color': '#212121' }] },
  { 'featureType': 'administrative', 'elementType': 'geometry', 'stylers': [{ 'color': '#757575' }] },
  { 'featureType': 'administrative.country', 'elementType': 'labels.text.fill', 'stylers': [{ 'color': '#9e9e9e' }] },
  { 'featureType': 'administrative.land_parcel', 'stylers': [{ 'visibility': 'off' }] },
  { 'featureType': 'administrative.locality', 'elementType': 'labels.text.fill', 'stylers': [{ 'color': '#bdbdbd' }] },
  { 'featureType': 'poi', 'elementType': 'labels.text.fill', 'stylers': [{ 'color': '#757575' }] },
  { 'featureType': 'poi.park', 'elementType': 'geometry', 'stylers': [{ 'color': '#181818' }] },
  { 'featureType': 'road', 'elementType': 'geometry.fill', 'stylers': [{ 'color': '#2c2c2c' }] },
  { 'featureType': 'road', 'elementType': 'labels.text.fill', 'stylers': [{ 'color': '#8a8a8a' }] },
  { 'featureType': 'road.arterial', 'elementType': 'geometry', 'stylers': [{ 'color': '#373737' }] },
  { 'featureType': 'road.highway', 'elementType': 'geometry', 'stylers': [{ 'color': '#3c3c3c' }] },
  { 'featureType': 'road.highway.controlled_access', 'elementType': 'geometry', 'stylers': [{ 'color': '#4e4e4e' }] },
  { 'featureType': 'road.local', 'elementType': 'labels.text.fill', 'stylers': [{ 'color': '#616161' }] },
  { 'featureType': 'transit', 'elementType': 'labels.text.fill', 'stylers': [{ 'color': '#757575' }] },
  { 'featureType': 'water', 'elementType': 'geometry', 'stylers': [{ 'color': '#000000' }] },
  { 'featureType': 'water', 'elementType': 'labels.text.fill', 'stylers': [{ 'color': '#3d3d3d' }] },
];

export default PickupMapScreen;
