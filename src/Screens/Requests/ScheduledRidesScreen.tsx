import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import moment from 'moment';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  TouchableOpacity,
  Animated,
  RefreshControl,
  Modal,
  Image,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useHaptic } from '../../hooks/useHaptic';
import Ionicons from 'react-native-vector-icons/Ionicons';
import NetInfo from '@react-native-community/netinfo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import DateTimePicker from '@react-native-community/datetimepicker';

import { PickupMapScreen_Nav, ScheduledRideDetails_Nav } from '../../Navigations/navigations';
import { useAppTheme } from '../../context/ThemeContext';
import AppStatusBar from '../../Components/AppStatusBar';
import { useAlert } from '../../context/AlertContext';
import { useToast } from '../../context/ToastContext';
import { hS as s, vS as vs, mS as ms } from '../../lib/scale';
import RideSkeleton from './components/RideSkeleton';
import { setMyAcceptedRideId, setCurrentRide, Ride } from '../../redux/rideSlice';
import { useGetIncomingTripsQuery, useAcceptTripMutation, useCancelTripMutation, useLazyGetTripByIdQuery, useSkipTripMutation, useArrivingTripMutation } from '../../service/driverApi';
import { useGetMySubscriptionQuery } from '../../service/userApi';
import { scheduledRideService } from '../../services/scheduledRideService';
import socketService from '../../service/socketService';



type SortOption = 'time' | 'price' | 'distance';
type FilterType = 'all' | 'outstation_one_way' | 'one_way' | 'round_trip' | 'outstation_round_trip' | 'high_value';


import { HeaderSection, TopTabs, DateSelectorSection, StatsRow, ScheduledRideCard } from './components/ScheduledRideComponents';

const getRideTypeDisplayText = (rideType: string) => {
  let displayType = rideType || 'ONE_WAY';
  if (displayType === 'OUTSTATION_ROUND_TRIP') return 'OUTSTATION ROUND TRIP';
  if (displayType === 'OUTSTATION_ONE_WAY') return 'OUTSTATION ONE WAY';
  return displayType;
};

const ScheduledRidesScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { theme, isDark } = useAppTheme();
  const { showAlert } = useAlert();
  const { showToast } = useToast();
  const { triggerHaptic } = useHaptic();

  // Access online status from Redux
  const user = useSelector((state: any) => state.userSlice.user);
  const isOnline = user?.isOnline;

  const { data: rawTrips, isLoading: isTripsLoading, refetch: refetchTrips } = useGetIncomingTripsQuery('SCHEDULED', {
    pollingInterval: 10000, // Always poll for scheduled rides
  });
  const { data: subData } = useGetMySubscriptionQuery();
  const [acceptTripMutation] = useAcceptTripMutation();
  const [cancelTripMutation] = useCancelTripMutation();
  const [getTripById] = useLazyGetTripByIdQuery();
  const [skipTrip] = useSkipTripMutation();
  const [arrivingTrip] = useArrivingTripMutation();

  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'live' | 'scheduled'>('scheduled');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [sortBy, setSortBy] = useState<SortOption>('time');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [showSortModal, setShowSortModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [rideToCancel, setRideToCancel] = useState<Ride | null>(null);
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [otherReasonText, setOtherReasonText] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const dispatch = useDispatch();
  const myAcceptedRideId = useSelector((state: any) => state.ride.myAcceptedRideId);
  const currentRide = useSelector((state: any) => state.ride.currentRide);
  const [acceptingRideId, setAcceptingRideId] = useState<string | null>(null);
  const [acceptedSuccessId, setAcceptedSuccessId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // 🛡️ Ref to always have the latest myAcceptedRideId inside socket callbacks (avoids stale closure)
  const myAcceptedRideIdRef = useRef<string | null>(myAcceptedRideId);
  useEffect(() => { myAcceptedRideIdRef.current = myAcceptedRideId; }, [myAcceptedRideId]);
  useEffect(() => {
    socketService.onTripUpdate(() => {
      refetchTrips();
    });

    // Listen for specific scheduled ride events
    socketService.on('NEW_SCHEDULED_RIDE', () => {
      refetchTrips();
    });
    socketService.on('SCHEDULED_RIDE_TAKEN', (data: any) => {
      // 🛡️ Don't remove ride from local state if it's the one WE just accepted
      const acceptedId = myAcceptedRideIdRef.current;
      if (data?.tripId && acceptedId && String(data.tripId) === String(acceptedId)) {
        console.log('[ScheduledRides] Ignoring SCHEDULED_RIDE_TAKEN for our own accepted ride:', acceptedId);
        return;
      }
      refetchTrips();
    });
    socketService.on('SCHEDULED_RIDE_CANCELLED', (data: any) => {
      if (data.previousDriverId === (user.driverId || user.id)) {
        dispatch(setMyAcceptedRideId(null));
        dispatch(setCurrentRide(null));
        showAlert({
          title: t('ride_unassigned'),
          message: t('ride_unassigned_msg'),
          singleButton: true,
          icon: 'alert-circle-outline',
        });
      }
      refetchTrips();
    });

    socketService.on('TRIP_REMOVED', (data: any) => {
      // 🛡️ CRITICAL: Use ref (not closure) so we always have the latest accepted ride ID
      const acceptedId = myAcceptedRideIdRef.current;
      if (data?.tripId && String(data.tripId) !== String(acceptedId)) {
        setRides(prev => prev.filter(r => String(r.trip_id) !== String(data.tripId) && String(r.id) !== String(data.tripId)));
      } else {
        console.log('[ScheduledRides] Ignoring TRIP_REMOVED for our own accepted ride:', acceptedId);
      }
      refetchTrips();
    });

    return () => {
      socketService.offTripUpdate();
      socketService.off('NEW_SCHEDULED_RIDE');
      socketService.off('SCHEDULED_RIDE_TAKEN');
      socketService.off('SCHEDULED_RIDE_CANCELLED');
      socketService.off('TRIP_REMOVED');
    };
  }, [refetchTrips, user.driverId, user.id, dispatch, showAlert, t]);

  // Animation values
  const countPulseAnim = useRef(new Animated.Value(1)).current;
  const tabAnim = useRef(new Animated.Value(0)).current;

  /* ================= HELPERS ================= */

  const switchTab = useCallback((tab: 'live' | 'scheduled') => {
    setActiveTab(prevTab => {
      if (prevTab === tab) { return prevTab; }
      triggerHaptic(HapticFeedbackTypes.impactLight);
      return tab;
    });
    // Auto-refresh data when switching tabs
    refetchTrips();
  }, [triggerHaptic, navigation, refetchTrips]);

  useEffect(() => {
    if (route.params?.initialTab) {
      switchTab(route.params.initialTab as any);
    }
  }, [route.params?.initialTab, switchTab]);

  useEffect(() => {
    if (myAcceptedRideId && !acceptedSuccessId) {
      // Find the date of the accepted ride and switch to it
      const myRide = rides.find(r => String(r.trip_id) === String(myAcceptedRideId));
      if (myRide) {
        setSelectedDate(moment(myRide.scheduled_start_time).format('YYYY-MM-DD'));
      }
    }
  }, [myAcceptedRideId, acceptedSuccessId, rides]);

  useEffect(() => {
    if (isTripsLoading && !rawTrips) {
      setLoading(true);
    } else {
      setLoading(false);
    }
  }, [isTripsLoading, rawTrips]);

  useEffect(() => {
    const tripsArray = Array.isArray(rawTrips) ? rawTrips : (rawTrips as any)?.data;
    let mappedRides: Ride[] = [];
    
    if (tripsArray && Array.isArray(tripsArray)) {
      mappedRides = tripsArray.map((trip: any) => {
        const timeVal = trip.scheduled_start_time || trip.startTime || new Date().toISOString();
        return {
          ...trip,
          // Ensure core fields are present if backend names differ slightly
          trip_id: trip.trip_id || trip.id,
          pickup_address: trip.pickup_address || trip.pickup,
          drop_address: trip.drop_address || trip.drop,
          total_fare: typeof trip.total_fare === 'number' ? trip.total_fare : parseFloat(trip.total_fare || trip.price || '0'),
          distance_km: trip.distance_km ? parseFloat(trip.distance_km) : parseFloat(trip.distance || '0'),
          trip_status: (trip.trip_status || trip.status || '').toString().toUpperCase(),
          scheduled_start_time: timeVal,
          startTime: new Date(timeVal).getTime(), // Added for RideCard display & timer logic
          passenger: trip.passenger || trip.passenger_details?.name || trip.user_details?.full_name || trip.user_details?.first_name || trip.passenger_name || trip.customer?.name || 'Customer',
          phone: trip.phone || trip.passenger_details?.phone || trip.user_details?.phone_number || trip.customer?.phone || trip.passenger_phone || '',
          rating: typeof trip.rating === 'number' ? trip.rating : (typeof trip.passenger_details?.rating === 'number' ? trip.passenger_details.rating : (typeof trip.user_details?.rating === 'number' ? trip.user_details.rating : (typeof trip.customer?.rating === 'number' ? trip.customer.rating : 5.0))),
          paymentType: trip.paymentType || trip.payment_method || trip.paymentType || 'CASH',
          scheduled_status: trip.scheduled_status,
          re_dispatch_count: trip.re_dispatch_count,
          car_name: trip.car_name || trip.vehicle_model || trip.vehicle_type || 'Standard Sedan',
          transmission: String(trip.transmission || trip.transmission_type || 'Manual').replace('_', ' '),
          fuel_type: trip.fuel_type || trip.engine_type || 'Petrol',
        };
      });
    }

    // 🛡️ RECOVERY FIX: Inject the persisted accepted ride if the backend didn't return it
    if (currentRide && (currentRide.booking_type === 'SCHEDULED' || currentRide.is_scheduled)) {
      const currentTripId = currentRide.trip_id || (currentRide as any).id;
      const exists = mappedRides.some(r => String(r.trip_id) === String(currentTripId));
      
      if (!exists && String(currentTripId) === String(myAcceptedRideId)) {
        const timeVal = currentRide.scheduled_start_time || currentRide.startTime || new Date().toISOString();
        mappedRides.push({
          ...currentRide,
          trip_id: currentTripId,
          pickup_address: currentRide.pickup_address || (currentRide as any).pickup,
          drop_address: currentRide.drop_address || (currentRide as any).drop,
          total_fare: typeof currentRide.total_fare === 'number' ? currentRide.total_fare : parseFloat(currentRide.total_fare || (currentRide as any).price || '0'),
          distance_km: currentRide.distance_km ? parseFloat(currentRide.distance_km as any) : parseFloat((currentRide as any).distance || '0'),
          trip_status: (currentRide.trip_status || (currentRide as any).status || 'ACCEPTED').toString().toUpperCase(),
          booking_type: 'SCHEDULED',
          scheduled_start_time: timeVal,
          startTime: new Date(timeVal).getTime(),
          passenger: currentRide.passenger || currentRide.passenger_details?.name || currentRide.user_details?.full_name || currentRide.user_details?.first_name || (currentRide as any).passenger_name || (currentRide as any).customer?.name || 'Customer',
          phone: currentRide.phone || currentRide.passenger_details?.phone || currentRide.user_details?.phone_number || (currentRide as any).customer?.phone || (currentRide as any).passenger_phone || '',
          rating: typeof currentRide.rating === 'number' ? currentRide.rating : (typeof currentRide.passenger_details?.rating === 'number' ? currentRide.passenger_details.rating : (typeof currentRide.user_details?.rating === 'number' ? currentRide.user_details.rating : (typeof (currentRide as any).customer?.rating === 'number' ? (currentRide as any).customer.rating : 5.0))),
          paymentType: currentRide.paymentType || currentRide.payment_method || 'CASH',
          scheduled_status: currentRide.scheduled_status,
          re_dispatch_count: currentRide.re_dispatch_count,
          car_name: currentRide.car_name || currentRide.vehicle_model || currentRide.vehicle_type || 'Standard Sedan',
          transmission: String(currentRide.transmission || currentRide.transmission_type || 'Manual').replace('_', ' '),
          fuel_type: currentRide.fuel_type || currentRide.engine_type || 'Petrol',
        } as Ride);
      }
    }

    setRides(mappedRides);
  }, [rawTrips, currentRide, myAcceptedRideId]);

  const loadRides = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
      await refetchTrips();
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(!!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const acceptedRide = useMemo(
    () => rides.find((r) => String(r.trip_id) === String(myAcceptedRideId) && r.trip_status === 'ACCEPTED'),
    [rides, myAcceptedRideId]
  );

  /* ================= FILTERING & SORTING ================= */

  const baseEligibleRides = useMemo(() => {
    const subscription = subData?.data?.subscription || user?.subscription || user?.subscription_details;
    const billingCycle = subscription?.billing_cycle;
    const planName = (subscription?.plan?.name || subscription?.plan?.plan_name || subscription?.plan_name || '').toLowerCase();

    return rides.filter((ride) => {
      // Strictly include ONLY scheduled rides in this screen
      if (ride.booking_type !== 'SCHEDULED') { return false; }

      // ALWAYS allow my accepted ride to show in the accepted tab
      const isMine = String(ride.trip_id) === String(myAcceptedRideId) || String(ride.driver_id) === String(user.driverId || user.id);
      if (isMine) return true;

      // 2. No new scheduled rides if it's a 'day' plan or no subscription
      if (billingCycle === 'day' || !billingCycle) {
        return false;
      }

      // 3. Plan based restrictions
      const isPremium = planName.includes('premium');
      const isElite = planName.includes('elite');
      const isBasic = planName.includes('basic') || (!isPremium && !isElite); // Default to basic if unknown

      const type = (ride.ride_type || ride.service_type || '').toLowerCase();

      if (isBasic) {
        // Basic: local, one_way, and round_trip ONLY (no outstation)
        if (!['local', 'one_way', 'round_trip'].includes(type)) {
          return false;
        }
      }
      
      // Elite and Premium allow all
      return true;
    });
  }, [rides, myAcceptedRideId, subData, user]);

  const filteredRides = useMemo(() => {
    let result = baseEligibleRides.filter((ride) => {
      const isMine = String(ride.trip_id) === String(myAcceptedRideId) || String(ride.driver_id) === String(user.driverId || user.id);
      const status = ride.trip_status;
      
      if (['COMPLETED', 'CANCELLED', 'CANCEL', 'REJECTED'].includes(status)) {
        return false;
      }

      if (activeTab === 'live') {
        if (!isMine || status === 'PENDING') return false;
        // If it belongs to this driver and we are in the live tab, bypass date and category filters
        return true;
      } else {
        // In the scheduled tab, hide rides that are active/accepted (they belong in live)
        if (['ARRIVED', 'STARTED', 'ON_TRIP', 'ACCEPTED'].includes(status)) return false;
      }

      if (selectedDate !== 'all') {
        const rideDateStr = moment(ride.scheduled_start_time).format('YYYY-MM-DD');
        if (rideDateStr !== selectedDate) return false;
      }

      // Filter by Type (Categories)
      if (filterType !== 'all') {
        const type = (ride.ride_type || ride.service_type || '').toLowerCase();

        if (filterType === 'outstation_one_way') { if (type !== 'outstation_one_way') return false; }
        else if (filterType === 'outstation_round_trip') {
          if (type !== 'outstation_round_trip') return false;
        }
        else if (filterType === 'one_way') { if (type !== 'one_way') return false; }
        else if (filterType === 'round_trip') { if (type !== 'round_trip') return false; }
        else if (filterType === 'high_value') {
          if (ride.total_fare < 300) return false;
        }
      }

      return true;
    });

    // Apply Sorting
    result.sort((a, b) => {
      // Priority: Accepted ride always first
      if (a.trip_status === 'ACCEPTED') { return -1; }
      if (b.trip_status === 'ACCEPTED') { return 1; }

      if (sortBy === 'time') {
        return new Date(a.scheduled_start_time).getTime() - new Date(b.scheduled_start_time).getTime();
      }
      if (sortBy === 'price') {
        return b.total_fare - a.total_fare;
      }
      if (sortBy === 'distance') {
        return a.distance_km - b.distance_km;
      }
      return 0;
    });

    return result;
  }, [baseEligibleRides, selectedDate, sortBy, filterType, myAcceptedRideId]);

  const stats = useMemo(() => {
    let totalRides = 0;
    let totalTimeMins = 0;
    let totalDistance = 0;
    let estEarnings = 0;

    filteredRides.forEach(r => {
      totalRides++;
      // Rough estimation for time if not provided, assuming 1 min per km or similar
      const dist = r.distance_km || 0;
      totalDistance += dist;
      totalTimeMins += (dist * 2); // basic estimate: 2 mins per km
      estEarnings += r.total_fare || 0;
    });

    const hours = Math.floor(totalTimeMins / 60);
    const mins = Math.round(totalTimeMins % 60);
    
    return {
      totalRides,
      totalTime: `${hours}h ${mins}m`,
      totalDistance: Math.round(totalDistance),
      estEarnings: Math.round(estEarnings)
    };
  }, [filteredRides]);

  // 📊 Dynamic counts for each filter category in the current tab
  const filterCounts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const sameTabRides = baseEligibleRides.filter(r => {
      const status = r.trip_status;
      if (['COMPLETED', 'CANCELLED', 'CANCEL', 'REJECTED'].includes(status)) {
        return false;
      }

      const isMine = String(r.trip_id) === String(myAcceptedRideId);

      if (activeTab === 'live') {
        if (!isMine || status === 'PENDING') return false;
      } else {
        if (!isMine) {
          if (['ARRIVED', 'STARTED', 'ON_TRIP', 'ACCEPTED'].includes(status)) return false;
        } else {
          if (['ARRIVED', 'STARTED', 'ON_TRIP', 'ACCEPTED'].includes(status)) return false;
        }
      }

      if (selectedDate !== 'all') {
        const rideDateStr = moment(r.scheduled_start_time).format('YYYY-MM-DD');
        return rideDateStr === selectedDate;
      }
      return true;
    });

    const getCount = (type: FilterType) => {
      if (type === 'all') return sameTabRides.length;
      if (type === 'high_value') return sameTabRides.filter(r => r.total_fare >= 300).length;
      if (type === 'outstation_round_trip') {
        return sameTabRides.filter(r => (r.ride_type || r.service_type || '').toLowerCase() === 'outstation_round_trip').length;
      }
      return sameTabRides.filter(r => (r.ride_type || r.service_type || '').toLowerCase() === type).length;
    };

    return {
      all: getCount('all'),
      // local: getCount('local'),
      outstation_one_way: getCount('outstation_one_way'),
      one_way: getCount('one_way'),
      round_trip: getCount('round_trip'),
      outstation_round_trip: getCount('outstation_round_trip'),
      high_value: getCount('high_value'),
    };
  }, [baseEligibleRides, activeTab, myAcceptedRideId]);

  // 📊 Compute available dates for the Date Selector dot indicators
  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    baseEligibleRides.forEach(r => {
      const status = r.trip_status;
      if (['COMPLETED', 'CANCELLED', 'CANCEL', 'REJECTED'].includes(status)) return;
      const isMine = String(r.trip_id) === String(myAcceptedRideId);
      if (activeTab === 'live') {
        if (!isMine || status === 'PENDING') return;
      } else {
        if (!isMine) {
          if (['ARRIVED', 'STARTED', 'ON_TRIP', 'ACCEPTED'].includes(status)) return;
        } else {
          if (['ARRIVED', 'STARTED', 'ON_TRIP', 'ACCEPTED'].includes(status)) return;
        }
      }
      dates.add(moment(r.scheduled_start_time).format('YYYY-MM-DD'));
    });
    return dates;
  }, [baseEligibleRides, activeTab, myAcceptedRideId]);

  // No pulse animation needed for new UI



  const getRemainingTime = (startTime: number) => {
    const diff = startTime - currentTime;
    if (diff <= 0) { return { text: t('starting_now'), isUrgent: true }; }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return { text: t('days_left', { count: days }), isUrgent: false };
    }
    if (hours > 0) { return { text: `${hours}h ${minutes}m ${t('left')}`, isUrgent: hours < 1 }; }
    return { text: `${minutes}m ${t('left')}`, isUrgent: true };
  };

  /* ================= ACTIONS ================= */

  const checkOverlap = (newRide: Ride) => {
    if (!acceptedRide) { return false; }

    // Simple overlap check: within 1 hour of existing accepted ride
    const RIDE_DURATION_MS = 60 * 60 * 1000;
    const startA = new Date(acceptedRide.scheduled_start_time).getTime();
    const endA = startA + RIDE_DURATION_MS;
    const startB = new Date(newRide.scheduled_start_time).getTime();
    const endB = startB + RIDE_DURATION_MS;

    return (startA < endB && startB < endA);
  };

  const acceptRide = async (ride: Ride) => {
    if (!isConnected) {
      showAlert({
        title: t('error'),
        message: t('no_internet'),
        singleButton: true,
        icon: 'wifi-outline',
      });
      return;
    }
    // Production Safety: Disable if already accepted, currently accepting, or success animation is playing
    if (acceptedRide || acceptingRideId || acceptedSuccessId) { return; }

    // 1. Subscription Tier Check (Weekly/Monthly ONLY)
    const subscription = subData?.data?.subscription || user?.subscription || user?.subscription_details;
    const billingCycle = subscription?.billing_cycle; // 'week' | 'month' | 'day'

    if (billingCycle === 'day' || !billingCycle) {
      showAlert({
        title: t('subscription_required'),
        message: t('scheduled_rides_weekly_monthly_only'),
        singleButton: true,
        icon: 'lock-closed-outline',
      });
      return;
    }

    // 2. Expiry Guard (Ride time vs Expiry time)
    const expiryDate = moment(subscription?.expiry_date);
    const rideStartTime = moment(ride.scheduled_start_time || ride.startTime);

    if (expiryDate.isValid() && rideStartTime.isValid()) {
      if (rideStartTime.isAfter(expiryDate)) {
        showAlert({
          title: t('subscription_expiry_warning'),
          message: t('subscription_expires_before_ride'),
          singleButton: true,
          icon: 'time-outline',
        });
        return;
      }
    }

    if (checkOverlap(ride)) {
      showAlert({
        title: t('time_conflict_warning'),
        message: t('overlap_msg'),
        singleButton: true,
        icon: 'calendar-outline',
      });
      return;
    }

    setAcceptingRideId(ride.trip_id);
    triggerHaptic(HapticFeedbackTypes.impactMedium);

    try {
      const acceptResponse = await acceptTripMutation({ tripId: ride.trip_id, driverId: user.driverId || user.id }).unwrap();

      // 🛡️ PRODUCTION FIX: Store the SERVER response (which has booking_type, driver_id, etc.)
      // instead of the client-side ride object which may be missing critical fields.
      const serverTrip = acceptResponse?.data || acceptResponse;
      const rideToStore = {
        ...ride,
        ...serverTrip,
        // Ensure the trip_id is always present (some responses nest differently)
        trip_id: serverTrip?.trip_id || ride.trip_id,
        // Preserve UI-only fields from the client-side ride object
        startTime: ride.startTime || new Date(serverTrip?.scheduled_start_time || ride.scheduled_start_time).getTime(),
        passenger: serverTrip?.user_details?.full_name || serverTrip?.user_details?.first_name || ride.passenger,
        phone: serverTrip?.user_details?.phone_number || ride.phone,
        rating: serverTrip?.user_details?.rating || ride.rating,
      };

      // Show Success State
      setAcceptedSuccessId(ride.trip_id);
      dispatch(setMyAcceptedRideId(ride.trip_id));
      dispatch(setCurrentRide(rideToStore));
      triggerHaptic(HapticFeedbackTypes.notificationSuccess);

      // Schedule reminders for the accepted ride
      try {
        await scheduledRideService.scheduleRideReminders(ride.trip_id, ride.scheduled_start_time);
      } catch (reminderError) {
        console.log('Failed to schedule reminders:', reminderError);
      }

      // Delay to let the driver see the success state
      setTimeout(() => {
        setSelectedDate(moment(rideToStore.scheduled_start_time).format('YYYY-MM-DD'));
        switchTab('live');
        setAcceptedSuccessId(null);
        setSelectedRide(null);
        refetchTrips();
      }, 1500);

    } catch (error: any) {
      // Production Log: Only log the message for debugging, avoiding full JSON object in toasts
      console.log('Accept ride attempt failed:', error?.data?.message || error?.message);

      const isAlreadyCancelled = error?.data?.message?.toLowerCase().includes('cancelled') || error?.status === 410;
      const isAlreadyAccepted = error.status === 400 &&
        (error.data?.message?.toLowerCase().includes('already accepted') ||
          error.data?.message?.toLowerCase().includes('taken') ||
          error.data?.message?.toLowerCase().includes('no longer available'));

      if (isAlreadyCancelled) {
        showAlert({
          title: t('ride_cancelled') || 'Ride Already Cancelled',
          message: t('rider_cancelled_msg') || 'The ride has already been cancelled by the rider.',
          singleButton: true,
          icon: 'close-circle-outline',
          isDestructive: true,
        });
        setSelectedRide(null);
        refetchTrips();
      } else if (isAlreadyAccepted) {
        showAlert({
          title: t('already_accepted'),
          message: t('already_accepted_error'),
          singleButton: true,
          icon: 'information-circle-outline',
        });
        setSelectedRide(null);
        refetchTrips();
      } else {
        showAlert({
          title: t('error'),
          message: error.data?.message || t('failed_to_accept_ride') || 'Failed to accept the ride.',
          singleButton: true,
          icon: 'alert-circle-outline',
          isDestructive: true,
        });
      }
    } finally {
      setAcceptingRideId(null);
      setRefreshing(false);
    }
  };

  const passRide = (id: string) => {
    showAlert({
      title: t('pass_confirm_title'),
      message: t('pass_confirm_msg'),
      confirmText: t('pass'),
      cancelText: t('cancel'),
      isDestructive: true,
      onConfirm: async () => {
        try {
          triggerHaptic(HapticFeedbackTypes.impactMedium);
          // Optimistic Pass: Remove from local state immediately
          setRides(prev => prev.filter(r => r.trip_id !== id));
          await skipTrip(id).unwrap();
        } catch (err) {
          console.error('Failed to skip trip:', err);
          // If it fails, the next poll will bring it back anyway if not skipped on backend
        }
      },
    });
  };

  const cancelRide = async (ride: Ride) => {
    setRideToCancel(ride);
    setSelectedReason('');
    setShowCancelModal(true);
    triggerHaptic(HapticFeedbackTypes.impactMedium);
  };

  const startHeadingToPickup = async (ride: Ride) => {
    // 1. Online Status Check
    if (!isOnline) {
      showToast({
        message: t('must_go_online_to_start_ride'),
        type: 'error',
      });
      return;
    }

    // 2. Cancellation Guard (Critical Check)
    try {
      const tripResult = await getTripById(ride.trip_id).unwrap();
      const status = tripResult?.data?.trip_status || tripResult?.data?.status || tripResult?.trip_status;

      if (status === 'CANCELLED' || status === 'CANCEL') {
        showAlert({
          title: t('ride_cancelled') || 'Ride Cancelled',
          message: t('rider_cancelled_msg') || 'The rider has cancelled this trip.',
          singleButton: true,
          icon: 'close-circle-outline',
        });
        dispatch(setMyAcceptedRideId(null));
        dispatch(setCurrentRide(null));
        refetchTrips();
        return;
      }
    } catch (err) {
      console.warn('Status check failed, proceeding with caution:', err);
    }

    // 3. Open Custom Confirmation Modal
    showAlert({
      title: t('start_ride_confirmation') || 'Heading to Pickup?',
      message: t('confirm_start_heading_pickup') || 'Are you sure you want to start navigating to the passenger\'s location now?',
      confirmText: t('confirm') || 'Confirm',
      cancelText: t('cancel') || 'Cancel',
      onConfirm: async () => {
        try {
          triggerHaptic(HapticFeedbackTypes.impactMedium);

          // 1. Notify backend (Updates status to ARRIVING)
          await arrivingTrip(ride.trip_id).unwrap();

          // 2. Production Flow: Ensure driver state is updated before navigating
          const { setDriverStatus } = require('../../redux/userSlice');
          dispatch(setDriverStatus('ON_TRIP'));
          dispatch(setMyAcceptedRideId(ride.trip_id));
          dispatch(setCurrentRide(ride));

          // 3. Notify rider via socket (Redundant but good for legacy / real-time)
          socketService.emitEnRoute(ride.trip_id, user.driverId || user.id);

          // 4. Navigate
          navigation.navigate(PickupMapScreen_Nav, { ride });
        } catch (error) {
          console.error('Failed to transition to arriving status:', error);
          showToast({
            message: t('failed_to_start_navigation'),
            type: 'error'
          });
        }
      }
    });
  };

  const confirmCancelRide = async () => {
    if (!rideToCancel || !selectedReason) { return; }
    if (selectedReason === 'reason_other' && !otherReasonText.trim()) { return; }

    setIsCancelling(true);

    const backendReasonMap: Record<string, string> = {
      'reason_vehicle_problem': 'VEHICLE_PROBLEM',
      'reason_personal_emergency': 'PERSONAL_EMERGENCY',
      'reason_traffic': 'reason_heavy_traffic',
      'rider_no_show': 'NO_SHOW',
      'reason_other': 'reason_other',
    };

    const finalBackendReason = backendReasonMap[selectedReason] || 'OTHER';

    try {
      await cancelTripMutation({
        tripId: rideToCancel.trip_id,
        cancel_reason: finalBackendReason,
        notes: selectedReason === 'reason_other' ? otherReasonText.trim() : undefined,
        cancel_by: 'DRIVER'
      }).unwrap();

      // Cancel local reminders
      await scheduledRideService.cancelRideReminders(rideToCancel.trip_id);

      setShowCancelModal(false);
      setRideToCancel(null);
      dispatch(setMyAcceptedRideId(null));
      refetchTrips();
      showToast({
        message: t('ride_cancelled'),
        type: 'success',
      });
    } catch (error: any) {
      console.error('Failed to cancel ride', error);
      const isAlreadyCancelled = error?.data?.message?.toLowerCase().includes('already cancelled');

      showToast({
        message: isAlreadyCancelled
          ? (t('rider_cancelled_msg') || 'The ride has already been cancelled.')
          : (error.data?.message || 'Failed to cancel ride. Please try again.'),
        type: isAlreadyCancelled ? 'success' : 'error',
      });

      if (isAlreadyCancelled) {
        setShowCancelModal(false);
        setRideToCancel(null);
        dispatch(setMyAcceptedRideId(null));
        refetchTrips();
      }
    } finally {
      setIsCancelling(false);
    }
  };

  const handlePressIn = (scale: Animated.Value) => {
    triggerHaptic(HapticFeedbackTypes.impactMedium);
    Animated.spring(scale, {
      toValue: 0.94, // More pronounced scale in for better feedback
      friction: 4,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };
  const handlePressOut = (scale: Animated.Value) => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 3,
      tension: 150, // Snappier return animation
      useNativeDriver: true,
    }).start();
  };



  /* ================= RENDER COMPONENTS ================= */

  const renderSortModal = () => (
    <Modal
      visible={showSortModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowSortModal(false)}
    >
      <Pressable style={styles.modalOverlay} onPress={() => setShowSortModal(false)}>
        <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{t('sort_by')}</Text>
          <TouchableOpacity
            style={styles.sortOption}
            onPress={() => { setSortBy('time'); setShowSortModal(false); }}
          >
            <Ionicons name="time" size={ms(20)} color={sortBy === 'time' ? theme.colors.primary : theme.colors.paragraphText} />
            <Text style={[styles.sortOptionText, { color: sortBy === 'time' ? theme.colors.primary : theme.colors.text }]}>
              {t('start_time_earliest')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sortOption}
            onPress={() => { setSortBy('price'); setShowSortModal(false); }}
          >
            <Ionicons name="cash" size={ms(20)} color={sortBy === 'price' ? theme.colors.primary : theme.colors.paragraphText} />
            <Text style={[styles.sortOptionText, { color: sortBy === 'price' ? theme.colors.primary : theme.colors.text }]}>
              {t('price_high_low')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sortOption}
            onPress={() => { setSortBy('distance'); setShowSortModal(false); }}
          >
            <Ionicons name="map" size={ms(20)} color={sortBy === 'distance' ? theme.colors.primary : theme.colors.paragraphText} />
            <Text style={[styles.sortOptionText, { color: sortBy === 'distance' ? theme.colors.primary : theme.colors.text }]}>
              {t('distance_low_high')}
            </Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );

  const renderCancelModal = () => (
    <Modal
      visible={showCancelModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowCancelModal(false)}
    >
      <Pressable style={styles.modalOverlay} onPress={() => setShowCancelModal(false)}>
        <View style={[styles.cancelModalContainer, { backgroundColor: theme.colors.card }]}>
          <View style={{ alignItems: 'center', marginBottom: vs(16) }}>
            <View style={{ width: ms(40), height: ms(4), backgroundColor: isDark ? '#333' : '#E2E8F0', borderRadius: ms(2) }} />
          </View>
          <View style={[styles.modalHeader, { justifyContent: 'center' }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text, marginBottom: 0 }]}>
              {t('cancel_trip')}
            </Text>
          </View>

          <Text style={[styles.modalSubtitle, { color: theme.colors.paragraphText }]}>
            {t('select_reason')}
          </Text>

          <View style={styles.reasonsList}>
            {[
              'reason_vehicle_problem',
              'reason_personal_emergency',
              'reason_traffic',
              'rider_no_show',
              'reason_other',
            ].map((reasonKey) => (
              <View key={reasonKey}>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedReason(reasonKey);
                    if (reasonKey !== 'reason_other') setOtherReasonText('');
                  }}
                  style={[
                    styles.reasonItem,
                    { backgroundColor: 'transparent', borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderBottomWidth: 1 },
                    selectedReason === reasonKey && {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC',
                      borderColor: 'transparent',
                      borderBottomColor: 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.reasonText,
                      { color: theme.colors.text },
                      selectedReason === reasonKey && {
                        fontWeight: '700',
                      },
                    ]}
                  >
                    {t(reasonKey)}
                  </Text>
                  <View
                    style={[
                      styles.radioCircle,
                      { borderColor: isDark ? theme.colors.border : '#CBD5E1' },
                      selectedReason === reasonKey && { borderColor: '#EF4444' },
                    ]}
                  >
                    {selectedReason === reasonKey && <View style={[styles.radioDot, { backgroundColor: '#EF4444' }]} />}
                  </View>
                </TouchableOpacity>

                {reasonKey === 'reason_other' && selectedReason === 'reason_other' && (
                  <View style={{ paddingHorizontal: ms(16), paddingBottom: vs(12), backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC', borderBottomLeftRadius: ms(12), borderBottomRightRadius: ms(12) }}>
                    <TextInput
                      style={[
                        styles.otherReasonInput,
                        {
                          color: theme.colors.text,
                          borderColor: isDark ? theme.colors.border : '#E2E8F0',
                          backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#FFF'
                        }
                      ]}
                      placeholder={t('type_reason_here', 'Please specify...')}
                      placeholderTextColor={isDark ? theme.colors.textMuted : '#9CA3AF'}
                      value={otherReasonText}
                      onChangeText={setOtherReasonText}
                      multiline
                    />
                  </View>
                )}
              </View>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: ms(12) }}>
            <TouchableOpacity
              disabled={isCancelling}
              style={[
                styles.confirmCancelBtn,
                {
                  flex: 1,
                  backgroundColor: isDark ? theme.colors.border : '#F3F4F6',
                  opacity: isCancelling ? 0.5 : 1
                },
              ]}
              onPress={() => setShowCancelModal(false)}
            >
              <Text style={[styles.confirmCancelBtnText, { color: theme.colors.text }]}>
                {t('cancel')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              disabled={!selectedReason || (selectedReason === 'reason_other' && !otherReasonText.trim()) || isCancelling}
              style={[
                styles.confirmCancelBtn,
                {
                  flex: 1,
                  backgroundColor: 'transparent',
                },
              ]}
              onPress={confirmCancelRide}
            >
              {isCancelling ? (
                <ActivityIndicator color="#EF4444" size="small" />
              ) : (
                <Text style={[styles.confirmCancelBtnText, { color: selectedReason ? '#EF4444' : (isDark ? theme.colors.textMuted : '#9CA3AF') }]}>
                  {t('confirm_cancellation')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Modal>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: isDark ? theme.colors.background : '#FFFFFF' }]}
      edges={['top']}
    >
      <AppStatusBar />
      {/* Header Section */}
      <HeaderSection 
        isOnline={isOnline}
        onToggleStatus={() => navigation.navigate('Dashboard')}
        theme={theme}
        isDark={isDark}
        t={t}
      />

      <TopTabs 
        activeTab={activeTab}
        onTabChange={switchTab}
        hasAcceptedRide={!!myAcceptedRideId}
        theme={theme}
        isDark={isDark}
        t={t}
      />

      <DateSelectorSection 
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        onFilterPress={() => setShowSortModal(true)}
        onPickDatePress={() => setShowDatePicker(true)}
        availableDates={availableDates}
        theme={theme}
        isDark={isDark}
        t={t}
      />

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate && selectedDate !== 'all' ? moment(selectedDate).toDate() : new Date()}
          mode="date"
          display="default"
          onChange={(event, date) => {
            if (Platform.OS === 'android') {
              setShowDatePicker(false);
            }
            if (event.type === 'set' || event.type === 'dismissed') {
              setShowDatePicker(false);
            }
            if (date) {
              setSelectedDate(moment(date).format('YYYY-MM-DD'));
              setShowDatePicker(false);
            }
          }}
        />
      )}

      <Text style={[styles.sectionTitle, { color: theme.colors.text, marginHorizontal: ms(16), marginTop: vs(8), marginBottom: vs(8) }]}>Select Ride Type</Text>
      <View style={styles.filterBar}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={['all', 'one_way', 'round_trip', 'outstation_one_way', 'outstation_round_trip'] as FilterType[]}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => {
            const count = filterCounts[item];
            const getIcon = () => {
              switch (item) {
                case 'all': return 'grid-outline';
                // case 'local': return 'car-outline';
                case 'outstation_one_way': return 'navigate-outline';
                case 'one_way': return 'arrow-forward-circle-outline';
                case 'round_trip': return 'sync-outline';
                case 'outstation_round_trip': return 'sync-circle-outline';
                case 'high_value': return 'star-outline';
                default: return 'filter-outline';
              }
            };

            return (
              <TouchableOpacity
                onPress={() => {
                  setFilterType(item);
                  triggerHaptic(HapticFeedbackTypes.impactLight);
                }}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: filterType === item ? '#2563EB' : 'transparent',
                    borderColor: filterType === item ? '#2563EB' : (isDark ? theme.colors.border : '#E2E8F0'),
                  },
                ]}
              >
                {item !== 'all' && (
                  <Ionicons
                    name={getIcon()}
                    size={ms(14)}
                    color={filterType === item ? '#FFF' : '#3B82F6'}
                    style={{ marginRight: ms(4) }}
                  />
                )}
                {item === 'all' && (
                  <Ionicons
                    name="grid-outline"
                    size={ms(14)}
                    color={filterType === item ? '#FFF' : '#3B82F6'}
                    style={{ marginRight: ms(4) }}
                  />
                )}
                <Text style={[
                  styles.filterChipText,
                  { color: filterType === item ? '#FFF' : (isDark ? theme.colors.text : '#374151') },
                ]}>
                  {item === 'outstation_one_way' ? 'Outstation\nOne-way' : item === 'outstation_round_trip' ? 'Outstation\nRound-trip' : item === 'one_way' ? 'One-way' : item === 'round_trip' ? 'Round-trip' : 'All'}
                </Text>
                {/* No badges for the new design pills */}
                </TouchableOpacity>
            );
          }}
        />
      </View>

      <View style={{ height: 1, backgroundColor: isDark ? theme.colors.border : '#E2E8F0', marginHorizontal: ms(16), marginBottom: vs(12) }} />

      {loading ? (
        <FlatList
          data={[1, 2, 3]}
          renderItem={() => <RideSkeleton />}
          keyExtractor={(item) => item.toString()}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <FlatList
          data={filteredRides}
          keyExtractor={(item) => item.trip_id}
          renderItem={({ item }) => {
            return (
              <ScheduledRideCard
                item={item}
                getRemainingTime={getRemainingTime}
                theme={theme}
                isDark={isDark}
                t={t}
                activeTab={activeTab}
                onPress={(ride: any) => navigation.navigate(ScheduledRideDetails_Nav, { 
                  ride, 
                  onAccept: () => acceptRide(ride), 
                  onStartNavigation: () => startHeadingToPickup(ride),
                  onCancelPress: () => {
                    navigation.goBack();
                    setRideToCancel(ride);
                    setShowCancelModal(true);
                  }
                })}
              />
            );
          }}
          contentContainerStyle={[
            styles.listContent,
            filteredRides.length === 0 && { flexGrow: 1, justifyContent: 'center' }
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadRides(true)}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Image source={require('../../assets/images/noride.png')} style={styles.emptyImage} resizeMode="contain" />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Scheduled Rides</Text>
              <Text style={[styles.emptySubtitle, { color: isDark ? theme.colors.textMuted : '#64748B' }]}>
                You don't have any scheduled rides yet.{'\n'}New bookings for later will appear here.
              </Text>
              
              <View style={[styles.emptyBanner, { backgroundColor: isDark ? theme.colors.card : '#FFF', borderColor: isDark ? theme.colors.border : '#E2E8F0' }]}>
                <View style={styles.emptyBannerIconBg}>
                  <Ionicons name="calendar-outline" size={ms(20)} color="#2563EB" />
                </View>
                <View style={styles.emptyBannerTextContainer}>
                  <Text style={[styles.emptyBannerTitle, { color: theme.colors.text }]}>Stay Ready for Upcoming Bookings</Text>
                  <Text style={[styles.emptyBannerSubtitle, { color: isDark ? theme.colors.textMuted : '#64748B' }]}>
                    Keep your availability up to date to receive more scheduled ride requests.
                  </Text>
                </View>
              </View>
            </View>
          }
        />
      )}


      

      {renderSortModal()}
      {renderCancelModal()}
    </SafeAreaView>
  );
};

export default ScheduledRidesScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: ms(16),
    fontWeight: '700',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: vs(8),
    paddingHorizontal: s(16),
    gap: ms(8),
  },
  offlineText: {
    color: '#FFF',
    fontSize: ms(12),
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(16),
    minHeight: vs(56),
    paddingVertical: vs(8),
  },
  headerTitle: {
    fontSize: ms(18),
    fontWeight: '700',
    textAlign: 'center',
  },
  headerTitleContainer: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: s(8),
  },
  headerSubtitle: {
    fontSize: ms(12),
    fontWeight: '500',
    marginTop: vs(2),
    textAlign: 'center',
  },
  iconBtn: {
    width: ms(40),
    height: ms(40),
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabOuterContainer: {
    marginHorizontal: s(16),
    marginVertical: vs(12),
    borderRadius: ms(12),
    padding: ms(4),
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: ms(10),
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: vs(10),
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  slidingPill: {
    position: 'absolute',
    height: '100%',
    borderRadius: ms(10),

  },
  tabText: {
    fontSize: ms(14),
    fontWeight: '500',
  },
  activeTabText: {
    fontWeight: '700',
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(6),
  },
  countBadge: {
    width: ms(24),
    height: ms(24),
    borderRadius: ms(12),
    justifyContent: 'center',
    alignItems: 'center'
  },
  countBadgeText: {
    color: '#FFF',
    fontSize: ms(12),
    fontWeight: '800',
  },
  listContent: {
    paddingHorizontal: s(16),
    paddingBottom: vs(24),
  },
  card: {
    borderRadius: ms(16),
    padding: ms(16),
    marginBottom: vs(16),
    borderWidth: 1,
  },
  acceptedCard: {
    borderWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    padding: ms(24),
    borderTopLeftRadius: ms(32),
    borderTopRightRadius: ms(32),
    paddingBottom: vs(48),
    elevation: 20,
  },
  modalTitle: {
    fontSize: ms(20),
    fontWeight: '800',
    marginBottom: vs(24),
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: vs(18),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    gap: ms(14),
  },
  sortOptionText: {
    fontSize: ms(17),
    fontWeight: '600',
  },
  footerActions: {
    marginTop: vs(8),
  },
  buttonGroupHorizontal: {
    flexDirection: 'row',
    gap: ms(12),
  },
  buttonGroupVertical: {
    gap: vs(10),
  },
  primaryBtnText: {
    fontSize: ms(14),
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#FFF',
  },
  outlineBtnText: {
    fontSize: ms(14),
    fontWeight: '600',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: vs(8),
    marginTop: 0,
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
  cardHeaderText: {
    fontSize: ms(12),
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ms(6),
    paddingVertical: vs(4),
    borderRadius: ms(6),
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(6),
    marginTop: vs(8),
    flexWrap: 'wrap',
  },
  metadataBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ms(6),
    paddingVertical: vs(4),
    borderRadius: ms(6),
    gap: ms(4),
  },
  metadataText: {
    fontSize: ms(10),
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  timeBadgeText: {
    fontSize: ms(10),
    fontWeight: '800',
    marginLeft: ms(4),
  },
  priceBig: {
    fontSize: ms(24),
    fontWeight: '800',
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
  remainingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ms(8),
    paddingVertical: vs(4),
    borderRadius: ms(8),
    gap: ms(4),
  },
  remainingTagText: {
    fontSize: ms(11),
    fontWeight: '600',
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
  rideStatsText: {
    fontSize: ms(13),
    fontWeight: '500',
  },
  rideStatsTextBold: {
    fontWeight: '800',
    fontSize: ms(14),
  },
  statItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(6),
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
  statsDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginHorizontal: ms(2),
  },
  primaryBtnRounded: {
    height: vs(54),
    borderRadius: ms(16),
    justifyContent: 'center',
    alignItems: 'center',
  },
  outlineBtnRounded: {
    height: vs(54),
    borderRadius: ms(50),
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  primaryBtnLarge: {
    width: '100%',
    height: vs(54),
    borderRadius: ms(16),
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: vs(12),
  },
  textBtn: {
    alignSelf: 'center',
    paddingVertical: vs(8),
  },
  textBtnRed: {
    color: '#EF4444',
    fontSize: ms(14),
    fontWeight: '600',
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
    shadowRadius: 6,
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
  psgrName: {
    fontSize: ms(15),
    fontWeight: '800',
  },
  psgrDetail: {
    fontSize: ms(12),
  },
  psgrDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
    marginTop: vs(2),
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(3),
  },
  ratingText: {
    fontSize: ms(11),
    fontWeight: '800',
    color: '#92400E',
  },
  avatarText: {
    fontSize: ms(15),
    fontWeight: '800',
  },
  callBtn: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  filterBar: {
    paddingVertical: vs(8),
    marginBottom: vs(4),
  },
  filterList: {
    paddingHorizontal: s(16),
    gap: ms(6),
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ms(8),
    paddingVertical: vs(4),
    borderRadius: ms(16),
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: ms(10),
    fontWeight: '600',
    lineHeight: vs(12),
  },
  cancelModalContainer: {
    borderTopLeftRadius: ms(24),
    borderTopRightRadius: ms(24),
    padding: ms(20),
    paddingBottom: vs(32),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(16),
  },
  modalSubtitle: {
    fontSize: ms(14),
    marginBottom: vs(20),
  },
  reasonsList: {
    gap: vs(10),
    marginBottom: vs(24),
  },
  reasonItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: ms(16),
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: '#F8FAFC',
  },
  reasonText: {
    fontSize: ms(15),
    fontWeight: '500',
  },
  radioCircle: {
    width: ms(20),
    height: ms(20),
    borderRadius: ms(10),
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioDot: {
    width: ms(10),
    height: ms(10),
    borderRadius: ms(5),
  },
  confirmCancelBtn: {
    height: vs(54),
    borderRadius: ms(12),
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmCancelBtnText: {
    fontSize: ms(16),
    fontWeight: '700',
  },
  otherReasonInput: {
    minHeight: vs(80),
    borderWidth: 1,
    borderRadius: ms(8),
    padding: ms(12),
    fontSize: ms(14),
    textAlignVertical: 'top',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: s(16),
    marginTop: vs(30),
    minHeight: vs(250),
  },
  emptyImage: {
    width: s(150),
    height: s(110),
    marginBottom: vs(12),
  },
  emptyTitle: {
    fontSize: ms(16),
    fontWeight: '700',
    marginBottom: vs(4),
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: ms(12),
    textAlign: 'center',
    marginBottom: vs(16),
    lineHeight: vs(18),
  },
  emptyBanner: {
    flexDirection: 'row',
    marginTop: vs(8),
    padding: ms(12),
    borderWidth: 1,
    borderRadius: ms(12),
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: ms(10),
    width: '100%',
  },
  emptyBannerIconBg: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(10),
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyBannerTextContainer: {
    flex: 1,
  },
  emptyBannerTitle: {
    fontSize: ms(12),
    fontWeight: '700',
    marginBottom: vs(2),
  },
  emptyBannerSubtitle: {
    fontSize: ms(10),
    lineHeight: vs(14),
  },
  clearFilterBtn: {
    paddingVertical: vs(12),
    paddingHorizontal: s(24),
    borderRadius: ms(12),
    borderWidth: 1.5,
  },
  clearFilterText: {
    fontSize: ms(14),
    fontWeight: '700',
  },
  filterCountBadge: {
    marginLeft: s(6),
    paddingHorizontal: s(6),
    paddingVertical: vs(2),
    borderRadius: ms(10),
    minWidth: s(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCountText: {
    fontSize: ms(10),
    fontWeight: '800',
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
