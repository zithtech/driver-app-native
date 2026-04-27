import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Animated,
  Dimensions,
  Image,
  Share,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import RNPrint from 'react-native-print';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useTheme } from '@react-navigation/native';
import { useAlert } from '../../context/AlertContext';
import { useHaptic } from '../../hooks/useHaptic';
import { formatCurrency } from '../../lib/currency';
import { useAppTheme } from '../../context/ThemeContext';
import AppStatusBar from '../../Components/AppStatusBar';
import { useIsFocused } from '@react-navigation/native';
import { useGetTripByIdQuery } from '../../service/driverApi';

const { width } = Dimensions.get('window');

const RideDetailScreen: React.FC<any> = ({ route, navigation }) => {
  const { theme, isDark } = useAppTheme();
  const isFocused = useIsFocused();
  const { showAlert } = useAlert();
  const { t } = useTranslation();
  const { ride: initialRide } = route.params;
  const { triggerHaptic } = useHaptic();

  // Fetch full details
  const { data: tripResult, isLoading: isFirstLoading } = useGetTripByIdQuery(initialRide.id, {
    skip: !initialRide.id,
  });

  const rawTripData = tripResult?.data;
  const isLoading = isFirstLoading;

  const extractTripObject = (result: any) => {
    if (!result) return null;
    if (result.trip_id || result.pickup_address || result.pickup) return result;
    if (result.data && (result.data.trip_id || result.data.pickup_address || result.data.pickup)) return result.data;
    if (result.trip && (result.trip.trip_id || result.trip.pickup_address || result.trip.pickup)) return result.trip;
    // fallback catch-all
    return result.data || result;
  };

  // Map trip data to format expected by UI
  const getRide = () => {
    const tripData = extractTripObject(rawTripData);
    if (!tripData || Object.keys(tripData).length === 0) return initialRide;

    // Helper to format values
    const rawAmount = tripData.amount !== undefined ? tripData.amount : tripData.total_fare;
    const amount = typeof rawAmount === 'string' ? parseFloat(rawAmount || '0') : (rawAmount || 0);
    
    let dateObj = new Date();
    if (tripData.created_at) { dateObj = new Date(tripData.created_at); } 
    else if (tripData.date && tripData.date.includes('-')) { dateObj = new Date(tripData.date); }

    // Map timeline from trip_changes if available
    const timeline: any = {};
    if (tripData.trip_changes && Array.isArray(tripData.trip_changes)) {
      tripData.trip_changes.forEach((change: any) => {
        const time = new Date(change.changed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (change.new_value?.trip_status === 'REQUESTED') timeline.requestedAt = time;
        if (change.new_value?.trip_status === 'ARRIVED') timeline.arrivedAt = time;
        if (change.new_value?.trip_status === 'LIVE' || change.new_value?.trip_status === 'STARTED') timeline.startedAt = time;
        if (change.new_value?.trip_status === 'COMPLETED') timeline.completedAt = time;
        if (change.new_value?.trip_status === 'CANCELLED') timeline.cancelledAt = time;
      });
    }

    // fallback if timeline is empty
    if (Object.keys(timeline).length === 0) {
      if (tripData.created_at) timeline.requestedAt = new Date(tripData.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (tripData.trip_status === 'COMPLETED' && tripData.updated_at) timeline.completedAt = new Date(tripData.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (tripData.trip_status === 'CANCELLED' && tripData.updated_at) timeline.cancelledAt = new Date(tripData.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    let finalStatus = tripData.status || '';
    if (tripData.trip_status) {
      finalStatus = tripData.trip_status === 'COMPLETED' ? 'Completed' : tripData.trip_status === 'CANCELLED' ? 'Cancelled' : tripData.trip_status;
    } else if (tripData.status) {
      finalStatus = tripData.status === 'COMPLETED' ? 'Completed' : tripData.status === 'CANCELLED' ? 'Cancelled' : tripData.status;
    }

    return {
      ...initialRide,
      id: tripData.trip_id?.toString() || tripData.id?.toString() || initialRide.id?.toString() || '',
      date: tripData.date || dateObj.toLocaleDateString(),
      time: tripData.time || dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      pickup: tripData.pickup_address || tripData.pickup || initialRide.pickup || 'Unknown Pickup',
      drop: tripData.drop_address || tripData.drop || initialRide.drop || 'Unknown Drop',
      amount: amount || initialRide.amount || 0,
      distance: tripData.distance_km ? `${tripData.distance_km} km` : (tripData.distance || initialRide.distance || '0 km'),
      status: finalStatus || initialRide.status || '',
      trip_code: tripData.trip_code || tripData.booking_code || initialRide.trip_code || '',
      customer: {
        ...initialRide.customer,
        name: tripData.passenger_name || tripData.customer?.name || initialRide.customer?.name || 'Customer',
        ratingGiven: tripData.rating || tripData.user_rating || tripData.trip_rating || initialRide.customer?.ratingGiven,
        comment: tripData.feedback || tripData.comment || tripData.user_feedback || initialRide.customer?.comment || '',
      },
      fareDetails: {
        base: parseFloat(tripData.base_fare || tripData.fareDetails?.base || '0'),
        distance: parseFloat(tripData.distance_fare || tripData.fareDetails?.distance || '0'), 
        time: parseFloat(tripData.waiting_charges || tripData.fareDetails?.time || '0'),
        platformFee: parseFloat(tripData.platform_fee || tripData.fareDetails?.platformFee || '0'),
      },
      timeline: Object.keys(timeline).length > 0 ? timeline : (tripData.timeline || initialRide.timeline || {}),
      paymentMethod: tripData.payment_status === 'PAID' ? 'Wallet' : (tripData.payment_method || tripData.paymentMethod || initialRide.paymentMethod || 'Cash'),
    };
  };

  const ride = getRide();

  const downloadInvoice = async (ride: any) => {
    triggerHaptic(HapticFeedbackTypes.impactLight);
    try {
      const html = `
        <html>
          <body style="font-family: Arial; padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h1 style="color: #2563EB;">${t('invoice')}</h1>
              <p style="color: #666;">#${ride.id || 'DR-' + ride.id}</p>
            </div>
            
            <hr style="border: 0; border-top: 1px solid #eee;" />
            
            <div style="margin: 20px 0;">
              <p><b>${t('date')}:</b> ${ride.date}</p>
              <p><b>${t('time')}:</b> ${ride.time}</p>
            </div>

            <div style="margin: 20px 0;">
              <p><b>${t('from')}:</b> ${ride.pickup}</p>
              <p><b>${t('to')}:</b> ${ride.drop}</p>
            </div>

            <table width="100%" style="border-collapse: collapse; margin-top: 30px;">
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0;">${t('base_fare')}</td>
                <td style="text-align: right;">${formatCurrency(ride.fareDetails?.base || 0)}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0;">${t('distance_fare')} (${ride.distance || '0 km'})</td>
                <td style="text-align: right;">${formatCurrency(ride.fareDetails?.distance || 0)}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0;">${t('time_fare')}</td>
                <td style="text-align: right;">${formatCurrency(ride.fareDetails?.time || 0)}</td>
              </tr>
              <tr style="border-bottom: 2px solid #333;">
                <td style="padding: 15px 0;"><b>${ride.status === 'Cancelled' ? t('cancellation_charge') : t('total_earnings')}</b></td>
                <td style="text-align: right;"><b>${formatCurrency(Math.abs(ride.amount))}</b></td>
              </tr>
            </table>

            <p style="margin-top: 40px; font-size: 12px; color: #888; text-align: center;">
              ${t('thank_you_driving')}
            </p>
          </body>
        </html>
      `;
      await RNPrint.print({ html });
    } catch (error) {
      showAlert({
        title: t('error'),
        message: t('invoice_error'),
        singleButton: true,
        icon: 'alert-circle-outline',
      });
    }
  };

  const handleShare = async () => {
    triggerHaptic(HapticFeedbackTypes.impactLight);
    try {
      const shareMessage = `Ride Details (#${ride.id || 'DR-' + ride.id})\n\nDate: ${ride.date} • ${ride.time}\nFrom: ${ride.pickup}\nTo: ${ride.drop}\nEarnings: ${formatCurrency(Math.abs(ride.amount))}`;
      await Share.share({
        message: shareMessage,
      });
    } catch (error) {
    }
  };

  const handleReportIssue = () => {
    triggerHaptic(HapticFeedbackTypes.impactLight);
    showAlert({
      title: t('report_issue'),
      message: t('report_issue_desc', { id: ride.id }),
      confirmText: t('report') || 'Report',
      cancelText: t('cancel'),
      onConfirm: () =>
        showAlert({
          title: 'Success',
          message: 'Support request sent. We will contact you soon.',
          singleButton: true,
          icon: 'checkmark-circle-outline',
        }),
    });
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {isFocused && <AppStatusBar />}
      <View style={[styles.header, { backgroundColor: theme.colors.background, borderBottomColor: isDark ? '#374151' : '#F3F4F6' }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={isDark ? '#FFFFFF' : '#1F2937'} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: isDark ? '#FFFFFF' : '#1F2937' }]}>{t('ride_details')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {isLoading ? (
          <RideDetailSkeleton />
        ) : (
          <>
            {/* Ride Status Card */}
            <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={[styles.rideId, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                    #{ride.trip_code || ride.id || 'TRIP-ID'}
                  </Text>
                  <Text style={[styles.dateTime, isDark && { color: '#9CA3AF' }]}>{ride.date} • {ride.time}</Text>
                </View>
                <StatusBadge status={ride.status} label={t(ride.status.toLowerCase())} isDark={isDark} />
              </View>

              <View style={[styles.divider, isDark && { backgroundColor: '#374151' }]} />

              <View style={styles.routeContainer}>
                <View style={styles.routeItem}>
                  <View style={styles.iconColumn}>
                    <Ionicons name="radio-button-on" size={18} color={isDark ? '#34D399' : '#16A34A'} />
                    <View style={[styles.verticalLine, isDark && { backgroundColor: '#4B5563' }]} />
                  </View>
                  <View style={styles.routeTextBody}>
                    <Text style={[styles.routeText, { color: isDark ? '#FFFFFF' : '#374151' }]}>{ride.pickup}</Text>
                  </View>
                </View>

                <View style={styles.routeItem}>
                  <View style={styles.iconColumn}>
                    <Ionicons name="location" size={18} color="#DC2626" />
                  </View>
                  <View style={styles.routeTextBody}>
                    <Text style={[styles.routeText, { color: isDark ? '#FFFFFF' : '#374151' }]}>{ride.drop}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Customer Information Section */}
            {ride.customer && (
              <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
                <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>{t('customer_details')}</Text>
                <View style={styles.customerRow}>
                  <Image source={{ uri: ride.customer.image || 'https://ui-avatars.com/api/?name=Customer' }} style={styles.customerAvatar} />
                  <View style={styles.customerInfo}>
                    <Text style={[styles.customerName, { color: isDark ? '#F3F4F6' : '#1F2937' }]}>{ride.customer.name}</Text>
                    {ride.status === 'Completed' ? (
                      <View style={[styles.ratingBox, isDark && { backgroundColor: 'rgba(251, 191, 36, 0.1)', borderColor: 'rgba(251, 191, 36, 0.2)' }]}>
                        <Ionicons name="star" size={14} color="#FBBF24" />
                        <Text style={[styles.ratingText, isDark && { color: '#FCD34D' }]}>{ride.customer.ratingGiven?.toFixed(1) || t('no_rating')}</Text>
                      </View>
                    ) : (
                      <Text style={[styles.noRatingText, isDark && { color: '#9CA3AF' }]}>{t('trip')} {t(ride.status.toLowerCase())}</Text>
                    )}
                  </View>
                </View>
                {ride.customer.comment && (
                  <View style={[styles.commentBox, isDark && { backgroundColor: '#374151', borderLeftColor: '#4B5563' }]}>
                    <Text style={[styles.commentText, isDark && { color: '#D1D5DB' }]}>"{ride.customer.comment}"</Text>
                  </View>
                )}
              </View>
            )}

            {/* Trip Timeline */}
            <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
              <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>{t('trip_timeline')}</Text>

              {ride.timeline ? (
                <>
                  {ride.timeline.requestedAt && (
                    <TimelineItem
                      status={t('requested')}
                      time={ride.timeline.requestedAt}
                      completed={true}
                      isLast={ride.status === 'Cancelled' ? !ride.timeline.cancelledAt : !ride.timeline.arrivedAt}
                      isDark={isDark}
                    />
                  )}

                  {ride.status === 'Cancelled' && ride.timeline.cancelledAt && (
                    <TimelineItem
                      status={t('cancelled')}
                      time={ride.timeline.cancelledAt}
                      completed={true}
                      isLast={true}
                      color={isDark ? '#F87171' : '#DC2626'}
                      isDark={isDark}
                    />
                  )}

                  {ride.status !== 'Cancelled' && ride.timeline.arrivedAt && (
                    <TimelineItem
                      status={t('arrived')}
                      time={ride.timeline.arrivedAt}
                      completed={true}
                      isLast={!ride.timeline.startedAt}
                      isDark={isDark}
                    />
                  )}

                  {ride.status !== 'Cancelled' && ride.timeline.startedAt && (
                    <TimelineItem
                      status={t('started')}
                      time={ride.timeline.startedAt}
                      completed={true}
                      isLast={!ride.timeline.completedAt}
                      isDark={isDark}
                    />
                  )}

                  {ride.status !== 'Cancelled' && ride.timeline.completedAt && (
                    <TimelineItem
                      status={t('completed')}
                      time={ride.timeline.completedAt}
                      completed={ride.status === 'Completed'}
                      isLast={true}
                      isDark={isDark}
                    />
                  )}
                </>
              ) : (
                <Text style={{ color: isDark ? '#9CA3AF' : '#6B7280', fontSize: 13, fontStyle: 'italic' }}>
                  {t('timeline_unavailable')}
                </Text>
              )}
            </View>

            {/* Fare Breakdown (Receipt Style) */}
            <View style={[styles.section, styles.receiptCard, isDark && { backgroundColor: theme.colors.card, borderColor: '#374151' }]}>
              <View style={[styles.receiptTopEdge, isDark && { borderBottomColor: theme.colors.background }]} />

              <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>{t('fare_breakdown')}</Text>
              <FareRow label={t('base_fare')} value={formatCurrency(ride.fareDetails?.base || 0)} isDark={isDark} />
              <FareRow label={t('distance_fare', { distance: ride.distance || '0 km' })} value={formatCurrency(ride.fareDetails?.distance || 0)} isDark={isDark} />
              <FareRow label={t('time_fare')} value={formatCurrency(ride.fareDetails?.time || 0)} isDark={isDark} />
              <FareRow label={t('platform_fee')} value={`- ${formatCurrency(ride.fareDetails?.platformFee || 0)}`} color={isDark ? '#F87171' : '#DC2626'} isDark={isDark} />

              <View style={[styles.receiptDashedLine, isDark && { borderColor: '#4B5563' }]} />

              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                  {ride.status === 'Cancelled' ? t('cancellation_charge') : t('your_earnings')}
                </Text>
                <Text style={[styles.totalValue, isDark && { color: ride.status === 'Cancelled' ? '#9CA3AF' : '#34D399' }]}>
                  {formatCurrency(Math.abs(ride.amount))}
                </Text>
              </View>

              <View style={[styles.receiptBottomEdge, isDark && { borderTopColor: theme.colors.background }]} />
            </View>

            {/* Payment and Support */}
            <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
              <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>{t('payment_method')}</Text>
              <View style={styles.paymentBox}>
                <Ionicons
                  name={ride.paymentMethod === 'Cash' ? 'cash-outline' : ride.paymentMethod === 'UPI' ? 'qr-code-outline' : 'wallet-outline'}
                  size={20}
                  color={isDark ? '#9CA3AF' : '#4B5563'}
                />
                <View>
                  <Text style={[styles.paymentText, { color: isDark ? '#E5E7EB' : '#374151' }]}>
                    {ride.paymentMethod ? (t(ride.paymentMethod.toLowerCase()) || ride.paymentMethod) : t('wallet')}
                  </Text>
                  {ride.settlementInfo && (
                    <Text style={[styles.settlementText, isDark && { color: '#9CA3AF' }]}>{ride.settlementInfo}</Text>
                  )}
                </View>
              </View>
            </View>

            <View style={styles.actionsGrid}>
              <View style={styles.actionRow}>
                <Pressable style={[styles.actionBtn, isDark && { backgroundColor: theme.colors.card, borderColor: '#4B5563' }]}>
                  <Ionicons name="headset-outline" size={20} color={isDark ? '#E5E7EB' : '#4B5563'} />
                  <Text style={[styles.actionBtnText, isDark && { color: '#E5E7EB' }]}>{t('support')}</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtnPrimary, ride.status === 'Cancelled' && styles.disabledBtn]}
                  onPress={() => ride.status !== 'Cancelled' && downloadInvoice(ride)}
                >
                  <Ionicons name="download-outline" size={20} color="#fff" />
                  <Text style={styles.actionBtnPrimaryText}>{t('invoice')}</Text>
                </Pressable>
              </View>

              <View style={styles.actionRow}>
                <Pressable style={[styles.actionBtn, isDark && { backgroundColor: theme.colors.card, borderColor: '#4B5563' }]} onPress={handleReportIssue}>
                  <Ionicons name="warning-outline" size={20} color={isDark ? '#F87171' : '#DC2626'} />
                  <Text style={[styles.actionBtnText, { color: isDark ? '#F87171' : '#DC2626' }]}>{t('report_issue')}</Text>
                </Pressable>
                <Pressable style={[styles.actionBtn, isDark && { backgroundColor: theme.colors.card, borderColor: '#4B5563' }]} onPress={handleShare}>
                  <Ionicons name="share-social-outline" size={20} color={isDark ? '#E5E7EB' : '#4B5563'} />
                  <Text style={[styles.actionBtnText, isDark && { color: '#E5E7EB' }]}>{t('share_details')}</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

/* Sub-components */
const StatusBadge = ({ status, label, isDark }: any) => (
  <View style={[
    styles.badge,
    status === 'Completed' ? [styles.success, isDark && { backgroundColor: 'rgba(22, 163, 74, 0.2)' }] : [styles.cancelled, isDark && { backgroundColor: 'rgba(220, 38, 38, 0.2)' }]
  ]}>
    <Text style={[styles.badgeText, isDark && { color: status === 'Completed' ? '#34D399' : '#F87171' }]}>{label || status}</Text>
  </View>
);

const TimelineItem = ({ status, time, completed, isLast, color, isDark }: any) => (
  <View style={styles.timelineItem}>
    <View style={styles.timelineLeft}>
      <View style={[
        styles.timelineDot,
        completed && (color ? { backgroundColor: color } : [styles.completedDot, isDark && { backgroundColor: '#60A5FA' }]),
        isDark && !completed && { backgroundColor: '#4B5563' }
      ]} />
      {!isLast && <View style={[
        styles.timelineLine,
        completed && [styles.completedLine, isDark && { backgroundColor: 'rgba(59, 130, 246, 0.3)' }],
        isDark && !completed && { backgroundColor: '#4B5563' }
      ]} />}
    </View>
    <View style={styles.timelineContent}>
      <Text style={[
        styles.timelineStatus,
        completed && (color ? { color } : [styles.completedStatus, isDark && { color: '#E5E7EB' }]),
        isDark && !completed && { color: '#9CA3AF' }
      ]}>{status}</Text>
      <Text style={[styles.timelineTime, isDark && { color: '#6B7280' }]}>{time}</Text>
    </View>
  </View>
);

const FareRow = ({ label, value, color, isDark }: any) => (
  <View style={styles.fareRow}>
    <Text style={[styles.fareLabel, isDark && { color: '#9CA3AF' }]}>{label}</Text>
    <Text style={[styles.fareValue, { color: color || (isDark ? '#E5E7EB' : '#1F2937') }]}>{value}</Text>
  </View>
);

const Shimmer = ({ translateX }: { translateX: any }) => (
  <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }], zIndex: 10 }]}>
    <LinearGradient
      colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={StyleSheet.absoluteFill}
    />
  </Animated.View>
);

const RideDetailSkeleton = () => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      })
    ).start();
  }, [animatedValue]);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });

  return (
    <View>
      {/* Ride Status Card Skeleton */}
      <View style={[styles.card, { overflow: 'hidden' }]}>
        <View style={styles.rowBetween}>
          <View>
            <View style={[styles.skeletonLine, { width: 120, height: 20 }]} />
            <View style={[styles.skeletonLine, { width: 160, marginTop: 8 }]} />
          </View>
          <View style={[styles.skeletonLine, { width: 80, height: 28, borderRadius: 20 }]} />
        </View>

        <View style={styles.divider} />

        <View style={styles.routeContainer}>
          <View style={styles.routeItem}>
            <View style={styles.iconColumn}>
              <View style={[styles.skeletonLine, { width: 16, height: 16, borderRadius: 8 }]} />
              <View style={styles.verticalLine} />
            </View>
            <View style={[styles.skeletonLine, { flex: 1, height: 16, marginTop: 4 }]} />
          </View>
          <View style={styles.routeItem}>
            <View style={styles.iconColumn}>
              <View style={[styles.skeletonLine, { width: 16, height: 16, borderRadius: 8 }]} />
            </View>
            <View style={[styles.skeletonLine, { flex: 1, height: 16, marginTop: 4 }]} />
          </View>
        </View>
        <Shimmer translateX={translateX} />
      </View>

      {/* Customer Information Skeleton */}
      <View style={[styles.section, { overflow: 'hidden' }]}>
        <View style={[styles.skeletonLine, { width: 140, height: 20, marginBottom: 16 }]} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={[styles.skeletonLine, { width: 50, height: 50, borderRadius: 25 }]} />
          <View style={{ gap: 8 }}>
            <View style={[styles.skeletonLine, { width: 120, height: 18 }]} />
            <View style={[styles.skeletonLine, { width: 60, height: 16 }]} />
          </View>
        </View>
        <Shimmer translateX={translateX} />
      </View>

      {/* Trip Timeline Skeleton */}
      <View style={[styles.section, { overflow: 'hidden' }]}>
        <View style={[styles.skeletonLine, { width: 140, height: 20, marginBottom: 16 }]} />
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.timelineItem}>
            <View style={styles.timelineLeft}>
              <View style={[styles.timelineDot, { backgroundColor: '#E5E7EB' }]} />
              {i !== 4 && <View style={styles.timelineLine} />}
            </View>
            <View style={[styles.timelineContent, { flex: 1 }]}>
              <View style={[styles.skeletonLine, { width: 100, height: 16 }]} />
              <View style={[styles.skeletonLine, { width: 60, height: 12, marginTop: 6 }]} />
            </View>
          </View>
        ))}
        <Shimmer translateX={translateX} />
      </View>

      {/* Fare Breakdown (Receipt Style) Skeleton */}
      <View style={[styles.section, styles.receiptCard, { overflow: 'hidden' }]}>
        <View style={styles.receiptTopEdge} />
        <View style={[styles.skeletonLine, { width: 140, height: 20, marginBottom: 16 }]} />
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.fareRow}>
            <View style={[styles.skeletonLine, { width: 120, height: 16 }]} />
            <View style={[styles.skeletonLine, { width: 60, height: 16 }]} />
          </View>
        ))}

        <View style={styles.receiptDashedLine} />

        <View style={styles.totalRow}>
          <View style={[styles.skeletonLine, { width: 100, height: 20 }]} />
          <View style={[styles.skeletonLine, { width: 80, height: 24 }]} />
        </View>
        <View style={styles.receiptBottomEdge} />
        <Shimmer translateX={translateX} />
      </View>

      {/* Actions Skeleton */}
      <View style={styles.actionsGrid}>
        <View style={styles.actionRow}>
          <View style={[styles.actionBtn, { backgroundColor: '#E5E7EB', overflow: 'hidden', borderColor: 'transparent' }]}>
            <Shimmer translateX={translateX} />
          </View>
          <View style={[styles.actionBtnPrimary, { backgroundColor: '#E5E7EB', overflow: 'hidden' }]}>
            <Shimmer translateX={translateX} />
          </View>
        </View>
        <View style={styles.actionRow}>
          <View style={[styles.actionBtn, { backgroundColor: '#E5E7EB', overflow: 'hidden', borderColor: 'transparent' }]}>
            <Shimmer translateX={translateX} />
          </View>
          <View style={[styles.actionBtn, { backgroundColor: '#E5E7EB', overflow: 'hidden', borderColor: 'transparent' }]}>
            <Shimmer translateX={translateX} />
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rideId: { fontSize: 16, fontWeight: '700', color: '#111827' },
  dateTime: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 16 },
  routeContainer: { gap: 12 },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconColumn: {
    alignItems: 'center',
    width: 24,
    marginRight: 12,
  },
  routeTextBody: {
    flex: 1,
  },
  routeText: { fontSize: 17, color: '#374151', fontWeight: '500', flex: 1 },
  verticalLine: { width: 2, flex: 1, backgroundColor: '#E5E7EB', marginVertical: 4 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  success: { backgroundColor: '#DCFCE7' },
  cancelled: { backgroundColor: '#FEE2E2' },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#111827' },

  /* Customer Details */
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  customerAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#E5E7EB' },
  customerInfo: { flex: 1, justifyContent: 'center' },
  customerName: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 4 },
  ratingBox: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFBEB', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#FEF3C7' },
  ratingText: { fontSize: 12, fontWeight: '700', color: '#B45309' },
  noRatingText: { fontSize: 13, color: '#6B7280' },
  commentBox: { marginTop: 12, padding: 12, backgroundColor: '#F3F4F6', borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#E5E7EB' },
  commentText: { fontSize: 13, fontStyle: 'italic', color: '#4B5563' },

  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16 },
  timelineItem: { flexDirection: 'row', gap: 16 },
  timelineLeft: { alignItems: 'center', width: 14 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E5E7EB' },
  completedDot: { backgroundColor: '#2563EB' },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#E5E7EB', marginVertical: 4 },
  completedLine: { backgroundColor: '#DBEAFE' },
  timelineContent: { paddingBottom: 20 },
  timelineStatus: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  completedStatus: { color: '#1F2937' },
  timelineTime: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  /* Fare/Receipt Styles */
  receiptCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    paddingTop: 24,
    paddingBottom: 24,
  },
  receiptTopEdge: {
    position: 'absolute',
    top: -5,
    left: 0,
    right: 0,
    height: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#F8FAFC',
    borderStyle: 'dashed',
  },
  receiptBottomEdge: {
    position: 'absolute',
    bottom: -5,
    left: 0,
    right: 0,
    height: 10,
    borderTopWidth: 2,
    borderTopColor: '#F8FAFC',
    borderStyle: 'dashed',
  },
  receiptDashedLine: {
    height: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    marginVertical: 12,
  },
  fareRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  fareLabel: { fontSize: 14, color: '#6B7280' },
  fareValue: { fontSize: 14, fontWeight: '600' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#111827' },
  totalValue: { fontSize: 18, fontWeight: '800', color: '#16A34A' },

  paymentBox: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  paymentText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  settlementText: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  /* Quick Actions */
  actionsGrid: { gap: 12, marginTop: 8 },
  actionRow: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionBtnText: { color: '#374151', fontWeight: '600', fontSize: 14 },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionBtnPrimaryText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  disabledBtn: { backgroundColor: '#9CA3AF', opacity: 0.6 },
  skeletonLine: {
    height: 14,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
  },
});

export default RideDetailScreen;
