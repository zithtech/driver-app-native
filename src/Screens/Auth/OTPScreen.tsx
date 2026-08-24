import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Animated,
  Platform,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Image,
  ScrollView,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Reanimated, {
  FadeInDown,
  FadeInUp,
  FadeInLeft,
  useAnimatedStyle,
  withSpring,
  withTiming,
  useSharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import { useAppTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useHaptic } from '../../hooks/useHaptic';

import { OTPInput } from '../../Components';
import Button from '../../Components/Button';
import { useToast } from '../../context/ToastContext';

import { useVerifyOtpMutation, useSendOtpMutation } from '../../service/userApi';
import { RootState } from '../../redux/store';
import { setUser } from '../../redux/userSlice';
import { getDeviceId } from '../../service/utils/device';
import { storage } from '../../service/utils/storage';
import AppStatusBar from '../../Components/AppStatusBar';



import { HelpCenter_Nav } from '../../Navigations/navigations';

const { width: _SCREEN_WIDTH } = Dimensions.get('window');




/* ================= CONSTANTS ================= */
const RESEND_TIME = 30;


const OTPScreen = ({ navigation }: any) => {
  const { colors: navColors, fonts } = useTheme() as any;
  const { theme, isDark: dark } = useAppTheme();
  const colors = theme.colors;
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { showToast } = useToast();

  const user = useSelector((state: RootState) => state.userSlice.user);

  const [otp, setOtp] = useState('');
  const [deviceId, setDeviceId] = useState<string | null>(null);

  const [resendTimer, setResendTimer] = useState(RESEND_TIME);
  const [canResend, setCanResend] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutMessage, setLockoutMessage] = useState('');

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useSharedValue(1);
  const successScale = useSharedValue(1);
  const successOpacity = useSharedValue(0);
  const processingRef = useRef(false);

  const [verifyOtp, { isLoading }] = useVerifyOtpMutation();
  const [sendOtp, { isLoading: isResending }] = useSendOtpMutation();
  const { triggerHaptic } = useHaptic();

  /* ================= LOAD DEVICE ID ================= */
  useEffect(() => {
    const loadDeviceId = async () => {
      const id = await getDeviceId();
      setDeviceId(id);
    };
    loadDeviceId();
  }, []);

  /* ================= RESEND TIMER ================= */
  useEffect(() => {
    if (resendTimer <= 0) {
      setCanResend(true);
      return;
    }

    const interval = setInterval(() => {
      setResendTimer(prev => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [resendTimer]);



  /* ================= ANIMATIONS ================= */
  const triggerShake = useCallback(() => {
    triggerHaptic(HapticFeedbackTypes.notificationError);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [triggerHaptic, shakeAnim]);

  const btnAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const successIconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: withSpring(successScale.value, { damping: 12, stiffness: 100 }) }
    ],
  }));

  const successTextStyle = useAnimatedStyle(() => ({
    opacity: successOpacity.value,
    transform: [{ translateY: withTiming(successOpacity.value === 1 ? 0 : 10) }],
  }));

  /* ================= VERIFY OTP ================= */
  const handleContinue = useCallback(async () => {
    if (isLoading || showSuccess || processingRef.current) { return; }
    if (!user?.phone_number) {
      showToast({ message: t('phone_missing'), type: 'error' });
      return;
    }

    if (otp.length !== 6) {
      setHasError(true);
      triggerShake();
      return;
    }

    if (!deviceId) {
      showToast({ message: t('device_initializing'), type: 'info' });
      return;
    }

    try {
      processingRef.current = true;
      buttonScale.value = withSpring(0.95, {}, () => {
        buttonScale.value = withSpring(1);
      });

      const res = await verifyOtp({
        phone_number: user.phone_number,
        role: 'driver',
        otp,
        device_id: deviceId,
        allow_new_device: true,
        referred_by: user.referred_by, // Pass the referral code from Redux
      }).unwrap();

      // 🛡️ Robust Response Parsing: Handle both nested { data: { ... } } and flat response structures
      const responseData = res?.data || res;

      if (responseData && (responseData.accessToken || responseData.userData)) {
        console.log('[OTPScreen] ✅ Verify OTP response processed:', JSON.stringify(responseData));

        if (responseData.accessToken) {
          await storage.setAccessToken(responseData.accessToken);
        }
        if (responseData.refreshToken) {
          await storage.setRefreshToken(responseData.refreshToken);
        }

        // Resolve driverId: backend may return it under many possible keys
        const resolvedDriverId =
          responseData.userData?.driverId ||
          responseData.userData?.driver_id ||
          responseData.userData?.id ||
          responseData.driverId ||
          responseData.driver_id ||
          responseData.id;

        if (resolvedDriverId) {
          await storage.setDriverId(resolvedDriverId);
        }

        console.log('[OTPScreen] Resolved driverId:', resolvedDriverId || 'NULL');

        // Success! Trigger Animation
        triggerHaptic(HapticFeedbackTypes.notificationSuccess);
        setShowSuccess(true);
        successScale.value = 1.2;
        successOpacity.value = 1;

        // 🛡️ DELAYED TRANSITION: Wait 1.5s to show the "Success" state before updating global auth
        setTimeout(() => {
          dispatch(
            setUser({
              ...responseData.userData,
              accessToken: responseData.accessToken,
              refreshToken: responseData.refreshToken,
              driverId: resolvedDriverId,
              device_id: responseData.userData?.device_id || responseData.device_id,
              onboarding_status: responseData.onboarding_status || responseData.userData?.onboarding_status,
              isLoggedIn: true,
              isOnline: false,
              driverStatus: 'OFFLINE' as const,
              // 🛡️ PRESERVE LANGUAGE: Prioritize locally selected language if backend has none or default
              language: user?.language || responseData.userData?.language,
            })
          );
        }, 2000);

      } else {
        // Response succeeded but didn't contain auth data
        console.error('[OTPScreen] ❌ Success response missing Auth Data:', res);
        throw new Error('Verification succeeded but no session data received.');
      }
    } catch (err: any) {
      triggerShake();
      const errMsg = err?.data?.message || err?.message || t('invalid_otp_toast');

      // 🛡️ Lockout Detection:
      const lockedKeywords = ['locked', 'too many failed', 'try again after'];
      const isLockoutError = lockedKeywords.some(keyword =>
        errMsg.toLowerCase().includes(keyword)
      );

      if (isLockoutError) {
        setIsLocked(true);
        setLockoutMessage(errMsg);
        setOtp(''); // Clear OTP on lockout
      } else {
        setHasError(true);
      }

      showToast({ message: errMsg, type: 'error' });
    } finally {
      processingRef.current = false;
    }
  }, [user, otp, deviceId, verifyOtp, t, buttonScale, successScale, successOpacity, triggerHaptic, triggerShake, dispatch]);


  /* ================= AUTO-VERIFY ================= */
  useEffect(() => {
    // 🛡️ Guard against infinite loops: Only auto-verify if not loading, no current error, and not locked.
    if (otp.length === 6 && !isLoading && !hasError && !isLocked && !processingRef.current) {
      handleContinue();
    }
  }, [otp, isLoading, hasError, isLocked, handleContinue]);

  /* ================= RESEND ================= */
  const handleResend = async () => {
    if (!canResend || isResending || !user?.phone_number || !deviceId) { return; }

    try {
      const result = await sendOtp({
        phone_number: user.phone_number,
        role: 'driver',
        device_id: deviceId,
        allow_new_device: true,
      }).unwrap();

      const newOtp = result?.otp || result?.data?.otp || '';
      if (newOtp) {
        dispatch(setUser({ otp: newOtp }));
      }

      setResendTimer(RESEND_TIME);
      setCanResend(false);
      setOtp('');
      setHasError(false);
      showToast({ message: t('otp_resent'), type: 'success' });
      triggerHaptic(HapticFeedbackTypes.impactLight);
    } catch (err: any) {
      const resendErrMsg = err?.data?.message || err?.message || t('otp_resend_fail');
      showToast({ message: resendErrMsg, type: 'error' });
    }
  };

  /* ================= UI COMPONENTS ================= */

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: '#FFFFFF' }}
      edges={['top', 'bottom']}
    >
      <AppStatusBar />

      {/* FLOATING HEADER BUTTONS */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <MaterialCommunityIcons name="chevron-left" size={26} color="#000" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate(HelpCenter_Nav)}
          style={styles.helpButton}
        >
          <Ionicons name="help-circle-outline" size={16} color={colors.primary} />
          <Text style={[fonts.medium, { color: '#000', fontSize: 13, marginLeft: 4 }]}>Help</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: 120, paddingBottom: 20 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.cardContainer}>
            {/* PHONE ICON BADGE */}
            <View style={styles.badgeContainer}>
              <View style={styles.badgeCircle}>
                <MaterialCommunityIcons name="cellphone" size={24} color={colors.primary} />
                <View style={styles.badgeCheck}>
                  <MaterialCommunityIcons name="check-circle" size={16} color="#10B981" />
                </View>
              </View>
            </View>

            <View style={styles.cardContent}>
              <Text style={[fonts.bold, { fontSize: 18, color: '#000', textAlign: 'center' }]}>
                OTP sent successfully!
              </Text>
              <Text style={[fonts.medium, { fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: 4 }]}>
                We've sent a 6-digit OTP to
              </Text>

              <View style={styles.phoneContainer}>
                <Text style={[fonts.bold, { fontSize: 16, color: '#3B82F6', fontWeight: 'bold' }]}>
                  +91 {user?.phone_number || '98765 43210'}
                </Text>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.editButton}>
                  <MaterialCommunityIcons name="pencil-outline" size={16} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              <Text style={[fonts.medium, { fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 10 }]}>
                Enter 6-digit OTP
              </Text>

              {/* DEVELOPMENT ONLY: Show OTP */}
              {user?.otp ? (
                <View style={{ backgroundColor: '#FEF3C7', padding: 10, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#F59E0B', borderStyle: 'dashed' }}>
                  <Text style={[fonts.bold, { fontSize: 14, color: '#D97706', textAlign: 'center' }]}>
                    🚧 Dev Mode OTP: {user.otp} 🚧
                  </Text>
                </View>
              ) : null}

              {showSuccess ? (
                <View style={{ alignItems: 'center', marginVertical: 30 }}>
                  <Reanimated.View style={successIconStyle}>
                    <MaterialCommunityIcons name="check-circle" size={80} color="#10B981" />
                  </Reanimated.View>
                  <Reanimated.View style={[{ marginTop: 16 }, successTextStyle]}>
                    <Text style={[fonts.bold, { fontSize: 20, color: '#10B981', textAlign: 'center' }]}>
                      {t('verification_successful', 'Verification Successful!')}
                    </Text>
                  </Reanimated.View>
                </View>
              ) : isLocked ? (
                <View style={[styles.lockoutCard]}>
                  <MaterialCommunityIcons
                    name="account-lock"
                    size={40}
                    color="#EF4444"
                    style={{ marginBottom: 12 }}
                  />
                  <Text style={[fonts.bold, { fontSize: 18, color: '#EF4444', marginBottom: 8 }]}>
                    Account Locked
                  </Text>
                  <Text style={styles.lockoutText}>
                    {lockoutMessage}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setIsLocked(false);
                      setHasError(false);
                    }}
                    style={[styles.retryButton, { marginTop: 16, backgroundColor: colors.primary + '15', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 }]}
                  >
                    <Text style={{ color: colors.primary, fontWeight: '700' }} numberOfLines={1} adjustsFontSizeToFit>
                      {t('try_again', 'Try Again')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
                    <OTPInput
                      value={otp}
                      autoFocus={true}
                      onChangeText={text => {
                        setOtp(text);
                        if (hasError) { setHasError(false); }
                        if (text.length > 0) triggerHaptic(HapticFeedbackTypes.selection);
                      }}
                      hasError={hasError}
                    />
                  </Animated.View>

                  <View style={styles.disclaimerContainer}>
                    <MaterialCommunityIcons name="shield-check" size={16} color={colors.primary} />
                    <Text style={[styles.disclaimerText, fonts.medium]}>
                      Your verification code is secure and confidential
                    </Text>
                  </View>

                  {!canResend ? (
                    <View style={styles.countdownContainer}>
                      <MaterialCommunityIcons name="clock-outline" size={16} color="#6B7280" />
                      <Text style={[fonts.medium, { color: '#6B7280', fontSize: 13, marginLeft: 6 }]}>
                        Resend OTP in <Text style={{ color: colors.primary }}>00:{resendTimer.toString().padStart(2, '0')}</Text>
                      </Text>
                    </View>
                  ) : null}

                  <Reanimated.View style={[{ width: '100%', marginTop: 12 }, btnAnimatedStyle]}>
                    <Button
                      style={styles.verifyBtn}
                      onPress={handleContinue}
                      disabled={otp.length !== 6 || isLoading}
                    >
                      {isLoading ? <ActivityIndicator color="#FFF" /> : (
                        <>
                          <Text style={[fonts.bold, { color: '#FFF', fontSize: 16 }]}>
                            Verify & Continue
                          </Text>
                          <MaterialCommunityIcons name="arrow-right" size={20} color="#FFF" style={{ position: 'absolute', right: 20 }} />
                        </>
                      )}
                    </Button>
                  </Reanimated.View>

                  {canResend && (
                    <TouchableOpacity
                      style={styles.resendBtnFull}
                      onPress={handleResend}
                      disabled={isResending}
                    >
                      <MaterialCommunityIcons name="chat-processing-outline" size={18} color="#000" style={{ marginRight: 8 }} />
                      <Text style={[fonts.bold, { color: '#000', fontSize: 14 }]}>
                        Didn't receive OTP? <Text style={{ color: colors.primary }}>Resend OTP</Text>
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              {/* SAFE & SECURE BANNER */}
              <View style={styles.safeBanner}>
                <View style={styles.safeIconContainer}>
                  <MaterialCommunityIcons name="shield-check" size={20} color="#FFF" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[fonts.bold, { color: '#000', fontSize: 13 }]}>Safe & Secure</Text>
                  <Text style={[fonts.medium, { color: '#6B7280', fontSize: 11, marginTop: 2 }]}>
                    We never share your number with anyone.
                  </Text>
                </View>
                <MaterialCommunityIcons name="lock" size={60} color="#E5E7EB" style={{ position: 'absolute', right: -10, top: -10, opacity: 0.4 }} />
              </View>

            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: {
    height: 60,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : 20,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  cardContainer: {
    marginHorizontal: 16,
    backgroundColor: 'transparent',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardContent: {
    padding: 16,
    paddingTop: 28,
  },
  badgeContainer: {
    position: 'absolute',
    top: -24,
    alignSelf: 'center',
    zIndex: 10,
  },
  badgeCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  badgeCheck: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFF',
    borderRadius: 10,
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  editButton: {
    marginLeft: 8,
    padding: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 8,
    marginHorizontal: 16,
  },
  disclaimerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 6,
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  verifyBtn: {
    height: 44,
    width: '100%',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendBtnFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFF',
  },
  safeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
    overflow: 'hidden',
  },
  safeIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockoutCard: {
    backgroundColor: '#EF444410',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EF444430',
  },
  lockoutText: {
    color: '#EF4444',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  retryButton: {
    padding: 8,
  },
});

export default OTPScreen;
