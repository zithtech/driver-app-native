import React, { useRef, useState, useEffect } from 'react';
import {
  ScrollView,
  Text,
  Alert,
  StyleSheet,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Pressable,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { useTheme } from '@react-navigation/native';
import { useAlert } from '../../context/AlertContext';
import { useTranslation } from 'react-i18next';
import { useUpdateDriverMutation } from '../../service/driverApi';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useHaptic } from '../../hooks/useHaptic';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
  withRepeat,
} from 'react-native-reanimated';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../context/ThemeContext';
import { useResponsive } from '../../lib/scale';

import { Input } from '../../Components';
import { RootState } from '../../redux/store';
import { setUser } from '../../redux/userSlice';
import { Onboarding_Nav, HelpCenter_Nav } from '../../Navigations/navigations';
import { useLocation } from '../../hooks/useLocation';
import { ALL_CITIES, ALL_STATES, ALL_DISTRICTS } from '../../constant/cities';
import AppStatusBar from '../../Components/AppStatusBar';

const cleanStepText = (text: string) => (text ? text.replace(/\\n/g, '\n') : '');

/* ================= COMPONENT EXTRACTIONS ================= */
const Dot: React.FC<{ index: number }> = ({ index: _index }) => {
  const dotScale = useSharedValue(1);
  useEffect(() => {
    dotScale.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: 400 }),
        withTiming(1, { duration: 400 })
      ),
      -1,
      true
    );
  }, [dotScale]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale.value }],
    opacity: dotScale.value === 1 ? 0.4 : 1,
  }));

  return (
    <Animated.View
      style={[styles.dot, dotStyle, { marginHorizontal: 4 }]}
    />
  );
};

const DotLoader = () => {
  return (
    <View style={styles.loaderContainer}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} index={i} />
      ))}
    </View>
  );
};

/* ================= SCREEN ================= */
const AddressDetails: React.FC<any> = ({ navigation }) => {
  const dispatch = useDispatch();
  const theme = useTheme() as any;
  const { colors, fonts } = theme;
  const { isDark } = useAppTheme();
  const { showAlert } = useAlert();
  const { t, i18n } = useTranslation();
  const { triggerHaptic } = useHaptic();
  const user = useSelector((state: RootState) => state.userSlice.user);
  const { rs, rvs, rms, cs, selectByDevice, isSmallDevice, isTablet } = useResponsive();

  /* ---------------- STATE ---------------- */
  const [street, setStreet] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [district, setDistrict] = useState('');
  const [districtSuggestions, setDistrictSuggestions] = useState<string[]>([]);
  const [stateName, setStateName] = useState('Tamil Nadu');
  const [stateSuggestions, setStateSuggestions] = useState<string[]>([]);
  const [pincode, setPincode] = useState('');
  const [country] = useState('India');

  const [locationString, setLocationString] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ---------------- AUTOCOMPLETE ---------------- */
  const handleCityChange = (text: string) => {
    setCity(text);
    if (text.length > 1) {
      const filtered = ALL_CITIES.filter(c =>
        c.toLowerCase().includes(text.toLowerCase())
      ).slice(0, 5);
      setCitySuggestions(filtered);
    } else {
      setCitySuggestions([]);
    }
  };

  const handleStateChange = (text: string) => {
    setStateName(text);
    if (text.length > 0) {
      const filtered = ALL_STATES.filter(s =>
        s.toLowerCase().includes(text.toLowerCase())
      ).slice(0, 5);
      setStateSuggestions(filtered);
    } else {
      setStateSuggestions([]);
    }
  };

  const handleDistrictChange = (text: string) => {
    setDistrict(text);
    if (text.length > 1) {
      const filtered = ALL_DISTRICTS.filter(d =>
        d.toLowerCase().includes(text.toLowerCase())
      ).slice(0, 5);
      setDistrictSuggestions(filtered);
    } else {
      setDistrictSuggestions([]);
    }
  };

  const selectCitySuggestion = (suggestion: string) => {
    setCity(suggestion);
    setCitySuggestions([]);
    triggerHaptic(HapticFeedbackTypes.impactLight);
  };

  const selectStateSuggestion = (suggestion: string) => {
    setStateName(suggestion);
    setStateSuggestions([]);
    triggerHaptic(HapticFeedbackTypes.impactLight);
  };

  const selectDistrictSuggestion = (suggestion: string) => {
    setDistrict(suggestion);
    setDistrictSuggestions([]);
    triggerHaptic(HapticFeedbackTypes.impactLight);
  };

  /* ---------------- REFS ---------------- */
  const pinRef = useRef<any>(null);

  /* ---------------- SYNC WITH REDUX ---------------- */
  useEffect(() => {
    if (user?.address) {
      if (user.address.street) setStreet(user.address.street);
      if (user.address.landmark) setAddressLine2(user.address.landmark);
      if (user.address.city) setCity(user.address.city);
      if (user.address.district) setDistrict(user.address.district);
      if (user.address.state) setStateName(user.address.state);
      if (user.address.pincode) setPincode(user.address.pincode);
    }
  }, [user]);

  /* ---------------- ANIMATION ---------------- */
  const shakeOffset = useSharedValue(0);
  const locationScale = useSharedValue(1);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [updateDriver, { isLoading }] = useUpdateDriverMutation();
  const { getCurrentLocation, getAddressFromCoords, loading: locationLoading } = useLocation();

  const isFormValid = street.trim().length > 0 &&
    city.trim().length > 0 &&
    district.trim().length > 0 &&
    stateName.trim().length > 0 &&
    pincode.trim().length === 6;

  const triggerShake = () => {
    triggerHaptic(HapticFeedbackTypes.notificationError);
    shakeOffset.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-6, { duration: 50 }),
      withTiming(6, { duration: 50 }),
      withTiming(0, { duration: 50 })
    );
  };

  const animatedShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeOffset.value }],
  }));

  const locationAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: locationScale.value }],
  }));

  /* ---------------- LOCATION FETCH ---------------- */
  const handleGetCurrentLocation = async () => {
    try {
      const pos = await getCurrentLocation();
      const address = await getAddressFromCoords(pos.coords.latitude, pos.coords.longitude);

      if (pos?.coords) {
        setLocationString(`${pos.coords.latitude.toFixed(4)}° N, ${pos.coords.longitude.toFixed(4)}° E`);
      }

      if (address) {
        triggerHaptic(HapticFeedbackTypes.selection);
        setStreet(address.street || '');
        setCity(address.city || '');
        setDistrict(address.district || '');
        setStateName(address.state || '');
        setPincode(address.pincode || '');
      } else {
        showAlert({ title: t('error', 'Error'), message: t('fetch_address_error', 'Could not fetch address details.'), singleButton: true, icon: 'alert-circle-outline' });
      }
    } catch (error) {
      if (error === 'Permission denied') {
        showAlert({ title: t('permission_denied', 'Permission Denied'), message: t('enable_location_permissions', 'Please enable location permissions in your settings.'), singleButton: true, icon: 'alert-circle-outline' });
      } else {
        showAlert({ title: t('location_error', 'Location Error'), message: t('fetch_location_error', 'Could not fetch your current location.'), singleButton: true, icon: 'alert-circle-outline' });
      }
    }
  };

  /* ---------------- SUBMIT ---------------- */
  const handleSubmit = async () => {
    if (!user?.phone_number) {
      showAlert({ title: t('session_expired', 'Session Expired'), message: t('please_login_again', 'Please login again'), singleButton: true, icon: 'alert-circle-outline' });
      return;
    }

    if (!user?.driverId) {
      showAlert({ title: t('session_expired', 'Session Expired'), message: t('driver_id_missing_login', 'Driver ID missing, please login again'), singleButton: true, icon: 'alert-circle-outline' });
      return;
    }

    if (!street || !city || !district || !stateName || pincode.length !== 6) {
      triggerShake();
      return;
    }

    if (isSubmitting) { return; }
    setIsSubmitting(true);

    const payload = {
      address: {
        street,
        landmark: addressLine2,
        city,
        district: district || city, // Fallback if district isn't separated
        state: stateName,
        country: 'India',
        pincode,
      },
      language: user?.language || i18n.language || 'en',
    };

    try {
      const res = await updateDriver({
        id: user.driverId,
        data: payload,
      }).unwrap();

      const nextStatus = res?.data?.onboarding_status || 'ADDRESS_COMPLETED';
      dispatch(
        setUser({
          address: payload.address,
          onboarding_status: nextStatus,
        })
      );

      timeoutRef.current = setTimeout(() => {
        setIsSubmitting(false);
        triggerHaptic(HapticFeedbackTypes.notificationSuccess);
        navigation.reset({
          index: 0,
          routes: [{ name: Onboarding_Nav, params: { showCongrats: true } }],
        });
      }, 500);

    } catch (err: any) {
      setIsSubmitting(false);
      showAlert({
        title: t('update_failed', 'Update Failed'),
        message: t('update_address_failed', 'Failed to update address details. Please try again.'),
        singleButton: true,
        icon: 'alert-circle-outline',
      });
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); }
    };
  }, []);

  const Label = ({ text, required }: { text: string; required?: boolean }) => (
    <Text maxFontSizeMultiplier={1.25} style={[styles.labelText, { color: colors.text, fontSize: selectByDevice({ small: rms(11.5), medium: rms(12), large: rms(13) }) }]}>
      {text} {required && <Text style={{ color: '#EF4444' }}>*</Text>}
    </Text>
  );

  const renderScreenContent = () => (
    <>
      {/* PROGRESS BAR */}
      <View style={[styles.progressWrapper, {
        paddingTop: selectByDevice({ small: 8, medium: 12, large: 14 }),
        paddingBottom: selectByDevice({ small: 8, medium: 12, large: 14 }),
      }]}>
        <View style={[styles.progressLineContainer, { top: selectByDevice({ small: 19, medium: 23, large: 25 }) }]}>
          <View style={[styles.progressLine, { width: '66%', backgroundColor: colors.primary }]} />
          <View style={[styles.progressLine, { width: '34%', backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB' }]} />
        </View>
        <View style={styles.progressStepsRow}>
          {/* Step 1 */}
          <View style={styles.stepContainer}>
            <View style={[styles.stepCircle, { backgroundColor: colors.primary, borderColor: colors.primary, width: selectByDevice({ small: 22, medium: 26, large: 28 }), height: selectByDevice({ small: 22, medium: 26, large: 28 }), borderRadius: selectByDevice({ small: 11, medium: 13, large: 14 }) }]}>
              <Ionicons name="checkmark" size={selectByDevice({ small: 14, medium: 16, large: 18 })} color="#FFF" />
            </View>
            <Text numberOfLines={2} maxFontSizeMultiplier={1.2} style={[styles.stepText, { color: isDark ? '#9CA3AF' : '#9CA3AF', fontSize: selectByDevice({ small: rms(9), medium: rms(10), large: rms(11) }), lineHeight: selectByDevice({ small: rms(12), medium: rms(13), large: rms(14) }) }]}>
              {cleanStepText(t('mobile_details_step', 'Mobile\nDetails'))}
            </Text>
          </View>
          {/* Step 2 */}
          <View style={styles.stepContainer}>
            <View style={[styles.stepCircle, { backgroundColor: colors.primary, borderColor: colors.primary, width: selectByDevice({ small: 22, medium: 26, large: 28 }), height: selectByDevice({ small: 22, medium: 26, large: 28 }), borderRadius: selectByDevice({ small: 11, medium: 13, large: 14 }) }]}>
              <Ionicons name="checkmark" size={selectByDevice({ small: 14, medium: 16, large: 18 })} color="#FFF" />
            </View>
            <Text numberOfLines={2} maxFontSizeMultiplier={1.2} style={[styles.stepText, { color: isDark ? '#9CA3AF' : '#9CA3AF', fontSize: selectByDevice({ small: rms(9), medium: rms(10), large: rms(11) }), lineHeight: selectByDevice({ small: rms(12), medium: rms(13), large: rms(14) }) }]}>
              {cleanStepText(t('personal_details_step', 'Personal\nDetails'))}
            </Text>
          </View>
          {/* Step 3 */}
          <View style={styles.stepContainer}>
            <View style={[styles.stepCircle, { backgroundColor: colors.primary, borderColor: colors.primary, width: selectByDevice({ small: 22, medium: 26, large: 28 }), height: selectByDevice({ small: 22, medium: 26, large: 28 }), borderRadius: selectByDevice({ small: 11, medium: 13, large: 14 }) }]}>
              <Text maxFontSizeMultiplier={1.2} style={[styles.stepNumber, { color: '#FFF', fontSize: selectByDevice({ small: rms(11), medium: rms(12), large: rms(13) }) }]}>3</Text>
            </View>
            <Text numberOfLines={2} maxFontSizeMultiplier={1.2} style={[styles.stepText, { color: colors.primary, fontSize: selectByDevice({ small: rms(9), medium: rms(10), large: rms(11) }), lineHeight: selectByDevice({ small: rms(12), medium: rms(13), large: rms(14) }) }]}>
              {cleanStepText(t('address_details_step', 'Address\nDetails'))}
            </Text>
          </View>
          {/* Step 4 */}
          <View style={styles.stepContainer}>
            <View style={[styles.stepCircle, { backgroundColor: isDark ? colors.card : '#FFF', borderColor: isDark ? 'rgba(255,255,255,0.2)' : '#D1D5DB', width: selectByDevice({ small: 22, medium: 26, large: 28 }), height: selectByDevice({ small: 22, medium: 26, large: 28 }), borderRadius: selectByDevice({ small: 11, medium: 13, large: 14 }) }]}>
              <Text maxFontSizeMultiplier={1.2} style={[styles.stepNumber, { color: isDark ? '#9CA3AF' : '#9CA3AF', fontSize: selectByDevice({ small: rms(11), medium: rms(12), large: rms(13) }) }]}>4</Text>
            </View>
            <Text numberOfLines={2} maxFontSizeMultiplier={1.2} style={[styles.stepText, { color: isDark ? '#9CA3AF' : '#9CA3AF', fontSize: selectByDevice({ small: rms(9), medium: rms(10), large: rms(11) }), lineHeight: selectByDevice({ small: rms(12), medium: rms(13), large: rms(14) }) }]}>
              {cleanStepText(t('documents_upload_step', 'Documents\nUpload'))}
            </Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        enabled={Platform.OS === 'ios'}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { flexGrow: 1, paddingBottom: selectByDevice({ small: 20, medium: 32, large: 40 }) }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* HEADER SECTION */}
          <View style={[styles.headerSection, { paddingBottom: selectByDevice({ small: 8, medium: 12, large: 16 }) }]}>
            <View style={styles.headerTextContainer}>
              <Text maxFontSizeMultiplier={1.25} style={[styles.headerTitle, { color: colors.text, fontSize: selectByDevice({ small: rms(20), medium: rms(22), large: rms(24) }) }]}>{t('address_details_title', 'Address Details')}</Text>
              <Text maxFontSizeMultiplier={1.25} style={[styles.headerSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280', fontSize: selectByDevice({ small: rms(12), medium: rms(13), large: rms(14) }), lineHeight: selectByDevice({ small: rms(16), medium: rms(18), large: rms(20) }) }]}>
                {t('address_details_subtitle', 'Please enter your current address as per your proof of address.')}
              </Text>
            </View>
            <Image
              source={isDark ? require('../../assets/images/addressDarkmode.png') : require('../../assets/images/addressLightmode.png')}
              style={[styles.headerImage, { width: selectByDevice({ small: 44, medium: 52, large: 60 }), height: selectByDevice({ small: 44, medium: 52, large: 60 }) }]}
            />
          </View>

          {/* LOCATION CARD */}
          <Pressable
            onPress={handleGetCurrentLocation}
            disabled={locationLoading}
            onPressIn={() => {
              triggerHaptic(HapticFeedbackTypes.impactLight);
              locationScale.value = withSpring(0.97);
            }}
            onPressOut={() => { locationScale.value = withSpring(1); }}
          >
            <Animated.View style={[styles.locationCard, locationAnimatedStyle, isDark && { backgroundColor: theme.colors.card, borderColor: 'rgba(255,255,255,0.1)' }]}>
              <View style={styles.locationCardInner}>
                <View style={[styles.locationIconCircle, { backgroundColor: colors.primary }]}>
                  {locationLoading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Ionicons name="locate" size={selectByDevice({ small: 18, medium: 20, large: 22 })} color="#FFF" />
                  )}
                </View>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text maxFontSizeMultiplier={1.25} style={[styles.locationTitle, { color: colors.text, fontSize: selectByDevice({ small: rms(13), medium: rms(14), large: rms(15) }) }]} numberOfLines={1}>{t('use_current_location', 'Use Current Location')}</Text>
                  <Text maxFontSizeMultiplier={1.2} style={[styles.locationSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280', fontSize: selectByDevice({ small: rms(10.5), medium: rms(11), large: rms(11.5) }) }]} numberOfLines={2}>{t('detect_location_subtitle', 'Detect your current location and fill address automatically')}</Text>
                </View>
                <View style={[styles.locationActionBtn, { backgroundColor: colors.primary, height: selectByDevice({ small: 32, medium: 36, large: 38 }), minWidth: selectByDevice({ small: 54, medium: 60, large: 66 }) }]}>
                  {locationLoading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text maxFontSizeMultiplier={1.2} style={[styles.locationActionText, { color: '#FFF', fontSize: selectByDevice({ small: rms(11.5), medium: rms(12), large: rms(13) }) }]} numberOfLines={1}>{t('use', 'Use')}</Text>
                  )}
                </View>
              </View>

              {/* Location Success Banner */}
              {locationString !== '' && !locationLoading && (
                <View style={[styles.locationSuccessBanner, { backgroundColor: isDark ? 'rgba(5, 150, 105, 0.1)' : '#F0FDF4', borderTopColor: isDark ? 'rgba(5, 150, 105, 0.2)' : '#DCFCE7' }]}>
                  <Ionicons name="checkmark-circle-outline" size={16} color={isDark ? '#4ADE80' : '#059669'} />
                  <Text maxFontSizeMultiplier={1.2} style={[styles.locationSuccessText, { color: isDark ? '#4ADE80' : '#059669', fontSize: selectByDevice({ small: rms(11), medium: rms(11.5), large: rms(12) }) }]}>{t('location_detected_prefix', 'Location detected:')} {locationString}</Text>
                </View>
              )}
            </Animated.View>
          </Pressable>

          {/* FORM FIELDS */}
          <Animated.View style={animatedShakeStyle}>

            {/* ADDRESS LINE 1 */}
            <View style={styles.fieldBox}>
              <Label text={t('address_line_1', 'Address Line 1')} required />
              <Input
                value={street}
                autoCapitalize="words"
                placeholder={t('address_line_1_placeholder', 'House / Flat / Building, Street')}
                onChangeText={setStreet}
                inputContainerStyle={[styles.flatInputInner, { backgroundColor: isDark ? theme.colors.card : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB', height: selectByDevice({ small: cs(44, 0.9, 1.1), medium: cs(48, 0.9, 1.1), large: cs(50, 0.9, 1.1) }) }]}
                style={[styles.flatInput, { color: colors.text, fontSize: selectByDevice({ small: rms(12.5), medium: rms(13), large: rms(14) }) }]}
                placeholderTextColor="#9CA3AF"
                LeadingAccessory={
                  <Ionicons name="location-outline" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
                }
              />
            </View>

            {/* ADDRESS LINE 2 */}
            <View style={[styles.fieldBox, styles.mt, { marginTop: selectByDevice({ small: 10, medium: 14, large: 16 }) }]}>
              <Label text={t('address_line_2_optional', 'Address Line 2 (Optional)')} />
              <Input
                value={addressLine2}
                autoCapitalize="words"
                placeholder={t('address_line_2_placeholder', 'Area, Landmark, Nearby place')}
                onChangeText={setAddressLine2}
                inputContainerStyle={[styles.flatInputInner, { backgroundColor: isDark ? theme.colors.card : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB', height: selectByDevice({ small: cs(44, 0.9, 1.1), medium: cs(48, 0.9, 1.1), large: cs(50, 0.9, 1.1) }) }]}
                style={[styles.flatInput, { color: colors.text, fontSize: selectByDevice({ small: rms(12.5), medium: rms(13), large: rms(14) }) }]}
                placeholderTextColor="#9CA3AF"
                LeadingAccessory={
                  <Ionicons name="business-outline" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
                }
              />
            </View>

            {/* CITY & DISTRICT */}
            <View style={[styles.row, styles.mt, { marginTop: selectByDevice({ small: 10, medium: 14, large: 16 }) }]}>
              <View style={[styles.fieldBox, { flex: 1, zIndex: 10 }]}>
                <Label text={t('city_town', 'City / Town')} required />
                <Input
                  value={city}
                  placeholder={t('enter_city_town', 'Enter city / town')}
                  onChangeText={handleCityChange}
                  inputContainerStyle={[styles.flatInputInner, { backgroundColor: isDark ? theme.colors.card : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB', height: selectByDevice({ small: cs(44, 0.9, 1.1), medium: cs(48, 0.9, 1.1), large: cs(50, 0.9, 1.1) }) }]}
                  style={[styles.flatInput, { color: colors.text, fontSize: selectByDevice({ small: rms(12.5), medium: rms(13), large: rms(14) }) }]}
                  placeholderTextColor="#9CA3AF"
                  LeadingAccessory={
                    <Ionicons name="business-outline" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
                  }
                />
                {citySuggestions.length > 0 && (
                  <View style={[styles.suggestionBox, { backgroundColor: isDark ? theme.colors.card : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB' }]}>
                    {citySuggestions.map((item, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[styles.suggestionItem, { borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : '#F3F4F6' }]}
                        onPress={() => selectCitySuggestion(item)}
                      >
                        <Text style={[styles.suggestionText, { color: colors.text }]}>{item}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={[styles.fieldBox, { flex: 1, zIndex: 9 }]}>
                <Label text={t('district', 'District')} required />
                <Input
                  value={district}
                  placeholder={t('enter_district', 'Enter district')}
                  onChangeText={handleDistrictChange}
                  inputContainerStyle={[styles.flatInputInner, { backgroundColor: isDark ? theme.colors.card : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB', height: selectByDevice({ small: cs(44, 0.9, 1.1), medium: cs(48, 0.9, 1.1), large: cs(50, 0.9, 1.1) }) }]}
                  style={[styles.flatInput, { color: colors.text, fontSize: selectByDevice({ small: rms(12.5), medium: rms(13), large: rms(14) }) }]}
                  placeholderTextColor="#9CA3AF"
                  LeadingAccessory={
                    <Ionicons name="location-outline" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
                  }
                />
                {districtSuggestions.length > 0 && (
                  <View style={[styles.suggestionBox, { backgroundColor: isDark ? theme.colors.card : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB' }]}>
                    {districtSuggestions.map((item, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[styles.suggestionItem, { borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : '#F3F4F6' }]}
                        onPress={() => selectDistrictSuggestion(item)}
                      >
                        <Text style={[styles.suggestionText, { color: colors.text }]}>{item}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>

            {/* STATE & PINCODE */}
            <View style={[styles.row, styles.mt, { marginTop: selectByDevice({ small: 10, medium: 14, large: 16 }) }]}>
              <View style={[styles.fieldBox, { flex: 1, zIndex: 8 }]}>
                <Label text={t('state', 'State')} required />
                <Input
                  value={stateName}
                  placeholder={t('select_state', 'Select state')}
                  onChangeText={handleStateChange}
                  inputContainerStyle={[styles.flatInputInner, { backgroundColor: isDark ? theme.colors.card : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB', height: selectByDevice({ small: cs(44, 0.9, 1.1), medium: cs(48, 0.9, 1.1), large: cs(50, 0.9, 1.1) }) }]}
                  style={[styles.flatInput, { color: colors.text, fontSize: selectByDevice({ small: rms(12.5), medium: rms(13), large: rms(14) }) }]}
                  placeholderTextColor="#9CA3AF"
                  LeadingAccessory={
                    <Ionicons name="map-outline" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
                  }
                />
                {stateSuggestions.length > 0 && (
                  <View style={[styles.suggestionBox, { backgroundColor: isDark ? theme.colors.card : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB' }]}>
                    {stateSuggestions.map((item, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[styles.suggestionItem, { borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : '#F3F4F6' }]}
                        onPress={() => selectStateSuggestion(item)}
                      >
                        <Text style={[styles.suggestionText, { color: colors.text }]}>{item}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={[styles.fieldBox, { flex: 1 }]}>
                <Label text={t('pin_code', 'PIN Code')} required />
                <Input
                  ref={pinRef}
                  value={pincode}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder={t('enter_pin_code', 'Enter PIN code')}
                  onChangeText={v => setPincode(v.replace(/[^0-9]/g, ''))}
                  inputContainerStyle={[styles.flatInputInner, { backgroundColor: isDark ? theme.colors.card : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB', height: selectByDevice({ small: cs(44, 0.9, 1.1), medium: cs(48, 0.9, 1.1), large: cs(50, 0.9, 1.1) }) }]}
                  style={[styles.flatInput, { color: colors.text, fontSize: selectByDevice({ small: rms(12.5), medium: rms(13), large: rms(14) }) }]}
                  placeholderTextColor="#9CA3AF"
                  LeadingAccessory={
                    <Ionicons name="archive-outline" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
                  }
                />
              </View>
            </View>

          </Animated.View>

          {/* IMPORTANT ALERT BOX */}
          <View style={[styles.alertBox, { backgroundColor: isDark ? theme.colors.card : '#EFF6FF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#BFDBFE', borderWidth: isDark ? 1 : 0, marginVertical: selectByDevice({ small: 12, medium: 16, large: 20 }) }]}>
            <View style={[styles.alertIconWrapper, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#DBEAFE' }]}>
              <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
            </View>
            <View style={styles.alertTextWrapper}>
              <Text maxFontSizeMultiplier={1.25} style={[styles.alertTitle, { color: colors.text, fontSize: selectByDevice({ small: rms(13), medium: rms(14), large: rms(15) }) }]} numberOfLines={1} adjustsFontSizeToFit>{t('important', 'Important')}</Text>
              <Text maxFontSizeMultiplier={1.2} style={[styles.alertSubtitle, { color: isDark ? '#9CA3AF' : '#4B5563', fontSize: selectByDevice({ small: rms(11), medium: rms(11.5), large: rms(12) }) }]} numberOfLines={2} adjustsFontSizeToFit>{t('address_matches_documents', 'Please make sure the address matches your official documents.')}</Text>
            </View>
          </View>

          {/* SUPPORT CHAT BUTTON */}
          <TouchableOpacity style={[styles.chatButton, { backgroundColor: colors.primary, marginVertical: selectByDevice({ small: 12, medium: 16, large: 20 }) }]} activeOpacity={0.8} onPress={() => navigation.navigate(HelpCenter_Nav as never)}>
            <View style={[styles.chatIconWrapper, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : '#FFF' }]}>
              <Ionicons name="chatbubbles" size={16} color={isDark ? '#FFF' : colors.primary} />
            </View>
            <View style={styles.chatTextWrapper}>
              <Text maxFontSizeMultiplier={1.25} style={[styles.chatTitle, { fontSize: selectByDevice({ small: rms(13), medium: rms(14), large: rms(15) }) }]}>{t('start_chatting', 'Start Chatting')}</Text>
              <Text maxFontSizeMultiplier={1.25} style={[styles.chatSubtitle, { fontSize: selectByDevice({ small: rms(10.5), medium: rms(11), large: rms(12) }) }]}>{t('get_help_from_assistant', 'Get help from our assistant')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#FFF" />
          </TouchableOpacity>

        </ScrollView>

        {/* FOOTER BUTTON */}
        <View style={[styles.footer, { padding: selectByDevice({ small: 12, medium: 16, large: 20 }) }]}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleSubmit}
            disabled={!isFormValid || isSubmitting || isLoading}
            style={[
              styles.continueBtn,
              { backgroundColor: colors.primary, height: selectByDevice({ small: cs(48, 0.9, 1.1), medium: cs(52, 0.9, 1.1), large: cs(54, 0.9, 1.1) }) },
              (!isFormValid || isSubmitting || isLoading) && styles.continueBtnDisabled
            ]}
          >
            <Text maxFontSizeMultiplier={1.25} style={[styles.continueText, { fontSize: selectByDevice({ small: rms(16), medium: rms(17), large: rms(18) }) }]}>
              {isSubmitting || isLoading ? t('saving', 'Saving...') : t('save_and_continue', 'Save & Continue')}
            </Text>
            {!(isSubmitting || isLoading) && (
              <Ionicons name="arrow-forward" size={24} color="#FFF" style={styles.continueIcon} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: isDark ? colors.background : '#FFFFFF' }]}>
      <AppStatusBar />
      <SafeAreaView style={styles.root} edges={Platform.OS === 'ios' ? ['top', 'bottom'] : ['top']}>
        {isTablet ? (
          <View style={{ maxWidth: 480, alignSelf: 'center', width: '100%', flex: 1 }}>
            {renderScreenContent()}
          </View>
        ) : (
          renderScreenContent()
        )}
      </SafeAreaView>
    </View>
  );
};

export default AddressDetails;

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  root: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
  },

  /* --- PROGRESS BAR --- */
  progressWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    position: 'relative',
    marginBottom: 4,
  },
  progressLineContainer: {
    position: 'absolute',
    top: 23,
    left: 48,
    right: 48,
    height: 2,
    flexDirection: 'row',
    zIndex: 1,
  },
  progressLine: {
    height: '100%',
  },
  progressStepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  stepContainer: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 2,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  stepText: {
    fontSize: 10,
    lineHeight: 13,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '600',
  },

  /* --- HEADER --- */
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingRight: 10,
  },
  headerTextContainer: {
    flex: 1,
    paddingRight: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
  },
  headerImage: {
    width: 100,
    height: 70,
    resizeMode: 'contain',
  },

  /* --- LOCATION CARD --- */
  locationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  locationCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  locationIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0062FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 3,
  },
  locationSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 15,
  },
  locationActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  locationSuccessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#DCFCE7',
  },
  locationSuccessText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
    marginLeft: 6,
  },

  /* --- FORM FIELDS --- */
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  mt: {
    marginTop: 8,
  },
  fieldBox: {
    width: '100%',
  },
  labelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginLeft: 2,
  },
  flatInputInner: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  flatInput: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
    paddingVertical: 0,
    backgroundColor: 'transparent',
  },

  /* --- ALERT BOX --- */
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
    marginBottom: 8,
  },
  alertIconWrapper: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  alertTextWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  alertSubtitle: {
    fontSize: 11,
    color: '#4B5563',
  },

  /* --- FOOTER BUTTON --- */
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: 'transparent',
  },
  continueBtn: {
    backgroundColor: '#0062FF',
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueBtnDisabled: {
    backgroundColor: '#93C5FD',
  },
  continueText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  continueIcon: {
    position: 'absolute',
    right: 20,
  },

  /* --- AUTOCOMPLETE --- */
  suggestionBox: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 99,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  suggestionText: {
    fontSize: 13,
    color: '#111827',
  },
  loaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  chatButton: {
    backgroundColor: '#0062FF',
    marginBottom: 4,
    marginTop: 8,
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatIconWrapper: {
    backgroundColor: '#FFF',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  chatTextWrapper: {
    flex: 1,
  },
  chatTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  chatSubtitle: {
    color: '#E0E7FF',
    fontSize: 10,
  },
});
