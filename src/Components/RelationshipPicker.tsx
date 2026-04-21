import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import { ms, vs } from '../lib/scale';
import { useTranslation } from 'react-i18next';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface RelationshipPickerProps {
  selected: string;
  onSelect: (relationship: string) => void;
}

const RELATIONSHIPS = [
  { label: 'Family', icon: 'people-outline', activeIcon: 'people' },
  { label: 'Friend', icon: 'person-outline', activeIcon: 'person' },
  { label: 'Spouse', icon: 'heart-outline', activeIcon: 'heart' },
  { label: 'Work', icon: 'briefcase-outline', activeIcon: 'briefcase' },
  { label: 'Other', icon: 'ellipsis-horizontal-outline', activeIcon: 'ellipsis-horizontal' },
];

const RelationshipPicker: React.FC<RelationshipPickerProps> = ({ selected, onSelect }) => {
  const { theme, isDark } = useAppTheme();
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: isDark ? '#FFFFFF' : '#111827' }]}>
        {t('relationship') || 'Relationship'}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {RELATIONSHIPS.map((item) => {
          const isSelected = selected === item.label;
          return (
            <Pressable
              key={item.label}
              onPress={() => onSelect(item.label)}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected
                    ? theme.colors.primary
                    : isDark ? '#374151' : '#F3F4F6',
                  borderColor: isSelected ? theme.colors.primary : 'transparent'
                }
              ]}
            >
              <Ionicons 
                name={isSelected ? item.activeIcon : item.icon} 
                size={ms(16)} 
                color={isSelected ? '#FFFFFF' : isDark ? '#9CA3AF' : '#6B7280'} 
                style={{ marginRight: ms(6) }}
              />
              <Text style={[
                styles.chipText,
                { color: isSelected ? '#FFFFFF' : isDark ? '#9CA3AF' : '#6B7280' }
              ]}>
                {t(item.label.toLowerCase()) || item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: vs(20),
  },
  label: {
    fontSize: ms(13),
    fontWeight: '700',
    marginBottom: vs(12),
    letterSpacing: 0.3,
  },
  scrollContent: {
    paddingRight: ms(20),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ms(14),
    paddingVertical: vs(10),
    borderRadius: ms(14),
    borderWidth: 1.5,
    marginRight: ms(10),
  },
  chipText: {
    fontSize: ms(14),
    fontWeight: '700',
  },
});

export default RelationshipPicker;

