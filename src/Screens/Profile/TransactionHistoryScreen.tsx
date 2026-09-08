import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Share,
  Platform,
  Modal,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useIsFocused } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { RootState } from '../../redux/store';
import { useGetWalletBalanceQuery, useGetWalletTransactionsQuery } from '../../service/driverApi';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import AppStatusBar from '../../Components/AppStatusBar';
import { useAppTheme } from '../../context/ThemeContext';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { trigger } from 'react-native-haptic-feedback';

const Skeleton = ({ width, height, style, isDark, borderRadius = 8 }: { width?: number | string, height?: number | string, style?: any, isDark?: boolean, borderRadius?: number }) => {
  const opacity = useSharedValue(0.3);
  React.useEffect(() => {
    opacity.value = withRepeat(withTiming(0.7, { duration: 800, easing: Easing.ease }), -1, true);
  }, [opacity]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ width, height, backgroundColor: isDark ? '#374151' : '#E2E8F0', borderRadius }, style, animatedStyle]} />;
};

type TransactionType = 'INCENTIVE' | 'PENALTY' | 'REFERRAL_BONUS' | 'WALLET_TOPUP' | 'REFUND';

const getTransactionIcon = (type: TransactionType, title: string = '', amount: number = 0) => {
  const lowerTitle = title.toLowerCase();
  if (type === 'WALLET_TOPUP' || lowerTitle.includes('added to wallet') || lowerTitle.includes('topup')) return { name: 'wallet', color: '#16a34a', bg: '#dcfce7' };
  if (lowerTitle.includes('subscription')) return { name: 'document-text-outline', color: '#7c3aed', bg: '#f3e8ff' };
  if (type === 'REFERRAL_BONUS' || lowerTitle.includes('referral') || lowerTitle.includes('bonus')) return { name: 'trophy-outline', color: '#d97706', bg: '#fef9c3' };
  if (lowerTitle.includes('refund') || type === 'REFUND') return { name: 'arrow-undo-outline', color: '#ef4444', bg: '#fee2e2' };
  if (amount < 0) return { name: 'wallet', color: '#ef4444', bg: '#fee2e2' };
  return { name: 'pricetag-outline', color: '#475569', bg: '#f1f5f9' };
};

const getTransactionSubtitle = (type: TransactionType, title: string, item: any) => {
  if (item.subtitle) return item.subtitle;
  const lowerTitle = title.toLowerCase();
  
  if (type === 'WALLET_TOPUP' || lowerTitle.includes('added to wallet') || lowerTitle.includes('topup')) {
     if (item.paymentMethod) return `Paid via ${item.paymentMethod}`;
     if (lowerTitle.includes('via')) {
         const method = title.split(/via/i)[1].trim();
         return method ? `Paid via ${method}` : 'Razorpay';
     }
     return 'Razorpay';
  }
  if (lowerTitle.includes('subscription')) return 'Premium Plan - 7 Days';
  if (type === 'REFERRAL_BONUS' || lowerTitle.includes('referral') || lowerTitle.includes('bonus')) return 'Referral ID: REF12345';
  if (lowerTitle.includes('refund') || type === 'REFUND') return 'Trip ID: #TRP12340';
  return item.description || null;
};

const getTransactionTitle = (type: TransactionType, title: string) => {
  const lowerTitle = title.toLowerCase();
  if (type === 'WALLET_TOPUP' || lowerTitle.includes('added to wallet') || lowerTitle.includes('topup')) return 'Added to Wallet';
  if (lowerTitle.includes('subscription')) return 'Subscription Plan';
  if (type === 'REFERRAL_BONUS' || lowerTitle.includes('referral') || lowerTitle.includes('bonus')) return 'Referral Bonus';
  if (lowerTitle.includes('refund')) return 'Refund Received';
  return title;
};

const TransactionHistoryScreen = ({ navigation }: any) => {
  const { isDark } = useAppTheme();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [pickingDate, setPickingDate] = useState<'start' | 'end' | null>(null);
  const user = useSelector((state: RootState) => state.userSlice.user);
  const driverId = user?.driverId || '';
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();

  const { data: balanceResult, refetch: refetchBalance, isFetching: isBalanceFetching } = useGetWalletBalanceQuery(driverId, { skip: !driverId });
  const { data: transactionsResult, refetch: refetchTransactions, isFetching: isTransactionsFetching } = useGetWalletTransactionsQuery({ driverId }, { skip: !driverId });

  const balance = balanceResult?.data?.balance || 0;
  const transactions = transactionsResult?.data || [];
  
  const transactionsWithBalance = useMemo(() => {
    let currentBal = balance;
    return transactions.map((item: any) => {
      const closingBalance = currentBal;
      currentBal = currentBal - item.amount;
      return { ...item, closingBalance };
    });
  }, [transactions, balance]);

  const filteredTransactions = useMemo(() => {
    if (!startDate && !endDate) return transactionsWithBalance;
    
    return transactionsWithBalance.filter((item: any) => {
      // Use createdAt for reliable parsing, fallback to date
      const txDate = new Date(item.createdAt || item.date);
      if (isNaN(txDate.getTime())) return true;
      
      txDate.setHours(0, 0, 0, 0);
      const start = startDate ? new Date(startDate) : null;
      if (start) start.setHours(0, 0, 0, 0);
      const end = endDate ? new Date(endDate) : null;
      if (end) end.setHours(23, 59, 59, 999);

      if (start && txDate < start) return false;
      if (end && txDate > end) return false;
      
      return true;
    });
  }, [transactionsWithBalance, startDate, endDate]);

  const isLoading = (isBalanceFetching || isTransactionsFetching) && (!balanceResult && !transactionsResult);

  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [isFilterVisible, setIsFilterVisible] = useState(false);


  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([refetchBalance(), refetchTransactions()]);
    setIsRefreshing(false);
  }, [refetchBalance, refetchTransactions]);

  const openTransactionDetails = (item: any) => {
    navigation.navigate('TransactionDetailScreen', { transaction: item });
  };

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setPickingDate(null);
    }
    if (date) {
      if (pickingDate === 'start') {
        setStartDate(date);
      } else {
        setEndDate(date);
      }
    }
    if (Platform.OS === 'ios') {
       // Allow iOS compact picker to stay open until user taps away
       setPickingDate(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f8fafc' }]}>
      {isFocused && <AppStatusBar backgroundColor="transparent" barStyle={isDark ? "light-content" : "dark-content"} />}
      
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: isDark ? '#1F2937' : 'transparent' }]}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={isDark ? "#ffffff" : "#0f172a"} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: isDark ? "#ffffff" : "#0f172a" }]}>Transaction History</Text>
        </View>
        <Pressable onPress={() => setIsFilterVisible(true)} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
          <Ionicons name="filter" size={22} color={(startDate || endDate) ? "#16a34a" : (isDark ? "#ffffff" : "#0f172a")} />
        </Pressable>
      </View>

      {(startDate || endDate) && (
        <View style={styles.activeFilterContainer}>
          <Text style={styles.activeFilterText}>
            {startDate ? startDate.toLocaleDateString() : 'Any'} to {endDate ? endDate.toLocaleDateString() : 'Any'}
          </Text>
          <Pressable onPress={() => { setStartDate(null); setEndDate(null); }} hitSlop={10}>
            <Ionicons name="close-circle" size={20} color="#64748b" />
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


      <FlatList
        style={{ marginTop: (startDate || endDate) ? 6 : 12 }}
        data={filteredTransactions}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingTop: 12 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => {
          const iconConfig = getTransactionIcon(item.type, item.title, item.amount);
          const isPositive = item.amount > 0;
          const subtitle = getTransactionSubtitle(item.type, item.title, item);
          const txDate = new Date(item.createdAt || item.date || Date.now());
          const displayDate = txDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
          const displayTime = txDate.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
          return (
            <Pressable onPress={() => openTransactionDetails(item)} style={[styles.txnItem, { backgroundColor: 'transparent', borderColor: isDark ? '#374151' : '#cbd5e1' }]}>
              <View style={[styles.txnIconWrap, { backgroundColor: isDark ? '#374151' : iconConfig.bg }]}>
                {iconConfig.name === 'wallet' ? (
                  <View style={{ width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="wallet-outline" size={18} color={iconConfig.color} />
                    <View style={{ position: 'absolute', top: -3, right: -3, backgroundColor: iconConfig.bg, borderRadius: 10, width: 10, height: 10, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={isPositive ? "add" : "remove"} size={10} color={iconConfig.color} />
                    </View>
                  </View>
                ) : (
                  <Ionicons name={iconConfig.name} size={18} color={iconConfig.color} />
                )}
              </View>
              
              <View style={[styles.txnContent, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <View style={styles.txnInfo}>
                  <Text style={[styles.txnItemTitle, { color: isDark ? '#ffffff' : '#0f172a' }]} numberOfLines={1}>{getTransactionTitle(item.type, item.title)}</Text>
                  {subtitle && <Text style={[styles.txnItemSubtitle, { color: isDark ? '#9ca3af' : '#64748b' }]} numberOfLines={1}>{subtitle}</Text>}
                  <Text style={[styles.txnItemDate, { color: isDark ? '#9ca3af' : '#64748b' }]}>{displayDate}, {displayTime}</Text>
                </View>
                
                <View style={[styles.txnRightContent, { alignItems: 'flex-end', justifyContent: 'center' }]}>
                  <Text style={[styles.txnItemAmount, { color: isPositive ? '#16a34a' : '#ef4444' }]}>
                    {isPositive ? '+' : '-'} {`\u20B9`}{Math.abs(item.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}
                  </Text>
                  <Text style={[styles.txnItemBalance, { color: isDark ? '#64748b' : '#64748b' }]}>
                    Balance: {`\u20B9`}{item.closingBalance.toLocaleString('en-IN', {minimumFractionDigits: 2})}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#94a3b8" style={{ marginLeft: 8 }} />
            </Pressable>
          );
        }}
        ListEmptyComponent={
          isLoading ? (
            <View>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <View key={i} style={styles.txnItem}>
                  <Skeleton width={44} height={44} borderRadius={22} isDark={isDark} />
                  <View style={styles.txnInfo}>
                    <Skeleton width={120} height={16} isDark={isDark} style={{ marginBottom: 6 }} />
                    <Skeleton width={80} height={12} isDark={isDark} />
                  </View>
                  <Skeleton width={60} height={20} isDark={isDark} />
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={56} color="#cbd5e1" />
              <Text style={styles.emptyText}>No recent transactions</Text>
            </View>
          )
        }
      />

      <Modal
        visible={isFilterVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsFilterVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setIsFilterVisible(false)} />
        <View style={[styles.modalSheet, { backgroundColor: isDark ? '#1F2937' : '#fff' }]}>
          <View style={[styles.sheetIndicator, { backgroundColor: isDark ? '#374151' : '#cbd5e1', alignSelf: 'center', marginTop: 12, marginBottom: 8, height: 4, borderRadius: 2 }]} />
          <View style={styles.sheetContent}>
            <Text style={[styles.sheetTitle, { color: isDark ? '#fff' : '#0f172a' }]}>Filter by Date</Text>
            
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
              <Pressable style={[styles.clearBtn, { borderColor: isDark ? '#374151' : '#e2e8f0' }]} onPress={() => { setStartDate(null); setEndDate(null); setIsFilterVisible(false); }}>
                <Text style={[styles.clearBtnText, { color: isDark ? '#d1d5db' : '#475569' }]}>Clear</Text>
              </Pressable>
              <Pressable style={styles.applyBtn} onPress={() => setIsFilterVisible(false)}>
                <Text style={styles.applyBtnText}>Apply Filter</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
};

export default TransactionHistoryScreen;

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    position: 'absolute',
    bottom: 0,
    width: '100%',
  },
  container: { flex: 1, backgroundColor: '#fdfdfd' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  activeFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#effcf4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginTop: 8,
  },
  activeFilterText: {
    fontSize: 13,
    color: '#16a34a',
    fontWeight: '600',
  },
  txnItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
  },
  txnIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txnContent: {
    flex: 1,
    marginLeft: 12,
  },
  txnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  txnInfo: {
    flex: 1,
    paddingRight: 8,
  },
  txnRightContent: {
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    paddingTop: 4,
  },
  txnItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  txnItemSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2,
  },
  txnItemDate: {
    fontSize: 10,
    color: '#94a3b8',
  },
  txnItemAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  txnItemBalance: {
    fontSize: 10,
    color: '#64748b',
  },
  sheetContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    flex: 1,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
  },
  dateRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  dateInput: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
  },
  dateLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  dateRangeDivider: {
    width: 12,
    height: 2,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 8,
  },
  filterActions: {
    flexDirection: 'row',
    marginTop: 'auto',
    marginBottom: 24,
  },
  clearBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    marginRight: 12,
  },
  clearBtnText: {
    fontWeight: '600',
    fontSize: 15,
  },
  applyBtn: {
    flex: 2,
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
  },
  applyBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
    color: '#94a3b8',
    fontWeight: '500',
  },
  sheetBackground: { backgroundColor: '#fff', borderRadius: 24 },
  sheetIndicator: { width: 40, backgroundColor: '#cbd5e1' },
  txnIconWrapLarge: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  txnDetailsHeader: { alignItems: 'center', marginBottom: 24 },
  txnDetailsTitle: { fontSize: 20, fontWeight: '700', marginTop: 16, marginBottom: 4, textAlign: 'center' },
  txnDetailsAmount: { fontSize: 28, fontWeight: '800', marginBottom: 12 },
  txnDetailsStatus: { backgroundColor: '#dcfce7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  txnDetailsStatusText: { color: '#16a34a', fontSize: 13, fontWeight: '600' },
  txnDetailsCard: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0', borderWidth: 1, borderRadius: 16, padding: 16 },
  txnDetailsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  txnDetailsLabel: { color: '#64748b', fontSize: 14, flexShrink: 0 },
  txnDetailsValue: { color: '#1e293b', fontSize: 14, fontWeight: '600', flex: 1, textAlign: 'right', marginLeft: 16 },
  primaryActionBtn: { backgroundColor: '#16a34a', paddingVertical: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', shadowColor: '#16a34a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 },
  primaryActionText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
