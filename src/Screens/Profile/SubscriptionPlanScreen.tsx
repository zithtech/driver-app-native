import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Animated,
  Platform,
  StatusBar,
  RefreshControl,
  ScrollView,
  TextInput,
  ActivityIndicator,
  InteractionManager,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useAlert } from '../../context/AlertContext';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import RazorpayCheckout from 'react-native-razorpay';
import LinearGradient from 'react-native-linear-gradient';
import Clipboard from '@react-native-clipboard/clipboard';
import Svg, { Path, Rect, G } from 'react-native-svg';
import { useSelector } from 'react-redux';
import { useHaptic } from '../../hooks/useHaptic';
import { RootState } from '../../redux/store';
import {
  useCreateSubscriptionOrderMutation,
  useVerifySubscriptionPaymentMutation,
  useGetMySubscriptionQuery,
  useGetSubscriptionPlansQuery,
  useValidatePromoMutation,
  useGetAvailablePromosQuery,
} from '../../service/userApi';
import { useAppTheme } from '../../context/ThemeContext';
import AppStatusBar from '../../Components/AppStatusBar';

/* ================= TYPES ================= */

interface PlanFeature {
  key: string;
  icon: string;
  params?: Record<string, any>;
  isBlocked?: boolean;
}

interface PlanTier {
  id: number;
  name: string;
  color: string;
  gradient: string;
  icon: string;
  features: PlanFeature[];
  pricing: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  isPopular?: boolean;
  savings?: number | null;
  tag?: string | null;
}

type Duration = 'daily' | 'weekly' | 'monthly';

/* ================= CONSTANTS ================= */
const RAZORPAY_KEY = 'rzp_test_SCjewpaZ96XBWa'; // Replace with real key in prod

const FALLBACK_COLORS = ['#2563EB', '#152D5E', '#D97706'];
const FALLBACK_GRADIENTS = ['#3B82F6', '#1E3A8A', '#F59E0B'];
const FALLBACK_ICONS = ['shield-outline', 'diamond-outline', 'trophy-outline'];

const PLAN_COLORS: Record<string, { color: string, gradient: string, icon: string }> = {
  basic: { color: '#2563EB', gradient: '#3B82F6', icon: 'shield-outline' },
  elite: { color: '#152D5E', gradient: '#1E3A8A', icon: 'diamond-outline' },
  premium: { color: '#D97706', gradient: '#F59E0B', icon: 'trophy-outline' },
};

const DURATIONS: { key: Duration; label: string }[] = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];

const SkeletonBox = ({ style, isDark, opacity }: { style?: any, isDark: boolean, opacity: any }) => {
  return (
    <Animated.View style={[{ backgroundColor: isDark ? '#374151' : '#E5E7EB', borderRadius: 8, opacity }, style]} />
  );
};

/* ================= SCREEN ================= */

const RechargeSkeleton = () => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const { isDark } = useAppTheme();

  return (
    <View style={styles.scrollContent}>
      <SkeletonBox style={{ height: 50, borderRadius: 14, marginBottom: 20 }} isDark={isDark} opacity={opacity} />
      <SkeletonBox style={{ height: 100, borderRadius: 20, marginBottom: 20 }} isDark={isDark} opacity={opacity} />
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
        <SkeletonBox style={{ flex: 1, height: 130, borderRadius: 22 }} isDark={isDark} opacity={opacity} />
        <SkeletonBox style={{ flex: 1, height: 130, borderRadius: 22 }} isDark={isDark} opacity={opacity} />
        <SkeletonBox style={{ flex: 1, height: 130, borderRadius: 22 }} isDark={isDark} opacity={opacity} />
      </View>
      <SkeletonBox style={{ height: 45, borderRadius: 14, marginBottom: 20 }} isDark={isDark} opacity={opacity} />
      <SkeletonBox style={{ height: 180, borderRadius: 16, marginBottom: 16 }} isDark={isDark} opacity={opacity} />
    </View>
  );
};

const PromoCoupon = ({ promo, tierColor, onApply, onCopy }: { promo: any; tierColor: string; onApply: (code: string) => void; onCopy: (code: string) => void }) => {
  const isPercentage = promo.discount_type === 'percentage';

  return (
    <View style={styles.couponOuterContainer}>
      {/* Top Grab deal badge - Slanted Premium Tag */}
      <View style={[styles.grabDealBadge, { backgroundColor: '#FFFFFF' }]}>
        <Text style={[styles.grabDealText, { color: tierColor }]}>GRAB THE DEAL!</Text>
      </View>

      <Pressable
        onPress={() => onApply(promo.code)}
        style={({ pressed }) => [
          styles.couponCard,
          { backgroundColor: tierColor, opacity: pressed ? 0.9 : 1 }
        ]}
      >
        {/* Scalloped edges - Left */}
        <View style={styles.scallopedEdgeLeft}>
          {[...Array(6)].map((_, i) => (
            <View key={`l-${i}`} style={styles.scallopCircleSmall} />
          ))}
        </View>

        {/* Scalloped edges - Right */}
        <View style={styles.scallopedEdgeRight}>
          {[...Array(6)].map((_, i) => (
            <View key={`r-${i}`} style={styles.scallopCircleSmall} />
          ))}
        </View>

        <View style={styles.couponContent}>
          {/* Left Portion: Massive Value */}
          <View style={styles.couponLeft}>
            <Text style={styles.couponDiscountLabel}>Flat {isPercentage ? '' : 'Rs.'}</Text>
            <Text style={[styles.couponDiscountValue, promo.discount_value > 99 && { fontSize: 36 }]}>
              {promo.discount_value}{isPercentage ? '%' : ''}
            </Text>
          </View>

          {/* Vertical Divider Line */}
          <View style={styles.couponDivider} />

          {/* Right Portion: OFF and Code */}
          <View style={styles.couponRight}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={styles.couponOffText}>{promo.label || (isPercentage ? '% OFF' : 'OFF')}</Text>
              <Pressable
                onPress={() => onCopy(promo.code)}
                style={styles.couponCopyIcon}
              >
                <Ionicons name="copy-outline" size={14} color="rgba(255,255,255,0.7)" />
              </Pressable>
            </View>

            <Text style={styles.couponDescription} numberOfLines={1}>
              {promo.description || 'Limited time offer'}
            </Text>

            <View style={styles.couponCodeContainer}>
              <Text style={styles.couponCodeHeader}>coupon: </Text>
              <Text style={styles.couponCodeText}>{promo.code}</Text>
            </View>
          </View>
        </View>

        {/* Bottom Platform Label - Black Bar */}
        <View style={styles.couponFooter}>
          <Ionicons name="phone-portrait-outline" size={10} color="rgba(255,255,255,0.6)" style={{ marginRight: 6 }} />
          <Text style={styles.couponFooterText}>ONLY ON VDRIVE APP</Text>
        </View>
      </Pressable>
    </View>
  );
};

const RechargePlanScreen: React.FC<any> = ({ navigation }) => {
  const { colors } = useTheme();
  const { showAlert } = useAlert();
  const { theme, isDark } = useAppTheme();
  const user = useSelector((state: RootState) => state.userSlice?.user);

  const { data: plansData, isLoading: isPlansLoading } = useGetSubscriptionPlansQuery();
  const { data: subscriptionData, isLoading: isSubLoading, refetch: refetchSub } = useGetMySubscriptionQuery();
  const [createSubscriptionOrder] = useCreateSubscriptionOrderMutation();
  const [verifySubscriptionPayment] = useVerifySubscriptionPaymentMutation();
  const [validatePromo] = useValidatePromoMutation();
  const { data: availablePromos } = useGetAvailablePromosQuery();

  const [selectedTierId, setSelectedTierId] = useState<number | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<Duration>('weekly');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'verifying' | 'success' | 'failed'>('idle');
  const [refreshing, setRefreshing] = useState(false);

  // Promo State
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  const [useRewardBalance, setUseRewardBalance] = useState(false);

  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { triggerHaptic } = useHaptic();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Clear promo if plan or duration changes
  useEffect(() => {
    setAppliedPromoCode(null);
    setDiscountAmount(0);
    setUseRewardBalance(false);
  }, [selectedTierId, selectedDuration]);

  const handleApplyPromo = async (codeOverride?: string) => {
    const codeToUse = codeOverride || promoInput;
    if (!codeToUse.trim()) return;

    setIsValidatingPromo(true);
    triggerHaptic(HapticFeedbackTypes.impactLight);

    try {
      const result = await validatePromo({
        code: codeToUse,
        amount: currentPrice
      }).unwrap();

      if (result.success && result.data.isValid) {
        setAppliedPromoCode(codeToUse);
        setPromoInput(codeToUse);
        setDiscountAmount(result.data.discountAmount);
        triggerHaptic(HapticFeedbackTypes.notificationSuccess);
      } else {
        throw new Error(result.message || 'Invalid promo code');
      }
    } catch (error: any) {
      setAppliedPromoCode(null);
      setDiscountAmount(0);
      triggerHaptic(HapticFeedbackTypes.notificationError);
      showAlert({
        title: 'Invalid Promo',
        message: error.data?.message || error.message || 'Could not apply promo code',
        singleButton: true,
        icon: 'close-circle-outline'
      });
    } finally {
      setIsValidatingPromo(false);
    }
  };

  const handleCopyPromo = (code: string) => {
    Clipboard.setString(code);
    triggerHaptic(HapticFeedbackTypes.impactLight);
    showAlert({
      title: 'Copied!',
      message: 'Promo code copied to clipboard',
      singleButton: true,
      icon: 'copy-outline'
    });
  };

  const getFeatureLabel = (key: string) => {
    const labels: Record<string, string> = {
      zero_commission: 'Zero Commission',
      instant_rides: 'Instant Requests',
      local_rides: 'Local Rides',
      outstation_trips: 'Outstation Trips',
      one_way_trips: 'One-Way Trips',
      scheduled_rides: 'Scheduled Rides',
      priority_support: '24/7 Priority Support',
      priority_matching: 'Priority Matching',
    };
    return labels[key] || key.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetchSub();
    setRefreshing(false);
  }, [refetchSub]);

  // Sync sub data on focus removed to prevent layout glitches on back navigation

  // Helper to map backend JSON features to translated display items
  const getDisplayFeatures = (plan: any, duration: Duration): PlanFeature[] => {
    const features: PlanFeature[] = [];
    const featObj = plan.features;

    // Support for array format (manual override / legacy)
    if (Array.isArray(featObj)) {
      return featObj.map(f => ({
        key: f.toLowerCase().replace(/ /g, '_'),
        icon: 'checkmark-circle'
      }));
    }

    const feats = featObj || {};

    // Core features
    features.push({ key: 'zero_commission', icon: 'shield-checkmark' });

    const allowedTypes = feats.allowed_ride_types || [];

    if (allowedTypes.includes('INSTANT') || feats.instant_requests) {
      features.push({ key: 'instant_rides', icon: 'car' });
    } else {
      features.push({ key: 'local_rides', icon: 'car' });
    }

    if (allowedTypes.includes('OUTSTATION') || feats.outstation_enabled) {
      features.push({ key: 'outstation_trips', icon: 'map' });
    }
    if (allowedTypes.includes('ONE-WAY') || feats.oneway_enabled) {
      features.push({ key: 'one_way_trips', icon: 'arrow-forward-circle' });
    }

    // Scheduled Rides Logic
    const sched = feats.scheduled_rides;
    let isScheduledAllowed = false;
    if (sched) {
      if (duration === 'daily') isScheduledAllowed = !!sched.daily_allowed;
      else if (duration === 'weekly') isScheduledAllowed = !!sched.weekly_allowed;
      else if (duration === 'monthly') isScheduledAllowed = !!sched.monthly_allowed;

      features.push({
        key: 'scheduled_rides',
        icon: 'calendar',
        isBlocked: !isScheduledAllowed
      });
    }

    // Support Level
    if (feats.support === '24/7 Priority Support' || feats.priority_support) {
      features.push({ key: 'priority_support', icon: 'headset' });
    }

    // Extra Benefits
    if (feats.premium_driver_rank || (plan.plan_name || plan.name || '').toLowerCase().includes('premium')) {
      features.push({ key: 'priority_matching', icon: 'star' });
    }

    return features;
  };

  // Dynamic Tiers Mapping
  const planTiers: PlanTier[] = (plansData?.data?.plans || plansData?.data || []).map((plan: any, index: number) => {
    const daily = Number(plan.daily_price || 0);
    const weekly = Number(plan.weekly_price || 0);
    const monthly = Number(plan.monthly_price || 0);

    // Calculate savings relative to daily price
    let savingsPercent = 0;
    if (selectedDuration === 'weekly' && daily > 0) {
      savingsPercent = Math.round((1 - (weekly / (daily * 7))) * 100);
    } else if (selectedDuration === 'monthly' && daily > 0) {
      savingsPercent = Math.round((1 - (monthly / (daily * 30))) * 100);
    }

    const name = plan.plan_name || plan.name || '';
    const lowerName = name.toLowerCase();

    let colorScheme = {
      color: FALLBACK_COLORS[index % 3],
      gradient: FALLBACK_GRADIENTS[index % 3],
      icon: FALLBACK_ICONS[index % 3]
    };

    if (lowerName.includes('basic')) colorScheme = PLAN_COLORS.basic;
    else if (lowerName.includes('elite')) colorScheme = PLAN_COLORS.elite;
    else if (lowerName.includes('premium')) colorScheme = PLAN_COLORS.premium;

    return {
      id: plan.id,
      name: name,
      ...colorScheme,
      features: getDisplayFeatures(plan, selectedDuration),
      pricing: { daily, weekly, monthly },
      savings: savingsPercent > 0 ? savingsPercent : null,
      isPopular: !!plan.is_popular,
      tag: plan.tag || null,
    };
  });

  useEffect(() => {
    if (planTiers.length > 0 && selectedTierId === null) {
      setSelectedTierId(planTiers[0].id);
    }
  }, [planTiers, selectedTierId]);

  const currentTier = planTiers.find((p) => p.id === selectedTierId) || planTiers[0];
  const currentPrice = currentTier?.pricing[selectedDuration] || 0;

  const getDurationKey = (cycle: string): Duration => {
    if (cycle === 'day') return 'daily';
    if (cycle === 'week') return 'weekly';
    if (cycle === 'month') return 'monthly';
    return 'daily';
  };

  const getBillingCycle = (dur: Duration): 'day' | 'week' | 'month' => {
    if (dur === 'daily') return 'day';
    if (dur === 'weekly') return 'week';
    if (dur === 'monthly') return 'month';
    return 'day';
  };

  const activePlan = subscriptionData?.data?.subscription;
  const isActivePlan = activePlan?.plan_id === selectedTierId &&
    getDurationKey(activePlan?.billing_cycle) === selectedDuration &&
    activePlan?.status?.toUpperCase() === 'ACTIVE';

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const handleTierSelect = (id: number) => {
    triggerHaptic(HapticFeedbackTypes.impactLight);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    setSelectedTierId(id);
  };

  const handleSubscribe = async () => {
    if (!selectedTierId || isActivePlan) return;

    triggerHaptic(HapticFeedbackTypes.impactMedium);
    setIsProcessing(true);
    setPaymentStatus('processing');

    try {
      const orderResponse = await createSubscriptionOrder({
        plan_id: selectedTierId,
        billing_cycle: getBillingCycle(selectedDuration),
        promo_code: appliedPromoCode || undefined,
        use_reward_balance: useRewardBalance,
      }).unwrap();

      const options = {
        description: `${currentTier.name} - ${selectedDuration.toUpperCase()} Recharge`,
        image: 'https://vdrive.com/logo.png',
        currency: 'INR',
        key: RAZORPAY_KEY,
        amount: orderResponse.data.amount,
        name: 'VDRIVE',
        order_id: orderResponse.data.order_id,
        prefill: {
          email: user?.email || '',
          contact: user?.phone_number || '',
          name: user?.full_name || '',
        },
        theme: { color: currentTier?.color || '#152D5E' },
      };

      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor(currentTier?.color || '#152D5E');
      }

      const data = await RazorpayCheckout.open(options);

      setPaymentStatus('verifying');
      const verifyResult = await verifySubscriptionPayment({
        razorpay_order_id: data.razorpay_order_id || '',
        razorpay_payment_id: data.razorpay_payment_id || '',
        razorpay_signature: data.razorpay_signature || '',
      }).unwrap();

      if (verifyResult.success) {
        setPaymentStatus('success');
        triggerHaptic(HapticFeedbackTypes.notificationSuccess);
        showAlert({
          title: 'Subscription',
          message: 'Your plan has been upgraded successfully.',
          singleButton: true,
          icon: 'star-outline',
        });
        refetchSub();
      } else {
        throw new Error('Verification failed');
      }
    } catch (error: any) {
      setPaymentStatus('failed');
      showAlert({
        title: 'Payment Failed',
        message: error.message || 'Something went wrong',
        singleButton: true,
        icon: 'close-circle-outline',
      });
    } finally {
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor('transparent');
      }
      setIsProcessing(false);
    }
  };

  const getFriendlyDuration = (dur: Duration) => {
    if (dur === 'daily') return 'day';
    if (dur === 'weekly') return 'week';
    if (dur === 'monthly') return 'month';
    return 'day';
  };

  if (isPlansLoading || isSubLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom', 'left', 'right']}>
        {isFocused && <AppStatusBar forceLight={true} />}

        <ScrollView
          contentContainerStyle={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors?.primary || '#152D5E']}
              tintColor={colors?.primary || '#152D5E'}
            />
          }
        >
          <LinearGradient
            colors={isDark ? ['#152D5E', '#0F172A'] : ['#152D5E', '#1E3A8A']}
            style={[styles.premiumHeader, { paddingTop: insets.top + 10 }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={[styles.headerContainer]}>
              <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
              </Pressable>
              <Text style={styles.premiumTitle} numberOfLines={1} adjustsFontSizeToFit>Subscription Plan</Text>
            </View>
          </LinearGradient>
          <RechargeSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (planTiers.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
          <Text style={{ marginTop: 12, color: '#9CA3AF', fontSize: 16 }}>No plans available at the moment</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom', 'left', 'right']}>
      {isFocused && <AppStatusBar forceLight={true} />}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors?.primary || '#152D5E']}
            tintColor={colors?.primary || '#152D5E'}
          />
        }
      >
        <LinearGradient
          colors={isDark ? ['#152D5E', '#0F172A'] : ['#152D5E', '#1E3A8A']}
          style={[styles.premiumHeader, { paddingTop: insets.top + 10 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >


          {/* Promo Banner */}


          {/* Title Section */}

          <View style={[styles.headerContainer]}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [
                styles.backButton,
                { opacity: pressed ? 0.6 : 1 }
              ]}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </Pressable>
            <View style={styles.headerTitleWrapper}>
              <Text style={styles.pickYourText}>
                Pick Your <Text style={styles.planWordText}>Plan</Text>
              </Text>
              <Text style={styles.subTitleText}>Drive & Earn Faster</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.contentContainer}>
          {/* Tier Selection Cards */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tierCardsScroll}
            style={styles.tierCardsWrapper}
          >
            {planTiers.map((tier) => (
              <Pressable
                key={tier.id}
                onPress={() => handleTierSelect(tier.id)}
                style={({ pressed }) => [
                  { transform: [{ scale: pressed ? 0.98 : 1 }] }
                ]}
              >
                <LinearGradient
                  colors={selectedTierId === tier.id
                    ? [tier.gradient, tier.color]
                    : (isDark ? ['#374151', '#1F2937'] : ['#FFFFFF', '#F9FAFB'])}
                  style={[
                    styles.tierCard,
                    selectedTierId === tier.id && { borderColor: tier.color },
                    tier.isPopular && { borderWidth: 2, borderColor: selectedTierId === tier.id ? '#FFF' : tier.color }
                  ]}
                >
                  {tier.tag && (
                    <View style={[styles.popularBadge, { backgroundColor: selectedTierId === tier.id ? '#FFF' : tier.color }]}>
                      <Text style={[styles.popularBadgeText, { color: selectedTierId === tier.id ? tier.color : '#FFF' }]}>
                        {tier.tag}
                      </Text>
                    </View>
                  )}
                  <View style={[
                    styles.tierIconContainer,
                    { backgroundColor: selectedTierId === tier.id ? 'rgba(255,255,255,0.2)' : (isDark ? '#4B5563' : '#F3F4F6') }
                  ]}>
                    <Ionicons
                      name={tier.icon as any}
                      size={26}
                      color={selectedTierId === tier.id ? '#FFFFFF' : tier.color}
                    />
                  </View>
                  <Text style={[
                    styles.tierNameText,
                    { color: selectedTierId === tier.id ? '#FFFFFF' : (isDark ? '#E5E7EB' : '#1E3A8A') }
                  ]} numberOfLines={1} adjustsFontSizeToFit>
                    {tier.name}
                  </Text>
                </LinearGradient>
              </Pressable>
            ))}
          </ScrollView>

          {/* Duration Selection */}
          <View style={styles.durationTabs}>
            {DURATIONS.map((dur) => (
              <Pressable
                key={dur.key}
                onPress={() => setSelectedDuration(dur.key)}
                style={[
                  styles.durationTab,
                  selectedDuration === dur.key && { backgroundColor: currentTier?.color || '#2563EB' }
                ]}
              >
                <Text style={[
                  styles.durationTabText,
                  selectedDuration === dur.key && styles.selectedDurationTabText
                ]} numberOfLines={1} adjustsFontSizeToFit>
                  {dur.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Promo Code Section */}
          <View style={[styles.promoSection, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
            {/* Available Promos Horizontal Scroll */}
            {availablePromos?.data?.length > 0 && !appliedPromoCode && (
              <View style={styles.availableOffersWrapper}>
                <Text style={[styles.availableOffersTitle, { color: isDark ? '#9CA3AF' : '#475569' }]}>
                  Available Offers
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.availableOffersScroll}>
                  {availablePromos.data.map((promo: any) => (
                    <PromoCoupon
                      key={promo.id}
                      promo={promo}
                      tierColor={currentTier?.color || '#2563EB'}
                      onApply={handleApplyPromo}
                      onCopy={handleCopyPromo}
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={[styles.promoInputRow, availablePromos?.data?.length > 0 && !appliedPromoCode && { marginTop: 15 }]}>
              <View style={[styles.promoInputWrapper, { borderColor: isDark ? '#334155' : '#E2E8F0', backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
                <Ionicons name="pricetag" size={18} color={isDark ? '#94A3B8' : '#475569'} style={{ marginRight: 12 }} />
                <TextInput
                  style={[styles.promoTextInput, { color: isDark ? '#FFFFFF' : '#1E293B' }]}
                  placeholder="Enter Promo Code"
                  placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                  value={promoInput}
                  onChangeText={setPromoInput}
                  autoCapitalize="characters"
                  editable={!isValidatingPromo && !appliedPromoCode}
                />
                {appliedPromoCode && (
                  <Pressable onPress={() => { setAppliedPromoCode(null); setDiscountAmount(0); setPromoInput(''); }}>
                    <Ionicons name="close-circle" size={20} color="#EF4444" />
                  </Pressable>
                )}
              </View>
              <Pressable
                onPress={() => handleApplyPromo()}
                disabled={isValidatingPromo || !!appliedPromoCode || !promoInput.trim()}
                style={[
                  styles.applyPromoButton,
                  { backgroundColor: appliedPromoCode ? '#10B981' : (currentTier?.color || '#2563EB') },
                  (isValidatingPromo || (!appliedPromoCode && !promoInput.trim())) && { opacity: 0.6 }
                ]}
              >
                {isValidatingPromo ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.applyPromoText} numberOfLines={1} adjustsFontSizeToFit>
                    {appliedPromoCode ? 'Applied' : 'Apply'}
                  </Text>
                )}
              </Pressable>
            </View>

            {/* Wallet Rewards Section */}
            {Number(user?.credit?.balance || 0) > 0 && (
              <View style={[
                styles.rewardSection,
                {
                  backgroundColor: isDark ? '#0F172A' : '#F0F9FF',
                  borderColor: useRewardBalance ? '#0EA5E9' : (isDark ? '#1E293B' : '#E0F2FE')
                }
              ]}>
                <View style={styles.rewardHeader}>
                  <View style={styles.rewardIconWrapper}>
                    <Ionicons name="gift" size={20} color="#0EA5E9" />
                  </View>
                  <View style={styles.rewardInfo}>
                    <Text style={[styles.rewardTitle, { color: isDark ? '#F1F5F9' : '#0F172A' }]} numberOfLines={1} adjustsFontSizeToFit>Referral Rewards</Text>
                    <Text style={[styles.rewardSubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      Available: <Text style={{ fontWeight: '800', color: '#0EA5E9' }}>₹{user?.credit?.balance || 0}</Text>
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      triggerHaptic(HapticFeedbackTypes.impactLight);
                      setUseRewardBalance(!useRewardBalance);
                    }}
                    style={[
                      styles.rewardApplyBtn,
                      { backgroundColor: useRewardBalance ? '#0EA5E9' : 'transparent', borderWidth: useRewardBalance ? 0 : 1, borderColor: '#0EA5E9' }
                    ]}
                  >
                    <Text style={[styles.rewardApplyText, { color: useRewardBalance ? '#FFF' : '#0EA5E9' }]} numberOfLines={1} adjustsFontSizeToFit>
                      {useRewardBalance ? 'Applied' : 'Apply'}
                    </Text>
                  </Pressable>
                </View>
                {useRewardBalance && (
                  <View style={styles.rewardCalculation}>
                    <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                    <Text style={styles.rewardCalcText}>
                      Extra ₹{Math.min(user?.credit?.balance || 0, currentPrice - discountAmount)} discount applied!
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Selected Plan Details */}
          <Animated.View style={[
            styles.mainPlanCard,
            {
              transform: [{ scale: scaleAnim }],
              backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
              borderRadius: 16, // Softer radius for the shadow look
            }
          ]}>
            <View style={styles.planCardHeader}>
              <View style={[styles.planTitleContainer, { backgroundColor: (currentTier?.color || '#2563EB') + '15', marginBottom: 0, borderWidth: 1, borderColor: (currentTier?.color || '#2563EB') + '30' }]}>
                <Ionicons name={currentTier?.icon || 'shield-outline'} size={14} color={currentTier?.color || '#2563EB'} style={{ marginRight: 6 }} />
                <Text style={[styles.mainPlanName, { color: currentTier?.color || '#2563EB' }]} numberOfLines={1} adjustsFontSizeToFit>{(currentTier?.name || '').toUpperCase()}</Text>
              </View>

              {currentTier?.savings && (
                <View style={[styles.saveBadge, { backgroundColor: isDark ? '#1E3A8A' : '#EBF2FF' }]}>
                  <Text style={[styles.saveBadgeText, { color: isDark ? '#60A5FA' : '#2563EB' }]} numberOfLines={1} adjustsFontSizeToFit>
                    SAVE {currentTier?.savings}%
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.mainPriceRow}>
              {(discountAmount > 0 || useRewardBalance) ? (
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <Text style={[styles.mainPriceText, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                    ₹{Math.max(0, currentPrice - discountAmount - (useRewardBalance ? Number(user?.credit?.balance || 0) : 0))}
                  </Text>
                  <Text style={[styles.originalPriceText, { color: isDark ? '#6B7280' : '#9CA3AF', textDecorationLine: 'line-through', marginLeft: 8, fontSize: 16 }]}>₹{currentPrice}</Text>
                </View>
              ) : (
                <Text style={[styles.mainPriceText, { color: isDark ? '#FFFFFF' : '#111827' }]}>₹{currentPrice}</Text>
              )}
              <Text style={styles.mainDurationText}>/ {getFriendlyDuration(selectedDuration)}</Text>
            </View>

            {isActivePlan && (
              <View style={[styles.activePlanBadge, { marginHorizontal: 20, marginBottom: 15 }]}>
                <Ionicons name="shield-checkmark" size={14} color="#10B981" />
                <Text style={styles.activePlanExpiryText}>
                  ACTIVE • Expires {new Date(activePlan.expiry_date).toLocaleDateString()}
                </Text>
              </View>
            )}

            <View style={[styles.divider, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]} />

            <View style={styles.featuresSection}>
              <Text style={styles.featuresTitle} numberOfLines={1} adjustsFontSizeToFit>WHAT'S INCLUDED</Text>
              <View style={styles.featuresGrid}>
                {(currentTier?.features || []).map((feature: any, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.featureGridItem,
                      { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }
                    ]}
                  >
                    <View style={[
                      styles.checkCircle,
                      {
                        backgroundColor: feature.isBlocked
                          ? (isDark ? '#374151' : '#F3F4F6')
                          : (currentTier?.color || '#2563EB'),
                      }
                    ]}>
                      <Ionicons
                        name={feature.icon}
                        size={12}
                        color={feature.isBlocked ? "#9CA3AF" : "white"}
                      />
                    </View>
                    <Text style={[
                      styles.featureLineText,
                      { color: isDark ? '#E5E7EB' : '#334155' },
                      feature.isBlocked && { textDecorationLine: 'line-through', color: '#9CA3AF' }
                    ]} numberOfLines={1} adjustsFontSizeToFit>
                      {getFeatureLabel(feature.key)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>

          {/* Action Button */}
          <View style={styles.bottomSection}>
            <Pressable
              onPress={handleSubscribe}
              disabled={isProcessing || isActivePlan}
              style={[
                styles.mainSubscribeButton,
                { backgroundColor: isActivePlan ? '#10B981' : (currentTier?.color || '#2563EB') }
              ]}
            >
              <Ionicons name="lock-closed" size={20} color="white" style={styles.lockIcon} />
              <Text style={styles.subscribeText} numberOfLines={1} adjustsFontSizeToFit>
                {isActivePlan ? 'Current Active Plan' : `Subscribe Now • ₹${Math.max(0, currentPrice - discountAmount - (useRewardBalance ? Number(user?.credit?.balance || 0) : 0))}`}
              </Text>
            </Pressable>

            <View style={styles.securityInfo}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#9CA3AF" />
              <Text style={styles.securityText}>Secured with 256-bit Encryption</Text>
            </View>

            <Pressable style={styles.refundLink}>
              <Text style={styles.refundText}>Refund Policy</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flexGrow: 1 },
  premiumHeader: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  backButtonAbsolute: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  premiumTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: 'white',
  },
  // promoBanner: {
  //   backgroundColor: '#FEF3C7',
  //   marginHorizontal: 20,
  //   borderRadius: 15,
  //   padding: 15,
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   marginTop: 10,
  // },
  // promoIcon: { marginRight: 12 },
  // promoTitle: { color: '#92400E', fontSize: 16, fontWeight: 'bold' },
  // promoSubtitle: { color: '#B45309', fontSize: 13 },

  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitleWrapper: {
    flex: 1,
  },
  pickYourText: {
    fontSize: 26,
    fontWeight: '800',
    color: 'white',
    letterSpacing: -0.5,
  },
  planWordText: { color: '#FBBF24' },
  subTitleText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
    fontWeight: '500',
  },
  contentContainer: {
    flex: 1,
    marginTop: -20,
  },
  tierCardsWrapper: {
    maxHeight: 210,
    marginBottom: 10,
  },
  tierCardsScroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 16,
  },
  tierCard: {
    width: 90,
    borderRadius: 22,
    padding: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',

  },
  selectedTierCard: {
    borderColor: '#FFFFFF',
  },
  // eliteCardBorder: {
  //   borderColor: '#1E3A8A',
  //   borderWidth: 2,
  // },
  popularBadge: {
    position: 'absolute',
    top: -10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  popularBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  tierIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  tierNameText: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  tierPriceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  tierPriceText: { fontSize: 18, fontWeight: '900' },
  tierDurationText: { fontSize: 11, fontWeight: '600' },

  durationTabs: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 15,
    padding: 2,
    marginBottom: 6,
    marginHorizontal: 18,
  },
  durationTab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  selectedDurationTab: {
    backgroundColor: '#1E3A8A',
  },
  durationTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  selectedDurationTabText: {
    color: 'white',
  },
  mainPlanCard: {
    padding: 16,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  planTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  mainPlanName: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  mainPriceRow: { 
    flexDirection: 'row', 
    alignItems: 'baseline', 
    justifyContent: 'center',
    marginVertical: 10,
  },
  mainPriceText: { fontSize: 48, fontWeight: '900', letterSpacing: -1 },
  mainDurationText: { fontSize: 20, color: '#4B5563', marginLeft: 6, fontWeight: '800', textTransform: 'capitalize' },
  activePlanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 14,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  activePlanExpiryText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '700',
    marginLeft: 6,
  },
  saveBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  saveBadgeText: { fontSize: 13, fontWeight: '800' },
  divider: {
    height: 1,
    width: '100%',
    marginVertical: 20,
  },
  featuresSection: { marginTop: 10 },
  featuresTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.5,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  featuresGrid: {
    flexDirection: 'column',
    gap: 8,
  },
  featureGridItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureLineText: { fontSize: 14, color: '#1F2937', fontWeight: '600' },
  bottomSection: {
    marginTop: 30,
    paddingBottom: 40,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  mainSubscribeButton: {
    width: '100%',
    height: 60,
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  lockIcon: { marginRight: 10 },
  subscribeText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  securityText: { color: '#9CA3AF', fontSize: 12, marginLeft: 8 },
  refundLink: { marginTop: 10 },
  refundText: { color: '#9CA3AF', fontSize: 12, textDecorationLine: 'underline' },
  promoSection: {
    marginHorizontal: 16,
    padding: 10,
    borderRadius: 10,
    marginBottom: 20,
  },
  promoInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  promoInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 18,
    paddingHorizontal: 12,
    height: 50,
    marginRight: 12,
  },
  promoTextInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    padding: 0,
  },
  applyPromoButton: {
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
  },
  applyPromoText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  availableOffersWrapper: {
    marginTop: 16,
  },
  availableOffersTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  availableOffersScroll: {
    paddingRight: 20,
    paddingBottom: 10,
  },
  originalPriceText: {
    marginLeft: 8,
  },
  scrollContent: { paddingBottom: 20 },

  // Coupon Styles
  couponOuterContainer: {
    marginRight: 12,
    paddingTop: 4,
    position: 'relative',
    width: 300,
  },
  grabDealBadge: {
    position: 'absolute',
    top: -2,
    left: 18,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 10,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '-2deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  grabDealText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  couponCard: {
    height: 130,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  scallopedEdgeLeft: {
    position: 'absolute',
    left: -8,
    top: 0,
    bottom: 0,
    justifyContent: 'space-around',
    zIndex: 5,
  },
  scallopedEdgeRight: {
    position: 'absolute',
    right: -8,
    top: 0,
    bottom: 0,
    justifyContent: 'space-around',
    zIndex: 5,
  },
  scallopCircleSmall: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  couponContent: {
    flex: 1,
    flexDirection: 'row',
    paddingLeft: 20,
    paddingRight: 12,
    paddingVertical: 14,
  },
  couponLeft: {
    width: '44%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  couponDiscountLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  couponDiscountValue: {
    color: '#FFF',
    fontSize: 48,
    fontWeight: '900',
    lineHeight: 52,
  },
  couponDivider: {
    width: 1,
    height: '100%',
    borderLeftWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.4)',
    marginHorizontal: 10,
  },
  couponRight: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: 4,
  },
  couponOffText: {
    color: '#FFF',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
  },
  couponCopyIcon: {
    marginLeft: 10,
    backgroundColor: 'rgba(0,0,0,0.15)',
    padding: 6,
    borderRadius: 20,
  },
  couponCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  couponCodeHeader: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '600',
  },
  couponCodeText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  couponDescription: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  couponFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingVertical: 4,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  couponFooterText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  rewardSection: {
    marginTop: 15,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    marginHorizontal: 18,
  },
  rewardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rewardIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  rewardInfo: {
    flex: 1,
  },
  rewardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  rewardSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  rewardApplyBtn: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 10,
  },
  rewardApplyText: {
    fontSize: 12,
    fontWeight: '800',
  },
  rewardCalculation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(14, 165, 233, 0.1)',
  },
  rewardCalcText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
    marginLeft: 6,
  },
});

export default RechargePlanScreen;
