import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Linking
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, useIsFocused } from '@react-navigation/native';
import { useAlert } from '../../context/AlertContext';
import { useTranslation } from 'react-i18next';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import RazorpayCheckout from 'react-native-razorpay';
import Config from 'react-native-config';
import { useSelector } from 'react-redux';
import { useHaptic } from '../../hooks/useHaptic';
import { RootState } from '../../redux/store';
import {
  useGetMySubscriptionQuery,
  useGetSubscriptionPlansQuery,
  useCreateAutoSubscriptionMutation,
  useVerifyAutoSubscriptionPaymentMutation,
  useLazyPreviewPlanChangeQuery,
  useToggleAutoRenewMutation,
  useCreateSubscriptionOrderMutation,
  useVerifySubscriptionPaymentMutation,
  useBuySubscriptionWithWalletMutation,
} from '../../service/userApi';
import { useGetWalletBalanceQuery } from '../../service/driverApi';
import { useAppTheme } from '../../context/ThemeContext';
import CurrentPlanDetailsView from './CurrentPlanDetailsView';
import AppStatusBar from '../../Components/AppStatusBar';
import PaymentMethodModal from '../../Components/PaymentMethodModal';

/* ================= TYPES ================= */

interface PlanFeature {
  key: string;
  icon: string;
  label: string;
  isBlocked?: boolean;
}

interface PlanTier {
  id: number;
  name: string;
  color: string;
  lightColor: string;
  icon: string;
  iconType: 'ionicons' | 'material';
  subtitle: string;
  highlight: string;
  features: PlanFeature[];
  pricing: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  isPopular?: boolean;
  tag?: string;
}

type Duration = 'daily' | 'weekly' | 'monthly';

/* ================= CONSTANTS ================= */


const DURATIONS: { key: Duration; label: string }[] = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];

/* ================= SCREEN ================= */

const RechargePlanScreen: React.FC<any> = ({ navigation }) => {
  const { colors } = useTheme();
  const { showAlert } = useAlert();
  const { t } = useTranslation();
  const { isDark } = useAppTheme();
  const user = useSelector((state: RootState) => state.userSlice?.user);

  const { data: plansData, isLoading: isPlansLoading } = useGetSubscriptionPlansQuery();
  const { data: subscriptionData, isLoading: isSubLoading, refetch: refetchSub } = useGetMySubscriptionQuery();
  const [createAutoSubscription] = useCreateAutoSubscriptionMutation();
  const [verifyAutoSubscriptionPayment] = useVerifyAutoSubscriptionPaymentMutation();
  const [triggerPreviewPlanChange] = useLazyPreviewPlanChangeQuery();
  const [toggleAutoRenew, { isLoading: isTogglingAutoRenew }] = useToggleAutoRenewMutation();
  const [createSubscriptionOrder] = useCreateSubscriptionOrderMutation();
  const [verifySubscriptionPayment] = useVerifySubscriptionPaymentMutation();
  const [buySubscriptionWithWallet] = useBuySubscriptionWithWalletMutation();
  const { data: walletData, refetch: refetchWallet } = useGetWalletBalanceQuery(user?.driverId || '', { skip: !user?.driverId });
  const walletBalance = walletData?.data?.balance || 0;
  
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [modalData, setModalData] = useState<{ tier: PlanTier | null, amountToPay: number }>({ tier: null, amountToPay: 0 });

  const [selectedDuration, setSelectedDuration] = useState<Duration>('daily');
  const [isProcessing, setIsProcessing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isSwitchPlanMode, setIsSwitchPlanMode] = useState(false);

  // Eligibility Modal State
  const [eligibilityModalVisible, setEligibilityModalVisible] = useState(false);
  const [ineligiblePlanName, setIneligiblePlanName] = useState('');
  const [upgradeConfirmData, setUpgradeConfirmData] = useState<{
    visible: boolean;
    unusedCredit: number;
    newPlanCost: number;
    amountToPay: number;
    tier: PlanTier | null;
  }>({ visible: false, unusedCredit: 0, newPlanCost: 0, amountToPay: 0, tier: null });

  useEffect(() => {
    if (subscriptionData?.data?.subscription?.billing_cycle) {
      setSelectedDuration(getDurationKey(subscriptionData.data.subscription.billing_cycle));
    }
  }, [subscriptionData]);

  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { triggerHaptic } = useHaptic();

  const getFeatureLabel = (key: string, duration: Duration) => {
    const labels: Record<string, string> = {
      local_trips_one_way: 'Local trips (One-way)',
      local_trips_round: 'Local trips (One-way & Round trip)',
      all_local_trips: 'All Local trips (One-way & Round trip)',
      up_to_25_km: 'Up to 25 km per trip',
      up_to_50_km: 'Up to 50 km per trip',
      no_distance_limit: 'No distance limit',
      standard_support: 'Standard support',
      priority_support: 'Priority support',
      high_priority_support: 'High priority support',
      trip_earnings_visible: 'Trip earnings visible',
      trip_earnings_incentives: 'Trip earnings & incentives',
      better_earnings_incentives: 'Better earnings & incentives',
      scheduled_rides: 'Scheduled rides',
      scheduled_rides_all: 'Scheduled rides (Day/Week/Month)',
      outstation_trips: 'Outstation trips',
      outstation_trips_all: 'Outstation trips (All types)',
    };
    return labels[key] || key.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetchSub();
    setRefreshing(false);
  }, [refetchSub]);

  // Dynamically extract features from API response
  const extractFeatures = (plan: any): PlanFeature[] => {
    const rawFeatures = plan.features;
    let labels: string[] = [];
    
    if (Array.isArray(rawFeatures)) {
      labels = rawFeatures.filter((f: any) => typeof f === 'string' && f.trim().length > 0);
    } else if (typeof rawFeatures === 'object' && rawFeatures !== null) {
      labels = Object.entries(rawFeatures)
        .filter(([_, val]) => val === true || val === 'true')
        .map(([key]) => key.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
    }

    return labels.map((label: string) => ({
      key: label,
      label: label,
      icon: 'checkmark',
      isBlocked: false,
    }));
  };

  const planTiers: PlanTier[] = (plansData?.data?.plans || plansData?.data || []).map((plan: any, index: number) => {
    const daily = Number(plan.daily_price || 0);
    const weekly = Number(plan.weekly_price || 0);
    const monthly = Number(plan.monthly_price || 0);

    const rawName = plan.plan_name || plan.name || '';
    const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    const lowerName = name.toLowerCase();

    let colorScheme: Pick<PlanTier, 'color' | 'lightColor' | 'icon' | 'iconType' | 'subtitle' | 'highlight'> = { color: '#2563EB', lightColor: '#EFF6FF', icon: 'car', iconType: 'ionicons', subtitle: 'For getting started', highlight: 'Perfect for new drivers and local one-way trips.' };
    
    if (lowerName.includes('basic')) {
      colorScheme = { color: '#2563EB', lightColor: '#EFF6FF', icon: 'crown', iconType: 'material', subtitle: 'For getting started', highlight: 'Perfect for new drivers and\nlocal one-way trips.' };
    } else if (lowerName.includes('elite')) {
      colorScheme = { color: '#10B981', lightColor: '#ECFDF5', icon: 'crown', iconType: 'material', subtitle: 'More trips, more earnings', highlight: 'For drivers who want more rides\nand better opportunities.' };
    } else if (lowerName.includes('premium')) {
      colorScheme = { color: '#D97706', lightColor: '#FEF3C7', icon: 'crown', iconType: 'material', subtitle: 'All trips. All access.', highlight: 'For professional drivers who want\nmaximum earnings.' };
    }

    return {
      id: plan.id,
      name: name,
      ...colorScheme,
      features: extractFeatures(plan),
      pricing: { daily, weekly, monthly },
      isPopular: !!plan.tag,
      tag: plan.tag || '',
    };
  }).sort((a: PlanTier, b: PlanTier) => {
    const getWeight = (n: string) => {
      const lower = n.toLowerCase();
      if (lower.includes('basic')) return 1;
      if (lower.includes('elite')) return 2;
      if (lower.includes('premium')) return 3;
      return 4;
    };
    return getWeight(a.name) - getWeight(b.name);
  });

  const getDurationKey = (cycle: string): Duration => {
    if (!cycle) return 'monthly';
    if (cycle === 'day' || cycle === 'daily') return 'daily';
    if (cycle === 'week' || cycle === 'weekly') return 'weekly';
    if (cycle === 'month' || cycle === 'monthly') return 'monthly';
    return 'monthly';
  };

  const getBillingCycle = (dur: Duration): 'day' | 'week' | 'month' => {
    if (dur === 'daily') return 'day';
    if (dur === 'weekly') return 'week';
    if (dur === 'monthly') return 'month';
    return 'day';
  };

  const activePlan = subscriptionData?.data?.subscription;

  const handleChoosePlan = async (tier: PlanTier, isDowngrade: boolean) => {
    // Determine Eligibility
    const lowerTierName = tier.name.toLowerCase();
    const isBasic = lowerTierName.includes('basic');
    const isElite = lowerTierName.includes('elite');
    const isPremium = lowerTierName.includes('premium');
    
    let isEligible = false;
    const eligibility = user?.subscription_eligibility;
    if (eligibility) {
      if (isBasic) isEligible = !!eligibility.basic;
      else if (isElite) isEligible = !!eligibility.elite;
      else if (isPremium) isEligible = !!eligibility.premium;
      else isEligible = true; // Fallback for unknown plans
    } else {
      // Default: If no eligibility object, allow all plans so drivers can recharge
      isEligible = true;
    }

    if (!isEligible) {
      setIneligiblePlanName(tier.name);
      setEligibilityModalVisible(true);
      return;
    }

    const isActivePlan = activePlan?.plan_id === tier.id && getDurationKey(activePlan?.billing_cycle) === selectedDuration && activePlan?.status?.toUpperCase() === 'ACTIVE';
    if (isActivePlan) {
      showAlert({ title: 'Already Active', message: 'You are currently subscribed to this plan.', singleButton: true, icon: 'checkmark-circle-outline' });
      return;
    }

    if (isDowngrade) {
      Alert.alert(
        'Downgrade Not Allowed',
        'You cannot downgrade an active plan. To switch to this cheaper plan, please cancel your auto-renewal from the My Plan screen and wait for your current plan to expire.'
      );
      return;
    }

    const isPlanChange = activePlan?.status?.toUpperCase() === 'ACTIVE' && activePlan?.plan_id;

    triggerHaptic(HapticFeedbackTypes.impactMedium);
    setIsProcessing(true);

    try {
      if (isPlanChange) {
        // Upgrade flow: fetch preview and prompt user
        const res = await triggerPreviewPlanChange({ plan_id: tier.id, billing_cycle: getBillingCycle(selectedDuration) }).unwrap();
        const proration = res?.data?.proration;
        
        if (proration) {
           setUpgradeConfirmData({
             visible: true,
             unusedCredit: proration.unused_credit,
             newPlanCost: proration.new_plan_cost,
             amountToPay: proration.amount_to_pay,
             tier
           });
           return;
        }
      }
      
      // Direct subscription or upgrade without preview data
      checkWalletAndExecute(tier);

    } catch (error: any) {
      setIsProcessing(false);
      showAlert({ title: 'Error', message: error.message || 'Something went wrong', singleButton: true, icon: 'close-circle-outline' });
    }
  };

  const checkWalletAndExecute = (tier: PlanTier, amountToPay?: number) => {
    let price = amountToPay;
    if (price === undefined) {
      if (selectedDuration === 'daily') price = tier.pricing.daily;
      if (selectedDuration === 'weekly') price = tier.pricing.weekly;
      if (selectedDuration === 'monthly') price = tier.pricing.monthly;
    }

    setModalData({ tier, amountToPay: price || 0 });
    setPaymentModalVisible(true);
    setIsProcessing(false); // Enable interactions, modal handles the rest
  };

  const executeWalletSubscription = async (pin: string, promoCode?: string) => {
    if (!modalData.tier) return;
    setIsProcessing(true);
    
    // Enforce a 3-second processing time to show the loader
    await new Promise(resolve => setTimeout(() => resolve(undefined), 3000));

    try {
      const res = await buySubscriptionWithWallet({
        plan_id: modalData.tier.id,
        billing_cycle: getBillingCycle(selectedDuration) as 'day'|'week'|'month',
        pin: pin,
        promo_code: promoCode,
      }).unwrap();

      triggerHaptic(HapticFeedbackTypes.notificationSuccess);
      refetchSub();
      refetchWallet();
       setPaymentModalVisible(false);
      navigation.replace('SubscriptionSuccessScreen', {
        planName: modalData.tier.name,
        planColor: modalData.tier.color,
        amountPaid: res.amount_paid || (modalData.amountToPay * 100),
        duration: selectedDuration,
        transactionId: 'Wallet Payment',
        isUpgrade: false,
        isDowngrade: false,
        proratedCredit: 0,
      });
    } catch (error: any) {
      setIsProcessing(false);
      setPaymentModalVisible(false);
      const errorMsg = error?.data?.message || error?.message || 'Could not deduct from wallet';
      const price = modalData.amountToPay || 0;
      const failedPlanName = modalData.tier?.name;
      
      // Add a slight delay to ensure the modal is fully closed before navigating
      setTimeout(() => {
        navigation.replace('PaymentFailedScreen', { 
          amount: price, 
          planName: failedPlanName,
          returnScreen: 'RechargePlanScreen', 
          errorReason: errorMsg 
        });
      }, 300);
    }
  };

  const executeSubscription = async (promoCode?: string, isRetry = false) => {
    const tier = modalData.tier;
    if (!tier) return;
    setPaymentModalVisible(false);
    setIsProcessing(true);
    try {
      if (selectedDuration === 'daily') {
        // ONE-TIME PAYMENT FOR DAILY PLANS
        const orderResponse = await createSubscriptionOrder({
          plan_id: tier.id,
          billing_cycle: 'day',
          promo_code: promoCode,
        }).unwrap();

        const orderData = orderResponse.data;

        const options = {
          description: `${tier.name} - DAILY (One-Time)`,
          image: Image.resolveAssetSource(require('../../assets/images/applogo.png')).uri,
          currency: 'INR',
          key: Config.RAZORPAY_KEY_ID || 'rzp_test_SCjewpaZ96XBWa',
          order_id: orderData.order_id,
          name: 'T2drive',
          prefill: { email: user?.email || '', contact: user?.phone_number || '', name: user?.full_name || '' },
          theme: { color: tier.color },
        };

        const data = await RazorpayCheckout.open(options as any);

        await verifySubscriptionPayment({
          razorpay_order_id: orderData.order_id,
          razorpay_payment_id: data.razorpay_payment_id || '',
          razorpay_signature: data.razorpay_signature || '',
        }).unwrap();

        triggerHaptic(HapticFeedbackTypes.notificationSuccess);
        refetchSub();
        navigation.reset({
          index: 0,
          routes: [{
            name: 'SubscriptionSuccessScreen',
            params: {
              planName: tier.name,
              planColor: tier.color,
              amountPaid: orderData.amount,
              duration: 'daily',
              transactionId: data.razorpay_payment_id || 'One-Time',
              isUpgrade: false,
              isDowngrade: false,
              proratedCredit: 0,
            }
          }]
        });
        return Promise.resolve();
      } else {
        // AUTO-RENEW SUBSCRIPTION FOR WEEKLY/MONTHLY
        const autoSubResponse = await createAutoSubscription({
          plan_id: tier.id,
          billing_cycle: getBillingCycle(selectedDuration),
          promo_code: promoCode,
        }).unwrap();

        const subData = autoSubResponse.data;

        const actionText = subData.is_upgrade ? 'Upgrade' : (subData.is_downgrade ? 'Downgrade' : 'Subscription');
        const options = {
          description: `${tier.name} - ${selectedDuration.toUpperCase()} ${actionText}`,
          image: Image.resolveAssetSource(require('../../assets/images/applogo.png')).uri,
          currency: 'INR',
          key: Config.RAZORPAY_KEY_ID || 'rzp_test_SCjewpaZ96XBWa',
          subscription_id: subData.subscription_id,
          name: 'T2drive',
          prefill: { email: user?.email || '', contact: user?.phone_number || '', name: user?.full_name || '' },
          theme: { color: tier.color },
        };

        const data = await RazorpayCheckout.open(options as any);

        await verifyAutoSubscriptionPayment({
          razorpay_subscription_id: subData.subscription_id,
          razorpay_payment_id: data.razorpay_payment_id || '',
          razorpay_signature: data.razorpay_signature || '',
        }).unwrap();

        triggerHaptic(HapticFeedbackTypes.notificationSuccess);
        refetchSub();
        navigation.reset({
          index: 0,
          routes: [{
            name: 'SubscriptionSuccessScreen',
            params: {
              planName: tier.name,
              planColor: tier.color,
              amountPaid: subData.amount_to_pay,
              duration: selectedDuration,
              transactionId: data.razorpay_payment_id || 'Auto-Subscription',
              isUpgrade: subData.is_upgrade,
              isDowngrade: subData.is_downgrade,
              proratedCredit: subData.prorated_credit,
            }
          }]
        });
        return Promise.resolve();
      }
    } catch (error: any) {
      const price = selectedDuration === 'daily' ? tier.pricing.daily : selectedDuration === 'weekly' ? tier.pricing.weekly : tier.pricing.monthly;
      
      let errorMsg = 'Payment cancelled or failed';
      try {
        let parsedError = error;
        if (typeof error === 'string') {
          try { parsedError = JSON.parse(error); } catch (e) {}
        }
        
        if (parsedError?.error?.description && parsedError.error.description !== 'undefined') {
          errorMsg = parsedError.error.description;
        } else if (parsedError?.error?.reason) {
          errorMsg = parsedError.error.reason.replace(/_/g, ' ');
          // capitalize first letter
          errorMsg = errorMsg.charAt(0).toUpperCase() + errorMsg.slice(1);
        } else if (parsedError?.description) {
          errorMsg = parsedError.description;
        } else if (parsedError?.message) {
          errorMsg = parsedError.message;
        } else if (typeof error === 'string' && !error.includes('{"error":')) {
          errorMsg = error;
        }
      } catch (e) {
        console.log("Error parsing payment error", e);
      }
      if (isRetry) {
        setIsProcessing(false);
        return Promise.reject(errorMsg);
      } else {
        navigation.navigate('PaymentFailedScreen', { 
          amount: price, 
          planName: tier.name, 
          returnScreen: 'RechargePlanScreen', 
          errorReason: errorMsg,
          onRetry: () => executeSubscription(promoCode, true)
        });
      }
    } finally {
      if (!isRetry) setIsProcessing(false);
    }
  };

  const getFriendlyDuration = (dur: Duration) => {
    if (dur === 'daily') return 'day';
    if (dur === 'weekly') return 'week';
    if (dur === 'monthly') return 'month';
    return 'day';
  };

  const handleCancelAutoRenew = async () => {
    Alert.alert(
      'Cancel Auto-Renew',
      'Are you sure you want to cancel auto-renewal? Your plan will remain active until the end of the current billing cycle, but you will need to recharge manually next time.',
      [
        { text: 'No, Keep it', style: 'cancel' },
        { 
            text: 'Yes, Cancel', 
            style: 'destructive',
            onPress: async () => {
                try {
                    await toggleAutoRenew({ auto_renew: false }).unwrap();
                    refetchSub();
                    showAlert({ title: 'Cancelled', message: 'Auto-renew cancelled successfully.', singleButton: true, icon: 'checkmark-circle-outline' });
                } catch (error: any) {
                    showAlert({ title: 'Error', message: error.message || 'Failed to cancel auto-renew', singleButton: true, icon: 'close-circle-outline' });
                }
            }
        }
      ]
    );
  };

  const renderActivePlanStatus = () => {
    const activePlan = subscriptionData?.data?.subscription;
    if (!activePlan || activePlan.status?.toUpperCase() !== 'ACTIVE') return null;

    const startDate = new Date(activePlan.start_date);
    const endDate = new Date(activePlan.expiry_date);
    const now = new Date();
    
    const diffTime = endDate.getTime() - now.getTime();
    
    let remainingText = '';
    if (diffTime > 0) {
      const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        remainingText = `${days} day${days > 1 ? 's' : ''} ${hours}h remaining`;
      } else {
        remainingText = `${hours}h ${mins}m remaining`;
      }
    } else {
      remainingText = 'Expired';
    }

    return (
      <View style={[styles.activeStatusCard, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF', borderColor: isDark ? '#374151' : '#E5E7EB' }]}>
        <Text style={[styles.activeStatusTitle, { color: isDark ? '#F3F4F6' : '#111827' }]}>Live Plan Status</Text>
        
        <View style={styles.statusRow}>
          <Text style={[styles.statusLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Start Date</Text>
          <Text style={[styles.statusValue, { color: isDark ? '#F3F4F6' : '#111827' }]}>{startDate.toLocaleDateString()}</Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={[styles.statusLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>End Date</Text>
          <Text style={[styles.statusValue, { color: isDark ? '#F3F4F6' : '#111827' }]}>{endDate.toLocaleDateString()}</Text>
        </View>

        <View style={[styles.statusRow, { borderTopWidth: 1, borderTopColor: isDark ? '#374151' : '#E5E7EB', paddingTop: 12, marginTop: 4, marginBottom: 0 }]}>
          <Text style={[styles.statusLabel, { color: isDark ? '#9CA3AF' : '#6B7280', fontWeight: 'bold' }]}>Time Remaining</Text>
          <Text style={[styles.statusValue, { color: '#10B981', fontWeight: 'bold' }]}>{remainingText}</Text>
        </View>

        {activePlan.razorpay_subscription_id && (
          <View style={[styles.statusRow, { borderTopWidth: 1, borderTopColor: isDark ? '#374151' : '#E5E7EB', paddingTop: 12, marginTop: 12, marginBottom: 0 }]}>
            <View>
              <Text style={[styles.statusLabel, { color: isDark ? '#9CA3AF' : '#6B7280', fontWeight: 'bold', marginBottom: 2 }]}>Auto-Renew Status</Text>
              <Text style={{ color: activePlan.auto_renew ? '#2563EB' : '#EF4444', fontSize: 13, fontWeight: '600' }}>
                {activePlan.auto_renew ? 'Active' : 'Cancelled'}
              </Text>
            </View>
            {activePlan.auto_renew && (
              <Pressable 
                style={[styles.cancelRenewBtn, isTogglingAutoRenew && { opacity: 0.7 }]}
                onPress={handleCancelAutoRenew}
                disabled={isTogglingAutoRenew}
              >
                {isTogglingAutoRenew ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <Text style={styles.cancelRenewBtnText}>Cancel</Text>
                )}
              </Pressable>
            )}
          </View>
        )}
      </View>
    );
  };

  if (isPlansLoading || isSubLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#111827' : '#FFFFFF' }]} edges={['bottom', 'left', 'right']}>
        {isFocused && <AppStatusBar forceLight={!isDark} />}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary || '#1E3A8A'} />
        </View>
      </SafeAreaView>
    );
  }

  const isViewingCurrentPlan = activePlan && activePlan.status?.toUpperCase() === 'ACTIVE' && !isSwitchPlanMode;

  if (isViewingCurrentPlan) {
    return (
      <CurrentPlanDetailsView 
        activePlan={activePlan} 
        user={user} 
        onManagePlan={() => setIsSwitchPlanMode(true)} 
        navigation={navigation}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#111827' : '#FFFFFF' }]} edges={['bottom', 'left', 'right']}>
      {isFocused && <AppStatusBar forceLight={false} />}
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>Subscription Plans</Text>
          <Pressable onPress={() => navigation.navigate('SubscriptionHistoryScreen')} style={styles.backButton}>
            <Ionicons name="time-outline" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
          </Pressable>
        </View>
        <Text style={[styles.headerSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Choose the best plan to maximize your earnings</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors?.primary || '#1E3A8A']} />}
      >
        {/* Tabs */}
        {(!activePlan || activePlan.status?.toUpperCase() !== 'ACTIVE' || isSwitchPlanMode) && (
          <View style={[styles.tabsContainer, { borderColor: isDark ? '#374151' : '#E5E7EB' }]}>
            {DURATIONS.map((dur) => {
              const isSelected = selectedDuration === dur.key;
              return (
                <Pressable
                  key={dur.key}
                  onPress={() => setSelectedDuration(dur.key)}
                  style={[
                    styles.tab,
                    isSelected && styles.activeTab,
                    isSelected && { backgroundColor: '#2563EB', borderColor: '#2563EB' },
                    !isSelected && { backgroundColor: isDark ? '#1F2937' : '#FFFFFF', borderColor: isDark ? '#374151' : '#E5E7EB' }
                  ]}
                >
                  <Ionicons 
                    name={dur.key === 'daily' ? 'today-outline' : dur.key === 'weekly' ? 'calendar-clear-outline' : 'calendar-outline'} 
                    size={16} 
                    color={isSelected ? '#FFFFFF' : (isDark ? '#9CA3AF' : '#6B7280')} 
                  />
                  <Text style={[
                    styles.tabText,
                    { color: isSelected ? '#FFFFFF' : (isDark ? '#9CA3AF' : '#6B7280') }
                  ]}>
                    {dur.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Plan Cards */}
        <View style={styles.planStack}>
          {planTiers
            .filter((tier) => !activePlan || activePlan.status?.toUpperCase() !== 'ACTIVE' || isSwitchPlanMode || tier.id === activePlan.plan_id)
            .map((tier) => {
            const isActivePlan = activePlan?.plan_id === tier.id && getDurationKey(activePlan?.billing_cycle) === selectedDuration && activePlan?.status?.toUpperCase() === 'ACTIVE';
            
            const isPlanChange = activePlan?.status?.toUpperCase() === 'ACTIVE' && activePlan?.plan_id;
            const durationValues: Record<string, number> = { daily: 1, weekly: 7, monthly: 30 };
            const oldDurationVal = durationValues[getDurationKey(activePlan?.billing_cycle || 'monthly')] || 0;
            const newDurationVal = durationValues[selectedDuration] || 0;
            const isDowngrade = isPlanChange && (tier.id < activePlan.plan_id || (tier.id === activePlan.plan_id && newDurationVal < oldDurationVal));

            // Check if rendering the basic card (it has slightly different styling in design)
            const isBasic = tier.name.toLowerCase().includes('basic');
            
            return (
              <View
                key={tier.id}
                style={[
                  styles.planCard,
                  { 
                    backgroundColor: 'transparent',
                    borderColor: isDark ? '#374151' : '#E5E7EB',
                    borderWidth: 1
                  }
                ]}
              >
                {tier.isPopular && (
                  <View style={[styles.popularBadge, { backgroundColor: tier.color }]}>
                    <Ionicons name="star" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.popularBadgeText}>{tier.tag || 'Most Popular'}</Text>
                  </View>
                )}
                
                <View style={styles.cardHeader}>
                  <View style={[styles.iconCircle, { backgroundColor: tier.lightColor }]}>
                    {tier.iconType === 'ionicons' ? (
                       <Ionicons name={tier.icon} size={22} color={tier.color} />
                    ) : (
                       <MaterialCommunityIcons name={tier.icon} size={22} color={tier.color} />
                    )}
                  </View>
                  <View style={styles.titleArea}>
                    <Text style={[styles.planNameText, { color: isDark ? '#F3F4F6' : '#111827' }]}>{tier.name}</Text>
                    <Text style={[styles.planSubtitleText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>{tier.subtitle}</Text>
                  </View>
                  <View style={styles.priceArea}>
                    <Text style={[styles.planPriceText, { color: tier.color }]}>₹{tier.pricing[selectedDuration]}</Text>
                    <Text style={[styles.planDurationText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>/ {getFriendlyDuration(selectedDuration)}</Text>
                  </View>
                </View>

                <View style={[styles.highlightBox, { backgroundColor: tier.lightColor }]}>
                   <Text style={[styles.highlightText, { color: tier.color }]}>{tier.highlight}</Text>
                </View>

                <Text style={[styles.featuresLabel, { color: tier.color }]}>Features</Text>
                
                <View style={styles.featuresList}>
                  {tier.features.reduce<React.ReactNode[]>((acc, feature, idx) => {
                    // Two-column layout if needed, but design shows one column
                    acc.push(
                      <View key={idx} style={styles.featureRow}>
                        {feature.isBlocked ? (
                          <View style={styles.blockedIconContainer}>
                            <View style={styles.blockedMinus} />
                          </View>
                        ) : (
                          <View style={[styles.checkIconContainer, { backgroundColor: tier.color }]}>
                            <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                          </View>
                        )}
                        <Text style={[
                          styles.featureText, 
                          { color: isDark ? '#D1D5DB' : '#374151' },
                          feature.isBlocked && { color: isDark ? '#6B7280' : '#9CA3AF' }
                        ]}>
                          {feature.label}
                        </Text>
                      </View>
                    );
                    return acc;
                  }, [])}
                </View>

                <Pressable
                  onPress={() => handleChoosePlan(tier, !!isDowngrade)}
                  disabled={isProcessing || isDowngrade}
                  style={[
                    styles.chooseBtn,
                    isDowngrade 
                      ? { backgroundColor: isDark ? '#374151' : '#D1D5DB' }
                      : isBasic 
                        ? { backgroundColor: 'transparent', borderWidth: 1, borderColor: tier.color } 
                        : { backgroundColor: tier.color },
                    (isProcessing || isDowngrade) && { opacity: 0.7 }
                  ]}
                >
                  <Text style={[
                    styles.chooseBtnText,
                    isDowngrade 
                      ? { color: isDark ? '#9CA3AF' : '#6B7280' }
                      : isBasic 
                        ? { color: tier.color } 
                        : { color: '#FFFFFF' }
                  ]}>
                    {isActivePlan ? 'Current Plan' : isDowngrade ? 'Unavailable' : `Choose ${tier.name}`}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        {/* Bottom Features */}
        <View style={[styles.bottomFeaturesContainer, { backgroundColor: isDark ? '#1F2937' : '#F8FAFC' }]}>
           <View style={styles.bottomFeatureItem}>
             <Ionicons name="shield-checkmark" size={24} color="#2563EB" />
             <Text style={[styles.bfTitle, { color: isDark ? '#F3F4F6' : '#111827' }]}>Secure Payments</Text>
             <Text style={[styles.bfSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>100% secure transactions</Text>
           </View>
           <View style={styles.bottomFeatureDivider} />
           <View style={styles.bottomFeatureItem}>
             <Ionicons name="flash" size={24} color="#2563EB" />
             <Text style={[styles.bfTitle, { color: isDark ? '#F3F4F6' : '#111827' }]}>Instant Activation</Text>
             <Text style={[styles.bfSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Activate your plan immediately</Text>
           </View>
           <View style={styles.bottomFeatureDivider} />
           <View style={styles.bottomFeatureItem}>
             <Ionicons name="sync" size={24} color="#10B981" />
             <Text style={[styles.bfTitle, { color: isDark ? '#F3F4F6' : '#111827' }]}>Flexible Plans</Text>
             <Text style={[styles.bfSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Change or renew your plan anytime</Text>
           </View>
           <View style={styles.bottomFeatureDivider} />
           <View style={styles.bottomFeatureItem}>
             <Ionicons name="headset" size={24} color="#2563EB" />
             <Text style={[styles.bfTitle, { color: isDark ? '#F3F4F6' : '#111827' }]}>24/7 Support</Text>
             <Text style={[styles.bfSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>We're here to help you</Text>
           </View>
        </View>

        <View style={styles.footer}>
          <Ionicons name="shield-checkmark" size={16} color="#6B7280" style={{ marginRight: 6 }} />
          <Text style={[styles.footerText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Your subscription is valid across all devices</Text>
        </View>

      </ScrollView>

      {/* Eligibility Modal */}
      <Modal
        visible={eligibilityModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEligibilityModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="lock-closed" size={32} color="#EF4444" />
            </View>
            <Text style={[styles.modalTitle, { color: isDark ? '#F9FAFB' : '#111827' }]}>
              Plan Locked
            </Text>
            <Text style={[styles.modalDesc, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>
              You are currently not eligible to subscribe to the <Text style={{ fontWeight: 'bold' }}>{ineligiblePlanName}</Text> plan.
            </Text>
            
            <View style={[styles.keyPointsContainer, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
              <Text style={[styles.keyPointsTitle, { color: isDark ? '#F9FAFB' : '#111827' }]}>How to unlock?</Text>
              <View style={styles.keyPointRow}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={[styles.keyPointText, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>Maintain high trip completion rate</Text>
              </View>
              <View style={styles.keyPointRow}>
                <Ionicons name="star" size={16} color="#F59E0B" />
                <Text style={[styles.keyPointText, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>Keep good customer ratings</Text>
              </View>
              <View style={styles.keyPointRow}>
                <Ionicons name="time" size={16} color="#3B82F6" />
                <Text style={[styles.keyPointText, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>Complete minimum tenure as a Basic driver</Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnOutline, { borderColor: isDark ? '#4B5563' : '#D1D5DB' }]}
                onPress={() => setEligibilityModalVisible(false)}
              >
                <Text style={[styles.modalBtnOutlineText, { color: isDark ? '#F9FAFB' : '#374151' }]}>Okay</Text>
              </Pressable>
              
              <Pressable
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={() => {
                  setEligibilityModalVisible(false);
                  Linking.openURL('tel:+918000000000'); // TODO: Replace with actual admin number
                }}
              >
                <Ionicons name="call" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.modalBtnPrimaryText}>Contact</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={upgradeConfirmData.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setUpgradeConfirmData({ ...upgradeConfirmData, visible: false });
          setIsProcessing(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.customModalContainer, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
            <View style={[styles.modalIconCircle, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.1)' : '#EFF6FF' }]}>
              <Ionicons name="arrow-up-circle" size={32} color="#2563EB" />
            </View>
            <Text style={[styles.modalTitle, { color: isDark ? '#F9FAFB' : '#111827' }]}>
              Confirm Upgrade
            </Text>
            <Text style={[styles.modalSubtitle, { color: isDark ? '#9CA3AF' : '#4B5563' }]}>
              Review your upgrade details below before proceeding.
            </Text>
            
            <View style={[styles.modalDetailsBox, { backgroundColor: isDark ? '#374151' : '#F9FAFB' }]}>
              <View style={styles.modalDetailRow}>
                <Text style={[styles.modalDetailLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Unused credit</Text>
                <Text style={[styles.modalDetailValue, { color: '#10B981' }]}>- ₹{upgradeConfirmData.unusedCredit}</Text>
              </View>
              <View style={styles.modalDetailRow}>
                <Text style={[styles.modalDetailLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>New plan cost</Text>
                <Text style={[styles.modalDetailValue, { color: isDark ? '#F9FAFB' : '#111827' }]}>₹{upgradeConfirmData.newPlanCost}</Text>
              </View>
              <View style={[styles.modalDivider, { backgroundColor: isDark ? '#4B5563' : '#E5E7EB' }]} />
              <View style={styles.modalDetailRow}>
                <Text style={[styles.modalTotalLabel, { color: isDark ? '#F9FAFB' : '#111827' }]}>You pay today</Text>
                <Text style={[styles.modalTotalValue, { color: '#2563EB' }]}>₹{upgradeConfirmData.amountToPay}</Text>
              </View>
            </View>
            
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnCancel, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}
                onPress={() => {
                  setUpgradeConfirmData({ ...upgradeConfirmData, visible: false });
                  setIsProcessing(false);
                }}
              >
                <Text style={[styles.modalBtnCancelText, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnProceed]}
                onPress={() => {
                  setUpgradeConfirmData({ ...upgradeConfirmData, visible: false });
                  if (upgradeConfirmData.tier) {
                    checkWalletAndExecute(upgradeConfirmData.tier, upgradeConfirmData.amountToPay);
                  } else {
                    setIsProcessing(false);
                  }
                }}
              >
                <Text style={styles.modalBtnProceedText}>Proceed</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <PaymentMethodModal
        isVisible={paymentModalVisible}
        onClose={() => setPaymentModalVisible(false)}
        amountToPay={modalData.amountToPay}
        walletBalance={walletBalance}
        hasWalletPin={user?.has_wallet_pin || false}
        onSelectWallet={executeWalletSubscription}
        onSelectRazorpay={executeSubscription}
        onSetupPin={() => navigation.navigate('WalletPinSetupScreen')}
        isProcessing={isProcessing}
      />

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: { alignItems: 'center', paddingHorizontal: 16, paddingBottom: 20 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 8 },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSubtitle: { fontSize: 14, textAlign: 'center' },
  
  scrollContent: { paddingBottom: 40 },
  
  tabsContainer: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 24, justifyContent: 'center', gap: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, borderWidth: 1 },
  activeTab: { shadowColor: '#2563EB', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 14, fontWeight: '600', marginLeft: 6 },

  planStack: { paddingHorizontal: 16, gap: 12, marginBottom: 24 },
  planCard: { borderRadius: 16, padding: 16, position: 'relative' },
  popularBadge: { position: 'absolute', top: -12, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  popularBadgeText: { color: 'white', fontSize: 11, fontWeight: '700' },
  
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  titleArea: { flex: 1 },
  planNameText: { fontSize: 18, fontWeight: '700', marginBottom: 2 },
  planSubtitleText: { fontSize: 12 },
  priceArea: { alignItems: 'flex-end' },
  planPriceText: { fontSize: 24, fontWeight: '800', lineHeight: 28 },
  planDurationText: { fontSize: 12, marginTop: -2 },
  
  highlightBox: { padding: 10, borderRadius: 8, marginBottom: 16 },
  highlightText: { fontSize: 12, fontWeight: '500', lineHeight: 16 },
  
  featuresLabel: { fontSize: 13, fontWeight: '700', marginBottom: 10 },
  featuresList: { marginBottom: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  checkIconContainer: { width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  blockedIconContainer: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  blockedMinus: { width: 6, height: 2, backgroundColor: '#9CA3AF', borderRadius: 1 },
  featureText: { fontSize: 13, flex: 1 },
  
  chooseBtn: { paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  chooseBtnText: { fontSize: 15, fontWeight: '700' },

  bottomFeaturesContainer: { flexDirection: 'row', marginHorizontal: 16, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 8, justifyContent: 'space-between', marginBottom: 24 },
  bottomFeatureItem: { flex: 1, alignItems: 'center', paddingHorizontal: 2 },
  bottomFeatureDivider: { width: 1, backgroundColor: '#E5E7EB', marginVertical: 8 },
  bfTitle: { fontSize: 11, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  bfSubtitle: { fontSize: 9, textAlign: 'center', marginTop: 4, lineHeight: 12 },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  footerText: { fontSize: 12, fontWeight: '500' },

  activeStatusCard: { marginHorizontal: 16, marginBottom: 20, padding: 16, borderRadius: 12, borderWidth: 1 },
  activeStatusTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statusLabel: { fontSize: 14 },
  statusValue: { fontSize: 14, fontWeight: '600' },
  cancelRenewBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#EF4444', backgroundColor: 'transparent' },
  cancelRenewBtnText: { color: '#EF4444', fontSize: 12, fontWeight: '600' },

  // Custom Modal Styles
  customModalContainer: { width: '100%', borderRadius: 16, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 },
  modalIconCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  modalSubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 24, paddingHorizontal: 10 },
  modalDetailsBox: { width: '100%', borderRadius: 12, padding: 16, marginBottom: 24 },
  modalDetailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 6 },
  modalDetailLabel: { fontSize: 14, fontWeight: '500' },
  modalDetailValue: { fontSize: 14, fontWeight: '600' },
  modalDivider: { height: 1, width: '100%', marginVertical: 12 },
  modalTotalLabel: { fontSize: 16, fontWeight: '700' },
  modalTotalValue: { fontSize: 20, fontWeight: '800' },

  modalBtnCancel: {},
  modalBtnCancelText: { fontSize: 15, fontWeight: '600' },
  modalBtnProceed: { backgroundColor: '#2563EB' },
  modalBtnProceedText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  // Shared Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', borderRadius: 16, padding: 24, alignItems: 'center' },
  modalIconContainer: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  modalDesc: { fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  keyPointsContainer: { width: '100%', padding: 16, borderRadius: 12, marginBottom: 24 },
  keyPointsTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  keyPointRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  keyPointText: { fontSize: 13, marginLeft: 8, flex: 1 },
  modalActions: { flexDirection: 'row', width: '100%', gap: 12 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  modalBtnOutline: { borderWidth: 1 },
  modalBtnOutlineText: { fontSize: 15, fontWeight: '600' },
  modalBtnPrimary: { backgroundColor: '#2563EB' },
  modalBtnPrimaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' }
});

export default RechargePlanScreen;
