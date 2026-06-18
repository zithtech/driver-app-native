import React from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import { ms, vs } from '../../../lib/scale';
import { Text } from '../../../Components';
import { useAppTheme } from '../../../context/ThemeContext';

const { width } = Dimensions.get('window');

interface SubscriptionRequiredModalProps {
  visible: boolean;
  onClose: () => void;
  onSubscribe: () => void;
}

const SubscriptionRequiredModal: React.FC<SubscriptionRequiredModalProps> = ({
  visible,
  onClose,
  onSubscribe,
}) => {
  const { theme, isDark } = useAppTheme();
  const { t } = useTranslation();

  const benefits = [
    { icon: 'shield-checkmark-outline', label: t('zero_commission', 'Zero Commission on Trips') },
    { icon: 'car-outline', label: t('instant_requests', 'Instant Ride Requests') },
    { icon: 'map-outline', label: t('unlock_all_trips', 'Unlock All Trip Types') },
    { icon: 'headset-outline', label: t('support_24_7', '24/7 Priority Support') },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.colors.card }]}>
          {/* Close Button UI */}
          <TouchableOpacity 
            style={styles.closeIcon} 
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={ms(24)} color={isDark ? theme.colors.textMuted : '#64748B'} />
          </TouchableOpacity>

          <LinearGradient
            colors={isDark ? ['#1E3A8A', '#1C294D'] : ['#EBF4FF', '#DBEAFF']}
            style={styles.iconWrapper}
          >
            <Ionicons name="diamond" size={ms(42)} color={isDark ? '#60A5FA' : '#2563EB'} />
          </LinearGradient>

          <View style={styles.contentContainer}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {t('subscription_required', 'Recharge Plan Required')}
            </Text>

            <Text style={[styles.description, { color: isDark ? theme.colors.textMuted : '#64748B' }]}>
              {t('active_plan_start_earning', 'Activate a plan to start receiving ride requests and maximize your earnings.')}
            </Text>

            <View style={styles.benefitsContainer}>
              {benefits.map((benefit, index) => (
                <View key={index} style={styles.benefitItem}>
                  <View style={[styles.benefitIconWrapper, { backgroundColor: isDark ? 'rgba(96, 165, 250, 0.1)' : 'rgba(37, 99, 235, 0.08)' }]}>
                    <Ionicons name={benefit.icon} size={ms(18)} color={isDark ? '#60A5FA' : '#2563EB'} />
                  </View>
                  <Text style={[styles.benefitText, { color: theme.colors.text }]}>
                    {benefit.label}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.footer}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.subscribeButton, { backgroundColor: theme.colors.primary }]}
                onPress={onSubscribe}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0.1)', 'transparent']}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.subscribeButtonText}>
                    {t('view_plans_btn', 'Browse Recharge Plans')}
                  </Text>
                  <Ionicons name="arrow-forward" size={ms(18)} color="#FFF" style={{ marginLeft: ms(8) }} />
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
              >
                <Text style={[styles.cancelButtonText, { color: isDark ? theme.colors.textMuted : '#64748B' }]}>
                  {t('not_now', 'Decide Later')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default SubscriptionRequiredModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: ms(24),
  },
  container: {
    width: '100%',
    maxWidth: ms(360),
    borderRadius: ms(32),
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    paddingTop: vs(40),
  },
  closeIcon: {
    position: 'absolute',
    right: ms(20),
    top: vs(20),
    zIndex: 10,
  },
  iconWrapper: {
    width: ms(90),
    height: ms(90),
    borderRadius: ms(45),
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: vs(24),
  },
  contentContainer: {
    paddingHorizontal: ms(24),
    paddingBottom: vs(32),
    alignItems: 'center',
  },
  title: {
    fontSize: ms(24),
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: vs(12),
    letterSpacing: -0.5,
  },
  description: {
    fontSize: ms(15),
    textAlign: 'center',
    lineHeight: ms(22),
    marginBottom: vs(28),
    paddingHorizontal: ms(10),
  },
  benefitsContainer: {
    width: '100%',
    gap: vs(14),
    marginBottom: vs(32),
    paddingHorizontal: ms(10),
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  benefitIconWrapper: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(10),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: ms(12),
  },
  benefitText: {
    fontSize: ms(14),
    fontWeight: '600',
  },
  footer: {
    width: '100%',
    gap: vs(12),
  },
  subscribeButton: {
    width: '100%',
    borderRadius: ms(18),
    overflow: 'hidden',
  },
  buttonGradient: {
    paddingVertical: vs(18),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscribeButtonText: {
    color: '#FFFFFF',
    fontSize: ms(16),
    fontWeight: '800',
  },
  cancelButton: {
    width: '100%',
    paddingVertical: vs(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: ms(14),
    fontWeight: '700',
  },
});
