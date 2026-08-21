import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Image, Alert } from 'react-native';
import moment from 'moment';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { hS as s, vS as vs, mS as ms } from '../../lib/scale';
import { useAppTheme } from '../../context/ThemeContext';
import AppStatusBar from '../../Components/AppStatusBar';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import MapView, { Marker } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { GOOGLE_MAPS_API_KEY } from '../../constant/config';

const ScheduledRideDetailsScreen = () => {
  const { theme, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { ride, onAccept, onStartNavigation, onCancelPress } = route.params || {};
  const { t } = useTranslation();
  const user = useSelector((state: RootState) => state.userSlice.user);
  const myAcceptedRideId = useSelector((state: any) => state.ride?.myAcceptedRideId);
  const isMine = (myAcceptedRideId && String(ride?.trip_id) === String(myAcceptedRideId)) || (ride?.driver_id && String(ride.driver_id) === String(user?.driverId || user?.id));
  const isAccepted = ride?.trip_status === 'ACCEPTED' || ride?.status === 'ACCEPTED' || isMine;
  const type = (ride?.ride_type || ride?.service_type || '').toLowerCase();
  const isRoundTrip = type === 'round_trip' || type === 'outstation_round_trip';

  const [now, setNow] = useState(Date.now());
  const [dynamicTime, setDynamicTime] = useState(ride?.estimated_time || ride?.duration || '45 min');
  const [dynamicDistance, setDynamicDistance] = useState(ride?.distance_km || '32');
  const mapRef = useRef<MapView>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (mins: number) => {
    const absMins = Math.abs(mins);
    if (absMins < 60) return `${absMins}m`;
    const hrs = Math.floor(absMins / 60);
    const remainingMins = absMins % 60;
    return remainingMins > 0 ? `${hrs}h ${remainingMins}m` : `${hrs}h`;
  };

  const getDynamicStartText = () => {
    if (!ride?.startTime) return '--';
    const diffMins = moment(ride.startTime).diff(moment(now), 'minutes');
    if (diffMins === 0) return 'Now';
    return formatDuration(Math.abs(diffMins));
  };

  const openMaps = (address: string) => {
    if (!address) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
  };

  const handleAccept = () => {
    Alert.alert(
      'Confirm Acceptance',
      'Are you sure you want to accept this ride?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            if (onAccept) onAccept();
            navigation.goBack();
          }
        }
      ]
    );
  };

  if (!ride) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <AppStatusBar />
        <View style={styles.errorContainer}>
          <Text style={{ color: theme.colors.text }}>Ride details not found.</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtnError}>
            <Text style={{ color: '#FFF' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const formatTime = (time: string | number | Date) => new Date(time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });
  const formatDateStr = (time: string | number | Date) => {
    const d = new Date(time);
    return `${d.getDate()} ${d.toLocaleDateString(undefined, { month: 'short' })} ${d.getFullYear()}`;
  };
  const isToday = new Date(ride.startTime).toDateString() === new Date().toDateString();

  const pickupLocation = {
    latitude: parseFloat(ride.pickup_lat?.toString() || ride.pickup_latitude?.toString() || "0"),
    longitude: parseFloat(ride.pickup_lng?.toString() || ride.pickup_longitude?.toString() || "0"),
  };
  const dropLocation = {
    latitude: parseFloat(ride.drop_lat?.toString() || ride.drop_latitude?.toString() || ride.dropoff_lat?.toString() || "0"),
    longitude: parseFloat(ride.drop_lng?.toString() || ride.drop_longitude?.toString() || ride.dropoff_lng?.toString() || "0"),
  };
  const hasValidCoords = !!(pickupLocation.latitude && pickupLocation.longitude && dropLocation.latitude && dropLocation.longitude);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: isDark ? theme.colors.background : '#FFFFFF' }]}
      edges={['top']}
    >
      <AppStatusBar />

      {/* HEADER ROW */}
      <View style={[styles.headerRow, { backgroundColor: isDark ? theme.colors.background : '#FFF' }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: ms(8) }}>
          <Ionicons name="arrow-back" size={ms(22)} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Scheduled Ride Details</Text>
        <View style={{ width: ms(38) }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* OVERVIEW & MAP CARD */}
        <View style={[styles.card, { padding: 0, overflow: 'hidden', backgroundColor: isDark ? theme.colors.card : '#FFF' }]}>
          <View style={{ padding: ms(16) }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="calendar-outline" size={ms(16)} color={theme.colors.textMuted} />
                <Text style={{ marginLeft: s(6), fontSize: ms(13), fontWeight: '600', color: theme.colors.text }}>{formatDateStr(ride.startTime || Date.now())}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="time-outline" size={ms(16)} color={theme.colors.textMuted} />
                <Text style={{ marginLeft: s(6), fontSize: ms(13), fontWeight: '700', color: theme.colors.text }}>{(formatTime(ride.startTime || Date.now()).replace(/[\s\u202F]+/, ' ').toUpperCase())}</Text>
              </View>
            </View>
          </View>

          {/* MAP SECTION */}
          <View style={{ height: vs(180), backgroundColor: isDark ? '#333' : '#F1F5F9', position: 'relative' }}>
            {hasValidCoords && (
              <MapView
                ref={mapRef}
                style={{ flex: 1 }}
                initialRegion={{
                  latitude: (pickupLocation.latitude + dropLocation.latitude) / 2,
                  longitude: (pickupLocation.longitude + dropLocation.longitude) / 2,
                  latitudeDelta: Math.max(Math.abs(pickupLocation.latitude - dropLocation.latitude) * 2, 0.05),
                  longitudeDelta: Math.max(Math.abs(pickupLocation.longitude - dropLocation.longitude) * 2, 0.05),
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
              >
                <MapViewDirections
                  origin={pickupLocation}
                  destination={dropLocation}
                  apikey={GOOGLE_MAPS_API_KEY}
                  strokeWidth={4}
                  strokeColor="#2563EB"
                  onReady={(result) => {
                    setDynamicTime(Math.ceil(result.duration) + ' min');
                    setDynamicDistance(result.distance.toFixed(1));
                    mapRef.current?.fitToCoordinates(result.coordinates, {
                      edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
                      animated: true,
                    });
                  }}
                />
                <Marker coordinate={pickupLocation} anchor={{ x: 0.5, y: 1 }}>
                  <Ionicons name="location" size={ms(32)} color="#10B981" />
                </Marker>
                <Marker coordinate={dropLocation} anchor={{ x: 0.5, y: 1 }}>
                  <Ionicons name="location" size={ms(32)} color="#EF4444" />
                </Marker>
                <Marker
                  coordinate={{
                    latitude: (pickupLocation.latitude + dropLocation.latitude) / 2,
                    longitude: (pickupLocation.longitude + dropLocation.longitude) / 2,
                  }}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={{ width: ms(24), height: ms(24), backgroundColor: '#2563EB', borderRadius: ms(6), justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="car" size={ms(16)} color="#FFF" />
                  </View>
                </Marker>
              </MapView>
            )}
            <TouchableOpacity onPress={() => openMaps(ride.pickup_address)} style={styles.mapOverlayBtn}>
              <Text style={{ color: '#2563EB', fontWeight: '600', fontSize: ms(12), marginRight: s(4) }}>Open in Maps</Text>
              <Ionicons name="arrow-forward-outline" size={ms(12)} color="#2563EB" style={{ transform: [{ rotate: '-45deg' }] }} />
            </TouchableOpacity>
          </View>
        </View>

        {/* LOCATIONS CARD */}
        <View style={[styles.card, { backgroundColor: 'transparent', borderColor: isDark ? theme.colors.border : '#E2E8F0', elevation: 0, shadowOpacity: 0, padding: ms(16), paddingLeft: ms(40), position: 'relative' }]}>
          {/* Absolute dotted line connecting the two dots */}
          <View style={{ position: 'absolute', left: ms(20), top: ms(24), bottom: ms(24), width: 1, borderStyle: 'dashed', borderWidth: 1, borderColor: '#94A3B8' }} />

          {/* Pickup */}
          <View style={{ position: 'relative', paddingBottom: vs(12) }}>
            <View style={[styles.dot, { backgroundColor: '#10B981', position: 'absolute', left: -ms(25), top: ms(4) }]} />
            <Text style={{ color: '#10B981', fontSize: ms(11), fontWeight: '600', marginBottom: vs(2) }}>Pickup</Text>
            <Text style={[styles.locationTitle, { color: theme.colors.text }]} numberOfLines={2}>{ride.pickup_address}</Text>
          </View>

          <View style={[styles.horizontalDividerSolid, { borderColor: isDark ? theme.colors.border : '#F1F5F9', marginVertical: 0, marginBottom: vs(12) }]} />

          {/* Drop-off */}
          <View style={{ position: 'relative', paddingBottom: isRoundTrip ? vs(12) : vs(4) }}>
            <View style={[styles.dot, { backgroundColor: '#EF4444', position: 'absolute', left: -ms(25), top: ms(4) }]} />
            <Text style={{ color: '#EF4444', fontSize: ms(11), fontWeight: '600', marginBottom: vs(2) }}>Drop-off</Text>
            <Text style={[styles.locationTitle, { color: theme.colors.text }]} numberOfLines={2}>{ride.drop_address}</Text>
          </View>

          {isRoundTrip && (
            <>
              <View style={[styles.horizontalDividerSolid, { borderColor: isDark ? theme.colors.border : '#F1F5F9', marginVertical: 0, marginBottom: vs(12) }]} />

              {/* Return (Pickup) */}
              <View style={{ position: 'relative', paddingBottom: vs(4) }}>
                <View style={[styles.dot, { backgroundColor: '#10B981', position: 'absolute', left: -ms(25), top: ms(4) }]} />
                <Text style={{ color: '#10B981', fontSize: ms(11), fontWeight: '600', marginBottom: vs(2) }}>Return (Pickup)</Text>
                <Text style={[styles.locationTitle, { color: theme.colors.text }]} numberOfLines={2}>{ride.pickup_address}</Text>
              </View>
            </>
          )}
        </View>

        {/* STATS ROW CARD */}
        <View style={[styles.card, { backgroundColor: 'transparent', borderColor: isDark ? theme.colors.border : '#E2E8F0', elevation: 0, shadowOpacity: 0, padding: ms(12), paddingVertical: vs(16) }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>

            <View style={styles.statItem}>
              <View style={[styles.statIconBox, { backgroundColor: '#D1FAE5' }]}>
                <Text style={{ color: '#10B981', fontSize: ms(16), fontWeight: '700' }}>₹</Text>
              </View>
              <View style={{ marginLeft: s(6) }}>
                <Text style={styles.statLbl}>Est. Fare</Text>
                <Text style={[styles.statVal, { color: theme.colors.text }]}>₹{ride.estimated_fare || ride.total_fare || '520'}</Text>
                <Text style={{ fontSize: ms(7), color: theme.colors.textMuted, marginTop: 1 }}>Includes taxes</Text>
              </View>
            </View>



            <View style={styles.statItem}>
              <View style={[styles.statIconBox, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="git-merge-outline" size={ms(16)} color="#9333EA" style={{ transform: [{ rotate: '90deg' }] }} />
              </View>
              <View style={{ marginLeft: s(6) }}>
                <Text style={styles.statLbl}>Est. Distance</Text>
                <Text style={[styles.statVal, { color: theme.colors.text }]}>{dynamicDistance} km</Text>
              </View>
            </View>

            <View style={styles.statItem}>
              <View style={[styles.statIconBox, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="time-outline" size={ms(16)} color="#2563EB" />
              </View>
              <View style={{ marginLeft: s(6) }}>
                <Text style={styles.statLbl}>Est. Time</Text>
                <Text style={[styles.statVal, { color: theme.colors.text }]}>{dynamicTime}</Text>
              </View>
            </View>


          </View>
        </View>

        {/* TRIP DETAILS CARD */}
        <View style={[styles.card, { backgroundColor: 'transparent', borderColor: isDark ? theme.colors.border : '#E2E8F0', elevation: 0, shadowOpacity: 0, padding: ms(16) }]}>
          <Text style={{ fontSize: ms(15), fontWeight: '700', color: theme.colors.text, marginBottom: vs(12) }}>Trip Details</Text>

          {!!ride.driver_allowance && ride.driver_allowance > 0 && (
            <View style={styles.tripDetailRow}>
              <Text style={styles.tripDetailLbl}>Driver Allowance</Text>
              <Text style={[styles.tripDetailVal, { color: '#10B981' }]}>₹{Math.round(ride.driver_allowance)}</Text>
            </View>
          )}

          <View style={styles.tripDetailRow}>
            <Text style={styles.tripDetailLbl}>Ride Type</Text>
            <Text style={[styles.tripDetailVal, { color: theme.colors.text }]}>{ride?.ride_type || ride?.service_type}</Text>
          </View>

          <View style={styles.tripDetailRow}>
            <Text style={styles.tripDetailLbl}>Vehicle Name</Text>
            <Text style={[styles.tripDetailVal, { color: theme.colors.text }]}>{ride?.car_name || ride?.vehicle_model}</Text>
          </View>

          <View style={styles.tripDetailRow}>
            <Text style={styles.tripDetailLbl}>Vehicle Type</Text>
            <Text style={[styles.tripDetailVal, { color: theme.colors.text }]}>{ride?.vehicle_type}</Text>
          </View>

          <View style={styles.tripDetailRow}>
            <Text style={styles.tripDetailLbl}>Transmission</Text>
            <Text style={[styles.tripDetailVal, { color: theme.colors.text, textTransform: 'capitalize' }]}>
              {String(ride?.transmission_type || ride?.transmission || 'Manual').replace('_', ' ')}
            </Text>
          </View>

          <View style={styles.tripDetailRow}>
            <Text style={styles.tripDetailLbl}>Payment</Text>
            <Text style={[styles.tripDetailVal, { color: theme.colors.text }]}>{ride?.payment_type || (ride?.payment_opt === 1 ? 'Cash' : ride?.payment_opt === 0 ? 'Online' : 'Online/Cash')}</Text>
          </View>
          <View style={styles.tripDetailRow}>
            <Text style={styles.tripDetailLbl}>Special Note</Text>
            <Text style={[styles.tripDetailVal, { color: theme.colors.text }]}>{ride?.special_note || ride?.description || '-'}</Text>
          </View>

          {ride?.note || ride?.customer_note ? (
            <View style={[styles.customerNoteBox, { backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : '#EFF6FF' }]}>
              <Ionicons name="information-circle-outline" size={ms(18)} color="#2563EB" />
              <View style={{ marginLeft: s(8), flex: 1 }}>
                <Text style={{ color: '#2563EB', fontSize: ms(12), fontWeight: '600', marginBottom: vs(2) }}>Customer Note</Text>
                <Text style={{ color: theme.colors.text, fontSize: ms(11) }}>{ride?.note || ride?.customer_note}</Text>
              </View>
            </View>
          ) : null}
        </View>

        {isAccepted && (
          <View style={[styles.card, { backgroundColor: 'transparent', borderColor: isDark ? theme.colors.border : '#E2E8F0', elevation: 0, shadowOpacity: 0, padding: ms(12), paddingVertical: vs(12) }]}>
            <Text style={{ fontSize: ms(13), fontWeight: '700', color: theme.colors.text, marginBottom: vs(8) }}>Customer Details</Text>
            
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {/* Profile Image */}
              <View style={{ width: ms(36), height: ms(36), borderRadius: ms(18), backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                {(ride?.passenger_details?.image || ride?.user_details?.profile_url || ride?.riderImage) ? (
                  <Image source={{ uri: ride?.passenger_details?.image || ride?.user_details?.profile_url || ride?.riderImage }} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <Text style={{ fontSize: ms(14), fontWeight: '600', color: '#64748B' }}>
                    {String(ride?.passenger_details?.name || ride?.user_details?.full_name || ride?.user_details?.first_name || ride?.passenger || ride?.passenger_name || 'P').charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>

              {/* Name and Rating */}
              <View style={{ flex: 1, marginLeft: ms(12) }}>
                <Text style={{ fontSize: ms(13), fontWeight: '600', color: theme.colors.text }}>
                  {ride?.passenger_details?.name || ride?.user_details?.full_name || ride?.user_details?.first_name || ride?.passenger || ride?.passenger_name || ride?.customer?.name || 'Passenger'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: vs(2) }}>
                  <Ionicons name="star" size={ms(11)} color="#F59E0B" />
                  <Text style={{ fontSize: ms(11), color: '#64748B', marginLeft: s(4) }}>
                    {ride?.passenger_details?.rating ?? ride?.user_details?.rating ?? ride?.passenger_rating ?? ride?.rating ?? ride?.customer?.rating ?? '5.0'}
                  </Text>
                </View>
              </View>

              {/* Call Button */}
              <TouchableOpacity 
                style={{ width: ms(32), height: ms(32), borderRadius: ms(16), backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' }}
                onPress={() => {
                  const phone = ride?.phone || ride?.passenger_phone || ride?.user_details?.phone_number || ride?.passenger_details?.phone;
                  if (phone) Linking.openURL(`tel:${phone}`);
                }}
              >
                <Ionicons name="call" size={ms(16)} color="#2563EB" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: isAccepted ? vs(180) : vs(120) }} />
      </ScrollView>

      {/* BOTTOM ACTION BAR */}
      <View style={[styles.bottomActionBar, { backgroundColor: isDark ? theme.colors.card : '#FFF', borderTopColor: isDark ? theme.colors.border : '#F1F5F9', paddingBottom: Math.max(insets.bottom, vs(16)) }]}>

        {isAccepted ? (
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: vs(12) }}>
              <TouchableOpacity style={[styles.startNavBtn, { flex: 1 }]} onPress={() => {
                if (onStartNavigation) onStartNavigation();
              }}>
                <View style={styles.startNavIconBox}>
                  <Ionicons name="navigate" size={ms(16)} color="#2563EB" />
                </View>
                <View style={{ marginLeft: s(8) }}>
                  <Text style={styles.startNavTitle}>Start Navigation</Text>
                  <Text style={styles.startNavSub}>Navigate to pickup</Text>
                </View>
                <Ionicons name="chevron-forward" size={ms(20)} color="#FFF" style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            </View>

            <View style={[styles.acceptedActionsCard, { backgroundColor: isDark ? theme.colors.background : '#FFF', borderColor: isDark ? theme.colors.border : '#F1F5F9' }]}>

              <TouchableOpacity style={styles.secondaryActionBtn} onPress={() => {
                if (onCancelPress) {
                  onCancelPress();
                }
              }}>
                <Ionicons name="close-circle-outline" size={ms(20)} color="#DC2626" />
                <Text style={[styles.secondaryActionText, { color: theme.colors.text }]}>Cancel Ride</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryActionBtn}>
                <Ionicons name="share-social-outline" size={ms(20)} color={theme.colors.textMuted} />
                <Text style={[styles.secondaryActionText, { color: theme.colors.text }]}>Share Trip</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryActionBtn}>
                <Ionicons name="calendar-outline" size={ms(20)} color={theme.colors.textMuted} />
                <Text style={[styles.secondaryActionText, { color: theme.colors.text }]}>Add to Calendar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <TouchableOpacity style={styles.declineBtn}>
              <Text style={styles.declineBtnText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept}>
              <Text style={styles.acceptBtnText}>Accept Ride</Text>
              <Ionicons name="chevron-forward" size={ms(16)} color="#FFF" style={{ marginLeft: s(8) }} />
            </TouchableOpacity>
          </View>
        )}

      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backBtnError: { marginTop: vs(20), backgroundColor: '#2563EB', paddingHorizontal: ms(20), paddingVertical: vs(10), borderRadius: ms(8) },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: ms(8), paddingVertical: vs(8), borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  headerTitle: { fontSize: ms(16), fontWeight: '700' },
  scrollContent: { padding: ms(12) },
  card: { borderRadius: ms(12), marginBottom: vs(12), borderWidth: 1, borderColor: '#F1F5F9', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  iconCircleBlue: { width: ms(36), height: ms(36), borderRadius: ms(18), backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  badgeBlueLight: { backgroundColor: '#EFF6FF', paddingHorizontal: ms(10), paddingVertical: vs(4), borderRadius: ms(12) },
  badgeBlueLightText: { color: '#2563EB', fontSize: ms(11), fontWeight: '600' },
  mapOverlayBtn: { position: 'absolute', bottom: ms(12), right: ms(12), backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: ms(12), paddingVertical: vs(6), borderRadius: ms(20), shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  locationRow: { flexDirection: 'row', alignItems: 'center' },
  dotLineCol: { width: ms(16), alignItems: 'center', marginRight: ms(12) },
  dot: { width: ms(10), height: ms(10), borderRadius: ms(5) },
  dottedLine: { width: 1, height: vs(32), borderWidth: 1, borderColor: '#CBD5E1', borderStyle: 'dashed', marginVertical: vs(4) },
  locationContent: { flex: 1, paddingRight: ms(8) },
  locationTitle: { fontSize: ms(13), marginBottom: vs(2) },
  locationSub: { fontSize: ms(11) },
  callBtnCircle: { width: ms(36), height: ms(36), borderRadius: ms(18), backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  horizontalDividerSolid: { borderBottomWidth: 1, marginVertical: vs(12) },
  statItem: { flexDirection: 'row', alignItems: 'center' },
  statIconBox: { width: ms(28), height: ms(28), borderRadius: ms(8), justifyContent: 'center', alignItems: 'center' },
  statLbl: { fontSize: ms(9), color: '#64748B', fontWeight: '500' },
  statVal: { fontSize: ms(12), fontWeight: '700', marginTop: vs(2) },
  tripDetailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: vs(8) },
  tripDetailLbl: { fontSize: ms(12), color: '#64748B' },
  tripDetailVal: { fontSize: ms(12), fontWeight: '600' },
  customerNoteBox: { flexDirection: 'row', padding: ms(12), borderRadius: ms(8), marginTop: vs(8) },
  bottomActionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: ms(16), paddingTop: vs(16), borderTopWidth: 1 },
  declineBtn: { flex: 0.45, borderWidth: 1, borderColor: '#2563EB', borderRadius: ms(8), paddingVertical: vs(12), justifyContent: 'center', alignItems: 'center' },
  declineBtnText: { color: '#2563EB', fontSize: ms(14), fontWeight: '700' },
  acceptBtn: { flex: 0.5, backgroundColor: '#2563EB', borderRadius: ms(8), paddingVertical: vs(12), flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  acceptBtnText: { color: '#FFF', fontSize: ms(14), fontWeight: '700' },
  secondaryActionBtn: { alignItems: 'center' },
  secondaryActionText: { fontSize: ms(10), marginTop: vs(4), fontWeight: '500' },
  callCustomerBtn: { flex: 0.38, flexDirection: 'row', borderWidth: 1, borderColor: '#2563EB', borderRadius: ms(8), paddingVertical: vs(12), justifyContent: 'center', alignItems: 'center' },
  callCustomerBtnText: { color: '#2563EB', fontSize: ms(13), fontWeight: '600', marginLeft: s(6) },
  startNavBtn: { flex: 0.6, backgroundColor: '#2563EB', borderRadius: ms(8), paddingVertical: vs(10), paddingHorizontal: ms(12), flexDirection: 'row', alignItems: 'center' },
  startNavIconBox: { width: ms(26), height: ms(26), borderRadius: ms(13), backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  startNavTitle: { color: '#FFF', fontSize: ms(14), fontWeight: '700' },
  startNavSub: { color: 'rgba(255,255,255,0.8)', fontSize: ms(11) },
  acceptedActionsCard: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: vs(12), paddingHorizontal: ms(16), borderRadius: ms(8), borderWidth: 1 },
});

export default ScheduledRideDetailsScreen;
