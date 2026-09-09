import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
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
  const dispatch = useDispatch();
  const { triggerHaptic } = useHaptic();

  const savedLanguage = useSelector((state: RootState) => state.userSlice.user?.language);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLanguageSelect = (lang: string) => {
    i18n.changeLanguage(lang);
    dispatch(setUser({ language: lang }));
    setShowDropdown(false);
    triggerHaptic(HapticFeedbackTypes.impactMedium);
  };

  const currentLangObj = languagesList.find(l => l.value === (savedLanguage || i18n.language)) || languagesList[0];
  const isDark = variant === 'dark';

  return (
    <View style={{ position: 'relative', zIndex: 1000 }}>
      <TouchableOpacity
        style={[
          styles.languageBtn,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            elevation: isDark ? 0 : 0.5,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.03,
            shadowRadius: 3,
          }
        ]}
        onPress={() => {
          triggerHaptic(HapticFeedbackTypes.impactLight);
          setShowDropdown(!showDropdown);
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

      {showDropdown && (
        <View style={[styles.dropdownContainer, {
          backgroundColor: colors.card,
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
        }]}>
          {languagesList.map((item, index) => {
            const isSelected = (savedLanguage || i18n.language) === item.value;
            return (
              <TouchableOpacity
                key={item.value}
                style={[
                  styles.dropdownItem,
                  index !== languagesList.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
                  }
                ]}
                onPress={() => handleLanguageSelect(item.value)}
              >
                <Text style={[
                  fonts.medium,
                  {
                    color: isSelected ? colors.primary : colors.text,
                    fontSize: 14
                  }
                ]}>
                  {item.nativeName}
                </Text>
                {isSelected && (
                  <Ionicons name="checkmark" size={16} color={colors.primary} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
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
  dropdownContainer: {
    position: 'absolute',
    top: 45,
    left: 0,
    width: 140,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
    paddingVertical: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
  }
});
