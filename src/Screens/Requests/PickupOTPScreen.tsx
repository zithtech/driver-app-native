import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Modal,
  BackHandler,
  Image,
  Linking,
  Share,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useHaptic } from '../../hooks/useHaptic';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../redux/store';

import { useAppTheme } from '../../context/ThemeContext';
import { vS as vs, mS as ms } from '../../lib/scale';
import { useAlert } from '../../context/AlertContext';
import { useToast } from '../../context/ToastContext';
import { VehicleVerificationScreen_Nav, ScheduledRideDetails_Nav, HelpCenter_Nav, ChatScreen_Nav } from '../../Navigations/navigations';
import { useStartTripMutation, useCancelTripMutation } from '../../service/driverApi';
import { clearAcceptedRide, setCurrentRide } from '../../redux/rideSlice';
import { CancellationModal } from '../../Components';
import AppStatusBar from '../../Components/AppStatusBar';
import socketService from '../../service/socketService';
import audioService from '../../utils/audioService';
import { StackActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveImageUrl } from '../../utils/imageUtils';
import { useLocationTracker } from '../../hooks/useLocationTracker';



interface PickupOTPModalProps {
  isVisible: boolean;
  onClose: () => void;
  ride?: any;
}

const PickupOTPScreen = ({ route, navigation }: any) => {
  const rideFromStore = useSelector((state: RootState) => state.ride.currentRide);
  const user = useSelector((state: RootState) => state.userSlice?.user);
  const ride = route?.params?.ride || rideFromStore || {};
  const { t } = useTranslation();
  const { theme, isDark } = useAppTheme();
  const { showAlert, hideAlert } = useAlert();
  const { showToast } = useToast();
  const { triggerHaptic } = useHaptic();
  const dispatch = useDispatch();

  // 📍 Keep foreground location service alive on this screen
  const trip_id = ride?.trip_id || ride?.id;
  useLocationTracker({
    driverId: user?.driverId,
    isTracking: !!trip_id,
    tripId: trip_id,
    mode: 'moving',
    suppressEmission: false,
  });

  const onClose = () => {
    navigation.navigate('DashboardScreen');
  };

  // 🛡️ Guard: Exit screen if ride is cleared from Redux (e.g. by global cancellation)
  // We use a ref to track whether we've seen a valid ride at least once.
  // This prevents the guard from firing during initial Redux rehydration
  // when rideFromStore is momentarily null before persisted data loads.
  const hadRideRef = useRef(!!rideFromStore);
  useEffect(() => {
    if (rideFromStore) {
      hadRideRef.current = true; // Mark that we've seen a valid ride
    } else if (hadRideRef.current && !rideFromStore) {
      // Ride was present but is now cleared → genuine cancellation
      console.log('[PickupOTPScreen] Active ride cleared from Redux, closing...');
      onClose();
    }
  }, [rideFromStore]);

  // Auto-redirect if OTP was already verified
  useEffect(() => {
    const checkOTPStatus = async () => {
      const tripId = ride?.trip_id || ride?.id;
      if (tripId) {
        try {
          const isOTPVerified = await AsyncStorage.getItem(`otp_verified_${tripId}`);
          if (isOTPVerified === 'true') {
            navigation.replace('VehicleVerificationScreen', { ride });
          }
        } catch (e) {
          console.error('Failed to read OTP state:', e);
        }
      }
    };
    checkOTPStatus();
  }, [ride]);

  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        navigation.navigate('DashboardScreen');
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => {
        subscription.remove();
      };
    }, [navigation])
  );

  const getInitials = (name: string) => {
    if (!name) return 'PA';
    return name.trim().substring(0, 2).toUpperCase();
  };





  const [otp, setOtp] = useState(['', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showTripOptionsModal, setShowTripOptionsModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [otpError, setOtpError] = useState(false);

  const [startTripApi] = useStartTripMutation();
  const [cancelTripApi, { isLoading: isCancelling }] = useCancelTripMutation();

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
        title: 'Trip Cancelled',
        message: 'The trip has been cancelled successfully.',
        singleButton: true,
        icon: 'checkmark-circle-outline',
      });

      setTimeout(() => {
        hideAlert();
        dispatch(clearAcceptedRide());
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
        title: isAlreadyCancelled ? (t('ride_cancelled') || 'Ride Cancelled') : t('common.error'),
        message: isAlreadyCancelled
          ? (t('rider_cancelled_msg') || 'The rider has cancelled this trip.')
          : (error?.data?.message || t('failed_cancel_trip') || 'Failed to cancel trip. Please try again.'),
        singleButton: true,
        icon: isAlreadyCancelled ? 'checkmark-circle-outline' : 'alert-circle-outline',
        onConfirm: shouldAllowForceClear ? () => {
          dispatch(clearAcceptedRide());
          navigation.reset({ index: 0, routes: [{ name: 'DashboardScreen' }] });
        } : undefined
      });
    }
  };

  const inputs = useRef<TextInput[]>([]);

  // SHAKE ANIMATION
  const shakeOffset = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeOffset.value }],
  }));

  const triggerShake = () => {
    shakeOffset.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withRepeat(withTiming(10, { duration: 100 }), 3, true),
      withTiming(0, { duration: 50 })
    );
  };

  // PULSE ANIMATION
  const pulseScale = useSharedValue(1);
  const animatedPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  useEffect(() => {
    pulseScale.value = withRepeat(
      withTiming(1.06, { duration: 1200 }),
      -1,
      true
    );
  }, [pulseScale]);

  const handleChange = (value: string, index: number) => {
    if (otpError) setOtpError(false);
    if (!/^\d?$/.test(value)) { return; }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value) {
      triggerHaptic(HapticFeedbackTypes.selection);
      if (index < 3) {
        inputs.current[index + 1].focus();
      } else {
        const enteredOtp = newOtp.join('');
        if (enteredOtp.length === 4) {
          verifyOtp(enteredOtp);
        }
      }
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      triggerHaptic(HapticFeedbackTypes.impactLight);
      if (!otp[index] && index > 0) {
        inputs.current[index - 1].focus();
      }
    }
  };

  const verifyOtp = (enteredValue?: string) => {
    const enteredOtp = enteredValue || otp.join('');

    if (enteredOtp.length < 4) {
      triggerHaptic(HapticFeedbackTypes.notificationError);
      showAlert({
        title: t('invalid_otp'),
        message: t('enter_complete_otp'),
        singleButton: true,
        icon: 'alert-circle-outline',
      });
      return;
    }

    setIsLoading(true);

    setTimeout(async () => {
      const correctOtp = ride?.otp;
      if (enteredOtp === correctOtp) {
        try {
          // Navigate to verification screen first, startTrip will happen after approval
          setIsLoading(false);
          triggerHaptic(HapticFeedbackTypes.notificationSuccess);
          setIsVerified(true);

          // Instantly advance local state to VERIFICATION_PENDING to prevent banner/navigation issues
          dispatch(setCurrentRide({ ...ride, trip_status: 'VERIFICATION_PENDING' }));

          // Persist OTP verified state locally to prevent modal reopening on app reload
          const tripId = ride?.trip_id || ride?.id;
          if (tripId) {
            AsyncStorage.setItem(`otp_verified_${tripId}`, 'true').catch(e => console.log('Failed to save OTP state:', e));
          }

          // Wait 1.5s to show the "Verified" state before navigating
          setTimeout(() => {
            navigation.replace(VehicleVerificationScreen_Nav, { ride });
          }, 1500);
        } catch (error: any) {
          setIsLoading(false);
          showAlert({
            title: t('common.error'),
            message: error?.data?.message || t('failed_start_trip') || 'Failed to start trip.',
            singleButton: true,
            icon: 'alert-circle-outline',
          });
        }
      } else {
        setIsLoading(false);
        triggerShake();
        triggerHaptic(HapticFeedbackTypes.notificationError);
        setOtpError(true);
      }
    }, 500);
  };

  const isOtpComplete = otp.every(digit => digit !== '');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppStatusBar />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>

          <TouchableOpacity style={styles.closeBtnIcon} onPress={() => setShowTripOptionsModal(!showTripOptionsModal)}>
            <Ionicons name="menu" size={ms(20)} color={isDark ? "#FFF" : "#111827"} />
          </TouchableOpacity>

          {showTripOptionsModal && (
            <View style={{
              position: 'absolute',
              top: vs(54),
              right: ms(16),
              backgroundColor: theme.colors.card,
              borderRadius: ms(12),
              paddingVertical: ms(8),
              width: ms(200),
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 5,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6',
              zIndex: 20
            }}>
              <TouchableOpacity
                style={{ paddingHorizontal: ms(16), paddingVertical: ms(12), flexDirection: 'row', alignItems: 'center' }}
                onPress={() => {
                  setShowTripOptionsModal(false);
                  navigation.navigate(ScheduledRideDetails_Nav, { ride, isLiveRide: true });
                  triggerHaptic(HapticFeedbackTypes.impactLight);
                }}
              >
                <Ionicons name="information-circle-outline" size={ms(18)} color={theme.colors.text} style={{ marginRight: ms(12) }} />
                <Text style={{ fontSize: ms(14), fontWeight: '600', color: theme.colors.text }}>Trip Details</Text>
              </TouchableOpacity>
              <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6', marginVertical: ms(4) }} />
              <TouchableOpacity
                style={{ paddingHorizontal: ms(16), paddingVertical: ms(12), flexDirection: 'row', alignItems: 'center' }}
                onPress={() => {
                  setShowTripOptionsModal(false);
                  navigation.navigate(HelpCenter_Nav);
                  triggerHaptic(HapticFeedbackTypes.impactLight);
                }}
              >
                <Ionicons name="headset-outline" size={ms(18)} color={theme.colors.text} style={{ marginRight: ms(12) }} />
                <Text style={{ fontSize: ms(14), fontWeight: '600', color: theme.colors.text }}>Help Center</Text>
              </TouchableOpacity>

              <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6', marginVertical: ms(4) }} />

              <TouchableOpacity
                style={{ paddingHorizontal: ms(16), paddingVertical: ms(12), flexDirection: 'row', alignItems: 'center' }}
                onPress={() => {
                  setShowTripOptionsModal(false);
                  setShowCancelModal(true);
                }}
              >
                <Ionicons name="trash-outline" size={ms(18)} color={theme.colors.error} style={{ marginRight: ms(12) }} />
                <Text style={{ fontSize: ms(14), fontWeight: '600', color: theme.colors.error }}>{t('cancel_trip') || 'Cancel Trip'}</Text>
              </TouchableOpacity>
            </View>
          )}

          <Image source={require('../../assets/images/tripotptop.png')} style={styles.topImage} />

          <View style={styles.contentContainer}>
            <Text style={styles.mainTitle} numberOfLines={1} adjustsFontSizeToFit>
              <Text style={{ color: theme.colors.text }}>You've reached the </Text>
              <Text style={{ color: theme.colors.primary }}>pickup </Text>
              <Text style={{ color: theme.colors.text }}>location!</Text>
            </Text>

            <Text style={styles.subTitle}>
              Please ask the rider for the 4-digit OTP to confirm{'\n'}the pickup and start the trip.
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: vs(12) }}>
              <Text style={[styles.enterOtpText, { color: theme.colors.text, marginBottom: 0 }]}>Enter 4-digit OTP</Text>
              <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: ms(10), paddingVertical: vs(4), borderRadius: ms(12) }}>
                <Text style={{ color: theme.colors.text, fontSize: ms(12), fontWeight: '700' }}>
                  Verify OTP : <Text style={{ color: '#10B981' }}>{ride?.otp}</Text>
                </Text>
              </View>
            </View>

            {/* OTP SECTION */}
            <View style={styles.otpSection}>
              <Animated.View style={[styles.otpRow, animatedStyle]}>
                {otp.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => {
                      if (ref) { inputs.current[index] = ref; }
                    }}
                    style={[
                      styles.otpBox,
                      {
                        backgroundColor: 'transparent',
                        color: theme.colors.primary,
                        borderColor: otpError ? theme.colors.error : (focusedIndex === index ? theme.colors.primary : (isDark ? 'rgba(255,255,255,0.15)' : '#D1D5DB')),
                        borderWidth: 1,
                      }
                    ]}
                    keyboardType="number-pad"
                    maxLength={1}
                    value={digit}
                    onFocus={() => setFocusedIndex(index)}
                    onBlur={() => setFocusedIndex(null)}
                    onChangeText={(val) => handleChange(val, index)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    selectionColor={theme.colors.primary}
                    underlineColorAndroid="transparent"
                    editable={!isLoading}
                  />
                ))}
              </Animated.View>
            </View>

            {/* OTP STATUS SECTION */}
            <View style={{ height: vs(32), justifyContent: 'center', alignItems: 'center', marginTop: vs(8) }}>
              {isVerified ? (
                <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(200)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="checkmark-circle" size={ms(20)} color="#10B981" />
                  <Text style={{ color: '#10B981', fontSize: ms(14), fontWeight: '700', marginLeft: ms(6), marginRight: ms(8) }}>OTP Successfully Verified!</Text>
                  <ActivityIndicator size="small" color="#10B981" />
                </Animated.View>
              ) : isLoading ? (
                <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                  <Text style={{ color: theme.colors.text, fontSize: ms(13), fontWeight: '500', marginLeft: ms(8) }}>Verifying...</Text>
                </Animated.View>
              ) : otpError ? (
                <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: theme.colors.error, fontSize: ms(13), fontWeight: '600', marginRight: ms(8) }}>Incorrect OTP</Text>
                  <TouchableOpacity onPress={() => {
                    setOtp(['', '', '', '']);
                    setOtpError(false);
                    inputs.current[0]?.focus();
                  }}>
                    <Text style={{ color: theme.colors.primary, fontSize: ms(13), fontWeight: '700' }}>Retry</Text>
                  </TouchableOpacity>
                </Animated.View>
              ) : null}
            </View>

            {/* Rider Info Card */}
            <View style={[styles.riderCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF', padding: ms(12), borderRadius: ms(16), elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, width: '100%', flexDirection: 'column' }]}>

              <View style={{ flexDirection: 'row', alignItems: 'flex-start', width: '100%' }}>

                {/* Left Side: Profile */}
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', flex: 1.1 }}>
                  {resolveImageUrl(ride?.passenger_details?.image || ride?.passenger_details?.profile_picture || ride?.user_details?.profile_url || ride?.user_details?.profile_picture || ride?.riderImage || ride?.customer?.profile_url || ride?.customer?.profile_picture || ride?.customer?.image) ? (
                    <Image source={{ uri: resolveImageUrl(ride?.passenger_details?.image || ride?.passenger_details?.profile_picture || ride?.user_details?.profile_url || ride?.user_details?.profile_picture || ride?.riderImage || ride?.customer?.profile_url || ride?.customer?.profile_picture || ride?.customer?.image) }} style={{ width: ms(40), height: ms(40), borderRadius: ms(20) }} />
                  ) : (
                    <View style={{ width: ms(40), height: ms(40), borderRadius: ms(20), backgroundColor: theme.colors.primary + '15', justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={[styles.riderAvatarText, { color: theme.colors.primary, fontSize: ms(14) }]}>
                        {getInitials(ride.user_details?.full_name || ride.passenger_details?.name || ride.passenger || 'Passenger')}
                      </Text>
                    </View>
                  )}

                  <View style={{ flex: 1, marginLeft: ms(10) }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[styles.riderName, { color: theme.colors.text, fontSize: ms(14), fontWeight: '700' }]} numberOfLines={1} adjustsFontSizeToFit>
                        {ride.user_details?.full_name || ride.passenger_details?.name || ride.passenger || 'Passenger'}
                      </Text>
                      <Ionicons name="checkmark-circle" size={ms(14)} color="#3B82F6" style={{ marginLeft: ms(4) }} />
                    </View>

                    {/* Stats Section */}
                    {ride.last_message ? (
                      <>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: vs(2) }}>
                          <Ionicons name="star" size={ms(12)} color="#F59E0B" />
                          <Text style={[styles.riderRatingText, { color: theme.colors.text, fontWeight: '700', marginLeft: ms(2), fontSize: ms(11) }]}>
                            {Number(ride.rating ?? ride.passenger_details?.rating ?? 4.8).toFixed(1)}
                          </Text>
                          <View style={{ width: 1, height: ms(10), backgroundColor: isDark ? '#4B5563' : '#D1D5DB', marginHorizontal: ms(6) }} />
                          <Text style={[styles.riderRidesText, { color: '#6B7280', fontSize: ms(11) }]} numberOfLines={1}>
                            ({ride.user_details?.total_reviews || 0} reviews)
                          </Text>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: vs(2) }}>
                          <Ionicons name="car-outline" size={ms(12)} color="#6B7280" />
                          <Text style={[styles.riderRidesText, { color: '#6B7280', marginLeft: ms(2), fontSize: ms(11) }]} numberOfLines={1}>
                            <Text style={{ color: theme.colors.text, fontWeight: '700' }}>{ride.user_details?.total_rides || 0}</Text> Total Rides
                          </Text>
                        </View>
                      </>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: vs(2) }}>
                        <Ionicons name="star" size={ms(12)} color="#F59E0B" />
                        <Text style={[styles.riderRatingText, { color: theme.colors.text, fontWeight: '700', marginLeft: ms(2), fontSize: ms(11) }]}>
                          {Number(ride.rating ?? ride.passenger_details?.rating ?? 4.8).toFixed(1)}
                        </Text>
                        <View style={{ width: 1, height: ms(10), backgroundColor: isDark ? '#4B5563' : '#D1D5DB', marginHorizontal: ms(6) }} />
                        <Text style={[styles.riderRidesText, { color: '#6B7280', fontSize: ms(11) }]} numberOfLines={1}>
                          ({ride.user_details?.total_reviews || 0} reviews)
                        </Text>

                        <View style={{ width: 1, height: ms(10), backgroundColor: isDark ? '#4B5563' : '#D1D5DB', marginHorizontal: ms(6) }} />
                        <Ionicons name="car-outline" size={ms(12)} color="#6B7280" />
                        <Text style={[styles.riderRidesText, { color: '#6B7280', marginLeft: ms(2), fontSize: ms(11) }]} numberOfLines={1}>
                          <Text style={{ color: theme.colors.text, fontWeight: '700' }}>{ride.user_details?.total_rides || 0}</Text> Total Rides
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Message Section (Only shown if last_message exists) */}
                {ride.last_message && (
                  <>
                    {/* Vertical Divider */}
                    <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: isDark ? '#4B5563' : '#E5E7EB', marginHorizontal: ms(8) }} />

                    {/* Right Side: Chat Bubble */}
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start' }}>
                      <View style={{
                        backgroundColor: '#3B82F6',
                        borderRadius: ms(10),
                        width: ms(20),
                        height: ms(20),
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: ms(6),
                        marginTop: vs(2)
                      }}>
                        <Ionicons name="chatbubble-ellipses" size={ms(12)} color="#FFFFFF" />
                      </View>

                      <View style={{
                        backgroundColor: isDark ? '#1F2937' : '#F4F6F9',
                        padding: ms(8),
                        borderRadius: ms(12),
                        borderTopLeftRadius: 0,
                        flex: 1
                      }}>
                        <Text style={{ color: theme.colors.text, fontSize: ms(11), lineHeight: vs(14) }}>
                          "{ride.last_message}"
                        </Text>
                        <Text style={{ color: '#9CA3AF', fontSize: ms(9), textAlign: 'right', marginTop: vs(4) }}>
                          {ride.last_message_time || 'Just now'}
                        </Text>
                      </View>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: vs(16) }}>
              {/* Message */}
              <TouchableOpacity style={{ flex: 1, backgroundColor: '#ECFDF5', paddingVertical: vs(12), borderRadius: ms(12), alignItems: 'center', marginRight: ms(4) }} onPress={() => {
                navigation.navigate(ChatScreen_Nav, {
                  rideId: ride.trip_id || ride.id,
                  userId: user?.driverId,
                  userName: ride.passenger_details?.name || ride.user_details?.full_name || ride.user_details?.first_name || ride.passenger || ride.passenger_name || ride.customer?.name || t('rider'),
                  userImage: ride.passenger_details?.image || ride.riderImage,
                  userPhone: ride.phone || ride.riderPhone || ride.user_phone || ride.customer?.phone || ride.customer?.phone_number || ride.passenger_phone || ride.user_details?.phone_number || ride.user_details?.phone || ride.passenger_details?.phone || ride.passenger_details?.phone_number,
                });
                triggerHaptic(HapticFeedbackTypes.impactLight);
              }}>
                <Ionicons name="chatbubble-ellipses" size={ms(18)} color="#10B981" />
                <Text style={{ color: '#10B981', fontSize: ms(10), fontWeight: '700', marginTop: vs(4) }} numberOfLines={1} adjustsFontSizeToFit>Message</Text>
              </TouchableOpacity>

              {/* Call */}
              <TouchableOpacity style={{ flex: 1, backgroundColor: '#EFF6FF', paddingVertical: vs(12), borderRadius: ms(12), alignItems: 'center', marginHorizontal: ms(4) }} onPress={() => {
                const phoneNumber = ride.phone || ride.riderPhone || ride.user_phone || ride.customer?.phone || ride.customer?.phone_number || ride.passenger_phone || ride.user_details?.phone_number || ride.user_details?.phone || ride.passenger_details?.phone || ride.passenger_details?.phone_number || '';
                if (phoneNumber) {
                  Linking.openURL(`tel:${phoneNumber}`);
                } else {
                  showToast({ message: t('phone_number_not_found') || 'Phone number not available', type: 'error' });
                }
                triggerHaptic(HapticFeedbackTypes.impactMedium);
              }}>
                <Ionicons name="call" size={ms(18)} color="#3B82F6" />
                <Text style={{ color: '#3B82F6', fontSize: ms(10), fontWeight: '700', marginTop: vs(4) }} numberOfLines={1} adjustsFontSizeToFit>Call</Text>
              </TouchableOpacity>

              {/* Open Location */}
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#F3F4F6', paddingVertical: vs(12), borderRadius: ms(12), alignItems: 'center', marginHorizontal: ms(4) }}
                onPress={() => {
                  const pickupLat = parseFloat(ride.pickup_lat?.toString() || "0");
                  const pickupLng = parseFloat(ride.pickup_lng?.toString() || "0");
                  if (pickupLat && pickupLng) {
                    const url = `https://www.google.com/maps/dir/?api=1&destination=${pickupLat},${pickupLng}&travelmode=driving`;
                    Linking.openURL(url).catch(err => {
                      console.error("Failed to open Google Maps", err);
                      showToast({ message: t('failed_to_open_maps') || 'Failed to open maps', type: 'error' });
                    });
                  } else {
                    showToast({ message: t('location_not_ready') || 'Location not available', type: 'error' });
                  }
                  triggerHaptic(HapticFeedbackTypes.impactMedium);
                }}
              >
                <Ionicons name="navigate" size={ms(18)} color="#374151" />
                <Text style={{ color: '#374151', fontSize: ms(10), fontWeight: '700', marginTop: vs(4) }} numberOfLines={1} adjustsFontSizeToFit>Open Location</Text>
              </TouchableOpacity>

              {/* Share Trip */}
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#F5F3FF', paddingVertical: vs(12), borderRadius: ms(12), alignItems: 'center', marginLeft: ms(4) }}
                onPress={async () => {
                  try {
                    const pickupAddress = ride.pickup_address || ride.pickup || 'the pickup location';
                    const riderName = ride.user_details?.full_name || ride.passenger_details?.name || ride.passenger || 'Passenger';
                    const tripId = ride.trip_id || ride.id || 'Unknown';

                    const message = `I am on my way to pick up ${riderName} at ${pickupAddress}. (Trip ID: ${tripId})`;

                    await Share.share({
                      message,
                      title: 'Trip Details',
                    });
                    triggerHaptic(HapticFeedbackTypes.impactMedium);
                  } catch (error) {
                    console.error("Error sharing trip:", error);
                    showToast({ message: t('failed_to_share') || 'Failed to share trip', type: 'error' });
                  }
                }}
              >
                <Ionicons name="share-social" size={ms(18)} color="#6D28D9" />
                <Text style={{ color: '#6D28D9', fontSize: ms(10), fontWeight: '700', marginTop: vs(4) }} numberOfLines={1} adjustsFontSizeToFit>Share Trip</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      <CancellationModal
        isVisible={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancelTrip}
        isSubmitting={isCancelling}
      />
    </SafeAreaView>
  );
};

export default PickupOTPScreen;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: ms(20),
  },
  keyboardView: {
    width: '100%',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
    width: '100%',
    padding: 0,
    overflow: 'hidden',
  },
  sheetHandle: {
    width: ms(40),
    height: vs(4),
    backgroundColor: '#D1D5DB',
    borderRadius: ms(2),
    alignSelf: 'center',
    marginTop: vs(12),
    position: 'absolute',
    top: 0,
    zIndex: 10,
  },
  closeBtnIcon: {
    position: 'absolute',
    top: vs(16),
    right: ms(16),
    width: ms(32),
    height: ms(32),
    borderRadius: ms(16),
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  topImage: {
    width: '100%',
    height: vs(180),
    marginTop: vs(24),
    resizeMode: 'contain',
  },
  contentContainer: {
    paddingHorizontal: ms(24),
    paddingBottom: ms(24),
    paddingTop: ms(16),
  },
  mainTitle: {
    fontSize: ms(22),
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: vs(8),
  },
  subTitle: {
    fontSize: ms(14),
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: vs(20),
    marginBottom: vs(20),
  },
  riderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: ms(16),
    borderRadius: ms(16),
    marginBottom: vs(20),
  },
  riderAvatarBox: {
    width: ms(48),
    height: ms(48),
    borderRadius: ms(24),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: ms(12),
  },
  riderAvatar: {
    width: ms(48),
    height: ms(48),
    borderRadius: ms(24),
    marginRight: ms(12),
  },
  riderAvatarText: {
    fontSize: ms(16),
    fontWeight: '800',
  },
  riderName: {
    fontSize: ms(16),
    fontWeight: '800',
  },
  riderRatingText: {
    fontSize: ms(13),
    fontWeight: '700',
    marginLeft: ms(4),
  },
  riderRidesText: {
    fontSize: ms(13),
    fontWeight: '500',
  },
  riderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(16),
  },
  actionBtn: {
    alignItems: 'center',
  },
  actionIconCircle: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(18),
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: vs(4),
  },
  actionText: {
    fontSize: ms(11),
    fontWeight: '600',
    color: '#4B5563',
  },
  enterOtpText: {
    fontSize: ms(15),
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: vs(10),
  },
  otpSection: {
    marginVertical: vs(4),
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: ms(12),
  },
  otpBox: {
    width: ms(52),
    height: ms(56),
    borderRadius: ms(12),
    textAlign: 'center',
    fontSize: ms(24),
    fontWeight: '800',
  },
  confirmBtn: {
    height: vs(54),
    borderRadius: ms(27),
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: vs(20),
  },
  confirmBtnText: {
    color: '#FFF',
    fontSize: ms(16),
    fontWeight: '800',
  },
  /* Helper Modal Styles (Reused from previous) */
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: vs(16),
    borderBottomWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    gap: ms(12),
  },
  modalTitle: {
    fontSize: ms(20),
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  modalOptionText: {
    fontSize: ms(15),
    fontWeight: '700',
  },
  modalCloseBtn: {
    width: '100%',
    paddingVertical: vs(16),
    borderRadius: ms(20),
    alignItems: 'center',
    marginTop: vs(10),
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  modalCloseText: {
    color: '#FFF',
    fontSize: ms(16),
    fontWeight: '800',
  },
  /* Modern Help Modal Styles */
  modalIndicator: {
    width: ms(40),
    height: vs(5),
    borderRadius: ms(3),
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: vs(15),
  },
  modalHeaderInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(24),
  },
  helpCloseIconBtn: {
    padding: ms(8),
    borderRadius: ms(20),
  },
  helpOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: ms(16),
    borderRadius: ms(20),
    marginBottom: vs(12),
  },
  optionIconBox: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(12),
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionInfo: {
    flex: 1,
    marginLeft: ms(16),
  },
  optionTitle: {
    fontSize: ms(16),
    fontWeight: '800',
    marginBottom: vs(2),
  },
  optionDescription: {
    fontSize: ms(13),
    opacity: 0.6,
  },
  optionDivider: {
    height: 1.5,
    marginVertical: vs(12),
    opacity: 0.1,
  },
});
