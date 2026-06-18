import React from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAppTheme } from '../../../context/ThemeContext';
import { Text } from '../../../Components';
import AppStatusBar from '../../../Components/AppStatusBar';
import { hS as s, vS as vs, ms } from '../../../lib/scale';

const AboutAppScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const { theme } = useAppTheme();

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top']}>
            <AppStatusBar />
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={s(24)} color={theme.colors.text} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{t('about_app', 'About App')}</Text>
                <View style={{ width: s(24) }} />
            </View>

            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
                <Animated.View entering={FadeInUp.duration(600)} style={styles.logoSection}>
                    <View style={[styles.logoBox, { backgroundColor: theme.colors.primary }]}>
                        <Ionicons name="car-sport" size={s(50)} color="#FFFFFF" />
                    </View>
                    <Text style={[styles.appName, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{t('app_name', 'VDrive')}</Text>
                    <Text style={[styles.version, { color: theme.colors.paragraphText }]} numberOfLines={1} adjustsFontSizeToFit>{t('version', 'Version')} 1.0.4 (Production)</Text>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.contentSection}>
                    <Text style={[styles.description, { color: theme.colors.paragraphText }]}>
                        {t('vdrive_desc', 'VDrive is a premium, tech-driven mobility platform designed specifically for professional drivers. We are committed to maximizing your earnings while ensuring safety and reliability through every mile.')}
                    </Text>

                    <View style={[styles.infoCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                        <View style={styles.infoRow}>
                            <Text style={[styles.infoLabel, { color: theme.colors.paragraphText }]}>{t('company', 'Company')}</Text>
                            <Text style={[styles.infoValue, { color: theme.colors.text }]}>VDrive Mobility Inc.</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.infoRow}>
                            <Text style={[styles.infoLabel, { color: theme.colors.paragraphText }]}>{t('released', 'Released')}</Text>
                            <Text style={[styles.infoValue, { color: theme.colors.text }]}>Jan 2026</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.infoRow}>
                            <Text style={[styles.infoLabel, { color: theme.colors.paragraphText }]}>{t('license', 'License')}</Text>
                            <Text style={[styles.infoValue, { color: theme.colors.text }]}>Commercial Use</Text>
                        </View>
                    </View>
                </Animated.View>

                <View style={styles.footer}>
                    <Text style={[styles.copyright, { color: theme.colors.paragraphText }]}>
                        {t('copyright', '© 2026 VDrive Mobility Inc.')}
                    </Text>
                    <Text style={[styles.madeWith, { color: theme.colors.paragraphText }]}>
                        {t('made_with_heart', 'Made with ❤️ for drivers worldwide')}
                    </Text>
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
    },
    backBtn: {
        padding: s(4),
    },
    headerTitle: {
        fontSize: ms(18),
        fontWeight: '700',
    },
    container: {
        padding: s(24),
        alignItems: 'center',
    },
    logoSection: {
        alignItems: 'center',
        marginTop: vs(40),
        marginBottom: vs(40),
    },
    logoBox: {
        width: s(100),
        height: s(100),
        borderRadius: ms(30),
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: vs(20),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
        elevation: 10,
    },
    appName: {
        fontSize: ms(32),
        fontWeight: '900',
        letterSpacing: -1,
    },
    version: {
        fontSize: ms(14),
        fontWeight: '500',
        opacity: 0.6,
        marginTop: vs(4),
    },
    contentSection: {
        width: '100%',
    },
    description: {
        fontSize: ms(15),
        lineHeight: ms(24),
        textAlign: 'center',
        marginBottom: vs(40),
        opacity: 0.8,
    },
    infoCard: {
        width: '100%',
        borderRadius: ms(24),
        padding: s(20),
        borderWidth: 1,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: vs(12),
    },
    infoLabel: {
        fontSize: ms(14),
        fontWeight: '500',
    },
    infoValue: {
        fontSize: ms(14),
        fontWeight: '700',
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    footer: {
        marginTop: vs(60),
        alignItems: 'center',
        paddingBottom: vs(20),
    },
    copyright: {
        fontSize: ms(13),
        fontWeight: '600',
        opacity: 0.5,
    },
    madeWith: {
        fontSize: ms(11),
        marginTop: vs(4),
        opacity: 0.4,
    },
});

export default AboutAppScreen;
