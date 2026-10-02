import React from 'react';
import { View, Text, Pressable, StyleSheet, Image, Linking, Platform } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../../redux/store';
import { useAppTheme } from '../../../context/ThemeContext';
import { hS as s, vS as vs, mS as ms } from '../../../lib/scale';
import { PickupMapScreen_Nav, PickupOTPScreen_Nav, DropMapScreen_Nav, WaitingScreen_Nav, ReturnTripMapScreen_Nav } from '../../../Navigations/navigations';

const activeTripImage = require('../../../assets/images/activetripimage.png');

const ActiveRideBanner = () => {
    const { theme, isDark } = useAppTheme();
    const { t } = useTranslation();
    const navigation = useNavigation<NavigationProp<any>>();

    const currentRide = useSelector((state: RootState) => state.ride.currentRide);

    if (!currentRide) return null;

    const rawStatus = (currentRide.trip_status || (currentRide as any).status || '').toUpperCase();
    
    // Ignore terminal statuses
    if (['COMPLETED', 'CANCELLED', 'CANCEL', 'MID_CANCELLED'].includes(rawStatus)) return null;

    const isScheduled = (currentRide as any)?.booking_type === 'SCHEDULED' || (currentRide as any)?.is_scheduled;
    
    // If it's a scheduled ride that's merely ACCEPTED, we don't show the active banner yet
    if (rawStatus === 'ACCEPTED' && isScheduled) return null;

    let targetScreen = '';
    
    if (['ARRIVING'].includes(rawStatus) || (rawStatus === 'ACCEPTED' && !isScheduled)) {
        targetScreen = PickupMapScreen_Nav;
    } else if (rawStatus === 'ARRIVED') {
        targetScreen = PickupOTPScreen_Nav;
    } else if (rawStatus === 'VERIFICATION_PENDING') {
        targetScreen = 'VehicleVerificationScreen';
    } else if (['LIVE', 'STARTED', 'ON_TRIP'].includes(rawStatus)) {
        const isRoundTrip = (currentRide as any)?.ride_type === 'ROUND_TRIP' || (currentRide as any)?.ride_type === 'OUTSTATION_ROUND_TRIP';
        const hasFinishedFirstLeg = !!((currentRide as any)?.actual_drop_time || (currentRide as any)?.wait_started_at || (currentRide as any)?.waiting_started_at || (currentRide as any)?.return_started_at);
        if (isRoundTrip && hasFinishedFirstLeg) {
            targetScreen = ReturnTripMapScreen_Nav;
        } else {
            targetScreen = DropMapScreen_Nav;
        }
    } else if (rawStatus === 'WAITING' || rawStatus === 'DAY_HALT') {
        targetScreen = WaitingScreen_Nav;
    } else if (rawStatus === 'RETURN_STARTED') {
        targetScreen = ReturnTripMapScreen_Nav;
    } else if (['DESTINATION_REACHED', 'RETURN_REACHED'].includes(rawStatus)) {
        targetScreen = 'PaymentCollectionScreen';
    }

    if (!targetScreen) return null;

    const handlePress = () => {
        navigation.navigate(targetScreen as any, { ride: currentRide } as any);
    };

    const handleMessage = () => {
        // Fallback to targetScreen if ChatScreen is not accessible or setup properly
        navigation.navigate('ChatScreen' as any, { tripId: currentRide.trip_id } as any);
    };

    const handleCall = () => {
        const phone = currentRide?.user_details?.phone_number || currentRide?.passenger_details?.phone;
        if (phone) {
            Linking.openURL(`tel:${phone}`);
        }
    };

    const passengerObj = currentRide?.user_details || currentRide?.passenger_details || currentRide?.customer || currentRide?.user || {};
    const userName = passengerObj?.full_name || passengerObj?.name || passengerObj?.first_name || 'Customer';
    const userRating = passengerObj?.rating || currentRide?.user_rating || 0;
    const userReviews = passengerObj?.total_reviews || passengerObj?.reviews_count || 0;
    const userRides = passengerObj?.total_rides || passengerObj?.total_trips || passengerObj?.rides_count || 0;

    // Use actual data or fallback to defaults matching design
    const pickupAddress = currentRide?.pickup_address || 'Pickup Location';
    const dropAddress = currentRide?.drop_address || 'Drop Location';
    
    const parsedTripDistance = parseFloat(((currentRide as any)?.distance_km || (currentRide as any)?.trip_distance || (currentRide as any)?.distance || '0').toString().replace(/[^0-9.]/g, ''));
    const tripDistanceNum = isNaN(parsedTripDistance) ? 0 : parsedTripDistance;
    const distanceKm = tripDistanceNum > 0 ? `${tripDistanceNum} km` : '--';
    
    const parsedTripTime = parseFloat(((currentRide as any)?.trip_duration_minutes || (currentRide as any)?.trip_time || (currentRide as any)?.eta || '0').toString().replace(/[^0-9.]/g, ''));
    const tripTimeNum = isNaN(parsedTripTime) ? 0 : parsedTripTime;
    const tripDuration = tripTimeNum > 0 ? `${tripTimeNum} mins` : '--';
    
    // Pickup distance/eta logic
    const pickupDistanceStr = (currentRide as any)?.distance_to_pickup || (currentRide as any)?.distanceToUser;
    const pickupEtaStr = (currentRide as any)?.eta_to_pickup;
    
    const pickupDistance = (pickupDistanceStr && pickupDistanceStr !== '--') ? pickupDistanceStr : (distanceKm !== '--' ? distanceKm : '2.5 km');
    const pickupEta = (pickupEtaStr && pickupEtaStr !== '--') ? pickupEtaStr : (tripDuration !== '--' ? tripDuration : '5 mins');

    return (
        <View style={styles.outerContainer}>
            {/* Top Blue Pill */}
            <View style={styles.topPill}>
                <Ionicons name="car" size={ms(16)} color="#FFF" style={{ marginRight: s(4) }} />
                <Text style={styles.topPillText}>{t('active_trip', 'Active Trip')}</Text>
                <View style={styles.greenDot} />
            </View>

            <View style={[styles.card, isDark && { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1 }]}>
                <View style={styles.cardContentRow}>
                    {/* Left Col - Profile */}
                    <View style={styles.profileCol}>
                        <Text style={[styles.nameText, isDark && { color: theme.colors.text }]} numberOfLines={1}>{userName}</Text>
                        
                        <View style={styles.ratingRow}>
                            <Ionicons name="star" size={ms(12)} color="#FBBF24" />
                            <Text style={[styles.ratingText, isDark && { color: theme.colors.text }]}>{Number(userRating).toFixed(1)}</Text>
                            <Text style={styles.reviewsText}>({userReviews})</Text>
                        </View>

                        <View style={styles.ridesRow}>
                            <Ionicons name="car-outline" size={ms(12)} color="#6B7280" />
                            <Text style={styles.ridesText}>
                                <Text style={{ fontWeight: '700' }}>{userRides}</Text> {t('total_rides', 'Total Rides')}
                            </Text>
                        </View>
                    </View>

                    {/* Middle Col - Route */}
                    <View style={[styles.routeCol, isDark && { borderLeftColor: theme.colors.border }]}>
                        <View style={styles.routePoints}>
                            <View style={styles.pickupDotContainer}>
                                <View style={styles.pickupDot} />
                            </View>
                            <View style={[styles.dashedLine, isDark && { borderColor: '#4B5563' }]} />
                            <View style={styles.dropDotContainer}>
                                <View style={styles.dropDot} />
                            </View>
                        </View>
                        
                        <View style={styles.routeTexts}>
                            <View style={styles.routeBlock}>
                                <Text style={[styles.addressText, isDark && { color: theme.colors.text }]} numberOfLines={1}>{pickupAddress}</Text>
                            </View>
                            <View style={[styles.routeBlock, { marginTop: vs(6) }]}>
                                <Text style={[styles.addressText, isDark && { color: theme.colors.text }]} numberOfLines={1}>{dropAddress}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Bottom Actions Row */}
                <View style={[styles.actionsRow, isDark && { borderTopColor: theme.colors.border }]}>
                    <Pressable 
                        style={[styles.actionButton, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EDF4FF' }]} 
                        onPress={handleMessage}
                        android_ripple={{ color: 'rgba(0,0,0,0.1)' }}
                    >
                        <Ionicons name="chatbubble-ellipses" size={ms(18)} color={isDark ? "#60A5FA" : "#0056FF"} />
                        <Text style={[styles.actionText, { color: isDark ? "#60A5FA" : "#0056FF" }]}>{t('message', 'Message')}</Text>
                    </Pressable>

                    <Pressable 
                        style={[styles.actionButton, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#E8F5E9' }]} 
                        onPress={handleCall}
                        android_ripple={{ color: 'rgba(0,0,0,0.1)' }}
                    >
                        <Ionicons name="call" size={ms(18)} color={isDark ? "#34D399" : "#2E7D32"} />
                        <Text style={[styles.actionText, { color: isDark ? "#34D399" : "#2E7D32" }]}>{t('call', 'Call')}</Text>
                    </Pressable>

                    <Pressable 
                        style={[styles.actionButton, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EDF4FF' }]} 
                        onPress={handlePress}
                        android_ripple={{ color: 'rgba(0,0,0,0.1)' }}
                    >
                        <Text style={[styles.actionText, { color: isDark ? "#60A5FA" : "#0056FF" }]}>{t('open', 'Open')}</Text>
                    </Pressable>
                </View>
            </View>

            {/* Top Right Floating Image */}
            <View style={styles.topRightImageContainer}>
                <Image source={activeTripImage} style={styles.floatingCarImage} resizeMode="contain" />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    outerContainer: {
        marginHorizontal: ms(16),
        marginBottom: vs(8),
        marginTop: vs(16),
        position: 'relative',
        zIndex: 5,
    },
    topPill: {
        position: 'absolute',
        top: -vs(14),
        left: ms(20),
        backgroundColor: '#0056FF',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: ms(12),
        paddingVertical: vs(4),
        borderRadius: ms(20),
        zIndex: 10,
        elevation: 6,
        shadowColor: '#0056FF',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 5,
    },
    topPillText: {
        color: '#FFF',
        fontFamily: 'Outfit-Bold',
        fontSize: ms(14),
    },
    greenDot: {
        width: ms(8),
        height: ms(8),
        borderRadius: ms(4),
        backgroundColor: '#10B981',
        marginLeft: ms(8),
    },
    card: {
        backgroundColor: '#FFF',
        borderRadius: ms(12),
        padding: ms(12),
        paddingTop: vs(20),
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    cardContentRow: {
        flexDirection: 'row',
    },
    profileCol: {
        width: '35%',
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    nameText: {
        fontFamily: 'Outfit-Bold',
        fontSize: ms(13),
        color: '#1E293B',
        textAlign: 'center',
        marginBottom: vs(2),
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: vs(4),
    },
    ratingText: {
        fontFamily: 'Outfit-Bold',
        fontSize: ms(12),
        color: '#1E293B',
        marginLeft: ms(4),
    },
    reviewsText: {
        fontFamily: 'Outfit-Medium',
        fontSize: ms(10),
        color: '#9CA3AF',
        marginLeft: ms(2),
    },
    ridesRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    ridesText: {
        fontFamily: 'Outfit-Medium',
        fontSize: ms(10),
        color: '#6B7280',
        marginLeft: ms(4),
    },
    routeCol: {
        flex: 1,
        flexDirection: 'row',
        paddingLeft: ms(8),
        borderLeftWidth: 1,
        borderLeftColor: '#F3F4F6',
        paddingRight: ms(30), // leave space so text doesn't clash with car heavily
    },
    routePoints: {
        alignItems: 'center',
        marginRight: ms(8),
        paddingVertical: vs(2),
    },
    pickupDotContainer: {
        width: ms(16),
        height: ms(16),
        borderRadius: ms(8),
        backgroundColor: '#D1FAE5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pickupDot: {
        width: ms(8),
        height: ms(8),
        borderRadius: ms(4),
        backgroundColor: '#10B981',
    },
    dropDotContainer: {
        width: ms(16),
        height: ms(16),
        borderRadius: ms(8),
        backgroundColor: '#FEE2E2',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dropDot: {
        width: ms(8),
        height: ms(8),
        borderRadius: ms(4),
        backgroundColor: '#EF4444',
    },
    dashedLine: {
        flex: 1,
        width: 1,
        borderLeftWidth: 1.5,
        borderColor: '#9CA3AF',
        borderStyle: 'dashed',
        marginVertical: vs(2),
    },
    routeTexts: {
        flex: 1,
        justifyContent: 'center',
    },
    routeBlock: {
        justifyContent: 'center',
    },
    addressText: {
        fontFamily: 'Outfit-Bold',
        fontSize: ms(12),
        color: '#1E293B',
        marginBottom: 0,
    },
    actionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: vs(10),
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        paddingTop: vs(8),
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: vs(6),
        borderRadius: ms(20),
        marginHorizontal: ms(4),
    },
    actionText: {
        fontFamily: 'Outfit-Bold',
        fontSize: ms(12),
        marginLeft: ms(4),
    },
    topRightImageContainer: {
        position: 'absolute',
        top: -vs(47),
        right: 0,
        zIndex: 10,
        elevation: 6,
    },
    floatingCarImage: {
        width: ms(110),
        height: vs(80),
    },
});

export default ActiveRideBanner;

