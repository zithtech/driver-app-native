import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
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
      <LinearGradient
        colors={colors || [color, color]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.helpIconBox}
      >
        <Ionicons name={icon} size={22} color="#FFFFFF" />
      </LinearGradient>
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
              colors={['#3B82F6', '#2563EB']}
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
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
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
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
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
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  helpTextContainer: {
    flex: 1,
  },
  helpMenuSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '400',
  },
  modalCloseBtn: {
    marginTop: 24,
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4B5563',
  },
});

export default HelpCenterModal;
