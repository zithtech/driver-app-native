import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    interpolate,
    Extrapolate
} from 'react-native-reanimated';
import { hS as s, vS as vs, ms } from '../../../lib/scale';
import { Text } from '../../../Components';
import { useAppTheme } from '../../../context/ThemeContext';
import { getLanguageScaledSize } from '../../../utils/languageSizings';
import { Ride } from '../../../redux/rideSlice';

interface WalletUpcomingCardsProps {
    balance?: number | string;
    upcomingRide?: Ride | null;
}

const WalletUpcomingCards: React.FC<WalletUpcomingCardsProps> = ({ balance, upcomingRide }) => {
    const { theme, isDark } = useAppTheme();
    const { t } = useTranslation();
    const navigation = useNavigation<NavigationProp<any>>();
    const pulse = useSharedValue(0);
    const [currentTime, setCurrentTime] = useState(Date.now());

    useEffect(() => {
        pulse.value = withRepeat(
            withTiming(1, { duration: 2000 }),
            -1,
            false
        );
    }, []);

    const animatedPulseStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 2.5], Extrapolate.CLAMP) }],
            opacity: interpolate(pulse.value, [0, 1], [0.4, 0], Extrapolate.CLAMP),
        };
    });

    useEffect(() => {
        if (!upcomingRide) { return; }
        const timer = setInterval(() => {
            setCurrentTime(Date.now());
        }, 30000); // Update every 30 seconds
        return () => clearInterval(timer);
    }, [upcomingRide]);

    const getCountdownText = (startTime: number) => {
        const diff = startTime - currentTime;
        if (diff <= 0) { return { text: t('starting_now'), isUrgent: true, isDays: false }; }

        const totalMinutes = Math.floor(diff / (1000 * 60));
        if (totalMinutes <= 0) {
            return { text: t('starting_now'), isUrgent: true, isDays: false };
        }
        if (totalMinutes < 60) {
            return { text: t('starts_in_m', { count: totalMinutes }), isUrgent: totalMinutes < 30, isDays: false };
        }

        const hours = Math.floor(totalMinutes / 60);
        if (hours < 24) {
            return { text: t('starts_in_hm', { hours, minutes: totalMinutes % 60 }), isUrgent: false, isDays: false };
        }

        const days = Math.floor(hours / 24);
        return { text: t('days_left', { count: days }), isUrgent: false, isDays: true };
    };

    const rideTime = upcomingRide ? (upcomingRide.startTime || new Date(upcomingRide.scheduled_start_time).getTime()) : 0;
    const { text: countdownText, isUrgent, isDays } = upcomingRide ? getCountdownText(rideTime) : { text: '', isUrgent: false, isDays: false };

    return (
        <View style={styles.container}>
            {/* Wallet Card */}
            <Pressable
                style={[styles.card, styles.walletCard, isDark && { backgroundColor: '#1E3A8A', borderColor: '#1E40AF' }]}
                onPress={() => navigation.navigate('WalletScreen')}
            >
                <View style={styles.cardHeader}>
                    <View style={[styles.walletIcon, isDark && { backgroundColor: '#3B82F6' }]}>
                        <Ionicons name="wallet-outline" size={ms(18)} color={isDark ? '#FFFFFF' : '#2563EB'} />
                    </View>
                    <Text style={[styles.cardTitle, { color: isDark ? '#DBEAFE' : '#1E40AF' }]} numberOfLines={2} adjustsFontSizeToFit>{t('wallet_balance')}</Text>
                </View>
                <Text style={[styles.walletAmount, { color: isDark ? '#FFFFFF' : '#1E3A8A' }]} numberOfLines={1} adjustsFontSizeToFit>₹{balance || '0'}</Text>
                <View style={styles.linkRow}>
                    <Text style={[styles.linkText, isDark && { color: '#60A5FA' }]}>{t('add_money')}</Text>
                    <Ionicons name="arrow-forward" size={ms(14)} color={isDark ? '#60A5FA' : '#2563EB'} style={{ marginLeft: s(4) }} />
                </View>
            </Pressable>

            {/* Upcoming Ride Card */}
            <Pressable
                style={[styles.card, styles.upcomingCard, { backgroundColor: theme.colors.card, borderColor: isDark ? theme.colors.border : '#F1F5F9' }]}
                onPress={() => navigation.navigate('Requests', { initialTab: 'upcoming' })}
            >
                <View style={styles.cardHeader}>
                    <Text style={[styles.cardTitle, { color: theme.colors.text }]} numberOfLines={2} adjustsFontSizeToFit>
                        {upcomingRide ? t('next_ride') : t('upcoming_ride')}
                    </Text>
                    <View style={styles.dotContainer}>
                        <Animated.View style={[styles.statusDot, styles.pulseRing, animatedPulseStyle, { backgroundColor: upcomingRide ? '#22C55E' : '#EF4444' }]} />
                        <View style={[styles.statusDot, { backgroundColor: upcomingRide ? '#22C55E' : '#EF4444' }]} />
                    </View>
                </View>

                <View style={styles.upcomingContent}>
                    {upcomingRide ? (
                        <>
                            <Ionicons
                                name="timer-outline"
                                size={ms(24)}
                                color={isUrgent ? '#F97316' : (isDark ? theme.colors.text : theme.colors.primary)}
                            />
                            <Text style={[
                                styles.countdownText,
                                { color: isUrgent ? '#F97316' : (isDays ? '#22C55E' : theme.colors.text) }
                            ]}>
                                {countdownText}
                            </Text>
                            <Text style={[styles.upcomingSubText, { color: isDark ? theme.colors.textMuted : '#64748B' }]} numberOfLines={1}>
                                {new Date(rideTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </>
                    ) : (
                        <View style={styles.noUpcomingWrap}>
                            <Ionicons name="calendar-outline" size={ms(24)} color={isDark ? theme.colors.textMuted : '#94A3B8'} />
                            <Text style={[styles.upcomingText, isDark && { color: theme.colors.textMuted }]} numberOfLines={2} adjustsFontSizeToFit>{t('no_upcoming_rides')}</Text>
                        </View>
                    )}
                </View>
            </Pressable>
        </View>
    );
};

export default WalletUpcomingCards;

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        paddingHorizontal: s(16),
        marginTop: vs(12),
        justifyContent: 'space-between',
    },
    card: {
        width: '48.5%',
        borderRadius: ms(20),
        padding: ms(16),
        minHeight: vs(135),
        justifyContent: 'space-between',
    },
    walletCard: {
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#DBEAFE',
    },
    upcomingCard: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOpacity: 0.02,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 }
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    walletIcon: {
        width: s(32),
        height: s(32),
        borderRadius: ms(10),
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: s(8),
    },
    cardTitle: {
        fontSize: getLanguageScaledSize(13),
        fontWeight: '700',
        color: '#1E293B',
        flex: 1,
    },
    walletAmount: {
        fontSize: getLanguageScaledSize(22),
        fontWeight: '800',
        color: '#1E3A8A',
        marginTop: vs(8),
    },
    linkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: vs(4),
    },
    linkText: {
        fontSize: ms(12),
        fontWeight: '600',
        color: '#2563EB',
    },
    dotContainer: {
        width: s(12),
        height: s(12),
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusDot: {
        width: s(6),
        height: s(6),
        borderRadius: ms(3),
    },
    pulseRing: {
        position: 'absolute',
    },
    upcomingContent: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    noUpcomingWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        width: '100%',
    },
    upcomingText: {
        fontSize: ms(11),
        color: '#94A3B8',
        marginTop: vs(6),
        textAlign: 'center',
    },
    countdownText: {
        fontSize: getLanguageScaledSize(16),
        fontWeight: '800',
        marginTop: vs(4),
        textAlign: 'center',
    },
    upcomingSubText: {
        fontSize: getLanguageScaledSize(20),
        fontWeight: '800',
        marginTop: vs(4),
        textAlign: 'center',
    },
});
