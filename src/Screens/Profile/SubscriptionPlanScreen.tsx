import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  StatusBar,
  RefreshControl,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Animated
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, useIsFocused } from '@react-navigation/native';
import { useAlert } from '../../context/AlertContext';
import { useTranslation } from 'react-i18next';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import RazorpayCheckout from 'react-native-razorpay';
import Clipboard from '@react-native-clipboard/clipboard';
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

const FALLBACK_COLORS = ['#3B82F6', '#1E3A8A', '#F59E0B'];
const FALLBACK_ICONS = ['shield-outline', 'diamond-outline', 'trophy-outline'];

const PLAN_COLORS: Record<string, { color: string, icon: string }> = {
  basic: { color: '#3B82F6', icon: 'shield-outline' },
  elite: { color: '#1E3A8A', icon: 'diamond-outline' },
  premium: { color: '#F59E0B', icon: 'trophy-outline' },
};

const DURATIONS: { key: Duration; label: string }[] = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];

/* ================= SCREEN ================= */

const MinimalPromoCoupon = ({ promo, tierColor, onApply, onCopy, isDark }: { promo: any; tierColor: string; onApply: (code: string) => void; onCopy: (code: string) => void; isDark: boolean }) => {
  const isPercentage = promo.discount_type === 'percentage';
  
  return (
    <View style={[styles.minimalCoupon, { borderColor: isDark ? '#334155' : '#E2E8F0', backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }]}>
      <View style={styles.couponLeft}>
        <Text style={[styles.couponValue, { color: tierColor }]}>
          {isPercentage ? `${promo.discount_value}%` : `₹${promo.discount_value}`} OFF
        </Text>
        <Text style={[styles.couponDesc, { color: isDark ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
          {promo.description || 'Limited time offer'}
        </Text>
      </View>
      <View style={styles.couponRight}>
        <Pressable style={styles.couponCodeBox} onPress={() => onCopy(promo.code)}>
          <Text style={[styles.couponCodeText, { color: isDark ? '#E2E8F0' : '#334155' }]}>{promo.code}</Text>
          <Ionicons name="copy-outline" size={12} color={isDark ? '#94A3B8' : '#64748B'} style={{ marginLeft: 4 }} />
        </Pressable>
        <Pressable onPress={() => onApply(promo.code)}>
          <Text style={[styles.couponApplyText, { color: tierColor }]}>APPLY</Text>
        </Pressable>
      </View>
    </View>
  );
};

const RechargePlanScreen: React.FC<any> = ({ navigation }) => {
  const { colors } = useTheme();
  const { showAlert } = useAlert();
  const { t } = useTranslation();
  const { isDark } = useAppTheme();
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
      const result = await validatePromo({ code: codeToUse, amount: currentPrice }).unwrap();
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
      showAlert({ title: 'Invalid Promo', message: error.data?.message || error.message || 'Could not apply promo code', singleButton: true, icon: 'close-circle-outline' });
    } finally {
      setIsValidatingPromo(false);
    }
  };

  const handleCopyPromo = (code: string) => {
    Clipboard.setString(code);
    triggerHaptic(HapticFeedbackTypes.impactLight);
    showAlert({ title: 'Copied!', message: 'Promo code copied to clipboard', singleButton: true, icon: 'copy-outline' });
  };

  const getFeatureLabel = (key: string) => {
    const labels: Record<string, string> = {
      zero_commission: 'Zero Commission',
      instant_rides: 'Instant Requests',
      // local_rides: 'Local Rides',
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

  const getDisplayFeatures = (plan: any, duration: Duration): PlanFeature[] => {
    const features: PlanFeature[] = [];
    const featObj = plan.features;
    if (Array.isArray(featObj)) return featObj.map(f => ({ key: f.toLowerCase().replace(/ /g, '_'), icon: 'checkmark' }));
    
    const feats = featObj || {};
    features.push({ key: 'zero_commission', icon: 'checkmark' });
    
    const allowedTypes = feats.allowed_ride_types || [];
    if (allowedTypes.includes('INSTANT') || feats.instant_requests) features.push({ key: 'instant_rides', icon: 'checkmark' });
    // else features.push({ key: 'local_rides', icon: 'checkmark' });

    if (allowedTypes.includes('OUTSTATION') || allowedTypes.includes('OUTSTATION_ONE_WAY') || allowedTypes.includes('OUTSTATION_ROUND_TRIP') || feats.outstation_enabled) features.push({ key: 'outstation_trips', icon: 'checkmark' });
    if (allowedTypes.includes('ONE-WAY') || feats.oneway_enabled) features.push({ key: 'one_way_trips', icon: 'checkmark' });

    const sched = feats.scheduled_rides;
    let isScheduledAllowed = false;
    if (sched) {
      if (duration === 'daily') isScheduledAllowed = !!sched.daily_allowed;
      else if (duration === 'weekly') isScheduledAllowed = !!sched.weekly_allowed;
      else if (duration === 'monthly') isScheduledAllowed = !!sched.monthly_allowed;
      features.push({ key: 'scheduled_rides', icon: 'checkmark', isBlocked: !isScheduledAllowed });
    }

    if (feats.support === '24/7 Priority Support' || feats.priority_support) features.push({ key: 'priority_support', icon: 'checkmark' });
    if (feats.premium_driver_rank || (plan.plan_name || plan.name || '').toLowerCase().includes('premium')) features.push({ key: 'priority_matching', icon: 'checkmark' });
    return features;
  };

  const planTiers: PlanTier[] = (plansData?.data?.plans || plansData?.data || []).map((plan: any, index: number) => {
    const daily = Number(plan.daily_price || 0);
    const weekly = Number(plan.weekly_price || 0);
    const monthly = Number(plan.monthly_price || 0);

    let savingsPercent = 0;
    if (selectedDuration === 'weekly' && daily > 0) savingsPercent = Math.round((1 - (weekly / (daily * 7))) * 100);
    else if (selectedDuration === 'monthly' && daily > 0) savingsPercent = Math.round((1 - (monthly / (daily * 30))) * 100);

    const name = plan.plan_name || plan.name || '';
    const lowerName = name.toLowerCase();

    let colorScheme = { color: FALLBACK_COLORS[index % 3], icon: FALLBACK_ICONS[index % 3] };
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
  const finalPrice = Math.max(0, currentPrice - discountAmount - (useRewardBalance ? Number(user?.credit?.balance || 0) : 0));

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

  const handleTierSelect = (id: number) => {
    triggerHaptic(HapticFeedbackTypes.impactLight);
    setSelectedTierId(id);
  };

  const handleSubscribe = async () => {
    if (!selectedTierId || isActivePlan) return;
    triggerHaptic(HapticFeedbackTypes.impactMedium);
    setIsProcessing(true);

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
        prefill: { email: user?.email || '', contact: user?.phone_number || '', name: user?.full_name || '' },
        theme: { color: currentTier?.color || '#152D5E' },
      };

      const data = await RazorpayCheckout.open(options);

      const verifyResult = await verifySubscriptionPayment({
        razorpay_order_id: data.razorpay_order_id || '',
        razorpay_payment_id: data.razorpay_payment_id || '',
        razorpay_signature: data.razorpay_signature || '',
      }).unwrap();

      if (verifyResult.success) {
        triggerHaptic(HapticFeedbackTypes.notificationSuccess);
        refetchSub();
        navigation.replace('SubscriptionSuccessScreen', {
          planName: currentTier.name,
          planColor: currentTier.color,
          amountPaid: finalPrice,
          duration: selectedDuration,
          transactionId: data.razorpay_payment_id || 'Free/Promo'
        });
      } else {
        throw new Error('Verification failed');
      }
    } catch (error: any) {
      showAlert({ title: 'Payment Failed', message: error.message || 'Something went wrong', singleButton: true, icon: 'close-circle-outline' });
    } finally {
      setIsProcessing(false);
    }
  };

  const getFriendlyDuration = (dur: Duration) => {
    if (dur === 'daily') return 'Day';
    if (dur === 'weekly') return 'Week';
    if (dur === 'monthly') return 'Month';
    return 'Day';
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

  if (planTiers.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#111827' : '#FFFFFF' }]} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.emptyContainer}>
          <Ionicons name="information-circle-outline" size={48} color={isDark ? '#6B7280' : '#9CA3AF'} />
          <Text style={[styles.emptyText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>No plans available</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#111827' : '#FFFFFF' }]} edges={['bottom', 'left', 'right']}>
      {isFocused && <AppStatusBar forceLight={false} />}
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#111827'} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>{t('choose_plan') || 'Choose Plan'}</Text>
        <Pressable onPress={() => navigation.navigate('MySubscriptionScreen')} style={styles.mySubBtn}>
          <Text style={[styles.mySubBtnText, { color: colors?.primary || '#3B82F6' }]}>{t('my_plan') || 'My Plan'}</Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors?.primary || '#1E3A8A']} />}
      >
        {/* Duration Tabs (Sleek) */}
        <View style={[styles.durationTabs, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
          {DURATIONS.map((dur) => {
            const isSelected = selectedDuration === dur.key;
            return (
              <Pressable
                key={dur.key}
                onPress={() => setSelectedDuration(dur.key)}
                style={[styles.durationTab, isSelected && { backgroundColor: isDark ? '#374151' : '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }]}
              >
                <Text style={[styles.durationTabText, { color: isSelected ? (isDark ? '#FFFFFF' : '#111827') : (isDark ? '#9CA3AF' : '#6B7280') }, isSelected && { fontWeight: '600' }]}>
                  {dur.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Plan Cards (Vertical Stack) */}
        <View style={styles.planStack}>
          {planTiers.map((tier) => {
            const isSelected = selectedTierId === tier.id;
            return (
              <Pressable
                key={tier.id}
                onPress={() => handleTierSelect(tier.id)}
                style={[
                  styles.planCard,
                  { 
                    backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                    borderColor: isSelected ? (tier.color || '#3B82F6') : (isDark ? '#374151' : '#E5E7EB'),
                    borderWidth: isSelected ? 2 : 1
                  }
                ]}
              >
                {tier.isPopular && (
                  <View style={[styles.popularBadge, { backgroundColor: tier.color }]}>
                    <Text style={styles.popularBadgeText}>{tier.tag || 'POPULAR'}</Text>
                  </View>
                )}
                
                <View style={styles.planCardRow}>
                  <View style={styles.planCardLeft}>
                    <Text style={[styles.planNameText, { color: isDark ? '#F3F4F6' : '#111827' }]}>{tier.name}</Text>
                    {tier.savings ? (
                      <Text style={[styles.savingsText, { color: tier.color }]}>Save {tier.savings}%</Text>
                    ) : (
                      <Text style={[styles.savingsText, { color: 'transparent' }]}>-</Text>
                    )}
                  </View>
                  <View style={styles.planCardRight}>
                    <Text style={[styles.planPriceText, { color: isDark ? '#F9FAFB' : '#111827' }]}>₹{tier.pricing[selectedDuration]}</Text>
                    <Text style={[styles.planDurationText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>/ {getFriendlyDuration(selectedDuration)}</Text>
                  </View>
                  
                  {/* Selection Indicator */}
                  <View style={[styles.radioCircle, { borderColor: isSelected ? tier.color : (isDark ? '#4B5563' : '#D1D5DB') }]}>
                    {isSelected && <View style={[styles.radioDot, { backgroundColor: tier.color }]} />}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.divider, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]} />

        {/* Features List */}
        <View style={styles.featuresSection}>
          <Text style={[styles.sectionTitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>INCLUDES</Text>
          {currentTier?.features.map((feature, idx) => (
            <View key={idx} style={styles.featureRow}>
              <Ionicons 
                name={feature.isBlocked ? "close" : "checkmark"} 
                size={18} 
                color={feature.isBlocked ? (isDark ? '#6B7280' : '#9CA3AF') : (currentTier.color || '#10B981')} 
                style={styles.featureIcon} 
              />
              <Text style={[
                styles.featureText, 
                { color: isDark ? '#D1D5DB' : '#374151' },
                feature.isBlocked && { textDecorationLine: 'line-through', color: isDark ? '#6B7280' : '#9CA3AF' }
              ]}>
                {getFeatureLabel(feature.key)}
              </Text>
            </View>
          ))}
        </View>

        <View style={[styles.divider, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]} />

        {/* Offers Section */}
        <View style={styles.offersSection}>
          <Text style={[styles.sectionTitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>PROMO CODE</Text>
          
          <View style={[styles.promoInputRow, { borderColor: isDark ? '#374151' : '#E5E7EB', backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
            <Ionicons name="pricetag-outline" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} style={styles.promoIcon} />
            <TextInput
              style={[styles.promoInput, { color: isDark ? '#FFFFFF' : '#111827' }]}
              placeholder="Enter code"
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              value={promoInput}
              onChangeText={setPromoInput}
              autoCapitalize="characters"
              editable={!isValidatingPromo && !appliedPromoCode}
            />
            {appliedPromoCode ? (
              <Pressable onPress={() => { setAppliedPromoCode(null); setDiscountAmount(0); setPromoInput(''); }} style={styles.promoActionBtn}>
                <Ionicons name="close-circle" size={20} color="#EF4444" />
              </Pressable>
            ) : (
              <Pressable 
                onPress={() => handleApplyPromo()} 
                disabled={isValidatingPromo || !promoInput.trim()}
                style={[styles.promoActionBtn, (!promoInput.trim() || isValidatingPromo) && { opacity: 0.4 }]}
              >
                <Text style={[styles.applyText, { color: currentTier?.color || '#3B82F6' }]}>Apply</Text>
              </Pressable>
            )}
          </View>

          {/* Available Promos List (Minimal) */}
          {availablePromos?.data?.length > 0 && !appliedPromoCode && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.promosScroll} contentContainerStyle={{ paddingRight: 20 }}>
              {availablePromos.data.map((promo: any) => (
                <MinimalPromoCoupon 
                  key={promo.id} 
                  promo={promo} 
                  tierColor={currentTier?.color || '#3B82F6'} 
                  onApply={handleApplyPromo} 
                  onCopy={handleCopyPromo} 
                  isDark={isDark} 
                />
              ))}
            </ScrollView>
          )}

          {/* Reward Balance */}
          {Number(user?.credit?.balance || 0) > 0 && (
            <View style={[styles.rewardCard, { borderColor: isDark ? '#374151' : '#E5E7EB', backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
              <View style={styles.rewardLeft}>
                <Ionicons name="gift-outline" size={20} color="#0EA5E9" />
                <View style={{ marginLeft: 12 }}>
                  <Text style={[styles.rewardTitle, { color: isDark ? '#F3F4F6' : '#111827' }]}>Wallet Balance</Text>
                  <Text style={[styles.rewardSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Available: ₹{user?.credit?.balance || 0}</Text>
                </View>
              </View>
              <Pressable
                onPress={() => { triggerHaptic(HapticFeedbackTypes.impactLight); setUseRewardBalance(!useRewardBalance); }}
                style={[styles.rewardToggleBtn, useRewardBalance && { backgroundColor: '#0EA5E9' }]}
              >
                <Text style={[styles.rewardToggleText, { color: useRewardBalance ? '#FFFFFF' : '#0EA5E9' }]}>{useRewardBalance ? 'Applied' : 'Use'}</Text>
              </Pressable>
            </View>
          )}
        </View>

      </ScrollView>

      {/* Floating Bottom Bar */}
      <View style={[styles.bottomBar, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF', borderTopColor: isDark ? '#374151' : '#F3F4F6' }]}>
        <View style={styles.bottomPriceInfo}>
          <Text style={[styles.totalLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Total</Text>
          <Text style={[styles.finalPrice, { color: isDark ? '#FFFFFF' : '#111827' }]}>₹{finalPrice}</Text>
          {(discountAmount > 0 || useRewardBalance) && (
            <Text style={[styles.originalPrice, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>₹{currentPrice}</Text>
          )}
        </View>
        <Pressable
          onPress={handleSubscribe}
          disabled={isProcessing || isActivePlan}
          style={[styles.subscribeBtn, { backgroundColor: isActivePlan ? '#10B981' : (currentTier?.color || '#3B82F6') }, isProcessing && { opacity: 0.7 }]}
        >
          {isProcessing ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.subscribeBtnText}>{isActivePlan ? 'Current Plan' : 'Subscribe'}</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { marginTop: 12, fontSize: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  mySubBtn: { padding: 4, paddingHorizontal: 8, backgroundColor: 'rgba(150,150,150,0.1)', borderRadius: 8 },
  mySubBtnText: { fontSize: 14, fontWeight: '700' },
  scrollContent: { paddingBottom: 100 }, // Space for bottom bar
  
  durationTabs: { flexDirection: 'row', marginHorizontal: 20, borderRadius: 12, padding: 4, marginBottom: 16 },
  durationTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  durationTabText: { fontSize: 13, fontWeight: '500' },

  planStack: { paddingHorizontal: 20, gap: 12 },
  planCard: { borderRadius: 16, padding: 16, position: 'relative' },
  popularBadge: { position: 'absolute', top: -10, left: 16, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  popularBadgeText: { color: 'white', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  planCardRow: { flexDirection: 'row', alignItems: 'center' },
  planCardLeft: { flex: 1 },
  planNameText: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  savingsText: { fontSize: 12, fontWeight: '600' },
  planCardRight: { alignItems: 'flex-end', marginRight: 16 },
  planPriceText: { fontSize: 18, fontWeight: '800' },
  planDurationText: { fontSize: 12 },
  radioCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: 6 },

  divider: { height: 1, marginHorizontal: 20, marginVertical: 16 },
  
  featuresSection: { paddingHorizontal: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  featureIcon: { marginRight: 12, width: 20, textAlign: 'center' },
  featureText: { fontSize: 15 },

  offersSection: { paddingHorizontal: 20 },
  promoInputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 48 },
  promoIcon: { marginRight: 8 },
  promoInput: { flex: 1, fontSize: 14, padding: 0 },
  promoActionBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  applyText: { fontWeight: '600', fontSize: 14 },
  
  promosScroll: { marginTop: 12 },
  minimalCoupon: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, padding: 12, marginRight: 12, width: 240 },
  couponLeft: { flex: 1, borderRightWidth: 1, borderRightColor: 'rgba(150,150,150,0.2)', paddingRight: 12 },
  couponValue: { fontSize: 14, fontWeight: '700' },
  couponDesc: { fontSize: 11, marginTop: 4 },
  couponRight: { paddingLeft: 12, justifyContent: 'center', alignItems: 'center' },
  couponCodeBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(150,150,150,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginBottom: 6 },
  couponCodeText: { fontSize: 10, fontWeight: '600' },
  couponApplyText: { fontSize: 12, fontWeight: '700' },

  rewardCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 12 },
  rewardLeft: { flexDirection: 'row', alignItems: 'center' },
  rewardTitle: { fontSize: 14, fontWeight: '600' },
  rewardSubtitle: { fontSize: 12, marginTop: 2 },
  rewardToggleBtn: { borderWidth: 1, borderColor: '#0EA5E9', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  rewardToggleText: { fontSize: 13, fontWeight: '600' },

  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 10 },
  bottomPriceInfo: { flex: 1 },
  totalLabel: { fontSize: 12, marginBottom: 2 },
  finalPrice: { fontSize: 24, fontWeight: '800' },
  originalPrice: { fontSize: 14, textDecorationLine: 'line-through' },
  subscribeBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  subscribeBtnText: { color: 'white', fontSize: 16, fontWeight: '700' }
});

export default RechargePlanScreen;
