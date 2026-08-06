import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    Platform,
    ActivityIndicator,
    TextInput,
    Alert,
    StatusBar,
    KeyboardAvoidingView,
    TouchableWithoutFeedback,
    Keyboard,
    ScrollView,
    ToastAndroid
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Animated, { SlideInRight, SlideOutRight } from 'react-native-reanimated';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useTranslation } from 'react-i18next';
import { useHaptic } from '../hooks/useHaptic';
import { ms, vs } from '../lib/scale';
import { useValidatePromoMutation, useGetAvailablePromosQuery } from '../service/userApi';

const { width } = Dimensions.get('window');

interface PaymentMethodModalProps {
    isVisible: boolean;
    onClose: () => void;
    amountToPay: number;
    walletBalance: number;
    hasWalletPin: boolean;
    onSelectWallet: (pin: string, promoCode?: string) => void;
    onSelectRazorpay: (promoCode?: string) => void;
    onSetupPin: () => void;
    isProcessing?: boolean;
}

const PRIMARY_GREEN = '#008362';
const BG_COLOR = '#F3F5F7';

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
    const { triggerHaptic } = useHaptic();
    const [step, setStep] = useState<'selection' | 'pin'>('selection');
    const [pin, setPin] = useState('');
    const [isPinVisible, setIsPinVisible] = useState(false);

    const [couponCode, setCouponCode] = useState('');
    const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount: number; description: string } | null>(null);
    const [promoError, setPromoError] = useState('');
    const [validatePromo, { isLoading: isValidatingPromo }] = useValidatePromoMutation();
    const { data: promosRes } = useGetAvailablePromosQuery();

    const [selectedMethod, setSelectedMethod] = useState<'wallet' | 'online'>('wallet');

    const availablePromos = promosRes?.data?.length > 0 ? promosRes.data : [
        {
            code: 'SAVE100',
            title: 'Flat ₹100 off',
            description: 'On orders above ₹999. Auto-applied at checkout.',
        },
        {
            code: 'WALLET50',
            title: '5% wallet cashback',
            description: 'Up to ₹50 back when you pay via wallet.',
        }
    ];

    useEffect(() => {
        if (!isVisible) {
            setStep('selection');
            setPin('');
            setIsPinVisible(false);
            setCouponCode('');
            setAppliedPromo(null);
            setPromoError('');
            setSelectedMethod('wallet');
        }
    }, [isVisible]);

    useEffect(() => {
        if (isVisible) {
            triggerHaptic(HapticFeedbackTypes.impactLight);
        }
    }, [isVisible, triggerHaptic]);

    const handleApplyPromo = async (codeToApply?: string) => {
        const code = codeToApply || couponCode.trim();
        if (!code) return;
        setPromoError('');
        try {
            const res = await validatePromo({ code: code, amount: amountToPay }).unwrap();
            if (res?.data?.isValid) {
                setAppliedPromo({
                    code: code,
                    discount: res.data.discountAmount || res.data.discount_amount || 0,
                    description: res.data.message || res.message || 'Promo code applied successfully!',
                });
                Keyboard.dismiss();
            } else {
                setAppliedPromo(null);
                setPromoError(res?.data?.message || res?.message || 'Invalid or expired promo code');
            }
        } catch (error: any) {
            setAppliedPromo(null);
            setPromoError(error?.data?.message || error?.message || 'Invalid or expired promo code');
        }
    };

    const handleRemovePromo = () => {
        setAppliedPromo(null);
        setCouponCode('');
        setPromoError('');
    };

    const handlePay = () => {
        triggerHaptic(HapticFeedbackTypes.selection);
        if (selectedMethod === 'wallet') {
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
        } else {
            onSelectRazorpay(appliedPromo?.code);
        }
    };

    const handleConfirmWallet = () => {
        if (pin.length !== 4) return;
        triggerHaptic(HapticFeedbackTypes.notificationSuccess);
        onSelectWallet(pin, appliedPromo?.code);
    };

    const handleBack = () => {
        triggerHaptic(HapticFeedbackTypes.selection);
        setStep('selection');
        setPin('');
    };

    const insets = useSafeAreaInsets();
    const finalAmountToPay = appliedPromo ? Math.max(0, amountToPay - appliedPromo.discount) : amountToPay;
    const hasEnoughBalance = walletBalance >= finalAmountToPay && finalAmountToPay > 0;

    // Default to online if wallet balance is not enough, only once
    useEffect(() => {
        if (isVisible && step === 'selection') {
            if (!hasEnoughBalance && selectedMethod === 'wallet') {
                setSelectedMethod('online');
            }
        }
    }, [isVisible, hasEnoughBalance]);

    if (!isVisible) return null;

    return (
        <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999, backgroundColor: BG_COLOR }]}>
            <StatusBar barStyle="light-content" backgroundColor={PRIMARY_GREEN} translucent={true} />
            
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={{ flex: 1, paddingBottom: step === 'selection' ? vs(80) : 0 }}>
                        {step === 'selection' ? (
                            <>
                                {/* Top Header Background */}
                                <View style={[styles.topHeaderBackground, { paddingTop: insets.top || vs(20) }]}>
                                    <View style={styles.headerRow}>
                                        <TouchableOpacity onPress={onClose} style={styles.backButton}>
                                            <Ionicons name="arrow-back" size={24} color="#FFF" />
                                        </TouchableOpacity>
                                        <Text style={styles.headerTitle}>{t('Select payment method')}</Text>
                                        <MaterialCommunityIcons name="shield-check-outline" size={24} color="#FFF" />
                                    </View>
                                    <View style={styles.amountSection}>
                                        <Text style={styles.amountToPayLabel}>{t('AMOUNT TO PAY')}</Text>
                                        <Text style={styles.amountToPayValue}>₹{finalAmountToPay.toFixed(0)}</Text>
                                    </View>
                                </View>

                                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                                    {/* Coupon Section */}
                                    <View style={styles.card}>
                                        <View style={styles.sectionTitleRow}>
                                            <MaterialCommunityIcons name="ticket-confirmation-outline" size={20} color={PRIMARY_GREEN} />
                                            <Text style={styles.sectionTitle}>{t('Have a coupon?')}</Text>
                                        </View>
                                        
                                        {!appliedPromo ? (
                                            <>
                                                <View style={styles.couponInputRow}>
                                                    <View style={styles.couponInputWrapper}>
                                                        <TextInput
                                                            style={styles.couponInput}
                                                            placeholder={t("Enter coupon code")}
                                                            placeholderTextColor="#9CA3AF"
                                                            value={couponCode}
                                                            onChangeText={(text) => { setCouponCode(text); setPromoError(''); }}
                                                            autoCapitalize="characters"
                                                        />
                                                    </View>
                                                    <TouchableOpacity 
                                                        style={[styles.applyBtn, { backgroundColor: couponCode.trim() ? '#98BEB5' : '#D1D5DB' }]}
                                                        onPress={() => handleApplyPromo()}
                                                        disabled={!couponCode.trim() || isValidatingPromo}
                                                    >
                                                        {isValidatingPromo ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.applyBtnText}>{t("Apply")}</Text>}
                                                    </TouchableOpacity>
                                                </View>
                                                {promoError ? <Text style={styles.promoError}>{promoError}</Text> : null}
                                            </>
                                        ) : (
                                            <View style={styles.appliedPromoBox}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.appliedPromoTitle}>{appliedPromo.code} {t("Applied!")}</Text>
                                                    <Text style={styles.appliedPromoDesc}>{appliedPromo.description}</Text>
                                                </View>
                                                <TouchableOpacity onPress={handleRemovePromo} style={{ padding: ms(4) }}>
                                                    <Ionicons name="close-circle" size={20} color="#EF4444" />
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>

                                    {/* Available Offers */}
                                    {step === 'selection' && !appliedPromo && (
                                        <>
                                            <View style={[styles.sectionTitleRow, { marginTop: vs(8) }]}>
                                                <MaterialCommunityIcons name="brightness-percent" size={20} color={PRIMARY_GREEN} />
                                                <Text style={[styles.sectionTitle, { marginLeft: ms(6) }]}>{t('Available offers')}</Text>
                                            </View>
                                            
                                            {availablePromos.map((promo: any, index: number) => (
                                                <View style={styles.card} key={promo.code || index}>
                                                    <View style={styles.offerItem}>
                                                        <View style={styles.offerIconBox}>
                                                            <Text style={styles.offerIconText}>%</Text>
                                                        </View>
                                                        <View style={styles.offerContent}>
                                                            <Text style={styles.offerTitle}>{promo.title || 'Special Offer'}</Text>
                                                            <Text style={styles.offerDesc}>{promo.description || promo.title}</Text>
                                                            <View style={styles.offerCodePill}>
                                                                <Text style={styles.offerCodeText}>{promo.code}</Text>
                                                            </View>
                                                        </View>
                                                        <TouchableOpacity onPress={() => { setCouponCode(promo.code); handleApplyPromo(promo.code); }} style={{ paddingLeft: ms(12) }}>
                                                            <Text style={styles.offerApplyText}>{t('APPLY')}</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            ))}
                                        </>
                                    )}

                                    {/* Pay Using */}
                                    <Text style={styles.payUsingTitle}>{t('Pay using')}</Text>
                                    
                                    <TouchableOpacity 
                                        style={[styles.paymentMethodCard, selectedMethod === 'wallet' && styles.paymentMethodCardSelected, !hasEnoughBalance && { opacity: 0.6 }]}
                                        onPress={() => hasEnoughBalance && setSelectedMethod('wallet')}
                                        activeOpacity={0.8}
                                    >
                                        <View style={styles.paymentIconBox}>
                                            <MaterialCommunityIcons name="wallet-outline" size={22} color="#FFF" />
                                        </View>
                                        <View style={styles.paymentContent}>
                                            <View style={styles.paymentTitleRow}>
                                                <Text style={styles.paymentTitle}>{t('Pay via Wallet')}</Text>
                                                <View style={styles.cashbackPill}>
                                                    <Text style={styles.cashbackPillText}>{t('5% cashback')}</Text>
                                                </View>
                                            </View>
                                            <Text style={styles.paymentDesc}>
                                                {t('Balance')} ₹{walletBalance.toFixed(0)} • {t('Instant')}
                                            </Text>
                                        </View>
                                        <View style={[styles.radioCircle, selectedMethod === 'wallet' && styles.radioCircleSelected]}>
                                            {selectedMethod === 'wallet' && <View style={styles.radioInner} />}
                                        </View>
                                    </TouchableOpacity>

                                    <TouchableOpacity 
                                        style={[styles.paymentMethodCard, selectedMethod === 'online' && styles.paymentMethodCardSelected]}
                                        onPress={() => setSelectedMethod('online')}
                                        activeOpacity={0.8}
                                    >
                                        <View style={[styles.paymentIconBox, styles.paymentIconBoxOutline]}>
                                            <MaterialCommunityIcons name="credit-card-outline" size={22} color="#6B7280" />
                                        </View>
                                        <View style={styles.paymentContent}>
                                            <Text style={styles.paymentTitle}>{t('Pay Online')}</Text>
                                            <Text style={[styles.paymentDesc, { marginTop: vs(2) }]}>{t('UPI, Cards, Net Banking')}</Text>
                                        </View>
                                        <View style={[styles.radioCircle, selectedMethod === 'online' && styles.radioCircleSelected]}>
                                            {selectedMethod === 'online' && <View style={styles.radioInner} />}
                                        </View>
                                    </TouchableOpacity>

                                    <View style={styles.secureTextRow}>
                                        <MaterialCommunityIcons name="shield-check" size={16} color="#10B981" />
                                        <Text style={styles.secureText}>{t('100% secure & encrypted payment')}</Text>
                                    </View>
                                </ScrollView>

                                {/* Bottom Fixed Bar */}
                                <View style={[styles.bottomBar, { paddingBottom: insets.bottom || vs(16) }]}>
                                    <View>
                                        <Text style={styles.totalPayableLabel}>{t('Total payable')}</Text>
                                        <Text style={styles.totalPayableValue}>₹{finalAmountToPay.toFixed(0)}</Text>
                                    </View>
                                    <TouchableOpacity 
                                        style={styles.payButton} 
                                        onPress={handlePay} 
                                        disabled={isProcessing}
                                    >
                                        {isProcessing ? <ActivityIndicator color="#FFF" /> : (
                                            <>
                                                <Text style={styles.payButtonText}>
                                                    {selectedMethod === 'wallet' ? t('Pay with Wallet') : t('Pay Online')}
                                                </Text>
                                                <Ionicons name="chevron-forward" size={18} color="#FFF" />
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </>
                        ) : (
                            /* PIN STEP */
                            <View style={[styles.container, { paddingTop: insets.top || vs(20) }]}>
                                <View style={styles.headerRowPin}>
                                    <TouchableOpacity onPress={handleBack} style={styles.backButtonPin}>
                                        <Ionicons name="chevron-back" size={28} color="#111" />
                                    </TouchableOpacity>
                                    <Text style={styles.headerTitlePin}>{t('Authorize Payment')}</Text>
                                    <View style={{ width: 40 }} />
                                </View>
                                
                                <Animated.View entering={SlideInRight.duration(300)} exiting={SlideOutRight.duration(200)} style={styles.pinContainer}>
                                    <Text style={styles.pinInstruction}>
                                        {t('Enter your 4-digit Wallet PIN to authorize this deduction.')}
                                    </Text>

                                    <View style={styles.pinInputContainer}>
                                        <TextInput
                                            style={styles.pinInput}
                                            keyboardType="numeric"
                                            secureTextEntry={!isPinVisible}
                                            maxLength={4}
                                            value={pin}
                                            onChangeText={setPin}
                                            placeholder="••••"
                                            placeholderTextColor="#9CA3AF"
                                            autoFocus
                                        />
                                        <TouchableOpacity 
                                            style={styles.eyeIcon} 
                                            onPress={() => setIsPinVisible(!isPinVisible)}
                                        >
                                            <Ionicons 
                                                name={isPinVisible ? "eye-off-outline" : "eye-outline"} 
                                                size={24} 
                                                color="#6B7280" 
                                            />
                                        </TouchableOpacity>
                                    </View>

                                    <TouchableOpacity
                                        style={[styles.confirmButton, { backgroundColor: pin.length === 4 ? PRIMARY_GREEN : '#D1D5DB' }]}
                                        onPress={handleConfirmWallet}
                                        disabled={pin.length !== 4 || isProcessing}
                                    >
                                        {isProcessing ? (
                                            <ActivityIndicator color="#FFFFFF" />
                                        ) : (
                                            <Text style={[styles.confirmButtonText, { color: pin.length === 4 ? '#FFFFFF' : '#6B7280' }]}>
                                                {t('Confirm Payment')}
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                </Animated.View>
                            </View>
                        )}
                    </View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BG_COLOR,
    },
    topHeaderBackground: {
        backgroundColor: PRIMARY_GREEN,
        borderBottomLeftRadius: ms(30),
        borderBottomRightRadius: ms(30),
        paddingHorizontal: ms(20),
        paddingBottom: vs(30),
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: vs(10),
    },
    backButton: {
        width: ms(40),
        height: ms(40),
        borderRadius: ms(20),
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        color: '#FFF',
        fontSize: ms(18),
        fontFamily: 'Inter-Bold',
    },
    amountSection: {
        alignItems: 'center',
        marginTop: vs(24),
    },
    amountToPayLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: ms(12),
        fontFamily: 'Inter-Medium',
        letterSpacing: 1,
        marginBottom: vs(4),
    },
    amountToPayValue: {
        color: '#FFF',
        fontSize: ms(48),
        fontFamily: 'Inter-Bold',
    },
    scrollContent: {
        paddingHorizontal: ms(16),
        paddingTop: vs(24),
        paddingBottom: vs(24),
    },
    card: {
        backgroundColor: '#FFF',
        borderRadius: ms(16),
        padding: ms(16),
        marginBottom: vs(16),
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: vs(12),
    },
    sectionTitle: {
        fontSize: ms(15),
        fontFamily: 'Inter-Bold',
        color: '#111',
        marginLeft: ms(8),
    },
    couponInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    couponInputWrapper: {
        flex: 1,
        height: vs(44),
        backgroundColor: '#F9FAFB',
        borderRadius: ms(12),
        paddingHorizontal: ms(12),
        justifyContent: 'center',
        marginRight: ms(12),
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderStyle: 'dashed',
    },
    couponInput: {
        flex: 1,
        fontFamily: 'Inter-Medium',
        fontSize: ms(14),
        color: '#333',
    },
    applyBtn: {
        height: vs(44),
        paddingHorizontal: ms(20),
        borderRadius: ms(12),
        justifyContent: 'center',
        alignItems: 'center',
    },
    applyBtnText: {
        color: '#FFF',
        fontFamily: 'Inter-Bold',
        fontSize: ms(14),
    },
    promoError: {
        color: '#EF4444',
        fontSize: ms(12),
        fontFamily: 'Inter-Regular',
        marginTop: vs(4),
        marginLeft: ms(4),
    },
    appliedPromoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: ms(8),
        padding: ms(12),
        backgroundColor: '#ECFDF5',
        borderColor: '#10B981',
    },
    appliedPromoTitle: {
        color: '#10B981',
        fontFamily: 'Inter-Bold',
        fontSize: ms(14),
        marginBottom: vs(2),
    },
    appliedPromoDesc: {
        color: '#10B981',
        fontFamily: 'Inter-Medium',
        fontSize: ms(12),
    },
    offerItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    offerIconBox: {
        width: ms(40),
        height: ms(40),
        borderRadius: ms(20),
        backgroundColor: '#E6F3EE',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: ms(12),
    },
    offerIconText: {
        color: PRIMARY_GREEN,
        fontFamily: 'Inter-Bold',
        fontSize: ms(16),
    },
    offerContent: {
        flex: 1,
    },
    offerTitle: {
        fontSize: ms(15),
        fontFamily: 'Inter-Bold',
        color: '#111',
        marginBottom: vs(2),
    },
    offerDesc: {
        fontSize: ms(12),
        fontFamily: 'Inter-Regular',
        color: '#6B7280',
        marginBottom: vs(8),
    },
    offerCodePill: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderStyle: 'dashed',
        borderRadius: ms(8),
        paddingHorizontal: ms(8),
        paddingVertical: vs(4),
        alignSelf: 'flex-start',
    },
    offerCodeText: {
        fontSize: ms(11),
        fontFamily: 'Inter-Bold',
        color: '#111',
        letterSpacing: 0.5,
    },
    offerApplyText: {
        color: PRIMARY_GREEN,
        fontFamily: 'Inter-Bold',
        fontSize: ms(13),
    },
    payUsingTitle: {
        fontSize: ms(15),
        fontFamily: 'Inter-Bold',
        color: '#111',
        marginBottom: vs(12),
        marginTop: vs(8),
    },
    paymentMethodCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: ms(16),
        padding: ms(16),
        marginBottom: vs(12),
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    paymentMethodCardSelected: {
        backgroundColor: '#EAF4F1',
        borderColor: PRIMARY_GREEN,
    },
    paymentIconBox: {
        width: ms(40),
        height: ms(40),
        borderRadius: ms(12),
        backgroundColor: PRIMARY_GREEN,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: ms(12),
    },
    paymentIconBoxOutline: {
        backgroundColor: '#F3F5F7',
    },
    paymentContent: {
        flex: 1,
    },
    paymentTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: vs(2),
    },
    paymentTitle: {
        fontSize: ms(15),
        fontFamily: 'Inter-Bold',
        color: '#111',
    },
    cashbackPill: {
        backgroundColor: '#D1EAE1',
        paddingHorizontal: ms(6),
        paddingVertical: vs(2),
        borderRadius: ms(6),
        marginLeft: ms(8),
    },
    cashbackPillText: {
        color: PRIMARY_GREEN,
        fontSize: ms(10),
        fontFamily: 'Inter-Bold',
    },
    paymentDesc: {
        fontSize: ms(12),
        fontFamily: 'Inter-Regular',
        color: '#6B7280',
    },
    radioCircle: {
        width: ms(20),
        height: ms(20),
        borderRadius: ms(10),
        borderWidth: 2,
        borderColor: '#D1D5DB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioCircleSelected: {
        borderColor: PRIMARY_GREEN,
        backgroundColor: PRIMARY_GREEN,
    },
    radioInner: {
        width: ms(10),
        height: ms(10),
        borderRadius: ms(5),
        backgroundColor: '#FFF',
    },
    secureTextRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: vs(8),
        marginBottom: vs(24),
    },
    secureText: {
        color: '#6B7280',
        fontSize: ms(12),
        fontFamily: 'Inter-Medium',
        marginLeft: ms(6),
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFF',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: ms(20),
        paddingVertical: vs(16),
    },
    totalPayableLabel: {
        fontSize: ms(12),
        fontFamily: 'Inter-Medium',
        color: '#6B7280',
        marginBottom: vs(2),
    },
    totalPayableValue: {
        fontSize: ms(22),
        fontFamily: 'Inter-Bold',
        color: '#111',
    },
    payButton: {
        backgroundColor: PRIMARY_GREEN,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: ms(24),
        paddingVertical: vs(12),
        borderRadius: ms(12),
    },
    payButtonText: {
        color: '#FFF',
        fontSize: ms(15),
        fontFamily: 'Inter-Bold',
        marginRight: ms(8),
    },
    
    // PIN Step styles
    headerRowPin: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: ms(20),
        paddingVertical: vs(12),
    },
    backButtonPin: {
        width: ms(40),
        height: ms(40),
        borderRadius: ms(20),
        backgroundColor: 'rgba(0,0,0,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitlePin: {
        fontSize: ms(18),
        fontFamily: 'Inter-Bold',
        color: '#111',
    },
    pinContainer: {
        marginTop: vs(40),
        alignItems: 'center',
        paddingHorizontal: ms(24),
    },
    pinInstruction: {
        fontSize: ms(16),
        fontFamily: 'Inter-Medium',
        textAlign: 'center',
        marginBottom: vs(32),
        color: '#4B5563',
        lineHeight: ms(24),
    },
    pinInputContainer: {
        width: '100%',
        marginBottom: vs(32),
        justifyContent: 'center',
    },
    pinInput: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: ms(16),
        fontSize: ms(32),
        fontFamily: 'Inter-Bold',
        textAlign: 'center',
        width: '100%',
        paddingVertical: vs(10),
        letterSpacing: ms(12),
        paddingRight: ms(40),
        backgroundColor: '#FFF',
        color: '#111',
    },
    eyeIcon: {
        position: 'absolute',
        right: ms(16),
        padding: ms(8),
    },
    confirmButton: {
        width: '100%',
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
        fontSize: ms(16),
        fontFamily: 'Inter-Bold',
    },
});

export default PaymentMethodModal;
