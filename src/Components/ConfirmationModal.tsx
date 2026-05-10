import React, { useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Dimensions,
    Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { BlurView } from '@react-native-community/blur';
import Animated, {
    FadeIn,
    FadeOut,
    ZoomIn,
    ZoomOut,
} from 'react-native-reanimated';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../context/ThemeContext';
import { useHaptic } from '../hooks/useHaptic';
import { ms, vs } from '../lib/scale';

const { width } = Dimensions.get('window');

interface ConfirmationModalProps {
    isVisible: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
    icon?: string;
    singleButton?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isVisible,
    onClose,
    onConfirm,
    title,
    message,
    confirmText,
    cancelText,
    isDestructive = false,
    icon = 'help-circle-outline',
    singleButton = false,
}) => {
    const { t } = useTranslation();
    const { theme, isDark } = useAppTheme();
    const { triggerHaptic } = useHaptic();

    const [layoutReady, setLayoutReady] = React.useState(false);

    useEffect(() => {
        if (!isVisible) {
            setLayoutReady(false);
        }
    }, [isVisible]);

    useEffect(() => {
        if (isVisible) {
            triggerHaptic(HapticFeedbackTypes.impactLight);
        }
    }, [isVisible, triggerHaptic]);

    const handleConfirm = () => {
        triggerHaptic(HapticFeedbackTypes.notificationSuccess);
        onConfirm();
    };

    const handleCancel = () => {
        triggerHaptic(HapticFeedbackTypes.selection);
        onClose();
    };

    return (
        <Modal
            visible={isVisible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View 
                style={styles.overlay}
                onLayout={() => setLayoutReady(true)}
            >
                {Platform.OS === 'ios' ? (
                    <BlurView
                        style={StyleSheet.absoluteFill}
                        blurType="dark"
                        blurAmount={10}
                        reducedTransparencyFallbackColor="black"
                    />
                ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)' }]} />
                )}

                <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    activeOpacity={1}
                    onPress={onClose}
                />
                
                {layoutReady && (
                    <Animated.View
                        entering={ZoomIn.springify().mass(1).stiffness(100).damping(15)}
                        exiting={ZoomOut.duration(200)}
                        style={[
                            styles.modalContainer,
                            {
                                backgroundColor: isDark ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.98)',
                                borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)',
                            }
                        ]}
                    >
                        {/* Status Icon with Glow */}
                        <View style={styles.iconContainer}>
                            <View style={[
                                styles.iconGlow,
                                { backgroundColor: isDestructive ? '#EF4444' : theme.colors.primary }
                            ]} />
                            <View style={[
                                styles.iconWrapper,
                                {
                                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
                                    borderColor: isDestructive ? 'rgba(239, 68, 68, 0.2)' : 'rgba(37, 99, 235, 0.1)',
                                    borderWidth: 1,
                                }
                            ]}>
                                <Ionicons
                                    name={icon}
                                    size={ms(34)}
                                    color={isDestructive ? '#EF4444' : theme.colors.primary}
                                />
                            </View>
                        </View>

                        {/* Content */}
                        <Text style={[styles.title, { color: theme.colors.text }]}>
                            {title}
                        </Text>
                        <Text style={[styles.message, { color: isDark ? '#D1D5DB' : '#6B7280' }]}>
                            {message}
                        </Text>

                        {/* Buttons */}
                        <View style={styles.buttonContainer}>
                            {!singleButton && (
                                <TouchableOpacity
                                    onPress={handleCancel}
                                    style={[
                                        styles.button,
                                        styles.cancelButton,
                                        {
                                            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6',
                                        }
                                    ]}
                                >
                                    <Text style={[styles.cancelText, { color: isDark ? '#FFFFFF' : '#4B5563' }]}>
                                        {cancelText || t('cancel')}
                                    </Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                onPress={handleConfirm}
                                style={styles.confirmButtonWrapper}
                            >
                                <LinearGradient
                                    colors={isDestructive ? ['#EF4444', '#DC2626'] : ['#2563EB', '#1D4ED8']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.button}
                                >
                                    <Text style={styles.confirmText}>
                                        {confirmText || (singleButton ? t('common.ok') : t('confirm'))}
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    modalContainer: {
        width: width * 0.85,
        borderRadius: ms(28),
        padding: ms(24),
        alignItems: 'center',
        borderWidth: 1,
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
    },
    iconContainer: {
        width: ms(72),
        height: ms(72),
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: vs(20),
        position: 'relative',
    },
    iconGlow: {
        position: 'absolute',
        width: ms(40),
        height: ms(40),
        borderRadius: ms(20),
        opacity: 0.15,
        transform: [{ scale: 1.8 }],
    },
    iconWrapper: {
        width: ms(64),
        height: ms(64),
        borderRadius: ms(32),
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    title: {
        fontSize: ms(20),
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: vs(8),
        letterSpacing: -0.5,
    },
    message: {
        fontSize: ms(15),
        textAlign: 'center',
        lineHeight: ms(22),
        marginBottom: vs(24),
    },
    buttonContainer: {
        flexDirection: 'row',
        width: '100%',
        gap: ms(12),
    },
    button: {
        flex: 1,
        height: vs(48),
        borderRadius: ms(16),
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelButton: {
        // Styles defined in render
    },
    confirmButtonWrapper: {
        flex: 1,
    },
    cancelText: {
        fontSize: ms(15),
        fontWeight: '700',
    },
    confirmText: {
        color: '#FFFFFF',
        fontSize: ms(15),
        fontWeight: '700',
    },
});

export default ConfirmationModal;
