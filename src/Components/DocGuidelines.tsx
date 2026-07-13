import React from 'react';
import { View, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import { Text } from './index';
import { useTranslation } from 'react-i18next';

interface DocGuidelinesProps {
  docKey: string;
}

const DocGuidelines: React.FC<DocGuidelinesProps> = ({ docKey }) => {
  const { colors, fonts } = useTheme() as any;
  const { t } = useTranslation();

  const getGuidelines = () => {
    switch (docKey) {
      case 'Profile_Selfie':
        return [
          { icon: 'sunny-outline', text: t('guide_lighting') || 'Good lighting on face' },
          { icon: 'person-outline', text: t('guide_center') || 'Center your face in frame' },
          { icon: 'glasses-outline', text: t('guide_no_accessories') || 'No glasses or face masks' },
        ];
      default:
        return [
          { icon: 'flash-off-outline', text: t('guide_no_glare') || 'Avoid glare and shadows' },
          { icon: 'scan-outline', text: t('guide_full_doc') || 'Ensure full document is visible' },
          { icon: 'eye-outline', text: t('guide_readable') || 'Text should be clear and readable' },
        ];
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="information-circle" size={18} color="#2563EB" />
        <Text style={[fonts.bold, styles.title]}>{t('capture_guides') || 'Guidelines for a clear photo'}</Text>
      </View>
      <View style={styles.list}>
        {getGuidelines().map((item, index) => (
          <View key={index} style={styles.item}>
            <View style={styles.iconBg}>
              <Ionicons name={item.icon} size={16} color="#4B5563" />
            </View>
            <Text style={styles.text}>{item.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export default DocGuidelines;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
    marginLeft: 8,
  },
  list: {
    gap: 10,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBg: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  text: {
    fontSize: 13,
    color: '#374151',
  },
});
