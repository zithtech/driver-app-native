import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import moment from 'moment';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Alert,
  Linking,
  TouchableOpacity,
  Animated,
  RefreshControl,
  Modal,
  Image,
} from 'react-native';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useHaptic } from '../../hooks/useHaptic';
import Ionicons from 'react-native-vector-icons/Ionicons';
import NetInfo from '@react-native-community/netinfo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';

import { PickupMapScreen_Nav } from '../../Navigations/navigations';
import { useAppTheme } from '../../context/ThemeContext';
import AppStatusBar from '../../Components/AppStatusBar';
import { useAlert } from '../../context/AlertContext';
import { hS as s, vS as vs, mS as ms } from '../../lib/scale';
import RideSkeleton from './components/RideSkeleton';
import { setMyAcceptedRideId, setCurrentRide, Ride } from '../../redux/rideSlice';
import { useGetIncomingTripsQuery, useAcceptTripMutation, useCancelTripMutation, useLazyGetTripByIdQuery, useSkipTripMutation, useArrivingTripMutation } from '../../service/driverApi';
import { useGetMySubscriptionQuery } from '../../service/userApi';
import { scheduledRideService } from '../../services/scheduledRideService';
import socketService from '../../service/socketService';



type SortOption = 'time' | 'price' | 'distance';
type FilterType = 'all' | 'local' | 'outstation' | 'one_way' | 'round_trip' | 'high_value';

const RideCard = ({ item, acceptedRide, getRemainingTime, theme, isDark, t, navigation, cancelRide, passRide, acceptRide, startHeadingToPickup, acceptingRideId, acceptedSuccessId, handlePressIn, handlePressOut, ms, vs, s, styles }: any) => {
  const accepted = item.trip_status === 'ACCEPTED';
  const isDimmed = !!acceptedRide && !accepted;
  const { text: timeText } = getRemainingTime(item.startTime);

  const acceptScale = useRef(new Animated.Value(1)).current;
  const passScale = useRef(new Animated.Value(1)).current;

  // Pulse animation for urgent rides inside the card
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  // Use card color from theme for background
  const cardBgColor = isDimmed
    ? (isDark ? '#1E1E1E' : '#F9FAFB')
    : theme.colors.card;

  const formatDate = (time: string | number | Date) =>
    new Date(time).toLocaleDateString(undefined, {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });

  const formatTime = (time: string | number | Date) =>
    new Date(time).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  const getInitials = (name: string) => {
    if (!name || name === 'Customer') return 'CU';
    const parts = name.split(' ');
    if (parts.length >= 2 && parts[0][0] && parts[1][0]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const formatEstimatedDuration = (km: number) => {
    const totalMinutes = Math.round(km * 2.5);
    if (totalMinutes < 60) return `${totalMinutes}m`;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}h ${mins}m`;
  };

  const initials = getInitials(item.passenger);

  return (
    <Animated.View
      style={[
        styles.card as any,
        {
          backgroundColor: cardBgColor,
          opacity: isDimmed ? 0.7 : 1,
        },
        accepted && styles.acceptedCard,
      ]}
    >
      <View style={[styles.timeSubHeader, { backgroundColor: isDark ? 'rgba(96, 165, 250, 0.1)' : '#EFF6FF' }]}>
        <Ionicons name="calendar-outline" size={ms(14)} color={isDark ? '#93C5FD' : '#2563EB'} />
        <Text style={[styles.dateSubHeaderText, { color: isDark ? '#93C5FD' : '#2563EB' }]}>
          {formatDate(item.startTime)}
        </Text>
        <View style={styles.statsDot} />
        <Ionicons name="time-outline" size={ms(14)} color={isDark ? '#93C5FD' : '#2563EB'} />
        <Text style={[styles.timeSubHeaderText, { color: isDark ? '#93C5FD' : '#2563EB' }]}>
          {formatTime(item.startTime)}
        </Text>
      </View>

      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardHeaderText, { color: theme.colors.paragraphText }]} numberOfLines={1} adjustsFontSizeToFit>
            {accepted ? t('your_active_ride') : t('scheduled_ride_request')}
          </Text>
          <View style={styles.badgeRow}>
            <View style={[styles.miniTag, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC' }]}>
              <Text style={[styles.miniTagText, { color: isDark ? '#94A3B8' : '#64748B' }]} numberOfLines={1} adjustsFontSizeToFit>
                {t(item.ride_type || 'ONE_WAY')}
              </Text>
            </View>
            <View style={[styles.miniTag, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC' }]}>
              <Text style={[styles.miniTagText, { color: isDark ? '#94A3B8' : '#64748B' }]} numberOfLines={1} adjustsFontSizeToFit>
                {t(item.paymentType || 'cash')}
              </Text>
            </View>
            {!accepted && (
              <View style={[styles.remainingTag, { backgroundColor: '#FFF7ED' }]}>
                <Ionicons name="time-outline" size={ms(10)} color="#F97316" />
                <Text style={[styles.remainingTagText, { color: '#F97316' }]}>{timeText}</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={[styles.priceBig, { color: '#16A34A' }]}>{t('currency_symbol')}{item.total_fare}</Text>
      </View>

      <View style={styles.locationContainer}>
        <View style={styles.locationIndicator}>
          <Ionicons
            name="radio-button-on"
            size={ms(18)}
            color={isDimmed ? theme.colors.border : '#4ade80'}
          />
          <View style={[
            styles.line,
            {
              backgroundColor: theme.colors.border,
              flex: 1,
            },
          ]} />
          <Ionicons
            name="location"
            size={ms(18)}
            color={isDimmed ? theme.colors.border : '#f87171'}
          />
        </View>
        <View style={styles.addresses}>
          <View style={styles.addressBox}>
            <Text style={[styles.addrLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>{t('pickup')}</Text>
            <Text style={[styles.addrText, { color: theme.colors.text }]}>{item.pickup_address}</Text>
          </View>
          <View style={[styles.addressBox, { marginTop: vs(12) }]}>
            <Text style={[styles.addrLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>{t('drop')}</Text>
            <Text style={[styles.addrText, { color: theme.colors.text }]}>{item.drop_address}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.rideStatsPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9' }]}>
        <View style={styles.statItemRow}>
          <Ionicons name="shuffle-outline" size={ms(14)} color={isDark ? '#94A3B8' : '#64748B'} />
          <Text style={[styles.rideStatsText, { color: isDark ? '#CBD5E1' : '#475569' }]}>{item.distance_km} km</Text>
        </View>
        <View style={styles.statsDot} />
        <View style={styles.statItemRow}>
          <Ionicons name="time-outline" size={ms(14)} color={isDark ? '#94A3B8' : '#64748B'} />
          <Text style={[styles.rideStatsText, { color: isDark ? '#CBD5E1' : '#475569' }]}>
            {t('eta')}: {formatEstimatedDuration(item.distance_km)}
          </Text>
        </View>
        <View style={styles.statsDot} />
        <View style={[styles.ecoBadge, { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : '#F0FDF4' }]}>
          <Ionicons name="leaf-outline" size={ms(12)} color="#22C55E" />
          <Text style={[styles.ecoBadgeText, { color: '#22C55E' }]}>{t('eco_friendly')}</Text>
        </View>
      </View>

      <View style={styles.vehicleInfoContainer}>
        <Text style={[styles.vehicleNameText, { color: theme.colors.text }]}>
          {item.car_name}
        </Text>
        <View style={styles.vehicleBadgeRow}>
          <View style={[styles.vehicleBadge, { backgroundColor: isDark ? 'rgba(96, 165, 250, 0.1)' : '#EFF6FF' }]}>
            <Ionicons name="cog-outline" size={ms(12)} color={isDark ? '#93C5FD' : '#2563EB'} />
            <Text style={[styles.vehicleBadgeText, { color: isDark ? '#93C5FD' : '#2563EB' }]}>
              {item.transmission}
            </Text>
          </View>
          <View style={[styles.vehicleBadge, { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : '#F0FDF4' }]}>
            <Ionicons name="flash-outline" size={ms(12)} color={isDark ? '#4ADE80' : '#16A34A'} />
            <Text style={[styles.vehicleBadgeText, { color: isDark ? '#4ADE80' : '#16A34A' }]}>
              {item.fuel_type}
            </Text>
          </View>
        </View>
      </View>

      {accepted && (
        <View style={[styles.passengerBox, { backgroundColor: isDark ? '#1A1A1A' : '#F8FAFC' }]}>
          <View style={styles.passengerMain}>
            <View style={[styles.avatar, { backgroundColor: '#E0F2C1' }]}>
              <Text style={[styles.avatarText, { color: theme.colors.primary }]}>{initials}</Text>
            </View>
            <View>
              <Text style={[styles.psgrName, { color: '#111827' }]}>{item.passenger}</Text>
              <View style={styles.psgrDetailRow}>
                <Text style={[styles.psgrDetail, { color: '#16A34A' }]}>✓ {t('verified_passenger')}</Text>
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={ms(12)} color="#F59E0B" />
                  <Text style={styles.ratingText}>{item.rating?.toFixed(1) || '5.0'}</Text>
                </View>
              </View>
            </View>
          </View>
          <TouchableOpacity style={styles.floatCallBtn} onPress={() => Linking.openURL(`tel:${item.phone}`)}>
            <Ionicons name="call" size={ms(20)} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.footerActions}>
        {accepted ? (
          <View style={styles.buttonGroupVertical}>
            <TouchableOpacity
              style={[styles.primaryBtnLarge, { backgroundColor: theme.colors.primary }]}
              onPress={() => startHeadingToPickup(item)}
            >
              <Ionicons name="navigate" size={ms(18)} color="#FFF" style={{ marginRight: s(8) }} />
              <Text style={styles.primaryBtnText} numberOfLines={1} adjustsFontSizeToFit>{t('navigate_pickup')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.textBtn} onPress={() => cancelRide(item)}>
              <Text style={styles.textBtnRed} numberOfLines={1} adjustsFontSizeToFit>{t('cancel_ride')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          !acceptedRide && (
            <View style={styles.buttonGroupHorizontal}>
              <Animated.View
                style={{
                  width: '48%',
                  transform: [{ scale: passScale }],
                }}
              >
                <Pressable
                  disabled={isDimmed || !!acceptingRideId || !!acceptedSuccessId}
                  onPressIn={() => handlePressIn(passScale)}
                  onPressOut={() => handlePressOut(passScale)}
                  style={[
                    styles.outlineBtnRounded,
                    {
                      borderColor: '#E5E7EB',
                      opacity: (isDimmed || !!acceptingRideId || !!acceptedSuccessId) ? 0.5 : 1,
                    },
                  ]}
                  onPress={() => passRide(item.trip_id)}
                >
                  <Text style={[styles.outlineBtnText, { color: '#64748B' }]} numberOfLines={1} adjustsFontSizeToFit>{t('pass')}</Text>
                </Pressable>
              </Animated.View>

              <Animated.View
                style={{
                  flex: 1,
                  transform: [{ scale: acceptScale }],
                }}
              >
                <Pressable
                  disabled={isDimmed || !!acceptingRideId || !!acceptedSuccessId}
                  onPressIn={() => handlePressIn(acceptScale)}
                  onPressOut={() => handlePressOut(acceptScale)}
                  style={[
                    styles.primaryBtnRounded,
                    {
                      backgroundColor: acceptedSuccessId === item.trip_id ? '#166534' : theme.colors.primary,
                      opacity: (isDimmed || (!!acceptingRideId && acceptingRideId !== item.trip_id) || (!!acceptedSuccessId && acceptedSuccessId !== item.trip_id)) ? 0.5 : 1,
                    },
                  ]}
                  onPress={() => acceptRide(item)}
                >
                  {acceptedSuccessId === item.trip_id ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="checkmark-circle" size={ms(20)} color="#FFF" style={{ marginRight: s(8) }} />
                      <Text style={[styles.primaryBtnText, { color: '#FFF' }]} numberOfLines={1} adjustsFontSizeToFit>{t('confirmed')}</Text>
                    </View>
                  ) : acceptingRideId === item.trip_id ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[styles.primaryBtnText, { color: '#FFF', marginRight: s(8) }]} numberOfLines={1} adjustsFontSizeToFit>{t('accepting')}</Text>
                      <Animated.View style={{ transform: [{ rotate: pulseAnim.interpolate({ inputRange: [1, 1.1], outputRange: ['0deg', '360deg'] }) }] }}>
                        <Ionicons name="sync" size={ms(16)} color="#FFF" />
                      </Animated.View>
                    </View>
                  ) : (
                    <Text style={[styles.primaryBtnText, { color: '#FFF' }]} numberOfLines={1} adjustsFontSizeToFit>{t('accept_ride')}</Text>
                  )}
                </Pressable>
              </Animated.View>
            </View>
          )
        )}
      </View>
    </Animated.View>
  );
};

const ScheduledRidesScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { theme, isDark } = useAppTheme();
  const { showAlert } = useAlert();
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
  const [activeTab, setActiveTab] = useState<'today' | 'upcoming'>('today');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [sortBy, setSortBy] = useState<SortOption>('time');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [showSortModal, setShowSortModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [rideToCancel, setRideToCancel] = useState<Ride | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [containerWidth, setContainerWidth] = useState(0);
  const dispatch = useDispatch();
  const myAcceptedRideId = useSelector((state: any) => state.ride.myAcceptedRideId);
  const [acceptingRideId, setAcceptingRideId] = useState<string | null>(null);
  const [acceptedSuccessId, setAcceptedSuccessId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  useEffect(() => {
    socketService.onTripUpdate(() => {
      refetchTrips();
    });

    // Listen for specific scheduled ride events
    socketService.on('NEW_SCHEDULED_RIDE', () => {
      refetchTrips();
    });
    socketService.on('SCHEDULED_RIDE_TAKEN', () => {
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

    return () => {
      socketService.offTripUpdate();
      socketService.off('NEW_SCHEDULED_RIDE');
      socketService.off('SCHEDULED_RIDE_TAKEN');
      socketService.off('SCHEDULED_RIDE_CANCELLED');
    };
  }, [refetchTrips, user.driverId, user.id, dispatch, showAlert, t]);

  // Animation values
  const countPulseAnim = useRef(new Animated.Value(1)).current;
  const tabAnim = useRef(new Animated.Value(0)).current;

  /* ================= HELPERS ================= */

  const switchTab = useCallback((tab: 'today' | 'upcoming') => {
    if (tab === activeTab) { return; }

    setActiveTab(tab);
    triggerHaptic(HapticFeedbackTypes.impactLight);

    Animated.spring(tabAnim, {
      toValue: tab === 'today' ? 0 : 1,
      useNativeDriver: true,
      friction: 8,
      tension: 50,
    }).start();
  }, [activeTab, triggerHaptic, tabAnim]);

  useEffect(() => {
    if (route.params?.initialTab === 'upcoming') {
      switchTab('upcoming');
    }
  }, [route.params?.initialTab, switchTab]);

  useEffect(() => {
    if (isTripsLoading && !rawTrips) {
      setLoading(true);
    } else {
      setLoading(false);
    }
  }, [isTripsLoading, rawTrips]);

  useEffect(() => {
    const tripsArray = Array.isArray(rawTrips) ? rawTrips : (rawTrips as any)?.data;
    if (tripsArray && Array.isArray(tripsArray)) {
      const mappedRides: Ride[] = tripsArray.map((trip: any) => {
        const timeVal = trip.scheduled_start_time || trip.startTime || new Date().toISOString();
        return {
          ...trip,
          // Ensure core fields are present if backend names differ slightly
          trip_id: trip.trip_id || trip.id,
          pickup_address: trip.pickup_address || trip.pickup,
          drop_address: trip.drop_address || trip.drop,
          total_fare: typeof trip.total_fare === 'number' ? trip.total_fare : parseFloat(trip.total_fare || trip.price || '0'),
          distance_km: trip.distance_km ? parseFloat(trip.distance_km) : parseFloat(trip.distance || '0'),
          trip_status: trip.trip_status || trip.status,
          scheduled_start_time: timeVal,
          startTime: new Date(timeVal).getTime(), // Added for RideCard display & timer logic
          passenger: trip.passenger || trip.passenger_details?.name || trip.passenger_name || trip.customer?.name || 'Customer',
          phone: trip.phone || trip.passenger_details?.phone || trip.customer?.phone || trip.passenger_phone || '',
          rating: typeof trip.rating === 'number' ? trip.rating : (typeof trip.passenger_details?.rating === 'number' ? trip.passenger_details.rating : (typeof trip.customer?.rating === 'number' ? trip.customer.rating : 5.0)),
          paymentType: trip.paymentType || trip.payment_method || trip.paymentType || 'CASH',
          scheduled_status: trip.scheduled_status,
          re_dispatch_count: trip.re_dispatch_count,
          car_name: trip.car_name || trip.vehicle_model || trip.vehicle_type || 'Standard Sedan',
          transmission: trip.transmission || trip.transmission_type || 'Manual',
          fuel_type: trip.fuel_type || trip.engine_type || 'Petrol',
        };
      });
      setRides(mappedRides);
    }
  }, [rawTrips]);

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
    () => rides.find((r) => r.trip_id === myAcceptedRideId && r.trip_status === 'ACCEPTED'),
    [rides, myAcceptedRideId]
  );

  /* ================= FILTERING & SORTING ================= */

  const baseEligibleRides = useMemo(() => {
    const subscription = subData?.data?.subscription || user?.subscription || user?.subscription_details;
    const billingCycle = subscription?.billing_cycle; 
    const planName = (subscription?.plan?.name || subscription?.plan?.plan_name || subscription?.plan_name || '').toLowerCase();
    
    return rides.filter((ride) => {
      // 1. ALWAYS show your own accepted ride at the top, bypassing other filters
      if (ride.trip_id === myAcceptedRideId) { return true; }

      // Strictly include ONLY scheduled rides in this screen
      if (ride.booking_type !== 'SCHEDULED') { return false; }

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
        // Basic: only local, one_way
        if (type !== 'local' && type !== 'one_way') return false;
      } else if (isElite) {
        // Elite: local, one_way, outstation (NO round_trip)
        if (type === 'round_trip') return false;
      }
      
      // Premium allows all
      return true;
    });
  }, [rides, myAcceptedRideId, subData, user]);

  const filteredRides = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let result = baseEligibleRides.filter((ride) => {

      const rideDate = new Date(ride.scheduled_start_time);
      const isToday = rideDate >= today && rideDate < tomorrow;
      const matchesTab = activeTab === 'today' ? isToday : !isToday;

      if (!matchesTab) { return false; }

      // Filter by Type (Categories)
      if (filterType !== 'all') {
        const type = (ride.ride_type || ride.service_type || '').toLowerCase();
        
        if (filterType === 'local') { if (type !== 'local') return false; }
        else if (filterType === 'outstation') { if (type !== 'outstation') return false; }
        else if (filterType === 'one_way') { if (type !== 'one_way') return false; }
        else if (filterType === 'round_trip') { if (type !== 'round_trip') return false; }
        else if (filterType === 'high_value') {
          if (ride.total_fare < 300) return false;
        }
      }

      // Filter by Status: Only show available requests OR my own active ride
      // ALWAYS exclude COMPLETED, CANCELLED, or REJECTED
      const status = ride.trip_status;
      if (['COMPLETED', 'CANCELLED', 'CANCEL', 'REJECTED'].includes(status)) {
        return false;
      }

      const isMine = ride.trip_id === myAcceptedRideId;
      if (!isMine) {
        // If not mine, exclude others' active/accepted rides
        if (['ARRIVED', 'STARTED', 'ON_TRIP', 'ACCEPTED'].includes(status)) {
          return false;
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
  }, [baseEligibleRides, activeTab, sortBy, filterType]);

  const counts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Only count rides that are strictly SCHEDULED and NOT completed/cancelled/rejected
    const visibleRides = baseEligibleRides.filter(r => {
      const status = r.trip_status;
      if (['COMPLETED', 'CANCELLED', 'CANCEL', 'REJECTED'].includes(status)) {
        return false;
      }

      const isMine = r.trip_id === myAcceptedRideId;
      if (!isMine) {
        // Exclude others' active/accepted rides
        if (['ARRIVED', 'STARTED', 'ON_TRIP', 'ACCEPTED'].includes(status)) {
          return false;
        }
      }
      return true;
    });

    const todayRides = visibleRides.filter(r => {
      const d = new Date(r.scheduled_start_time);
      return d >= today && d < tomorrow;
    });

    return {
      today: todayRides.length,
      upcoming: visibleRides.length - todayRides.length,
    };
  }, [baseEligibleRides, myAcceptedRideId]);

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

        const isMine = r.trip_id === myAcceptedRideId;
        if (!isMine) {
          // Exclude others' active/accepted rides
          if (['ARRIVED', 'STARTED', 'ON_TRIP', 'ACCEPTED'].includes(status)) {
            return false;
          }
        }

        const d = new Date(r.scheduled_start_time);
        const isToday = d >= today && d < tomorrow;
        return activeTab === 'today' ? isToday : !isToday;
    });

    const getCount = (type: FilterType) => {
        if (type === 'all') return sameTabRides.length;
        if (type === 'high_value') return sameTabRides.filter(r => r.total_fare >= 300).length;
        return sameTabRides.filter(r => (r.ride_type || r.service_type || '').toLowerCase() === type).length;
    };

    return {
        all: getCount('all'),
        local: getCount('local'),
        outstation: getCount('outstation'),
        one_way: getCount('one_way'),
        round_trip: getCount('round_trip'),
        high_value: getCount('high_value'),
    };
  }, [baseEligibleRides, activeTab, myAcceptedRideId]);

  // Pulse count badge when numbers change
  useEffect(() => {
    Animated.sequence([
      Animated.timing(countPulseAnim, { toValue: 1.4, duration: 200, useNativeDriver: true }),
      Animated.spring(countPulseAnim, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();
  }, [counts.today, counts.upcoming, countPulseAnim]);



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
      await acceptTripMutation({ tripId: ride.trip_id, driverId: user.driverId || user.id }).unwrap();

      // Show Success State
      setAcceptedSuccessId(ride.trip_id);
      dispatch(setMyAcceptedRideId(ride.trip_id));
      dispatch(setCurrentRide(ride));
      triggerHaptic(HapticFeedbackTypes.notificationSuccess);

      // Schedule reminders for the accepted ride
      await scheduledRideService.scheduleRideReminders(ride.trip_id, ride.scheduled_start_time);

      // Delay to let the driver see the success state
      setTimeout(() => {
        setAcceptedSuccessId(null);
        refetchTrips();
      }, 1500);

    } catch (error: any) {
      // Production Log: Only log the message for debugging, avoiding full JSON object in toasts
      console.log('Accept ride attempt failed:', error?.data?.message || error?.message);

      const isAlreadyCancelled = error?.data?.message?.toLowerCase().includes('cancelled') || error?.status === 410;
      const isAlreadyAccepted = error.status === 400 && (error.data?.message?.toLowerCase().includes('already') || error.data?.message?.toLowerCase().includes('taken'));

      if (isAlreadyCancelled) {
        showAlert({
          title: t('ride_cancelled') || 'Ride Already Cancelled',
          message: t('rider_cancelled_msg') || 'The ride has already been cancelled by the rider.',
          singleButton: true,
          icon: 'close-circle-outline',
          isDestructive: true,
        });
        refetchTrips();
      } else if (isAlreadyAccepted) {
        showAlert({
          title: t('already_accepted'),
          message: t('already_accepted_error'),
          singleButton: true,
          icon: 'information-circle-outline',
        });
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
      showAlert({
        title: t('go_online_required'),
        message: t('must_go_online_to_start_ride'),
        singleButton: true,
        icon: 'eye-off-outline',
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

    // 3. Confirmation Modal
    showAlert({
      title: t('start_ride_confirmation'),
      message: t('confirm_start_heading_pickup'),
      confirmText: t('confirm'),
      cancelText: t('cancel'),
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
          showAlert({
            title: t('error'),
            message: t('failed_to_start_navigation'),
            singleButton: true,
            icon: 'alert-circle-outline'
          });
        }
      },
      icon: 'navigate-circle-outline',
    });
  };

  const confirmCancelRide = async () => {
    if (!rideToCancel || !selectedReason) { return; }

    try {
      await cancelTripMutation({
        tripId: rideToCancel.trip_id,
        cancel_reason: selectedReason,
        cancel_by: 'DRIVER'
      }).unwrap();

      // Cancel local reminders
      await scheduledRideService.cancelRideReminders(rideToCancel.trip_id);

      setShowCancelModal(false);
      setRideToCancel(null);
      dispatch(setMyAcceptedRideId(null));
      refetchTrips();
      showAlert({
        title: t('ride_cancelled'),
        message: t('no_cancellation_fee'),
        singleButton: true,
        icon: 'checkmark-circle-outline',
      });
    } catch (error: any) {
      console.error('Failed to cancel ride', error);
      const isAlreadyCancelled = error?.data?.message?.toLowerCase().includes('already cancelled');

      showAlert({
        title: isAlreadyCancelled ? (t('ride_cancelled') || 'Ride Cancelled') : t('error'),
        message: isAlreadyCancelled 
          ? (t('rider_cancelled_msg') || 'The ride has already been cancelled.')
          : (error.data?.message || 'Failed to cancel ride. Please try again.'),
        singleButton: true,
        icon: isAlreadyCancelled ? 'checkmark-circle-outline' : 'alert-circle-outline',
      });

      if (isAlreadyCancelled) {
        setShowCancelModal(false);
        setRideToCancel(null);
        dispatch(setMyAcceptedRideId(null));
        refetchTrips();
      }
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
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {t('cancel_trip_title')}
            </Text>
            <TouchableOpacity onPress={() => setShowCancelModal(false)}>
              <Ionicons name="close" size={ms(24)} color={theme.colors.text} />
            </TouchableOpacity>
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
              <TouchableOpacity
                key={reasonKey}
                onPress={() => setSelectedReason(reasonKey)}
                style={[
                  styles.reasonItem,
                  selectedReason === reasonKey && {
                    backgroundColor: theme.colors.primary + '10',
                    borderColor: theme.colors.primary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.reasonText,
                    { color: theme.colors.text },
                    selectedReason === reasonKey && {
                      color: theme.colors.primary,
                      fontWeight: '700',
                    },
                  ]}
                >
                  {t(reasonKey)}
                </Text>
                <View
                  style={[
                    styles.radioCircle,
                    { borderColor: theme.colors.border },
                    selectedReason === reasonKey && { borderColor: theme.colors.primary },
                  ]}
                >
                  {selectedReason === reasonKey && <View style={[styles.radioDot, { backgroundColor: theme.colors.primary }]} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            disabled={!selectedReason}
            style={[
              styles.confirmCancelBtn,
              { backgroundColor: selectedReason ? '#EF4444' : '#E5E7EB' },
            ]}
            onPress={confirmCancelRide}
          >
            <Text style={[styles.confirmCancelBtnText, { color: selectedReason ? '#FFF' : '#9CA3AF' }]}>
              {t('confirm_cancellation')}
            </Text>
          </TouchableOpacity>
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
      {/* OFFLINE BANNERS */}
      {!isConnected ? (
        <View style={[styles.offlineBanner, { backgroundColor: '#EF4444' }]}>
          <Ionicons name="wifi-outline" size={ms(14)} color="#FFF" />
          <Text style={styles.offlineText}>{t('no_internet')}</Text>
        </View>
      ) : !isOnline ? (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate('Dashboard')}
          style={[styles.offlineBanner, { backgroundColor: '#F59E0B' }]}
        >
          <Ionicons name="eye-off-outline" size={ms(14)} color="#FFF" />
          <Text style={styles.offlineText}>{t('go_online_start')}</Text>
        </TouchableOpacity>
      ) : null}

      {/* PREMIUM HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={ms(24)} color={theme.colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.headerTitleContainer}
        >
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{t('ride_requests')}</Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.paragraphText }]}>{t('scheduled_rides_near_you')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setShowSortModal(true)}>
          <Ionicons name="filter" size={ms(20)} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* GLASSMORPHISM TABS */}
      <View style={[styles.tabOuterContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
        <View
          style={styles.tabContainer}
          onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        >
          {containerWidth > 0 && (
            <Animated.View
              style={[
                styles.slidingPill,
                {
                  backgroundColor: theme.colors.card,
                  width: containerWidth / 2,
                  transform: [
                    {
                      translateX: tabAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, containerWidth / 2],
                      }),
                    },
                  ],
                },
              ]}
            />
          )}
          <TouchableOpacity
            style={styles.tab}
            onPress={() => switchTab('today')}
          >
            <View style={styles.tabContent}>
              <Text style={[
                styles.tabText,
                { color: activeTab === 'today' ? theme.colors.primary : '#64748B' },
                activeTab === 'today' && styles.activeTabText,
              ]} numberOfLines={1} adjustsFontSizeToFit>
                {t('today')}
              </Text>
              <Animated.View
                style={[
                  styles.countBadge,
                  {
                    backgroundColor: activeTab === 'today' ? theme.colors.primary : '#64748B',
                    transform: [{ scale: countPulseAnim }]
                  }
                ]}
              >
                <Text style={styles.countBadgeText}>{counts.today}</Text>
              </Animated.View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tab}
            onPress={() => switchTab('upcoming')}
          >
            <View style={styles.tabContent}>
              <Text style={[
                styles.tabText,
                { color: activeTab === 'upcoming' ? theme.colors.primary : '#64748B' },
                activeTab === 'upcoming' && styles.activeTabText,
              ]} numberOfLines={1} adjustsFontSizeToFit>
                {t('upcoming')}
              </Text>
              <Animated.View
                style={[
                  styles.countBadge,
                  {
                    backgroundColor: activeTab === 'upcoming' ? theme.colors.primary : '#64748B',
                    transform: [{ scale: countPulseAnim }]
                  }
                ]}
              >
                <Text style={styles.countBadgeText}>{counts.upcoming}</Text>
              </Animated.View>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* FILTER CHIPS */}
      <View style={styles.filterBar}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={['all', 'local', 'outstation', 'one_way', 'round_trip', 'high_value'] as FilterType[]}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => {
            const count = filterCounts[item];
            const getIcon = () => {
                switch(item) {
                    case 'all': return 'list-outline';
                    case 'local': return 'car-outline';
                    case 'outstation': return 'map-outline';
                    case 'one_way': return 'arrow-forward-outline';
                    case 'round_trip': return 'repeat-outline';
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
                    backgroundColor: filterType === item ? theme.colors.primary : (isDark ? '#333' : '#FFF'),
                    borderColor: filterType === item ? theme.colors.primary : (isDark ? '#444' : '#E2E8F0'),
                    },
                ]}
                >
                    <Ionicons 
                        name={getIcon()} 
                        size={ms(16)} 
                        color={filterType === item ? '#FFF' : (isDark ? '#94A3B8' : '#64748B')} 
                        style={{ marginRight: ms(6) }} 
                    />
                    <Text style={[
                        styles.filterChipText,
                        { color: filterType === item ? '#FFF' : (isDark ? '#CBD5E1' : '#64748B') },
                    ]} numberOfLines={1} adjustsFontSizeToFit>
                        {t(item)}
                    </Text>
                    {count > 0 && (
                        <View style={[
                            styles.filterCountBadge,
                            { backgroundColor: filterType === item ? 'rgba(255,255,255,0.2)' : (isDark ? '#444' : '#E2E8F0') }
                        ]}>
                            <Text style={[
                                styles.filterCountText,
                                { color: filterType === item ? '#FFF' : (isDark ? '#94A3B8' : '#64748B') }
                            ]}>
                                {count}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>
            );
          }}
        />
      </View>

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
          renderItem={({ item }) => (
            <RideCard
              item={item}
              acceptedRide={acceptedRide}
              getRemainingTime={getRemainingTime}
              theme={theme}
              isDark={isDark}
              t={t}
              navigation={navigation}
              cancelRide={cancelRide}
              passRide={passRide}
              acceptRide={acceptRide}
              startHeadingToPickup={startHeadingToPickup}
              acceptingRideId={acceptingRideId}
              acceptedSuccessId={acceptedSuccessId}
              handlePressIn={handlePressIn}
              handlePressOut={handlePressOut}
              ms={ms}
              vs={vs}
              s={s}
              styles={styles}
            />
          )}
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
              <View style={styles.emptyIconCircle}>
                <Ionicons name="search-outline" size={ms(40)} color={isDark ? '#4B5563' : '#CBD5E1'} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                {filterType === 'all' ? t('no_rides_found') : t('no_matching_rides')}
              </Text>
              <Text style={[styles.emptySubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                {filterType === 'all' ? t('check_back_later') : t('try_clearing_filters')}
              </Text>
              {filterType !== 'all' && (
                <TouchableOpacity
                  style={[styles.clearFilterBtn, { borderColor: theme.colors.primary }]}
                  onPress={() => {
                    setFilterType('all');
                    triggerHaptic(HapticFeedbackTypes.impactLight);
                  }}
                >
                  <Text style={[styles.clearFilterText, { color: theme.colors.primary }]}>{t('clear_all_filters')}</Text>
                </TouchableOpacity>
              )}
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
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: vs(8),
    gap: ms(8),
  },
  offlineText: {
    color: '#FFF',
    fontSize: ms(12),
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(16),
    height: vs(56),
  },
  headerTitle: {
    fontSize: ms(18),
    fontWeight: '700',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: ms(12),
    fontWeight: '500',
    marginTop: vs(2),
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
    borderRadius: ms(24),
    padding: ms(20),
    marginBottom: vs(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    backgroundColor: '#FFF',
  },
  acceptedCard: {
    borderWidth: 2,
    borderColor: 'transparent',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
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
    marginTop: vs(16),
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
    marginBottom: vs(12),
    marginTop: vs(4),
  },
  timeSubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ms(12),
    paddingVertical: vs(8),
    borderRadius: ms(12),
    marginBottom: vs(12),
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
    fontSize: ms(32),
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
    marginBottom: vs(24),
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
    fontSize: ms(18),
    fontWeight: '500',
  },
  vehicleInfoContainer: {
    alignItems: 'center',
    paddingVertical: vs(20),
    marginHorizontal: ms(12),
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    marginBottom: vs(16),
  },
  vehicleNameText: {
    fontSize: ms(20),
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: vs(8),
  },
  vehicleBadgeRow: {
    flexDirection: 'row',
    gap: ms(8),
  },
  vehicleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ms(10),
    paddingVertical: vs(4),
    borderRadius: ms(8),
    gap: ms(4),
  },
  vehicleBadgeText: {
    fontSize: ms(12),
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
    paddingHorizontal: ms(8),
    paddingVertical: vs(4),
    borderRadius: ms(8),
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
    padding: ms(14),
    borderRadius: ms(16),
    marginBottom: vs(20),
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
    backgroundColor: '#FFFBEB',
    paddingHorizontal: ms(6),
    paddingVertical: vs(1),
    borderRadius: ms(6),
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
    gap: ms(10),
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ms(16),
    paddingVertical: vs(8),
    borderRadius: ms(30),
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: ms(13),
    fontWeight: '600',
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
    elevation: 2,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  confirmCancelBtnText: {
    fontSize: ms(16),
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: s(40),
    marginTop: vs(60),
    minHeight: vs(300),
  },
  emptyIconCircle: {
    width: s(80),
    height: s(80),
    borderRadius: ms(40),
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(16),
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  emptyTitle: {
    fontSize: ms(18),
    fontWeight: '700',
    marginBottom: vs(8),
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: ms(14),
    textAlign: 'center',
    marginBottom: vs(24),
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
});
