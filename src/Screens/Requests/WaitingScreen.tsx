import React, { useEffect, useState, useRef } from 'react';
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
  TouchableWithoutFeedback,
  ImageBackground,
  Image,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation, useFocusEffect, StackActions } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../redux/store';
import { useAppTheme } from '../../context/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import { useHaptic } from '../../hooks/useHaptic';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useStartReturnTripMutation, useToggleDayHaltMutation, useTriggerSosMutation } from '../../service/driverApi';
import { useLocationTracker } from '../../hooks/useLocationTracker';
import { useCallback } from 'react';
import SwipeButton from '../Dashboard/dashComponents/SwipeButton';
import { mS as ms, vS as vs } from '../../lib/scale';
import { ChatScreen_Nav, HelpCenter_Nav } from '../../Navigations/navigations';
import { setCurrentRide } from '../../redux/rideSlice';
import LinearGradient from 'react-native-linear-gradient';

const WaitingScreen = ({ route }: any) => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { theme, isDark } = useAppTheme();
  const { showAlert } = useAlert();
  const { triggerHaptic } = useHaptic();
  const dispatch = useDispatch();

  const rideFromStore = useSelector((state: RootState) => state.ride.currentRide);
  const ride = rideFromStore || route?.params?.ride || {};

  const handleCopyTripCode = useCallback(() => {
    const code = ride?.trip_code || ride?.booking_code;
    if (code) {
      Clipboard.setString(code);
      triggerHaptic?.(HapticFeedbackTypes.notificationSuccess);
      showAlert({
        title: t('copied') || 'Copied',
        message: t('trip_code_copied') || 'Trip code copied to clipboard',
        singleButton: true,
        icon: 'checkmark-circle-outline',
        onConfirm: () => { },
      });
    }
  }, [ride, t, showAlert, triggerHaptic]);

  const handleCopyTripId = useCallback(() => {
    const id = String(ride?.trip_id || ride?.id || '');
    if (id) {
      Clipboard.setString(id);
      triggerHaptic?.(HapticFeedbackTypes.notificationSuccess);
      showAlert({
        title: t('copied') || 'Copied',
        message: t('trip_id_copied') || 'Trip ID copied to clipboard',
        singleButton: true,
        icon: 'checkmark-circle-outline',
        onConfirm: () => { },
      });
    }
  }, [ride, t, showAlert, triggerHaptic]);

  const distance = ride?.distance_km || '0';
  const eta = ride?.trip_duration_minutes || ride?.duration || '0';
  const vehicleInfo = { label: ride?.car_name || ride?.vehicle_model || ride?.ride_type || ride?.service_type || 'Premium Ride' };

  const trip_id = ride?.trip_id || ride?.id;
  const user = useSelector((state: RootState) => state.userSlice?.user);

  const [startReturnTripApi, { isLoading }] = useStartReturnTripMutation();
  const [toggleDayHaltApi, { isLoading: isToggling }] = useToggleDayHaltMutation();
  const [triggerSosApi] = useTriggerSosMutation();

  const [waitingSeconds, setWaitingSeconds] = useState(0);
  const [isDayHaltModalVisible, setIsDayHaltModalVisible] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isTripDetailsModalVisible, setIsTripDetailsModalVisible] = useState(false);
  const [isReturnTripModalVisible, setIsReturnTripModalVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { width: windowWidth } = useWindowDimensions();
  const [activeSlide, setActiveSlide] = useState(0);
  const slideTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const slides = [
    {
      id: '1',
      title: t('contact_app', 'Need Help?'),
      description: t('contact_app_desc', 'Contact our support team 24/7 for any assistance regarding your rides or the app.'),
      icon: 'headset-outline',
      color: '#3B82F6',
    },
    {
      id: '2',
      title: t('driver_benefits', 'Driver Benefits'),
      description: t('driver_benefits_desc', 'Earn more with our flexible hours, bonuses on peak times, and instant daily payouts.'),
      icon: 'gift-outline',
      color: '#10B981',
    },
    {
      id: '3',
      title: t('driver_rules', 'Code of Conduct'),
      description: t('driver_rules_desc', 'Maintain a clean vehicle, drive safely, and be polite to ensure 5-star ratings from passengers.'),
      icon: 'shield-checkmark-outline',
      color: '#F59E0B',
    },
    {
      id: '4',
      title: t('motivational', 'You Are Doing Great!'),
      description: t('motivational_desc', 'Your hard work moves the city forward. Keep up the amazing service, hero!'),
      icon: 'star-outline',
      color: '#8B5CF6',
    }
  ];

  useEffect(() => {
    slideTimerRef.current = setInterval(() => {
      setActiveSlide((prev) => {
        const next = (prev + 1) % slides.length;
        scrollViewRef.current?.scrollTo({ x: next * (windowWidth - ms(40)), animated: true });
        return next;
      });
    }, 4000);
    return () => {
      if (slideTimerRef.current) clearInterval(slideTimerRef.current);
    };
  }, [windowWidth]);

  const handleScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = Math.round(event.nativeEvent.contentOffset.x / slideSize);
    if (index !== activeSlide) setActiveSlide(index);
  };

  const isOutstationRoundTrip = ride?.ride_type === 'OUTSTATION_ROUND_TRIP';
  const isDayHalt = ride?.trip_status === 'DAY_HALT';

  useLocationTracker({
    driverId: user?.driverId,
    isTracking: !isDayHalt,
    tripId: trip_id,
    mode: 'idle',
  });

  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        showAlert({
          title: t('waiting'),
          message: t('cannot_go_back_waiting', 'You cannot go back while waiting for the round trip.'),
          singleButton: true,
          icon: 'information-circle-outline',
        });
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
    // Start local timer
    timerRef.current = setInterval(() => {
      setWaitingSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

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
      await startReturnTripApi(trip_id.toString()).unwrap();
      triggerHaptic?.(HapticFeedbackTypes.notificationSuccess);
      navigation.dispatch(StackActions.replace('ReturnTripMapScreen', { ride }));
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

  const handleSOS = useCallback(() => {
    triggerHaptic?.(HapticFeedbackTypes.notificationWarning);
    handleSosPress();
  }, [handleSosPress, triggerHaptic]);

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

  const handleHelpCenter = () => {
    setShowMenu(false);
    navigation.navigate(HelpCenter_Nav);
  };

  const handleViewTrip = () => {
    setShowMenu(false);
    setIsTripDetailsModalVisible(true);
  };

  return (
    <ImageBackground
      source={isDayHalt ? require('../../assets/images/dayhalt.png') : require('../../assets/images/waitback.png')}
      style={styles.backgroundContainer}
      resizeMode="cover"
    >
      <LinearGradient
        colors={isDark ? ['rgba(18, 18, 18, 0.4)', 'rgba(18, 18, 18, 0.85)'] : ['rgba(255, 255, 255, 0.4)', 'rgba(255, 255, 255, 0.85)']}
        style={styles.gradientOverlay}
      >
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <TouchableWithoutFeedback onPress={() => showMenu && setShowMenu(false)}>
            <View style={styles.container}>

              <View style={styles.headerContainer}>
                <View style={styles.headerCenter} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: ms(12) }}>
                  <TouchableOpacity
                    style={[styles.sosButton, { backgroundColor: '#B91C1C' }]}
                    onLongPress={handleSOS}
                    onPress={handleSosPress}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="alert-circle" size={ms(18)} color="#FFF" style={{ marginRight: ms(6) }} />
                    <Text style={styles.sosText} numberOfLines={1} adjustsFontSizeToFit>{t('sos') || 'SOS'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowMenu(!showMenu)} style={styles.iconBtnMinimal}>
                    <Ionicons name="ellipsis-vertical" size={ms(24)} color={theme.colors.text} />
                  </TouchableOpacity>
                </View>
              </View>

              {showMenu && (
                <View style={[styles.dropdownMenu, { backgroundColor: isDark ? 'rgba(30, 30, 30, 0.98)' : 'rgba(255, 255, 255, 0.98)' }]}>
                  <TouchableOpacity style={styles.dropdownItem} onPress={handleViewTrip}>
                    <Ionicons name="map-outline" size={ms(18)} color={theme.colors.text} />
                    <Text style={[styles.dropdownText, { color: theme.colors.text }]}>{t('view_trip', 'View Trip')}</Text>
                  </TouchableOpacity>
                  <View style={[styles.dropdownDivider, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' }]} />
                  <TouchableOpacity style={styles.dropdownItem} onPress={handleHelpCenter}>
                    <Ionicons name="help-circle-outline" size={ms(18)} color={theme.colors.text} />
                    <Text style={[styles.dropdownText, { color: theme.colors.text }]}>{t('help_center', 'Help Center')}</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.content}>

                <View style={styles.screenHeader}>
                  <Text style={[styles.screenTitle, { color: theme.colors.text }]}>
                    {t('waiting_at_destination', 'Waiting at Destination')}
                  </Text>
                  <Text style={[styles.screenSubtitle, { color: theme.colors.primary }]}>
                    {t('please_wait_for_rider', 'Please wait for the rider to return')}
                  </Text>
                </View>

                <View style={styles.mainCard}>
                  <View style={styles.riderInfoCompact}>
                    <View style={styles.riderAvatar}>
                      <Ionicons name="person" size={ms(20)} color={theme.colors.primary} />
                    </View>
                    <View style={styles.riderDetails}>
                      <Text style={[styles.riderName, { color: theme.colors.text }]} numberOfLines={1}>
                        {ride?.passenger_details?.name || ride?.user_details?.full_name || t('rider')}
                      </Text>
                      <Text style={[styles.riderSub, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                        {t('contact_rider_if_needed', 'Contact if needed')}
                      </Text>
                    </View>
                    <View style={styles.actionButtons}>
                      <TouchableOpacity onPress={handleCallPress} style={styles.compactBtn}>
                        <Ionicons name="call" size={ms(20)} color="#10B981" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleChatPress} style={styles.compactBtn}>
                        <Ionicons name="chatbubble-ellipses" size={ms(20)} color={theme.colors.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {isOutstationRoundTrip && (
                    <>
                      <View style={[styles.toggleContainer, { backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.04)', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                        <View style={styles.toggleTextContainer}>
                          <Text style={[styles.toggleTitle, { color: theme.colors.text }]}>
                            {t('day_halt', 'Day Halt')}
                          </Text>
                          <Text style={[styles.toggleSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                            {t('day_halt_desc', 'Pause trip for the day')}
                          </Text>
                        </View>
                        <Switch
                          trackColor={{ false: '#767577', true: theme.colors.primary }}
                          thumbColor="#f4f3f4"
                          ios_backgroundColor="#3e3e3e"
                          onValueChange={handleToggleChange}
                          value={isDayHalt}
                          style={{ transform: [{ scale: 0.9 }] }}
                        />
                      </View>
                    </>
                  )}
                </View>

                {/* Slideshow Card */}
                <View style={[styles.sliderCard, { marginTop: vs(16), borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                  <ScrollView
                    ref={scrollViewRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={handleScroll}
                  >
                    {slides.map((slide, index) => (
                      <View key={slide.id} style={[styles.slideItem, { width: windowWidth - ms(40) }]}>
                        <View style={[styles.slideIconContainer, { backgroundColor: slide.color + '15' }]}>
                          <Ionicons name={slide.icon} size={ms(24)} color={slide.color} />
                        </View>
                        <View style={styles.slideTextContainer}>
                          <Text style={[styles.slideTitle, { color: theme.colors.text }]}>{slide.title}</Text>
                          <Text style={[styles.slideDescription, { color: isDark ? '#9CA3AF' : '#6B7280' }]} numberOfLines={2}>
                            {slide.description}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                  <View style={styles.paginationContainer}>
                    {slides.map((_, index) => (
                      <View
                        key={index}
                        style={[
                          styles.paginationDot,
                          activeSlide === index ? { backgroundColor: theme.colors.primary, width: ms(16) } : { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }
                        ]}
                      />
                    ))}
                  </View>
                </View>

                {/* Timer Section Below Slideshow */}
                <View style={{ alignItems: 'center', marginBottom: vs(16) }}>
                  <Text style={[styles.timerValue, { color: theme.colors.primary }]}>
                    {formatTime(waitingSeconds)}
                  </Text>
                  <Text style={[styles.timerLabel, { color: isDark ? '#9CA3AF' : '#6B7280', marginTop: 0, marginBottom: 0 }]}>
                    {t('waiting_time', 'ELAPSED TIME')}
                  </Text>
                </View>

              </View>

              <View style={styles.footer}>
                {isLoading ? (
                  <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginVertical: vs(20) }} />
                ) : isDayHalt ? (
                  <View style={styles.dayHaltActiveContainer}>
                    <Ionicons name="pause" size={ms(20)} color="#EAB308" />
                    <Text style={[styles.dayHaltActiveText, { color: '#EAB308' }]}>
                      {t('day_halt_active', 'Day Halt Active - Return Disabled')}
                    </Text>
                  </View>
                ) : (
                  <SwipeButton
                    title={t('start_return_trip', 'Swipe to Start Return')}
                    onSwipeSuccess={handleSwipeSuccess}
                  />
                )}
              </View>

            </View>
          </TouchableWithoutFeedback>

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

          {/* Trip Details Modal */}
          <Modal
            visible={isTripDetailsModalVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setIsTripDetailsModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.detailsModal, { backgroundColor: theme.colors.card }]}>
                <View style={[styles.modalIndicator, { backgroundColor: theme.colors.border }]} />
                <View style={[styles.modalHeader, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                  <View>
                    <Text style={[styles.detailsModalTitle, { color: theme.colors.primary }]} numberOfLines={1} adjustsFontSizeToFit>
                      {t('trip_details', 'Trip Details').toUpperCase()}
                    </Text>
                    <Text style={[styles.modalSubtitle, { color: theme.colors.paragraphText }]}>
                      {t('complete_trip_info', 'Complete trip information')}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setIsTripDetailsModalVisible(false)} style={{ padding: ms(4) }}>
                    <Text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: ms(14) }}>{t('close', 'Close')}</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.detailsContent}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: vs(20) }}
                >
                  {/* Trip Identifiers Box (Minimal Stacked) */}
                  <View style={[styles.tripIdsBox, { flexDirection: 'column', backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 0, paddingVertical: vs(4), marginBottom: vs(8), gap: vs(8) }]}>

                    {/* Trip ID Row */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={[styles.idLabel, { color: theme.colors.paragraphText, marginRight: ms(6), marginBottom: 0 }]} numberOfLines={1}>{t('trip_id', 'TRIP ID')}:</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }} style={{ flex: 1, maxWidth: '80%' }}>
                          <Text style={[styles.idValue, { color: theme.colors.text, fontSize: ms(13), textAlign: 'right' }]}>#{ride?.trip_id || ride?.id || 'N/A'}</Text>
                        </ScrollView>
                        <TouchableOpacity
                          onPress={handleCopyTripId}
                          style={{ marginLeft: ms(8), padding: ms(2) }}
                        >
                          <Ionicons name="copy-outline" size={ms(16)} color={theme.colors.text} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Trip Code Row */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={[styles.idLabel, { color: theme.colors.paragraphText, marginRight: ms(6), marginBottom: 0 }]} numberOfLines={1}>{t('trip_code', 'TRIP CODE')}:</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.idValue, { color: theme.colors.primary, fontWeight: '900', fontSize: ms(14) }]}>{ride?.trip_code || ride?.booking_code || '---'}</Text>
                        {(ride?.trip_code || ride?.booking_code) && (
                          <TouchableOpacity
                            onPress={handleCopyTripCode}
                            style={{ marginLeft: ms(8), padding: ms(2) }}
                          >
                            <Ionicons name="copy-outline" size={ms(16)} color={theme.colors.primary} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                  </View>

                  {/* Exact UI from RideCardItem */}
                  <View style={[
                    styles.card,
                    {
                      backgroundColor: isDark ? theme.colors.background : '#F9FAFB',
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                      marginTop: vs(8),
                      borderWidth: 1,
                      overflow: 'hidden',
                    }
                  ]}>
                    <View style={[styles.timeSubHeader, { backgroundColor: isDark ? 'rgba(96, 165, 250, 0.1)' : '#EFF6FF' }]}>
                      <Ionicons name="calendar-outline" size={ms(14)} color={isDark ? '#93C5FD' : '#2563EB'} />
                      <Text style={[styles.dateSubHeaderText, { color: isDark ? '#93C5FD' : '#2563EB' }]}>
                        {new Date(ride?.created_at || new Date()).toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })}
                      </Text>
                      <View style={styles.statsDot} />
                      <Ionicons name="time-outline" size={ms(14)} color={isDark ? '#93C5FD' : '#2563EB'} />
                      <Text style={[styles.timeSubHeaderText, { color: isDark ? '#93C5FD' : '#2563EB' }]}>
                        {new Date(ride?.created_at || new Date()).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </Text>
                    </View>

                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.cardHeaderText, { color: theme.colors.paragraphText }]} numberOfLines={1} adjustsFontSizeToFit>
                          {t('your_active_ride', 'Your Active Ride')}
                        </Text>
                        <View style={styles.badgeRow}>
                          <View style={[styles.miniTag, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC' }]}>
                            <Text style={[styles.miniTagText, { color: isDark ? theme.colors.textMuted : '#64748B' }]} numberOfLines={1} adjustsFontSizeToFit>
                              {t(ride?.ride_type || 'ONE_WAY')}
                            </Text>
                          </View>
                          <View style={[styles.miniTag, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC' }]}>
                            <Text style={[styles.miniTagText, { color: isDark ? theme.colors.textMuted : '#64748B' }]} numberOfLines={1} adjustsFontSizeToFit>
                              {t(ride?.paymentType || ride?.payment_method || 'CASH')}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <Text style={[styles.priceBig, { color: '#16A34A' }]}>{t('currency_symbol', '₹')}{ride?.total_fare || ride?.fare || '0'}</Text>
                    </View>

                    <View style={styles.locationContainer}>
                      <View style={styles.locationIndicator}>
                        <Ionicons name="radio-button-on" size={ms(18)} color="#4ade80" />
                        <View style={[styles.line, { backgroundColor: theme.colors.border, flex: 1 }]} />
                        <Ionicons name="location" size={ms(18)} color="#f87171" />
                      </View>
                      <View style={styles.addresses}>
                        <View style={styles.addressBox}>
                          <Text style={[styles.addrLabel, { color: isDark ? theme.colors.textMuted : '#64748B' }]}>{t('pickup')}</Text>
                          <Text style={[styles.addrText, { color: theme.colors.text }]}>{ride?.pickup_address || ride?.pickup}</Text>
                        </View>
                        <View style={[styles.addressBox, { marginTop: vs(12) }]}>
                          <Text style={[styles.addrLabel, { color: isDark ? theme.colors.textMuted : '#64748B' }]}>{t('drop')}</Text>
                          <Text style={[styles.addrText, { color: theme.colors.text }]}>{ride?.drop_address || ride?.drop}</Text>
                        </View>
                      </View>
                    </View>

                    <View style={[styles.rideStatsPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9' }]}>
                      <View style={styles.statItemRow}>
                        <Ionicons name="shuffle-outline" size={ms(14)} color={isDark ? theme.colors.textMuted : '#64748B'} />
                        <Text style={[styles.rideStatsText, { color: isDark ? theme.colors.text : '#475569' }]}>{distance} {t('km_unit', 'km')}</Text>
                      </View>
                      <View style={styles.statsDot} />
                      <View style={styles.statItemRow}>
                        <Ionicons name="time-outline" size={ms(14)} color={isDark ? theme.colors.textMuted : '#64748B'} />
                        <Text style={[styles.rideStatsText, { color: isDark ? theme.colors.text : '#475569' }]}>
                          {t('eta')}: {eta} {t('minutes_unit', 'm')}
                        </Text>
                      </View>
                      <View style={styles.statsDot} />
                      <View style={styles.ecoBadge}>
                        <Ionicons name="leaf-outline" size={ms(12)} color="#22C55E" />
                        <Text style={[styles.ecoBadgeText, { color: '#22C55E' }]}>{t('eco_friendly', 'Eco-Friendly')}</Text>
                      </View>
                    </View>

                    <View style={styles.vehicleInfoContainer}>
                      <Text style={[styles.vehicleNameText, { color: theme.colors.text }]}>
                        {vehicleInfo.label}
                      </Text>
                      <View style={styles.vehicleBadgeRow}>
                        <View style={[styles.vehicleBadge, { backgroundColor: isDark ? 'rgba(96, 165, 250, 0.1)' : '#EFF6FF' }]}>
                          <Ionicons name="cog-outline" size={ms(12)} color={isDark ? '#93C5FD' : '#2563EB'} />
                          <Text style={[styles.vehicleBadgeText, { color: isDark ? '#93C5FD' : '#2563EB' }]}>
                            {ride?.transmission || 'Auto'}
                          </Text>
                        </View>
                        <View style={[styles.vehicleBadge, { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : '#F0FDF4' }]}>
                          <Ionicons name="flash-outline" size={ms(12)} color={isDark ? '#4ADE80' : '#16A34A'} />
                          <Text style={[styles.vehicleBadgeText, { color: isDark ? '#4ADE80' : '#16A34A' }]}>
                            {ride?.fuel_type || 'Any'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.passengerBox}>
                      <View style={styles.passengerMain}>
                        {ride?.passenger_details?.image || ride?.user_details?.profile_url || ride?.riderImage ? (
                          <Image source={{ uri: ride?.passenger_details?.image || ride?.user_details?.profile_url || ride?.riderImage }} style={styles.avatar} />
                        ) : (
                          <View style={[styles.avatar, { backgroundColor: '#E0F2C1' }]}>
                            <Text style={[styles.avatarText, { color: theme.colors.primary }]}>
                              {String(ride?.passenger_details?.name || ride?.user_details?.full_name || ride?.user_details?.first_name || ride?.passenger || ride?.passenger_name || ride?.customer?.name || 'P').trim().substring(0, 2).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View>
                          <Text style={[styles.psgrName, { color: isDark ? '#FFF' : '#111827' }]}>{ride?.passenger_details?.name || ride?.user_details?.full_name || ride?.user_details?.first_name || ride?.passenger || ride?.passenger_name || ride?.customer?.name || 'Passenger'}</Text>
                          <View style={styles.psgrDetailRow}>
                            <Text style={[styles.psgrDetail, { color: '#16A34A' }]}>{t('verified_passenger', 'Verified Passenger')}</Text>
                            <View style={styles.ratingBadge}>
                              <Ionicons name="star" size={ms(12)} color="#F59E0B" />
                              <Text style={styles.ratingText}>{ride?.passenger_details?.rating ?? ride?.user_details?.rating ?? ride?.passenger_rating ?? ride?.rating ?? ride?.customer?.rating ?? '5.0'}</Text>
                            </View>
                          </View>
                        </View>
                      </View>
                      <TouchableOpacity style={styles.floatCallBtn} onPress={() => Linking.openURL(`tel:${ride?.phone || ride?.passenger_phone || ride?.user_details?.phone_number || ride?.passenger_details?.phone}`)}>
                        <Ionicons name="call" size={ms(20)} color="#FFF" />
                      </TouchableOpacity>
                    </View>

                  </View>
                </ScrollView>
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
              <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
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

        </SafeAreaView>
      </LinearGradient>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: ms(20),
    paddingTop: vs(12),
    paddingBottom: vs(8),
  },
  iconBtnMinimal: {
    width: ms(40),
    height: ms(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ms(12),
    paddingVertical: vs(6),
    borderRadius: ms(20),
    gap: ms(6),
  },
  dotIndicator: {
    width: ms(8),
    height: ms(8),
    borderRadius: ms(4),
  },
  statusText: {
    fontSize: ms(13),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dropdownMenu: {
    position: 'absolute',
    top: vs(55),
    right: ms(20),
    width: ms(170),
    borderRadius: ms(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 100,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: ms(14),
    paddingHorizontal: ms(16),
    gap: ms(12),
  },
  dropdownText: {
    fontSize: ms(15),
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  dropdownDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  content: {
    flex: 1,
    paddingHorizontal: ms(20),
    justifyContent: 'center',
  },
  mainCard: {
    width: '100%',
    padding: ms(20),
    alignItems: 'center',
  },
  timerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
    marginBottom: vs(16),
  },
  timerTitle: {
    fontSize: ms(18),
    fontWeight: '700',
  },
  timerValue: {
    fontSize: ms(28),
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    lineHeight: ms(42),
  },
  timerLabel: {
    fontSize: ms(12),
    fontWeight: '600',
    marginTop: vs(4),
    marginBottom: vs(24),
    letterSpacing: 1,
  },
  divider: {
    width: '100%',
    height: 1,
    marginBottom: vs(20),
  },
  riderInfoCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: vs(8),
  },
  riderAvatar: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(22),
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: ms(12),
  },
  riderDetails: {
    flex: 1,
    paddingRight: ms(8),
  },
  riderName: {
    fontSize: ms(16),
    fontWeight: '700',
    marginBottom: vs(2),
  },
  riderSub: {
    fontSize: ms(12),
  },
  actionButtons: {
    flexDirection: 'row',
    gap: ms(8),
  },
  compactBtn: {
    width: ms(38),
    height: ms(38),
    borderRadius: ms(19),
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: ms(14),
    borderRadius: ms(16),
    marginTop: vs(16),
  },
  toggleTextContainer: {
    flex: 1,
    paddingRight: ms(12),
  },
  toggleTitle: {
    fontSize: ms(15),
    fontWeight: '600',
    marginBottom: vs(2),
  },
  toggleSubtitle: {
    fontSize: ms(13),
  },
  footer: {
    paddingHorizontal: ms(20),
    paddingBottom: vs(30),
    paddingTop: vs(10),
    width: '100%',
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
  },
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
  modalContent: {
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
  modalBtnPrimary: {
  },
  modalBtnText: {
    fontSize: ms(16),
    fontWeight: '600',
  },
  tripDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  timelineContainer: {
    width: '100%',
    padding: ms(16),
    borderRadius: ms(16),
    marginTop: vs(12),
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timelineTitle: {
    fontSize: ms(15),
    fontWeight: '600',
  },
  timelineBody: {
    marginTop: vs(16),
    paddingLeft: ms(8),
  },
  timelineStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(12),
  },
  timelineDot: {
    width: ms(10),
    height: ms(10),
    borderRadius: ms(5),
    backgroundColor: '#10B981',
  },
  timelineDotCurrent: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    width: ms(12),
    height: ms(12),
    borderRadius: ms(6),
    marginLeft: -ms(1),
  },
  timelineDotPending: {
    backgroundColor: '#9CA3AF',
  },
  timelineLine: {
    width: 2,
    height: vs(16),
    backgroundColor: 'rgba(156, 163, 175, 0.3)',
    marginLeft: ms(4),
    marginVertical: vs(2),
  },
  timelineText: {
    fontSize: ms(14),
    flex: 1,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: ms(14),
    letterSpacing: 1
  },
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
  detailsModalTitle: {
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
  tripIdsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: ms(16),
    borderRadius: ms(20),
    marginBottom: vs(16),
    borderWidth: 1,
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
  card: {
    backgroundColor: '#fff',
    borderRadius: ms(24),
    padding: ms(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  timeSubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: vs(8),
    paddingHorizontal: ms(12),
    borderRadius: ms(12),
    marginBottom: vs(14),
  },
  dateSubHeaderText: {
    fontSize: ms(12),
    fontWeight: '700',
    marginLeft: ms(6),
  },
  statsDot: {
    width: ms(4),
    height: ms(4),
    borderRadius: ms(2),
    backgroundColor: 'rgba(100, 116, 139, 0.5)',
    marginHorizontal: ms(10),
  },
  timeSubHeaderText: {
    fontSize: ms(12),
    fontWeight: '700',
    marginLeft: ms(6),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: vs(16),
  },
  cardHeaderText: {
    fontSize: ms(14),
    fontWeight: '600',
    marginBottom: vs(4),
  },
  badgeRow: {
    flexDirection: 'row',
    gap: ms(6),
  },
  miniTag: {
    paddingHorizontal: ms(8),
    paddingVertical: vs(4),
    borderRadius: ms(6),
  },
  miniTagText: {
    fontSize: ms(10),
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  priceBig: {
    fontSize: ms(20),
    fontWeight: '800',
  },
  locationContainer: {
    flexDirection: 'row',
    marginBottom: vs(16),
  },
  locationIndicator: {
    alignItems: 'center',
    marginRight: ms(12),
    paddingVertical: vs(2),
  },
  line: {
    width: 2,
    flex: 1,
    marginVertical: vs(4),
    borderStyle: 'dashed',
  },
  addresses: {
    flex: 1,
  },
  addressBox: {
    flex: 1,
  },
  addrLabel: {
    fontSize: ms(11),
    fontWeight: '600',
    marginBottom: vs(2),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addrText: {
    fontSize: ms(14),
    fontWeight: '700',
    lineHeight: ms(20),
  },
  rideStatsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: vs(12),
    paddingHorizontal: ms(14),
    borderRadius: ms(14),
    marginBottom: vs(16),
  },
  statItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rideStatsText: {
    fontSize: ms(13),
    fontWeight: '600',
    marginLeft: ms(6),
  },
  ecoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ecoBadgeText: {
    fontSize: ms(11),
    fontWeight: '700',
    marginLeft: ms(4),
  },
  vehicleInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: vs(14),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  vehicleNameText: {
    fontSize: ms(15),
    fontWeight: '800',
  },
  vehicleBadgeRow: {
    flexDirection: 'row',
    gap: ms(6),
  },
  vehicleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ms(8),
    paddingVertical: vs(4),
    borderRadius: ms(8),
  },
  vehicleBadgeText: {
    fontSize: ms(11),
    fontWeight: '700',
    marginLeft: ms(4),
  },
  passengerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: vs(14),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  passengerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(22),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: ms(12),
  },
  avatarText: {
    fontSize: ms(16),
    fontWeight: '800',
  },
  psgrName: {
    fontSize: ms(15),
    fontWeight: '700',
    marginBottom: vs(2),
  },
  psgrDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  psgrDetail: {
    fontSize: ms(12),
    fontWeight: '600',
    marginRight: ms(8),
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: ms(6),
    paddingVertical: vs(2),
    borderRadius: ms(6),
  },
  ratingText: {
    color: '#D97706',
    fontSize: ms(11),
    fontWeight: '700',
    marginLeft: ms(2),
  },
  floatCallBtn: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(22),
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  sliderCard: {
    borderRadius: ms(16),
    marginBottom: vs(16),
    overflow: 'hidden',
  },
  slideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: ms(16),
  },
  slideIconContainer: {
    width: ms(48),
    height: ms(48),
    borderRadius: ms(24),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: ms(16),
  },
  slideTextContainer: {
    flex: 1,
  },
  slideTitle: {
    fontSize: ms(15),
    fontWeight: '700',
    marginBottom: vs(4),
  },
  slideDescription: {
    fontSize: ms(12),
    lineHeight: ms(18),
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: vs(12),
    gap: ms(6),
  },
  paginationDot: {
    height: ms(4),
    width: ms(4),
    borderRadius: ms(2),
  },
  screenHeader: {
    paddingHorizontal: ms(4),
    marginTop: vs(30),
    marginBottom: vs(12),
  },
  screenTitle: {
    fontSize: ms(24),
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    fontSize: ms(13),
    fontWeight: '600',
    marginTop: vs(2),
  },
});

export default WaitingScreen;
