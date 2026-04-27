import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Pressable,
  // Dimensions,
  KeyboardAvoidingView,
  FlatList,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  FadeInDown,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withRepeat,
  withSpring,
} from 'react-native-reanimated';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useHaptic } from '../../hooks/useHaptic';

import { Input, PremiumUserIcon } from '../../Components';
import { AddressDetails_Nav } from '../../Navigations/navigations';
import { useAlert } from '../../context/AlertContext';
import { setUser } from '../../redux/userSlice';
import { useUpdateDriverMutation } from '../../service/driverApi';
import { RootState } from '../../redux/store';
import AppStatusBar from '../../Components/AppStatusBar';

// const { width } = Dimensions.get('window');

/* ================= HELPERS ================= */

const isAgeValid = (date: Date) => {
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const m = today.getMonth() - date.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < date.getDate())) { age--; }

  return age >= 18;
};

/* const parseDOB = (text: string): Date | null => {
  const parts = text.split('/');
  if (parts.length !== 3) { return null; }

  const [dd, mm, yyyy] = parts.map(Number);
  if (!dd || !mm || !yyyy) { return null; }

  const date = new Date(yyyy, mm - 1, dd);

  if (
    date.getDate() !== dd ||
    date.getMonth() !== mm - 1 ||
    date.getFullYear() !== yyyy
  ) {
    return null;
  }

  return date;
}; */

/* ================= COMPONENTS ================= */

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

const GenderOption = ({ option, index: _index, active, onPress, t }: any) => {
  const scale = useSharedValue(1);
  const icons = {
    male: 'male-outline',
    female: 'female-outline',
    other: 'transgender-outline',
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSequence(
      withSpring(1.05, { damping: 10, stiffness: 100 }),
      withSpring(1, { damping: 10, stiffness: 100 })
    );
    onPress();
  };

  return (
    <Animated.View style={[{ flex: 1 }, animatedStyle]}>
      <TouchableOpacity
        activeOpacity={0.8}
        style={[
          styles.genderBtn,
          active && styles.genderActive,
        ]}
        onPress={handlePress}
      >
        {active && (
          <LinearGradient
            colors={['#EFF6FF', '#DBEAFE']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        )}
        <Ionicons
          name={icons[option as keyof typeof icons] as any}
          size={24}
          color={active ? '#2563EB' : '#9CA3AF'}
        />
        <Text
          adjustsFontSizeToFit
          numberOfLines={1}
          style={[
            styles.genderText,
            { color: active ? '#2563EB' : '#9CA3AF' },
          ]}
        >
          {t(option)}
        </Text>
        {active && (
          <View style={styles.activeDot} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const WheelColumn = ({ data, selectedValue, onValueChange, label, triggerHaptic }: any) => {
  const ITEM_HEIGHT = 44;
  const flatListRef = useRef<any>(null);

  useEffect(() => {
    const index = data.indexOf(selectedValue);
    if (index !== -1) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index, animated: false });
      }, 100);
    }
  }, [data, selectedValue]);

  const onMomentumScrollEnd = (event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    if (index >= 0 && index < data.length) {
      onValueChange(data[index]);
      triggerHaptic(HapticFeedbackTypes.selection);
    }
  };

  return (
    <View style={styles.wheelColumn}>
      <Text style={styles.wheelLabel}>{label}</Text>
      <View style={styles.wheelListContainer}>
        <FlatList
          ref={flatListRef}
          data={data}
          keyExtractor={(item) => item.toString()}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          onMomentumScrollEnd={onMomentumScrollEnd}
          getItemLayout={(_: any, index: number) => ({
            length: ITEM_HEIGHT,
            offset: ITEM_HEIGHT * index,
            index,
          })}
          contentContainerStyle={{
            paddingVertical: ITEM_HEIGHT * 2,
          }}
          renderItem={({ item }: { item: any }) => {
            const isSelected = item === selectedValue;
            return (
              <View style={[styles.wheelItem, { height: ITEM_HEIGHT }]}>
                <Text style={[styles.wheelItemText, isSelected && styles.wheelItemTextActive]}>
                  {item}
                </Text>
              </View>
            );
          }}
        />
        <View style={styles.activeIndicator} pointerEvents="none" />
      </View>
    </View>
  );
};

const PremiumWheelPicker = ({
  tempDate,
  setShowDatePicker,
  setAndFormatDate,
  triggerHaptic,
  t
}: any) => {
  const [selDay, setSelDay] = useState(tempDate.getDate());
  const [selMonth, setSelMonth] = useState(tempDate.getMonth() + 1);
  const [selYear, setSelYear] = useState(tempDate.getFullYear());

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month, 0).getDate();
  };

  const days = Array.from({ length: getDaysInMonth(selMonth, selYear) }, (_, i) => i + 1);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);

  const handleConfirm = () => {
    const newDate = new Date(selYear, selMonth - 1, selDay);
    setAndFormatDate(newDate);
    setShowDatePicker(false);
    triggerHaptic(HapticFeedbackTypes.notificationSuccess);
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={styles.modalOverlay} onPress={() => setShowDatePicker(false)} />
      <Animated.View
        entering={FadeInDown.springify().damping(15)}
        exiting={FadeOut.duration(200)}
        style={styles.pickerContainer}
      >
        <View style={styles.pickerHeader}>
          <Text style={styles.pickerTitle}>{t('date_of_birth')}</Text>
          <TouchableOpacity onPress={handleConfirm} style={styles.doneBtn}>
            <LinearGradient colors={['#2563EB', '#1D4ED8']} style={styles.doneGradient}>
              <Text style={styles.doneText}>{t('continue')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.wheelsContainer}>
          <WheelColumn label={t('day_label')} data={days} selectedValue={selDay} onValueChange={setSelDay} triggerHaptic={triggerHaptic} />
          <WheelColumn label={t('month_label')} data={months} selectedValue={selMonth} onValueChange={setSelMonth} triggerHaptic={triggerHaptic} />
          <WheelColumn label={t('year_label')} data={years} selectedValue={selYear} onValueChange={setSelYear} triggerHaptic={triggerHaptic} />
        </View>
      </Animated.View>
    </View>
  );
};

/* ================= SCREEN ================= */

const PersonalDetails = ({ navigation }: any) => {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const { showAlert } = useAlert();
  const dispatch = useDispatch();
  const { triggerHaptic } = useHaptic();
  const user = useSelector((state: RootState) => state.userSlice.user);

  const [updateDriver, { isLoading: isUpdating }] = useUpdateDriverMutation();

  const shakeOffset = useSharedValue(0);

  /* ---------- STATE ---------- */
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');

  const [dobText, setDobText] = useState('');
  const [dobDate, setDobDate] = useState<Date | null>(null);
  const [dobError, setDobError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(dobDate || new Date(2000, 0, 1));

  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ---------- SYNC WITH REDUX ---------- */
  useEffect(() => {
    if (user) {
      if (user.first_name) setFirstName(user.first_name);
      if (user.last_name) setLastName(user.last_name);
      if (user.email) setEmail(user.email);
      if (user.gender) setGender(user.gender as any);
      if (user.date_of_birth) {
        const date = new Date(user.date_of_birth);
        setDobDate(date);
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yyyy = date.getFullYear();
        setDobText(`${dd}/${mm}/${yyyy}`);
      }
    }
  }, [user]);

  /* ---------- SHAKE ---------- */
  const triggerShake = () => {
    triggerHaptic(HapticFeedbackTypes.notificationError);
    shakeOffset.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withRepeat(withTiming(10, { duration: 100 }), 3, true),
      withTiming(0, { duration: 50 })
    );
  };

  const animatedShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeOffset.value }],
  }));

  /* ---------- CONTINUE ---------- */
  const handleContinue = async () => {
    if (!firstName.trim() || !lastName.trim() || !dobDate || !isAgeValid(dobDate)) {
      showAlert({
        title: t('validation_error'),
        message: t('please_fill_all_required_fields'),
        singleButton: true,
        icon: 'information-circle-outline',
      });
      triggerShake();
      return;
    }

    if (isSubmitting || isUpdating) { return; }

    if (!user?.driverId) {
      triggerShake();
      return;
    }

    triggerHaptic(HapticFeedbackTypes.impactLight);
    setIsSubmitting(true);

    const payload: Record<string, any> = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
      date_of_birth: dobDate.toISOString(),
      gender,
      referred_by: user?.referred_by,
      language: user?.language || i18n.language || 'en', // Persist language selection to backend
    };

    // Only include email if user entered a valid one
    const trimmedEmail = email.trim();
    if (trimmedEmail && isValidEmail(trimmedEmail)) {
      payload.email = trimmedEmail;
    }

    if (__DEV__) {
      console.log('[PersonalDetails] Submitting payload:', JSON.stringify(payload));
      console.log('[PersonalDetails] driverId:', user.driverId);
    }

    try {
      const res = await updateDriver({
        id: user.driverId,
        data: payload,
      }).unwrap();

      const nextStatus = res?.data?.onboarding_status || 'PROFILE_COMPLETED';

      dispatch(
        setUser({
          ...payload,
          onboarding_status: nextStatus,
          onboarding_step: 2,
        })
      );

      setIsSubmitting(false);
      triggerHaptic(HapticFeedbackTypes.notificationSuccess);
      navigation.navigate(AddressDetails_Nav);
    } catch (error: any) {
      setIsSubmitting(false);
      showAlert({
        title: t('update_failed'),
        message: error?.data?.message || t('failed_to_update_personal_details'),
        singleButton: true,
        icon: 'alert-circle-outline',
      });
      if (__DEV__) { console.error('Failed to update profile', JSON.stringify(error?.data || error)); }
    }
  };

  /* ---------- VALIDATION HELPERS ---------- */
  const isValidEmail = (text: string) => {
    if (!text) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
  };

  const isFormValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    (email.trim() === '' || isValidEmail(email)) &&
    dobDate !== null &&
    isAgeValid(dobDate);

  /* ---------- DATE PICKER HANDLERS ---------- */
  /* const onDateChange = (_: any, date?: Date) => {
    if (Platform.OS === 'ios') {
      if (date) {
        setAndFormatDate(date);
      }
    } else {
      if (date) {
        setAndFormatDate(date);
      }
    }
  }; */

  const setAndFormatDate = (date: Date) => {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    setDobText(`${dd}/${mm}/${yyyy}`);
    setDobDate(date);
    setDobError(isAgeValid(date) ? null : 'must_be_18_plus');
  };

  const handleDateTextChange = (text: string) => {
    // Keep only numbers
    const cleaned = text.replace(/[^0-9]/g, '');
    let formatted = cleaned;

    // Auto-format as DD/MM/YYYY
    if (cleaned.length > 4) {
      formatted = `${cleaned.substring(0, 2)}/${cleaned.substring(2, 4)}/${cleaned.substring(4, 8)}`;
    } else if (cleaned.length > 2) {
      formatted = `${cleaned.substring(0, 2)}/${cleaned.substring(2, 4)}`;
    }

    setDobText(formatted);

    // If completely typed out, validate and set the actual Date object
    if (formatted.length === 10) {
      const parts = formatted.split('/');
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
      const year = parseInt(parts[2], 10);

      const parsedDate = new Date(year, month, day);

      // Verify it's a real calendar date (e.g. rejects 30/02/YYYY)
      if (
        parsedDate.getFullYear() === year &&
        parsedDate.getMonth() === month &&
        parsedDate.getDate() === day
      ) {
        setDobDate(parsedDate);
        setDobError(isAgeValid(parsedDate) ? null : 'must_be_18_plus');
      } else {
        setDobDate(null);
        setDobError('invalid_date');
      }
    } else {
      setDobDate(null);
      if (formatted.length > 0) setDobError(null);
    }
  };

  /* const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month, 0).getDate();
  }; */

  const showPicker = () => {
    triggerHaptic(HapticFeedbackTypes.impactLight);
    setTempDate(dobDate || new Date(2000, 0, 1));
    setShowDatePicker(true);
  };

  /* ================= UI COMPONENTS ================= */

  /* ================= UI RENDER ================= */

  return (
    <View style={styles.container}>
      <AppStatusBar />
      <LinearGradient
        colors={['#E0E7FF', '#F3F4F6', '#FFFFFF']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        {/* PROGRESS HEADER */}
        <Animated.View
          style={styles.progressHeader}
        >
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: '50%' }]} />
          </View>
          <Text style={styles.progressText}>{t('step_2_of_4')}</Text>
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            {/* HEADER SECTION */}
            <View style={styles.headerSection}>
              <View style={styles.iconRow}>
                <PremiumUserIcon size={64} />
                <View style={styles.greetingContainer}>
                  {firstName.trim().length > 0 && (
                    <Text style={styles.greetingText}>
                      {t('welcome_name', { name: firstName.trim() })}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.titleContainer}>
                <Text 
                  adjustsFontSizeToFit 
                  numberOfLines={1} 
                  style={styles.title}
                >
                  {t('personal_details')}
                </Text>
                <Text 
                  adjustsFontSizeToFit 
                  numberOfLines={2} 
                  style={styles.subtitle}
                >
                  {t('tell_us_about_yourself')}
                </Text>
              </View>
            </View>

            {/* FORM CARD */}
            <Animated.View
              style={[styles.card, animatedShakeStyle]}
            >
              {/* NAME ROW */}
              <View style={styles.row}>
                <View style={styles.half}>
                  <Input
                    label={t('first_name')}
                    value={firstName}
                    autoCapitalize="words"
                    onChangeText={setFirstName}
                    placeholder={t('placeholder_first_name')}
                    onFocus={() => {
                      triggerHaptic(HapticFeedbackTypes.impactLight);
                    }}
                    onBlur={() => {
                      if (!firstName.trim()) triggerShake();
                    }}
                    TailingAccessory={firstName.trim().length > 0 ? <SuccessIcon /> : null}
                  />
                </View>

                <View style={styles.half}>
                  <Input
                    label={t('last_name')}
                    value={lastName}
                    autoCapitalize="words"
                    onChangeText={setLastName}
                    placeholder={t('placeholder_last_name')}
                    onFocus={() => {
                      triggerHaptic(HapticFeedbackTypes.impactLight);
                    }}
                    onBlur={() => {
                      if (!lastName.trim()) triggerShake();
                    }}
                    TailingAccessory={lastName.trim().length > 0 ? <SuccessIcon /> : null}
                  />
                </View>
              </View>

              {/* EMAIL */}
              <View style={Styles.mt4}>
                <Input
                  label={t('email_optional')}
                  value={email}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onChangeText={setEmail}
                  onFocus={() => {
                    triggerHaptic(HapticFeedbackTypes.impactLight);
                  }}
                  onBlur={() => {
                    if (email.trim() && !isValidEmail(email)) triggerShake();
                  }}
                  placeholder={t('placeholder_email')}
                  error={email.length > 0 && !isValidEmail(email) ? t('invalid_email') : undefined}
                  TailingAccessory={email.length > 0 && isValidEmail(email) ? <SuccessIcon /> : null}
                />
              </View>

              {/* DOB */}
              <Text style={styles.sectionTitle}>{t('date_of_birth')}</Text>
              <View style={{ position: 'relative' }}>
                <Input
                  value={dobText}
                  onChangeText={handleDateTextChange}
                  placeholder={t('dob_placeholder', 'DD/MM/YYYY')}
                  keyboardType="numeric"
                  maxLength={10}
                  error={dobError ? t(dobError) : undefined}
                  TailingAccessory={
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {dobDate && isAgeValid(dobDate) ? <SuccessIcon /> : null}
                      <TouchableOpacity onPress={showPicker} style={{ marginLeft: 8, padding: 4 }}>
                        <Ionicons name="calendar-outline" size={22} color="#9CA3AF" />
                      </TouchableOpacity>
                    </View>
                  }
                />
              </View>

              {/* GENDER */}
              <Text style={styles.sectionTitle}>{t('gender')}</Text>
              <View style={styles.genderRow}>
                {(['male', 'female', 'other'] as const).map((option, index) => (
                  <GenderOption
                    key={option}
                    option={option}
                    index={index}
                    active={gender === option}
                    onPress={() => {
                      triggerHaptic(HapticFeedbackTypes.selection);
                      setGender(option);
                    }}
                    t={t}
                  />
                ))}
              </View>
            </Animated.View>
          </ScrollView>

          {/* FOOTER */}
          <View
            style={[styles.footer, { backgroundColor: colors.background }]}
          >
            <Pressable
              onPress={handleContinue}
              disabled={!isFormValid || isSubmitting || isUpdating}
              style={({ pressed }) => [
                styles.ctaButton,
                { backgroundColor: colors.primary, shadowColor: colors.primary },
                (!isFormValid || isSubmitting || isUpdating) && styles.ctaDisabled,
                pressed && styles.ctaPressed,
              ]}
            >
              <Text 
                adjustsFontSizeToFit 
                numberOfLines={1} 
                style={styles.ctaText}
              >
                {(isSubmitting || isUpdating) ? <DotLoader /> : t('next_arrow')}
              </Text>
            </Pressable>
            <Text 
              adjustsFontSizeToFit 
              numberOfLines={2} 
              style={styles.footerInfo}
            >
              <Ionicons name="shield-checkmark" size={12} color="#6B7280" /> {t('info_safe_verification')}
            </Text>
          </View>
        </KeyboardAvoidingView>

        {showDatePicker && (
          Platform.OS === 'ios' ? (
            <View style={[StyleSheet.absoluteFill, { zIndex: 999 }]}>
              <Pressable style={styles.modalOverlay} onPress={() => setShowDatePicker(false)} />
              <Animated.View
                entering={FadeInDown.springify().damping(15)}
                exiting={FadeOut.duration(200)}
                style={styles.pickerContainer}
              >
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerTitle}>{t('date_of_birth')}</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.doneBtn}>
                    <LinearGradient colors={['#2563EB', '#1D4ED8']} style={styles.doneGradient}>
                      <Text style={styles.doneText}>{t('continue')}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={dobDate || new Date(2000, 0, 1)}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  onChange={(_event, selectedDate) => {
                    if (selectedDate) {
                      triggerHaptic(HapticFeedbackTypes.selection);
                      setAndFormatDate(selectedDate);
                    }
                  }}
                  style={{ height: 200, width: '100%' }}
                />
              </Animated.View>
            </View>
          ) : (
            <DateTimePicker
              value={dobDate || new Date(2000, 0, 1)}
              mode="date"
              display="default"
              maximumDate={new Date()}
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (event.type === 'set' && selectedDate) {
                  triggerHaptic(HapticFeedbackTypes.selection);
                  setAndFormatDate(selectedDate);
                }
              }}
            />
          )
        )}
      </SafeAreaView>
    </View >
  );
};

export default PersonalDetails;

const Styles = {
  mt4: { marginTop: 16 },
};

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  root: {
    flex: 1,
  },
  progressHeader: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
  },
  progressContainer: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'right',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 120,
  },
  headerSection: {
    marginVertical: 4,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 12,
  },
  greetingContainer: {
    height: 24,
    justifyContent: 'center',
  },
  titleContainer: {
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'left',
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'left',
    marginTop: 4,
    lineHeight: 22,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  half: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginTop: 20,
    marginBottom: 10,
  },
  calendarBtn: {
    position: 'absolute',
    right: 12,
    top: 12,
    padding: 4,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 10,
  },
  genderBtn: {
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    gap: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  genderActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
    shadowColor: '#2563EB',
    shadowOpacity: 0.1,

  },
  activeDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563EB',
  },
  greetingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  genderText: {
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  ctaButton: {
    height: 58,
    borderRadius: 20,
    backgroundColor: '#000',
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
  ctaPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  footerInfo: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  doneBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  doneGradient: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  doneText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  wheelsContainer: {
    flexDirection: 'row',
    padding: 20,
    justifyContent: 'space-between',
    height: 280,
  },
  wheelColumn: {
    flex: 1,
    alignItems: 'center',
  },
  wheelLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  wheelListContainer: {
    height: 220,
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    top: 88,
    left: 10,
    right: 10,
    height: 44,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    zIndex: -1,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  wheelItem: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelItemText: {
    fontSize: 18,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  wheelItemTextActive: {
    fontSize: 22,
    color: '#2563EB',
    fontWeight: '700',
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
});
