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
import { useToast } from '../../context/ToastContext';
import AppStatusBar from '../../Components/AppStatusBar';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import axiosInstance from '../../api/axiosInstance';
// @ts-ignore
import { selectContactPhone } from 'react-native-select-contact';
import {
  PremiumInfoBanner,
  ConfirmationModal
} from '../../Components';
import { ms, vs, s } from '../../lib/scale';
import Animated, { FadeInUp, FadeInDown, FadeInRight, Layout } from 'react-native-reanimated';

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
  const { showToast } = useToast();

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
      showToast({
        message: t('failed_to_load_contacts') || 'Failed to load trusted contacts.',
        type: 'error'
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
          showToast({
            message: t('contacts_permission_required') || 'Contacts permission is required.',
            type: 'error'
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
      showToast({ message: t('fill_all_fields') || 'Please fill all fields', type: 'error' });
      return;
    }

    if (contacts.length >= 5) {
      showToast({ message: t('max_contacts_reached') || 'Max contacts reached', type: 'error' });
      return;
    }

    try {
      setAdding(true);
      const response = await axiosInstance.post('/sos/contacts', { name, phone, relationship });
      if (response.data.success) {
        setContacts([...contacts, response.data.data]);
        setName('');
        setPhone('');
        showToast({ message: t('contact_added_success') || 'Emergency contact added securely!', type: 'success' });
      }
    } catch (error) {
      showToast({ message: t('failed_to_add_contact') || 'Failed to add contact', type: 'error' });
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
          showToast({ message: t('failed_to_remove_contact') || 'Failed to remove contact', type: 'error' });
        }
      }
    });
  };

  const textPrimary = isDark ? '#F3F4F6' : '#111827';
  const textSecondary = isDark ? '#9CA3AF' : '#4B5563';
  const textMuted = isDark ? '#6B7280' : '#9CA3AF';
  const cardBg = isDark ? '#1F2937' : '#FFFFFF';
  const inputBg = isDark ? '#1F2937' : '#FFFFFF';
  const inputBorder = isDark ? 'rgba(255,255,255,0.1)' : '#F3F4F6';
  const dividerColor = isDark ? '#374151' : '#F3F4F6';
  const isFormValid = name.trim().length > 0 && phone.trim().length > 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#111827' : '#FFFFFF' }]} edges={['top', 'bottom']}>
      <AppStatusBar />
      {/* HEADER */}
      <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: dividerColor }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>{t('emergency_contacts', 'Emergency Contacts')}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── ADD CONTACT CARD ── */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          style={[styles.addCard, { backgroundColor: cardBg, borderColor: dividerColor }]}
        >
          {/* Card Header */}
          <View style={styles.addCardHeader}>
            <View style={[styles.addCardIconBox, { backgroundColor: 'transparent' }]}>
              <Ionicons name="person-add-outline" size={22} color={textPrimary} />
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
                backgroundColor: isDark ? (pressed ? '#111827' : '#1F2937') : (pressed ? '#F3F4F6' : '#FFFFFF'),
                borderColor: inputBorder,
              }
            ]}
          >
            <View style={[styles.importIconBox, { backgroundColor: 'transparent' }]}>
              <Ionicons name="phone-portrait-outline" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.importTitle, { color: textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>
                {t('import_from_contacts') || 'Import from Contacts'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={textMuted} />
          </Pressable>

          <View style={styles.orDividerRow}>
            <View style={[styles.orDividerLine, { backgroundColor: dividerColor }]} />
          </View>

          {/* Name Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: textSecondary }]} numberOfLines={1} adjustsFontSizeToFit>{t('contact_name')}</Text>
            <View style={[styles.inputRow, { backgroundColor: inputBg, borderColor: name ? colors.primary : inputBorder }]}>
              <Ionicons name="person-outline" size={18} color={name ? colors.primary : textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { color: textPrimary }]}
                placeholder={t('enter_name') || 'e.g. John Doe'}
                placeholderTextColor={textMuted}
                value={name}
                onChangeText={setName}
              />
              {name.length > 0 && (
                <Pressable onPress={() => setName('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={textMuted} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Phone Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: textSecondary }]} numberOfLines={1} adjustsFontSizeToFit>{t('phone_number')}</Text>
            <View style={[styles.inputRow, { backgroundColor: inputBg, borderColor: phone ? colors.primary : inputBorder }]}>
              <Ionicons name="call-outline" size={18} color={phone ? colors.primary : textMuted} style={styles.inputIcon} />
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
                  <Ionicons name="close-circle" size={18} color={textMuted} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Relationship Chips */}
          <View style={[styles.inputGroup, { marginBottom: 16 }]}>
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
                          backgroundColor: isSelected ? (isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)') : 'transparent',
                          borderColor: isSelected ? colors.primary : inputBorder,
                        }
                      ]}
                    >
                      <Ionicons
                        name={icon}
                        size={16}
                        color={isSelected ? colors.primary : textMuted}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={[
                        styles.chipText,
                        { color: isSelected ? colors.primary : textSecondary }
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
              <Text style={[
                styles.saveBtnText,
                { color: !isFormValid ? textMuted : '#FFFFFF' }
              ]} numberOfLines={1} adjustsFontSizeToFit>
                {t('save_contact') || 'Save Contact'}
              </Text>
            )}
          </Pressable>
        </Animated.View>

        {/* ── CONTACTS LIST ── */}
        <View style={styles.contactsList}>
          <View style={styles.listHeaderRow}>
            <Text style={[styles.listTitle, { color: textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>{t('my_trusted_contacts')}</Text>
            <Text style={[styles.countText, { color: textSecondary }]}>{contacts.length} / 5</Text>
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} size="large" />
          ) : contacts.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: 'transparent' }]}>
              <Ionicons name="people-outline" size={48} color={textMuted} style={{ marginBottom: 16 }} />
              <Text style={[styles.emptyTitle, { color: textPrimary }]}>{t('no_contacts_added')}</Text>
              <Text style={[styles.emptySubText, { color: textSecondary }]}>
                {t('add_contact_hint') || 'Add a trusted contact using the form above'}
              </Text>
            </View>
          ) : (
            contacts.map((contact, index) => (
              <SosContactCard
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

        {/* SECURE BANNER */}
        <Animated.View entering={FadeInUp.delay(300).duration(600)}>
          <View style={[styles.secureBannerContainer, { backgroundColor: isDark ? '#064E3B' : '#F0FDF4', borderColor: isDark ? '#065F46' : '#DCFCE7' }]}>
            <View style={[styles.secureBannerIconLeft, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#DCFCE7' }]}>
              <Ionicons name="shield-checkmark" size={24} color={isDark ? '#34D399' : '#16A34A'} />
            </View>
            <View style={styles.secureBannerTextContainer}>
              <Text style={[styles.secureBannerTitle, { color: isDark ? '#34D399' : '#16A34A' }]}>
                {t('your_info_secure', 'Your information is secure')}
              </Text>
              <Text style={[styles.secureBannerDesc, { color: isDark ? '#D1FAE5' : '#064E3B' }]}>
                {t('info_secure_desc', 'This information will only be used in case of emergency and is kept strictly confidential.')}
              </Text>
            </View>
            <View style={[styles.secureBannerIconRight, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#DCFCE7' }]}>
              <Ionicons name="lock-closed" size={20} color={isDark ? '#34D399' : '#16A34A'} />
            </View>
          </View>
        </Animated.View>
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    width: 24,
  },
  content: {
    padding: 12,
    paddingBottom: 24,
  },

  // ── Add Contact Card ──
  addCard: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  addCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addCardIconBox: {
    marginRight: 10,
  },
  addCardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },

  // ── Import from Contacts ──
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  importIconBox: {
    marginRight: 12,
  },
  importTitle: {
    fontSize: 14,
    fontWeight: '500',
  },

  // ── Or Divider ──
  orDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  orDividerLine: {
    flex: 1,
    height: 1,
  },

  // ── Inputs ──
  inputGroup: {
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    height: '100%',
    paddingVertical: 0,
  },

  // ── Chips ──
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 24, // Pill shape
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // ── Save Button ──
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // ── Contacts List ──
  contactsList: {
    marginTop: 4,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  countText: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    textAlign: 'center',
  },

  // ── Secure Banner ──
  secureBannerContainer: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 8,
  },
  secureBannerIconLeft: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  secureBannerTextContainer: {
    flex: 1,
  },
  secureBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  secureBannerDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  secureBannerIconRight: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
});

// ── Inline Contact Card Component ──
const AVATAR_COLORS = [
  { bg: '#DBEAFE', text: '#1E40AF' },
  { bg: '#E0E7FF', text: '#3730A3' },
  { bg: '#FEF3C7', text: '#92400E' },
  { bg: '#DCFCE7', text: '#166534' },
  { bg: '#FCE7F3', text: '#9D174D' },
];

const SosContactCard = ({ name, phone, relationship, status = 'verified', onDelete, index }: any) => {
  const { isDark } = useAppTheme();
  const avatarStyle = AVATAR_COLORS[index % AVATAR_COLORS.length];

  return (
    <Animated.View 
      entering={FadeInRight.delay(index * 100)}
      layout={Layout.springify()}
      style={[
        cardStyles.container,
        { 
          backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
          borderColor: isDark ? '#374151' : '#E5E7EB',
        }
      ]}
    >
      <View style={[cardStyles.avatar, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : avatarStyle.bg }]}>
        <Text style={[cardStyles.avatarText, { color: isDark ? '#9CA3AF' : avatarStyle.text }]}>
          {name.charAt(0).toUpperCase()}
        </Text>
      </View>
      
      <View style={cardStyles.info}>
        <View style={cardStyles.nameRow}>
          <Text style={[cardStyles.name, { color: isDark ? '#F3F4F6' : '#111827' }]} numberOfLines={1}>
            {name}
          </Text>
        </View>
        
        <View style={cardStyles.phoneStatusRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[cardStyles.phone, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>{phone}</Text>
            {relationship && (
              <View style={[cardStyles.tag, { borderColor: isDark ? '#374151' : '#E5E7EB', marginLeft: 8 }]}>
                <Text style={[cardStyles.tagText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                  {relationship}
                </Text>
              </View>
            )}
          </View>
          
          <View style={cardStyles.statusRow}>
            <Ionicons 
              name={status === 'verified' ? "shield-checkmark-outline" : "time-outline"} 
              size={12} 
              color={status === 'verified' ? '#10B981' : '#F59E0B'} 
            />
            <Text style={[cardStyles.statusText, { color: status === 'verified' ? '#10B981' : '#F59E0B' }]}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </View>
        </View>
      </View>
      
      {onDelete && (
        <Pressable 
          onPress={onDelete} 
          style={({ pressed }) => [
            cardStyles.deleteBtn,
            pressed && { opacity: 0.5 }
          ]}
        >
          <Ionicons name="trash-outline" size={ms(20)} color={isDark ? '#EF4444' : '#DC2626'} />
        </Pressable>
      )}
    </Animated.View>
  );
};

const cardStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: ms(12),
    borderRadius: ms(12),
    marginBottom: vs(10),
    borderWidth: 1,
  },
  avatar: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: ms(12),
  },
  avatarText: {
    fontSize: ms(16),
    fontWeight: '700',
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: vs(2),
    flexWrap: 'wrap',
  },
  name: {
    fontSize: ms(15),
    fontWeight: '700',
    marginRight: ms(8),
  },
  tag: {
    paddingHorizontal: ms(6),
    paddingVertical: vs(2),
    borderRadius: ms(8),
    borderWidth: 1,
  },
  tagText: {
    fontSize: ms(9),
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  phoneStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  phone: {
    fontSize: ms(13),
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: ms(10),
    fontWeight: '600',
    marginLeft: ms(2),
  },
  deleteBtn: {
    width: ms(36),
    height: ms(36),
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: ms(12),
  },
});

export default SosContactsScreen;
