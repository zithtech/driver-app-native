import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Modal,
  Animated,
  Dimensions,
  InteractionManager,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { RootState } from '../../redux/store';
import {
  useGetRideActivityQuery,
  useGetEarningsSummaryQuery,
  useGetDriverPerformanceQuery
} from '../../service/driverApi';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import colors from '../../constant/colors';
import { formatCurrency } from '../../lib/currency';
import { useAppTheme } from '../../context/ThemeContext';
import AppStatusBar from '../../Components/AppStatusBar';
import { calculateAverageRating } from '../../utils/ratingUtils';

const { width } = Dimensions.get('window');



export interface RideItem {
  id: string;
  date: string;
  time: string;
  pickup: string;
  drop: string;
  amount: number;
  distance: string;
  duration: string;
  status: string;
  trip_code?: string;
  paymentMethod?: string;
  settlementInfo?: string;
  timeline?: {
    requestedAt?: string;
    arrivedAt?: string;
    startedAt?: string;
    completedAt?: string;
    cancelledAt?: string;
  };
  customer?: {
    name: string;
    rating?: number;
    feedback?: string;
  };
}

/* ================= SCREEN ================= */

const RideActivityScreen = ({ navigation, route }: any) => {
  const { theme, isDark } = useAppTheme();
  const isFocused = useIsFocused();
  const { t } = useTranslation();
  const user = useSelector((state: RootState) => state.userSlice.user);
  const driverId = user?.driverId || '';

  const [statusFilter, setStatusFilter] =
    useState<'all' | 'Completed' | 'Cancelled'>('all');

  const [showDateFilter, setShowDateFilter] = useState(false);

  // Default range: Last 30 days
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  });
  const [toDate, setToDate] = useState(new Date());

  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const insets = useSafeAreaInsets();

  const {
    data: activityResult,
    isLoading: isFirstLoading,
    refetch,
  } = useGetRideActivityQuery(
    {
      driverId,
      from: fromDate.toISOString().split('T')[0],
      to: toDate.toISOString().split('T')[0],
      status: statusFilter === 'all' ? undefined : statusFilter,
    },
    { skip: !driverId }
  );

  const { data: earningsSummary, refetch: refetchSummary } = useGetEarningsSummaryQuery(
    { 
      driverId,
      from: fromDate.toISOString().split('T')[0],
      to: toDate.toISOString().split('T')[0],
    }, 
    { skip: !driverId }
  );
  const { data: performanceMetrics, refetch: refetchPerformance } = useGetDriverPerformanceQuery({ driverId }, { skip: !driverId });

  // Sync data on focus
  const [isManualRefresh, setIsManualRefresh] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsManualRefresh(true);
    await Promise.all([refetch(), refetchSummary(), refetchPerformance()]);
    setIsManualRefresh(false);
  }, [refetch, refetchSummary, refetchPerformance]);

  // Sync data on focus removed to prevent layout glitches on back navigation

  // Map backend trip object to RideItem format
  const extractTripObject = (result: any) => {
    if (!result) return null;
    if (result.trip_id || result.pickup_address || result.pickup) return result;
    if (result.data && (result.data.trip_id || result.data.pickup_address || result.data.pickup)) return result.data;
    if (result.trip && (result.trip.trip_id || result.trip.pickup_address || result.trip.pickup)) return result.trip;
    // fallback catch-all
    return result.data || result;
  };

  const mapTripToRideItem = (rawTripData: any): RideItem => {
    const tripData = extractTripObject(rawTripData) || rawTripData;

    // If the endpoint is already sending the expected summary format, grab it
    const rawAmount = tripData.amount !== undefined ? tripData.amount : tripData.total_fare;
    const amount = typeof rawAmount === 'string' ? parseFloat(rawAmount || '0') : (rawAmount || 0);

    // Dates & Times
    let dateObj = new Date();
    if (tripData.created_at) {
      dateObj = new Date(tripData.created_at);
    } else if (tripData.date && tripData.date.includes('-')) {
      // if date is "YYYY-MM-DD", try to parse
      dateObj = new Date(tripData.date);
    }

    const timeline: any = {};
    if (tripData.trip_changes && Array.isArray(tripData.trip_changes)) {
      tripData.trip_changes.forEach((change: any) => {
        const time = new Date(change.changed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (change.new_value?.trip_status === 'REQUESTED') timeline.requestedAt = time;
        if (change.new_value?.trip_status === 'ARRIVED') timeline.arrivedAt = time;
        if (change.new_value?.trip_status === 'LIVE' || change.new_value?.trip_status === 'STARTED') timeline.startedAt = time;
        if (change.new_value?.trip_status === 'COMPLETED') timeline.completedAt = time;
        if (change.new_value?.trip_status === 'CANCELLED') timeline.cancelledAt = time;
      });
    }

    if (Object.keys(timeline).length === 0) {
      if (tripData.created_at) timeline.requestedAt = new Date(tripData.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (tripData.trip_status === 'COMPLETED' && tripData.updated_at) timeline.completedAt = new Date(tripData.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (tripData.trip_status === 'CANCELLED' && tripData.updated_at) timeline.cancelledAt = new Date(tripData.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Determine Status
    let finalStatus = tripData.status || '';
    if (tripData.trip_status) {
      finalStatus = tripData.trip_status === 'COMPLETED' ? 'Completed' : tripData.trip_status === 'CANCELLED' ? 'Cancelled' : tripData.trip_status;
    } else if (tripData.status) {
      finalStatus = tripData.status === 'COMPLETED' ? 'Completed' : tripData.status === 'CANCELLED' ? 'Cancelled' : tripData.status;
    }

    return {
      id: tripData.id?.toString() || tripData.trip_id?.toString() || Math.random().toString(),
      date: tripData.date || dateObj.toLocaleDateString(),
      time: tripData.time || dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      pickup: tripData.pickup_address || tripData.pickup || 'Unknown Pickup',
      drop: tripData.drop_address || tripData.drop || 'Unknown Drop',
      amount: amount,
      distance: tripData.distance_km ? `${tripData.distance_km} ${t('km')}` : (tripData.distance || `0 ${t('km')}`),
      duration: tripData.duration || (tripData.trip_duration_minutes ? `${tripData.trip_duration_minutes} ${t('m')}` : ''),
      status: finalStatus,
      trip_code: tripData.trip_code || tripData.booking_code || '',
      paymentMethod: tripData.payment_status === 'PAID' ? 'Wallet' : (tripData.payment_method || tripData.paymentMethod || 'Cash'),
      timeline: Object.keys(timeline).length > 0 ? timeline : (tripData.timeline || {}),
      customer: {
        name: tripData.customer?.name || tripData.passenger_name || 'Customer',
        rating: tripData.rating || tripData.user_rating || tripData.trip_rating,
        feedback: tripData.feedback || tripData.comment || tripData.user_feedback || '',
      },
      ...tripData
    };
  };

  const extractArray = (result: any) => {
    if (!result) return [];
    if (Array.isArray(result)) return result;
    if (result.data && Array.isArray(result.data)) return result.data;
    if (result.trips && Array.isArray(result.trips)) return result.trips;
    if (result.activity && Array.isArray(result.activity)) return result.activity;
    if (result.history && Array.isArray(result.history)) return result.history;
    return [];
  };

  const rawRides = extractArray(activityResult?.data);
  const rides = rawRides.map(mapTripToRideItem);
  const isLoading = isFirstLoading;

  const avgRating = React.useMemo(() => {
    const periodRating = calculateAverageRating(rawRides);
    if (periodRating !== null) return periodRating.toFixed(1);
    if (user?.rating) return Number(user.rating).toFixed(1);
    return '0.0';
  }, [rawRides, user?.rating]);

  /* ================= QUICK FILTERS ================= */

  const applyToday = () => {
    const today = new Date();
    setFromDate(today);
    setToDate(today);
  };

  const applyYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setFromDate(yesterday);
    setToDate(yesterday);
  };

  const applyLast7Days = () => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    setFromDate(start);
    setToDate(end);
  };

  /* ================= FILTER LOGIC ================= */

  const filteredRides = rides; // Backend handles filtering now

  return (
    <View style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {isFocused && <AppStatusBar />}
      {/* ================= HEADER ================= */}
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: theme.colors.background }]}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{t('ride_activity')}</Text>

        <Pressable onPress={() => setShowDateFilter(true)}>
          <Ionicons name="calendar-outline" size={22} color={theme.colors.text} />
        </Pressable>
      </View>

      {/* ================= STATUS FILTER ================= */}
      <View style={[styles.tabs, isDark && { backgroundColor: theme.colors.border }]}>
        {['all', 'Completed', 'Cancelled'].map((item) => {
          let iconName = 'layers-outline';
          if (item === 'Completed') iconName = 'checkmark-done-circle-outline';
          if (item === 'Cancelled') iconName = 'close-circle-outline';

          return (
            <Pressable
              key={item}
              onPress={() => setStatusFilter(item as any)}
              style={[
                styles.tab,
                statusFilter === item && styles.activeTab,
              ]}
            >
              <Ionicons
                name={iconName}
                size={16}
                color={statusFilter === item ? '#FFFFFF' : (isDark ? theme.colors.textMuted : '#64748B')}
              />
              <Text
                style={[
                  styles.tabText,
                  isDark && statusFilter !== item && { color: theme.colors.textMuted },
                  statusFilter === item && styles.activeTabText,
                ]}
                numberOfLines={1} adjustsFontSizeToFit
              >
                {t(item.toLowerCase())}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ================= STATS SUMMARY ================= */}
      <Text style={{
        fontSize: 15,
        fontWeight: '700',
        color: theme.colors.text,
        marginLeft: 18,
        marginBottom: 10,
        marginTop: 8,
        letterSpacing: 0.3
      }}>
        {t('earnings_summary')}
      </Text>

      <View style={styles.statsSummary}>
        <View style={[styles.statItem, { backgroundColor: theme.colors.card }]}>
          <Ionicons name="car-sport-outline" size={22} color={theme.colors.primary} style={{ marginBottom: 4 }} />
          <Text style={[styles.statValue, { color: theme.colors.text }]}>
            {earningsSummary?.data?.tripsCompleted || 0}
          </Text>
          <Text style={[styles.statLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]} numberOfLines={1} adjustsFontSizeToFit>
            {t('trips_completed')}
          </Text>
        </View>

        <View style={[styles.statItem, { backgroundColor: theme.colors.card }]}>
          <Ionicons name="wallet-outline" size={22} color="#10B981" style={{ marginBottom: 4 }} />
          <Text style={[styles.statValue, { color: theme.colors.primary }]}>
            {formatCurrency(earningsSummary?.data?.totalEarnings || 0)}
          </Text>
          <Text style={[styles.statLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]} numberOfLines={1} adjustsFontSizeToFit>
            {t('total_earnings')}
          </Text>
        </View>

        <View style={[styles.statItem, { backgroundColor: theme.colors.card }]}>
          <Ionicons name="star" size={22} color="#EAB308" style={{ marginBottom: 4 }} />
          <Text style={[styles.statValue, { color: '#EAB308' }]}>
            {avgRating}
          </Text>
          <Text style={[styles.statLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]} numberOfLines={1} adjustsFontSizeToFit>
            {t('avg_rating')}
          </Text>
        </View>
      </View>

      {/* ================= RIDE LIST ================= */}
      {isLoading ? (
        <View style={{ paddingBottom: 20 }}>
          {[1, 2, 3, 4, 5].map((key) => <RideActivitySkeleton key={key} />)}
        </View>
      ) : (
        <FlatList
          onRefresh={handleRefresh}
          refreshing={isManualRefresh}
          data={filteredRides}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>{t('no_rides_found')}</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.rideCard, { backgroundColor: theme.colors.card }]}
              onPress={() =>
                navigation.navigate('RideDetailScreen', { ride: item })
              }
            >
              <View style={styles.rideHeader}>
                <Text style={[styles.rideDate, isDark && { color: theme.colors.textMuted }]}>
                  {item.trip_code ? `#${item.trip_code}` : `#${item.id.slice(-6)}`} • {item.date} • {item.time}
                </Text>
                <StatusBadge status={item.status} isDark={isDark} />
              </View>

              <View style={styles.routeRow}>
                <Ionicons
                  name="radio-button-on"
                  size={18}
                  color={isDark ? '#34D399' : '#16A34A'}
                />
                <Text style={[styles.routeText, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{item.pickup}</Text>
              </View>

              <View style={styles.routeRow}>
                <Ionicons name="location" size={18} color="#DC2626" />
                <Text style={[styles.routeText, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{item.drop}</Text>
              </View>

              <View style={[styles.divider, isDark && { backgroundColor: theme.colors.border }]} />

              <View style={styles.footer}>
                <View style={styles.footerItem}>
                  <Ionicons
                    name="car-outline"
                    size={16}
                    color={isDark ? '#60A5FA' : colors.primary}
                  />
                  <Text style={[styles.footerText, isDark && { color: theme.colors.textMuted }]}>
                    {item.distance?.includes(t('km')) || item.distance?.includes('km') ? item.distance : `${item.distance} ${t('km')}`}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.amount,
                    item.status === 'Cancelled' && styles.cancelAmount,
                    isDark && item.status !== 'Cancelled' && { color: '#34D399' },
                    isDark && item.status === 'Cancelled' && { color: theme.colors.textMuted }
                  ]}
                >
                  {formatCurrency(item.amount)}
                </Text>
              </View>

              {item.customer?.rating && (
                <View style={styles.ratingRow}>
                  <View style={styles.starsSmall}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Ionicons
                        key={s}
                        name={s <= (item.customer?.rating || 0) ? "star" : "star-outline"}
                        size={12}
                        color="#FBBF24"
                      />
                    ))}
                  </View>
                  {item.customer.feedback && (
                    <Text style={[styles.feedbackSmall, { color: isDark ? '#9CA3AF' : '#6B7280' }]} numberOfLines={1}>
                      "{item.customer.feedback}"
                    </Text>
                  )}
                </View>
              )}
            </Pressable>
          )}
        />
      )}


      {/* ================= DATE FILTER MODAL ================= */}
      <Modal transparent visible={showDateFilter} animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: theme.colors.card }]}>
            {/* Drag Indicator */}
            <View style={[styles.dragHandle, isDark && { backgroundColor: theme.colors.border }]} />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Ionicons name="funnel-outline" size={20} color={theme.colors.text} />
              <Text style={[styles.sheetTitle, { color: theme.colors.text, marginBottom: 0 }]} numberOfLines={1} adjustsFontSizeToFit>{t('filter_trips')}</Text>
            </View>

            {/* QUICK RANGES */}
            <Text style={[styles.sectionLabel, isDark && { color: '#D1D5DB' }]} numberOfLines={1} adjustsFontSizeToFit>{t('quick_range')}</Text>
            <View style={styles.quickRow}>
              <Pressable style={[styles.quickChip, isDark && { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]} onPress={applyToday}>
                <Ionicons name="today-outline" size={14} color={isDark ? '#60A5FA' : colors.primary} />
                <Text style={[styles.quickChipText, isDark && { color: '#60A5FA' }]}>{t('today')}</Text>
              </Pressable>

              <Pressable style={[styles.quickChip, isDark && { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]} onPress={applyYesterday}>
                <Ionicons name="time-outline" size={14} color={isDark ? '#60A5FA' : colors.primary} />
                <Text style={[styles.quickChipText, isDark && { color: '#60A5FA' }]}>{t('yesterday')}</Text>
              </Pressable>

              <Pressable style={[styles.quickChip, isDark && { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]} onPress={applyLast7Days}>
                <Ionicons name="calendar-outline" size={14} color={isDark ? '#60A5FA' : colors.primary} />
                <Text style={[styles.quickChipText, isDark && { color: '#60A5FA' }]}>{t('last_7_days')}</Text>
              </Pressable>
            </View>

            {/* DATE RANGE */}
            <Text style={[styles.sectionLabel, isDark && { color: '#D1D5DB' }]} numberOfLines={1} adjustsFontSizeToFit>{t('custom_range')}</Text>

            <Pressable
              style={[styles.dateRow, isDark && { backgroundColor: theme.colors.background }]}
              onPress={() => setShowFromPicker(true)}
            >
              <Ionicons name="calendar-outline" size={18} color={theme.colors.text} />
              <View>
                <Text style={[styles.dateLabel, isDark && { color: theme.colors.textMuted }]} numberOfLines={1} adjustsFontSizeToFit>{t('from')}</Text>
                <Text style={[styles.dateValue, { color: theme.colors.text }]}>
                  {fromDate.toDateString()}
                </Text>
              </View>
            </Pressable>

            <Pressable
              style={[styles.dateRow, isDark && { backgroundColor: theme.colors.background }]}
              onPress={() => setShowToPicker(true)}
            >
              <Ionicons name="calendar-outline" size={18} color={theme.colors.text} />
              <View>
                <Text style={[styles.dateLabel, isDark && { color: theme.colors.textMuted }]} numberOfLines={1} adjustsFontSizeToFit>{t('to')}</Text>
                <Text style={[styles.dateValue, { color: theme.colors.text }]}>
                  {toDate.toDateString()}
                </Text>
              </View>
            </Pressable>

            {/* ACTIONS */}
            <Pressable
              style={styles.applyBtn}
              onPress={() => setShowDateFilter(false)}
            >
              <Text style={styles.applyText} numberOfLines={1} adjustsFontSizeToFit>{t('apply_filter')}</Text>
            </Pressable>

            <Pressable
              style={styles.cancelBtn}
              onPress={() => setShowDateFilter(false)}
            >
              <Text style={[styles.cancelText, isDark && { color: '#60A5FA' }]} numberOfLines={1} adjustsFontSizeToFit>{t('cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>


      {showFromPicker && (
        <DateTimePicker
          value={fromDate}
          mode="date"
          display="spinner"
          onChange={(e, date) => {
            setShowFromPicker(false);
            if (date) { setFromDate(date); }
          }}
        />
      )}

      {showToPicker && (
        <DateTimePicker
          value={toDate}
          mode="date"
          display="spinner"
          onChange={(e, date) => {
            setShowToPicker(false);
            if (date) { setToDate(date); }
          }}
        />
      )}
    </View>
  );
};

export default RideActivityScreen;

/* ================= SUB COMPONENT ================= */

const StatusBadge = ({ status, isDark }: any) => {
  const { t, i18n } = useTranslation();
  return (
    <View
      style={[
        styles.badge,
        status === 'Completed'
          ? [styles.success, isDark && { backgroundColor: 'rgba(22, 163, 74, 0.2)' }]
          : [styles.cancelled, isDark && { backgroundColor: 'rgba(220, 38, 38, 0.2)' }],
      ]}
    >
      <Text style={[styles.badgeText, isDark && { color: status === 'Completed' ? '#34D399' : '#F87171' }]}>
        {i18n.exists(status.toLowerCase()) ? t(status.toLowerCase()) : status}
      </Text>
    </View>
  );
};

const RideActivitySkeleton = () => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      })
    ).start();
  }, [animatedValue]);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });

  return (
    <View style={[styles.rideCard, { overflow: 'hidden' }]}>
      <View style={styles.rideHeader}>
        <View style={[styles.skeletonLine, { width: 120, height: 16 }]} />
        <View style={[styles.skeletonLine, { width: 60, height: 20, borderRadius: 12 }]} />
      </View>

      <View style={[styles.skeletonLine, { width: '80%', height: 16, marginTop: 4, marginBottom: 8 }]} />
      <View style={[styles.skeletonLine, { width: '60%', height: 16 }]} />

      <View style={styles.divider} />

      <View style={styles.footer}>
        <View style={[styles.skeletonLine, { width: 80, height: 16 }]} />
        <View style={[styles.skeletonLine, { width: 60, height: 20 }]} />
      </View>

      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }], zIndex: 10 }]}>
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
};

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    alignItems: 'center',

  },
  statsSummary: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 12,

  },
  statItem: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },

  quickFilters: {
    flexDirection: 'row',
    marginHorizontal: 16,
    gap: 8,
  },

  quickBtn: {
    flex: 1,
    backgroundColor: '#E0E7FF',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },

  quickText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },

  tabs: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
  },

  tab: {
    flex: 1,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 20,
  },

  activeTab: {
    backgroundColor: colors.primary,
  },

  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },

  activeTabText: {
    color: '#FFFFFF',
  },

  rideCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },

  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  rideDate: {
    fontSize: 12,
    color: '#6B7280',
  },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  success: { backgroundColor: '#DCFCE7' },
  cancelled: { backgroundColor: '#FEE2E2' },

  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },

  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 4,
  },

  routeText: {
    fontSize: 15,
  },

  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  footerItem: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },

  footerText: {
    fontSize: 13,
    color: '#6B7280',
  },

  amount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#16A34A',
  },

  cancelAmount: {
    color: '#9CA3AF',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  starsSmall: {
    flexDirection: 'row',
    gap: 2,
  },
  feedbackSmall: {
    fontSize: 11,
    fontStyle: 'italic',
    flex: 1,
  },

  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#6B7280',
  },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },

  dateModal: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },

  dateText: {
    fontSize: 14,
    marginBottom: 8,
  },

  applyBtn: {
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: 12,
    marginTop: 12,
    alignItems: 'center',
  },

  applyText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  cancelText: {
    textAlign: 'center',
    marginTop: 12,
    color: colors.primary,
    fontWeight: '600',
  },


  sheet: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },

  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 12,
  },

  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },

  quickRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },

  quickChip: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  quickChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },

  dateLabel: {
    fontSize: 12,
    color: '#6B7280',
  },

  dateValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },

  cancelBtn: {
    marginTop: 12,
    alignItems: 'center',
  },
  skeletonLine: {
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
  },
});
