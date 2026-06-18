import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  ScrollView,
  RefreshControl,
  InteractionManager,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import AppStatusBar from '../../Components/AppStatusBar';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withSpring,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { useSelector } from 'react-redux';
import { useAppTheme } from '../../context/ThemeContext';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useHaptic } from '../../hooks/useHaptic';
import { 
  useGetDriverPerformanceQuery, 
  useGetRideActivityQuery, 
  useGetTodayOverviewQuery,
  useUpdateDriverMutation 
} from '../../service/driverApi';
import { RootState } from '../../redux/store';
import { 
  calculatePerformanceMetrics, 
  getDynamicPerformanceInsights, 
  getTierRoadmapData,
  PerformanceMetrics 
} from '../../utils/performanceUtils';

const { width } = Dimensions.get('window');

/* =====================================================
   TYPES
===================================================== */

type Period = 'Today' | 'Week' | 'Month';


const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/* =====================================================
   COMPONENTS
===================================================== */

/**
 * Enhanced Performance Gauge with Gradients
 */
const PerformanceGauge = ({ value, loading }: { value: number; loading?: boolean }) => {
  const { t } = useTranslation();
  const { isDark } = useAppTheme();
  const size = width * 0.45;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = useSharedValue(0);

  React.useEffect(() => {
    if (!loading) {
      progress.value = withSpring(value / 100, { damping: 15 });
    } else {
      progress.value = withTiming(0);
    }
  }, [value, loading, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={styles.gaugeContainer}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <SvgGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#2563EB" />
            <Stop offset="100%" stopColor="#3B82F6" />
          </SvgGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={isDark ? '#374151' : '#E5E7EB'}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#grad)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.gaugeInnerText}>
        <Text style={[styles.gaugeValue, { color: isDark ? '#FFFFFF' : '#111827' }]}>{loading ? '--' : `${value}%`}</Text>
        <Text style={[styles.gaugeLabel, { color: isDark ? '#D1D5DB' : '#6B7280' }]}>{t('score', 'Score')}</Text>
      </View>
    </View>
  );
};

const StatCard = ({ label, value, icon, color, loading }: { label: string; value: string | number; icon: string; color: string; loading?: boolean }) => {
  const { t: _t } = useTranslation();
  const { isDark } = useAppTheme();
  return (
    <View style={[styles.statCard, { backgroundColor: isDark ? '#1F2937' : '#FFF', shadowOpacity: isDark ? 0 : 0.02 }]}>
      <View style={[styles.statIconContainer, { backgroundColor: isDark ? color + '30' : color + '15' }]}>
        <Ionicons name={icon} size={20} color={isDark ? '#FFFFFF' : color} />
      </View>
      <View style={styles.statContent}>
        <Text style={[styles.statLabel, { color: isDark ? '#D1D5DB' : '#6B7280' }]}>{label}</Text>
        <Text style={[styles.statValue, { color: isDark ? '#FFFFFF' : '#111827' }]}>{loading ? '...' : value}</Text>
      </View>
    </View>
  );
};

/**
 * Premium Tier Roadmap with Glassmorphism
 */
const TierRoadmap = ({ period, metrics }: { period: 'Today' | 'Week' | 'Month'; metrics: PerformanceMetrics | null }) => {
  const { t } = useTranslation();
  const { isDark } = useAppTheme();
  
  const roadmap = useMemo(() => 
    getTierRoadmapData(period, metrics, t), 
  [period, metrics, t]);

  const { currentTier, nextTier, progress, tasks, ratingPlan, ridesNeeded } = roadmap;

  const tierUIConfig = useMemo(() => {
    const name = currentTier.name.toUpperCase();
    if (name.includes('SILVER')) {
      return {
        colors: isDark ? ['#334155', '#1E293B'] : ['#94A3B8', '#475569'],
        glowColor: 'rgba(203, 213, 225, 0.4)',
        icon: 'medal-outline',
        accentColor: '#CBD5E1',
        textColor: '#FFFFFF',
      };
    } else if (name.includes('GOLD')) {
      return {
        colors: isDark ? ['#78350F', '#451A03'] : ['#D97706', '#92400E'],
        glowColor: 'rgba(251, 191, 36, 0.5)',
        icon: 'trophy-outline',
        accentColor: '#FBBF24',
        textColor: '#FFFFFF',
      };
    } else if (name.includes('PLATINUM')) {
      return {
        colors: isDark ? ['#1E3A8A', '#0F172A'] : ['#2563EB', '#1D4ED8'],
        glowColor: 'rgba(96, 165, 250, 0.6)',
        icon: 'shield-checkmark-outline',
        accentColor: '#60A5FA',
        textColor: '#FFFFFF',
      };
    } else {
      return {
        colors: isDark ? ['#1E293B', '#0F172A'] : ['#64748B', '#334155'],
        glowColor: 'rgba(148, 163, 184, 0.3)',
        icon: 'ribbon-outline',
        accentColor: '#94A3B8',
        textColor: '#FFFFFF',
      };
    }
  }, [currentTier, isDark]);

  return (
    <View style={styles.tierContainer}>
      <LinearGradient
        colors={tierUIConfig.colors}
        style={[
          styles.tierCard,
          {
            shadowColor: tierUIConfig.glowColor,
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 15,
            elevation: 8,
          },
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.tierHeader}>
          <View>
            <View style={styles.tierNameRow}>
              <Ionicons name={tierUIConfig.icon} size={26} color={tierUIConfig.accentColor} style={{ marginRight: 8 }} />
              <Text style={[styles.tierTitle, { color: tierUIConfig.textColor }]}>{currentTier.name}</Text>
            </View>
            <Text style={styles.tierLevel}>{t('driver_level', { level: currentTier.name })}</Text>
          </View>
          {nextTier && (
            <View style={[styles.pointsBadge, { backgroundColor: 'rgba(0, 0, 0, 0.3)', borderColor: 'rgba(255, 255, 255, 0.1)', borderWidth: 1 }]}>
              <Text style={styles.pointsNeeded}>{ridesNeeded}</Text>
              <Text style={styles.pointsLabel}>{t('rides_to_next', 'RIDES TO NEXT')}</Text>
            </View>
          )}
        </View>

        <View style={styles.roadmapContent}>
          {nextTier ? (
            <>
              <View style={styles.roadmapProgress}>
                <View style={[styles.progressBarBg, { backgroundColor: 'rgba(0, 0, 0, 0.25)' }]}>
                  <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: tierUIConfig.accentColor }]} />
                </View>
                <View style={styles.roadmapLabels}>
                  <Text style={styles.roadmapLabel}>{currentTier.name}</Text>
                  <Text style={styles.roadmapLabel}>{nextTier.name}</Text>
                </View>
              </View>

              <View style={[styles.missionCard, { backgroundColor: 'rgba(255, 255, 255, 0.08)', borderColor: 'rgba(255, 255, 255, 0.15)' }]}>
                <Text style={styles.missionTitle}>
                  {t('remaining_rides_to_tier', '🔥 {{count}} rides to {{tier}}!', { count: ridesNeeded, tier: nextTier.name })}
                </Text>
                {tasks.map((task, idx) => (
                  <View key={idx} style={styles.missionItem}>
                    <Ionicons name="checkmark-circle" size={16} color={tierUIConfig.accentColor} />
                    <Text style={styles.missionText}>{task}</Text>
                  </View>
                ))}
              </View>

              {/* Dynamic Growth Plan based on Rating */}
              <View style={[styles.missionCard, { marginTop: 10, backgroundColor: 'rgba(0, 0, 0, 0.15)', borderColor: 'rgba(255, 255, 255, 0.05)' }]}>
                <Text style={styles.missionTitle}>{t('performance_plan', 'Growth Plan')}</Text>
                <View style={styles.missionItem}>
                  <Ionicons name="bulb" size={16} color="#FBBF24" />
                  <Text style={[styles.missionText, { fontWeight: '700', color: '#FFF' }]}>{ratingPlan}</Text>
                </View>
              </View>
            </>
          ) : (
            <View style={[styles.maxTierBox, { backgroundColor: 'rgba(255, 255, 255, 0.12)', borderColor: 'rgba(255, 255, 255, 0.2)', borderWidth: 1 }]}>
              <Ionicons name="trophy" size={32} color="#FBBF24" />
              <Text style={styles.maxTierText}>{t('highest_tier_reached', 'Highest Tier Reached!')}</Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </View>
  );
};

/* =====================================================
   MAIN SCREEN
===================================================== */

const DriverPerformanceScreen = ({ navigation }: any) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isDark } = useAppTheme();
  const { triggerHaptic } = useHaptic();
  
  const [updateDriver] = useUpdateDriverMutation();
  const lastSyncedRating = React.useRef<number | null>(null);

  const [period, setPeriod] = useState<Period>('Week');
  const scrollY = useSharedValue(0);

  // Get current user from Redux
  const user = useSelector((state: RootState) => state.userSlice.user);
  const driverId = user?.driverId || '';
  const isFocused = useIsFocused();

  // RTK Query for performance data (keeping this for backend-only stats like Tier/Points)
  const { data, isLoading: isPerfLoading, refetch: refetchPerf, error } = useGetDriverPerformanceQuery(
    { driverId, period: period.toLowerCase() },
    { skip: !driverId }
  );
  
  // Real-time Overview for "Today" (most accurate for total online time)
  const { data: todayOverviewResult, refetch: refetchTodayOverview } = useGetTodayOverviewQuery(driverId, { skip: !driverId || period !== 'Today' });
  const todayOverview = todayOverviewResult;



  // Helper for date calculation
  const getDatesForPeriod = useCallback((p: Period) => {
    const to = new Date();
    const from = new Date();
    if (p === 'Today') {
      // Current day
    } else if (p === 'Week') {
      from.setDate(to.getDate() - 7);
    } else if (p === 'Month') {
      from.setDate(to.getDate() - 30);
    }
    return { 
      from: from.toISOString().split('T')[0], 
      to: to.toISOString().split('T')[0] 
    };
  }, []);

  const dateRange = getDatesForPeriod(period);

  // Fetch real ride activity for dynamic metrics
  const { data: activityResult, isLoading: isActivityLoading, refetch: refetchActivity } = useGetRideActivityQuery(
    { 
      driverId, 
      from: dateRange.from, 
      to: dateRange.to 
    },
    { skip: !driverId }
  );

  // Sync data on focus removed to prevent layout glitches on back navigation

  const isLoading = isPerfLoading || isActivityLoading;

  // Calculate dynamic metrics from real ride data
  const dynamicMetrics = useMemo(() => {
    const rides = activityResult?.data ? (Array.isArray(activityResult.data) ? activityResult.data : (activityResult.data.rides || activityResult.data.trips || [])) : [];
    // If it's a paginated or object response, handle it
    const normalizedRides = Array.isArray(activityResult?.data) ? activityResult.data : (activityResult?.data?.data || []);
    return calculatePerformanceMetrics(normalizedRides);
  }, [activityResult]);

  const apiMetrics = data?.data || {};
  
  // MERGE: Prefer dynamic metrics for specific KPIs, keep API for Tier/Points
  const metrics = {
    completionRate: dynamicMetrics.completionRate,
    acceptanceRate: dynamicMetrics.acceptanceRate,
    rating: dynamicMetrics.rating || user?.rating || 0,
    earnings: `₹${dynamicMetrics.totalEarnings.toLocaleString('en-IN')}`,
    onlineHours: period === 'Today' && todayOverview?.onlineMinutes !== undefined 
        ? parseFloat((todayOverview.onlineMinutes / 60).toFixed(1)) 
        : (apiMetrics.onlineHours || 0),
    tier: apiMetrics.tier || 'Partner',
    points: apiMetrics.points || 0,
    nextTierPoints: apiMetrics.nextTierPoints || 100,
  };

  // Sync Calculate Rating to Backend (Drivers Table)
  useEffect(() => {
    if (
      period === 'Month' && // Only sync when looking at a large enough dataset
      dynamicMetrics.rating > 0 && 
      driverId && 
      lastSyncedRating.current !== dynamicMetrics.rating &&
      Math.abs(dynamicMetrics.rating - (user?.rating || 0)) > 0.01 // Only sync if there's a real change
    ) {
      lastSyncedRating.current = dynamicMetrics.rating;
      updateDriver({ 
        id: driverId, 
        data: { rating: dynamicMetrics.rating } 
      });
    }
  }, [dynamicMetrics.rating, driverId, user?.rating, updateDriver, period]);

  const dynamicInsights = useMemo(() => 
    getDynamicPerformanceInsights(dynamicMetrics, t),
  [dynamicMetrics, t]);

  const [isManualRefresh, setIsManualRefresh] = useState(false);

  const onRefresh = useCallback(async () => {
    triggerHaptic(HapticFeedbackTypes.impactLight);
    setIsManualRefresh(true);
    await Promise.all([refetchPerf(), refetchActivity()]);
    setIsManualRefresh(false);
  }, [refetchPerf, refetchActivity, triggerHaptic]);

  const handlePeriodChange = (p: Period) => {
    if (p !== period) {
      triggerHaptic(HapticFeedbackTypes.selection);
      setPeriod(p);
    }
  };

  const headerStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, 60], [1, 0], Extrapolate.CLAMP);
    return { opacity };
  });

  return (
    <View style={[styles.safeArea, { backgroundColor: isDark ? '#111827' : '#F9FAFB' }]}>
      {isFocused && <AppStatusBar />}
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: isDark ? '#1F2937' : '#FFF' }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={isDark ? '#FFFFFF' : '#111827'} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: isDark ? '#FFFFFF' : '#111827' }]} numberOfLines={1} adjustsFontSizeToFit>{t('driver_performance', 'Driver Performance')}</Text>
        <Pressable style={styles.infoBtn}>
          <Ionicons name="information-circle-outline" size={24} color={isDark ? '#FFFFFF' : '#111827'} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={(e) => { scrollY.value = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={isManualRefresh} onRefresh={onRefresh} tintColor="#2563EB" />
        }
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
      >
        {/* Period Selector */}
        <View style={[styles.toggleContainer, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
          {(['Today', 'Week', 'Month'] as Period[]).map((p) => (
            <Pressable
              key={p}
              onPress={() => handlePeriodChange(p)}
              style={[
                styles.toggleBtn,
                period === p && [styles.toggleActive, { backgroundColor: isDark ? '#1F2937' : '#FFF' }]
              ]}
            >
              <Text style={[
                styles.toggleText,
                { color: isDark ? '#9CA3AF' : '#6B7280' },
                period === p && [styles.toggleTextActive, { color: isDark ? '#FFFFFF' : '#111827' }]
              ]}>{t(p.toLowerCase(), p)}</Text>
            </Pressable>
          ))}
        </View>

        {/* Hero Section: Gauge */}
        <Animated.View style={[styles.heroSection, headerStyle, { backgroundColor: isDark ? '#1F2937' : '#FFF' }]}>
          <PerformanceGauge value={metrics.completionRate} loading={isLoading} />
          <View style={styles.heroSummary}>
            <Text style={[styles.summaryTitle, { color: isDark ? '#FFFFFF' : '#111827' }]} numberOfLines={1} adjustsFontSizeToFit>{t('overall_performance', 'Overall Performance')}</Text>
            <Text style={[styles.summarySub, { color: isDark ? '#D1D5DB' : '#6B7280' }]}>
              {error ? t('performance_load_error', 'Could not load your performance data.') : t('performance_period_desc', { period: t(period.toLowerCase()) })}
            </Text>
          </View>
        </Animated.View>

        {/* Level & Gamification */}
        {!isLoading && (
          <TierRoadmap period={period} metrics={dynamicMetrics} />
        )}

        {/* Main Metrics Grid */}
        <View style={styles.metricsGrid}>
          <StatCard
            label={t('earnings', 'Earnings')}
            value={metrics.earnings}
            icon="wallet-outline"
            color="#059669"
            loading={isLoading}
          />
          <StatCard
            label={t('online_time', 'Online Time')}
            value={`${metrics.onlineHours}h`}
            icon="time-outline"
            color="#2563EB"
            loading={isLoading}
          />
          <StatCard
            label={t('rating', 'Rating')}
            value={typeof metrics.rating === 'number' ? metrics.rating.toFixed(1) : metrics.rating}
            icon="star-outline"
            color="#D97706"
            loading={isLoading}
          />
          <StatCard
            label={t('acceptance', 'Acceptance')}
            value={`${metrics.acceptanceRate}%`}
            icon="checkmark-circle-outline"
            color="#7C3AED"
            loading={isLoading}
          />
        </View>

        {/* Insight Section */}
        <View style={styles.insightSection}>
          <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#111827' }]} numberOfLines={1} adjustsFontSizeToFit>{t('performance_insights', 'Performance Insights')}</Text>
          <View style={[styles.insightCard, { backgroundColor: isDark ? '#1F2937' : '#FFF', borderColor: isDark ? '#374151' : '#F3F4F6' }]}>
            {dynamicInsights.map((insight, index) => (
              <View key={index} style={styles.insightRow}>
                <Ionicons name={insight.icon} size={20} color={isDark ? insight.color : insight.color} />
                <Text style={[styles.insightText, { color: isDark ? '#FFFFFF' : '#374151' }]}>
                  {insight.text}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Footer Info */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: isDark ? '#9CA3AF' : '#9CA3AF' }]} numberOfLines={1} adjustsFontSizeToFit>{t('updated_just_now', 'Updated: Just Now')}</Text>
        </View>
      </ScrollView>
    </View>
  );
};

/* =====================================================
   STYLES
===================================================== */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  infoBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  toggleContainer: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  toggleActive: {
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  toggleTextActive: {
    color: '#111827',
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    borderRadius: 20,
    marginBottom: 16,
  },
  gaugeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  gaugeInnerText: {
    position: 'absolute',
    alignItems: 'center',
  },
  gaugeValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
  },
  gaugeLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  heroSummary: {
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  summarySub: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  tierContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  tierCard: {
    borderRadius: 20,
    padding: 20,
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tierNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  tierLevel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '600',
    marginTop: 4,
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  roadmapContent: {
    width: '100%',
  },
  roadmapProgress: {
    marginBottom: 16,
  },
  roadmapLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  roadmapLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  missionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  missionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  missionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  missionText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.95)',
    marginLeft: 8,
    fontWeight: '500',
  },
  maxTierBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: 10,
    borderRadius: 12,
    justifyContent: 'center',
  },
  maxTierText: {
    color: '#FFF',
    fontWeight: '700',
    marginLeft: 8,
    fontSize: 13,
  },
  pointsBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'center',
  },
  pointsNeeded: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },
  pointsLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 9,
    fontWeight: '800',
  },

  progressBarBg: {
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFF',
    borderRadius: 5,
    shadowColor: '#FFF',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  statCard: {
    width: (width - 48) / 2,
    backgroundColor: '#FFF',
    margin: 8,
    padding: 16,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 5,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginTop: 2,
  },
  insightSection: {
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  insightCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 8,
  },
  insightText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
    marginLeft: 12,
    lineHeight: 20,
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});

export default DriverPerformanceScreen;
