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

// const { width: _SCREEN_WIDTH } = Dimensions.get('window');

/* ================= CONSTANTS ================= */
const RESEND_TIME = 30;

const DecorativeBackground = ({ colors }: { colors: any }) => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <Reanimated.View
      entering={FadeInLeft.delay(300).duration(1000)}
      style={[styles.blob, { top: -50, right: -50, backgroundColor: colors.primary + '15' }]}
    />
    <Reanimated.View
      entering={FadeInUp.delay(500).duration(1000)}
      style={[styles.blob, { bottom: -100, left: -50, width: 300, height: 300, backgroundColor: colors.primary + '10' }]}
    />
  </View>
);


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

  const [resendTimer, setResendTimer] = useState(0);
  const [canResend, setCanResend] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutMessage, setLockoutMessage] = useState('');

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useSharedValue(1);
  const successScale = useSharedValue(1);
  const successOpacity = useSharedValue(0);
  const iconRotate = useSharedValue(0);
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
      { scale: withSpring(successScale.value, { damping: 12, stiffness: 100 }) },
      { rotate: `${iconRotate.value}deg` }
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
        iconRotate.value = withSpring(360, { damping: 15 });

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
        }, 1500);

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
  }, [user, otp, deviceId, verifyOtp, t, buttonScale, successScale, successOpacity, iconRotate, triggerHaptic, triggerShake, dispatch]);


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
      await sendOtp({
        phone_number: user.phone_number,
        role: 'driver',
        device_id: deviceId,
        allow_new_device: true,
      }).unwrap();

      setResendTimer(RESEND_TIME);
      setCanResend(false);
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
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={['top', 'bottom']}
    >
      <AppStatusBar />
      <DecorativeBackground colors={colors} />

      {/* HEADER / BACK */}
      <Reanimated.View
        style={styles.header}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { backgroundColor: colors.card }]}
        >
          <MaterialCommunityIcons name="chevron-left" size={32} color={colors.text} />
        </TouchableOpacity>
      </Reanimated.View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1, paddingHorizontal: 24 }}>
            <View style={styles.centerContent}>

              <Reanimated.View
                style={styles.iconContainer}
              >
                <Reanimated.View style={[
                  styles.iconCircle,
                  { backgroundColor: showSuccess ? '#10B98120' : colors.primary + '20' },
                  successIconStyle
                ]}>
                  <MaterialCommunityIcons
                    name={showSuccess ? "check-decagram" : "shield-check"}
                    size={showSuccess ? 56 : 48}
                    color={showSuccess ? '#10B981' : colors.primary}
                  />
                </Reanimated.View>
              </Reanimated.View>

              <Reanimated.View>
                {showSuccess ? (
                  <Reanimated.View style={[{ alignItems: 'center' }, successTextStyle]}>
                    <Text 
                      adjustsFontSizeToFit
                      numberOfLines={1}
                      style={[fonts.bold, { fontSize: 28, textAlign: 'center', color: '#10B981' }]}
                    >
                      {t('otp_verified')}
                    </Text>
                    <Text style={{ marginTop: 12, opacity: 0.8, textAlign: 'center', color: colors.text, fontSize: 16 }}>
                      {t('redirecting_to_dashboard')}
                    </Text>
                  </Reanimated.View>
                ) : (
                  <>
                    <Text 
                      adjustsFontSizeToFit
                      numberOfLines={1}
                      style={[fonts.bold, { fontSize: 28, textAlign: 'center', color: colors.text }]}
                    >
                      {t('verify_otp')}
                    </Text>

                    <Text style={{ marginTop: 12, opacity: 0.6, textAlign: 'center', color: colors.text, fontSize: 16 }}>
                      {t('sent_code_to')}
                    </Text>

                    <View style={styles.phoneContainer}>
                      <Text style={[fonts.bold, { fontSize: 18, color: colors.text }]}>
                        +91 {user?.phone_number}
                      </Text>
                      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.editButton}>
                        <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>
                          {t('edit')}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.disclaimerContainer}>
                      <MaterialCommunityIcons name="information-outline" size={14} color={colors.text + '60'} />
                      <Text style={[styles.disclaimerText, { color: dark ? theme.colors.textMuted : '#6B7280' }]}>
                        {t('security_disclaimer')}
                      </Text>
                    </View>
                  </>
                )}
              </Reanimated.View>

              {!showSuccess && (
                <>
                  {/* OTP INPUT OR LOCKOUT UI */}
                  {isLocked ? (
                    <View style={[styles.lockoutCard, { marginTop: 32 }]}>
                      <MaterialCommunityIcons
                        name="account-lock"
                        size={48}
                        color="#EF4444"
                        style={{ marginBottom: 16 }}
                      />
                      <Text style={[fonts.bold, { fontSize: 20, color: '#EF4444', marginBottom: 8 }]}>
                        {t('account_locked', 'Account Locked')}
                      </Text>
                      <Text style={styles.lockoutText}>
                        {lockoutMessage}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          setIsLocked(false);
                          setHasError(false);
                        }}
                        style={[styles.retryButton, { marginTop: 24, backgroundColor: colors.primary + '15', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 }]}
                      >
                        <Text style={{ color: colors.primary, fontWeight: '700' }} numberOfLines={1} adjustsFontSizeToFit>
                          {t('try_again', 'Try Again')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <Animated.View
                        style={{
                          marginTop: 32,
                          transform: [{ translateX: shakeAnim }],
                        }}
                      >
                        <Reanimated.View>
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
                        </Reanimated.View>
                      </Animated.View>

                      {hasError && (
                        <Reanimated.Text
                          entering={FadeInDown}
                          style={styles.errorText}
                        >
                          {t('invalid_otp')}
                        </Reanimated.Text>
                      )}

                      <Reanimated.View style={{ width: '100%' }}>
                        <Reanimated.View style={btnAnimatedStyle}>
                          <Button
                            style={{
                              marginTop: 44,
                              height: 60,
                              width: '100%',
                              borderRadius: 20,
                              backgroundColor: colors.primary,
                              elevation: 6,
                              shadowColor: colors.primary,
                              shadowOffset: { width: 0, height: 6 },
                              shadowOpacity: 0.3,
                              shadowRadius: 12,
                            }}
                            onPress={handleContinue}
                            disabled={otp.length !== 6 || isLoading}
                          >
                            {isLoading ? <ActivityIndicator color="#FFF" /> : (
                              <Text 
                                adjustsFontSizeToFit
                                numberOfLines={1}
                                style={[fonts.bold, { color: '#FFF', fontSize: 18 }]}
                              >
                                {t('verify_continue')}
                              </Text>
                            )}
                          </Button>
                        </Reanimated.View>
                      </Reanimated.View>

                      <Reanimated.View
                        style={{ marginTop: 28 }}
                      >
                        {canResend ? (
                          <TouchableOpacity onPress={handleResend} disabled={isResending} style={styles.resendButton}>
                            <MaterialCommunityIcons name="refresh" size={20} color={colors.primary} style={{ marginRight: 6 }} />
                            <Text 
                              adjustsFontSizeToFit
                              numberOfLines={1}
                              style={{ color: colors.primary, fontSize: 16, fontWeight: '700' }}
                            >
                              {isResending ? t('sending') : t('resend_otp')}
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.countdownContainer}>
                            <View style={styles.progressWrapper}>
                              <Svg width={44} height={44} viewBox="0 0 44 44">
                                <Circle
                                  cx="22"
                                  cy="22"
                                  r="19"
                                  stroke={colors.border + '40'}
                                  strokeWidth="3"
                                  fill="none"
                                />
                                <Circle
                                  cx="22"
                                  cy="22"
                                  r="19"
                                  stroke={colors.primary}
                                  strokeWidth="3"
                                  strokeDasharray={`${2 * Math.PI * 19}`}
                                  strokeDashoffset={2 * Math.PI * 19 * (resendTimer / RESEND_TIME)}
                                  strokeLinecap="round"
                                  fill="none"
                                  transform="rotate(-90 22 22)"
                                />
                              </Svg>
                              <Text style={[styles.timerNumber, { color: colors.text, ...fonts.bold }]}>{resendTimer}</Text>
                            </View>
                            <Text style={[styles.resendInText, { color: colors.text }]}>
                              {t('resend_in')}
                            </Text>
                          </View>
                        )}
                      </Reanimated.View>
                    </>
                  )}
                </>
              )}
            </View>

            {/* FOOTER */}
            <Reanimated.View
              style={styles.footer}
            >
              <Text style={[styles.footerText, { color: dark ? theme.colors.textMuted : '#6B7280' }]}>
                {t('agree_terms_prefix')}
                <Text style={{ color: colors.primary, fontWeight: '700' }} numberOfLines={1} adjustsFontSizeToFit>{t('terms')}</Text>
                {t('and')}
                <Text style={{ color: colors.primary, fontWeight: '700' }} numberOfLines={1} adjustsFontSizeToFit>{t('privacy_policy')}</Text>
              </Text>
            </Reanimated.View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    opacity: 0.5,
  },
  header: {
    height: 60,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },
  iconContainer: {
    marginBottom: 32,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  editButton: {
    marginLeft: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
  },
  disclaimerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 6,
    textAlign: 'left',
    opacity: 0.8,
    flexShrink: 1,
  },
  errorText: {
    color: '#EF4444',
    marginTop: 16,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  countdownContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressWrapper: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  timerNumber: {
    position: 'absolute',
    fontSize: 14,
  },
  resendInText: {
    fontSize: 14,
    opacity: 0.6,
  },
  footer: {
    paddingBottom: Platform.OS === 'android' ? 24 : 12,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  lockoutCard: {
    backgroundColor: '#EF444410',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EF444430',
    width: '100%',
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
