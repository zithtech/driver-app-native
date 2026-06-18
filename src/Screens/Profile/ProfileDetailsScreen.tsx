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
  StatusBar,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import { useAppTheme } from '../../context/ThemeContext';
import { useIsFocused } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import AppStatusBar from '../../Components/AppStatusBar';
import { ms, vs } from '../../lib/scale';
import ImageZoomModal from '../../Components/ImageZoomModal';
import { resolveImageUrl } from '../../utils/imageUtils';

const CardSection = ({ title, icon, children, s, headerIconColor }: any) => (
  <View style={s.cardSection}>
    <View style={s.cardHeader}>
      <View style={s.cardHeaderIconWrap}>
        <Ionicons name={icon} size={16} color={headerIconColor} />
      </View>
      <Text style={s.cardHeaderTitle} numberOfLines={1} adjustsFontSizeToFit>{title}</Text>
    </View>
    {children}
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

  // Reset image error when the actual photo changes (e.g. new selfie uploaded)
  React.useEffect(() => {
    setImgError(false);
  }, [user?.profile_picture]);

  const onRefresh = () => {
    setRefreshing(true);
    // TODO: Dispatch a Redux thunk here to fetch latest user profile, like:
    // dispatch(fetchUserProfile()).finally(() => setRefreshing(false));

    // Simulating a network request for now
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
    const textPrimary = isDark ? '#FFFFFF' : '#111827';
    const textSecondary = isDark ? '#9CA3AF' : '#6B7280';

    const labelColor = isDark ? '#9CA3AF' : '#6B7280';
    const cardBg = isDark ? '#1F2937' : '#FFFFFF';

    return StyleSheet.create({
      safeArea: {
        flex: 1,
        backgroundColor: colors.background,
      },
      scrollView: {
        flexGrow: 1,
      },
      contentContainer: {
        padding: 16,
      },
      headerGradient: {
        paddingTop: 20,
        paddingBottom: 30,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
      },
      pendingBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: isDark ? 'rgba(146, 64, 14, 0.2)' : '#FEF3C7',
        padding: 12,
        borderRadius: 12,
        marginBottom: 16,
      },
      pendingText: {
        fontSize: ms(13),
        color: isDark ? '#FCD34D' : '#92400E',
        flex: 1,
      },
      topSection: {
        alignItems: 'center',
        marginTop: vs(10),
        marginBottom: vs(24),
      },
      avatarContainer: {
        width: ms(80),
        height: ms(80),
        borderRadius: ms(40),
        backgroundColor: isDark ? '#374151' : '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
      },
      avatarText: {
        fontSize: ms(32),
        fontWeight: '700',
        color: textPrimary,
      },
      verifiedBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: ms(24),
        height: ms(24),
        borderRadius: ms(12),
        backgroundColor: '#10B981',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: colors.background,
      },
      nameText: {
        fontSize: ms(24),
        fontWeight: '700',
        color: '#FFFFFF',
        marginTop: vs(16),
      },
      emailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: vs(4),
      },
      emailText: {
        fontSize: ms(14),
        color: 'rgba(255, 255, 255, 0.8)',
        marginLeft: ms(6),
      },
      pillsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 16,
        gap: 12,
      },
      verifiedPill: {
        backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#D1FAE5',
        borderColor: isDark ? '#059669' : '#10B981',
        borderWidth: 1,
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 4,
      },
      verifiedPillText: {
        color: isDark ? '#10B981' : '#047857',
        fontSize: ms(12),
        fontWeight: '600',
      },
      activePill: {
        backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7',
        borderColor: isDark ? '#D97706' : '#F59E0B',
        borderWidth: 1,
        borderRadius: ms(16),
        paddingHorizontal: ms(16),
        paddingVertical: vs(4),
      },
      activePillText: {
        color: isDark ? '#F59E0B' : '#B45309',
        fontSize: ms(12),
        fontWeight: '600',
      },
      buttonsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 24,
        gap: 16,
        width: '100%',
      },
      editButton: {
        flex: 1,
        backgroundColor: colors.primary,
        paddingVertical: 14,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
      },
      editButtonText: {
        color: '#FFFFFF',
        fontSize: ms(16),
        fontWeight: '600',
        marginLeft: ms(8),
      },
      documentsButton: {
        flex: 1,
        backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
        paddingVertical: vs(14),
        borderRadius: ms(16),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
      },
      documentsButtonText: {
        color: textPrimary,
        fontSize: ms(16),
        fontWeight: '600',
        marginLeft: ms(8),
      },
      bannerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: isDark ? 'rgba(6, 78, 59, 0.4)' : '#ECFDF5',
        borderColor: isDark ? '#064E3B' : '#A7F3D0',
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
      },
      bannerIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: isDark ? '#064E3B' : '#D1FAE5',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
      },
      bannerTitle: {
        fontSize: ms(16),
        fontWeight: '700',
        color: isDark ? '#34D399' : '#065F46',
        marginBottom: vs(4),
      },
      bannerDesc: {
        fontSize: ms(13),
        color: isDark ? '#9CA3AF' : '#047857',
        lineHeight: ms(18),
      },
      cardSection: {
        backgroundColor: cardBg,
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: isDark ? 1 : 0,
        borderColor: '#374151',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0 : 0.05,
        shadowRadius: 8
      },
      cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
      },
      cardHeaderIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: isDark ? '#374151' : '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
      },
      cardHeaderTitle: {
        fontSize: ms(16),
        fontWeight: '700',
        color: textPrimary,
        flex: 1,
      },
      gridRow: {
        flexDirection: 'row',
        marginBottom: 20,
        gap: 16,
      },
      gridCol: {
        flex: 1,
      },
      labelText: {
        fontSize: ms(12),
        color: labelColor,
        letterSpacing: 0.5,
        marginBottom: vs(4),
      },
      valueText: {
        fontSize: ms(16),
        fontWeight: '600',
        color: textPrimary,
      },
      valueRow: {
        flexDirection: 'row',
        alignItems: 'center',
      },
      valueRowText: {
        fontSize: ms(15),
        fontWeight: '500',
        color: textPrimary,
        marginLeft: ms(6),
        flex: 1,
      },
      listRow: {
        marginBottom: 20,
      },
      listRowLast: {
        marginBottom: 0,
      },
      backButton: {
        position: 'absolute',
        top: 40,
        left: 16,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
      },
      modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
      },
      modalContent: {
        backgroundColor: cardBg,
        borderRadius: 24,
        padding: 24,
        width: '100%',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
        borderWidth: isDark ? 1 : 0,
        borderColor: '#374151',
      },
      modalIconBg: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
      },
      modalTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: textPrimary,
        marginBottom: 12,
        textAlign: 'center',
      },
      modalText: {
        fontSize: 15,
        color: textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
      },
      modalCallBtn: {
        backgroundColor: '#2563EB',
        width: '100%',
        paddingVertical: 16,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
      },
      modalCallBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
      },
      modalCancelBtn: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
      },
      modalCancelBtnText: {
        color: textSecondary,
        fontSize: 16,
        fontWeight: '600',
      },
    });
  }, [isDark, colors]);

  if (!user) { return null; }

  const s = dynamicStyles;
  const iconColor = isDark ? '#9CA3AF' : '#6B7280';
  const headerIconColor = isDark ? '#FBBF24' : '#B45309';

  return (
    <SafeAreaView style={s.safeArea} edges={['bottom', 'left', 'right']}>
      {isFocused && <AppStatusBar forceLight={true} />}
      <Pressable onPress={() => navigation.goBack()} style={s.backButton}>
        <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
      </Pressable>

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
        {/* ================= PREMIUM HEADER ================= */}
        <LinearGradient
          colors={isDark ? ['#152D5E', '#0F172A'] : ['#152D5E', '#1E3A8A']}
          style={s.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* ================= PENDING STATUS ================= */}
          {profileRequest.status === 'PENDING' && (
            <View style={s.pendingBox}>
              <Ionicons name="time-outline" size={18} color={isDark ? '#FCD34D' : '#92400E'} />
              <Text style={s.pendingText}>
                {t('profile_update_pending')}
              </Text>
            </View>
          )}

          <View style={s.topSection}>
            <Pressable
              style={s.avatarContainer}
              onPress={() => {
                if (user?.profile_picture && !imgError) {
                  setShowProfileImage(true);
                }
              }}
            >
              <View style={[s.avatarContainer, { position: 'relative', backgroundColor: 'transparent' }]}>
                {(() => {
                  // Priority 1: Show image if we have a URL and no error
                  if (user?.profile_picture && !imgError) {
                    return (
                      <Image
                        source={{ uri: resolveImageUrl(user.profile_picture) }}
                        style={{ width: 80, height: 80, borderRadius: 40 }}
                        resizeMode="cover"
                        fadeDuration={0}
                        onError={() => setImgError(true)}
                      />
                    );
                  }
                  // Priority 2: Show initials fallback
                  return <Text style={s.avatarText}>{getInitials()}</Text>;
                })()}
              </View>
              <View style={s.verifiedBadge}>
                <Ionicons name="shield-checkmark" size={12} color="#FFFFFF" />
              </View>
            </Pressable>

            <Text style={s.nameText}>
              {user?.full_name}
            </Text>

            <View style={s.emailRow}>
              <Ionicons name="mail-outline" size={16} color="rgba(255, 255, 255, 0.6)" />
              <Text style={s.emailText}>{user?.email || t('no_email')}</Text>
            </View>

            <View style={s.pillsRow}>
              <View style={[s.verifiedPill, { backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: '#10B981' }]}>
                <Text style={[s.verifiedPillText, { color: '#10B981' }]} numberOfLines={1} adjustsFontSizeToFit>{t('verified')}</Text>
              </View>
              <View style={[s.activePill, { backgroundColor: 'rgba(245, 158, 11, 0.2)', borderColor: '#F59E0B' }]}>
                <Text style={[s.activePillText, { color: '#F59E0B' }]} numberOfLines={1} adjustsFontSizeToFit>{t('active')}</Text>
              </View>
            </View>

            <View style={s.buttonsRow}>
              <Pressable
                disabled={profileRequest?.status === 'PENDING'}
                style={[
                  s.editButton,
                  { backgroundColor: '#FFFFFF' },
                  profileRequest?.status === 'PENDING' && { opacity: 0.5 },
                ]}
                onPress={() => setEditModalVisible(true)}
              >
                <Ionicons name="pencil" size={18} color="#152D5E" />
                <Text style={[s.editButtonText, { color: '#152D5E' }]} numberOfLines={1} adjustsFontSizeToFit>
                  {profileRequest?.status === 'PENDING' ? t('edit_disabled') : t('edit_profile')}
                </Text>
              </Pressable>

              <Pressable 
                onPress={() => navigation.navigate('ProfileDocumentsScreen')}
                style={[s.documentsButton, { backgroundColor: 'rgba(255, 255, 255, 0.15)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)' }]}
              >
                <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
                <Text style={[s.documentsButtonText, { color: '#FFFFFF' }]} numberOfLines={1} adjustsFontSizeToFit>{t('documents')}</Text>
              </Pressable>
            </View>
          </View>
        </LinearGradient>

        <View style={s.contentContainer}>
          {/* ================= VERIFIED BANNER ================= */}
          <View style={s.bannerCard}>
            <View style={s.bannerIconWrap}>
              <Ionicons name="shield-checkmark" size={20} color={isDark ? '#34D399' : '#059669'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.bannerTitle} numberOfLines={1} adjustsFontSizeToFit>{t('profile_verified')}</Text>
              <Text style={s.bannerDesc}>
                {t('profile_verified_desc')}
              </Text>
            </View>
          </View>

          {/* ================= PERSONAL INFO ================= */}
          <CardSection title={t('personal_information')} icon="person" s={s} headerIconColor={headerIconColor}>
            <View style={s.gridRow}>
              <View style={s.gridCol}>
                <Text style={s.labelText}>{t('first_name').toUpperCase()}</Text>
                <Text style={s.valueText}>{user?.first_name || '-'}</Text>
              </View>
              <View style={s.gridCol}>
                <Text style={s.labelText}>{t('last_name').toUpperCase()}</Text>
                <Text style={s.valueText}>{user?.last_name || '-'}</Text>
              </View>
            </View>

            <View style={s.gridRow}>
              <View style={s.gridCol}>
                <Text style={s.labelText}>{t('date_of_birth').toUpperCase()}</Text>
                <View style={s.valueRow}>
                  <Ionicons name="calendar-outline" size={16} color={iconColor} />
                  <Text style={s.valueRowText}>
                    {user?.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '-'}
                  </Text>
                </View>
              </View>
              <View style={s.gridCol}>
                <Text style={s.labelText}>{t('gender').toUpperCase()}</Text>
                <View style={s.valueRow}>
                  <Ionicons name="people-outline" size={16} color={iconColor} />
                  <Text style={s.valueRowText}>
                    {user?.gender ? t(user.gender.toLowerCase()) : '-'}
                  </Text>
                </View>
              </View>
            </View>
          </CardSection>

          {/* ================= CONTACT INFO ================= */}
          <CardSection title={t('contact_information')} icon="call" s={s} headerIconColor={headerIconColor}>
            <View style={s.listRow}>
              <Text style={s.labelText}>{t('email').toUpperCase()}</Text>
              <View style={s.valueRow}>
                <Ionicons name="mail-outline" size={16} color={iconColor} />
                <Text style={s.valueRowText}>{user?.email || '-'}</Text>
              </View>
            </View>

            <View style={s.listRow}>
              <Text style={s.labelText}>{t('phone').toUpperCase()}</Text>
              <View style={s.valueRow}>
                <Ionicons name="call-outline" size={16} color={iconColor} />
                <Text style={s.valueRowText}>{user?.phone_number || '-'}</Text>
              </View>
            </View>

            <View style={s.listRowLast}>
              <Text style={s.labelText}>{t('alternative_phone').toUpperCase()}</Text>
              <View style={s.valueRow}>
                <Ionicons name="call-outline" size={16} color={iconColor} />
                <Text style={s.valueRowText}>{user?.alternate_contact || '-'}</Text>
              </View>
            </View>
          </CardSection>

          {/* ================= ADDRESS ================= */}
          <CardSection title={t('step_address_label')} icon="location" s={s} headerIconColor={headerIconColor}>
            <View style={s.listRow}>
              <Text style={s.labelText}>{t('street').toUpperCase()}</Text>
              <Text style={s.valueText}>{user?.address?.street || '-'}</Text>
            </View>
            <View style={s.listRow}>
              <Text style={s.labelText}>{t('city').toUpperCase()}</Text>
              <Text style={s.valueText}>{user?.address?.city || '-'}</Text>
            </View>
            <View style={s.listRow}>
              <Text style={s.labelText}>{t('state').toUpperCase()}</Text>
              <Text style={s.valueText}>{user?.address?.state || '-'}</Text>
            </View>
            <View style={s.listRow}>
              <Text style={s.labelText}>{t('country').toUpperCase()}</Text>
              <Text style={s.valueText}>{user?.address?.country || '-'}</Text>
            </View>
            <View style={s.listRowLast}>
              <Text style={s.labelText}>{t('pincode').toUpperCase()}</Text>
              <Text style={s.valueText}>{user?.address?.pincode || '-'}</Text>
            </View>
          </CardSection>

        </View>
      </ScrollView>

      {/* ================= EDIT PROFILE MODAL ================= */}
      <Modal
        visible={isEditModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalIconBg}>
              <Ionicons name="information-circle" size={32} color="#3B82F6" />
            </View>
            <Text style={s.modalTitle} numberOfLines={1} adjustsFontSizeToFit>{t('profile_update_title')}</Text>
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
              <Ionicons name="call" size={20} color="#FFFFFF" />
              <Text style={s.modalCallBtnText} numberOfLines={1} adjustsFontSizeToFit>{t('call_support')}</Text>
            </Pressable>

            <Pressable
              style={s.modalCancelBtn}
              onPress={() => setEditModalVisible(false)}
            >
              <Text style={s.modalCancelBtnText} numberOfLines={1} adjustsFontSizeToFit>{t('cancel')}</Text>
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
