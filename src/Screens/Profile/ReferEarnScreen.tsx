import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Share,
  ActivityIndicator,
  Clipboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import Reanimated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../context/ThemeContext';
import AppStatusBar from '../../Components/AppStatusBar';
import {
  useGetMyReferralCodeQuery,
  useGetMyReferralStatsQuery,
} from '../../service/driverApi';

/* ─────────── HOW IT WORKS STEPS ─────────── */
const STEPS = [
  { icon: 'share-social-outline', key: 'refer_step_1' },
  { icon: 'person-add-outline', key: 'refer_step_2' },
  { icon: 'car-outline', key: 'refer_step_3' },
  { icon: 'gift-outline', key: 'refer_step_4' },
];

const ReferEarnScreen = ({ navigation }: any) => {
  const { theme, isDark } = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const { data: codeData, isLoading: codeLoading } = useGetMyReferralCodeQuery();
  const { data: statsData, isLoading: statsLoading } = useGetMyReferralStatsQuery();

  const referralCode = codeData?.data?.referral_code || '---';
  const shareMessage = codeData?.data?.share_message || '';

  const stats = statsData?.data || {
    total_referrals: 0,
    successful_referrals: 0,
    pending_referrals: 0,
    total_earned_coupons: 0,
    earned_coupons: [],
  };

  const earnedCoupons = stats.earned_coupons || [];

  /* ─────────── HANDLERS ─────────── */
  const handleCopyCode = useCallback(() => {
    Clipboard.setString(referralCode);
    setCopiedCode('referral');
    setTimeout(() => setCopiedCode(null), 2000);
  }, [referralCode]);

  const handleCopyCoupon = useCallback((code: string) => {
    Clipboard.setString(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }, []);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: shareMessage,
        title: t('refer_share_title') || 'Join V-Drive!',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  }, [shareMessage, t]);

  /* ─────────── RENDER ─────────── */
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <AppStatusBar />

      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={isDark ? '#FFF' : '#000'} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: isDark ? '#FFF' : '#111827' }]} numberOfLines={1} adjustsFontSizeToFit>
          {t('refer_earn') || 'Refer & Earn'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── HERO CARD ─── */}
        <Reanimated.View entering={FadeInDown.delay(100).duration(500)}>
          <LinearGradient
            colors={isDark ? ['#1E3A5F', '#0F2744'] : ['#4F46E5', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <Ionicons name="gift" size={48} color="#FFF" style={{ opacity: 0.9 }} />
            <Text style={styles.heroTitle} numberOfLines={1} adjustsFontSizeToFit>
              {t('refer_hero_title') || 'Invite Friends, Earn Rewards!'}
            </Text>
            <Text style={styles.heroSubtitle}>
              {t('refer_hero_subtitle') || 'Share your code and earn subscription coupons when your friend completes their first ride'}
            </Text>
          </LinearGradient>
        </Reanimated.View>

        {/* ─── REFERRAL CODE CARD ─── */}
        <Reanimated.View entering={FadeInDown.delay(200).duration(500)}>
          <View style={[styles.codeCard, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.codeLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]} numberOfLines={1} adjustsFontSizeToFit>
              {t('refer_your_code') || 'Your Referral Code'}
            </Text>

            {codeLoading ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <View style={styles.codeRow}>
                <View style={[styles.codeBadge, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
                  <Text style={[styles.codeText, { color: isDark ? '#60A5FA' : '#4F46E5' }]}>
                    {referralCode}
                  </Text>
                </View>
                <Pressable
                  style={[styles.copyBtn, {
                    backgroundColor: copiedCode === 'referral' ? '#10B981' : (isDark ? '#374151' : '#E5E7EB'),
                  }]}
                  onPress={handleCopyCode}
                >
                  <Ionicons
                    name={copiedCode === 'referral' ? 'checkmark' : 'copy-outline'}
                    size={20}
                    color={copiedCode === 'referral' ? '#FFF' : (isDark ? '#D1D5DB' : '#374151')}
                  />
                </Pressable>
              </View>
            )}

            {/* SHARE BUTTONS */}
            <View style={styles.shareRow}>
              <Pressable
                style={[styles.shareBtn, { backgroundColor: '#25D366' }]}
                onPress={handleShare}
              >
                <Ionicons name="logo-whatsapp" size={22} color="#FFF" />
                <Text style={styles.shareBtnText} numberOfLines={1} adjustsFontSizeToFit>WhatsApp</Text>
              </Pressable>

              <Pressable
                style={[styles.shareBtn, { backgroundColor: isDark ? '#374151' : '#1F2937' }]}
                onPress={handleShare}
              >
                <Ionicons name="share-social-outline" size={22} color="#FFF" />
                <Text style={styles.shareBtnText} numberOfLines={1} adjustsFontSizeToFit>{t('refer_share') || 'Share'}</Text>
              </Pressable>
            </View>
          </View>
        </Reanimated.View>

        {/* ─── STATS CARD ─── */}
        <Reanimated.View entering={FadeInDown.delay(300).duration(500)}>
          <View style={[styles.statsCard, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#FFF' : '#111827' }]} numberOfLines={1} adjustsFontSizeToFit>
              {t('refer_your_stats') || 'Your Referral Stats'}
            </Text>

            {statsLoading ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.statsScrollContent}
              >
                <StatItem
                  label={t('refer_total') || 'Total'}
                  value={stats.total_referrals}
                  icon="people-outline"
                  color="#3B82F6"
                  isDark={isDark}
                />
                <StatItem
                  label={t('refer_successful') || 'Successful'}
                  value={stats.successful_referrals}
                  icon="checkmark-circle-outline"
                  color="#10B981"
                  isDark={isDark}
                />
                <StatItem
                  label={t('refer_pending') || 'Pending'}
                  value={stats.pending_referrals}
                  icon="time-outline"
                  color="#F59E0B"
                  isDark={isDark}
                />
                <StatItem
                  label={t('refer_coupons') || 'Coupons'}
                  value={`₹${stats.total_earned_coupons}`}
                  icon="pricetag-outline"
                  color="#8B5CF6"
                  isDark={isDark}
                />
              </ScrollView>
            )}
          </View>
        </Reanimated.View>

        {/* ─── YOUR REWARD COUPONS ─── */}
        <Reanimated.View entering={FadeInDown.delay(350).duration(500)}>
          <View style={[styles.couponsCard, { backgroundColor: theme.colors.card }]}>
            {/* Section Header with count badge */}
            <View style={styles.couponHeader}>
              <Text style={[styles.sectionTitle, { color: isDark ? '#FFF' : '#111827', marginBottom: 0 }]} numberOfLines={1} adjustsFontSizeToFit>
                {t('refer_your_coupons') || 'Your Reward Coupons'}
              </Text>
              {earnedCoupons.length > 0 && (
                <View style={[styles.couponCountBadge, { backgroundColor: isDark ? '#7C3AED' : '#4F46E5' }]}>
                  <Text style={styles.couponCountText}>{earnedCoupons.length}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.couponsSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
              {t('refer_coupon_hint') || 'Use these codes during subscription recharge'}
            </Text>

            {earnedCoupons.length === 0 ? (
              /* ─── Empty State ─── */
              <View style={styles.emptyState}>
                <View style={[styles.emptyIconWrap, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
                  <Ionicons name="ticket-outline" size={32} color={isDark ? '#6B7280' : '#9CA3AF'} />
                </View>
                <Text style={[styles.emptyTitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]} numberOfLines={1} adjustsFontSizeToFit>
                  {t('refer_no_coupons') || 'No coupons yet'}
                </Text>
                <Text style={[styles.emptyDesc, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
                  {t('refer_no_coupons_desc') || 'Invite friends to earn subscription discount coupons!'}
                </Text>
              </View>
            ) : (
              /* ─── Coupon List ─── */
              earnedCoupons.map((coupon: any, index: number) => {
                const isCopied = copiedCode === coupon.code;
                return (
                  <Reanimated.View
                    key={coupon.code || index}
                    entering={FadeInDown.delay(100 * index).duration(400)}
                  >
                    <View
                      style={[
                        styles.couponItem,
                        {
                          backgroundColor: isDark ? '#1F2937' : '#F9FAFB',
                          borderColor: isCopied
                            ? '#10B981'
                            : (isDark ? '#374151' : '#E5E7EB'),
                          opacity: coupon.is_used ? 0.6 : 1,
                        },
                      ]}
                    >
                      <View style={styles.couponLeft}>
                        <View style={[styles.couponIconWrap, { backgroundColor: coupon.is_used ? '#9CA3AF20' : '#8B5CF620' }]}>
                          <Ionicons name="pricetag" size={18} color={coupon.is_used ? '#9CA3AF' : '#8B5CF6'} />
                        </View>
                        <View style={styles.couponInfo}>
                          <Text style={[
                            styles.couponCode, 
                            { 
                              color: coupon.is_used ? (isDark ? '#6B7280' : '#9CA3AF') : (isDark ? '#A78BFA' : '#7C3AED'),
                              textDecorationLine: coupon.is_used ? 'line-through' : 'none'
                            }
                          ]}>
                            {coupon.code}
                          </Text>
                          <Text style={[styles.couponDesc, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                            {coupon.is_used 
                              ? (t('refer_used') || 'Used')
                              : (coupon.expiry_date
                                ? `${t('refer_expires') || 'Expires'}: ${new Date(coupon.expiry_date).toLocaleDateString()}`
                                : coupon.description)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.couponRight}>
                        <Text style={[styles.couponValue, { color: coupon.is_used ? (isDark ? '#4B5563' : '#9CA3AF') : (isDark ? '#34D399' : '#059669') }]}>
                          ₹{coupon.value}
                        </Text>
                        {coupon.is_used ? (
                          <View style={[styles.couponUsedBadge, { backgroundColor: isDark ? '#374151' : '#E5E7EB' }]}>
                            <Text style={[styles.couponUsedText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                              {t('refer_used') || 'Used'}
                            </Text>
                          </View>
                        ) : (
                          <Pressable
                            onPress={() => handleCopyCoupon(coupon.code)}
                            style={[
                              styles.couponCopyBtn,
                              {
                                backgroundColor: isCopied
                                  ? '#10B981'
                                  : (isDark ? '#374151' : '#E5E7EB'),
                              },
                            ]}
                          >
                            <Ionicons
                              name={isCopied ? 'checkmark' : 'copy-outline'}
                              size={14}
                              color={isCopied ? '#FFF' : (isDark ? '#D1D5DB' : '#374151')}
                            />
                            <Text
                              style={[
                                styles.couponCopyText,
                                { color: isCopied ? '#FFF' : (isDark ? '#D1D5DB' : '#374151') },
                              ]}
                              numberOfLines={1} adjustsFontSizeToFit
                            >
                              {isCopied ? (t('refer_copied') || 'Copied!') : (t('refer_copy') || 'Copy')}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  </Reanimated.View>
                );
              })
            )}
          </View>
        </Reanimated.View>

        {/* ─── HOW IT WORKS ─── */}
        <Reanimated.View entering={FadeInUp.delay(400).duration(500)}>
          <View style={[styles.howItWorks, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#FFF' : '#111827' }]} numberOfLines={1} adjustsFontSizeToFit>
              {t('refer_how_it_works') || 'How It Works'}
            </Text>

            {STEPS.map((step, index) => (
              <View key={index} style={styles.stepRow}>
                <View style={[styles.stepCircle, { backgroundColor: isDark ? '#1F2937' : '#EEF2FF' }]}>
                  <Ionicons name={step.icon as any} size={22} color={isDark ? '#818CF8' : '#4F46E5'} />
                </View>
                <View style={styles.stepContent}>
                  <Text style={[styles.stepNumber, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
                    {t('refer_step_label') || 'Step'} {index + 1}
                  </Text>
                  <Text style={[styles.stepText, { color: isDark ? '#D1D5DB' : '#374151' }]}>
                    {t(step.key) || getDefaultStep(index)}
                  </Text>
                </View>
                {index < STEPS.length - 1 && (
                  <View style={[styles.stepLine, { backgroundColor: isDark ? '#374151' : '#E5E7EB' }]} />
                )}
              </View>
            ))}
          </View>
        </Reanimated.View>
      </ScrollView>
    </View>
  );
};

/* ─────────── STAT ITEM COMPONENT ─────────── */
const StatItem = ({ label, value, icon, color, isDark }: any) => (
  <View style={[styles.statItem, { backgroundColor: isDark ? '#1F2937' : '#F9FAFB' }]}>
    <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <Text style={[styles.statValue, { color: isDark ? '#FFF' : '#111827' }]}>{value}</Text>
    <Text style={[styles.statLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>{label}</Text>
  </View>
);

/* ─────────── DEFAULT STEPS ─────────── */
const getDefaultStep = (index: number): string => {
  const defaults = [
    'Share your referral code with friends',
    'Your friend signs up using your code',
    'They complete their first ride',
    'Both of you get subscription coupon codes!',
  ];
  return defaults[index] || '';
};

/* ─────────── STYLES ─────────── */
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },

  /* Hero */
  heroCard: {
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
    marginTop: 12,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },

  /* Code Card */
  codeCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  codeLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  codeBadge: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: '#4F46E520',
    borderStyle: 'dashed',
  },
  codeText: { fontSize: 24, fontWeight: '800', letterSpacing: 3, textAlign: 'center' },
  copyBtn: { padding: 14, borderRadius: 12 },

  /* Share */
  shareRow: { flexDirection: 'row', gap: 12 },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  shareBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },

  /* Stats */
  statsCard: { borderRadius: 16, paddingVertical: 8, marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8, paddingHorizontal: 16 },
  statsScrollContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  statItem: {
    width: 110,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  statIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 12, fontWeight: '500', marginTop: 4 },

  /* Coupons */
  couponsCard: { borderRadius: 16, padding: 20, marginBottom: 16 },
  couponHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  couponCountBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  couponCountText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  couponsSubtitle: { fontSize: 13, marginBottom: 16 },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  emptyDesc: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  couponItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  couponLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  couponIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  couponInfo: { flex: 1 },
  couponCode: { fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  couponDesc: { fontSize: 11, marginTop: 2 },
  couponRight: { alignItems: 'flex-end', marginLeft: 8 },
  couponValue: { fontSize: 18, fontWeight: '800' },
  couponCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 6,
  },
  couponCopyText: { fontSize: 11, fontWeight: '600' },
  couponUsedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 6,
  },
  couponUsedText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },

  /* How it works */
  howItWorks: { borderRadius: 16, padding: 20, marginBottom: 16 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20, position: 'relative' },
  stepCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  stepContent: { flex: 1, paddingTop: 2 },
  stepNumber: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  stepText: { fontSize: 14, fontWeight: '500', marginTop: 2, lineHeight: 20 },
  stepLine: {
    position: 'absolute',
    left: 21,
    top: 44,
    width: 2,
    height: 20,
  },
});

export default ReferEarnScreen;
