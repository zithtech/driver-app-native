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
import { useAppTheme } from '../../context/ThemeContext';
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

const GenderOption = ({ option, index: _index, active, onPress, t, isDark, theme: themeColors }: any) => {
  const scale = useSharedValue(1);


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

  const icons = {
    male: 'man-outline',
    female: 'woman-outline',
    other: 'ellipsis-horizontal-outline',
  };

  const getGenderColor = (opt: string, active: boolean) => {
    if (!active) return isDark ? themeColors?.textMuted || '#8899B0' : '#6B7280';
    if (opt === 'male') return '#2563EB';
    if (opt === 'female') return '#DB2777';
    return isDark ? themeColors?.text || '#F1F5F9' : '#111827';
  };

  const getGenderBg = (opt: string, active: boolean) => {
    if (!active) return 'transparent';
    if (opt === 'male') return isDark ? 'rgba(37, 99, 235, 0.15)' : '#EFF6FF';
    if (opt === 'female') return isDark ? 'rgba(219, 39, 119, 0.15)' : '#FDF2F8';
    return isDark ? themeColors?.card || '#1A2438' : '#FFFFFF';
  };

  const activeColor = getGenderColor(option, active);
  const activeBg = getGenderBg(option, active);

  return (
    <Animated.View style={[{ flex: 1 }, animatedStyle]}>
      <TouchableOpacity
        activeOpacity={0.8}
        style={[
          styles.genderBtn,
          active && { backgroundColor: activeBg, shadowOpacity: 0.1, elevation: 2 },
        ]}
        onPress={handlePress}
      >
        <Ionicons
          name={icons[option as keyof typeof icons] as any}
          size={22}
          color={activeColor}
        />
        <Text
          adjustsFontSizeToFit
          numberOfLines={1}
          style={[
            styles.genderText,
            { color: activeColor },
          ]}
        >
          {t(option)}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const WheelColumn = ({ data, selectedValue, onValueChange, label, triggerHaptic, isDark, themeColors }: any) => {
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
      <Text style={[styles.wheelLabel, isDark && { color: themeColors?.textMuted }]}>{label}</Text>
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
                <Text style={[styles.wheelItemText, isDark && { color: themeColors?.textMuted }, isSelected && styles.wheelItemTextActive]}>
                  {item}
                </Text>
              </View>
            );
          }}
        />
        <View style={[styles.activeIndicator, isDark && { backgroundColor: 'rgba(37, 99, 235, 0.15)', borderColor: 'rgba(37, 99, 235, 0.3)' }]} pointerEvents="none" />
      </View>
    </View>
  );
};

const PremiumWheelPicker = ({
  tempDate,
  setShowDatePicker,
  setAndFormatDate,
  triggerHaptic,
  t,
  isDark,
  themeColors
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
        style={[styles.pickerContainer, isDark && { backgroundColor: themeColors?.card }]}
      >
        <View style={[styles.pickerHeader, isDark && { borderBottomColor: themeColors?.border }]}>
          <Text style={[styles.pickerTitle, isDark && { color: themeColors?.text }]} numberOfLines={1} adjustsFontSizeToFit>{t('date_of_birth')}</Text>
          <TouchableOpacity onPress={handleConfirm} style={styles.doneBtn}>
            <LinearGradient colors={['#2563EB', '#1D4ED8']} style={styles.doneGradient}>
              <Text style={styles.doneText} numberOfLines={1} adjustsFontSizeToFit>{t('continue')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.wheelsContainer}>
          <WheelColumn label={t('day_label')} data={days} selectedValue={selDay} onValueChange={setSelDay} triggerHaptic={triggerHaptic} isDark={isDark} themeColors={themeColors} />
          <WheelColumn label={t('month_label')} data={months} selectedValue={selMonth} onValueChange={setSelMonth} triggerHaptic={triggerHaptic} isDark={isDark} themeColors={themeColors} />
          <WheelColumn label={t('year_label')} data={years} selectedValue={selYear} onValueChange={setSelYear} triggerHaptic={triggerHaptic} isDark={isDark} themeColors={themeColors} />
        </View>
      </Animated.View>
    </View>
  );
};

/* ================= SCREEN ================= */

const PersonalDetails = ({ navigation }: any) => {
  const { colors: navColors } = useTheme();
  const { theme, isDark } = useAppTheme();
  const colors = theme.colors;
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
  const [alternateContact, setAlternateContact] = useState('');

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
      if (user.alternate_contact) setAlternateContact(user.alternate_contact);
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
    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !dobDate ||
      !isAgeValid(dobDate) ||
      (alternateContact.trim() && !isValidAlternateContact(alternateContact.trim()))
    ) {
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
      alternate_contact: alternateContact.trim() ? alternateContact.trim() : null,
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
        confirmText: t('try_again'),
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

  const isValidAlternateContact = (text: string) => {
    if (!text) return true;
    return /^[0-9]{10}$/.test(text);
  };

  const isFormValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    (email.trim() === '' || isValidEmail(email)) &&
    (alternateContact.trim() === '' || isValidAlternateContact(alternateContact.trim())) &&
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
    <View style={[styles.container, { backgroundColor: isDark ? colors.background : '#FFFFFF' }]}>
      <AppStatusBar />


      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        {/* PROGRESS HEADER */}
        <Animated.View
          style={styles.progressHeader}
        >
          <View style={styles.progressContainer}>
            {[1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={[
                  styles.progressBar,
                  { backgroundColor: i <= 2 ? '#2563EB' : (isDark ? colors.border : '#E5E7EB') }
                ]}
              />
            ))}
          </View>
          <View style={styles.progressLabelRow}>
            <Text style={[styles.progressText, isDark && { color: colors.textMuted }]}>
              {t('step_profile_label')} <Text style={styles.activeProgressText}>• {t('step_2_of_4')}</Text>
            </Text>
          </View>
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scroll, { flexGrow: 1 }]}
            keyboardShouldPersistTaps="handled"
          >
            {/* HEADER SECTION */}
            <View style={styles.headerSection}>
              <View style={styles.profileRow}>
                <View style={styles.avatarContainer}>
                  <LinearGradient
                    colors={['#2563EB', '#60A5FA']}
                    style={styles.avatarGradient}
                  >
                    <View style={[styles.avatarInner, isDark && { backgroundColor: colors.card }]}>
                      <PremiumUserIcon size={44} />
                    </View>
                  </LinearGradient>
                  <View style={[styles.verifiedBadge, isDark && { borderColor: colors.background }]}>
                    <Ionicons name="checkmark-sharp" size={10} color="#FFFFFF" />
                  </View>
                </View>
                <View style={styles.greetingContent}>
                  <View style={styles.helloRow}>
                    <Text style={[styles.greetingLabel, isDark && { color: colors.textMuted }]}>{t('hello')}</Text>
                    <View style={[styles.divider, isDark && { backgroundColor: colors.border }]} />
                    <View style={styles.subtitleRow}>
                      <Ionicons name="shield-checkmark" size={12} color="#10B981" style={{ marginRight: 4 }} />
                      <Text
                        adjustsFontSizeToFit
                        numberOfLines={1}
                        style={[styles.smallSubtitle, isDark && { color: colors.textMuted }]}
                      >
                        {t('tell_us_about_yourself')}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.greetingName}>
                    {firstName.trim().length > 0 ? firstName.trim() : t('driver')}
                  </Text>
                </View>
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

              {/* ALTERNATIVE PHONE NUMBER */}
              <View style={Styles.mt4}>
                <Input
                  label={t('alternative_phone_number_optional')}
                  value={alternateContact}
                  keyboardType="numeric"
                  maxLength={10}
                  onChangeText={(text) => setAlternateContact(text.replace(/[^0-9]/g, ''))}
                  onFocus={() => {
                    triggerHaptic(HapticFeedbackTypes.impactLight);
                  }}
                  onBlur={() => {
                    if (alternateContact.trim() && !isValidAlternateContact(alternateContact)) triggerShake();
                  }}
                  placeholder={t('placeholder_alternative_phone')}
                  error={alternateContact.length > 0 && !isValidAlternateContact(alternateContact) ? t('invalid_alternative_phone') : undefined}
                  TailingAccessory={alternateContact.length > 0 && isValidAlternateContact(alternateContact) ? <SuccessIcon /> : null}
                />
              </View>

              {/* DOB */}
              <Text style={[styles.sectionTitle, isDark && { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{t('date_of_birth')}</Text>
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
              <Text style={[styles.sectionTitle, isDark && { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{t('gender')}</Text>
              <View style={[styles.genderRow, isDark && { backgroundColor: colors.card }]}>
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
                    isDark={isDark}
                    theme={colors}
                  />
                ))}
              </View>
            </Animated.View>
          </ScrollView>

          {/* FOOTER */}
          <View
            style={[styles.footer, { backgroundColor: isDark ? colors.background : '#FFFFFF', borderTopColor: isDark ? colors.border : '#F3F4F6' }]}
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
              style={[styles.footerInfo, isDark && { color: colors.textMuted }]}
            >
              <Ionicons name="shield-checkmark" size={12} color={isDark ? colors.textMuted : '#6B7280'} /> {t('info_safe_verification')}
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
                style={[styles.pickerContainer, isDark && { backgroundColor: colors.card }]}
              >
                <View style={[styles.pickerHeader, isDark && { borderBottomColor: colors.border }]}>
                  <Text style={[styles.pickerTitle, isDark && { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{t('date_of_birth')}</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.doneBtn}>
                    <LinearGradient colors={['#2563EB', '#1D4ED8']} style={styles.doneGradient}>
                      <Text style={styles.doneText} numberOfLines={1} adjustsFontSizeToFit>{t('continue')}</Text>
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
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
    marginTop: 10,
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
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  headerSection: {
    marginVertical: 12,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarGradient: {
    padding: 2,
    borderRadius: 28,
  },
  avatarInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#10B981',
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  greetingContent: {
    flex: 1,
  },
  greetingLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  helloRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  divider: {
    width: 1,
    height: 12,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 6,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 4,
  },
  smallSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '400',
    flexShrink: 1,
  },
  greetingName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#2563EB',
    letterSpacing: -0.5,
  },

  card: {
    paddingVertical: 0,
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
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    padding: 4,
    marginTop: 0,
  },
  genderBtn: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  genderActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
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
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  ctaButton: {
    height: 56,
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
