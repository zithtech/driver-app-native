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
import { VehicleVerificationScreen_Nav } from '../../Navigations/navigations';
import { useStartTripMutation, useCancelTripMutation } from '../../service/driverApi';
import { clearAcceptedRide } from '../../redux/rideSlice';
import { CancellationModal } from '../../Components';
import socketService from '../../service/socketService';
import audioService from '../../utils/audioService';
import { StackActions } from '@react-navigation/native';

const DEMO_OTP = '1234';

const HelpModal = ({ showHelpModal, setShowHelpModal, theme, t, triggerHaptic, setShowCancelModal, showAlert }: any) => {
  const isDark = theme.dark;

  const OptionCard = ({ icon, color, title, subtitle, onPress, isDanger = false }: any) => (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[
        styles.helpOptionCard,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F9FAFB',
          borderColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
          borderWidth: 1.5,
        }
      ]}
      onPress={onPress}
    >
      <View style={[styles.optionIconBox, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={ms(20)} color={color} />
      </View>
      <View style={styles.optionInfo}>
        <Text style={[styles.optionTitle, { color: isDanger ? theme.colors.error : theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
          {title}
        </Text>
        <Text style={[styles.optionDescription, { color: theme.colors.paragraphText }]}>
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={ms(16)} color={theme.colors.border} />
    </TouchableOpacity>
  );

  return (
    <Modal
      transparent
      visible={showHelpModal}
      animationType="none"
      onRequestClose={() => setShowHelpModal(false)}
    >
      <Animated.View
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(300)}
        style={styles.modalOverlay}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setShowHelpModal(false)}
        />
        <Animated.View
          entering={SlideInDown.springify().damping(25).stiffness(200)}
          exiting={SlideOutDown.duration(250)}
          style={[styles.modalContent, { backgroundColor: theme.colors.card }]}
        >
          <View style={styles.modalIndicator} />

          <View style={styles.modalHeaderInner}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
              {t('help_options')}
            </Text>
            <TouchableOpacity
              style={[styles.helpCloseIconBtn, { backgroundColor: theme.colors.border + '30' }]}
              onPress={() => setShowHelpModal(false)}
            >
              <Ionicons name="close" size={ms(20)} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: vs(20) }}>
            <OptionCard
              icon="call-outline"
              color="#10B981"
              title={t('call_passenger')}
              subtitle={t('calling_passenger_msg') || 'Reach out directly via phone'}
              onPress={() => {
                setShowHelpModal(false);
                showAlert({
                  title: t('call_passenger'),
                  message: t('calling_passenger_msg'),
                  singleButton: true,
                  icon: 'call-outline',
                });
                triggerHaptic(HapticFeedbackTypes.impactMedium);
              }}
            />

            <OptionCard
              icon="headset-outline"
              color={theme.colors.primary}
              title={t('contact_support')}
              subtitle={t('support_msg') || 'Get assistance from our 24/7 team'}
              onPress={() => {
                setShowHelpModal(false);
                showAlert({
                  title: t('contact_support'),
                  message: t('support_msg'),
                  singleButton: true,
                  icon: 'headset-outline',
                });
                triggerHaptic(HapticFeedbackTypes.impactMedium);
              }}
            />

            <OptionCard
              icon="information-circle-outline"
              color={theme.colors.primary}
              title={t('passenger_no_otp')}
              subtitle={t('check_otp_passenger') || 'Troublesome OTP verification'}
              onPress={() => {
                setShowHelpModal(false);
                showAlert({
                  title: t('passenger_no_otp'),
                  message: t('check_otp_passenger'),
                  singleButton: true,
                  icon: 'information-circle-outline',
                });
                triggerHaptic(HapticFeedbackTypes.notificationWarning);
              }}
            />

            <View style={[styles.optionDivider, { backgroundColor: theme.colors.border }]} />

            <OptionCard
              icon="trash-outline"
              color={theme.colors.error}
              title={t('cancel_trip')}
              subtitle={t('cancel_trip_description') || 'Cancel the current booking'}
              onPress={() => {
                setShowHelpModal(false);
                setShowCancelModal(true);
                triggerHaptic(HapticFeedbackTypes.impactMedium);
              }}
              isDanger
            />
          </ScrollView>

          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.modalCloseBtn, { backgroundColor: theme.colors.primary }]}
            onPress={() => setShowHelpModal(false)}
          >
            <Text style={styles.modalCloseText} numberOfLines={1} adjustsFontSizeToFit>{t('close')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

interface PickupOTPModalProps {
  isVisible: boolean;
  onClose: () => void;
  ride?: any;
}

const PickupOTPModal = ({ isVisible, onClose, ride: rideFromProps }: PickupOTPModalProps) => {
  const rideFromStore = useSelector((state: RootState) => state.ride.currentRide);
  const ride = rideFromProps || rideFromStore || {};
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { theme, isDark } = useAppTheme();
  const { showAlert, hideAlert } = useAlert();
  const { triggerHaptic } = useHaptic();
  const dispatch = useDispatch();

  // 🛡️ Guard: Exit modal if ride is cleared from Redux (e.g. by global cancellation)
  useEffect(() => {
    if (!rideFromStore && isVisible) {
      console.log('[PickupOTPModal] Active ride cleared from Redux, closing...');
      onClose();
    }
  }, [rideFromStore, isVisible, onClose]);

  const getInitials = (name: string) => {
    if (!name) return 'P';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 0) return 'P';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + (parts[parts.length - 1][0] || '')).toUpperCase();
  };





  const [otp, setOtp] = useState(['', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

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
        onClose();
        dispatch(clearAcceptedRide());
        navigation.replace('DashboardScreen');
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
          onClose(); // Close OTP modal
          dispatch(clearAcceptedRide());
          navigation.dispatch(StackActions.replace('DashboardScreen'));
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
      const correctOtp = ride?.otp || DEMO_OTP;
      if (enteredOtp === correctOtp) {
        try {
          // Navigate to verification screen first, startTrip will happen after approval
          setIsLoading(false);
          triggerHaptic(HapticFeedbackTypes.notificationSuccess);
          setIsVerified(true);

          // Wait 1.5s to show the "Verified" state before navigating
          setTimeout(() => {
            onClose();
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
        setOtp(['', '', '', '']);
        inputs.current[0].focus();
        showAlert({
          title: t('incorrect_otp'),
          message: t('check_otp_passenger'),
          singleButton: true,
          icon: 'close-circle-outline',
        });
      }
    }, 500);
  };

  const isOtpComplete = otp.every(digit => digit !== '');

  return (
    <Modal
      visible={isVisible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <Pressable style={[styles.modalContent, { backgroundColor: theme.colors.card }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitleText, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{t('verify_pickup_otp')}</Text>
                <Text style={[styles.modalSubtitleText, { color: theme.colors.paragraphText }]}>{t('ask_otp')}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowHelpModal(true)}>
                <Ionicons name="help-circle-outline" size={ms(24)} color={theme.colors.paragraphText} />
              </TouchableOpacity>
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
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
                        color: theme.colors.text,
                        borderColor: focusedIndex === index ? theme.colors.primary : 'transparent',
                        borderWidth: 2,
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

            {/* RIDER INFO */}
            <View style={[styles.riderSummary, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F9FAFB' }]}>
              {ride.user_details?.profile_url ? (
                <Image 
                  source={{ uri: ride.user_details.profile_url }} 
                  style={styles.avatarImage} 
                />
              ) : (
                <View style={[styles.avatarBox, { backgroundColor: theme.colors.primary + '15' }]}>
                  <Text style={[styles.avatarText, { color: theme.colors.primary }]}>
                    {getInitials(ride.user_details?.full_name || ride.passenger_details?.name || ride.passenger || 'Passenger')}
                  </Text>
                </View>
              )}
              <View style={styles.riderInfoContainer}>
                 <Text style={[styles.riderNameText, { color: theme.colors.text }]} numberOfLines={1}>
                  {ride.user_details?.full_name || ride.passenger_details?.name || ride.passenger || 'Passenger'}
                </Text>
                {ride.trip_code && (
                  <Text style={[styles.tripCodeText, { color: theme.colors.paragraphText }]}>
                    #{ride.trip_code}
                  </Text>
                 )}
              </View>
            </View>

            <TouchableOpacity
              disabled={!isOtpComplete || isLoading || isVerified}
              style={[
                styles.confirmBtn,
                { backgroundColor: theme.colors.primary },
                (!isOtpComplete || isLoading) && !isVerified && { backgroundColor: theme.colors.border },
                isVerified && { backgroundColor: theme.colors.success }
              ]}
              onPress={() => verifyOtp()}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : isVerified ? (
                <Ionicons name="checkmark-circle" size={ms(24)} color="#FFF" />
              ) : (
                <Text style={styles.confirmBtnText} numberOfLines={1} adjustsFontSizeToFit>{t('confirm_pickup_btn')}</Text>
              )}
            </TouchableOpacity>

            {!isVerified && !isLoading && (
              <TouchableOpacity
                style={styles.skipBtn}
                onPress={() => verifyOtp(ride?.otp || DEMO_OTP)}
              >
                <Text style={[styles.skipBtnText, { color: theme.colors.primary }]} numberOfLines={1} adjustsFontSizeToFit>
                  {t('skip_verification') || 'Skip for testing'}
                </Text>
              </TouchableOpacity>
            )}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>

      <HelpModal
        showHelpModal={showHelpModal}
        setShowHelpModal={setShowHelpModal}
        theme={theme}
        t={t}
        triggerHaptic={triggerHaptic}
        setShowCancelModal={setShowCancelModal}
        showAlert={showAlert}
      />
      <CancellationModal
        isVisible={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancelTrip}
        isSubmitting={isCancelling}
      />
    </Modal>
  );
};

export default PickupOTPModal;

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
    width: '100%',
    borderRadius: ms(28),
    padding: ms(24),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: vs(15),
  },
  modalTitleText: {
    fontSize: ms(20),
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  modalSubtitleText: {
    fontSize: ms(13),
    marginTop: vs(2),
    opacity: 0.7,
  },
  otpSection: {
    marginVertical: vs(10),
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: ms(10),
  },
  otpBox: {
    width: ms(54),
    height: ms(58),
    borderRadius: ms(16),
    textAlign: 'center',
    fontSize: ms(24),
    fontWeight: '800',
  },
  riderSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: ms(12),
    borderRadius: ms(16),
    marginVertical: vs(15),
  },
  avatarBox: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(22),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: ms(12),
  },
  avatarImage: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(22),
    marginRight: ms(12),
  },
  avatarText: {
    fontSize: ms(16),
    fontWeight: '800',
  },
  riderInfoContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: ms(6),
  },
  riderNameText: {
    fontSize: ms(16),
    fontWeight: '800',
  },
  tripCodeText: {
    fontSize: ms(13),
    fontWeight: '600',
    opacity: 0.7,
  },
  confirmBtn: {
    height: vs(54),
    borderRadius: ms(18),
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: vs(10),
  },
  confirmBtnText: {
    color: '#FFF',
    fontSize: ms(16),
    fontWeight: '800',
  },
  skipBtn: {
    marginTop: vs(15),
    alignItems: 'center',
    padding: ms(10),
  },
  skipBtnText: {
    fontSize: ms(13),
    fontWeight: '700',
    textDecorationLine: 'underline',
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
