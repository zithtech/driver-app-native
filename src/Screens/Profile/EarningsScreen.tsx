import React, { useState, useCallback } from 'react';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useHaptic } from '../../hooks/useHaptic';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Dimensions,
  ImageBackground,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import { useGetEarningsSummaryQuery, useGetEarningsTransactionsQuery, useGetWalletBalanceQuery } from '../../service/driverApi';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useAppTheme } from '../../context/ThemeContext';
import AppStatusBar from '../../Components/AppStatusBar';
import { startOfDay, startOfWeek, startOfMonth } from 'date-fns';

// We import these but if it fails we might need to mock
import { LineChart, PieChart } from 'react-native-gifted-charts';

const { width } = Dimensions.get('window');

const EarningsScreen: React.FC<any> = ({ navigation }) => {
  const { theme, isDark } = useAppTheme();
  const user = useSelector((state: RootState) => state.userSlice.user);
  const { triggerHaptic } = useHaptic();
  const driverId = user?.driverId || '';
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();

  const [filterType, setFilterType] = useState<'today' | 'week' | 'month' | 'lifetime'>('lifetime');

  const dateRange = React.useMemo(() => {
    const now = new Date();
    switch (filterType) {
      case 'today':
        return { from: startOfDay(now).toISOString(), to: now.toISOString() };
      case 'week':
        return { from: startOfWeek(now, { weekStartsOn: 1 }).toISOString(), to: now.toISOString() };
      case 'month':
        return { from: startOfMonth(now).toISOString(), to: now.toISOString() };
      case 'lifetime':
      default:
        return { from: undefined, to: undefined };
    }
  }, [filterType]);

  // API Hooks
  const {
    data: summaryResult,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
  } = useGetEarningsSummaryQuery({ driverId, from: dateRange.from, to: dateRange.to }, { skip: !driverId });

  const {
    data: transactionsResult,
    isLoading: isTransactionsLoading,
    refetch: refetchTransactions,
  } = useGetEarningsTransactionsQuery({ driverId, from: dateRange.from, to: dateRange.to, limit: 5 }, { skip: !driverId });

  const {
    data: walletResult,
    isLoading: isWalletLoading,
    refetch: refetchWallet,
  } = useGetWalletBalanceQuery(driverId, { skip: !driverId });

  // Format decimal hours into "Xh Ym" string
  const formatHours = (decimalHours: number): string => {
    if (!decimalHours || decimalHours <= 0) return '0h 0m';
    const h = Math.floor(decimalHours);
    const m = Math.round((decimalHours - h) * 60);
    return `${h}h ${m}m`;
  };

  const summary = {
    total: summaryResult?.data?.totalEarnings || 0,
    trips: summaryResult?.data?.tripsCompleted || 0,
    hours: formatHours(summaryResult?.data?.onlineHours || 0),
    avgPerTrip: summaryResult?.data?.avgPerTrip || 0,
    tips: summaryResult?.data?.tips || 0,
    growthPercentage: summaryResult?.data?.growth?.earnings,
    growth: summaryResult?.data?.growth || {},
  };

  // Renders a small growth badge (arrow + %) or nothing if no data
  const renderGrowthBadge = (value?: number) => {
    if (value === undefined || value === null || filterType === 'lifetime') return null;
    const isPositive = value >= 0;
    return (
      <View style={styles.statGrowth}>
        <Ionicons name={isPositive ? 'arrow-up' : 'arrow-down'} size={10} color={isPositive ? '#16A34A' : '#EF4444'} />
        <Text style={[styles.statGrowthTextPos, !isPositive && { color: '#EF4444' }]}>{Math.abs(value).toFixed(1)}%</Text>
      </View>
    );
  };

  const walletBalance = walletResult?.data?.balance || 0;

  const transactions = transactionsResult?.data?.length ? transactionsResult.data.slice(0, 5) : [];

  const handleTransactionPress = (tx: any) => {
    triggerHaptic(HapticFeedbackTypes.impactLight);
    if (tx.source === 'ride' && tx.tripData) {
      navigation.navigate('RideDetailScreen', { ride: tx.tripData });
    } else if (tx.source === 'wallet' && tx.walletData) {
      navigation.navigate('TransactionDetailScreen', { transaction: tx.walletData });
    }
  };

  const isLoading = isSummaryLoading || isTransactionsLoading || isWalletLoading;
  const [isManualRefresh, setIsManualRefresh] = useState(false);

  const onRefresh = useCallback(async () => {
    triggerHaptic(HapticFeedbackTypes.impactLight);
    setIsManualRefresh(true);
    await Promise.all([refetchSummary(), refetchTransactions(), refetchWallet()]);
    setIsManualRefresh(false);
  }, [refetchSummary, refetchTransactions, refetchWallet, triggerHaptic]);

  const handleBack = () => {
    triggerHaptic(HapticFeedbackTypes.impactLight);
    navigation.goBack();
  };

  // Line Chart Data
  const lineData = summaryResult?.data?.chartData && summaryResult.data.chartData.length > 0 
    ? summaryResult.data.chartData 
    : [ { value: 0, label: '' }, { value: 0, label: '' } ]; // Safe fallback for empty chart

  const breakdown = summaryResult?.data?.earningsBreakdown || { baseFare: 0, extraTiming: 0, incentives: 0, tips: 0 };
  
  const calcPercent = (val: number, total: number) => {
    if (total === 0) return '0.0';
    return ((val / total) * 100).toFixed(1);
  };

  const hasBreakdownData = summary.total > 0;

  // Pie Chart Data (Donut)
  const pieData = hasBreakdownData ? [
    { value: breakdown.baseFare || 0.1, color: '#3B82F6', focused: true }, // Blue (Base Fare)
    { value: breakdown.extraTiming || 0.1, color: '#10B981' }, // Green (Extra Timing)
    { value: breakdown.incentives || 0.1, color: '#F59E0B' }, // Orange (Incentives)
    { value: breakdown.tips || 0.1, color: '#8B5CF6' }, // Purple (Tips)
  ] : [ { value: 1, color: '#E5E7EB' } ]; // Empty state

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Pressable onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </Pressable>
        <View style={{ marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Earnings</Text>
          <Text style={styles.headerSubtitle}>Track your income and trips</Text>
        </View>
      </View>
      <View style={styles.headerRight}>
        <Pressable style={styles.iconBtn} onPress={() => navigation.navigate('EarningsTransactionsScreen')}>
          <Ionicons name="time-outline" size={22} color="#111827" />
        </Pressable>
      </View>
    </View>
  );

  const renderHeroCard = () => (
    <LinearGradient colors={['#184BE1', '#061D6E']} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.heroCard}>
      <Image 
        source={require('../../assets/images/earningsbanner.png')} 
        style={styles.bannerImage}
        resizeMode="contain"
      />
      <View style={styles.heroTopRow}>
        <View style={styles.heroTopLeft}>
          <View style={styles.heroTitleRow}>
            <Text style={styles.heroTitle}>Total Earnings</Text>
          </View>
          
          <Text style={styles.heroAmount}>₹ {summary.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          
          {summary.growthPercentage !== undefined && filterType !== 'lifetime' ? (
            <View style={styles.heroVsRow}>
              <Text style={styles.heroSubText}>vs Last {filterType === 'today' ? 'Day' : filterType === 'week' ? 'Week' : 'Month'}</Text>
              <View style={[styles.percentBadge, { backgroundColor: summary.growthPercentage >= 0 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)' }]}>
                <Ionicons name={summary.growthPercentage >= 0 ? "arrow-up" : "arrow-down"} size={10} color={summary.growthPercentage >= 0 ? "#4ADE80" : "#F87171"} />
                <Text style={[styles.percentText, { color: summary.growthPercentage >= 0 ? "#4ADE80" : "#F87171" }]}>{Math.abs(summary.growthPercentage).toFixed(2)}%</Text>
              </View>
            </View>
          ) : (
            <View style={styles.heroVsRow}>
              <Text style={styles.heroSubText}>{filterType === 'lifetime' ? 'Lifetime Earnings' : filterType === 'today' ? 'Today' : filterType === 'week' ? 'This Week' : 'This Month'}</Text>
            </View>
          )}
        </View>
      </View>
      
      <View style={styles.heroBottomRow}>
        <Pressable style={styles.actionBox}>
          <Ionicons name="wallet-outline" size={20} color="#FFF" />
          <View style={styles.actionBoxTexts}>
            <Text style={styles.actionBoxLabel}>Available Balance</Text>
            <Text style={styles.actionBoxAmount}>₹ {walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#FFF" style={{ marginLeft: 8 }} />
        </Pressable>

        <View style={styles.filterPillsRow}>
          {(['lifetime', 'month', 'week', 'today'] as const).map(opt => (
            <Pressable 
              key={opt} 
              onPress={() => setFilterType(opt)} 
              style={[styles.filterPill, filterType === opt && styles.filterPillActive]}
            >
               <Text style={[styles.filterPillText, filterType === opt && styles.filterPillTextActive]}>
                 {opt === 'lifetime' ? 'All' : opt === 'month' ? '1M' : opt === 'week' ? '1W' : '1D'}
               </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </LinearGradient>
  );

  const renderStatsGrid = () => (
    <View>
      <View style={styles.overviewCard}>
        <View style={styles.overviewRow}>
        
        <View style={styles.overviewItem}>
          <View style={[styles.overviewIconBox, { backgroundColor: '#DCFCE7' }]}>
            <Text style={{fontSize: 14, fontWeight: 'bold', color: '#16A34A'}}>₹</Text>
          </View>
          <Text style={styles.overviewLabel} numberOfLines={2}>Total Earnings</Text>
          <Text style={styles.overviewValue}>₹{summary.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
          {renderGrowthBadge(summary.growth.earnings)}
        </View>

        <View style={styles.overviewDivider} />

        <View style={styles.overviewItem}>
          <View style={[styles.overviewIconBox, { backgroundColor: '#DBEAFE' }]}>
            <Ionicons name="car-outline" size={14} color="#2563EB" />
          </View>
          <Text style={styles.overviewLabel} numberOfLines={2}>Total Rides</Text>
          <Text style={styles.overviewValue}>{summary.trips}</Text>
          {renderGrowthBadge(summary.growth.trips)}
        </View>

        <View style={styles.overviewDivider} />

        <View style={styles.overviewItem}>
          <View style={[styles.overviewIconBox, { backgroundColor: '#F3E8FF' }]}>
            <Ionicons name="time-outline" size={14} color="#9333EA" />
          </View>
          <Text style={styles.overviewLabel} numberOfLines={2}>Total Hours</Text>
          <Text style={styles.overviewValue}>{summary.hours}</Text>
          {renderGrowthBadge(summary.growth.hours)}
        </View>

        <View style={styles.overviewDivider} />

        <View style={styles.overviewItem}>
          <View style={[styles.overviewIconBox, { backgroundColor: '#FFEDD5' }]}>
            <Ionicons name="star-outline" size={14} color="#EA580C" />
          </View>
          <Text style={styles.overviewLabel} numberOfLines={2}>Avg Earnings</Text>
          <Text style={styles.overviewValue}>₹{summary.avgPerTrip.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
          {renderGrowthBadge(summary.growth.avgPerTrip)}
        </View>
        
        </View>
      </View>
    </View>
  );

  const renderLineChart = () => (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle}>Earnings Trend</Text>
        <Pressable style={styles.dropdownButton}>
          <Text style={styles.dropdownText}>
            {filterType === 'today' ? 'Today' : filterType === 'week' ? 'This Week' : filterType === 'month' ? 'This Month' : 'All Time'}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#1E293B" />
        </Pressable>
      </View>
      <View style={{ marginTop: 8 }}>
        <LineChart
          areaChart
          data={lineData}
          width={width - 64}
          height={80}
          isAnimated
          animationDuration={1200}
          startFillColor="#3B82F6"
          endFillColor="#3B82F6"
          startOpacity={0.2}
          endOpacity={0.0}
          spacing={lineData.length > 1 ? (width - 80) / (lineData.length - 1) : width - 80}
          color="#3B82F6"
          thickness={3}
          hideRules
          hideYAxisText={false}
          yAxisTextStyle={{ color: '#9CA3AF', fontSize: 10 }}
          xAxisLabelTextStyle={{ color: '#9CA3AF', fontSize: 10, textAlign: 'center' }}
          yAxisColor="#E5E7EB"
          xAxisColor="#E5E7EB"
          yAxisLabelTexts={filterType === 'lifetime' ? ['0', '10K', '20K', '30K', '40K'] : ['0', '5k', '10k', '15k', '20k']}
          maxValue={filterType === 'lifetime' ? 40000 : 20000}
          noOfSections={4}
          dataPointsColor="#3B82F6"
          dataPointsRadius={4}
          pointerConfig={{
            pointerStripHeight: 120,
            pointerStripColor: '#E5E7EB',
            pointerStripWidth: 2,
            pointerColor: '#3B82F6',
            radius: 6,
            pointerLabelWidth: 80,
            pointerLabelHeight: 30,
            activatePointersOnLongPress: true,
            autoAdjustPointerLabelPosition: true,
            pointerLabelComponent: (items: any) => {
              return (
                <View style={styles.tooltipBox}>
                  <Text style={styles.tooltipText}>₹ {items[0].value.toLocaleString()}</Text>
                </View>
              );
            },
          }}
        />
      </View>
    </View>
  );

  const renderDonutChart = () => (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle}>Earnings Breakdown</Text>
        <Pressable>
          <Text style={styles.viewDetailsText}>View Details <Ionicons name="chevron-forward" size={12} /></Text>
        </Pressable>
      </View>
      
      <View style={styles.donutRow}>
        <View style={styles.donutContainer}>
          <PieChart
            data={pieData}
            donut
            radius={45}
            innerRadius={30}
            centerLabelComponent={() => {
              return (
                <View style={styles.donutCenter}>
                  <Text style={styles.donutCenterVal}>₹{summary.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                  <Text style={styles.donutCenterLabel}>Total</Text>
                </View>
              );
            }}
          />
        </View>
        
        <View style={styles.legendContainer}>
          <LegendItem color="#3B82F6" icon="car" title="Base Fare" amount={`₹ ${breakdown.baseFare.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} percent={`${calcPercent(breakdown.baseFare, summary.total)}%`} />
          <LegendItem color="#10B981" icon="time" title="Extra Timing" amount={`₹ ${breakdown.extraTiming.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} percent={`${calcPercent(breakdown.extraTiming, summary.total)}%`} />
          <LegendItem color="#F59E0B" icon="gift" title="Incentives" amount={`₹ ${breakdown.incentives.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} percent={`${calcPercent(breakdown.incentives, summary.total)}%`} />
          <LegendItem color="#8B5CF6" icon="heart" title="Tips" amount={`₹ ${breakdown.tips.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} percent={`${calcPercent(breakdown.tips, summary.total)}%`} />
        </View>
      </View>
    </View>
  );

  const getIconForTx = (tx: any) => {
    if (tx.icon === 'car') return 'car-outline';
    if (tx.icon === 'gift') return 'gift-outline';
    if (tx.icon === 'heart') return 'heart-outline';
    if (tx.icon === 'wallet') return 'wallet-outline';
    if (tx.icon === 'card') return 'card-outline';
    if (tx.icon === 'warning') return 'warning-outline';
    if (tx.icon === 'refresh') return 'refresh-outline';
    return 'cash-outline';
  };

  const getIconColor = (tx: any) => {
    if (tx.type === 'Credit') return '#16A34A';
    if (tx.badge === 'Subscription') return '#3B82F6';
    if (tx.badge === 'Penalty') return '#EF4444';
    return '#64748B';
  };

  const getBgColor = (tx: any) => {
    if (tx.type === 'Credit') return '#DCFCE7';
    if (tx.badge === 'Subscription') return '#EFF6FF';
    if (tx.badge === 'Penalty') return '#FEE2E2';
    if (tx.badge === 'Incentive') return '#FFEDD5';
    return '#F1F5F9';
  };

  const renderTransactions = () => (
    <View style={styles.transactionsContainer}>
      <View style={styles.txHeaderRow}>
        <Text style={styles.cardTitle}>Recent Transactions</Text>
        <Pressable onPress={() => navigation.navigate('EarningsTransactionsScreen')}>
          <Text style={styles.viewAllText}>View All</Text>
        </Pressable>
      </View>
      
      {transactions.length === 0 && (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <Ionicons name="receipt-outline" size={32} color="#CBD5E1" />
          <Text style={{ color: '#94A3B8', fontSize: 13, marginTop: 8 }}>No transactions yet</Text>
        </View>
      )}

      {transactions.map((tx: any, index: number) => (
        <Pressable key={tx.id} onPress={() => handleTransactionPress(tx)} style={[styles.txItem, index !== transactions.length - 1 && styles.txBorder]}>
          <View style={styles.txLeftRow}>
            <View style={[styles.txIconBox, { backgroundColor: getBgColor(tx) }]}>
              <Ionicons name={getIconForTx(tx)} size={16} color={getIconColor(tx)} />
            </View>
            <View style={styles.txInfo}>
              <Text style={styles.txTitle}>{tx.title}</Text>
              <Text style={styles.txDate}>{tx.date}, {tx.time}</Text>
            </View>
          </View>
          
          <View style={styles.txRightContainer}>
            <View style={styles.txRightCol}>
              <Text style={[styles.txAmount, { color: tx.type === 'Credit' ? '#16A34A' : '#EF4444' }]}>
                {tx.type === 'Credit' ? '+' : '-'} ₹{Math.abs(tx.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}
              </Text>
              <View style={[styles.txBadge, { backgroundColor: getBgColor(tx) }]}>
                <Text style={[styles.txBadgeText, { color: getIconColor(tx) }]}>
                  {tx.badge}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
          </View>
        </Pressable>
      ))}
    </View>
  );

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      {isFocused && <AppStatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />}
      {renderHeader()}
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isManualRefresh} onRefresh={onRefresh} colors={['#3B82F6']} />
        }
      >
        {renderHeroCard()}
        {renderStatsGrid()}
        {renderLineChart()}
        {renderDonutChart()}
        {renderTransactions()}
      </ScrollView>
    </View>
  );
};

// Subcomponent for Legend
const LegendItem = ({ color, title, amount, percent }: any) => (
  <View style={styles.legendRow}>
    <View style={styles.legendLeft}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendTitle}>{title}</Text>
    </View>
    <View style={styles.legendRightRow}>
      <Text style={styles.legendAmount}>{amount}</Text>
      <Text style={styles.legendPercent}>{percent}</Text>
    </View>
  </View>
);

export default EarningsScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { paddingBottom: 100 },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#111827' },
  headerSubtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  headerRight: { flexDirection: 'row', gap: 12 },
  iconBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1, borderColor: '#F1F5F9'
  },
  badgeContainer: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    width: 16, height: 16,
    justifyContent: 'center', alignItems: 'center',
    zIndex: 1,
  },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },

  // Hero Card
  heroCard: {
    margin: 16, borderRadius: 16,
    padding: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  bannerImage: {
    position: 'absolute',
    right: -45,
    top: -40,
    width: 260,
    height: 190,
    zIndex: 1,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', zIndex: 2 },
  heroTopLeft: { flex: 1 },
  heroTitleRow: { flexDirection: 'row', alignItems: 'center' },
  heroTitle: { color: '#FFF', fontSize: 11, fontWeight: '500' },
  heroAmount: { color: '#FFF', fontSize: 22, fontWeight: '700', marginTop: 0, marginBottom: 2 },
  heroVsRow: { flexDirection: 'row', alignItems: 'center' },
  heroSubText: { color: '#E0E7FF', fontSize: 11, marginRight: 8 },
  percentBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.25)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  percentText: { color: '#4ADE80', fontSize: 10, fontWeight: '700', marginLeft: 2 },
  
  heroTopRight: { width: 100, height: 80, justifyContent: 'center', alignItems: 'center' },
  
  heroBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, zIndex: 2 },
  actionBox: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8, paddingRight: 10 },
  actionBoxTexts: { marginLeft: 8 },
  actionBoxLabel: { color: '#E0E7FF', fontSize: 10 },
  actionBoxAmount: { color: '#FFF', fontSize: 12, fontWeight: '700', marginTop: 0 },
  
  filterPillsRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, padding: 2 },
  filterPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16 },
  filterPillActive: { backgroundColor: '#FFF' },
  filterPillText: { fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  filterPillTextActive: { color: '#184BE1' },



  // Earnings Overview
  overviewCard: { backgroundColor: '#FFF', marginHorizontal: 16, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 4, borderWidth: 1, borderColor: '#F1F5F9' },
  overviewRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  overviewItem: { flex: 1, alignItems: 'center', paddingHorizontal: 2 },
  overviewIconBox: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  overviewLabel: { fontSize: 9, color: '#64748B', marginBottom: 2, textAlign: 'center', lineHeight: 12 },
  overviewValue: { fontSize: 13, fontWeight: '700', color: '#1E1E2D', marginBottom: 2 },
  overviewDivider: { width: 1, height: 50, backgroundColor: '#F1F5F9', marginHorizontal: 2, marginTop: 8 },
  
  statGrowth: { flexDirection: 'row', alignItems: 'center' },
  statGrowthTextPos: { fontSize: 9, fontWeight: '600', color: '#16A34A', marginLeft: 2 },

  // Cards General
  card: { backgroundColor: '#FFF', marginHorizontal: 16, marginBottom: 16, borderRadius: 16, padding: 12 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  
  // Line Chart Header
  dropdownButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, gap: 4 },
  dropdownText: { fontSize: 11, color: '#1E293B', fontWeight: '600' },
  tooltipBox: { backgroundColor: '#3B82F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  tooltipText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  // Donut Chart
  viewDetailsText: { fontSize: 13, color: '#3B82F6', fontWeight: '500' },
  donutRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  donutContainer: { width: 90, height: 90, justifyContent: 'center', alignItems: 'center' },
  donutCenter: { alignItems: 'center', justifyContent: 'center' },
  donutCenterVal: { fontSize: 10, fontWeight: '700', color: '#111827' },
  donutCenterLabel: { fontSize: 9, color: '#6B7280' },
  legendContainer: { flex: 1, paddingLeft: 24, gap: 12 },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  legendLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, width: 100 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendTitle: { fontSize: 12, color: '#1E293B', fontWeight: '500' },
  legendRightRow: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'space-between' },
  legendAmount: { fontSize: 12, fontWeight: '600', color: '#111827' },
  legendPercent: { fontSize: 12, color: '#64748B', width: 45, textAlign: 'right' },

  // Transactions
  transactionsContainer: { marginHorizontal: 16, marginBottom: 16, backgroundColor: '#FFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  txHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  viewAllText: { fontSize: 12, color: '#3B82F6', fontWeight: '600' },
  txItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  txBorder: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  txLeftRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  txIconBox: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  txInfo: { gap: 2 },
  txTitle: { fontSize: 12, fontWeight: '600', color: '#111827' },
  txDate: { fontSize: 10, color: '#6B7280' },
  txRightContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  txRightCol: { alignItems: 'flex-end', gap: 2 },
  txAmount: { fontSize: 12, fontWeight: '700' },
  txBadge: { paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
  txBadgeText: { fontSize: 8, fontWeight: '700' }
});
