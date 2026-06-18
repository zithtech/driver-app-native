import React, { useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { ms, s, vs } from '../../../lib/scale';
import { useAppTheme } from '../../../context/ThemeContext';

interface GoOfflineTabProps {
    onPress: () => void;
}

const GoOfflineTab: React.FC<GoOfflineTabProps> = React.memo(({ onPress }) => {
    const { theme, isDark } = useAppTheme();
    const { t } = useTranslation();

    // ── Animation Values ──
    const translateY = useRef(new Animated.Value(-vs(40))).current;
    const scale = useRef(new Animated.Value(1)).current;
    const pulseOpacity = useRef(new Animated.Value(1)).current; // Opacity pulse for the "Live" effect

    useEffect(() => {
        // High-impact spring entrance
        Animated.spring(translateY, {
            toValue: 0,
            friction: 6,
            tension: 40,
            useNativeDriver: true,
        }).start();

        // Slow, subtle "Live" pulse (1.0 to 0.85)
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseOpacity, {
                    toValue: 0.85,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseOpacity, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [translateY, pulseOpacity]);

    const handlePressIn = () => {
        Animated.spring(scale, {
            toValue: 0.95,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scale, {
            toValue: 1,
            friction: 3,
            tension: 40,
            useNativeDriver: true,
        }).start();
    };

    // ── Trapezoid Dimensions (Precision Join + Smooth Curves) ──
    const topWidth = s(140);
    const bottomWidth = s(100);
    const height = vs(34);
    const diff = (topWidth - bottomWidth) / 2;

    const d = `
        M 0 0 
        H ${topWidth}
        L ${topWidth - diff + s(5)} ${height - vs(7)}
        Q ${topWidth - diff} ${height} ${topWidth - diff - s(10)} ${height}
        H ${diff + s(10)}
        Q ${diff} ${height} ${diff - s(5)} ${height - vs(7)}
        L 0 0
        Z
    `;

    const headerBgColor = isDark ? theme.colors.card : '#F5F6FA';
    const strokeColor = isDark ? theme.colors.border : '#E2E8F0';

    return (
        <Animated.View style={[styles.container, { transform: [{ translateY }, { scale }] }]}>
            <TouchableOpacity
                activeOpacity={1}
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                style={styles.touchable}
            >
                <View style={styles.svgWrapper}>
                    <Svg width={topWidth} height={height} viewBox={`0 0 ${topWidth} ${height}`}>
                        <Path
                            d={d}
                            fill={headerBgColor}
                            stroke={strokeColor}
                            strokeWidth="1"
                        />
                        {/* Match the header baseline exactly at the join point */}
                        <Path
                            d={`M 0 0 H ${topWidth}`}
                            stroke={headerBgColor}
                            strokeWidth="2"
                        />
                    </Svg>
                </View>
                <View style={[styles.contentOverlay, { width: topWidth, height }]}>
                    <View style={styles.content}>
                        <Animated.Text style={[styles.text, { opacity: pulseOpacity }]} numberOfLines={1} adjustsFontSizeToFit>
                            {t('go_offline').toUpperCase()}
                        </Animated.Text>
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
});

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        zIndex: 100,
    },
    touchable: {
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
    },
    svgWrapper: {
        // SVG base layer
    },
    contentOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: vs(2),
    },
    text: {
        fontSize: ms(11),
        fontWeight: '900',
        color: '#DC2626',
        letterSpacing: 0.8,
    },
});

export default GoOfflineTab;
