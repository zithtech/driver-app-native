import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { hS as s, vS as vs, mS as ms } from '../../../lib/scale';
import { Text } from '../../../Components';
import { format } from 'date-fns';

const PLAN_CONFIG: any = {
    basic: {
        gradient: ['#60A5FA', '#2563EB'],
        icon: 'shield',
        color: '#2563EB',
        bgColor: '#EFF6FF'
    },
    elite: {
        gradient: ['#A78BFA', '#6D28D9'],
        icon: 'ribbon',
        color: '#6D28D9',
        bgColor: '#F5F3FF'
    },
    premium: {
        gradient: ['#FBBF24', '#D97706'],
        icon: 'trophy',
        color: '#D97706',
        bgColor: '#FEF3C7'
    },
};

interface SubscriptionCardProps {
    subscription?: any;
}

const RechargeCard: React.FC<SubscriptionCardProps> = ({ subscription }) => {
    const { t } = useTranslation();
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
            <View style={styles.card}>
                {/* INACTIVE HEADER */}
                <View style={styles.headerRow}>
                    <View style={styles.inactiveHeaderLeft}>
                        <View style={styles.redShieldWrap}>
                            <Ionicons name="shield-outline" size={ms(24)} color="#EF4444" />
                            <View style={styles.exclamationDot}>
                                <Text style={{ color: '#FFF', fontSize: ms(10), fontWeight: 'bold' }}>!</Text>
                            </View>
                        </View>
                        <View style={styles.inactiveTitles}>
                            <Text style={styles.inactiveTitleMain}>No Active Plan</Text>
                            <Text style={styles.inactiveTitleSub}>Subscribe to start receiving trips</Text>
                            <View style={styles.inactiveBadge}>
                                <Ionicons name="information-circle-outline" size={ms(12)} color="#EF4444" />
                                <Text style={styles.inactiveBadgeText}>Plan inactive</Text>
                            </View>
                        </View>
                    </View>
                    <View style={styles.inactiveHeaderRight}>
                        <Pressable style={styles.browsePlansBtn} onPress={() => navigation.navigate('RechargePlanScreen')}>
                            <Ionicons name="ribbon-outline" size={ms(16)} color="#EF4444" />
                            <Text style={styles.browsePlansText}>Browse Plans</Text>
                        </Pressable>
                        <Text style={styles.chooseBestText}>Choose the best plan for you</Text>
                    </View>
                </View>

                {/* INACTIVE DETAILS */}
                <View style={styles.detailsGrid}>
                    <View style={styles.detailCol}>
                        <View style={styles.redIconCircle}>
                            <Ionicons name="calendar-outline" size={ms(18)} color="#EF4444" />
                        </View>
                        <Text style={styles.detailLabel}>Start Date</Text>
                        <Text style={styles.detailValueInactive}>-</Text>
                        <Text style={styles.detailSubInactive}>Not available</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.detailCol}>
                        <View style={styles.redIconCircle}>
                            <Ionicons name="calendar-outline" size={ms(18)} color="#EF4444" />
                        </View>
                        <Text style={styles.detailLabel}>Next Billing Date</Text>
                        <Text style={styles.detailValueInactive}>-</Text>
                        <Text style={styles.detailSubInactive}>Not available</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.detailCol}>
                        <View style={styles.redIconCircle}>
                            <Ionicons name="document-text-outline" size={ms(18)} color="#EF4444" />
                        </View>
                        <Text style={styles.detailLabel}>Billing Cycle</Text>
                        <Text style={styles.detailValueInactive}>-</Text>
                        <Text style={styles.detailSubInactive}>Not available</Text>
                    </View>
                </View>

                {/* INACTIVE FOOTER */}
                <View style={styles.inactiveFooter}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="pricetag-outline" size={ms(18)} color="#EF4444" style={{ marginRight: s(8) }} />
                        <Text style={styles.inactiveFooterText}>Unlock all features and start earning more.</Text>
                    </View>
                    <Pressable style={styles.viewPlansSolidBtn} onPress={() => navigation.navigate('RechargePlanScreen')}>
                        <Text style={styles.viewPlansSolidText}>View Plans</Text>
                        <Ionicons name="chevron-forward" size={ms(14)} color="#FFF" />
                    </Pressable>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.card}>
            {/* ACTIVE HEADER */}
            <View style={styles.headerRow}>
                <LinearGradient
                    colors={tier.gradient}
                    style={styles.activeGradientBox}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <Ionicons name={tier.icon} size={ms(24)} color="#FCD34D" style={{ marginBottom: vs(4) }} />
                    <Text style={styles.activePlanName}>{planName.toUpperCase()}</Text>
                    <View style={styles.activeBadge}>
                        <Ionicons name="checkmark-circle" size={ms(12)} color={tier.color} />
                        <Text style={[styles.activeBadgeText, { color: tier.color }]}>Active</Text>
                    </View>
                </LinearGradient>

                <View style={styles.activeHeaderRight}>
                    <View style={styles.priceContainer}>
                        <Text style={styles.priceText}>₹{price}</Text>
                        <Text style={styles.cycleText}>{billingCycle} Subscription</Text>
                    </View>
                    <View style={styles.headerVerticalDivider} />
                    <View style={styles.autoRenewContainer}>
                        <View style={[styles.autoRenewIconCircle, { backgroundColor: autoRenew ? '#DCFCE7' : '#FEF2F2' }]}>
                            <Ionicons name="shield-checkmark-outline" size={ms(16)} color={autoRenew ? "#22C55E" : "#EF4444"} />
                        </View>
                        <Text style={[styles.autoRenewText, { color: autoRenew ? "#22C55E" : "#EF4444" }]}>
                            Auto-renew {autoRenew ? "ON" : "OFF"}
                        </Text>
                    </View>
                </View>
            </View>

            {/* ACTIVE DETAILS */}
            <View style={styles.detailsGrid}>
                <View style={styles.detailCol}>
                    <View style={[styles.iconCircle, { backgroundColor: tier.bgColor }]}>
                        <Ionicons name="calendar-outline" size={ms(18)} color={tier.color} />
                    </View>
                    <Text style={styles.detailLabel}>Start Date</Text>
                    <Text style={styles.detailValue}>{safeFormatDate(startDate)}</Text>
                    <Text style={styles.detailSub}>{safeFormatTime(startDate)}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.detailCol}>
                    <View style={[styles.iconCircle, { backgroundColor: tier.bgColor }]}>
                        <Ionicons name="calendar-outline" size={ms(18)} color={tier.color} />
                    </View>
                    <Text style={styles.detailLabel}>Next Billing Date</Text>
                    <Text style={styles.detailValue}>{safeFormatDate(expiryDate)}</Text>
                    <Text style={styles.detailSub}>{safeFormatTime(expiryDate)}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.detailCol}>
                    <View style={[styles.iconCircle, { backgroundColor: tier.bgColor }]}>
                        <Ionicons name="document-text-outline" size={ms(18)} color={tier.color} />
                    </View>
                    <Text style={styles.detailLabel}>Billing Cycle</Text>
                    <Text style={styles.detailValue}>{billingCycle}</Text>
                </View>
            </View>

            {/* ACTIVE FOOTER */}
            <View style={styles.activeFooter}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="document-text-outline" size={ms(16)} color={tier.color} style={{ marginRight: s(6) }} />
                    <Text style={styles.footerMsg}>Manage your subscription anytime</Text>
                </View>
                <Pressable style={styles.viewPlanDetailsBtn} onPress={() => navigation.navigate('SubscriptionHistoryScreen')}>
                    <Text style={[styles.viewPlanDetailsText, { color: tier.color }]}>View Plan</Text>
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
        fontSize: ms(16),
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: vs(2),
    },
    inactiveTitleSub: {
        fontSize: ms(11),
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
        fontSize: ms(10),
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
        fontSize: ms(12),
        fontWeight: '700',
        color: '#EF4444',
        marginLeft: s(4),
    },
    chooseBestText: {
        fontSize: ms(10),
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
        fontSize: ms(11),
        color: '#64748B',
        marginBottom: vs(4),
        fontWeight: '500',
    },
    detailValueInactive: {
        fontSize: ms(18),
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: vs(2),
    },
    detailSubInactive: {
        fontSize: ms(11),
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
        fontSize: ms(12),
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
        fontSize: ms(12),
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
        fontSize: ms(14),
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
        fontSize: ms(10),
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
        fontSize: ms(16),
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: vs(2),
    },
    cycleText: {
        fontSize: ms(9),
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
        fontSize: ms(9),
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
        fontSize: ms(14),
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: vs(2),
        textAlign: 'center',
    },
    detailSub: {
        fontSize: ms(11),
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
        fontSize: ms(12),
        color: '#334155',
        fontWeight: '500',
    },
    viewPlanDetailsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    viewPlanDetailsText: {
        fontSize: ms(13),
        fontWeight: '700',
        marginRight: s(2),
    },
});
