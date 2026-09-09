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
  ScrollView,
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
import { calculateDistance } from '../../utils/locationUtils';
import DateTimePicker from '@react-native-community/datetimepicker';
import { startOfDay, startOfWeek, startOfMonth, endOfDay } from 'date-fns';
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

type DateFilterType = 'all' | 'today' | 'week' | 'month' | 'other';

const DATE_FILTER_OPTIONS: { key: DateFilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'other', label: 'Other' },
];

const RideActivityScreen = ({ navigation, route }: any) => {
  const { theme, isDark } = useAppTheme();
  const isFocused = useIsFocused();
  const { t } = useTranslation();
  const user = useSelector((state: RootState) => state.userSlice.user);
  const driverId = user?.driverId || '';

  const [statusFilter, setStatusFilter] =
    useState<'all' | 'completed' | 'cancelled'>('all');
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('all');
  const [overviewTimeframe, setOverviewTimeframe] = useState<'Day' | 'Week' | 'Month'>('Month');
  const [showOverviewDropdown, setShowOverviewDropdown] = useState(false);
  const [showAllRides, setShowAllRides] = useState(false);

  const [showDateFilter, setShowDateFilter] = useState(false);

  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  });
  const [toDate, setToDate] = useState(new Date());
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);

  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const insets = useSafeAreaInsets();

  const dateParams = React.useMemo(() => {
    const now = new Date();
    const formatYMD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    switch (dateFilterType) {
      case 'today':
        return { from: formatYMD(startOfDay(now)), to: formatYMD(endOfDay(now)) };
      case 'week':
        return { from: formatYMD(startOfWeek(now, { weekStartsOn: 1 })), to: formatYMD(endOfDay(now)) };
      case 'month':
        return { from: formatYMD(startOfMonth(now)), to: formatYMD(endOfDay(now)) };
      case 'other':
        if (customStartDate && customEndDate) {
          return { from: formatYMD(customStartDate), to: formatYMD(customEndDate) };
        }
        return { from: formatYMD(fromDate), to: formatYMD(toDate) };
      default: // 'all'
        return { from: undefined, to: undefined };
    }
  }, [dateFilterType, customStartDate, customEndDate, fromDate, toDate]);

  const {
    data: activityResult,
    isLoading: isFirstLoading,
    refetch,
  } = useGetRideActivityQuery(
    {
      driverId,
      from: dateParams.from,
      to: dateParams.to,
      status: statusFilter === 'all' ? undefined : statusFilter,
    },
    { skip: !driverId }
  );

  const { data: performanceMetrics, refetch: refetchPerformance } = useGetDriverPerformanceQuery({ driverId }, { skip: !driverId });

  const [isManualRefresh, setIsManualRefresh] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsManualRefresh(true);
    await Promise.all([refetch(), refetchPerformance()]);
    setIsManualRefresh(false);
  }, [refetch, refetchPerformance]);

  const extractTripObject = (result: any) => {
    if (!result) return null;
    if (result.trip_id || result.pickup_address || result.pickup) return result;
    if (result.data && (result.data.trip_id || result.data.pickup_address || result.data.pickup)) return result.data;
    if (result.trip && (result.trip.trip_id || result.trip.pickup_address || result.trip.pickup)) return result.trip;
    return result.data || result;
  };

  const mapTripToRideItem = (rawTripData: any): RideItem => {
    const tripData = extractTripObject(rawTripData) || rawTripData;

    const rawAmount = tripData.amount !== undefined ? tripData.amount : tripData.total_fare;
    const amount = typeof rawAmount === 'string' ? parseFloat(rawAmount || '0') : (rawAmount || 0);

    let dateObj = new Date();
    if (tripData.created_at) {
      dateObj = new Date(tripData.created_at);
    } else if (tripData.date && tripData.date.includes('-')) {
      dateObj = new Date(tripData.date);
    }

    const timeline: any = {};
    if (tripData.trip_changes && Array.isArray(tripData.trip_changes)) {
      tripData.trip_changes.forEach((change: any) => {
        if (typeof change.new_value === 'string') {
          try { change.new_value = JSON.parse(change.new_value); } catch (e) {}
        }
        const newVal = change.new_value;
        const time = new Date(change.changed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (newVal?.trip_status === 'REQUESTED') timeline.requestedAt = time;
        if (newVal?.trip_status === 'ACCEPTED') timeline.acceptedAt = time;
        if (newVal?.trip_status === 'ARRIVED') timeline.arrivedAt = time;
        if (newVal?.trip_status === 'LIVE' || newVal?.trip_status === 'STARTED') timeline.startedAt = time;
        if (newVal?.trip_status === 'COMPLETED') timeline.completedAt = time;
        if (newVal?.trip_status === 'CANCELLED') timeline.cancelledAt = time;
      });
    }

    // fallback if timeline is empty
    if (Object.keys(timeline).length === 0) {
      if (tripData.created_at) timeline.requestedAt = new Date(tripData.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (tripData.trip_status === 'ACCEPTED' && tripData.updated_at) timeline.acceptedAt = new Date(tripData.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (tripData.trip_status === 'COMPLETED' && tripData.updated_at) timeline.completedAt = new Date(tripData.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (tripData.trip_status === 'CANCELLED' && tripData.updated_at) timeline.cancelledAt = new Date(tripData.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    let finalStatus = tripData.status || '';
    if (tripData.trip_status) {
      finalStatus = tripData.trip_status === 'COMPLETED' ? 'Completed' : tripData.trip_status === 'CANCELLED' ? 'Cancelled' : tripData.trip_status;
    } else if (tripData.status) {
      finalStatus = tripData.status === 'COMPLETED' ? 'Completed' : tripData.status === 'CANCELLED' ? 'Cancelled' : tripData.status;
    }

    const tripTypeStr = tripData.trip_type || tripData.ride_type || 'One-way';
    const isRoundTrip = tripTypeStr === 'ROUND_TRIP' || tripTypeStr === 'OUTSTATION_ROUND_TRIP';
    
    const pLat = parseFloat(tripData.pickup_lat || '0');
    const pLng = parseFloat(tripData.pickup_lng || '0');
    const dLat = parseFloat(tripData.drop_lat || '0');
    const dLng = parseFloat(tripData.drop_lng || '0');

    let distKm = parseFloat(tripData.distance_km || '0');
    const calculatedDist = calculateDistance(pLat, pLng, dLat, dLng);
    if (calculatedDist > 0) {
      distKm = isRoundTrip ? calculatedDist * 2 : calculatedDist;
      distKm = Math.round(distKm * 10) / 10;
    }

    // Calculate duration dynamically
    let durationMin = 0;
    if (tripData.trip_changes && Array.isArray(tripData.trip_changes)) {
      const startChange = tripData.trip_changes.find((c: any) => c.new_value?.trip_status === 'ACCEPTED' || c.new_value?.trip_status === 'ASSIGNED');
      const endChange = tripData.trip_changes.find((c: any) => c.new_value?.trip_status === 'COMPLETED');
      if (startChange && endChange) {
        const startTime = new Date(startChange.changed_at).getTime();
        const endTime = new Date(endChange.changed_at).getTime();
        durationMin = Math.max(0, Math.round((endTime - startTime) / 60000));
      }
    }
    if (durationMin <= 0) {
      durationMin = tripData.duration || tripData.trip_duration_minutes || 0;
    }

    return {
      id: tripData.id?.toString() || tripData.trip_id?.toString() || Math.random().toString(),
      date: tripData.date || dateObj.toLocaleDateString(),
      time: tripData.time || dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      pickup: tripData.pickup_address || tripData.pickup || 'Unknown Pickup',
      drop: tripData.drop_address || tripData.drop || 'Unknown Drop',
      amount: amount,
      distance: distKm > 0 ? `${distKm} km` : (tripData.distance || `0 km`),
      duration: durationMin > 0 ? `${durationMin} min` : '28 min',
      status: finalStatus,
      trip_code: tripData.trip_code || tripData.booking_code || '',
      paymentMethod: tripData.payment_method || tripData.paymentMethod || 'Cash',
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
    return '-';
  }, [rawRides, user?.rating]);

  const handleDateFilterSelect = (key: DateFilterType) => {
    if (key === 'other') {
      setDateFilterType('other');
      setShowDateFilter(true);
    } else {
      setDateFilterType(key);
      setCustomStartDate(null);
      setCustomEndDate(null);
    }
  };

  const applyToday = () => {
    const now = new Date();
    setCustomStartDate(startOfDay(now));
    setCustomEndDate(endOfDay(now));
    setDateFilterType('other');
    setShowDateFilter(false);
  };

  const applyYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setCustomStartDate(startOfDay(yesterday));
    setCustomEndDate(endOfDay(yesterday));
    setDateFilterType('other');
    setShowDateFilter(false);
  };

  const applyLast7Days = () => {
    const now = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    setCustomStartDate(startOfDay(weekAgo));
    setCustomEndDate(endOfDay(now));
    setDateFilterType('other');
    setShowDateFilter(false);
  };

  const filteredRides = rides.filter((r: RideItem) => statusFilter === 'all' || r.status.toLowerCase() === statusFilter);
  const displayedRides = showAllRides ? filteredRides : filteredRides.slice(0, 3);

  const dynamicStats = React.useMemo(() => {
    let completed = 0;
    let cancelled = 0;
    let earnings = 0;
    let tripDurationMinutes = 0;

    rides.forEach((r: RideItem) => {
      if (r.status.toLowerCase() === 'completed') {
        completed++;
        earnings += (r.amount || 0);
        
        // Parse duration (e.g., "28 min" -> 28)
        const match = r.duration?.toString().match(/(\d+)/);
        if (match) tripDurationMinutes += parseInt(match[1], 10);
      } else if (r.status.toLowerCase() === 'cancelled') {
        cancelled++;
      }
    });

    return {
      tripsCompleted: completed,
      cancelledTrips: cancelled,
      totalEarnings: earnings,
      tripDurationHours: tripDurationMinutes / 60
    };
  }, [rides]);

  const formatDurationTime = (hours: number) => {
    if (!hours || hours === 0) return '0h';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const formatGrowth = (value: number | undefined | null) => {
    if (value === undefined || value === null) return null;
    const isUp = value >= 0;
    return { text: `${isUp ? '↑' : '↓'} ${Math.abs(value).toFixed(1)}%`, isUp };
  };

  const renderHeader = () => (
    <View>
      {/* Date Filter Pills */}
      <View style={styles.filterPillsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsScroll}>
          {DATE_FILTER_OPTIONS.map((opt) => {
            const isActive = dateFilterType === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => handleDateFilterSelect(opt.key)}
                style={[
                  styles.filterPill,
                  isActive
                    ? styles.filterPillActive
                    : [styles.filterPillInactive, { borderColor: isDark ? '#334155' : '#E2E8F0' }],
                ]}
              >
                {opt.key === 'other' && (
                  <Ionicons name="calendar-outline" size={14} color={isActive ? '#fff' : (isDark ? '#94A3B8' : '#64748B')} style={{ marginRight: 4 }} />
                )}
                <Text style={[styles.filterText, isActive ? styles.filterTextActive : { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  {t(opt.key, opt.label)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <View style={[styles.tabs, isDark && { backgroundColor: theme.colors.border }]}>
        {['All', 'Completed', 'Cancelled'].map((item) => {
          const lowerItem = item.toLowerCase() as any;
          return (
            <Pressable
              key={item}
              onPress={() => setStatusFilter(lowerItem)}
              style={[
                styles.tab,
                statusFilter === lowerItem && styles.activeTab,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  isDark && statusFilter !== lowerItem && { color: theme.colors.textMuted },
                  statusFilter === lowerItem && styles.activeTabText,
                ]}
                numberOfLines={1} adjustsFontSizeToFit
              >
                {t(item, item)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <LinearGradient
        colors={['#0F172A', '#1E3A8A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.overviewCard}
      >
        <View style={styles.overviewHeaderRow}>
          <Text style={styles.dropdownTriggerText}>{t('overview', t('overview', 'Overview'))}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.overviewGrid}>
          <View style={styles.overviewCol}>
            <Text style={styles.overviewValue}>{dynamicStats.tripsCompleted}</Text>
            <Text style={styles.overviewLabel}>{t('completed_rides', t('completed_rides', 'Completed Rides'))}</Text>
          </View>

          <View style={styles.overviewDivider} />
          <View style={styles.overviewCol}>
            <Text style={styles.overviewValue}>{dynamicStats.cancelledTrips}</Text>
            <Text style={styles.overviewLabel}>{t('cancelled_rides', t('cancelled_rides', 'Cancelled Rides'))}</Text>
          </View>
          <View style={styles.overviewDivider} />
          <View style={styles.overviewCol}>
            <Text style={styles.overviewValue}>{formatDurationTime(dynamicStats.tripDurationHours)}</Text>
            <Text style={styles.overviewLabel}>{t('total_trip_duration', t('total_trip_duration', 'Total Trip Duration'))}</Text>
          </View>
          <View style={styles.overviewDivider} />
          <View style={styles.overviewCol}>
            <Text style={styles.overviewValue}>{formatCurrency(dynamicStats.totalEarnings)}</Text>
            <Text style={styles.overviewLabel}>{t('earnings', t('earnings', 'Earnings'))}</Text>
          </View>
          <View style={styles.overviewDivider} />
          <View style={styles.overviewCol}>
            <Text style={styles.overviewValue}>{avgRating}</Text>
            <Text style={styles.overviewLabel}>{t('rating', t('rating', 'Rating'))}</Text>
          </View>
        </ScrollView>
      </LinearGradient>



      <View style={styles.recentHeader}>
        <Text style={[styles.recentTitle, { color: theme.colors.text }]}>{t('recent_rides', t('recent_rides', 'Recent Rides'))}</Text>
        {filteredRides.length > 3 && (
          <Pressable onPress={() => setShowAllRides(!showAllRides)}>
            <Text style={styles.viewAllText}>{showAllRides ? t('show_less', t('show_less', 'Show Less')) : t('view_all', t('view_all', 'View All'))}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  const renderRideItem = ({ item }: { item: any }) => (
    <Pressable
      style={[styles.rideCard, { borderBottomColor: isDark ? theme.colors.border : '#E2E8F0' }]}
      onPress={() =>
        navigation.navigate('RideDetailScreen', { ride: item })
      }
    >
      <View style={styles.rideHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rideDate, isDark && { color: theme.colors.textMuted }]} numberOfLines={1}>
            {item.trip_code ? `#${item.trip_code}` : `#${item.id.slice(-6)}`} • {item.date}{item.time ? `, ${item.time}` : ''}
          </Text>
        </View>
        {statusFilter === 'all' && <StatusBadge status={item.status} isDark={isDark} />}
      </View>

      <View style={[styles.routeRow, { justifyContent: 'space-between', alignItems: 'center', width: '100%' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, paddingRight: 8 }}>
          <Ionicons
            name="radio-button-on"
            size={14}
            color={isDark ? '#34D399' : '#16A34A'}
          />
          <Text style={[styles.routeText, { color: theme.colors.text, flex: 1 }]} numberOfLines={1} ellipsizeMode="tail">{item.pickup}</Text>
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

      <View style={styles.routeRow}>
        <Ionicons name="location" size={14} color="#DC2626" />
        <Text style={[styles.routeText, { color: theme.colors.text, flex: 1 }]} numberOfLines={1} ellipsizeMode="tail">{item.drop}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, flexWrap: 'wrap', gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Ionicons name="time-outline" size={12} color={isDark ? '#9CA3AF' : '#6B7280'} />
          <Text style={{ fontSize: 11, color: isDark ? '#9CA3AF' : '#6B7280' }}>
            Acc: {item.timeline?.acceptedAt || item.timeline?.requestedAt || item.time}
          </Text>
        </View>
        {item.timeline?.startedAt && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 11, color: isDark ? '#6B7280' : '#D1D5DB' }}>•</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Ionicons name="play-circle-outline" size={12} color={isDark ? '#9CA3AF' : '#6B7280'} />
              <Text style={{ fontSize: 11, color: isDark ? '#9CA3AF' : '#6B7280' }}>
                Start: {item.timeline.startedAt}
              </Text>
            </View>
          </View>
        )}
        {item.timeline?.completedAt && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 11, color: isDark ? '#6B7280' : '#D1D5DB' }}>•</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Ionicons name="checkmark-done-circle-outline" size={12} color={isDark ? '#9CA3AF' : '#6B7280'} />
              <Text style={{ fontSize: 11, color: isDark ? '#9CA3AF' : '#6B7280' }}>
                End: {item.timeline.completedAt}
              </Text>
            </View>
          </View>
        )}
        {item.timeline?.cancelledAt && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 11, color: isDark ? '#6B7280' : '#D1D5DB' }}>•</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Ionicons name="close-circle-outline" size={12} color={isDark ? '#EF4444' : '#DC2626'} />
              <Text style={{ fontSize: 11, color: isDark ? '#EF4444' : '#DC2626' }}>
                Cancel: {item.timeline.cancelledAt}
              </Text>
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );

  const renderFooter = () => (
    <View style={[styles.bottomPromo, { backgroundColor: isDark ? '#1e293b' : '#EFF6FF' }]}>
      <View style={styles.promoIconCircle}>
        <Ionicons name="bar-chart" size={18} color="#FFFFFF" />
      </View>
      <View style={styles.promoTextContainer}>
        <Text style={[styles.promoTitle, { color: theme.colors.text }]} numberOfLines={1}>{t('keep_it_up', "Keep it up! You're doing great")}</Text>
        <Text style={[styles.promoSubtitle, { color: isDark ? '#9CA3AF' : '#4B5563' }]} numberOfLines={1}>
          Completed <Text style={{ fontWeight: '700' }}>12.6%</Text> more rides.
        </Text>
      </View>
      <Pressable style={styles.promoButton}>
        <Text style={styles.promoButtonText}>{t('view', 'View')}</Text>
        <Ionicons name="chevron-forward" size={12} color="#FFFFFF" style={{ marginLeft: 2 }} />
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {isFocused && <AppStatusBar />}
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: theme.colors.background }]}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </Pressable>
          <View>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1}>{t('ride_activity', t('ride_activity', 'Ride Activity'))}</Text>
            <Text style={styles.headerSubtitle}>{t('track_performance', t('track_performance', 'Track your rides and performance'))}</Text>
          </View>
        </View>
      </View>

      {isLoading ? (
        <View style={{ padding: 16 }}>
          {[1, 2, 3].map((key) => <RideActivitySkeleton key={key} />)}
        </View>
      ) : (
        <FlatList
          onRefresh={handleRefresh}
          refreshing={isManualRefresh}
          data={displayedRides}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={renderRideItem}
        />
      )}

      {/* Date Filter Modal */}
      <Modal transparent visible={showDateFilter} animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: theme.colors.card }]}>
            <View style={[styles.dragHandle, isDark && { backgroundColor: theme.colors.border }]} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Ionicons name="funnel-outline" size={20} color={theme.colors.text} />
              <Text style={[styles.sheetTitle, { color: theme.colors.text, marginBottom: 0 }]} numberOfLines={1}>{t('filter_trips')}</Text>
            </View>

            <Text style={[styles.sectionLabel, isDark && { color: '#D1D5DB' }]} numberOfLines={1}>{t('quick_range')}</Text>
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

            <Text style={[styles.sectionLabel, isDark && { color: '#D1D5DB' }]} numberOfLines={1}>{t('custom_range')}</Text>
            <Pressable style={[styles.dateRow, isDark && { backgroundColor: theme.colors.background }]} onPress={() => setShowFromPicker(true)}>
              <Ionicons name="calendar-outline" size={18} color={theme.colors.text} />
              <View>
                <Text style={[styles.dateLabel, isDark && { color: theme.colors.textMuted }]} numberOfLines={1}>{t('from')}</Text>
                <Text style={[styles.dateValue, { color: theme.colors.text }]}>{fromDate.toDateString()}</Text>
              </View>
            </Pressable>
            <Pressable style={[styles.dateRow, isDark && { backgroundColor: theme.colors.background }]} onPress={() => setShowToPicker(true)}>
              <Ionicons name="calendar-outline" size={18} color={theme.colors.text} />
              <View>
                <Text style={[styles.dateLabel, isDark && { color: theme.colors.textMuted }]} numberOfLines={1}>{t('to')}</Text>
                <Text style={[styles.dateValue, { color: theme.colors.text }]}>{toDate.toDateString()}</Text>
              </View>
            </Pressable>

            <Pressable style={styles.applyBtn} onPress={() => setShowDateFilter(false)}>
              <Text style={styles.applyText} numberOfLines={1}>{t('apply_filter')}</Text>
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={() => setShowDateFilter(false)}>
              <Text style={[styles.cancelText, isDark && { color: '#60A5FA' }]} numberOfLines={1}>{t('cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showOverviewDropdown} transparent animationType="fade">
        <Pressable style={styles.dropdownOverlay} onPress={() => setShowOverviewDropdown(false)}>
          <View style={[styles.dropdownMenu, { backgroundColor: theme.colors.card }]}>
            {['Day', 'Week', 'Month'].map((opt) => (
              <Pressable 
                key={opt} 
                style={[styles.dropdownOption, overviewTimeframe === opt && { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]} 
                onPress={() => { setOverviewTimeframe(opt as any); setShowOverviewDropdown(false); }}
              >
                <Text style={[styles.dropdownOptionText, { color: theme.colors.text }, overviewTimeframe === opt && { fontWeight: 'bold' }]}>{t(opt.toLowerCase(), opt)}</Text>
                {overviewTimeframe === opt && <Ionicons name="checkmark" size={16} color={colors.primary} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {showFromPicker && (
        <DateTimePicker value={fromDate} mode="date" display="spinner" onChange={(e, date) => { setShowFromPicker(false); if (date) setFromDate(date); }} />
      )}
      {showToPicker && (
        <DateTimePicker value={toDate} mode="date" display="spinner" onChange={(e, date) => { setShowToPicker(false); if (date) setToDate(date); }} />
      )}
    </View>
  );
};

export default RideActivityScreen;

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
    <View style={[{ overflow: 'hidden', backgroundColor: '#FFF', marginHorizontal: 16, marginBottom: 16, padding: 16, borderRadius: 16 }]}>
      <View style={{ flexDirection: 'row', marginBottom: 8 }}>
        <View style={[styles.skeletonLine, { width: 40, height: 40, borderRadius: 20, marginRight: 12 }]} />
        <View style={{ flex: 1 }}>
          <View style={[styles.skeletonLine, { width: 120, height: 16, marginBottom: 8 }]} />
          <View style={[styles.skeletonLine, { width: '80%', height: 12 }]} />
        </View>
      </View>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }], zIndex: 10 }]}>
        <LinearGradient colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    backgroundColor: '#F1F5F9',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillsContainer: { paddingVertical: 10 },
  filterPillsScroll: { paddingHorizontal: 16, gap: 8 },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  filterPillInactive: {},
  filterText: { fontSize: 13, fontWeight: '500' },
  filterTextActive: { color: '#FFF' },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  overviewCard: {
    marginHorizontal: 12,
    borderRadius: 16,
    padding: 10,
    marginBottom: 16,
  },
  overviewTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 0,
  },
  overviewGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  overviewCol: {
    marginRight: 16,
  },
  overviewValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  overviewLabel: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 0,
    marginBottom: 2,
  },
  overviewTrendUp: {
    color: '#34D399',
    fontSize: 9,
    fontWeight: '600',
  },
  overviewTrendDown: {
    color: '#F87171',
    fontSize: 9,
    fontWeight: '600',
  },
  overviewDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#334155',
    marginRight: 16,
  },
  statsScroll: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  smallStatCard: {
    width: 140,
    padding: 16,
    borderRadius: 16,
  },
  statIconContainerBlue: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statIconContainerGreen: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statIconContainerYellow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statIconContainerPurple: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  smallStatLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  smallStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  smallStatTrendUp: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  viewAllText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  rideCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    position: 'relative',
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rideDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  success: { backgroundColor: '#DCFCE7' },
  cancelled: { backgroundColor: '#FEE2E2' },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  routeText: {
    fontSize: 13,
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
  bottomPromo: {
    marginHorizontal: 16,
    marginVertical: 16,
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  promoIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoTextContainer: {
    flex: 1,
  },
  promoTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  promoSubtitle: {
    fontSize: 11,
    lineHeight: 14,
  },
  promoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  promoButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
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
  cancelBtn: {
    marginTop: 12,
    alignItems: 'center',
  },
  cancelText: {
    textAlign: 'center',
    marginTop: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  skeletonLine: {
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
  },
  overviewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  dropdownTriggerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginRight: 4,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    width: 200,
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  dropdownOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  dropdownOptionText: {
    fontSize: 14,
  },
});
