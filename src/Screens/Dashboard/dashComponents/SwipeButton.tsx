import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Animated,
  PanResponder,
  ViewStyle,
} from 'react-native';

import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useHaptic } from '../../../hooks/useHaptic';
import colors from '../../../constant/colors';
import { useAppTheme } from '../../../context/ThemeContext';

type Props = {
  onSwipeSuccess?: () => void;
  title: string;
  thumbIcon?: string;
  activeColor?: string;
  containerStyle?: ViewStyle;
  resetTrigger?: any; // To reset thumb animation manually if needed
  shimmer?: boolean; // Control whether the shimmer animation is active
};


const THUMB_SIZE = 56;

const SwipeButton: React.FC<Props> = ({
  onSwipeSuccess,
  title,
  thumbIcon = 'chevron-double-right',
  activeColor = colors.primary,
  containerStyle,
  resetTrigger,
}) => {
  const { theme, isDark } = useAppTheme();
  const pan = useRef(new Animated.Value(0)).current;
  const [buttonWidth, setButtonWidth] = React.useState(0);
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const { triggerHaptic } = useHaptic();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Shimmer Effect for text
  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();
  }, [shimmerAnim]);


  const swipeRange = buttonWidth ? buttonWidth - THUMB_SIZE - 8 : 0;

  // Keep refs updated so PanResponder closures always have fresh values
  const swipeRangeRef = useRef(swipeRange);
  swipeRangeRef.current = swipeRange;

  const onSwipeSuccessRef = useRef(onSwipeSuccess);
  onSwipeSuccessRef.current = onSwipeSuccess;

  // RESET THUMB when resetTrigger changes
  useEffect(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); }
    // Stop any currently running animation before starting the reset
    pan.stopAnimation();
    Animated.timing(pan, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [resetTrigger, pan]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) { clearTimeout(timerRef.current); }
    };
  }, []);

  // Create PanResponder ONCE via useRef — avoids re-creation on every render
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderMove: (_, g) => {
        const range = swipeRangeRef.current;
        if (g.dx >= 0 && g.dx <= range) {
          pan.setValue(g.dx);
          // Subtle haptic every 30px of movement
          if (Math.floor(g.dx) % 30 === 0 && g.dx > 0) {
            triggerHaptic(HapticFeedbackTypes.impactLight);
          }
        }
      },

      onPanResponderRelease: (_, g) => {
        const range = swipeRangeRef.current;
        if (g.dx > range * 0.75) {
          // SUCCESS SWIPE
          triggerHaptic(HapticFeedbackTypes.notificationSuccess);
          Animated.spring(pan, {
            toValue: range,
            useNativeDriver: true,
          }).start(() => {
            if (onSwipeSuccessRef.current) { onSwipeSuccessRef.current(); }

            // Reset thumb after callback
            timerRef.current = setTimeout(() => {
              pan.stopAnimation();
              Animated.timing(pan, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
              }).start();
            }, 300);
          });
        } else {
          // FAILED SWIPE → reset
          Animated.spring(pan, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  return (
    <View
      style={[{ width: '100%', marginVertical: 6 }, containerStyle]}
      onLayout={(e) => setButtonWidth(e.nativeEvent.layout.width)}
    >
      <View
        style={{
          height: 65,
          width: '100%',
          backgroundColor: isDark ? '#1E293B' : activeColor,
          borderRadius: 32,
          justifyContent: 'center',
          padding: 4,
          overflow: 'hidden',
          borderWidth: isDark ? 1 : 0,
          borderColor: isDark ? '#374151' : 'transparent',
        }}
      >
        {/* Shimmering Text only */}
        <View style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center' }}>
          <Animated.View
            style={{
              opacity: pan.interpolate({
                inputRange: [0, (swipeRange || 1) / 2],
                outputRange: [1, 0],
                extrapolate: 'clamp',
              }),
            }}
          >
            <Text style={{ color: isDark ? theme.colors.text : '#FFF', fontSize: 16, fontWeight: '700' }} numberOfLines={1} adjustsFontSizeToFit>
              {title}
            </Text>
          </Animated.View>
        </View>

        {/* Thumb */}
        <Animated.View
          {...panResponder.panHandlers}
          style={{
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            backgroundColor: isDark ? activeColor : '#FFF',
            borderRadius: 28,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ translateX: pan }],
            zIndex: 10,
          }}
        >
          <MaterialCommunityIcons
            name={thumbIcon}
            size={26}
            color={isDark ? '#FFF' : activeColor}
          />
        </Animated.View>
      </View>
    </View>
  );
};

export default SwipeButton;
