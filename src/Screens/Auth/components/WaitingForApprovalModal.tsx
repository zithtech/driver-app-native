import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, SafeAreaView, Dimensions, Platform, Image, Animated as RNAnimated, Easing } from 'react-native';
import Text from '../../../Components/Text';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Animated, {
  FadeInDown,
  FadeIn,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing as ReanimatedEasing,
  useAnimatedStyle
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@react-navigation/native';
import HelpCenterModal from '../../Onboarding/HelpCenterModal';
import { useAppTheme } from '../../../context/ThemeContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface WaitingForApprovalModalProps {
  visible: boolean;
  onCheckStatus: () => void;
  onContactSupport: () => void;
  fonts: any;
  status?: 'review' | 'rejected';
  rejectionReasons?: string;
  onReupload?: () => void;
}

const PulseCircle = ({ color }: { color: string }) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(2, { duration: 1500, easing: ReanimatedEasing.out(ReanimatedEasing.ease) }),
      -1,
      false
    );
    opacity.value = withRepeat(
      withTiming(0, { duration: 1500, easing: ReanimatedEasing.out(ReanimatedEasing.ease) }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View style={[
      StyleSheet.absoluteFillObject,
      { backgroundColor: color, borderRadius: 16 },
      animatedStyle
    ]} />
  );
};

const HorizontalTimeline = ({ t, fonts, colors, isRejected, isDark }: { t: any; fonts: any; colors: any; isRejected?: boolean; isDark: boolean }) => {
  const steps = [
    { key: 'docs_upload', label: 'Document Upload', icon: 'cloud-done-outline', completed: true, active: false },
    { key: 'under_review', label: 'Under Review', icon: isRejected ? 'close' : 'search-outline', completed: false, active: true, error: isRejected },
    { key: 'start_earning', label: 'Start Earning', icon: 'car-outline', completed: false, active: false },
  ];

  return (
    <Animated.View entering={FadeInDown.duration(800).delay(400)} style={styles.horizontalTimeline}>
      {steps.map((step, index) => (
        <View key={step.key} style={styles.timelineStepContainer}>
          {index < steps.length - 1 && (
             <View style={[styles.timelineConnector, { backgroundColor: isDark ? '#374151' : '#E5E7EB' }, step.completed && { backgroundColor: '#F59E0B' }]} />
          )}
          <View style={[
            styles.timelineIconWrapper, 
            { backgroundColor: isDark ? '#374151' : '#F3F4F6' },
            step.completed && { backgroundColor: '#F59E0B' },
            step.active && !step.error && { backgroundColor: '#F59E0B', elevation: 4, shadowColor: '#F59E0B', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
            step.error && { backgroundColor: '#EF4444', elevation: 4, shadowColor: '#EF4444', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } }
          ]}>
             {step.active && !step.error && <PulseCircle color="#F59E0B" />}
             <Ionicons name={step.completed ? 'checkmark' : step.icon} size={16} color={step.active || step.completed ? '#FFF' : (isDark ? '#6B7280' : '#9CA3AF')} />
          </View>
          <Text style={[fonts.medium, styles.timelineStepText, (step.active || step.completed) && { color: isDark ? '#F9FAFB' : '#111827' }]} numberOfLines={2} adjustsFontSizeToFit>
             {t(step.key, step.label)}
          </Text>
        </View>
      ))}
    </Animated.View>
  );
};

const WaitingForApprovalModal: React.FC<WaitingForApprovalModalProps> = ({
  visible,
  onCheckStatus,
  onContactSupport,
  fonts,
  status = 'review',
  rejectionReasons,
  onReupload,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme() as any;
  const { theme, isDark } = useAppTheme();
  const [isHelpVisible, setIsHelpVisible] = useState(false);
  const isRejected = status === 'rejected';

  // --- Spin Animation for Refresh ---
  const spinValue = useRef(new RNAnimated.Value(0)).current;
  
  const handleRefresh = () => {
    spinValue.setValue(0);
    RNAnimated.timing(spinValue, {
      toValue: 1,
      duration: 1000,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
    onCheckStatus();
  };

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Modal visible={visible} animationType="fade" transparent={true} statusBarTranslucent={true}>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <SafeAreaView style={styles.safeArea}>
          
          <View style={styles.headerRow}>
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: isDark ? theme.colors.card : '#FFFFFF' }]} onPress={() => setIsHelpVisible(true)}>
              <Ionicons name="help-outline" size={24} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: isDark ? theme.colors.card : '#FFFFFF' }]} onPress={handleRefresh}>
              <RNAnimated.View style={{ transform: [{ rotate: spin }] }}>
                <Ionicons name="refresh" size={24} color={colors.text} />
              </RNAnimated.View>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {/* Top Image Section */}
            <Animated.View entering={FadeIn.duration(800)} style={styles.imageContainer}>
               <Image 
                 source={require('../../../assets/images/docReview.png')} 
                 style={styles.image} 
                 resizeMode="contain" 
               />
            </Animated.View>

            {/* Floating Card Section */}
            <Animated.View entering={FadeInDown.duration(800).delay(200)} style={[styles.card, { backgroundColor: theme.colors.card }]}>
               {/* Icon overlapping top */}
               <View style={[styles.iconOverlap, isRejected && { backgroundColor: '#EF4444', shadowColor: '#EF4444', borderColor: theme.colors.card }, { borderColor: theme.colors.card }]}>
                 <Ionicons name={isRejected ? "close" : "time"} size={24} color="#FFFFFF" />
               </View>

               <Text style={[fonts.bold, styles.title, { color: colors.text }]}>
                 {isRejected ? t('docs_rejected_title', 'Action Required') : t('docs_under_review', 'Documents Under Review')}
               </Text>
               <Text style={[styles.subtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                 {isRejected 
                   ? t('docs_rejected_desc', 'Some of your documents were rejected. Please review the reasons below and re-upload them.')
                   : t('docs_review_desc_detailed', 'Thank you! Your documents have been submitted successfully and are currently under review.')}
               </Text>

               {isRejected ? (
                 <View style={[styles.infoBoxRed, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2', borderColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FECACA' }]}>
                   <Ionicons name="warning-outline" size={24} color="#DC2626" />
                   <View style={styles.infoBoxTextContainer}>
                      <Text style={[fonts.medium, styles.infoBoxTextBold, { color: isDark ? '#FCA5A5' : '#991B1B' }]}>{t('rejection_reasons', 'Rejection Reasons:')}</Text>
                      <Text style={[fonts.regular, styles.infoBoxText, { color: isDark ? '#FECACA' : '#7F1D1D' }]}>{rejectionReasons || t('invalid_document', 'Invalid document')}</Text>
                   </View>
                 </View>
               ) : (
                 <>
                   <View style={[styles.infoBoxYellow, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#FFFBEB', borderColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7' }]}>
                     <Ionicons name="hourglass-outline" size={24} color="#F59E0B" />
                     <View style={styles.infoBoxTextContainer}>
                        <Text style={[fonts.medium, styles.infoBoxTextBold, { color: isDark ? '#FCD34D' : '#92400E' }]}>{t('docs_review_time_title', 'This usually takes 24–48 hours.')}</Text>
                        <Text style={[fonts.regular, styles.infoBoxText, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>{t('docs_review_time_desc', 'We\'ll notify you once the review is complete.')}</Text>
                     </View>
                   </View>

                   <View style={[styles.infoBoxGray, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
                     <Ionicons name="notifications-outline" size={20} color="#6B7280" />
                     <View style={styles.infoBoxTextContainer}>
                        <Text style={[fonts.regular, styles.infoBoxText, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>{t('docs_review_notify', 'You will receive a notification once there is an update.')}</Text>
                     </View>
                   </View>
                 </>
               )}

               {isRejected && onReupload && (
                 <TouchableOpacity
                   activeOpacity={0.8}
                   style={[styles.reuploadBtn, { backgroundColor: colors.primary }]}
                   onPress={onReupload}
                 >
                   <Ionicons name="cloud-upload-outline" size={20} color="#FFFFFF" />
                   <Text style={[fonts.bold, styles.reuploadBtnText]}>
                     {t('reupload_documents', 'Re-upload Documents')}
                   </Text>
                 </TouchableOpacity>
               )}
             </Animated.View>
          </View>

          <HorizontalTimeline t={t} fonts={fonts} colors={colors} isRejected={isRejected} isDark={isDark} />
        </SafeAreaView>
      </View>
      <HelpCenterModal visible={isHelpVisible} onClose={() => setIsHelpVisible(false)} />
    </Modal>
  );
};

export default WaitingForApprovalModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
    width: '100%',
  },
  headerRow: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 40 : 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 2,
  },
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: SCREEN_HEIGHT * 0.4,
    marginBottom: -80, // Increased overlap effect
    zIndex: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 8,
    position: 'relative',
    zIndex: 2,
    marginBottom: 20,
  },
  iconOverlap: {
    position: 'absolute',
    top: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  title: {
    fontSize: 20,
    color: '#111827',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
    paddingHorizontal: 6,
  },
  infoBoxYellow: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  infoBoxGray: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    width: '100%',
  },
  infoBoxTextContainer: {
    marginLeft: 14,
    flex: 1,
  },
  infoBoxTextBold: {
    fontSize: 14,
    color: '#92400E',
    marginBottom: 4,
  },
  infoBoxText: {
    fontSize: 14,
    color: '#4B5563',
  },
  infoBoxRed: {
    flexDirection: 'row',
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  reuploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 14,
    width: '100%',
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  reuploadBtnText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 8,
  },
  horizontalTimeline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 50 : 80,
    width: '100%',
  },
  timelineStepContainer: {
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  timelineIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  timelineStepText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },
  timelineConnector: {
    position: 'absolute',
    top: 15,
    left: '50%',
    width: '100%',
    height: 2,
    backgroundColor: '#E5E7EB',
    zIndex: 1,
  },
});
