import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  ToastAndroid,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppStatusBar from '../../Components/AppStatusBar';
import { useAppTheme } from '../../context/ThemeContext';
import { trigger } from 'react-native-haptic-feedback';
import Clipboard from '@react-native-clipboard/clipboard';
import moment from 'moment';
import RNPrint from 'react-native-print';
import { useSelector } from 'react-redux';

type TransactionType = 'INCENTIVE' | 'PENALTY' | 'REFERRAL_BONUS' | 'WALLET_TOPUP' | 'REFUND';

const getTransactionTitle = (type: TransactionType, title: string) => {
  const t = title?.toLowerCase() || '';
  if (type === 'WALLET_TOPUP' || t.includes('added to wallet') || t.includes('topup')) return 'Added to Wallet';
  if (t.includes('subscription')) return 'Subscription Plan';
  if (type === 'REFERRAL_BONUS' || t.includes('referral') || t.includes('bonus')) return 'Referral Bonus';
  if (t.includes('refund')) return 'Refund Received';
  return title || 'Transaction';
};

const TransactionDetailScreen = ({ navigation, route }: any) => {
  const { isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { transaction } = route.params || {};
  const user = useSelector((state: any) => state.userSlice?.user);

  const handleCopy = (text: string) => {
    Clipboard.setString(text);
    trigger('impactLight');
    if (Platform.OS === 'android') {
      ToastAndroid.show('Copied to clipboard', ToastAndroid.SHORT);
    }
  };

  const handleShareReceipt = async () => {
    if (!transaction) return;
    
    try {
      const isPositive = transaction.amount > 0;
      const formattedAmount = Math.abs(transaction.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 });
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; }
            .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
            .logo { font-size: 36px; font-weight: 800; color: #1D7AF2; letter-spacing: -1px; }
            .title { font-size: 16px; color: #64748B; margin-top: 10px; text-transform: uppercase; letter-spacing: 2px; }
            .content { width: 100%; max-width: 600px; margin: 0 auto; }
            .row { display: flex; justify-content: space-between; border-bottom: 1px solid #f0f0f0; padding: 18px 0; font-size: 16px; }
            .label { font-weight: 500; color: #64748B; }
            .value { font-weight: 700; color: #0F172A; text-align: right; }
            .amount-row { font-size: 20px; border-bottom: 2px solid #333; margin-top: 20px; }
            .amount-row .value { color: #1D7AF2; font-size: 28px; }
            .footer { text-align: center; margin-top: 60px; color: #94A3B8; font-size: 14px; line-height: 1.6; }
            .badge { background: ${isPositive ? '#10B981' : '#EF4444'}; color: white; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
          </style>
        </head>
        <body>
          <div class="content">
            <div class="header">
              <div class="logo">T2drive</div>
              <div class="title">Transaction Receipt</div>
            </div>
            
            <div class="row" style="border: none; padding-bottom: 5px;">
              <span class="label">Status</span>
              <span class="value"><span class="badge">${transaction.status === 'Completed' ? 'Transaction Completed' : (transaction.status || 'Success')}</span></span>
            </div>

            <div class="row">
              <span class="label">Date</span>
              <span class="value">${transaction.date}, ${transaction.time}</span>
            </div>
            <div class="row">
              <span class="label">Transaction ID</span>
              <span class="value">${transaction.id || 'N/A'}</span>
            </div>
            <div class="row">
              <span class="label">Order ID</span>
              <span class="value">${transaction.orderId || transaction.order_id || 'N/A'}</span>
            </div>
            <div class="row">
              <span class="label">Payment ID</span>
              <span class="value">${transaction.paymentId || transaction.payment_id || 'N/A'}</span>
            </div>
            <div class="row">
              <span class="label">Billed To</span>
              <span class="value">${user?.full_name || 'Driver'}<br><span style="font-size:14px; color:#666; font-weight: 500;">${user?.phone_number || ''}</span></span>
            </div>
            <div class="row">
              <span class="label">Payment Method</span>
              <span class="value">${transaction.paymentMethod || 'Online'}</span>
            </div>
            <div class="row">
              <span class="label">Transaction Type</span>
              <span class="value">${getTransactionTitle(transaction.type, transaction.title)}</span>
            </div>
            
            <div class="row amount-row">
              <span class="label" style="color: #0F172A; align-self: center;">Amount ${isPositive ? 'Credited' : 'Debited'}</span>
              <span class="value">₹${formattedAmount}</span>
            </div>
            
            <div class="footer">
              Thank you for using T2drive!<br>
              This is a computer generated receipt and does not require a physical signature.<br><br>
              <strong>Need help?</strong> Contact support in the T2drive app.
            </div>
          </div>
        </body>
        </html>
      `;
      
      await RNPrint.print({
        html: htmlContent,
        jobName: `T2drive_Receipt_${transaction.id || 'Transaction'}`,
      });
    } catch (error) {
      console.log('Print dismissed or failed', error);
    }
  };

  if (!transaction) return null;

  const isPositive = transaction.amount > 0;
  const amountColor = isPositive ? '#16a34a' : (isDark ? '#ffffff' : '#0f172a');
  const closingBalance = transaction.closingBalance || 0;
  const prevBalance = closingBalance - transaction.amount;
  const formattedAmount = Math.abs(transaction.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const formattedClosing = closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const formattedPrev = prevBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 });

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#fafafa' }]}>
      <AppStatusBar backgroundColor="transparent" barStyle={isDark ? "light-content" : "dark-content"} />

      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: isDark ? '#111827' : '#fafafa' }]}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: isDark ? '#1F2937' : '#fff' }]}>
            <Ionicons name="arrow-back" size={20} color={isDark ? "#ffffff" : "#0f172a"} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: isDark ? "#ffffff" : "#0f172a" }]}>Transaction Details</Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>

        {/* Top Greenish Card */}
        <View style={[styles.topCard, { backgroundColor: isDark ? '#1F2937' : '#f4fbf4', borderColor: isDark ? '#374151' : '#e5f3e7' }]}>
          <View style={styles.topCardRow1}>
            <View style={styles.topCardIconWrap}>
              <View style={[styles.iconCircle, { backgroundColor: isPositive ? '#dcfce7' : '#fee2e2' }]}>
                <Ionicons name={isPositive ? "wallet" : "pricetag-outline"} size={28} color={isPositive ? "#16a34a" : "#475569"} />
                {isPositive && (
                  <View style={[styles.plusIconBadge, { borderColor: isDark ? '#1F2937' : '#f4fbf4', backgroundColor: isDark ? '#1F2937' : '#fff' }]}>
                    <Ionicons name="add" size={14} color="#16a34a" />
                  </View>
                )}
              </View>
            </View>

            <View style={styles.topCardMiddle}>
              <View style={[styles.rowSpaceBetween, { alignItems: 'center' }]}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={[styles.topCardTitle, { color: isDark ? '#FFF' : '#1e293b', marginBottom: 2 }]}>
                    {getTransactionTitle(transaction.type, transaction.title)}
                  </Text>
                  <Text style={[styles.dateText, { color: isDark ? '#9ca3af' : '#64748b', marginBottom: 4 }]}>
                    {transaction.date}, {transaction.time}
                  </Text>
                  <View style={styles.statusRow}>
                    <Text style={[styles.statusText, { color: isPositive ? '#16a34a' : '#DC2626' }]}>
                      {transaction.status === 'Completed' ? 'Transaction Completed' : transaction.status}
                    </Text>
                    <Ionicons name={isPositive ? "checkmark-circle" : "close-circle"} size={12} color={isPositive ? "#16a34a" : "#DC2626"} style={{ marginLeft: 4 }} />
                  </View>
                </View>

                <Text style={[styles.topCardAmount, { color: amountColor }]}>
                  {isPositive ? '+' : '-'} ₹{formattedAmount}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Transaction Overview */}
        <Text style={[styles.sectionTitle, { color: isDark ? '#e2e8f0' : '#334155' }]}>Transaction Overview</Text>
        <View style={[styles.detailsCard, { backgroundColor: isDark ? '#1F2937' : '#ffffff', borderColor: isDark ? '#374151' : '#f1f5f9' }]}>

          <View style={styles.overviewRowDouble}>
            <Ionicons name="card-outline" size={20} color="#64748B" style={styles.overviewIcon} />
            <View style={styles.overviewCol}>
              <Text style={styles.overviewLabelGray}>Payment Method</Text>
              <Text style={[styles.overviewValueBlack, { color: isDark ? '#f8fafc' : '#0f172a' }]}>{transaction.paymentMethod || 'Razorpay'}</Text>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: isDark ? '#374151' : '#f1f5f9' }]} />

          <View style={styles.overviewRowDouble}>
            <Ionicons name="wallet-outline" size={20} color="#16a34a" style={styles.overviewIcon} />
            <View style={styles.overviewCol}>
              <Text style={styles.overviewLabelGray}>Paid To</Text>
              <Text style={[styles.overviewValueBlack, { color: isDark ? '#f8fafc' : '#0f172a' }]}>T2Drive Wallet</Text>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: isDark ? '#374151' : '#f1f5f9' }]} />

          <View style={styles.overviewRowSingle}>
            <View style={styles.rowCenter}>
              <Ionicons name="cash-outline" size={20} color="#16a34a" style={styles.overviewIcon} />
              <Text style={[styles.overviewLabelBlack, { color: isDark ? '#cbd5e1' : '#334155' }]}>Amount</Text>
            </View>
            <Text style={[styles.overviewValueBlack, { color: isDark ? '#f8fafc' : '#0f172a' }]}>₹{formattedAmount}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: isDark ? '#374151' : '#f1f5f9' }]} />

          <View style={styles.overviewRowSingle}>
            <View style={styles.rowCenter}>
              <Ionicons name="receipt-outline" size={20} color="#64748B" style={styles.overviewIcon} />
              <Text style={[styles.overviewLabelBlack, { color: isDark ? '#cbd5e1' : '#334155' }]}>Convenience Fee</Text>
            </View>
            <Text style={[styles.overviewValueBlack, { color: isDark ? '#f8fafc' : '#0f172a' }]}>₹0.00</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: isDark ? '#374151' : '#f1f5f9' }]} />

          <View style={styles.overviewRowSingle}>
            <Text style={[styles.overviewLabelBold, { color: isDark ? '#f8fafc' : '#0f172a' }]}>Total Amount</Text>
            <Text style={styles.overviewValueGreen}>₹{formattedAmount}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: isDark ? '#374151' : '#f1f5f9' }]} />

          <View style={styles.overviewRowSingle}>
            <Text style={[styles.overviewLabelBlack, { color: isDark ? '#cbd5e1' : '#334155', fontWeight: '600' }]}>Previous Balance</Text>
            <Text style={[styles.overviewValueBlack, { color: isDark ? '#cbd5e1' : '#475569' }]}>₹{formattedPrev}</Text>
          </View>

          <View style={[styles.newBalanceRow, { backgroundColor: isDark ? 'rgba(22,163,74,0.1)' : '#f4fbf4' }]}>
            <Text style={[styles.overviewLabelBold, { color: isDark ? '#f8fafc' : '#0f172a' }]}>New Wallet Balance</Text>
            <Text style={styles.overviewValueGreen}>₹{formattedClosing}</Text>
          </View>
        </View>

        {/* Payment Details */}
        <Text style={[styles.sectionTitle, { color: isDark ? '#e2e8f0' : '#334155', marginTop: 12 }]}>Payment Details</Text>
        <View style={[styles.detailsCard, { backgroundColor: isDark ? '#1F2937' : '#ffffff', borderColor: isDark ? '#374151' : '#f1f5f9' }]}>

          {/* Transaction ID */}
          <View style={styles.detailsRow}>
            <Text style={styles.detailsLabel}>Transaction ID</Text>
            {transaction.id ? (
              <View style={styles.idValueRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.idScrollView} contentContainerStyle={styles.idScrollContent}>
                  <Text style={[styles.detailsValueMono, { color: isDark ? '#f8fafc' : '#0f172a' }]}>#{String(transaction.id)}</Text>
                </ScrollView>
                <Pressable onPress={() => handleCopy(String(transaction.id))} hitSlop={8}>
                  <Ionicons name="copy-outline" size={14} color="#64748B" style={{ marginLeft: 8 }} />
                </Pressable>
              </View>
            ) : (
              <Text style={[styles.detailsValue, { color: isDark ? '#6b7280' : '#94a3b8' }]}>—</Text>
            )}
          </View>
          <View style={[styles.divider, { backgroundColor: isDark ? '#374151' : '#f1f5f9' }]} />

          {/* Order ID */}
          <View style={styles.detailsRow}>
            <Text style={styles.detailsLabel}>Order ID</Text>
            {(transaction.orderId || transaction.order_id) ? (
              <View style={styles.idValueRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.idScrollView} contentContainerStyle={styles.idScrollContent}>
                  <Text style={[styles.detailsValueMono, { color: isDark ? '#f8fafc' : '#0f172a' }]}>{transaction.orderId || transaction.order_id}</Text>
                </ScrollView>
                <Pressable onPress={() => handleCopy(transaction.orderId || transaction.order_id)} hitSlop={8}>
                  <Ionicons name="copy-outline" size={14} color="#64748B" style={{ marginLeft: 8 }} />
                </Pressable>
              </View>
            ) : (
              <Text style={[styles.detailsValue, { color: isDark ? '#6b7280' : '#94a3b8' }]}>—</Text>
            )}
          </View>
          <View style={[styles.divider, { backgroundColor: isDark ? '#374151' : '#f1f5f9' }]} />

          {/* Payment ID */}
          <View style={styles.detailsRow}>
            <Text style={styles.detailsLabel}>Payment ID</Text>
            {(transaction.paymentId || transaction.payment_id) ? (
              <View style={styles.idValueRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.idScrollView} contentContainerStyle={styles.idScrollContent}>
                  <Text style={[styles.detailsValueMono, { color: isDark ? '#f8fafc' : '#0f172a' }]}>{transaction.paymentId || transaction.payment_id}</Text>
                </ScrollView>
                <Pressable onPress={() => handleCopy(transaction.paymentId || transaction.payment_id)} hitSlop={8}>
                  <Ionicons name="copy-outline" size={14} color="#64748B" style={{ marginLeft: 8 }} />
                </Pressable>
              </View>
            ) : (
              <Text style={[styles.detailsValue, { color: isDark ? '#6b7280' : '#94a3b8' }]}>—</Text>
            )}
          </View>
          <View style={[styles.divider, { backgroundColor: isDark ? '#374151' : '#f1f5f9' }]} />

          {/* Status */}
          <View style={styles.detailsRow}>
            <Text style={styles.detailsLabel}>Status</Text>
            <View style={styles.statusBadge}>
              <Ionicons name="checkmark-circle" size={12} color="#FFF" />
              <Text style={styles.statusBadgeText}>{transaction.status || 'Success'}</Text>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: isDark ? '#374151' : '#f1f5f9' }]} />

          {/* Remarks */}
          <View style={styles.detailsRow}>
            <Text style={styles.detailsLabel}>Remarks</Text>
            <Text style={[styles.detailsValue, { color: isDark ? '#f8fafc' : '#0f172a' }]}>{transaction.remarks || 'Money added to wallet'}</Text>
          </View>
        </View>

        {/* Need Help Card */}
        <View style={[styles.helpCard, { backgroundColor: isDark ? '#1F2937' : '#f4fbf4', borderColor: isDark ? '#374151' : '#e5f3e7' }]}>
          <View style={[styles.helpIconWrap, { backgroundColor: isDark ? '#374151' : '#fff' }]}>
            <Ionicons name="headset" size={16} color="#16a34a" />
          </View>
          <View style={styles.helpTextCol}>
            <Text style={[styles.helpTitle, { color: isDark ? '#fff' : '#0f172a' }]}>Need Help?</Text>
            <Text style={[styles.helpDesc, { color: isDark ? '#9ca3af' : '#475569' }]}>If you have any issues with this transaction, our support team is here to help.</Text>
          </View>
          <Pressable style={[styles.contactBtn, { backgroundColor: isDark ? '#1F2937' : '#fff' }]}>
            <Text style={styles.contactBtnText}>Contact Support</Text>
          </Pressable>
        </View>

        {/* Share Receipt Button */}
        <Pressable 
          style={({ pressed }) => [styles.shareBtn, { backgroundColor: isDark ? '#374151' : '#f1f5f9' }, pressed && { opacity: 0.7 }]} 
          onPress={handleShareReceipt}
        >
          <Ionicons name="share-social-outline" size={20} color={isDark ? '#e2e8f0' : '#0f172a'} style={{ marginRight: 8 }} />
          <Text style={[styles.shareBtnText, { color: isDark ? '#e2e8f0' : '#0f172a' }]}>Share receipt</Text>
        </Pressable>

      </ScrollView>
    </View>
  );
};

export default TransactionDetailScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    marginRight: 16,
    borderRadius: 24,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  topCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  topCardRow1: {
    flexDirection: 'row',
  },
  topCardIconWrap: {
    marginRight: 16,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  plusIconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    borderRadius: 12,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  topCardMiddle: {
    flex: 1,
  },
  rowSpaceBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  topCardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  topCardAmount: {
    fontSize: 20,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 12,
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  idValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '55%',
  },
  idScrollView: {
    flexShrink: 1,
  },
  idScrollContent: {
    alignItems: 'center',
  },
  txnIdText: {
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  detailsCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  overviewRowDouble: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
  },
  overviewIcon: {
    marginRight: 16,
    marginTop: 2,
  },
  overviewCol: {
    flex: 1,
  },
  overviewLabelGray: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 4,
  },
  overviewValueBlack: {
    fontSize: 14,
    fontWeight: '500',
  },
  overviewRowSingle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overviewLabelBlack: {
    fontSize: 14,
  },
  overviewLabelBold: {
    fontSize: 15,
    fontWeight: '700',
  },
  overviewValueGreen: {
    fontSize: 15,
    fontWeight: '700',
    color: '#16a34a',
  },
  newBalanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  divider: {
    height: 1,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  detailsLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  detailsValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  detailsValueMono: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flexShrink: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16a34a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  helpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 32,
  },
  helpIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  helpTextCol: {
    flex: 1,
    marginRight: 12,
  },
  helpTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  helpDesc: {
    fontSize: 11,
    lineHeight: 14,
  },
  contactBtn: {
    borderWidth: 1,
    borderColor: '#16a34a',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  contactBtnText: {
    color: '#16a34a',
    fontSize: 12,
    fontWeight: '600',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  shareBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

