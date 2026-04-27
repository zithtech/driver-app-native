import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';

import { useHaptic } from '../hooks/useHaptic';
import { setUser } from '../redux/userSlice';
import { RootState } from '../redux/store';
import i18n from '../i18n/i18n';
import { languagesList } from '../constant/language';

interface LanguageSelectorProps {
  variant?: 'light' | 'dark';
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ variant = 'light' }) => {
  const { colors, fonts } = useTheme() as any;
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { triggerHaptic } = useHaptic();

  const savedLanguage = useSelector((state: RootState) => state.userSlice.user?.language);
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  const handleLanguageSelect = (lang: string) => {
    i18n.changeLanguage(lang);
    dispatch(setUser({ language: lang }));
    setShowLanguageModal(false);
    triggerHaptic(HapticFeedbackTypes.impactMedium);
  };

  const currentLangObj = languagesList.find(l => l.value === (savedLanguage || i18n.language)) || languagesList[0];
  const isDark = variant === 'dark';

  return (
    <>
      <TouchableOpacity
        style={[
          styles.languageBtn,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#F3F4F6' }
        ]}
        onPress={() => {
          triggerHaptic(HapticFeedbackTypes.impactLight);
          setShowLanguageModal(true);
        }}
      >
        <Text style={{ fontSize: 18, marginRight: 6 }}>{currentLangObj.icon}</Text>
        <Text style={[fonts.bold, { color: isDark ? '#FFFFFF' : colors.text, fontSize: 14 }]}>
          {currentLangObj.nativeName}
        </Text>
        <MaterialIcons
          name="keyboard-arrow-down"
          size={20}
          color={isDark ? '#FFFFFF' : colors.text}
          style={{ marginLeft: 2 }}
        />
      </TouchableOpacity>

      <Modal
        visible={showLanguageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLanguageModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[fonts.bold, { fontSize: 18, color: colors.text }]}>{t('choose_language')}</Text>
              <TouchableOpacity onPress={() => setShowLanguageModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {languagesList.map((item) => (
              <TouchableOpacity
                key={item.value}
                style={[
                  styles.languageItem,
                  {
                    backgroundColor: i18n.language === item.value ? colors.primary + '15' : 'transparent',
                    borderColor: i18n.language === item.value ? colors.primary : 'transparent'
                  }
                ]}
                onPress={() => handleLanguageSelect(item.value)}
              >
                <View style={styles.langItemLeft}>
                  <Text style={{ fontSize: 24, marginRight: 12 }}>{item.icon}</Text>
                  <View>
                    <Text style={[fonts.bold, { color: colors.text, fontSize: 16 }]}>{item.nativeName}</Text>
                    <Text style={{ color: colors.text, opacity: 0.6, fontSize: 13 }}>{item.label}</Text>
                  </View>
                </View>
                {i18n.language === item.value && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

export default LanguageSelector;

const styles = StyleSheet.create({
  languageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1.5,
  },
  langItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
