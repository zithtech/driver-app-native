import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, useIsFocused } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import { useAppTheme } from '../../context/ThemeContext';
import AppStatusBar from '../../Components/AppStatusBar';
import { useGetMySubscriptionQuery } from '../../service/userApi';
import { hS as s, vS as vs, mS as ms } from '../../lib/scale';

const PLAN_TIERS_MAP: any = {
    basic: { 
        color: '#2563EB', 
        icon: 'shield-checkmark', 
        gradient: ['#3B82F6', '#1D4ED8'],
        text: '#FFFFFF'
    },
    elite: { 
        color: '#152D5E', 
        icon: 'diamond', 
        gradient: ['#1E3A8A', '#0F172A'],
        text: '#F8FAFC'
    },
    premium: { 
        color: '#D97706', 
        icon: 'trophy', 
        gradient: ['#F59E0B', '#B45309'],
        text: '#FFFFFF'
    },
};

const MySubscriptionScreen = ({ navigation }: any) => {
    const { colors } = useTheme();
    const { isDark, theme } = useAppTheme();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const isFocused = useIsFocused();

    const { data: subscriptionData, isLoading } = useGetMySubscriptionQuery(undefined, {
        refetchOnMountOrArgChange: true,
    });

    // Animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        if (!isLoading) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 600,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 600,
                    useNativeDriver: true,
                })
            ]).start();
        }
    }, [isLoading, fadeAnim, slideAnim]);

    const activePlan = subscriptionData?.data?.subscription || subscriptionData?.data || subscriptionData?.subscription;
    const uiStyles = useMemo(() => getStyles(theme), [theme]);

    if (isLoading) {
        return (
            <SafeAreaView style={[uiStyles.container, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]} edges={['top', 'bottom', 'left', 'right']}>
                {isFocused && <AppStatusBar forceLight={!isDark} />}
                <View style={uiStyles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary || '#1E3A8A'} />
                </View>
            </SafeAreaView>
        );
    }

    if (!activePlan) {
        return (
            <SafeAreaView style={[uiStyles.container, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]} edges={['bottom', 'left', 'right']}>
                {isFocused && <AppStatusBar forceLight={!isDark} />}
                
                <View style={[uiStyles.header, { paddingTop: insets.top + 10 }]}>
                    <Pressable onPress={() => navigation.goBack()} style={uiStyles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={isDark ? '#F8FAFC' : '#0F172A'} />
                    </Pressable>
                    <Text style={[uiStyles.headerTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>{t('my_subscription') || 'My Subscription'}</Text>
                    <View style={{ width: 24 }} />
                </View>

                <View style={uiStyles.emptyContainer}>
                    <View style={uiStyles.emptyIconWrap}>
                        <Ionicons name="cube-outline" size={64} color={isDark ? '#334155' : '#CBD5E1'} />
                    </View>
                    <Text style={[uiStyles.emptyText, { color: isDark ? '#94A3B8' : '#64748B' }]}>{t('no_active_plan') || 'No active plan found'}</Text>
                    
                    <Pressable style={uiStyles.exploreBtn} onPress={() => navigation.navigate('RechargePlanScreen')}>
                        <Text style={uiStyles.exploreBtnText}>{t('choose_plan') || 'Explore Plans'}</Text>
                        <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 8 }} />
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    const planName = activePlan?.plan?.name || activePlan?.plan?.plan_name || activePlan?.plan_name || 'Current Plan';
    const lowerName = planName.toLowerCase();
    const tierId = lowerName.includes('elite') ? 'elite' :
                   lowerName.includes('premium') ? 'premium' :
                   lowerName.includes('gold') ? 'premium' : 'basic';
    
    const tier = PLAN_TIERS_MAP[tierId] || PLAN_TIERS_MAP.basic;

    const startDateObj = activePlan?.start_date ? new Date(activePlan.start_date) : null;
    const expiryDateObj = activePlan?.expiry_date ? new Date(activePlan.expiry_date) : null;
    
    const startDate = startDateObj ? startDateObj.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    const expiryDate = expiryDateObj ? expiryDateObj.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    
    const status = activePlan?.status?.toUpperCase() || 'ACTIVE';
    const isActive = status === 'ACTIVE';

    return (
        <SafeAreaView style={[uiStyles.container, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]} edges={['bottom', 'left', 'right']}>
            {isFocused && <AppStatusBar forceLight={!isDark} />}
            
            <View style={[uiStyles.header, { paddingTop: insets.top + 10, backgroundColor: 'transparent' }]}>
                <Pressable onPress={() => navigation.goBack()} style={uiStyles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={isDark ? '#F8FAFC' : '#0F172A'} />
                </Pressable>
                <Text style={[uiStyles.headerTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>{t('my_subscription') || 'My Subscription'}</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={uiStyles.scrollContent} showsVerticalScrollIndicator={false}>
                
                <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
                    {/* Premium Plan Card */}
                    <LinearGradient
                        colors={tier.gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={uiStyles.premiumCard}
                    >
                        <View style={uiStyles.cardTopRow}>
                            <View style={uiStyles.planTitleWrap}>
                                <Ionicons name={tier.icon} size={28} color={tier.text} />
                                <Text style={[uiStyles.premiumPlanName, { color: tier.text }]}>{planName}</Text>
                            </View>
                            
                            <View style={[uiStyles.premiumBadge, { backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(239, 68, 68, 0.2)' }]}>
                                <View style={[uiStyles.statusDot, { backgroundColor: isActive ? '#4ADE80' : '#EF4444' }]} />
                                <Text style={[uiStyles.premiumStatusText, { color: isActive ? '#FFFFFF' : '#FECACA' }]}>{status}</Text>
                            </View>
                        </View>
                        
                        <View style={uiStyles.cycleWrap}>
                            <Text style={[uiStyles.premiumCycleText, { color: 'rgba(255,255,255,0.8)' }]}>
                                {activePlan?.billing_cycle ? activePlan.billing_cycle.toUpperCase() : 'SUBSCRIPTION'} PLAN
                            </Text>
                        </View>

                        <View style={uiStyles.datesRow}>
                            <View style={uiStyles.dateBox}>
                                <Text style={uiStyles.dateLabel}>{t('start_date') || 'Started'}</Text>
                                <Text style={uiStyles.dateValue}>{startDate}</Text>
                            </View>
                            <View style={uiStyles.dateDivider} />
                            <View style={uiStyles.dateBox}>
                                <Text style={uiStyles.dateLabel}>{t('expiry_date') || 'Expires'}</Text>
                                <Text style={uiStyles.dateValue}>{expiryDate}</Text>
                            </View>
                        </View>
                    </LinearGradient>
                </Animated.View>

                <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
                    {/* Payment Info Section */}
                    <View style={[uiStyles.infoSection, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', shadowColor: isDark ? '#000' : '#94A3B8' }]}>
                        <View style={uiStyles.infoRow}>
                            <View style={uiStyles.infoRowLeft}>
                                <View style={[uiStyles.infoIconBg, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}>
                                    <Ionicons name="wallet-outline" size={20} color={isDark ? '#94A3B8' : '#64748B'} />
                                </View>
                                <Text style={[uiStyles.infoLabel, { color: isDark ? '#CBD5E1' : '#475569' }]}>{t('price_paid') || 'Price Paid'}</Text>
                            </View>
                            <Text style={[uiStyles.infoValue, { color: isDark ? '#F8FAFC' : '#0F172A', fontSize: 18, fontWeight: '800' }]}>
                                ₹{activePlan?.price || activePlan?.amount || '0'}
                            </Text>
                        </View>

                        {activePlan?.transaction_id && (
                            <>
                                <View style={[uiStyles.infoDivider, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]} />
                                <View style={uiStyles.infoRow}>
                                    <View style={uiStyles.infoRowLeft}>
                                        <View style={[uiStyles.infoIconBg, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}>
                                            <Ionicons name="receipt-outline" size={20} color={isDark ? '#94A3B8' : '#64748B'} />
                                        </View>
                                        <Text style={[uiStyles.infoLabel, { color: isDark ? '#CBD5E1' : '#475569' }]}>{t('transaction_id') || 'Transaction ID'}</Text>
                                    </View>
                                    <Text style={[uiStyles.infoValue, { color: isDark ? '#F8FAFC' : '#0F172A' }]} numberOfLines={1} ellipsizeMode="middle">
                                        {activePlan.transaction_id}
                                    </Text>
                                </View>
                            </>
                        )}
                    </View>
                </Animated.View>

                <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
                    {/* Features Section */}
                    {activePlan?.plan?.features && (
                        <View style={uiStyles.featuresSection}>
                            <View style={uiStyles.featuresHeader}>
                                <Ionicons name="star" size={18} color={tier.color} />
                                <Text style={[uiStyles.featuresTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                                    {t('plan_features') || 'Included Features'}
                                </Text>
                            </View>
                            
                            <View style={uiStyles.featuresList}>
                                {Array.isArray(activePlan.plan.features) ? activePlan.plan.features.map((feature: any, index: number) => (
                                    <View key={index} style={uiStyles.featureItem}>
                                        <View style={[uiStyles.checkCircle, { backgroundColor: tier.color + '15' }]}>
                                            <Ionicons name="checkmark-sharp" size={16} color={tier.color} />
                                        </View>
                                        <Text style={[uiStyles.featureText, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                                            {typeof feature === 'string' ? feature : feature?.name || JSON.stringify(feature)}
                                        </Text>
                                    </View>
                                )) : (
                                    <View style={uiStyles.featureItem}>
                                        <View style={[uiStyles.checkCircle, { backgroundColor: tier.color + '15' }]}>
                                            <Ionicons name="checkmark-sharp" size={16} color={tier.color} />
                                        </View>
                                        <Text style={[uiStyles.featureText, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                                            {t('included_all_premium_features') || 'Included all premium features'}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    )}
                </Animated.View>

            </ScrollView>
        </SafeAreaView>
    );
};

const getStyles = (theme: any) => StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
    emptyIconWrap: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(150,150,150,0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
    emptyText: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 32 },
    exploreBtn: { flexDirection: 'row', backgroundColor: '#3B82F6', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, alignItems: 'center', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
    exploreBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },
    
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.5 },
    scrollContent: { padding: 20, paddingBottom: 120 },
    
    // Premium Card
    premiumCard: {
        borderRadius: 24,
        padding: 24,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
    },
    cardTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    planTitleWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    premiumPlanName: {
        fontSize: 26,
        fontWeight: '800',
        marginLeft: 12,
        letterSpacing: -0.5,
    },
    premiumBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    premiumStatusText: {
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    cycleWrap: {
        marginTop: 8,
        marginBottom: 32,
    },
    premiumCycleText: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1,
    },
    datesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 16,
        borderRadius: 16,
    },
    dateBox: {
        flex: 1,
    },
    dateDivider: {
        width: 1,
        height: 30,
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginHorizontal: 16,
    },
    dateLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    dateValue: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },

    // Info Section
    infoSection: {
        borderRadius: 20,
        padding: 20,
        marginBottom: 24,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    infoRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    infoIconBg: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    infoLabel: {
        fontSize: 15,
        fontWeight: '600',
    },
    infoValue: {
        fontSize: 15,
        fontWeight: '600',
        maxWidth: 150,
    },
    infoDivider: {
        height: 1,
        marginVertical: 16,
    },

    // Features Section
    featuresSection: {
        marginTop: 8,
        paddingHorizontal: 8,
        marginBottom: 24,
    },
    featuresHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    featuresTitle: {
        fontSize: 18,
        fontWeight: '800',
        marginLeft: 10,
        letterSpacing: -0.3,
    },
    featuresList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 16,
    },
    featureItem: {
        width: '48%',
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    featureText: {
        fontSize: 15,
        fontWeight: '500',
        flex: 1,
        lineHeight: 22,
    }
});

export default MySubscriptionScreen;
