import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  Alert,
  Modal,
  TouchableOpacity,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import LinearGradient from 'react-native-linear-gradient';
import Reanimated, {
  FadeInDown,
  FadeInUp,
  FadeInLeft,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  useSharedValue
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import { useAppTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useHaptic } from '../../hooks/useHaptic';
import i18n from '../../i18n/i18n';

import { Input, LanguageSelector } from '../../Components';
import Button from '../../Components/Button';

import walcomeImg from '../../assets/images/walcomeImg.png';
import logoLightmode from '../../assets/images/logoLightmode.png';
import logoDarkmode from '../../assets/images/logoDarkmode.png';

import { OTPScreen_Nav } from '../../Navigations/navigations';
import { setUser, clearUser } from '../../redux/userSlice';
import { RootState } from '../../redux/store';
import { useSendOtpMutation } from '../../service/userApi';
import { useApplyReferralCodeMutation } from '../../service/driverApi';
import { getDeviceId } from '../../service/utils/device';
import { Logo } from '../../assets/svg';
import AppStatusBar from '../../Components/AppStatusBar';

// const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const OTP_NAVIGATION_DELAY = 700;

const DecorativeBackground = ({ colors }: { colors: any }) => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <Reanimated.View
      style={[styles.blob, { top: -50, left: -50, backgroundColor: colors.primary + '15' }]}
    />
    <Reanimated.View
      style={[styles.blob, { bottom: -100, right: -50, width: 300, height: 300, backgroundColor: colors.primary + '10' }]}
    />
  </View>
);


const WelcomeScreen = ({ navigation }: any) => {
  const { colors: navColors, fonts } = useTheme() as any;
  const { theme, isDark: dark } = useAppTheme();
  const colors = theme.colors;
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { triggerHaptic } = useHaptic();


  /* ================= STATE ================= */
  const [mobileNumber, setMobileNumber] = useState('');
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [referralError, setReferralError] = useState('');
  const [referralMessage, setReferralMessage] = useState('');

  const [referralCodeStatus, setReferralCodeStatus] = useState<'idle' | 'loading' | 'valid' | 'invalid'>('idle');
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [isReferralVisible, setIsReferralVisible] = useState(false);
  const [typedTextLength, setTypedTextLength] = useState(0);

  const buttonScale = useSharedValue(1);

  const [sendOtp, { isLoading }] = useSendOtpMutation();
  const [applyReferralCode, { isLoading: isCheckingReferral }] = useApplyReferralCodeMutation();

  /* ================= DEVICE ID ================= */
  useEffect(() => {
    // 1. Force a completely clean state to prevent stale login data bugs
    dispatch(clearUser());

    // 2. Load device ID
    const loadDeviceId = async () => {
      try {
        const id = await getDeviceId();
        setDeviceId(id);
      } catch (e) {
        console.log('DEVICE ID ERROR:', e);
      }
    };
    loadDeviceId();
  }, [dispatch]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  /* ================= TYPING ANIMATION ================= */
  useEffect(() => {
    const fullText = "Driver Partner!";
    let currentLength = 0;

    // Slight delay to wait for the screen fade-in animation
    const timeout = setTimeout(() => {
      const interval = setInterval(() => {
        currentLength++;
        setTypedTextLength(currentLength);
        if (currentLength >= fullText.length) {
          clearInterval(interval);
        }
      }, 80);

      return () => clearInterval(interval);
    }, 800);

    return () => clearTimeout(timeout);
  }, []);

  /* ================= ANIMATIONS ================= */
  const triggerShake = () => {
    triggerHaptic(HapticFeedbackTypes.notificationError);
    // Animated.sequence([
    //   Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
    //   Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
    //   Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
    //   Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
    //   Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    // ]).start();
  };

  const btnAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const inputAnimatedStyle = useAnimatedStyle(() => ({
    borderColor: withTiming(
      hasError ? '#EF4444' : isFocused ? colors.primary : dark ? 'rgba(255,255,255,0.3)' : '#9CA3AF',
      { duration: 250 }
    ),
    transform: [{ scale: withSpring(isFocused ? 1.01 : 1) }],
    backgroundColor: dark ? theme.colors.card : '#FFFFFF',
  }));

  const handleCheckReferral = async () => {
    if (!referralCode || referralCode.length < 3) return;

    setReferralCodeStatus('loading');
    setReferralError('');
    setReferralMessage('');
    triggerHaptic(HapticFeedbackTypes.impactLight);

    try {
      const result = await applyReferralCode({ code: referralCode }).unwrap();

      // result.success is the API wrapper's status
      // result.data.valid is the actual referral code validity
      if (result.success && result.data?.valid) {
        setReferralCodeStatus('valid');
        setReferralMessage(result.data.message || t('referral_applied'));
        triggerHaptic(HapticFeedbackTypes.notificationSuccess);
      } else {
        setReferralCodeStatus('invalid');
        setReferralError(result.data?.message || t('invalid_referral_code'));
        triggerHaptic(HapticFeedbackTypes.notificationWarning);
      }
    } catch (err: any) {
      setReferralCodeStatus('invalid');
      setReferralError(err?.data?.message || t('invalid_referral_code'));
      triggerHaptic(HapticFeedbackTypes.notificationError);
    }
  };

  /* ================= HANDLERS ================= */
  const handleContinue = async () => {
    buttonScale.value = withSequence(withSpring(0.95), withSpring(1));
    triggerHaptic(HapticFeedbackTypes.impactLight);

    if (!mobileNumber || mobileNumber.length !== 10) {
      setHasError(true);
      triggerShake();
      return;
    }

    if (!deviceId) {
      Alert.alert(t('error') || 'Error', t('device_initializing') || 'Device is initializing. Please wait.');
      return;
    }

    try {
      const result = await sendOtp({
        phone_number: mobileNumber,
        role: 'driver',
        device_id: deviceId,
        allow_new_device: true,
      }).unwrap();

      const newOtp = result?.otp || result?.data?.otp || '';

      dispatch(setUser({ phone_number: mobileNumber, referred_by: referralCode || undefined, otp: newOtp }));
      // ToastAndroid.show(t('otp_sent_success'), ToastAndroid.SHORT);

      setTimeout(() => {
        navigation.navigate(OTPScreen_Nav);
      }, OTP_NAVIGATION_DELAY);

    } catch (err: any) {
      Alert.alert(
        t('otp_send_fail'),
        err?.data?.message || err?.message || t('something_went_wrong')
      );
    }
  };

  /* ================= UI COMPONENTS ================= */

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppStatusBar />
      <DecorativeBackground colors={colors} />

      {/* HEADER: LOGO, LANGUAGE SELECTOR & SUPPORT */}
      <Reanimated.View
        style={styles.headerContainer}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>

          <LanguageSelector variant={dark ? 'dark' : 'light'} />
        </View>

      </Reanimated.View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View
            style={{ flex: 1, padding: 24 }}
          >
            {/* HERO SECTION */}
            {!isKeyboardVisible && (
              <View style={{ marginTop: 12, marginBottom: 12 }}>
                {/* Right Side Image (Absolute) */}
                <Reanimated.View style={{ position: 'absolute', right: -80, top: -30, width: 250, height: 250, zIndex: 0, pointerEvents: 'none' }}>
                  <Image
                    source={walcomeImg}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="contain"
                  />
                </Reanimated.View>

                {/* Left Side Content */}
                <Reanimated.View
                  style={{ zIndex: 1, paddingRight: 100 }}
                >
                  <Text
                    style={[fonts.bold, { fontSize: 28, fontWeight: '900', color: dark ? '#FFFFFF' : '#0B132B', marginTop: 16, marginLeft: -2 }]}
                  >
                    Welcome
                  </Text>

                  <MaskedView
                    style={{ height: 36, marginTop: -4, marginLeft: -2 }}
                    maskElement={
                      <Text style={[fonts.bold, { fontSize: 28, fontWeight: '900', backgroundColor: 'transparent' }]}>
                        {"Driver Partner!".substring(0, typedTextLength)}
                      </Text>
                    }
                  >
                    <LinearGradient
                      colors={['#1D4ED8', '#3B82F6', '#60A5FA']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{ flex: 1 }}
                    />
                  </MaskedView>

                  <View style={{ marginTop: 16 }}>
                    <Text style={[fonts.medium, { fontSize: 13, color: '#6B7280' }]}>
                      Ready to hit the road?
                    </Text>
                    <Text style={[fonts.medium, { fontSize: 13, color: '#6B7280', marginTop: 2 }]}>
                      Turn your miles into money with flexible hours.
                    </Text>
                  </View>
                </Reanimated.View>
              </View>
            )}


            <Reanimated.View
              style={{
                marginTop: 32,
              }}
            >
              {/* Header: Icon + Let's get you started */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ backgroundColor: dark ? 'rgba(59, 130, 246, 0.1)' : '#EEF2FF', padding: 8, borderRadius: 10, marginRight: 12 }}>
                  <Ionicons name="phone-portrait-outline" size={20} color={dark ? '#60A5FA' : '#3B82F6'} />
                </View>
                <View>
                  <Text style={[fonts.bold, { fontSize: 16, color: colors.text }]}>Let's get you started</Text>
                  <Text style={[fonts.medium, { fontSize: 12, color: '#64748B', marginTop: 1 }]}>Enter your mobile number to continue</Text>
                </View>
              </View>

              {/* Input Field */}
              <Reanimated.View
                style={[
                  styles.glassInputContainer,
                  inputAnimatedStyle,
                  {
                    borderWidth: 1,
                    borderColor: isFocused ? colors.primary : (dark ? 'rgba(255,255,255,0.1)' : '#E2E8F0'),
                    backgroundColor: dark ? theme.colors.card : '#FFFFFF',
                    shadowColor: isFocused ? colors.primary : '#000',
                    shadowOffset: { width: 0, height: isFocused ? 4 : 0 },
                    shadowOpacity: isFocused ? 0.1 : 0,
                    shadowRadius: isFocused ? 10 : 0,
                    borderRadius: 12,
                    height: 48,
                    paddingHorizontal: 12,
                  }
                ]}
              >
                {/* INDIA FLAG + CODE */}
                <View style={[styles.countryCode, { paddingRight: 10 }]}>
                  <Text style={[fonts.bold, { fontSize: 15, color: colors.text, fontWeight: '700' }]}>+91</Text>
                  <Ionicons name="chevron-down" size={16} color="#64748B" style={{ marginLeft: 4 }} />
                </View>

                <View style={[styles.divider, { backgroundColor: dark ? 'rgba(255,255,255,0.1)' : '#E2E8F0', height: 24 }]} />

                {/* MOBILE INPUT */}
                <Input
                  value={mobileNumber}
                  keyboardType="phone-pad"
                  maxLength={10}
                  placeholder="Enter your mobile number"
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  returnKeyType="done"
                  onSubmitEditing={handleContinue}
                  onChangeText={text => {
                    const cleanText = text.replace(/[^0-9]/g, '');
                    setMobileNumber(cleanText);
                    if (hasError) setHasError(false);
                    if (cleanText.length > 0) triggerHaptic(HapticFeedbackTypes.selection);
                  }}
                  containerStyle={{
                    flex: 1,
                    backgroundColor: 'transparent',
                    marginLeft: 10,
                  }}
                  inputContainerStyle={{
                    borderWidth: 0,
                    backgroundColor: 'transparent',
                    height: '100%',
                    paddingHorizontal: 0,
                  }}
                  style={{
                    color: colors.text,
                    fontSize: 15,
                    fontWeight: mobileNumber ? '600' : '400',
                    letterSpacing: mobileNumber ? 1 : 0,
                    backgroundColor: 'transparent',
                    paddingVertical: 0,
                    textAlignVertical: 'center',
                  }}
                  placeholderTextColor="#94A3B8"
                  keyboardAppearance={dark ? 'dark' : 'light'}
                />
              </Reanimated.View>

              {hasError && (
                <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 6, marginLeft: 8 }}>
                  {t('valid_mobile_error')}
                </Text>
              )}

              {/* BUTTON */}
              <Reanimated.View style={[btnAnimatedStyle, { marginTop: 12, width: '85%', alignSelf: 'center' }]}>
                <Button
                  style={{
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: '#2563EB',
                    borderWidth: 0,
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                    shadowColor: '#2563EB',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                  onPress={handleContinue}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                      <Text style={[fonts.bold, { color: '#FFF', fontSize: 16, fontWeight: '600' }]}>
                        Get OTP
                      </Text>
                      <Ionicons name="arrow-forward" size={20} color="#FFF" style={{ position: 'absolute', right: 24 }} />
                    </View>
                  )}
                </Button>
              </Reanimated.View>

              {/* OTP Hint text */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
                <Ionicons name="lock-closed-outline" size={12} color="#64748B" />
                <Text style={{ fontSize: 11, color: '#64748B', marginLeft: 6 }}>
                  We will send you a 6-digit OTP on this number
                </Text>
              </View>

              {/* REFERRAL CODE SECTION */}
              <View style={{ backgroundColor: dark ? 'rgba(22, 163, 74, 0.1)' : '#F0FDF4', borderRadius: 12, padding: 10, marginTop: 36 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ backgroundColor: dark ? 'rgba(22, 163, 74, 0.2)' : '#DCFCE7', padding: 8, borderRadius: 8, marginRight: 8 }}>
                    <Ionicons name="gift" size={22} color="#16A34A" />
                  </View>

                  <View style={{ flex: 1, paddingRight: 6 }}>
                    <Text numberOfLines={1} style={[fonts.bold, { color: colors.text, fontSize: 12 }]}>Have a referral code?</Text>
                    <Text numberOfLines={1} style={{ fontSize: 10, color: '#6B7280', marginTop: 2, lineHeight: 14 }}>Enter referral code and earn exciting rewards when you join!</Text>
                  </View>

                  {/* Referral Input & Apply Button Row */}
                  <View style={{ width: 145, backgroundColor: dark ? theme.colors.card : '#FFF', borderRadius: 8, borderWidth: 1, borderColor: '#86EFAC', height: 40, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }}>
                    <Input
                      value={referralCode}
                      placeholder="Enter code"
                      autoCapitalize="characters"
                      maxLength={20}
                      onChangeText={(text: string) => {
                        setReferralCode(text.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                        setReferralCodeStatus('idle');
                        setReferralError('');
                        setReferralMessage('');
                      }}
                      containerStyle={{ flex: 1, backgroundColor: 'transparent' }}
                      inputContainerStyle={{ borderWidth: 0, backgroundColor: 'transparent', height: '100%', paddingHorizontal: 6 }}
                      style={{
                        color: colors.text,
                        fontSize: 12,
                        fontWeight: '600',
                        letterSpacing: 0.5,
                        backgroundColor: 'transparent',
                        paddingVertical: 0,
                      }}
                      placeholderTextColor="#9CA3AF"
                      keyboardAppearance={dark ? 'dark' : 'light'}
                    />
                    <TouchableOpacity
                      onPress={handleCheckReferral}
                      disabled={isCheckingReferral || !referralCode}
                      style={{ paddingHorizontal: 8, height: '100%', justifyContent: 'center', backgroundColor: dark ? 'rgba(22, 163, 74, 0.1)' : 'transparent' }}
                    >
                      {isCheckingReferral ? (
                        <ActivityIndicator size="small" color="#16A34A" />
                      ) : (
                        <Text style={[fonts.bold, { color: referralCodeStatus === 'valid' ? '#16A34A' : '#16A34A', fontSize: 12, opacity: (!referralCode) ? 0.5 : 1 }]}>
                          {referralCodeStatus === 'valid' ? 'Applied' : 'Apply'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {referralCodeStatus === 'invalid' && (
                  <Text style={{ color: '#EF4444', fontSize: 11, marginTop: 6, marginLeft: 4 }}>
                    {referralError || t('invalid_referral_code')}
                  </Text>
                )}
                {referralCodeStatus === 'valid' && (
                  <Text style={{ color: '#16A34A', fontSize: 11, marginTop: 6, marginLeft: 4 }}>
                    {referralMessage || t('referral_applied')}
                  </Text>
                )}
              </View>
            </Reanimated.View>

            {/* CHAT SUPPORT BUTTON */}

            {/* FOOTER */}
            <Reanimated.View
              style={{ marginTop: 'auto', marginBottom: 10 }}
            >
              <Text style={styles.footerText}>
                {t('agree_terms_prefix')}
                <Text style={{ color: '#2563EB', fontWeight: '500' }}>{t('terms')}</Text>
                {'\n'}
                {t('and')}
                <Text style={{ color: '#2563EB', fontWeight: '500' }}>{t('privacy_policy')}</Text>
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
    width: 240,
    height: 240,
    borderRadius: 120,
    opacity: 0.5,
  },
  logoWrapper: {
    padding: 0,
    borderRadius: 24,
    backgroundColor: 'transparent',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    zIndex: 10,
  },
  glassInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    paddingHorizontal: 12,
    height: 60,
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 14,
  },
  divider: {
    width: 1,
    height: 28,
    marginLeft: 14,
    opacity: 0.6,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
});

export default WelcomeScreen;
