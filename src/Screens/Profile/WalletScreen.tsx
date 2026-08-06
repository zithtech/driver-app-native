import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Platform,
  Image,
  Share,
  ImageBackground,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useIsFocused } from '@react-navigation/native';
import { RootState } from '../../redux/store';
import { useGetWalletBalanceQuery, useGetWalletTransactionsQuery } from '../../service/driverApi';
import { useTheme } from '@react-navigation/native';
import { useAlert } from '../../context/AlertContext';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetTextInput, BottomSheetScrollView } from '@gorhom/bottom-sheet';
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

const WalletScreen = ({ navigation }: any) => {
  const { theme, isDark } = useAppTheme();
  const { colors } = useTheme();
  const { showAlert } = useAlert();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const user = useSelector((state: RootState) => state.userSlice.user);
  const driverId = user?.driverId || '';
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();

  const { data: balanceResult, refetch: refetchBalance, isFetching: isBalanceFetching, isError: isBalanceError } = useGetWalletBalanceQuery(driverId, { skip: !driverId });
  const { data: transactionsResult, refetch: refetchTransactions, isFetching: isTransactionsFetching, isError: isTransactionsError } = useGetWalletTransactionsQuery({ driverId }, { skip: !driverId });

  const balance = balanceResult?.data?.balance || 0;
  const transactions = transactionsResult?.data || [];
  
  const transactionsWithBalance = React.useMemo(() => {
    let currentBal = balance;
    return transactions.map((item: any) => {
      const closingBalance = currentBal;
      currentBal = currentBal - item.amount;
      return { ...item, closingBalance };
    });
  }, [transactions, balance]);

  const recentTransactions = React.useMemo(() => {
    return transactionsWithBalance.slice(0, 3);
  }, [transactionsWithBalance]);

  const isLoading = (isBalanceFetching || isTransactionsFetching) && (!balanceResult && !transactionsResult);
  const isError = isBalanceError || isTransactionsError;



  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const transactionSheetRef = useRef<BottomSheetModal>(null);

  const snapPoints = useMemo(() => ['40%', '50%'], []);
  const transactionSnapPoints = useMemo(() => ['50%', '70%'], []);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([refetchBalance(), refetchTransactions()]);
    setIsRefreshing(false);
  }, [refetchBalance, refetchTransactions]);

  const openTransactionDetails = (item: any) => {
    navigation.navigate('TransactionDetailScreen', { transaction: item });
  };

  const handleDownloadReceipt = async () => {
    if (!selectedTransaction) return;
    try {
      const receiptText = `Transaction Receipt

ID: ${selectedTransaction.id}
Title: ${selectedTransaction.title}
Date: ${selectedTransaction.date} ${selectedTransaction.time}
Amount: ${selectedTransaction.amount > 0 ? '+' : ''}₹${Math.abs(selectedTransaction.amount)}
Status: ${selectedTransaction.status}`;
      await Share.share({ title: 'Transaction Receipt', message: receiptText });
    } catch (error) { console.log('Error sharing receipt', error); }
  };


  const renderBackdrop = useCallback((props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} pressBehavior="close" />, []);

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

  return (
    <ImageBackground source={require('../../assets/images/walletback.png')} style={[styles.container, { backgroundColor: isDark ? '#111827' : 'transparent' }]}>
      {isFocused && <AppStatusBar backgroundColor="transparent" barStyle={isDark ? "light-content" : "dark-content"} />}
      
      <FlatList
        data={recentTransactions}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View>
            <View style={[styles.topSection, { paddingTop: insets.top + 10, backgroundColor: isDark ? '#1F2937' : 'transparent' }]}>
              <View style={styles.headerRow}>
                <View style={styles.headerLeft}>
                  <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={isDark ? "#ffffff" : "#0f172a"} />
                  </Pressable>
                  <Text style={[styles.headerTitle, { color: isDark ? "#ffffff" : "#0f172a" }]}>Wallet</Text>
                </View>
                <Pressable>
                  <Ionicons name="help-circle-outline" size={24} color={isDark ? "#ffffff" : "#0f172a"} />
                </Pressable>
              </View>

              <View style={styles.topBalanceArea}>
                <View style={styles.topLeft}>
                  <Text style={[styles.totalBalanceLabel, { color: isDark ? "#9ca3af" : "#64748b" }]}>Total Balance</Text>
                  <Text style={[styles.totalBalanceValue, { color: isDark ? "#ffffff" : "#0f172a" }]}>₹{balance.toLocaleString('en-IN', {minimumFractionDigits: 2})}</Text>
                  <View style={styles.secureBadge}>
                    <Ionicons name="shield-checkmark" size={14} color="#16a34a" />
                    <Text style={styles.secureBadgeText}>100% Secure Payments</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.contentPadding}>
              {/* Green Card */}
              <LinearGradient colors={['#4ade80', '#22c55e']} start={{x:0, y:0}} end={{x:1, y:1}} style={styles.greenCard}>
                <View style={styles.greenCardTop}>
                  <View>
                    <Text style={styles.greenCardLabel}>Available Balance</Text>
                    <Text style={styles.greenCardValue}>₹{balance.toLocaleString('en-IN', {minimumFractionDigits: 2})}</Text>
                  </View>
                  <Pressable style={styles.addMoneyBtn} onPress={() => navigation.navigate('AddMoneyScreen', { balance })}>
                    <Ionicons name="add" size={16} color="#16a34a" />
                    <Text style={styles.addMoneyBtnText}>Add Money</Text>
                  </Pressable>
                </View>
                
                <View style={styles.greenCardDivider} />
                
                <View style={styles.greenCardBottom}>
                  <View style={styles.greenCardStat}>
                    <View style={styles.statIconRow}>
                      <Ionicons name="wallet-outline" size={14} color="#fff" />
                      <Text style={styles.statLabel}>Used Balance</Text>
                    </View>
                    <Text style={styles.statValue}>₹0.00</Text>
                  </View>
                  
                  <View style={styles.statDivider} />
                  
                  <View style={styles.greenCardStat}>
                    <View style={styles.statIconRow}>
                      <Ionicons name="time-outline" size={14} color="#fff" />
                      <Text style={styles.statLabel}>In Hold</Text>
                    </View>
                    <Text style={styles.statValue}>₹0.00</Text>
                  </View>
                  
                  <View style={styles.statDivider} />
                  
                  <View style={styles.greenCardStat}>
                    <View style={styles.statIconRow}>
                      <Ionicons name="gift-outline" size={14} color="#fff" />
                      <Text style={styles.statLabel}>Bonus Balance</Text>
                    </View>
                    <Text style={styles.statValue}>₹0.00</Text>
                  </View>
                </View>
              </LinearGradient>

              {/* Quick Actions */}
              <View style={[styles.quickActionsCard, { backgroundColor: isDark ? '#1F2937' : '#fff' }]}>
                <Text style={[styles.quickActionsTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>Quick Actions</Text>
                <View style={styles.quickActionsRow}>
                  <Pressable style={styles.actionItem} onPress={() => navigation.navigate('AddMoneyScreen', { balance })}>
                    <View style={[styles.actionIconBg, { backgroundColor: isDark ? '#374151' : '#f0fdf4' }]}>
                      <Ionicons name="add" size={24} color="#16a34a" />
                    </View>
                    <Text style={[styles.actionItemText, { color: isDark ? '#9ca3af' : '#475569' }]}>Add Money</Text>
                  </Pressable>
                  
                  <Pressable style={styles.actionItem} onPress={() => navigation.navigate('RechargePlanScreen')}>
                    <View style={[styles.actionIconBg, { backgroundColor: isDark ? '#374151' : '#f0fdf4' }]}>
                      <Ionicons name="ribbon" size={18} color="#16a34a" />
                    </View>
                    <Text style={[styles.actionItemText, { color: isDark ? '#9ca3af' : '#475569' }]}>Subscription</Text>
                  </Pressable>
                  
                  <Pressable style={styles.actionItem} onPress={() => navigation.navigate('TransactionHistoryScreen')}>
                    <View style={[styles.actionIconBg, { backgroundColor: isDark ? '#374151' : '#f0fdf4' }]}>
                      <Ionicons name="document-text" size={20} color="#16a34a" />
                    </View>
                    <Text style={[styles.actionItemText, { color: isDark ? '#9ca3af' : '#475569' }]}>Transaction{'\n'}History</Text>
                  </Pressable>
                  
                  <Pressable style={styles.actionItem}>
                    <View style={[styles.actionIconBg, { backgroundColor: isDark ? '#374151' : '#f0fdf4' }]}>
                      <Ionicons name="pricetag" size={20} color="#16a34a" />
                    </View>
                    <Text style={[styles.actionItemText, { color: isDark ? '#9ca3af' : '#475569' }]}>Offers &{'\n'}Rewards</Text>
                  </Pressable>
                </View>
              </View>

              {/* Offer Banner */}
              <View style={[styles.offerBanner, { backgroundColor: isDark ? '#1F2937' : '#f0fdf4' }]}>
                <Image source={require('../../assets/images/price.png')} style={styles.offerImage} resizeMode="contain" />
                <View style={styles.offerContent}>
                  <View style={styles.offerHeaderRow}>
                    <Text style={[styles.offerBannerTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>Earn more on every ride!</Text>
                    <Pressable>
                      <Ionicons name="close" size={18} color="#64748b" />
                    </Pressable>
                  </View>
                  <Text style={[styles.offerBannerDesc, { color: isDark ? '#9ca3af' : '#64748b' }]}>Add money to your wallet and get exciting cashback offers.</Text>
                  <Pressable style={styles.viewOffersBtn}>
                    <Text style={styles.viewOffersText}>View Offers</Text>
                  </Pressable>
                </View>
              </View>

              {/* Recent Transactions Header */}
              <View style={styles.recentTxnHeader}>
                <Text style={[styles.recentTxnTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>Recent Transactions</Text>
                <Pressable onPress={() => navigation.navigate('TransactionHistoryScreen')}>
                  <Text style={styles.viewAllText}>View All</Text>
                </Pressable>
              </View>
            </View>
          </View>
        }
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
              {[1, 2, 3, 4].map((i) => (
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
        ListFooterComponent={
          recentTransactions.length > 0 ? (
            <View style={[styles.secureFooter, { backgroundColor: isDark ? '#1F2937' : '#f0fdf4' }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#16a34a" />
              <Text style={styles.secureFooterText}>Your payments are secure with 256-bit encryption</Text>
              <Ionicons name="chevron-forward" size={16} color="#16a34a" />
            </View>
          ) : null
        }
      />

    </ImageBackground>
  );
};

export default WalletScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fdfdfd' },
  topSection: {
    backgroundColor: '#effcf4', 
    paddingHorizontal: 16,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  topBalanceArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topLeft: {
    flex: 1,
  },
  totalBalanceLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 4,
  },
  totalBalanceValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  secureBadgeText: {
    fontSize: 11,
    color: '#16a34a',
    fontWeight: '600',
    marginLeft: 4,
  },
  walletIllustration: {
    width: 120,
    height: 100,
    marginRight: -10,
  },
  contentPadding: {
    paddingHorizontal: 16,
    marginTop: -20,
  },
  greenCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  greenCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  greenCardLabel: {
    color: '#dcfce7',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  greenCardValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  addMoneyBtn: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addMoneyBtnText: {
    color: '#16a34a',
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 4,
  },
  greenCardDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 16,
  },
  greenCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greenCardStat: {
    flex: 1,
    alignItems: 'flex-start',
  },
  statIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statLabel: {
    color: '#dcfce7',
    fontSize: 11,
    marginLeft: 4,
  },
  statValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 12,
  },
  quickActionsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  quickActionsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionItem: {
    alignItems: 'center',
    width: '22%',
  },
  actionIconBg: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  actionItemText: {
    fontSize: 11,
    color: '#475569',
    textAlign: 'center',
    fontWeight: '500',
  },
  offerBanner: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  offerImage: {
    width: 80,
    height: 80,
    marginRight: 12,
  },
  offerContent: {
    flex: 1,
  },
  offerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  offerBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  offerBannerDesc: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
    lineHeight: 16,
  },
  viewOffersBtn: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  viewOffersText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  recentTxnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  recentTxnTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  viewAllText: {
    fontSize: 13,
    color: '#16a34a',
    fontWeight: '600',
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
  secureFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdf4',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  secureFooterText: {
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '500',
    marginHorizontal: 8,
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
  sheetTitle: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  sheetSubtitle: { fontSize: 15, color: '#64748b', marginBottom: 24 },
  boldText: { fontWeight: '700', color: '#1e293b' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#e2e8f0', paddingBottom: 8, marginBottom: 24 },
  currencySymbol: { fontSize: 32, fontWeight: '600', color: '#0f172a', marginRight: 8 },
  bottomSheetInput: { flex: 1, fontSize: 36, fontWeight: '700', color: '#0f172a', ...Platform.select({ ios: { paddingVertical: 12 }, android: { paddingVertical: 4 } }) },
  quickAmounts: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  quickAmtBtn: { flex: 1, backgroundColor: '#f1f5f9', paddingVertical: 10, marginHorizontal: 4, borderRadius: 10, alignItems: 'center' },
  quickAmtText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  primaryActionBtn: { backgroundColor: '#16a34a', paddingVertical: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', shadowColor: '#16a34a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 },
  primaryActionText: { color: '#fff', fontSize: 16, fontWeight: '700' },
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
});
