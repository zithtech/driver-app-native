import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Animated as RNAnimated, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MapView, { PROVIDER_GOOGLE, AnimatedRegion, Marker } from 'react-native-maps';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { Text } from '../../../Components';
import { hS as s, vS as vs, mS as ms } from '../../../lib/scale';
import { useAppTheme } from '../../../context/ThemeContext';

// ── Dark Mode Map Style (Uber-inspired) ──
const DARK_MAP_STYLE = [
    { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8b949e' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#16213e' }] },
    {
        featureType: 'administrative',
        elementType: 'geometry.stroke',
        stylers: [{ color: '#2d3a4a' }],
    },
    {
        featureType: 'administrative.land_parcel',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#64748b' }],
    },
    {
        featureType: 'landscape',
        elementType: 'geometry',
        stylers: [{ color: '#1e293b' }],
    },
    {
        featureType: 'poi',
        elementType: 'geometry',
        stylers: [{ color: '#263445' }],
    },
    {
        featureType: 'poi',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#6b7280' }],
    },
    {
        featureType: 'poi.park',
        elementType: 'geometry',
        stylers: [{ color: '#1a3a2a' }],
    },
    {
        featureType: 'poi.park',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#4ade80' }],
    },
    {
        featureType: 'road',
        elementType: 'geometry',
        stylers: [{ color: '#2d3a4a' }],
    },
    {
        featureType: 'road',
        elementType: 'geometry.stroke',
        stylers: [{ color: '#1e293b' }],
    },
    {
        featureType: 'road.highway',
        elementType: 'geometry',
        stylers: [{ color: '#3b4f6b' }],
    },
    {
        featureType: 'road.highway',
        elementType: 'geometry.stroke',
        stylers: [{ color: '#2d3a4a' }],
    },
    {
        featureType: 'road.arterial',
        elementType: 'geometry',
        stylers: [{ color: '#334155' }],
    },
    {
        featureType: 'transit',
        elementType: 'geometry',
        stylers: [{ color: '#2d3a4a' }],
    },
    {
        featureType: 'transit.station',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#94a3b8' }],
    },
    {
        featureType: 'water',
        elementType: 'geometry',
        stylers: [{ color: '#0c1929' }],
    },
    {
        featureType: 'water',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#4a6e8a' }],
    },
];

// ── Light Mode Map Style (Clean & Minimal) ──
const LIGHT_MAP_STYLE = [
    {
        featureType: 'poi',
        elementType: 'labels',
        stylers: [{ visibility: 'simplified' }],
    },
    {
        featureType: 'transit',
        elementType: 'labels',
        stylers: [{ visibility: 'simplified' }],
    },
    {
        featureType: 'water',
        elementType: 'geometry',
        stylers: [{ color: '#c9d6e5' }],
    },
    {
        featureType: 'road.highway',
        elementType: 'geometry',
        stylers: [{ color: '#e2e8f0' }],
    },
];

interface DashboardMapProps {
    userLocation: { latitude: number; longitude: number; heading: number | null } | null;
    isOnline: boolean;
    routeCoordinates?: { latitude: number; longitude: number }[];
}


const DashboardMap: React.FC<DashboardMapProps> = ({
    userLocation,
    isOnline,
    routeCoordinates = [],
}) => {
    const { theme, isDark } = useAppTheme();
    const { t } = useTranslation();
    const mapRef = useRef<MapView | null>(null);

    const [isFollowing, setIsFollowing] = useState(true);
    const [hasCentered, setHasCentered] = useState(false);
    const [mapMargin, setMapMargin] = useState(1);
    const [showTraffic, setShowTraffic] = useState(false);

    // ── Animated Marker (Smooth Glide) ──
    const animatedCoord = useRef(new AnimatedRegion({
        latitude: userLocation?.latitude || 0,
        longitude: userLocation?.longitude || 0,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
    })).current;

    // ── Recenter button highlight animation ──
    const recenterPulse = useRef(new RNAnimated.Value(0)).current;

    // ── Offline overlay fade animation ──
    const offlineFade = useRef(new RNAnimated.Value(isOnline ? 0 : 1)).current;

    // ── Pulse animation for the marker ──
    const markerPulse = useRef(new RNAnimated.Value(1)).current;

    // Reset centering when going offline
    useEffect(() => {
        if (!isOnline) {
            setHasCentered(false);
            setIsFollowing(false);
            RNAnimated.timing(offlineFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
        } else {
            setIsFollowing(true);
            RNAnimated.timing(offlineFade, { toValue: 0, duration: 400, useNativeDriver: true }).start();
        }
    }, [isOnline, offlineFade]);

    // Re-center when navigating back to the dashboard
    useFocusEffect(
        useCallback(() => {
            if (isOnline) {
                setIsFollowing(true);
                setHasCentered(false);
            }
        }, [isOnline])
    );

    // ── Smooth marker animation on location updates ──
    useEffect(() => {
        if (userLocation && isOnline) {
            // Smooth glide the marker to new position
            if (Platform.OS === 'android') {
                animatedCoord.timing({
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                    duration: 1000,
                    useNativeDriver: false,
                } as any).start();
            } else {
                animatedCoord.timing({
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                    duration: 1000,
                    useNativeDriver: false,
                } as any).start();
            }
        }
    }, [userLocation, isOnline, animatedCoord]);

    // ── Auto-center/Follow map ──
    useEffect(() => {
        if (userLocation && isOnline) {
            if (!hasCentered) {
                mapRef.current?.animateToRegion({
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                });
                setHasCentered(true);
            } else if (isFollowing) {
                mapRef.current?.animateToRegion(
                    {
                        latitude: userLocation.latitude,
                        longitude: userLocation.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                    },
                    1000
                );
            }
        }
    }, [userLocation, isOnline, hasCentered, isFollowing]);

    // ── Recenter button pulse when NOT following ──
    useEffect(() => {
        if (!isFollowing && isOnline) {
            RNAnimated.loop(
                RNAnimated.sequence([
                    RNAnimated.timing(recenterPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
                    RNAnimated.timing(recenterPulse, { toValue: 0, duration: 800, useNativeDriver: true }),
                ])
            ).start();
        } else {
            recenterPulse.stopAnimation();
            recenterPulse.setValue(0);
        }
    }, [isFollowing, isOnline, recenterPulse]);

    // ── Marker pulse animation ──
    useEffect(() => {
        if (isOnline) {
            RNAnimated.loop(
                RNAnimated.sequence([
                    RNAnimated.timing(markerPulse, { toValue: 1.6, duration: 2000, useNativeDriver: true }),
                    RNAnimated.timing(markerPulse, { toValue: 1, duration: 2000, useNativeDriver: true }),
                ])
            ).start();
        } else {
            markerPulse.stopAnimation();
            markerPulse.setValue(1);
        }
    }, [isOnline, markerPulse]);

    const recenterMap = useCallback(() => {
        if (userLocation) {
            setIsFollowing(true);
            mapRef.current?.animateToRegion(
                {
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                },
                1000
            );
        }
    }, [userLocation]);

    const rotation = userLocation?.heading !== null && userLocation?.heading !== undefined
        ? `${userLocation.heading}deg`
        : '0deg';

    const recenterRingOpacity = recenterPulse.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.3],
    });

    const recenterRingScale = recenterPulse.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.4],
    });

    return (
        <View style={styles.mapContainer}>
            <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={{ flex: 1 }}
                customMapStyle={isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE}
                onMapReady={() => setMapMargin(0)}
                showsUserLocation={false}
                showsMyLocationButton={false}
                showsCompass={false}
                showsTraffic={showTraffic}
                onPanDrag={() => setIsFollowing(false)}
                region={{
                    latitude: userLocation?.latitude || 0,
                    longitude: userLocation?.longitude || 0,
                    latitudeDelta: userLocation ? 0.05 : 100,
                    longitudeDelta: userLocation ? 0.05 : 100,
                }}
            >
                {/* ── SMOOTH ANIMATED MARKER ── */}
                {isOnline && userLocation && (
                    <Marker.Animated
                        coordinate={animatedCoord as any}
                        anchor={{ x: 0.5, y: 0.5 }}
                        flat={true}
                        zIndex={99}
                    >
                        <View style={styles.markerOuter}>
                            {/* Pulse ring */}
                            <RNAnimated.View
                                style={[
                                    styles.markerPulseRing,
                                    {
                                        backgroundColor: theme.colors.primary,
                                        transform: [{ scale: markerPulse }],
                                        opacity: markerPulse.interpolate({
                                            inputRange: [1, 1.6],
                                            outputRange: [0.35, 0],
                                        }),
                                    },
                                ]}
                            />
                            {/* Car body */}
                            <View style={[
                                styles.markerCarBody,
                                { backgroundColor: theme.colors.primary, transform: [{ rotate: rotation }] },
                            ]}>
                                <MaterialCommunityIcons name="car-sports" size={ms(20)} color="#FFFFFF" />
                            </View>
                            {/* Directional arrow */}
                            <View style={[
                                styles.markerArrow,
                                { borderBottomColor: theme.colors.primary, transform: [{ rotate: rotation }] },
                            ]} />
                        </View>
                    </Marker.Animated>
                )}
            </MapView>

            {/* ── GRADIENT FADE OVERLAY (bottom edge blend) ── */}
            <LinearGradient
                colors={['transparent', isDark ? '#0F172A' : '#F5F6FA']}
                style={styles.mapGradientFade}
                pointerEvents="none"
            />


            {/* ── FLOATING STATUS CHIP ── */}
            {isOnline && (
                <View style={[
                    styles.statusChip,
                    { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.92)' : 'rgba(255, 255, 255, 0.92)' },
                ]}>
                    <View style={styles.statusDot} />
                    <Text style={[styles.statusChipText, { color: isDark ? '#E2E8F0' : '#1E293B' }]}>
                        {t('online') || 'Online'}
                    </Text>
                </View>
            )}

            {/* ── OFFLINE DIM OVERLAY (Animated) ── */}
            {!isOnline && (
                <RNAnimated.View style={[styles.offlineOverlay, { opacity: offlineFade }]}>
                    <View style={styles.offlineIconCircle}>
                        <Ionicons name="moon-outline" size={s(28)} color="#FFFFFF" />
                    </View>
                    <Text style={styles.offlineMapText}>{t('go_online_start')}</Text>
                    <Text style={styles.offlineSubtext}>
                        {t('offline_map_hint') || 'Slide below to start accepting rides'}
                    </Text>
                </RNAnimated.View>
            )}

            {/* ── MAP CONTROL BUTTONS (Right Side Stack) ── */}
            {isOnline && (
                <View style={styles.controlStack}>
                    {/* Traffic Toggle */}
                    <Pressable
                        style={[
                            styles.controlBtn,
                            {
                                backgroundColor: showTraffic
                                    ? theme.colors.primary
                                    : (isDark ? '#1E293B' : '#FFFFFF'),
                            },
                        ]}
                        onPress={() => setShowTraffic(prev => !prev)}
                    >
                        <MaterialCommunityIcons
                            name="traffic-light"
                            size={s(18)}
                            color={showTraffic ? '#FFFFFF' : (isDark ? '#94A3B8' : '#475569')}
                        />
                    </Pressable>

                    {/* Recenter Button */}
                    <View>
                        {/* Pulse ring when not following */}
                        {!isFollowing && (
                            <RNAnimated.View
                                style={[
                                    styles.recenterPulseRing,
                                    {
                                        opacity: recenterRingOpacity,
                                        transform: [{ scale: recenterRingScale }],
                                        borderColor: theme.colors.primary,
                                    },
                                ]}
                            />
                        )}
                        <Pressable
                            style={[
                                styles.controlBtn,
                                {
                                    backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                                    borderWidth: !isFollowing ? 1.5 : 0,
                                    borderColor: !isFollowing ? theme.colors.primary : 'transparent',
                                },
                            ]}
                            onPress={recenterMap}
                        >
                            <Ionicons
                                name={isFollowing ? 'navigate' : 'locate'}
                                size={s(20)}
                                color={isFollowing ? theme.colors.primary : (isDark ? '#FFFFFF' : '#1E293B')}
                            />
                        </Pressable>
                    </View>
                </View>
            )}
        </View>
    );
};

export default DashboardMap;

const styles = StyleSheet.create({
    mapContainer: {
        height: vs(280),
        borderBottomLeftRadius: ms(24),
        borderBottomRightRadius: ms(24),
        overflow: 'hidden',
    },

    // ── Gradient Fade ──
    mapGradientFade: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: vs(50),
    },


    // ── Floating Status Chip ──
    statusChip: {
        position: 'absolute',
        top: vs(12),
        right: s(12),
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: s(10),
        paddingVertical: vs(6),
        borderRadius: ms(20),
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
    },
    statusDot: {
        width: ms(7),
        height: ms(7),
        borderRadius: ms(4),
        backgroundColor: '#22C55E',
        marginRight: s(6),
    },
    statusChipText: {
        fontSize: ms(11),
        fontWeight: '700',
        letterSpacing: 0.3,
    },

    // ── Smooth Animated Marker ──
    markerOuter: {
        alignItems: 'center',
        justifyContent: 'center',
        width: ms(56),
        height: ms(56),
    },
    markerPulseRing: {
        position: 'absolute',
        width: ms(44),
        height: ms(44),
        borderRadius: ms(22),
    },
    markerCarBody: {
        width: ms(34),
        height: ms(34),
        borderRadius: ms(17),
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        borderWidth: 2.5,
        borderColor: '#FFFFFF',
    },
    markerArrow: {
        position: 'absolute',
        top: ms(2),
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: ms(6),
        borderRightWidth: ms(6),
        borderBottomWidth: ms(10),
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
    },

    // ── Control Buttons Stack ──
    controlStack: {
        position: 'absolute',
        bottom: vs(20),
        right: s(14),
        gap: vs(10),
    },
    controlBtn: {
        width: s(42),
        height: s(42),
        borderRadius: ms(21),
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 5,
    },
    recenterPulseRing: {
        position: 'absolute',
        width: s(42),
        height: s(42),
        borderRadius: ms(21),
        borderWidth: 2,
    },

    // ── Offline Overlay ──
    offlineOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 23, 42, 0.72)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    offlineIconCircle: {
        width: s(60),
        height: s(60),
        borderRadius: ms(30),
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: vs(14),
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    offlineMapText: {
        color: '#FFFFFF',
        fontSize: ms(15),
        fontWeight: '700',
        textAlign: 'center',
        letterSpacing: 0.3,
    },
    offlineSubtext: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: ms(12),
        fontWeight: '500',
        textAlign: 'center',
        marginTop: vs(6),
        paddingHorizontal: s(40),
    },
});
