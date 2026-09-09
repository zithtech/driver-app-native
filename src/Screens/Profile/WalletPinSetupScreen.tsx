import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ImageBackground,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../context/ThemeContext';
import { ms, vs } from '../../lib/scale';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSetupWalletPinMutation } from '../../service/userApi';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../redux/store';
import { setUser } from '../../redux/userSlice';
import { useToast } from '../../context/ToastContext';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useHaptic } from '../../hooks/useHaptic';
import AppStatusBar from '../../Components/AppStatusBar';

const WalletPinSetupScreen = ({ navigation }: any) => {
  const { t } = useTranslation();
  const { theme, isDark } = useAppTheme();
  const { triggerHaptic } = useHaptic();
  const { showToast } = useToast();
  
  const user = useSelector((state: RootState) => state.userSlice.user);
  const dispatch = useDispatch();
  const [setupWalletPin, { isLoading }] = useSetupWalletPinMutation();
  
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState(1);

  const handleKeyPress = (num: string) => {
    triggerHaptic(HapticFeedbackTypes.selection);
    if (step === 1) {
      if (pin.length < 4) setPin(pin + num);
    } else {
      if (confirmPin.length < 4) setConfirmPin(confirmPin + num);
    }
  };

  const handleBackspace = () => {
    triggerHaptic(HapticFeedbackTypes.selection);
    if (step === 1) {
      setPin(pin.slice(0, -1));
    } else {
      setConfirmPin(confirmPin.slice(0, -1));
    }
  };

  const handleNext = () => {
    if (pin.length !== 4) return;
    setStep(2);
  };

  const handleSave = async () => {
    if (confirmPin !== pin) {
      showToast({ message: 'PINs do not match.', type: 'error' });
      setConfirmPin('');
      setStep(1);
      setPin('');
      return;
    }

    try {
      await setupWalletPin({ id: user?.driverId || '', pin }).unwrap();
      dispatch(setUser({ has_wallet_pin: true }));
      triggerHaptic(HapticFeedbackTypes.notificationSuccess);
      showToast({ 
        message: 'Wallet PIN setup successfully.', 
        type: 'success' 
      });
      navigation.goBack();
    } catch (err: any) {
      showToast({ message: err.message || 'Failed to setup PIN', type: 'error' });
    }
  };

  const currentVal = step === 1 ? pin : confirmPin;
  const isButtonDisabled = currentVal.length !== 4 || isLoading;

  return (
    <ImageBackground 
      source={require('../../assets/images/walletback.png')} 
      style={[styles.container, { backgroundColor: isDark ? '#111827' : '#F8FAFC' }]}
    >
      <AppStatusBar backgroundColor="transparent" barStyle={isDark ? "light-content" : "dark-content"} translucent={true} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#0F172A'} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            {user?.has_wallet_pin ? t('Update Wallet PIN') : t('Setup Wallet PIN')}
          </Text>
          <View style={styles.backButtonPlaceholder} />
        </View>

        <View style={styles.content}>
          <View style={[styles.iconWrapper, { backgroundColor: isDark ? '#374151' : '#DCFCE7' }]}>
             <Ionicons name="lock-closed" size={ms(32)} color="#16a34a" />
          </View>
          <Text style={[styles.instruction, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            {step === 1 ? t('Enter a 4-digit PIN for your wallet') : t('Confirm your 4-digit PIN')}
          </Text>
          
          <View style={styles.dotsContainer}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    borderColor: isDark ? '#4B5563' : '#CBD5E1',
                    backgroundColor: currentVal.length > i ? '#16a34a' : 'transparent',
                    ...(currentVal.length > i ? { borderColor: '#16a34a' } : {})
                  },
                ]}
              />
            ))}
          </View>

          <View style={styles.keypad}>
            {[[1, 2, 3], [4, 5, 6], [7, 8, 9]].map((row, i) => (
              <View key={i} style={styles.keypadRow}>
                {row.map((num) => (
                  <TouchableOpacity 
                    key={num} 
                    style={[
                      styles.key, 
                      { 
                        backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                        shadowColor: isDark ? '#000' : '#94A3B8'
                      }
                    ]} 
                    onPress={() => handleKeyPress(num.toString())}
                  >
                    <Text style={[styles.keyText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{num}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
            <View style={styles.keypadRow}>
              <View style={styles.keyPlaceholder} />
              <TouchableOpacity 
                style={[
                  styles.key, 
                  { 
                    backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                    shadowColor: isDark ? '#000' : '#94A3B8'
                  }
                ]} 
                onPress={() => handleKeyPress('0')}
              >
                <Text style={[styles.keyText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>0</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.key} onPress={handleBackspace}>
                <Ionicons name="backspace-outline" size={28} color={isDark ? '#9CA3AF' : '#64748B'} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.saveButton, { backgroundColor: isButtonDisabled ? (isDark ? '#374151' : '#E2E8F0') : '#16a34a' }]}
            onPress={step === 1 ? handleNext : handleSave}
            disabled={isButtonDisabled}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={[styles.saveButtonText, { color: isButtonDisabled ? (isDark ? '#9CA3AF' : '#94A3B8') : '#FFFFFF' }]}>
                {step === 1 ? t('Next') : t('Save PIN')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ms(20),
    paddingVertical: vs(12),
  },
  title: {
    fontSize: ms(18),
    fontFamily: 'Inter-Bold',
    fontWeight: '700',
  },
  backButton: {
    padding: ms(4),
  },
  backButtonPlaceholder: {
    width: ms(32),
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: ms(20),
    paddingTop: vs(40),
  },
  iconWrapper: {
    width: ms(64),
    height: ms(64),
    borderRadius: ms(32),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: vs(24),
  },
  instruction: {
    fontSize: ms(16),
    fontFamily: 'Inter-Medium',
    marginBottom: vs(32),
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: ms(20),
    marginBottom: vs(48),
  },
  dot: {
    width: ms(20),
    height: ms(20),
    borderRadius: ms(10),
    borderWidth: 1,
  },
  keypad: {
    width: '100%',
    maxWidth: ms(300),
    gap: vs(16),
    marginBottom: vs(48),
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  key: {
    width: ms(72),
    height: ms(72),
    borderRadius: ms(36),
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  keyPlaceholder: {
    width: ms(72),
  },
  keyText: {
    fontSize: ms(28),
    fontFamily: 'Inter-Medium',
  },
  saveButton: {
    width: '100%',
    paddingVertical: vs(16),
    borderRadius: ms(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: ms(16),
    fontFamily: 'Inter-Bold',
    fontWeight: '700',
  },
});

export default WalletPinSetupScreen;
