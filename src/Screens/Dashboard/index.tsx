import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert,
  Modal,
  AppState,
  AppStateStatus,
  TouchableOpacity,
  Animated as RNAnimated,
  Linking,
  Platform,
} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { calculateAverageRating } from '../../utils/ratingUtils';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, NavigationProp, useFocusEffect, useIsFocused } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';
import { hS as s, vS as vs, mS as ms } from '../../lib/scale';
import { Text } from '../../Components';
import { RootState } from '../../redux/store';
import { setOnlineStatus, setDriverStatus, setUser } from '../../redux/userSlice';
// import { useSubscription } from '../../hooks/useSubscription';
import { useAppTheme } from '../../context/ThemeContext';
import { useRideFeed, RideItem } from '../../hooks/useRideFeed';
import { useDashboardMap } from '../../hooks/useDashboardMap';
import { useLocationTracker } from '../../hooks/useLocationTracker';
import { useGetMySubscriptionQuery } from '../../service/userApi';
import {
  useGetEarningsSummaryQuery as useGetDriverEarningsSummaryQuery,
  useGetWalletBalanceQuery,
  useGetEarningsTransactionsQuery,
  useGetRideActivityQuery,
  useGetDriverPerformanceQuery,
  useGoOnlineMutation,
  useGoOfflineMutation,
  useAcceptTripMutation,
  useArrivingTripMutation,
  useGetTodayOverviewQuery,
  useGetIncomingTripsQuery,
  useUpdateDriverMutation,
} from '../../service/driverApi';

// ── DashComponents ──
import DashboardMap from './dashComponents/DashboardMap';
import DashboardProfileHeader from './dashComponents/DashboardProfileHeader';
import TodayOverview from './dashComponents/TodayOverview';
import RechargeCard from './dashComponents/SubscriptionCard';
import SettingsModal from './dashComponents/SettingsModal';
import RideAlertCard from './dashComponents/RideAlertCard';
import AssignedRideCard from './dashComponents/AssignedRideCard';
import { TripStatus } from '../../types/trip';
import SwipeButton from './dashComponents/SwipeButton';
import DashboardSkeleton from './dashComponents/DashboardSkeleton';
import RecentActivity from './dashComponents/RecentActivity';
import WalletUpcomingCards from './dashComponents/WalletUpcomingCards';
import GoOfflineTab from './dashComponents/GoOfflineTab';
import SubscriptionRequiredModal from './dashComponents/SubscriptionRequiredModal';
import ConfirmationModal from '../../Components/ConfirmationModal';
import { parseOnlineTimeToSeconds, formatOnlineTime } from '../../utils/timeUtils';
import socketService from '../../service/socketService';
import RatingReceivedModal from '../../Components/RatingReceivedModal';
import AppStatusBar from '../../Components/AppStatusBar';
import { setLastTripRating } from '../../redux/rideSlice';
import axiosInstance from '../../api/axiosInstance';
// Use RideItem from the hook
// Use RideItem from the hook, but for now we keep the local type for compatibility if needed.
// Actually, let's just use it implicitly.

// ── Constants ──



const DriverDashboard = () => {
  const navigation = useNavigation<NavigationProp<any>>();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { t } = useTranslation();
  const { theme, isDark } = useAppTheme();
  const user = useSelector((state: RootState) => state.userSlice?.user);
  const currentRide = useSelector((state: RootState) => state.ride?.currentRide);
  const myAcceptedRideId = useSelector((state: RootState) => state.ride?.myAcceptedRideId);
  const isOnline = !!user?.isOnline;
  const dispatch = useDispatch();

  // ── VERIFICATION GUARD ──
  // Redirect unapproved drivers back to DocumentScreen
  const APPROVED_STATUSES = ['DOCUMENTS_APPROVED', 'DOCUMENTS_VERIFIED', 'ONBOARDING_COMPLETED', 'SUBSCRIPTION_ACTIVE', 'ACTIVE'];
  useEffect(() => {
    const status = user?.onboarding_status;
    const accountStatus = user?.status;
    const kycStatus = user?.kyc_status;
    const kycStatusStr = typeof kycStatus === 'object' ? kycStatus?.overallStatus : kycStatus;

    const isApproved = 
      (status && APPROVED_STATUSES.includes(status)) || 
      accountStatus === 'active' || 
      kycStatusStr === 'verified';

    if (user && !isApproved) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'DocumentScreen' }],
      });
    }
  }, [user?.onboarding_status, user?.status, user?.kyc_status, navigation]);

  const [goOnline] = useGoOnlineMutation();
  const [goOffline] = useGoOfflineMutation();
  const [acceptTripApi] = useAcceptTripMutation();
  const [arrivingTrip] = useArrivingTripMutation();
  const [updateDriver] = useUpdateDriverMutation();

  // ── BACKEND DATA ──
  const { data: subData, isLoading: isSubLoading, refetch: refetchSub } = useGetMySubscriptionQuery();
  const todayStr = new Date().toISOString().split('T')[0];
  const { data: earningsResult, isLoading: isEarningsLoading, refetch: refetchEarnings } = useGetDriverEarningsSummaryQuery(
    { driverId: user?.driverId || '', from: todayStr, to: todayStr },
    { skip: !user?.driverId }
  );
  const earningsSummary = earningsResult;

  const { data: walletBalanceResult, refetch: refetchWallet } = useGetWalletBalanceQuery(user?.driverId || '', { skip: !user?.driverId });
  const { data: recentActivityData, isFetching: isActivityFetching, refetch: refetchRecentActivity } = useGetRideActivityQuery(
    { driverId: user?.driverId || '', limit: 5, from: todayStr, to: todayStr },
    { skip: !user?.driverId }
  );

  const { data: todayRidesResult, refetch: refetchTodayRides } = useGetRideActivityQuery(
    { driverId: user?.driverId || '', from: todayStr, to: todayStr },
    { skip: !user?.driverId }
  );

  const { data: todayPerformanceResult, refetch: refetchPerformance } = useGetDriverPerformanceQuery(
    { driverId: user?.driverId || '', period: 'today' },
    { skip: !user?.driverId }
  );

  const { data: todayOverviewResult, refetch: refetchTodayOverview } = useGetTodayOverviewQuery(user?.driverId || '', { skip: !user?.driverId });
  const todayOverview = todayOverviewResult?.data;

  useFocusEffect(
    useCallback(() => {
      if (user?.driverId) {
        refetchEarnings();
        refetchWallet();
        refetchRecentActivity();
        refetchTodayRides();
        refetchPerformance();
        refetchTodayOverview();
      }
    }, [user?.driverId, refetchEarnings, refetchWallet, refetchRecentActivity, refetchTodayRides, refetchPerformance, refetchTodayOverview])
  );

  // 📈 All-time Ride Activity for Rating Calculation
  const { data: allHistoryResult } = useGetRideActivityQuery(
    { driverId: user?.driverId || '', limit: 1000 },
    { skip: !user?.driverId }
  );

  // 🕒 Scheduled Rides for Countdown Widget
  const { data: scheduledTripsResult, refetch: refetchScheduled } = useGetIncomingTripsQuery('SCHEDULED', {
    pollingInterval: 30000,
  });

  const extractArray = useCallback((result: any) => {
    if (!result) return [];
    if (Array.isArray(result)) return result;
    if (result.data && Array.isArray(result.data)) return result.data;
    if (result.trips && Array.isArray(result.trips)) return result.trips;
    return [];
  }, []);

  const nextScheduledRide = useMemo(() => {
    const trips = extractArray(scheduledTripsResult);
    if (!trips.length) return null;

    const myAcceptedRides = trips.filter((t: any) =>
      (t.trip_id === myAcceptedRideId || t.id === myAcceptedRideId) &&
      (t.status === 'ACCEPTED' || t.trip_status === 'ACCEPTED' || t.status === 'ARRIVING' || t.trip_status === 'ARRIVING')
    );

    if (!myAcceptedRides.length) return null;

    // Map and Sort to find the soonest one
    const mapped = myAcceptedRides.map((tripData: any) => {
      const timeVal = tripData.scheduled_start_time || tripData.startTime || new Date().toISOString();
      return {
        ...tripData,
        trip_id: tripData.trip_id || tripData.id,
        scheduled_start_time: timeVal,
        startTime: new Date(timeVal).getTime(),
        customer: {
          name: tripData.user_details?.full_name || tripData.user_details?.first_name || tripData.passenger_details?.name || tripData.passenger_name || tripData.customer?.name || 'Customer',
          ratingGiven: tripData.rating || tripData.user_rating || tripData.trip_rating || undefined,
          comment: tripData.feedback || tripData.comment || tripData.user_feedback || '',
        },
      };
    });

    mapped.sort((a: any, b: any) => a.startTime - b.startTime);
    return mapped[0];
  }, [scheduledTripsResult]);



  const todayRides = extractArray(todayRidesResult?.data);
  const computedEarnings = todayOverview?.totalEarnings !== undefined ? todayOverview.totalEarnings : todayRides.reduce((sum: number, ride: any) => {
    const amt = typeof ride.amount === 'string' ? parseFloat(ride.amount) : (ride.amount || 0);
    const rating = ride.rating || ride.user_rating || ride.trip_rating ? parseFloat(ride.rating || ride.user_rating || ride.trip_rating) : undefined;
    return sum + amt;
  }, 0);
  const computedCancellations = todayOverview?.cancellations !== undefined ? todayOverview.cancellations : todayRides.filter((ride: any) => ride.status === 'Cancelled' || ride.trip_status === 'CANCELLED').length;
  const computedCompletedRides = todayOverview?.tripsCompleted !== undefined ? todayOverview.tripsCompleted : todayRides.filter((ride: any) => ride.status === 'Completed' || ride.trip_status === 'COMPLETED').length;

  // Format online time from performance (assume it's in hours for now, as seen in performance screen)
  const onlineHoursFromBackend = todayOverview?.onlineMinutes !== undefined ? todayOverview.onlineMinutes / 60 : (todayPerformanceResult?.data?.onlineHours || 0);
  const onlineSecondsFromBackend = todayOverview?.onlineMinutes !== undefined ? todayOverview.onlineMinutes * 60 : Math.floor(onlineHoursFromBackend * 3600);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [acceptedRide, setAcceptedRide] = useState<RideItem | null>(null);

  const { rideQueue, acceptRide, rejectRide } = useRideFeed({
    isOnline,
    showConfirmModal,
    acceptedRide,
  });

  const { userLocation, currentAddress, locationError } = useDashboardMap({ isOnline });


  const [showOfflineSwipe, setShowOfflineSwipe] = useState(false);
  const [onlineSeconds, setOnlineSeconds] = useState(0);
  const [isBaseTimeLoaded, setIsBaseTimeLoaded] = useState(false);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const lastTripRating = useSelector((state: RootState) => state.ride.lastTripRating);

  const [sosContactsCount, setSosContactsCount] = useState<number | null>(null);
  const [isSosDismissed, setIsSosDismissed] = useState(false);

  // ── Alert Modal State ──
  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const [alertModalConfig, setAlertModalConfig] = useState({
    title: '',
    message: '',
    icon: 'information-circle-outline',
    isDestructive: false,
    singleButton: true,
    confirmText: undefined as string | undefined,
    cancelText: undefined as string | undefined,
    onConfirm: () => setAlertModalVisible(false),
    onCancel: () => setAlertModalVisible(false),
  });

  const showAlert = useCallback((title: string, message: string, options?: {
    icon?: string,
    isDestructive?: boolean,
    singleButton?: boolean,
    confirmText?: string,
    cancelText?: string,
    onConfirm?: () => void,
    onCancel?: () => void
  }) => {
    setAlertModalConfig({
      title,
      message,
      icon: options?.icon || 'information-circle-outline',
      isDestructive: options?.isDestructive || false,
      singleButton: options?.singleButton !== undefined ? options.singleButton : true,
      confirmText: options?.confirmText,
      cancelText: options?.cancelText,
      onConfirm: options?.onConfirm || (() => setAlertModalVisible(false)),
      onCancel: options?.onCancel || (() => setAlertModalVisible(false)),
    });
    setAlertModalVisible(true);
  }, []);

  // 📍 Battery-optimized location tracking
  const { locationDisabled, openLocationSettings } = useLocationTracker({
    driverId: user?.driverId,
    isTracking: isOnline || user?.driverStatus === 'ON_TRIP',
    mode: user?.driverStatus === 'ON_TRIP' ? 'moving' : 'idle',
    onLocationError: useCallback((errorMsg: string) => {
      showAlert(
        t('location_required') || 'Location Required',
        errorMsg,
        {
          icon: 'location-outline',
          isDestructive: true,
          singleButton: false,
          onConfirm: () => {
            if (Platform.OS === 'android') {
              Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() => Linking.openSettings());
            } else {
              Linking.openURL('app-settings:');
            }
            setAlertModalVisible(false);
          },
        },
      );
    }, [showAlert, t]),
    onLocationRecovered: useCallback(() => {
      showAlert(
        t('location_restored') || 'Location Restored',
        t('location_restored_msg') || 'GPS signal recovered. Your location is being shared again.',
        { icon: 'checkmark-circle-outline', singleButton: true },
      );
    }, [showAlert, t]),
  });

  useFocusEffect(
    useCallback(() => {
      if (!user?.driverId) return;



      const checkSosContacts = async () => {
        try {
          const response = await axiosInstance.get('/sos/contacts');
          if (response.data.success) {
            setSosContactsCount(response.data.data.length);
          }
        } catch (error) {
        }
      };

      checkSosContacts();
    }, [user?.driverId])
  );

  const onlineStartTime = useRef<number | null>(null);
  const accumulatedOnlineSeconds = useRef<number>(0);
  const timerPulseAnim = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    if (earningsSummary?.data?.totalTrips !== undefined) {
      if (!isOnline) {
      } else if (!isBaseTimeLoaded) {
        setIsBaseTimeLoaded(true);
      }
    }
  }, [earningsSummary, isOnline, isBaseTimeLoaded]);

  useEffect(() => {
    if (!isOnline) {
      if (onlineStartTime.current) {
        const elapsed = Math.floor((Date.now() - onlineStartTime.current) / 1000);
        accumulatedOnlineSeconds.current += elapsed;
        setOnlineSeconds(accumulatedOnlineSeconds.current);
      }
      onlineStartTime.current = null;
      setIsBaseTimeLoaded(false);
      return;
    }

    if (!onlineStartTime.current) {
      onlineStartTime.current = Date.now();
    }

    const interval = setInterval(() => {
      if (onlineStartTime.current) {
        const elapsed = Math.floor((Date.now() - onlineStartTime.current) / 1000);
        setOnlineSeconds(accumulatedOnlineSeconds.current + elapsed);
      }
    }, 1000);

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        onlineStartTime.current = Date.now();
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        if (onlineStartTime.current) {
          const elapsed = Math.floor((Date.now() - onlineStartTime.current) / 1000);
          accumulatedOnlineSeconds.current += elapsed;
          onlineStartTime.current = null;
        }
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [isOnline]);

  // ── Rating Calculation & Update ──
  useEffect(() => {
    if (allHistoryResult?.data && user?.driverId) {
      const rides = extractArray(allHistoryResult.data);
      const newRating = calculateAverageRating(rides);

      if (newRating !== null) {

        // Update only if if it's significant or different
        if (Math.abs((user.rating || 0) - newRating) > 0.001) {
          updateDriver({
            id: user.driverId,
            data: { rating: newRating }
          }).unwrap()
            .then(() => {
              // Only update the rating in Redux to avoid stale overwrites
              dispatch(setUser({ rating: newRating }));
            })
            .catch(err => {
              console.error('[RatingCalc] Failed to update driver rating:', err);
            });
        }
      }
    }
  }, [allHistoryResult, user?.driverId]);

  useEffect(() => {
    if (!isOnline || !user?.driverId) return;

    const handleRating = (tripData: any) => {
      dispatch(setLastTripRating({
        rating: tripData.rating || tripData.user_rating || tripData.trip_rating,
        feedback: tripData.feedback || tripData.comment || tripData.user_feedback || ''
      }));
      setRatingModalVisible(true);
    };

    socketService.onTripRated(handleRating);
    return () => socketService.offTripRated();
  }, [isOnline, user?.driverId, dispatch]);

  useEffect(() => {
    if (!isOnline) { return; }
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(timerPulseAnim, { toValue: 1.05, duration: 500, useNativeDriver: true }),
        RNAnimated.timing(timerPulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    ).start();
    return () => timerPulseAnim.stopAnimation();
  }, [isOnline, timerPulseAnim]);

  useEffect(() => {
    if (subData || earningsSummary || walletBalanceResult || recentActivityData) {
      setLoading(false);
    }
  }, [subData, earningsSummary, walletBalanceResult, recentActivityData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 5000);

    const allLoaded =
      !isSubLoading &&
      (!user?.driverId || (!isEarningsLoading && !isActivityFetching));

    if (allLoaded) {
      setLoading(false);
    }

    return () => clearTimeout(timer);
  }, [isSubLoading, isEarningsLoading, isActivityFetching, user?.driverId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchSub(),
      refetchEarnings(),
      refetchWallet(),
      refetchRecentActivity(),
      refetchTodayRides(),
      refetchPerformance(),
      refetchTodayOverview(),
      refetchScheduled(),
    ]);
    setRefreshing(false);
  }, [refetchSub, refetchEarnings, refetchWallet, refetchRecentActivity, refetchTodayRides, refetchPerformance, refetchTodayOverview, refetchScheduled]);

  const displayRating = useMemo(() => {
    if (allHistoryResult?.data) {
      const rides = extractArray(allHistoryResult.data);
      const newRating = calculateAverageRating(rides);
      if (newRating !== null) return newRating;
    }
    return user?.rating || 0;
  }, [allHistoryResult?.data, user?.rating, extractArray]);

  const displayTotalTrips = useMemo(() => {
    if (allHistoryResult?.data) {
      const rides = extractArray(allHistoryResult.data);
      const completedRides = rides.filter((ride: any) => 
        ride.status?.toUpperCase() === 'COMPLETED' || 
        ride.trip_status?.toUpperCase() === 'COMPLETED'
      );
      if (completedRides.length > 0) return completedRides.length;
    }
    return user?.total_trips || 0;
  }, [allHistoryResult?.data, user?.total_trips, extractArray]);

  const route = [] as { latitude: number; longitude: number }[];

  const driverName = user?.full_name || t('driver');

  if (loading) { return <DashboardSkeleton />; }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {isFocused && <AppStatusBar />}
      <View style={{ zIndex: 100 }}>
        {/* ── FIXED HEADER ── */}
        <DashboardProfileHeader
          isOnline={isOnline}
          driverName={driverName}
          rating={displayRating}
          totalTrips={displayTotalTrips}
          profileImage={user?.profile_picture}
          onSettingsPress={() => setSettingsVisible(true)}
          onProfilePress={() => navigation.navigate('Profile')}
          subscription={subData?.data?.subscription}
        />

        {/* ── GO OFFLINE HANGING TAB ── */}
        {
          isOnline && !showOfflineSwipe && rideQueue.length === 0 && (
            <View style={styles.offlineTabContainer}>
              <GoOfflineTab onPress={() => setShowOfflineSwipe(true)} />
            </View>
          )
        }
      </View>

      {/* ── FLOATING BANNERS CONTAINER ── */}
      <View style={{ position: 'absolute', top: vs(110) + insets.top, left: 0, right: 0, zIndex: 95, paddingHorizontal: s(16), gap: vs(10) }}>
        {/* ── LOCATION ERROR BANNER ── */}
        {locationError && isOnline && (
          <Animated.View
            entering={FadeInDown.duration(600)}
            style={[
              styles.errorBanner,
              { position: 'relative', marginHorizontal: 0, marginTop: 0, marginBottom: 0, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 },
              isDark && { backgroundColor: '#450a0a', borderLeftColor: '#ef4444' }
            ]}
          >
            <Ionicons name="warning" size={s(20)} color={isDark ? '#ef4444' : '#DC2626'} />
            <Text style={[styles.errorText, isDark && { color: '#fecaca' }]}>
              {locationError === 'User denied location permission'
                ? t('please_enable_location') || 'Please enable location access'
                : t('location_fetch_error') || 'Unable to fetch location. Please check your GPS.'}
            </Text>
          </Animated.View>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3B82F6']} />
        }
      >

        {/* ── MAP ── */}
        <DashboardMap
          userLocation={userLocation}
          currentAddress={currentAddress}
          isOnline={isOnline}
          routeCoordinates={route}
        />

        {/* ── SOS SAFETY TOOLKIT CARD ── */}
        {sosContactsCount !== null && sosContactsCount < 3 && !isSosDismissed && (
          <Animated.View entering={FadeInDown.duration(600)} style={[styles.inlineSosCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.sosCardHeader}>
              <View style={styles.sosCardLeft}>
                <View style={styles.sosCardIconRing}>
                  <Ionicons name="shield-checkmark" size={ms(26)} color={theme.colors.primary} />
                </View>
                <View style={styles.sosCardTextGroup}>
                  <Text style={[styles.sosCardTitle, { color: theme.colors.text }]}>Safety Toolkit</Text>
                  <Text style={[styles.sosCardSubtitle, isDark && { color: '#94A3B8' }]}>{sosContactsCount}/3 Recommended Contacts</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsSosDismissed(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ fontSize: ms(10), color: isDark ? '#94A3B8' : '#64748B', fontWeight: '500' }}>Close</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sosCardActionRow}>
              <Text style={[styles.sosCardActionText, isDark && { color: '#CBD5E1' }]}>Add trusted contacts for emergency alerts.</Text>
              <TouchableOpacity
                style={[styles.sosCardButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => navigation.navigate('SosContactsScreen')}
              >
                <Text style={styles.sosCardButtonText}>Setup Now</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}



        {/* ── TODAY'S OVERVIEW ── */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('todays_overview')}</Text>
        <TodayOverview
          earnings={String(computedEarnings.toFixed(2))}
          rides={computedCompletedRides}
          displayTimeFormatted={formatOnlineTime(onlineSecondsFromBackend || onlineSeconds, { h: t('h'), m: t('m'), s: t('s') })}
          distance={0}
          cancellations={computedCancellations}
          timerPulseAnim={timerPulseAnim}
          onEarningsPress={() => navigation.navigate('EarningsScreen')}
          onRidesPress={() => navigation.navigate('RideActivityScreen')}
        />

        {/* ── WALLET & UPCOMING RIDE ── */}
        <WalletUpcomingCards balance={walletBalanceResult?.data?.balance} upcomingRide={nextScheduledRide} />

        {/* ── SUBSCRIPTION CARD ── */}
        <RechargeCard subscription={subData?.data?.subscription} />

        {/* ── RECENT ACTIVITY ── */}
        <RecentActivity
          items={
            Array.isArray(recentActivityData?.data)
              ? recentActivityData.data.map((t: any) => ({
                id: t.trip_id || t.id,
                trip_code: t.trip_code || t.booking_code,
                route: t.pickup_address && t.drop_address ? `${t.pickup_address} → ${t.drop_address}` : (t.pickup && t.drop ? `${t.pickup} → ${t.drop}` : t.title || 'Unknown Route'),
                timeAgo: t.time || (t.date ? new Date(t.date).toLocaleDateString() : 'Recent'),
                amount: `₹${Math.abs(t.amount || t.total_fare || 0)}`,
                status: (t.trip_status || t.status || '').toLowerCase(),
              }))
              : []
          }
        />
      </ScrollView>

      {/* ── ALERTS / RECENT ── */}
      {
        rideQueue.length > 0 && (
          <View style={styles.rideOverlay}>
            <ScrollView
              style={{ width: '100%' }}
              contentContainerStyle={styles.rideScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {rideQueue.map((item, index) => {
                const onAccept = async () => {
                  try {
                    await acceptTripApi({ tripId: item.trip_id.toString(), driverId: user?.driverId || '' }).unwrap();
                    setAcceptedRide(item);
                    acceptRide(item.id);
                    dispatch(setDriverStatus(item.booking_type === 'SCHEDULED' ? 'HAS_UPCOMING_SCHEDULED' : 'ON_TRIP'));
                    refetchScheduled();
                    setShowConfirmModal(true);
                  } catch (e: any) {
                    showAlert('Cannot Accept Ride', e?.data?.message || 'Failed to accept trip.', { icon: 'close-circle-outline', isDestructive: true });
                  }
                };

                const isAssigned = item.trip_status?.toString().toUpperCase() === 'ASSIGNED' ||
                  item.trip_status?.toString().toUpperCase() === 'TRIP_ASSIGNED' ||
                  item.trip_status?.toString().toUpperCase() === 'ASSIGNED_RIDE';

                console.log(`[Dashboard] Rendering Ride: ${item.id} | Status: ${item.trip_status} | isAssigned: ${isAssigned}`);

                if (isAssigned) {
                  return (
                    <AssignedRideCard
                      key={item.id || `ride-${index}`}
                      item={item}
                      onAccept={onAccept}
                      onReject={() => rejectRide(item.id)}
                    />
                  );
                }

                return (
                  <RideAlertCard
                    key={item.id || `ride-${index}`}
                    item={item}
                    onAccept={onAccept}
                    onReject={() => rejectRide(item.id)}
                  />
                );
              })}
            </ScrollView>
          </View>
        )
      }

      {/* ── SWIPE TO GO ONLINE/OFFLINE ── */}
      {
        (!isOnline || showOfflineSwipe) && (
          <View style={[styles.swipeBox, { paddingBottom: vs(10), zIndex: 1000, backgroundColor: theme.colors.card }]}>
            {showOfflineSwipe && (
              <TouchableOpacity
                onPress={() => setShowOfflineSwipe(false)}
                style={{ position: 'absolute', right: s(16), top: vs(12), zIndex: 1100 }}
              >
                <Text style={{ fontSize: ms(14), color: isDark ? '#94A3B8' : '#64748B', fontWeight: '500' }}>Close</Text>
              </TouchableOpacity>
            )}
            <Text style={[styles.swipeTitle, { color: theme.colors.text }]}>
              {isOnline ? t('you_are_online') : t('you_are_offline')}
            </Text>
            <Text style={[styles.swipeSub, isDark && { color: '#94A3B8' }]}>
              {isOnline ? t('waiting_requests') : t('go_online_start')}
            </Text>
            <SwipeButton
              title={isOnline ? t('slide_offline') : t('slide_online')}
              activeColor={isOnline ? '#DC2626' : theme.colors.primary}
              onSwipeSuccess={async () => {
                let currentDriverId = user?.driverId;

                // 🛡️ Recovery: If driverId is missing, try to recover from secure storage
                if (!currentDriverId) {
                  try {
                    const { storage: storageUtil } = require('../../service/utils/storage');
                    const storedId = await storageUtil.getDriverId();
                    if (storedId) {
                      dispatch(setUser({ driverId: storedId }));
                      currentDriverId = storedId;
                    }
                  } catch (e) {
                    console.error('[Dashboard] Storage recovery failed:', e);
                  }

                  if (!currentDriverId) {
                    showAlert(
                      'Profile Not Ready',
                      'Your driver profile is still loading. Please wait a moment and try again. If this continues, try logging out and back in.',
                      { icon: 'time-outline' }
                    );
                    setShowOfflineSwipe(false);
                    return;
                  }
                }

                if (!isOnline) {
                  // Check if driver has an active subscription
                  if (!subData?.data?.subscription) {
                    setShowSubscriptionModal(true);
                    setShowOfflineSwipe(false);
                    return;
                  }

                  const proceedToOnline = async () => {
                    try {
                      const res = await goOnline(currentDriverId).unwrap();
                      dispatch(setOnlineStatus(true));
                      if (res?.upcomingRide) {
                        showAlert('Upcoming Ride', `You have a scheduled ride starting soon at ${res.upcomingRide.pickup_address}`, { icon: 'calendar-outline' });
                      }
                    } catch (e: any) {
                      showAlert('Error', e?.data?.message || 'Failed to go online', { icon: 'alert-circle-outline', isDestructive: true });
                    }
                    setShowOfflineSwipe(false);
                  };

                  if (Platform.OS === 'android') {
                    try {
                      const notifee = (await import('@notifee/react-native')).default;
                      const isOptimized = await notifee.isBatteryOptimizationEnabled();
                      if (isOptimized) {
                        showAlert(
                          'Background Priority',
                          `To receive ride requests reliably, please change the battery setting for vDrive to "Unrestricted" or "Don't Optimize".`,
                          {
                            icon: 'battery-dead',
                            singleButton: false,
                            confirmText: 'Fix Now',
                            cancelText: 'Skip',
                            onConfirm: () => {
                              Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS').catch(() => {
                                Linking.openSettings();
                              });
                              setAlertModalVisible(false);
                              setShowOfflineSwipe(false);
                            },
                            onCancel: () => {
                              proceedToOnline();
                            }
                          }
                        );
                        return;
                      }
                    } catch (e) {
                      console.log('Battery check failed', e);
                    }
                  }

                  proceedToOnline();
                } else {
                  // 🛡️ Safety: Prevent going offline if on an active ride
                  const isActiveTrip = currentRide && (
                    currentRide.booking_type === 'LIVE' ||
                    ['ARRIVING', 'ARRIVED', 'LIVE', 'ON_TRIP', 'DESTINATION_REACHED'].includes(currentRide.trip_status)
                  );

                  if (isActiveTrip) {
                    showAlert(
                      t('cannot_go_offline') || 'Cannot Go Offline',
                      t('complete_current_trip') || 'Please complete your current trip before going offline.',
                      { icon: 'hand-left-outline', isDestructive: true }
                    );
                    setShowOfflineSwipe(false);
                    return;
                  }

                  try {
                    await goOffline(currentDriverId).unwrap();
                    dispatch(setOnlineStatus(false));
                  } catch (e: any) {
                    console.error('[Dashboard] Go Offline Error:', e);

                    // Extract specific error message if available from RTK Query / Backend
                    const errorMessage =
                      e?.data?.message ||
                      e?.message ||
                      (typeof e?.data === 'string' ? e.data : null) ||
                      t('failed_to_go_offline') || 'Failed to go offline';

                    showAlert(t('error') || 'Error', errorMessage, { icon: 'alert-circle-outline', isDestructive: true });
                  }
                  setShowOfflineSwipe(false);
                }
              }}
              resetTrigger={isOnline}
            />
          </View>
        )
      }

      {/* ── SETTINGS MODAL ── */}
      <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />

      {/* ── SUBSCRIPTION REQUIRED MODAL ── */}
      <SubscriptionRequiredModal
        visible={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        onSubscribe={() => {
          setShowSubscriptionModal(false);
          navigation.navigate('RechargePlanScreen');
        }}
      />

      {/* ── ACCEPT RIDE CONFIRM MODAL ── */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
      >
        <View style={styles.confirmModalOverlay}>
          <Animated.View style={[styles.confirmModalBox, { transform: [{ scale: 1 }], backgroundColor: theme.colors.card }]}>
            <View style={styles.confirmIconRing}>
              <Ionicons name={acceptedRide?.booking_type === 'SCHEDULED' ? "calendar" : "checkmark-circle"} size={ms(60)} color={acceptedRide?.booking_type === 'SCHEDULED' ? theme.colors.primary : "#22C55E"} />
            </View>
            <Text style={[styles.confirmModalTitle, { color: theme.colors.text }]}>
              {acceptedRide?.booking_type === 'SCHEDULED' ? t('ride_scheduled', 'Ride Scheduled!') : t('ride_accepted', 'Ride Accepted!')}
            </Text>
            <Text style={[styles.confirmModalSub, isDark && { color: '#94A3B8' }]}>
              {acceptedRide?.booking_type === 'SCHEDULED'
                ? t('scheduled_success_msg', 'You can find this ride in your upcoming list.')
                : t('navigating_to_pickup', 'Navigating to pickup location...')}
            </Text>

            <Pressable
              style={[styles.confirmModalBtn, { backgroundColor: theme.colors.primary }]}
              onPress={async () => {
                if (!isOnline) {
                  showAlert(t('error'), t('go_online_start'), { icon: 'alert-circle-outline', isDestructive: true });
                  return;
                }

                try {
                  const isScheduled = acceptedRide?.booking_type === 'SCHEDULED';

                  if (acceptedRide && !isScheduled) {
                    // 1. Transition status to ARRIVING for live rides
                    await arrivingTrip(acceptedRide.trip_id).unwrap();

                    // 2. Hide modal and navigate
                    setShowConfirmModal(false);
                    navigation.navigate('PickupMapScreen', { ride: acceptedRide });
                  } else {
                    // For scheduled rides, just hide the modal (we already accepted it)
                    setShowConfirmModal(false);
                  }
                } catch (error) {
                  console.error('Failed to transition to arriving status (Live):', error);
                  // In case of error (e.g. network), we still allow navigation but hide modal
                  setShowConfirmModal(false);
                  if (acceptedRide && acceptedRide.booking_type !== 'SCHEDULED') {
                    navigation.navigate('PickupMapScreen', { ride: acceptedRide });
                  }
                }
              }}
            >
              <Text style={styles.confirmModalBtnText}>
                {acceptedRide?.booking_type === 'SCHEDULED' ? t('done', 'Done') : t('start_to_pickup', 'Start to pickup')}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

      <ConfirmationModal
        isVisible={alertModalVisible}
        onClose={() => {
          setAlertModalVisible(false);
          if (alertModalConfig.onCancel) alertModalConfig.onCancel();
        }}
        onConfirm={alertModalConfig.onConfirm}
        title={alertModalConfig.title}
        message={alertModalConfig.message}
        icon={alertModalConfig.icon}
        isDestructive={alertModalConfig.isDestructive}
        singleButton={alertModalConfig.singleButton}
        confirmText={alertModalConfig.confirmText}
        cancelText={alertModalConfig.cancelText}
      />

      <RatingReceivedModal
        visible={ratingModalVisible}
        rating={lastTripRating?.rating || 0}
        feedback={lastTripRating?.feedback}
        onClose={() => {
          setRatingModalVisible(false);
          dispatch(setLastTripRating(null));
        }}
      />
    </SafeAreaView>
  );
};

export default DriverDashboard;

// ── STYLES ──
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  scrollContent: {
    paddingBottom: vs(120),
  },
  sectionTitle: {
    marginHorizontal: s(16),
    marginTop: vs(16),
    fontSize: ms(14),
    fontWeight: '700',
    color: '#111827',
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    marginHorizontal: s(16),
    marginTop: vs(16),
    marginBottom: vs(-4),
    padding: ms(12),
    borderRadius: ms(8),
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  errorText: {
    color: '#991B1B',
    fontSize: ms(13),
    fontWeight: '600',
    marginLeft: s(8),
    flex: 1,
  },
  rideOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)', // Semi-transparent overlay
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    elevation: 30, // For Android
  },
  rideScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: vs(50),
    paddingHorizontal: s(8),
  },
  swipeBox: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: s(16),
    paddingTop: vs(12),
    borderTopLeftRadius: ms(24),
    borderTopRightRadius: ms(24),
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: -5 },
    elevation: 20,
    zIndex: 100,
  },
  swipeTitle: {
    textAlign: 'center',
    fontSize: ms(14),
    fontWeight: '700',
    color: '#1E293B',
  },
  swipeSub: {
    textAlign: 'center',
    fontSize: ms(12),
    color: '#64748B',
    marginBottom: vs(12),
  },
  offlineTabContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 50,
    elevation: 5,
    alignItems: 'center',
    marginTop: vs(-1), // Small overlap for seamless join
  },
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: s(20),
  },
  confirmModalBox: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: ms(24),
    padding: s(24),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  confirmIconRing: {
    width: s(100),
    height: s(100),
    borderRadius: ms(50),
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: vs(16),
  },
  confirmModalTitle: {
    fontSize: ms(22),
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: vs(8),
    textAlign: 'center',
  },
  confirmModalSub: {
    fontSize: ms(14),
    color: '#64748B',
    textAlign: 'center',
    marginBottom: vs(24),
  },
  confirmModalBtn: {
    width: '100%',
    backgroundColor: '#2563EB',
    paddingVertical: vs(16),
    borderRadius: ms(16),
    alignItems: 'center',
  },
  confirmModalBtnText: {
    color: '#fff',
    fontSize: ms(16),
    fontWeight: '700',
  },
  inlineSosCard: {
    marginHorizontal: s(16),
    marginTop: vs(16),
    borderRadius: ms(16),
    padding: s(16),
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.1)',
  },
  sosCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sosCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sosCardIconRing: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(22),
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: s(12),
  },
  sosCardTextGroup: {
    flex: 1,
  },
  sosCardTitle: {
    fontSize: ms(16),
    fontWeight: '700',
    marginBottom: vs(2),
  },
  sosCardSubtitle: {
    fontSize: ms(13),
    color: '#64748B',
    fontWeight: '500',
  },
  sosCardActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: vs(16),
  },
  sosCardActionText: {
    flex: 1,
    fontSize: ms(13),
    color: '#475569',
    marginRight: s(12),
    lineHeight: ms(18),
  },
  sosCardButton: {
    paddingVertical: vs(8),
    paddingHorizontal: s(16),
    borderRadius: ms(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosCardButtonText: {
    color: '#fff',
    fontSize: ms(13),
    fontWeight: '700',
  },
});
