import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable, Animated as RNAnimated, Platform, ActivityIndicator, ScrollView, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps';
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

const PulseRadar = () => {
    const pulse1 = useRef(new RNAnimated.Value(0)).current;
    const pulse2 = useRef(new RNAnimated.Value(0)).current;
    const pulse3 = useRef(new RNAnimated.Value(0)).current;

    useEffect(() => {
        const animate = (anim: RNAnimated.Value, delay: number) => {
            RNAnimated.sequence([
                RNAnimated.delay(delay),
                RNAnimated.loop(
                    RNAnimated.timing(anim, {
                        toValue: 1,
                        duration: 3000,
                        useNativeDriver: true,
                    })
                )
            ]).start();
        };
        animate(pulse1, 0);
        animate(pulse2, 1000);
        animate(pulse3, 2000);
    }, []);

    const getPulseStyle = (anim: RNAnimated.Value) => ({
        transform: [{
            scale: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.2, 4]
            })
        }],
        opacity: anim.interpolate({
            inputRange: [0, 0.2, 1],
            outputRange: [0.4, 0.1, 0]
        })
    });

    return (
        <View style={styles.pulseContainer}>
            <RNAnimated.View style={[styles.pulseCircle, getPulseStyle(pulse1)]} />
            <RNAnimated.View style={[styles.pulseCircle, getPulseStyle(pulse2)]} />
            <RNAnimated.View style={[styles.pulseCircle, getPulseStyle(pulse3)]} />
        </View>
    );
};

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
    const [isTransitioningOnline, setIsTransitioningOnline] = useState(false);

    // ── Fix for Android Marker Disappearing ──
    // TracksViewChanges forces Android to continually re-render the view as a bitmap.
    // We only enable it briefly when content changes to prevent disappearance and improve performance.
    useEffect(() => {
        setTrackChanges(true);
        const timer = setTimeout(() => {
            setTrackChanges(false);
        }, 3000); // Increased time to ensure map and text render fully without hiding
        return () => clearTimeout(timer);
    }, [currentAddress, isOnline]);

    useEffect(() => {
        if (userLocation && !hasMountedMap) {
            setHasMountedMap(true);
        }
    }, [userLocation, hasMountedMap]);


    // ── Recenter button highlight animation ──
    const recenterPulse = useRef(new RNAnimated.Value(0)).current;

    // Reset centering when going offline
    useEffect(() => {
        if (!isOnline) {
            setHasCentered(false);
            setIsFollowing(false);
        } else {
            setIsFollowing(true);
            setIsTransitioningOnline(true);
            const timer = setTimeout(() => {
                setIsTransitioningOnline(false);
            }, 1200); // smooth loader duration
            return () => clearTimeout(timer);
        }
    }, [isOnline]);

    // Re-center when navigating back to the dashboard
    useFocusEffect(
        useCallback(() => {
            if (isOnline) {
                setIsFollowing(true);
                setHasCentered(false);
            }
        }, [isOnline])
    );


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
        <View style={[styles.cardWrapper, { backgroundColor: isDark ? theme.colors.card : '#FFFFFF', borderColor: isDark ? theme.colors.border : '#F1F5F9' }]}>
            {/* ── HEADER ── */}
            <View style={[styles.cardHeader, { borderBottomColor: isDark ? theme.colors.border : '#F1F5F9' }]}>
                <View style={styles.headerLeft}>
                    <View style={styles.blueDot} />
                    <View>
                        <Text style={[styles.headerTitle, isDark && { color: theme.colors.text }]}>Live Ride Requests</Text>
                        <Text style={[styles.headerSubtitle, isDark && { color: theme.colors.textMuted }]}>You will be notified for new requests</Text>
                    </View>
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end', marginLeft: s(12), justifyContent: 'center' }}>
                    <Pressable
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}
                        onPress={() => {
                            if (userLocation) {
                                const url = Platform.OS === 'ios'
                                    ? `maps:0,0?q=${currentAddress || `${userLocation.latitude},${userLocation.longitude}`}&ll=${userLocation.latitude},${userLocation.longitude}`
                                    : `geo:0,0?q=${userLocation.latitude},${userLocation.longitude}(${currentAddress || 'My Location'})`;
                                Linking.openURL(url).catch(() => {
                                    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${userLocation.latitude},${userLocation.longitude}`);
                                });
                            }
                        }}
                    >
                        <Ionicons name="location" size={ms(12)} color={isDark ? theme.colors.primary : "#3B82F6"} style={{ marginRight: s(4) }} />
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexShrink: 1 }}>
                            <Text
                                style={[{ fontSize: ms(11), color: isDark ? theme.colors.textMuted : '#64748B', textAlign: 'right' }]}
                            >
                                {currentAddress || t('fetching_location') || "Locating..."}
                            </Text>
                        </ScrollView>
                    </Pressable>
                </View>
            </View>

            <View style={styles.mapContainer}>
                {hasMountedMap && (
                    <MapView
                        ref={mapRef}
                        provider={PROVIDER_GOOGLE}
                        style={{ flex: 1 }}
                        mapPadding={{ top: vs(100), right: s(10), bottom: vs(10), left: 0 }}
                        customMapStyle={isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE}
                        onMapReady={() => {
                            setMapMargin(0);
                            setIsMapLoaded(true);
                            setTimeout(() => setIsMapReady(true), 800);
                        }}
                        showsUserLocation={true}
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
                        {/* ── RADIATION RINGS ── */}
                        {userLocation && isOnline && (
                            <Marker
                                key="pulse-marker"
                                coordinate={{
                                    latitude: userLocation.latitude,
                                    longitude: userLocation.longitude,
                                }}
                                anchor={{ x: 0.5, y: 0.5 }}
                                flat={true}
                                tracksViewChanges={true}
                            >
                                <PulseRadar />
                            </Marker>
                        )}
                    </MapView>
                )}

                {/* ── LOADER OVERLAY ── */}
                {(!isMapReady || (isOnline && (!userLocation || isTransitioningOnline))) && (
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



                {/* ── GO TO MAP BUTTON ── */}
                {userLocation && (
                    <Pressable
                        style={[styles.goToMapBtn, isDark && { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1 }]}
                        onPress={() => {
                            const url = Platform.OS === 'ios'
                                ? `maps:0,0?q=${currentAddress || `${userLocation.latitude},${userLocation.longitude}`}&ll=${userLocation.latitude},${userLocation.longitude}`
                                : `geo:0,0?q=${userLocation.latitude},${userLocation.longitude}(${currentAddress || 'My Location'})`;
                            Linking.openURL(url).catch(() => {
                                Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${userLocation.latitude},${userLocation.longitude}`);
                            });
                        }}
                    >
                        <Ionicons name="locate" size={ms(18)} color="#2563EB" />
                        <Text style={[styles.goToMapText, isDark && { color: theme.colors.text }]}>Go to Map</Text>
                    </Pressable>
                )}

            </View>
        </View>
    );
};

export default DashboardMap;

const styles = StyleSheet.create({
    cardWrapper: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: s(12),
        borderRadius: ms(16),
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
        elevation: 1,
        overflow: 'hidden',
    },
    cardHeader: {
        flexDirection: 'row',
        paddingHorizontal: s(16),
        paddingVertical: vs(12),
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    blueDot: {
        width: ms(8),
        height: ms(8),
        borderRadius: ms(4),
        backgroundColor: '#2563EB',
        marginTop: vs(4),
        marginRight: s(8),
    },
    headerTitle: {
        fontSize: ms(16),
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: vs(2),
    },
    headerSubtitle: {
        fontSize: ms(11),
        color: '#64748B',
        fontWeight: '500',
    },
    viewAllText: {
        fontSize: ms(13),
        fontWeight: '700',
        color: '#2563EB',
    },
    mapContainer: {
        height: vs(160),
        borderBottomLeftRadius: ms(16),
        borderBottomRightRadius: ms(16),
        overflow: 'hidden',
    },
    pulseContainer: {
        width: s(150),
        height: s(150),
        justifyContent: 'center',
        alignItems: 'center',
    },
    pulseCircle: {
        position: 'absolute',
        width: s(40),
        height: s(40),
        borderRadius: s(20),
        backgroundColor: '#3B82F6',
    },
    goToMapBtn: {
        position: 'absolute',
        bottom: vs(16),
        right: s(16),
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: s(11),
        paddingVertical: vs(4),
        borderRadius: ms(10),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
    },
    goToMapText: {
        marginLeft: s(6),
        fontSize: ms(13),
        fontWeight: '700',
        color: '#0F172A',
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
        bottom: ms(2),
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
