import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  ScrollView,
  RefreshControl,
  Image,
  Animated,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import AppStatusBar from '../../Components/AppStatusBar';
import { useSelector } from 'react-redux';
import { useAppTheme } from '../../context/ThemeContext';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useHaptic } from '../../hooks/useHaptic';
import { 
  useGetRideActivityQuery,
  useUpdateDriverScoreMutation,
  useGetDriverPerformanceQuery,
} from '../../service/driverApi';
import { RootState } from '../../redux/store';
import { 
  calculatePerformanceMetrics, 
  calculateOverallScore,
  getDynamicTips,
} from '../../utils/performanceUtils';
import { resolveImageUrl } from '../../utils/imageUtils';

const { width } = Dimensions.get('window');

// Shimmer skeleton placeholder
const SkeletonBox = ({ style, opacity }: { style?: any; opacity: any }) => (
  <Animated.View style={[{ backgroundColor: '#E5E7EB', borderRadius: 8 }, { opacity }, style]} />
);

const PerformanceSkeleton = ({ isDark, insets }: { isDark: boolean; insets: any }) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });
  const bgColor = isDark ? '#1F2937' : '#E5E7EB';

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#111827' : '#F4F6F9' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 12 }}>
        <SkeletonBox style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: bgColor }} opacity={opacity} />
        <SkeletonBox style={{ width: 160, height: 18, marginLeft: 16, backgroundColor: bgColor }} opacity={opacity} />
      </View>
      <View style={{ paddingHorizontal: 16 }}>
        {/* Hero card */}
        <SkeletonBox style={{ width: '100%', height: 140, borderRadius: 16, backgroundColor: isDark ? '#1E3A5F' : '#93B5F5', marginBottom: 12 }} opacity={opacity} />
        {/* Overall Performance card */}
        <SkeletonBox style={{ width: '100%', height: 130, borderRadius: 16, backgroundColor: bgColor, marginBottom: 12 }} opacity={opacity} />
        {/* Breakdown card */}
        <SkeletonBox style={{ width: '100%', height: 100, borderRadius: 16, backgroundColor: bgColor, marginBottom: 12 }} opacity={opacity} />
        {/* Tips card */}
        <SkeletonBox style={{ width: '100%', height: 80, borderRadius: 16, backgroundColor: isDark ? '#1E3A5F30' : '#E0E7FF', marginBottom: 12 }} opacity={opacity} />
      </View>
    </View>
  );
};

// Top gauge for Overall Performance — displays a 0–100 composite score
const SemiCircleGauge = ({ value, label }: { value: number; label: string }) => {
  const size = 120;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = Math.PI * radius;
  
  // Value is 0 to 100 (overall score percentage)
  const percentage = Math.min(Math.max(value, 0), 100);
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Color based on score
  const getGaugeColors = () => {
    if (percentage >= 90) return { start: '#10B981', end: '#34D399' }; // green
    if (percentage >= 80) return { start: '#2563EB', end: '#3B82F6' }; // blue
    if (percentage >= 70) return { start: '#F59E0B', end: '#FBBF24' }; // amber
    return { start: '#EF4444', end: '#F87171' }; // red
  };
  const colors = getGaugeColors();

  return (
    <View style={styles.gaugeContainer}>
      <Svg width={size} height={size / 2 + strokeWidth} viewBox={`0 0 ${size} ${size / 2 + strokeWidth}`}>
        <Defs>
          <SvgGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={colors.start} />
            <Stop offset="100%" stopColor={colors.end} />
          </SvgGradient>
        </Defs>
        <Path
          d={`M ${strokeWidth/2} ${size/2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth/2} ${size/2}`}
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d={`M ${strokeWidth/2} ${size/2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth/2} ${size/2}`}
          stroke="url(#gaugeGrad)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </Svg>
      <View style={styles.gaugeInnerText}>
        <Text style={styles.gaugeValue}>{value}</Text>
        <Text style={styles.gaugeLabel}>{label}</Text>
      </View>
    </View>
  );
};

const DriverPerformanceScreen = ({ navigation }: any) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isDark, theme } = useAppTheme();
  const { triggerHaptic } = useHaptic();
  
  const user = useSelector((state: RootState) => state.userSlice.user);
  const driverId = user?.driverId || '';
  const isFocused = useIsFocused();
  const [imgError, setImgError] = useState(false);
  const [showAllBreakdown, setShowAllBreakdown] = useState(false);
  const [backendPercentile, setBackendPercentile] = useState<number | null>(null);

  const [updateDriverScore, { isLoading: isUpdatingScore }] = useUpdateDriverScoreMutation();

  const [timeframe, setTimeframe] = useState<'week' | 'month'>('month');

  const getDatesForTimeframe = (selectedTimeframe: 'week' | 'month') => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - (selectedTimeframe === 'week' ? 7 : 30));
    return { 
      from: `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`, 
      to: `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, '0')}-${String(to.getDate()).padStart(2, '0')}` 
    };
  };

  const dateRange = useMemo(() => getDatesForTimeframe(timeframe), [timeframe]);

  const { data: activityResult, isLoading: isActivityLoading, refetch: refetchActivity } = useGetRideActivityQuery(
    { driverId, from: dateRange.from, to: dateRange.to },
    { skip: !driverId }
  );

  const { data: performanceResult, refetch: refetchPerformance } = useGetDriverPerformanceQuery(
    { driverId, period: timeframe },
    { skip: !driverId }
  );

  const dynamicMetrics = useMemo(() => {
    const raw = activityResult?.data;
    const normalizedRides = Array.isArray(raw)
      ? raw
      : (raw?.data || raw?.rides || raw?.trips || []);
    return calculatePerformanceMetrics(normalizedRides);
  }, [activityResult]);

  const truePerformance = performanceResult?.data;

  const rating = dynamicMetrics.rating > 0 ? dynamicMetrics.rating : (truePerformance?.rating || 0);
  const firstName = user?.first_name || user?.full_name?.split(' ')[0] || 'Driver';
  const acceptanceRate = dynamicMetrics.totalTrips > 0 ? dynamicMetrics.acceptanceRate : (truePerformance?.acceptanceRate ?? 0);
  const completionRate = dynamicMetrics.completionRate || 0;
  const totalRides = dynamicMetrics.totalTrips; // Strictly dynamic for the selected period
  const cancellationRate = dynamicMetrics.totalTrips > 0 ? dynamicMetrics.cancellationRate : (truePerformance?.cancellationRate ?? 0);
  const onTimeRate = dynamicMetrics.onTimeRate; // -1 means no data available

  // Overall composite score
  const overallScore = useMemo(() => calculateOverallScore(dynamicMetrics, t), [dynamicMetrics, t]);

  // Sync score to backend and get actual percentile
  React.useEffect(() => {
    if (driverId && overallScore.score > 0) {
      updateDriverScore({ id: driverId, score: overallScore.score, timeframe })
        .unwrap()
        .then((res) => {
          if (res?.data?.percentile !== undefined) {
            setBackendPercentile(res.data.percentile);
          }
        })
        .catch((err) => console.error('Failed to sync score:', err));
    }
  }, [driverId, overallScore.score, timeframe, updateDriverScore]);

  // Dynamic tips based on weakest metrics
  const tips = useMemo(() => getDynamicTips(dynamicMetrics, t), [dynamicMetrics, t]);

  // Dynamic greeting based on score
  const getGreeting = () => {
    if (overallScore.score >= 90) return t('greeting_excellent', 'Excellent Work, {{name}}! 🌟', { name: firstName });
    if (overallScore.score >= 80) return t('greeting_great', 'Great Job, {{name}}! 👍', { name: firstName });
    if (overallScore.score >= 70) return t('greeting_keep_going', 'Keep Going, {{name}}! 💪', { name: firstName });
    if (overallScore.score > 0) return t('greeting_can_do_better', 'You Can Do Better, {{name}}! 🚀', { name: firstName });
    return t('greeting_welcome', 'Welcome, {{name}}! 👋', { name: firstName });
  };

  const onRefresh = async () => {
    triggerHaptic(HapticFeedbackTypes.impactLight);
    await Promise.all([
      refetchActivity(),
      refetchPerformance(),
    ]);
  };

  // Show skeleton on first load (not on pull-to-refresh)
  if (isActivityLoading && dynamicMetrics.totalTrips === 0 && !activityResult) {
    return <PerformanceSkeleton isDark={isDark} insets={insets} />;
  }

  const getStatusText = (value: number, type: 'rating' | 'rate' | 'cancellation') => {
    if (type === 'rating') {
      if (value >= 4.8) return t('status_excellent', 'Excellent');
      if (value >= 4.5) return t('status_great', 'Great');
      return t('status_good', 'Good');
    } else if (type === 'rate') {
      if (value >= 95) return t('status_excellent', 'Excellent');
      if (value >= 90) return t('status_great', 'Great');
      return t('status_good', 'Good');
    } else {
      if (value <= 3) return t('status_good', 'Good');
      if (value <= 5) return t('status_fair', 'Fair');
      return t('status_poor', 'Poor');
    }
  };

  return (
    <View style={[styles.safeArea, { backgroundColor: isDark ? theme.colors.background : '#F4F6F9' }]}>
      {isFocused && <AppStatusBar />}
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: isDark ? theme.colors.background : '#F4F6F9' }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#111827'} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>{t('performance_screen_title', 'Driver Performance')}</Text>
        <Pressable style={styles.infoBtn}>
          <Ionicons name="help-circle-outline" size={24} color={isDark ? '#FFFFFF' : '#6B7280'} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isActivityLoading} onRefresh={onRefresh} tintColor="#2563EB" />
        }
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
      >
        {/* Top Blue Gradient Card */}
        <LinearGradient
          colors={['#2563EB', '#1D4ED8']}
          style={styles.heroCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.heroTop}>
            <View style={styles.profileSection}>
              <View style={styles.avatarContainer}>
                <View style={[styles.avatar, { justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }]}>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: '#0F172A' }}>
                    {firstName ? firstName.charAt(0).toUpperCase() : 'D'}
                  </Text>
                  {user?.profile_picture && user.profile_picture.trim() !== '' && !imgError && (
                    <Image 
                      source={{ uri: resolveImageUrl(user.profile_picture) }} 
                      style={{ width: '100%', height: '100%', position: 'absolute' }} 
                      onError={() => setImgError(true)}
                    />
                  )}
                </View>
                <View style={styles.badgeCheck}>
                  <Ionicons name="checkmark" size={12} color="#FFF" />
                </View>
              </View>
              <View style={styles.greetingSection}>
                <Text style={styles.greetingTitle}>{getGreeting()}</Text>
                <Text style={styles.greetingSub}>{overallScore.score > 0 ? t('score_text', 'Score: {{score}}/100 · {{label}}', { score: overallScore.score, label: overallScore.label }) : t('complete_rides_for_score', 'Complete rides to build your score')}</Text>
              </View>
            </View>
            <View style={styles.rightHeroIcons}>
              <View style={styles.shieldIconWrapper}>
                <Ionicons name="shield" size={48} color="rgba(255,255,255,0.2)" />
                <View style={{ position: 'absolute', top: 12 }}>
                  <Ionicons name="star" size={24} color="#60A5FA" />
                </View>
              </View>
            </View>
          </View>
          
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatItem}>
              <View style={styles.heroStatValueRow}>
                <Ionicons name="star" size={16} color="#FBBF24" />
                <Text style={styles.heroStatValue}>{rating.toFixed(1)}</Text>
              </View>
              <Text style={styles.heroStatLabel}>{t('rating_label', 'Rating')}</Text>
              <View style={styles.starsRowSmall}>
                {[1,2,3,4,5].map(i => (
                  <Ionicons key={i} name={i <= Math.round(rating) ? "star" : "star-outline"} size={10} color="#FBBF24" />
                ))}
              </View>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <View style={styles.heroStatValueRow}>
                <Ionicons name="cellular" size={16} color="#4ADE80" />
                <Text style={styles.heroStatValue}>{acceptanceRate}%</Text>
              </View>
              <Text style={styles.heroStatLabel}>{t('acceptance_rate_label_multiline', 'Acceptance\nRate')}</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <View style={styles.heroStatValueRow}>
                <Ionicons name="time" size={16} color="#C084FC" />
                <Text style={styles.heroStatValue}>{completionRate}%</Text>
              </View>
              <Text style={styles.heroStatLabel}>{t('completion_rate_label_multiline', 'Completion\nRate')}</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <View style={styles.heroStatValueRow}>
                <Ionicons name="ribbon" size={16} color="#FCA5A5" />
                <Text style={styles.heroStatValue}>{totalRides}</Text>
              </View>
              <Text style={styles.heroStatLabel}>{timeframe === 'month' ? t('total_rides_this_month', 'Total Rides\nThis Month') : t('total_rides_this_week', 'Total Rides\nThis Week')}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Overall Performance Card */}
        <View style={[styles.sectionCard, { backgroundColor: isDark ? theme.colors.card : '#FFF' }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>{t('overall_performance_title', 'Overall Performance')}</Text>
            <Pressable 
              style={[styles.sectionAction, { backgroundColor: isDark ? '#374151' : '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }]} 
              onPress={() => setTimeframe(t => t === 'month' ? 'week' : 'month')}
            >
              <Text style={[styles.sectionActionText, { color: isDark ? '#D1D5DB' : '#4B5563', marginRight: 4 }]}>
                {timeframe === 'month' ? t('this_month_action', 'This Month') : t('this_week_action', 'This Week')}
              </Text>
              <Ionicons name="swap-vertical" size={14} color={isDark ? '#D1D5DB' : '#6B7280'} />
            </Pressable>
          </View>
          
          <View style={styles.overallContent}>
            <SemiCircleGauge value={overallScore.score} label={overallScore.label} />
            
            <View style={styles.rankingSection}>
              {isUpdatingScore || backendPercentile === null ? (
                <View style={{ flex: 1, justifyContent: 'center' }}>
                  <SkeletonBox style={{ width: '80%', height: 16, marginBottom: 12, backgroundColor: isDark ? '#374151' : '#E5E7EB' }} opacity={new Animated.Value(0.7)} />
                  <SkeletonBox style={{ width: '100%', height: 24, backgroundColor: isDark ? '#374151' : '#E5E7EB' }} opacity={new Animated.Value(0.7)} />
                </View>
              ) : (
                <>
                  <Text style={[styles.rankingText, { color: isDark ? '#D1D5DB' : '#374151' }]}>
                    {backendPercentile > 0 ? (
                      <>{t('ranking_text_prefix', 'You are among the ')}<Text style={styles.rankingHighlight}>{t('ranking_highlight', 'top {{percent}}%', { percent: 100 - backendPercentile })}</Text>{t('ranking_text_suffix', ' drivers in your city')}</>
                    ) : (
                      t('no_ranking_yet', 'Complete more rides to see your ranking')
                    )}
                  </Text>
                  <View style={styles.percentileContainer}>
                    <View style={[styles.percentileBadgeWrapper, { right: `${100 - backendPercentile}%` }]}>
                      <View style={styles.percentileBadge}>
                        <Text style={styles.percentileBadgeText}>{backendPercentile}%</Text>
                      </View>
                      <View style={styles.percentileBadgeTriangle} />
                    </View>
                    <View style={[styles.percentileBarBg, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
                      <View style={[styles.percentileBarFill, { width: `${backendPercentile}%` }]} />
                    </View>
                    <View style={styles.percentileLabels}>
                      <Text style={styles.percentileLabel}>0%</Text>
                      <Text style={styles.percentileLabel}>50%</Text>
                      <Text style={styles.percentileLabel}>100%</Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>

        {/* Performance Breakdown */}
        <View style={[styles.sectionCard, { backgroundColor: isDark ? theme.colors.card : '#FFF' }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>{t('performance_breakdown_title', 'Performance Breakdown')}</Text>
            <Pressable style={styles.sectionAction} onPress={() => setShowAllBreakdown(!showAllBreakdown)}>
              <Text style={styles.sectionActionText}>{showAllBreakdown ? t('view_less_action', 'View Less') : t('view_all_action', 'View All')}</Text>
              <Ionicons name={showAllBreakdown ? 'chevron-up' : 'chevron-down'} size={16} color="#6B7280" />
            </Pressable>
          </View>

          <View style={styles.breakdownList}>
            <BreakdownItem
              icon="thumbs-up"
              iconColor="#10B981"
              title={t('rider_rating_title', 'Rider Rating')}
              subtitle={t('rider_rating_subtitle', 'Based on rider feedback')}
              value={`${rating.toFixed(1)} / 5.0`}
              status={getStatusText(rating, 'rating')}
              statusColor="#10B981"
              progress={rating / 5 * 100}
              isDark={isDark}
            />
            <BreakdownItem
              icon="checkmark"
              iconColor="#3B82F6"
              title={t('acceptance_rate_title', 'Acceptance Rate')}
              subtitle={t('acceptance_rate_subtitle', 'Rides you accepted')}
              value={`${acceptanceRate}%`}
              status={getStatusText(acceptanceRate, 'rate')}
              statusColor="#3B82F6"
              progress={acceptanceRate}
              isDark={isDark}
              isLast={!showAllBreakdown}
            />
            {showAllBreakdown && (
              <>
                <BreakdownItem
                  icon="flag"
                  iconColor="#8B5CF6"
                  title={t('completion_rate_title', 'Completion Rate')}
                  subtitle={t('completion_rate_subtitle', 'Rides you completed')}
                  value={`${completionRate}%`}
                  status={getStatusText(completionRate, 'rate')}
                  statusColor="#10B981"
                  progress={completionRate}
                  isDark={isDark}
                />
                <BreakdownItem
                  icon="time"
                  iconColor="#F97316"
                  title={t('on_time_rate_title', 'On-time Rate')}
                  subtitle={onTimeRate >= 0 ? t('on_time_rate_subtitle_maintained', 'Punctuality maintained') : t('data_not_available', 'Data not available yet')}
                  value={onTimeRate >= 0 ? `${onTimeRate}%` : 'N/A'}
                  status={onTimeRate >= 0 ? getStatusText(onTimeRate, 'rate') : t('status_pending', 'Pending')}
                  statusColor={onTimeRate >= 0 ? '#3B82F6' : '#9CA3AF'}
                  progress={onTimeRate >= 0 ? onTimeRate : 0}
                  isDark={isDark}
                />
                <BreakdownItem
                  icon="shield-checkmark"
                  iconColor="#EF4444"
                  title={t('cancellation_rate_title', 'Cancellation Rate')}
                  subtitle={t('cancellation_rate_subtitle', 'Rides you cancelled')}
                  value={`${cancellationRate}%`}
                  status={getStatusText(cancellationRate, 'cancellation')}
                  statusColor="#10B981"
                  progress={100 - cancellationRate}
                  isLast
                  isDark={isDark}
                />
              </>
            )}
          </View>
        </View>

        {/* Tips to Improve */}
        <View style={[styles.tipsCard, { backgroundColor: isDark ? '#1E3A8A20' : '#EEF2FF' }]}>
          <View style={styles.tipsHeaderRow}>
            <Ionicons name="megaphone" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} style={{ marginRight: 6 }} />
            <Text style={[styles.tipsTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>{t('tips_to_improve_title', 'Tips to Improve')}</Text>
          </View>
          <View style={styles.tipsContentRow}>
            <View style={styles.tipsList}>
              {tips.map((tip, index) => (
                <View key={index} style={styles.tipItem}>
                  <Ionicons name={tip.icon} size={14} color={tip.color} style={styles.tipIcon} />
                  <Text style={[styles.tipText, { color: isDark ? '#D1D5DB' : '#374151' }]}>{tip.text}</Text>
                </View>
              ))}
            </View>
            <View style={styles.tipsGraphic}>
              <Ionicons name="trending-up" size={32} color="#3B82F6" />
              <Ionicons name="trophy" size={24} color="#FBBF24" style={{ marginTop: -8, marginLeft: 16 }} />
            </View>
          </View>
        </View>
        
      </ScrollView>
    </View>
  );
};

const BreakdownItem = ({ icon, iconColor, title, subtitle, value, status, statusColor, progress, isLast, isDark }: any) => {
  return (
    <View style={[styles.breakdownItemContainer, !isLast && [styles.breakdownItemBorder, { borderBottomColor: isDark ? '#374151' : '#F3F4F6' }]]}>
      <View style={styles.breakdownItemRow}>
        <View style={[styles.breakdownIconWrapper, { backgroundColor: iconColor }]}>
          <Ionicons name={icon} size={18} color="#FFF" />
        </View>
        <View style={styles.breakdownTextContent}>
          <Text style={[styles.breakdownTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>{title}</Text>
          <Text style={[styles.breakdownSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>{subtitle}</Text>
        </View>
        <View style={styles.breakdownValueContent}>
          <Text style={[styles.breakdownValue, { color: isDark ? '#FFFFFF' : '#111827' }]}>{value}</Text>
          <View style={[styles.breakdownStatusBadge, { backgroundColor: statusColor + '15' }]}>
            <Text style={[styles.breakdownStatusText, { color: statusColor }]}>{status}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={isDark ? '#6B7280' : '#D1D5DB'} />
      </View>
      <View style={styles.breakdownProgressContainer}>
        <View style={[styles.breakdownProgressBg, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
          <View style={[styles.breakdownProgressFill, { width: `${progress}%`, backgroundColor: iconColor }]} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  infoBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  heroCard: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginHorizontal: -8,
    marginBottom: 12,
    shadowColor: '#2563EB',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    marginRight: 12,
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFF',
    backgroundColor: '#E5E7EB',
  },
  badgeCheck: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#10B981',
    borderRadius: 10,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  greetingSection: {
    flex: 1,
  },
  greetingTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  greetingSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    lineHeight: 16,
  },
  rightHeroIcons: {
    alignItems: 'flex-end',
  },

  shieldIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  heroStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  heroStatValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  heroStatValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 4,
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 12,
  },
  starsRowSmall: {
    flexDirection: 'row',
    marginTop: 4,
  },
  heroStatDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  sectionCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionActionText: {
    fontSize: 13,
    color: '#6B7280',
    marginRight: 2,
  },
  overallContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gaugeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginRight: 16,
  },
  gaugeInnerText: {
    position: 'absolute',
    alignItems: 'center',
    top: 25,
  },
  gaugeValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  starsRow: {
    flexDirection: 'row',
    marginVertical: 2,
  },
  gaugeLabel: {
    fontSize: 10,
    color: '#2563EB',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  rankingSection: {
    flex: 1,
    justifyContent: 'center',
  },
  rankingText: {
    fontSize: 12,
    color: '#374151',
    lineHeight: 16,
    marginBottom: 8,
  },
  rankingHighlight: {
    color: '#2563EB',
    fontWeight: '700',
  },
  percentileContainer: {
    width: '100%',
  },
  percentileBadgeWrapper: {
    position: 'absolute',
    top: -25,
    transform: [{ translateX: 15 }],
    alignItems: 'center',
  },
  percentileBadge: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  percentileBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  percentileBadgeTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#2563EB',
    transform: [{ rotate: '180deg' }],
  },
  percentileBarBg: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  percentileBarFill: {
    height: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 4,
  },
  percentileLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  percentileLabel: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  breakdownList: {
    marginTop: 4,
  },
  breakdownItemContainer: {
    marginBottom: 10,
  },
  breakdownItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 10,
  },
  breakdownItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  breakdownIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  breakdownTextContent: {
    flex: 1,
  },
  breakdownTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  breakdownSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  breakdownValueContent: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  breakdownStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  breakdownStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  breakdownProgressContainer: {
    paddingLeft: 48,
  },
  breakdownProgressBg: {
    height: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 2,
    overflow: 'hidden',
  },
  breakdownProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  tipsCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  tipsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  tipsContentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tipsList: {
    flex: 1,
    paddingRight: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  tipIcon: {
    marginTop: 2,
    marginRight: 6,
  },
  tipText: {
    fontSize: 12,
    color: '#374151',
    lineHeight: 16,
    flex: 1,
  },
  tipsGraphic: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default DriverPerformanceScreen;
