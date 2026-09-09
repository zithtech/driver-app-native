import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../../context/ThemeContext';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { hS as s, vS as vs, mS as ms } from '../../../lib/scale';
import { Text } from '../../../Components';
import { format } from 'date-fns';
import { getLanguageScaledSize } from '../../../utils/languageSizings';

const PLAN_CONFIG: any = {
    basic: {
        gradient: ['#60A5FA', '#2563EB'],
        icon: 'shield',
        color: '#2563EB',
        bgColor: '#EFF6FF', darkBgColor: 'rgba(37, 99, 235, 0.15)'
    },
    elite: {
        gradient: ['#A78BFA', '#6D28D9'],
        icon: 'ribbon',
        color: '#6D28D9',
        bgColor: '#F5F3FF', darkBgColor: 'rgba(109, 40, 217, 0.15)'
    },
    premium: {
        gradient: ['#FBBF24', '#D97706'],
        icon: 'trophy',
        color: '#D97706',
        bgColor: '#FEF3C7', darkBgColor: 'rgba(217, 119, 6, 0.15)'
    },
};

interface SubscriptionCardProps {
    subscription?: any;
}

const RechargeCard: React.FC<SubscriptionCardProps> = ({ subscription }) => {
    const { t } = useTranslation();
    const { isDark, theme } = useAppTheme();
    const navigation = useNavigation<NavigationProp<any>>();

    const activePlan = subscription;
    const planName = activePlan?.plan?.name || activePlan?.plan?.plan_name || 'Basic Plan';

    const lowerName = planName.toLowerCase();
    const tierId = lowerName.includes('elite') ? 'elite' :
        lowerName.includes('premium') || lowerName.includes('gold') ? 'premium' : 'basic';

    const tier = PLAN_CONFIG[tierId];

    // Status Check
    const expiryDate = activePlan?.expiry_date ? new Date(activePlan.expiry_date) : null;
    const startDate = activePlan?.created_at || activePlan?.start_date ? new Date(activePlan?.created_at || activePlan?.start_date) : new Date();

    const now = new Date();
    const todayAtMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const expiryMidnight = (expiryDate && !isNaN(expiryDate.getTime()))
        ? new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate())
        : null;

    const daysLeft = expiryMidnight
        ? Math.round((expiryMidnight.getTime() - todayAtMidnight.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    const status = activePlan?.status?.toUpperCase();
    const isActive = activePlan &&
        (daysLeft >= 0) &&
        (status === 'ACTIVE' || status === 'EXPIRED' || activePlan?.is_active === true || !status);

    const price = parseFloat(activePlan?.plan?.price || activePlan?.amount || '0').toFixed(2);

    const rawCycle = activePlan?.billing_cycle || 'monthly';
    const cycleMap: Record<string, string> = { day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Yearly' };
    const billingCycle = cycleMap[rawCycle.toLowerCase()] || rawCycle.charAt(0).toUpperCase() + rawCycle.slice(1);

    const autoRenew = activePlan?.auto_renew ?? false;

    // Formatters
    const safeFormatDate = (date: Date | null) => date && !isNaN(date.getTime()) ? format(date, 'dd MMM yyyy') : '-';
    const safeFormatTime = (date: Date | null) => date && !isNaN(date.getTime()) ? format(date, 'hh:mm a') : 'Not available';

    if (!isActive) {
        return (
            <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: isDark ? '#374151' : '#F1F5F9' }]}>
                {/* INACTIVE HEADER */}
                <View style={[styles.headerRow, { borderBottomColor: isDark ? '#374151' : '#F1F5F9' }]}>
                    <View style={styles.inactiveHeaderLeft}>
                        <View style={[styles.redShieldWrap, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2' }]}>
                            <Ionicons name="shield-outline" size={ms(24)} color="#EF4444" />
                            <View style={styles.exclamationDot}>
                                <Text style={{ color: '#FFF', fontSize: getLanguageScaledSize(10), fontWeight: 'bold' }}>!</Text>
                            </View>
                        </View>
                        <View style={styles.inactiveTitles}>
                            <Text style={[styles.inactiveTitleMain, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{t('dashboard.no_active_plan')}</Text>
                            <Text style={[styles.inactiveTitleSub, { color: isDark ? '#9CA3AF' : '#64748B' }]} numberOfLines={2}>{t('dashboard.subscribe_to_start')}</Text>
                            <View style={[styles.inactiveBadge, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2' }]}>
                                <Ionicons name="information-circle-outline" size={ms(12)} color="#EF4444" />
                                <Text style={styles.inactiveBadgeText} numberOfLines={1} adjustsFontSizeToFit>{t('dashboard.plan_inactive')}</Text>
                            </View>
                        </View>
                    </View>
                    <View style={styles.inactiveHeaderRight}>
                        <Pressable style={styles.browsePlansBtn} onPress={() => navigation.navigate('RechargePlanScreen')}>
                            <Ionicons name="ribbon-outline" size={ms(16)} color="#EF4444" />
                            <Text style={styles.browsePlansText} numberOfLines={1} adjustsFontSizeToFit>{t('dashboard.browse_plans')}</Text>
                        </Pressable>
                        <Text style={[styles.chooseBestText, { color: isDark ? '#9CA3AF' : '#64748B' }]} numberOfLines={2}>{t('dashboard.choose_best_plan')}</Text>
                    </View>
                </View>

                {/* INACTIVE DETAILS */}
                <View style={styles.detailsGrid}>
                    <View style={styles.detailCol}>
                        <View style={[styles.redIconCircle, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2' }]}>
                            <Ionicons name="calendar-outline" size={ms(18)} color="#EF4444" />
                        </View>
                        <Text style={[styles.detailLabel, { color: isDark ? '#9CA3AF' : '#64748B' }]} numberOfLines={1} adjustsFontSizeToFit>{t('dashboard.start_date')}</Text>
                        <Text style={[styles.detailValueInactive, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>-</Text>
                        <Text style={[styles.detailSubInactive, { color: isDark ? '#6B7280' : '#94A3B8' }]} numberOfLines={1} adjustsFontSizeToFit>{t('dashboard.not_available')}</Text>
                    </View>
                    <View style={[styles.divider, { backgroundColor: isDark ? '#374151' : '#F1F5F9' }]} />
                    <View style={styles.detailCol}>
                        <View style={[styles.redIconCircle, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2' }]}>
                            <Ionicons name="calendar-outline" size={ms(18)} color="#EF4444" />
                        </View>
                        <Text style={[styles.detailLabel, { color: isDark ? '#9CA3AF' : '#64748B' }]} numberOfLines={1} adjustsFontSizeToFit>{t('dashboard.next_billing_date')}</Text>
                        <Text style={[styles.detailValueInactive, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>-</Text>
                        <Text style={[styles.detailSubInactive, { color: isDark ? '#6B7280' : '#94A3B8' }]} numberOfLines={1} adjustsFontSizeToFit>{t('dashboard.not_available')}</Text>
                    </View>
                    <View style={[styles.divider, { backgroundColor: isDark ? '#374151' : '#F1F5F9' }]} />
                    <View style={styles.detailCol}>
                        <View style={[styles.redIconCircle, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2' }]}>
                            <Ionicons name="document-text-outline" size={ms(18)} color="#EF4444" />
                        </View>
                        <Text style={[styles.detailLabel, { color: isDark ? '#9CA3AF' : '#64748B' }]} numberOfLines={1} adjustsFontSizeToFit>{t('dashboard.billing_cycle')}</Text>
                        <Text style={[styles.detailValueInactive, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>-</Text>
                        <Text style={[styles.detailSubInactive, { color: isDark ? '#6B7280' : '#94A3B8' }]} numberOfLines={1} adjustsFontSizeToFit>{t('dashboard.not_available')}</Text>
                    </View>
                </View>

                {/* INACTIVE FOOTER */}
                <View style={[styles.inactiveFooter, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 8 }}>
                        <Ionicons name="pricetag-outline" size={ms(18)} color="#EF4444" style={{ marginRight: s(8) }} />
                        <Text style={[styles.inactiveFooterText, { color: theme.colors.text }]} numberOfLines={2}>{t('dashboard.unlock_features')}</Text>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: isDark ? '#374151' : '#F1F5F9' }]}>
            {/* ACTIVE HEADER */}
            <View style={[styles.headerRow, { borderBottomColor: isDark ? '#374151' : '#F1F5F9' }]}>
                <LinearGradient
                    colors={tier.gradient}
                    style={styles.activeGradientBox}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <Ionicons name={tier.icon} size={ms(24)} color="#FCD34D" style={{ marginBottom: vs(4) }} />
                    <Text style={styles.activePlanName} numberOfLines={1} adjustsFontSizeToFit>{planName.toUpperCase()}</Text>
                    <View style={styles.activeBadge}>
                        <Ionicons name="checkmark-circle" size={ms(12)} color={tier.color} />
                        <Text style={[styles.activeBadgeText, { color: tier.color }]} numberOfLines={1} adjustsFontSizeToFit>{t('dashboard.active')}</Text>
                    </View>
                </LinearGradient>

                <View style={styles.activeHeaderRight}>
                    <View style={styles.priceContainer}>
                        <Text style={[styles.priceText, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>₹{price}</Text>
                        <Text style={[styles.cycleText, { color: isDark ? '#9CA3AF' : '#64748B' }]} numberOfLines={1} adjustsFontSizeToFit>{billingCycle} {t('dashboard.subscription')}</Text>
                    </View>
                    <View style={[styles.headerVerticalDivider, { backgroundColor: isDark ? '#374151' : '#F1F5F9' }]} />
                    <View style={styles.autoRenewContainer}>
                        <View style={[styles.autoRenewIconCircle, { backgroundColor: autoRenew ? (isDark ? 'rgba(34, 197, 94, 0.1)' : '#DCFCE7') : (isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2') }]}>
                            <Ionicons name="shield-checkmark-outline" size={ms(16)} color={autoRenew ? "#22C55E" : "#EF4444"} />
                        </View>
                        <Text style={[styles.autoRenewText, { color: autoRenew ? "#22C55E" : "#EF4444" }]} numberOfLines={1} adjustsFontSizeToFit>
                            {autoRenew ? t('dashboard.auto_renew_on') : t('dashboard.auto_renew_off')}
                        </Text>
                    </View>
                </View>
            </View>

            {/* ACTIVE DETAILS */}
            <View style={styles.detailsGrid}>
                <View style={styles.detailCol}>
                    <View style={[styles.iconCircle, { backgroundColor: isDark ? tier.darkBgColor : tier.bgColor }]}>
                        <Ionicons name="calendar-outline" size={ms(18)} color={tier.color} />
                    </View>
                    <Text style={[styles.detailLabel, { color: isDark ? '#9CA3AF' : '#64748B' }]} numberOfLines={1} adjustsFontSizeToFit>{t('dashboard.start_date')}</Text>
                    <Text style={[styles.detailValue, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{safeFormatDate(startDate)}</Text>
                    <Text style={[styles.detailSub, { color: isDark ? '#6B7280' : '#94A3B8' }]} numberOfLines={1} adjustsFontSizeToFit>{safeFormatTime(startDate)}</Text>
                </View>
                <View style={[styles.divider, { backgroundColor: isDark ? '#374151' : '#F1F5F9' }]} />
                <View style={styles.detailCol}>
                    <View style={[styles.iconCircle, { backgroundColor: isDark ? tier.darkBgColor : tier.bgColor }]}>
                        <Ionicons name="calendar-outline" size={ms(18)} color={tier.color} />
                    </View>
                    <Text style={[styles.detailLabel, { color: isDark ? '#9CA3AF' : '#64748B' }]} numberOfLines={1} adjustsFontSizeToFit>{t('dashboard.next_billing_date')}</Text>
                    <Text style={[styles.detailValue, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{safeFormatDate(expiryDate)}</Text>
                    <Text style={[styles.detailSub, { color: isDark ? '#6B7280' : '#94A3B8' }]} numberOfLines={1} adjustsFontSizeToFit>{safeFormatTime(expiryDate)}</Text>
                </View>
                <View style={[styles.divider, { backgroundColor: isDark ? '#374151' : '#F1F5F9' }]} />
                <View style={styles.detailCol}>
                    <View style={[styles.iconCircle, { backgroundColor: isDark ? tier.darkBgColor : tier.bgColor }]}>
                        <Ionicons name="document-text-outline" size={ms(18)} color={tier.color} />
                    </View>
                    <Text style={[styles.detailLabel, { color: isDark ? '#9CA3AF' : '#64748B' }]} numberOfLines={1} adjustsFontSizeToFit>{t('dashboard.billing_cycle')}</Text>
                    <Text style={[styles.detailValue, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{billingCycle}</Text>
                </View>
            </View>

            {/* ACTIVE FOOTER */}
            <View style={[styles.activeFooter, { borderTopColor: isDark ? '#374151' : '#F1F5F9' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="document-text-outline" size={ms(16)} color={tier.color} style={{ marginRight: s(6) }} />
                    <Text style={[styles.footerMsg, { color: isDark ? '#D1D5DB' : '#334155' }]} numberOfLines={2} adjustsFontSizeToFit>{t('dashboard.manage_subscription')}</Text>
                </View>
                <Pressable style={styles.viewPlanDetailsBtn} onPress={() => navigation.navigate('SubscriptionHistoryScreen')}>
                    <Text style={[styles.viewPlanDetailsText, { color: tier.color }]} numberOfLines={1} adjustsFontSizeToFit>{t('dashboard.view_plan')}</Text>
                    <Ionicons name="chevron-forward" size={ms(14)} color={tier.color} />
                </Pressable>
            </View>
        </View>
    );
};

export default RechargeCard;

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: s(12),
        marginTop: vs(8),
        borderRadius: ms(16),
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
        overflow: 'hidden',
    },
    headerRow: {
        flexDirection: 'row',
        paddingVertical: vs(8),
        paddingHorizontal: s(12),
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    // INACTIVE STYLES
    inactiveHeaderLeft: {
        flex: 1,
        flexDirection: 'row',
    },
    redShieldWrap: {
        width: ms(44),
        height: ms(44),
        borderRadius: ms(22),
        backgroundColor: '#FEF2F2',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: s(12),
        position: 'relative',
    },
    exclamationDot: {
        position: 'absolute',
        top: ms(8),
        right: ms(8),
        width: ms(12),
        height: ms(12),
        borderRadius: ms(6),
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FFF',
    },
    inactiveTitles: {
        flex: 1,
        justifyContent: 'center',
    },
    inactiveTitleMain: {
        fontSize: getLanguageScaledSize(16),
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: vs(2),
    },
    inactiveTitleSub: {
        fontSize: getLanguageScaledSize(11),
        color: '#64748B',
        marginBottom: vs(6),
    },
    inactiveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF2F2',
        alignSelf: 'flex-start',
        paddingHorizontal: s(8),
        paddingVertical: vs(2),
        borderRadius: ms(10),
    },
    inactiveBadgeText: {
        fontSize: getLanguageScaledSize(10),
        fontWeight: '600',
        color: '#EF4444',
        marginLeft: s(4),
    },
    inactiveHeaderRight: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        paddingLeft: s(12),
    },
    browsePlansBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#EF4444',
        paddingHorizontal: s(12),
        paddingVertical: vs(6),
        borderRadius: ms(8),
        marginBottom: vs(4),
    },
    browsePlansText: {
        fontSize: getLanguageScaledSize(12),
        fontWeight: '700',
        color: '#EF4444',
        marginLeft: s(4),
    },
    chooseBestText: {
        fontSize: getLanguageScaledSize(10),
        color: '#64748B',
    },
    detailsGrid: {
        flexDirection: 'row',
        paddingVertical: vs(8),
        paddingHorizontal: s(16),
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    detailCol: {
        flex: 1,
        alignItems: 'center',
    },
    redIconCircle: {
        width: ms(28),
        height: ms(28),
        borderRadius: ms(14),
        backgroundColor: '#FEF2F2',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: vs(4),
    },
    detailLabel: {
        fontSize: getLanguageScaledSize(11),
        color: '#64748B',
        marginBottom: vs(4),
        fontWeight: '500',
    },
    detailValueInactive: {
        fontSize: getLanguageScaledSize(18),
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: vs(2),
    },
    detailSubInactive: {
        fontSize: getLanguageScaledSize(11),
        color: '#94A3B8',
    },
    divider: {
        width: 1,
        height: '70%',
        backgroundColor: '#F1F5F9',
        alignSelf: 'center',
    },
    inactiveFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FEF2F2',
        paddingHorizontal: s(16),
        paddingVertical: vs(8),
        borderBottomLeftRadius: ms(16),
        borderBottomRightRadius: ms(16),
    },
    inactiveFooterText: {
        fontSize: getLanguageScaledSize(12),
        fontWeight: '600',
        color: '#0F172A',
        flex: 1,
    },
    viewPlansSolidBtn: {
        backgroundColor: '#EF4444',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: s(12),
        paddingVertical: vs(8),
        borderRadius: ms(8),
    },
    viewPlansSolidText: {
        color: '#FFF',
        fontSize: getLanguageScaledSize(12),
        fontWeight: '700',
        marginRight: s(4),
    },

    // ACTIVE STYLES
    activeGradientBox: {
        flex: 0.35,
        borderRadius: ms(12),
        padding: ms(6),
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: vs(60),
    },
    activePlanName: {
        fontSize: getLanguageScaledSize(14),
        fontWeight: '800',
        color: '#FFFFFF',
        marginBottom: vs(4),
        textAlign: 'center',
    },
    activeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.95)',
        paddingHorizontal: s(8),
        paddingVertical: vs(2),
        borderRadius: ms(12),
    },
    activeBadgeText: {
        fontSize: getLanguageScaledSize(10),
        fontWeight: '700',
        marginLeft: s(4),
    },
    activeHeaderRight: {
        flex: 0.65,
        flexDirection: 'row',
        paddingLeft: s(8),
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerVerticalDivider: {
        width: 1,
        height: '60%',
        backgroundColor: '#F1F5F9',
        marginHorizontal: s(12),
    },
    priceContainer: {
        alignItems: 'center',
    },
    priceText: {
        fontSize: getLanguageScaledSize(16),
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: vs(2),
    },
    cycleText: {
        fontSize: getLanguageScaledSize(9),
        color: '#64748B',
        fontWeight: '500',
    },
    autoRenewContainer: {
        alignItems: 'center',
    },
    autoRenewIconCircle: {
        width: ms(26),
        height: ms(26),
        borderRadius: ms(13),
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: vs(2),
    },
    autoRenewText: {
        fontSize: getLanguageScaledSize(9),
        fontWeight: '700',
    },
    iconCircle: {
        width: ms(28),
        height: ms(28),
        borderRadius: ms(14),
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: vs(4),
    },
    detailValue: {
        fontSize: getLanguageScaledSize(14),
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: vs(2),
        textAlign: 'center',
    },
    detailSub: {
        fontSize: getLanguageScaledSize(11),
        color: '#94A3B8',
        fontWeight: '500',
    },
    activeFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: s(16),
        paddingVertical: vs(8),
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    footerMsg: {
        fontSize: getLanguageScaledSize(12),
        color: '#334155',
        fontWeight: '500',
    },
    viewPlanDetailsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    viewPlanDetailsText: {
        fontSize: getLanguageScaledSize(13),
        fontWeight: '700',
        marginRight: s(2),
    },
});
