import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    runOnJS,
    interpolate,
    Extrapolate,
} from 'react-native-reanimated';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { mS as ms } from '../../../lib/scale';

interface SwipeToArriveProps {
    onSwipeComplete: () => void;
    title: string;
    theme: any;
    disabled?: boolean;
}

const BUTTON_WIDTH = Dimensions.get('window').width - ms(40);
const BUTTON_HEIGHT = ms(64);
const SWIPE_RANGE = BUTTON_WIDTH - BUTTON_HEIGHT - ms(8);

const SwipeToArrive: React.FC<SwipeToArriveProps> = ({ onSwipeComplete, title, theme, disabled }) => {
    const translateX = useSharedValue(0);
    const contextX = useSharedValue(0);
    const [completed, setCompleted] = useState(false);

    const panGesture = Gesture.Pan()
        .enabled(!disabled && !completed)
        .onStart(() => {
            contextX.value = translateX.value;
        })
        .onUpdate((event) => {
            let newX = contextX.value + event.translationX;
            if (newX < 0) {newX = 0;}
            if (newX > SWIPE_RANGE) {newX = SWIPE_RANGE;}
            translateX.value = newX;
        })
        .onEnd(() => {
            if (translateX.value > SWIPE_RANGE * 0.8) {
                translateX.value = withSpring(SWIPE_RANGE);
                runOnJS(setCompleted)(true);
                runOnJS(onSwipeComplete)();
            } else {
                translateX.value = withSpring(0);
            }
        });

    const animatedThumbStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    const animatedTextStyle = useAnimatedStyle(() => ({
        opacity: interpolate(translateX.value, [0, SWIPE_RANGE * 0.5], [1, 0], Extrapolate.CLAMP),
        transform: [{ translateX: translateX.value / 2 }],
    }));

    const animatedProgressStyle = useAnimatedStyle(() => ({
        width: translateX.value + BUTTON_HEIGHT,
    }));

    return (
        <View style={[
            styles.container,
            { backgroundColor: theme.colors.border, opacity: disabled ? 0.5 : 1 },
        ]}>
            <Animated.View style={[
                styles.progress,
                { backgroundColor: theme.colors.success || '#10B981' },
                animatedProgressStyle,
            ]} />

            <Animated.View style={[styles.textContainer, animatedTextStyle]}>
                <Text style={[styles.text, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{title}</Text>
            </Animated.View>

            <GestureDetector gesture={panGesture}>
                <Animated.View style={[styles.thumb, animatedThumbStyle]}>
                    <View style={[styles.thumbInner, { backgroundColor: '#FFF' }]}>
                        <Ionicons
                            name={completed ? 'checkmark' : 'chevron-forward'}
                            size={ms(24)}
                            color={theme.colors.success || '#10B981'}
                        />
                    </View>
                </Animated.View>
            </GestureDetector>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: BUTTON_WIDTH,
        height: BUTTON_HEIGHT,
        borderRadius: BUTTON_HEIGHT / 2,
        justifyContent: 'center',
        padding: ms(4),
        overflow: 'hidden',
    },
    progress: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: BUTTON_HEIGHT / 2,
    },
    thumb: {
        width: BUTTON_HEIGHT - ms(8),
        height: BUTTON_HEIGHT - ms(8),
        borderRadius: (BUTTON_HEIGHT - ms(8)) / 2,
        zIndex: 10,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    thumbInner: {
        flex: 1,
        borderRadius: (BUTTON_HEIGHT - ms(8)) / 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textContainer: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5,
    },
    text: {
        fontSize: ms(16),
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
});

export default SwipeToArrive;
