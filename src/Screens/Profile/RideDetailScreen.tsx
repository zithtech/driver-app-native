import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Dimensions,
  Image,
  Share,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import RNPrint from 'react-native-print';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { calculateDistance } from '../../utils/locationUtils';
import { useAlert } from '../../context/AlertContext';
import { useHaptic } from '../../hooks/useHaptic';
import { formatCurrency } from '../../lib/currency';
import { useAppTheme } from '../../context/ThemeContext';
import AppStatusBar from '../../Components/AppStatusBar';
import { useIsFocused } from '@react-navigation/native';
import { useGetTripByIdQuery, useCreateSupportTicketMutation } from '../../service/driverApi';

const { width } = Dimensions.get('window');

const RideDetailScreen: React.FC<any> = ({ route, navigation }) => {
  const { theme, isDark } = useAppTheme();
  const isFocused = useIsFocused();
  const { showAlert } = useAlert();
  const { t } = useTranslation();
  const { ride: initialRide } = route.params;
  const { triggerHaptic } = useHaptic();

  // Helper: returns fallback if t() returns the raw key (contains underscores)
  const tt = (key: string, fallback: string, options?: any): string => {
    const result = t(key, options);
    // If the result is the same as the key, translation is missing
    if (result === key || (typeof result === 'string' && result.includes('_') && result === key)) {
      return fallback;
    }
    return String(result);
  };
  
  const [createTicket, { isLoading: isSubmittingTicket }] = useCreateSupportTicketMutation();
  const [isReportModalVisible, setReportModalVisible] = useState(false);
  const [selectedIssueCategory, setSelectedIssueCategory] = useState('');
  const [issueDescription, setIssueDescription] = useState('');

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
        if (typeof change.new_value === 'string') {
          try { change.new_value = JSON.parse(change.new_value); } catch (e) {}
        }
        const newVal = change.new_value;
        const time = new Date(change.changed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (newVal?.trip_status === 'REQUESTED') timeline.requestedAt = time;
        if (newVal?.trip_status === 'ACCEPTED') timeline.acceptedAt = time;
        if (newVal?.trip_status === 'ARRIVED') timeline.arrivedAt = time;
        if (newVal?.trip_status === 'LIVE' || newVal?.trip_status === 'STARTED') timeline.startedAt = time;
        if (newVal?.trip_status === 'DESTINATION_REACHED') timeline.destinationReachedAt = time;
        if (newVal?.trip_status === 'RETURN_REACHED') timeline.returnReachedAt = time;
        if (newVal?.trip_status === 'COMPLETED') timeline.completedAt = time;
        if (newVal?.trip_status === 'CANCELLED') timeline.cancelledAt = time;
      });
    }

    // fallback if timeline is empty
    if (Object.keys(timeline).length === 0) {
      if (tripData.created_at) timeline.requestedAt = new Date(tripData.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (tripData.trip_status === 'ACCEPTED' && tripData.updated_at) timeline.acceptedAt = new Date(tripData.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (tripData.trip_status === 'COMPLETED' && tripData.updated_at) timeline.completedAt = new Date(tripData.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (tripData.trip_status === 'CANCELLED' && tripData.updated_at) timeline.cancelledAt = new Date(tripData.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    let finalStatus = tripData.status || '';
    if (tripData.trip_status) {
      finalStatus = tripData.trip_status === 'COMPLETED' ? 'Completed' : tripData.trip_status === 'CANCELLED' ? 'Cancelled' : tripData.trip_status;
    } else if (tripData.status) {
      finalStatus = tripData.status === 'COMPLETED' ? 'Completed' : tripData.status === 'CANCELLED' ? 'Cancelled' : tripData.status;
    }

    // Calculate duration dynamically from ACCEPTED to COMPLETED
    let durationMin = 0;
    if (tripData.trip_changes && Array.isArray(tripData.trip_changes)) {
      const startChange = tripData.trip_changes.find((c: any) => c.new_value?.trip_status === 'ACCEPTED' || c.new_value?.trip_status === 'ASSIGNED');
      const endChange = tripData.trip_changes.find((c: any) => c.new_value?.trip_status === 'COMPLETED');
      if (startChange && endChange) {
        const startTime = new Date(startChange.changed_at).getTime();
        const endTime = new Date(endChange.changed_at).getTime();
        durationMin = Math.max(0, Math.round((endTime - startTime) / 60000));
      }
    }
    // Fallback if dynamic calculation failed
    if (durationMin <= 0) {
      durationMin = tripData.duration_min || tripData.duration || tripData.trip_duration_minutes || 0;
    }

    // Calculate avg speed and dynamic distance
    const pLat = parseFloat(tripData.pickup_lat || initialRide.pickupLat || '0');
    const pLng = parseFloat(tripData.pickup_lng || initialRide.pickupLng || '0');
    const dLat = parseFloat(tripData.drop_lat || initialRide.dropLat || '0');
    const dLng = parseFloat(tripData.drop_lng || initialRide.dropLng || '0');
    const tripTypeStr = tripData.trip_type || tripData.ride_type || initialRide.tripType || 'One-way';

    let distKm = parseFloat(tripData.distance_km || '0');
    const calculatedDist = calculateDistance(pLat, pLng, dLat, dLng);
    
    if (calculatedDist > 0) {
      const isRoundTrip = tripTypeStr === 'ROUND_TRIP' || tripTypeStr === 'OUTSTATION_ROUND_TRIP';
      distKm = isRoundTrip ? calculatedDist * 2 : calculatedDist;
      distKm = Math.round(distKm * 10) / 10;
    }

    const avgSpeed = durationMin > 0 && distKm > 0 ? Math.round((distKm / (durationMin / 60))) : 0;

    return {
      ...initialRide,
      id: tripData.trip_id?.toString() || tripData.id?.toString() || initialRide.id?.toString() || '',
      date: tripData.date || dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: tripData.time || dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      pickup: tripData.pickup_address || tripData.pickup || initialRide.pickup || 'Unknown Pickup',
      drop: tripData.drop_address || tripData.drop || initialRide.drop || 'Unknown Drop',
      amount: amount || initialRide.amount || 0,
      distance: distKm > 0 ? `${distKm} km` : (tripData.distance || initialRide.distance || '0 km'),
      distanceKm: distKm || parseFloat((tripData.distance || initialRide.distance || '0').toString().replace(/[^\d.]/g, '')) || 0,
      durationMin: durationMin,
      avgSpeed: avgSpeed,
      status: finalStatus || initialRide.status || '',
      trip_code: tripData.trip_code || tripData.booking_code || initialRide.trip_code || '',
      customer: {
        ...initialRide.customer,
        name: tripData.passenger_name || tripData.customer?.name || initialRide.customer?.name || 'Customer',
        phone: tripData.passenger_phone || tripData.user_details?.phone_number || initialRide.customer?.phone || '',
        totalRides: tripData.user_details?.total_rides || initialRide.customer?.totalRides || 0,
        ratingGiven: (() => {
          const rawRating = tripData.user_rating ?? initialRide.customer?.ratingGiven;
          const parsed = rawRating != null ? Number(rawRating) : NaN;
          return isNaN(parsed) ? undefined : parsed;
        })(),
        ratingReceived: (() => {
          const rawRating = tripData.driver_rating ?? initialRide.customer?.ratingReceived;
          const parsed = rawRating != null ? Number(rawRating) : NaN;
          return isNaN(parsed) ? undefined : parsed;
        })(),
        comment: tripData.user_feedback ?? tripData.comment ?? initialRide.customer?.comment ?? '',
        receivedComment: tripData.driver_feedback ?? initialRide.customer?.receivedComment ?? '',
      },
      fareDetails: {
        base: parseFloat(tripData.base_fare || tripData.fareDetails?.base || '0'),
        distance: parseFloat(tripData.distance_fare || tripData.fareDetails?.distance || '0'), 
        time: parseFloat(tripData.waiting_charges || tripData.fareDetails?.time || '0'),
        platformFee: parseFloat(tripData.platform_fee || tripData.fareDetails?.platformFee || '0'),
      },
      timeline: Object.keys(timeline).length > 0 ? timeline : (tripData.timeline || initialRide.timeline || {}),
      paymentMethod: tripData.payment_method || tripData.paymentMethod || initialRide.paymentMethod || 'Cash',
      // Coordinates for map
      pickupLat: parseFloat(tripData.pickup_lat || initialRide.pickupLat || '0'),
      pickupLng: parseFloat(tripData.pickup_lng || initialRide.pickupLng || '0'),
      dropLat: parseFloat(tripData.drop_lat || initialRide.dropLat || '0'),
      dropLng: parseFloat(tripData.drop_lng || initialRide.dropLng || '0'),
      tripType: tripData.trip_type || tripData.ride_type || initialRide.tripType || 'One-way',
      packageHours: tripData.package_hours || initialRide.packageHours || null,
    };
  };

  const ride = getRide();

  // Map region calculation
  const mapRegion = useMemo(() => {
    if (ride.pickupLat && ride.pickupLng && ride.dropLat && ride.dropLng) {
      const midLat = (ride.pickupLat + ride.dropLat) / 2;
      const midLng = (ride.pickupLng + ride.dropLng) / 2;
      const deltaLat = Math.abs(ride.pickupLat - ride.dropLat) * 1.5;
      const deltaLng = Math.abs(ride.pickupLng - ride.dropLng) * 1.5;
      return {
        latitude: midLat,
        longitude: midLng,
        latitudeDelta: Math.max(deltaLat, 0.02),
        longitudeDelta: Math.max(deltaLng, 0.02),
      };
    }
    return null;
  }, [ride.pickupLat, ride.pickupLng, ride.dropLat, ride.dropLng]);

  const hasMapCoords = ride.pickupLat && ride.pickupLng && ride.dropLat && ride.dropLng;

  const downloadInvoice = async (ride: any) => {
    triggerHaptic(HapticFeedbackTypes.impactLight);
    try {
      const html = `
        <html>
          <body style="font-family: Arial; padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h1 style="color: #2563EB;">${t('invoice')}</h1>
              <p style="color: #666;">#${ride.trip_code || ride.id}</p>
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
      const shareMessage = `Ride Details (#${ride.trip_code || ride.id})\n\nDate: ${ride.date} • ${ride.time}\nFrom: ${ride.pickup}\nTo: ${ride.drop}\nEarnings: ${formatCurrency(Math.abs(ride.amount))}`;
      await Share.share({
        message: shareMessage,
      });
    } catch (error) {
    }
  };

  const handleReportIssue = () => {
    triggerHaptic(HapticFeedbackTypes.impactLight);
    setReportModalVisible(true);
  };

  const submitReport = async () => {
    if (!selectedIssueCategory) {
      showAlert({
        title: t('error') || 'Error',
        message: 'Please select an issue category.',
        singleButton: true,
      });
      return;
    }

    try {
      await createTicket({
        driver_id: ride.driver_id || 'UNKNOWN',
        subject: `Issue with Ride #${ride.trip_code || ride.id}`,
        description: `Category: ${selectedIssueCategory}\n\nDetails: ${issueDescription}`,
        category: 'ride_issue',
        priority: 'medium',
      }).unwrap();

      triggerHaptic(HapticFeedbackTypes.notificationSuccess);
      setReportModalVisible(false);
      setSelectedIssueCategory('');
      setIssueDescription('');

      showAlert({
        title: 'Success',
        message: 'Support request sent. We will contact you soon.',
        singleButton: true,
        icon: 'checkmark-circle-outline',
      });
    } catch (error) {
      triggerHaptic(HapticFeedbackTypes.notificationError);
      showAlert({
        title: t('error') || 'Error',
        message: 'Failed to submit the report. Please try again.',
        singleButton: true,
      });
    }
  };

  const handleCallCustomer = () => {
    const phone = ride.customer?.phone;
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const handleMessageCustomer = () => {
    const phone = ride.customer?.phone;
    if (phone) {
      Linking.openURL(`sms:${phone}`);
    }
  };

  // Get short location name from full address
  const getShortLocation = (address: string) => {
    if (!address) return '';
    const parts = address.split(',');
    return parts[0]?.trim() || address;
  };

  // Get city from address  
  const getCityFromAddress = (address: string) => {
    if (!address) return '';
    const parts = address.split(',');
    if (parts.length >= 2) {
      return parts.slice(0, Math.min(parts.length, 3)).join(',').trim();
    }
    return address;
  };

  const isCancelled = ride.status?.toUpperCase() === 'CANCELLED';
  const isCompleted = ride.status === 'Completed';

  // Format string to human-readable string (e.g. OUTSTATION_ONE_WAY -> Outstation One Way)
  const formatString = (text: string, defaultVal: string) => {
    if (!text) return defaultVal;
    return text
      .replace(/_/g, ' ')
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Format date nicely like "Today, 08:45 PM" and "08 May 2025"
  const getFormattedDateTime = () => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    let dateLabel = ride.date;
    let fullDate = ride.date;
    try {
      const rideDate = new Date(ride.date);
      if (!isNaN(rideDate.getTime())) {
        fullDate = rideDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        if (rideDate.toDateString() === today.toDateString()) {
          dateLabel = 'Today';
        } else if (rideDate.toDateString() === yesterday.toDateString()) {
          dateLabel = 'Yesterday';
        } else {
          dateLabel = fullDate;
        }
      }
    } catch (e) {}
    return { dateTimeStr: `${dateLabel}, ${ride.time}`, fullDate };
  };

  const formattedDate = getFormattedDateTime();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: isDark ? theme.colors.background : '#FFFFFF' }]}>
      {isFocused && <AppStatusBar />}
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDark ? theme.colors.card : '#FFFFFF', borderBottomColor: isDark ? '#374151' : '#F0F0F0' }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={isDark ? '#FFFFFF' : '#111827'} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
            {tt('ride_details', 'Ride Details')}
          </Text>
          <Text style={[styles.headerSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            Trip ID: #{ride.trip_code || ride.id || 'TRP0000'}
          </Text>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <RideDetailSkeleton isDark={isDark} theme={theme} />
        ) : (
          <>
            {/* ═══════════════════ Status & Earnings Card ═══════════════════ */}
            <View style={[styles.statusCard, { backgroundColor: isDark ? theme.colors.card : '#FFFFFF' }]}>
              <View style={styles.statusCardRow}>
                <View>
                  <Text style={[styles.statusDateTime, { color: isDark ? '#E5E7EB' : '#111827' }]}>
                    {formattedDate.dateTimeStr}
                  </Text>
                  <Text style={[styles.statusDate, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                    {formattedDate.fullDate}
                  </Text>
                  <View style={styles.statusBadge}>
                    <Ionicons 
                      name={isCompleted ? 'checkmark-circle' : 'close-circle'} 
                      size={14} 
                      color={isCompleted ? '#16A34A' : '#DC2626'} 
                    />
                    <Text style={[
                      styles.statusBadgeText, 
                      { color: isCompleted ? '#16A34A' : '#DC2626' }
                    ]}>
                      {ride.status ? tt(ride.status.toLowerCase(), ride.status) : ''}
                    </Text>
                  </View>
                </View>
                <View style={styles.earningsCol}>
                  <Text style={[styles.earningsAmount, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                    {formatCurrency(Math.abs(ride.amount))}
                  </Text>
                  <Text style={[styles.earningsLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                    {isCancelled ? tt('cancellation_charge', 'Cancellation') : tt('total_earnings', 'Total Earnings')}
                  </Text>
                  {!isCancelled && (
                    <View style={[styles.paidToWallet, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.1)' : '#EFF6FF' }]}>
                      <Ionicons name="wallet-outline" size={14} color="#2563EB" />
                      <Text style={styles.paidToWalletText}>
                        {(!ride.paymentMethod || ride.paymentMethod.toLowerCase() === 'cash') 
                          ? tt('received_as_cash', 'Received as Cash') 
                          : tt('received_as_online', 'Received as Online')}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* ═══════════════════ Map Section ═══════════════════ */}
            {hasMapCoords && (
              <View style={[styles.mapContainer, { backgroundColor: isDark ? theme.colors.card : '#FFFFFF' }]}>
                <MapView
                  style={styles.map}
                  provider={PROVIDER_GOOGLE}
                  region={mapRegion!}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  rotateEnabled={false}
                  pitchEnabled={false}
                >
                  {/* Pickup Marker */}
                  <Marker
                    coordinate={{ latitude: ride.pickupLat, longitude: ride.pickupLng }}
                  >
                    <View style={styles.markerPickup}>
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    </View>
                  </Marker>
                  
                  {/* Drop Marker */}
                  <Marker
                    coordinate={{ latitude: ride.dropLat, longitude: ride.dropLng }}
                  >
                    <View style={styles.markerDrop}>
                      <View style={styles.markerDropInner} />
                    </View>
                  </Marker>

                  {/* Route Line */}
                  <Polyline
                    coordinates={[
                      { latitude: ride.pickupLat, longitude: ride.pickupLng },
                      { latitude: ride.dropLat, longitude: ride.dropLng },
                    ]}
                    strokeColor="#2563EB"
                    strokeWidth={3}
                    lineDashPattern={[6, 4]}
                  />
                </MapView>

                {/* Overlaid Pickup/Drop Info */}
                <View style={styles.mapOverlayRow}>
                  <View style={[styles.mapInfoCard, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255,255,255,0.95)' }]}>
                    <View style={styles.mapInfoCardHeader}>
                      <View style={styles.mapInfoDotGreen} />
                      <Text style={[styles.mapInfoLabel, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                        {tt('pickup', 'Pickup')}
                      </Text>
                      <Text style={[styles.mapInfoTime, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                        {ride.timeline?.startedAt || ride.timeline?.arrivedAt || ride.time}
                      </Text>
                    </View>
                    <Text style={[styles.mapInfoAddress, { color: isDark ? '#E5E7EB' : '#374151' }]} numberOfLines={1}>
                      {getShortLocation(ride.pickup)}
                    </Text>
                    <Text style={[styles.mapInfoSubAddress, { color: isDark ? '#9CA3AF' : '#6B7280' }]} numberOfLines={1}>
                      {getCityFromAddress(ride.pickup)}
                    </Text>
                  </View>

                  <View style={[styles.mapInfoCard, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255,255,255,0.95)' }]}>
                    <View style={styles.mapInfoCardHeader}>
                      <View style={styles.mapInfoDotRed} />
                      <Text style={[styles.mapInfoLabel, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                        {tt('drop', 'Drop')}
                      </Text>
                      <Text style={[styles.mapInfoTime, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                        {(ride.tripType === 'ROUND_TRIP' || ride.tripType === 'OUTSTATION_ROUND_TRIP') 
                          ? (ride.timeline?.destinationReachedAt || '')
                          : (ride.timeline?.completedAt || ride.timeline?.cancelledAt || '')}
                      </Text>
                    </View>
                    <Text style={[styles.mapInfoAddress, { color: isDark ? '#E5E7EB' : '#374151' }]} numberOfLines={1}>
                      {getShortLocation(ride.drop)}
                    </Text>
                    <Text style={[styles.mapInfoSubAddress, { color: isDark ? '#9CA3AF' : '#6B7280' }]} numberOfLines={1}>
                      {getCityFromAddress(ride.drop)}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* ═══════════════════ Trip Details ═══════════════════ */}
            <View style={[styles.tripDetailsCard, { backgroundColor: isDark ? theme.colors.card : '#FFFFFF' }]}>
              <Text style={[styles.tripDetailsTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                {tt('trip_details', 'Trip Details')}
              </Text>

              {/* Pickup & Drop Timeline */}
              <View style={styles.tripTimeline}>
                {/* Pickup */}
                <View style={styles.tripTimelineRow}>
                  <View style={styles.tripTimelineDotCol}>
                    <View style={styles.tripDotGreen} />
                    <View style={[styles.tripConnectorLine, { borderColor: isDark ? '#4B5563' : '#2563EB' }]} />
                  </View>
                  <View style={styles.tripTimelineContent}>
                    <Text style={[styles.tripLocationLabel, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                      {tt('pickup_location', 'Pickup Location')}
                    </Text>
                    <Text style={[styles.tripLocationAddress, { color: isDark ? '#9CA3AF' : '#6B7280' }]} numberOfLines={1}>
                      {ride.pickup || 'Unknown'}
                    </Text>
                  </View>
                  <Text style={[styles.tripLocationTime, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                    {ride.timeline?.startedAt || ride.timeline?.arrivedAt || ride.time || '--'}
                  </Text>
                </View>

                {/* Drop */}
                <View style={styles.tripTimelineRow}>
                  <View style={styles.tripTimelineDotCol}>
                    <View style={styles.tripDotRed} />
                    {(ride.tripType === 'ROUND_TRIP' || ride.tripType === 'OUTSTATION_ROUND_TRIP') && (
                      <View style={[styles.tripConnectorLine, { borderColor: isDark ? '#4B5563' : '#2563EB' }]} />
                    )}
                  </View>
                  <View style={styles.tripTimelineContent}>
                    <Text style={[styles.tripLocationLabel, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                      {isCancelled ? tt('cancelled', 'Cancelled') : tt('drop_location', 'Drop Location')}
                    </Text>
                    <Text style={[styles.tripLocationAddress, { color: isDark ? '#9CA3AF' : '#6B7280' }]} numberOfLines={1}>
                      {isCancelled ? '--' : (ride.drop || 'Unknown')}
                    </Text>
                  </View>
                  <Text style={[styles.tripLocationTime, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                    {(ride.tripType === 'ROUND_TRIP' || ride.tripType === 'OUTSTATION_ROUND_TRIP')
                      ? (ride.timeline?.destinationReachedAt || '--')
                      : (ride.timeline?.completedAt || ride.timeline?.cancelledAt || '--')}
                  </Text>
                </View>

                {/* Return */}
                {(ride.tripType === 'ROUND_TRIP' || ride.tripType === 'OUTSTATION_ROUND_TRIP') && (
                  <View style={styles.tripTimelineRow}>
                    <View style={styles.tripTimelineDotCol}>
                      <View style={styles.tripDotGreen} />
                    </View>
                    <View style={styles.tripTimelineContent}>
                      <Text style={[styles.tripLocationLabel, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                        {tt('return_to_pickup', 'Return to Pickup')}
                      </Text>
                      <Text style={[styles.tripLocationAddress, { color: isDark ? '#9CA3AF' : '#6B7280' }]} numberOfLines={1}>
                        {ride.pickup || 'Unknown'}
                      </Text>
                    </View>
                    <Text style={[styles.tripLocationTime, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                      {ride.timeline?.returnReachedAt || ride.timeline?.completedAt || '--'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Divider */}
              <View style={[styles.tripStatsDivider, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]} />

              {/* Stats Row */}
              <View style={styles.tripStatsRow}>
                <View style={styles.tripStatItem}>
                  <View style={[styles.tripStatIcon, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.1)' : '#F0F5FF' }]}>
                    <Ionicons name="car-outline" size={16} color="#2563EB" />
                  </View>
                  <Text style={[styles.tripStatLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                    {tt('distance', 'Distance')}
                  </Text>
                  <Text style={[styles.tripStatValue, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                    {ride.distanceKm ? `${ride.distanceKm} km` : ride.distance || '--'}
                  </Text>
                </View>

                <View style={styles.tripStatItem}>
                  <View style={[styles.tripStatIcon, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.1)' : '#F0F5FF' }]}>
                    <Ionicons name="time-outline" size={16} color="#2563EB" />
                  </View>
                  <Text style={[styles.tripStatLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                    {tt('duration', 'Duration')}
                  </Text>
                  <Text style={[styles.tripStatValue, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                    {ride.durationMin ? `${ride.durationMin}m` : '--'}
                  </Text>
                </View>

                {ride.packageHours && (
                  <View style={styles.tripStatItem}>
                    <View style={[styles.tripStatIcon, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.1)' : '#F0F5FF' }]}>
                      <Ionicons name="time" size={16} color="#2563EB" />
                    </View>
                    <Text style={[styles.tripStatLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                      {tt('package', 'Package')}
                    </Text>
                    <Text style={[styles.tripStatValue, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                      {ride.packageHours} hr
                    </Text>
                  </View>
                )}

                <View style={styles.tripStatItem}>
                  <View style={[styles.tripStatIcon, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.1)' : '#F0F5FF' }]}>
                    <MaterialCommunityIcons name="swap-horizontal" size={16} color="#2563EB" />
                  </View>
                  <Text style={[styles.tripStatLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                    {tt('ride_type', 'Ride Type')}
                  </Text>
                  <Text style={[styles.tripStatValue, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                    {formatString(ride.tripType, 'One Way')}
                  </Text>
                </View>

                <View style={styles.tripStatItem}>
                  <View style={[styles.tripStatIcon, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.1)' : '#F0F5FF' }]}>
                    <Ionicons name="wallet-outline" size={16} color="#2563EB" />
                  </View>
                  <Text style={[styles.tripStatLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                    {tt('payment', 'Payment')}
                  </Text>
                  <Text style={[styles.tripStatValue, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                    {formatString(ride.paymentMethod, 'Cash')}
                  </Text>
                </View>
              </View>
            </View>

            {/* ═══════════════════ Fare Breakdown ═══════════════════ */}
            <View style={[styles.sectionCard, { backgroundColor: isDark ? theme.colors.card : '#FFFFFF' }]}>
              <View style={styles.fareTitleRow}>
                <Text style={[styles.fareTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                  {tt('fare_breakdown', 'Fare Breakdown')}
                </Text>
                <Pressable onPress={() => downloadInvoice(ride)} style={styles.viewInvoiceBtn}>
                  <Text style={styles.viewInvoiceText}>{tt('view_invoice', 'View Invoice')}</Text>
                  <Ionicons name="document-text-outline" size={16} color="#2563EB" />
                </Pressable>
              </View>

              {(() => {
                const baseFare = isCancelled ? 0 : (ride.fareDetails?.base || 0);
                const distanceFare = isCancelled ? 0 : (ride.fareDetails?.distance || 0);
                const timeFare = isCancelled ? 0 : (ride.fareDetails?.time || 0);
                const platformFee = isCancelled ? 0 : (ride.fareDetails?.platformFee || 0);
                const totalAmount = isCancelled ? 0 : Math.abs(ride.amount || 0);

                return (
                  <>
                    <View style={styles.fareItemRow}>
                      <Text style={[styles.fareItemLabel, { color: isDark ? '#D1D5DB' : '#374151' }]}>
                        {tt('base_fare', 'Base Fare')}
                      </Text>
                      <Text style={[styles.fareItemValue, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                        {formatCurrency(baseFare)}
                      </Text>
                    </View>
                    <View style={styles.fareItemRow}>
                      <Text style={[styles.fareItemLabel, { color: isDark ? '#D1D5DB' : '#374151' }]}>
                        {tt('distance_fare', `Distance Fare (${ride.distance || '0 km'})`, { distance: isCancelled ? '0 km' : (ride.distance || '0 km') })}
                      </Text>
                      <Text style={[styles.fareItemValue, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                        {formatCurrency(distanceFare)}
                      </Text>
                    </View>
                    <View style={styles.fareItemRow}>
                      <Text style={[styles.fareItemLabel, { color: isDark ? '#D1D5DB' : '#374151' }]}>
                        {tt('time_fare', 'Time Fare')} {ride.durationMin ? `(${ride.durationMin} min)` : ''}
                      </Text>
                      <Text style={[styles.fareItemValue, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                        {formatCurrency(timeFare)}
                      </Text>
                    </View>
                    <View style={styles.fareItemRow}>
                      <Text style={[styles.fareItemLabel, { color: isDark ? '#D1D5DB' : '#374151' }]}>
                        {tt('platform_fee', 'Platform Fee')}
                      </Text>
                      <Text style={[styles.fareItemValue, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                        {formatCurrency(platformFee)}
                      </Text>
                    </View>

                    <View style={[styles.fareDivider, { borderColor: isDark ? '#374151' : '#E5E7EB' }]} />

                    <View style={styles.fareTotalRow}>
                      <Text style={[styles.fareTotalLabel, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                        {isCancelled ? tt('cancellation_charge', 'Cancellation Charge') : tt('total_earnings', 'Total Earnings')}
                      </Text>
                      <Text style={[styles.fareTotalValue, { color: isCompleted ? '#16A34A' : (isDark ? '#F87171' : '#DC2626') }]}>
                        {formatCurrency(totalAmount)}
                      </Text>
                    </View>

                    <View style={[styles.secureNote, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.08)' : '#F0F9FF' }]}>
                      <Ionicons name="shield-checkmark" size={16} color="#2563EB" />
                      <Text style={[styles.secureNoteText, { color: isDark ? '#93C5FD' : '#1D4ED8' }]}>
                        {tt('earnings_secure', 'Your earnings are safe and secure with us.')}
                      </Text>
                    </View>
                  </>
                );
              })()}
            </View>

            {/* ═══════════════════ Need Help ═══════════════════ */}
            <View style={[styles.sectionCard, { backgroundColor: isDark ? theme.colors.card : '#FFFFFF' }]}>
              <View style={styles.helpRow}>
                <View style={styles.helpLeft}>
                  <View style={[styles.helpIconCircle, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.15)' : '#EFF6FF' }]}>
                    <Ionicons name="information-circle" size={22} color="#2563EB" />
                  </View>
                  <View>
                    <Text style={[styles.helpTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                      {tt('need_help', 'Need Help?')}
                    </Text>
                    <Text style={[styles.helpSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                      {tt('report_trip_issue', 'Report an issue with this trip')}
                    </Text>
                  </View>
                </View>
                <Pressable onPress={handleReportIssue} style={styles.reportIssueBtn}>
                  <Ionicons name="warning" size={16} color="#FFFFFF" />
                  <Text style={styles.reportIssueBtnText}>
                    {tt('report_issue', 'Report Issue')}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={{ height: 20 }} />
          </>
        )}
      </ScrollView>

      {/* Report Issue Modal */}
      <Modal
        visible={isReportModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setReportModalVisible(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDark && { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDark && { color: '#FFFFFF' }]}>Report an Issue</Text>
              <Pressable onPress={() => setReportModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color={isDark ? '#9CA3AF' : '#4B5563'} />
              </Pressable>
            </View>

            <Text style={[styles.modalSubtitle, isDark && { color: '#9CA3AF' }]}>
              What went wrong with Ride #{ride.trip_code || ride.id}?
            </Text>

            <View style={styles.issueTags}>
              {['Payment Issue', 'Passenger Behavior', 'Wrong Route', 'App Glitch', 'Other'].map((tag) => (
                <Pressable
                  key={tag}
                  style={[
                    styles.issueTag,
                    isDark && { backgroundColor: '#374151', borderColor: '#4B5563' },
                    selectedIssueCategory === tag && styles.issueTagSelected,
                  ]}
                  onPress={() => {
                    triggerHaptic(HapticFeedbackTypes.selection);
                    setSelectedIssueCategory(tag);
                  }}
                >
                  <Text
                    style={[
                      styles.issueTagText,
                      isDark && { color: '#E5E7EB' },
                      selectedIssueCategory === tag && styles.issueTagTextSelected,
                    ]}
                  >
                    {tag}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={[
                styles.issueInput,
                isDark && { backgroundColor: '#374151', color: '#FFFFFF', borderColor: '#4B5563' },
              ]}
              placeholder="Additional Details (Optional)"
              placeholderTextColor={isDark ? '#9CA3AF' : '#9CA3AF'}
              multiline
              numberOfLines={4}
              value={issueDescription}
              onChangeText={setIssueDescription}
              textAlignVertical="top"
            />

            <Pressable
              style={[styles.submitReportBtn, (!selectedIssueCategory || isSubmittingTicket) && styles.disabledBtn]}
              onPress={submitReport}
              disabled={!selectedIssueCategory || isSubmittingTicket}
            >
              <Text style={styles.submitReportBtnText}>
                {isSubmittingTicket ? 'Submitting...' : 'Submit Report'}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
};

/* ═══════════════════ Sub-components ═══════════════════ */

const TimelineStep = ({ icon, iconColor, label, time, address, isLast, isDark, completed }: any) => (
  <View style={styles.timelineStep}>
    <View style={styles.timelineIconCol}>
      <View style={[
        styles.timelineIconWrap,
        completed ? { backgroundColor: iconColor + '20' } : { backgroundColor: isDark ? '#374151' : '#F3F4F6' }
      ]}>
        <Ionicons name={icon} size={16} color={completed ? iconColor : (isDark ? '#6B7280' : '#9CA3AF')} />
      </View>
      {!isLast && (
        <View style={[
          styles.timelineConnector,
          { backgroundColor: isDark ? '#374151' : '#E5E7EB' }
        ]} />
      )}
    </View>
    <View style={[styles.timelineStepContent, !isLast && { paddingBottom: 20 }]}>
      <View style={styles.timelineStepHeader}>
        <Text style={[
          styles.timelineStepLabel,
          { color: completed ? (isDark ? '#FFFFFF' : '#111827') : (isDark ? '#6B7280' : '#9CA3AF') },
          { fontWeight: completed ? '600' : '400' }
        ]}>
          {label}
        </Text>
        <Text style={[styles.timelineStepTime, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
          {time}
        </Text>
      </View>
      {address && (
        <View style={[styles.timelineAddressBox, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.06)' : '#F8FAFC' }]}>
          <Text style={[styles.timelineAddressMain, { color: isDark ? '#E5E7EB' : '#374151' }]} numberOfLines={1}>
            {getShortLocationStatic(address)}
          </Text>
          <Text style={[styles.timelineAddressSub, { color: isDark ? '#9CA3AF' : '#6B7280' }]} numberOfLines={1}>
            {address}
          </Text>
        </View>
      )}
    </View>
  </View>
);

const getShortLocationStatic = (address: string) => {
  if (!address) return '';
  const parts = address.split(',');
  return parts[0]?.trim() || address;
};

/* ═══════════════════ Skeleton ═══════════════════ */
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

const RideDetailSkeleton = ({ isDark, theme }: { isDark: boolean; theme: any }) => {
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

  const skBg = isDark ? '#374151' : '#E5E7EB';

  return (
    <View>
      {/* Status Card Skeleton */}
      <View style={[styles.sectionCard, { overflow: 'hidden', backgroundColor: isDark ? theme.colors.card : '#fff' }]}>
        <View style={styles.statusCardRow}>
          <View>
            <View style={[styles.skeletonLine, { width: 100, height: 28, borderRadius: 14, backgroundColor: skBg }]} />
            <View style={[styles.skeletonLine, { width: 150, height: 16, marginTop: 10, backgroundColor: skBg }]} />
            <View style={[styles.skeletonLine, { width: 100, height: 14, marginTop: 6, backgroundColor: skBg }]} />
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <View style={[styles.skeletonLine, { width: 100, height: 28, backgroundColor: skBg }]} />
            <View style={[styles.skeletonLine, { width: 80, height: 14, marginTop: 6, backgroundColor: skBg }]} />
          </View>
        </View>
        <Shimmer translateX={translateX} />
      </View>

      {/* Map Skeleton */}
      <View style={[styles.sectionCard, { overflow: 'hidden', backgroundColor: isDark ? theme.colors.card : '#fff', height: 180 }]}>
        <View style={[styles.skeletonLine, { width: '100%', height: '100%', borderRadius: 12, backgroundColor: skBg }]} />
        <Shimmer translateX={translateX} />
      </View>

      {/* Customer Skeleton */}
      <View style={[styles.sectionCard, { overflow: 'hidden', backgroundColor: isDark ? theme.colors.card : '#fff' }]}>
        <View style={styles.customerRow}>
          <View style={[styles.skeletonLine, { width: 50, height: 50, borderRadius: 25, backgroundColor: skBg }]} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={[styles.skeletonLine, { width: 120, height: 18, backgroundColor: skBg }]} />
            <View style={[styles.skeletonLine, { width: 80, height: 14, marginTop: 6, backgroundColor: skBg }]} />
          </View>
        </View>
        <Shimmer translateX={translateX} />
      </View>

      {/* Stats Skeleton */}
      <View style={[styles.sectionCard, { overflow: 'hidden', backgroundColor: isDark ? theme.colors.card : '#fff' }]}>
        <View style={styles.statsRow}>
          {[1, 2, 3, 4].map(i => (
            <View key={i} style={styles.statItem}>
              <View style={[styles.skeletonLine, { width: 42, height: 42, borderRadius: 21, backgroundColor: skBg }]} />
              <View style={[styles.skeletonLine, { width: 50, height: 12, marginTop: 8, backgroundColor: skBg }]} />
              <View style={[styles.skeletonLine, { width: 40, height: 16, marginTop: 4, backgroundColor: skBg }]} />
            </View>
          ))}
        </View>
        <Shimmer translateX={translateX} />
      </View>

      {/* Fare Skeleton */}
      <View style={[styles.sectionCard, { overflow: 'hidden', backgroundColor: isDark ? theme.colors.card : '#fff' }]}>
        {[1, 2, 3, 4].map(i => (
          <View key={i} style={styles.fareItemRow}>
            <View style={[styles.skeletonLine, { width: 120, height: 16, backgroundColor: skBg }]} />
            <View style={[styles.skeletonLine, { width: 60, height: 16, backgroundColor: skBg }]} />
          </View>
        ))}
        <Shimmer translateX={translateX} />
      </View>
    </View>
  );
};

/* ═══════════════════ Styles ═══════════════════ */
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  
  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: { 
    padding: 6,
    position: 'absolute',
    left: 16,
    zIndex: 1,
  },
  headerCenter: { 
    flex: 1, 
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#111827',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 3,
    textAlign: 'center',
  },
  helpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'absolute',
    right: 16,
    zIndex: 1,
  },
  helpBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },

  scrollContent: { padding: 16, paddingBottom: 40 },

  /* Status & Earnings Card */
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  statusCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusDateTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  statusDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  earningsCol: {
    alignItems: 'flex-end',
  },
  earningsAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  earningsLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  paidToWallet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 5,
  },
  paidToWalletText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#2563EB',
  },

  /* Map */
  mapContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  map: {
    width: '100%',
    height: 180,
  },
  markerPickup: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  markerDrop: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  markerDropInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  mapOverlayRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    marginTop: -50,
  },
  mapInfoCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 10,
    padding: 10,
  },
  mapInfoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  mapInfoDotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  mapInfoDotRed: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
  },
  mapInfoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  mapInfoTime: {
    fontSize: 10,
    color: '#6B7280',
  },
  mapInfoAddress: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  mapInfoSubAddress: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },

  /* Section Card */
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },

  /* Trip Details Card */
  tripDetailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  tripDetailsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  tripTimeline: {
    gap: 0,
  },
  tripTimelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tripTimelineDotCol: {
    alignItems: 'center',
    width: 18,
    marginRight: 10,
    paddingTop: 2,
  },
  tripDotGreen: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#16A34A',
    borderWidth: 2.5,
    borderColor: '#DCFCE7',
  },
  tripDotRed: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#DC2626',
    borderWidth: 2.5,
    borderColor: '#FEE2E2',
  },
  tripConnectorLine: {
    width: 0,
    height: 22,
    borderLeftWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#2563EB',
    marginVertical: 1,
  },
  tripTimelineContent: {
    flex: 1,
    paddingBottom: 8,
  },
  tripLocationLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  tripLocationAddress: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  tripLocationTime: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
    paddingTop: 2,
  },
  tripStatsDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 10,
  },
  tripStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tripStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  tripStatIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tripStatLabel: {
    fontSize: 9,
    color: '#6B7280',
    marginBottom: 1,
  },
  tripStatValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },

  /* Customer */
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E5E7EB',
  },
  customerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  ratingText: {
    fontSize: 13,
    color: '#6B7280',
  },
  customerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  customerActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },

  /* Timeline */
  timelineContainer: {},
  timelineStep: {
    flexDirection: 'row',
  },
  timelineIconCol: {
    alignItems: 'center',
    width: 36,
    marginRight: 12,
  },
  timelineIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineConnector: {
    width: 2,
    flex: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  timelineStepContent: {
    flex: 1,
    paddingTop: 4,
  },
  timelineStepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timelineStepLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  timelineStepTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  timelineAddressBox: {
    marginTop: 6,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  timelineAddressMain: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  timelineAddressSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },

  /* Fare Breakdown */
  fareTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  fareTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  viewInvoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewInvoiceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  fareItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  fareItemLabel: {
    fontSize: 13,
    color: '#374151',
  },
  fareItemValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  fareDivider: {
    height: 1,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#E5E7EB',
    marginVertical: 6,
  },
  fareTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 2,
    marginBottom: 8,
  },
  fareTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  fareTotalValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#16A34A',
  },
  secureNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F0F9FF',
  },
  secureNoteText: {
    fontSize: 11,
    color: '#1D4ED8',
    flex: 1,
  },

  /* Need Help */
  helpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  helpLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  helpIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  helpSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  reportIssueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  reportIssueBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  /* Skeleton */
  skeletonLine: {
    height: 14,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
  },

  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  issueTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  issueTag: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  issueTagSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  issueTagText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  issueTagTextSelected: {
    color: '#2563EB',
    fontWeight: '600',
  },
  issueInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    height: 120,
    fontSize: 16,
    color: '#111827',
    marginBottom: 24,
    backgroundColor: '#F9FAFB',
  },
  submitReportBtn: {
    backgroundColor: '#DC2626',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitReportBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  disabledBtn: { backgroundColor: '#9CA3AF', opacity: 0.6 },
});

export default RideDetailScreen;
