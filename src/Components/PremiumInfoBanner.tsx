import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useAppTheme } from '../context/ThemeContext';
import { ms, vs } from '../lib/scale';

interface PremiumInfoBannerProps {
  title?: string;
  description: string;
  icon?: string;
}

const PremiumInfoBanner: React.FC<PremiumInfoBannerProps> = ({
  title,
  description,
  icon = 'shield-checkmark'
}) => {
  const { isDark } = useAppTheme();

  return (
    <LinearGradient
      colors={isDark ? ['#1E3A8A', '#1C294D'] : ['#EBF4FF', '#DBEAFF']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={[styles.iconWrapper, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(37, 99, 235, 0.1)' }]}>
        <Ionicons name={icon} size={ms(24)} color={isDark ? '#60A5FA' : '#2563EB'} />
      </View>
      <View style={styles.textContainer}>
        {title && <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#1E40AF' }]}>{title}</Text>}
        <Text style={[styles.description, { color: isDark ? '#BFDBFE' : '#1E40AF' }]}>
          {description}
        </Text>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: ms(16),
    borderRadius: ms(20),
    marginBottom: vs(24),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.1)',
  },
  iconWrapper: {
    width: ms(48),
    height: ms(48),
    borderRadius: ms(24),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: ms(16),
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: ms(16),
    fontWeight: '800',
    marginBottom: vs(4),
  },
  description: {
    fontSize: ms(14),
    fontWeight: '500',
    lineHeight: ms(20),
  },
});

export default PremiumInfoBanner;
