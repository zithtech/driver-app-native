import React from 'react';
import { View, ScrollView, StyleSheet, Animated, Pressable } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { hS as s, vS as vs, ms } from '../../../lib/scale';
import { Text } from '../../../Components';
import { useAppTheme } from '../../../context/ThemeContext';
import { getLanguageScaledSize } from '../../../utils/languageSizings';

interface TodayOverviewProps {
    earnings: string;
    rides: number;
    displayTimeFormatted: string;
    distance: number;
    cancellations: number;
    timerPulseAnim: Animated.Value;
    onEarningsPress?: () => void;
    onRidesPress?: () => void;
}

const TodayOverview: React.FC<TodayOverviewProps> = ({
    earnings,
    rides,
    displayTimeFormatted,
    distance,
    cancellations,
    timerPulseAnim,
    onEarningsPress,
    onRidesPress,
}) => {
    const { theme, isDark } = useAppTheme();
    const { t } = useTranslation();

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.todayScrollContent}
            decelerationRate="fast"
        >
            <Pressable style={[styles.todayCard, { backgroundColor: theme.colors.card, borderColor: isDark ? '#374151' : '#F3F4F6' }]} onPress={onEarningsPress}>
                <View style={[styles.todayIcon, { backgroundColor: isDark ? '#064e3b' : '#DCFCE7' }]}>
                    <Ionicons name="cash-outline" size={ms(20)} color={isDark ? '#34D399' : '#16A34A'} />
                </View>
                <View style={styles.todayTextWrap}>
                    <Text style={[styles.todayValue, { color: isDark ? '#FFFFFF' : '#1E293B' }]} adjustsFontSizeToFit numberOfLines={1}>
                        {t('currency_symbol')}
                        {earnings}
                    </Text>
                    <Text style={[styles.todayLabel, isDark && { color: '#94A3B8' }]} numberOfLines={2} adjustsFontSizeToFit>{t('earnings')}</Text>
                </View>
            </Pressable>

            {/* Rides */}
            <Pressable style={[styles.todayCard, { backgroundColor: theme.colors.card, borderColor: isDark ? '#374151' : '#F3F4F6' }]} onPress={onRidesPress}>
                <View style={[styles.todayIcon, { backgroundColor: isDark ? '#1e3a8a' : '#DBEAFE' }]}>
                    <Ionicons name="car-outline" size={ms(20)} color={isDark ? '#60A5FA' : '#2563EB'} />
                </View>
                <View style={styles.todayTextWrap}>
                    <Text style={[styles.todayValue, { color: isDark ? '#FFFFFF' : '#1E293B' }]} adjustsFontSizeToFit numberOfLines={1}>{rides}</Text>
                    <Text style={[styles.todayLabel, isDark && { color: '#94A3B8' }]} numberOfLines={2} adjustsFontSizeToFit>{t('rides')}</Text>
                </View>
            </Pressable>

            {/* Online */}
            <View style={[styles.todayCard, { backgroundColor: theme.colors.card, borderColor: isDark ? '#374151' : '#F3F4F6' }]}>
                <View style={[styles.todayIcon, { backgroundColor: isDark ? '#4c1d95' : '#EDE9FE' }]}>
                    <Ionicons name="time-outline" size={ms(20)} color={isDark ? '#A78BFA' : '#7C3AED'} />
                </View>
                <View style={styles.todayTextWrap}>
                    <Animated.Text style={[styles.todayValue, { transform: [{ scale: timerPulseAnim }], color: isDark ? '#FFFFFF' : '#1E293B' }]} adjustsFontSizeToFit numberOfLines={1}>
                        {displayTimeFormatted}
                    </Animated.Text>
                    <Text style={[styles.todayLabel, isDark && { color: '#94A3B8' }]} numberOfLines={2} adjustsFontSizeToFit>{t('online')}</Text>
                </View>
            </View>

            {/* Distance */}
            <View style={[styles.todayCard, { backgroundColor: theme.colors.card, borderColor: isDark ? '#374151' : '#F3F4F6' }]}>
                <View style={[styles.todayIcon, { backgroundColor: isDark ? '#78350f' : '#FEF3C7' }]}>
                    <Ionicons name="map-outline" size={ms(20)} color={isDark ? '#FBBF24' : '#D97706'} />
                </View>
                <View style={styles.todayTextWrap}>
                    <Text style={[styles.todayValue, { color: isDark ? '#FFFFFF' : '#1E293B' }]} adjustsFontSizeToFit numberOfLines={1}>
                        {distance}
                        {t('km')}
                    </Text>
                    <Text style={[styles.todayLabel, isDark && { color: '#94A3B8' }]} numberOfLines={2} adjustsFontSizeToFit>{t('distance')}</Text>
                </View>
            </View>

            {/* Cancellations */}
            <View style={[styles.todayCard, { backgroundColor: theme.colors.card, borderColor: isDark ? '#374151' : '#F3F4F6' }]}>
                <View style={[styles.todayIcon, { backgroundColor: isDark ? '#7f1d1d' : '#FEE2E2' }]}>
                    <Ionicons name="close-circle-outline" size={ms(20)} color={isDark ? '#F87171' : '#DC2626'} />
                </View>
                <View style={styles.todayTextWrap}>
                    <Text style={[styles.todayValue, { color: isDark ? '#FFFFFF' : '#1E293B' }]} adjustsFontSizeToFit numberOfLines={1}>{cancellations}</Text>
                    <Text style={[styles.todayLabel, isDark && { color: '#94A3B8' }]} numberOfLines={2} adjustsFontSizeToFit>{t('cancellations')}</Text>
                </View>
            </View>
        </ScrollView>
    );
};

export default TodayOverview;

const styles = StyleSheet.create({
    todayScrollContent: {
        paddingHorizontal: s(16),
        paddingBottom: vs(10),
        marginTop: vs(10),
    },
    todayCard: {
        minWidth: s(150),
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: ms(16),
        paddingVertical: vs(14),
        paddingHorizontal: s(12),
        marginRight: s(12),
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    todayIcon: {
        width: s(36),
        height: s(36),
        borderRadius: ms(18),
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: s(10),
    },
    todayTextWrap: {
        justifyContent: 'center',
        flex: 1,
    },
    todayValue: {
        fontSize: getLanguageScaledSize(14),
        fontWeight: '800',
        color: '#1E293B',
        lineHeight: vs(20),
    },
    todayLabel: {
        fontSize: getLanguageScaledSize(12),
        color: '#64748B',
        marginTop: vs(1),
        fontWeight: '500',
    },
});
