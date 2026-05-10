import { View, Text, StyleSheet, Animated, FlatList, Dimensions, TouchableOpacity, Platform, Modal, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppStatusBar from '../../Components/AppStatusBar';
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';

// import Button from '../../Components/Button';

import {
  Dashboard_Nav,
  DocumentScreen_Nav,
  OnboardingSos_Nav,
} from '../../Navigations/navigations';

import HelpCenterModal from './HelpCenterModal';
import OnboardingBackground from './components/OnboardingBackground';
import { useTranslation } from 'react-i18next';

import Page1 from './pages/Page1';
import Page2 from './pages/Page2';
import Page3 from './pages/Page3';
import Page4 from './pages/Page4';
import Page5 from './pages/Page5';
import Page6 from './pages/Page6';

import { hS, vS, mS } from '../../lib/scale';
import { useTheme } from '@react-navigation/native';
import AnimatedReanimated, {
  FadeIn,
  FadeInDown,
  BounceIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Ionicons from 'react-native-vector-icons/Ionicons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const pages = [
  <Page1 />,
  <Page2 />,
  <Page3 />,
  <Page4 />,
  <Page5 />,
  <Page6 />,
];

const AUTO_TIME = 8000;

const Onboarding = ({ navigation }: any) => {
  const flatRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [index, setIndex] = useState(0);
  const [helpVisible, setHelpVisible] = useState(false);
  const [showCongratsModal, setShowCongratsModal] = useState(false);
  const { colors } = useTheme() as any;
  const { t } = useTranslation();

  // Pulse animation for brand text
  const pulseValue = useSharedValue(1);

  useEffect(() => {
    pulseValue.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1500 }),
        withTiming(1, { duration: 1500 }),
      ),
      -1,
      true,
    );
  }, [pulseValue]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseValue.value }],
  }));

  // Typewriter animation
  const words = useMemo(() => ['VDrive', 'Partner', 'Future', 'Flexibility', 'Success', 'Reliability', 'Growth'], []);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const typingSpeed = 140;
  const deletingSpeed = 70;
  const pauseTime = 1500;

  useEffect(() => {
    const handleType = () => {
      const currentWord = words[currentWordIndex];
      if (isDeleting) {
        if (displayText === '') {
          setIsDeleting(false);
          setCurrentWordIndex((prev) => (prev + 1) % words.length);
          return;
        }
        setDisplayText(currentWord.substring(0, displayText.length - 1));
      } else {
        if (displayText === currentWord) {
          setTimeout(() => setIsDeleting(true), pauseTime);
          return;
        }
        setDisplayText(currentWord.substring(0, displayText.length + 1));
      }
    };

    const timer = setTimeout(handleType, isDeleting ? deletingSpeed : typingSpeed);
    return () => clearTimeout(timer);
  }, [displayText, isDeleting, currentWordIndex, words]);

  useFocusEffect(
    useCallback(() => {
      const backAction = () => {
        // Prevent back button from doing anything on this screen
        return true;
      };
      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        backAction,
      );
      return () => backHandler.remove();
    }, [])
  );

  useEffect(() => {
    const route = navigation.getState().routes.find((r: any) => r.name === 'Onboarding_Nav');
    if (route?.params?.showCongrats) {
      setShowCongratsModal(true);
      navigation.setParams({ showCongrats: undefined });
    }
  }, [navigation]);

  useEffect(() => {
    if (__DEV__) { console.log('[Onboarding] Mounted'); }
    return () => { if (__DEV__) { console.log('[Onboarding] Unmounted'); } };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const nextIndex = index === pages.length - 1 ? 0 : index + 1;

      flatRef.current?.scrollToIndex({
        index: nextIndex,
        animated: true,
      });
      setIndex(nextIndex);
    }, AUTO_TIME);

    return () => clearInterval(interval);
  }, [index]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <AppStatusBar forceDark />
      <OnboardingBackground>
        <View style={styles.container}>
          {/* HEADER */}
          <View style={styles.headerContainer}>


            <View style={styles.titleWrapper}>
              <Text style={styles.title}>{t('welcome_to', 'Welcome to ')}</Text>
              <AnimatedReanimated.View
                entering={BounceIn.duration(1000).delay(200)}
                style={styles.brandWrapper}
              >
                <AnimatedReanimated.View style={pulseStyle}>
                  <Text style={styles.brand}>{displayText}</Text>
                </AnimatedReanimated.View>
              </AnimatedReanimated.View>
            </View>

            <AnimatedReanimated.Text
              entering={FadeInDown.duration(800).delay(300)}
              style={styles.subtitle}
            >
              VDrive Partner App
            </AnimatedReanimated.Text>

            <AnimatedReanimated.Text
              entering={FadeInDown.duration(800).delay(500)}
              style={styles.tagline}
              adjustsFontSizeToFit
              numberOfLines={2}
            >
              {t('onboarding_tagline', 'Your trusted platform to earn, drive, and grow with confidence.')}
            </AnimatedReanimated.Text>

            <AnimatedReanimated.View
              entering={FadeIn.duration(800).delay(800)}
              style={{ alignSelf: 'flex-end' }}
            >
              <TouchableOpacity
                style={styles.helpButton}
                activeOpacity={0.8}
                onPress={() => setHelpVisible(true)}
              >
                <Ionicons name="headset-outline" size={mS(12)} color="#4B5563" style={{ marginRight: hS(4) }} />
                <Text style={styles.helpText}>{t('help_center', 'Help Center')}</Text>
              </TouchableOpacity>
            </AnimatedReanimated.View>
          </View>

          {/* PAGES */}
          <View style={styles.pagesContainer}>
            <FlatList
              ref={flatRef}
              data={pages}
              horizontal
              pagingEnabled
              bounces={false}
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, idx) => idx.toString()}
              renderItem={({ item }) => (
                <View style={{ width: SCREEN_WIDTH, justifyContent: 'center' }}>
                  {item}
                </View>
              )}
              onMomentumScrollEnd={(e) => {
                const newIndex = Math.round(
                  e.nativeEvent.contentOffset.x / SCREEN_WIDTH
                );
                setIndex(newIndex);
              }}
            />
          </View>

          {/* DOT INDICATORS */}
          <View style={styles.dotsContainer}>
            {pages.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      i === index ? '#2563EB' : 'rgba(0, 0, 0, 0.15)',
                  },
                ]}
              />
            ))}
          </View>

          {/* BOTTOM CTA */}
          <View style={styles.bottomContainer}>
            <TouchableOpacity
              style={[styles.verificationButton, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
              onPress={() => navigation.navigate(DocumentScreen_Nav)}
            >
              <Text style={styles.verificationButtonText}>
                {t('verify_docs_to_start', 'Verify Documents to Start Earning')}
              </Text>
              <Ionicons name="shield-checkmark" size={15} color="#FFF" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </View>

          <HelpCenterModal
            visible={helpVisible}
            onClose={() => setHelpVisible(false)}
          />

          {/* CONGRATS MODAL */}
          <Modal
            visible={showCongratsModal}
            animationType="fade"
            transparent={true}
          >
            <View style={styles.congratsOverlay}>
              <AnimatedReanimated.View
                entering={FadeIn.duration(400)}
                style={styles.congratsBackdrop}
              >
                <TouchableOpacity
                  activeOpacity={1}
                  style={{ flex: 1 }}
                  onPress={() => setShowCongratsModal(false)}
                />
              </AnimatedReanimated.View>
              <AnimatedReanimated.View
                entering={FadeInDown.springify().damping(15)}
                style={[styles.congratsContent, { backgroundColor: colors.card }]}
              >
                <View style={styles.congratsIconContainer}>
                  <AnimatedReanimated.View
                    entering={FadeInDown.delay(200).springify()}
                    style={[styles.checkCircle, { backgroundColor: colors.primary + '15' }]}
                  >
                    <Ionicons name="checkmark-circle" size={60} color={colors.primary} />
                  </AnimatedReanimated.View>
                </View>

                <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.congratsTitle, { color: colors.text }]}>
                  {t('registration_finished', 'Registration Finished!')}
                </Text>

                <Text adjustsFontSizeToFit numberOfLines={3} style={[styles.congratsSubtitle, { color: colors.text + '99' }]}>
                  {t('registration_finished_desc', 'Your profile details are saved. The final step to start earning is to upload your documents for verification.')}
                </Text>

                <TouchableOpacity
                  style={[styles.verifyButton, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    setShowCongratsModal(false);
                    navigation.navigate(DocumentScreen_Nav);
                  }}
                >
                  <Text adjustsFontSizeToFit numberOfLines={1} style={styles.verifyButtonText}>
                    {t('start_verification', 'Start Verification')}
                  </Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFF" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.maybeLater}
                  onPress={() => {
                    setShowCongratsModal(false);
                  }}
                >
                  <Text style={[styles.maybeLaterText, { color: colors.text + '60' }]}>
                    Maybe Later
                  </Text>
                </TouchableOpacity>
              </AnimatedReanimated.View>
            </View>
          </Modal>
        </View>
      </OnboardingBackground>
    </SafeAreaView>
  );
};

export default Onboarding;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  /* HEADER */
  headerContainer: {
    paddingTop: vS(8),
    paddingHorizontal: hS(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandWrapper: {
    marginLeft: hS(6),
    width: hS(140), // Fixed width to keep 'Welcome to' stable in centered Row
    alignItems: 'flex-start',
  },
  titleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  title: {
    fontSize: mS(18),
    fontWeight: '600',
    textAlign: 'center',
    color: '#4B5563',
  },
  brand: {
    fontSize: mS(22),
    fontWeight: '800',
    color: '#2563EB',
    textAlign: 'left', // Left align inside the fixed-width wrapper
  },
  subtitle: {
    fontSize: mS(14),
    textAlign: 'center',
    color: '#1F2937',
    marginTop: vS(2),
  },
  tagline: {
    marginTop: vS(4),
    textAlign: 'center',
    color: '#6B7280',
    fontSize: mS(12),
    marginBottom: vS(6),
  },
  helpButton: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    paddingHorizontal: hS(14),
    paddingVertical: vS(6),
    borderRadius: mS(20),
    marginTop: vS(4),
  },
  helpText: {
    color: '#4B5563',
    fontWeight: '600',
    fontSize: mS(10),
  },

  /* PAGES */
  pagesContainer: {
    flex: 1,
  },

  /* DOTS */
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: vS(5),
    marginTop: vS(5),
  },
  dot: {
    width: mS(8),
    height: mS(8),
    borderRadius: mS(4),
    marginHorizontal: hS(3),
  },

  /* BOTTOM */
  bottomContainer: {
    paddingHorizontal: hS(20),
    paddingBottom: Platform.OS === 'android' ? vS(30) : vS(15),
  },
  button: {
    marginTop: vS(20),
    height: vS(56),
    width: hS(320),
    alignSelf: 'center',
    borderRadius: mS(12),
  },
  congratsOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  congratsBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  congratsContent: {
    width: '90%',
    borderRadius: mS(24),
    padding: mS(30),
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  congratsIconContainer: {
    marginBottom: vS(20),
  },
  checkCircle: {
    width: mS(100),
    height: mS(100),
    borderRadius: mS(50),
    justifyContent: 'center',
    alignItems: 'center',
  },
  congratsTitle: {
    fontSize: mS(24),
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: vS(12),
  },
  congratsSubtitle: {
    fontSize: mS(16),
    textAlign: 'center',
    lineHeight: vS(24),
    marginBottom: vS(30),
    paddingHorizontal: hS(10),
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: vS(16),
    paddingHorizontal: hS(24),
    borderRadius: mS(16),
    width: '100%',
    justifyContent: 'center',
  },
  verifyButtonText: {
    color: '#FFF',
    fontSize: mS(18),
    fontWeight: '700',
    marginRight: hS(10),
  },
  maybeLater: {
    marginTop: vS(20),
    paddingVertical: vS(10),
  },
  maybeLaterText: {
    fontSize: mS(14),
    fontWeight: '500',
  },
  verificationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: vS(16),
    paddingHorizontal: hS(20),
    borderRadius: mS(12),
    width: 320,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  verificationButtonText: {
    color: '#FFF',
    fontSize: mS(13),
    fontWeight: '500',
  },
  premiumButtonWrapper: {
    marginTop: vS(12),
    borderRadius: mS(16),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  premiumButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: vS(16),
    paddingHorizontal: hS(24),
  },
  premiumButtonText: {
    color: '#FFF',
    fontSize: mS(16),
    fontWeight: '700',
  },
});
