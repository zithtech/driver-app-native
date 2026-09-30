import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated as RNAnimated,
  Dimensions,
  Vibration,
  Image,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useHaptic } from '../../../hooks/useHaptic';
import { useTranslation } from 'react-i18next';
import { Text } from '../../../Components';
import SoundPlayer from 'react-native-sound-player';
import { s, vs, ms } from '../../../lib/scale';
import { useAppTheme } from '../../../context/ThemeContext';

const SCREEN_HEIGHT = Dimensions.get('window').height;

/* ================= TYPES ================= */
export type RideItem = {
  id: string;
  trip_id: string;
  pickup: string;
  drop: string;
  price: string;
  remaining: number;
  distance?: string;
  eta?: string;
  ride_type?: string;
  notes?: string;
  passenger?: string;
  rating?: number;
  phone?: string;
  booking_type?: 'LIVE' | 'SCHEDULED';
  scheduled_start_time?: string;
  trip_status?: string;
  otp?: string;
  noVibrate?: boolean;
  trip_distance?: number | string;
  trip_time?: number | string;
  distance_to_pickup?: string;
  eta_to_pickup?: string;
  package_hours?: number | string;
};

type Props = {
  item: RideItem;
  onAccept: () => void;
  onReject: (isManual: boolean) => void;
  isMultiple?: boolean;
};

/* ================= COMPONENT ================= */
const CompactRideAlertCard: React.FC<Props> = ({ item, onAccept, onReject, isMultiple = false }) => {
  const { theme, isDark } = useAppTheme();
  const slideAnim = useRef(new RNAnimated.Value(300)).current;
  const fadeAnim = useRef(new RNAnimated.Value(0)).current;
  const { triggerHaptic } = useHaptic();
  const { t } = useTranslation();

  const [remaining, setRemaining] = useState(item.remaining || 28);

  // Countdown timer logic
  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  /* ---------- ENTRANCE ---------- */
  useEffect(() => {
    RNAnimated.parallel([
      RNAnimated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 110,
      }),
      RNAnimated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start();

    triggerHaptic(HapticFeedbackTypes.notificationSuccess);
  }, [slideAnim, fadeAnim, triggerHaptic]);

  /* ---------- SOUND + VIBRATION ---------- */
  useEffect(() => {
    if (item.noVibrate) return;
    const playSound = () => {
      try {
        SoundPlayer.setVolume(1.0);
        SoundPlayer.playSoundFile('incoming', 'mp3');
        SoundPlayer.setNumberOfLoops(-1);
        Vibration.vibrate([400, 600, 400], true);
      } catch (e) {
        console.log('SoundPlayer error:', e);
      }
    };
    playSound();
    return () => {
      try {
        SoundPlayer.stop();
        Vibration.cancel();
      } catch (e) { }
    };
  }, [item.noVibrate]);

  /* ---------- ACTIONS ---------- */
  const handleAccept = useCallback(() => {
    SoundPlayer.stop();
    Vibration.cancel();
    triggerHaptic(HapticFeedbackTypes.impactMedium);
    onAccept();
  }, [onAccept, triggerHaptic]);

  const handleReject = useCallback((isManual: boolean = false) => {
    SoundPlayer.stop();
    Vibration.cancel();
    if (isManual) triggerHaptic(HapticFeedbackTypes.impactLight);
    onReject(isManual);
  }, [onReject, triggerHaptic]);

  /* ---------- AUTO EXPIRE ---------- */
  useEffect(() => {
    if (remaining <= 0) {
      handleReject(false);
    }
  }, [remaining, handleReject]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isRoundTrip = item.ride_type === 'ROUND_TRIP' || item.ride_type === 'OUTSTATION_ROUND_TRIP';
  const tripDistanceNum = parseFloat(item.trip_distance?.toString() || '0');
  const displayDistance = isRoundTrip ? (tripDistanceNum * 2).toFixed(1) : (tripDistanceNum ? tripDistanceNum.toFixed(1) : '--');

  const tripTimeNum = parseFloat(item.trip_time?.toString() || '0');
  const displayTime = isRoundTrip ? (tripTimeNum * 2).toFixed(0) : (tripTimeNum ? tripTimeNum.toFixed(0) : '--');

  const pickupDistance = item.distance_to_pickup || item.distance || '--';
  const pickupTime = item.eta_to_pickup || item.eta || '--';

  // Split addresses for better display
  const pickupParts = (item.pickup || '').split(',').map(p => p.trim());
  const pickupMain = pickupParts[0] || item.pickup || 'Pickup';
  const pickupSub = pickupParts.length > 1 ? pickupParts.slice(1).join(', ') : 'Pickup Location';

  const dropParts = (item.drop || '').split(',').map(p => p.trim());
  const dropMain = dropParts[0] || item.drop || 'Drop';
  const dropSub = dropParts.length > 1 ? dropParts.slice(1).join(', ') : 'Drop Location';

  return (
    <RNAnimated.View
      style={[
        styles.cardWrapper,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={[styles.card, { backgroundColor: isDark ? theme.colors.card : '#FFFFFF' }]}>
        
        {/* HEADER ROW */}
        <View style={styles.headerRow}>
          <View style={styles.liveBadge}>
            <Ionicons name="flash" size={ms(12)} color="#FFFFFF" />
            <Text style={styles.liveBadgeText}>LIVE REQUEST</Text>
          </View>
          <View style={styles.timerBadge}>
            <Text style={styles.timerText}>{formatTime(remaining)}</Text>
          </View>
        </View>

        {/* BODY ROW */}
        <View style={styles.bodyRow}>
          {/* LEFT COL: CAR INFO */}
          <View style={styles.carCol}>
            <View style={[styles.carImageWrapper, isDark && { backgroundColor: theme.colors.background }]}>
              <Image source={require('../../../assets/images/car.png')} style={styles.carImage} resizeMode="contain" />
            </View>
            <Text style={[styles.carName, isDark && { color: theme.colors.text }]}>
               {item.ride_type === 'ROUND_TRIP' ? 'Round Trip' : item.ride_type === 'OUTSTATION_ROUND_TRIP' ? 'Outstation' : item.ride_type === 'ONE_WAY' ? 'One Way' : (item.ride_type || 'Mini')}
            </Text>
            <Text style={styles.carSeats}>4 Seater</Text>
          </View>

          {/* RIGHT COL: RIDE INFO */}
          <View style={styles.infoCol}>
            {/* PRICE */}
            <View style={styles.priceRow}>
              <Text style={[styles.priceText, isDark && { color: theme.colors.text }]}>{item.price}</Text>
              <Ionicons name="information-circle-outline" size={ms(16)} color="#64748B" style={{ marginLeft: s(4) }} />
            </View>
            
            {/* DISTANCE & TIME */}
            <View style={{ marginBottom: styles.distanceTimeText.marginBottom }}>
              <Text style={[styles.distanceTimeText, { marginBottom: 2 }]}>
                <Text style={{fontWeight: '700'}}>To Pickup: </Text>
                {pickupDistance} {String(pickupDistance).includes('km') ? '' : 'km'} • {pickupTime} {String(pickupTime).includes('min') ? '' : 'mins'}
              </Text>
              <Text style={styles.distanceTimeText}>
                <Text style={{fontWeight: '700'}}>Trip Total: </Text>
                {displayDistance} km • {displayTime} mins
              </Text>
            </View>

            {/* LOCATIONS */}
            <View style={styles.locationsContainer}>
              {/* Pickup */}
              <View style={styles.locationItem}>
                <View style={styles.pickupDot} />
                <View style={styles.locationTextWrapper}>
                  <Text style={[styles.locationMain, isDark && { color: theme.colors.text }]} numberOfLines={1}>{pickupMain}</Text>
                  <Text style={styles.locationSub} numberOfLines={1}>{pickupSub}</Text>
                </View>
              </View>

              {/* Line */}
              <View style={styles.connectingLine} />

              {/* Drop */}
              <View style={styles.locationItem}>
                <View style={styles.dropDot} />
                <View style={styles.locationTextWrapper}>
                  <Text style={[styles.locationMain, isDark && { color: theme.colors.text }]} numberOfLines={1}>{dropMain}</Text>
                  <Text style={styles.locationSub} numberOfLines={1}>{dropSub}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* FOOTER ACTIONS */}
        <View style={styles.actionsRow}>
          <Pressable style={[styles.btnCancel, isDark && { backgroundColor: theme.colors.background }]} onPress={() => handleReject(true)}>
            <View style={styles.cancelIconCircle}>
              <Ionicons name="close" size={ms(14)} color="#FFFFFF" />
            </View>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>

          <Pressable style={styles.btnAccept} onPress={handleAccept}>
            <Ionicons name="checkmark" size={ms(18)} color="#FFFFFF" style={{ marginRight: s(6) }} />
            <Text style={styles.acceptText}>Accept</Text>
          </Pressable>
        </View>

      </View>
    </RNAnimated.View>
  );
};

export default CompactRideAlertCard;

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  cardWrapper: {
    marginHorizontal: s(6),
    marginBottom: vs(8),
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: ms(12),
    padding: s(12),
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(8),
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF3B30',
    paddingHorizontal: s(8),
    paddingVertical: vs(2),
    borderRadius: ms(8),
    gap: s(4),
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: ms(10),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  timerBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: s(8),
    paddingVertical: vs(2),
    borderRadius: ms(6),
  },
  timerText: {
    color: '#EF4444',
    fontSize: ms(12),
    fontWeight: '700',
  },
  bodyRow: {
    flexDirection: 'row',
    marginBottom: vs(12),
  },
  carCol: {
    alignItems: 'center',
    marginRight: s(10),
  },
  carImageWrapper: {
    backgroundColor: '#F0F9FF',
    width: ms(50),
    height: ms(32),
    borderRadius: ms(8),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: vs(2),
  },
  carImage: {
    width: '80%',
    height: '80%',
  },
  carName: {
    fontSize: ms(13),
    fontWeight: '700',
    color: '#0F172A',
  },
  carSeats: {
    fontSize: ms(10),
    color: '#64748B',
  },
  infoCol: {
    flex: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
  },
  priceText: {
    fontSize: ms(18),
    fontWeight: '800',
    color: '#0F172A',
  },
  distanceTimeText: {
    fontSize: ms(12),
    color: '#475569',
    marginBottom: vs(4),
  },
  locationsContainer: {
    marginTop: vs(2),
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pickupDot: {
    width: ms(8),
    height: ms(8),
    borderRadius: ms(4),
    backgroundColor: '#22C55E',
    marginTop: vs(4),
    marginRight: s(6),
  },
  dropDot: {
    width: ms(8),
    height: ms(8),
    borderRadius: ms(4),
    backgroundColor: '#EF4444',
    marginTop: vs(4),
    marginRight: s(6),
  },
  connectingLine: {
    width: 1,
    height: vs(12),
    backgroundColor: '#CBD5E1',
    marginLeft: ms(3.5),
    marginVertical: vs(2),
  },
  locationTextWrapper: {
    flex: 1,
  },
  locationMain: {
    fontSize: ms(13),
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 0,
  },
  locationSub: {
    fontSize: ms(11),
    color: '#64748B',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: s(10),
  },
  btnCancel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: vs(10),
    borderRadius: ms(10),
    gap: s(4),
  },
  cancelIconCircle: {
    width: ms(16),
    height: ms(16),
    borderRadius: ms(8),
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: ms(14),
    fontWeight: '600',
    color: '#EF4444',
  },
  btnAccept: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: vs(10),
    borderRadius: ms(10),
  },
  acceptText: {
    fontSize: ms(14),
    fontWeight: '600',
    color: '#FFFFFF',
  },
});