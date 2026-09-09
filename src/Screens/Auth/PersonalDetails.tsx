import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Pressable,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../context/ThemeContext';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useHaptic } from '../../hooks/useHaptic';

import { Input } from '../../Components';
import { AddressDetails_Nav, HelpCenter_Nav } from '../../Navigations/navigations';
import { useAlert } from '../../context/AlertContext';
import { setUser } from '../../redux/userSlice';
import { useUpdateDriverMutation } from '../../service/driverApi';
import { RootState } from '../../redux/store';
import AppStatusBar from '../../Components/AppStatusBar';

/* ================= HELPERS ================= */

const isAgeValid = (date: Date) => {
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const m = today.getMonth() - date.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < date.getDate())) { age--; }

  return age >= 18;
};

/* ================= SCREEN ================= */

const PersonalDetails = ({ navigation }: any) => {
  const { theme, isDark } = useAppTheme();
  const colors = theme.colors;
  const { t, i18n } = useTranslation();
  const { showAlert } = useAlert();
  const dispatch = useDispatch();
  const { triggerHaptic } = useHaptic();
  const user = useSelector((state: RootState) => state.userSlice.user);

  const [updateDriver, { isLoading: isUpdating }] = useUpdateDriverMutation();

  /* ---------- STATE ---------- */
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [alternateContact, setAlternateContact] = useState('');

  const [dobText, setDobText] = useState('');
  const [dobDate, setDobDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [gender, setGender] = useState<'Male' | 'Female' | 'Other' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ---------- SYNC WITH REDUX ---------- */
  useEffect(() => {
    if (user) {
      if (user.first_name) setFirstName(user.first_name);
      if (user.last_name) setLastName(user.last_name);
      if (user.email) setEmail(user.email);
      if (user.alternate_contact) setAlternateContact(user.alternate_contact);
      if (user.gender) setGender(user.gender === 'male' ? 'Male' : user.gender === 'female' ? 'Female' : 'Other');
      if (user.date_of_birth) {
        const date = new Date(user.date_of_birth);
        setDobDate(date);
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yyyy = date.getFullYear();
        setDobText(`${dd} / ${mm} / ${yyyy}`);
      }
    }
  }, [user]);

  /* ---------- CONTINUE ---------- */
  const handleContinue = async () => {
    if (alternateContact.trim() && isSameAsMobile(alternateContact.trim())) {
      showAlert({
        title: t('validation_error', 'Validation Error'),
        message: t('alternate_same_as_mobile', 'Alternative contact cannot be the same as mobile number.'),
        singleButton: true,
        icon: 'information-circle-outline',
      });
      triggerHaptic(HapticFeedbackTypes.notificationError);
      return;
    }

    if (
      !firstName.trim() ||
      !isValidName(firstName) ||
      firstName.trim().length < 2 ||
      !lastName.trim() ||
      !isValidName(lastName) ||
      lastName.trim().length < 2 ||
      !dobDate ||
      !isAgeValid(dobDate) ||
      !gender ||
      (email.trim() && !isValidEmail(email.trim())) ||
      (alternateContact.trim() && !isValidAlternateContact(alternateContact.trim()))
    ) {
      showAlert({
        title: t('validation_error', 'Validation Error'),
        message: t('fill_all_fields_correctly', 'Please fill all required fields correctly.'),
        singleButton: true,
        icon: 'information-circle-outline',
      });
      triggerHaptic(HapticFeedbackTypes.notificationError);
      return;
    }

    if (isSubmitting || isUpdating) { return; }

    if (!user?.driverId) {
      return;
    }

    triggerHaptic(HapticFeedbackTypes.impactLight);
    setIsSubmitting(true);

    const payload: Record<string, any> = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
      date_of_birth: dobDate.toISOString(),
      gender: gender.toLowerCase(),
      referred_by: user?.referred_by,
      language: user?.language || i18n.language || 'en',
      alternate_contact: alternateContact.trim() ? alternateContact.trim() : null,
    };

    const trimmedEmail = email.trim();
    if (trimmedEmail && isValidEmail(trimmedEmail)) {
      payload.email = trimmedEmail;
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
        title: t('update_failed', 'Update Failed'),
        message: error?.data?.message || t('failed_to_update_personal_details', 'Failed to update personal details.'),
        confirmText: t('try_again', 'Try Again'),
        singleButton: true,
        icon: 'alert-circle-outline',
      });
    }
  };

  /* ---------- VALIDATION HELPERS ---------- */
  const isValidName = (text: string) => {
    if (!text.trim()) return false;
    return /^[A-Za-z]+$/.test(text.trim());
  };

  const sanitizeName = (text: string) => {
    return text.replace(/[^A-Za-z]/g, '');
  };

  const isValidEmail = (text: string) => {
    if (!text) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
  };

  const isValidAlternateContact = (text: string) => {
    if (!text) return true;
    return /^[6-9][0-9]{9}$/.test(text);
  };

  const isSameAsMobile = (altContact: string) => {
    if (!user?.phone_number || !altContact) return false;
    const cleanAlt = altContact.replace(/[^0-9]/g, '');
    const cleanMobile = user.phone_number.replace(/[^0-9]/g, '');
    
    if (cleanAlt.length >= 10 && cleanMobile.length >= 10) {
      return cleanAlt.slice(-10) === cleanMobile.slice(-10);
    }
    return cleanAlt === cleanMobile;
  };

  const getNameError = (name: string, fieldLabel: string) => {
    if (name.length === 0) return undefined;
    if (name.trim().length < 2) return t('name_too_short', '{{field}} must be at least 2 characters', { field: fieldLabel });
    if (name.trim().length > 50) return t('name_too_long', '{{field}} must be less than 50 characters', { field: fieldLabel });
    return undefined;
  };

  const isFormValid =
    firstName.trim().length >= 2 &&
    isValidName(firstName) &&
    lastName.trim().length >= 2 &&
    isValidName(lastName) &&
    (email.trim() === '' || isValidEmail(email)) &&
    (alternateContact.trim() === '' || (isValidAlternateContact(alternateContact.trim()) && !isSameAsMobile(alternateContact.trim()))) &&
    dobDate !== null &&
    gender !== null &&
    isAgeValid(dobDate);

  /* ---------- DATE PICKER HANDLERS ---------- */
  const handleDateTextChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    let formatted = cleaned;

    if (cleaned.length > 4) {
      formatted = `${cleaned.substring(0, 2)} / ${cleaned.substring(2, 4)} / ${cleaned.substring(4, 8)}`;
    } else if (cleaned.length > 2) {
      formatted = `${cleaned.substring(0, 2)} / ${cleaned.substring(2, 4)}`;
    }

    setDobText(formatted);

    if (formatted.length === 14) { // "DD / MM / YYYY"
      const parts = formatted.split(' / ');
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);

      const parsedDate = new Date(year, month, day);

      if (
        parsedDate.getFullYear() === year &&
        parsedDate.getMonth() === month &&
        parsedDate.getDate() === day
      ) {
        setDobDate(parsedDate);
      } else {
        setDobDate(null);
      }
    } else {
      setDobDate(null);
    }
  };

  const setAndFormatDate = (date: Date) => {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    setDobText(`${dd} / ${mm} / ${yyyy}`);
    setDobDate(date);
  };

  const Label = ({ text, required }: { text: string; required?: boolean }) => (
    <Text style={[styles.labelText, { color: colors.text }]}>
      {text} {required && <Text style={{ color: '#EF4444' }}>*</Text>}
    </Text>
  );

  return (
    <View style={[styles.container, { backgroundColor: isDark ? colors.background : '#FFFFFF' }]}>
      <AppStatusBar />
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        
        {/* PROGRESS BAR */}
        <View style={styles.progressWrapper}>
          <View style={styles.progressLineContainer}>
             <View style={[styles.progressLine, { width: '33%', backgroundColor: colors.primary }]} />
             <View style={[styles.progressLine, { width: '67%', backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB' }]} />
          </View>
          <View style={styles.progressStepsRow}>
            {/* Step 1 */}
            <View style={styles.stepContainer}>
              <View style={[styles.stepCircle, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                <Ionicons name="checkmark" size={16} color="#FFF" />
              </View>
              <Text style={[styles.stepText, { color: isDark ? '#9CA3AF' : '#9CA3AF' }]}>{t('mobile_verification_step', 'Mobile\nVerification')}</Text>
            </View>
            {/* Step 2 */}
            <View style={styles.stepContainer}>
              <View style={[styles.stepCircle, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                <Text style={[styles.stepNumber, { color: '#FFF' }]}>2</Text>
              </View>
              <Text style={[styles.stepText, { color: colors.primary }]}>{t('personal_details_step', 'Personal\nDetails')}</Text>
            </View>
            {/* Step 3 */}
            <View style={styles.stepContainer}>
              <View style={[styles.stepCircle, { backgroundColor: isDark ? theme.colors.card : '#FFF', borderColor: isDark ? 'rgba(255,255,255,0.2)' : '#D1D5DB' }]}>
                <Text style={[styles.stepNumber, { color: isDark ? '#9CA3AF' : '#9CA3AF' }]}>3</Text>
              </View>
              <Text style={[styles.stepText, { color: isDark ? '#9CA3AF' : '#9CA3AF' }]}>{t('address_details_step', 'Address\nDetails')}</Text>
            </View>
            {/* Step 4 */}
            <View style={styles.stepContainer}>
              <View style={[styles.stepCircle, { backgroundColor: isDark ? theme.colors.card : '#FFF', borderColor: isDark ? 'rgba(255,255,255,0.2)' : '#D1D5DB' }]}>
                <Text style={[styles.stepNumber, { color: isDark ? '#9CA3AF' : '#9CA3AF' }]}>4</Text>
              </View>
              <Text style={[styles.stepText, { color: isDark ? '#9CA3AF' : '#9CA3AF' }]}>{t('documents_upload_step', 'Documents\nUpload')}</Text>
            </View>
          </View>
        </View>

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
              <View style={styles.headerTextContainer}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>{t('personal_details_title', 'Personal Details')}</Text>
                <Text style={[styles.headerSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                  {t('personal_details_subtitle', 'Please enter your details exactly as per your official documents.')}
                </Text>
              </View>
              <Image 
                source={require('../../assets/images/personaldetailsImg.png')} 
                style={styles.headerImage} 
              />
            </View>

            {/* FORM CARD */}
            <View style={styles.formCard}>
              
              {/* FIRST & LAST NAME */}
              <View style={styles.row}>
                <View style={styles.half}>
                  <Label text={t('first_name', 'First Name')} required />
                  <Input
                    value={firstName}
                    autoCapitalize="words"
                    onChangeText={(text: string) => setFirstName(sanitizeName(text))}
                    placeholder={t('enter_first_name', 'Enter first name')}
                    placeholderTextColor="#9CA3AF"
                    maxLength={50}
                    style={{ fontSize: 13, color: colors.text }}
                    inputContainerStyle={[styles.inputContainer, { backgroundColor: isDark ? theme.colors.card : '#FFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB' }]}
                    LeadingAccessory={
                      <Ionicons name="person-outline" size={20} color="#9CA3AF" style={{ marginRight: 8 }} />
                    }
                    error={getNameError(firstName, t('first_name', 'First Name'))}
                  />
                </View>
                <View style={styles.half}>
                  <Label text={t('last_name', 'Last Name')} required />
                  <Input
                    value={lastName}
                    autoCapitalize="words"
                    onChangeText={(text: string) => setLastName(sanitizeName(text))}
                    placeholder={t('enter_last_name', 'Enter last name')}
                    placeholderTextColor="#9CA3AF"
                    maxLength={50}
                    style={{ fontSize: 13, color: colors.text }}
                    inputContainerStyle={[styles.inputContainer, { backgroundColor: isDark ? theme.colors.card : '#FFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB' }]}
                    LeadingAccessory={
                      <Ionicons name="person-outline" size={20} color="#9CA3AF" style={{ marginRight: 8 }} />
                    }
                    error={getNameError(lastName, t('last_name', 'Last Name'))}
                  />
                </View>
              </View>

              {/* DATE OF BIRTH */}
              <View style={styles.mt}>
                <Label text={t('date_of_birth_label', 'Date of Birth')} required />
                <Input
                  value={dobText}
                  onChangeText={handleDateTextChange}
                  keyboardType="numeric"
                  maxLength={14}
                  placeholder="DD / MM / YYYY"
                  placeholderTextColor="#9CA3AF"
                  style={{ fontSize: 13, color: colors.text }}
                  inputContainerStyle={[styles.inputContainer, { backgroundColor: isDark ? theme.colors.card : '#FFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB' }]}
                  LeadingAccessory={
                    <Ionicons name="calendar-outline" size={20} color="#9CA3AF" style={{ marginRight: 8 }} />
                  }
                  TailingAccessory={
                    <TouchableOpacity onPress={() => setShowDatePicker(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Ionicons name="chevron-down-outline" size={20} color={colors.text} />
                    </TouchableOpacity>
                  }
                />
              </View>

              {/* GENDER */}
              <View style={styles.mt}>
                <Label text={t('gender_label', 'Gender')} required />
                <View style={styles.genderRow}>
                  {['Male', 'Female', 'Other'].map((option) => {
                    const isActive = gender === option;
                    let iconName = 'person';
                    let iconColor = '#2563EB';
                    
                    if (option === 'Female') {
                      iconName = 'female';
                      iconColor = '#EC4899';
                    } else if (option === 'Other') {
                      iconName = 'person-circle-outline';
                      iconColor = '#8B5CF6';
                    }

                    return (
                      <TouchableOpacity
                        key={option}
                        activeOpacity={0.8}
                        onPress={() => {
                          triggerHaptic(HapticFeedbackTypes.selection);
                          setGender(option as any);
                        }}
                        style={[
                          styles.genderBtn,
                          { backgroundColor: isDark ? theme.colors.card : '#FFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB' },
                          isActive && [styles.genderBtnActive, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF', borderColor: colors.primary }]
                        ]}
                      >
                        <View style={[styles.radioCircle, { borderColor: isDark ? 'rgba(255,255,255,0.3)' : '#D1D5DB' }, isActive && [styles.radioCircleActive, { borderColor: colors.primary }]]}>
                          {isActive && <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />}
                        </View>
                        <Ionicons name={iconName} size={18} color={isActive ? iconColor : '#9CA3AF'} />
                        <Text style={[styles.genderText, { color: isDark ? '#9CA3AF' : '#6B7280' }, isActive && [styles.genderTextActive, { color: colors.text }]]}>
                          {option}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* EMAIL */}
              <View style={styles.mt}>
                <Label text={t('email_address_optional', 'Email Address (Optional)')} />
                <Input
                  value={email}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onChangeText={setEmail}
                  placeholder={t('enter_email_address', 'Enter email address')}
                  placeholderTextColor="#9CA3AF"
                  style={{ fontSize: 13, color: colors.text }}
                  inputContainerStyle={[styles.inputContainer, { backgroundColor: isDark ? theme.colors.card : '#FFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB' }]}
                  LeadingAccessory={
                    <Ionicons name="mail-outline" size={20} color="#9CA3AF" style={{ marginRight: 8 }} />
                  }
                  error={(email.length > 0 && !isValidEmail(email)) ? t('valid_email_error', 'Please enter a valid email address') : undefined}
                />
              </View>

              {/* ALTERNATIVE CONTACT NUMBER */}
              <View style={styles.mt}>
                <Label text={t('alternative_contact_optional', 'Alternative Contact Number (Optional)')} />
                <Input
                  value={alternateContact}
                  keyboardType="numeric"
                  maxLength={10}
                  onChangeText={(text) => setAlternateContact(text.replace(/[^0-9]/g, ''))}
                  placeholder={t('enter_alternative_contact', 'Enter alternative contact number')}
                  placeholderTextColor="#9CA3AF"
                  style={{ fontSize: 13, color: colors.text }}
                  inputContainerStyle={[styles.inputContainer, { backgroundColor: isDark ? theme.colors.card : '#FFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB' }]}
                  LeadingAccessory={
                    <View style={styles.phonePrefixContainer}>
                      <Ionicons name="phone-portrait-outline" size={20} color="#9CA3AF" />
                      <Text style={[styles.phonePrefixText, { color: colors.text }]}>+91</Text>
                      <Ionicons name="chevron-down-outline" size={16} color={colors.text} />
                      <View style={[styles.phoneDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB' }]} />
                    </View>
                  }
                  error={
                    (alternateContact.length > 0 && !isValidAlternateContact(alternateContact)) 
                      ? t('valid_phone_error', 'Please enter a valid phone number') 
                      : (alternateContact.length > 0 && isSameAsMobile(alternateContact)) 
                        ? t('alternate_same_as_mobile', 'Cannot be the same as mobile number') 
                        : undefined
                  }
                />
              </View>

            </View>

            {/* SUPPORT CHAT BUTTON */}
            <TouchableOpacity style={[styles.chatButton, { backgroundColor: colors.primary }]} activeOpacity={0.8} onPress={() => navigation.navigate(HelpCenter_Nav)}>
              <View style={[styles.chatIconWrapper, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : '#FFF' }]}>
                <Ionicons name="chatbubbles" size={16} color={isDark ? '#FFF' : colors.primary} />
              </View>
              <View style={styles.chatTextWrapper}>
                <Text style={styles.chatTitle}>{t('start_chatting', 'Start Chatting')}</Text>
                <Text style={styles.chatSubtitle}>{t('get_help_from_assistant', 'Get help from our assistant')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#FFF" />
            </TouchableOpacity>

          </ScrollView>

          {/* FOOTER BUTTON */}
          {isFormValid && (
            <View style={[styles.footer, { backgroundColor: isDark ? colors.background : '#FFFFFF' }]}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleContinue}
                disabled={isSubmitting || isUpdating}
                style={[
                  styles.continueBtn,
                  { backgroundColor: colors.primary },
                  (isSubmitting || isUpdating) && styles.continueBtnDisabled
                ]}
              >
                <Text style={styles.continueText}>
                  {isSubmitting || isUpdating ? t('saving', 'Saving...') : t('continue_btn', 'Continue')}
                </Text>
                {!(isSubmitting || isUpdating) && (
                  <Ionicons name="arrow-forward" size={24} color="#FFF" style={styles.continueIcon} />
                )}
              </TouchableOpacity>
              
              <View style={styles.secureTextContainer}>
                <Ionicons name="lock-closed-outline" size={14} color={isDark ? '#9CA3AF' : '#6B7280'} />
                <Text style={[styles.secureText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                  Your information is safe and secure with us
                </Text>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>

        {showDatePicker && (
          Platform.OS === 'ios' ? (
            <View style={[StyleSheet.absoluteFill, { zIndex: 999 }]}>
              <Pressable style={styles.modalOverlay} onPress={() => setShowDatePicker(false)} />
              <View style={[styles.pickerContainer, { backgroundColor: isDark ? theme.colors.card : '#FFFFFF' }]}>
                <View style={[styles.pickerHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : '#F3F4F6' }]}>
                  <Text style={[styles.pickerTitle, { color: colors.text }]}>Date of Birth</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={[styles.doneText, { color: colors.primary }]}>{t('done', 'Done')}</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={dobDate || new Date(2000, 0, 1)}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  textColor={colors.text}
                  onChange={(_event, selectedDate) => {
                    if (selectedDate) {
                      triggerHaptic(HapticFeedbackTypes.selection);
                      setAndFormatDate(selectedDate);
                    }
                  }}
                  style={{ height: 200, width: '100%' }}
                />
              </View>
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
    </View>
  );
};

export default PersonalDetails;

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  root: {
    flex: 1,
  },
  
  /* Progress Bar */
  progressWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    position: 'relative',
  },
  progressLineContainer: {
    position: 'absolute',
    top: 28,
    left: 40,
    right: 40,
    height: 2,
    flexDirection: 'row',
  },
  progressLine: {
    height: '100%',
  },
  progressStepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepContainer: {
    alignItems: 'center',
    width: 60,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  stepNumber: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  stepText: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
    fontWeight: '600',
  },

  /* Header */
  headerSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  headerTextContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    lineHeight: 18,
  },
  headerImage: {
    width: 110,
    height: 110,
    resizeMode: 'contain',
    marginRight: -10,
  },

  /* Form Card */
  scroll: {
    paddingBottom: 100,
  },
  formCard: {
    paddingHorizontal: 16,
    marginTop: 0,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  half: {
    flex: 1,
  },
  mt: {
    marginTop: 12,
  },
  labelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  inputContainer: {
    borderColor: '#E5E7EB',
    backgroundColor: '#FFF',
    borderRadius: 8,
    height: 44,
  },

  /* Gender */
  genderRow: {
    flexDirection: 'row',
    gap: 8,
  },
  genderBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  genderBtnActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: '#2563EB',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
  },
  genderText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  genderTextActive: {
    color: '#111827',
  },

  /* Phone */
  phonePrefixContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  phonePrefixText: {
    marginHorizontal: 6,
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  phoneDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
    marginLeft: 8,
  },

  /* Footer */
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#9CA3AF',
  },
  continueText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  continueIcon: {
    position: 'absolute',
    right: 20,
  },
  secureTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  secureText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 6,
  },
  chatButton: {
    backgroundColor: '#0062FF',
    marginHorizontal: 16,
    marginBottom: 16,
    marginTop: 16,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatIconWrapper: {
    backgroundColor: '#FFF',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  chatTextWrapper: {
    flex: 1,
  },
  chatTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  chatSubtitle: {
    color: '#E0E7FF',
    fontSize: 11,
  },

  /* Date Picker iOS Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  doneText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2563EB',
  },
});
