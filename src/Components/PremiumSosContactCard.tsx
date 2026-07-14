import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../context/ThemeContext';
import { ms, vs } from '../lib/scale';
import Animated, { FadeInRight, Layout } from 'react-native-reanimated';

interface PremiumSosContactCardProps {
  name: string;
  phone: string;
  relationship?: string;
  status?: 'verified' | 'pending';
  onDelete?: () => void;
  index: number;
}

const AVATAR_COLORS = [
  { bg: '#DBEAFE', text: '#1E40AF' },
  { bg: '#E0E7FF', text: '#3730A3' },
  { bg: '#FEF3C7', text: '#92400E' },
  { bg: '#DCFCE7', text: '#166534' },
  { bg: '#FCE7F3', text: '#9D174D' },
];

const PremiumSosContactCard: React.FC<PremiumSosContactCardProps> = ({
  name,
  phone,
  relationship,
  status = 'verified',
  onDelete,
  index
}) => {
  const { isDark } = useAppTheme();
  const avatarStyle = AVATAR_COLORS[index % AVATAR_COLORS.length];

  return (
    <Animated.View 
      entering={FadeInRight.delay(index * 100)}
      layout={Layout.springify()}
      style={[
        styles.container,
        { 
          backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
          borderColor: isDark ? '#374151' : '#E5E7EB',
        }
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : avatarStyle.bg }]}>
        <Text style={[styles.avatarText, { color: isDark ? '#9CA3AF' : avatarStyle.text }]}>
          {name.charAt(0).toUpperCase()}
        </Text>
      </View>
      
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: isDark ? '#F3F4F6' : '#111827' }]} numberOfLines={1}>
            {name}
          </Text>
          {relationship && (
            <View style={[styles.tag, { borderColor: isDark ? '#374151' : '#E5E7EB' }]}>
              <Text style={[styles.tagText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                {relationship}
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.phone, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>{phone}</Text>
        
        <View style={styles.statusRow}>
          <Ionicons 
            name={status === 'verified' ? "shield-checkmark-outline" : "time-outline"} 
            size={14} 
            color={status === 'verified' ? '#10B981' : '#F59E0B'} 
          />
          <Text style={[styles.statusText, { color: status === 'verified' ? '#10B981' : '#F59E0B' }]}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Text>
        </View>
      </View>
      
      {onDelete && (
        <Pressable 
          onPress={onDelete} 
          style={({ pressed }) => [
            styles.deleteBtn,
            pressed && { opacity: 0.5 }
          ]}
        >
          <Ionicons name="trash-outline" size={ms(20)} color={isDark ? '#EF4444' : '#DC2626'} />
        </Pressable>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: ms(14),
    borderRadius: ms(16),
    marginBottom: vs(12),
    borderWidth: 1,
  },
  avatar: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(22),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: ms(14),
  },
  avatarText: {
    fontSize: ms(18),
    fontWeight: '700',
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: vs(2),
    flexWrap: 'wrap',
  },
  name: {
    fontSize: ms(16),
    fontWeight: '700',
    marginRight: ms(8),
  },
  tag: {
    paddingHorizontal: ms(8),
    paddingVertical: vs(2),
    borderRadius: ms(12),
    borderWidth: 1,
  },
  tagText: {
    fontSize: ms(10),
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  phone: {
    fontSize: ms(13),
    fontWeight: '500',
    marginBottom: vs(4),
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: ms(11),
    fontWeight: '600',
    marginLeft: ms(4),
  },
  deleteBtn: {
    width: ms(36),
    height: ms(36),
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: ms(12),
  },
});

export default PremiumSosContactCard;
