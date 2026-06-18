import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { hS as s, vS as vs, mS as ms } from '../../../lib/scale';
import { useAppTheme } from '../../../context/ThemeContext';
interface RecentActivityItem {
    id: string | number;
    trip_code?: string;
    route: string;
    timeAgo: string;
    amount: string;
    status: string;
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
                    <Text style={[styles.seeAllText, isDark && { color: '#60A5FA' }]}>{t('see_all')}</Text>
                </Pressable>
            </View>

            {items.length > 0 ? items.map((item, index) => (
                <View key={item.id || `activity-${index}`} style={[styles.activityItem, isDark && { borderBottomColor: '#1E293B' }]}>
                    <View style={[styles.activityIcon, isDark && { backgroundColor: '#064e3b' }]}>
                        <Ionicons
                            name={item.status === 'completed' ? 'checkmark-circle' : item.status === 'cancelled' ? 'close-circle' : 'time'}
                            size={20}
                            color={item.status === 'completed' ? (isDark ? '#34D399' : '#22C55E') : item.status === 'cancelled' ? (isDark ? '#F87171' : '#EF4444') : (isDark ? '#FBBF24' : '#F59E0B')}
                        />
                    </View>
                    <View style={styles.activityInfo}>
                        <Text style={[styles.activityLoc, { color: theme.colors.text }]} numberOfLines={1}>
                            {item.trip_code ? `#${item.trip_code} • ` : ''}{item.route}
                        </Text>
                        <Text style={[styles.activityTime, isDark && { color: '#94A3B8' }]}>
                            {item.timeAgo} • {item.amount}
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={isDark ? '#4B5563' : '#9CA3AF'} />
                </View>
            )) : (
                <Text style={{ color: isDark ? '#4B5563' : '#9CA3AF', fontSize: ms(12), textAlign: 'center', paddingVertical: vs(16) }}>
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
        fontSize: ms(13),
        fontWeight: '700',
        color: '#111827',
    },
    seeAllText: {
        fontSize: ms(12),
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
        fontSize: ms(14),
        fontWeight: '500',
        color: '#111827',
    },
    activityTime: {
        fontSize: ms(11),
        color: '#6B7280',
        marginTop: vs(2),
    },
});
