import React, { useEffect, useState } from 'react';
import { View, StyleSheet, StatusBar, Dimensions, Text } from 'react-native';
import LottieView from 'lottie-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  withRepeat,
  interpolate,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import fonts from '../../constant/fonts';
import { useAppTheme } from '../../context/ThemeContext';
import pkg from '../../../package.json';

const { width } = Dimensions.get('window');

const SplashScreen = () => {
  const { t } = useTranslation();
  const { isDark } = useAppTheme();
  const [statusIndex, setStatusIndex] = useState(0);

  // Animation values
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.8);
  const logoTranslateY = useSharedValue(20);
  const taglineOpacity = useSharedValue(0);
  const taglineTranslateY = useSharedValue(15);
  const shimmerPosition = useSharedValue(-1);
  const mapPulse = useSharedValue(1);
  const mapOpacity = useSharedValue(0.02);
  const footerOpacity = useSharedValue(0);

  const loadingStatuses = React.useMemo(() => [
    t('device_initializing'),
    t('security_disclaimer'),
    t('loading_dashboard'),
  ], [t]);

  useEffect(() => {
    // Start entrance animations
    logoOpacity.value = withTiming(1, { duration: 1500, easing: Easing.out(Easing.exp) });
    logoScale.value = withTiming(1, { duration: 1500, easing: Easing.out(Easing.exp) });
    logoTranslateY.value = withTiming(0, { duration: 1500, easing: Easing.out(Easing.exp) });

    taglineOpacity.value = withDelay(1000, withTiming(1, { duration: 1000 }));
    taglineTranslateY.value = withDelay(1000, withTiming(0, { duration: 1000, easing: Easing.out(Easing.quad) }));

    footerOpacity.value = withDelay(1500, withTiming(1, { duration: 800 }));

    // Shimmer effect
    shimmerPosition.value = withRepeat(
      withTiming(2, { duration: 3000, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
      -1,
      false
    );

    // More organic "Breathing" Map effect
    mapPulse.value = withRepeat(
      withTiming(1.15, { duration: 6000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    mapOpacity.value = withRepeat(
      withTiming(0.06, { duration: 6000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );

    // Rotate loading status
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % loadingStatuses.length);
    }, 3500);

    return () => clearInterval(interval);

  }, [logoOpacity, logoTranslateY, taglineOpacity, taglineTranslateY, shimmerPosition, logoScale, footerOpacity, mapPulse, mapOpacity, loadingStatuses.length]);

  const animatedLogoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [
      { translateY: logoTranslateY.value },
      { scale: logoScale.value }
    ],
  }));

  const animatedTaglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [{ translateY: taglineTranslateY.value }],
  }));

  const animatedShimmerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(shimmerPosition.value, [-1, 2], [-width, width]),
      },
    ],
  }));

  const animatedMapStyle = useAnimatedStyle(() => ({
    opacity: mapOpacity.value,
    transform: [{ scale: mapPulse.value }],
  }));

  const animatedFooterStyle = useAnimatedStyle(() => ({
    opacity: footerOpacity.value,
  }));

  // Theme Constants
  const themeColors = {
    background: isDark ? ['#050B18', '#0B172A', '#0F172A'] : ['#FFFFFF', '#F8FAFC', '#F1F5F9'],
    text: isDark ? '#FFFFFF' : '#0B172A',
    tagline: isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(11, 23, 42, 0.85)',
    shimmer: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.45)',
    statusBar: isDark ? 'light-content' : 'dark-content',
    versionText: isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(11, 23, 42, 0.45)',
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#050B18' : '#FFFFFF' }]} edges={['top', 'bottom']}>
      <StatusBar animated={false} translucent backgroundColor="transparent" barStyle={themeColors.statusBar as any} />

      {/* Premium Gradient Background */}
      <LinearGradient
        colors={themeColors.background}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Subtle Map Texture Overlay with Pulse */}
      <Animated.Image
        source={require('../../assets/images/map6.png')}
        style={[StyleSheet.absoluteFill, animatedMapStyle, { tintColor: isDark ? '#4F86FF' : '#000000' }]}
        resizeMode="cover"
      />

      <View style={styles.content}>
        <View style={styles.animationContainer}>
          <LottieView
            source={require('../../assets/animation/splash-screen.json')}
            autoPlay
            loop
            style={styles.lottie}
          />
        </View>

        <View style={styles.footer}>
          {/* Brand Text with Masked Shimmer */}
          <MaskedView
            style={styles.maskedContainer}
            maskElement={
              <View style={styles.maskElementContainer}>
                <Animated.Text style={[styles.brandText, animatedLogoStyle]}>
                  VDrive
                </Animated.Text>
              </View>
            }
          >
            {/* Base Logo Color */}
            <View style={[styles.shimmerBase, { backgroundColor: themeColors.text }]} />

            {/* Animated Shimmer Glint */}
            <Animated.View style={[StyleSheet.absoluteFill, animatedShimmerStyle]}>
              <LinearGradient
                colors={['transparent', themeColors.shimmer, 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </MaskedView>

          <Animated.Text style={[styles.tagline, { color: themeColors.tagline }, animatedTaglineStyle]}>
            {t('premium_tagline')}
          </Animated.Text>
        </View>
      </View>

      {/* Production Level Footer Details */}
      <Animated.View style={[styles.versionContainer, animatedFooterStyle]}>
        <Text style={[styles.statusText, { color: themeColors.versionText }]}>
          {loadingStatuses[statusIndex]}
        </Text>
        <Text style={[styles.versionText, { color: themeColors.versionText }]}>
          Version {pkg.version}
        </Text>
      </Animated.View>
    </SafeAreaView>
  );
};

export default SplashScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingBottom: 40, // Space from bottom elements
  },
  animationContainer: {
    width: width,
    height: width * 0.9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lottie: {
    width: width * 0.95,
    height: width * 0.95,
  },
  footer: {
    marginTop: 20, // Reduced space from animation
    alignItems: 'center',
    width: width,
  },
  maskedContainer: {
    height: 70,
    width: width,
    justifyContent: 'center',
    alignItems: 'center',
  },
  maskElementContainer: {
    flex: 1,
    width: width,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shimmerBase: {
    height: '100%',
    width: '100%',
  },
  brandText: {
    fontSize: 52,
    ...fonts.heavy,
    textAlign: 'center',
    letterSpacing: -1.5,
  },
  tagline: {
    fontSize: 15,
    ...fonts.bold,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  versionContainer: {
    position: 'absolute',
    bottom: 50,
    alignItems: 'center',
    width: width,
    paddingHorizontal: 20,
  },
  statusText: {
    fontSize: 12,
    ...fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 6,
    textAlign: 'center',
    opacity: 0.8,
  },
  versionText: {
    fontSize: 13,
    ...fonts.medium,
    opacity: 0.5,
  },
});
