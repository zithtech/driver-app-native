import React from 'react';
import { View, StyleSheet, Modal, Pressable, TouchableWithoutFeedback } from 'react-native';
import { Text } from '../../../Components';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { hS as s, vS as vs, mS as ms } from '../../../lib/scale';

interface VerificationSuccessModalProps {
  visible: boolean;
  onClose: () => void;
}

const VerificationSuccessModal: React.FC<VerificationSuccessModalProps> = ({
  visible,
  onClose,
}) => {
  const { theme, isDark } = useAppTheme();
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <TouchableWithoutFeedback>
          <Animated.View 
            entering={FadeInDown.duration(400).springify()}
            style={[styles.modalContainer, { backgroundColor: isDark ? theme.colors.card : '#FFFFFF' }]}
          >
            <Animated.View entering={ZoomIn.delay(200).springify()} style={[styles.iconWrapper, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
              <Ionicons name="shield-checkmark" size={ms(60)} color="#10B981" />
            </Animated.View>

            <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#111827' }]}>
              {t('verified_successfully', 'Verified Successfully!')}
            </Text>
            
            <Text style={[styles.message, { color: isDark ? '#9CA3AF' : '#4B5563' }]}>
              {t('verification_success_msg', 'Your documents have been verified successfully. You are now ready to go online and start earning.')}
            </Text>

            <Pressable 
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: theme.colors.primary },
                pressed && { opacity: 0.8 }
              ]}
              onPress={onClose}
            >
              <Text style={styles.buttonText}>
                {t('start_earning', 'Start Earning')}
              </Text>
            </Pressable>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: s(24),
  },
  modalContainer: {
    width: '100%',
    maxWidth: s(340),
    borderRadius: ms(24),
    paddingTop: vs(32),
    paddingBottom: vs(24),
    paddingHorizontal: s(24),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  iconWrapper: {
    width: ms(100),
    height: ms(100),
    borderRadius: ms(50),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: vs(20),
  },
  title: {
    fontSize: ms(22),
    fontWeight: '800',
    marginBottom: vs(8),
    textAlign: 'center',
  },
  message: {
    fontSize: ms(15),
    textAlign: 'center',
    lineHeight: ms(24),
    marginBottom: vs(32),
    paddingHorizontal: s(10),
  },
  button: {
    width: '100%',
    paddingVertical: vs(16),
    borderRadius: ms(16),
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: ms(16),
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});

export default VerificationSuccessModal;
