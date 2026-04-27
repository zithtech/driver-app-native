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

  /* ---------------- STATE ---------------- */
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('Tamil Nadu');
  const [pincode, setPincode] = useState('');
  const [showCityModal, setShowCityModal] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [showStateModal, setShowStateModal] = useState(false);
  const [stateSearch, setStateSearch] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ---------------- REFS (AUTO FOCUS) ---------------- */
  const cityRef = useRef<any>(null);
  const stateRef = useRef<any>(null);
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

  /* ---------------- CITY SELECTION ---------------- */
  const filteredCities = ALL_CITIES.filter(c =>
    c.toLowerCase().includes(citySearch.toLowerCase())
  );

  const showCustomCityOption = citySearch.trim().length > 0 &&
    !filteredCities.some(c => c.toLowerCase() === citySearch.toLowerCase());

  const handleSelectCity = (selectedCity: string) => {
    setCity(selectedCity);
    setShowCityModal(false);
    setCitySearch('');
    triggerHaptic(HapticFeedbackTypes.selection);
  };

  const filteredStates = ALL_STATES.filter(s =>
    s.toLowerCase().includes(stateSearch.toLowerCase())
  );

  const handleSelectState = (selectedState: string) => {
    setStateName(selectedState);
    setShowStateModal(false);
    setStateSearch('');
    triggerHaptic(HapticFeedbackTypes.selection);
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
      <LinearGradient
        colors={['#E0E7FF', '#F3F4F6', '#FFFFFF']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* PROGRESS */}
            <Animated.View entering={FadeInDown.delay(200).duration(800)} style={styles.progressHeader}>
              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: '75%' }]} />
              </View>
              <Text style={styles.progressText}>{t('step_3_of_4')}</Text>
            </Animated.View>

            {/* HEADER SECTION */}
            <View style={styles.headerRow}>
              <PremiumAddressIcon size={60} />
              <View style={styles.titleContainer}>
                <Text 
                  adjustsFontSizeToFit 
                  numberOfLines={1} 
                  style={styles.title}
                >
                  {t('confirm_address_title')}
                </Text>
                <Text 
                  adjustsFontSizeToFit 
                  numberOfLines={2} 
                  style={styles.subtitle}
                >
                  {t('confirm_address_subtitle')}
                </Text>
              </View>
            </View>

            <Animated.View entering={FadeInDown.delay(400).duration(800)}>
              <Animated.View
                style={[
                  styles.card,
                  animatedShakeStyle,
                ]}
              >
                {/* PREMIUM LOCATION BUTTON */}
                <Pressable
                  onPress={handleGetCurrentLocation}
                  disabled={locationLoading}
                  onPressIn={() => {
                    triggerHaptic(HapticFeedbackTypes.impactLight);
                    locationScale.value = withSpring(0.96);
                  }}
                  onPressOut={() => {
                    locationScale.value = withSpring(1);
                  }}
                >
                  <Animated.View style={[
                    styles.locationBtn,
                    locationAnimatedStyle,
                    { backgroundColor: colors.primary + '0A', borderColor: colors.primary + '20' }
                  ]}>
                    {locationLoading ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Ionicons name="locate" size={20} color={colors.primary} />
                    )}
                    <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.locationBtnText, { color: colors.primary }]}>
                      {locationLoading ? t('fetching_location') : t('use_current_location')}
                    </Text>
                  </Animated.View>
                </Pressable>

                <Input
                  label={t('street')}
                  value={street}
                  scrollable={true}
                  autoCapitalize="words"
                  onChangeText={setStreet}
                  onFocus={() => triggerHaptic(HapticFeedbackTypes.impactLight)}
                  onBlur={() => {
                    if (!street.trim()) triggerShake();
                  }}
                  LeadingAccessory={<Ionicons name="home-outline" size={20} color="#9CA3AF" />}
                  TailingAccessory={street.trim().length > 0 ? <SuccessIcon /> : null}
                />
                <Text style={styles.helper}>{t('street_helper')}</Text>

                <View style={styles.mt4}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      setCitySearch(city);
                      setShowCityModal(true);
                      triggerHaptic(HapticFeedbackTypes.impactLight);
                    }}
                  >
                    <View pointerEvents="none">
                      <Input
                        label={t('city')}
                        value={city}
                        scrollable={true}
                        placeholder={t('select_city')}
                        editable={false}
                        LeadingAccessory={<Ionicons name="business-outline" size={20} color="#9CA3AF" />}
                        TailingAccessory={
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {city.trim().length > 0 && <SuccessIcon />}
                            <Ionicons name="chevron-down" size={20} color="#9CA3AF" style={{ marginLeft: 8 }} />
                          </View>
                        }
                      />
                    </View>
                  </TouchableOpacity>
                  <Text style={styles.helper}>{t('city_helper')}</Text>
                </View>

                <View style={styles.mt4}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      setStateSearch(stateName);
                      setShowStateModal(true);
                      triggerHaptic(HapticFeedbackTypes.impactLight);
                    }}
                  >
                    <View pointerEvents="none">
                      <Input
                        label={t('state')}
                        value={stateName}
                        scrollable={true}
                        placeholder={t('select_state')}
                        editable={false}
                        LeadingAccessory={<Ionicons name="map-outline" size={20} color="#9CA3AF" />}
                        TailingAccessory={
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {stateName.trim().length > 0 && <SuccessIcon />}
                            <Ionicons name="chevron-down" size={20} color="#9CA3AF" style={{ marginLeft: 8 }} />
                          </View>
                        }
                      />
                    </View>
                  </TouchableOpacity>
                  <Text style={styles.helper}>{t('state_helper')}</Text>
                </View>

                <View style={styles.mt4}>
                  <Input
                    ref={pinRef}
                    label={t('pincode')}
                    value={pincode}
                    keyboardType="number-pad"
                    maxLength={6}
                    onChangeText={v => setPincode(v.replace(/[^0-9]/g, ''))}
                    onFocus={() => triggerHaptic(HapticFeedbackTypes.impactLight)}
                    onBlur={() => {
                      if (pincode.length !== 6) triggerShake();
                    }}
                    LeadingAccessory={<Ionicons name="location-outline" size={20} color="#9CA3AF" />}
                    TailingAccessory={pincode.length === 6 ? <SuccessIcon /> : null}
                  />
                  {pincode.length > 0 && pincode.length < 6 && (
                    <Text style={styles.errorText}>{t('enter_valid_pincode')}</Text>
                  )}
                </View>
              </Animated.View>
            </Animated.View>
          </ScrollView>

          {/* FOOTER */}
          <View style={[styles.footer, { backgroundColor: colors.background }]}>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting || isLoading}
              activeOpacity={0.8}
              style={[
                styles.ctaButton,
                { backgroundColor: colors.primary, shadowColor: colors.primary },
                (isSubmitting || isLoading) && styles.ctaDisabled,
              ]}
            >
              <Text 
                adjustsFontSizeToFit 
                numberOfLines={1} 
                style={styles.ctaText}
              >
                {isSubmitting || isLoading ? <DotLoader /> : t('complete_registration')}
              </Text>
            </TouchableOpacity>
            <Text 
              adjustsFontSizeToFit 
              numberOfLines={2} 
              style={styles.footerInfo}
            >
              <Ionicons name="shield-checkmark" size={12} color="#6B7280" /> {t('footer_encrypted')}
            </Text>
          </View>
        </KeyboardAvoidingView>

        <Modal
          visible={showCityModal}
          animationType="slide"
          transparent={true}
          onShow={() => {
            setTimeout(() => {
              cityRef.current?.focus();
            }, 600);
          }}
          onRequestClose={() => setShowCityModal(false)}
        >
          <View style={styles.modalOverlay}>
            <Animated.View
              entering={FadeIn.duration(300)}
              exiting={FadeOut.duration(200)}
              style={styles.modalBackdrop}
            >
              <TouchableOpacity
                activeOpacity={1}
                style={{ flex: 1 }}
                onPress={() => setShowCityModal(false)}
              />
            </Animated.View>

            <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHandle} />
                <Text style={[styles.modalTitle, { color: colors.text, ...fonts.bold }]}>
                  {t('select_city')}
                </Text>
              </View>

              <View style={styles.searchContainer}>
                <Input
                  ref={cityRef}
                  placeholder={t('search_city_placeholder')}
                  value={citySearch}
                  onChangeText={setCitySearch}
                  LeadingAccessory={<Ionicons name="search" size={20} color="#9CA3AF" />}
                  TailingAccessory={
                    citySearch.length > 0 ? (
                      <TouchableOpacity onPress={() => setCitySearch('')}>
                        <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                      </TouchableOpacity>
                    ) : null
                  }
                />
              </View>

              <FlatList
                data={filteredCities}
                keyExtractor={(item) => item}
                keyboardShouldPersistTaps="handled"
                ListHeaderComponent={
                  showCustomCityOption ? (
                    <TouchableOpacity
                      style={[styles.cityItem, { borderBottomColor: colors.border + '20' }]}
                      onPress={() => handleSelectCity(citySearch)}
                    >
                      <View style={[styles.customCityIcon, { backgroundColor: colors.primary + '15' }]}>
                        <Ionicons name="add" size={20} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.cityText, { color: colors.text, ...fonts.medium }]}>
                          {t('use_custom_city')} "{citySearch}"
                        </Text>
                        <Text style={[styles.citySubtext, { color: colors.text + '60' }]}>
                          {t('manual_entry')}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ) : null
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.cityItem, { borderBottomColor: colors.border + '20' }]}
                    onPress={() => handleSelectCity(item)}
                  >
                    <Ionicons
                      name={city === item ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={city === item ? colors.primary : '#9CA3AF'}
                    />
                    <Text style={[
                      styles.cityText,
                      { color: colors.text },
                      city === item ? fonts.bold : fonts.regular
                    ]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  !showCustomCityOption ? (
                    <View style={styles.emptyContainer}>
                      <Ionicons name="search-outline" size={48} color="#D1D5DB" />
                      <Text style={[styles.emptyText, { color: colors.text + '60' }]}>
                        {t('no_cities_found')}
                      </Text>
                    </View>
                  ) : null
                }
                contentContainerStyle={{ paddingBottom: 40 }}
              />
            </View>
          </View>
        </Modal>

        <Modal
          visible={showStateModal}
          animationType="slide"
          transparent={true}
          onShow={() => {
            setTimeout(() => {
              stateRef.current?.focus();
            }, 600);
          }}
          onRequestClose={() => setShowStateModal(false)}
        >
          <View style={styles.modalOverlay}>
            <Animated.View
              entering={FadeIn.duration(300)}
              exiting={FadeOut.duration(200)}
              style={styles.modalBackdrop}
            >
              <TouchableOpacity
                activeOpacity={1}
                style={{ flex: 1 }}
                onPress={() => setShowStateModal(false)}
              />
            </Animated.View>

            <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHandle} />
                <Text style={[styles.modalTitle, { color: colors.text, ...fonts.bold }]}>
                  {t('select_state')}
                </Text>
              </View>

              <View style={styles.searchContainer}>
                <Input
                  ref={stateRef}
                  placeholder={t('search_state_placeholder')}
                  value={stateSearch}
                  onChangeText={setStateSearch}
                  LeadingAccessory={<Ionicons name="search" size={20} color="#9CA3AF" />}
                  TailingAccessory={
                    stateSearch.length > 0 ? (
                      <TouchableOpacity onPress={() => setStateSearch('')}>
                        <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                      </TouchableOpacity>
                    ) : null
                  }
                />
              </View>

              <FlatList
                data={filteredStates}
                keyExtractor={(item) => item}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={20}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.cityItem, { borderBottomColor: colors.border + '20' }]}
                    onPress={() => handleSelectState(item)}
                  >
                    <Ionicons
                      name={stateName === item ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={stateName === item ? colors.primary : '#9CA3AF'}
                    />
                    <Text style={[
                      styles.cityText,
                      { color: colors.text },
                      stateName === item ? fonts.bold : fonts.regular
                    ]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Ionicons name="search-outline" size={48} color="#D1D5DB" />
                    <Text style={[styles.emptyText, { color: colors.text + '60' }]}>
                      {t('no_results')}
                    </Text>
                  </View>
                }
                contentContainerStyle={{ paddingBottom: 40 }}
              />
            </View>
          </View>
        </Modal>
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
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 120,
  },
  progressHeader: {
    marginBottom: 24,
  },
  progressContainer: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    textAlign: 'right',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    lineHeight: 22,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10
  },
  helper: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
    marginBottom: 2,
    marginLeft: 4,
  },
  mt4: {
    marginTop: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  ctaButton: {
    height: 58,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  ctaDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  footerInfo: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 16,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
    marginLeft: 4,
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,

  },
  locationBtnText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
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
