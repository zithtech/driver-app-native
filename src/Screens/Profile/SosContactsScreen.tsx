import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
  TextInput,
} from 'react-native';
import { useAppTheme } from '../../context/ThemeContext';
import AppStatusBar from '../../Components/AppStatusBar';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import axiosInstance from '../../api/axiosInstance';
// @ts-ignore
import { selectContactPhone } from 'react-native-select-contact';
import {
  PremiumInfoBanner,
  PremiumSosContactCard,
  ConfirmationModal
} from '../../Components';
import { ms, vs, s } from '../../lib/scale';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';

const RELATIONSHIPS = [
  { key: 'Family', icon: 'home-outline' },
  { key: 'Friend', icon: 'people-outline' },
  { key: 'Spouse', icon: 'heart-outline' },
  { key: 'Work', icon: 'briefcase-outline' },
  { key: 'Other', icon: 'ellipsis-horizontal-circle-outline' },
];

const SosContactsScreen = ({ navigation }: any) => {
  const { t } = useTranslation();
  const { theme, isDark } = useAppTheme();
  const colors = theme.colors;

  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('Family');
  const [adding, setAdding] = useState(false);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalData, setModalData] = useState({
    title: '',
    message: '',
    confirmText: '',
    cancelText: '',
    icon: 'shield-checkmark',
    isDestructive: false,
    onConfirm: () => { },
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

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/sos/contacts');
      if (response.data.success) {
        setContacts(response.data.data);
      }
    } catch (error) {
      showConfirm({
        title: t('error'),
        message: t('failed_to_load_contacts'),
        icon: 'alert-circle',
        isDestructive: true
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChooseContact = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_CONTACTS
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          showConfirm({
            title: t('permission_denied'),
            message: t('contacts_permission_required') || 'Contacts permission is required.',
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
      setPhone((selectedPhone.number || '').replace(/[ \-\(\)]/g, ''));

    } catch (error) {
    }
  };

  const handleAddContact = async () => {
    if (!name.trim() || !phone.trim()) {
      showConfirm({ title: t('error'), message: t('fill_all_fields'), icon: 'alert-circle', isDestructive: true });
      return;
    }

    if (contacts.length >= 5) {
      showConfirm({ title: t('limit_reached'), message: t('max_contacts_reached'), icon: 'warning', isDestructive: true });
      return;
    }

    try {
      setAdding(true);
      const response = await axiosInstance.post('/sos/contacts', { name, phone, relationship });
      if (response.data.success) {
        setContacts([...contacts, response.data.data]);
        setName('');
        setPhone('');
        showConfirm({ title: t('success'), message: t('contact_added_success'), icon: 'checkmark-circle' });
      }
    } catch (error) {
      showConfirm({ title: t('error'), message: t('failed_to_add_contact'), icon: 'close-circle', isDestructive: true });
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteContact = (id: number) => {
    showConfirm({
      title: t('remove_contact'),
      message: t('remove_contact_confirm'),
      icon: 'trash',
      isDestructive: true,
      confirmText: t('remove'),
      onConfirm: async () => {
        try {
          setModalVisible(false);
          await axiosInstance.delete(`/sos/contacts/${id}`);
          setContacts(contacts.filter(c => c.id !== id));
        } catch (error) {
          showConfirm({ title: t('error'), message: t('failed_to_remove_contact'), icon: 'close-circle', isDestructive: true });
        }
      }
    });
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
      {/* HEADER */}
      <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: dividerColor }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={ms(24)} color={textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>{t('trusted_contacts')}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* INFO BANNER */}
        <Animated.View entering={FadeInUp.duration(600)}>
          <PremiumInfoBanner
            description={t('trusted_contacts_desc')}
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
              <Text style={[styles.addCardTitle, { color: textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>{t('add_new_contact')}</Text>
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
              <Text style={[styles.importTitle, { color: textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>
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
            <Text style={[styles.inputLabel, { color: textSecondary }]} numberOfLines={1} adjustsFontSizeToFit>{t('contact_name')}</Text>
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
            <Text style={[styles.inputLabel, { color: textSecondary }]} numberOfLines={1} adjustsFontSizeToFit>{t('phone_number')}</Text>
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
            <Text style={[styles.inputLabel, { color: textSecondary }]} numberOfLines={1} adjustsFontSizeToFit>
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
                      ]} numberOfLines={1} adjustsFontSizeToFit>
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
            disabled={adding || !isFormValid}
            style={({ pressed }) => [
              styles.saveBtn,
              {
                backgroundColor: !isFormValid
                  ? (isDark ? '#374151' : '#E5E7EB')
                  : colors.primary,
                opacity: pressed ? 0.85 : adding ? 0.6 : 1,
              }
            ]}
          >
            {adding ? (
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
                ]} numberOfLines={1} adjustsFontSizeToFit>
                  {t('save_contact')}
                </Text>
              </>
            )}
          </Pressable>
        </Animated.View>

        {/* ── CONTACTS LIST ── */}
        <View style={styles.contactsList}>
          <View style={styles.listHeaderRow}>
            <Text style={[styles.listTitle, { color: textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>{t('my_trusted_contacts')}</Text>
            <View style={[styles.countBadge, { backgroundColor: isDark ? '#374151' : '#E5E7EB' }]}>
              <Text style={[styles.countText, { color: textSecondary }]}>{contacts.length}/5</Text>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginTop: vs(40) }} color={colors.primary} size="large" />
          ) : contacts.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: cardBg }]}>
              <View style={[styles.emptyIconRing, { backgroundColor: isDark ? '#1E3A5F' : '#EFF6FF' }]}>
                <Ionicons name="people-outline" size={ms(36)} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: textPrimary }]}>{t('no_contacts_added')}</Text>
              <Text style={[styles.emptySubText, { color: textMuted }]}>
                {t('add_contact_hint') || 'Add a trusted contact using the form above'}
              </Text>
            </View>
          ) : (
            contacts.map((contact, index) => (
              <PremiumSosContactCard
                key={contact.id}
                name={contact.name}
                phone={contact.phone}
                relationship={contact.relationship || 'Family'}
                index={index}
                onDelete={() => handleDeleteContact(contact.id)}
              />
            ))
          )}
        </View>
      </ScrollView>

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ms(16),
    paddingVertical: vs(12),
    borderBottomWidth: 1,
  },
  backBtn: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(12),
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: ms(18),
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerRight: {
    width: ms(40),
  },
  content: {
    padding: ms(16),
    paddingBottom: vs(40),
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

  // ── Contacts List ──
  contactsList: {
    marginTop: vs(4),
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(16),
  },
  listTitle: {
    fontSize: ms(16),
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  countBadge: {
    paddingHorizontal: ms(10),
    paddingVertical: vs(4),
    borderRadius: ms(10),
  },
  countText: {
    fontSize: ms(12),
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: ms(32),
    borderRadius: ms(20),
  },
  emptyIconRing: {
    width: ms(72),
    height: ms(72),
    borderRadius: ms(20),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: vs(16),
  },
  emptyTitle: {
    fontSize: ms(15),
    fontWeight: '700',
    marginBottom: vs(6),
  },
  emptySubText: {
    fontSize: ms(13),
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default SosContactsScreen;
