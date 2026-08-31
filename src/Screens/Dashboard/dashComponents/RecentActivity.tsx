import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { hS as s, vS as vs, mS as ms } from '../../../lib/scale';
import { useAppTheme } from '../../../context/ThemeContext';
import { getLanguageScaledSize } from '../../../utils/languageSizings';
interface RecentActivityItem {
    id: string | number;
    trip_code?: string;
    route?: string; // route is optional now
    title?: string; // used for wallet/sub
    timeAgo: string;
    amount: string;
    status: string;
    type?: 'ride' | 'wallet' | 'subscription'; // Add type property
}

interface RecentActivityProps {
    items: RecentActivityItem[];
}

const RecentActivity: React.FC<RecentActivityProps> = ({ items }) => {
    const { theme, isDark } = useAppTheme();
    const { t } = useTranslation();
    const navigation = useNavigation<NavigationProp<any>>();

    return (
        <View style={[styles.activityCard, { backgroundColor: theme.colors.card }]}>
            <View style={styles.activityHeader}>
                <Text style={[styles.activityTitle, { color: theme.colors.text, flex: 1 }]} numberOfLines={1} adjustsFontSizeToFit>{t('recent_activity')}</Text>
                <Pressable onPress={() => navigation.navigate('Profile', { screen: 'RideActivityScreen' })}>
                    <Text style={[styles.seeAllText, isDark && { color: theme.colors.primary }]}>{t('see_all')}</Text>
                </Pressable>
            </View>

            {items.length > 0 ? items.map((item, index) => {
                let iconName = 'time';
                let iconColor = isDark ? '#FBBF24' : '#F59E0B'; // default yellow
                let iconBg = isDark ? '#064e3b' : '#F0FDF4';

                if (item.type === 'wallet') {
                    iconName = 'wallet';
                    iconColor = isDark ? '#34D399' : '#10B981'; // Green
                    iconBg = isDark ? '#064e3b' : '#ECFDF5';
                } else if (item.type === 'subscription') {
                    iconName = 'card';
                    iconColor = isDark ? '#8B5CF6' : '#6366F1'; // Purple/Indigo
                    iconBg = isDark ? '#312e81' : '#EEF2FF';
                } else {
                    // Ride logic
                    iconName = item.status === 'completed' ? 'checkmark-circle' : item.status === 'cancelled' ? 'close-circle' : 'time';
                    iconColor = item.status === 'completed' ? (isDark ? '#34D399' : '#22C55E') : item.status === 'cancelled' ? (isDark ? '#F87171' : '#EF4444') : (isDark ? '#FBBF24' : '#F59E0B');
                    iconBg = item.status === 'cancelled' ? (isDark ? '#450a0a' : '#FEF2F2') : (isDark ? '#064e3b' : '#F0FDF4');
                }

                return (
                <View key={item.id || `activity-${index}`} style={[styles.activityItem, isDark && { borderBottomColor: theme.colors.border }]}>
                    <View style={[styles.activityIcon, { backgroundColor: iconBg }]}>
                        <Ionicons
                            name={iconName}
                            size={20}
                            color={iconColor}
                        />
                    </View>
                    <View style={styles.activityInfo}>
                        <Text style={[styles.activityLoc, { color: theme.colors.text }]} numberOfLines={1}>
                            {item.trip_code ? `#${item.trip_code} • ` : ''}{item.title || item.route}
                        </Text>
                        <Text style={[styles.activityTime, isDark && { color: theme.colors.textMuted }]}>
                            {item.timeAgo} • {item.amount}
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={isDark ? theme.colors.textMuted : '#9CA3AF'} />
                </View>
            )}) : (
                <Text style={{ color: isDark ? theme.colors.textMuted : '#9CA3AF', fontSize: ms(12), textAlign: 'center', paddingVertical: vs(16) }}>
                    {t('no_recent_activity')}
                </Text>
            )}
        </View>
    );
};

export default RecentActivity;

const styles = StyleSheet.create({
    activityCard: {
        marginHorizontal: s(16),
        marginTop: vs(12),
        backgroundColor: '#FFFFFF',
        borderRadius: ms(16),
        padding: ms(14),
        marginBottom: vs(20),
    },
    activityHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: vs(14),
    },
    activityTitle: {
        fontSize: getLanguageScaledSize(13),
        fontWeight: '700',
        color: '#111827',
    },
    seeAllText: {
        fontSize: getLanguageScaledSize(12),
        color: '#2563EB',
        fontWeight: '600',
    },
    activityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: ms(16),
        borderRadius: ms(20),
        marginBottom: vs(12),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
        backgroundColor: '#FFF',
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: vs(10),
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    activityIcon: {
        width: s(32),
        height: s(32),
        borderRadius: ms(16),
        backgroundColor: '#F0FDF4',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: s(12),
    },
    activityInfo: {
        flex: 1,
    },
    activityLoc: {
        fontSize: getLanguageScaledSize(14),
        fontWeight: '500',
        color: '#111827',
    },
    activityTime: {
        fontSize: getLanguageScaledSize(11),
        color: '#6B7280',
        marginTop: vs(2),
    },
});
