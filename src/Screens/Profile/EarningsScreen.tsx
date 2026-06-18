
import React, { useState, useCallback } from 'react';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useHaptic } from '../../hooks/useHaptic';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  InteractionManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import { useGetEarningsSummaryQuery, useGetEarningsTransactionsQuery } from '../../service/driverApi';
import colors from '../../constant/colors';

interface Transaction {
  id: string;
  title: string;
  date: string;
  time?: string;
  pickup?: string;
  drop?: string;
  amount: number;
  distance?: string;
  status: string;
}




import { useTranslation } from 'react-i18next';
import { useTheme } from '@react-navigation/native';
import { useAlert } from '../../context/AlertContext';
import Ionicons from 'react-native-vector-icons/Ionicons';
import RNPrint from 'react-native-print';
import { useAppTheme } from '../../context/ThemeContext';
import AppStatusBar from '../../Components/AppStatusBar';

/* ================= SCREEN ================= */

const EarningsScreen: React.FC<any> = ({ navigation, route }) => {
  const { colors, fonts } = useTheme();
  const { showAlert } = useAlert();
  const { t } = useTranslation();
  const { theme, isDark } = useAppTheme();
  const user = useSelector((state: RootState) => state.userSlice.user);
  const { triggerHaptic } = useHaptic();
  const driverId = user?.driverId || '';
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] =
    useState<'today' | 'week' | 'month'>('today'); 
  const [selectedRange, setSelectedRange] = useState('Today');

  const [selectedPayout, setSelectedPayout] = useState<Transaction | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  // API Hooks
  const {
    data: summaryResult,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
    isFetching: isSummaryFetching,
  } = useGetEarningsSummaryQuery(
    { driverId },
    { skip: !driverId }
  );

  const {
    data: transactionsResult,
    isLoading: isTransactionsLoading,
    refetch: refetchTransactions,
    isFetching: isTransactionsFetching,
  } = useGetEarningsTransactionsQuery(
    { driverId },
    { skip: !driverId }
  );

  const summary = {
    total: `₹${summaryResult?.data?.totalEarnings || 0}`,
    stats: {
      trips: summaryResult?.data?.tripsCompleted || 0,
      hours: summaryResult?.data?.onlineHours !== undefined ? `${summaryResult.data.onlineHours}h 0m` : '0h 0m',
      incentive: `₹${summaryResult?.data?.tips || 0}`,
    },
  };

  const transactions = transactionsResult?.data || [];

  const isLoading = isSummaryLoading || isTransactionsLoading;
  const [isManualRefresh, setIsManualRefresh] = useState(false);

  const onRefresh = useCallback(async () => {
    triggerHaptic(HapticFeedbackTypes.impactLight);
    setIsManualRefresh(true);
    await Promise.all([refetchSummary(), refetchTransactions()]);
    setIsManualRefresh(false);
  }, [refetchSummary, refetchTransactions, triggerHaptic]);

  // Sync data on focus removed to prevent layout glitches on back navigation

  const handleTransactionPress = (item: Transaction) => {
    triggerHaptic(HapticFeedbackTypes.impactLight);
    if (item.title === 'Ride Earnings') {
      navigation.navigate('RideDetailScreen', { ride: item });
    } else {
      setSelectedPayout(item);
      setIsModalVisible(true);
    }
  };

  /* ================= MONTHLY STATEMENT ================= */
  const downloadMonthlyStatement = async () => {
    triggerHaptic(HapticFeedbackTypes.notificationSuccess);
    try {
      const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
      
      // Calculate additional metrics
      const totalEarningsValue = summaryResult?.data?.totalEarnings || 0;
      const tripsCount = summaryResult?.data?.tripsCompleted || 0;
      const avgPerTrip = tripsCount > 0 ? (totalEarningsValue / tripsCount).toFixed(2) : '0.00';
      const onlineHours = summaryResult?.data?.onlineHours || 0;
      const tipsValue = summaryResult?.data?.tips || 0;

      // Generate suggestions based on data
      const suggestions = [];
      if (tipsValue < totalEarningsValue * 0.05) {
        suggestions.push("Focus on passenger comfort and small gestures to increase your tips (currently below 5% of total).");
      }
      if (onlineHours > 0 && tripsCount / onlineHours < 1) {
        suggestions.push("Try moving to high-demand areas like the City Center or Airport during peak hours to increase trip frequency.");
      }
      if (tripsCount > 50) {
        suggestions.push("Great job on completing over 50 trips this month! You're among our top-performing drivers.");
      } else {
        suggestions.push("Increase your activity during weekend nights (8 PM - 12 AM) to qualify for weekly bonuses.");
      }
      suggestions.push("Regularly check your vehicle's health to ensure smooth rides and higher ratings.");

      const rows = transactions.map(
        (t: Transaction) => `
          <tr style="border-bottom: 1px solid #F3F4F6;">
            <td style="padding: 12px; font-size: 13px; color: #374151;">${t.date} ${t.time || ''}</td>
            <td style="padding: 12px; font-size: 13px; color: #374151;">${t.title}</td>
            <td style="padding: 12px; font-size: 13px;"><span style="padding: 4px 8px; border-radius: 9999px; background-color: ${t.status === 'Completed' ? '#DEF7EC' : '#FDE8E8'}; color: ${t.status === 'Completed' ? '#03543F' : '#9B1C1C'}; font-weight: 500;">${t.status}</span></td>
            <td style="padding: 12px; font-size: 13px; font-weight: 600; text-align: right; color: ${t.amount < 0 ? '#C81E1E' : '#057A55'};">₹${Math.abs(t.amount).toLocaleString('en-IN')}</td>
          </tr>
        `
      ).join('');

      const html = `
        <html>
          <head>
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111827; line-height: 1.5; padding: 40px; }
              .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid ${colors.primary}; padding-bottom: 20px; }
              .logo-text { font-size: 28px; font-weight: 800; color: ${colors.primary}; letter-spacing: -0.5px; }
              .statement-info { text-align: right; }
              .section-title { font-size: 18px; font-weight: 700; margin-top: 32px; margin-bottom: 16px; color: #1F2937; border-left: 4px solid ${colors.primary}; padding-left: 12px; }
              
              .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 32px; }
              .stat-card { background-color: #F9FAFB; padding: 16px; border-radius: 12px; border: 1px solid #E5E7EB; }
              .stat-label { font-size: 12px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
              .stat-value { font-size: 20px; font-weight: 700; color: #111827; margin-top: 4px; }
              
              table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
              th { text-align: left; padding: 12px; background-color: #F3F4F6; font-size: 12px; color: #4B5563; text-transform: uppercase; font-weight: 600; }
              
              .suggestions-box { background-color: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 12px; padding: 20px; margin-top: 40px; }
              .suggestion-item { display: flex; align-items: center; margin-bottom: 10px; font-size: 14px; color: #1E40AF; }
              .suggestion-bullet { width: 6px; height: 6px; background-color: #3B82F6; border-radius: 50%; margin-right: 12px; min-width: 6px; }
              
              .footer { margin-top: 60px; text-align: center; font-size: 12px; color: #9CA3AF; border-top: 1px solid #E5E7EB; padding-top: 20px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div>
                <div class="logo-text">DriverClient</div>
                <p style="font-size: 14px; color: #6B7280; margin-top: 4px;">Premium Driver Partner Network</p>
              </div>
              <div class="statement-info">
                <h2 style="margin: 0; color: #111827;">Monthly Statement</h2>
                <p style="margin: 4px 0; color: #4B5563;"><b>Period:</b> ${currentMonth}</p>
                <p style="margin: 0; color: #4B5563;"><b>Driver ID:</b> ${driverId}</p>
              </div>
            </div>

            <div class="section-title">Earnings Performance</div>
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-label">Total Earnings</div>
                <div class="stat-value" style="color: ${colors.primary}; font-size: 24px;">₹${totalEarningsValue.toLocaleString('en-IN')}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Trips Completed</div>
                <div class="stat-value">${tripsCount} Rides</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Avg. per Trip</div>
                <div class="stat-value">₹${avgPerTrip}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Incentives & Tips</div>
                <div class="stat-value">₹${tipsValue.toLocaleString('en-IN')}</div>
              </div>
            </div>

            <div class="section-title">Trip Details</div>
            <table>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th style="text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>

            <div class="suggestions-box">
              <div style="font-weight: 700; color: #1E40AF; margin-bottom: 12px; font-size: 16px;">Smart Insights & Suggestions</div>
              ${suggestions.map(s => `
                <div class="suggestion-item">
                  <div class="suggestion-bullet"></div>
                  <div>${s}</div>
                </div>
              `).join('')}
            </div>

            <div class="footer">
              <p>This is a system-generated document. For any discrepancies, please contact partner support through the help center.</p>
              <p>&copy; 2026 DriverClient. All rights reserved.</p>
            </div>
          </body>
        </html>
      `;

      await RNPrint.print({ html });
    } catch (error) {
      console.error('Print error:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to generate statement. Please try again.',
        singleButton: true,
        icon: 'alert-circle-outline',
      });
    }
  };

  const handleBack = () => {
    triggerHaptic(HapticFeedbackTypes.impactLight);
    navigation.goBack();
  };

  return (
    <View style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {isFocused && <AppStatusBar />}
      {/* ================= HEADER ================= */}
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: theme.colors.background }]}>
        <Pressable onPress={handleBack}>
          <Ionicons name="chevron-back" size={24} color={isDark ? '#FFFFFF' : '#000'} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: isDark ? '#FFFFFF' : '#111827' }]} numberOfLines={1} adjustsFontSizeToFit>{t('earnings')}</Text>

        <Pressable onPress={() => {
          triggerHaptic(HapticFeedbackTypes.impactLight);
          navigation.navigate('HelpCenterScreen');
        }}>
          <Ionicons
            name="help-circle-outline"
            size={22}
            color={isDark ? '#FFFFFF' : '#000'}
          />
        </Pressable>
      </View>

      <FlatList
        data={isLoading ? [] : transactions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={isManualRefresh}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ marginTop: 16 }}>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={64} color="#CBD5E1" />
              <Text style={styles.emptyText}>{t('no_transactions_found') || 'No transactions yet'}</Text>
            </View>
          )
        }
        ListHeaderComponent={
          <>
            {/* ================= SUMMARY ================= */}
            <View style={[styles.summaryCard, { backgroundColor: theme.colors.card }]}>
              <Text style={[styles.summaryLabel, isDark && { color: '#D1D5DB' }]}>{t('total_earnings')}</Text>
              <Text style={[styles.summaryValue, isDark && { color: '#FFFFFF' }]}>
                {summary.total}
              </Text>

              <View style={[styles.tabs, isDark && { backgroundColor: theme.colors.border }]}>
                {['today', 'week', 'month'].map((tab: any) => (
                  <Pressable
                    key={tab}
                    onPress={() => setActiveTab(tab)}
                    style={[
                      styles.tab,
                      activeTab === tab && styles.activeTab,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        isDark && activeTab !== tab && { color: '#9CA3AF' },
                        activeTab === tab &&
                        styles.activeTabText,
                      ]}
                    >
                      {t(tab).toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* ================= MONTHLY STATEMENT ACTION ================= */}
            {activeTab === 'month' && (
              <View style={[styles.statementCard, { backgroundColor: theme.colors.card }]}>
                <Text style={[styles.statementTitle, isDark && { color: '#FFFFFF' }]} numberOfLines={1} adjustsFontSizeToFit>
                  {t('monthly_statement')}
                </Text>

                <Pressable
                  style={[styles.statementBtn, isDark && { shadowOpacity: 0.1 }]}
                  onPress={downloadMonthlyStatement}
                >
                  <Ionicons
                    name="download-outline"
                    size={18}
                    color="#fff"
                  />
                  <Text style={[styles.statementBtnText, isDark && { color: '#FFFFFF' }]} numberOfLines={1} adjustsFontSizeToFit>
                    {t('download_pdf')}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* ================= STATS ================= */}
            <View style={styles.statsRow}>
              <StatBox
                icon="car-outline"
                label={t('trips')}
                value={summary.stats.trips}
                isDark={isDark}
                theme={theme}
              />
              <StatBox
                icon="time-outline"
                label={t('online_hours')}
                value={summary.stats.hours}
                isDark={isDark}
                theme={theme}
              />
              <StatBox
                icon="gift-outline"
                label={t('incentives')}
                value={summary.stats.incentive}
                isDark={isDark}
                theme={theme}
              />
            </View>

            {/* ================= PAYOUT ================= */}
            <View style={[styles.payoutCard, { backgroundColor: theme.colors.card }]}>
              <View>
                <Text style={[styles.payoutTitle, isDark && { color: '#F3F4F6' }]}>{t('next_payout')}</Text>
                <Text style={[styles.payoutDate, isDark && { color: '#D1D5DB' }]}>
                  Monday, 15 Jan
                </Text>
              </View>

              <Pressable style={[styles.payoutBtn, isDark && { backgroundColor: 'rgba(21, 45, 94, 0.2)' }]}>
                <Text style={[styles.payoutBtnText, isDark && { color: '#60A5FA' }]}>
                  {t('view_details')}
                </Text>
              </Pressable>
            </View>

            {/* ================= TRANSACTIONS ================= */}
            <Text style={[styles.sectionTitle, isDark && { color: '#FFFFFF' }]} numberOfLines={1} adjustsFontSizeToFit>{t('transactions')}</Text>
          </>
        }
        renderItem={({ item }) => (
          <Pressable
            style={[styles.rideCard, { backgroundColor: theme.colors.card }]}
            onPress={() => handleTransactionPress(item)}
          >
            <View style={styles.rideHeader}>
              <Text style={[styles.rideDate, isDark && { color: '#9CA3AF' }]}>
                {item.date} {item.time ? `• ${item.time}` : ''}
              </Text>
              <StatusBadge status={item.status} label={t(item.status.toLowerCase())} isDark={isDark} />
            </View>

            {item.pickup ? (
              <>
                <View style={styles.routeRow}>
                  <Ionicons
                    name="radio-button-on"
                    size={12}
                    color={isDark ? '#34D399' : '#16A34A'}
                  />
                  <Text style={[styles.routeText, { color: isDark ? '#FFFFFF' : '#374151' }]}>{item.pickup}</Text>
                </View>

                <View style={styles.routeRow}>
                  <Ionicons name="location" size={14} color="#DC2626" />
                  <Text style={[styles.routeText, { color: isDark ? '#FFFFFF' : '#374151' }]}>{item.drop}</Text>
                </View>
              </>
            ) : (
              <View style={styles.txnDescriptionRow}>
                <View style={[styles.txnIcon, isDark && { backgroundColor: 'rgba(21, 45, 94, 0.2)' }]}>
                  <Ionicons
                    name="cash-outline"
                    size={18}
                    color={isDark ? '#60A5FA' : colors.primary}
                  />
                </View>
                <Text style={[styles.txnTitleText, { color: isDark ? '#FFFFFF' : '#111827' }]}>{item.title}</Text>
              </View>
            )}

            <View style={[styles.divider, isDark && { backgroundColor: theme.colors.border }]} />

            <View style={styles.footer}>
              <View style={styles.footerItem}>
                {item.distance && (
                  <>
                    <Ionicons
                      name="car-outline"
                      size={16}
                      color={isDark ? '#60A5FA' : colors.primary}
                    />
                    <Text style={[styles.footerText, isDark && { color: '#9CA3AF' }]}>
                      {item.distance}
                    </Text>
                  </>
                )}
              </View>

              <Text
                style={[
                  styles.amountText,
                  item.amount < 0 && styles.debitAmount,
                  isDark && item.amount >= 0 && { color: '#34D399' }
                ]}
              >
                {item.amount > 0 ? '+' : ''} ₹{Math.abs(item.amount)}
              </Text>
            </View>
          </Pressable>
        )}
      />

      {/* ================= PAYOUT DETAIL MODAL ================= */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={[styles.modalDragHandle, isDark && { backgroundColor: '#4B5563' }]} />
            <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : '#111827' }]} numberOfLines={1} adjustsFontSizeToFit>{t('transaction_details')}</Text>

            {selectedPayout && (
              <View style={styles.detailContainer}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, isDark && { color: '#D1D5DB' }]}>{t('description')}</Text>
                  <Text style={[styles.detailValue, isDark && { color: '#FFFFFF' }]}>{selectedPayout.title}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, isDark && { color: '#D1D5DB' }]}>{t('date')}</Text>
                  <Text style={[styles.detailValue, isDark && { color: '#FFFFFF' }]}>{selectedPayout.date} • {selectedPayout.time}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, isDark && { color: '#D1D5DB' }]}>{t('amount')}</Text>
                  <Text style={[styles.detailValue, { color: selectedPayout.amount < 0 ? '#DC2626' : (isDark ? '#34D399' : '#16A34A') }]}>
                    {selectedPayout.amount > 0 ? '+' : ''} ₹{Math.abs(selectedPayout.amount)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, isDark && { color: '#D1D5DB' }]}>{t('payout_status')}</Text>
                  <View style={[styles.miniBadge, styles.successBadge, isDark && { backgroundColor: 'rgba(22, 163, 74, 0.2)' }]}>
                    <Text style={[styles.miniBadgeText, isDark && { color: '#34D399' }]}>{t(selectedPayout.status.toLowerCase())}</Text>
                  </View>
                </View>

                <View style={[styles.divider, isDark && { backgroundColor: theme.colors.border }]} />

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, isDark && { color: '#D1D5DB' }]}>{t('payment_method')}</Text>
                  <View style={styles.paymentMethodLabel}>
                    <Ionicons name="business-outline" size={16} color={isDark ? '#9CA3AF' : '#4B5563'} />
                    <Text style={[styles.detailValue, isDark && { color: '#FFFFFF' }]}>{t('bank_transfer')}</Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, isDark && { color: '#D1D5DB' }]}>{t('reference_id')}</Text>
                  <Text style={[styles.refText, isDark && { color: '#6B7280' }]}>TXN-{selectedPayout.id}82937492</Text>
                </View>
              </View>
            )}

            <Pressable
              style={[styles.closeBtn, isDark && { backgroundColor: theme.colors.border }]}
              onPress={() => setIsModalVisible(false)}
            >
              <Text style={[styles.closeBtnText, isDark && { color: '#FFFFFF' }]} numberOfLines={1} adjustsFontSizeToFit>{t('close')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default EarningsScreen;

/* ================= SUB COMPONENTS ================= */

const StatBox = ({ icon, label, value, isDark, theme }: any) => (
  <View style={[styles.statBox, { backgroundColor: theme.colors.card }]}>
    <Ionicons name={icon} size={20} color={isDark ? '#60A5FA' : colors.primary} />
    <Text style={[styles.statLabelValue, { color: isDark ? '#FFFFFF' : '#111827' }]}>{value}</Text>
    <Text style={[styles.statSubLabel, isDark && { color: '#9CA3AF' }]}>{label}</Text>
  </View>
);

const StatusBadge = ({ status, label, isDark }: { status: string; label?: string; isDark?: boolean }) => (
  <View
    style={[
      styles.badge,
      status === 'Completed'
        ? [styles.success, isDark && { backgroundColor: 'rgba(22, 163, 74, 0.2)' }]
        : status === 'Transferred'
          ? [styles.info, isDark && { backgroundColor: 'rgba(21, 45, 94, 0.2)' }]
          : [styles.cancelled, isDark && { backgroundColor: 'rgba(220, 38, 38, 0.2)' }],
    ]}
  >
    <Text style={[styles.badgeText, isDark && {
      color: status === 'Completed' ? '#34D399' :
        status === 'Transferred' ? '#60A5FA' : '#F87171'
    }]}>{label || status}</Text>
  </View>
);

const SkeletonCard = () => (
  <View style={[styles.rideCard, { opacity: 0.5 }]}>
    <View style={styles.rideHeader}>
      <View style={styles.skeletonDate} />
      <View style={styles.skeletonBadge} />
    </View>
    <View style={styles.skeletonRoute} />
    <View style={styles.divider} />
    <View style={styles.footer}>
      <View style={styles.skeletonFooterIcon} />
      <View style={styles.skeletonAmount} />
    </View>
  </View>
);

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },

  summaryCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 16,
    
  },

  summaryLabel: {
    color: '#6B7280',
    fontSize: 14,
  },

  summaryValue: {
    fontSize: 32,
    fontWeight: '800',
    marginVertical: 8,
    color: '#111827',
  },

  tabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },

  activeTab: {
    backgroundColor: '#152D5E',
  },

  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },

  activeTabText: {
    color: '#fff',
  },

  statementCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },

  statementTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },

  statementBtn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  statementBtnText: {
    color: '#fff',
    fontWeight: '600',
  },

  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
  },

  statBox: {
    flex: 1,
    backgroundColor: '#fff',
    marginHorizontal: 4,
    padding: 12,
    borderRadius: 14,
    alignItems: 'center',
  },

  statLabelValue: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 6,
    color: '#111827',
  },

  statSubLabel: {
    fontSize: 12,
    color: '#6B7280',
  },

  payoutCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  payoutTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },

  payoutDate: {
    fontSize: 12,
    color: '#6B7280',
  },

  payoutBtn: {
    backgroundColor: 'rgba(21, 45, 94, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },

  payoutBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },

  sectionTitle: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },

  rideCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 14,
  },

  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  rideDate: {
    fontSize: 12,
    color: '#6B7280',
  },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  success: { backgroundColor: '#DCFCE7' },
  cancelled: { backgroundColor: '#FEE2E2' },
  info: { backgroundColor: '#E0E7FF' },

  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#111827',
  },

  routeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    alignItems: 'center',
  },

  routeText: {
    fontSize: 14,
    color: '#374151',
  },

  txnDescriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },

  txnIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(21, 45, 94, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  txnTitleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },

  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  footerItem: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },

  footerText: {
    fontSize: 13,
    color: '#6B7280',
  },

  amountText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#16A34A',
  },

  debitAmount: {
    color: '#DC2626',
  },

  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  modalDragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 24,
  },
  detailContainer: {
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '700',
  },
  miniBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  successBadge: {
    backgroundColor: '#DCFCE7',
  },
  miniBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16A34A',
    textTransform: 'capitalize',
  },
  paymentMethodLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  refText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  closeBtn: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 32,
  },
  closeBtnText: {
    color: '#374151',
    fontWeight: '700',
    fontSize: 15,
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '600',
  },
  skeletonDate: {
    width: 120,
    height: 12,
    backgroundColor: '#E2E8F0',
    borderRadius: 6,
  },
  skeletonBadge: {
    width: 70,
    height: 18,
    backgroundColor: '#E2E8F0',
    borderRadius: 9,
  },
  skeletonRoute: {
    width: '100%',
    height: 40,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    marginVertical: 4,
  },
  skeletonFooterIcon: {
    width: 60,
    height: 16,
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
  },
  skeletonAmount: {
    width: 50,
    height: 20,
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
  },
});
