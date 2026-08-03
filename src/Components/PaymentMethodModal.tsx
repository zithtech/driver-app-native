import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Dimensions,
    Platform,
    ActivityIndicator,
    TextInput,
    Alert,
    ImageBackground,
    StatusBar,
    KeyboardAvoidingView,
    TouchableWithoutFeedback,
    Keyboard
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut, SlideInRight, SlideOutLeft, SlideInLeft, SlideOutRight } from 'react-native-reanimated';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../context/ThemeContext';
import { useHaptic } from '../hooks/useHaptic';
import { ms, vs } from '../lib/scale';

const { width } = Dimensions.get('window');

interface PaymentMethodModalProps {
    isVisible: boolean;
    onClose: () => void;
    amountToPay: number;
    walletBalance: number;
    hasWalletPin: boolean;
    onSelectWallet: (pin: string) => void;
    onSelectRazorpay: () => void;
    onSetupPin: () => void;
    isProcessing?: boolean;
}

const PaymentMethodModal: React.FC<PaymentMethodModalProps> = ({
    isVisible,
    onClose,
    amountToPay,
    walletBalance,
    hasWalletPin,
    onSelectWallet,
    onSelectRazorpay,
    onSetupPin,
    isProcessing = false,
}) => {
    const { t } = useTranslation();
    const { theme, isDark } = useAppTheme();
    const { triggerHaptic } = useHaptic();
    const [step, setStep] = useState<'selection' | 'pin'>('selection');
    const [pin, setPin] = useState('');
    const [isPinVisible, setIsPinVisible] = useState(false);

    useEffect(() => {
        if (!isVisible) {
            setStep('selection');
            setPin('');
            setIsPinVisible(false);
        }
    }, [isVisible]);

    useEffect(() => {
        if (isVisible) {
            triggerHaptic(HapticFeedbackTypes.impactLight);
        }
    }, [isVisible, triggerHaptic]);

    const handleWalletSelect = () => {
        triggerHaptic(HapticFeedbackTypes.selection);
        if (!hasWalletPin) {
            Alert.alert(
                t('Setup Wallet PIN'),
                t('You need to set up a 4-digit Wallet PIN to securely authorize payments. Would you like to set it up now?'),
                [
                    { text: t('Cancel'), style: 'cancel' },
                    {
                        text: t('Setup PIN'),
                        onPress: () => {
                            onClose();
                            onSetupPin();
                        }
                    }
                ]
            );
            return;
        }
        setStep('pin');
    };

    const handleConfirmWallet = () => {
        if (pin.length !== 4) return;
        triggerHaptic(HapticFeedbackTypes.notificationSuccess);
        onSelectWallet(pin);
    };

    const handleRazorpaySelect = () => {
        triggerHaptic(HapticFeedbackTypes.selection);
        onSelectRazorpay();
    };

    const handleBack = () => {
        triggerHaptic(HapticFeedbackTypes.selection);
        setStep('selection');
        setPin('');
    };

    const insets = useSafeAreaInsets();
    const hasEnoughBalance = walletBalance >= amountToPay && amountToPay > 0;

    if (!isVisible) return null;

    return (
        <Animated.View
            style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999 }]}
        >
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
            <ImageBackground
                source={require('../assets/images/pay.png')}
                style={styles.background}
                resizeMode="cover"
            >
                {/* Overlay for better readability over the image */}
                <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.7)' }]} />

                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom || ms(20) }]}>

                            {/* Header */}
                            <View style={styles.header}>
                                {step === 'pin' ? (
                                    <TouchableOpacity onPress={handleBack} style={styles.iconButton} disabled={isProcessing}>
                                        <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity onPress={onClose} style={styles.iconButton} disabled={isProcessing}>
                                        <Ionicons name="close" size={28} color={theme.colors.text} />
                                    </TouchableOpacity>
                                )}
                            </View>

                            <View style={styles.content}>
                                <Text style={[styles.title, { color: theme.colors.text }]}>
                                    {step === 'selection' ? t('Select Payment Method') : t('Authorize Payment')}
                                </Text>

                                <View style={styles.amountContainer}>
                                    <Text style={[styles.amountLabel, { color: theme.colors.textMuted }]}>{t('Amount to pay')}</Text>
                                    <Text style={[styles.amountValue, { color: theme.colors.primary }]}>₹{amountToPay.toFixed(2)}</Text>
                                </View>

                                {step === 'selection' && (
                                    <Animated.View style={styles.optionsContainer}>
                                        <TouchableOpacity
                                            style={[styles.minimalOptionCard, { borderColor: isDark ? '#4B5563' : '#E5E7EB', backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}
                                            onPress={handleWalletSelect}
                                            disabled={!hasEnoughBalance || isProcessing}
                                        >
                                            <View style={styles.minimalOptionContent}>
                                                <Ionicons name="wallet-outline" size={26} color={theme.colors.text} style={styles.minimalIcon} />
                                                <View style={styles.optionTexts}>
                                                    <Text style={[styles.minimalOptionTitle, { color: theme.colors.text }]}>{t('Pay via Wallet')}</Text>
                                                    <Text style={[styles.minimalOptionSubtitle, { color: hasEnoughBalance ? theme.colors.textMuted : theme.colors.error }]}>
                                                        {t('Balance')}: ₹{walletBalance.toFixed(2)}
                                                    </Text>
                                                </View>
                                                <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
                                            </View>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[styles.minimalOptionCard, { borderColor: isDark ? '#4B5563' : '#E5E7EB', backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}
                                            onPress={handleRazorpaySelect}
                                            disabled={isProcessing}
                                        >
                                            <View style={styles.minimalOptionContent}>
                                                <Ionicons name="card-outline" size={26} color={theme.colors.text} style={styles.minimalIcon} />
                                                <View style={styles.optionTexts}>
                                                    <Text style={[styles.minimalOptionTitle, { color: theme.colors.text }]}>{t('Pay Online')}</Text>
                                                    <Text style={[styles.minimalOptionSubtitle, { color: theme.colors.textMuted }]}>{t('UPI, Cards, Netbanking')}</Text>
                                                </View>
                                                <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
                                            </View>
                                        </TouchableOpacity>
                                    </Animated.View>
                                )}

                                {step === 'pin' && (
                                    <Animated.View entering={SlideInRight.duration(300)} exiting={SlideOutRight.duration(200)} style={styles.pinContainer}>
                                        <Text style={[styles.pinInstruction, { color: theme.colors.textMuted }]}>
                                            {t('Enter your 4-digit Wallet PIN to authorize this deduction.')}
                                        </Text>

                                        <View style={styles.pinInputContainer}>
                                            <TextInput
                                                style={[styles.pinInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}
                                                keyboardType="numeric"
                                                secureTextEntry={!isPinVisible}
                                                maxLength={4}
                                                value={pin}
                                                onChangeText={setPin}
                                                placeholder="••••"
                                                placeholderTextColor={theme.colors.textMuted}
                                                autoFocus
                                            />
                                            <TouchableOpacity 
                                                style={styles.eyeIcon} 
                                                onPress={() => setIsPinVisible(!isPinVisible)}
                                                activeOpacity={0.7}
                                            >
                                                <Ionicons 
                                                    name={isPinVisible ? "eye-off-outline" : "eye-outline"} 
                                                    size={24} 
                                                    color={theme.colors.textMuted} 
                                                />
                                            </TouchableOpacity>
                                        </View>

                                        <TouchableOpacity
                                            style={[styles.confirmButton, { backgroundColor: pin.length === 4 ? theme.colors.primary : (isDark ? '#374151' : '#E5E7EB') }]}
                                            onPress={handleConfirmWallet}
                                            disabled={pin.length !== 4 || isProcessing}
                                        >
                                            {isProcessing ? (
                                                <ActivityIndicator color="#FFFFFF" />
                                            ) : (
                                                <Text style={[styles.confirmButtonText, { color: pin.length === 4 ? '#FFFFFF' : theme.colors.textMuted }]}>
                                                    {t('Confirm Payment')}
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                    </Animated.View>
                                )}
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
            </ImageBackground>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    background: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    container: {
        flex: 1,
        paddingHorizontal: ms(24),
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: vs(12),
    },
    iconButton: {
        padding: ms(8),
        borderRadius: ms(20),
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingBottom: vs(40),
    },
    title: {
        fontSize: ms(28),
        fontWeight: '700',
        fontFamily: 'Inter-Bold',
        marginBottom: vs(8),
        textAlign: 'center',
    },
    amountContainer: {
        alignItems: 'center',
        marginVertical: vs(24),
    },
    amountLabel: {
        fontSize: ms(16),
        fontFamily: 'Inter-Medium',
        marginBottom: vs(8),
    },
    amountValue: {
        fontSize: ms(48),
        fontFamily: 'Inter-Bold',
        fontWeight: '800',
    },
    optionsContainer: {
        marginTop: vs(24),
    },
    minimalOptionCard: {
        borderWidth: 1,
        borderRadius: ms(12),
        paddingVertical: vs(16),
        paddingHorizontal: ms(12),
        marginBottom: vs(16),
    },
    minimalOptionContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    minimalIcon: {
        marginRight: ms(16),
    },
    optionTexts: {
        flex: 1,
    },
    minimalOptionTitle: {
        fontSize: ms(16),
        fontFamily: 'Inter-Medium',
        marginBottom: vs(2),
    },
    minimalOptionSubtitle: {
        fontSize: ms(13),
        fontFamily: 'Inter-Regular',
    },
    badge: {
        position: 'absolute',
        top: ms(16),
        right: ms(16),
        backgroundColor: '#FF3B30',
        paddingHorizontal: ms(10),
        paddingVertical: vs(4),
        borderRadius: ms(12),
    },
    badgeText: {
        color: '#FFF',
        fontSize: ms(12),
        fontFamily: 'Inter-Bold',
        fontWeight: '700',
    },
    pinContainer: {
        marginTop: vs(24),
        alignItems: 'center',
    },
    pinInstruction: {
        fontSize: ms(16),
        fontFamily: 'Inter-Medium',
        textAlign: 'center',
        marginBottom: vs(32),
        paddingHorizontal: ms(16),
        lineHeight: ms(24),
    },
    pinInputContainer: {
        width: '100%',
        marginBottom: vs(32),
        justifyContent: 'center',
    },
    pinInput: {
        borderWidth: 1,
        borderRadius: ms(16),
        fontSize: ms(32),
        fontFamily: 'Inter-Bold',
        textAlign: 'center',
        width: '100%',
        paddingVertical: vs(10),
        letterSpacing: ms(12),
        paddingRight: ms(40),
    },
    eyeIcon: {
        position: 'absolute',
        right: ms(16),
        padding: ms(8),
    },
    confirmButton: {
        width: '80%',
        alignSelf: 'center',
        paddingVertical: vs(14),
        borderRadius: ms(16),
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    confirmButtonText: {
        fontSize: ms(18),
        fontFamily: 'Inter-Bold',
        fontWeight: '700',
    },
});

export default PaymentMethodModal;
