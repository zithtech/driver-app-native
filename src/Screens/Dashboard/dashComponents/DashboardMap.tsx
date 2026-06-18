import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable, Animated as RNAnimated, Platform, ActivityIndicator } from 'react-native';
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
    userLocation: { latitude: number; longitude: number; heading: number | null; accuracy?: number } | null;
    currentAddress?: string;
    isOnline: boolean;
    routeCoordinates?: { latitude: number; longitude: number }[];
}


const DashboardMap: React.FC<DashboardMapProps> = ({
    userLocation,
    currentAddress,
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
    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const [isMapReady, setIsMapReady] = useState(false);
    const [hasMountedMap, setHasMountedMap] = useState(false);
    const [trackChanges, setTrackChanges] = useState(true);

    // ── Fix for Android Marker Disappearing ──
    // TracksViewChanges forces Android to continually re-render the view as a bitmap.
    // We only enable it briefly when content changes to prevent disappearance and improve performance.
    useEffect(() => {
        setTrackChanges(true);
        const timer = setTimeout(() => {
            setTrackChanges(false);
        }, 1500); // Allow enough time for the map and text to render
        return () => clearTimeout(timer);
    }, [currentAddress, isOnline]);

    useEffect(() => {
        if (userLocation && !hasMountedMap) {
            setHasMountedMap(true);
        }
    }, [userLocation, hasMountedMap]);

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

    const hasInitializedLocation = useRef(false);

    // ── Smooth marker animation on location updates ──
    useEffect(() => {
        if (userLocation && isOnline) {
            if (!hasInitializedLocation.current) {
                // Instantly snap to the first valid location without animating from 0,0
                animatedCoord.setValue({
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                });
                hasInitializedLocation.current = true;
            } else {
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

    // Unused rotation logic removed as the heading beam is no longer present

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
            {hasMountedMap && (
            <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={{ flex: 1 }}
                customMapStyle={isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE}
                onMapReady={() => {
                    setMapMargin(0);
                    setIsMapLoaded(true);
                    setTimeout(() => setIsMapReady(true), 800);
                }}
                showsUserLocation={false}
                showsMyLocationButton={false}
                showsCompass={false}
                showsTraffic={showTraffic}
                onPanDrag={() => setIsFollowing(false)}
                initialRegion={{
                    latitude: userLocation?.latitude || 0,
                    longitude: userLocation?.longitude || 0,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                }}
            >
                {/* ── SMOOTH ANIMATED MARKER ── */}
                {userLocation && isMapLoaded && (
                    <Marker.Animated
                        key={currentAddress ? 'loaded-marker' : 'loading-marker'} // Forces a clean render when address is found
                        coordinate={animatedCoord as any}
                        anchor={{ x: 0.5, y: 1 }}
                        flat={false}
                        zIndex={99}
                        tracksViewChanges={Platform.OS === 'android' ? trackChanges : undefined} // Only track briefly when text/state changes
                    >
                        <View style={styles.customMarkerContainer}>
                            {/* Label - Positioned Above */}
                            <View style={styles.markerLabelContainer}>
                                <Text style={styles.markerLabelText} numberOfLines={1}>
                                    {currentAddress || t('fetching_location') || "Locating..."}
                                </Text>
                                <View style={styles.labelPointer} />
                            </View>

                            {/* Red Pin + Blue Dot Combo */}
                            <View style={styles.markerVisuals}>
                                {/* Red Pin with Blue Base Dot */}
                                <View style={[styles.pinContainer, !isOnline && { opacity: 0.6 }]}>
                                    <Ionicons 
                                        name="location" 
                                        size={ms(34)} 
                                        color={isOnline ? "#EF4444" : "#64748B"} 
                                    />
                                    {/* The Blue Circle at the base */}
                                    <View style={[styles.blueBaseCircle, !isOnline && { borderColor: '#94A3B8' }]}>
                                        <View style={[styles.blueBaseInner, !isOnline && { backgroundColor: '#64748B' }]} />
                                    </View>
                                </View>
                            </View>
                        </View>
                    </Marker.Animated>
                )}
            </MapView>
            )}

            {/* ── LOADER OVERLAY ── */}
            {(!userLocation || !isMapReady) && (
                <View style={[
                    StyleSheet.absoluteFillObject, 
                    { justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? theme.colors.background : '#f8fafc', zIndex: 100 }
                ]}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={{ marginTop: vs(12), color: isDark ? theme.colors.textMuted : '#64748b', fontSize: ms(13), fontWeight: '600' }}>
                        {t('fetching_location') || 'Fetching location...'}
                    </Text>
                </View>
            )}

            {/* ── GRADIENT FADE OVERLAY (bottom edge blend) ── */}
            <LinearGradient
                colors={['transparent', isDark ? 'rgba(11, 19, 32, 0.5)' : 'rgba(245, 246, 250, 0.5)']}
                style={styles.mapGradientFade}
                pointerEvents="none"
            />


            {/* ── FLOATING STATUS CHIP ── */}
            {isOnline && (
                <View style={[
                    styles.statusChip,
                    { backgroundColor: isDark ? 'rgba(26, 36, 56, 0.92)' : 'rgba(255, 255, 255, 0.92)' },
                ]}>
                    <View style={styles.statusDot} />
                    <Text style={[styles.statusChipText, { color: isDark ? theme.colors.text : '#1E293B' }]}>
                        {t('finding_rides', 'Finding rides...')}
                    </Text>
                </View>
            )}

            {/* ── MAP PAUSED TOAST ── */}
            {!isFollowing && isOnline && (
                <View style={[styles.mapPausedChip, { backgroundColor: isDark ? 'rgba(26, 36, 56, 0.92)' : 'rgba(255, 255, 255, 0.92)' }]}>
                    <Ionicons name="pause-circle" size={s(16)} color="#64748B" style={{ marginRight: s(6) }} />
                    <Text style={[styles.statusChipText, { color: isDark ? theme.colors.text : '#1E293B' }]}>
                        {t('map_paused') || 'Map Paused'}
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
                                    ? (isDark ? theme.colors.primary : '#3B82F6')
                                    : (isDark ? theme.colors.card : '#FFFFFF'),
                            },
                        ]}
                        onPress={() => setShowTraffic(prev => !prev)}
                        accessibilityLabel={t('toggle_traffic') || "Toggle Traffic"}
                        accessibilityHint={t('toggle_traffic_hint') || "Shows or hides live traffic on the map"}
                        accessibilityRole="button"
                    >
                        <MaterialCommunityIcons
                            name="traffic-light"
                            size={s(18)}
                            color={showTraffic ? '#FFFFFF' : (isDark ? theme.colors.textMuted : '#475569')}
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
                                    backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
                                    borderWidth: !isFollowing ? 1.5 : 0,
                                    borderColor: !isFollowing ? theme.colors.primary : 'transparent',
                                },
                            ]}
                            onPress={recenterMap}
                            accessibilityLabel={t('recenter_map') || "Recenter Map"}
                            accessibilityHint={t('recenter_map_hint') || "Centers the map back to your current location"}
                            accessibilityRole="button"
                        >
                            <Ionicons
                                name={isFollowing ? 'navigate' : 'locate'}
                                size={s(20)}
                                color={isFollowing ? theme.colors.primary : (isDark ? theme.colors.text : '#1E293B')}
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
        height: vs(20),
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
    mapPausedChip: {
        position: 'absolute',
        top: vs(12),
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: s(12),
        paddingVertical: vs(6),
        borderRadius: ms(20),
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
    },

    // ── Custom Marker Styles ──
    customMarkerContainer: {
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: vs(12),
    },
    markerVisuals: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    pinContainer: {
        alignItems: 'center',
        justifyContent: 'flex-end',
        position: 'relative',
    },
    blueBaseCircle: {
        position: 'absolute',
        bottom: ms(3),
        width: ms(14),
        height: ms(14),
        borderRadius: ms(7),
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: '#3B82F6',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
    },
    blueBaseInner: {
        width: ms(6),
        height: ms(6),
        borderRadius: ms(3),
        backgroundColor: '#2563EB',
    },
    markerLabelContainer: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        paddingHorizontal: s(10),
        paddingVertical: vs(5),
        borderRadius: ms(10),
        marginBottom: vs(6),
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 10,
        alignItems: 'center',
        minWidth: s(80),
        maxWidth: s(200),
    },
    markerLabelText: {
        color: '#FFFFFF',
        fontSize: ms(11),
        fontWeight: '800',
        textAlign: 'center',
        letterSpacing: 0.2,
    },
    labelPointer: {
        position: 'absolute',
        bottom: -vs(6),
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: s(6),
        borderRightWidth: s(6),
        borderTopWidth: vs(6),
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: 'rgba(15, 23, 42, 0.95)',
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
