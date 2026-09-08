import React, { useState } from 'react';
import {
    View,
    ScrollView,
    Pressable,
    TouchableOpacity,
    Linking,
    Platform,
    UIManager,
    Image,
    StyleSheet,
} from 'react-native';

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../../context/ThemeContext';
import { Text, Input } from '../../../Components';
import AppStatusBar from '../../../Components/AppStatusBar';
import { hS as s, vS as vs, mS as ms } from '../../../lib/scale';
import { FAQScreen_Nav, ChatbotScreen_Nav } from '../../../Navigations/navigations';

const getPopularTopics = (t: any) => [
    {
        id: 1,
        title: t('topic_payments_earnings', 'Payments & Earnings'),
        subtitle: t('topic_payments_subtitle', 'Payouts, balance and invoices'),
        icon: 'wallet-outline',
        color: '#3B82F6',
        bgColor: '#EFF6FF',
        category: 'Payments',
    },
    {
        id: 2,
        title: t('topic_account_documents', 'Account & Documents'),
        subtitle: t('topic_account_subtitle', 'KYC, documents and verification'),
        icon: 'document-text-outline',
        color: '#10B981',
        bgColor: '#ECFDF5',
        category: 'Account',
    },
    {
        id: 3,
        title: t('topic_trips_bookings', 'Trips & Bookings'),
        subtitle: t('topic_trips_subtitle', 'Trip issues and cancellations'),
        icon: 'car-outline',
        color: '#F59E0B',
        bgColor: '#FFFBEB',
        category: 'Trips',
    },
    {
        id: 4,
        title: t('topic_subscription_plans', 'Subscription & Plans'),
        subtitle: t('topic_subscription_subtitle', 'Plans, renewals and benefits'),
        icon: 'star-outline',
        color: '#8B5CF6',
        bgColor: '#F5F3FF',
        category: 'Subscription',
    },
    {
        id: 5,
        title: t('topic_safety_guidelines', 'Safety & Guidelines'),
        subtitle: t('topic_safety_subtitle', 'Safety tips and community rules'),
        icon: 'shield-checkmark-outline',
        color: '#EF4444',
        bgColor: '#FEF2F2',
        category: 'General',
    },
    {
        id: 6,
        title: t('topic_other_help', 'Other Help'),
        subtitle: t('topic_other_subtitle', 'Other issues and general queries'),
        icon: 'chatbubble-ellipses-outline',
        color: '#3B82F6',
        bgColor: '#EFF6FF',
        category: 'General',
    },
];

const getOtherWaysHelp = (t: any) => [
    {
        id: 'whatsapp',
        title: t('help_chat_whatsapp', 'Chat on WhatsApp'),
        subtitle: t('help_chat_whatsapp_subtitle', 'Chat with our support team'),
        icon: 'logo-whatsapp',
        color: '#22C55E',
        bgColor: '#DCFCE7',
        badge: t('recommended', 'Recommended')
    },
    {
        id: 'email',
        title: t('help_email_us', 'Email Us'),
        subtitle: 'support@t2drive.com',
        icon: 'mail-outline',
        color: '#8B5CF6',
        bgColor: '#F5F3FF',
    },
    {
        id: 'faqs',
        title: t('help_faqs', 'FAQs'),
        subtitle: t('help_faqs_subtitle', 'Find quick answers here'),
        icon: 'help-circle-outline',
        color: '#F59E0B',
        bgColor: '#FFFBEB',
    }
];

const HelpCenterScreen = ({ navigation, route }: any) => {
    const { t } = useTranslation();

    const POPULAR_TOPICS = getPopularTopics(t);
    const OTHER_WAYS_HELP = getOtherWaysHelp(t);
    const { theme, isDark } = useAppTheme();

    const [searchQuery, setSearchQuery] = useState('');

    const [showAllTopics, setShowAllTopics] = useState(false);

    // Handle deep link parameter to automatically open the chat
    React.useEffect(() => {
        if (route.params?.openChat) {
            navigation.navigate(ChatbotScreen_Nav);
            // Clear the param so it doesn't reopen if the user navigates back and forth
            navigation.setParams({ openChat: undefined });
        }
    }, [route.params?.openChat, navigation]);

    const handleCallSupport = () => {
        Linking.openURL('tel:18001234567');
    };

    const displayedTopics = showAllTopics ? POPULAR_TOPICS : POPULAR_TOPICS.slice(0, 2);

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top']}>
            <AppStatusBar />
            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={s(24)} color={theme.colors.text} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{t('help_center')}</Text>
                <View style={{ width: s(24) }} />
            </View>

            <ScrollView
                stickyHeaderIndices={[1]}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Hero Section */}
                <View style={[styles.heroCard, { backgroundColor: isDark ? '#1E293B' : '#F3F7FF' }]}>
                    <View style={styles.heroLeft}>
                        <Text style={[styles.heroTitleMain, { color: isDark ? '#F8FAFC' : '#0B193C' }]}>
                            {t('were_here', "We're here")}{' '}
                            <Text style={styles.heroTitleHighlight}>
                                {t('to_help', 'to help')}
                            </Text>
                        </Text>
                        <Text style={[styles.heroSubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                            {t('help_subtitle', 'Get quick support and find answers to your questions.')}
                        </Text>
                        <View style={styles.heroSearchContainer}>
                            <Input
                                placeholder={t('search_help_placeholder', 'Search for help...')}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                returnKeyType="search"
                                onSubmitEditing={() => {
                                    if (searchQuery.trim()) {
                                        navigation.navigate(ChatbotScreen_Nav, { initialMessage: searchQuery.trim() });
                                        setSearchQuery(''); // clear it after sending
                                    }
                                }}
                                LeadingAccessory={
                                    <Ionicons name="search" size={s(18)} color="#94A3B8" style={{ marginRight: s(8) }} />
                                }
                                inputContainerStyle={[styles.heroSearchInput, { backgroundColor: isDark ? '#334155' : '#FFFFFF', borderColor: isDark ? '#475569' : '#FFFFFF' }]}
                                placeholderTextColor="#94A3B8"
                                style={{ fontSize: ms(13), color: isDark ? '#F8FAFC' : '#1E293B', height: '100%' }}
                            />
                        </View>
                    </View>
                    <View style={styles.heroRight}>
                        <Image
                            source={require('../../../assets/images/supporti.png')}
                            style={styles.heroImage}
                            resizeMode="contain"
                        />
                    </View>
                </View>

                {/* Popular Topics */}
                <View style={styles.popularTopicsContainer}>
                    <View style={styles.popularHeader}>
                        <Text style={[styles.popularTitle, { color: isDark ? '#F8FAFC' : '#0B193C' }]}>{t('popular_topics', 'Popular Topics')}</Text>
                        <TouchableOpacity onPress={() => setShowAllTopics(!showAllTopics)}>
                            <Text style={styles.viewAllText}>{showAllTopics ? t('show_less', 'Show Less') : t('view_all', 'View All')}</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.topicsList}>
                        {displayedTopics.map((topic, index) => (
                            <TouchableOpacity 
                                key={topic.id} 
                                style={[
                                    styles.topicListItem, 
                                    index !== displayedTopics.length - 1 && { 
                                        borderBottomWidth: StyleSheet.hairlineWidth, 
                                        borderBottomColor: isDark ? '#334155' : '#E2E8F0' 
                                    }
                                ]}
                                onPress={() => navigation.navigate(FAQScreen_Nav, { category: topic.category })}
                            >
                                <View style={[styles.topicIconContainer, { backgroundColor: isDark ? `${topic.color}20` : topic.bgColor }]}>
                                    <Ionicons name={topic.icon} size={s(18)} color={topic.color} />
                                </View>
                                <View style={styles.topicContent}>
                                    <Text style={[styles.topicCardTitle, { color: theme.colors.text }]} numberOfLines={1}>
                                        {topic.title}
                                    </Text>
                                    <Text style={[styles.topicCardSubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]} numberOfLines={2}>
                                        {topic.subtitle}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={s(16)} color="#94A3B8" />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
                {/* Other Ways to Get Help */}
                <View style={styles.otherWaysContainer}>
                    <Text style={[styles.popularTitle, { color: isDark ? '#F8FAFC' : '#0B193C', marginBottom: vs(12) }]}>
                        {t('other_ways_help', 'Other Ways to Get Help')}
                    </Text>
                    <View style={[styles.otherWaysCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
                        {OTHER_WAYS_HELP.map((item, index) => (
                            <TouchableOpacity 
                                key={item.id} 
                                style={[
                                    styles.otherWaysItem, 
                                    index !== OTHER_WAYS_HELP.length - 1 && { 
                                        borderBottomWidth: StyleSheet.hairlineWidth, 
                                        borderBottomColor: isDark ? '#334155' : '#E2E8F0' 
                                    }
                                ]}
                                onPress={() => {
                                    if(item.id === 'call') handleCallSupport();
                                    else if(item.id === 'whatsapp') navigation.navigate(ChatbotScreen_Nav);
                                    else if(item.id === 'faqs') navigation.navigate(FAQScreen_Nav);
                                }}
                            >
                                <View style={[styles.topicIconContainer, { backgroundColor: isDark ? `${item.color}20` : item.bgColor, marginRight: s(12) }]}>
                                    <Ionicons name={item.icon} size={s(18)} color={item.color} />
                                </View>
                                <View style={styles.topicContent}>
                                    <Text style={[styles.topicCardTitle, { color: theme.colors.text }]} numberOfLines={1}>
                                        {item.title}
                                    </Text>
                                    <Text style={[styles.topicCardSubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
                                        {item.subtitle}
                                    </Text>
                                </View>
                                {item.badge ? (
                                    <View style={[styles.badgeContainer, { backgroundColor: isDark ? '#064E3B' : '#D1FAE5' }]}>
                                        <Text style={[styles.badgeText, { color: isDark ? '#34D399' : '#059669' }]}>{item.badge}</Text>
                                    </View>
                                ) : null}
                                <Ionicons name="chevron-forward" size={s(16)} color="#94A3B8" />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Contact Footer */}
                <View style={[styles.footerCard, { backgroundColor: isDark ? '#1E293B' : '#F0F9FF' }]}>
                    <View style={styles.footerInfo}>
                        <Text style={[styles.footerTitle, { color: isDark ? '#60A5FA' : '#1E40AF' }]} numberOfLines={1} adjustsFontSizeToFit>{t('still_need_help', 'Still need help?')}</Text>
                        <Text style={[styles.footerDesc, { color: isDark ? '#94A3B8' : '#3B82F6' }]}>
                            {t('contact_support_desc', 'Our support team is available 24/7 to assist you.')}
                        </Text>
                    </View>
                    <View style={styles.footerActions}>
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: isDark ? '#334155' : '#0B193C' }]} onPress={handleCallSupport}>
                            <Ionicons name="call" size={s(18)} color="#FFFFFF" />
                            <Text style={styles.actionBtnText} numberOfLines={1} adjustsFontSizeToFit>{t('call_us', 'Call Us')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderWidth: 1, borderColor: '#3B82F6' }]}
                            onPress={() => navigation.navigate(ChatbotScreen_Nav)}
                        >
                            <Ionicons name="chatbubbles" size={s(18)} color="#3B82F6" />
                            <Text style={[styles.actionBtnText, { color: '#3B82F6' }]} numberOfLines={1} adjustsFontSizeToFit>{t('chat_now', 'Chat Now')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>


        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: vs(56),
        paddingHorizontal: s(16),
        zIndex: 100,
    },
    backBtn: {
        padding: s(4),
    },
    headerTitle: {
        fontSize: ms(18),
        fontWeight: '600',
    },
    scrollContent: {
        paddingBottom: vs(40),
    },
    heroCard: {
        flexDirection: 'row',
        marginHorizontal: s(16),
        marginTop: vs(12),
        marginBottom: vs(8),
        borderRadius: ms(16),
        padding: s(12),
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    heroLeft: {
        flex: 1,
        paddingRight: s(8),
    },
    heroTitleMain: {
        fontSize: ms(20),
        fontWeight: '800',
        lineHeight: ms(24),
        marginBottom: vs(4),
    },
    heroTitleHighlight: {
        color: '#3B82F6',
    },
    heroSubtitle: {
        fontSize: ms(11),
        lineHeight: ms(15),
        marginBottom: vs(10),
    },
    heroSearchContainer: {
        width: '100%',
    },
    heroSearchInput: {
        height: vs(38),
        borderRadius: ms(10),
        borderWidth: 1,
        paddingHorizontal: s(10),
    },
    popularTopicsContainer: {
        paddingHorizontal: s(16),
        marginTop: vs(16),
        marginBottom: vs(10),
    },
    popularHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: vs(16),
    },
    popularTitle: {
        fontSize: ms(18),
        fontWeight: '800',
    },
    viewAllText: {
        fontSize: ms(14),
        fontWeight: '700',
        color: '#3B82F6',
    },
    topicsList: {
        flexDirection: 'column',
    },
    topicListItem: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: vs(8),
    },
    topicIconContainer: {
        width: s(36),
        height: s(36),
        borderRadius: s(18),
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: s(12),
    },
    topicContent: {
        flex: 1,
        justifyContent: 'center',
    },
    topicCardTitle: {
        fontSize: ms(13),
        fontWeight: '500',
        marginBottom: vs(2),
        lineHeight: ms(18),
    },
    topicCardSubtitle: {
        fontSize: ms(11),
        lineHeight: ms(14),
    },

    otherWaysContainer: {
        paddingHorizontal: s(16),
        marginBottom: vs(20),
    },
    otherWaysCard: {
        borderRadius: ms(16),
        borderWidth: 1,
    },
    otherWaysItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: vs(8),
        paddingHorizontal: s(12),
    },
    badgeContainer: {
        paddingHorizontal: s(8),
        paddingVertical: vs(4),
        borderRadius: ms(12),
        marginRight: s(8),
    },
    badgeText: {
        fontSize: ms(10),
        fontWeight: '600',
    },
    footerCard: {
        marginHorizontal: s(16),
        marginBottom: vs(40),
        padding: s(16),
        borderRadius: ms(16),
    },
    footerInfo: {
        marginBottom: vs(12),
        alignItems: 'center',
    },
    footerTitle: {
        fontSize: ms(16),
        fontWeight: '700',
        color: '#1E40AF',
        marginBottom: vs(2),
    },
    footerDesc: {
        fontSize: ms(11),
        color: '#3B82F6',
        textAlign: 'center',
        lineHeight: ms(16),
    },
    footerActions: {
        flexDirection: 'row',
        gap: s(8),
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: vs(40),
        borderRadius: ms(10),
        gap: s(6),
    },
    actionBtnText: {
        color: '#FFFFFF',
        fontSize: ms(13),
        fontWeight: '600',
    },
    heroRight: {
        width: s(90),
        height: s(90),
        justifyContent: 'center',
        alignItems: 'center',
    },
    heroImage: {
        width: '100%',
        height: '100%',
    },
});

export default HelpCenterScreen;
