import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  PermissionsAndroid,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useAppTheme } from '../../context/ThemeContext';
import AppStatusBar from '../../Components/AppStatusBar';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import axiosInstance from '../../api/axiosInstance';
import LinearGradient from 'react-native-linear-gradient';
// @ts-ignore
import { selectContactPhone } from 'react-native-select-contact';
import { 
  PremiumInfoBanner, 
  ConfirmationModal 
} from '../../Components';
import { ms, vs } from '../../lib/scale';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';

const RELATIONSHIPS = [
  { key: 'Family', icon: 'home-outline' },
  { key: 'Friend', icon: 'people-outline' },
  { key: 'Spouse', icon: 'heart-outline' },
  { key: 'Work', icon: 'briefcase-outline' },
  { key: 'Other', icon: 'ellipsis-horizontal-circle-outline' },
];

const OnboardingSosScreen = ({ navigation, route }: any) => {
  const { t } = useTranslation();
  const { theme, isDark } = useAppTheme();
  const colors = theme.colors;
  const insets = useSafeAreaInsets();
  
  const nextScreen = route?.params?.nextScreen || 'Dashboard_Nav';

  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('Family');
  const [contactsAddedCount, setContactsAddedCount] = useState(0);

  // Modal State for ConfirmationModal
  const [modalVisible, setModalVisible] = useState(false);
  const [modalData, setModalData] = useState({
    title: '',
    message: '',
    confirmText: '',
    cancelText: '',
    icon: 'shield-checkmark',
    isDestructive: false,
    onConfirm: () => {},
  });

  const showConfirm = (options: any) => {
    setModalData({
      title: options.title || '',
      message: options.message || '',
      confirmText: options.confirmText || t('ok'),
      cancelText: options.cancelText || t('cancel'),
      icon: options.icon || 'shield-checkmark',
      isDestructive: options.isDestructive || false,
      onConfirm: options.onConfirm || (() => setModalVisible(false)),
    });
    setModalVisible(true);
  };

  const handleChooseContact = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_CONTACTS
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          showConfirm({
            title: t('permission_denied') || 'Permission Denied',
            message: 'Contacts permission is required to use this feature.',
            icon: 'lock-closed',
            isDestructive: true
          });
          return;
        }
      }

      const selection = await selectContactPhone();
      if (!selection) return;

      const { contact, selectedPhone } = selection;
      setName(contact.name || '');
      setPhone((selectedPhone.number || '').replace(/[\s\-\(\)]/g, ''));
    } catch (error) {
      console.log('Error picking contact:', error);
    }
  };

  const handleAddContact = async () => {
    if (!name.trim() || !phone.trim()) {
      showConfirm({
        title: t('error') || 'Error',
        message: t('fill_all_fields') || 'Please fill name and phone number',
        icon: 'alert-circle',
        isDestructive: true
      });
      return;
    }

    const cleanInputPhone = phone.trim().replace(/[\s\-\(\)]/g, '');
    const phoneRegex = /^\+?[0-9]{10,15}$/;
    if (!phoneRegex.test(cleanInputPhone)) {
      showConfirm({
        title: t('invalid_phone') || 'Invalid Phone Number',
        message: t('invalid_phone_desc') || 'Please enter a valid phone number.',
        icon: 'call',
        isDestructive: true
      });
      return;
    }

    try {
      setLoading(true);
      const payload = { 
        name: name.trim(), 
        phone: cleanInputPhone,
        relationship
      };
      const response = await axiosInstance.post('/sos/contacts', payload);
      
      if (response.data.success) {
        setName('');
        setPhone('');
        setContactsAddedCount(prev => prev + 1);
        showConfirm({
          title: t('success') || 'Success',
          message: t('contact_added_success') || 'Emergency contact added securely!',
          icon: 'checkmark-circle',
          onConfirm: () => {
            setModalVisible(false);
            setTimeout(() => {
              proceedToNext();
            }, 300);
          }
        });
      }
    } catch (error: any) {
      showConfirm({
        title: t('error') || 'Error',
        message: error.response?.data?.message || t('failed_to_add_contact') || 'Failed to add contact.',
        icon: 'close-circle',
        isDestructive: true
      });
    } finally {
      setLoading(false);
    }
  };

  const proceedToNext = () => {
    navigation.replace(nextScreen);
  };

  const handleContinue = () => {
    if (contactsAddedCount === 0) {
      showConfirm({
        title: t('highly_recommended') || 'Highly Recommended',
        message: t('sos_skip_warning') || 'Adding an emergency contact is highly recommended for your safety. Skip anyway?',
        icon: 'warning',
        confirmText: t('skip_anyway') || 'Skip Anyway',
        cancelText: t('add_contact') || 'Add Contact',
        isDestructive: true,
        onConfirm: () => {
          setModalVisible(false);
          proceedToNext();
        }
      });
    } else {
      proceedToNext();
    }
  };

  const textPrimary = isDark ? '#FFFFFF' : '#1F2937';
  const textSecondary = isDark ? '#9CA3AF' : '#6B7280';
  const textMuted = isDark ? '#6B7280' : '#9CA3AF';
  const cardBg = isDark ? '#1F2937' : '#FFFFFF';
  const inputBg = isDark ? '#111827' : '#F9FAFB';
  const inputBorder = isDark ? '#374151' : '#E5E7EB';
  const dividerColor = isDark ? '#374151' : '#F3F4F6';
  const isFormValid = name.trim().length > 0 && phone.trim().length > 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#111827' : '#F3F4F6' }]} edges={['top', 'bottom']}>
      <AppStatusBar />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* HERO BANNER */}
        <Animated.View entering={FadeInUp.duration(600)}>
          <PremiumInfoBanner 
            title="Safety First"
            description="Your safety is our top priority. Add a trusted contact to share your live location during emergencies."
          />
        </Animated.View>

        {/* ── ADD CONTACT CARD ── */}
        <Animated.View 
          entering={FadeInDown.delay(200).duration(600)}
          style={[styles.addCard, { backgroundColor: cardBg, shadowColor: isDark ? '#000' : '#94A3B8' }]}
        >
          {/* Card Header */}
          <View style={styles.addCardHeader}>
            <View style={[styles.addCardIconBox, { backgroundColor: isDark ? '#1E3A5F' : '#EFF6FF' }]}>
              <Ionicons name="person-add" size={ms(18)} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.addCardTitle, { color: textPrimary }]}>{t('add_new_contact') || 'Add New Contact'}</Text>
            </View>
          </View>

          {/* Import from Contacts Button */}
          <Pressable
            onPress={handleChooseContact}
            style={({ pressed }) => [
              styles.importBtn,
              {
                backgroundColor: isDark ? '#111827' : '#F9FAFB',
                borderColor: isDark ? '#374151' : '#E5E7EB',
                opacity: pressed ? 0.7 : 1,
              }
            ]}
          >
            <View style={[styles.importIconBox, { backgroundColor: isDark ? '#1E3A5F' : '#DBEAFE' }]}>
              <Ionicons name="phone-portrait-outline" size={ms(16)} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.importTitle, { color: textPrimary }]}>
                {t('import_from_contacts') || 'Import from Contacts'}
              </Text>
              <Text style={[styles.importSubtitle, { color: textMuted }]}>
                {t('auto_fill_details') || 'Auto-fill name & number from phonebook'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={ms(16)} color={textMuted} />
          </Pressable>

          {/* Divider with "or" */}
          <View style={styles.orDividerRow}>
            <View style={[styles.orDividerLine, { backgroundColor: dividerColor }]} />
            <Text style={[styles.orDividerText, { color: textMuted }]}>{t('or') || 'or'}</Text>
            <View style={[styles.orDividerLine, { backgroundColor: dividerColor }]} />
          </View>

          {/* Name Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: textSecondary }]}>{t('contact_name') || 'Contact Name'}</Text>
            <View style={[styles.inputRow, { backgroundColor: inputBg, borderColor: name ? colors.primary : inputBorder }]}>
              <Ionicons name="person-outline" size={ms(18)} color={name ? colors.primary : textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { color: textPrimary }]}
                placeholder={t('enter_name') || 'e.g. John Doe'}
                placeholderTextColor={textMuted}
                value={name}
                onChangeText={setName}
              />
              {name.length > 0 && (
                <Pressable onPress={() => setName('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={ms(18)} color={textMuted} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Phone Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: textSecondary }]}>{t('phone_number') || 'Phone Number'}</Text>
            <View style={[styles.inputRow, { backgroundColor: inputBg, borderColor: phone ? colors.primary : inputBorder }]}>
              <Ionicons name="call-outline" size={ms(18)} color={phone ? colors.primary : textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { color: textPrimary }]}
                placeholder={t('enter_phone') || 'e.g. 9043522612'}
                placeholderTextColor={textMuted}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              {phone.length > 0 && (
                <Pressable onPress={() => setPhone('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={ms(18)} color={textMuted} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Relationship Chips */}
          <View style={[styles.inputGroup, { marginBottom: vs(20) }]}>
            <Text style={[styles.inputLabel, { color: textSecondary }]}>
              {t('relationship') || 'Relationship'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipsRow}>
                {RELATIONSHIPS.map(({ key, icon }) => {
                  const isSelected = relationship === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setRelationship(key)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isSelected ? colors.primary : isDark ? '#111827' : '#F3F4F6',
                          borderColor: isSelected ? colors.primary : inputBorder,
                        }
                      ]}
                    >
                      <Ionicons
                        name={icon}
                        size={ms(15)}
                        color={isSelected ? '#FFFFFF' : textMuted}
                        style={{ marginRight: ms(6) }}
                      />
                      <Text style={[
                        styles.chipText,
                        { color: isSelected ? '#FFFFFF' : textSecondary }
                      ]}>
                        {t(key.toLowerCase()) || key}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          {/* Save Button */}
          <Pressable
            onPress={handleAddContact}
            disabled={loading || !isFormValid}
            style={({ pressed }) => [
              styles.saveBtn,
              {
                backgroundColor: !isFormValid
                  ? (isDark ? '#374151' : '#E5E7EB')
                  : colors.primary,
                opacity: pressed ? 0.85 : loading ? 0.6 : 1,
              }
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons
                  name="shield-checkmark"
                  size={ms(18)}
                  color={!isFormValid ? textMuted : '#FFFFFF'}
                  style={{ marginRight: ms(8) }}
                />
                <Text style={[
                  styles.saveBtnText,
                  { color: !isFormValid ? textMuted : '#FFFFFF' }
                ]}>
                  {t('save_contact') || 'Save Contact'}
                </Text>
              </>
            )}
          </Pressable>
        </Animated.View>
      </ScrollView>

      {/* STICKY FOOTER */}
      <View style={[styles.onboardingFooter, { backgroundColor: cardBg, paddingBottom: Platform.OS === 'ios' ? insets.bottom : vs(20) }]}>
        <Pressable
          style={[styles.continueSetupBtn, { backgroundColor: contactsAddedCount > 0 ? '#10B981' : colors.primary }]}
          onPress={handleContinue}
        >
          <Text style={styles.continueSetupBtnText}>
            {contactsAddedCount > 0 ? t('continue_setup') || 'Continue' : 'Skip for now'}
          </Text>
        </Pressable>
      </View>

      {/* STANDARDIZED MODAL */}
      <ConfirmationModal 
        isVisible={modalVisible}
        onClose={() => setModalVisible(false)}
        onConfirm={modalData.onConfirm}
        title={modalData.title}
        message={modalData.message}
        confirmText={modalData.confirmText}
        cancelText={modalData.cancelText}
        isDestructive={modalData.isDestructive}
        icon={modalData.icon}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: ms(16),
    paddingBottom: vs(120),
  },
  // ── Add Contact Card ──
  addCard: {
    borderRadius: ms(20),
    padding: ms(20),
    marginBottom: vs(28),
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  addCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addCardIconBox: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(12),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: ms(12),
  },
  addCardTitle: {
    fontSize: ms(16),
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  // ── Import from Contacts ──
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: ms(14),
    borderRadius: ms(14),
    borderWidth: 1,
    marginTop: vs(16),
  },
  importIconBox: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(10),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: ms(12),
  },
  importTitle: {
    fontSize: ms(14),
    fontWeight: '600',
  },
  importSubtitle: {
    fontSize: ms(11),
    fontWeight: '500',
    marginTop: vs(2),
  },

  // ── Or Divider ──
  orDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: vs(18),
  },
  orDividerLine: {
    flex: 1,
    height: 1,
  },
  orDividerText: {
    paddingHorizontal: ms(12),
    fontSize: ms(12),
    fontWeight: '600',
    textTransform: 'uppercase',
  },

  // ── Inputs ──
  inputGroup: {
    marginBottom: vs(14),
  },
  inputLabel: {
    fontSize: ms(11),
    fontWeight: '600',
    marginBottom: vs(8),
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: vs(48),
    borderWidth: 1,
    borderRadius: ms(14),
    paddingHorizontal: ms(14),
  },
  inputIcon: {
    marginRight: ms(10),
  },
  textInput: {
    flex: 1,
    fontSize: ms(15),
    fontWeight: '500',
    height: '100%',
    paddingVertical: 0,
  },

  // ── Chips ──
  chipsRow: {
    flexDirection: 'row',
    gap: ms(8),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ms(14),
    paddingVertical: vs(8),
    borderRadius: ms(10),
    borderWidth: 1,
  },
  chipText: {
    fontSize: ms(13),
    fontWeight: '600',
  },

  // ── Save Button ──
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: vs(50),
    borderRadius: ms(14),
  },
  saveBtnText: {
    fontSize: ms(15),
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  onboardingFooter: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    paddingHorizontal: ms(20),
    paddingTop: vs(16),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  continueSetupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: vs(18),
    borderRadius: ms(16),
  },
  continueSetupBtnText: {
    color: '#FFF',
    fontSize: ms(17),
    fontWeight: '800',
  },
});

export default OnboardingSosScreen;

