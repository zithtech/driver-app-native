import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  Alert,
  StatusBar,
  Dimensions,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, LatLng, AnimatedRegion } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { GOOGLE_MAPS_API_KEY } from '../../constant/config';
import { useTheme } from '@react-navigation/native';
import { useAlert } from '../../context/AlertContext';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../context/ThemeContext';
import { mS as ms, vS as vs } from '../../lib/scale';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import axiosInstance from '../../api/axiosInstance';
import Geolocation from 'react-native-geolocation-service';
import { useLocationTracker } from '../../hooks/useLocationTracker';
// UserLocationMarker removed

const { width, height } = Dimensions.get('window');

const NavigationScreen: React.FC<{ route: any }> = ({ route }) => {
  const { colors } = useTheme();
  const { showAlert } = useAlert();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { theme, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const user = useSelector((state: RootState) => state.userSlice?.user);

  // Get trip data from redux or navigation params
  const ride = useSelector((state: RootState) => state.ride.currentRide) || route?.params?.ride || {};

  // 📍 Send live location to backend every 10s during active navigation
  useLocationTracker({
    driverId: user?.driverId,
    isTracking: true,
  });

  // Destination (Pickup location)
  const destination: LatLng = useMemo(() => ({
      latitude: ride.pickup_lat || 0,
      longitude: ride.pickup_lng || 0,
  }), [ride]);

  // Initial driver location
  const initialLocation: LatLng = useMemo(() => ({
      latitude: ride.driver_lat || (destination.latitude ? destination.latitude - 0.01 : 0),
      longitude: ride.driver_lng || (destination.longitude ? destination.longitude - 0.01 : 0),
  }), [ride, destination]);

  // Animated driver location for smooth movement
  const driverAnimatedLocation = useRef(new AnimatedRegion({
    ...initialLocation,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  })).current;

  const [currentLocation, setCurrentLocation] = useState<LatLng>(initialLocation);
  const [markerRotation, setMarkerRotation] = useState(0);
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSimulating, setIsSimulating] = useState(true); // Default to true for testing as requested
  const [isSosActive, setIsSosActive] = useState(false);
  const [sosId, setSosId] = useState<string | null>(null);
  const [mapMargin, setMapMargin] = useState(1);
  const sosIntervalRef = useRef<any>(null);

  // Helper to calculate bearing
  const calculateBearing = (start: LatLng, end: LatLng) => {
    const startLat = (start.latitude * Math.PI) / 180;
    const startLng = (start.longitude * Math.PI) / 180;
    const endLat = (end.latitude * Math.PI) / 180;
    const endLng = (end.longitude * Math.PI) / 180;

    const y = Math.sin(endLng - startLng) * Math.cos(endLat);
    const x =
      Math.cos(startLat) * Math.sin(endLat) -
      Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
    const bearing = (Math.atan2(y, x) * 180) / Math.PI;
    return (bearing + 360) % 360;
  };

  // 15-Second Automatic Update for Testing
  useEffect(() => {
    if (!isSimulating || routeCoords.length < 2) return;

    let subRouteIndex = 0;
    const interval = setInterval(() => {
        // Move to the next meaningful point in the route every 15 seconds
        // We take a skip to make the movement visible
        const nextIndex = Math.min(subRouteIndex + 5, routeCoords.length - 1);
        
        if (nextIndex === subRouteIndex) {
            clearInterval(interval);
            setIsSimulating(false);
            return;
        }

        const nextPos = routeCoords[nextIndex];
        const prevPos = routeCoords[subRouteIndex];

        // Animate marker to next position
        (driverAnimatedLocation as any).timing({
            ...nextPos,
            duration: 2000, // Smooth transition over 2 seconds
            useNativeDriver: false,
        }).start();

        // Update heading
        const bearing = calculateBearing(prevPos, nextPos);
        setMarkerRotation(bearing);
        setCurrentLocation(nextPos);

        // Auto-follow camera
        if (mapRef.current) {
            mapRef.current.animateCamera({
                center: nextPos,
                pitch: 45,
                heading: bearing,
                zoom: 17,
            }, { duration: 2000 });
        }

        subRouteIndex = nextIndex;
        if (subRouteIndex >= routeCoords.length - 1) {
            clearInterval(interval);
            setIsSimulating(false);
            showAlert({
              title: "Testing Info",
              message: "Driver has reached the pickup location.",
              singleButton: true,
              icon: 'information-circle-outline',
            });
        }
    }, 15000); // 15 seconds interval

    return () => clearInterval(interval);
  }, [isSimulating, routeCoords, driverAnimatedLocation]);

  // SOS Location Tracking Effect
  useEffect(() => {
    if (isSosActive && sosId) {
      sosIntervalRef.current = setInterval(() => {
        Geolocation.getCurrentPosition(
          async (position) => {
            try {
              await axiosInstance.post('/sos/location', {
                sos_id: sosId,
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              });
              console.log('SOS Location updated:', position.coords);
            } catch (error) {
              console.error('Failed to update SOS location:', error);
            }
          },
          (error) => console.error('SOS Geolocation error:', error),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
      }, 5000); // Update every 5 seconds
    } else {
      if (sosIntervalRef.current) {
        clearInterval(sosIntervalRef.current);
        sosIntervalRef.current = null;
      }
    }

    return () => {
      if (sosIntervalRef.current) clearInterval(sosIntervalRef.current);
    };
  }, [isSosActive, sosId]);

  const handleSosPress = () => {
    if (isSosActive) {
      showAlert({
        title: t('resolve_sos') || 'Resolve SOS?',
        message: t('resolve_sos_message') || 'Are you safe now? This will stop the emergency tracking.',
        confirmText: t('i_am_safe') || 'I am Safe',
        cancelText: t('cancel') || 'Cancel',
        onConfirm: handleSosResolve,
      });
    } else {
      showAlert({
        title: t('emergency_alert') || 'Emergency Alert!',
        message: t('trigger_sos_confirmation') || 'Are you sure you want to trigger SOS? This will alert the admin and your trusted contacts.',
        confirmText: t('trigger_now') || 'Trigger Now',
        cancelText: t('cancel') || 'Cancel',
        onConfirm: async () => {
          try {
            const response = await axiosInstance.post('/sos/trigger', {
              trip_id: ride.trip_id || ride.id,
            });
            if (response.data.success) {
              setIsSosActive(true);
              setSosId(response.data.data.id);
              Linking.openURL('tel:112');
            }
          } catch (error) {
            showAlert({
              title: 'Error',
              message: 'Failed to trigger SOS. Please call 112 manually.',
              singleButton: true,
              icon: 'alert-circle-outline',
            });
            console.error('SOS Trigger error:', error);
          }
        },
      });
    }
  };

  const handleSosResolve = async () => {
    try {
      if (sosId) {
        await axiosInstance.post('/sos/resolve', { sos_id: sosId });
      }
      setIsSosActive(false);
      setSosId(null);
      showAlert({
        title: t('sos_resolved') || 'SOS Resolved',
        message: t('glad_you_are_safe') || 'We are glad you are safe.',
        singleButton: true,
        icon: 'checkmark-circle-outline',
      });
    } catch (error) {
      console.error('SOS Resolve error:', error);
      // Fallback: resolution failed on server but we stop tracking locally
      setIsSosActive(false);
      setSosId(null);
    }
  };

  const onDirectionsReady = (result: any) => {
    setRouteCoords(result.coordinates);
    setDistance(result.distance);
    setDuration(result.duration);

    // Initial camera fit
    if (mapRef.current) {
        mapRef.current.fitToCoordinates(result.coordinates, {
            edgePadding: {
                top: 100,
                right: 50,
                bottom: 300,
                left: 50,
            },
            animated: true,
        });
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar animated={false} barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={[styles.map, { marginBottom: mapMargin }]}
        onMapReady={() => setMapMargin(0)}
        initialRegion={{
          latitude: initialLocation.latitude || 0,
          longitude: initialLocation.longitude || 0,
          latitudeDelta: initialLocation.latitude ? 0.05 : 100,
          longitudeDelta: initialLocation.longitude ? 0.05 : 100,
        }}
        showsUserLocation={true} 
        followsUserLocation={false}
        rotateEnabled={true}
      >
        {/* Manual Blue Dot Fallback removed as showsUserLocation is now fixed for Fabric */}

        <MapViewDirections
          origin={currentLocation}
          destination={destination}
          apikey={GOOGLE_MAPS_API_KEY}
          strokeWidth={5}
          strokeColor={theme.colors.primary}
          optimizeWaypoints={true}
          onReady={onDirectionsReady}
        />

        {/* <Marker.Animated
          coordinate={driverAnimatedLocation as any}
          rotation={markerRotation}
          anchor={{ x: 0.5, y: 0.5 }}
          flat
        >
          <View style={[styles.driverMarker, { backgroundColor: theme.colors.primary }]}>
            <MaterialCommunityIcons name="car-sports" size={ms(24)} color="#FFF" />
          </View>
        </Marker.Animated> */}

        <Marker coordinate={destination} title="Pickup Location">
             <View style={styles.pickupMarker}>
                <Ionicons name="location" size={ms(30)} color={theme.colors.error || "#FF4B4B"} />
             </View>
        </Marker>
      </MapView>

      {/* Navigation UI Overlays */}
      <View style={[styles.topOverlay, { top: insets.top + vs(10) }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={ms(24)} color={theme.colors.text} />
        </TouchableOpacity>
        
        <View style={styles.infoPill}>
          <Text style={styles.infoText}>
            {distance.toFixed(1)} km • {Math.ceil(duration)} min
          </Text>
        </View>
      </View>

      <View style={[styles.bottomCard, { paddingBottom: insets.bottom + vs(20) }]}>
        <View style={styles.handle} />
        <View style={styles.tripHeader}>
            <View>
                <Text style={styles.title}>{t('navigating_to_pickup') || 'Navigating to Pickup'}</Text>
                <Text style={styles.subtitle}>{ride.pickup_address || '123 Test St, City Center'}</Text>
            </View>
            <TouchableOpacity 
                style={[styles.sosButton, isSosActive && styles.sosButtonActive]} 
                onLongPress={handleSosPress}
            >
                <Text style={styles.sosText}>
                    {isSosActive ? (t('active_sos') || 'ACTIVE SOS') : (t('sos') || 'SOS')}
                </Text>
            </TouchableOpacity>
        </View>
        
        <View style={styles.statsRow}>
            <View style={styles.stat}>
                <Text style={styles.statLabel}>{t('eta') || 'ETA'}</Text>
                <Text style={styles.statValue}>{Math.ceil(duration)} min</Text>
            </View>
            <View style={styles.stat}>
                <Text style={styles.statLabel}>{t('distance') || 'Distance'}</Text>
                <Text style={styles.statValue}>{distance.toFixed(1)} km</Text>
            </View>
        </View>

        <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => setIsSimulating(!isSimulating)}
        >
          <Text style={styles.actionText}>
            {isSimulating ? "Stop Simulation" : "Start 15s Simulation"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
    ...StyleSheet.absoluteFillObject,
  },
  driverMarker: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  pickupMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  topOverlay: {
    position: 'absolute',
    left: ms(20),
    right: ms(20),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  backButton: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(22),
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  infoPill: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: ms(15),
    paddingVertical: vs(8),
    borderRadius: ms(20),
  },
  infoText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: ms(14),
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderTopLeftRadius: ms(24),
    borderTopRightRadius: ms(24),
    padding: ms(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  handle: {
    width: ms(40),
    height: vs(4),
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: vs(15),
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: vs(20),
  },
  title: {
    fontSize: ms(18),
    fontWeight: '700',
    color: '#1E293B',
  },
  subtitle: {
    fontSize: ms(13),
    color: '#64748B',
    marginTop: vs(2),
  },
  sosButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: ms(12),
    paddingVertical: vs(6),
    borderRadius: ms(8),
  },
  sosButtonActive: {
    backgroundColor: '#991B1B',
    paddingHorizontal: ms(20),
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  sosText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: ms(12),
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: vs(15),
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: vs(20),
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: ms(12),
    color: '#64748B',
    marginBottom: vs(4),
  },
  statValue: {
    fontSize: ms(16),
    fontWeight: '700',
    color: '#1E293B',
  },
  actionButton: {
    height: vs(54),
    borderRadius: ms(12),
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    color: '#FFF',
    fontSize: ms(16),
    fontWeight: '600',
  },
});

export default NavigationScreen;
