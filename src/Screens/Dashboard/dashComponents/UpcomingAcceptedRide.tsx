import React from 'react';
import { View, StyleSheet, Pressable, Image } from 'react-native';
import { Text } from '../../../Components';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { hS as s, vS as vs, ms } from '../../../lib/scale';

interface UpcomingAcceptedRideProps {
    trip: any;
    onViewAllPress?: () => void;
    onNavigatePress?: () => void;
}

const UpcomingAcceptedRide: React.FC<UpcomingAcceptedRideProps> = ({ trip, onViewAllPress, onNavigatePress }) => {
    if (!trip) return null;

    // Parse date and time
    const tripDate = new Date(trip.scheduled_start_time || trip.startTime || new Date());
    const day = tripDate.getDate();
    const month = tripDate.toLocaleString('default', { month: 'short' });
    const timeString = tripDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Mock distance for now if not provided
    const distanceAway = trip.distance ? `${trip.distance} away` : '2.4 km away';
    const tripType = trip.booking_type === 'ROUND_TRIP' ? 'Round Trip' : 'One Way';
    const estimatedFare = trip.estimated_fare || trip.total_fare || trip.amount || '0.00';

    const pickup = trip.pickup_address || trip.pickup || 'Pickup Location';
    const dropoff = trip.drop_address || trip.drop || 'Dropoff Location';

    return (
        <View style={styles.cardContainer}>
            {/* Header */}
            <View style={styles.headerRow}>
                <Text style={styles.headerTitle}>Upcoming Accepted Ride</Text>
                <Pressable onPress={onViewAllPress}>
                    <Text style={styles.viewAllText}>View All</Text>
                </Pressable>
            </View>

            <View style={styles.contentRow}>
                {/* Left Column: Date & Time */}
                <View style={styles.dateCol}>
                    <Text style={styles.dayText}>{day}</Text>
                    <Text style={styles.monthText}>{month}</Text>
                    <View style={styles.timeBadge}>
                        <Text style={styles.timeText}>{timeString}</Text>
                    </View>
                </View>

                {/* Middle Column: Route & Fare */}
                <View style={styles.routeCol}>
                    {/* Pickup Row */}
                    <View style={styles.locationRow}>
                        <View style={styles.dotContainer}>
                            <View style={[styles.dot, { backgroundColor: '#22C55E' }]} />
                            <View style={styles.verticalLine} />
                        </View>
                        <View style={styles.addressInfo}>
                            <Text style={styles.addressText} numberOfLines={1}>{pickup}</Text>
                            <Text style={styles.distanceText}>{distanceAway}</Text>
                        </View>
                    </View>

                    {/* Dropoff Row */}
                    <View style={[styles.locationRow, { marginTop: vs(4) }]}>
                        <View style={styles.dotContainer}>
                            <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
                        </View>
                        <View style={styles.addressInfo}>
                            <Text style={styles.addressText} numberOfLines={1}>{dropoff}</Text>
                            <View style={styles.tripTypeBadge}>
                                <Text style={styles.tripTypeText}>{tripType}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Fare info */}
                    <View style={styles.fareContainer}>
                        <Text style={styles.fareLabel}>Estimated Fare</Text>
                        <Text style={styles.fareValue}>₹{parseFloat(estimatedFare).toFixed(2)}</Text>
                    </View>
                </View>

                {/* Right Column: Map & Navigate */}
                <View style={styles.actionCol}>
                    <Image 
                        source={require('../../../assets/images/map6.png')} 
                        style={styles.mapThumbnail}
                        resizeMode="cover"
                    />
                    <Pressable style={styles.navigateBtn} onPress={onNavigatePress}>
                        <Ionicons name="navigate" size={ms(16)} color="#FFFFFF" />
                        <Text style={styles.navigateBtnText}>Navigate</Text>
                    </Pressable>
                </View>
            </View>
        </View>
    );
};

export default UpcomingAcceptedRide;

const styles = StyleSheet.create({
    cardContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: ms(16),
        marginHorizontal: s(12),
        marginBottom: vs(16),
        padding: ms(16),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: vs(16),
    },
    headerTitle: {
        fontSize: ms(15),
        fontWeight: '700',
        color: '#1E293B',
    },
    viewAllText: {
        fontSize: ms(13),
        fontWeight: '600',
        color: '#3B82F6',
    },
    contentRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    /* Left Column */
    dateCol: {
        backgroundColor: '#F8FAFC',
        borderRadius: ms(12),
        paddingVertical: vs(12),
        paddingHorizontal: s(8),
        alignItems: 'center',
        width: s(65),
    },
    dayText: {
        fontSize: ms(24),
        fontWeight: '800',
        color: '#0F172A',
    },
    monthText: {
        fontSize: ms(13),
        fontWeight: '600',
        color: '#2563EB',
        marginBottom: vs(8),
    },
    timeBadge: {
        backgroundColor: '#DBEAFE',
        paddingHorizontal: s(6),
        paddingVertical: vs(4),
        borderRadius: ms(6),
    },
    timeText: {
        fontSize: ms(10),
        fontWeight: '700',
        color: '#1D4ED8',
    },
    /* Middle Column */
    routeCol: {
        flex: 1,
        paddingHorizontal: s(12),
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    dotContainer: {
        alignItems: 'center',
        width: s(16),
        marginRight: s(6),
    },
    dot: {
        width: ms(10),
        height: ms(10),
        borderRadius: ms(5),
        marginTop: vs(4),
    },
    verticalLine: {
        width: 1,
        height: vs(24),
        backgroundColor: '#CBD5E1',
        marginVertical: vs(2),
    },
    addressInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    addressText: {
        fontSize: ms(13),
        color: '#1E293B',
        fontWeight: '500',
        marginRight: s(6),
        flexShrink: 1,
    },
    distanceText: {
        fontSize: ms(11),
        color: '#3B82F6',
        fontWeight: '500',
    },
    tripTypeBadge: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: s(6),
        paddingVertical: vs(2),
        borderRadius: ms(8),
        marginTop: vs(2),
    },
    tripTypeText: {
        fontSize: ms(10),
        color: '#64748B',
        fontWeight: '600',
    },
    fareContainer: {
        marginTop: vs(12),
        marginLeft: s(22), // Align under the text, avoiding the dots
    },
    fareLabel: {
        fontSize: ms(11),
        color: '#64748B',
        marginBottom: vs(2),
    },
    fareValue: {
        fontSize: ms(14),
        fontWeight: '700',
        color: '#0F172A',
    },
    /* Right Column */
    actionCol: {
        width: s(90),
        justifyContent: 'space-between',
    },
    mapThumbnail: {
        width: '100%',
        height: vs(60),
        borderRadius: ms(12),
        marginBottom: vs(8),
        backgroundColor: '#E2E8F0',
    },
    navigateBtn: {
        backgroundColor: '#2563EB',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: vs(8),
        borderRadius: ms(8),
    },
    navigateBtnText: {
        color: '#FFFFFF',
        fontSize: ms(12),
        fontWeight: '600',
        marginLeft: s(4),
    }
});
