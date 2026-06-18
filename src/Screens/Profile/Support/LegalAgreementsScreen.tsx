import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, FadeIn, Layout } from 'react-native-reanimated';
import { useAppTheme } from '../../../context/ThemeContext';
import { Text } from '../../../Components';
import AppStatusBar from '../../../Components/AppStatusBar';
import { hS as s, vS as vs, ms } from '../../../lib/scale';

const HighlightItem = ({ icon, text, color, theme }: any) => (
    <View style={styles.highlightRow}>
        <View style={[styles.highlightIcon, { backgroundColor: color + '15' }]}>
            <Ionicons name={icon} size={s(16)} color={color} />
        </View>
        <Text style={[styles.highlightText, { color: theme.colors.paragraphText }]}>{text}</Text>
    </View>
);

const LegalCard = ({ title, content, icon, color, index, theme }: any) => (
    <Animated.View
        entering={FadeInDown.delay(index * 100).duration(500)}
        layout={Layout.springify()}
        style={[styles.legalCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
    >
        <View style={styles.cardHeader}>
            <View style={[styles.cardIconBox, { backgroundColor: color + '15' }]}>
                <Ionicons name={icon} size={s(20)} color={color} />
            </View>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{title}</Text>
        </View>
        <Text style={[styles.cardParagraph, { color: theme.colors.paragraphText }]}>{content}</Text>
    </Animated.View>
);

const PrivacyContent = ({ t, theme, isDark }: any) => (
    <Animated.View entering={FadeIn.duration(400)}>
        <Animated.View entering={FadeInDown.delay(100)} style={[styles.tldrCard, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
            <Text style={[styles.tldrTitle, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>✨ {t('privacy_highlights', 'Policy Highlights')}</Text>
            <HighlightItem icon="shield-checkmark" text={t('highlight_1', 'Your data is encrypted and secure.')} color="#10B981" theme={theme} />
            <HighlightItem icon="location" text={t('highlight_2', 'Location is only tracked while you are online.')} color="#2563EB" theme={theme} />
            <HighlightItem icon="eye-off" text={t('highlight_3', 'We never sell your personal information.')} color="#F59E0B" theme={theme} />
        </Animated.View>

        <LegalCard index={2} icon="information-circle-outline" color="#6366F1" title="1. Introduction" content={t('privacy_intro', 'Welcome to VDrive. We value your privacy and are committed to protecting your personal data. This privacy policy explains how we collect, use, and share your information when you use our driver application.')} theme={theme} />
        <LegalCard index={3} icon="person-add-outline" color="#EC4899" title="2. Information We Collect" content={t('privacy_collection', 'We may collect various types of information, including but not limited to:\n• Personal Identification Information (Name, Email, Phone Number)\n• Location Data (Real-time GPS coordinates)\n• Transaction Data (Earnings, Trip history)')} theme={theme} />
        <LegalCard index={4} icon="rocket-outline" color="#3B82F6" title="3. How We Use Your Information" content={t('privacy_usage', 'Your data is used to provide and improve our services, ensure safety, calculate earnings, and communicate with you regarding your account and trips.')} theme={theme} />
        <LegalCard index={5} icon="lock-closed-outline" color="#10B981" title="4. Data Security" content={t('privacy_security', 'We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction.')} theme={theme} />
        <LegalCard index={6} icon="mail-outline" color="#64748B" title="5. Contact Us" content={t('privacy_contact', 'If you have any questions about this Privacy Policy, please contact us at privacy@vdrive.com.')} theme={theme} />

        <View style={styles.controlsSection}>
            <Text style={[styles.sectionLabel, { color: theme.colors.paragraphText }]}>{t('privacy_tools', 'PRIVACY TOOLS')}</Text>
            <TouchableOpacity style={[styles.controlItem, { borderColor: theme.colors.border }]}>
                <Text style={[styles.controlText, { color: theme.colors.primary }]} numberOfLines={1} adjustsFontSizeToFit>{t('download_data', 'Download My Data')}</Text>
                <Ionicons name="download-outline" size={s(18)} color={theme.colors.primary} />
            </TouchableOpacity>
        </View>
    </Animated.View>
);

const TermsContent = ({ t, theme, isDark }: any) => (
    <Animated.View entering={FadeIn.duration(400)}>
        <Animated.View entering={FadeInDown.delay(100)} style={[styles.agreementCard, { backgroundColor: isDark ? '#1E293B' : '#ECFDF5', borderColor: '#A7F3D0' }]}>
            <View style={styles.agreementHeader}>
                <Ionicons name="document-text" size={s(20)} color="#059669" />
                <Text style={[styles.agreementTitle, { color: '#065F46' }]} numberOfLines={1} adjustsFontSizeToFit>{t('terms_summary_title', 'Agreement Summary')}</Text>
            </View>
            <Text style={[styles.agreementText, { color: '#047857' }]}>
                {t('terms_summary_desc', 'By using VDrive, you agree to follow our safety rules and maintain valid documentation.')}
            </Text>
        </Animated.View>

        <LegalCard index={2} icon="checkmark-circle-outline" color="#FACC15" title="1. Acceptance of Terms" content={t('terms_acceptance', 'By accessing or using the VDrive Driver App, you agree to comply with and be bound by these Terms and Conditions. If you do not agree, please do not use our services.')} theme={theme} />
        <LegalCard index={3} icon="shield-outline" color="#EF4444" title="2. Driver Obligations" content={t('terms_obligations', 'You agree to maintain valid documents (License, Registration, Insurance) at all times. You must follow all traffic laws and regulations while using the platform.')} theme={theme} />
        <LegalCard index={4} icon="card-outline" color="#10B981" title="3. Payment and Fees" content={t('terms_payment', 'VDrive operates on a recharge plan model. Drivers receive payments directly from users (Cash, UPI, or Wallet). No commissions are deducted from ride earnings. Wallet deductions are limited to fines and penalties only.')} theme={theme} />
        <LegalCard index={5} icon="close-circle-outline" color="#F97316" title="4. Account Termination" content={t('terms_termination', 'VDrive may suspend or terminate your account if you violate these terms, engage in fraudulent activity, or receive consistently poor ratings.')} theme={theme} />
        <LegalCard index={6} icon="create-outline" color="#6366F1" title="5. Modifications" content={t('terms_modifications', 'We reserve the right to modify these terms at any time. Continued use of the app after changes constitutes acceptance of the new terms.')} theme={theme} />

        <View style={[styles.disclaimerBox, { borderColor: theme.colors.border }]}>
            <Ionicons name="information-circle-outline" size={s(16)} color={theme.colors.paragraphText} />
            <Text style={[styles.disclaimerText, { color: theme.colors.paragraphText }]}>
                {t('terms_disclaimer', 'This is a legally binding contract between you and VDrive.')}
            </Text>
        </View>
    </Animated.View>
);

const LegalAgreementsScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const { theme, isDark } = useAppTheme();
    const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>('privacy');

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top']}>
            <AppStatusBar />
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={s(24)} color={theme.colors.text} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{t('legal_agreements', 'Legal Agreements')}</Text>
                <View style={{ width: s(24) }} />
            </View>

            <View style={styles.tabContainer}>
                <View style={[styles.tabBar, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
                    <TouchableOpacity
                        onPress={() => setActiveTab('privacy')}
                        style={[styles.tab, activeTab === 'privacy' && [styles.activeTab, { backgroundColor: theme.colors.background }]]}
                    >
                        <Text style={[styles.tabText, { color: activeTab === 'privacy' ? theme.colors.text : theme.colors.paragraphText }]} numberOfLines={1} adjustsFontSizeToFit>{t('privacy', 'Privacy')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setActiveTab('terms')}
                        style={[styles.tab, activeTab === 'terms' && [styles.activeTab, { backgroundColor: theme.colors.background }]]}
                    >
                        <Text style={[styles.tabText, { color: activeTab === 'terms' ? theme.colors.text : theme.colors.paragraphText }]} numberOfLines={1} adjustsFontSizeToFit>{t('terms', 'Terms')}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
                <Text style={[styles.lastUpdated, { color: theme.colors.paragraphText }]}>
                    {t('last_updated', 'Last Updated: Feb 2026')}
                </Text>

                {activeTab === 'privacy' ? <PrivacyContent t={t} theme={theme} isDark={isDark} /> : <TermsContent t={t} theme={theme} isDark={isDark} />}

                <View style={styles.footer} />
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
    },
    backBtn: {
        padding: s(4),
    },
    headerTitle: {
        fontSize: ms(18),
        fontWeight: '700',
    },
    tabContainer: {
        paddingHorizontal: s(20),
        marginTop: vs(8),
        marginBottom: vs(12),
    },
    tabBar: {
        flexDirection: 'row',
        padding: s(4),
        borderRadius: ms(12),
    },
    tab: {
        flex: 1,
        height: vs(36),
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: ms(8),
    },
    activeTab: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4
    },
    tabText: {
        fontSize: ms(14),
        fontWeight: '600',
    },
    container: {
        paddingHorizontal: s(20),
        paddingTop: vs(10),
        paddingBottom: vs(40),
    },
    tldrCard: {
        padding: s(16),
        borderRadius: ms(20),
        marginBottom: vs(20),
    },
    agreementCard: {
        padding: s(16),
        borderRadius: ms(20),
        marginBottom: vs(20),
        borderWidth: 1,
    },
    agreementHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: vs(8),
        gap: s(8),
    },
    agreementTitle: {
        fontSize: ms(16),
        fontWeight: '800',
    },
    agreementText: {
        fontSize: ms(13),
        lineHeight: ms(18),
        fontWeight: '500',
    },
    tldrTitle: {
        fontSize: ms(16),
        fontWeight: '800',
        marginBottom: vs(12),
    },
    highlightRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: vs(10),
        gap: s(12),
    },
    highlightIcon: {
        width: s(28),
        height: s(28),
        borderRadius: s(14),
        alignItems: 'center',
        justifyContent: 'center',
    },
    highlightText: {
        fontSize: ms(13),
        fontWeight: '500',
        flex: 1,
    },
    lastUpdated: {
        fontSize: ms(13),
        marginBottom: vs(20),
        fontStyle: 'italic',
        opacity: 0.7,
        marginLeft: s(4),
    },
    legalCard: {
        padding: s(16),
        borderRadius: ms(20),
        marginBottom: vs(16),
        borderWidth: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: vs(12),
        gap: s(12),
    },
    cardIconBox: {
        width: s(40),
        height: s(40),
        borderRadius: ms(12),
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitle: {
        fontSize: ms(16),
        fontWeight: '700',
    },
    cardParagraph: {
        fontSize: ms(14),
        lineHeight: ms(22),
    },
    controlsSection: {
        marginTop: vs(8),
        marginBottom: vs(24),
    },
    sectionLabel: {
        fontSize: ms(12),
        fontWeight: '800',
        marginBottom: vs(12),
        letterSpacing: 1.2,
        opacity: 0.6,
        marginLeft: s(4),
    },
    controlItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: s(16),
        borderRadius: ms(16),
        borderWidth: 1,
        marginBottom: vs(10),
    },
    controlText: {
        fontSize: ms(14),
        fontWeight: '600',
    },
    disclaimerBox: {
        flexDirection: 'row',
        padding: s(16),
        borderRadius: ms(16),
        borderWidth: 1,
        borderStyle: 'dashed',
        marginTop: vs(8),
        gap: s(10),
        alignItems: 'center',
    },
    disclaimerText: {
        fontSize: ms(12),
        flex: 1,
        lineHeight: ms(16),
        opacity: 0.8,
    },
    footer: {
        height: vs(40),
    },
});

export default LegalAgreementsScreen;
