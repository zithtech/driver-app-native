import React from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
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
    { icon: 'shield-checkmark-outline', label: t('zero_commission', 'Zero commission on all rides') },
    { icon: 'car-outline', label: t('instant_requests', 'Instant Requests') },
    { icon: 'map-outline', label: t('unlock_all_trips', 'Unlock All Trip Types') },
    { icon: 'headset-outline', label: t('support_24_7', '24/7 Support') },
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


          <View style={styles.contentContainer}>
            <View style={styles.planTextWrapper}>
              <View style={styles.planBadge}>
                <Ionicons name="star-outline" size={ms(14)} color={isDark ? '#94A3B8' : '#64748B'} style={{ marginRight: ms(4) }} />
                <Text style={[styles.planText, { color: isDark ? '#94A3B8' : '#64748B' }]}>Basic</Text>
              </View>
              
              <View style={styles.planBadge}>
                <Ionicons name="flash-outline" size={ms(14)} color={isDark ? '#94A3B8' : '#64748B'} style={{ marginRight: ms(4) }} />
                <Text style={[styles.planText, { color: isDark ? '#94A3B8' : '#64748B' }]}>Elite</Text>
              </View>
              
              <View style={[styles.planBadge, styles.premiumBadge]}>
                <Ionicons name="diamond" size={ms(14)} color={isDark ? '#FFF' : theme.colors.primary} style={{ marginRight: ms(4) }} />
                <Text style={[styles.planText, { color: isDark ? '#FFF' : theme.colors.primary, fontWeight: '800' }]}>Premium</Text>
              </View>
            </View>

            <Text style={[styles.title, { color: isDark ? theme.colors.text : theme.colors.primary }]}>
              {t('subscription_required', 'Recharge Plan Required')}
            </Text>

            <Text style={[styles.description, { color: isDark ? 'rgba(255,255,255,0.5)' : '#94A3B8' }]}>
              {t('active_plan_start_earning', 'Active the plan then start earning')}
            </Text>

            <View style={[styles.separator, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0' }]} />

            <View style={styles.benefitsContainer}>
              {benefits.map((benefit, index) => (
                <View key={index} style={styles.benefitItem}>
                  <View style={[styles.benefitIconWrapper, { backgroundColor: isDark ? 'rgba(96, 165, 250, 0.1)' : '#EFF6FF' }]}>
                    <Ionicons name={benefit.icon} size={ms(14)} color={isDark ? '#60A5FA' : '#3B82F6'} />
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
                <Text style={styles.subscribeButtonText}>
                  {t('view_plans_btn', 'Browse Recharge Plans')}
                </Text>
                <Ionicons name="arrow-forward" size={ms(16)} color="#FFF" style={{ marginLeft: ms(6) }} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: isDark ? 'rgba(255,255,255,0.2)' : '#CBD5E1' }]}
                onPress={onClose}
              >
                <Text style={[styles.cancelButtonText, { color: isDark ? theme.colors.textMuted : '#475569' }]}>
                  {t('not_now', 'Not Now')}
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: ms(20),
  },
  container: {
    width: '100%',
    maxWidth: ms(320),
    borderRadius: ms(16),
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },

  contentContainer: {
    paddingHorizontal: ms(20),
    paddingTop: vs(32),
    paddingBottom: vs(24),
    alignItems: 'center',
  },

  planTextWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(16),
    gap: ms(8),
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    paddingHorizontal: ms(10),
    paddingVertical: vs(6),
    borderRadius: ms(12),
  },
  premiumBadge: {
    backgroundColor: 'rgba(21, 45, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(21, 45, 94, 0.3)',
    shadowColor: '#152D5E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  planText: {
    fontSize: ms(11),
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: ms(22),
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: vs(8),
    letterSpacing: -0.3,
  },
  description: {
    fontSize: ms(14),
    textAlign: 'center',
    marginBottom: vs(16),
    paddingHorizontal: ms(10),
  },
  separator: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
    marginBottom: vs(20),
  },
  benefitsContainer: {
    alignSelf: 'center',
    gap: vs(8),
    marginBottom: vs(24),
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  benefitIconWrapper: {
    width: ms(28),
    height: ms(28),
    borderRadius: ms(8),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: ms(12),
  },
  benefitText: {
    fontSize: ms(13),
    fontWeight: '500',
  },
  footer: {
    width: '100%',
    gap: vs(12),
  },
  subscribeButton: {
    width: '100%',
    borderRadius: ms(14),
    paddingVertical: vs(14),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#152D5E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  subscribeButtonText: {
    color: '#FFFFFF',
    fontSize: ms(15),
    fontWeight: '700',
  },
  cancelButton: {
    width: '100%',
    paddingVertical: vs(12),
    borderRadius: ms(14),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: ms(14),
    fontWeight: '600',
  },
});
