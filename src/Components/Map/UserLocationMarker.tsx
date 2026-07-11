import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Marker, LatLng } from 'react-native-maps';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { mS as ms } from '../../lib/scale';
import { useAppTheme } from '../../context/ThemeContext';

interface UserLocationMarkerProps {
  coordinate: LatLng;
  heading?: number | null;
}

const UserLocationMarker: React.FC<UserLocationMarkerProps> = ({ coordinate, heading }) => {
  const { theme } = useAppTheme();
  const [trackChanges, setTrackChanges] = useState(true);

  // Allow enough time for marker to render before disabling trackChanges to avoid disappearing on Android
  useEffect(() => {
    setTrackChanges(true);
    const timer = setTimeout(() => {
      setTrackChanges(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [coordinate.latitude, coordinate.longitude, heading]);

  const rotation = heading !== null && heading !== undefined ? `${heading}deg` : '0deg';

  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      flat={true}
      zIndex={99}
      tracksViewChanges={trackChanges}
    >
      <View style={styles.container}>
        {/* Car Marker Body */}
        <View style={[styles.markerBody, { transform: [{ rotate: rotation }] }]}>
          <View style={[styles.carContainer, { backgroundColor: theme.colors.primary }]}>
            <MaterialCommunityIcons name="car-sports" size={ms(20)} color="#FFFFFF" />
          </View>
          {/* Directional small arrow */}
          <View style={[styles.directionArrow, { borderBottomColor: theme.colors.primary }]} />
        </View>
      </View>
    </Marker>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: ms(50),
    height: ms(50),
  },
  markerBody: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  carContainer: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(16),
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  directionArrow: {
    position: 'absolute',
    top: -ms(8),
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
});

export default UserLocationMarker;
