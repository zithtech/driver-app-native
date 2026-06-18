import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  ScrollView,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import { RootState } from '../../redux/store';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { setBannerIndex } from '../../redux/userSlice';
import AppStatusBar from '../../Components/AppStatusBar';
import { useAppTheme } from '../../context/ThemeContext';
import { useLazyGetDriverByIdQuery, useGetRideActivityQuery } from '../../service/driverApi';
import { calculateAverageRating } from '../../utils/ratingUtils';
import {
  HelpCenter_Nav,
  ContactSupport_Nav,
  AboutApp_Nav,
  SosContacts_Nav,
  ReferEarn_Nav,
} from '../../Navigations/navigations';
import ImageZoomModal from '../../Components/ImageZoomModal';
import { resolveImageUrl } from '../../utils/imageUtils';

/* ================= BANNER LIST ================= */
const BANNERS = [
  require('../../assets/banners/banner2.png'),
  require('../../assets/banners/banner1.png'),
  require('../../assets/banners/banner3.png'),
  require('../../assets/banners/banner4.png'),
  require('../../assets/banners/banner5.png'),
];

const ProfileScreen = ({ navigation }: any) => {
  const { theme, isDark } = useAppTheme();
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const user = useSelector((state: RootState) => state.userSlice.user);
  const bannerIndex = user?.bannerIndex ?? 0;
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const [triggerFetch] = useLazyGetDriverByIdQuery();

  useFocusEffect(
    useCallback(() => {
      if (user?.driverId) {
        triggerFetch(user.driverId);
      }
    }, [user?.driverId, triggerFetch])
  );

  const [showBannerPicker, setShowBannerPicker] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [showProfileImage, setShowProfileImage] = useState(false);

  // Reset error when the actual photo changes (e.g. new selfie uploaded)
  React.useEffect(() => {
    setImgError(false);
  }, [user?.profile_picture]);

  const name =
    user?.full_name
      ? `${user.full_name}`
      : t('driver_default_name');

  const phone = user?.phone_number || t('not_available');
  const experienceYears = useMemo(() => {
    if (!user?.created_at && !user?.createdAt) { return '0.1'; }
    const start = new Date(user?.created_at || user?.createdAt || '');
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const years = diffDays / 365;
    return years < 0.1 ? '0.1' : years.toFixed(1);
  }, [user?.created_at, user?.createdAt]);

  const { data: allHistoryResult } = useGetRideActivityQuery(
    { driverId: user?.driverId || '', limit: 1000 },
    { skip: !user?.driverId }
  );

  const extractArray = useCallback((result: any) => {
    if (!result) return [];
    if (Array.isArray(result)) return result;
    if (result.data && Array.isArray(result.data)) return result.data;
    if (result.trips && Array.isArray(result.trips)) return result.trips;
    return [];
  }, []);

  const displayRating = useMemo(() => {
    if (allHistoryResult?.data) {
      const rides = extractArray(allHistoryResult.data);
      const newRating = calculateAverageRating(rides);
      if (newRating !== null) return newRating.toFixed(1);
    }
    return user?.rating ? Number(user.rating).toFixed(1) : '0.0';
  }, [allHistoryResult?.data, user?.rating, extractArray]);

  const displayTotalTrips = useMemo(() => {
    if (allHistoryResult?.data) {
      const rides = extractArray(allHistoryResult.data);
      const completedRides = rides.filter((ride: any) => 
        ride.status?.toUpperCase() === 'COMPLETED' || 
        ride.trip_status?.toUpperCase() === 'COMPLETED'
      );
      if (completedRides.length > 0) return completedRides.length;
    }
    return user?.total_trips || 0;
  }, [allHistoryResult?.data, user?.total_trips, extractArray]);


  return (
    <View style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {isFocused && <AppStatusBar />}
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* ================= HEADER ================= */}
        <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: theme.colors.background }]}>
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={isDark ? '#FFFFFF' : '#000'} />
          </Pressable>

          <Text style={[styles.headerTitle, { color: isDark ? '#FFFFFF' : '#111827' }]} numberOfLines={1} adjustsFontSizeToFit>{t('my_profile')}</Text>

          <Pressable
            style={[styles.helpBtn, isDark && { backgroundColor: theme.colors.card, borderColor: '#374151' }]}
            onPress={() => setShowHelpModal(true)}
          >
            <Ionicons name="headset-outline" size={18} color={isDark ? '#FFFFFF' : '#000'} />
            <Text style={[styles.helpText, { color: isDark ? '#FFFFFF' : '#111827' }]} numberOfLines={1} adjustsFontSizeToFit>{t('help')}</Text>
          </Pressable>
        </View>

        {/* ================= BANNER ================= */}
        <Pressable
          style={styles.banner}
          onPress={() => setShowBannerPicker(true)}
        >
          <Image source={BANNERS[bannerIndex]} style={styles.bannerImage} />

          <View style={styles.editIcon}>
            <Ionicons name="camera-outline" size={18} color="#fff" />
          </View>
        </Pressable>

        {/* ================= PROFILE IMAGE ================= */}
        <Pressable
          style={styles.avatarWrapper}
          onPress={() => {
            if (user?.profile_picture && !imgError) {
              setShowProfileImage(true);
            }
          }}
        >
          <View style={[styles.avatarPlaceholder, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
            <Text style={[styles.avatarText, { color: isDark ? '#FFFFFF' : '#111827' }]}>
              {(() => {
                if (!user) return 'UN';
                const first = user.full_name ? user.full_name.charAt(0).toUpperCase() : '';
                const last = user.last_name ? user.last_name.charAt(0).toUpperCase() : '';
                return first || 'UN';
              })()}
            </Text>

            {user?.profile_picture && !imgError && (
              <Image
                source={{
                  uri: resolveImageUrl(user.profile_picture),
                }}
                style={[styles.avatar, { position: 'absolute', top: 0, left: 0 }]}
                fadeDuration={0}
                onError={() => setImgError(true)}
              />
            )}
          </View>
        </Pressable>

        {/* ================= NAME ================= */}
        <Text style={[styles.name, { color: isDark ? '#FFFFFF' : '#111827' }]}>{name}</Text>
        <Text style={[styles.phone, isDark && { color: '#9CA3AF' }]}>{phone}</Text>

        {/* ================= STATS ================= */}
        <View style={styles.statsContainer}>
          <StatCard
            icon="star"
            iconColor="#F59E0B"
            value={displayRating}
            label={t('rating')}
            isDark={isDark}
            theme={theme}
          />
          <StatCard
            icon="car-outline"
            iconColor="#2563EB"
            value={displayTotalTrips}
            label={t('rides_label')}
            isDark={isDark}
            theme={theme}
          />
          <StatCard
            icon="calendar"
            iconColor="#16A34A"
            value={experienceYears}
            label={t('years_label')}
            isDark={isDark}
            theme={theme}
          />
        </View>

        {/* ================= MENU CARD ================= */}
        <ScrollView style={[styles.menuCard, { backgroundColor: theme.colors.card }]} showsVerticalScrollIndicator={false}>
          <MenuItem
            icon="speedometer-outline"
            title={t('performance')}
            onPress={() => navigation.navigate('DriverPerformanceScreen')}
            isDark={isDark}
          />

          <MenuItem
            icon="person-outline"
            title={t('profile_info')}
            onPress={() => navigation.navigate('ProfileDetailsScreen')}
            isDark={isDark}
          />

          <MenuItem
            icon="people-outline"
            title={t('trusted_contacts') || 'Trusted Contacts'}
            onPress={() => navigation.navigate(SosContacts_Nav)}
            isDark={isDark}
          />

          <MenuItem
            icon="pricetag-outline"
            title={t('subscription_plan')}
            onPress={() => navigation.navigate('RechargePlanScreen')}
            isDark={isDark}
          />

          <MenuItem
            icon="wallet-outline"
            title={t('wallet')}
            onPress={() => navigation.navigate('WalletScreen')}
            isDark={isDark}
          />

          <MenuItem
            icon="cash-outline"
            title={t('earnings')}
            onPress={() => navigation.navigate('EarningsScreen')}
            isDark={isDark}
          />

          <MenuItem
            icon="gift-outline"
            title={t('refer_earn') || 'Refer & Earn'}
            onPress={() => navigation.navigate(ReferEarn_Nav)}
            isDark={isDark}
          />

          <MenuItem
            icon="time-outline"
            title={t('ride_activity')}
            onPress={() => navigation.navigate('RideActivityScreen')}
            isDark={isDark}
          />

          <MenuItem
            icon="document-text-outline"
            title={t('documents_menu')}
            onPress={() => navigation.navigate('ProfileDocumentsScreen')}
            isDark={isDark}
          />

          <MenuItem
            icon="settings-outline"
            title={t('settings')}
            onPress={() => navigation.navigate('ProfileSettingsScreen')}
            isDark={isDark}
          />

        </ScrollView>
      </View>

      {/* ================= BANNER PICKER MODAL ================= */}
      {showBannerPicker && (
        <View style={styles.overlay}>
          <View style={[styles.bannerModal, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : '#111827' }]} numberOfLines={1} adjustsFontSizeToFit>{t('choose_banner')}</Text>

            <View style={styles.bannerGrid}>
              {BANNERS.map((img, index) => (
                <Pressable
                  key={index}
                  onPress={() => {
                    dispatch(setBannerIndex(index));
                    setShowBannerPicker(false);
                  }}
                >
                  <Image source={img} style={styles.bannerThumb} />
                </Pressable>
              ))}
            </View>

            <Pressable
              style={styles.closeBtn}
              onPress={() => setShowBannerPicker(false)}
            >
              <Text style={[styles.closeText, isDark && { color: '#60A5FA' }]} numberOfLines={1} adjustsFontSizeToFit>{t('cancel')}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ================= HELP MODAL ================= */}
      <Modal
        visible={showHelpModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHelpModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.helpModalContent, { backgroundColor: theme.colors.card }]}>
            <View style={[styles.modalDragHandle, isDark && { backgroundColor: '#4B5563' }]} />
            <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : '#111827' }]} numberOfLines={1} adjustsFontSizeToFit>{t('help_center_title') || 'Support & Services'}</Text>

            <View style={styles.helpMenu}>
              <HelpItem
                icon="help-circle-outline"
                title={t('help_center')}
                subtitle={t('help_center_subtitle') || 'Find answers to common questions'}
                colors={['#3B82F6', '#2563EB']}
                isDark={isDark}
                onPress={() => {
                  setShowHelpModal(false);
                  navigation.navigate(HelpCenter_Nav);
                }}
              />
              <HelpItem
                icon="chatbubble-ellipses-outline"
                title={t('contact_support')}
                subtitle={t('contact_support_desc') || 'Get in touch with our team 24/7'}
                colors={['#10B981', '#059669']}
                isDark={isDark}
                onPress={() => {
                  setShowHelpModal(false);
                  navigation.navigate(ContactSupport_Nav);
                }}
              />
              <HelpItem
                icon="shield-checkmark-outline"
                title={t('safety_emergency')}
                subtitle={t('safety_features') || 'Emergency contacts & safety tools'}
                colors={['#EF4444', '#DC2626']}
                isDark={isDark}
                onPress={() => {
                  setShowHelpModal(false);
                  navigation.navigate(SosContacts_Nav);
                }}
              />
              <HelpItem
                icon="document-text-outline"
                title={t('about_app')}
                subtitle={t('about_app_desc') || 'Versions, terms & conditions'}
                colors={['#9CA3AF', '#4B5563']}
                isDark={isDark}
                onPress={() => {
                  setShowHelpModal(false);
                  navigation.navigate(AboutApp_Nav);
                }}
              />
            </View>

            <Pressable
              style={[styles.modalCloseBtn, isDark && { backgroundColor: '#374151' }]}
              onPress={() => setShowHelpModal(false)}
            >
              <Text style={[styles.modalCloseBtnText, isDark && { color: '#FFFFFF' }]} numberOfLines={1} adjustsFontSizeToFit>{t('close')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ImageZoomModal
        visible={showProfileImage}
        imageUris={user?.profile_picture ? [resolveImageUrl(user.profile_picture) || ''] : []}
        onClose={() => setShowProfileImage(false)}
      />

    </View>
  );
};

export default ProfileScreen;

/* ================= SUB COMPONENTS ================= */

const MenuItem = ({ icon, title, onPress, isDark }: any) => (
  <Pressable style={styles.menuItem} onPress={onPress}>
    <View style={styles.menuLeft}>
      <Ionicons name={icon} size={20} color={isDark ? '#FFFFFF' : '#000'} />
      <Text style={[styles.menuText, { color: isDark ? '#FFFFFF' : '#111827' }]} numberOfLines={1} adjustsFontSizeToFit>{title}</Text>
    </View>
    <Ionicons name="chevron-forward" size={20} color={isDark ? '#6B7280' : '#9CA3AF'} />
  </Pressable>
);

const HelpItem = ({ icon, title, subtitle, color, colors, onPress, isDark }: any) => (
  <Pressable
    style={({ pressed }) => [
      styles.helpMenuItem,
      pressed && { opacity: 0.7, backgroundColor: isDark ? '#374151' : '#F9FAFB' }
    ]}
    onPress={onPress}
  >
    <LinearGradient
      colors={colors || [color, color]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.helpIconBox}
    >
      <Ionicons name={icon} size={22} color="#FFFFFF" />
    </LinearGradient>
    <View style={styles.helpTextContainer}>
      <Text style={[styles.helpMenuText, isDark && { color: '#F3F4F6' }]} numberOfLines={1} adjustsFontSizeToFit>{title}</Text>
      {subtitle && <Text style={styles.helpMenuSubtitle}>{subtitle}</Text>}
    </View>
    <Ionicons name="chevron-forward" size={18} color={isDark ? '#4B5563' : '#D1D5DB'} />
  </Pressable>
);

const StatCard = ({ icon, iconColor, value, label, isDark, theme }: any) => (
  <View style={[styles.statCard, { backgroundColor: theme.colors.card }]}>
    <View style={[styles.statIcon, { backgroundColor: iconColor + (isDark ? '30' : '20') }]}>
      <Ionicons name={icon} size={18} color={iconColor} />
    </View>

    <View style={styles.statTextWrap}>
      <Text style={[styles.statValue, { color: isDark ? '#FFFFFF' : '#111827' }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={[styles.statLabel, isDark && { color: '#9CA3AF' }]} numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
    </View>
  </View>
);




/* ================= STYLES ================= */

const styles = StyleSheet.create({
  /* ---------- ROOT ---------- */
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  /* ---------- HEADER ---------- */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },

  helpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },

  helpText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },

  /* ---------- BANNER ---------- */
  banner: {
    height: 160,
    backgroundColor: '#E5E7EB',
  },

  bannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  editIcon: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    padding: 8,
    borderRadius: 20,
  },

  /* ---------- AVATAR ---------- */
  avatarWrapper: {
    alignSelf: 'center',
    marginTop: -45,
    backgroundColor: 'transparent',
    padding: 3,
    borderRadius: 60,
  },

  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },

  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
  },

  /* ---------- USER INFO ---------- */
  name: {
    marginTop: 10,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    color: '#111827',
  },

  phone: {
    marginTop: 2,
    fontSize: 14,
    textAlign: 'center',
    color: '#6B7280',
  },

  /* ---------- STATS ---------- */
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 8,
  },

  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 4,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
  },

  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statTextWrap: {
    marginLeft: 8,
  },

  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 18,
  },

  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },

  /* ---------- MENU CARD ---------- */
  menuCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 7,
    elevation: 0,
    overflow: 'hidden',
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  menuText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },

  /* ---------- LOGOUT ---------- */
  logoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
  },

  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
  },

  /* ---------- MODAL OVERLAY ---------- */
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },

  bannerModal: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },

  bannerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  bannerThumb: {
    width: 100,
    height: 60,
    borderRadius: 10,
  },

  closeBtn: {
    marginTop: 16,
    alignItems: 'center',
  },

  closeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563EB',
  },

  /* ---------- HELP MODAL ---------- */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  helpModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  modalDragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  helpMenu: {
    marginTop: 8,
  },
  helpMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  helpIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  helpMenuText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  helpTextContainer: {
    flex: 1,
  },
  helpMenuSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '400',
  },
  modalCloseBtn: {
    marginTop: 24,
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4B5563',
  },
});
