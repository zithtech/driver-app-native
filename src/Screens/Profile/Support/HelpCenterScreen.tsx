import React, { useState, useMemo } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    Pressable,
    TouchableOpacity,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import Animated, {
    useAnimatedStyle,
    withTiming,
    FadeInDown,
} from 'react-native-reanimated';
import { useAppTheme } from '../../../context/ThemeContext';
import { Text, Input } from '../../../Components';
import AppStatusBar from '../../../Components/AppStatusBar';
import { hS as s, vS as vs, mS as ms } from '../../../lib/scale';
import FaqChatbotModal from '../../Onboarding/FaqChatbotModal';

/* ================= TYPES ================= */
interface FAQ {
    id: number;
    question: string;
    answer: string;
    category: string;
}

/* ================= DATA ================= */
const CATEGORIES = ['all', 'getting_started', 'payments', 'safety', 'account'];

const FAQ_DATA: FAQ[] = [
    {
        id: 1,
        category: 'getting_started',
        question: 'How do I start a ride?',
        answer: "Go to the home screen and slide 'Go Online'. You will start receiving ride requests. When a request appears, tap 'Accept' to see pickup details.",
    },
    {
        id: 2,
        category: 'payments',
        question: 'How are earnings calculated?',
        answer: 'Earnings are based on distance, time, and base fare. You can view detailed breakdown in the Earnings section. Peak hour surges may also apply.',
    },
    {
        id: 3,
        category: 'safety',
        question: 'What if a passenger cancels?',
        answer: 'If a passenger cancels after you have arrived or after 5 minutes of booking, you may receive a cancellation fee credited to your wallet.',
    },
    {
        id: 4,
        category: 'account',
        question: 'How do I contact support?',
        answer: 'You can contact support via the Contact Support screen in settings or use the SOS button during an active ride for emergencies.',
    },
    {
        id: 5,
        category: 'payments',
        question: 'When do I get paid?',
        answer: 'Payouts are processed weekly on Mondays. You can also use the Instant Cashout feature in your Wallet if you meet the minimum balance requirements.',
    },
    {
        id: 6,
        category: 'getting_started',
        question: 'How to use navigation?',
        answer: 'Once you accept a ride, tap the Navigate button. This will open your preferred map app (Google Maps or Waze) to guide you to the destination.',
    },
];

/* ================= COMPONENTS ================= */

const AccordionItem = ({ item, isExpanded, onPress }: { item: FAQ, isExpanded: boolean, onPress: () => void }) => {
    const { theme, isDark } = useAppTheme();

    const accordionMarginTop = vs(12);
    const animatedStyle = useAnimatedStyle(() => {
        return {
            height: withTiming(isExpanded ? 'auto' : 0, { duration: 300 }),
            opacity: withTiming(isExpanded ? 1 : 0, { duration: 250 }),
            marginTop: withTiming(isExpanded ? accordionMarginTop : 0, { duration: 300 }),
        };
    });

    const rotateStyle = useAnimatedStyle(() => {
        return {
            transform: [{ rotate: withTiming(isExpanded ? '180deg' : '0deg') }],
        };
    });

    return (
        <View style={[styles.faqCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Pressable onPress={onPress} style={styles.faqHeader}>
                <Text style={[styles.questionText, { color: theme.colors.text }]}>{item.question}</Text>
                <Animated.View style={rotateStyle}>
                    <Ionicons name="chevron-down" size={s(20)} color={theme.colors.primary} />
                </Animated.View>
            </Pressable>
            <Animated.View style={[styles.answerContainer, animatedStyle]}>
                <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
                <Text style={[styles.answerText, { color: isDark ? '#94A3B8' : '#64748B' }]}>{item.answer}</Text>
            </Animated.View>
        </View>
    );
};

const HelpCenterScreen = ({ navigation, route }: any) => {
    const { t } = useTranslation();
    const { theme, isDark } = useAppTheme();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [chatVisible, setChatVisible] = useState(false);

    // Handle deep link parameter to automatically open the chat
    React.useEffect(() => {
        if (route.params?.openChat) {
            setChatVisible(true);
            // Clear the param so it doesn't reopen if the user navigates back and forth
            navigation.setParams({ openChat: undefined });
        }
    }, [route.params?.openChat, navigation]);

    const filteredFAQs = useMemo(() => {
        return FAQ_DATA.filter(faq => {
            const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [searchQuery, selectedCategory]);

    const handleCallSupport = () => {
        Linking.openURL('tel:18001234567');
    };

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
                {/* Search Bar Container */}
                <View style={styles.searchSection}>
                    <Text style={[styles.heroTitle, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{t('how_can_we_help', 'How can we help?')}</Text>
                    <Input
                        placeholder={t('search_help_placeholder', 'Search questions...')}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        LeadingAccessory={
                            <Ionicons name="search" size={s(20)} color="#94A3B8" style={{ marginRight: s(10) }} />
                        }
                        inputContainerStyle={[styles.searchInput, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E2E8F0' }]}
                    />
                </View>

                {/* Category Pills */}
                <View style={[styles.categoryWrapper, { backgroundColor: theme.colors.background }]}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.categoryContent}
                    >
                        {CATEGORIES.map(cat => (
                            <TouchableOpacity
                                key={cat}
                                onPress={() => setSelectedCategory(cat)}
                                style={[
                                    styles.categoryPill,
                                    {
                                        backgroundColor: selectedCategory === cat ? theme.colors.primary : (isDark ? '#1E293B' : '#FFFFFF'),
                                        borderColor: selectedCategory === cat ? theme.colors.primary : theme.colors.border,
                                    }
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.categoryText,
                                        { color: selectedCategory === cat ? '#FFFFFF' : theme.colors.text }
                                    ]}
                                >
                                    {t(`faq_cat_${cat}`, cat.replace('_', ' ').toUpperCase())}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* FAQ List */}
                <View style={styles.faqList}>
                    {filteredFAQs.length > 0 ? (
                        filteredFAQs.map((faq, index) => (
                            <Animated.View key={faq.id} entering={FadeInDown.delay(index * 100)}>
                                <AccordionItem
                                    item={faq}
                                    isExpanded={expandedId === faq.id}
                                    onPress={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
                                />
                            </Animated.View>
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <Ionicons name="help-circle-outline" size={s(60)} color={isDark ? '#334155' : '#CBD5E1'} />
                            <Text style={[styles.emptyText, { color: isDark ? '#64748B' : '#94A3B8' }]}>{t('no_faqs_found', 'No matching questions found.')}</Text>
                        </View>
                    )}
                </View>

                {/* Contact Footer */}
                <View style={[styles.footerCard, { backgroundColor: isDark ? '#1E293B' : '#EFF6FF' }]}>
                    <View style={styles.footerInfo}>
                        <Text style={[styles.footerTitle, { color: isDark ? '#60A5FA' : '#1E40AF' }]} numberOfLines={1} adjustsFontSizeToFit>{t('still_need_help', 'Still need help?')}</Text>
                        <Text style={[styles.footerDesc, { color: isDark ? '#94A3B8' : '#3B82F6' }]}>
                            {t('contact_support_desc', 'Our support team is available 24/7 to assist you.')}
                        </Text>
                    </View>
                    <View style={styles.footerActions}>
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]} onPress={handleCallSupport}>
                            <Ionicons name="call" size={s(18)} color="#FFFFFF" />
                            <Text style={styles.actionBtnText} numberOfLines={1} adjustsFontSizeToFit>{t('call_us', 'Call Us')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: isDark ? '#334155' : '#FFFFFF', borderWidth: 1, borderColor: '#3B82F6' }]}
                            onPress={() => setChatVisible(true)}
                        >
                            <Ionicons name="chatbubbles" size={s(18)} color="#3B82F6" />
                            <Text style={[styles.actionBtnText, { color: '#3B82F6' }]} numberOfLines={1} adjustsFontSizeToFit>{t('chat_now', 'Chat Now')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            <FaqChatbotModal visible={chatVisible} onClose={() => setChatVisible(false)} />
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
        fontWeight: '700',
    },
    scrollContent: {
        paddingBottom: vs(40),
    },
    searchSection: {
        padding: s(20),
        paddingBottom: vs(10),
    },
    heroTitle: {
        fontSize: ms(24),
        fontWeight: '800',
        marginBottom: vs(16),
        color: '#1E293B',
    },
    searchInput: {
        height: vs(50),
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
    },
    categoryWrapper: {
        paddingVertical: vs(12),
        zIndex: 10,
    },
    categoryContent: {
        paddingHorizontal: s(20),
        gap: s(10),
    },
    categoryPill: {
        paddingHorizontal: s(16),
        paddingVertical: vs(8),
        borderRadius: ms(20),
        borderWidth: 1,
    },
    categoryText: {
        fontSize: ms(13),
        fontWeight: '700',
    },
    faqList: {
        paddingHorizontal: s(20),
        marginTop: vs(10),
    },
    faqCard: {
        borderRadius: ms(16),
        padding: s(16),
        marginBottom: vs(12),
        borderWidth: 1,
    },
    faqHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    questionText: {
        fontSize: ms(15),
        fontWeight: '700',
        color: '#1E293B',
        flex: 1,
        marginRight: s(10),
    },
    answerContainer: {
        overflow: 'hidden',
    },
    divider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginVertical: vs(8),
    },
    answerText: {
        fontSize: ms(14),
        color: '#64748B',
        lineHeight: ms(22),
    },
    emptyState: {
        alignItems: 'center',
        marginTop: vs(40),
    },
    emptyText: {
        marginTop: vs(12),
        color: '#94A3B8',
        fontSize: ms(14),
    },
    footerCard: {
        margin: s(20),
        marginTop: vs(30),
        padding: s(20),
        borderRadius: ms(24),
    },
    footerInfo: {
        marginBottom: vs(20),
        alignItems: 'center',
    },
    footerTitle: {
        fontSize: ms(18),
        fontWeight: '800',
        color: '#1E40AF',
        marginBottom: vs(4),
    },
    footerDesc: {
        fontSize: ms(13),
        color: '#3B82F6',
        textAlign: 'center',
        lineHeight: ms(18),
    },
    footerActions: {
        flexDirection: 'row',
        gap: s(12),
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: vs(48),
        borderRadius: ms(14),
        gap: s(8),
    },
    actionBtnText: {
        color: '#FFFFFF',
        fontSize: ms(14),
        fontWeight: '700',
    },
});

export default HelpCenterScreen;
