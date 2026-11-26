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
  Linking,
  ToastAndroid,
} from 'react-native';
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
import { useToast } from '../../context/ToastContext';
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
import { useResponsive } from '../../lib/scale';
import { requestDevicePhoneNumber, isValidIndianMobile } from '../../service/phoneHint';

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


const LEGAL_URLS = {
  TERMS: 'https://www.j2bglobal.com/legal/terms.html',
  PRIVACY: 'https://www.j2bglobal.com/legal/privacy.html',
};

const WelcomeScreen = ({ navigation }: any) => {
  const { colors: navColors, fonts } = useTheme() as any;
  const { theme, isDark: dark } = useAppTheme();
  const colors = theme.colors;
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { triggerHaptic } = useHaptic();
  const { showToast } = useToast();
  const { rs, rvs, rms, cs, selectByDevice, isSmallDevice, isLargeDevice, isTablet } = useResponsive();


  /* ================= STATE ================= */
  const [mobileNumber, setMobileNumber] = useState('');
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isTermsAccepted, setIsTermsAccepted] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [referralError, setReferralError] = useState('');
  const [referralMessage, setReferralMessage] = useState('');

  const [referralCodeStatus, setReferralCodeStatus] = useState<'idle' | 'loading' | 'valid' | 'invalid'>('idle');
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [isReferralVisible, setIsReferralVisible] = useState(false);

  const buttonScale = useSharedValue(1);

  const [sendOtp, { isLoading }] = useSendOtpMutation();
  const [applyReferralCode, { isLoading: isCheckingReferral }] = useApplyReferralCodeMutation();

  const handleOpenLink = async (url: string, documentName: string) => {
    try {
      triggerHaptic(HapticFeedbackTypes.selection);
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          t('cannot_open_link', 'Unable to open link'),
          t('cannot_open_link_desc', 'Could not open the legal document in your browser.')
        );
      }
    } catch (error) {
      console.log(`Error opening ${documentName} URL:`, error);
      Alert.alert(
        t('error', 'Error'),
        t('cannot_open_link_desc', 'Could not open the legal document in your browser.')
      );
    }
  };

  const toggleTerms = () => {
    triggerHaptic(HapticFeedbackTypes.selection);
    setIsTermsAccepted(prev => !prev);
    if (termsError) setTermsError(false);
  };

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

  /* ================= AUTO PHONE NUMBER RETRIEVAL ================= */
  useEffect(() => {
    let isMounted = true;

    const autoRetrievePhoneNumber = async () => {
      // 350ms delay to allow screen animations to settle before triggering system sheet
      const timer = setTimeout(async () => {
        if (!isMounted) return;
        try {
          const result = await requestDevicePhoneNumber();
          if (isMounted && result.success && result.phoneNumber) {
            setMobileNumber(result.phoneNumber);
            setHasError(false);
            triggerHaptic(HapticFeedbackTypes.notificationSuccess);
          }
        } catch (e) {
          // Graceful silent fallback to manual entry
        }
      }, 350);

      return () => clearTimeout(timer);
    };

    autoRetrievePhoneNumber();

    return () => {
      isMounted = false;
    };
  }, []);

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

  /* ================= BRAND TEXT ================= */
  const fullText = t('driver_partner_anim', 'Driver Partner!');

  /* ================= ANIMATIONS ================= */
  const triggerShake = () => {
    triggerHaptic(HapticFeedbackTypes.notificationError);
  };

  const btnAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const inputAnimatedStyle = useAnimatedStyle(() => ({
    borderColor: withTiming(
      hasError ? '#EF4444' : isFocused ? colors.primary : dark ? 'rgba(255,255,255,0.3)' : '#9CA3AF',
      { duration: 200 }
    ),
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
    Keyboard.dismiss();
    buttonScale.value = withSequence(withSpring(0.95), withSpring(1));
    triggerHaptic(HapticFeedbackTypes.impactLight);

    if (!isValidIndianMobile(mobileNumber)) {
      setHasError(true);
      triggerShake();
      return;
    }

    if (!isTermsAccepted) {
      setTermsError(true);
      triggerHaptic(HapticFeedbackTypes.notificationWarning);
      const termsMsg = t('accept_terms_required', 'Please accept the Terms of Use and Privacy Policy to continue.');
      if (Platform.OS === 'android') {
        ToastAndroid.show(termsMsg, ToastAndroid.SHORT);
      } else {
        showToast({
          type: 'error',
          message: termsMsg,
          position: 'bottom',
        });
      }
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
      const isExistingUser = result?.isExistingUser ?? result?.data?.isExistingUser ?? false;

      dispatch(setUser({
        phone_number: mobileNumber,
        referred_by: referralCode || undefined,
        otp: newOtp,
        isExistingUser,
        terms_accepted: true,
        terms_accepted_at: new Date().toISOString(),
      }));
      navigation.navigate(OTPScreen_Nav);

    } catch (err: any) {
      Alert.alert(
        t('otp_send_fail'),
        err?.data?.message || err?.message || t('something_went_wrong')
      );
    }
  };

  /* ================= UI COMPONENTS ================= */

  const mainContent = (
    <View style={{ flex: 1, justifyContent: 'space-between' }}>
      {/* 1. HERO SECTION (Hides when keyboard is active to maintain zero scroll) */}
      {!isKeyboardVisible && (
        <View style={{
          marginTop: selectByDevice({ small: 2, medium: 6, large: 12 }),
          minHeight: selectByDevice({ small: 125, medium: 180, large: 220 }),
        }}>
          {/* Right Side Image (Absolute) - positioned to the right to avoid overlapping with text */}
          <View style={{
            position: 'absolute',
            right: selectByDevice({ small: -50, medium: -58, large: -45 }),
            top: selectByDevice({ small: -10, medium: -6, large: 0 }),
            width: selectByDevice({ small: 160, medium: 220, large: 260 }),
            height: selectByDevice({ small: 160, medium: 220, large: 260 }),
            zIndex: 0,
            pointerEvents: 'none'
          }}>
            <Image
              source={walcomeImg}
              style={{ width: '100%', height: '100%' }}
              resizeMode="contain"
            />
          </View>

          {/* Left Side Content - maxWidth ensures text never collides with car/driver illustration */}
          <View style={{ zIndex: 1, maxWidth: selectByDevice({ small: '58%', medium: '56%', large: '58%' }), paddingRight: 4 }}>
            <Text
              maxFontSizeMultiplier={1.25}
              style={[
                fonts.bold,
                {
                  fontSize: selectByDevice({ small: rms(21), medium: rms(25), large: rms(29) }),
                  fontWeight: '900',
                  color: dark ? '#FFFFFF' : '#0B132B',
                  marginTop: selectByDevice({ small: 4, medium: 8, large: 12 }),
                  lineHeight: selectByDevice({ small: rms(27), medium: rms(31), large: rms(35) }),
                  marginLeft: -2,
                }
              ]}
            >
              Welcome{' '}
              <Text style={{ color: colors.primary }}>
                {fullText}
              </Text>
            </Text>

            <View style={{ marginTop: selectByDevice({ small: 6, medium: 10, large: 14 }) }}>
              <Text 
                maxFontSizeMultiplier={1.25}
                style={[fonts.medium, { fontSize: selectByDevice({ small: rms(11), medium: rms(12), large: rms(13.5) }), color: dark ? '#9CA3AF' : '#6B7280', lineHeight: selectByDevice({ small: rms(15), medium: rms(17), large: rms(19) }) }]}
              >
                Ready to hit the road?
              </Text>
              <Text 
                maxFontSizeMultiplier={1.25}
                style={[fonts.medium, { fontSize: selectByDevice({ small: rms(11), medium: rms(12), large: rms(13.5) }), color: dark ? '#9CA3AF' : '#6B7280', marginTop: 2, lineHeight: selectByDevice({ small: rms(15), medium: rms(17), large: rms(19) }) }]}
              >
                Turn your miles into money with flexible hours.
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* 2. FORM SECTION */}
      <View style={{ marginTop: isKeyboardVisible ? selectByDevice({ small: 10, medium: 20, large: 30 }) : 0 }}>
        {/* Header: Icon + Let's get you started */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: selectByDevice({ small: 10, medium: 12, large: 14 }) }}>
          <View style={{ backgroundColor: dark ? 'rgba(59, 130, 246, 0.1)' : '#EEF2FF', padding: selectByDevice({ small: 7, medium: 8, large: 9 }), borderRadius: 10, marginRight: 12 }}>
            <Ionicons name="phone-portrait-outline" size={selectByDevice({ small: 18, medium: 21, large: 23 })} color={dark ? '#60A5FA' : '#3B82F6'} />
          </View>
          <View>
            <Text maxFontSizeMultiplier={1.25} style={[fonts.bold, { fontSize: selectByDevice({ small: rms(14), medium: rms(16), large: rms(17.5) }), color: colors.text }]}>{t('lets_get_started', "Let's get you started")}</Text>
            <Text maxFontSizeMultiplier={1.25} style={[fonts.medium, { fontSize: selectByDevice({ small: rms(11), medium: rms(12), large: rms(13) }), color: dark ? '#9CA3AF' : '#64748B', marginTop: 1 }]}>{t('enter_mobile_to_continue', 'Enter your mobile number to continue')}</Text>
          </View>
        </View>

        {/* Input Field */}
        <Reanimated.View
          style={[
            styles.glassInputContainer,
            inputAnimatedStyle,
            {
              borderWidth: 1,
              shadowColor: isFocused ? colors.primary : '#000',
              shadowOffset: { width: 0, height: isFocused ? 4 : 0 },
              shadowOpacity: isFocused ? 0.1 : 0,
              shadowRadius: isFocused ? 10 : 0,
              borderRadius: 12,
              height: selectByDevice({ small: cs(48, 0.9, 1.1), medium: cs(52, 0.9, 1.1), large: cs(56, 0.9, 1.1) }),
              paddingHorizontal: 12,
            }
          ]}
        >
          {/* INDIA FLAG + CODE */}
          <View style={[styles.countryCode, { paddingRight: 10 }]}>
            <Text maxFontSizeMultiplier={1.25} style={[fonts.bold, { fontSize: selectByDevice({ small: rms(14), medium: rms(15.5), large: rms(16.5) }), color: colors.text, fontWeight: '700' }]}>+91</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: dark ? 'rgba(255,255,255,0.1)' : '#E2E8F0', height: 24 }]} />

          {/* MOBILE INPUT */}
          <Input
            value={mobileNumber}
            keyboardType="phone-pad"
            maxLength={10}
            textContentType="telephoneNumber"
            autoComplete="tel"
            placeholder={t('enter_mobile_placeholder', 'Enter your mobile number')}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            returnKeyType="done"
            onSubmitEditing={handleContinue}
            onChangeText={text => {
              const cleanText = text.replace(/[^0-9]/g, '');
              setMobileNumber(cleanText);
              if (hasError) setHasError(false);
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
              fontSize: selectByDevice({ small: rms(14), medium: rms(15.5), large: rms(16.5) }),
              fontWeight: '600',
              letterSpacing: 0.5,
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
        <Reanimated.View style={[btnAnimatedStyle, { marginTop: selectByDevice({ small: 10, medium: 14, large: 18 }), width: '100%' }]}>
          <Button
            style={{
              height: selectByDevice({ small: cs(46, 0.9, 1.1), medium: cs(52, 0.9, 1.1), large: cs(56, 0.9, 1.1) }),
              borderRadius: 12,
              backgroundColor: colors.primary,
              borderWidth: 0,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              shadowColor: colors.primary,
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
                <Text maxFontSizeMultiplier={1.25} style={[fonts.bold, { color: '#FFF', fontSize: selectByDevice({ small: rms(15), medium: rms(16.5), large: rms(17.5) }), fontWeight: '600' }]}>
                  Get OTP
                </Text>
                <Ionicons name="arrow-forward" size={selectByDevice({ small: 18, medium: 21, large: 23 })} color="#FFF" style={{ position: 'absolute', right: 24 }} />
              </View>
            )}
          </Button>
        </Reanimated.View>

        {/* OTP Hint text */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: selectByDevice({ small: 8, medium: 10, large: 14 }) }}>
          <Ionicons name="lock-closed-outline" size={selectByDevice({ small: 12, medium: 13.5, large: 14.5 })} color={dark ? '#9CA3AF' : '#64748B'} />
          <Text maxFontSizeMultiplier={1.25} style={{ fontSize: selectByDevice({ small: rms(10.5), medium: rms(11.5), large: rms(12.5) }), color: dark ? '#9CA3AF' : '#64748B', marginLeft: 6 }}>
            We will send you a 6-digit OTP on this number
          </Text>
        </View>
      </View>

      {/* 3. REFERRAL CODE SECTION - Clean, readable 2-row card layout */}
      <View style={{
        backgroundColor: dark ? 'rgba(22, 163, 74, 0.1)' : '#F0FDF4',
        borderRadius: 14,
        padding: selectByDevice({ small: 8, medium: 12, large: 15 }),
        marginTop: selectByDevice({ small: 20, medium: 12, large: 16 }),
        marginBottom: selectByDevice({ small: 8, medium: 14, large: 18 }),
        borderWidth: 1,
        borderColor: dark ? 'rgba(74, 222, 128, 0.2)' : '#DCFCE7'
      }}>
        {/* Row 1: Header + subtitle with 100% width so text is never truncated */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: selectByDevice({ small: 7, medium: 9, large: 11 }) }}>
          <View style={{ backgroundColor: dark ? 'rgba(22, 163, 74, 0.2)' : '#DCFCE7', padding: selectByDevice({ small: 6, medium: 7, large: 8 }), borderRadius: 8, marginRight: 10 }}>
            <Ionicons name="gift" size={selectByDevice({ small: 18, medium: 21, large: 23 })} color="#16A34A" />
          </View>

          <View style={{ flex: 1 }}>
            <Text maxFontSizeMultiplier={1.25} style={[fonts.bold, { color: colors.text, fontSize: selectByDevice({ small: rms(12), medium: rms(13), large: rms(14) }) }]}>
              {t('have_referral_code', 'Have a referral code?')}
            </Text>
            <Text maxFontSizeMultiplier={1.25} style={{ fontSize: selectByDevice({ small: rms(10), medium: rms(11), large: rms(12) }), color: dark ? '#9CA3AF' : '#6B7280', marginTop: 1 }}>
              {t('referral_rewards_hint', 'Enter referral code and earn exciting rewards when you join!')}
            </Text>
          </View>
        </View>

        {/* Row 2: Full-width input + Apply Button */}
        <View style={{
          backgroundColor: dark ? theme.colors.card : '#FFF',
          borderRadius: 8,
          borderWidth: 1,
          borderColor: dark ? 'rgba(74, 222, 128, 0.3)' : '#86EFAC',
          height: selectByDevice({ small: 40, medium: 44, large: 48 }),
          flexDirection: 'row',
          alignItems: 'center',
          overflow: 'hidden'
        }}>
          <Input
            value={referralCode}
            placeholder={t('enter_code_placeholder', 'Enter code')}
            autoCapitalize="characters"
            maxLength={20}
            onChangeText={(text: string) => {
              setReferralCode(text.toUpperCase().replace(/[^A-Z0-9]/g, ''));
              setReferralCodeStatus('idle');
              setReferralError('');
              setReferralMessage('');
            }}
            containerStyle={{ flex: 1, backgroundColor: 'transparent' }}
            inputContainerStyle={{ borderWidth: 0, backgroundColor: 'transparent', height: '100%', paddingHorizontal: 10 }}
            style={{
              color: colors.text,
              fontSize: selectByDevice({ small: rms(12), medium: rms(13), large: rms(14) }),
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
            style={{ paddingHorizontal: selectByDevice({ small: 12, medium: 16, large: 20 }), height: '100%', justifyContent: 'center', backgroundColor: referralCode ? (dark ? '#15803D' : '#16A34A') : (dark ? 'rgba(22, 163, 74, 0.1)' : '#F0FDF4') }}
          >
            {isCheckingReferral ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text maxFontSizeMultiplier={1.25} style={[fonts.bold, { color: referralCode ? '#FFF' : (dark ? '#4ADE80' : '#16A34A'), fontSize: selectByDevice({ small: rms(12), medium: rms(13), large: rms(14) }) }]}>
                {referralCodeStatus === 'valid' ? t('applied', 'Applied') : t('apply', 'Apply')}
              </Text>
            )}
          </TouchableOpacity>
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

      {/* 4. FOOTER: TERMS & PRIVACY CONSENT */}
      <View
        style={{
          marginTop: 'auto',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: selectByDevice({ small: 6, medium: 8, large: 12 }),
          paddingBottom: selectByDevice({ small: 8, medium: 12, large: 16 }),
          paddingHorizontal: selectByDevice({ small: 8, medium: 12, large: 16 }),
          width: '100%',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'center',
            maxWidth: '96%',
          }}
        >
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={toggleTerms}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessible={true}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isTermsAccepted }}
            accessibilityLabel={t('agree_terms_checkbox_label', 'I agree to the Terms of Use and Privacy Policy')}
            style={[
              styles.checkboxContainer,
              {
                borderColor: termsError
                  ? '#EF4444'
                  : isTermsAccepted
                    ? colors.primary
                    : dark ? '#4B5563' : '#CBD5E1',
                backgroundColor: isTermsAccepted
                  ? colors.primary
                  : dark ? 'rgba(31, 41, 55, 0.6)' : '#FFFFFF',
                marginRight: 8,
              },
            ]}
          >
            {isTermsAccepted && (
              <Ionicons name="checkmark" size={13} color="#FFFFFF" />
            )}
          </TouchableOpacity>

          <View style={{ flexShrink: 1 }}>
            <Text
              style={[
                styles.footerText,
                {
                  textAlign: 'center',
                  paddingHorizontal: 0,
                  color: dark ? '#9CA3AF' : '#6B7280',
                  fontSize: selectByDevice({ small: rms(11), medium: rms(11.5), large: rms(12.5) }),
                  lineHeight: selectByDevice({ small: rms(16), medium: rms(18), large: rms(20) }),
                },
              ]}
            >
              <Text onPress={toggleTerms}>
                {t('i_agree_to', 'I agree to the ')}
              </Text>
              <Text
                accessible={true}
                accessibilityRole="link"
                accessibilityLabel={`${t('terms_of_use', 'Terms of Use')}, opens in browser`}
                accessibilityHint="Opens the Terms of Use webpage"
                onPress={() => handleOpenLink(LEGAL_URLS.TERMS, 'Terms of Use')}
                style={{
                  color: colors.primary,
                  fontWeight: '600',
                  textDecorationLine: 'underline',
                }}
              >
                {t('terms_of_use', 'Terms of Use')}
              </Text>
              <Text onPress={toggleTerms}>
                {t('and', ' and ')}
              </Text>
              <Text
                accessible={true}
                accessibilityRole="link"
                accessibilityLabel={`${t('privacy_policy', 'Privacy Policy')}, opens in browser`}
                accessibilityHint="Opens the Privacy Policy webpage"
                onPress={() => handleOpenLink(LEGAL_URLS.PRIVACY, 'Privacy Policy')}
                style={{
                  color: colors.primary,
                  fontWeight: '600',
                  textDecorationLine: 'underline',
                }}
              >
                {t('privacy_policy', 'Privacy Policy')}
              </Text>
            </Text>
          </View>
        </View>

        {termsError && (
          <Text style={{ color: '#EF4444', fontSize: selectByDevice({ small: rms(10), medium: rms(11), large: rms(11.5) }), textAlign: 'center', marginTop: 6, fontWeight: '500' }}>
            {t('accept_terms_required', 'Please accept the Terms of Use and Privacy Policy to continue.')}
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={Platform.OS === 'ios' ? ['top', 'bottom'] : ['top']}>
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
        enabled={Platform.OS === 'ios'}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={{ flex: 1, paddingHorizontal: selectByDevice({ small: 18, medium: 22, large: 28 }), paddingBottom: selectByDevice({ small: 10, medium: 16, large: 20 }) }}>
            {isTablet ? (
              <View style={{ maxWidth: 480, alignSelf: 'center', width: '100%', flex: 1 }}>
                {mainContent}
              </View>
            ) : (
              mainContent
            )}
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
  checkboxContainer: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default WelcomeScreen;
