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
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useHaptic } from '../../hooks/useHaptic';
import i18n from '../../i18n/i18n';

import { Input, LanguageSelector } from '../../Components';
import Button from '../../Components/Button';

import vdriveImg from '../../assets/images/wee.png';

import { OTPScreen_Nav } from '../../Navigations/navigations';
import { setUser } from '../../redux/userSlice';
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
      entering={FadeInLeft.delay(300).duration(1000)}
      style={[styles.blob, { top: -50, left: -50, backgroundColor: colors.primary + '15' }]}
    />
    <Reanimated.View
      entering={FadeInUp.delay(500).duration(1000)}
      style={[styles.blob, { bottom: -100, right: -50, width: 300, height: 300, backgroundColor: colors.primary + '10' }]}
    />
  </View>
);


const WelcomeScreen = ({ navigation }: any) => {
  const { colors, fonts, dark } = useTheme() as any;
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

  const buttonScale = useSharedValue(1);

  const [sendOtp, { isLoading }] = useSendOtpMutation();
  const [applyReferralCode, { isLoading: isCheckingReferral }] = useApplyReferralCodeMutation();

  /* ================= DEVICE ID ================= */
  useEffect(() => {
    const loadDeviceId = async () => {
      try {
        const id = await getDeviceId();
        setDeviceId(id);
      } catch (e) {
        console.log('DEVICE ID ERROR:', e);
      }
    };
    loadDeviceId();
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
      hasError ? '#EF4444' : isFocused ? colors.primary : colors.background === '#FFFFFF' ? '#9CA3AF' : 'rgba(255,255,255,0.3)',
      { duration: 250 }
    ),
    transform: [{ scale: withSpring(isFocused ? 1.01 : 1) }],
    backgroundColor: '#FFFFFF',
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
      await sendOtp({
        phone_number: mobileNumber,
        role: 'driver',
        device_id: deviceId,
        allow_new_device: true,
      }).unwrap();

      dispatch(setUser({ phone_number: mobileNumber, referred_by: referralCode || undefined }));
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

      {/* HEADER: LOGO & LANGUAGE SELECTOR */}
      <Reanimated.View 
        entering={FadeInDown.delay(100).duration(600)}
        style={styles.headerContainer}
      >
        <View style={styles.logoWrapper}>
          <Logo width={52} height={52} />
        </View>
        <LanguageSelector variant={dark ? 'dark' : 'light'} />
      </Reanimated.View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View
            style={{ flex: 1, padding: 24 }}
          >
            {/* HEADER */}
            <Reanimated.View
              entering={FadeInDown.delay(400).duration(600)}
              style={{ alignItems: 'center', marginTop: 0 }}
            >
              <Text 
                adjustsFontSizeToFit
                numberOfLines={2}
                style={[fonts.bold, { fontSize: 26,fontWeight:'900' , color: colors.text, textAlign: 'center' }]}
              >
                {t('lets_get_on_road')}
              </Text>
              <Text 
                adjustsFontSizeToFit
                numberOfLines={1}
                style={{ fontSize: 14, opacity: 0.6, color: colors.text, marginTop: 4 }}
              >
                {t('start_earning')}
              </Text>
            </Reanimated.View>

            {/* IMAGE */}
            {!isKeyboardVisible && (
              <Reanimated.View entering={FadeInUp.delay(600).duration(800)}>
                <Image
                  source={vdriveImg}
                  style={{ width: '100%', height: 220, marginVertical: -4 }}
                  resizeMode="contain"
                />
              </Reanimated.View>
            )}

            {/* REFERRAL CODE (TOGGLEABLE) */}
            <Reanimated.View 
              entering={FadeInDown.delay(800).duration(600)} 
              style={{ marginTop: 20, width: '100%' }}
            >
              <Pressable 
                onPress={() => {
                  setIsReferralVisible(!isReferralVisible);
                  triggerHaptic(HapticFeedbackTypes.impactLight);
                }}
                style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  paddingVertical: 8,
                  marginLeft: 4
                }}
              >
                <Text style={[fonts.medium, { fontSize: 15, color: colors.primary, fontWeight: '600' }]}>
                  {t('have_referral_code')}
                </Text>
                <MaterialIcons 
                  name={isReferralVisible ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
                  size={20} 
                  color={colors.primary} 
                  style={{ marginLeft: 4 }}
                />
              </Pressable>
              
              {isReferralVisible && (
                <Reanimated.View 
                  entering={FadeInDown.duration(400)}
                  style={{ marginTop: 12, alignItems: 'flex-start', width: '100%' }}
                >
                  <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <Reanimated.View
                      style={{
                        borderWidth: 1.5,
                        borderColor: referralCodeStatus === 'valid' ? '#10B981' : referralCodeStatus === 'invalid' ? '#EF4444' : colors.primary + '40',
                        borderRadius: 16,
                        paddingHorizontal: 16,
                        backgroundColor: '#FFFFFF',
                        height: 45,
                        flex: 1,
                        justifyContent: 'center',
                      }}
                    >
                      <Input
                        value={referralCode}
                        placeholder={t('referral_code_placeholder')}
                        autoCapitalize="characters"
                        maxLength={20}
                        onChangeText={(text: string) => {
                          setReferralCode(text.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                          setReferralCodeStatus('idle');
                          setReferralError('');
                          setReferralMessage('');
                        }}
                        containerStyle={{ backgroundColor: 'transparent', width: '100%' }}
                        inputContainerStyle={{ borderWidth: 0, backgroundColor: 'transparent', height: '100%', paddingHorizontal: 0 }}
                        style={{
                          color: colors.text,
                          fontSize: 16,
                          fontWeight: '600',
                          letterSpacing: 2,
                          backgroundColor: 'transparent',
                          paddingVertical: 0,
                          textAlign: 'center',
                        }}
                        placeholderTextColor={colors.text + '40'}
                      />
                    </Reanimated.View>

                    <Pressable
                      onPress={handleCheckReferral}
                      disabled={isCheckingReferral || !referralCode}
                      style={{
                        marginLeft: 12,
                        backgroundColor: referralCodeStatus === 'valid' ? '#10B981' : colors.primary,
                        paddingHorizontal: 16,
                        height: 45, // Matched height with input
                        borderRadius: 16,
                        justifyContent: 'center',
                        alignItems: 'center',
                        opacity: (!referralCode || isCheckingReferral) ? 0.6 : 1,
                      }}
                    >
                      {isCheckingReferral ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text 
                          adjustsFontSizeToFit
                          numberOfLines={1}
                          style={{ color: '#FFF', fontWeight: 'bold' }}
                        >
                          {referralCodeStatus === 'valid' ? '✓' : t('check')}
                        </Text>
                      )}
                    </Pressable>
                  </View>

                  {referralCodeStatus === 'invalid' && (
                    <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 4, marginLeft: 8 }}>
                      {referralError || t('invalid_referral_code')}
                    </Text>
                  )}

                  {referralCodeStatus === 'valid' && (
                    <Text style={{ color: '#10B981', fontSize: 12, marginTop: 4, marginLeft: 8 }}>
                      {referralMessage || t('referral_applied')}
                    </Text>
                  )}
                </Reanimated.View>
              )}
            </Reanimated.View>

            {/* INPUT SECTION */}
            <Reanimated.View entering={FadeInDown.delay(900).duration(600)} style={{ marginTop: 24 }}>
              <Text style={[fonts.regular, { fontSize: 16, marginBottom: 8, color: colors.text, marginLeft: 4 }]}>
                {t('enter_mobile')}
              </Text>

              <View>
                <Reanimated.View
                  style={[
                    styles.glassInputContainer,
                    inputAnimatedStyle,
                    {
                      borderWidth: 1.5,
                      shadowColor: isFocused ? colors.primary : '#000',
                      shadowOffset: { width: 0, height: isFocused ? 4 : 2 },
                      shadowOpacity: isFocused ? 0.2 : 0.05,
                      shadowRadius: isFocused ? 10 : 4,

                    }
                  ]}
                >
                  {/* INDIA FLAG + CODE */}
                  <View style={styles.countryCode}>
                    <Text style={{ fontSize: 20, marginRight: 8 }}>🇮🇳</Text>
                    <Text style={[fonts.bold, { fontSize: 17, color: colors.text }]}>+91</Text>
                  </View>

                  <View style={[styles.divider, { backgroundColor: colors.text + '20' }]} />

                  {/* MOBILE INPUT */}
                  <Input
                    value={mobileNumber}
                    keyboardType="phone-pad"
                    maxLength={10}
                    placeholder={t('mobile_placeholder')}
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
                    }}
                    inputContainerStyle={{
                      borderWidth: 0,
                      backgroundColor: 'transparent',
                      height: '100%',
                      paddingHorizontal: 0,
                    }}
                    style={{
                      color: colors.text,
                      fontSize: 18,
                      fontWeight: mobileNumber ? '600' : '400',
                      letterSpacing: mobileNumber ? 1 : 0,
                      backgroundColor: 'transparent',
                      paddingVertical: 0,
                      textAlignVertical: 'center',
                    }}
                    placeholderTextColor={colors.text + '30'}
                  />
                </Reanimated.View>
              </View>

              {/* ERROR TEXT */}
              {hasError && (
                <Reanimated.Text
                  entering={FadeInDown}
                  style={{ color: '#EF4444', fontSize: 13, marginTop: 8, marginLeft: 8 }}
                >
                  {t('valid_mobile_error')}
                </Reanimated.Text>
              )}
            </Reanimated.View>

            {/* BUTTON */}
            <Reanimated.View entering={FadeInUp.delay(1000).duration(600)}>
              <Reanimated.View style={btnAnimatedStyle}>
                <Button
                  style={{
                    marginTop: 16,
                    height: 52,
                    borderRadius: 20,
                    backgroundColor: colors.primary,
                    elevation: 6,
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.4,
                    shadowRadius: 12,
                  }}
                  onPress={handleContinue}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                      <Text 
                        adjustsFontSizeToFit
                        numberOfLines={1}
                        style={[fonts.bold, { color: '#FFF', fontSize: 20 }]}
                      >
                        {t('get_otp')}
                      </Text>
                  )}
                </Button>
              </Reanimated.View>
            </Reanimated.View>

            {/* FOOTER */}
            <Reanimated.View
              entering={FadeInUp.delay(1200).duration(600)}
              style={{ marginTop: 11, marginBottom: 20 }}
            >
              <Text style={styles.footerText}>
                {t('agree_terms_prefix')}
                <Text style={{ color: colors.primary, fontWeight: '700' }}>{t('terms')}</Text>
                {t('and')}
                <Text style={{ color: colors.primary, fontWeight: '700' }}>{t('privacy_policy')}</Text>
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
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
});

export default WelcomeScreen;
