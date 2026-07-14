import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../context/ThemeContext';
import {
  HelpCenter_Nav,
} from '../../Navigations/navigations';

/* ================= COMPONENTS ================= */

const HelpItem = ({ icon, title, subtitle, color, colors, onPress, isDark }: any) => {
  const { theme } = useAppTheme();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.helpMenuItem,
        pressed && { opacity: 0.7, backgroundColor: isDark ? theme.colors.border : '#F9FAFB' }
      ]}
      onPress={onPress}
    >
      <View style={[styles.helpIconBox, { backgroundColor: theme.colors.primary + '15' }]}>
        <Ionicons name={icon} size={22} color={theme.colors.primary} />
      </View>
      <View style={styles.helpTextContainer}>
        <Text style={[styles.helpMenuText, isDark && { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{title}</Text>
        {subtitle && <Text style={[styles.helpMenuSubtitle, isDark && { color: theme.colors.textMuted }]}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={isDark ? theme.colors.border : '#D1D5DB'} />
    </Pressable>
  );
};

const HelpCenterModal = ({ visible, onClose }: any) => {
  const { theme, isDark } = useAppTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<any>();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable 
          style={[styles.helpModalContent, { backgroundColor: theme.colors.card }]}
        >
          <View style={[styles.modalDragHandle, isDark && { backgroundColor: theme.colors.border }]} />
          <Text style={[styles.modalTitle, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
            {t('help_center_title') || 'Support & Services'}
          </Text>

          <View style={styles.helpMenu}>
            <HelpItem
              icon="help-circle-outline"
              title={t('help_center') || 'Help Center'}
              subtitle={t('help_center_subtitle') || 'Find answers to common questions'}
              isDark={isDark}
              onPress={() => {
                onClose();
                navigation.navigate(HelpCenter_Nav);
              }}
            />
          </View>

          <Pressable
            style={[styles.modalCloseBtn, isDark && { backgroundColor: theme.colors.background }]}
            onPress={onClose}
          >
            <Text style={[styles.modalCloseBtnText, isDark && { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
              {t('close') || 'Close'}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  helpModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  modalDragHandle: {
    width: 32,
    height: 3,
    backgroundColor: '#E5E7EB',
    borderRadius: 1.5,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  helpMenu: {
    marginTop: 8,
  },
  helpMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  helpIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  helpMenuText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  helpTextContainer: {
    flex: 1,
  },
  helpMenuSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '400',
  },
  modalCloseBtn: {
    marginTop: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
});

export default HelpCenterModal;
