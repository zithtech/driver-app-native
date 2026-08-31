import React, { useEffect } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useAppTheme } from '../../../context/ThemeContext';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    Easing
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface OnboardingBackgroundProps {
    children: React.ReactNode;
}

const OnboardingBackground: React.FC<OnboardingBackgroundProps> = ({ children }) => {
    const { isDark, theme } = useAppTheme();
    const blob1Pos = useSharedValue({ x: SCREEN_WIDTH * 0.1, y: SCREEN_HEIGHT * 0.2 });
    const blob2Pos = useSharedValue({ x: SCREEN_WIDTH * 0.7, y: SCREEN_HEIGHT * 0.6 });
    const blob3Pos = useSharedValue({ x: SCREEN_WIDTH * 0.4, y: SCREEN_HEIGHT * 0.4 });

    useEffect(() => {
        // Animate blobs for a "living" mesh effect
        const duration = 20000;

        blob1Pos.value = withRepeat(
            withSequence(
                withTiming({ x: SCREEN_WIDTH * 0.3, y: SCREEN_HEIGHT * 0.1 }, { duration, easing: Easing.inOut(Easing.sin) }),
                withTiming({ x: SCREEN_WIDTH * 0.1, y: SCREEN_HEIGHT * 0.2 }, { duration, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );

        blob2Pos.value = withRepeat(
            withSequence(
                withTiming({ x: SCREEN_WIDTH * 0.5, y: SCREEN_HEIGHT * 0.8 }, { duration: duration * 1.2, easing: Easing.inOut(Easing.sin) }),
                withTiming({ x: SCREEN_WIDTH * 0.7, y: SCREEN_HEIGHT * 0.6 }, { duration: duration * 1.2, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );

        blob3Pos.value = withRepeat(
            withSequence(
                withTiming({ x: SCREEN_WIDTH * 0.2, y: SCREEN_HEIGHT * 0.5 }, { duration: duration * 1.5, easing: Easing.inOut(Easing.sin) }),
                withTiming({ x: SCREEN_WIDTH * 0.4, y: SCREEN_HEIGHT * 0.3 }, { duration: duration * 1.5, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );
    }, [blob1Pos, blob2Pos, blob3Pos]);

    const blob1Style = useAnimatedStyle(() => ({
        transform: [
            { translateX: blob1Pos.value.x },
            { translateY: blob1Pos.value.y }
        ],
    }));

    const blob2Style = useAnimatedStyle(() => ({
        transform: [
            { translateX: blob2Pos.value.x },
            { translateY: blob2Pos.value.y }
        ],
    }));

    const blob3Style = useAnimatedStyle(() => ({
        transform: [
            { translateX: blob3Pos.value.x },
            { translateY: blob3Pos.value.y }
        ],
    }));

    return (
        <View style={[styles.container, { backgroundColor: isDark ? theme.colors.background : '#FFFFFF' }]}>
            {/* BASE GRADIENT */}
            <LinearGradient
                colors={isDark ? ['#111827', '#1F2937', '#111827'] : ['#FFFFFF', '#F8FAFC', '#F1F5F9']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />

            {/* BLURRED MESH BLOBS */}
            <Animated.View style={[styles.blob, styles.blob1, blob1Style]} />
            <Animated.View style={[styles.blob, styles.blob2, blob2Style]} />
            <Animated.View style={[styles.blob, styles.blob3, blob3Style]} />

            {/* OVERLAY FOR TEXT READABILITY */}
            <View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: isDark ? 'rgba(17, 24, 39, 0.7)' : 'rgba(255, 255, 255, 0.4)' }]} />

            {/* CONTENT */}
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF', // Fallback
    },
    blob: {
        position: 'absolute',
        width: mS(300),
        height: mS(300),
        borderRadius: mS(150),
        opacity: 0.15, // Light Opacity for light theme
    },
    blob1: {
        backgroundColor: '#3b82f6', // Keep blue but opacity makes it pastel
        top: -mS(100),
        left: -mS(100),
    },
    blob2: {
        backgroundColor: '#8b5cf6', // Violet
        bottom: -mS(50),
        right: -mS(50),
    },
    blob3: {
        backgroundColor: '#06b6d4', // Cyan
        top: SCREEN_HEIGHT * 0.3,
        left: SCREEN_WIDTH * 0.2,
        width: mS(200),
        height: mS(200),
    },
    overlay: {
        backgroundColor: 'rgba(255, 255, 255, 0.4)', // Light tint to help text readability
    },
});

export default OnboardingBackground;

// Scale mock – usually you'd import this but I'll define local helpers if needed, 
// however since I know the project has ../../../lib/scale, I should import it.
import { mS } from '../../../lib/scale';
