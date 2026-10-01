import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../../redux/store';
import { useAppTheme } from '../../../context/ThemeContext';
import { hS as s, vS as vs, mS as ms } from '../../../lib/scale';
import { PickupMapScreen_Nav, PickupOTPScreen_Nav, DropMapScreen_Nav, WaitingScreen_Nav, ReturnTripMapScreen_Nav } from '../../../Navigations/navigations';

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
    let label = '';
    let iconName = 'car-outline';
    let bgColor = isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF'; // Blue tint
    let borderColor = isDark ? 'rgba(59, 130, 246, 0.3)' : '#BFDBFE';
    let textColor = isDark ? '#60A5FA' : '#1D4ED8';

    if (['ARRIVING'].includes(rawStatus) || (rawStatus === 'ACCEPTED' && !isScheduled)) {
        targetScreen = PickupMapScreen_Nav;
        label = t('active_ride_pickup', 'En route to Pickup');
        iconName = 'navigate-circle-outline';
    } else if (rawStatus === 'ARRIVED') {
        targetScreen = PickupOTPScreen_Nav;
        label = t('active_ride_arrived', 'Arrived at Pickup');
        iconName = 'checkmark-circle-outline';
    } else if (rawStatus === 'VERIFICATION_PENDING') {
        targetScreen = 'VehicleVerificationScreen';
        label = t('active_ride_verify', 'Verification Pending');
        iconName = 'shield-checkmark-outline';
        bgColor = isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7';
        borderColor = isDark ? 'rgba(245, 158, 11, 0.3)' : '#FDE68A';
        textColor = isDark ? '#FBBF24' : '#B45309';
    } else if (['LIVE', 'STARTED', 'ON_TRIP'].includes(rawStatus)) {
        targetScreen = DropMapScreen_Nav;
        label = t('active_ride_drop', 'On Trip');
        iconName = 'map-outline';
        bgColor = isDark ? 'rgba(16, 185, 129, 0.15)' : '#D1FAE5';
        borderColor = isDark ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0';
        textColor = isDark ? '#34D399' : '#047857';
    } else if (rawStatus === 'WAITING' || rawStatus === 'DAY_HALT') {
        targetScreen = WaitingScreen_Nav;
        label = t('active_ride_waiting', 'Waiting on Trip');
        iconName = 'time-outline';
        bgColor = isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7';
        borderColor = isDark ? 'rgba(245, 158, 11, 0.3)' : '#FDE68A';
        textColor = isDark ? '#FBBF24' : '#B45309';
    } else if (rawStatus === 'RETURN_STARTED') {
        targetScreen = ReturnTripMapScreen_Nav;
        label = t('active_ride_return', 'Return Trip Started');
        iconName = 'return-up-back-outline';
    } else if (['DESTINATION_REACHED', 'RETURN_REACHED'].includes(rawStatus)) {
        targetScreen = 'PaymentCollectionScreen';
        label = t('active_ride_payment', 'Collect Payment');
        iconName = 'cash-outline';
        bgColor = isDark ? 'rgba(16, 185, 129, 0.15)' : '#D1FAE5';
        borderColor = isDark ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0';
        textColor = isDark ? '#34D399' : '#047857';
    }

    if (!targetScreen) return null;

    const handlePress = () => {
        navigation.navigate(targetScreen as any, { ride: currentRide } as any);
    };

    return (
        <Pressable 
            style={[
                styles.container, 
                { backgroundColor: bgColor, borderColor: borderColor }
            ]} 
            onPress={handlePress}
            android_ripple={{ color: 'rgba(0,0,0,0.1)' }}
        >
            <View style={[styles.iconContainer, { backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)' }]}>
                <Ionicons name={iconName} size={ms(24)} color={textColor} />
            </View>
            <View style={styles.textContainer}>
                <Text style={[styles.title, { color: textColor }]}>
                    {t('active_ride_ongoing', 'Active Ride Ongoing')}
                </Text>
                <Text style={[styles.subtitle, { color: isDark ? '#9CA3AF' : '#4B5563' }]}>
                    {label} • {t('tap_to_return', 'Tap to return')}
                </Text>
            </View>
            <Ionicons name="chevron-forward" size={ms(20)} color={textColor} />
        </Pressable>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: ms(16),
        marginHorizontal: ms(16),
        marginBottom: vs(16),
        borderRadius: ms(12),
        borderWidth: 1,
    },
    iconContainer: {
        width: ms(40),
        height: ms(40),
        borderRadius: ms(20),
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: ms(12),
    },
    textContainer: {
        flex: 1,
    },
    title: {
        fontFamily: 'Outfit-Bold',
        fontSize: ms(16),
        marginBottom: vs(2),
    },
    subtitle: {
        fontFamily: 'Outfit-Medium',
        fontSize: ms(13),
    }
});

export default ActiveRideBanner;
