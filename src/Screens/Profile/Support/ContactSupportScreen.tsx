import React from 'react';
import { View, StyleSheet, Pressable, Linking, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import { useAlert } from '../../../context/AlertContext';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAppTheme } from '../../../context/ThemeContext';
import { Text } from '../../../Components';
import AppStatusBar from '../../../Components/AppStatusBar';
import { hS as s, vS as vs, ms } from '../../../lib/scale';

const ContactCard = ({ icon, title, subtitle, color, onPress, index, theme }: any) => (
    <Animated.View entering={FadeInDown.delay(index * 100).duration(500)}>
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={onPress}
            style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
        >
            <View style={[styles.iconBox, { backgroundColor: color + '15' }]}>
                <Ionicons name={icon} size={s(24)} color={color} />
            </View>
            <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{title}</Text>
                <Text style={[styles.cardSubtitle, { color: theme.colors.paragraphText }]}>{subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={s(20)} color={theme.colors.border} />
        </TouchableOpacity>
    </Animated.View>
);

const ContactSupportScreen: React.FC = ({ navigation }: any) => {
    const { colors } = useTheme();
    const { showAlert } = useAlert();
    const { t } = useTranslation();
    const { theme } = useAppTheme();
    // const insets = useSafeAreaInsets();

    const handleCall = () => {
        Linking.openURL('tel:+919043522612');
    };

    const handleEmail = async () => {
        const email = 'support@vdrive.com';
        const subject = t('support_email_subject', 'Support Request: Driver App');
        const body = 'Please describe your issue here...';
        const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

        const supported = await Linking.canOpenURL(url);
        if (supported) {
            await Linking.openURL(url);
        } else {
            showAlert({
                title: t('error', 'Error'),
                message: t('support_mail_error', 'Could not open email app'),
                singleButton: true,
                icon: 'close-circle-outline',
            });
        }
    };

    const handleWhatsApp = () => {
        Linking.openURL('whatsapp://send?phone=919043522612&text=Hi, I need help with...');
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top']}>
            <AppStatusBar />
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={s(24)} color={theme.colors.text} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{t('contact_support')}</Text>
                <View style={{ width: s(24) }} />
            </View>

            <View style={styles.container}>
                <Animated.View entering={FadeInUp.duration(600)}>
                    <Text style={[styles.heroText, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                        {t('get_in_touch', 'Get in Touch')}
                    </Text>
                    <Text style={[styles.description, { color: theme.colors.paragraphText }]}>
                        {t('support_desc', "Our support team is available 24/7 to assist you with any issues.")}
                    </Text>
                </Animated.View>

                <View style={styles.cardContainer}>
                    <ContactCard
                        index={1}
                        icon="call-outline"
                        title={t('call_support', 'Call Support')}
                        subtitle="+91 90435 22612"
                        color="#2563EB"
                        onPress={handleCall}
                        theme={theme}
                    />
                    <ContactCard
                        index={2}
                        icon="mail-outline"
                        title={t('email_support', 'Email Support')}
                        subtitle="support@vdrive.com"
                        color="#DC2626"
                        onPress={handleEmail}
                        theme={theme}
                    />
                    <ContactCard
                        index={3}
                        icon="logo-whatsapp"
                        title={t('whatsapp_support', 'WhatsApp Support')}
                        subtitle="+91 90435 22612"
                        color="#16A34A"
                        onPress={handleWhatsApp}
                        theme={theme}
                    />
                </View>

                <View style={styles.footer}>
                    <Text style={[styles.footerText, { color: theme.colors.paragraphText }]} numberOfLines={1} adjustsFontSizeToFit>
                        {t('average_response', 'Average response time: < 30 mins')}
                    </Text>
                </View>
            </View>
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
        flex: 1,
        padding: s(24),
    },
    heroText: {
        fontSize: ms(28),
        fontWeight: '800',
        marginBottom: vs(8),
    },
    description: {
        fontSize: ms(15),
        lineHeight: ms(22),
        marginBottom: vs(32),
        opacity: 0.8,
    },
    cardContainer: {
        gap: vs(16),
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: s(16),
        borderRadius: ms(20),
        borderWidth: 1,
    },
    iconBox: {
        width: s(52),
        height: s(52),
        borderRadius: ms(16),
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: s(16),
    },
    cardContent: {
        flex: 1,
    },
    cardTitle: {
        fontSize: ms(16),
        fontWeight: '700',
        marginBottom: vs(2),
    },
    cardSubtitle: {
        fontSize: ms(14),
        opacity: 0.7,
    },
    footer: {
        position: 'absolute',
        bottom: vs(40),
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    footerText: {
        fontSize: ms(12),
        fontWeight: '500',
        opacity: 0.6,
    },
});

export default ContactSupportScreen;
