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
  
  const bgColor = isDark ? theme.colors.background : '#FFFFFF';
  const cardColor = isDark ? theme.colors.card : '#FFFFFF';
  const borderColor = isDark ? '#2C2C2E' : '#E5E7EB';
  const textMuted = isDark ? theme.colors.textMuted : '#6B7280';

  /* ─────────── RENDER ─────────── */
  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <AppStatusBar />

      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: bgColor }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={isDark ? '#FFF' : '#111827'} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: isDark ? '#FFF' : '#111827' }]} numberOfLines={1} adjustsFontSizeToFit>
          {t('refer_earn') || 'Refer & Earn'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── HERO CARD ─── */}
        <Reanimated.View entering={FadeInDown.delay(100).duration(500)}>
          <View style={[styles.card, { backgroundColor: cardColor, borderColor }]}>
            <View style={styles.heroContent}>
              <View style={[styles.heroIconBox, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.1)' : '#EEF2FF' }]}>
                  <Ionicons name="gift-outline" size={32} color="#6366F1" />
              </View>
              <Text style={[styles.heroTitle, { color: isDark ? '#FFF' : '#111827' }]} numberOfLines={1} adjustsFontSizeToFit>
                {t('refer_hero_title') || 'Invite Friends, Earn Rewards!'}
              </Text>
              <Text style={[styles.heroSubtitle, { color: textMuted }]}>
                {t('refer_hero_subtitle') || 'Share your code and earn subscription coupons when your friend completes their first ride'}
              </Text>
            </View>
          </View>
        </Reanimated.View>

        {/* ─── REFERRAL CODE CARD ─── */}
        <Reanimated.View entering={FadeInDown.delay(200).duration(500)}>
          <View style={[styles.card, { backgroundColor: cardColor, borderColor }]}>
            <Text style={[styles.sectionTitle, { color: textMuted }]} numberOfLines={1} adjustsFontSizeToFit>
              {t('refer_your_code') || 'YOUR REFERRAL CODE'}
            </Text>

            {codeLoading ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <View style={styles.codeRow}>
                <View style={[styles.codeBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6' }]}>
                  <Text style={[styles.codeText, { color: isDark ? '#FFF' : '#111827' }]}>
                    {referralCode}
                  </Text>
                </View>
                <Pressable
                  style={[styles.copyBtn, {
                    backgroundColor: copiedCode === 'referral' ? '#10B981' : (isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB'),
                  }]}
                  onPress={handleCopyCode}
                >
                  <Ionicons
                    name={copiedCode === 'referral' ? 'checkmark' : 'copy-outline'}
                    size={20}
                    color={copiedCode === 'referral' ? '#FFF' : (isDark ? '#FFF' : '#4B5563')}
                  />
                </Pressable>
              </View>
            )}

            {/* SHARE BUTTONS */}
            <View style={styles.shareRow}>
              <Pressable
                style={[styles.shareBtn, { backgroundColor: 'rgba(37, 211, 102, 0.1)' }]}
                onPress={handleShare}
              >
                <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                <Text style={[styles.shareBtnText, { color: '#25D366' }]} numberOfLines={1} adjustsFontSizeToFit>WhatsApp</Text>
              </Pressable>

              <Pressable
                style={[styles.shareBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6' }]}
                onPress={handleShare}
              >
                <Ionicons name="share-social-outline" size={18} color={isDark ? '#FFF' : '#111827'} />
                <Text style={[styles.shareBtnText, { color: isDark ? '#FFF' : '#111827' }]} numberOfLines={1} adjustsFontSizeToFit>{t('refer_share') || 'Share'}</Text>
              </Pressable>
            </View>
          </View>
        </Reanimated.View>

        {/* ─── STATS CARD ─── */}
        <Reanimated.View entering={FadeInDown.delay(300).duration(500)}>
          <View style={[styles.card, { backgroundColor: cardColor, borderColor }]}>
            <Text style={[styles.sectionTitle, { color: textMuted }]} numberOfLines={1} adjustsFontSizeToFit>
              {t('refer_your_stats') || 'YOUR REFERRAL STATS'}
            </Text>

            {statsLoading ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <View style={styles.statsScrollContent}>
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
              </View>
            )}
          </View>
        </Reanimated.View>

        {/* ─── YOUR REWARD COUPONS ─── */}
        <Reanimated.View entering={FadeInDown.delay(350).duration(500)}>
          <View style={[styles.card, { backgroundColor: cardColor, borderColor, padding: 0 }]}>
            {/* Section Header with count badge */}
            <View style={styles.couponHeader}>
              <Text style={[styles.sectionTitle, { color: textMuted, marginBottom: 0 }]} numberOfLines={1} adjustsFontSizeToFit>
                {t('refer_your_coupons') || 'YOUR REWARD COUPONS'}
              </Text>
              {earnedCoupons.length > 0 && (
                <View style={[styles.couponCountBadge, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : '#EEF2FF' }]}>
                  <Text style={[styles.couponCountText, { color: '#6366F1' }]}>{earnedCoupons.length}</Text>
                </View>
              )}
            </View>

            {earnedCoupons.length === 0 ? (
              /* ─── Empty State ─── */
              <View style={styles.emptyState}>
                <View style={[styles.emptyIconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6' }]}>
                  <Ionicons name="ticket-outline" size={24} color={isDark ? '#6B7280' : '#9CA3AF'} />
                </View>
                <Text style={[styles.emptyTitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]} numberOfLines={1} adjustsFontSizeToFit>
                  {t('refer_no_coupons') || 'No coupons yet'}
                </Text>
                <Text style={[styles.emptyDesc, { color: textMuted }]}>
                  {t('refer_no_coupons_desc') || 'Invite friends to earn subscription discount coupons!'}
                </Text>
              </View>
            ) : (
              /* ─── Coupon List ─── */
              <View style={styles.couponListWrapper}>
                {earnedCoupons.map((coupon: any, index: number) => {
                  const isCopied = copiedCode === coupon.code;
                  const isLast = index === earnedCoupons.length - 1;
                  return (
                    <View
                        key={coupon.code || index}
                        style={[
                            styles.couponItem,
                            !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderColor },
                            { opacity: coupon.is_used ? 0.6 : 1 },
                        ]}
                    >
                        <View style={styles.couponLeft}>
                        <View style={[styles.couponIconWrap, { backgroundColor: coupon.is_used ? 'transparent' : 'rgba(139, 92, 246, 0.1)' }]}>
                            <Ionicons name={coupon.is_used ? "checkmark-circle-outline" : "pricetag-outline"} size={18} color={coupon.is_used ? textMuted : '#8B5CF6'} />
                        </View>
                        <View style={styles.couponInfo}>
                            <Text style={[
                            styles.couponCode, 
                            { 
                                color: isDark ? '#FFF' : '#111827',
                                textDecorationLine: coupon.is_used ? 'line-through' : 'none'
                            }
                            ]}>
                            {coupon.code}
                            </Text>
                            <Text style={[styles.couponDesc, { color: textMuted }]}>
                            {coupon.is_used 
                                ? (t('refer_used') || 'Used')
                                : (coupon.expiry_date
                                ? `${t('refer_expires') || 'Expires'}: ${new Date(coupon.expiry_date).toLocaleDateString()}`
                                : coupon.description)}
                            </Text>
                        </View>
                        </View>
                        <View style={styles.couponRight}>
                        <Text style={[styles.couponValue, { color: coupon.is_used ? textMuted : '#10B981' }]}>
                            ₹{coupon.value}
                        </Text>
                        {coupon.is_used ? (
                            <View style={styles.couponUsedBadge}>
                            <Text style={[styles.couponUsedText, { color: textMuted }]}>
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
                                    : (isDark ? 'rgba(255,255,255,0.1)' : '#F3F4F6'),
                                },
                            ]}
                            >
                            <Ionicons
                                name={isCopied ? 'checkmark' : 'copy-outline'}
                                size={14}
                                color={isCopied ? '#FFF' : (isDark ? '#FFF' : '#4B5563')}
                            />
                            <Text
                                style={[
                                styles.couponCopyText,
                                { color: isCopied ? '#FFF' : (isDark ? '#FFF' : '#111827') },
                                ]}
                                numberOfLines={1} adjustsFontSizeToFit
                            >
                                {isCopied ? (t('refer_copied') || 'Copied!') : (t('refer_copy') || 'Copy')}
                            </Text>
                            </Pressable>
                        )}
                        </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </Reanimated.View>

        {/* ─── HOW IT WORKS ─── */}
        <Reanimated.View entering={FadeInUp.delay(400).duration(500)}>
          <View style={[styles.card, { backgroundColor: cardColor, borderColor }]}>
            <Text style={[styles.sectionTitle, { color: textMuted, marginBottom: 16 }]} numberOfLines={1} adjustsFontSizeToFit>
              {t('refer_how_it_works') || 'HOW IT WORKS'}
            </Text>

            {STEPS.map((step, index) => (
              <View key={index} style={styles.stepRow}>
                <View style={styles.stepCircleWrapper}>
                  <View style={[styles.stepCircle, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.1)' : '#EEF2FF' }]}>
                    <Ionicons name={step.icon as any} size={16} color="#6366F1" />
                  </View>
                  {index < STEPS.length - 1 && (
                    <View style={[styles.stepLine, { backgroundColor: isDark ? '#2C2C2E' : '#E5E7EB' }]} />
                  )}
                </View>
                <View style={styles.stepContent}>
                  <Text style={[styles.stepNumber, { color: textMuted }]}>
                    {t('refer_step_label') || 'Step'} {index + 1}
                  </Text>
                  <Text style={[styles.stepText, { color: isDark ? '#FFF' : '#111827' }]}>
                    {t(step.key) || getDefaultStep(index)}
                  </Text>
                </View>
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
  <View style={styles.statItem}>
    <View style={styles.statIcon}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <Text style={[styles.statValue, { color: isDark ? '#FFF' : '#111827' }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    <Text style={[styles.statLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]} numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
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
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', flex: 1, textAlign: 'center' },

  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  
  /* Hero */
  heroContent: {
    alignItems: 'center',
  },
  heroIconBox: {
      width: 64,
      height: 64,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  sectionTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 16 },

  /* Code Card */
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  codeBadge: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeText: { fontSize: 20, fontWeight: '700', letterSpacing: 2 },
  copyBtn: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  /* Share */
  shareRow: { flexDirection: 'row', gap: 12 },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  shareBtnText: { fontWeight: '600', fontSize: 14 },

  /* Stats */
  statsScrollContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  statIcon: { marginBottom: 6 },
  statValue: { fontSize: 16, fontWeight: '700' },
  statLabel: { fontSize: 11, fontWeight: '500', marginTop: 4, textAlign: 'center' },

  /* Coupons */
  couponHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 8,
  },
  couponCountBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  couponCountText: { fontSize: 12, fontWeight: '700' },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  emptyDesc: { fontSize: 13, textAlign: 'center' },
  
  couponListWrapper: {
      paddingHorizontal: 16,
      paddingBottom: 8,
  },
  couponItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  couponLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  couponIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  couponInfo: { flex: 1 },
  couponCode: { fontSize: 15, fontWeight: '600', letterSpacing: 0.5 },
  couponDesc: { fontSize: 12, marginTop: 2 },
  couponRight: { alignItems: 'flex-end', marginLeft: 8 },
  couponValue: { fontSize: 16, fontWeight: '700' },
  couponCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
  },
  couponCopyText: { fontSize: 12, fontWeight: '500' },
  couponUsedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 4,
  },
  couponUsedText: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },

  /* How it works */
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  stepCircleWrapper: { alignItems: 'center', width: 32, marginRight: 12 },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  stepLine: {
    position: 'absolute',
    top: 32,
    width: 2,
    height: 32,
  },
  stepContent: { flex: 1, paddingTop: 2, paddingBottom: 4 },
  stepNumber: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  stepText: { fontSize: 14, fontWeight: '500', marginTop: 4, lineHeight: 20 },
});

export default ReferEarnScreen;
