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
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { useTheme } from '@react-navigation/native';
import { useAlert } from '../../context/AlertContext';
import { useTranslation } from 'react-i18next';
import { useUpdateDriverMutation } from '../../service/driverApi';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useHaptic } from '../../hooks/useHaptic';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withRepeat,
} from 'react-native-reanimated';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { Input, PremiumAddressIcon } from '../../Components';
import { RootState } from '../../redux/store';
import { setUser } from '../../redux/userSlice';
import { Onboarding_Nav } from '../../Navigations/navigations';
import { useLocation } from '../../hooks/useLocation';
import { ALL_CITIES, ALL_STATES } from '../../constant/cities';
import AppStatusBar from '../../Components/AppStatusBar';


/* ================= COMPONENT EXTRACTIONS ================= */
const SuccessIcon = () => (
  <View style={{ marginRight: 4 }}>
    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
  </View>
);

const Dot = ({ index: _index }: { index: number }) => {
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
  const { colors, fonts } = useTheme() as any;
  const { showAlert } = useAlert();
  const { t, i18n } = useTranslation();
  const { triggerHaptic } = useHaptic();
  const user = useSelector((state: RootState) => state.userSlice.user);

  const handleCityChange = (text: string) => {
    setCity(text);
    if (text.length > 1) {
      const filtered = ALL_CITIES.filter(c => 
        c.toLowerCase().includes(text.toLowerCase())
      ).slice(0, 5); // Show top 5 suggestions
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
  /* ---------------- STATE ---------------- */
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [stateName, setStateName] = useState('Tamil Nadu');
  const [stateSuggestions, setStateSuggestions] = useState<string[]>([]);
  const [pincode, setPincode] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ---------------- REFS ---------------- */
  const pinRef = useRef<any>(null);

  /* ---------------- SYNC WITH REDUX ---------------- */
  useEffect(() => {
    if (user?.address) {
      if (user.address.street) setStreet(user.address.street);
      if (user.address.city) setCity(user.address.city);
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

      if (address) {
        triggerHaptic(HapticFeedbackTypes.selection);
        setStreet(address.street || '');
        setCity(address.city || '');
        setStateName(address.state || '');
        setPincode(address.pincode || '');
      } else {
        showAlert({ title: 'Error', message: 'Could not fetch address details.', singleButton: true, icon: 'alert-circle-outline' });
      }
    } catch (error) {
      if (error === 'Permission denied') {
        showAlert({ title: 'Permission Denied', message: 'Please enable location permissions in your settings.', singleButton: true, icon: 'alert-circle-outline' });
      } else {
        showAlert({ title: 'Location Error', message: 'Could not fetch your current location.', singleButton: true, icon: 'alert-circle-outline' });
      }
    }
  };




  /* ---------------- SUBMIT ---------------- */
  const handleSubmit = async () => {
    if (!user?.phone_number) {
      showAlert({ title: 'Session Expired', message: 'Please login again', singleButton: true, icon: 'alert-circle-outline' });
      return;
    }

    if (!user?.date_of_birth) {
      showAlert({ title: 'Error', message: 'Date of birth missing', singleButton: true, icon: 'alert-circle-outline' });
      return;
    }

    if (!user?.driverId) {
      showAlert({ title: 'Session Expired', message: 'Driver ID missing, please login again', singleButton: true, icon: 'alert-circle-outline' });
      return;
    }

    if (!street || !city || !stateName || pincode.length !== 6) {
      showAlert({
        title: 'Validation',
        message: 'Please fill all address fields correctly',
        singleButton: true,
        icon: 'information-circle-outline',
      });
      triggerShake();
      return;
    }

    if (isSubmitting) { return; }
    setIsSubmitting(true);

    const payload = {
      address: {
        street,
        city,
        state: stateName,
        country: 'India',
        pincode,
      },
      language: user?.language || i18n.language || 'en', // Maintain language persistence on backend
    };

    try {
      const res = await updateDriver({
        id: user.driverId,
        data: payload,
      }).unwrap();

      // ✅ Sync address + status to Redux (backend auto-upgrades to ADDRESS_COMPLETED)
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
        title: 'Update Failed',
        message: 'Failed to update address details. Please try again.',
        singleButton: true,
        icon: 'alert-circle-outline',
      });
    }
  };


  /* ---------------- CLEANUP ---------------- */
  useEffect(() => {
    return () => {
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); }
    };
  }, []);

  /* ---------------- UI ---------------- */
  return (
    <View style={styles.container}>
      <AppStatusBar />


      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          {/* PROGRESS */}
          <Animated.View
            style={styles.progressHeader}
          >
            <View style={styles.progressContainer}>
              {[1, 2, 3, 4].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.progressBar,
                    { backgroundColor: i <= 3 ? '#2563EB' : '#E5E7EB' }
                  ]}
                />
              ))}
            </View>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressText}>
                {t('step_address_label', 'Address Details')} <Text style={styles.activeProgressText}>• {t('step_3_of_4')}</Text>
              </Text>
            </View>
          </Animated.View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >

            {/* HEADER */}
            <View style={styles.headerSection}>
              <Text style={styles.title}>
                {t('address_title_line1', 'What is your')}
              </Text>
              <Text style={styles.titleItalic}>
                {t('address_title_line2', 'Home address?')}
              </Text>
              <Text style={styles.subtitle}>
                {t('address_subtitle', "This helps us verify your profile and connect with us for security purposes.")}
              </Text>
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
              <Animated.View style={[styles.locationCard, locationAnimatedStyle]}>
                <View style={styles.locationIconCircle}>
                  {locationLoading ? (
                    <ActivityIndicator size="small" color="#D97706" />
                  ) : (
                    <Ionicons name="locate" size={22} color="#D97706" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.locationTitle} numberOfLines={1} adjustsFontSizeToFit>{t('use_current_location')}</Text>
                  <Text style={styles.locationSubtitle} numberOfLines={1} adjustsFontSizeToFit>{t('auto_fills_gps', 'Auto-fills the form via GPS')}</Text>
                </View>
                <Text style={styles.locationAllow}>{locationLoading ? '' : t('allow', 'Allow')}</Text>
              </Animated.View>
            </Pressable>

            {/* DIVIDER */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText} numberOfLines={1} adjustsFontSizeToFit>{t('or_enter_manually', 'OR ENTER MANUALLY')}</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* FORM FIELDS */}
            <Animated.View style={animatedShakeStyle}>
              {/* STREET */}
              <View style={styles.fieldBox}>
                <View style={styles.fieldLabelRow}>
                  <Ionicons name="home-outline" size={17} color="#111827" />
                  <Text style={styles.fieldLabel}>{t('street').toUpperCase()} <Text style={styles.requiredStar}>*</Text></Text>
                </View>
                <Input
                  value={street}
                  scrollable={true}
                  autoCapitalize="words"
                  placeholder="House no, building, street"
                  onChangeText={setStreet}
                  onFocus={() => triggerHaptic(HapticFeedbackTypes.impactLight)}
                  containerStyle={styles.flatInputContainer}
                  inputContainerStyle={styles.flatInputInner}
                  style={styles.flatInput}
                  placeholderTextColor="#6B7280"
                />
              </View>

              {/* CITY / TOWN */}
              <View style={[styles.fieldBox, { zIndex: 100 }]}>
                <View style={styles.fieldLabelRow}>
                  <Ionicons name="business-outline" size={17} color="#111827" />
                  <Text style={styles.fieldLabel}>{t('city').toUpperCase()} <Text style={styles.requiredStar}>*</Text></Text>
                </View>
                <Input
                  value={city}
                  scrollable={true}
                  placeholder="e.g. Bengaluru"
                  onChangeText={handleCityChange}
                  onFocus={() => triggerHaptic(HapticFeedbackTypes.impactLight)}
                  containerStyle={styles.flatInputContainer}
                  inputContainerStyle={styles.flatInputInner}
                  style={styles.flatInput}
                  placeholderTextColor="#6B7280"
                />
                
                {citySuggestions.length > 0 && (
                  <View style={styles.suggestionBox}>
                    {citySuggestions.map((item, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.suggestionItem}
                        onPress={() => selectCitySuggestion(item)}
                      >
                        <Text style={styles.suggestionText}>{item}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* STATE + PINCODE ROW */}
              <View style={styles.row}>
                <View style={[styles.fieldBox, { flex: 1, zIndex: 90 }]}>
                  <View style={styles.fieldLabelRow}>
                    <Ionicons name="map-outline" size={17} color="#111827" />
                    <Text style={styles.fieldLabel}>{t('state').toUpperCase()} <Text style={styles.requiredStar}>*</Text></Text>
                  </View>
                  <Input
                    value={stateName}
                    scrollable={true}
                    placeholder="State"
                    onChangeText={handleStateChange}
                    onFocus={() => triggerHaptic(HapticFeedbackTypes.impactLight)}
                    containerStyle={styles.flatInputContainer}
                    inputContainerStyle={styles.flatInputInner}
                    style={styles.flatInput}
                    placeholderTextColor="#6B7280"
                  />
                  
                  {stateSuggestions.length > 0 && (
                    <View style={styles.suggestionBox}>
                      {stateSuggestions.map((item, index) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.suggestionItem}
                          onPress={() => selectStateSuggestion(item)}
                        >
                          <Text style={styles.suggestionText}>{item}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                <View style={[styles.fieldBox, { flex: 1 }]}>
                  <View style={styles.fieldLabelRow}>
                    <Text style={[styles.hashIcon, { fontSize: 17, color: '#111827' }]}>#</Text>
                    <Text style={styles.fieldLabel}>{t('pincode').toUpperCase()} <Text style={styles.requiredStar}>*</Text></Text>
                  </View>
                  <Input
                    ref={pinRef}
                    value={pincode}
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder="e.g. 560001"
                    onChangeText={v => setPincode(v.replace(/[^0-9]/g, ''))}
                    onFocus={() => triggerHaptic(HapticFeedbackTypes.impactLight)}
                    containerStyle={styles.flatInputContainer}
                    inputContainerStyle={styles.flatInputInner}
                    style={styles.flatInput}
                    placeholderTextColor="#6B7280"
                  />
                  {pincode.length > 0 && pincode.length < 6 && (
                    <Text style={styles.errorText}>{t('enter_valid_pincode')}</Text>
                  )}
                </View>
              </View>
            </Animated.View>
          </ScrollView>

          {/* FOOTER */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!isFormValid || isSubmitting || isLoading}
              activeOpacity={0.8}
              style={[
                styles.ctaButton,
                isFormValid && { backgroundColor: colors.primary },
                (!isFormValid || isSubmitting || isLoading) && styles.ctaDisabled,
              ]}
            >
              <Text style={styles.ctaText} numberOfLines={1} adjustsFontSizeToFit>
                {isSubmitting || isLoading ? <DotLoader /> : t('verify_and_continue', 'Verify & Continue')}
              </Text>
            </TouchableOpacity>
            <Text style={styles.securityNote} numberOfLines={1} adjustsFontSizeToFit>
              {t('footer_encrypted', '🔒 Your details are encrypted and used for verification only')}
            </Text>
          </View>
        </KeyboardAvoidingView>


      </SafeAreaView>
    </View>
  );
};

export default AddressDetails;

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  stateCol: {
    flex: 2,
  },
  pinCol: {
    flex: 1,
  },
  root: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
  },
  progressHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    marginBottom: 4,
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 6,
    height: 4,
  },
  progressBar: {
    flex: 1,
    height: '100%',
    borderRadius: 2,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeProgressText: {
    color: '#2563EB',
  },
  headerSection: {
    marginBottom: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 32,
  },
  titleItalic: {
    fontSize: 26,
    fontWeight: '700',
    fontStyle: 'italic',
    color: '#111827',
    lineHeight: 32,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 19,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
    gap: 12,
  },
  locationIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  locationSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1,
  },
  locationAllow: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 1.5,
  },
  fieldBox: {
    marginBottom: 18,
    width: '100%',
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingLeft: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  requiredStar: {
    color: '#D97706',
    fontSize: 12,
    fontWeight: '700',
  },
  hashIcon: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: -1,
  },
  flatInputContainer: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    width: '100%',
  },
  flatInputInner: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 54,
  },
  flatInput: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
    paddingVertical: 0,
    backgroundColor: 'transparent',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
  },
  ctaButton: {
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#D1D5DB',
  },
  ctaDisabled: {
    backgroundColor: '#D1D5DB',
    opacity: 0.7,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 2,
    marginLeft: 4,
    marginBottom: 4,
  },
  securityNote: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '500',
  },
  suggestionBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  suggestionText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '100%',
    height: '80%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 12,
  },
  modalHeader: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  cityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    gap: 16,
  },
  cityText: {
    fontSize: 16,
  },
  citySubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  customCityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
  },
});
