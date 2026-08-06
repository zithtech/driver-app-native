import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Share,
  ImageBackground,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useIsFocused } from '@react-navigation/native';
import { RootState } from '../../redux/store';
import { useGetWalletBalanceQuery, useGetWalletTransactionsQuery } from '../../service/driverApi';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
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

const getTransactionIcon = (type: TransactionType, title: string = '') => {
  const t = title.toLowerCase();
  if (type === 'WALLET_TOPUP' || t.includes('added to wallet') || t.includes('topup')) return { name: 'wallet', color: '#16a34a', bg: '#dcfce7' };
  if (t.includes('subscription')) return { name: 'document-text-outline', color: '#7c3aed', bg: '#f3e8ff' };
  if (type === 'REFERRAL_BONUS' || t.includes('referral') || t.includes('bonus')) return { name: 'trophy-outline', color: '#d97706', bg: '#fef9c3' };
  if (t.includes('refund') || type === 'REFUND') return { name: 'arrow-undo-outline', color: '#ef4444', bg: '#fee2e2' };
  return { name: 'pricetag-outline', color: '#475569', bg: '#f1f5f9' };
};

const getTransactionSubtitle = (type: TransactionType, title: string, item: any) => {
  if (item.subtitle) return item.subtitle;
  const t = title.toLowerCase();
  
  if (type === 'WALLET_TOPUP' || t.includes('added to wallet') || t.includes('topup')) {
     if (item.paymentMethod) return `Paid via ${item.paymentMethod}`;
     if (t.includes('via')) {
         const method = title.split(/via/i)[1].trim();
         return method ? `Paid via ${method}` : 'Razorpay';
     }
     return 'Razorpay';
  }
  if (t.includes('subscription')) return 'Premium Plan - 7 Days';
  if (type === 'REFERRAL_BONUS' || t.includes('referral') || t.includes('bonus')) return 'Referral ID: REF12345';
  if (t.includes('refund') || type === 'REFUND') return 'Trip ID: #TRP12340';
  return item.description || null;
};

const getTransactionTitle = (type: TransactionType, title: string) => {
  const t = title.toLowerCase();
  if (type === 'WALLET_TOPUP' || t.includes('added to wallet') || t.includes('topup')) return 'Added to Wallet';
  if (t.includes('subscription')) return 'Subscription Plan';
  if (type === 'REFERRAL_BONUS' || t.includes('referral') || t.includes('bonus')) return 'Referral Bonus';
  if (t.includes('refund')) return 'Refund Received';
  return title;
};

const TransactionHistoryScreen = ({ navigation }: any) => {
  const { isDark } = useAppTheme();
  const [isRefreshing, setIsRefreshing] = useState(false);
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

  const isLoading = (isBalanceFetching || isTransactionsFetching) && (!balanceResult && !transactionsResult);

  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const transactionSheetRef = useRef<BottomSheetModal>(null);
  const transactionSnapPoints = useMemo(() => ['50%', '70%'], []);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([refetchBalance(), refetchTransactions()]);
    setIsRefreshing(false);
  }, [refetchBalance, refetchTransactions]);

  const openTransactionDetails = (item: any) => {
    navigation.navigate('TransactionDetailScreen', { transaction: item });
  };

  return (
    <ImageBackground source={require('../../assets/images/walletback.png')} style={[styles.container, { backgroundColor: isDark ? '#111827' : 'transparent' }]}>
      {isFocused && <AppStatusBar backgroundColor="transparent" barStyle={isDark ? "light-content" : "dark-content"} />}
      
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: isDark ? '#1F2937' : 'transparent' }]}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={isDark ? "#ffffff" : "#0f172a"} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: isDark ? "#ffffff" : "#0f172a" }]}>Transaction History</Text>
        </View>
        <Pressable>
          <Ionicons name="filter" size={22} color={isDark ? "#ffffff" : "#0f172a"} />
        </Pressable>
      </View>

      <FlatList
        data={transactionsWithBalance}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingTop: 16 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => {
          const iconConfig = getTransactionIcon(item.type, item.title);
          const isPositive = item.amount > 0;
          const subtitle = getTransactionSubtitle(item.type, item.title, item);
          return (
            <Pressable onPress={() => openTransactionDetails(item)} style={[styles.txnItem, { backgroundColor: isDark ? '#1F2937' : '#ffffff', borderColor: isDark ? '#374151' : '#f1f5f9' }]}>
              <View style={[styles.txnIconWrap, { backgroundColor: isDark ? '#374151' : iconConfig.bg }]}>
                {iconConfig.name === 'wallet' ? (
                  <View style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="wallet-outline" size={22} color={iconConfig.color} />
                    <View style={{ position: 'absolute', top: -3, right: -3, backgroundColor: iconConfig.bg, borderRadius: 10, width: 12, height: 12, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="add" size={12} color={iconConfig.color} />
                    </View>
                  </View>
                ) : (
                  <Ionicons name={iconConfig.name} size={22} color={iconConfig.color} />
                )}
              </View>
              
              <View style={styles.txnContent}>
                <View style={styles.txnRow}>
                  <Text style={[styles.txnItemTitle, { color: isDark ? '#ffffff' : '#0f172a' }]} numberOfLines={1}>{getTransactionTitle(item.type, item.title)}</Text>
                  <Text style={[styles.txnItemAmount, { color: isPositive ? '#16a34a' : (isDark ? '#ffffff' : '#0f172a') }]}>
                    {isPositive ? '+' : '-'} ₹{Math.abs(item.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}
                  </Text>
                </View>
                
                <View style={styles.txnRow}>
                  <View style={styles.txnInfo}>
                    {subtitle && <Text style={[styles.txnItemSubtitle, { color: isDark ? '#9ca3af' : '#64748b' }]} numberOfLines={1}>{subtitle}</Text>}
                    <Text style={[styles.txnItemDate, { color: isDark ? '#9ca3af' : '#64748b' }]}>{item.date}, {item.time}</Text>
                  </View>
                  
                  <View style={styles.txnRightContent}>
                    <Text style={[styles.txnItemBalance, { color: isDark ? '#64748b' : '#64748b' }]}>
                      Balance: ₹{item.closingBalance.toLocaleString('en-IN', {minimumFractionDigits: 2})}
                    </Text>
                  </View>
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
    </ImageBackground>
  );
};

export default TransactionHistoryScreen;

const styles = StyleSheet.create({
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
  txnItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 0,
    borderWidth: 1,
  },
  txnIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
    flex: 1,
  },
  txnItemSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 2,
  },
  txnItemDate: {
    fontSize: 11,
    color: '#94a3b8',
  },
  txnItemAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginLeft: 8,
  },
  txnItemBalance: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
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
  sheetContent: { paddingHorizontal: 24, paddingTop: 8 },
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
