import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { ms, vs } from '../../../lib/scale';
import { useAppTheme } from '../../../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { getLanguageScaledSize } from '../../../utils/languageSizings';

export default function QuickActions() {
  const navigation = useNavigation<any>();
  const { isDark, theme } = useAppTheme();
  const { t } = useTranslation();

  const actions = [
    {
      id: 'activity',
      title: t('dashboard.ride_activity'),
      icon: 'clipboard-outline',
      color: '#3B82F6', // Blue
      bgColor: '#EFF6FF',
      onPress: () => navigation.navigate('RideActivityScreen'),
    },
    {
      id: 'performance',
      title: t('dashboard.performance'),
      icon: 'speedometer-outline',
      color: '#10B981', // Green
      bgColor: '#ECFDF5',
      onPress: () => navigation.navigate('DriverPerformanceScreen'),
    },
    {
      id: 'profile',
      title: t('dashboard.profile'),
      icon: 'person-outline',
      color: '#8B5CF6', // Purple
      bgColor: '#F5F3FF',
      onPress: () => navigation.navigate('ProfileDetailsScreen'),
    },
    {
      id: 'recharge',
      title: t('dashboard.recharge_plan'),
      icon: 'card-outline',
      color: '#06B6D4', // Cyan
      bgColor: '#ECFEFF',
      onPress: () => navigation.navigate('RechargePlanScreen'),
    },
    {
      id: 'wallet',
      title: t('dashboard.wallet'),
      icon: 'wallet-outline',
      color: '#F59E0B', // Orange
      bgColor: '#FEF3C7',
      onPress: () => navigation.navigate('WalletScreen'),
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: isDark ? theme.colors.card : '#FFFFFF' }]}>
      <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{t('dashboard.quick_actions')}</Text>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {actions.map((action) => (
          <Pressable 
            key={action.id} 
            style={styles.actionItem} 
            onPress={action.onPress}
          >
            <View style={[styles.iconContainer, { backgroundColor: isDark ? '#1E293B' : action.bgColor }]}>
              <Ionicons name={action.icon} size={ms(20)} color={action.color} />
            </View>
            <Text style={[styles.actionTitle, { color: isDark ? theme.colors.text : '#1E293B' }]} numberOfLines={2}>
              {action.title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: ms(16),
    marginBottom: vs(8),
    borderRadius: ms(16),
    paddingVertical: vs(12),
    paddingHorizontal: ms(12),
  },
  headerTitle: {
    fontSize: getLanguageScaledSize(13),
    fontWeight: '700',
    marginBottom: vs(10),
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: ms(12),
  },
  actionItem: {
    alignItems: 'center',
    width: ms(70),
  },
  iconContainer: {
    width: ms(42),
    height: ms(42),
    borderRadius: ms(12),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: vs(6),
  },
  actionTitle: {
    fontSize: getLanguageScaledSize(10),
    fontWeight: '500',
    textAlign: 'center',
  }
});
