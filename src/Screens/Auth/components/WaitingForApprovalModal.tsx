import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, SafeAreaView, Dimensions, Platform, Image, Animated as RNAnimated, Easing, FlatList } from 'react-native';
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
import { useAppTheme } from '../../../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { HelpCenter_Nav } from '../../../Navigations/navigations';
import { isTamilLanguage } from '../../../utils/languageSizings';
import { ScrollView } from 'react-native';

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

const HorizontalTimeline = ({ t, fonts, colors, isRejected, isDark, isTamil }: { t: any; fonts: any; colors: any; isRejected?: boolean; isDark: boolean; isTamil: boolean }) => {
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
          <Text style={[fonts.medium, styles.timelineStepText, (step.active || step.completed) && { color: colors.text }, { fontSize: isTamil ? 9 : 12 }]} numberOfLines={2} adjustsFontSizeToFit>
            {t(step.key, step.label)}
          </Text>
        </View>
      ))}
    </Animated.View>
  );
};

const getSlides = (t: any) => [
  { id: '1', title: t('pan_card', 'PAN Card'), desc: t('verifying_pan', 'Verifying your permanent account number.'), icon: 'card-outline' },
  { id: '2', title: t('aadhar_card', 'Aadhaar Card'), desc: t('verifying_aadhar', 'Verifying your identity and address.'), icon: 'finger-print-outline' },
  { id: '3', title: t('driving_license', 'Driving License'), desc: t('verifying_dl', 'Ensuring your authorization to drive.'), icon: 'car-sport-outline' },
  { id: '4', title: t('police_verification_optional', 'Police Verification (Optional)'), desc: t('background_check_safety', 'Background check for community safety.'), icon: 'shield-half-outline' },
  { id: '5', title: t('profile_selfie', 'Profile Selfie'), desc: t('matching_identity', 'Matching your identity with documents.'), icon: 'camera-outline' },
  { id: '6', title: t('background_check', 'Background Check'), desc: t('secure_platform_desc', 'Ensuring a secure platform for everyone.'), icon: 'shield-checkmark-outline' },
  { id: '7', title: t('final_review', 'Final Review'), desc: t('almost_there_desc', 'Almost there! Thanks for your patience.'), icon: 'checkmark-circle-outline' },
];

const AutoSwipeVerificationInfo = ({ fonts, isDark, theme }: { fonts: any, isDark: boolean, theme: any }) => {
  const { t } = useTranslation();
  const SLIDES = getSlides(t);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % SLIDES.length;
        flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
        return nextIndex;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleScroll = (event: any) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / (SCREEN_WIDTH - 24)); // margins (12 on each side)
    setCurrentIndex(index);
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.slideContainer, { width: SCREEN_WIDTH - 24 }]}>
      <View style={[styles.slideIconWrapper, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
        <Ionicons name={item.icon} size={24} color={isDark ? '#FFF' : theme.colors.primary} />
      </View>
      <View style={styles.slideTextContainer}>
        <Text style={[fonts.bold, styles.slideTitle, { color: theme.colors.text }]}>{item.title}</Text>
        <Text style={[styles.slideDesc, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>{item.desc}</Text>
      </View>
    </View>
  );

  return (
    <Animated.View entering={FadeInDown.duration(800).delay(250)} style={[styles.carouselCard, { backgroundColor: theme.colors.card }]}>
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
      />
      <View style={styles.paginationContainer}>
        {SLIDES.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              { backgroundColor: currentIndex === index ? theme.colors.primary : (isDark ? '#4B5563' : '#D1D5DB') },
              currentIndex === index && { width: 16 }
            ]}
          />
        ))}
      </View>
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
  const { theme, isDark } = useAppTheme();
  const navigation = useNavigation<any>();
  const isRejected = status === 'rejected';
  const isTamil = isTamilLanguage();

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
          <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>

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
                <Ionicons name={isRejected ? "close" : "time"} size={20} color="#FFFFFF" />
              </View>

              <Text style={[fonts.bold, styles.title, { color: theme.colors.text }]}>
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
                </>
              )}

              {isRejected && onReupload && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.reuploadBtn, { backgroundColor: theme.colors.primary }]}
                  onPress={onReupload}
                >
                  <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
                  <Text style={[fonts.bold, styles.reuploadBtnText]}>
                    {t('reupload_documents', 'Re-upload Documents')}
                  </Text>
                </TouchableOpacity>
              )}
              <View style={[styles.supportCard, { marginHorizontal: 0, marginTop: 8, marginBottom: 0, width: '100%', backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#FFFBEB' }]}>
                <View style={[styles.supportIconWrapper, { backgroundColor: '#F59E0B' }]}>
                  <RNAnimated.View style={{ transform: [{ rotate: spin }] }}>
                    <Ionicons name="refresh" size={20} color="#FFF" />
                  </RNAnimated.View>
                </View>
                <View style={styles.supportTextContent}>
                  <Text style={[fonts.bold, styles.supportTitle, { color: isDark ? '#FCD34D' : '#92400E', fontSize: isTamil ? 13 : 15 }]} numberOfLines={2} adjustsFontSizeToFit>
                    {t('refresh_status', 'Refresh Status')}
                  </Text>
                  <Text style={[styles.supportSubtitle, { color: isDark ? '#FDE68A' : '#B45309', fontSize: isTamil ? 10 : 12 }]} numberOfLines={2} adjustsFontSizeToFit>
                    {t('check_update_desc', 'Check for the latest updates')}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.supportBtn, { backgroundColor: '#F59E0B' }]}
                  onPress={handleRefresh}
                  activeOpacity={0.8}
                >
                  <Text style={[fonts.medium, styles.supportBtnText, { fontSize: isTamil ? 11 : 13 }]} numberOfLines={1} adjustsFontSizeToFit>{t('refresh', 'Refresh')}</Text>
                </TouchableOpacity>
              </View>

              <HorizontalTimeline t={t} fonts={fonts} colors={theme.colors} isRejected={isRejected} isDark={isDark} isTamil={isTamil} />
            </Animated.View>
          </View>

          <AutoSwipeVerificationInfo fonts={fonts} isDark={isDark} theme={theme} />

          <Animated.View entering={FadeInDown.duration(800).delay(300)} style={[styles.supportCard, { backgroundColor: theme.colors.card }]}>
            <View style={[styles.supportIconWrapper, { backgroundColor: theme.colors.primary }]}>
              <Ionicons name="headset-outline" size={20} color="#FFF" />
            </View>
            <View style={styles.supportTextContent}>
              <Text style={[fonts.bold, styles.supportTitle, { color: theme.colors.text, fontSize: isTamil ? 13 : 15 }]} numberOfLines={2} adjustsFontSizeToFit>
                {t('need_help', 'Need Help?')}
              </Text>
              <Text style={[styles.supportSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280', fontSize: isTamil ? 10 : 12 }]} numberOfLines={2} adjustsFontSizeToFit>
                {t('chat_with_support', 'Chat with our support team')}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.supportBtn, { backgroundColor: theme.colors.primary }]}
              onPress={() => navigation.navigate(HelpCenter_Nav)}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubble-outline" size={14} color="#FFF" style={{ marginRight: 4 }} />
              <Text style={[fonts.medium, styles.supportBtnText, { color: '#FFF', fontSize: isTamil ? 11 : 13 }]} numberOfLines={1} adjustsFontSizeToFit>{t('chat_now', 'Chat Now')}</Text>
            </TouchableOpacity>
          </Animated.View>

          </ScrollView>
        </SafeAreaView>
      </View>
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
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
    paddingTop: 20,
  },
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: SCREEN_HEIGHT * 0.28,
    marginBottom: -50, // Reduced overlap effect
    zIndex: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
    zIndex: 2,
    marginBottom: 16,
  },
  iconOverlap: {
    position: 'absolute',
    top: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
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
    fontSize: 18,
    color: '#111827',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 8,
    paddingHorizontal: 6,
  },
  infoBoxYellow: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 8,
    marginBottom: 4,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },

  infoBoxTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  infoBoxTextBold: {
    fontSize: 12,
    color: '#92400E',
    marginBottom: 2,
  },
  infoBoxText: {
    fontSize: 12,
    color: '#4B5563',
  },
  infoBoxRed: {
    flexDirection: 'row',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 8,
    marginBottom: 4,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  reuploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: 12,
    width: '100%',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  reuploadBtnText: {
    fontSize: 15,
    color: '#FFFFFF',
    marginLeft: 6,
  },
  horizontalTimeline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    marginTop: 12,
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
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 50,
    padding: 12,
    borderRadius: 14,
  },
  supportIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  supportTextContent: {
    flex: 1,
    marginLeft: 10,
  },
  supportTitle: {
    fontSize: 15,
    marginBottom: 2,
  },
  supportSubtitle: {
    fontSize: 12,
  },
  supportBtn: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  supportBtnText: {
    color: '#FFF',
    fontSize: 13,
  },
  carouselCard: {
    borderRadius: 14,
    marginHorizontal: 12,
    marginBottom: 16,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'center',
  },
  slideContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  slideIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  slideTextContainer: {
    flex: 1,
  },
  slideTitle: {
    fontSize: 15,
    marginBottom: 4,
  },
  slideDesc: {
    fontSize: 13,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
  dot: {
    height: 6,
    width: 6,
    borderRadius: 3,
    marginHorizontal: 4,
  },
});
