import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Linking, Image } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { hS as s, vS as vs, mS as ms } from '../../lib/scale';
import { useAppTheme } from '../../context/ThemeContext';
import AppStatusBar from '../../Components/AppStatusBar';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';

const ScheduledRideDetailsScreen = () => {
  const { theme, isDark } = useAppTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { ride } = route.params || {};
  const { t } = useTranslation();
  const user = useSelector((state: RootState) => state.userSlice.user);

  if (!ride) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <AppStatusBar />
        <View style={styles.errorContainer}>
          <Text style={{ color: theme.colors.text }}>Ride details not found.</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtnError}>
            <Text style={{ color: '#FFF' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const formatTime = (time: string | number | Date) => new Date(time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });
  const formatDateStr = (time: string | number | Date) => {
    const d = new Date(time);
    return `${d.getDate()} ${d.toLocaleDateString(undefined, { month: 'short' })} ${d.getFullYear()}`;
  };
  const isToday = new Date(ride.startTime).toDateString() === new Date().toDateString();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? theme.colors.background : '#F8FAFC' }]}>
      <AppStatusBar />

      {/* HEADER */}
      <View style={[styles.header, { backgroundColor: isDark ? theme.colors.card : '#FFF', borderBottomColor: isDark ? theme.colors.border : '#E2E8F0' }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIconBtn}>
          <Ionicons name="arrow-back" size={ms(24)} color={theme.colors.text} />
        </TouchableOpacity>
        
        <View style={styles.headerLogoContainer}>
          <Image source={require('../../assets/images/applogo.png')} style={styles.logoImage} resizeMode="contain" />
        </View>

        <View style={styles.headerRightGroup}>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Ionicons name="notifications-outline" size={ms(22)} color={theme.colors.text} />
            <View style={styles.badgeDot} />
          </TouchableOpacity>
          <Image source={user?.profile_picture ? { uri: user.profile_picture } : require('../../assets/images/appuse1.png')} style={styles.avatarImage} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* TITLE ROW */}
        <View style={styles.titleRow}>
          <Text style={[styles.pageTitle, { color: theme.colors.text }]}>Scheduled Ride Details</Text>
          <View style={[styles.upcomingBadge, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#E0E7FF' }]}>
            <Text style={[styles.upcomingBadgeText, { color: isDark ? '#93C5FD' : '#4338CA' }]}>Upcoming</Text>
          </View>
        </View>

        {/* TIME & TRIP ID CARD */}
        <View style={[styles.card, { backgroundColor: isDark ? theme.colors.card : '#FFF' }]}>
          <View style={styles.timeTripRow}>
            <View style={styles.timeTripCol}>
              <Ionicons name="calendar-outline" size={ms(20)} color="#2563EB" />
              <View style={styles.timeTripTextGroup}>
                {isToday && <Text style={[styles.smallLabel, { color: theme.colors.textMuted }]}>Today</Text>}
                <Text style={[styles.strongText, { color: theme.colors.text }]}>{formatDateStr(ride.startTime || Date.now())}</Text>
              </View>
            </View>
            <View style={[styles.verticalDivider, { backgroundColor: isDark ? theme.colors.border : '#F1F5F9' }]} />
            
            <View style={styles.timeTripCol}>
              <Ionicons name="time-outline" size={ms(20)} color="#2563EB" />
              <View style={styles.timeTripTextGroup}>
                <Text style={[styles.smallLabel, { color: theme.colors.textMuted }]}>Pickup Time</Text>
                <Text style={[styles.strongText, { color: theme.colors.text }]}>{(formatTime(ride.startTime || Date.now()).replace(/[\s\u202F]+/, ' ').toUpperCase())}</Text>
              </View>
            </View>

            <View style={[styles.tripIdBox, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF' }]}>
              <Text style={[styles.smallLabel, { color: theme.colors.textMuted }]}>Trip ID</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.tripIdText, { color: theme.colors.text }]}>{ride.trip_id || 'SCH12345678'}</Text>
                <TouchableOpacity style={{ marginLeft: s(4) }}>
                  <Ionicons name="copy-outline" size={ms(12)} color="#2563EB" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* LOCATIONS CARD */}
        <View style={[styles.card, { backgroundColor: isDark ? theme.colors.card : '#FFF' }]}>
          <View style={styles.locationRow}>
            <View style={styles.dotLineCol}>
              <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
              <View style={styles.dottedLine} />
            </View>
            <View style={styles.locationContent}>
              <Text style={[styles.locationTitle, { color: theme.colors.text }]} numberOfLines={2}>{ride.pickup_address}</Text>
              <Text style={[styles.locationSub, { color: theme.colors.textMuted }]} numberOfLines={1}>Pickup Location</Text>
            </View>
            <View style={[styles.locBadge, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#D1FAE5' }]}>
              <Text style={[styles.locBadgeText, { color: '#059669' }]}>Pickup</Text>
            </View>
            <Ionicons name="chevron-forward" size={ms(16)} color={theme.colors.textMuted} style={{ marginLeft: s(8) }} />
          </View>

          <View style={[styles.horizontalDividerDashed, { borderColor: isDark ? theme.colors.border : '#F1F5F9' }]} />

          <View style={styles.locationRow}>
            <View style={styles.dotLineCol}>
              <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
            </View>
            <View style={styles.locationContent}>
              <Text style={[styles.locationTitle, { color: theme.colors.text }]} numberOfLines={2}>{ride.drop_address}</Text>
              <Text style={[styles.locationSub, { color: theme.colors.textMuted }]} numberOfLines={1}>Drop-off Location</Text>
            </View>
            <View style={[styles.locBadge, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEE2E2' }]}>
              <Text style={[styles.locBadgeText, { color: '#DC2626' }]}>Drop-off</Text>
            </View>
            <Ionicons name="chevron-forward" size={ms(16)} color={theme.colors.textMuted} style={{ marginLeft: s(8) }} />
          </View>
        </View>

        {/* METRICS CARD */}
        <View style={[styles.card, { backgroundColor: isDark ? theme.colors.card : '#FFF' }]}>
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Ionicons name="people-outline" size={ms(20)} color="#2563EB" />
              <Text style={[styles.metricVal, { color: theme.colors.text }]}>1</Text>
              <Text style={[styles.metricLbl, { color: theme.colors.textMuted }]}>Passenger</Text>
            </View>
            <View style={[styles.verticalDivider, { backgroundColor: isDark ? theme.colors.border : '#F1F5F9' }]} />
            
            <View style={styles.metricItem}>
              <Ionicons name="briefcase-outline" size={ms(20)} color="#2563EB" />
              <Text style={[styles.metricVal, { color: theme.colors.text }]}>1</Text>
              <Text style={[styles.metricLbl, { color: theme.colors.textMuted }]}>Luggage</Text>
            </View>
            <View style={[styles.verticalDivider, { backgroundColor: isDark ? theme.colors.border : '#F1F5F9' }]} />
            
            <View style={styles.metricItem}>
              <Ionicons name="map-outline" size={ms(20)} color="#2563EB" />
              <Text style={[styles.metricVal, { color: theme.colors.text }]}>{ride.distance_km || '32'} km</Text>
              <Text style={[styles.metricLbl, { color: theme.colors.textMuted }]}>Est. Distance</Text>
            </View>
            <View style={[styles.verticalDivider, { backgroundColor: isDark ? theme.colors.border : '#F1F5F9' }]} />

            <View style={styles.metricItem}>
              <Ionicons name="time-outline" size={ms(20)} color="#2563EB" />
              <Text style={[styles.metricVal, { color: theme.colors.text }]}>60 mins</Text>
              <Text style={[styles.metricLbl, { color: theme.colors.textMuted }]}>Est. Duration</Text>
            </View>
          </View>
        </View>

        {/* TRIP DETAILS CARD */}
        <View style={[styles.card, { backgroundColor: isDark ? theme.colors.card : '#FFF' }]}>
          <View style={styles.tripTypeHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="sync-outline" size={ms(16)} color="#2563EB" />
              <Text style={[styles.tripTypeTitle, { color: theme.colors.text }]}>Trip Type</Text>
            </View>
            <View style={[styles.tripTypeBadge, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF' }]}>
              <Ionicons name="arrow-forward-circle-outline" size={ms(12)} color="#2563EB" />
              <Text style={[styles.tripTypeBadgeText, { color: '#2563EB' }]}>One-way</Text>
            </View>
          </View>
          
          <View style={styles.detailRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="car-outline" size={ms(16)} color="#3B82F6" style={{ marginRight: s(8) }} />
              <Text style={[styles.detailLbl, { color: theme.colors.textMuted }]}>Ride Type</Text>
            </View>
            <Text style={[styles.detailVal, { color: theme.colors.text }]}>One-way</Text>
          </View>

          <View style={styles.detailRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="card-outline" size={ms(16)} color="#3B82F6" style={{ marginRight: s(8) }} />
              <Text style={[styles.detailLbl, { color: theme.colors.textMuted }]}>Payment Type</Text>
            </View>
            <Text style={[styles.detailVal, { color: theme.colors.text }]}>Online</Text>
          </View>

          <View style={styles.detailRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="wallet-outline" size={ms(16)} color="#3B82F6" style={{ marginRight: s(8) }} />
              <Text style={[styles.detailLbl, { color: theme.colors.textMuted }]}>Customer Payment</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.detailVal, { color: theme.colors.text }]}>₹{ride.total_fare || '1,250'}</Text>
              <Ionicons name="information-circle-outline" size={ms(14)} color={theme.colors.textMuted} style={{ marginLeft: s(4) }} />
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="cash-outline" size={ms(16)} color="#2563EB" style={{ marginRight: s(8) }} />
              <Text style={[styles.detailLbl, { color: theme.colors.text }]}>Your Earnings</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.detailVal, { color: '#10B981' }]}>₹520</Text>
              <Ionicons name="information-circle-outline" size={ms(14)} color={theme.colors.textMuted} style={{ marginLeft: s(4) }} />
            </View>
          </View>
        </View>

        {/* CUSTOMER DETAILS CARD */}
        <View style={[styles.card, { backgroundColor: isDark ? theme.colors.card : '#FFF' }]}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="person-outline" size={ms(16)} color="#3B82F6" style={{ marginRight: s(8) }} />
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Customer Details</Text>
          </View>
          
          <View style={styles.customerContentRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.custDetailRow}>
                <Text style={[styles.custLbl, { color: theme.colors.textMuted }]}>Name</Text>
                <Text style={[styles.custVal, { color: theme.colors.text }]}>Ramesh Kumar</Text>
              </View>
              <View style={styles.custDetailRow}>
                <Text style={[styles.custLbl, { color: theme.colors.textMuted }]}>Mobile Number</Text>
                <Text style={[styles.custVal, { color: theme.colors.text }]}>+91 98765 43210</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.callBtn}>
              <Ionicons name="call-outline" size={ms(18)} color="#2563EB" />
            </TouchableOpacity>
          </View>
        </View>

        {/* NOTES CARD */}
        <View style={[styles.card, { backgroundColor: isDark ? theme.colors.card : '#FFF' }]}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="document-text-outline" size={ms(16)} color="#3B82F6" style={{ marginRight: s(8) }} />
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Notes from Customer</Text>
          </View>
          <Text style={[styles.notesText, { color: theme.colors.text }]}>
            Please call me once you reach the pickup location.
          </Text>
        </View>

        {/* INFO BANNER */}
        <View style={[styles.infoBanner, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF' }]}>
          <Ionicons name="information-circle" size={ms(24)} color="#2563EB" style={{ marginRight: s(12), alignSelf: 'flex-start' }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoBannerText, { color: theme.colors.text }]}>
              Please reach the pickup location 10 minutes before the scheduled time. Scheduled rides will appear 15 minutes before pickup time.
            </Text>
          </View>
          <Ionicons name="calendar" size={ms(32)} color="#93C5FD" style={{ marginLeft: s(12), alignSelf: 'flex-end', opacity: 0.5 }} />
        </View>

        <View style={{ height: vs(100) }} />
      </ScrollView>

      {/* STICKY FOOTER */}
      <View style={[styles.footer, { backgroundColor: isDark ? theme.colors.card : '#F8FAFC' }]}>
        <TouchableOpacity style={styles.acceptBtn}>
          <Text style={styles.acceptBtnText}>Accept Ride</Text>
          <Ionicons name="arrow-forward" size={ms(20)} color="#FFF" style={{ position: 'absolute', right: ms(20) }} />
        </TouchableOpacity>
        <Text style={[styles.footerSub, { color: theme.colors.textMuted }]}>
          You can accept this ride until 07:50 AM
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnError: {
    marginTop: vs(20),
    backgroundColor: '#2563EB',
    paddingHorizontal: ms(20),
    paddingVertical: vs(10),
    borderRadius: ms(8),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ms(16),
    paddingVertical: vs(12),
    borderBottomWidth: 1,
  },
  headerIconBtn: {
    padding: ms(4),
  },
  headerLogoContainer: {
    flex: 1,
    alignItems: 'center',
  },
  logoImage: {
    width: ms(100),
    height: vs(24),
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeDot: {
    width: ms(8),
    height: ms(8),
    borderRadius: ms(4),
    backgroundColor: '#EF4444',
    position: 'absolute',
    top: ms(4),
    right: ms(4),
    borderWidth: 1,
    borderColor: '#FFF',
  },
  avatarImage: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(16),
    marginLeft: ms(12),
  },
  scrollContent: {
    padding: ms(16),
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(16),
  },
  pageTitle: {
    fontSize: ms(18),
    fontWeight: '700',
  },
  upcomingBadge: {
    paddingHorizontal: ms(12),
    paddingVertical: vs(4),
    borderRadius: ms(12),
  },
  upcomingBadgeText: {
    fontSize: ms(12),
    fontWeight: '600',
  },
  card: {
    borderRadius: ms(12),
    padding: ms(16),
    marginBottom: vs(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  timeTripRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeTripCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  timeTripTextGroup: {
    marginLeft: s(8),
  },
  smallLabel: {
    fontSize: ms(11),
    fontWeight: '500',
    marginBottom: vs(2),
  },
  strongText: {
    fontSize: ms(13),
    fontWeight: '700',
  },
  verticalDivider: {
    width: 1,
    height: '100%',
    marginHorizontal: ms(12),
  },
  tripIdBox: {
    paddingHorizontal: ms(12),
    paddingVertical: vs(8),
    borderRadius: ms(8),
    alignItems: 'flex-start',
  },
  tripIdText: {
    fontSize: ms(12),
    fontWeight: '700',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dotLineCol: {
    width: ms(16),
    alignItems: 'center',
    marginRight: ms(12),
  },
  dot: {
    width: ms(10),
    height: ms(10),
    borderRadius: ms(5),
  },
  dottedLine: {
    width: 1,
    height: vs(30),
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    marginVertical: vs(4),
  },
  locationContent: {
    flex: 1,
  },
  locationTitle: {
    fontSize: ms(13),
    fontWeight: '600',
    marginBottom: vs(2),
  },
  locationSub: {
    fontSize: ms(11),
  },
  locBadge: {
    paddingHorizontal: ms(8),
    paddingVertical: vs(4),
    borderRadius: ms(6),
  },
  locBadgeText: {
    fontSize: ms(10),
    fontWeight: '600',
  },
  horizontalDividerDashed: {
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    marginVertical: vs(12),
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricVal: {
    fontSize: ms(14),
    fontWeight: '700',
    marginTop: vs(6),
    marginBottom: vs(2),
  },
  metricLbl: {
    fontSize: ms(10),
    fontWeight: '500',
  },
  tripTypeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(16),
  },
  tripTypeTitle: {
    fontSize: ms(14),
    fontWeight: '700',
    marginLeft: s(8),
  },
  tripTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ms(10),
    paddingVertical: vs(4),
    borderRadius: ms(12),
  },
  tripTypeBadgeText: {
    fontSize: ms(12),
    fontWeight: '600',
    marginLeft: s(4),
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(12),
  },
  detailLbl: {
    fontSize: ms(13),
    fontWeight: '500',
  },
  detailVal: {
    fontSize: ms(13),
    fontWeight: '700',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: vs(12),
  },
  cardTitle: {
    fontSize: ms(14),
    fontWeight: '700',
  },
  customerContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  custDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: vs(8),
    paddingRight: ms(16),
  },
  custLbl: {
    fontSize: ms(13),
    flex: 1,
  },
  custVal: {
    fontSize: ms(13),
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  callBtn: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notesText: {
    fontSize: ms(13),
    lineHeight: vs(18),
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: ms(16),
    borderRadius: ms(12),
    marginBottom: vs(24),
  },
  infoBannerText: {
    fontSize: ms(12),
    lineHeight: vs(18),
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: ms(16),
    paddingTop: vs(16),
    paddingBottom: vs(32),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  acceptBtn: {
    backgroundColor: '#0D47A1',
    borderRadius: ms(8),
    paddingVertical: vs(14),
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: vs(8),
  },
  acceptBtnText: {
    color: '#FFF',
    fontSize: ms(16),
    fontWeight: '700',
  },
  footerSub: {
    textAlign: 'center',
    fontSize: ms(11),
  },
});

export default ScheduledRideDetailsScreen;
