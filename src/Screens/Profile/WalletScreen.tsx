import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  RefreshControl,
  Platform,
  InteractionManager,
  Image,
  Share,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { RootState } from '../../redux/store';
import { useGetWalletBalanceQuery, useGetWalletTransactionsQuery, useCreateWalletTopupOrderMutation, useVerifyWalletTopupPaymentMutation } from '../../service/driverApi';
import RazorpayCheckout from 'react-native-razorpay';
import Config from 'react-native-config';
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

/* ================= SKELETON COMPONENT ================= */
const Skeleton = ({ width, height, style, isDark, borderRadius = 8 }: { width?: number | string, height?: number | string, style?: any, isDark?: boolean, borderRadius?: number }) => {
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 800, easing: Easing.ease }),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: isDark ? '#374151' : '#E2E8F0',
          borderRadius,
        },
        style,
        animatedStyle,
      ]}
    />
  );
};

/* ================= TYPES ================= */

type TransactionType = 'INCENTIVE' | 'PENALTY' | 'WITHDRAW' | 'WALLET_TOPUP';



/* ================= CONSTANT DATA ================= */

/* ================= SCREEN ================= */

const WalletScreen = ({ navigation }: any) => {
  const { theme, isDark } = useAppTheme();
  const { colors, fonts } = useTheme();
  const { showAlert } = useAlert();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const user = useSelector((state: RootState) => state.userSlice.user);
  const driverId = user?.driverId || '';
  const hasWalletPin = user?.has_wallet_pin || false;
  const isFocused = useIsFocused();

  // API Hooks
  const {
    data: balanceResult,
    refetch: refetchBalance,
    isFetching: isBalanceFetching,
    isError: isBalanceError,
  } = useGetWalletBalanceQuery(driverId, { skip: !driverId });

  const {
    data: transactionsResult,
    refetch: refetchTransactions,
    isFetching: isTransactionsFetching,
    isError: isTransactionsError,
  } = useGetWalletTransactionsQuery({ driverId }, { skip: !driverId });

  const balance = balanceResult?.data?.balance || 0;
  const transactions = transactionsResult?.data || [];

  const isLoading = (isBalanceFetching || isTransactionsFetching) && (!balanceResult && !transactionsResult);
  const isError = isBalanceError || isTransactionsError;

  const [topupAmount, setTopupAmount] = useState('');
  const addMoneySheetRef = useRef<BottomSheetModal>(null);

  const [createOrder, { isLoading: isCreating }] = useCreateWalletTopupOrderMutation();
  const [verifyPayment, { isLoading: isVerifying }] = useVerifyWalletTopupPaymentMutation();

  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const transactionSheetRef = useRef<BottomSheetModal>(null);

  // Snap points for Bottom Sheets
  const snapPoints = useMemo(() => ['40%', '50%'], []);
  const transactionSnapPoints = useMemo(() => ['50%', '70%'], []);
  const insets = useSafeAreaInsets();

  /* ================= ACTIONS ================= */

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([refetchBalance(), refetchTransactions()]);
    setIsRefreshing(false);
  }, [refetchBalance, refetchTransactions]);

  const openTransactionDetails = (txn: any) => {
    setSelectedTransaction(txn);
    transactionSheetRef.current?.present();
  };

  const handleDownloadReceipt = async () => {
    if (!selectedTransaction) return;
    try {
      const receiptText = `Transaction Receipt\n\nID: ${selectedTransaction.id}\nTitle: ${selectedTransaction.title}\nDate: ${selectedTransaction.date} ${selectedTransaction.time}\nAmount: ${selectedTransaction.amount > 0 ? '+' : ''}₹${Math.abs(selectedTransaction.amount)}\nStatus: ${selectedTransaction.status}`;
      await Share.share({
        title: 'Transaction Receipt',
        message: receiptText,
      });
    } catch (error) {
      console.log('Error sharing receipt', error);
    }
  };

  // Sync data on focus removed to prevent layout glitches on back navigation

  const handleTopup = async () => {
    const amount = Number(topupAmount);
    if (amount < 50) {
      showAlert({ title: 'Minimum Amount', message: 'Minimum topup amount is ₹50', singleButton: true, icon: 'alert-circle-outline' });
      return;
    }
    addMoneySheetRef.current?.dismiss();
    try {
      const orderResult = await createOrder({ driverId, amount }).unwrap();
      const options = {
        description: 'Wallet Topup',
        image: Image.resolveAssetSource(require('../../assets/images/applogo.png')).uri,
        currency: orderResult.data?.currency || 'INR',
        key: Config.RAZORPAY_KEY_ID || 'rzp_test_SCjewpaZ96XBWa',
        amount: orderResult.data?.amount || String(amount * 100),
        name: 'T2drive',
        order_id: orderResult.data?.id,
        prefill: { email: user?.email || '', contact: user?.phone_number || '', name: user?.full_name || '' },
        theme: { color: '#2563eb' }
      };
      const data = await RazorpayCheckout.open(options);
      const verifyRes = await verifyPayment({
        driverId, amount,
        razorpay_order_id: data.razorpay_order_id || '',
        razorpay_payment_id: data.razorpay_payment_id || '',
        razorpay_signature: data.razorpay_signature || ''
      }).unwrap();
      if (verifyRes.success) {
        trigger('notificationSuccess');
        refetchBalance();
        refetchTransactions();
        navigation.replace('WalletSuccessScreen', { 
          amount, 
          transactionId: data.razorpay_payment_id, 
          orderId: data.razorpay_order_id, 
          date: new Date().toISOString() 
        });
      }
    } catch (error: any) {
      console.log('Payment error', error);
      const errorMsg = error?.message || error?.error?.description || error?.description || (typeof error === 'string' ? error : 'Payment cancelled or failed');
      navigation.replace('PaymentFailedScreen', { amount, returnScreen: 'WalletScreen', errorReason: errorMsg });
    }
  };

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior="close"
      />
    ),
    []
  );

  /* ================= UI HELPER ================= */

  const getTransactionIcon = (type: TransactionType) => {
    switch (type) {
      case 'INCENTIVE':
        return { name: 'arrow-down', color: '#16a34a', bg: '#dcfce7' };
      case 'PENALTY':
        return { name: 'arrow-up', color: '#dc2626', bg: '#fee2e2' };
      case 'WITHDRAW':
        return { name: 'business-outline', color: '#2563eb', bg: '#dbeafe' };
      case 'WALLET_TOPUP':
        return { name: 'add-circle-outline', color: '#16a34a', bg: '#dcfce7' };
      default:
        return { name: 'swap-horizontal', color: '#64748b', bg: '#f1f5f9' };
    }
  };

  /* ================= UI ================= */

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {isFocused && <AppStatusBar />}
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: theme.colors.background }]}>
        <Pressable onPress={() => navigation.goBack()} style={[styles.backButton, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
          <Ionicons name="chevron-back" size={24} color={isDark ? '#FFFFFF' : '#111827'} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: isDark ? '#FFFFFF' : '#0f172a' }]} numberOfLines={1} adjustsFontSizeToFit>My Wallet</Text>
      </View>

      <FlatList
        data={transactions}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 40 }]}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <>
            {isLoading ? (
               <View style={styles.balanceCardSkeleton}>
                  <Skeleton height={20} width={120} isDark={isDark} style={{ marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                  <Skeleton height={40} width={180} isDark={isDark} style={{ marginBottom: 24, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                  <Skeleton height={40} width={130} isDark={isDark} style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
               </View>
            ) : (
              <LinearGradient
                colors={['#1e3a8a', '#3b82f6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.balanceCard}
              >
                <View style={styles.balanceHeader}>
                  <Text style={styles.balanceLabel}>Total Balance</Text>
                  <Ionicons name="wallet-outline" size={24} color="#e0e7ff" />
                </View>
                <Text style={styles.balanceValue}>₹{balance.toLocaleString('en-IN')}</Text>

                <View style={styles.cardActions}>
                  <Pressable
                    style={({ pressed }) => [styles.withdrawBtn, pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] }]}
                    onPress={() => { trigger('impactLight'); addMoneySheetRef.current?.present(); }}
                  >
                    <Ionicons name="add-circle-outline" size={18} color="#1e3a8a" />
                    <Text style={styles.withdrawText}>Add Money</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [styles.withdrawBtn, pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] }, { marginLeft: 12, backgroundColor: 'rgba(255,255,255,0.2)' }]}
                    onPress={() => { trigger('impactLight'); navigation.navigate('WalletPinSetupScreen'); }}
                  >
                    <Ionicons name="lock-closed-outline" size={18} color="#ffffff" />
                    <Text style={[styles.withdrawText, { color: '#ffffff' }]}>{hasWalletPin ? 'Reset PIN' : 'Setup PIN'}</Text>
                  </Pressable>
                </View>
              </LinearGradient>
            )}

            <View style={[styles.sectionHeader, { marginTop: isLoading ? 0 : 24 }]}>
              <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#1e293b' }]}>Recent Transactions</Text>
            </View>
          </>
        }
        renderItem={({ item }) => {
          const iconConfig = getTransactionIcon(item.type);
          const isPositive = item.amount > 0;
          return (
            <Pressable 
              onPress={() => openTransactionDetails(item)}
              style={({ pressed }) => [
                styles.transactionItem, 
                { backgroundColor: theme.colors.card, borderColor: isDark ? '#374151' : 'transparent', borderWidth: isDark ? 1 : 0 },
                pressed && { opacity: 0.8, backgroundColor: isDark ? '#374151' : '#f1f5f9' }
              ]}
            >
              <View style={[styles.txnIconWrap, { backgroundColor: isDark ? iconConfig.bg.replace('0)', '0.2)') : iconConfig.bg }]}>
                <Ionicons name={iconConfig.name} size={20} color={isDark ? '#FFFFFF' : iconConfig.color} />
              </View>
              <View style={styles.txnBody}>
                <Text style={[styles.txnTitle, { color: isDark ? '#FFFFFF' : '#1e293b' }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.txnDate, { color: isDark ? '#9CA3AF' : '#64748b' }]}>{item.date}</Text>
              </View>
              <View style={styles.txnRight}>
                <Text
                  style={[
                    styles.txnAmount,
                    { color: isPositive ? (isDark ? '#34D399' : '#16a34a') : (isDark ? '#FFFFFF' : '#1e293b') },
                  ]}
                >
                  {isPositive ? '+' : ''}₹{Math.abs(item.amount).toLocaleString('en-IN')}
                </Text>
                {item.status && (
                  <Text style={[styles.txnStatus, isDark && { backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#FCD34D' }]}>{item.status}</Text>
                )}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          isLoading ? (
            <View>
              {[1, 2, 3, 4].map((i) => (
                <View key={i} style={[styles.transactionItem, { backgroundColor: theme.colors.card, borderColor: isDark ? '#374151' : 'transparent', borderWidth: isDark ? 1 : 0 }]}>
                  <Skeleton width={44} height={44} borderRadius={22} isDark={isDark} />
                  <View style={styles.txnBody}>
                    <Skeleton width={120} height={16} isDark={isDark} style={{ marginBottom: 6 }} />
                    <Skeleton width={80} height={12} isDark={isDark} />
                  </View>
                  <Skeleton width={60} height={20} isDark={isDark} />
                </View>
              ))}
            </View>
          ) : isError ? (
            <View style={styles.emptyState}>
              <Ionicons name="alert-circle-outline" size={56} color="#EF4444" />
              <Text style={[styles.emptyText, isDark && { color: '#9CA3AF' }]}>Failed to load wallet data</Text>
              <Pressable style={styles.retryBtn} onPress={() => onRefresh()}>
                <Text style={styles.retryBtnText}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={56} color={isDark ? '#4B5563' : '#cbd5e1'} />
              <Text style={[styles.emptyText, isDark && { color: '#9CA3AF' }]}>No recent transactions</Text>
              <Text style={{ color: isDark ? '#6B7280' : '#94a3b8', fontSize: 13, marginTop: 6, textAlign: 'center' }}>When you earn or add money,{'\n'}your transactions will appear here.</Text>
            </View>
          )
        }
      />

      {/* ================= ADD MONEY BOTTOM SHEET ================= */}
      <BottomSheetModal
        ref={addMoneySheetRef}
        snapPoints={snapPoints}
        enablePanDownToClose
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        backdropComponent={renderBackdrop}
        backgroundStyle={[styles.sheetBackground, { backgroundColor: theme.colors.card }]}
        handleIndicatorStyle={[styles.sheetIndicator, isDark && { backgroundColor: '#4B5563' }]}
      >
        <BottomSheetScrollView style={styles.sheetContent} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Text style={[styles.sheetTitle, { color: isDark ? '#FFFFFF' : '#0f172a' }]} numberOfLines={1} adjustsFontSizeToFit>Add Money to Wallet</Text>
          <Text style={[styles.sheetSubtitle, { color: isDark ? '#9CA3AF' : '#64748b' }]}>
            Available balance: <Text style={[styles.boldText, { color: isDark ? '#FFFFFF' : '#1e293b' }]}>₹{balance.toLocaleString('en-IN')}</Text>
          </Text>

          <View style={[styles.inputContainer, isDark && { borderBottomColor: '#374151' }]}>
            <Text style={[styles.currencySymbol, { color: isDark ? '#FFFFFF' : '#0f172a' }]}>₹</Text>
            <BottomSheetTextInput
              placeholder="0"
              keyboardType="numeric"
              value={topupAmount}
              onChangeText={setTopupAmount}
              style={[styles.bottomSheetInput, { color: isDark ? '#FFFFFF' : '#0f172a' }]}
              placeholderTextColor={isDark ? '#6B7280' : '#94a3b8'}
            />
          </View>

          <View style={styles.quickAmounts}>
            {[500, 1000, 2000].map((amt, idx) => (
              <Pressable
                key={idx}
                style={({ pressed }) => [styles.quickAmtBtn, isDark && { backgroundColor: '#374151' }, pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] }]}
                onPress={() => { trigger('impactLight'); setTopupAmount(amt.toString()); }}
              >
                <Text style={[styles.quickAmtText, isDark && { color: '#D1D5DB' }]}>
                  ₹{amt}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [styles.primaryActionBtn, isDark && { backgroundColor: '#3B82F6', shadowOpacity: 0.1 }, pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }]} 
            onPress={() => { trigger('impactMedium'); handleTopup(); }}
          >
            <Text style={[styles.primaryActionText, isDark && { color: '#FFFFFF' }]} numberOfLines={1} adjustsFontSizeToFit>{isCreating || isVerifying ? 'Processing...' : 'Proceed to Pay'}</Text>
          </Pressable>
        </BottomSheetScrollView>
      </BottomSheetModal>

      {/* ================= TRANSACTION DETAILS BOTTOM SHEET ================= */}
      <BottomSheetModal
        ref={transactionSheetRef}
        snapPoints={transactionSnapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={[styles.sheetBackground, { backgroundColor: theme.colors.card }]}
        handleIndicatorStyle={[styles.sheetIndicator, isDark && { backgroundColor: '#4B5563' }]}
      >
        {selectedTransaction && (
          <BottomSheetScrollView style={styles.sheetContent} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={styles.txnDetailsHeader}>
              <View style={[styles.txnIconWrap, { width: 64, height: 64, borderRadius: 32, backgroundColor: selectedTransaction.amount > 0 ? (isDark ? 'rgba(22,163,74,0.2)' : '#dcfce7') : (isDark ? 'rgba(239,68,68,0.2)' : '#fee2e2') }]}>
                <Ionicons 
                  name={selectedTransaction.amount > 0 ? 'arrow-down' : 'arrow-up'} 
                  size={32} 
                  color={selectedTransaction.amount > 0 ? (isDark ? '#34D399' : '#16a34a') : (isDark ? '#F87171' : '#dc2626')} 
                />
              </View>
              <Text style={[styles.txnDetailsTitle, { color: isDark ? '#FFFFFF' : '#0f172a' }]}>{selectedTransaction.title}</Text>
              <Text style={[styles.txnDetailsAmount, { color: selectedTransaction.amount > 0 ? (isDark ? '#34D399' : '#16a34a') : (isDark ? '#FFFFFF' : '#0f172a') }]}>
                {selectedTransaction.amount > 0 ? '+' : ''}₹{Math.abs(selectedTransaction.amount).toLocaleString('en-IN')}
              </Text>
              {selectedTransaction.status && (
                <View style={[styles.txnDetailsStatus, isDark && { backgroundColor: 'rgba(52, 211, 153, 0.2)' }]}>
                  <Text style={[styles.txnDetailsStatusText, isDark && { color: '#34D399' }]}>{selectedTransaction.status}</Text>
                </View>
              )}
            </View>

            <View style={[styles.txnDetailsCard, { backgroundColor: isDark ? '#1F2937' : '#f8fafc', borderColor: isDark ? '#374151' : '#e2e8f0' }]}>
              <View style={styles.txnDetailsRow}>
                <Text style={[styles.txnDetailsLabel, { color: isDark ? '#9CA3AF' : '#64748b' }]}>Transaction ID</Text>
                <Text style={[styles.txnDetailsValue, { color: isDark ? '#FFFFFF' : '#1e293b' }]}>{selectedTransaction.id}</Text>
              </View>
              <View style={styles.txnDetailsRow}>
                <Text style={[styles.txnDetailsLabel, { color: isDark ? '#9CA3AF' : '#64748b' }]}>Date</Text>
                <Text style={[styles.txnDetailsValue, { color: isDark ? '#FFFFFF' : '#1e293b' }]}>{selectedTransaction.date}</Text>
              </View>
              <View style={styles.txnDetailsRow}>
                <Text style={[styles.txnDetailsLabel, { color: isDark ? '#9CA3AF' : '#64748b' }]}>Time</Text>
                <Text style={[styles.txnDetailsValue, { color: isDark ? '#FFFFFF' : '#1e293b' }]}>{selectedTransaction.time}</Text>
              </View>
              <View style={styles.txnDetailsRow}>
                <Text style={[styles.txnDetailsLabel, { color: isDark ? '#9CA3AF' : '#64748b' }]}>Type</Text>
                <Text style={[styles.txnDetailsValue, { color: isDark ? '#FFFFFF' : '#1e293b' }]}>{selectedTransaction.type.replace('_', ' ')}</Text>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.primaryActionBtn, 
                { backgroundColor: theme.colors.background, borderColor: theme.colors.primary, borderWidth: 1, marginTop: 16 },
                isDark && { backgroundColor: '#1F2937' },
                pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
              ]} 
              onPress={() => { trigger('impactLight'); handleDownloadReceipt(); }}
            >
              <Ionicons name="share-outline" size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.primaryActionText, { color: theme.colors.primary }]} numberOfLines={1}>Share Receipt</Text>
            </Pressable>
          </BottomSheetScrollView>
        )}
      </BottomSheetModal>
    </View>
  );
};

export default WalletScreen;

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#f8fafc',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    marginLeft: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  balanceCardSkeleton: {
    padding: 24,
    borderRadius: 20,
    marginBottom: 24,
    backgroundColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  balanceCard: {
    padding: 24,
    borderRadius: 20,
    marginBottom: 24,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceLabel: { fontSize: 15, color: '#e0e7ff', fontWeight: '500' },
  balanceValue: { fontSize: 36, fontWeight: '800', color: '#fff', marginBottom: 24 },
  cardActions: {
    flexDirection: 'row',
  },
  withdrawBtn: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  withdrawText: {
    color: '#1e3a8a',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 6,
  },
  sectionHeader: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  bankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    marginBottom: 8,
  },
  bankIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bankDetails: { marginLeft: 16, flex: 1 },
  bankTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  bankSub: { fontSize: 14, color: '#64748b', marginBottom: 2 },
  bankHolder: { fontSize: 12, color: '#94a3b8', textTransform: 'uppercase' },
  changeBankBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
  },
  changeText: { color: '#2563eb', fontWeight: '600', fontSize: 13 },
  addBankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderStyle: 'dashed',
    marginBottom: 8,
  },
  addBankText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  transactionItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  txnIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txnBody: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  txnTitle: { fontSize: 15, fontWeight: '600', color: '#1e293b', marginBottom: 4 },
  txnDate: { fontSize: 13, color: '#64748b' },
  txnRight: {
    alignItems: 'flex-end',
  },
  txnAmount: { fontSize: 16, fontWeight: '700' },
  txnStatus: {
    fontSize: 11,
    color: '#d97706',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    fontWeight: '600',
    overflow: 'hidden',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '600',
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  retryBtnText: {
    color: '#2563eb',
    fontWeight: '600',
    fontSize: 14,
  },
  sheetBackground: {
    backgroundColor: '#fff',
    borderRadius: 24,
  },
  sheetIndicator: {
    width: 40,
    backgroundColor: '#cbd5e1',
  },
  sheetContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  sheetSubtitle: {
    fontSize: 15,
    color: '#64748b',
    marginBottom: 24,
  },
  boldText: {
    fontWeight: '700',
    color: '#1e293b',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 8,
    marginBottom: 24,
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: '600',
    color: '#0f172a',
    marginRight: 8,
  },
  bottomSheetInput: {
    flex: 1,
    fontSize: 36,
    fontWeight: '700',
    color: '#0f172a',
    ...Platform.select({
      ios: { paddingVertical: 12 },
      android: { paddingVertical: 4 },
    }),
  },
  quickAmounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  quickAmtBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 10,
    alignItems: 'center',
  },
  quickAmtText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  primaryActionBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  formGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  txnDetailsHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  txnDetailsTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 4,
    textAlign: 'center',
  },
  txnDetailsAmount: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 12,
  },
  txnDetailsStatus: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  txnDetailsStatusText: {
    color: '#16a34a',
    fontSize: 13,
    fontWeight: '600',
  },
  txnDetailsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  txnDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  txnDetailsLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  txnDetailsValue: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
});
