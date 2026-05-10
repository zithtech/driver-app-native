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
          { 
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            elevation: isDark ? 0 : 2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
          }
        ]}
        onPress={() => {
          triggerHaptic(HapticFeedbackTypes.impactLight);
          setShowLanguageModal(true);
        }}
      >
        <Ionicons 
          name="globe-outline" 
          size={18} 
          color={colors.primary} 
          style={{ marginRight: 6 }} 
        />
        <Text style={[fonts.bold, { color: isDark ? '#FFFFFF' : colors.text, fontSize: 13, marginRight: 4 }]}>
          {currentLangObj.nativeName}
        </Text>
        <MaterialIcons
          name="keyboard-arrow-down"
          size={18}
          color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.3)'}
        />
      </TouchableOpacity>

      <Modal
        visible={showLanguageModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLanguageModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            {/* GRABBER */}
            <View style={[styles.grabber, { backgroundColor: colors.text + '20' }]} />

            <View style={styles.modalHeader}>
              <View>
                <Text style={[fonts.bold, { fontSize: 20, color: colors.text }]}>
                  {t('choose_language')}
                </Text>
                <Text style={{ color: colors.text, opacity: 0.5, fontSize: 13, marginTop: 2 }}>
                  {t('select_preferred_language')}
                </Text>
              </View>
              <TouchableOpacity 
                style={[styles.closeBtn, { backgroundColor: colors.text + '10' }]} 
                onPress={() => setShowLanguageModal(false)}
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 8 }}>
              {languagesList.map((item) => {
                const isSelected = (savedLanguage || i18n.language) === item.value;
                return (
                  <TouchableOpacity
                    key={item.value}
                    style={[
                      styles.languageItem,
                      {
                        backgroundColor: isSelected ? colors.primary + '10' : colors.text + '05',
                        borderColor: isSelected ? colors.primary : 'transparent',
                        borderWidth: 1.5,
                      }
                    ]}
                    onPress={() => handleLanguageSelect(item.value)}
                  >
                    <View style={styles.langItemLeft}>
                      <View style={[styles.iconWrapper, { backgroundColor: isSelected ? '#FFFFFF' : colors.text + '10' }]}>
                        <Text style={{ fontSize: 22 }}>{item.icon}</Text>
                      </View>
                      <View style={{ marginLeft: 14 }}>
                        <Text style={[fonts.bold, { color: isSelected ? colors.primary : colors.text, fontSize: 16 }]}>
                          {item.nativeName}
                        </Text>
                        <Text style={{ color: colors.text, opacity: 0.5, fontSize: 12 }}>
                          {item.label}
                        </Text>
                      </View>
                    </View>
                    <View style={[
                      styles.radioCircle, 
                      { borderColor: isSelected ? colors.primary : colors.text + '30' }
                    ]}>
                      {isSelected && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            
            {/* BOTTOM SPACING FOR SAFE AREA */}
            <View style={{ height: 20 }} />
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
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 20,
    marginBottom: 12,
  },
  langItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
