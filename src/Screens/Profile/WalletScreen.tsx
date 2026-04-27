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
} from 'react-native';
import { useSelector } from 'react-redux';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { RootState } from '../../redux/store';
import { useGetWalletBalanceQuery, useGetWalletTransactionsQuery } from '../../service/driverApi';
import { useTheme } from '@react-navigation/native';
import { useAlert } from '../../context/AlertContext';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import BottomSheet, { BottomSheetBackdrop, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import AppStatusBar from '../../Components/AppStatusBar';
import { useAppTheme } from '../../context/ThemeContext';

/* ================= TYPES ================= */

type TransactionType = 'INCENTIVE' | 'PENALTY' | 'WITHDRAW';



interface BankAccount {
  id: string;
  holderName: string;
  bankName: string;
  accountLast4: string;
  isPrimary: boolean;
}

/* ================= CONSTANT DATA ================= */

const INITIAL_BANKS: BankAccount[] = [
  {
    id: '1',
    holderName: 'Karthi',
    bankName: 'HDFC Bank',
    accountLast4: '4321',
    isPrimary: true,
  },
];

/* ================= SCREEN ================= */

const WalletScreen = ({ navigation }: any) => {
  const { theme, isDark } = useAppTheme();
  const { colors, fonts } = useTheme();
  const { showAlert } = useAlert();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const user = useSelector((state: RootState) => state.userSlice.user);
  const driverId = user?.driverId || '';
  const isFocused = useIsFocused();

  // API Hooks
  const {
    data: balanceResult,
    refetch: refetchBalance,
    isFetching: isBalanceFetching,
  } = useGetWalletBalanceQuery(driverId, { skip: !driverId });

  const {
    data: transactionsResult,
    refetch: refetchTransactions,
    isFetching: isTransactionsFetching,
  } = useGetWalletTransactionsQuery({ driverId }, { skip: !driverId });

  const balance = balanceResult?.data?.balance || 0;
  const transactions = transactionsResult?.data || [];

  // const isLoading = isBalanceLoading || isTransactionsLoading;

  const [banks, setBanks] = useState<BankAccount[]>(INITIAL_BANKS);

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [newBankName, setNewBankName] = useState('');
  const [newAccountLast4, setNewAccountLast4] = useState('');

  const withdrawSheetRef = useRef<BottomSheet>(null);
  const addBankSheetRef = useRef<BottomSheet>(null);

  const primaryBank = banks.find(b => b.isPrimary);

  // Snap points for Bottom Sheets
  const snapPoints = useMemo(() => ['40%', '50%'], []);
  const bankSnapPoints = useMemo(() => ['50%', '60%'], []);
  const insets = useSafeAreaInsets();

  /* ================= ACTIONS ================= */

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([refetchBalance(), refetchTransactions()]);
    setIsRefreshing(false);
  }, [refetchBalance, refetchTransactions]);

  // Sync data on focus removed to prevent layout glitches on back navigation

  const confirmWithdraw = () => {
    const amount = Number(withdrawAmount);

    if (!primaryBank) {
    showAlert({
      title: 'No Bank Account',
      message: 'Please add a bank account first',
      singleButton: true,
      icon: 'business-outline',
    });
      return;
    }

    if (amount < 500) {
    showAlert({
      title: 'Minimum Withdrawal',
      message: 'Minimum withdrawal is ₹500',
      singleButton: true,
      icon: 'alert-circle-outline',
    });
      return;
    }

    if (amount > balance) {
    showAlert({
      title: 'Insufficient Balance',
      message: 'You do not have enough balance to withdraw.',
      singleButton: true,
      icon: 'wallet-outline',
    });
      return;
    }

    // For production, this should call a mutation endpoint
    showAlert({
      title: 'Withdrawal Requested',
      message: `Your withdrawal of ₹${amount} is being processed.`,
      singleButton: true,
      icon: 'checkmark-circle-outline',
    });
    setWithdrawAmount('');
    withdrawSheetRef.current?.close();
  };

  const addBankAccount = () => {
    if (!newBankName || !newAccountLast4) {
    showAlert({
      title: 'Invalid Details',
      message: 'Please fill in all details',
      singleButton: true,
      icon: 'close-circle-outline',
    });
      return;
    }

    setBanks(prev =>
      prev.map(b => ({ ...b, isPrimary: false })).concat({
        id: Date.now().toString(),
        holderName: 'Driver',
        bankName: newBankName,
        accountLast4: newAccountLast4,
        isPrimary: true,
      })
    );

    setNewBankName('');
    setNewAccountLast4('');
    addBankSheetRef.current?.close();
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
        <Text style={[styles.headerTitle, { color: isDark ? '#FFFFFF' : '#0f172a' }]}>My Wallet</Text>
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
            {/* ================= BALANCE CARD ================= */}
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
                  style={[
                    styles.withdrawBtn,
                    balance < 500 && { opacity: 0.6 },
                  ]}
                  disabled={balance < 500}
                  onPress={() => withdrawSheetRef.current?.expand()}
                >
                  <Ionicons name="push-outline" size={18} color="#1e3a8a" />
                  <Text style={styles.withdrawText}>Withdraw</Text>
                </Pressable>
              </View>
            </LinearGradient>

            {/* ================= PRIMARY BANK ================= */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#1e293b' }]}>Withdrawal Account</Text>
            </View>

            {primaryBank ? (
              <View style={[styles.bankCard, { backgroundColor: theme.colors.card, borderColor: isDark ? '#374151' : 'transparent', borderWidth: isDark ? 1 : 0 }]}>
                <View style={[styles.bankIconContainer, isDark && { backgroundColor: 'rgba(37, 99, 235, 0.2)' }]}>
                  <Ionicons name="business" size={24} color={isDark ? '#3B82F6' : '#2563eb'} />
                </View>
                <View style={styles.bankDetails}>
                  <Text style={[styles.bankTitle, { color: isDark ? '#FFFFFF' : '#0f172a' }]}>{primaryBank.bankName}</Text>
                  <Text style={[styles.bankSub, { color: isDark ? '#9CA3AF' : '#64748b' }]}>
                    •••• •••• •••• {primaryBank.accountLast4}
                  </Text>
                  <Text style={[styles.bankHolder, { color: isDark ? '#6B7280' : '#94a3b8' }]}>{primaryBank.holderName}</Text>
                </View>
                <Pressable
                  style={[styles.changeBankBtn, isDark && { backgroundColor: 'rgba(37, 99, 235, 0.2)' }]}
                  onPress={() => addBankSheetRef.current?.expand()}
                >
                  <Text style={[styles.changeText, isDark && { color: '#60A5FA' }]}>Change</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={[styles.addBankCard, isDark && { backgroundColor: 'rgba(37, 99, 235, 0.1)', borderColor: 'rgba(37, 99, 235, 0.3)' }]}
                onPress={() => addBankSheetRef.current?.expand()}
              >
                <Ionicons name="add-circle-outline" size={24} color={isDark ? '#60A5FA' : '#2563eb'} />
                <Text style={[styles.addBankText, isDark && { color: '#60A5FA' }]}>Add Bank Account</Text>
              </Pressable>
            )}

            <View style={[styles.sectionHeader, { marginTop: 24 }]}>
              <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#1e293b' }]}>Recent Transactions</Text>
            </View>
          </>
        }
        renderItem={({ item }) => {
          const iconConfig = getTransactionIcon(item.type);
          const isPositive = item.amount > 0;
          return (
            <View style={[styles.transactionItem, { backgroundColor: theme.colors.card, borderColor: isDark ? '#374151' : 'transparent', borderWidth: isDark ? 1 : 0 }]}>
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
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color={isDark ? '#4B5563' : '#cbd5e1'} />
            <Text style={[styles.emptyText, isDark && { color: '#9CA3AF' }]}>No recent transactions</Text>
          </View>
        }
      />

      {/* ================= WITHDRAW BOTTOM SHEET ================= */}
      <BottomSheet
        ref={withdrawSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={[styles.sheetBackground, { backgroundColor: theme.colors.card }]}
        handleIndicatorStyle={[styles.sheetIndicator, isDark && { backgroundColor: '#4B5563' }]}
      >
        <View style={styles.sheetContent}>
          <Text style={[styles.sheetTitle, { color: isDark ? '#FFFFFF' : '#0f172a' }]}>Withdraw Funds</Text>
          <Text style={[styles.sheetSubtitle, { color: isDark ? '#9CA3AF' : '#64748b' }]}>
            Available balance: <Text style={[styles.boldText, { color: isDark ? '#FFFFFF' : '#1e293b' }]}>₹{balance.toLocaleString('en-IN')}</Text>
          </Text>

          <View style={[styles.inputContainer, isDark && { borderBottomColor: '#374151' }]}>
            <Text style={[styles.currencySymbol, { color: isDark ? '#FFFFFF' : '#0f172a' }]}>₹</Text>
            <BottomSheetTextInput
              placeholder="0"
              keyboardType="numeric"
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
              style={[styles.bottomSheetInput, { color: isDark ? '#FFFFFF' : '#0f172a' }]}
              placeholderTextColor={isDark ? '#6B7280' : '#94a3b8'}
            />
          </View>

          <View style={styles.quickAmounts}>
            {[500, 1000, balance].map((amt, idx) => (
              <Pressable
                key={idx}
                style={[styles.quickAmtBtn, isDark && { backgroundColor: '#374151' }]}
                onPress={() => setWithdrawAmount(amt.toString())}
              >
                <Text style={[styles.quickAmtText, isDark && { color: '#D1D5DB' }]}>
                  {amt === balance ? 'Max' : `₹${amt}`}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[styles.primaryActionBtn, isDark && { backgroundColor: '#3B82F6', shadowOpacity: 0.1 }]}
            onPress={confirmWithdraw}
          >
            <Text style={[styles.primaryActionText, isDark && { color: '#FFFFFF' }]}>Confirm Withdrawal</Text>
          </Pressable>
        </View>
      </BottomSheet>

      {/* ================= ADD BANK BOTTOM SHEET ================= */}
      <BottomSheet
        ref={addBankSheetRef}
        index={-1}
        snapPoints={bankSnapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={[styles.sheetBackground, { backgroundColor: theme.colors.card }]}
        handleIndicatorStyle={[styles.sheetIndicator, isDark && { backgroundColor: '#4B5563' }]}
      >
        <View style={styles.sheetContent}>
          <Text style={[styles.sheetTitle, { color: isDark ? '#FFFFFF' : '#0f172a' }]}>Add Bank Account</Text>
          <Text style={[styles.sheetSubtitle, { color: isDark ? '#9CA3AF' : '#64748b' }]}>Enter details to receive your earnings securely.</Text>

          <View style={styles.formGroup}>
            <Text style={[styles.inputLabel, { color: isDark ? '#D1D5DB' : '#475569' }]}>Bank Name</Text>
            <BottomSheetTextInput
              placeholder="e.g. State Bank of India"
              value={newBankName}
              onChangeText={setNewBankName}
              style={[styles.formInput, isDark && { backgroundColor: '#374151', borderColor: '#4B5563', color: '#FFFFFF' }]}
              placeholderTextColor={isDark ? '#6B7280' : '#94a3b8'}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.inputLabel, { color: isDark ? '#D1D5DB' : '#475569' }]}>Account Number (Last 4 Digits)</Text>
            <BottomSheetTextInput
              placeholder="e.g. 1234"
              keyboardType="numeric"
              maxLength={4}
              value={newAccountLast4}
              onChangeText={setNewAccountLast4}
              style={[styles.formInput, isDark && { backgroundColor: '#374151', borderColor: '#4B5563', color: '#FFFFFF' }]}
              placeholderTextColor={isDark ? '#6B7280' : '#94a3b8'}
            />
          </View>

          <Pressable
            style={[styles.primaryActionBtn, { marginTop: 16 }, isDark && { backgroundColor: '#3B82F6', shadowOpacity: 0.1 }]}
            onPress={addBankAccount}
          >
            <Text style={[styles.primaryActionText, isDark && { color: '#FFFFFF' }]}>Save & Set Primary</Text>
          </Pressable>
        </View>
      </BottomSheet>
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
    fontSize: 15,
    color: '#94a3b8',
    fontWeight: '500',
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
    padding: 24,
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
});
