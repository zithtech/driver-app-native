import React, { useState } from 'react';
import ImagePicker from 'react-native-image-crop-picker';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    // StatusBar removed — using AppStatusBar
    Alert,
    ScrollView,
    Dimensions,
    ActivityIndicator,
    BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppStatusBar from '../../Components/AppStatusBar';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { 
  PickupOTPScreen_Nav,
  Dashboard_Nav,
} from '../../Navigations/navigations';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    FadeIn,
    SlideInDown,
} from 'react-native-reanimated';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useHaptic } from '../../hooks/useHaptic';

// import colors from '../../constant/colors';
import { useAppTheme } from '../../context/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import { useCompleteTripMutation } from '../../service/driverApi';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../redux/store';
import { clearAcceptedRide } from '../../redux/rideSlice';
import { checkPhotoLibraryPermission, goToSettings } from '../../utils/permissionUtils';

const { width } = Dimensions.get('window');


const PaymentCollectionScreen = ({ route, navigation }: any) => {
    const rideFromStore = useSelector((state: RootState) => state.ride.currentRide);
    const ride = rideFromStore || route.params?.ride || {};
    const actualDistance = route.params?.actualDistance;
    const actualDuration = route.params?.actualDuration;
    const [isFinished, setIsFinished] = useState(false);
    
    // 🛡️ Guard: Exit screen if ride is cleared from Redux (e.g. by unexpected global state change)
    React.useEffect(() => {
        if (!rideFromStore && !isFinished) {
            console.log('[PaymentCollection] Active ride cleared from Redux, exiting...');
            navigation.navigate(Dashboard_Nav);
        }
    }, [rideFromStore, isFinished, navigation]);

    // 🕒 Auto-redirect to dashboard after success
    React.useEffect(() => {
        if (isFinished) {
            const timeout = setTimeout(() => {
                navigation.navigate(Dashboard_Nav);
            }, 3500);
            return () => clearTimeout(timeout);
        }
    }, [isFinished, navigation]);
    const { t } = useTranslation();
    const { theme, isDark } = useAppTheme();
    const { showAlert } = useAlert();
    const { triggerHaptic } = useHaptic();
    const [completeTripMutation] = useCompleteTripMutation();
    const dispatch = useDispatch();

    // 🛡️ Navigation Guard: Prevent back button during payment collection
    useFocusEffect(
        React.useCallback(() => {
            const onBackPress = () => {
                showAlert({
                    title: t('payment_collection_title'),
                    message: t('payment_back_restriction'),
                    singleButton: true,
                    icon: 'information-circle-outline',
                });
                return true; // Prevent default behavior
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            navigation.setOptions({ gestureEnabled: false });

            return () => {
                subscription.remove();
                navigation.setOptions({ gestureEnabled: true });
            };
        }, [navigation])
    );

    const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);



    const price = ride?.total_fare ? `₹${ride.total_fare}` : (ride?.fare || ride?.price || '₹0.00');

    // Animation values
    const cashScale = useSharedValue(1);
    const upiScale = useSharedValue(1);

    const selectPayment = (mode: 'CASH' | 'UPI') => {
        setPaymentMode(mode);
        triggerHaptic(HapticFeedbackTypes.impactLight);

        // Reset all scales
        cashScale.value = withSpring(mode === 'CASH' ? 1.05 : 1);
        upiScale.value = withSpring(mode === 'UPI' ? 1.05 : 1);
    };

    const animatedCashStyle = useAnimatedStyle(() => ({
        transform: [{ scale: cashScale.value }],
    }));
    const animatedUpiStyle = useAnimatedStyle(() => ({
        transform: [{ scale: upiScale.value }],
    }));

    // Helper to format duration dynamically
    const formatDuration = (minsInput: any) => {
        let mins = parseFloat(minsInput);
        
        // If mins is missing or invalid, try to calculate from start time
        if (isNaN(mins) || mins <= 0) {
            const startTime = ride?.actual_start_time || ride?.started_at || ride?.scheduled_start_time;
            if (startTime) {
                const diffMs = new Date().getTime() - new Date(startTime).getTime();
                mins = Math.max(0, diffMs / 60000);
            } else {
                mins = 0;
            }
        }

        if (mins < 60) {
            return `${Math.ceil(mins)} ${t('minutes_unit')}`;
        }
        const hrs = Math.floor(mins / 60);
        const m = Math.round(mins % 60);
        return `${hrs}h ${m > 0 ? `${m}m` : ''}`;
    };

    const handleOpenGallery = async () => {
        const hasPermission = await checkPhotoLibraryPermission();
        if (!hasPermission) {
            showAlert({
                title: t('gallery_permission') || 'Gallery Required',
                message: t('gallery_permission_msg') || 'Please enable gallery access to pick a QR code.',
                confirmText: t('go_to_settings') || 'Settings',
                onConfirm: () => goToSettings(),
                cancelText: t('cancel') || 'Cancel',
            });
            return;
        }

        ImagePicker.openPicker({
            width: 400,
            height: 400,
            cropping: false,
            includeBase64: true,
        }).then((image: any) => {
            console.log('[PaymentCollection] Image picked from gallery:', image.path);
        }).catch(err => {
            if (err.message !== 'User cancelled image selection') {
                console.error('[PaymentCollection] Gallery error:', err);
            }
        });
    };

    const onEndTrip = () => {
        if (!paymentMode) {
            triggerHaptic(HapticFeedbackTypes.notificationError);
            showAlert({
                title: t('error'),
                message: t('payment_method_error'),
                singleButton: true,
                icon: 'alert-circle-outline',
            });
            return;
        }

        triggerHaptic(HapticFeedbackTypes.impactMedium);
        finishTrip();
    };

    const finishTrip = async () => {
        try {
            setIsProcessing(true);
            const targetTripId = ride?.trip_id || ride?.id;
            if (!targetTripId) throw new Error('Invalid Trip ID');
            
            await completeTripMutation({
                tripId: targetTripId,
                distance_km: actualDistance,
                trip_duration_minutes: actualDuration,
            }).unwrap();
            
            dispatch(clearAcceptedRide());
            triggerHaptic(HapticFeedbackTypes.notificationSuccess);
            setIsFinished(true);
        } catch (err: any) {
            triggerHaptic(HapticFeedbackTypes.notificationError);
            const errorMsg = err?.data?.message?.toLowerCase() || '';
            const isAlreadyDone = errorMsg.includes('already completed') || errorMsg.includes('cancelled');
            
            if (isAlreadyDone) {
                // If it's already handled by the backend, clear local state and proceed to success
                console.log('[PaymentCollection] Trip already completed/cancelled on the server.');
                dispatch(clearAcceptedRide());
                setIsFinished(true);
            } else {
                showAlert({
                    title: t('error'),
                    message: err?.data?.message || t('complete_trip_error'),
                    singleButton: true,
                    icon: 'alert-circle-outline',
                });
            }
        } finally {
            setIsProcessing(false);
        }
    };

    if (isFinished) {
        return (
            <View style={[styles.successContainer, { backgroundColor: '#f8f9fa' }]}>
                <AppStatusBar forceDark />
                
                <Animated.View entering={FadeIn.delay(200)} style={styles.successContent}>
                    <View style={[styles.checkBadge, { backgroundColor: theme.colors.success || '#34a853', shadowColor: theme.colors.success }]}>
                        <Ionicons name="checkmark" size={60} color="#fff" />
                    </View>
                    <Text style={[styles.successTitle, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{t('payment_success_title')}</Text>
                    <Text style={[styles.successSubtitle, { color: theme.colors.paragraphText }]}>
                        {t('payment_success_msg', {
                            amount: price,
                            method: paymentMode === 'CASH' ? t('cash') : t('upi')
                        })}
                    </Text>

                    <View style={[styles.earningsSummary, { backgroundColor: theme.colors.primary + '0D' }]}>
                        <Text style={[styles.netEarningLabel, { color: theme.colors.primary }]}>{t('net_earning')}</Text>
                        <Text style={[styles.netEarningValue, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{price}</Text>
                        <View style={[styles.zeroCommBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                            <Ionicons name="flash" size={14} color={theme.colors.primary} />
                            <Text style={[styles.zeroCommText, { color: theme.colors.primary }]}>{t('zero_commission_note')}</Text>
                        </View>
                    </View>
                </Animated.View>

                <Animated.View entering={SlideInDown.delay(500)} style={styles.successFooter}>
                    <Pressable
                        style={[styles.doneBtn, { backgroundColor: theme.colors.primary }]}
                        onPress={() => navigation.navigate(Dashboard_Nav)}
                    >
                        <Text style={[styles.doneBtnText, { color: '#fff' }]} numberOfLines={1} adjustsFontSizeToFit>{t('done')}</Text>
                    </Pressable>
                </Animated.View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: '#f8f9fa' }]}>
            <AppStatusBar forceDark />


            <SafeAreaView style={styles.safeArea}>
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                    {/* Subscription Badge */}
                    <Animated.View entering={FadeIn} style={styles.topBadgeContainer}>
                        <LinearGradient
                            colors={isDark ? ['#B8860B', '#8B6508'] : ['#FFD700', '#f9ab00']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.subBadge}
                        >
                            <Ionicons name="star" size={14} color="#fff" />
                            <Text style={styles.subBadgeText} numberOfLines={1} adjustsFontSizeToFit>{t('subscription_active_badge')}</Text>
                        </LinearGradient>
                    </Animated.View>

                    {/* Header Section */}
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{t('trip_finished')}</Text>
                        <Text style={[styles.subtitle, { color: isDark ? '#b0b3b8' : '#5f6368' }]}>{t('collect_payment_from')} {ride?.passenger || ride?.passenger_details?.name || t('rider')}</Text>
                    </View>

                    {/* Trip Summary Card */}
                    <Animated.View entering={FadeIn.delay(100)} style={[styles.amountCard, { backgroundColor: theme.colors.card }]}>
                        <View style={styles.cardHeader}>
                            <View style={[styles.rideIdBadge, { backgroundColor: theme.colors.primary + '10' }]}>
                                <Text style={[styles.tripId, { color: theme.colors.primary }]}>{t('ride_id_label', { id: ride?.trip_code || ride?.trip_id || ride?.id || '8829' })}</Text>
                            </View>
                            <Text style={[styles.tripDate, { color: isDark ? '#8a8d91' : '#9aa0a6' }]}>{ride?.scheduled_start_time ? new Date(ride.scheduled_start_time).toLocaleDateString() : (ride?.date || new Date().toLocaleDateString())}</Text>
                        </View>

                        <View style={styles.amountHeader}>
                            <Text style={[styles.amountValue, { color: theme.colors.primary }]} numberOfLines={1} adjustsFontSizeToFit>{price}</Text>
                            <Text style={[styles.amountLabel, { color: isDark ? '#b0b3b8' : '#5f6368' }]}>{t('net_earning')}</Text>
                        </View>

                        <View style={[styles.divider, { backgroundColor: isDark ? '#3a3b3c' : '#f1f3f4' }]} />

                        <View style={styles.statsRow}>
                            <View style={styles.statBox}>
                                <Ionicons name="navigate-outline" size={18} color={theme.colors.paragraphText} />
                                <Text style={[styles.statText, { color: theme.colors.text }]}>{actualDistance !== undefined ? `${actualDistance} ${t('km_unit')}` : (ride?.distance_km ? `${ride.distance_km} ${t('km_unit')}` : `0 ${t('km_unit')}`)}</Text>
                            </View>
                            <View style={[styles.dividerVertical, { backgroundColor: theme.colors.border }]} />
                             <View style={styles.statBox}>
                                <Ionicons name="time-outline" size={18} color={theme.colors.paragraphText} />
                                <Text style={[styles.statText, { color: theme.colors.text }]}>{formatDuration(actualDuration ?? (ride?.trip_duration_minutes || ride?.eta))}</Text>
                            </View>
                        </View>

                        <View style={[styles.commissionIncentive, { backgroundColor: theme.colors.success + '15' }]}>
                            <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                            <Text style={[styles.incentiveText, { color: theme.colors.success }]}>{t('zero_commission_note')}</Text>
                        </View>
                    </Animated.View>

                    {/* Payment Method Selection */}
                    <View style={styles.paymentSection}>
                        <Text style={[styles.sectionTitle, { color: isDark ? '#8a8d91' : '#5f6368' }]}>{t('select_received_method')}</Text>

                        <View style={styles.methodGrid}>
                            <Animated.View style={[styles.methodWrapper, animatedCashStyle]}>
                                <Pressable
                                    style={[
                                        styles.methodCard,
                                        { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                                        paymentMode === 'CASH' && [styles.methodCardActive, { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '0D' }]
                                    ]}
                                    onPress={() => selectPayment('CASH')}
                                >
                                    <View style={[styles.methodIconWrapper, { backgroundColor: (theme.colors.success || '#1e8e3e') + '15' }]}>
                                        <Ionicons name="cash" size={32} color={theme.colors.success || '#1e8e3e'} />
                                    </View>
                                    <Text style={[styles.methodLabel, { color: theme.colors.text }]}>{t('cash')}</Text>
                                    {paymentMode === 'CASH' && (
                                        <View style={styles.checkIconWrapper}>
                                            <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
                                        </View>
                                    )}
                                </Pressable>
                            </Animated.View>

                            <Animated.View style={[styles.methodWrapper, animatedUpiStyle]}>
                                <Pressable
                                    style={[
                                        styles.methodCard,
                                        { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                                        paymentMode === 'UPI' && [styles.methodCardActive, { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '0D' }]
                                    ]}
                                    onPress={() => selectPayment('UPI')}
                                >
                                    <View style={[styles.methodIconWrapper, { backgroundColor: theme.colors.primary + '15' }]}>
                                        <Ionicons name="wallet" size={32} color={theme.colors.primary} />
                                    </View>
                                    <Text style={[styles.methodLabel, { color: theme.colors.text }]}>{t('upi')}</Text>
                                    {paymentMode === 'UPI' && (
                                        <View style={styles.checkIconWrapper}>
                                            <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
                                        </View>
                                    )}
                                </Pressable>
                            </Animated.View>


                        </View>

                        {/* Contextual Info Boxes */}
                        {paymentMode === 'CASH' && (
                            <Animated.View entering={FadeIn} style={[styles.contextBox, { backgroundColor: theme.colors.card, borderColor: isDark ? '#1b2e21' : '#e6f4ea' }]}>
                                <View style={[styles.contextIcon, { backgroundColor: theme.colors.success || '#1e8e3e' }]}>
                                    <Ionicons name="information-circle" size={20} color="#fff" />
                                </View>
                                <View style={styles.contextTextWrapper}>
                                    <Text style={[styles.contextTitle, { color: theme.colors.success || '#1e8e3e' }]}>{t('confirm_receipt')}</Text>
                                    <Text style={[styles.contextText, { color: theme.colors.success || '#1e8e3e' }]}>{t('collect_cash_instruction')}</Text>
                                </View>
                            </Animated.View>
                        )}

                        {paymentMode === 'UPI' && (
                            <Animated.View entering={FadeIn} style={[styles.upiCard, { backgroundColor: theme.colors.card, paddingVertical: 12 }]}>
                                <Pressable 
                                    style={[styles.shareBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8faff', paddingVertical: 16 }]} 
                                    onPress={handleOpenGallery}
                                >
                                    <Ionicons name="images-outline" size={24} color={theme.colors.primary} />
                                    <View style={{ marginLeft: 12 }}>
                                        <Text style={[styles.shareBtnText, { color: theme.colors.primary, fontSize: 16 }]}>{t('share_qr')}</Text>
                                        <Text style={{ fontSize: 12, color: theme.colors.paragraphText }}>{t('pick_from_gallery', 'Pick from gallery')}</Text>
                                    </View>
                                </Pressable>
                            </Animated.View>
                        )}

                    </View>
                </ScrollView>

                {/* Footer Action */}
                <View style={[styles.footer, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border }]}>
                    <Pressable
                        style={[
                            styles.endTripBtn,
                            { backgroundColor: paymentMode ? theme.colors.primary : theme.colors.border }
                        ]}
                        onPress={onEndTrip}
                        disabled={!paymentMode}
                    >
                        <Text style={[styles.endTripBtnText, !paymentMode && { color: theme.colors.paragraphText }]} numberOfLines={1} adjustsFontSizeToFit>{t('confirm_payment_received')}</Text>
                       
                    </Pressable>
                </View>
            </SafeAreaView>

            {/* Processing Overlay */}
            {isProcessing && (
                <View style={styles.processingOverlay}>
                    <View style={[styles.processingCard, { backgroundColor: theme.colors.card }]}>
                        <ActivityIndicator size="large" color={theme.colors.primary} />
                        <Text style={[styles.processingText, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{t('completing_trip')}</Text>
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    // overlay: {
    //     ...StyleSheet.absoluteFillObject,
    // },
    safeArea: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    topBadgeContainer: {
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 20,
    },
    subBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
        shadowColor: '#f9ab00',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    subBadgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        textAlign: 'center',
    },
    amountCard: {
        borderRadius: 24,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
        marginBottom: 32,
        
    },
    cardHeader: {
        alignItems: 'center',
        marginBottom: 20,
        gap: 4,
    },
     rideIdBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    tripId: {
        fontSize: 13,
        fontWeight: 'bold',
    },
    tripDate: {
        fontSize: 12,
    },
    amountHeader: {
        alignItems: 'center',
        marginBottom: 20,
    },
    amountValue: {
        fontSize: 52,
        fontWeight: '900',
        letterSpacing: -1,
    },
    amountLabel: {
        fontSize: 14,
        fontWeight: '600',
        marginTop: -4,
    },
    divider: {
        height: 1,
        marginVertical: 16,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'center',
    },
    statBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statText: {
        fontSize: 15,
        fontWeight: '700',
    },
    dividerVertical: {
        width: 1,
        height: 20,
    },
    commissionIncentive: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        borderRadius: 12,
        marginTop: 20,
        gap: 8,
    },
    incentiveText: {
        fontSize: 12,
        fontWeight: '700',
    },
    paymentSection: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '800',
        marginBottom: 16,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    methodGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    methodWrapper: {
        flex: 1,
    },
    methodCard: {
        borderRadius: 20,
        paddingVertical: 8,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
    },
    methodCardActive: {
    },
    methodIconWrapper: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    methodLabel: {
        fontSize: 13,
        fontWeight: '700',
    },
    checkIconWrapper: {
        position: 'absolute',
        top: 8,
        right: 8,
    },
    contextBox: {
        flexDirection: 'row',
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        alignItems: 'center',
        gap: 16,
       
    },
    contextIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    contextTextWrapper: {
        flex: 1,
    },
    contextTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    contextText: {
        fontSize: 13,
        lineHeight: 18,
    },
    upiCard: {
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
    },

    shareBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 30,
        gap: 8,
    },
    shareBtnText: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
    },
    endTripBtn: {
        height: 64,
        borderRadius: 20,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
    },
    btnDisabled: {
        shadowOpacity: 0,
        elevation: 0,
    },
    endTripBtnText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    processingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    processingCard: {
        padding: 32,
        borderRadius: 24,
        alignItems: 'center',
        gap: 16,
        width: width * 0.8,
    },
    processingText: {
        fontSize: 16,
        fontWeight: '600',
    },
    successContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    successContent: {
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    checkBadge: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    successTitle: {
        fontSize: 32,
        fontWeight: '900',
        color: '#fff',
        marginBottom: 12,
        textAlign: 'center',
    },
    successSubtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 40,
    },
    earningsSummary: {
        padding: 24,
        borderRadius: 24,
        alignItems: 'center',
        width: width * 0.8,
    },
    netEarningLabel: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    netEarningValue: {
        fontSize: 44,
        fontWeight: '900',
        color: '#fff',
        marginBottom: 16,
    },
    zeroCommBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
        gap: 6,
    },
    zeroCommText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    successFooter: {
        position: 'absolute',
        bottom: 50,
        left: 0,
        right: 0,
        paddingHorizontal: 40,
    },
    doneBtn: {
        backgroundColor: '#fff',
        height: 64,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
    },
    doneBtnText: {
        fontSize: 18,
        fontWeight: 'bold',
    },
});

export default PaymentCollectionScreen;
