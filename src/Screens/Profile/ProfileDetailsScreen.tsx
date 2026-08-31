import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  Dimensions,
  Platform,
  RefreshControl
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import { useAppTheme } from '../../context/ThemeContext';
import { calculateCompletion } from '../../utils/profileUtils';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Circle, G } from 'react-native-svg';
import AppStatusBar from '../../Components/AppStatusBar';
import { ms, vs } from '../../lib/scale';
import { resolveImageUrl } from '../../utils/imageUtils';
import { useGetTodayOverviewQuery, useGetDriverPerformanceQuery } from '../../service/driverApi';
import { SosContacts_Nav, HelpCenter_Nav } from '../../Navigations/navigations';

const { width } = Dimensions.get('window');

const StatCard = ({ icon, iconColor, iconBg, title, value, subtitle, s }: any) => (
  <View style={s.statCard}>
    <View style={[s.statIconBox, { backgroundColor: iconBg }]}>
      <Ionicons name={icon} size={ms(18)} color={iconColor} />
    </View>
    <Text style={s.statTitle}>{title}</Text>
    <Text style={s.statValue}>{value}</Text>
    {subtitle && <Text style={[s.statSubtitle, subtitle.includes('Great') && {color: '#16A34A'}]}>{subtitle}</Text>}
  </View>
);

const InfoRow = ({ icon, iconBg, label, value, verified, isLast, s }: any) => {
  const { t } = useTranslation();
  return (
    <View style={[s.infoRow, !isLast && s.infoRowBorder]}>
      <View style={[s.infoIconBox, { backgroundColor: iconBg }]}>
        {icon}
      </View>
      <View style={s.infoTextContent}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValue}>{value || '-'}</Text>
      </View>
      {verified && (
        <View style={s.verifiedBadgeSmall}>
          <Ionicons name="checkmark-circle-outline" size={ms(14)} color="#16A34A" />
          <Text style={s.verifiedBadgeText}>{t('verified_badge', 'Verified')}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={ms(20)} color="#9CA3AF" />
    </View>
  );
};

const DocCard = ({ icon, iconBg, title, verified, expiry, s }: any) => {
  const { t } = useTranslation();
  return (
    <View style={s.docCard}>
      {verified && (
        <View style={s.docVerifiedTick}>
          <Ionicons name="checkmark-circle" size={ms(16)} color="#16A34A" />
        </View>
      )}
      <View style={[s.docIconBox, { backgroundColor: iconBg }]}>
        {icon}
      </View>
      <Text style={s.docTitle}>{title}</Text>
      <Text style={s.docExpiry}>{t('doc_exp_label', 'Exp: {{expiry}}', { expiry })}</Text>
    </View>
  );
};

const SettingRow = ({ icon, iconBg, title, subtitle, s, isLast, onPress }: any) => (
  <Pressable style={[s.settingRow, !isLast && s.settingRowBorder]} onPress={onPress}>
    <View style={[s.settingIconBox, { backgroundColor: iconBg }]}>
      {icon}
    </View>
    <View style={s.settingTextContent}>
      <Text style={s.settingTitle}>{title}</Text>
      <Text style={s.settingSubtitle}>{subtitle}</Text>
    </View>
    <Ionicons name="chevron-forward" size={ms(20)} color="#9CA3AF" />
  </Pressable>
);

export default function ProfileDetailsScreen() {
  const { t } = useTranslation();
  const { theme, isDark } = useAppTheme();
  const navigation = useNavigation<any>();
  const user = useSelector((state: RootState) => state.userSlice.user);
  
  const { data: todayOverviewResult, refetch: refetchOverview, isFetching: isOverviewFetching } = useGetTodayOverviewQuery(user?.driverId || '', { skip: !user?.driverId });
  const todayOverview = todayOverviewResult?.data;

  const { data: todayPerformanceResult, refetch: refetchPerformance, isFetching: isPerformanceFetching } = useGetDriverPerformanceQuery(
    { driverId: user?.driverId || '', period: 'today' },
    { skip: !user?.driverId }
  );
  const performance = todayPerformanceResult?.data;

  const [imgError, setImgError] = useState(false);
  const isFocused = useIsFocused();
  const [showAllPersonalInfo, setShowAllPersonalInfo] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchOverview(),
      refetchPerformance()
    ]);
    setRefreshing(false);
  }, [refetchOverview, refetchPerformance]);

  const completionPercentage = calculateCompletion(user);

  const handleCompleteNowPress = () => {
    if (!user) return;

    const isDocValid = (docKey: string, altKey: string) => {
      const doc = user.documents?.[docKey] || user.documents?.[altKey];
      return doc && (doc.status === 'verified' || doc.status === 'UPLOADED' || doc.status === 'PENDING' || doc.status === 'pending');
    };

    // Check if selfie/photo is missing -> Redirect to documents screen
    if (!user.profile_picture && !user.profile_pic_url && !isDocValid('Profile_Selfie', 'profile_selfie')) {
      return navigation.navigate('ProfileDocumentsScreen');
    }

    // Check Essential Documents
    if (!isDocValid('Driving_License', 'driving_license') || 
        (!isDocValid('Aadhar_Card', 'aadhaar_card') && !isDocValid('Aadhaar_Card', 'aadhaar_card')) || 
        !isDocValid('Pan_Card', 'pan_card') ||
        !isDocValid('Police_Verification', 'police_verification')) {
      return navigation.navigate('ProfileDocumentsScreen');
    }

    // Check Trusted Contact
    if (!user.trusted_contact) {
      return navigation.navigate(SosContacts_Nav);
    }
  };

  const joinDate = useMemo(() => {
    const dateString = user?.created_at || user?.createdAt;
    if (!dateString) return 'May 2023';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  }, [user]);

  const getDocConfig = (key: string) => {
    const k = key.toLowerCase();
    if (k.includes('license') || k.includes('driving')) return { title: t("doc_driving_license", "Driving License"), icon: <FontAwesome5 name="id-card" size={ms(16)} color="#3B82F6" />, iconBg: "#EFF6FF" };
    if (k.includes('aadhar') || k.includes('aadhaar')) return { title: t("doc_aadhaar_card", "Aadhaar Card"), icon: <MaterialCommunityIcons name="fingerprint" size={ms(18)} color="#8B5CF6" />, iconBg: "#F5F3FF" };
    if (k.includes('rc') || k.includes('registration')) return { title: t("doc_vehicle_rc", "Vehicle RC"), icon: <Ionicons name="car" size={ms(18)} color="#F59E0B" />, iconBg: "#FEF3C7" };
    if (k.includes('insurance')) return { title: t("doc_insurance", "Insurance"), icon: <MaterialCommunityIcons name="shield-car" size={ms(18)} color="#EF4444" />, iconBg: "#FEF2F2" };
    if (k.includes('pan')) return { title: t("doc_pan_card", "PAN Card"), icon: <FontAwesome5 name="id-card" size={ms(16)} color="#10B981" />, iconBg: "#ECFDF5" };
    if (k.includes('police')) return { title: t("doc_police_verification", "Police Verification"), icon: <MaterialCommunityIcons name="police-badge" size={ms(18)} color="#8B5CF6" />, iconBg: "#F5F3FF" };
    if (k.includes('selfie') || k.includes('profile')) return { title: t("doc_profile_selfie", "Profile Selfie"), icon: <Ionicons name="person" size={ms(18)} color="#F59E0B" />, iconBg: "#FEF3C7" };
    
    // Default
    return { 
      title: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), 
      icon: <Ionicons name="document-text" size={ms(18)} color="#6B7280" />, 
      iconBg: "#F3F4F6" 
    };
  };

  const getInitials = () => {
    if (!user) return 'UN';
    const first = user.first_name ? user.first_name.charAt(0).toUpperCase() : '';
    const last = user.last_name ? user.last_name.charAt(0).toUpperCase() : '';
    return `${first}${last}` || 'UN';
  };

  const getFullAddress = (address: any) => {
    if (!address) return null;
    const parts = [
      address.street,
      address.city,
      address.district,
      address.state,
      address.pincode
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  const dynamicStyles = useMemo(() => {
    const bgColor = isDark ? '#121212' : '#FFFFFF';
    const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
    const textPrimary = isDark ? '#F9FAFB' : '#1F2937';
    const textSecondary = isDark ? '#9CA3AF' : '#6B7280';
    const borderColor = isDark ? '#374151' : '#F3F4F6';

    return StyleSheet.create({
      safeArea: {
        flex: 1,
        backgroundColor: bgColor,
      },
      headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: ms(16),
        paddingVertical: vs(12),
        backgroundColor: bgColor,
        justifyContent: 'space-between',
      },
      headerTitleWrapper: {
        alignItems: 'center',
      },
      headerTitle: {
        fontSize: ms(18),
        fontWeight: '700',
        color: textPrimary,
      },
      headerSubtitle: {
        fontSize: ms(12),
        color: textSecondary,
        marginTop: vs(2),
      },
      iconButton: {
        width: ms(40),
        height: ms(40),
        borderRadius: ms(20),
        backgroundColor: 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
      },
      scrollContent: {
        flexGrow: 1,
        paddingBottom: vs(100),
      },
      
      // Blue Card
      blueCardContainer: {
        marginHorizontal: ms(16),
        marginTop: vs(16),
        borderRadius: ms(24),
        overflow: 'hidden',
      },
      blueCardGradient: {
        padding: ms(16),
        paddingBottom: vs(48),
      },
      userInfoTop: {
        flexDirection: 'row',
        alignItems: 'center',
      },
      avatarWrapper: {
        width: ms(72),
        height: ms(72),
        borderRadius: ms(36),
        borderWidth: 3,
        borderColor: '#FFFFFF',
        backgroundColor: '#E5E7EB',
        justifyContent: 'center',
        alignItems: 'center',
      },
      avatarText: {
        fontSize: ms(28),
        fontWeight: '700',
        color: '#6B7280',
      },
      avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: ms(36),
      },
      editAvatarBtn: {
        position: 'absolute',
        bottom: 0,
        right: -ms(4),
        backgroundColor: '#10B981',
        width: ms(24),
        height: ms(24),
        borderRadius: ms(12),
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
      },
      userDetails: {
        flex: 1,
        marginLeft: ms(16),
      },
      userNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
      },
      userName: {
        fontSize: ms(20),
        fontWeight: '700',
        color: '#FFFFFF',
        marginRight: ms(6),
      },
      proBadge: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: ms(8),
        paddingVertical: vs(4),
        borderRadius: ms(12),
        alignSelf: 'flex-start',
        marginTop: vs(6),
      },
      proBadgeText: {
        fontSize: ms(11),
        color: '#FFFFFF',
        fontWeight: '500',
      },
      ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: vs(8),
      },
      ratingText: {
        fontSize: ms(13),
        fontWeight: '600',
        color: '#FFFFFF',
        marginLeft: ms(4),
      },
      reviewsText: {
        fontSize: ms(12),
        color: 'rgba(255,255,255,0.7)',
        marginLeft: ms(4),
      },
      onlineStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: vs(6),
      },
      onlineDot: {
        width: ms(8),
        height: ms(8),
        borderRadius: ms(4),
        backgroundColor: '#10B981',
        marginRight: ms(6),
      },
      onlineText: {
        fontSize: ms(12),
        color: '#FFFFFF',
      },
      ridesBox: {
        backgroundColor: 'rgba(0,0,0,0.2)',
        paddingHorizontal: ms(8),
        paddingVertical: vs(6),
        borderRadius: ms(10),
        alignItems: 'center',
      },
      ridesLabel: {
        fontSize: ms(10),
        color: 'rgba(255,255,255,0.7)',
      },
      ridesValue: {
        fontSize: ms(16),
        fontWeight: '700',
        color: '#FFFFFF',
        marginVertical: vs(2),
      },
      ridesSince: {
        fontSize: ms(9),
        color: 'rgba(255,255,255,0.7)',
      },

      // Floating Stats
      floatingStatsWrapper: {
        marginTop: -vs(32),
        marginHorizontal: ms(16),
        backgroundColor: cardBg,
        borderRadius: ms(20),
        padding: ms(16),
        flexDirection: 'row',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
        zIndex: 10,
      },
      statCard: {
        alignItems: 'center',
        width: (width - ms(70)) / 4,
      },
      statIconBox: {
        width: ms(36),
        height: ms(36),
        borderRadius: ms(10),
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: vs(8),
      },
      statTitle: {
        fontSize: ms(10),
        color: textSecondary,
        fontWeight: '500',
        textAlign: 'center',
      },
      statValue: {
        fontSize: ms(14),
        fontWeight: '700',
        color: textPrimary,
        marginTop: vs(4),
        marginBottom: vs(2),
        textAlign: 'center',
      },
      statSubtitle: {
        fontSize: ms(9),
        color: textSecondary,
        textAlign: 'center',
      },

      // Profile Completion
      completionCard: {
        marginHorizontal: ms(16),
        marginTop: vs(24),
        backgroundColor: 'transparent',
        borderRadius: ms(20),
        padding: ms(16),
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: borderColor,
      },
      completionChart: {
        width: ms(60),
        height: ms(60),
        justifyContent: 'center',
        alignItems: 'center',
      },
      completionPercent: {
        position: 'absolute',
        fontSize: ms(14),
        fontWeight: '700',
        color: textPrimary,
      },
      completionText: {
        flex: 1,
        marginLeft: ms(12),
      },
      completionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: vs(2),
      },
      completionTitle: {
        fontSize: ms(14),
        fontWeight: '700',
        color: textPrimary,
      },
      completionSub: {
        fontSize: ms(11),
        color: textSecondary,
        marginBottom: vs(8),
      },
      progressBarTrack: {
        height: ms(4),
        backgroundColor: '#E5E7EB',
        borderRadius: ms(2),
        overflow: 'hidden',
        width: '100%',
      },
      progressBarFill: {
        height: '100%',
        backgroundColor: '#2563EB',
        borderRadius: ms(2),
      },
      completeRightCol: {
        flexDirection: 'row',
        alignItems: 'center',
      },
      completeBtn: {
        backgroundColor: '#EFF6FF',
        paddingHorizontal: ms(8),
        paddingVertical: vs(4),
        borderRadius: ms(4),
        justifyContent: 'center',
        alignItems: 'center',
      },
      completeBtnText: {
        color: '#2563EB',
        fontSize: ms(9),
        fontWeight: '600',
      },

      // Sections
      sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: vs(28),
        marginHorizontal: ms(16),
        marginBottom: vs(12),
      },
      sectionTitleLeft: {
        flexDirection: 'row',
        alignItems: 'center',
      },
      sectionTitleText: {
        fontSize: ms(15),
        fontWeight: '700',
        color: textPrimary,
        marginLeft: ms(8),
      },
      viewAllText: {
        fontSize: ms(13),
        fontWeight: '600',
        color: '#2563EB',
      },

      // Lists
      flatListContainer: {
        marginHorizontal: ms(16),
      },
      listCard: {
        marginHorizontal: ms(16),
        backgroundColor: cardBg,
        borderRadius: ms(20),
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 2,
      },
      infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: vs(12),
      },
      infoRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: borderColor,
      },
      infoIconBox: {
        width: ms(36),
        height: ms(36),
        borderRadius: ms(10),
        justifyContent: 'center',
        alignItems: 'center',
      },
      infoTextContent: {
        flex: 1,
        marginLeft: ms(12),
      },
      infoLabel: {
        fontSize: ms(12),
        color: textPrimary,
        fontWeight: '600',
      },
      infoValue: {
        fontSize: ms(12),
        color: textSecondary,
        marginTop: vs(2),
      },
      verifiedBadgeSmall: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'transparent',
        paddingHorizontal: ms(8),
        paddingVertical: vs(4),
        borderRadius: ms(12),
        marginRight: ms(8),
      },
      verifiedBadgeText: {
        fontSize: ms(10),
        color: '#16A34A',
        fontWeight: '600',
        marginLeft: ms(4),
      },

      // Documents
      docScroll: {
        paddingHorizontal: ms(16),
      },
      docCard: {
        width: ms(100),
        backgroundColor: 'transparent',
        borderRadius: ms(12),
        paddingHorizontal: ms(10),
        paddingVertical: vs(8),
        alignItems: 'center',
        marginRight: ms(12),
        borderWidth: 1,
        borderColor: borderColor,
      },
      docVerifiedTick: {
        position: 'absolute',
        top: ms(6),
        right: ms(6),
      },
      docIconBox: {
        width: ms(32),
        height: ms(32),
        borderRadius: ms(10),
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: vs(4),
      },
      docTitle: {
        fontSize: ms(10),
        fontWeight: '600',
        color: textPrimary,
        textAlign: 'center',
        marginBottom: vs(2),
      },
      docStatusBox: {
        backgroundColor: '#DCFCE7',
        paddingHorizontal: ms(4),
        paddingVertical: vs(2),
        borderRadius: ms(4),
        marginBottom: vs(2),
      },
      docStatusText: {
        fontSize: ms(9),
        color: '#16A34A',
        fontWeight: '600',
      },
      docExpiry: {
        fontSize: ms(9),
        color: textSecondary,
      },

      // Settings
      settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: vs(16),
        paddingHorizontal: ms(16),
      },
      settingRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: borderColor,
      },
      settingIconBox: {
        width: ms(36),
        height: ms(36),
        borderRadius: ms(10),
        justifyContent: 'center',
        alignItems: 'center',
      },
      settingTextContent: {
        flex: 1,
        marginLeft: ms(12),
      },
      settingTitle: {
        fontSize: ms(13),
        fontWeight: '600',
        color: textPrimary,
      },
      settingSubtitle: {
        fontSize: ms(11),
        color: textSecondary,
        marginTop: vs(2),
      },
    });
  }, [isDark, theme]);

  if (!user) return null;
  const s = dynamicStyles;

  const getStatusText = (value: number) => {
    if (value >= 95) return 'Excellent';
    if (value >= 90) return 'Great';
    return 'Good';
  };

  const acceptanceRateValue = Math.round(performance?.acceptanceRate || 0);

  const stats = {
    earnings: `₹${todayOverview?.totalEarnings || 0}`,
    trips: `${todayOverview?.tripsCompleted || 0}`,
    hours: todayOverview?.onlineFormatted || '0h 0m',
    acceptance: `${acceptanceRateValue}%`,
    acceptanceStatus: getStatusText(acceptanceRateValue),
  };

  const CircleChart = ({ percentage }: { percentage: number }) => {
    const size = ms(50);
    const strokeWidth = 4;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <View style={s.completionChart}>
        <Svg width={size} height={size}>
          <G rotation="-90" origin={`${size/2}, ${size/2}`}>
            <Circle
              stroke="#E5E7EB"
              cx={size/2}
              cy={size/2}
              r={radius}
              strokeWidth={strokeWidth}
              fill="none"
            />
            <Circle
              stroke="#2563EB"
              cx={size/2}
              cy={size/2}
              r={radius}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="none"
            />
          </G>
        </Svg>
        <Text style={s.completionPercent}>{percentage}%</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      {isFocused && <AppStatusBar forceLight={false} />}
      
      {/* HEADER */}
      <View style={s.headerRow}>
        <Pressable style={s.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={ms(20)} color={isDark ? '#FFF' : '#111827'} />
        </Pressable>
        <View style={s.headerTitleWrapper}>
          <Text style={s.headerTitle}>{t('my_profile_title', 'My Profile')}</Text>
          <Text style={s.headerSubtitle}>{t('manage_account_info', 'Manage your account information')}</Text>
        </View>
        <Pressable style={s.iconButton}>
          <Ionicons name="settings-outline" size={ms(20)} color={isDark ? '#FFF' : '#111827'} />
        </Pressable>
      </View>

      <ScrollView 
        contentContainerStyle={s.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2563EB']}
            tintColor={isDark ? '#FFFFFF' : '#2563EB'}
          />
        }
      >
        
        {/* BLUE CARD */}
        <View style={s.blueCardContainer}>
          <LinearGradient
            colors={['#1E3A8A', '#1E40AF', '#2563EB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.blueCardGradient}
          >
            <View style={s.userInfoTop}>
              <View>
                <View style={s.avatarWrapper}>
                  {user?.profile_picture && !imgError ? (
                    <Image
                      source={{ uri: resolveImageUrl(user.profile_picture) }}
                      style={s.avatarImage}
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    <Text style={s.avatarText}>{getInitials()}</Text>
                  )}
                </View>
                <Pressable style={s.editAvatarBtn}>
                  <Ionicons name="pencil" size={ms(14)} color="#FFF" />
                </Pressable>
              </View>

              <View style={s.userDetails}>
                <View style={s.userNameRow}>
                  <Text style={s.userName}>{user.full_name || 'Karthikeyan R'}</Text>
                  <MaterialIcons name="verified" size={ms(16)} color="#3B82F6" />
                </View>
                <View style={s.proBadge}>
                  <Text style={s.proBadgeText}>{t('professional_driver_badge', 'Professional Driver')}</Text>
                </View>
                <View style={s.ratingRow}>
                  <Ionicons name="star" size={ms(14)} color="#F59E0B" />
                  <Text style={s.ratingText}>{user?.rating ? Number(user.rating).toFixed(1) : '0.0'}</Text>
                  <Text style={s.reviewsText}>({user?.total_reviews || 0} {t('reviews_label', 'Reviews')})</Text>
                </View>

              </View>

              <View style={s.ridesBox}>
                <Text style={s.ridesLabel}>{t('total_rides_label', 'Total Rides')}</Text>
                <Text style={s.ridesValue}>{todayOverview?.totalCompletedRides || user.total_trips || 0}</Text>
                <Text style={s.ridesSince}>{t('since_date_label', 'Since {{date}}', { date: joinDate })}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* FLOATING STATS */}
        <View style={s.floatingStatsWrapper}>
          <StatCard icon="wallet-outline" iconColor="#2563EB" iconBg="#EFF6FF" title={t('total_earnings_label', 'Total Earnings')} value={stats.earnings} subtitle={t('this_month_action', 'This Month')} s={s} />
          <StatCard icon="stats-chart" iconColor="#10B981" iconBg="#ECFDF5" title={t('total_trips_label', 'Total Trips')} value={stats.trips} subtitle="This Month" s={s} />
          <StatCard icon="time-outline" iconColor="#8B5CF6" iconBg="#F5F3FF" title={t('online_hours_label', 'Online Hours')} value={stats.hours} subtitle="This Month" s={s} />
          <StatCard icon="star" iconColor="#F59E0B" iconBg="#FEF3C7" title={t('acceptance_rate_title', 'Acceptance Rate')} value={stats.acceptance} subtitle={stats.acceptanceStatus} s={s} />
        </View>

        {/* PROFILE COMPLETION */}
        <View style={s.completionCard}>
          <CircleChart percentage={completionPercentage} />
          <View style={s.completionText}>
            <View style={s.completionHeaderRow}>
              <Text style={s.completionTitle}>{t('profile_completion_title', 'Profile Completion')}</Text>
              <View style={s.completeRightCol}>
                <Pressable style={s.completeBtn} onPress={handleCompleteNowPress}>
                  <Text style={s.completeBtnText}>{t('complete_now_action', 'Complete Now')}</Text>
                </Pressable>
                <Ionicons name="chevron-forward" size={ms(18)} color="#9CA3AF" style={{ marginLeft: ms(6) }} />
              </View>
            </View>
            <Text style={s.completionSub}>{t('unlock_more_rides', 'Unlock more ride requests')}</Text>
            <View style={s.progressBarTrack}>
              <View style={[s.progressBarFill, { width: `${completionPercentage}%` }]} />
            </View>
          </View>
        </View>

        {/* PERSONAL INFORMATION */}
        <View style={s.sectionTitleRow}>
          <View style={s.sectionTitleLeft}>
            <Ionicons name="person" size={ms(18)} color="#3B82F6" />
            <Text style={s.sectionTitleText}>{t('personal_info_title', 'Personal Information')}</Text>
          </View>
          <Pressable onPress={() => setShowAllPersonalInfo(!showAllPersonalInfo)}>
            <Text style={s.viewAllText}>{showAllPersonalInfo ? t('view_less_action', 'View Less') : t('view_all_action', 'View All')}</Text>
          </Pressable>
        </View>
        <View style={s.flatListContainer}>
          <InfoRow 
            icon={<Ionicons name="person" size={ms(18)} color="#3B82F6" />} iconBg="#EFF6FF"
            label={t('full_name_label', 'Full Name')} value={user.full_name || 'Karthikeyan R'} s={s} 
          />
          <InfoRow 
            icon={<Ionicons name="call" size={ms(18)} color="#10B981" />} iconBg="#ECFDF5"
            label={t('mobile_number_label', 'Mobile Number')} value={user.phone_number || '+91 98765 43210'} verified s={s} isLast={!showAllPersonalInfo}
          />
          {showAllPersonalInfo && (
            <>
              <InfoRow 
                icon={<Ionicons name="call-outline" size={ms(18)} color="#10B981" />} iconBg="#ECFDF5"
                label={t('alternate_number_label', 'Alternate Number')} value={user.alternate_contact || '-'} s={s} 
              />
              <InfoRow 
                icon={<Ionicons name="mail" size={ms(18)} color="#8B5CF6" />} iconBg="#F5F3FF"
                label={t('email_address_label', 'Email Address')} value={user.email || 'karthikeyan.r@email.com'} verified s={s} 
              />
              <InfoRow 
                icon={<Ionicons name="calendar" size={ms(18)} color="#F59E0B" />} iconBg="#FEF3C7"
                label={t('date_of_birth_label', 'Date of Birth')} value={user.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '15 Mar 1995'} s={s} 
              />
              <InfoRow 
                icon={<Ionicons name="location" size={ms(18)} color="#EF4444" />} iconBg="#FEF2F2"
                label={t('address_label', 'Address')} value={getFullAddress(user?.address) || '12, Anna Nagar, Chennai, Tamil Nadu - 600040'} isLast s={s} 
              />
            </>
          )}
        </View>

        {/* DOCUMENTS */}
        <View style={s.sectionTitleRow}>
          <View style={s.sectionTitleLeft}>
            <Ionicons name="document-text" size={ms(18)} color="#3B82F6" />
            <Text style={s.sectionTitleText}>{t('documents_title', 'Documents')}</Text>
          </View>
          <Pressable 
            style={{ flexDirection: 'row', alignItems: 'center' }}
            onPress={() => navigation.navigate('ProfileDocumentsScreen')}
          >
            <Text style={[s.viewAllText, { marginRight: 4 }]}>{t('manage_action', 'Manage')}</Text>
            <Ionicons name="create-outline" size={ms(14)} color="#2563EB" />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.docScroll}>
          {(() => {
            const documentKeys = Object.keys(user?.documents || {});
            const requiredDocs = [
              { key: 'Driving_License', match: (k: string) => k.toLowerCase().includes('driving') || k.toLowerCase().includes('license') },
              { key: 'Aadhaar_Card', match: (k: string) => k.toLowerCase().includes('aadhar') || k.toLowerCase().includes('aadhaar') },
              { key: 'Pan_Card', match: (k: string) => k.toLowerCase().includes('pan') },
              { key: 'Police_Verification', match: (k: string) => k.toLowerCase().includes('police') }
            ];

            const docsToShow = [...documentKeys];
            
            // Add missing required docs
            requiredDocs.forEach(req => {
              const alreadyExists = documentKeys.some(k => req.match(k));
              if (!alreadyExists) {
                docsToShow.push(req.key);
              }
            });

            return docsToShow.map((docKey) => {
              const docState = user?.documents?.[docKey];
              const isVerified = docState?.status === 'verified' || docState?.status === 'UPLOADED' || docState?.status === 'PENDING' || docState?.status === 'pending';
              const config = getDocConfig(docKey);
              return (
                <DocCard 
                  key={docKey}
                  icon={config.icon} iconBg={config.iconBg}
                  title={config.title} verified={isVerified} expiry="-" s={s}
                />
              );
            });
          })()}
        </ScrollView>

        {/* BOTTOM SETTINGS LIST */}
        <View style={[s.listCard, { marginTop: vs(24), backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF' }]}>
          <SettingRow 
            icon={<Ionicons name="call" size={ms(18)} color="#EF4444" />} iconBg="#FEF2F2"
            title={t('emergency_contact_title', 'Emergency Contact')} subtitle={t('emergency_contact_subtitle', 'Add or update emergency contact')} s={s}
            onPress={() => navigation.navigate(SosContacts_Nav)}
          />
          <SettingRow 
            icon={<Ionicons name="settings" size={ms(18)} color="#10B981" />} iconBg="#ECFDF5"
            title={t('app_settings_title', 'App Settings')} subtitle={t('app_settings_subtitle', 'Notifications, language and more')} s={s}
            onPress={() => navigation.navigate('ProfileSettingsScreen')}
          />
          <SettingRow 
            icon={<Ionicons name="headset" size={ms(18)} color="#F59E0B" />} iconBg="#FEF3C7"
            title={t('help_support_title', 'Help & Support')} subtitle={t('help_support_subtitle', 'Get help and support')} s={s} isLast
            onPress={() => navigation.navigate(HelpCenter_Nav)}
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
