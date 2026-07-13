import React, { useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../redux/store';
import { useTriggerSosMutation } from '../../../service/driverApi';
import {
    View,
    StyleSheet,
    Pressable,
    Linking,
    ScrollView,
    TouchableOpacity,
    Share,
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import { useTheme } from '@react-navigation/native';
import { useAlert } from '../../../context/AlertContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    FadeInDown,
} from 'react-native-reanimated';
import { useAppTheme } from '../../../context/ThemeContext';
import { Text } from '../../../Components';
import AppStatusBar from '../../../Components/AppStatusBar';
import { hS as s, vS as vs, ms } from '../../../lib/scale';

const EmergencyCard = ({ title, sub, icon, color, number, index, theme, handleCall }: any) => (
    <Animated.View entering={FadeInDown.delay(index * 150)}>
        <TouchableOpacity
            style={[styles.listItem, { borderBottomColor: theme.colors.border }]}
            onPress={() => handleCall(number)}
            activeOpacity={0.7}
        >
            <View style={styles.minimalIconBox}>
                <Ionicons name={icon} size={s(22)} color={color} />
            </View>
            <View style={styles.cardInfo}>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{title}</Text>
                <Text style={styles.cardSub}>{sub}</Text>
            </View>
            <Ionicons name="call-outline" size={s(20)} color={theme.colors.text} style={{ opacity: 0.4 }} />
        </TouchableOpacity>
    </Animated.View>
);

const EmergencySupportScreen: React.FC = ({ navigation }: any) => { // Kept navigation for goBack()
  const { colors } = useTheme();
  const { showAlert } = useAlert();
  const { t } = useTranslation();
    const { theme, isDark } = useAppTheme();
    const [triggerSosApi] = useTriggerSosMutation();
    const currentRideId = useSelector((state: RootState) => state.ride?.myAcceptedRideId || state.ride?.currentRide?.trip_id);

    // ── SOS TRIGGER HANDLER ──
    const handleSosTrigger = useCallback(() => {
        showAlert({
            title: t('sos'),
            message: t('sos_message') || 'Are you in an emergency? This will notify our security team immediately.',
            icon: 'alert-circle',
            onConfirm: async () => {
                try {
                    await triggerSosApi({ trip_id: currentRideId?.toString() }).unwrap();
                    showAlert({
                        title: t('sos_triggered'),
                        message: t('sos_triggered_msg') || 'Emergency signal sent. Help is on the way.',
                        singleButton: true,
                        icon: 'checkmark-circle-outline',
                        onConfirm: () => Linking.openURL('tel:112')
                    });
                } catch (error) {
                    Linking.openURL('tel:112'); // Final safety mechanism
                }
            }
        });
    }, [currentRideId, showAlert, t, triggerSosApi]);

    // ── ANIMATION VALUES ──
    const pulseScale = useSharedValue(1);
    const pulseOpacity = useSharedValue(0.2);

    useEffect(() => {
        pulseScale.value = withRepeat(
            withTiming(1.2, { duration: 1500 }),
            -1,
            true
        );
        pulseOpacity.value = withRepeat(
            withTiming(0.1, { duration: 1500 }),
            -1,
            true
        );
    }, [pulseOpacity, pulseScale]);

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }],
        opacity: pulseOpacity.value,
    }));

    // ── HANDLERS ──
    const handleCall = (number: string) => {
        Linking.openURL(`tel:${number}`);
    };

    const handleShareLocation = async () => {
        Geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                const mapLink = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
                const message = `${t('emergency_location_msg')}\n\n${mapLink}`;
                try {
                    await Share.share({ message });
                } catch (error) {
                    showAlert({
                        title: t('sos_triggered'),
                        message: t('emergency_services_notified'),
                        singleButton: true,
                        icon: 'shield-checkmark-outline',
                    });
                }
            },
            (error) => {
                console.log(error.code, error.message);
                showAlert({
                    title: 'Location Error',
                    message: 'Unable to fetch your current location.',
                    singleButton: true,
                    icon: 'alert-circle',
                });
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top']}>
            <AppStatusBar />
            {/* Header - No Border Consistent with Help Center */}
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={s(24)} color={theme.colors.text} />
                </Pressable>
                <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit>{t('emergency_support')}</Text>
                <View style={{ width: s(24) }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                {/* SOS STATUS SECTION */}
                <TouchableOpacity 
                    style={styles.sosContainer}
                    onPress={handleSosTrigger}
                    activeOpacity={0.8}
                >
                    <View style={styles.pulseWrapper}>
                        <Animated.View style={[styles.pulseCircle, pulseStyle]} />
                        <View style={styles.mainSOSIcon}>
                            <Ionicons name="shield-checkmark" size={s(44)} color="#DC2626" />
                        </View>
                    </View>
                    <Text style={styles.sosTitle} numberOfLines={1} adjustsFontSizeToFit>{t('emergency_help_title')}</Text>
                    <Text style={styles.sosDesc}>
                        {t('emergency_help_desc')}
                    </Text>
                </TouchableOpacity>

                {/* MAIN ACTIONS */}
                <View style={styles.actionSection}>
                    <EmergencyCard
                        index={0}
                        title={t('call_police')}
                        sub="112"
                        icon="shield-outline"
                        color="#DC2626"
                        number="112"
                        theme={theme}
                        handleCall={handleCall}
                    />
                    <EmergencyCard
                        index={1}
                        title={t('call_ambulance')}
                        sub="108"
                        icon="medical-outline"
                        color="#EA580C"
                        number="108"
                        theme={theme}
                        handleCall={handleCall}
                    />
                    <EmergencyCard
                        index={2}
                        title={t('traffic_police')}
                        sub="103"
                        icon="car-outline"
                        color="#059669"
                        number="103"
                        theme={theme}
                        handleCall={handleCall}
                    />
                    <EmergencyCard
                        index={3}
                        title={t('driver_helpline')}
                        sub="1800-123-456"
                        icon="headset-outline"
                        color="#2563EB"
                        number="1800123456"
                        theme={theme}
                        handleCall={handleCall}
                    />
                </View>

                {/* SAFETY FEATURES */}
                <View style={styles.safetyFeatures}>
                    <Text style={styles.sectionLabel} numberOfLines={1} adjustsFontSizeToFit>{t('safety_tools')}</Text>
                    <TouchableOpacity
                        style={[styles.featureListItem, { borderBottomColor: theme.colors.border }]}
                        onPress={handleShareLocation}
                    >
                        <View style={styles.featureLeft}>
                            <View style={styles.minimalIconBox}>
                                <Ionicons name="location-outline" size={s(22)} color="#0369A1" />
                            </View>
                            <View>
                                <Text style={styles.featureTitle} numberOfLines={1} adjustsFontSizeToFit>{t('share_location')}</Text>
                                <Text style={styles.featureSub}>{t('share_loc_desc')}</Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={s(20)} color={theme.colors.text} style={{ opacity: 0.4 }} />
                    </TouchableOpacity>

                    <View style={styles.tipsSection}>
                        <Text style={[styles.tipsTitle, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>💡 {t('safety_tips')}</Text>
                        <View style={styles.tipRow}>
                            <Ionicons name="checkmark-circle" size={s(16)} color="#10B981" />
                            <Text style={styles.tipText}>{t('safety_tip_1')}</Text>
                        </View>
                        <View style={styles.tipRow}>
                            <Ionicons name="checkmark-circle" size={s(16)} color="#10B981" />
                            <Text style={styles.tipText}>{t('safety_tip_2')}</Text>
                        </View>
                        <View style={styles.tipRow}>
                            <Ionicons name="checkmark-circle" size={s(16)} color="#10B981" />
                            <Text style={styles.tipText}>{t('safety_tip_3')}</Text>
                        </View>
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
        fontWeight: '700',
    },
    scrollContainer: {
        paddingBottom: vs(40),
    },
    sosContainer: {
        alignItems: 'center',
        paddingVertical: vs(30),
        paddingHorizontal: s(24),
    },
    pulseWrapper: {
        width: s(120),
        height: s(120),
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: vs(20),
    },
    pulseCircle: {
        position: 'absolute',
        width: s(110),
        height: s(110),
        borderRadius: s(55),
        backgroundColor: '#DC2626',
    },
    mainSOSIcon: {
        width: s(90),
        height: s(90),
        borderRadius: s(45),
        backgroundColor: '#FFF1F2',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FECACA',
    },
    sosTitle: {
        fontSize: ms(22),
        fontWeight: '800',
        color: '#1E293B',
        marginBottom: vs(8),
    },
    sosDesc: {
        fontSize: ms(14),
        color: '#64748B',
        textAlign: 'center',
        lineHeight: ms(20),
    },
    actionSection: {
        paddingHorizontal: s(20),
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: vs(16),
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    minimalIconBox: {
        width: s(40),
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    cardInfo: {
        flex: 1,
    },
    cardTitle: {
        fontSize: ms(15),
        fontWeight: '600',
        marginBottom: vs(2),
    },
    cardSub: {
        fontSize: ms(13),
        color: '#64748B',
    },
    safetyFeatures: {
        paddingHorizontal: s(20),
        marginTop: vs(16),
    },
    sectionLabel: {
        fontSize: ms(12),
        fontWeight: '700',
        color: '#94A3B8',
        marginBottom: vs(4),
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    featureListItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: vs(16),
        borderBottomWidth: StyleSheet.hairlineWidth,
        marginBottom: vs(16),
    },
    featureLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    featureTitle: {
        fontSize: ms(15),
        fontWeight: '600',
        color: '#0369A1',
        marginBottom: vs(2),
    },
    featureSub: {
        fontSize: ms(13),
        color: '#64748B',
    },
    tipsSection: {
        marginTop: vs(8),
        paddingVertical: vs(12),
    },
    tipsTitle: {
        fontSize: ms(16),
        fontWeight: '700',
        marginBottom: vs(16),
    },
    tipRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: vs(12),
        gap: s(12),
    },
    tipText: {
        fontSize: ms(14),
        color: '#64748B',
        flex: 1,
        lineHeight: ms(20),
    },
});

export default EmergencySupportScreen;
