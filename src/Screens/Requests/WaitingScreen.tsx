import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  BackHandler,
  Switch,
  Modal,
  Linking,
  Pressable,
  Image,
  ScrollView,
  Platform,
  StatusBar,
  Share,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Clipboard from '@react-native-clipboard/clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveImageUrl } from '../../utils/imageUtils';
import { useTranslation } from 'react-i18next';
import { useNavigation, useFocusEffect, StackActions } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../redux/store';
import { useAppTheme } from '../../context/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import { useHaptic } from '../../hooks/useHaptic';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useStartReturnTripMutation, useToggleDayHaltMutation, useTriggerSosMutation } from '../../service/driverApi';
import { useLocationTracker } from '../../hooks/useLocationTracker';
import SwipeButton from '../Dashboard/dashComponents/SwipeButton';
import { mS as ms, vS as vs } from '../../lib/scale';
import { ChatScreen_Nav, HelpCenter_Nav } from '../../Navigations/navigations';
import { setCurrentRide } from '../../redux/rideSlice';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackgroundProps } from '@gorhom/bottom-sheet';

const WaitingScreen = ({ route }: any) => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { theme, isDark } = useAppTheme();
  const { showAlert } = useAlert();
  const { triggerHaptic } = useHaptic();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();

  const rideFromStore = useSelector((state: RootState) => state.ride.currentRide);
  const ride = rideFromStore || route?.params?.ride || {};
  const unreadCount = useSelector((state: RootState) => state.chat?.unreadCounts[(ride.trip_id || ride.id)?.toString()] || 0);

  const trip_id = ride?.trip_id || ride?.id;
  const user = useSelector((state: RootState) => state.userSlice?.user);

  const [startReturnTripApi, { isLoading }] = useStartReturnTripMutation();
  const [toggleDayHaltApi, { isLoading: isToggling }] = useToggleDayHaltMutation();
  const [triggerSosApi] = useTriggerSosMutation();

  const [waitingSeconds, setWaitingSeconds] = useState(0);
  const [isDayHaltModalVisible, setIsDayHaltModalVisible] = useState(false);
  const [isReturnTripModalVisible, setIsReturnTripModalVisible] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mapRef = useRef<MapView>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);

  const isOutstationRoundTrip = ride?.ride_type === 'OUTSTATION_ROUND_TRIP';
  const isDayHalt = ride?.trip_status === 'DAY_HALT';

  // Parse drop coordinates for the map
  const drop_lat = parseFloat(ride?.drop_lat?.toString() || ride?.dropoff_lat?.toString() || '0');
  const drop_lng = parseFloat(ride?.drop_lng?.toString() || ride?.dropoff_lng?.toString() || '0');
  const hasDropCoords = !!(drop_lat && drop_lng);

  const snapPoints = useMemo(() => ['50%', '88%'], []);

  useLocationTracker({
    driverId: user?.driverId,
    isTracking: !isDayHalt,
    tripId: trip_id,
    mode: 'idle',
  });

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

  useEffect(() => {
    const initTimer = async () => {
      try {
        if (!trip_id) return;

        // 1. Prefer actual server-side start time if provided by backend
        let serverStartTime = (ride as any)?.wait_started_at || (ride as any)?.waiting_started_at || (ride as any)?.waiting_start_time || (ride as any)?.actual_drop_time;
        let finalStartTimeMs: number;

        if (serverStartTime) {
          finalStartTimeMs = new Date(serverStartTime).getTime();
        } else {
          // 2. Fallback to local persistent storage so it survives app closures
          const storageKey = `@waiting_start_${trip_id}`;
          const localStartTimeStr = await AsyncStorage.getItem(storageKey);
          
          if (localStartTimeStr) {
            finalStartTimeMs = parseInt(localStartTimeStr, 10);
          } else {
            // First time landing on this screen for this trip
            finalStartTimeMs = Date.now();
            await AsyncStorage.setItem(storageKey, finalStartTimeMs.toString());
          }
        }

        const updateTimer = () => {
          const now = Date.now();
          const elapsed = Math.floor((now - finalStartTimeMs) / 1000);
          setWaitingSeconds(Math.max(0, elapsed));
        };

        updateTimer();
        timerRef.current = setInterval(updateTimer, 1000);

      } catch (err) {
        console.error("Failed to initialize waiting timer", err);
      }
    };

    initTimer();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [trip_id, (ride as any)?.wait_started_at, (ride as any)?.waiting_started_at, (ride as any)?.waiting_start_time, (ride as any)?.actual_drop_time]);

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartReturnTrip = async () => {
    try {
      if (!trip_id) return;
      const result = await startReturnTripApi(trip_id.toString()).unwrap();
      const updatedRide = result?.data || { ...ride, trip_status: 'RETURN_STARTED' };
      dispatch(setCurrentRide(updatedRide));
      triggerHaptic?.(HapticFeedbackTypes.notificationSuccess);
      navigation.dispatch(StackActions.replace('ReturnTripMapScreen', { ride: updatedRide }));
    } catch (error: any) {
      triggerHaptic?.(HapticFeedbackTypes.notificationError);
      showAlert({
        title: t('error'),
        message: error?.data?.message || t('failed_to_start_return_trip', 'Failed to start the return trip. Please try again.'),
        singleButton: true,
        icon: 'alert-circle-outline',
      });
    }
  };

  const handleSwipeSuccess = () => {
    setIsReturnTripModalVisible(true);
  };

  const confirmReturnTrip = () => {
    setIsReturnTripModalVisible(false);
    handleStartReturnTrip();
  };

  const handleToggleChange = (value: boolean) => {
    if (value) {
      setIsDayHaltModalVisible(true);
    } else {
      toggleDayHalt(false);
    }
  };

  const toggleDayHalt = async (is_day_halt: boolean) => {
    try {
      if (!trip_id) return;
      const result = await toggleDayHaltApi({ tripId: trip_id.toString(), is_day_halt }).unwrap();
      if (result?.data) {
        dispatch(setCurrentRide(result.data));
      }
      setIsDayHaltModalVisible(false);
      triggerHaptic?.(HapticFeedbackTypes.notificationSuccess);
    } catch (error: any) {
      triggerHaptic?.(HapticFeedbackTypes.notificationError);
      showAlert({
        title: t('error'),
        message: error?.data?.message || t('failed_to_update', 'Failed to update. Please try again.'),
        singleButton: true,
        icon: 'alert-circle-outline',
      });
    }
  };

  const handleSosPress = useCallback(() => {
    showAlert({
      title: t('sos'),
      message: t('sos_message') || 'Are you in an emergency? This will notify our security team immediately.',
      confirmText: t('confirm') || 'Confirm',
      cancelText: t('cancel') || 'Cancel',
      onConfirm: async () => {
        try {
          if (!trip_id) return;
          await triggerSosApi({ trip_id: trip_id.toString() }).unwrap();
          showAlert({
            title: t('sos_triggered'),
            message: t('sos_triggered_msg') || 'Emergency signal sent. Help is on the way.',
            singleButton: true,
            icon: 'alert-circle-outline'
          });
        } catch (error) {
          showAlert({
            title: t('error'),
            message: t('sos_error') || 'Failed to trigger SOS. Please call emergency services directly.',
            singleButton: true,
            icon: 'alert-circle-outline'
          });
        }
      }
    });
  }, [trip_id, showAlert, t, triggerSosApi]);

  const handleChatPress = () => {
    navigation.navigate(ChatScreen_Nav, {
      rideId: trip_id,
      userId: user?.driverId,
      userName: ride?.passenger_details?.name || ride?.user_details?.full_name || t('rider'),
      userImage: ride?.passenger_details?.image,
      userPhone: ride?.phone || ride?.passenger_phone || ride?.user_details?.phone_number || ride?.passenger_details?.phone,
    });
  };

  const handleCallPress = () => {
    const phone = ride?.phone || ride?.passenger_phone || ride?.user_details?.phone_number || ride?.passenger_details?.phone;
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    } else {
      showAlert({
        title: t('error') || 'Error',
        message: t('phone_number_not_found') || 'Passenger phone number is not available.',
        singleButton: true,
      });
    }
  };

  const handleShareTrip = async () => {
    try {
      const passengerName = ride?.passenger_details?.name || ride?.user_details?.full_name || 'Passenger';
      const tripCode = ride?.trip_code || ride?.booking_code || ride?.trip_id || ride?.id || '';
      const shareMessage = `🚗 Track my T2Drive Trip!\n\n` +
        (tripCode ? `🆔 Trip Code: ${tripCode}\n` : '') +
        `👤 Passenger: ${passengerName}\n` +
        `📍 Pickup: ${ride?.pickup_address || ride?.pickup || 'Not available'}\n` +
        `🏁 Drop: ${ride?.drop_address || ride?.drop || 'Not available'}\n` +
        `\nTrack the ride status live in the T2Drive app!`;
      await Share.share({ message: shareMessage });
    } catch (error) {
      console.log('Error sharing trip:', error);
    }
  };

  const handleCopyTripCode = useCallback(() => {
    const code = ride?.trip_code || ride?.booking_code;
    if (code) {
      Clipboard.setString(code);
      triggerHaptic?.(HapticFeedbackTypes.notificationSuccess);
    }
  }, [ride, triggerHaptic]);

  const passengerName = ride?.passenger_details?.name || ride?.user_details?.full_name || ride?.user_details?.first_name || ride?.passenger || ride?.passenger_name || ride?.customer?.name || 'Passenger';
  const vehicleLabel = ride?.car_name || ride?.vehicle_model || ride?.ride_type || ride?.service_type || 'Standard';
  const vehicleNumber = ride?.vehicle_number || ride?.car_number || '';
  const passengerStatus = isDayHalt ? t('day_halt_active_short', 'Day halt') : t('waiting_at_destination_short', 'Waiting at destination');

  const isRoundTrip = ride?.ride_type === 'ROUND_TRIP' || ride?.ride_type === 'OUTSTATION_ROUND_TRIP';

  const CustomBackground = useCallback(({ style }: BottomSheetBackgroundProps) => (
    <View style={[style, {
      backgroundColor: isDark ? theme.colors.card : '#F7F8FC',
      borderTopLeftRadius: ms(32),
      borderTopRightRadius: ms(32),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -10 },
      shadowOpacity: 0.08,
      shadowRadius: 15,
      elevation: 24,
    }]} />
  ), [theme.colors.card, isDark]);

  const darkMapStyle = [
    { 'elementType': 'geometry', 'stylers': [{ 'color': '#212121' }] },
    { 'elementType': 'labels.icon', 'stylers': [{ 'visibility': 'off' }] },
    { 'elementType': 'labels.text.fill', 'stylers': [{ 'color': '#757575' }] },
    { 'elementType': 'labels.text.stroke', 'stylers': [{ 'color': '#212121' }] },
    { 'featureType': 'road', 'elementType': 'geometry.fill', 'stylers': [{ 'color': '#2c2c2c' }] },
    { 'featureType': 'water', 'elementType': 'geometry', 'stylers': [{ 'color': '#000000' }] },
  ];

  return (
    <View style={styles.container}>
      <StatusBar animated={false} barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Map Section */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        customMapStyle={isDark ? darkMapStyle : []}
        showsUserLocation={false}
        showsMyLocationButton={false}
        initialRegion={{
          latitude: hasDropCoords ? drop_lat : 13.0827,
          longitude: hasDropCoords ? drop_lng : 80.2707,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
      >
        {hasDropCoords && (
          <Marker coordinate={{ latitude: drop_lat, longitude: drop_lng }} anchor={{ x: 0.5, y: 0.9 }}>
            <View style={styles.destinationMarkerOuter}>
              <View style={styles.destinationBadge}>
                <Text style={styles.destinationBadgeText}>{t('destination_reached', 'Destination reached')}</Text>
              </View>
              <View style={styles.destinationPinOuter}>
                <View style={styles.destinationPinInner} />
              </View>
            </View>
          </Marker>
        )}
      </MapView>

      {/* Back button floating on map */}
      <TouchableOpacity
        style={[styles.backBtn, { top: insets.top + vs(10) }]}
        onPress={() => navigation.navigate('DashboardScreen')}
      >
        <Ionicons name="chevron-back" size={ms(24)} color={isDark ? '#FFF' : '#1F2937'} />
      </TouchableOpacity>

      {/* Recenter FAB */}
      <TouchableOpacity
        style={[styles.recenterFab, { backgroundColor: isDark ? theme.colors.card : '#FFF' }]}
        onPress={() => {
          if (mapRef.current && hasDropCoords) {
            mapRef.current.animateToRegion({
              latitude: drop_lat,
              longitude: drop_lng,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            }, 500);
          }
        }}
      >
        <MaterialCommunityIcons name="crosshairs-gps" size={ms(22)} color={theme.colors.primary} />
      </TouchableOpacity>

      {/* Bottom Sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        backgroundComponent={CustomBackground}
        handleIndicatorStyle={{ backgroundColor: isDark ? '#4B5563' : '#C4C9D4', width: ms(40), height: ms(4), borderRadius: ms(2) }}
      >
        <BottomSheetScrollView
          contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + vs(10) }]}
          showsVerticalScrollIndicator={false}
        >

          {/* Round Trip Badge */}
          {isRoundTrip && (
            <View style={styles.roundTripBadge}>
              <MaterialCommunityIcons name="swap-horizontal" size={ms(14)} color="#3B82F6" />
              <Text style={styles.roundTripBadgeText}>{t('round_trip', 'Round Trip')}</Text>
            </View>
          )}

          {/* Hero Section: Absolute image left, text right */}
          <View style={styles.heroSection}>
            {/* Car image — absolutely positioned on left */}
            <View style={styles.heroImageContainer}>
              <Image
                source={
                  isRoundTrip
                    ? require('../../assets/images/roundtripwaitingimg.png')
                    : require('../../assets/images/waitback.png')
                }
                style={styles.heroImage}
                resizeMode="contain"
              />
              <View style={styles.clockOverlay}>
                <Ionicons name="time" size={ms(14)} color="#FFF" />
              </View>
            </View>
            {/* Text — pushed right to clear the image */}
            <View style={styles.heroTextContainer}>
              <Text style={[styles.heroTitle, { color: isDark ? '#FFF' : '#111827' }]}>
                {t('waiting_at_destination', 'Waiting at Destination')}
              </Text>
              <Text style={[styles.heroSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                {t('waiting_desc', 'Please wait here before starting\nthe return trip.')}
              </Text>
            </View>
          </View>

          {/* Waiting Timer Card */}
          <View style={[styles.timerCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E8EBF0' }]}>
            <View style={styles.timerLeftSection}>
              <View style={[styles.timerIconCircle, { borderColor: isDark ? 'rgba(59,130,246,0.3)' : '#DBEAFE' }]}>
                <Ionicons name="time-outline" size={ms(20)} color="#3B82F6" />
              </View>
              <View>
                <Text style={[styles.timerLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                  {t('waiting_time', 'Waiting time')}
                </Text>
                <Text style={[styles.timerValue, { color: isDark ? '#FFF' : '#111827' }]}>
                  {formatTime(waitingSeconds)}
                </Text>
              </View>
            </View>
            <View style={[styles.timerDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#E8EBF0' }]} />
            <Text style={[styles.timerNote, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
              {t('return_trip_auto', 'Return trip will start automatically\nafter the waiting period.')}
            </Text>
          </View>

          {/* Day Halt Toggle (Outstation Round Trip Only) */}
          {isOutstationRoundTrip && (
            <View style={[styles.dayHaltCard, {
              backgroundColor: isDayHalt
                ? (isDark ? 'rgba(234, 179, 8, 0.1)' : '#FFFBEB')
                : (isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF'),
              borderColor: isDayHalt
                ? (isDark ? 'rgba(234, 179, 8, 0.3)' : '#FDE68A')
                : (isDark ? 'rgba(255,255,255,0.1)' : '#E8EBF0'),
            }]}>
              <View style={styles.dayHaltLeft}>
                <View style={[styles.dayHaltIcon, {
                  backgroundColor: isDayHalt ? '#FEF3C7' : (isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF'),
                }]}>
                  <Ionicons
                    name={isDayHalt ? "pause-circle" : "moon-outline"}
                    size={ms(20)}
                    color={isDayHalt ? '#D97706' : '#3B82F6'}
                  />
                </View>
                <View style={styles.dayHaltTextContainer}>
                  <Text style={[styles.dayHaltTitle, { color: isDark ? '#FFF' : '#111827' }]}>
                    {t('day_halt', 'Day Halt')}
                  </Text>
                  <Text style={[styles.dayHaltSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                    {isDayHalt
                      ? t('day_halt_active_desc', 'Trip paused for the day')
                      : t('day_halt_desc', 'Pause trip for the day')
                    }
                  </Text>
                </View>
              </View>
              <Switch
                trackColor={{ false: isDark ? '#374151' : '#D1D5DB', true: '#F59E0B' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={isDark ? '#374151' : '#D1D5DB'}
                onValueChange={handleToggleChange}
                value={isDayHalt}
                style={{ transform: [{ scale: 0.9 }] }}
              />
            </View>
          )}

          {/* Customer Info Card */}
          <View style={[styles.customerCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E8EBF0' }]}>
            <View style={styles.customerRow}>
              {resolveImageUrl(ride?.passenger_details?.image || ride?.passenger_details?.profile_picture || ride?.user_details?.profile_url || ride?.user_details?.profile_picture || ride?.riderImage || ride?.customer?.profile_url || ride?.customer?.profile_picture || ride?.customer?.image) ? (
                <Image
                  source={{ uri: resolveImageUrl(ride?.passenger_details?.image || ride?.passenger_details?.profile_picture || ride?.user_details?.profile_url || ride?.user_details?.profile_picture || ride?.riderImage || ride?.customer?.profile_url || ride?.customer?.profile_picture || ride?.customer?.image) }}
                  style={styles.customerAvatar}
                />
              ) : (
                <View style={[styles.customerAvatar, { backgroundColor: isDark ? '#1E293B' : '#EEF2FF', justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={[styles.customerAvatarText, { color: theme.colors.primary }]}>
                    {String(passengerName).trim().substring(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.customerMeta}>
                <Text style={[styles.customerName, { color: isDark ? '#FFF' : '#111827' }]} numberOfLines={1}>
                  {passengerName}
                </Text>
                <Text style={[styles.customerVehicle, { color: isDark ? '#9CA3AF' : '#6B7280' }]} numberOfLines={1}>
                  {vehicleLabel}{vehicleNumber ? ` • ${vehicleNumber}` : ''}
                </Text>
                <View style={styles.customerStatusRow}>
                  <View style={[styles.statusDot, { backgroundColor: isDayHalt ? '#F59E0B' : '#22C55E' }]} />
                  <Text style={[styles.customerStatus, { color: isDayHalt ? '#F59E0B' : '#22C55E' }]}>
                    {passengerStatus}
                  </Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end', gap: vs(4) }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : '#FEF3C7', paddingHorizontal: ms(8), paddingVertical: vs(3), borderRadius: ms(8), gap: ms(4) }}>
                  <Ionicons name="star" size={ms(13)} color="#F59E0B" />
                  <Text style={{ fontSize: ms(13), fontWeight: '700', color: '#D97706' }}>
                    {Number(ride?.passenger_details?.rating ?? ride?.user_details?.rating ?? ride?.passenger_rating ?? ride?.rating ?? ride?.customer?.rating ?? 0).toFixed(1)}
                  </Text>
                </View>
                <Text style={{ fontSize: ms(10), fontWeight: '600', color: isDark ? '#6B7280' : '#9CA3AF' }}>
                  {ride?.passenger_details?.total_rides ?? ride?.user_details?.total_rides ?? ride?.total_rides ?? ride?.customer?.total_rides ?? 0} {t('rides', 'rides')}
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons Row */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity style={styles.actionItem} onPress={handleChatPress}>
              <View style={[styles.actionIconCircle, { backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF' }]}>
                <Ionicons name="chatbubble-outline" size={ms(20)} color="#3B82F6" />
              </View>
              <Text style={[styles.actionLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>{t('chat', 'Chat')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionItem} onPress={handleCallPress}>
              <View style={[styles.actionIconCircle, { backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : '#ECFDF5' }]}>
                <Ionicons name="call-outline" size={ms(20)} color="#10B981" />
              </View>
              <Text style={[styles.actionLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>{t('call', 'Call')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionItem} onPress={handleShareTrip}>
              <View style={[styles.actionIconCircle, { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : '#EEF2FF' }]}>
                <Ionicons name="share-social-outline" size={ms(20)} color="#6366F1" />
              </View>
              <Text style={[styles.actionLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>{t('share_trip', 'Share Trip')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionItem} onPress={handleSosPress}>
              <View style={[styles.actionIconCircle, { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEF2F2' }]}>
                <Ionicons name="alert-circle-outline" size={ms(20)} color="#EF4444" />
              </View>
              <Text style={[styles.actionLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>{t('safety', 'Safety')}</Text>
            </TouchableOpacity>
          </View>

          {/* Pickup & Drop Timeline */}
          <View style={[styles.timelineCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E8EBF0' }]}>
            {/* Pickup */}
            <View style={styles.timelineItem}>
              <View style={styles.timelineIconCol}>
                <View style={[styles.timelineDot, { backgroundColor: '#22C55E' }]} />
                <View style={[styles.timelineLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0' }]} />
              </View>
              <View style={styles.timelineContent}>
                <View style={styles.timelineHeaderRow}>
                  <Text style={[styles.timelineLabel, { color: isDark ? '#FFF' : '#111827' }]}>
                    {t('pickup', 'Pickup')}
                  </Text>
                  <Text style={[styles.timelineTime, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
                    {ride?.pickup_time
                      ? new Date(ride.pickup_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\b(am|pm)\b/i, (m: string) => m.toLowerCase()).replace(/(\d+:\d+)\s*(am|pm)/i, '$1 $2').trim()
                      : `${Math.floor(waitingSeconds / 60)} mins ago`
                    }
                  </Text>
                </View>
                <Text style={[styles.timelineAddress, { color: isDark ? '#9CA3AF' : '#6B7280' }]} numberOfLines={2}>
                  {ride?.pickup_address || ride?.pickup || t('location_not_available', 'Location not available')}
                </Text>
              </View>
            </View>

            {/* Drop */}
            <View style={styles.timelineItem}>
              <View style={styles.timelineIconCol}>
                <View style={styles.dropIconContainer}>
                  <Ionicons name="flag" size={ms(12)} color="#EF4444" />
                </View>
              </View>
              <View style={styles.timelineContent}>
                <View style={styles.timelineHeaderRow}>
                  <Text style={[styles.timelineLabel, { color: isDark ? '#FFF' : '#111827' }]}>
                    {t('drop_off_destination', 'Drop-off (Destination)')}
                  </Text>
                  <View style={styles.reachedBadge}>
                    <Ionicons name="checkmark-circle" size={ms(14)} color="#22C55E" />
                    <Text style={styles.reachedText}>{t('reached', 'Reached')}</Text>
                  </View>
                </View>
                <Text style={[styles.timelineAddress, { color: isDark ? '#9CA3AF' : '#6B7280' }]} numberOfLines={2}>
                  {ride?.drop_address || ride?.drop || t('location_not_available', 'Location not available')}
                </Text>
              </View>
            </View>
          </View>

          {/* Swipe Button / Day Halt State */}
          <View style={styles.swipeContainer}>
            {isLoading ? (
              <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginVertical: vs(20) }} />
            ) : isDayHalt ? (
              <View style={styles.dayHaltActiveContainer}>
                <Ionicons name="pause-circle" size={ms(20)} color="#D97706" />
                <Text style={styles.dayHaltActiveText}>
                  {t('day_halt_active', 'Day Halt Active - Return Disabled')}
                </Text>
              </View>
            ) : (
              <SwipeButton
                title={t('start_return_trip', 'Start Return Trip')}
                onSwipeSuccess={handleSwipeSuccess}
              />
            )}
          </View>

        </BottomSheetScrollView>
      </BottomSheet>

      {/* Return Trip Confirmation Modal */}
      <Modal
        visible={isReturnTripModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsReturnTripModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentCompact, { backgroundColor: theme.colors.card }]}>
            <View style={[styles.modalIconWrapper, { backgroundColor: theme.colors.primary + '15' }]}>
              <Ionicons name="arrow-undo-circle" size={ms(40)} color={theme.colors.primary} />
            </View>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {t('confirm_return', 'Start Return Trip?')}
            </Text>
            <Text style={[styles.modalDesc, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
              {t('confirm_return_desc', 'Are you sure you want to start the return trip? This action cannot be undone.')}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSecondary, { borderColor: theme.colors.border }]}
                onPress={() => setIsReturnTripModalVisible(false)}
              >
                <Text style={[styles.modalBtnText, { color: theme.colors.text }]}>{t('cancel', 'Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary, { backgroundColor: theme.colors.primary }]}
                onPress={confirmReturnTrip}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>{t('confirm', 'Confirm')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Day Halt Modal */}
      <Modal
        visible={isDayHaltModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !isToggling && setIsDayHaltModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentBottom, { backgroundColor: theme.colors.card }]}>
            <View style={[styles.modalIconWrapper, { backgroundColor: theme.colors.primary + '20' }]}>
              <Ionicons name="pause-circle" size={ms(40)} color={theme.colors.primary} />
            </View>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {t('confirm_day_halt', 'Confirm Day Halt')}
            </Text>
            <Text style={[styles.modalDesc, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
              {t('confirm_day_halt_desc', 'Turning on day halt will pause location sharing and hold the trip until you resume.')}
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSecondary, { borderColor: theme.colors.border }]}
                onPress={() => setIsDayHaltModalVisible(false)}
                disabled={isToggling}
              >
                <Text style={[styles.modalBtnText, { color: theme.colors.text }]}>{t('cancel', 'Cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary, { backgroundColor: theme.colors.primary }]}
                onPress={() => toggleDayHalt(true)}
                disabled={isToggling}
              >
                {isToggling ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>{t('confirm', 'Confirm')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FC',
  },
  map: {
    flex: 1,
  },
  backBtn: {
    position: 'absolute',
    left: ms(16),
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 10,
  },
  recenterFab: {
    position: 'absolute',
    right: ms(16),
    bottom: '56%',
    width: ms(44),
    height: ms(44),
    borderRadius: ms(22),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 10,
  },

  // Destination Marker
  destinationMarkerOuter: {
    alignItems: 'center',
  },
  destinationBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: ms(12),
    paddingVertical: vs(5),
    borderRadius: ms(20),
    marginBottom: vs(6),
  },
  destinationBadgeText: {
    color: '#FFF',
    fontSize: ms(11),
    fontWeight: '700',
  },
  destinationPinOuter: {
    width: ms(28),
    height: ms(28),
    borderRadius: ms(14),
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  destinationPinInner: {
    width: ms(14),
    height: ms(14),
    borderRadius: ms(7),
    backgroundColor: '#3B82F6',
    borderWidth: 2,
    borderColor: '#FFF',
  },

  // Sheet Content
  sheetContent: {
    paddingHorizontal: ms(16),
    paddingTop: vs(2),
  },

  // Round Trip Badge
  roundTripBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: ms(12),
    paddingVertical: vs(4),
    borderRadius: ms(16),
    gap: ms(5),
    marginBottom: vs(4),
  },
  roundTripBadgeText: {
    color: '#3B82F6',
    fontSize: ms(12),
    fontWeight: '700',
  },

  // Hero Section
  heroSection: {
    position: 'relative',
    minHeight: ms(100),
    marginBottom: vs(10),
    justifyContent: 'center',
  },
  heroImageContainer: {
    position: 'absolute',
    left: -ms(6),
    top: 0,
    bottom: 0,
    width: ms(130),
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  heroImage: {
    width: ms(120),
    height: ms(95),
  },
  clockOverlay: {
    position: 'absolute',
    top: ms(4),
    right: ms(10),
    width: ms(26),
    height: ms(26),
    borderRadius: ms(13),
    backgroundColor: 'rgba(59, 130, 246, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  heroTextContainer: {
    marginLeft: ms(118),
    paddingVertical: vs(8),
    paddingRight: ms(4),
  },
  heroTitle: {
    fontSize: ms(19),
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: vs(4),
  },
  heroSubtitle: {
    fontSize: ms(12),
    fontWeight: '500',
    lineHeight: vs(17),
  },

  // Timer Card
  timerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: ms(14),
    borderWidth: 1,
    padding: ms(10),
    marginBottom: vs(8),
  },
  timerLeftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
  },
  timerIconCircle: {
    width: ms(34),
    height: ms(34),
    borderRadius: ms(17),
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerLabel: {
    fontSize: ms(10),
    fontWeight: '600',
  },
  timerValue: {
    fontSize: ms(18),
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  timerDivider: {
    width: 1,
    height: '80%',
    marginHorizontal: ms(10),
  },
  timerNote: {
    flex: 1,
    fontSize: ms(10),
    fontWeight: '500',
    lineHeight: vs(15),
  },

  // Day Halt Card
  dayHaltCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: ms(14),
    borderWidth: 1,
    padding: ms(10),
    marginBottom: vs(8),
  },
  dayHaltLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dayHaltIcon: {
    width: ms(34),
    height: ms(34),
    borderRadius: ms(10),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: ms(10),
  },
  dayHaltTextContainer: {
    flex: 1,
  },
  dayHaltTitle: {
    fontSize: ms(14),
    fontWeight: '700',
    marginBottom: vs(1),
  },
  dayHaltSubtitle: {
    fontSize: ms(11),
    fontWeight: '500',
  },

  // Customer Card
  customerCard: {
    borderRadius: ms(14),
    borderWidth: 1,
    padding: ms(10),
    marginBottom: vs(8),
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerAvatar: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(22),
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  customerAvatarText: {
    fontSize: ms(16),
    fontWeight: '800',
  },
  customerMeta: {
    flex: 1,
    marginLeft: ms(10),
  },
  customerName: {
    fontSize: ms(14),
    fontWeight: '700',
    marginBottom: vs(1),
  },
  customerVehicle: {
    fontSize: ms(11),
    fontWeight: '500',
    marginBottom: vs(2),
  },
  customerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: ms(6),
    height: ms(6),
    borderRadius: ms(3),
    marginRight: ms(4),
  },
  customerStatus: {
    fontSize: ms(11),
    fontWeight: '600',
  },
  customerActions: {
    flexDirection: 'row',
    gap: ms(6),
  },
  customerActionBtn: {
    width: ms(34),
    height: ms(34),
    borderRadius: ms(17),
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  chatBadge: {
    position: 'absolute',
    top: -ms(4),
    right: -ms(4),
    backgroundColor: '#EF4444',
    borderRadius: ms(8),
    minWidth: ms(16),
    height: ms(16),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
    paddingHorizontal: ms(2),
  },
  chatBadgeText: {
    color: '#FFF',
    fontSize: ms(9),
    fontWeight: 'bold',
  },

  // Action Buttons Row
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: vs(10),
    paddingVertical: vs(2),
  },
  actionItem: {
    alignItems: 'center',
    gap: vs(4),
  },
  actionIconCircle: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(22),
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: ms(10),
    fontWeight: '600',
  },

  // Timeline
  timelineCard: {
    borderRadius: ms(14),
    borderWidth: 1,
    padding: ms(12),
    marginBottom: vs(10),
  },
  timelineItem: {
    flexDirection: 'row',
  },
  timelineIconCol: {
    alignItems: 'center',
    marginRight: ms(10),
    paddingTop: vs(3),
  },
  timelineDot: {
    width: ms(10),
    height: ms(10),
    borderRadius: ms(5),
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginVertical: vs(3),
  },
  timelineContent: {
    flex: 1,
    paddingBottom: vs(10),
  },
  timelineHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(2),
  },
  timelineLabel: {
    fontSize: ms(13),
    fontWeight: '700',
  },
  timelineTime: {
    fontSize: ms(11),
    fontWeight: '500',
  },
  timelineAddress: {
    fontSize: ms(11),
    fontWeight: '500',
    lineHeight: vs(16),
  },
  dropIconContainer: {
    width: ms(20),
    height: ms(20),
    borderRadius: ms(4),
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -ms(4),
  },
  reachedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(4),
  },
  reachedText: {
    color: '#22C55E',
    fontSize: ms(12),
    fontWeight: '600',
  },

  // Swipe Container
  swipeContainer: {
    paddingBottom: vs(4),
  },
  dayHaltActiveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: ms(16),
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    borderRadius: ms(30),
    gap: ms(8),
  },
  dayHaltActiveText: {
    fontSize: ms(15),
    fontWeight: '600',
    color: '#D97706',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContentCompact: {
    width: '85%',
    borderRadius: ms(24),
    padding: ms(24),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalContentBottom: {
    width: '100%',
    borderTopLeftRadius: ms(24),
    borderTopRightRadius: ms(24),
    padding: ms(24),
    alignItems: 'center',
    position: 'absolute',
    bottom: 0,
  },
  modalIconWrapper: {
    width: ms(64),
    height: ms(64),
    borderRadius: ms(32),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(16),
  },
  modalTitle: {
    fontSize: ms(20),
    fontWeight: '700',
    marginBottom: vs(12),
    textAlign: 'center',
  },
  modalDesc: {
    fontSize: ms(15),
    textAlign: 'center',
    marginBottom: vs(24),
    lineHeight: vs(22),
  },
  modalActions: {
    flexDirection: 'row',
    gap: ms(12),
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    height: vs(50),
    borderRadius: ms(25),
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnSecondary: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  modalBtnPrimary: {},
  modalBtnText: {
    fontSize: ms(16),
    fontWeight: '600',
  },
});

export default WaitingScreen;
