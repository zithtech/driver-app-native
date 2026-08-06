import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ImageBackground,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../../context/ThemeContext';
import AppStatusBar from '../../Components/AppStatusBar';
import { useGetSubscriptionHistoryQuery } from '../../service/userApi';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';

/* ================= HELPERS ================= */

const Skeleton = ({ width, height, style, isDark, borderRadius = 8 }: { width?: number | string, height?: number | string, style?: any, isDark?: boolean, borderRadius?: number }) => {
  const opacity = useSharedValue(0.3);
  React.useEffect(() => {
    opacity.value = withRepeat(withTiming(0.7, { duration: 800, easing: Easing.ease }), -1, true);
  }, [opacity]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ width, height, backgroundColor: isDark ? '#374151' : '#E2E8F0', borderRadius }, style, animatedStyle]} />;
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getBillingCycleLabel = (cycle: string) => {
  if (cycle === 'day') return 'Daily Subscription';
  if (cycle === 'week') return 'Weekly Subscription';
  if (cycle === 'month') return 'Monthly Subscription';
  return cycle;
};

const getStatusDisplay = (status: string) => {
  const s = status?.toLowerCase();
  if (s === 'active') return { label: 'Active', bg: '#E8F5E9', color: '#2E7D32' };
  if (s === 'expired') return { label: 'Expired', bg: '#F3F4F6', color: '#4B5563' };
  if (s === 'cancelled') return { label: 'Cancelled', bg: '#FEE2E2', color: '#DC2626' };
  return { label: status, bg: '#F3F4F6', color: '#4B5563' };
};

const getActionDisplay = (item: any) => {
  const s = item.status?.toLowerCase();
  if (s === 'active' && item.auto_renew) return { text: 'Auto-renewal ON', color: '#2E7D32', hasRefresh: true };
  if (s === 'active') return { text: 'Completed', color: '#2E7D32', hasRefresh: false };
  if (s === 'expired') return { text: 'Expired', color: '#DC2626', hasRefresh: false };
  if (s === 'cancelled') return { text: 'Cancelled', color: '#DC2626', hasRefresh: false };
  return { text: item.status, color: '#4B5563', hasRefresh: false };
};

const getPlanColors = (planName: string) => {
  const name = (planName || '').toLowerCase();
  if (name.includes('basic')) return { iconColor: '#2563EB', iconBg: '#EFF6FF' };
  if (name.includes('elite')) return { iconColor: '#10B981', iconBg: '#ECFDF5' };
  if (name.includes('premium')) return { iconColor: '#D97706', iconBg: '#FEF3C7' };
  return { iconColor: '#2E7D32', iconBg: '#E8F5E9' };
};

const getAmount = (item: any) => {
  const cycle = item.billing_cycle;
  if (cycle === 'day' && item.daily_price) return Number(item.daily_price);
  if (cycle === 'week' && item.weekly_price) return Number(item.weekly_price);
  if (cycle === 'month' && item.monthly_price) return Number(item.monthly_price);
  // Fallback: try to find the right price
  return Number(item.monthly_price || item.weekly_price || item.daily_price || 0);
};

const FILTERS = ['All', 'Active', 'Expired', 'Cancelled'];

/* ================= SCREEN ================= */

const SubscriptionHistoryScreen = ({ navigation }: any) => {
  const { isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState('All');

  const { data: historyData, isLoading, isFetching, refetch } = useGetSubscriptionHistoryQuery();

  const subscriptions = historyData?.data?.subscriptions || [];
  const totalSpent = historyData?.data?.totalSpent || 0;
  const totalCount = historyData?.data?.totalCount || 0;

  const [isRefreshing, setIsRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }, [refetch]);

  const filteredData = useMemo(() => {
    return subscriptions.filter((item: any) => {
      if (activeFilter === 'All') return true;
      return item.status?.toLowerCase() === activeFilter.toLowerCase();
    });
  }, [subscriptions, activeFilter]);

  const renderHeader = () => (
    <View>
      <ImageBackground
        source={require('../../assets/images/subhis.png')}
        style={[styles.headerBackground, { paddingTop: 10 }]}
        imageStyle={styles.headerImageStyle}
      >
        <View style={styles.headerTop}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </Pressable>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Subscription History</Text>
            <Text style={styles.headerSubtitle}>
              Track your all subscription plans and{'\n'}payments
            </Text>
          </View>
        </View>
      </ImageBackground>

      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <View style={[styles.statIconWrap, { backgroundColor: '#E8F5E9' }]}>
            <Ionicons name="calendar-outline" size={24} color="#2E7D32" />
          </View>
          <View style={styles.statTextWrap}>
            <Text style={styles.statLabel}>Total Subscriptions</Text>
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
              {String(totalCount).padStart(2, '0')}
            </Text>
            <Text style={styles.statTime}>All time</Text>
          </View>
        </View>
        
        <View style={styles.statDivider} />
        
        <View style={styles.statItem}>
          <View style={[styles.statIconWrap, { backgroundColor: '#E8F5E9' }]}>
            <MaterialCommunityIcons name="currency-inr" size={24} color="#2E7D32" />
          </View>
          <View style={styles.statTextWrap}>
            <Text style={styles.statLabel}>Total Spent</Text>
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
              ₹{Number(totalSpent).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <Text style={styles.statTime}>All time</Text>
          </View>
        </View>
      </View>

      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <View style={styles.filterContainer}>
            {FILTERS.map((filter) => {
              const isActive = activeFilter === filter;
              let iconName = 'grid-outline';
              if (filter === 'Active') iconName = 'play-outline';
              if (filter === 'Expired') iconName = 'time-outline';
              if (filter === 'Cancelled') iconName = 'close-circle-outline';
              
              return (
                <Pressable
                  key={filter}
                  style={[
                    styles.filterChip,
                    isActive ? styles.filterChipActive : styles.filterChipInactive
                  ]}
                  onPress={() => setActiveFilter(filter)}
                >
                  <Ionicons 
                    name={iconName} 
                    size={14} 
                    color={isActive ? '#FFF' : '#4B5563'} 
                    style={{ marginRight: 6 }} 
                  />
                  <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                    {filter}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          
          <Pressable style={styles.filterButtonRight}>
            <Ionicons name="filter-outline" size={16} color="#2E7D32" style={{ marginRight: 4 }} />
            <Text style={styles.filterButtonRightText}>Filter</Text>
          </Pressable>
        </ScrollView>
      </View>
    </View>
  );

  const renderFooter = () => (
    <View style={styles.footerCard}>
      <View style={styles.footerIconWrap}>
        <Ionicons name="shield-checkmark" size={24} color="#FFFFFF" />
      </View>
      <View style={styles.footerTextWrap}>
        <Text style={styles.footerTitle}>All payments are 100% secure</Text>
        <Text style={styles.footerSubtitle}>We protect your data and ensure safe transactions.</Text>
      </View>
      <Pressable style={styles.learnMoreBtn}>
        <Text style={styles.learnMoreText}>Learn More</Text>
      </Pressable>
    </View>
  );

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={{ paddingHorizontal: 16 }}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={[styles.listItem, { marginHorizontal: 0 }]}>
              <Skeleton width={56} height={56} borderRadius={12} isDark={isDark} />
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Skeleton width={120} height={16} isDark={isDark} style={{ marginBottom: 8 }} />
                <Skeleton width={160} height={12} isDark={isDark} style={{ marginBottom: 6 }} />
                <Skeleton width={140} height={12} isDark={isDark} />
              </View>
              <Skeleton width={70} height={18} isDark={isDark} />
            </View>
          ))}
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Ionicons name="receipt-outline" size={56} color="#cbd5e1" />
        <Text style={styles.emptyText}>No subscriptions found</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#111827' : '#F9FAFB' }]} edges={['top']}>
      <AppStatusBar backgroundColor={isDark ? '#111827' : '#F9FAFB'} barStyle={isDark ? 'light-content' : 'dark-content'} />
      <FlatList
        data={filteredData}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={filteredData.length > 0 ? renderFooter : undefined}
        ListEmptyComponent={renderEmpty}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => {
          const planColors = getPlanColors(item.plan_name);
          const statusDisplay = getStatusDisplay(item.status);
          const actionDisplay = getActionDisplay(item);
          const amount = getAmount(item);

          return (
            <Pressable 
              style={styles.listItem}
              onPress={() => navigation.navigate('SubscriptionDetailScreen', { item })}
            >
              <View style={[styles.listIconWrap, { backgroundColor: planColors.iconBg }]}>
                <MaterialCommunityIcons name="crown" size={32} color={planColors.iconColor} />
              </View>
              <View style={styles.listContent}>
                <View style={styles.listRow}>
                  <View style={styles.planTitleRow}>
                    <Text style={styles.planTitle}>
                      {(item.plan_name || '').charAt(0).toUpperCase() + (item.plan_name || '').slice(1)} Plan
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusDisplay.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: statusDisplay.color }]}>{statusDisplay.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.planPrice}>
                    ₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.listRow}>
                  <View>
                    <Text style={styles.billingCycle}>{getBillingCycleLabel(item.billing_cycle)}</Text>
                    <View style={styles.dateRow}>
                      <Ionicons name="calendar-outline" size={12} color="#6B7280" />
                      <Text style={styles.dateRange}>
                        {formatDate(item.start_date)} - {formatDate(item.expiry_date)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.actionRow}>
                    <Text style={[styles.actionText, { color: actionDisplay.color }]}>{actionDisplay.text}</Text>
                    {actionDisplay.hasRefresh && (
                      <Ionicons name="sync" size={12} color={actionDisplay.color} style={{ marginLeft: 4 }} />
                    )}
                    <Ionicons name="chevron-forward" size={16} color="#9CA3AF" style={{ marginLeft: 8 }} />
                  </View>
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
};

export default SubscriptionHistoryScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBackground: { width: '100%', paddingBottom: 40, backgroundColor: '#FFFFFF' },
  headerImageStyle: { opacity: 0.9, resizeMode: 'cover' },
  headerTop: { flexDirection: 'row', paddingHorizontal: 16, alignItems: 'flex-start' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, marginTop: 4 },
  headerTitleContainer: { marginLeft: 16, flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 4 },
  headerSubtitle: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  
  statsCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', marginHorizontal: 16, borderRadius: 16, padding: 16, marginTop: -20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 4 },
  statItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  statIconWrap: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  statTextWrap: { flex: 1 },
  statLabel: { fontSize: 11, color: '#6B7280', fontWeight: '500', marginBottom: 2 },
  statValue: { fontSize: 20, color: '#2E7D32', fontWeight: '700', marginBottom: 2 },
  statTime: { fontSize: 11, color: '#9CA3AF' },
  statDivider: { width: 1, backgroundColor: '#F3F4F6', marginHorizontal: 16 },

  filterSection: { marginTop: 24, paddingBottom: 16 },
  filterScroll: { paddingHorizontal: 16, alignItems: 'center' },
  filterContainer: { flexDirection: 'row', alignItems: 'center' },
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, marginRight: 8, borderWidth: 1 },
  filterChipActive: { backgroundColor: '#2E7D32', borderColor: '#2E7D32' },
  filterChipInactive: { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' },
  filterChipText: { fontSize: 13, fontWeight: '500', color: '#4B5563' },
  filterChipTextActive: { color: '#FFFFFF' },
  filterButtonRight: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#2E7D32', backgroundColor: '#FFFFFF', marginLeft: 8 },
  filterButtonRightText: { fontSize: 13, fontWeight: '600', color: '#2E7D32' },

  listItem: { flexDirection: 'row', backgroundColor: '#FFFFFF', marginHorizontal: 16, marginBottom: 12, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 2, borderWidth: 1, borderColor: '#F3F4F6' },
  listIconWrap: { width: 56, height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  listContent: { flex: 1 },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  planTitleRow: { flexDirection: 'row', alignItems: 'center' },
  planTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginRight: 8 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusBadgeText: { fontSize: 10, fontWeight: '600' },
  planPrice: { fontSize: 15, fontWeight: '700', color: '#111827' },
  billingCycle: { fontSize: 13, color: '#6B7280', marginBottom: 4 },
  dateRow: { flexDirection: 'row', alignItems: 'center' },
  dateRange: { fontSize: 11, color: '#6B7280', marginLeft: 4 },
  actionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  actionText: { fontSize: 11, fontWeight: '600' },
  
  footerCard: { flexDirection: 'row', backgroundColor: '#F0FDF4', marginHorizontal: 16, marginTop: 12, marginBottom: 24, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#DCFCE7' },
  footerIconWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#4ADE80', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  footerTextWrap: { flex: 1 },
  footerTitle: { fontSize: 12, fontWeight: '700', color: '#111827', marginBottom: 2 },
  footerSubtitle: { fontSize: 10, color: '#4B5563' },
  learnMoreBtn: { borderWidth: 1, borderColor: '#2E7D32', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  learnMoreText: { fontSize: 11, fontWeight: '600', color: '#2E7D32' },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { marginTop: 12, fontSize: 15, color: '#94a3b8', fontWeight: '500' },
});
