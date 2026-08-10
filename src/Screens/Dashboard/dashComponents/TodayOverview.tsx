import React from 'react';
import { View, StyleSheet, Animated, Pressable } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { hS as s, vS as vs, ms } from '../../../lib/scale';
import { Text } from '../../../Components';
import LinearGradient from 'react-native-linear-gradient';

interface TodayOverviewProps {
    earnings: string;
    rides: number;
    displayTimeFormatted: string;
    rating: string | number; 
    timerPulseAnim: Animated.Value;
    onEarningsPress?: () => void;
    onRidesPress?: () => void;
    onViewAllPress?: () => void;
    earningsTrend?: number;
    ridesTrend?: number;
    onlineTrend?: number;
    ratingTrend?: number;
}

const TodayOverview: React.FC<TodayOverviewProps> = ({
    earnings,
    rides,
    displayTimeFormatted,
    rating,
    timerPulseAnim,
    onEarningsPress,
    onRidesPress,
    onViewAllPress,
    earningsTrend,
    ridesTrend,
    onlineTrend,
    ratingTrend,
}) => {
    const { t } = useTranslation();

    const renderTrend = (trendValue?: number) => {
        if (trendValue === undefined || trendValue === null) return null;
        const isPositive = trendValue > 0;
        const isNegative = trendValue < 0;
        const iconName = isNegative ? "caret-down" : (isPositive ? "caret-up" : "remove");
        const color = isNegative ? "#EF4444" : (isPositive ? "#4ADE80" : "#94A3B8");
        return (
            <View style={styles.trendWrap}>
                <Ionicons name={iconName} size={ms(10)} color={color} />
                <Text style={[styles.trendText, { color }]}>{Math.abs(trendValue)}%</Text>
            </View>
        );
    };

    return (
        <LinearGradient 
            colors={['#3B82F6', '#2563EB']} 
            style={styles.container}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
        >
            <View style={styles.headerRow}>
                <View style={styles.titleWrap}>
                    <Text style={styles.titleText}>{t('todays_overview', "Today's Overview")}</Text>
                    <Ionicons name="eye-outline" size={ms(14)} color="#FFFFFF" style={{ marginLeft: s(6) }} />
                </View>
                <View style={styles.dateWrap}>
                    <Ionicons name="calendar-outline" size={ms(14)} color="#FFFFFF" />
                    <Text style={styles.dateText}>
                        {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                </View>
            </View>

            {/* Metrics Row */}
            <View style={styles.metricsRow}>
                {/* Earnings */}
                <Pressable style={styles.metricCol} onPress={onEarningsPress}>
                    <View style={styles.iconCircle}>
                        <Text style={{color: '#fff', fontSize: ms(14), fontWeight: '600'}}>₹</Text>
                    </View>
                    <Text style={styles.metricLabel}>{t('earnings', 'Earnings')}</Text>
                    <Text style={styles.metricValue}>₹{earnings}</Text>
                    {renderTrend(earningsTrend)}
                </Pressable>

                <View style={styles.divider} />

                {/* Rides */}
                <Pressable style={styles.metricCol} onPress={onRidesPress}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="car-outline" size={ms(14)} color="#FFFFFF" />
                    </View>
                    <Text style={styles.metricLabel}>{t('rides', 'Rides')}</Text>
                    <Text style={styles.metricValue}>{rides}</Text>
                    {renderTrend(ridesTrend)}
                </Pressable>

                <View style={styles.divider} />

                {/* Online Hours */}
                <View style={styles.metricCol}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="time-outline" size={ms(14)} color="#FFFFFF" />
                    </View>
                    <Text style={styles.metricLabel}>{t('online_hours', 'Online Hours')}</Text>
                    <Animated.Text style={[styles.metricValue, { transform: [{ scale: timerPulseAnim }] }]}>
                        {displayTimeFormatted}
                    </Animated.Text>
                    {renderTrend(onlineTrend)}
                </View>

                <View style={styles.divider} />

                {/* Rating */}
                <View style={styles.metricCol}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="star-outline" size={ms(14)} color="#FBBF24" />
                    </View>
                    <Text style={styles.metricLabel}>{t('rating', 'Rating')}</Text>
                    <Text style={styles.metricValue}>{rating}</Text>
                    {renderTrend(ratingTrend)}
                </View>
            </View>
        </LinearGradient>
    );
};

export default TodayOverview;

const styles = StyleSheet.create({
    container: {
        marginHorizontal: s(12),
        marginTop: vs(8),
        marginBottom: vs(4),
        borderRadius: ms(16),
        padding: ms(12),
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: vs(12),
    },
    titleWrap: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    titleText: {
        color: '#FFFFFF',
        fontSize: ms(14),
        fontWeight: '600',
    },
    dateWrap: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dateText: {
        color: '#FFFFFF',
        fontSize: ms(12),
        marginLeft: s(4),
        fontWeight: '500',
    },
    metricsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    metricCol: {
        flex: 1,
        alignItems: 'center',
    },
    iconCircle: {
        width: ms(28),
        height: ms(28),
        borderRadius: ms(14),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: vs(4),
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    metricLabel: {
        color: '#E2E8F0',
        fontSize: ms(10),
        marginBottom: vs(2),
    },
    metricValue: {
        color: '#FFFFFF',
        fontSize: ms(14),
        fontWeight: '700',
        marginBottom: vs(2),
    },
    trendWrap: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    trendText: {
        color: '#4ADE80',
        fontSize: ms(9),
        marginLeft: s(2),
        fontWeight: '500',
    },
    divider: {
        width: 1,
        height: '70%',
        backgroundColor: 'rgba(255,255,255,0.15)',
    }
});
