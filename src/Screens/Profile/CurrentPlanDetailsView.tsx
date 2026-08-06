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

/* ================= HELPERS ================= */

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTime = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const getBillingCycleLabel = (cycle: string) => {
  if (cycle === 'day') return 'Daily Subscription';
  if (cycle === 'week') return 'Weekly Subscription';
  if (cycle === 'month') return 'Monthly Subscription';
  return 'Subscription';
};

const getAmount = (item: any) => {
  if (item.amount) return Number(item.amount);
  
  if (item.plan) {
    const cycle = item.billing_cycle;
    if (cycle === 'day' || cycle === 'daily') return Number(item.plan.daily_price || 0);
    if (cycle === 'week' || cycle === 'weekly') return Number(item.plan.weekly_price || 0);
    if (cycle === 'month' || cycle === 'monthly') return Number(item.plan.monthly_price || 0);
  }

  const priceField = `${item.billing_cycle}_price`;
  if (item[priceField]) return Number(item[priceField]);
  if (item.monthly_price) return Number(item.monthly_price);
  return 0;
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

export default function CurrentPlanDetailsView({ activePlan, user, onManagePlan }: any) {
  const insets = useSafeAreaInsets();
  const item = activePlan || {};

  const [showAllBenefits, setShowAllBenefits] = useState(false);

  const discountAmount = Number(item.discount_amount || 0);
  const totalPaid = getAmount(item);
  const planAmount = totalPaid + discountAmount;

  const formattedPlanAmount = planAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const formattedDiscount = discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const formattedTotalPaid = totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 });

  const planName = item.plan?.name || item.plan_name || 'Premium';
  const planDisplayName = planName.charAt(0).toUpperCase() + planName.slice(1) + ' Plan';

  const lowerName = planName.toLowerCase();
  let topCardColor = '#2E7D32'; // Default Premium (Green)
  if (lowerName.includes('basic')) {
    topCardColor = '#2563EB'; // Blue
  } else if (lowerName.includes('elite')) {
    topCardColor = '#2E7D32'; // Green
  }

  const paymentMethod = item.payment_method || 'Online Payment';
  const paymentId = item.razorpay_payment_id || item.payment_id || item.razorpay_subscription_id || 'N/A';
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
          </style>
        </head>
        <body>
          <div class="content">
            <div class="header">
              <div class="logo">T2drive</div>
              <div class="title">Subscription Invoice</div>
            </div>
            <div class="row">
              <span class="label">Plan Details</span>
              <span class="value">${planDisplayName}<br><span style="font-size:14px; color:#666; font-weight: 500;">${getBillingCycleLabel(item.billing_cycle)}</span></span>
            </div>
            <div class="row">
              <span class="label">Start Date</span>
              <span class="value">${formatDate(item.start_date)} ${formatTime(item.start_date)}</span>
            </div>
            <div class="row">
              <span class="label">Billed To</span>
              <span class="value">${user?.full_name || 'Driver'}<br><span style="font-size:14px; color:#666; font-weight: 500;">${user?.phone_number || ''}</span></span>
            </div>
            <div class="row">
              <span class="label">Auto Renewal</span>
              <span class="value">${item.auto_renew ? 'Active' : 'Cancelled'}</span>
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
              <span class="value">₹${formattedTotalPaid}</span>
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
    <ImageBackground
      source={require('../../assets/images/subhis.png')}
      style={{ flex: 1 }}
      imageStyle={{ opacity: 0.15, resizeMode: 'cover' }}
    >
      <SafeAreaView style={styles.containerTrans} edges={['top']}>
        <AppStatusBar backgroundColor="transparent" translucent={true} barStyle="dark-content" />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        >
          {/* ─── HEADER ─── */}
          <View style={[styles.headerBg, { paddingTop: 10 }]}>
            <View style={styles.headerRow}>
              <View style={styles.headerTextWrap}>
                <Text style={styles.headerTitle}>Current Plan Details</Text>
                <Text style={styles.headerSubtitle}>
                  View all information about your{'\n'}active subscription
                </Text>
              </View>
            </View>
          </View>

          {/* ─── PLAN CARD (GREEN/BLUE/VIOLET & WHITE SPLIT) ─── */}
          <View style={styles.planCard}>
            <View style={[styles.planCardLeft, { backgroundColor: topCardColor }]}>
              <MaterialCommunityIcons name="crown" size={32} color="#FBBF24" />
              <Text style={styles.planNameTextWhite}>{planName.toUpperCase()} PLAN</Text>
              <View style={styles.activeBadgeWhite}>
                <Ionicons name="checkmark-circle" size={14} color="#FFF" />
                <Text style={styles.activeBadgeTextWhite}>Active</Text>
              </View>
            </View>
            <View style={styles.planCardRight}>
              <View style={styles.planCardRightCol1}>
                <Text style={styles.planPriceBig}>₹{formattedPlanAmount}</Text>
                <Text style={styles.planPriceSub}>{getBillingCycleLabel(item.billing_cycle)}</Text>
              </View>
              <View style={styles.verticalDivider} />
              <View style={styles.planCardRightCol2}>
                <View style={[styles.shieldIconWrap, { backgroundColor: item.auto_renew ? '#E8F5E9' : '#FEE2E2' }]}>
                  <Ionicons name={item.auto_renew ? "shield-checkmark-outline" : "shield-half-outline"} size={24} color={item.auto_renew ? "#2E7D32" : "#EF4444"} />
                </View>
                <Text style={[styles.autoRenewTextGreen, { color: item.auto_renew ? '#2E7D32' : '#EF4444' }]}>
                  Auto-renewal {item.auto_renew ? 'ON' : 'OFF'}
                </Text>
              </View>
            </View>
          </View>

          {/* ─── DATES CARD ─── */}
          <View style={styles.sectionCard}>
            <View style={styles.dateCardsRow}>
              <View style={styles.dateCol}>
                <View style={styles.dateIconWrap}>
                  <Ionicons name="calendar-outline" size={20} color="#2E7D32" />
                </View>
                <Text style={styles.dateLabelText}>Start Date</Text>
                <Text style={styles.dateValueText}>{formatDate(item.start_date)}</Text>
                <Text style={styles.timeValueText}>{formatTime(item.start_date)}</Text>
              </View>

              <View style={styles.verticalDividerLight} />

              <View style={styles.dateCol}>
                <View style={styles.dateIconWrap}>
                  <Ionicons name="calendar-outline" size={20} color="#2E7D32" />
                </View>
                <Text style={styles.dateLabelText}>Next Billing Date</Text>
                <Text style={styles.dateValueText}>{formatDate(item.expiry_date)}</Text>
                <Text style={styles.timeValueText}>{formatTime(item.expiry_date)}</Text>
              </View>

              <View style={styles.verticalDividerLight} />

              <View style={styles.dateCol}>
                <View style={styles.dateIconWrap}>
                  <Ionicons name="receipt-outline" size={20} color="#2E7D32" />
                </View>
                <Text style={styles.dateLabelText}>Billing Cycle</Text>
                <Text style={styles.dateValueText}>
                  {item.billing_cycle ? item.billing_cycle.charAt(0).toUpperCase() + item.billing_cycle.slice(1) + 'ly' : 'Monthly'}
                </Text>
                <Text style={styles.timeValueText}>Renews automatically</Text>
              </View>
            </View>
          </View>

          {/* ─── PLAN BENEFITS ─── */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Plan Benefits</Text>
              <Pressable onPress={() => setShowAllBenefits(!showAllBenefits)}>
                <Text style={styles.viewAllBtnText}>{showAllBenefits ? 'View Less' : 'View All Benefits >'}</Text>
              </Pressable>
            </View>
            <View style={styles.benefitsContainer}>
              <View style={styles.benefitsList}>
                {(() => {
                  const allFeatures = getFeaturesList(item.plan?.features || item.features);
                  const visibleFeatures = showAllBenefits ? allFeatures : allFeatures.slice(0, 5);

                  return visibleFeatures.map((benefit: string, index: number) => (
                    <View key={index} style={styles.benefitRowNew}>
                      <Ionicons name="checkmark-circle" size={20} color="#2E7D32" style={{ marginRight: 12 }} />
                      <Text style={styles.benefitTextNew}>{benefit}</Text>
                      <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                    </View>
                  ));
                })()}
              </View>
              <View style={styles.shieldWatermark}>
                <MaterialCommunityIcons name="shield-crown-outline" size={120} color="#E8F5E9" style={{ opacity: 0.6 }} />
              </View>
            </View>
          </View>


          {/* ─── SUBSCRIPTION JOURNEY ─── */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Your Subscription Journey</Text>
            <View style={styles.journeyContainer}>
              <View style={styles.journeyNode}>
                <Ionicons name="checkmark-circle" size={24} color="#2E7D32" />
                <Text style={styles.journeyDate}>{formatDate(item.start_date)}</Text>
                <Text style={styles.journeyLabel}>Subscribed</Text>
              </View>

              <View style={styles.journeyLineSolid} />

              <View style={styles.journeyNode}>
                <Ionicons name="disc" size={24} color="#2E7D32" />
                <Text style={styles.journeyDate}>{formatDate(item.expiry_date)}</Text>
                <Text style={styles.journeyLabel}>Next Billing</Text>
              </View>

              <View style={styles.journeyLineDashed} />

              <View style={styles.journeyNode}>
                <Ionicons name="ellipse-outline" size={24} color="#9CA3AF" />
                <Text style={[styles.journeyDate, { color: '#9CA3AF' }]}>{formatDate(item.expiry_date)}</Text>
                <Text style={[styles.journeyLabel, { color: '#9CA3AF' }]}>Next Renewal</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* ─── BOTTOM STATUS BAR ─── */}
        <View style={[styles.bottomBarNew, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.statusBoxGreen}>
            <View style={styles.statusBoxLeft}>
              <Ionicons name="shield-checkmark" size={24} color="#2E7D32" style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.statusBoxTitle}>You're all set!</Text>
                <Text style={styles.statusBoxSubtitle}>
                  Your {planDisplayName} is active {item.auto_renew ? 'and will renew automatically.' : 'but auto-renewal is off.'}
                </Text>
              </View>
            </View>
            <Pressable style={styles.managePlanBtn} onPress={onManagePlan}>
              <Text style={styles.managePlanBtnText}>Manage Plan</Text>
              <Ionicons name="settings-outline" size={16} color="#2E7D32" style={{ marginLeft: 6 }} />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  containerTrans: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  headerBg: {
    width: '100%',
    minHeight: 120,
    backgroundColor: 'transparent',
  },
  headerImageStyle: {
    opacity: 0.9,
    resizeMode: 'contain',
    position: 'absolute',
    right: 0,
    top: 0,
    width: 250,
    height: 180,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerTextWrap: {
    marginLeft: 32, // to align since there is no back button
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },

  /* Split Plan Card */
  planCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: -20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  planCardLeft: {
    flex: 0.4,
    backgroundColor: '#166534',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planNameTextWhite: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  activeBadgeWhite: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  activeBadgeTextWhite: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  planCardRight: {
    flex: 0.6,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  planCardRightCol1: {
    flex: 1,
    alignItems: 'center',
  },
  planPriceBig: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
  },
  planPriceSub: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  planCardRightCol2: {
    flex: 1,
    alignItems: 'center',
  },
  shieldIconWrap: {
    backgroundColor: '#E8F5E9',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  autoRenewTextGreen: {
    color: '#2E7D32',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  verticalDivider: {
    width: 1,
    height: '80%',
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },

  /* Sections */
  sectionCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  viewAllBtnText: {
    color: '#2E7D32',
    fontSize: 13,
    fontWeight: '600',
  },

  /* Date Row */
  dateCardsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateCol: {
    flex: 1,
    alignItems: 'center',
  },
  dateIconWrap: {
    backgroundColor: '#F3F4F6',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateLabelText: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
    textAlign: 'center',
  },
  dateValueText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  timeValueText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  verticalDividerLight: {
    width: 1,
    height: 60,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 8,
  },

  /* Benefits */
  benefitsContainer: {
    flexDirection: 'row',
    position: 'relative',
  },
  benefitsList: {
    flex: 1,
    zIndex: 2,
  },
  benefitRowNew: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  benefitTextNew: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
  },
  shieldWatermark: {
    position: 'absolute',
    right: -20,
    bottom: -10,
    zIndex: 1,
  },

  /* Payment Summary */
  paymentRowClean: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  paymentRowLeftClean: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentLabelClean: {
    fontSize: 13,
    color: '#4B5563',
  },
  paymentValueClean: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
  },

  /* Subscription Journey */
  journeyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingHorizontal: 10,
  },
  journeyNode: {
    alignItems: 'center',
    width: 80,
  },
  journeyDate: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
  },
  journeyLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  journeyLineSolid: {
    flex: 1,
    height: 2,
    backgroundColor: '#2E7D32',
    marginHorizontal: -15,
    marginBottom: 20, // push up to align with icons
  },
  journeyLineDashed: {
    flex: 1,
    height: 2,
    borderWidth: 1,
    borderColor: '#9CA3AF',
    borderStyle: 'dashed',
    marginHorizontal: -15,
    marginBottom: 20,
  },

  /* Bottom Bar */
  bottomBarNew: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
  },
  statusBoxGreen: {
    flexDirection: 'row',
    backgroundColor: '#F4FBF4',
    borderWidth: 1,
    borderColor: '#D1E8D5',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBoxLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  statusBoxTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
  },
  statusBoxSubtitle: {
    fontSize: 11,
    color: '#4B5563',
    marginTop: 2,
  },
  managePlanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#2E7D32',
    borderRadius: 8,
    marginLeft: 12,
  },
  managePlanBtnText: {
    color: '#2E7D32',
    fontSize: 13,
    fontWeight: '600',
  },
});
