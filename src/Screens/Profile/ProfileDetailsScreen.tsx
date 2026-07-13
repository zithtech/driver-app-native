import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  Linking,
  RefreshControl,
  Image,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import { useAppTheme } from '../../context/ThemeContext';
import { useIsFocused } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import AppStatusBar from '../../Components/AppStatusBar';
import { ms, vs } from '../../lib/scale';
import ImageZoomModal from '../../Components/ImageZoomModal';
import { resolveImageUrl } from '../../utils/imageUtils';

const ListRow = ({ icon, label, value, isLast, s, iconColor }: any) => (
  <View style={[s.listRowItem, !isLast && s.listRowDivider]}>
    <View style={s.listRowLeft}>
      {icon && <Ionicons name={icon} size={18} color={iconColor} style={s.listRowIcon} />}
      <Text style={s.listRowLabel}>{label}</Text>
    </View>
    <View style={s.listRowRight}>
      <Text style={s.listRowValue} numberOfLines={2}>{value || '-'}</Text>
    </View>
  </View>
);

const MultiColRow = ({ items, isLast, s, iconColor }: any) => (
  <View style={[s.listRowItem, !isLast && s.listRowDivider, { paddingVertical: vs(12) }]}>
    {items.map((item: any, index: number) => (
      <View key={index} style={{ flex: 1, borderRightWidth: index < items.length - 1 ? StyleSheet.hairlineWidth : 0, borderColor: s.sectionContent.borderColor, paddingHorizontal: 8 }}>
        <Text style={[s.listRowLabel, { fontSize: ms(12), color: s.listRowValue.color, marginBottom: vs(2) }]}>{item.label}</Text>
        <Text style={[s.listRowValue, { textAlign: 'left', fontSize: ms(15) }]} numberOfLines={1}>{item.value || '-'}</Text>
      </View>
    ))}
  </View>
);

const Section = ({ title, children, s }: any) => (
  <View style={s.sectionContainer}>
    {title && <Text style={s.sectionTitle}>{title.toUpperCase()}</Text>}
    <View style={s.sectionContent}>
      {children}
    </View>
  </View>
);

export default function ProfileDetailsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme, isDark } = useAppTheme();
  const colors = theme.colors;
  const user = useSelector((state: RootState) => state.userSlice.user);
  const profileRequest = useSelector((state: RootState) => {
    return state.userSlice.profileUpdateRequest ?? { status: 'NONE' };
  });

  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [showProfileImage, setShowProfileImage] = useState(false);

  const isFocused = useIsFocused();

  React.useEffect(() => {
    setImgError(false);
  }, [user?.profile_picture]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  };

  const getInitials = () => {
    if (!user) return 'UN';
    const first = user.first_name ? user.first_name.charAt(0).toUpperCase() : '';
    const last = user.last_name ? user.last_name.charAt(0).toUpperCase() : '';
    return `${first}${last}`;
  };

  const dynamicStyles = useMemo(() => {
    const textPrimary = theme.colors.text;
    const textSecondary = theme.colors.textMuted;
    const bgColor = isDark ? '#000000' : '#FFFFFF';
    const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
    const separatorColor = isDark ? '#38383A' : '#E5E5EA';

    return StyleSheet.create({
      safeArea: {
        flex: 1,
        backgroundColor: bgColor,
      },
      headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: vs(12),
        paddingBottom: vs(12),
        backgroundColor: bgColor,
      },
      headerTitle: {
        flex: 1,
        fontSize: ms(18),
        fontWeight: '600',
        color: textPrimary,
        textAlign: 'center',
      },
      backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-start',
      },
      editIconButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-end',
      },
      scrollView: {
        flexGrow: 1,
        paddingBottom: vs(40),
      },
      topSection: {
        marginTop: vs(20),
        marginBottom: vs(24),
      },
      profileInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        marginBottom: vs(20),
      },
      profileTextContainer: {
        flex: 1,
        marginLeft: ms(16),
      },
      avatarContainer: {
        width: ms(80),
        height: ms(80),
        borderRadius: ms(40),
        backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
      },
      avatarText: {
        fontSize: ms(36),
        fontWeight: '600',
        color: textSecondary,
      },
      verifiedBadge: {
        position: 'absolute',
        bottom: 0,
        right: -4,
        width: ms(24),
        height: ms(24),
        borderRadius: ms(12),
        backgroundColor: '#34C759',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: bgColor,
      },
      nameText: {
        fontSize: ms(20),
        fontWeight: '700',
        color: textPrimary,
        marginBottom: vs(4),
      },
      emailText: {
        fontSize: ms(15),
        color: textSecondary,
        marginBottom: vs(12),
      },
      pillsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      },
      statusPill: {
        paddingHorizontal: ms(12),
        paddingVertical: vs(4),
        borderRadius: ms(12),
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
      },
      statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
      },
      statusPillText: {
        fontSize: ms(12),
        fontWeight: '600',
      },

      sectionContainer: {
        marginBottom: vs(24),
      },
      sectionTitle: {
        fontSize: ms(13),
        fontWeight: '500',
        color: textSecondary,
        marginLeft: 16,
        marginBottom: vs(8),
        letterSpacing: 0.5,
      },
      sectionContent: {
        backgroundColor: cardBg,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: separatorColor,
        paddingLeft: 16,
      },
      listRowItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: vs(14),
        paddingRight: 16,
      },
      listRowDivider: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: separatorColor,
      },
      listRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 0.4,
      },
      listRowIcon: {
        marginRight: 12,
      },
      listRowLabel: {
        fontSize: ms(16),
        color: textPrimary,
      },
      listRowRight: {
        flex: 0.6,
        alignItems: 'flex-end',
        paddingLeft: 8,
      },
      listRowValue: {
        fontSize: ms(16),
        color: textSecondary,
        textAlign: 'right',
      },
      pendingBox: {
        marginHorizontal: 16,
        marginBottom: vs(16),
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: isDark ? 'rgba(255, 149, 0, 0.15)' : '#FFF9E6',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255, 149, 0, 0.3)' : '#FFD60A',
      },
      pendingText: {
        fontSize: ms(13),
        color: isDark ? '#FFD60A' : '#D97706',
        flex: 1,
        fontWeight: '500',
      },
      // Modal Styles
      modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)', // Slightly lighter overlay
        justifyContent: 'flex-end',
      },
      modalContent: {
        backgroundColor: cardBg,
        borderTopLeftRadius: 32, // More premium curve
        borderTopRightRadius: 32,
        padding: 24,
        paddingBottom: 40,
        alignItems: 'center',
      },
      dragIndicator: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: separatorColor,
        marginBottom: 24,
      },
      modalIconBg: {
        marginBottom: 16,
      },
      modalTitle: {
        fontSize: 22,
        fontWeight: '600',
        color: textPrimary,
        marginBottom: 8,
      },
      modalText: {
        fontSize: 16,
        color: textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
      },
      modalCallBtn: {
        backgroundColor: colors.primary,
        width: '100%',
        paddingVertical: 16,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
      },
      modalCallBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
      },
      modalCancelBtn: {
        width: '100%',
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
      },
      modalCancelBtnText: {
        color: textSecondary,
        fontSize: 16,
        fontWeight: '500',
      },
    });
  }, [isDark, colors]);

  if (!user) { return null; }

  const s = dynamicStyles;
  const iconColor = isDark ? '#8E8E93' : '#8E8E93';

  return (
    <SafeAreaView style={s.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      {isFocused && <AppStatusBar forceLight={false} />}
      
      <View style={s.headerRow}>
        <Pressable onPress={() => navigation.goBack()} style={s.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </Pressable>
        <Text style={s.headerTitle}>{t('profile_details')}</Text>
        <Pressable 
          onPress={() => setEditModalVisible(true)} 
          style={s.editIconButton}
          disabled={profileRequest?.status === 'PENDING'}
        >
          <Ionicons name="pencil" size={20} color={profileRequest?.status === 'PENDING' ? '#9CA3AF' : colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={s.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {profileRequest.status === 'PENDING' && (
          <View style={s.pendingBox}>
            <Ionicons name="time" size={18} color={isDark ? '#FFD60A' : '#D97706'} />
            <Text style={s.pendingText}>
              {t('profile_update_pending')}
            </Text>
          </View>
        )}

        <View style={s.topSection}>
          <View style={s.profileInfoRow}>
            <Pressable
              onPress={() => {
                if (user?.profile_picture && !imgError) {
                  setShowProfileImage(true);
                }
              }}
            >
              <View style={s.avatarContainer}>
                {user?.profile_picture && !imgError ? (
                  <Image
                    source={{ uri: resolveImageUrl(user.profile_picture) }}
                    style={{ width: ms(80), height: ms(80), borderRadius: ms(40) }}
                    resizeMode="cover"
                    fadeDuration={0}
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <Text style={s.avatarText}>{getInitials()}</Text>
                )}
              </View>
              <View style={s.verifiedBadge}>
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              </View>
            </Pressable>

            <View style={s.profileTextContainer}>
              <Text style={s.nameText}>{user?.full_name}</Text>
              <Text style={s.emailText}>{user?.email || t('no_email')}</Text>

              <View style={s.pillsRow}>
                <View style={[s.statusPill, { backgroundColor: isDark ? 'rgba(52, 199, 89, 0.15)' : '#E6F8EB' }]}>
                  <View style={[s.statusDot, { backgroundColor: '#34C759' }]} />
                  <Text style={[s.statusPillText, { color: isDark ? '#34C759' : '#248A3D' }]}>{t('verified')}</Text>
                </View>
                <View style={[s.statusPill, { backgroundColor: isDark ? 'rgba(255, 149, 0, 0.15)' : '#FFF4E6' }]}>
                  <View style={[s.statusDot, { backgroundColor: '#FF9500' }]} />
                  <Text style={[s.statusPillText, { color: isDark ? '#FF9500' : '#B26800' }]}>{t('active')}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <Section title={t('personal_information')} s={s}>
          <MultiColRow 
            items={[
              { label: t('first_name'), value: user?.first_name },
              { label: t('last_name'), value: user?.last_name },
            ]}
            s={s}
            iconColor={iconColor}
          />
          <MultiColRow 
            items={[
              { label: t('date_of_birth'), value: user?.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null },
              { label: t('gender'), value: user?.gender ? t(user.gender.toLowerCase()) : null },
            ]}
            s={s}
            iconColor={iconColor}
            isLast
          />
        </Section>

        <Section title={t('contact_information')} s={s}>
          <ListRow label={t('email')} value={user?.email} icon="mail-outline" iconColor={iconColor} s={s} />
          <MultiColRow 
            items={[
              { label: t('phone'), value: user?.phone_number },
              { label: t('alternative_phone'), value: user?.alternate_contact },
            ]}
            s={s}
            iconColor={iconColor}
            isLast
          />
        </Section>

        <Section title={t('step_address_label')} s={s}>
          <ListRow label={t('street')} value={user?.address?.street} icon="location-outline" iconColor={iconColor} s={s} />
          <ListRow label={t('city')} value={user?.address?.city} icon="location-outline" iconColor={iconColor} s={s} />
          <MultiColRow 
            items={[
              { label: t('state'), value: user?.address?.state },
              { label: t('country'), value: user?.address?.country },
              { label: t('pincode'), value: user?.address?.pincode },
            ]}
            s={s}
            iconColor={iconColor}
            isLast
          />
        </Section>

      </ScrollView>

      <Modal
        visible={isEditModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.dragIndicator} />
            <View style={s.modalIconBg}>
              <Ionicons name="headset-outline" size={40} color={colors.primary} />
            </View>
            <Text style={s.modalTitle}>{t('profile_update_title')}</Text>
            <Text style={s.modalText}>
              {t('profile_update_call_desc')}
            </Text>

            <Pressable
              style={s.modalCallBtn}
              onPress={() => {
                setEditModalVisible(false);
                Linking.openURL('tel:+18001234567'); // Replace with actual support number
              }}
            >
              <Text style={s.modalCallBtnText}>{t('call_support')}</Text>
            </Pressable>

            <Pressable
              style={s.modalCancelBtn}
              onPress={() => setEditModalVisible(false)}
            >
              <Text style={s.modalCancelBtnText}>{t('cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ImageZoomModal
        visible={showProfileImage}
        imageUris={user?.profile_picture ? [resolveImageUrl(user.profile_picture) || ''] : []}
        onClose={() => setShowProfileImage(false)}
      />

    </SafeAreaView >
  );
}
