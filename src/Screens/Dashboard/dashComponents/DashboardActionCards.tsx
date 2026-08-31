import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Dimensions } from 'react-native';
import { ms, vs } from '../../../lib/scale';
import { useAppTheme } from '../../../context/ThemeContext';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSelector } from 'react-redux';
import { RootState } from '../../../redux/store';
import { calculateCompletion, getProfileMissingText } from '../../../utils/profileUtils';
import Svg, { Circle, G } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { getLanguageScaledSize } from '../../../utils/languageSizings';

const { width } = Dimensions.get('window');

const CircleChart = ({ percentage, isDark }: { percentage: number, isDark: boolean }) => {
  const size = ms(45);
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          <Circle
            stroke={isDark ? '#374151' : '#E5E7EB'}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            stroke="#2563EB"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      </Svg>
      <Text style={{ position: 'absolute', fontSize: ms(11), fontWeight: '700', color: isDark ? '#FFFFFF' : '#111827' }}>
        {percentage}%
      </Text>
    </View>
  );
};


export default function DashboardActionCards() {
  const { theme, isDark } = useAppTheme();
  const { t } = useTranslation();
  const safetyTips = t('dashboard.safety_tips', { returnObjects: true }) as string[];
  const user = useSelector((state: RootState) => state.userSlice.user);
  const completionPercentage = calculateCompletion(user);
  const missingText = getProfileMissingText(user);
  const navigation = useNavigation<any>();
  const [tipIndex, setTipIndex] = useState(0);

  const handleStaySafePress = () => {
    setTipIndex((prev) => (prev + 1) % safetyTips.length);
  };

  const carImage = isDark
    ? require('../../../assets/images/dashboraddarkcar.png')
    : require('../../../assets/images/dashboradcar.png');

  return (
    <View style={styles.container}>
      {/* Card 1: Stay Safe */}
      <Pressable 
        style={[styles.card, { backgroundColor: isDark ? '#1E293B' : '#F0F9FF' }]}
        onPress={handleStaySafePress}
      >
        <View style={{ zIndex: 10, position: 'absolute', top: ms(12), left: ms(12), right: ms(12) }}>
          <Text style={[styles.title, { color: isDark ? '#F8FAFC' : '#1E1B4B' }]}>
            {t('dashboard.stay_safe')}
          </Text>
          <View style={styles.subtitleRow}>
            <Text style={[styles.subtitle, { color: isDark ? '#94A3B8' : '#334155', flex: 1, paddingRight: ms(4) }]} numberOfLines={2}>
              {safetyTips[tipIndex]}
            </Text>
            <Ionicons name="chevron-forward" size={ms(16)} color={isDark ? '#60A5FA' : '#2563EB'} style={{ marginTop: vs(2) }} />
          </View>
        </View>
        <Image source={carImage} style={styles.carImage} resizeMode="contain" />
      </Pressable>

      {/* Card 2: Complete Profile */}
      <Pressable
        style={[styles.card, { backgroundColor: isDark ? theme.colors.card : '#FFFFFF', borderWidth: isDark ? 0 : 1, borderColor: '#F3F4F6' }]}
        onPress={() => navigation.navigate('ProfileDetailsScreen')}
      >
        <Text style={[styles.title, { color: isDark ? theme.colors.text : '#1E1B4B' }]}>
          {t('dashboard.complete_profile')}
        </Text>

        <View style={styles.profileContent}>
          <CircleChart percentage={completionPercentage} isDark={isDark} />
          <View style={{ flex: 1, marginLeft: ms(8), marginRight: ms(4) }}>
            <Text style={[styles.subtitle, { color: isDark ? theme.colors.textMuted : '#475569', marginTop: 0 }]} numberOfLines={2}>
              {missingText}
            </Text>
            <View style={[styles.progressBarTrack, { backgroundColor: isDark ? '#374151' : '#E5E7EB', marginTop: vs(8) }]}>
              <View style={[styles.progressBarFill, { width: `${completionPercentage}%` }]} />
            </View>
          </View>
          <Ionicons name="chevron-forward" size={ms(16)} color={isDark ? theme.colors.textMuted : '#9CA3AF'} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: ms(16),
    gap: ms(12),
    marginTop: vs(16),
    marginBottom: vs(12),
  },
  card: {
    flex: 1,
    borderRadius: ms(16),
    padding: ms(12),
    minHeight: vs(115),
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'flex-start',
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: vs(4),
  },
  title: {
    fontSize: getLanguageScaledSize(12),
    fontWeight: '700',
  },
  subtitle: {
    fontSize: getLanguageScaledSize(10),
    lineHeight: vs(14),
  },
  carImage: {
    width: '120%',
    height: vs(80),
    position: 'absolute',
    bottom: -vs(10),
    right: -ms(15),
    opacity: 0.9,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: vs(8),
    justifyContent: 'space-between',
    flex: 1,
  },
  progressBarTrack: {
    height: ms(4),
    borderRadius: ms(2),
    overflow: 'hidden',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2563EB',
    borderRadius: ms(2),
  }
});
