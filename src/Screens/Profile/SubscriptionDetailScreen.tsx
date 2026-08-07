import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ImageBackground,
  Platform,
  ToastAndroid,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AppStatusBar from '../../Components/AppStatusBar';
import { trigger } from 'react-native-haptic-feedback';
import Clipboard from '@react-native-clipboard/clipboard';
import RNPrint from 'react-native-print';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';

/* ================= HELPERS ================= */

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTime = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const getBillingCycleLabel = (cycle: string) => {
  if (cycle === 'day') return 'Daily Subscription';
  if (cycle === 'week') return 'Weekly Subscription';
  if (cycle === 'month') return 'Monthly Subscription';
  return cycle;
};

const getStatusDisplay = (status: string) => {
  const s = status?.toLowerCase();
  if (s === 'active') return { label: 'Active', bg: '#E8F5E9', color: '#2E7D32', dotColor: '#2E7D32' };
  if (s === 'expired') return { label: 'Expired', bg: '#F3F4F6', color: '#4B5563', dotColor: '#4B5563' };
  if (s === 'cancelled') return { label: 'Cancelled', bg: '#FEE2E2', color: '#DC2626', dotColor: '#DC2626' };
  return { label: status, bg: '#F3F4F6', color: '#4B5563', dotColor: '#4B5563' };
};

const getPlanColors = (planName: string) => {
  const name = (planName || '').toLowerCase();
  if (name.includes('basic')) return { iconColor: '#2563EB', iconBg: '#EFF6FF', gradientBg: '#EFF6FF' };
  if (name.includes('elite')) return { iconColor: '#10B981', iconBg: '#ECFDF5', gradientBg: '#ECFDF5' };
  if (name.includes('premium')) return { iconColor: '#D97706', iconBg: '#FEF3C7', gradientBg: '#FEF3C7' };
  return { iconColor: '#2E7D32', iconBg: '#E8F5E9', gradientBg: '#E8F5E9' };
};

const getAmount = (item: any) => {
  const cycle = item.billing_cycle;
  if (cycle === 'day' && item.daily_price) return Number(item.daily_price);
  if (cycle === 'week' && item.weekly_price) return Number(item.weekly_price);
  if (cycle === 'month' && item.monthly_price) return Number(item.monthly_price);
  return Number(item.monthly_price || item.weekly_price || item.daily_price || 0);
};

const PLAN_BENEFITS = [
  'All ride types (Local, Outstation, Rental)',
  'Priority ride requests',
  'Higher earnings opportunities',
  '24/7 Priority support',
  'Exclusive partner offers',
];

const getFeaturesList = (features: any): string[] => {
  if (!features) return PLAN_BENEFITS;
  if (Array.isArray(features)) return features;
  if (typeof features === 'string') {
    try {
      if (features.trim().startsWith('[')) {
        const parsed = JSON.parse(features);
        if (Array.isArray(parsed)) return parsed;
      }
      return features.split(',').map(s => s.trim()).filter(Boolean);
    } catch (e) {
      return [features];
    }
  }
  return PLAN_BENEFITS;
};

/* ================= SCREEN ================= */

const SubscriptionDetailScreen = ({ navigation, route }: any) => {
  const insets = useSafeAreaInsets();
  const item = route.params?.item || {};
  const user = useSelector((state: RootState) => state.userSlice?.user);
  
  const [showAllBenefits, setShowAllBenefits] = useState(false);

  const planColors = getPlanColors(item.plan_name);
  const statusDisplay = getStatusDisplay(item.status);
  const amount = getAmount(item);
  const formattedAmount = amount.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const planDisplayName = (item.plan_name || '').charAt(0).toUpperCase() + (item.plan_name || '').slice(1) + ' Plan';
  
  const isWallet = item.payment_method?.toLowerCase() === 'wallet' || item.payment_type?.toLowerCase() === 'wallet' || item.razorpay_payment_id === 'Wallet Payment' || item.payment_id === 'Wallet Payment';
  const paymentMethod = isWallet ? 'Wallet' : (item.payment_method || 'Online Payment');
  const paymentId = isWallet ? 'Wallet Transaction' : (item.razorpay_payment_id || item.payment_id || 'N/A');
  const orderId = item.razorpay_order_id || item.order_id || 'N/A';

  const handleCopy = (text: string) => {
    if (!text) return;
    Clipboard.setString(text);
    trigger('impactLight');
    if (Platform.OS === 'android') {
      ToastAndroid.show('Copied to clipboard', ToastAndroid.SHORT);
    }
  };

  const handleDownloadInvoice = async () => {
    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; }
            .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
            .logo { font-size: 36px; font-weight: 800; color: #2E7D32; letter-spacing: -1px; }
            .title { font-size: 16px; color: #64748B; margin-top: 10px; text-transform: uppercase; letter-spacing: 2px; }
            .content { width: 100%; max-width: 600px; margin: 0 auto; }
            .row { display: flex; justify-content: space-between; border-bottom: 1px solid #f0f0f0; padding: 18px 0; font-size: 16px; }
            .label { font-weight: 500; color: #64748B; }
            .value { font-weight: 700; color: #0F172A; text-align: right; }
            .amount-row { font-size: 20px; border-bottom: 2px solid #333; margin-top: 20px; }
            .amount-row .value { color: #2E7D32; font-size: 28px; }
            .footer { text-align: center; margin-top: 60px; color: #94A3B8; font-size: 14px; line-height: 1.6; }
            .badge { background: #2E7D32; color: white; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="content">
            <div class="header">
              <div class="logo">T2drive</div>
              <div class="title">Subscription Invoice</div>
            </div>
            <div class="row" style="border: none; padding-bottom: 5px;">
              <span class="label">Status</span>
              <span class="value"><span class="badge">${statusDisplay.label}</span></span>
            </div>
            <div class="row">
              <span class="label">Plan</span>
              <span class="value">${planDisplayName}</span>
            </div>
            <div class="row">
              <span class="label">Billing Cycle</span>
              <span class="value">${getBillingCycleLabel(item.billing_cycle)}</span>
            </div>
            <div class="row">
              <span class="label">Start Date</span>
              <span class="value">${formatDate(item.start_date)}</span>
            </div>
            <div class="row">
              <span class="label">Expiry Date</span>
              <span class="value">${formatDate(item.expiry_date)}</span>
            </div>
            <div class="row">
              <span class="label">Billed To</span>
              <span class="value">${user?.full_name || 'Driver'}<br><span style="font-size:14px; color:#666; font-weight: 500;">${user?.phone_number || ''}</span></span>
            </div>
            ${paymentId !== 'N/A' ? `<div class="row">
              <span class="label">Payment ID</span>
              <span class="value">${paymentId}</span>
            </div>` : ''}
            ${orderId !== 'N/A' ? `<div class="row">
              <span class="label">Order ID</span>
              <span class="value">${orderId}</span>
            </div>` : ''}
            <div class="row amount-row">
              <span class="label" style="color: #0F172A; align-self: center;">Total Amount Paid</span>
              <span class="value">₹${formattedAmount}</span>
            </div>
            <div class="footer">
              Thank you for subscribing to T2drive!<br>
              This is a computer generated invoice and does not require a physical signature.<br><br>
              <strong>Need help?</strong> Contact support in the T2drive app.
            </div>
          </div>
        </body>
        </html>
      `;

      await RNPrint.print({
        html: htmlContent,
        jobName: `T2drive_Invoice_${paymentId !== 'N/A' ? paymentId : 'Subscription'}`,
      });
    } catch (error) {
      console.log('Print dismissed or failed', error);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppStatusBar backgroundColor="#FFFFFF" barStyle="dark-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* ─── HEADER ─── */}
        <ImageBackground
          source={require('../../assets/images/subhis.png')}
          style={[styles.headerBg, { paddingTop: 10 }]}
          imageStyle={styles.headerImageStyle}
        >
          <View style={styles.headerRow}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#000" />
            </Pressable>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>Subscription Details</Text>
              <Text style={styles.headerSubtitle}>
                View detailed information about your{'\n'}subscription
              </Text>
            </View>
          </View>
        </ImageBackground>

        {/* ─── PLAN CARD (COMBINED) ─── */}
        <View style={styles.planCard}>
          <View style={styles.planCardTop}>
            <View style={[styles.planIconWrap, { backgroundColor: planColors.iconBg }]}>
              <MaterialCommunityIcons name="crown" size={32} color={planColors.iconColor} />
            </View>
            <View style={styles.planInfo}>
              <Text style={styles.planName}>{planDisplayName}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusDisplay.bg }]}>
                <View style={[styles.statusDot, { backgroundColor: statusDisplay.dotColor }]} />
                <Text style={[styles.statusBadgeText, { color: statusDisplay.color }]}>
                  {statusDisplay.label}
                </Text>
              </View>
              <Text style={styles.billingCycleText}>
                {getBillingCycleLabel(item.billing_cycle)}
              </Text>
            </View>
            <View style={styles.planPriceWrap}>
              <Text style={styles.planPrice}>₹{formattedAmount}</Text>
              {item.auto_renew && item.status?.toLowerCase() === 'active' && (
                <View style={styles.autoRenewBadge}>
                  <Text style={styles.autoRenewText}>Auto-renewal ON</Text>
                  <Ionicons name="sync" size={12} color="#2E7D32" style={{ marginLeft: 4 }} />
                </View>
              )}
            </View>
          </View>

          {/* Divider between Plan Info and Dates */}
          <View style={styles.planCardDivider} />

          {/* Dates Row inside Plan Card */}
          <View style={styles.dateCardsRow}>
            <View style={styles.dateCardLeft}>
              <View style={[styles.dateIconWrap, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="calendar-outline" size={22} color="#2E7D32" />
              </View>
              <View style={styles.dateTextWrap}>
                <Text style={styles.dateLabel}>Start Date</Text>
                <Text style={styles.dateValue}>{formatDate(item.start_date)}</Text>
                <Text style={styles.dateTime}>{formatTime(item.start_date)}</Text>
              </View>
            </View>
            
            <View style={styles.verticalDivider} />

            <View style={styles.dateCardRight}>
              <View style={[styles.dateIconWrap, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="calendar-outline" size={22} color="#2E7D32" />
              </View>
              <View style={styles.dateTextWrap}>
                <Text style={styles.dateLabel}>Next Billing Date</Text>
                <Text style={styles.dateValue}>{formatDate(item.expiry_date)}</Text>
                <Text style={styles.dateTime}>{formatTime(item.expiry_date)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── PLAN BENEFITS ─── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Plan Benefits</Text>
          <View style={styles.benefitsContainer}>
            <View style={styles.benefitsList}>
              {(() => {
                const allFeatures = getFeaturesList(item.features);
                const visibleFeatures = showAllBenefits ? allFeatures : allFeatures.slice(0, 2);
                
                return (
                  <>
                    {visibleFeatures.map((benefit: string, index: number) => (
                      <View key={index} style={styles.benefitRow}>
                        <View style={styles.benefitCheckWrap}>
                          <Ionicons name="checkmark-circle" size={22} color="#2E7D32" />
                        </View>
                        <Text style={styles.benefitText}>{benefit}</Text>
                      </View>
                    ))}
                    {allFeatures.length > 2 && (
                      <Pressable 
                        onPress={() => setShowAllBenefits(!showAllBenefits)}
                        style={styles.viewAllBtn}
                      >
                        <Text style={styles.viewAllText}>
                          {showAllBenefits ? 'View Less' : `View All (${allFeatures.length})`}
                        </Text>
                        <Ionicons 
                          name={showAllBenefits ? 'chevron-up' : 'chevron-down'} 
                          size={16} 
                          color="#2563EB" 
                          style={{ marginLeft: 4 }} 
                        />
                      </Pressable>
                    )}
                  </>
                );
              })()}
            </View>
            {/* Decorative shield icon */}
            <View style={styles.benefitsDecorative}>
              <View style={styles.shieldWrap}>
                <Ionicons name="shield-checkmark" size={56} color="#D1FAE5" />
              </View>
            </View>
          </View>
        </View>

        {/* ─── PAYMENT SUMMARY ─── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Payment Summary</Text>

          {/* Plan Amount */}
          <View style={styles.paymentRow}>
            <View style={styles.paymentRowLeft}>
              <View style={[styles.paymentIconWrap, { backgroundColor: '#F3F4F6' }]}>
                <Ionicons name="receipt-outline" size={18} color="#6B7280" />
              </View>
              <Text style={styles.paymentLabel}>Plan Amount</Text>
            </View>
            <Text style={styles.paymentValue}>₹{formattedAmount}</Text>
          </View>

          <View style={styles.paymentDivider} />

          {/* Discount */}
          <View style={styles.paymentRow}>
            <View style={styles.paymentRowLeft}>
              <View style={[styles.paymentIconWrap, { backgroundColor: '#F3F4F6' }]}>
                <MaterialCommunityIcons name="sale" size={18} color="#6B7280" />
              </View>
              <Text style={styles.paymentLabel}>Discount</Text>
            </View>
            <Text style={[styles.paymentValue, { color: '#2E7D32' }]}>-₹0.00</Text>
          </View>

          <View style={styles.paymentDivider} />

          {/* Total Paid */}
          <View style={styles.paymentRow}>
            <View style={styles.paymentRowLeft}>
              <View style={[styles.paymentIconWrap, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="checkmark-circle" size={18} color="#2E7D32" />
              </View>
              <Text style={[styles.paymentLabel, { fontWeight: '700', color: '#111827' }]}>Total Paid</Text>
            </View>
            <Text style={[styles.paymentValue, { fontWeight: '700' }]}>₹{formattedAmount}</Text>
          </View>

          <View style={styles.paymentDivider} />

          {/* Payment Method */}
          <View style={styles.paymentRow}>
            <View style={styles.paymentRowLeft}>
              <View style={[styles.paymentIconWrap, { backgroundColor: '#F3F4F6' }]}>
                <Ionicons name="card-outline" size={18} color="#6B7280" />
              </View>
              <Text style={styles.paymentLabel}>Payment Method</Text>
            </View>
            <Text style={styles.paymentValue}>{paymentMethod}</Text>
          </View>

          <View style={styles.paymentDivider} />

          {/* Payment ID */}
          <View style={styles.paymentRow}>
            <View style={styles.paymentRowLeft}>
              <View style={[styles.paymentIconWrap, { backgroundColor: '#F3F4F6' }]}>
                <Ionicons name="document-text-outline" size={18} color="#6B7280" />
              </View>
              <Text style={styles.paymentLabel}>Payment ID</Text>
            </View>
            <View style={styles.txnIdRow}>
              <Text style={styles.txnIdText} numberOfLines={1}>
                {paymentId !== 'N/A' ? paymentId.slice(0, 14) : 'N/A'}
              </Text>
              {paymentId !== 'N/A' && (
                <Pressable onPress={() => handleCopy(paymentId)} hitSlop={8}>
                  <Ionicons name="copy-outline" size={16} color="#9CA3AF" style={{ marginLeft: 6 }} />
                </Pressable>
              )}
            </View>
          </View>

          <View style={styles.paymentDivider} />

          {/* Order ID */}
          <View style={styles.paymentRow}>
            <View style={styles.paymentRowLeft}>
              <View style={[styles.paymentIconWrap, { backgroundColor: '#F3F4F6' }]}>
                <Ionicons name="receipt-outline" size={18} color="#6B7280" />
              </View>
              <Text style={styles.paymentLabel}>Order ID</Text>
            </View>
            <View style={styles.txnIdRow}>
              <Text style={styles.txnIdText} numberOfLines={1}>
                {orderId !== 'N/A' ? orderId.slice(0, 14) : 'N/A'}
              </Text>
              {orderId !== 'N/A' && (
                <Pressable onPress={() => handleCopy(orderId)} hitSlop={8}>
                  <Ionicons name="copy-outline" size={16} color="#9CA3AF" style={{ marginLeft: 6 }} />
                </Pressable>
              )}
            </View>
          </View>
        </View>

        {/* ─── SECURE PAYMENTS BADGE ─── */}
        <View style={styles.secureBadge}>
          <View style={styles.secureIconWrap}>
            <Ionicons name="checkmark-circle" size={28} color="#2E7D32" />
          </View>
          <View style={styles.secureTextWrap}>
            <Text style={styles.secureTitle}>100% Secure Payments</Text>
            <Text style={styles.secureSubtitle}>
              Your payment and data are always safe with us.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ─── BOTTOM BUTTONS ─── */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          style={({ pressed }) => [styles.outlineBtn, pressed && { opacity: 0.7 }]}
          onPress={handleDownloadInvoice}
        >
          <Ionicons name="download-outline" size={18} color="#2E7D32" style={{ marginRight: 6 }} />
          <Text style={styles.outlineBtnText}>Download Invoice</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.filledBtn, pressed && { opacity: 0.8 }]}
          onPress={() => navigation.navigate('RechargePlanScreen')}
        >
          <Text style={styles.filledBtnText}>Manage Subscription</Text>
          <Ionicons name="settings-outline" size={16} color="#FFF" style={{ marginLeft: 6 }} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

export default SubscriptionDetailScreen;

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  /* Header */
  headerBg: {
    width: '100%',
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  headerImageStyle: {
    opacity: 0.9,
    resizeMode: 'cover',
  },
  headerRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    alignItems: 'flex-start',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginTop: 4,
  },
  headerTextWrap: {
    marginLeft: 16,
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },

  /* Plan Card */
  planCard: {
    marginHorizontal: 16,
    marginTop: -16,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  planCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  planIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  billingCycleText: {
    fontSize: 13,
    color: '#6B7280',
  },
  planPriceWrap: {
    alignItems: 'flex-end',
  },
  planPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  autoRenewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  autoRenewText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2E7D32',
  },

  planCardDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 8,
  },
  
  /* Date Cards */
  dateCardsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateCardRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
  },
  verticalDivider: {
    width: 1,
    height: '100%',
    backgroundColor: '#F3F4F6',
    marginHorizontal: 8,
  },
  dateIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  dateTextWrap: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 1,
  },
  dateTime: {
    fontSize: 11,
    color: '#9CA3AF',
  },

  /* Section Card */
  sectionCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },

  /* Benefits */
  benefitsContainer: {
    flexDirection: 'row',
  },
  benefitsList: {
    flex: 1,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  benefitCheckWrap: {
    marginRight: 12,
  },
  benefitText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    marginTop: 4,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  benefitsDecorative: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldWrap: {
    opacity: 0.6,
  },

  /* Payment Summary */
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  paymentRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paymentLabel: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500',
  },
  paymentValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  paymentDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  txnIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txnIdText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  /* Secure Badge */
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  secureIconWrap: {
    marginRight: 12,
  },
  secureTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  secureSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  secureTextWrap: {
    flex: 1,
  },

  /* Bottom Bar */
  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 8,
    gap: 12,
  },
  outlineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  outlineBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  filledBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2E7D32',
  },
  filledBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
