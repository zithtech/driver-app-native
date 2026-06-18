import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useAppTheme } from '../../../context/ThemeContext';
import { hS as s, vS as vs, mS as ms } from '../../../lib/scale';

const PLAN_TIERS_MAP: any = {
    basic: {
        nameKey: 'basic',
        color: '#2563EB',
        icon: 'shield-outline',
    },
    elite: {
        nameKey: 'monthly_elite',
        color: '#152D5E', // Deep Navy as requested
        icon: 'diamond-outline',
    },
    premium: {
        nameKey: 'premium',
        color: '#D97706',
        icon: 'trophy-outline',
    },
};

const DURATION_TAGS: any = {
    daily: 'daily_tag',
    weekly: 'weekly_tag',
    monthly: 'monthly_tag',
};

interface SubscriptionCardProps {
    subscription: any;
}

const RechargeCard: React.FC<SubscriptionCardProps> = ({ subscription }) => {
    const { t } = useTranslation();
    const navigation = useNavigation<NavigationProp<any>>();

    const activePlan = subscription;
    const planName = activePlan?.plan?.name || activePlan?.plan?.plan_name || '';
    
    // Determine visual tier based on keywords or ID for variety
    const lowerName = planName.toLowerCase();
    const tierId = lowerName.includes('elite') ? 'elite' :
                  lowerName.includes('premium') ? 'premium' :
                  lowerName.includes('gold') ? 'premium' : 'basic';

    const getDurationKey = (cycle: string) => {
        if (cycle === 'day') return 'daily';
        if (cycle === 'week') return 'weekly';
        if (cycle === 'month') return 'monthly';
        return 'monthly';
    };
    const duration = getDurationKey(activePlan?.billing_cycle || '');

    const tier = PLAN_TIERS_MAP[tierId] || PLAN_TIERS_MAP.basic;
    const { theme } = useAppTheme();

    const expiryDate = activePlan?.expiry_date ? new Date(activePlan.expiry_date) : null;
    const now = new Date();
    const todayAtMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Normalize expiry to midnight to get clean day difference
    // Check if date is valid before calling methods
    const expiryMidnight = (expiryDate && !isNaN(expiryDate.getTime())) 
        ? new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate()) 
        : null;

    const daysLeft = expiryMidnight
        ? Math.round((expiryMidnight.getTime() - todayAtMidnight.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    const isUrgent = !!activePlan && daysLeft >= 0 && daysLeft <= 2;
    const isBasic = tierId === 'basic';
    
    // Status can be ACTIVE, active, or we might have an is_active flag
    const status = activePlan?.status?.toUpperCase();
    
    // If we have an activePlan and daysLeft >= 0, we should generally show it as ACTIVE 
    // unless it's explicitly CANCELLED or REFUNDED.
    const isActive = activePlan && 
                    (daysLeft >= 0) && 
                    (status === 'ACTIVE' || status === 'EXPIRED' || activePlan?.is_active === true || !status);

    // ── ANIMATIONS ──
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Subtle pulse for tier icon
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.15, duration: 1500, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
            ])
        ).start();
    }, [pulseAnim]);

    const uiStyles = React.useMemo(() => getStyles(theme), [theme]);

    return (
        <Animated.View
            style={[
                uiStyles.walletCard,
                isUrgent && uiStyles.urgentCardBackground
            ]}
        >
            <View style={uiStyles.walletRow}>
                <Animated.View style={[
                    uiStyles.tierIconWrap,
                    { backgroundColor: tier.color + '15', transform: [{ scale: pulseAnim }] }
                ]}>
                    <Ionicons name={tier.icon} size={ms(18)} color={tier.color} />
                </Animated.View>

                <View style={{ marginLeft: s(12), flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                        <Text style={uiStyles.walletTitle} numberOfLines={1} adjustsFontSizeToFit>
                            {activePlan ? (planName || t('subscription_plan')) : t('no_active_plan')}
                        </Text>
                        {!!activePlan && (
                            <View style={uiStyles.durationBadge}>
                                <Text style={uiStyles.durationText}>{t(DURATION_TAGS[duration] || 'monthly_tag')}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {isActive ? (
                    <View style={[uiStyles.statusBadge, { backgroundColor: isUrgent ? '#FFF7ED' : '#F0FDF4' }]}>
                        <Text style={[uiStyles.statusText, { color: isUrgent ? '#EA580C' : '#15803D' }]}>
                            {isUrgent ? t('expiring_soon') || 'EXPIRING SOON' : t('active')}
                        </Text>
                    </View>
                ) : activePlan ? (
                    <View style={[uiStyles.statusBadge, { backgroundColor: '#F3F4F6' }]}>
                        <Text style={[uiStyles.statusText, { color: '#6B7280' }]}>
                            {t('expired')}
                        </Text>
                    </View>
                ) : null}
            </View>

            {isBasic && (
                <View style={uiStyles.upgradeBox}>
                    <Ionicons name="sparkles" size={14} color="#6D28D9" />
                    <Text style={uiStyles.upgradeText} numberOfLines={2} adjustsFontSizeToFit>{t('upgrade_to_elite_rides')}</Text>
                </View>
            )}

            <View style={uiStyles.planInfoRow}>
                <View style={{ flex: 1, minWidth: '55%' }}>
                    {activePlan ? (
                        <Text style={uiStyles.expiryLabel}>
                            {t('expires_on')} <Text style={uiStyles.expiryDateText}>{expiryDate ? expiryDate.toDateString() : '—'}</Text>
                        </Text>
                    ) : (
                        <Text style={uiStyles.expiryLabel}>
                            {t('subscribe_start_earning')}
                        </Text>
                    )}
                    {daysLeft > 0 && activePlan && (
                        <Text style={[uiStyles.daysLeftText, { color: isUrgent ? '#EA580C' : tier.color }]}>
                            {t('days_left', { count: daysLeft })}
                        </Text>
                    )}
                </View>
                <Pressable
                    style={[uiStyles.ctaBtn, { backgroundColor: isUrgent ? '#EA580C' : theme.colors.primary, flexGrow: 1 }]}
                    onPress={() => navigation.navigate('RechargePlanScreen')}
                >
                    <Text style={uiStyles.ctaText} numberOfLines={1} adjustsFontSizeToFit>
                        {isUrgent ? t('renew_now') : t('view_plans')}
                    </Text>
                </Pressable>
            </View>
        </Animated.View>
    );
};

export default RechargeCard;

const getStyles = (theme: any) => StyleSheet.create({
    walletCard: {
        marginHorizontal: s(16),
        marginTop: vs(12),
        backgroundColor: theme.colors.card,
        borderRadius: ms(24),
        padding: ms(20),
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.dark ? '#334155' : '#E2E8F0',
        shadowColor: theme.dark ? '#000' : '#475569',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: theme.dark ? 0.3 : 0.08,
        shadowRadius: 16,
        elevation: 8,
    },
    urgentCardBackground: {
        backgroundColor: theme.dark ? '#2a1a15' : '#FFF7ED',
        borderColor: theme.dark ? '#9a3412' : '#FFEDD5',
        borderWidth: 1,
    },
    walletRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    walletTitle: {
        fontSize: ms(17),
        fontWeight: '800',
        color: theme.colors.text,
        textTransform: 'capitalize',
        letterSpacing: -0.3,
    },
    durationBadge: {
        marginLeft: s(8),
        backgroundColor: theme.dark ? '#334155' : '#F1F5F9',
        paddingHorizontal: s(8),
        paddingVertical: vs(4),
        borderRadius: ms(8),
    },
    durationText: {
        fontSize: ms(10),
        fontWeight: '800',
        color: theme.dark ? '#CBD5E1' : '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    tierIconWrap: {
        width: ms(44),
        height: ms(44),
        borderRadius: ms(16),
        alignItems: 'center',
        justifyContent: 'center',
    },
    upgradeBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.dark ? '#3b0764' : '#F5F3FF',
        padding: ms(10),
        borderRadius: ms(12),
        marginTop: vs(16),
        gap: s(8),
    },
    upgradeText: {
        fontSize: ms(12),
        fontWeight: '600',
        color: theme.dark ? '#c4b5fd' : '#5B21B6',
        flex: 1,
    },
    planInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: vs(20),
        justifyContent: 'space-between',
        paddingTop: vs(16),
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.dark ? '#334155' : '#E2E8F0',
        flexWrap: 'wrap',
        gap: 12,
    },
    expiryLabel: {
        color: theme.colors.paragraphText,
        fontSize: ms(13),
        fontWeight: '500',
    },
    expiryDateText: {
        fontWeight: '700',
        color: theme.colors.text,
    },
    daysLeftText: {
        fontSize: ms(14),
        fontWeight: '800',
        marginTop: vs(4),
    },
    statusBadge: {
        paddingHorizontal: s(12),
        paddingVertical: vs(5),
        borderRadius: ms(12),
    },
    statusText: {
        fontSize: ms(10),
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    ctaBtn: {
        paddingHorizontal: s(20),
        paddingVertical: vs(12),
        borderRadius: ms(16),
        minWidth: s(110),
        alignItems: 'center',
    },
    ctaText: {
        color: '#FFFFFF',
        fontSize: ms(13),
        fontWeight: '800',
        letterSpacing: 0.3,
    },
});
