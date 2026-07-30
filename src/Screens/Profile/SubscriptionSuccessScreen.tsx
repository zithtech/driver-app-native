import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import RNPrint from 'react-native-print';
import { useAppTheme } from '../../context/ThemeContext';
import { useGetMySubscriptionQuery } from '../../service/userApi';
import moment from 'moment';
import { useAlert } from '../../context/AlertContext';
import AppStatusBar from '../../Components/AppStatusBar';
import { Dashboard_Nav } from '../../Navigations/navigations';

const SubscriptionSuccessScreen = ({ navigation, route }: any) => {
  const { colors } = useTheme();
  const { isDark } = useAppTheme();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  
  const { planName, planColor, amountPaid, duration, transactionId, isUpgrade, isDowngrade, proratedCredit } = route.params || {};

  const { data: subscriptionData, isLoading } = useGetMySubscriptionQuery();
  const subscription = subscriptionData?.data?.subscription;

  const displayAmount = (Number(amountPaid) / 100).toFixed(2);
  
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 40,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const handleDownloadInvoice = async () => {
    try {
      const htmlContent = `
        <html>
          <body style="font-family: Arial, sans-serif; padding: 40px; color: #111827;">
            <div style="text-align: center; margin-bottom: 40px;">
              <h1 style="color: #2563EB;">T2drive</h1>
              <h2>Payment Receipt</h2>
            </div>
            <div style="margin-bottom: 30px;">
              <p><strong>Transaction ID:</strong> ${transactionId}</p>
              <p><strong>Date:</strong> ${moment().format('DD MMM YYYY, hh:mm A')}</p>
              <p><strong>Plan:</strong> ${planName || subscription?.plan?.plan_name || 'Premium'} (${formatDuration(duration || subscription?.billing_cycle)})</p>
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
              <tr style="border-bottom: 2px solid #E5E7EB; text-align: left;">
                <th style="padding: 12px 0;">Description</th>
                <th style="padding: 12px 0; text-align: right;">Amount</th>
              </tr>
              <tr style="border-bottom: 1px solid #E5E7EB;">
                <td style="padding: 12px 0;">${planName || subscription?.plan?.plan_name || 'Premium'} Subscription</td>
                <td style="padding: 12px 0; text-align: right;">₹${displayAmount}</td>
              </tr>
            </table>
            <div style="text-align: right; font-size: 24px; font-weight: bold;">
              Total Paid: ₹${displayAmount}
            </div>
            <div style="margin-top: 60px; text-align: center; color: #6B7280; font-size: 14px;">
              Thank you for choosing T2drive!
            </div>
          </body>
        </html>
      `;
      await RNPrint.print({ html: htmlContent });
    } catch (error) {
      showAlert({ title: 'Error', message: 'Failed to generate receipt.', singleButton: true, icon: 'close-circle-outline' });
    }
  };

  const handleGoToDashboard = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: Dashboard_Nav }],
    });
  };

  const formatDuration = (dur: string) => {
    if (dur === 'daily' || dur === 'day') return 'Daily';
    if (dur === 'weekly' || dur === 'week') return 'Weekly';
    if (dur === 'monthly' || dur === 'month') return 'Monthly';
    return dur;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#000000' : '#F9FAFB' }]} edges={['top', 'bottom']}>
      <AppStatusBar forceLight={!isDark} />
      
      <Animated.View style={[styles.content, { opacity: opacityAnim, transform: [{ translateY: slideAnim }] }]}>
        
        {/* Sleek Header */}
        <View style={styles.headerArea}>
          <Animated.View style={[styles.iconWrapper, { transform: [{ scale: scaleAnim }] }]}>
            <Ionicons name="checkmark-circle" size={80} color={isDark ? '#34D399' : '#10B981'} />
          </Animated.View>
          <Text style={[styles.successTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>Payment Successful</Text>
          <Text style={[styles.successSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            Your {formatDuration(duration || subscription?.billing_cycle)} plan is active.
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <View style={[styles.receiptCard, { backgroundColor: isDark ? '#111827' : '#FFFFFF', borderColor: isDark ? '#374151' : '#E5E7EB' }]}>
            <Text style={[styles.amountText, { color: isDark ? '#FFFFFF' : '#111827' }]}>₹{displayAmount}</Text>
            
            {(isUpgrade || isDowngrade) && (
              <View style={[styles.badge, { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.1)' : '#ECFDF5' }]}>
                <Text style={[styles.badgeText, { color: isDark ? '#34D399' : '#059669' }]}>
                  {isUpgrade ? 'Upgraded' : 'Downgraded'} (₹{proratedCredit} credit)
                </Text>
              </View>
            )}

            <View style={styles.dashedLineWrapper}>
              <View style={[styles.dashedLine, { borderColor: isDark ? '#374151' : '#E5E7EB' }]} />
            </View>

            <View style={styles.listRow}>
              <Text style={[styles.listLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Transaction ID</Text>
              <Text style={[styles.listValue, { color: isDark ? '#F3F4F6' : '#111827' }]}>{transactionId}</Text>
            </View>

            <View style={styles.listRow}>
              <Text style={[styles.listLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Plan Tier</Text>
              <Text style={[styles.listValue, { color: planColor || (isDark ? '#F3F4F6' : '#111827') }]}>{planName || subscription?.plan?.plan_name || 'Premium'}</Text>
            </View>
            
            <View style={styles.listRow}>
              <Text style={[styles.listLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Start Date</Text>
              <Text style={[styles.listValue, { color: isDark ? '#F3F4F6' : '#111827' }]}>
                {subscription?.start_date ? moment(subscription.start_date).format('DD MMM YYYY') : moment().format('DD MMM YYYY')}
              </Text>
            </View>

            {subscription?.expiry_date && (
              <View style={[styles.listRow, { marginBottom: 0 }]}>
                <Text style={[styles.listLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>End Date</Text>
                <Text style={[styles.listValue, { color: isDark ? '#F3F4F6' : '#111827' }]}>
                  {moment(subscription.expiry_date).format('DD MMM YYYY')}
                </Text>
              </View>
            )}
          </View>
        )}
      </Animated.View>

      <Animated.View style={[styles.footer, { opacity: opacityAnim, paddingBottom: Math.max(insets.bottom, 24) }]}>
        <Pressable 
          style={({ pressed }) => [styles.downloadBtn, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6', opacity: pressed ? 0.7 : 1 }]} 
          onPress={handleDownloadInvoice}
        >
          <Ionicons name="receipt-outline" size={18} color={isDark ? '#F9FAFB' : '#111827'} style={{ marginRight: 8 }} />
          <Text style={[styles.downloadBtnText, { color: isDark ? '#F9FAFB' : '#111827' }]}>Get Receipt</Text>
        </Pressable>
        
        <Pressable 
          style={({ pressed }) => [styles.dashboardBtn, { backgroundColor: isDark ? '#FFFFFF' : '#111827', opacity: pressed ? 0.8 : 1 }]} 
          onPress={handleGoToDashboard}
        >
          <Text style={[styles.dashboardBtnText, { color: isDark ? '#111827' : '#FFFFFF' }]}>Done</Text>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    paddingBottom: 20,
  },
  headerArea: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconWrapper: {
    marginBottom: 20,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  successSubtitle: {
    fontSize: 15,
    textAlign: 'center',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  receiptCard: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  amountText: {
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: -1,
    textAlign: 'center',
  },
  badge: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'center',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dashedLineWrapper: {
    width: '100%',
    height: 1,
    overflow: 'hidden',
    marginVertical: 24,
  },
  dashedLine: {
    width: '100%',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  listRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  listLabel: {
    fontSize: 14,
    fontWeight: '400',
  },
  listValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 24,
    gap: 12,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
  },
  downloadBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  dashboardBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
  },
  dashboardBtnText: {
    fontSize: 16,
    fontWeight: '600',
  }
});

export default SubscriptionSuccessScreen;
