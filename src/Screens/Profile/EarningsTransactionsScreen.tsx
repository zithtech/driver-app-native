import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, StatusBar, Modal, RefreshControl } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../context/ThemeContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import { useGetEarningsTransactionsQuery, useGetEarningsSummaryQuery } from '../../service/driverApi';
import { startOfDay, startOfWeek, startOfMonth, endOfDay } from 'date-fns';

type FilterType = 'all' | 'today' | 'week' | 'month' | 'other';

const FILTER_OPTIONS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'other', label: 'Other' },
];

const EarningsTransactionsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useAppTheme();
  const user = useSelector((state: RootState) => state.userSlice.user);
  const driverId = user?.driverId || '';

  const [filterType, setFilterType] = useState<FilterType>('all');
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [pickingDate, setPickingDate] = useState<'start' | 'end' | null>(null);
  const [isManualRefresh, setIsManualRefresh] = useState(false);

  // Compute date range from filterType
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (filterType) {
      case 'today':
        return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
      case 'week':
        return { from: startOfWeek(now, { weekStartsOn: 1 }).toISOString(), to: endOfDay(now).toISOString() };
      case 'month':
        return { from: startOfMonth(now).toISOString(), to: endOfDay(now).toISOString() };
      case 'other':
        return {
          from: startDate ? startOfDay(startDate).toISOString() : undefined,
          to: endDate ? endOfDay(endDate).toISOString() : undefined,
        };
      default: // 'all'
        return { from: undefined, to: undefined };
    }
  }, [filterType, startDate, endDate]);

  const {
    data: transactionsResult,
    isLoading,
    refetch,
  } = useGetEarningsTransactionsQuery(
    { driverId, from: dateRange.from, to: dateRange.to },
    { skip: !driverId }
  );

  const {
    data: lifetimeSummaryResult,
  } = useGetEarningsSummaryQuery({ driverId }, { skip: !driverId });

  const lifetimeTotalCredits = lifetimeSummaryResult?.data?.totalEarnings || 0;

  const transactions: any[] = transactionsResult?.data || [];

  const onRefresh = useCallback(async () => {
    setIsManualRefresh(true);
    await refetch();
    setIsManualRefresh(false);
  }, [refetch]);

  // Group transactions by date string
  const groupedTransactions = useMemo(() => {
    const groups: { date: string; data: any[] }[] = [];
    const map = new Map<string, any[]>();
    transactions.forEach((tx: any) => {
      const dateKey = tx.date || 'Unknown';
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(tx);
    });
    map.forEach((data, date) => {
      groups.push({ date, data });
    });
    return groups;
  }, [transactions]);

  // Summary calculations
  const summary = useMemo(() => {
    let totalCredits = 0, totalDebits = 0, creditCount = 0, debitCount = 0;
    transactions.forEach((tx: any) => {
      if (tx.type === 'Credit') { totalCredits += Math.abs(tx.amount); creditCount++; }
      else { totalDebits += Math.abs(tx.amount); debitCount++; }
    });
    return { totalCredits, totalDebits, creditCount, debitCount, net: totalCredits - totalDebits, totalCount: transactions.length };
  }, [transactions]);

  const handleFilterSelect = (key: FilterType) => {
    if (key === 'other') {
      setFilterType('other');
      setIsFilterModalVisible(true);
    } else {
      setFilterType(key);
      setStartDate(null);
      setEndDate(null);
    }
  };

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') setPickingDate(null);
    if (date) {
      if (pickingDate === 'start') setStartDate(date);
      else setEndDate(date);
    }
    if (Platform.OS === 'ios') setPickingDate(null);
  };

  const handleTransactionPress = (tx: any) => {
    if (tx.source === 'ride' && tx.tripData) {
      navigation.navigate('RideDetailScreen', { ride: tx.tripData });
    } else if (tx.source === 'wallet' && tx.walletData) {
      navigation.navigate('TransactionDetailScreen', { transaction: tx.walletData });
    }
  };

  const getIconName = (tx: any) => {
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
    if (tx.type === 'Credit') return '#22C55E';
    if (tx.badge === 'Subscription') return '#3B82F6';
    if (tx.badge === 'Penalty') return '#EF4444';
    if (tx.badge === 'Fee') return '#EF4444';
    return '#64748B';
  };

  const getBgColor = (tx: any) => {
    if (tx.type === 'Credit') return isDark ? 'rgba(34,197,94,0.1)' : '#DCFCE7';
    if (tx.badge === 'Subscription') return isDark ? 'rgba(59,130,246,0.1)' : '#DBEAFE';
    if (tx.badge === 'Penalty' || tx.badge === 'Fee') return isDark ? 'rgba(239,68,68,0.1)' : '#FEE2E2';
    if (tx.badge === 'Incentive') return isDark ? 'rgba(245,158,11,0.1)' : '#FEF3C7';
    return isDark ? 'rgba(100,116,139,0.1)' : '#F1F5F9';
  };

  const getBadgeColor = (tx: any) => {
    if (tx.type === 'Credit') return '#22C55E';
    if (tx.badge === 'Incentive') return '#F59E0B';
    if (tx.badge === 'Subscription') return '#3B82F6';
    if (tx.badge === 'Penalty' || tx.badge === 'Fee') return '#EF4444';
    return '#3B82F6';
  };

  const filterLabel = filterType === 'all' ? 'All Time' : filterType === 'today' ? 'Today' : filterType === 'week' ? 'This Week' : filterType === 'month' ? 'This Month' : 'Custom Range';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: isDark ? '#1E293B' : '#E2E8F0' }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Transactions History</Text>
          <Text style={[styles.headerSub, { color: theme.colors.textMuted }]}>{filterLabel} · {transactions.length} transactions</Text>
        </View>
        <View style={styles.headerRightPlaceholder} />
      </View>

      {/* Filter Pills */}
      <View style={styles.filterPillsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsScroll}>
          {FILTER_OPTIONS.map((opt) => {
            const isActive = filterType === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => handleFilterSelect(opt.key)}
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
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Custom date range indicator */}
      {filterType === 'other' && (startDate || endDate) && (
        <View style={[styles.activeFilterContainer, { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : '#effcf4', borderColor: isDark ? 'rgba(34, 197, 94, 0.3)' : '#bbf7d0' }]}>
          <Text style={styles.activeFilterText}>
            {startDate ? startDate.toLocaleDateString() : 'Any'} to {endDate ? endDate.toLocaleDateString() : 'Any'}
          </Text>
          <Pressable onPress={() => { setStartDate(null); setEndDate(null); setFilterType('all'); }} hitSlop={10}>
            <Ionicons name="close-circle" size={20} color={isDark ? '#94A3B8' : '#64748b'} />
          </Pressable>
        </View>
      )}

      {pickingDate && (
        <DateTimePicker
          value={(pickingDate === 'start' ? startDate : endDate) || new Date()}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isManualRefresh} onRefresh={onRefresh} colors={['#3B82F6']} />}
      >
        {/* Summary Card */}
        <View style={[styles.summaryCard, { borderWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
          <View style={styles.summaryHeader}>
            <Text style={[styles.summaryTitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>Transaction Summary</Text>
            <Ionicons name="information-circle-outline" size={14} color={isDark ? '#94A3B8' : '#64748B'} />
          </View>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIconBox, { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : '#DCFCE7' }]}>
                <Ionicons name="wallet" size={14} color="#22C55E" />
              </View>
              <Text style={[styles.summaryLabel, { color: isDark ? '#CBD5E1' : '#475569' }]}>Total Credits (Lifetime)</Text>
              <Text style={[styles.summaryValue, { color: '#22C55E' }]}>₹ {lifetimeTotalCredits.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
            </View>

            <View style={styles.summaryItem}>
              <View style={[styles.summaryIconBox, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEE2E2' }]}>
                <Ionicons name="exit-outline" size={14} color="#EF4444" />
              </View>
              <Text style={[styles.summaryLabel, { color: isDark ? '#CBD5E1' : '#475569' }]}>Total Debits ({filterLabel})</Text>
              <Text style={[styles.summaryValue, { color: '#EF4444' }]}>- ₹ {summary.totalDebits.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
            </View>

            <View style={styles.summaryItem}>
              <View style={[styles.summaryIconBox, { backgroundColor: isDark ? 'rgba(168, 85, 247, 0.1)' : '#F3E8FF' }]}>
                <Ionicons name="calendar" size={14} color="#A855F7" />
              </View>
              <Text style={[styles.summaryLabel, { color: isDark ? '#CBD5E1' : '#475569' }]}>Credits ({filterLabel})</Text>
              <Text style={[styles.summaryValue, { color: theme.colors.text }]}>₹ {summary.totalCredits.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
            </View>
          </View>
        </View>

        {/* Empty State */}
        {!isLoading && transactions.length === 0 && (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <Ionicons name="receipt-outline" size={48} color="#CBD5E1" />
            <Text style={{ color: '#94A3B8', fontSize: 15, marginTop: 12 }}>No transactions found</Text>
            <Text style={{ color: '#CBD5E1', fontSize: 12, marginTop: 4 }}>Try changing the filter period</Text>
          </View>
        )}

        {/* Transactions List */}
        <View style={styles.listContainer}>
          {groupedTransactions.map((group) => (
            <View key={group.date} style={styles.groupContainer}>
              <Text style={[styles.groupDate, { color: isDark ? '#94A3B8' : '#64748B' }]}>{group.date}</Text>

              <View style={styles.groupBlock}>
                {group.data.map((tx: any, txIdx: number) => (
                  <Pressable
                    key={tx.id}
                    onPress={() => handleTransactionPress(tx)}
                    style={[
                      styles.txItem,
                      txIdx !== group.data.length - 1 && [styles.txBorder, { borderBottomColor: isDark ? '#1E293B' : '#F1F5F9' }]
                    ]}
                  >
                    <View style={styles.txLeftRow}>
                      <View style={[styles.txIconBox, { backgroundColor: getBgColor(tx) }]}>
                        <Ionicons name={getIconName(tx)} size={16} color={getIconColor(tx)} />
                      </View>
                      <View style={styles.txInfo}>
                        <Text style={[styles.txTitle, { color: theme.colors.text }]}>{tx.title}</Text>
                        <Text style={[styles.txSub, { color: isDark ? '#64748B' : '#94A3B8' }]}>{tx.subtitle}</Text>
                      </View>
                    </View>

                    <Text style={[styles.txTime, { color: isDark ? '#94A3B8' : '#64748B' }]}>{tx.time}</Text>

                    <View style={styles.txRightContainer}>
                      <View style={styles.txRightCol}>
                        <Text style={[styles.txAmount, { color: tx.type === 'Credit' ? '#22C55E' : '#EF4444' }]}>
                          {tx.type === 'Credit' ? '+' : '-'} ₹{Math.abs(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </Text>
                        <View style={[styles.txBadge, { backgroundColor: getBgColor(tx) }]}>
                          <Text style={[styles.txBadgeText, { color: getBadgeColor(tx) }]}>
                            {tx.badge}
                          </Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={isDark ? '#475569' : '#94A3B8'} />
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>

      </ScrollView>

      {/* Date Picker Modal for "Other" */}
      <Modal
        visible={isFilterModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsFilterModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setIsFilterModalVisible(false)} />
        <View style={[styles.modalSheet, { backgroundColor: isDark ? '#1F2937' : '#fff', paddingBottom: Math.max(insets.bottom + 20, 24) }]}>
          <View style={[styles.sheetIndicator, { backgroundColor: isDark ? '#374151' : '#cbd5e1' }]} />
          <View style={styles.sheetContent}>
            <Text style={[styles.sheetTitle, { color: isDark ? '#fff' : '#0f172a' }]}>Custom Date Range</Text>

            <View style={styles.dateRangeContainer}>
              <Pressable style={[styles.dateInput, { backgroundColor: isDark ? '#374151' : '#f1f5f9' }]} onPress={() => setPickingDate('start')}>
                <Text style={styles.dateLabel}>Start Date</Text>
                <Text style={[styles.dateValue, { color: isDark ? '#fff' : '#0f172a' }]}>{startDate ? startDate.toLocaleDateString() : 'Select Date'}</Text>
              </Pressable>

              <View style={styles.dateRangeDivider} />

              <Pressable style={[styles.dateInput, { backgroundColor: isDark ? '#374151' : '#f1f5f9' }]} onPress={() => setPickingDate('end')}>
                <Text style={styles.dateLabel}>End Date</Text>
                <Text style={[styles.dateValue, { color: isDark ? '#fff' : '#0f172a' }]}>{endDate ? endDate.toLocaleDateString() : 'Select Date'}</Text>
              </Pressable>
            </View>

            <View style={styles.filterActions}>
              <Pressable style={[styles.clearBtn, { borderColor: isDark ? '#374151' : '#e2e8f0' }]} onPress={() => { setStartDate(null); setEndDate(null); setFilterType('all'); setIsFilterModalVisible(false); }}>
                <Text style={[styles.clearBtnText, { color: isDark ? '#d1d5db' : '#475569' }]}>Clear</Text>
              </Pressable>
              <Pressable style={styles.applyBtn} onPress={() => setIsFilterModalVisible(false)}>
                <Text style={styles.applyBtnText}>Apply Filter</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
};

export default EarningsTransactionsScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerCenter: { alignItems: 'center' },
  backBtn: { padding: 4, width: 32 },
  headerRightPlaceholder: { width: 32 },
  headerTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  headerSub: { fontSize: 12, marginTop: 2, textAlign: 'center' },
  scrollContent: { paddingBottom: 40 },

  // Filter pills
  filterPillsContainer: { paddingVertical: 12 },
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

  // Summary
  summaryCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    padding: 12,
  },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  summaryTitle: { fontSize: 12, fontWeight: '500' },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  summaryItem: { flex: 1 },
  summaryIconBox: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  summaryLabel: { fontSize: 10, marginBottom: 2 },
  summaryValue: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  summarySub: { fontSize: 9 },

  // List
  listContainer: { paddingHorizontal: 16, gap: 16 },
  groupContainer: { gap: 8 },
  groupDate: { fontSize: 12, fontWeight: '500', marginLeft: 4 },
  groupBlock: { borderRadius: 12 },

  txItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4 },
  txBorder: { borderBottomWidth: 1 },
  txLeftRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1.8 },
  txIconBox: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  txInfo: { gap: 2 },
  txTitle: { fontSize: 12, fontWeight: '600' },
  txSub: { fontSize: 10 },

  txTime: { fontSize: 10, flex: 1, textAlign: 'center' },

  txRightContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1.2, justifyContent: 'flex-end' },
  txRightCol: { alignItems: 'flex-end', gap: 2 },
  txAmount: { fontSize: 12, fontWeight: '700' },
  txBadge: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  txBadgeText: { fontSize: 8, fontWeight: '700' },

  // Modal & Filter Styles
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, position: 'absolute', bottom: 0, width: '100%' },
  sheetIndicator: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  sheetContent: { paddingHorizontal: 24, paddingTop: 8 },
  sheetTitle: { fontSize: 20, fontWeight: '700', marginBottom: 20 },
  dateRangeContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  dateInput: { flex: 1, padding: 12, borderRadius: 12 },
  dateLabel: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  dateValue: { fontSize: 14, fontWeight: '600' },
  dateRangeDivider: { width: 12, height: 2, backgroundColor: '#cbd5e1', marginHorizontal: 8 },
  filterActions: { flexDirection: 'row', marginTop: 12 },
  clearBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderRadius: 12, marginRight: 12 },
  clearBtnText: { fontWeight: '600', fontSize: 15 },
  applyBtn: { flex: 2, backgroundColor: '#16a34a', paddingVertical: 14, alignItems: 'center', borderRadius: 12 },
  applyBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  activeFilterContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, marginBottom: 12 },
  activeFilterText: { fontSize: 13, color: '#16a34a', fontWeight: '600' },
});
