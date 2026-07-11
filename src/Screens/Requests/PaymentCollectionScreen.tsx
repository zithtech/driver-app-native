import React, { useState } from 'react';
import ImagePicker from 'react-native-image-crop-picker';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    TouchableOpacity,
    Alert,
    ScrollView,
    Dimensions,
    ActivityIndicator,
    BackHandler,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppStatusBar from '../../Components/AppStatusBar';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { Dashboard_Nav } from '../../Navigations/navigations';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Animated, {
    FadeIn,
    FadeInDown,
    SlideInDown,
} from 'react-native-reanimated';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useHaptic } from '../../hooks/useHaptic';

import { useAppTheme } from '../../context/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import { useCompleteTripMutation } from '../../service/driverApi';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../redux/store';
import { clearAcceptedRide } from '../../redux/rideSlice';
import { checkPhotoLibraryPermission, goToSettings } from '../../utils/permissionUtils';
import { mS as ms, vS as vs } from '../../lib/scale';

const { width } = Dimensions.get('window');

const PaymentCollectionScreen = ({ route, navigation }: any) => {
    const rideFromStore = useSelector((state: RootState) => state.ride.currentRide);
    const ride = rideFromStore || route.params?.ride || {};
    const actualDistance = route.params?.actualDistance;
    const actualDuration = route.params?.actualDuration;
    const [isFinished, setIsFinished] = useState(false);

    React.useEffect(() => {
        if (!rideFromStore && !isFinished) {
            navigation.navigate(Dashboard_Nav);
        }
    }, [rideFromStore, isFinished, navigation]);

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

    useFocusEffect(
        React.useCallback(() => {
            const onBackPress = () => {
                showAlert({
                    title: t('payment_collection_title'),
                    message: t('payment_back_restriction'),
                    singleButton: true,
                    icon: 'information-circle-outline',
                });
                return true;
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
    const [rating, setRating] = useState<number>(5);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isInitialProcessing, setIsInitialProcessing] = useState(true);
    const [showFareDetails, setShowFareDetails] = useState(false);
    const [showTripSummary, setShowTripSummary] = useState(false);
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setIsInitialProcessing(false);
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

    const price = ride?.total_fare ? `₹${ride.total_fare}` : (ride?.fare || ride?.price || '₹0.00');

    const selectPayment = (mode: 'CASH' | 'UPI') => {
        setPaymentMode(mode);
        triggerHaptic(HapticFeedbackTypes.selection);
    };

    const formatDuration = (minsInput: any) => {
        if (typeof minsInput === 'string' && (minsInput.includes('h') || minsInput.includes('m') || minsInput.includes('min'))) {
            return minsInput;
        }
        let mins = parseFloat(minsInput);
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
            return `${Math.ceil(mins)} ${t('minutes_unit', 'mins')}`;
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

    const getRatingText = (val: number) => {
        switch (val) {
            case 1: return { text: t('rating_terrible', 'Terrible!'), color: '#EF4444' };
            case 2: return { text: t('rating_bad', 'Bad!'), color: '#F97316' };
            case 3: return { text: t('rating_okay', 'Okay!'), color: '#EAB308' };
            case 4: return { text: t('rating_good', 'Good!'), color: '#84CC16' };
            case 5: return { text: t('rating_excellent', 'Excellent!'), color: '#16A34A' };
            default: return { text: '', color: 'transparent' };
        }
    };

    const onEndTrip = () => {
        if (!paymentMode) {
            triggerHaptic(HapticFeedbackTypes.notificationError);
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
                rating: rating,
            }).unwrap();

            dispatch(clearAcceptedRide());
            triggerHaptic(HapticFeedbackTypes.notificationSuccess);
            setIsFinished(true);
        } catch (err: any) {
            triggerHaptic(HapticFeedbackTypes.notificationError);
            const errorMsg = err?.data?.message?.toLowerCase() || '';
            const isAlreadyDone = errorMsg.includes('already completed') || errorMsg.includes('cancelled');

            if (isAlreadyDone) {
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

    // Styling constants
    const PRIMARY_COLOR = theme.colors.primary || '#152D5E';
    const bgColor = isDark ? '#121212' : '#FFFFFF';
    const cardBg = isDark ? '#1E1E1E' : '#F9FAFB';
    const textPrimary = isDark ? '#F9FAFB' : '#111827';
    const textSecondary = isDark ? '#9CA3AF' : '#6B7280';
    const borderColorTheme = isDark ? 'rgba(255,255,255,0.05)' : '#E5E7EB';

    if (isFinished) {
        return (
            <View style={[styles.successContainer, { backgroundColor: '#F9FCFA' }]}>
                <AppStatusBar forceDark={false} />

                <View style={styles.cityBgContainer}>
                    <View style={styles.treeLeft}>
                        <View style={styles.treeTop} />
                        <View style={styles.treeTrunk} />
                    </View>
                    <View style={styles.buildingLeft1} />
                    <View style={styles.buildingLeft2} />
                    <View style={styles.buildingLeft3} />
                    <View style={styles.buildingRight1} />
                    <View style={styles.buildingRight2} />
                    <View style={styles.treeRight}>
                        <View style={styles.treeTop} />
                        <View style={styles.treeTrunk} />
                    </View>
                    <View style={styles.ground} />
                </View>

                <Animated.View entering={FadeIn.delay(200)} style={styles.successContent}>
                    <View style={styles.outerCircle}>
                        <View style={[styles.diamond, { top: -ms(10), left: ms(20) }]} />
                        <View style={[styles.diamondGreen, { top: ms(60), left: -ms(20) }]} />
                        <Ionicons name="sunny-outline" size={ms(24)} color="#47B872" style={{ position: 'absolute', top: -ms(10), right: ms(25) }} />
                        <View style={[styles.diamond, { top: ms(40), right: -ms(30) }]} />
                        <Ionicons name="sunny-outline" size={ms(18)} color="#47B872" style={{ position: 'absolute', bottom: ms(30), left: -ms(25) }} />
                        <View style={[styles.diamondGreen, { bottom: ms(20), right: -ms(10) }]} />

                        <View style={styles.middleCircle}>
                            <View style={styles.innerCircle}>
                                <Ionicons name="checkmark" size={ms(56)} color="#FFFFFF" />
                            </View>
                        </View>
                    </View>
                    <Text style={styles.successTitleText}>{t('trip_completed', 'Trip Completed!')}</Text>
                    <Text style={styles.successSubtitleText}>
                        {t('thank_you_trip', 'Thank you for completing the trip')}
                    </Text>
                </Animated.View>

                <Animated.View entering={SlideInDown.delay(500)} style={styles.successFooter}>
                    <Pressable
                        style={styles.doneBtnLight}
                        onPress={() => navigation.navigate(Dashboard_Nav)}
                    >
                        <Text style={styles.doneBtnTextLight}>{t('done') || 'Done'}</Text>
                    </Pressable>
                </Animated.View>
            </View>
        );
    }

    if (isInitialProcessing) {
        return (
            <View style={[styles.container, { backgroundColor: bgColor, justifyContent: 'center', alignItems: 'center' }]}>
                <AppStatusBar forceDark={false} />
                <ActivityIndicator size="large" color={PRIMARY_COLOR} />
                <Text style={{ marginTop: vs(16), fontSize: ms(16), fontWeight: '600', color: textPrimary }}>{t('processing_trip_details')}</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: isDark ? '#121212' : '#F9FCFA' }]}>
            <AppStatusBar forceDark={false} />

            {/* City Background */}
            <View style={styles.cityBgContainer}>
                <View style={styles.treeLeft}>
                    <View style={styles.treeTop} />
                    <View style={styles.treeTrunk} />
                </View>
                <View style={styles.buildingLeft1} />
                <View style={styles.buildingLeft2} />
                <View style={styles.buildingLeft3} />
                <View style={styles.buildingRight1} />
                <View style={styles.buildingRight2} />
                <View style={styles.treeRight}>
                    <View style={styles.treeTop} />
                    <View style={styles.treeTrunk} />
                </View>
                <View style={styles.ground} />
            </View>

            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={{ alignItems: 'center', paddingTop: vs(12) }}>
                    <Image
                        source={require('../../assets/images/tripc.png')}
                        style={{ width: width, height: vs(200), resizeMode: 'contain', marginBottom: vs(8) }}
                    />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>



                    {/* Fare Details */}
                    <Animated.View entering={FadeInDown.delay(200)} style={{ marginTop: vs(16) }}>
                        <View style={styles.fareRow}>
                            <Text style={[styles.fareLabel, { color: textSecondary }]}>{t('base_fare', 'Base Fare')}</Text>
                            <Text style={[styles.fareValue, { color: textPrimary }]}>₹{Math.round((ride?.base_fare || 0) + (ride?.distance_fare || 0) + (ride?.time_fare || 0) || (ride?.fare || ride?.price || 0))}</Text>
                        </View>

                        {!!ride?.driver_allowance && ride.driver_allowance > 0 && (
                            <View style={styles.fareRow}>
                                <Text style={[styles.fareLabel, { color: textSecondary }]}>{t('driver_allowance', 'Driver Allowance')}</Text>
                                <Text style={[styles.fareValue, { color: textPrimary }]}>₹{Math.round(ride.driver_allowance)}</Text>
                            </View>
                        )}

                        {!!ride?.waiting_charges && ride.waiting_charges > 0 && (
                            <View style={styles.fareRow}>
                                <Text style={[styles.fareLabel, { color: textSecondary }]}>{t('waiting_charges', 'Waiting Charges')}</Text>
                                <Text style={[styles.fareValue, { color: textPrimary }]}>₹{Math.round(ride.waiting_charges)}</Text>
                            </View>
                        )}

                        {((ride?.additional_charges || 0) + (ride?.toll_charges || 0) + (ride?.night_charges || 0)) > 0 && (
                            <View style={styles.fareRow}>
                                <Text style={[styles.fareLabel, { color: textSecondary }]}>{t('other_charges', 'Other Charges (Toll, Night, etc.)')}</Text>
                                <Text style={[styles.fareValue, { color: textPrimary }]}>₹{Math.round((ride?.additional_charges || 0) + (ride?.toll_charges || 0) + (ride?.night_charges || 0))}</Text>
                            </View>
                        )}

                        <View style={[styles.fareRow, { borderTopWidth: 1, borderTopColor: borderColorTheme, paddingTop: vs(12), marginTop: vs(4) }]}>
                            <Text style={[styles.fareLabel, { color: textPrimary, fontWeight: '700', fontSize: ms(16) }]}>{t('total_fare', 'Total Fare')}</Text>
                            <Text style={[styles.fareValue, { color: PRIMARY_COLOR, fontWeight: '800', fontSize: ms(16) }]}>{price}</Text>
                        </View>

                        <View style={styles.zeroCommBadge}>
                            <Ionicons name="checkmark-circle" size={ms(14)} color="#10B981" />
                            <Text style={styles.zeroCommText}>{t('100_percent_fare_note', '100% of fare goes to you')}</Text>
                        </View>
                    </Animated.View>

                    {/* Payment Method List Items */}
                    <Animated.View entering={FadeInDown.delay(300)} style={{ marginTop: vs(32) }}>
                        <Text style={[styles.sectionHeading, { color: textPrimary }]}>{t('select_received_method', 'Select Payment Method')}</Text>
                        <Text style={[styles.sectionSubheading, { color: textSecondary, marginBottom: vs(16), fontSize: ms(14) }]}>{t('choose_how_customer_paid', 'Choose how the customer has paid for this trip')}</Text>

                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => selectPayment('CASH')}
                            style={[
                                styles.paymentListItem,
                                { backgroundColor: 'transparent', borderColor: '#E5E7EB' },
                                paymentMode === 'CASH' && { borderColor: '#16A34A' }
                            ]}
                        >
                            <View style={[styles.paymentIconBg, { backgroundColor: '#DCFCE7' }]}>
                                <Ionicons name="cash-outline" size={ms(24)} color="#16A34A" />
                            </View>
                            <View style={{ marginLeft: ms(16), flex: 1 }}>
                                <Text style={[styles.paymentListTitle, { color: textPrimary }]}>{t('cash', 'Cash')}</Text>
                                <Text style={[styles.paymentListSub, { color: textSecondary, marginTop: vs(4), fontSize: ms(13) }]}>{t('customer_pay_cash', 'Customer will pay in cash')}</Text>
                            </View>
                            <View style={styles.checkArea}>
                                {paymentMode === 'CASH' ? (
                                    <View style={styles.radioSelected}>
                                        <View style={styles.radioInner} />
                                    </View>
                                ) : (
                                    <View style={styles.radioUnselected} />
                                )}
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => selectPayment('UPI')}
                            style={[
                                styles.paymentListItem,
                                { backgroundColor: 'transparent', borderColor: '#E5E7EB' },
                                paymentMode === 'UPI' && { borderColor: '#16A34A' }
                            ]}
                        >
                            <View style={[styles.paymentIconBg, { backgroundColor: '#DBEAFE' }]}>
                                <Ionicons name="card-outline" size={ms(24)} color="#2563EB" />
                            </View>
                            <View style={{ marginLeft: ms(16), flex: 1 }}>
                                <Text style={[styles.paymentListTitle, { color: textPrimary }]}>{t('online', 'Online')}</Text>
                                <Text style={[styles.paymentListSub, { color: textSecondary, marginTop: vs(4), fontSize: ms(13) }]}>{t('customer_paid_online', 'Customer has paid online')}</Text>
                            </View>
                            <View style={styles.checkArea}>
                                {paymentMode === 'UPI' ? (
                                    <View style={styles.radioSelected}>
                                        <View style={styles.radioInner} />
                                    </View>
                                ) : (
                                    <View style={styles.radioUnselected} />
                                )}
                            </View>
                        </TouchableOpacity>
                    </Animated.View>

                    {/* Trip Summary */}
                    <Animated.View entering={FadeInDown.delay(400)} style={{ marginTop: vs(32) }}>
                        <View style={[styles.accordionHeader, { backgroundColor: 'transparent' }]}>
                            <Text style={[styles.accordionTitle, { color: textPrimary, fontSize: ms(18), fontWeight: '800' }]}>{t('trip_summary', 'Trip Summary')}</Text>
                        </View>

                        <Animated.View entering={FadeInDown.duration(200)} style={[styles.accordionContent, { backgroundColor: 'transparent' }]}>
                            {/* Trip ID */}
                            <View style={[styles.summaryRow, { borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: vs(12), marginBottom: vs(12) }]}>
                                <View style={styles.summaryLabelWrap}>
                                    <Ionicons name="git-branch-outline" size={ms(18)} color="#10B981" />
                                    <Text style={[styles.summaryLabel, { color: textSecondary }]}>{t('trip_id_label', 'Trip ID')}</Text>
                                </View>
                                <Text style={[styles.summaryValue, { color: textPrimary }]}>{ride?.trip_code || ride?.trip_id || ride?.id ? `#${ride?.trip_code || ride?.trip_id || ride?.id}` : 'N/A'}</Text>
                            </View>

                            {/* Customer */}
                            <View style={[styles.summaryRow, { borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: vs(12), marginBottom: vs(12) }]}>
                                <View style={styles.summaryLabelWrap}>
                                    <Ionicons name="person-outline" size={ms(18)} color="#10B981" />
                                    <Text style={[styles.summaryLabel, { color: textSecondary }]}>{t('customer', 'Customer')}</Text>
                                </View>
                                <Text style={[styles.summaryValue, { color: textPrimary }]}>{ride?.passenger_details?.name || ride?.user_details?.full_name || ride?.user_details?.first_name || ride?.passenger || ride?.passenger_name || ride?.customer?.name || t('passenger', 'Passenger')}</Text>
                            </View>

                            {/* Pickup */}
                            <View style={[styles.summaryRow, { borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: vs(12), marginBottom: vs(12) }]}>
                                <View style={[styles.summaryLabelWrap, { minWidth: ms(100) }]}>
                                    <Ionicons name="location-outline" size={ms(18)} color="#10B981" />
                                    <Text style={[styles.summaryLabel, { color: textSecondary }]}>{t('pickup', 'Pickup')}</Text>
                                </View>
                                <View style={{ flex: 1, marginLeft: ms(16), alignItems: 'flex-start' }}>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-start' }} style={{ maxWidth: '100%' }}>
                                        <Text style={[styles.summaryValue, { color: textPrimary }]}>
                                            {ride?.pickup_address || ride?.pickup || ride?.pickup_location || 'N/A'}
                                        </Text>
                                    </ScrollView>
                                </View>
                            </View>

                            {/* Drop */}
                            <View style={[styles.summaryRow, { borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: vs(12), marginBottom: vs(12) }]}>
                                <View style={[styles.summaryLabelWrap, { minWidth: ms(100) }]}>
                                    <Ionicons name="location" size={ms(18)} color="#EF4444" />
                                    <Text style={[styles.summaryLabel, { color: textSecondary }]}>{t('drop', 'Drop')}</Text>
                                </View>
                                <View style={{ flex: 1, marginLeft: ms(16), alignItems: 'flex-start' }}>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-start' }} style={{ maxWidth: '100%' }}>
                                        <Text style={[styles.summaryValue, { color: textPrimary }]}>
                                            {ride?.drop_address || ride?.drop || ride?.drop_location || 'N/A'}
                                        </Text>
                                    </ScrollView>
                                </View>
                            </View>

                            {/* Duration */}
                            <View style={[styles.summaryRow, { borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: vs(12), marginBottom: vs(12) }]}>
                                <View style={styles.summaryLabelWrap}>
                                    <Ionicons name="time-outline" size={ms(18)} color="#3B82F6" />
                                    <Text style={[styles.summaryLabel, { color: textSecondary }]}>{t('duration', 'Duration')}</Text>
                                </View>
                                <Text style={[styles.summaryValue, { color: textPrimary }]}>{formatDuration(actualDuration ?? ride?.duration ?? ride?.trip_duration_minutes ?? ride?.eta)}</Text>
                            </View>

                            {/* Distance */}
                            <View style={[styles.summaryRow, { borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: vs(12), marginBottom: vs(12) }]}>
                                <View style={styles.summaryLabelWrap}>
                                    <Ionicons name="swap-horizontal-outline" size={ms(18)} color="#8B5CF6" />
                                    <Text style={[styles.summaryLabel, { color: textSecondary }]}>{t('distance', 'Distance')}</Text>
                                </View>
                                <Text style={[styles.summaryValue, { color: textPrimary }]}>
                                    {actualDistance !== undefined ? `${actualDistance} ${t('km_unit', 'km')}` : (ride?.distance_km || ride?.distance ? `${ride.distance_km || ride.distance} ${t('km_unit', 'km')}` : `0 ${t('km_unit', 'km')}`)}
                                </Text>
                            </View>

                            {/* Earnings */}
                            <View style={[styles.summaryRow]}>
                                <View style={styles.summaryLabelWrap}>
                                    <Text style={{ fontSize: ms(18), color: '#F59E0B', fontWeight: 'bold' }}>₹</Text>
                                    <Text style={[styles.summaryLabel, { color: textSecondary }]}>{t('earnings', 'Earnings')}</Text>
                                </View>
                                <Text style={[styles.summaryValue, { color: '#16A34A', fontWeight: '800' }]}>{price}</Text>
                            </View>
                        </Animated.View>
                    </Animated.View>
                    {/* Contextual Action (UPI QR) */}
                    {paymentMode === 'UPI' && (
                        <Animated.View entering={FadeInDown.duration(300)} style={{ marginTop: vs(16) }}>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={handleOpenGallery}
                                style={[styles.upiShareBtn, { backgroundColor: cardBg, borderColor: borderColorTheme }]}
                            >
                                <Ionicons name="qr-code-outline" size={ms(24)} color={PRIMARY_COLOR} />
                                <View style={{ marginLeft: ms(12) }}>
                                    <Text style={[styles.upiShareTitle, { color: textPrimary }]}>{t('share_qr') || 'Share QR Code'}</Text>
                                    <Text style={[styles.upiShareSub, { color: textSecondary }]}>{t('pick_from_gallery', 'Pick from gallery')}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={ms(20)} color={textSecondary} style={{ marginLeft: 'auto' }} />
                            </TouchableOpacity>
                        </Animated.View>
                    )}

                    {/* Divider */}
                    <View style={{ height: 1, backgroundColor: borderColorTheme, marginTop: vs(24), marginBottom: vs(8) }} />

                    {/* Rating UI */}
                    <Animated.View entering={FadeInDown.duration(400)} style={styles.ratingCard}>
                        <Text style={[styles.ratingMainTitle, { color: isDark ? '#F9FAFB' : '#1E293B' }]}>{t('how_was_trip', 'How was your trip?')}</Text>
                        <Text style={[styles.ratingSubTitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>{t('rate_experience', 'Rate your experience')}</Text>
                        <View style={styles.starsRow}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <Pressable
                                    key={star}
                                    onPress={() => {
                                        setRating(star);
                                        triggerHaptic(HapticFeedbackTypes.impactLight);
                                    }}
                                    style={styles.starBtn}
                                >
                                    <Ionicons
                                        name={rating >= star ? 'star' : 'star-outline'}
                                        size={ms(38)}
                                        color={rating >= star ? '#FBBF24' : (isDark ? '#4B5563' : '#E5E7EB')}
                                    />
                                </Pressable>
                            ))}
                        </View>
                        <Text style={[styles.ratingFeedback, { color: getRatingText(rating).color }]}>{getRatingText(rating).text}</Text>
                    </Animated.View>

                </ScrollView>

                {/* Footer */}
                <View style={[styles.footer, { backgroundColor: bgColor, borderTopColor: borderColorTheme }]}>
                    <TouchableOpacity
                        activeOpacity={0.85}
                        style={[
                            styles.endTripBtn,
                            { backgroundColor: paymentMode ? '#47B872' : (isDark ? '#374151' : '#E5E7EB') }
                        ]}
                        onPress={onEndTrip}
                        disabled={!paymentMode || isProcessing}
                    >
                        {isProcessing ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: ms(8) }}>
                                <Text style={[styles.endTripBtnText, { color: paymentMode ? '#FFF' : textSecondary }]}>{t('end_trip', 'End Trip')}</Text>
                                <Ionicons name="exit-outline" size={ms(20)} color={paymentMode ? '#FFF' : textSecondary} />
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1 },
    header: { alignItems: 'center', paddingVertical: vs(20) },
    title: { fontSize: ms(24), fontWeight: '800' },
    subtitle: { fontSize: ms(15), marginTop: vs(4) },

    scrollContent: { paddingHorizontal: ms(20), paddingBottom: vs(40) },

    earningContainer: { alignItems: 'center', marginVertical: vs(24) },
    earningLabel: { fontSize: ms(14), textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' },
    earningValue: { fontSize: ms(42), fontWeight: '900', letterSpacing: -1, marginVertical: vs(8) },

    statsPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: ms(16), paddingVertical: vs(8), borderRadius: ms(20), gap: ms(12) },
    statItem: { flexDirection: 'row', alignItems: 'center', gap: ms(4) },
    statItemText: { fontSize: ms(14), fontWeight: '600' },
    statDivider: { width: 1, height: ms(14) },
    tripIdText: { fontSize: ms(13), marginTop: vs(16), fontWeight: '600' },

    accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: ms(16), paddingHorizontal: 0 },
    accordionTitle: { fontSize: ms(15), fontWeight: '700' },
    accordionContent: { paddingBottom: ms(16), paddingTop: ms(8), paddingHorizontal: 0, marginTop: 0 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    summaryLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: ms(12) },
    summaryLabel: { fontSize: ms(15) },
    summaryValue: { fontSize: ms(15), fontWeight: '500' },
    fareRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: vs(12) },
    fareLabel: { fontSize: ms(14) },
    fareValue: { fontSize: ms(14), fontWeight: '600' },
    zeroCommBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B98115', alignSelf: 'center', paddingHorizontal: ms(12), paddingVertical: vs(6), borderRadius: ms(12), gap: ms(6), marginTop: vs(8) },
    zeroCommText: { color: '#10B981', fontSize: ms(12), fontWeight: '700' },

    sectionHeading: { fontSize: ms(18), fontWeight: '800', marginBottom: vs(4) },
    sectionSubheading: { fontSize: ms(14), fontWeight: '400', marginBottom: vs(12) },
    paymentListItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: vs(12), paddingHorizontal: ms(16), borderRadius: ms(12), borderWidth: 1, marginBottom: vs(12) },
    paymentIconBg: { width: ms(40), height: ms(40), borderRadius: ms(20), justifyContent: 'center', alignItems: 'center' },
    paymentListTitle: { fontSize: ms(16), fontWeight: '700' },
    paymentListSub: { fontSize: ms(13), fontWeight: '500' },
    checkArea: { marginLeft: 'auto' },
    radioSelected: { width: ms(24), height: ms(24), borderRadius: ms(12), borderWidth: ms(2), borderColor: '#16A34A', justifyContent: 'center', alignItems: 'center' },
    radioInner: { width: ms(12), height: ms(12), borderRadius: ms(6), backgroundColor: '#16A34A' },
    radioUnselected: { width: ms(24), height: ms(24), borderRadius: ms(12), borderWidth: ms(2), borderColor: '#D1D5DB' },

    upiShareBtn: { flexDirection: 'row', alignItems: 'center', padding: ms(16), borderRadius: ms(20), borderWidth: 1 },
    upiShareTitle: { fontSize: ms(16), fontWeight: '700' },
    upiShareSub: { fontSize: ms(13), marginTop: vs(2) },

    footer: { paddingHorizontal: ms(20), paddingBottom: vs(32), paddingTop: vs(16), borderTopWidth: 1 },
    ratingCard: { alignItems: 'center', marginTop: vs(16), paddingVertical: vs(12) },
    ratingMainTitle: { fontSize: ms(18), fontWeight: '700', marginBottom: vs(4) },
    ratingSubTitle: { fontSize: ms(14), fontWeight: '400', marginBottom: vs(16) },
    ratingFeedback: { fontSize: ms(16), fontWeight: '600', marginTop: vs(12) },
    starsRow: { flexDirection: 'row', gap: ms(8) },
    starBtn: { padding: ms(4) },
    endTripBtn: { height: vs(56), borderRadius: ms(16), justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
    endTripBtnText: { fontSize: ms(16), fontWeight: '800' },

    // Success Screen
    successContainer: { flex: 1, backgroundColor: '#F9FCFA' },
    successContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: ms(32), zIndex: 1 },

    outerCircle: {
        width: ms(200),
        height: ms(200),
        borderRadius: ms(100),
        backgroundColor: 'rgba(71, 184, 114, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: vs(40),
    },
    middleCircle: {
        width: ms(140),
        height: ms(140),
        borderRadius: ms(70),
        backgroundColor: 'rgba(71, 184, 114, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    innerCircle: {
        width: ms(96),
        height: ms(96),
        borderRadius: ms(48),
        backgroundColor: '#47B872',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#47B872',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    diamond: { width: ms(8), height: ms(8), borderWidth: 1.5, borderColor: '#F59E0B', transform: [{ rotate: '45deg' }], position: 'absolute' },
    diamondGreen: { width: ms(8), height: ms(8), borderWidth: 1.5, borderColor: '#47B872', transform: [{ rotate: '45deg' }], position: 'absolute' },

    successTitleText: { fontSize: ms(26), fontWeight: '800', color: '#38A15E', marginBottom: vs(12), textAlign: 'center' },
    successSubtitleText: { fontSize: ms(16), color: '#6C757D', textAlign: 'center', lineHeight: vs(24) },

    successFooter: { position: 'absolute', bottom: vs(40), left: ms(32), right: ms(32), zIndex: 2 },
    doneBtnLight: { backgroundColor: '#47B872', height: vs(56), borderRadius: ms(28), justifyContent: 'center', alignItems: 'center', shadowColor: '#47B872', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
    doneBtnTextLight: { fontSize: ms(16), fontWeight: '700', color: '#FFFFFF' },

    // City Background
    cityBgContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', opacity: 0.15, zIndex: 0 },
    ground: { height: vs(140), backgroundColor: '#47B872', width: '100%' },
    treeLeft: { position: 'absolute', bottom: vs(140), left: ms(25), alignItems: 'center' },
    treeRight: { position: 'absolute', bottom: vs(140), right: ms(25), alignItems: 'center' },
    treeTop: { width: ms(28), height: ms(40), borderRadius: ms(14), backgroundColor: '#47B872' },
    treeTrunk: { width: ms(4), height: ms(16), backgroundColor: '#47B872' },
    buildingLeft1: { position: 'absolute', bottom: vs(140), left: ms(70), width: ms(28), height: vs(50), backgroundColor: '#47B872', borderTopLeftRadius: 2, borderTopRightRadius: 2 },
    buildingLeft2: { position: 'absolute', bottom: vs(140), left: ms(100), width: ms(22), height: vs(80), backgroundColor: '#47B872', borderTopLeftRadius: 2, borderTopRightRadius: 2 },
    buildingLeft3: { position: 'absolute', bottom: vs(140), left: ms(124), width: ms(30), height: vs(60), backgroundColor: '#47B872', borderTopLeftRadius: 2, borderTopRightRadius: 2 },
    buildingRight1: { position: 'absolute', bottom: vs(140), right: ms(90), width: ms(35), height: vs(95), backgroundColor: '#47B872', borderTopLeftRadius: 2, borderTopRightRadius: 2 },
    buildingRight2: { position: 'absolute', bottom: vs(140), right: ms(60), width: ms(28), height: vs(65), backgroundColor: '#47B872', borderTopLeftRadius: 2, borderTopRightRadius: 2 },
});

export default PaymentCollectionScreen;
