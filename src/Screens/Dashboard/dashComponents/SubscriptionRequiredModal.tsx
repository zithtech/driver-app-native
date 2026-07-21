import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
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
  const bottomSheetRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible]);

  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      onClose();
    }
  }, [onClose]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
      />
    ),
    []
  );

  const benefits = [
    { icon: 'headset-outline', label: t('support_24_7', '24/7 Support') },
    { icon: 'car-outline', label: t('instant_requests', 'Instant Requests') },
    { icon: 'map-outline', label: t('unlock_all_trips', 'Unlock All Trip Types') },
    { icon: 'shield-checkmark-outline', label: t('zero_commission', 'Zero commission on all rides') },
  ];

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={['65%']}
      onChange={handleSheetChanges}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: isDark ? 'rgba(252,211,77,0.4)' : '#FCD34D' }}
      backgroundStyle={{ backgroundColor: isDark ? '#451A03' : '#FFFBEB' }}
      enablePanDownToClose={true}
    >
      <BottomSheetView style={styles.contentContainer}>

            <View style={styles.titleRow}>
              <Ionicons name="warning" size={ms(26)} color={isDark ? '#FCD34D' : '#F59E0B'} style={{ marginRight: ms(8) }} />
              <Text style={[styles.title, { color: isDark ? '#FCD34D' : '#F59E0B', marginBottom: 0 }]}>
                {t('subscription_required', 'Recharge Plan Required')}
              </Text>
            </View>

            <Text style={[styles.description, { color: isDark ? 'rgba(252,211,77,0.7)' : '#78350F' }]}>
              {t('active_plan_start_earning', 'Active the plan then start earning')}
            </Text>

            <View style={[styles.separator, { backgroundColor: isDark ? 'rgba(252,211,77,0.2)' : '#FDE68A' }]} />

            <View style={styles.benefitsContainer}>
              {benefits.map((benefit, index) => (
                <View key={index} style={styles.benefitItem}>
                  <View style={[styles.benefitIconWrapper, { backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : '#FEF3C7' }]}>
                    <Ionicons name={benefit.icon} size={ms(13)} color={isDark ? '#FCD34D' : '#F59E0B'} />
                  </View>
                  <Text style={[styles.benefitText, { color: isDark ? '#FDE68A' : '#78350F' }]}>
                    {benefit.label}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.footer}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.subscribeButton, { backgroundColor: '#F59E0B' }]}
                onPress={onSubscribe}
              >
                <Text style={styles.subscribeButtonText}>
                  {t('view_plans_btn', 'Browse Recharge Plans')}
                </Text>
                <Ionicons name="arrow-forward" size={ms(16)} color="#FFF" style={{ marginLeft: ms(6) }} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: isDark ? 'rgba(252,211,77,0.3)' : '#FCD34D' }]}
                onPress={() => bottomSheetRef.current?.dismiss()}
              >
                <Text style={[styles.cancelButtonText, { color: isDark ? '#FCD34D' : '#F59E0B' }]}>
                  {t('not_now', 'Not Now')}
                </Text>
              </TouchableOpacity>
            </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
};

export default SubscriptionRequiredModal;

const styles = StyleSheet.create({
  contentContainer: {
    paddingHorizontal: ms(24),
    paddingTop: vs(16),
    paddingBottom: vs(32),
    alignItems: 'center',
  },


  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(8),
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    rowGap: vs(16),
    marginBottom: vs(24),
  },
  benefitItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  benefitIconWrapper: {
    width: ms(26),
    height: ms(26),
    borderRadius: ms(8),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: ms(8),
    marginTop: vs(2),
  },
  benefitText: {
    flex: 1,
    flexShrink: 1,
    fontSize: ms(11),
    lineHeight: ms(16),
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
