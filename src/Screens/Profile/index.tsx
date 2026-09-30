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
    <View style={[styles.safeArea, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      {isFocused && <AppStatusBar />}
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* ================= BANNER ================= */}
        <Pressable
          style={styles.banner}
          onPress={() => setShowBannerPicker(true)}
        >
          <Image source={BANNERS[bannerIndex]} style={styles.bannerImage} />

          {/* BACK ARROW */}
          <Pressable style={[styles.backBtnOnBanner, { top: 12 }]} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={20} color="#111827" />
          </Pressable>

          <View style={[styles.editIcon, { top: 12, right: 12, bottom: undefined }]}>
            <Ionicons name="pencil" size={14} color="#fff" />
          </View>
        </Pressable>

        {/* ================= PROFILE IMAGE ================= */}
        <View style={styles.avatarContainer}>
          <Pressable
            style={[styles.avatarWrapper, { backgroundColor: isDark ? theme.colors.background : '#FFFFFF' }]}
            onPress={() => {
              if (user?.profile_picture && !imgError) {
                setShowProfileImage(true);
              }
            }}
          >
            <View style={[styles.avatarPlaceholder, { backgroundColor: isDark ? theme.colors.card : '#1E293B' }]}>
              <Text style={[styles.avatarText, { color: '#FFF' }]}>
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
          <Pressable style={[styles.avatarCameraBadge, { borderColor: isDark ? theme.colors.background : '#FFFFFF' }]}>
            <Ionicons name="camera" size={14} color="#FFF" />
          </Pressable>
        </View>

        {/* ================= NAME ================= */}
        <Text style={[styles.name, { color: theme.colors.text }]}>{name}</Text>
        
        {/* ================= PHONE & ID ================= */}
        <View style={styles.phoneEditContainer}>
          <Text style={[styles.phone, { color: isDark ? theme.colors.textMuted : '#6B7280' }]}>{phone}</Text>
          <Text style={styles.phoneEditSeparator}>|</Text>
          <Text style={styles.driverIdText}>
            ID: {user?.t2d_id || 'N/A'}
          </Text>
        </View>

        {/* ================= STATS ================= */}
        <View style={styles.statsContainer}>
          <StatCard
            icon="star"
            iconColor="#F59E0B"
            value={displayRating}
            label={t('driver_rating', 'Driver Rating')}
            isDark={isDark}
            theme={theme}
          />
          <StatCard
            icon="car-outline"
            iconColor="#2563EB"
            value={displayTotalTrips}
            label={t('total_rides', 'Total Rides')}
            isDark={isDark}
            theme={theme}
          />
          <StatCard
            icon="calendar"
            iconColor="#16A34A"
            value={experienceYears}
            label={t('working_period', 'Working Period')}
            isDark={isDark}
            theme={theme}
          />
        </View>

        {/* ================= MENU CARD ================= */}
        <ScrollView style={styles.menuCard} showsVerticalScrollIndicator={false}>
          <MenuItem
            icon="speedometer-outline"
            title={t('performance')}
            subtitle="View your ratings & feedback"
            onPress={() => navigation.navigate('DriverPerformanceScreen')}
            isDark={isDark}
          />

          <MenuItem
            icon="person-outline"
            title={t('profile_info')}
            subtitle="Personal details"
            onPress={() => navigation.navigate('ProfileDetailsScreen')}
            isDark={isDark}
          />

          <MenuItem
            icon="people-outline"
            title={t('trusted_contacts') || 'Trusted Contacts'}
            subtitle="Emergency contacts"
            onPress={() => navigation.navigate(SosContacts_Nav)}
            isDark={isDark}
          />

          <MenuItem
            icon="pricetag-outline"
            title={t('subscription_plan')}
            subtitle="Manage your plan"
            onPress={() => navigation.navigate('RechargePlanScreen')}
            isDark={isDark}
          />

          <MenuItem
            icon="wallet-outline"
            title={t('wallet') || 'My Wallet'}
            subtitle="Balance & Transactions"
            onPress={() => navigation.navigate('WalletScreen')}
            isDark={isDark}
          />

          <MenuItem
            icon="cash-outline"
            title={t('earnings')}
            subtitle="Weekly payouts & history"
            onPress={() => navigation.navigate('EarningsScreen')}
            isDark={isDark}
          />

          <MenuItem
            icon="gift-outline"
            title={t('refer_earn') || 'Refer and Earn'}
            subtitle="Invite friends & earn rewards"
            onPress={() => navigation.navigate(ReferEarn_Nav)}
            isDark={isDark}
          />

          <MenuItem
            icon="time-outline"
            title={t('ride_activity') || 'Activity'}
            subtitle="Rides & History"
            onPress={() => navigation.navigate('RideActivityScreen')}
            isDark={isDark}
          />

          <MenuItem
            icon="document-text-outline"
            title={t('documents_menu')}
            subtitle="Vehicle & personal docs"
            onPress={() => navigation.navigate('ProfileDocumentsScreen')}
            isDark={isDark}
          />

          <MenuItem
            icon="settings-outline"
            title={t('settings')}
            subtitle="App preferences"
            onPress={() => navigation.navigate('ProfileSettingsScreen')}
            isDark={isDark}
          />

          <MenuItem
            icon="headset-outline"
            title={t('help') || 'Help & Support'}
            subtitle="FAQs & Contact Us"
            onPress={() => navigation.navigate(HelpCenter_Nav)}
            isDark={isDark}
          />

        </ScrollView>
      </View>

      {/* ================= BANNER PICKER MODAL ================= */}
      {showBannerPicker && (
        <View style={styles.overlay}>
          <View style={[styles.bannerModal, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{t('choose_banner')}</Text>

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

const MenuItem = ({ icon, title, subtitle, onPress, isDark }: any) => {
  const { theme } = useAppTheme();
  return (
    <Pressable style={[styles.menuItem, { borderBottomColor: isDark ? theme.colors.border : '#F1F5F9' }]} onPress={onPress}>
      <View style={styles.menuLeft}>
        <Ionicons name={icon} size={22} color={theme.colors.text} />
        <View style={styles.menuTextContainer}>
          <Text style={[styles.menuText, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{title}</Text>
          {subtitle && (
            <Text style={[styles.menuSubtitle, { color: isDark ? theme.colors.textMuted : '#6B7280' }]} numberOfLines={1}>{subtitle}</Text>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={isDark ? theme.colors.textMuted : '#9CA3AF'} />
    </Pressable>
  );
};



const StatCard = ({ icon, iconColor, value, label, isDark, theme }: any) => (
  <View style={[styles.statCard, { backgroundColor: isDark ? theme.colors.card : '#F5F8FF' }]}>
    <View style={styles.statTopRow}>
      <View style={[styles.statIcon, { backgroundColor: iconColor + (isDark ? '30' : '20') }]}>
        <Ionicons name={icon} size={14} color={iconColor} />
      </View>
      <Text style={[styles.statValue, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
    <Text style={[styles.statLabel, { color: isDark ? theme.colors.textMuted : '#6B7280' }]} numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
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
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },

  headerTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
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
    height: 120,
    backgroundColor: '#E5E7EB',
  },

  bannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  backBtnOnBanner: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    backgroundColor: '#FFFFFF', // From the user image, it has a white circular background
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  editIcon: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    padding: 8,
    borderRadius: 20,
  },

  avatarContainer: {
    alignSelf: 'center',
    position: 'relative',
    marginTop: -50,
  },

  avatarWrapper: {
    backgroundColor: '#FFFFFF', // To act as border
    padding: 4,
    borderRadius: 60,
  },

  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },

  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 34,
    fontWeight: '700',
    color: '#111827',
  },

  avatarCameraBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#1E293B', // dark color from image
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF', // to give spacing
  },

  /* ---------- USER INFO ---------- */
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  namePlaceholder: {
    flex: 1, // balances the right side button to keep name centered
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    color: '#111827',
  },
  helpBtnContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },

  phoneEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 8,
  },

  phone: {
    fontSize: 14,
    color: '#6B7280',
  },

  phoneEditSeparator: {
    fontSize: 14,
    color: '#D1D5DB', // light gray
    marginHorizontal: 8,
  },

  driverIdText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280', // dark gray, similar to phone
  },

  /* ---------- STATS ---------- */
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 6,
  },

  statCard: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
  },

  statTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },

  statIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },

  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },

  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },

  menuCard: {
    flex: 1,
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 8,
    borderRadius: 7,
    elevation: 0,
    overflow: 'hidden',
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },

  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },

  menuTextContainer: {
    flexDirection: 'column',
  },

  menuText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },

  menuSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
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


});
