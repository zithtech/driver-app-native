import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated as RNAnimated,
  Dimensions,
  Vibration,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useHaptic } from '../../../hooks/useHaptic';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Text } from '../../../Components';
import SoundPlayer from 'react-native-sound-player';
import { s, vs, ms } from '../../../lib/scale';
import { useAppTheme } from '../../../context/ThemeContext';
import { getLanguageScaledSize } from '../../../utils/languageSizings';

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
};

type Props = {
  item: RideItem;
  onAccept: () => void;
  onReject: () => void;
};

/* ================= COMPONENT ================= */
const RideAlertCard: React.FC<Props> = ({ item, onAccept, onReject }) => {
  const { theme, isDark } = useAppTheme();
  const slideAnim = useRef(new RNAnimated.Value(SCREEN_HEIGHT)).current; // Start from bottom
  const { triggerHaptic } = useHaptic();
  const insets = useSafeAreaInsets();
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
    RNAnimated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      damping: 22,
      stiffness: 110,
    }).start();

    triggerHaptic(HapticFeedbackTypes.notificationSuccess);
  }, [slideAnim, triggerHaptic]);

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
      } catch (e) {}
    };
  }, [item.noVibrate]);

  /* ---------- ACTIONS ---------- */
  const handleAccept = useCallback(() => {
    SoundPlayer.stop();
    Vibration.cancel();
    triggerHaptic(HapticFeedbackTypes.impactMedium);
    onAccept();
  }, [onAccept, triggerHaptic]);

  const handleReject = useCallback(() => {
    SoundPlayer.stop();
    Vibration.cancel();
    triggerHaptic(HapticFeedbackTypes.impactLight);
    onReject();
  }, [onReject, triggerHaptic]);

  /* ---------- AUTO EXPIRE ---------- */
  useEffect(() => {
    if (remaining <= 0) {
      handleReject();
    }
  }, [remaining, handleReject]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <RNAnimated.View
      style={[
        styles.cardWrapper,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={[styles.card, { backgroundColor: isDark ? theme.colors.card : '#FFFFFF' }]}>
        
        {/* DRAG HANDLE */}
        <View style={styles.dragHandleContainer}>
          <View style={styles.dragHandle} />
        </View>

        {/* HEADER BADGE & TIMER */}
        <View style={styles.headerTopRow}>
          <View style={styles.headerLeftSpacer} />
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>LIVE RIDE REQUEST</Text>
          </View>
          <View style={styles.headerRightSpacer}>
            <Text style={styles.timerText}>{formatTime(remaining)}</Text>
          </View>
        </View>

        {/* TITLE */}
        <Text style={[styles.mainTitle, isDark && { color: theme.colors.text }]}>New Ride Request!</Text>
        <Text style={styles.subTitle}>Please review and accept</Text>

        {/* INNER CONTENT BOX */}
        <View style={[styles.innerBox, isDark && { borderColor: theme.colors.border }]}>
          <View style={styles.innerBoxRow}>
            
            {/* LOCATIONS */}
            <View style={styles.locationsContainer}>
              <View style={styles.locationItem}>
                <View style={styles.pickupIcon}>
                  <View style={styles.pickupDot} />
                </View>
                <View style={styles.locationTextContainer}>
                  <Text style={styles.locationLabelPickup}>PICKUP</Text>
                  <Text style={[styles.addressText, isDark && { color: theme.colors.text }]} numberOfLines={1}>{item.pickup}</Text>
                  <Text style={styles.subAddressText} numberOfLines={1}>Pickup Location</Text>
                </View>
              </View>

              <View style={styles.dottedLineContainer}>
                {[...Array(4)].map((_, i) => (
                  <View key={i} style={styles.dot} />
                ))}
              </View>

              <View style={styles.locationItem}>
                <View style={styles.dropIcon}>
                  <View style={styles.dropDot} />
                </View>
                <View style={styles.locationTextContainer}>
                  <Text style={styles.locationLabelDrop}>DROP</Text>
                  <Text style={[styles.addressText, isDark && { color: theme.colors.text }]} numberOfLines={1}>{item.drop}</Text>
                  <Text style={styles.subAddressText} numberOfLines={1}>Drop Location</Text>
                </View>
              </View>
            </View>

            {/* ESTIMATED FARE */}
            <View style={[styles.fareContainer, isDark && { backgroundColor: theme.colors.background }]}>
              <Text style={[styles.farePrice, isDark && { color: theme.colors.text }]}>{item.price}</Text>
              <Text style={styles.fareLabel}>Estimated Fare</Text>
              <View style={[styles.rideTypeBadge, isDark && { backgroundColor: theme.colors.card }]}>
                <Ionicons name="car-outline" size={ms(12)} color={isDark ? theme.colors.text : "#0F172A"} />
                <Text style={[styles.rideTypeText, isDark && { color: theme.colors.text }]}>{item.ride_type || 'One-way'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* INFO ROW */}
        <View style={[styles.infoRowContainer, isDark && { borderColor: theme.colors.border }]}>
          <View style={styles.infoCol}>
            <View style={[styles.infoIconBg, { backgroundColor: isDark ? 'rgba(79, 70, 229, 0.2)' : '#EEF2FF' }]}>
              <MaterialCommunityIcons name="map-marker-distance" size={ms(18)} color="#4F46E5" />
            </View>
            <View style={styles.infoColText}>
              <Text style={[styles.infoVal, isDark && { color: theme.colors.text }]} numberOfLines={1}>{item.distance || '2.4 km'}</Text>
              <Text style={styles.infoLabel} numberOfLines={1}>Distance to pickup</Text>
            </View>
          </View>
          <View style={[styles.verticalDivider, isDark && { backgroundColor: theme.colors.border }]} />
          <View style={styles.infoCol}>
            <View style={[styles.infoIconBg, { backgroundColor: isDark ? 'rgba(5, 150, 105, 0.2)' : '#ECFDF5' }]}>
              <Ionicons name="time-outline" size={ms(18)} color="#059669" />
            </View>
            <View style={styles.infoColText}>
              <Text style={[styles.infoVal, isDark && { color: theme.colors.text }]} numberOfLines={1}>{item.eta || '6 min'}</Text>
              <Text style={styles.infoLabel} numberOfLines={1}>Est. time to pickup</Text>
            </View>
          </View>
          <View style={[styles.verticalDivider, isDark && { backgroundColor: theme.colors.border }]} />
          <View style={styles.infoCol}>
            <View style={[styles.infoIconBg, { backgroundColor: isDark ? 'rgba(234, 88, 12, 0.2)' : '#FFF7ED' }]}>
              <MaterialCommunityIcons name="source-commit" size={ms(18)} color="#EA580C" />
            </View>
            <View style={styles.infoColText}>
              <Text style={[styles.infoVal, isDark && { color: theme.colors.text }]} numberOfLines={1}>8.7 km</Text>
              <Text style={styles.infoLabel} numberOfLines={1}>Total trip distance</Text>
            </View>
          </View>
        </View>

        {/* PREFERRED TYPE */}
        <View style={styles.preferredRow}>
          <Ionicons name="shield-checkmark-outline" size={ms(16)} color="#059669" />
          <Text style={styles.preferredText}>This request is from your preferred ride type.</Text>
        </View>

        {/* ACTIONS */}
        <View style={styles.actionsContainer}>
          <Pressable style={[styles.declineBtn, isDark && { backgroundColor: theme.colors.background }]} onPress={handleReject}>
            <View style={[styles.iconCircleOutline, isDark && { borderColor: theme.colors.text }]}>
              <Ionicons name="close" size={ms(16)} color={isDark ? theme.colors.text : "#0F172A"} />
            </View>
            <Text style={[styles.declineBtnText, isDark && { color: theme.colors.text }]}>Decline</Text>
          </Pressable>

          <Pressable style={styles.acceptBtn} onPress={handleAccept}>
            <View style={styles.iconCircleFilled}>
              <Ionicons name="checkmark" size={ms(16)} color="#1D4ED8" />
            </View>
            <Text style={styles.acceptBtnText}>Accept Ride</Text>
          </Pressable>
        </View>

        {/* FOOTER */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>Auto-decline in {formatTime(remaining)}</Text>
        </View>

      </View>
    </RNAnimated.View>
  );
};

export default RideAlertCard;

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  cardWrapper: {
    marginHorizontal: s(8),
    marginBottom: vs(16),
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: ms(24),
    paddingTop: vs(12),
    paddingBottom: vs(24),
    paddingHorizontal: s(20),
    elevation: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  dragHandleContainer: {
    alignItems: 'center',
    marginBottom: vs(12),
  },
  dragHandle: {
    width: s(40),
    height: vs(4),
    backgroundColor: '#E2E8F0',
    borderRadius: ms(2),
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: vs(16),
  },
  headerLeftSpacer: {
    flex: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: s(12),
    paddingVertical: vs(6),
    borderRadius: ms(16),
  },
  liveDot: {
    width: s(6),
    height: s(6),
    borderRadius: ms(3),
    backgroundColor: '#2563EB',
    marginRight: s(6),
  },
  liveBadgeText: {
    color: '#2563EB',
    fontSize: ms(11),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerRightSpacer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  timerText: {
    color: '#1D4ED8',
    fontSize: ms(16),
    fontWeight: '700',
  },
  mainTitle: {
    fontSize: getLanguageScaledSize(22),
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: vs(4),
  },
  subTitle: {
    fontSize: getLanguageScaledSize(14),
    color: '#475569',
    textAlign: 'center',
    marginBottom: vs(20),
  },
  innerBox: {
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: ms(16),
    padding: s(16),
    marginBottom: vs(12),
  },
  innerBoxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  locationsContainer: {
    flex: 1,
    paddingRight: s(16),
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pickupIcon: {
    width: ms(20),
    height: ms(20),
    borderRadius: ms(10),
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: vs(2),
  },
  pickupDot: {
    width: ms(6),
    height: ms(6),
    borderRadius: ms(3),
    backgroundColor: '#FFF',
  },
  dropIcon: {
    width: ms(20),
    height: ms(20),
    borderRadius: ms(10),
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: vs(2),
  },
  dropDot: {
    width: ms(6),
    height: ms(6),
    borderRadius: ms(3),
    backgroundColor: '#FFF',
  },
  dottedLineContainer: {
    width: ms(20),
    alignItems: 'center',
    paddingVertical: vs(2),
    gap: vs(4),
  },
  dot: {
    width: ms(3),
    height: ms(3),
    borderRadius: ms(1.5),
    backgroundColor: '#94A3B8',
  },
  locationTextContainer: {
    flex: 1,
    marginLeft: s(12),
    justifyContent: 'center',
  },
  locationLabelPickup: {
    fontSize: ms(11),
    fontWeight: '800',
    color: '#059669',
    marginBottom: vs(2),
    letterSpacing: 0.5,
  },
  locationLabelDrop: {
    fontSize: ms(11),
    fontWeight: '800',
    color: '#DC2626',
    marginBottom: vs(2),
    letterSpacing: 0.5,
  },
  addressText: {
    fontSize: ms(14),
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: vs(2),
  },
  subAddressText: {
    fontSize: ms(12),
    color: '#64748B',
  },
  fareContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: ms(12),
    padding: s(14),
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: s(100),
  },
  farePrice: {
    fontSize: ms(20),
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: vs(4),
  },
  fareLabel: {
    fontSize: ms(11),
    color: '#64748B',
    marginBottom: vs(8),
  },
  rideTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: s(8),
    paddingVertical: vs(4),
    borderRadius: ms(12),
    gap: s(4),
  },
  rideTypeText: {
    fontSize: ms(10),
    fontWeight: '700',
    color: '#0F172A',
  },
  infoRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: ms(16),
    paddingVertical: vs(12),
    paddingHorizontal: s(8),
    marginBottom: vs(16),
  },
  infoCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(4),
  },
  infoIconBg: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(16),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: s(8),
  },
  infoColText: {
    flex: 1,
  },
  infoVal: {
    fontSize: ms(13),
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: vs(2),
  },
  infoLabel: {
    fontSize: ms(9),
    color: '#64748B',
  },
  verticalDivider: {
    width: 1,
    height: '80%',
    backgroundColor: '#F1F5F9',
  },
  preferredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(20),
    gap: s(6),
  },
  preferredText: {
    fontSize: ms(12),
    color: '#475569',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: s(12),
    marginBottom: vs(16),
  },
  declineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: vs(14),
    borderRadius: ms(24),
    gap: s(8),
  },
  iconCircleOutline: {
    width: ms(24),
    height: ms(24),
    borderRadius: ms(12),
    borderWidth: 1.5,
    borderColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineBtnText: {
    fontSize: ms(16),
    fontWeight: '700',
    color: '#0F172A',
  },
  acceptBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1D4ED8',
    paddingVertical: vs(14),
    borderRadius: ms(24),
    gap: s(8),
  },
  iconCircleFilled: {
    width: ms(24),
    height: ms(24),
    borderRadius: ms(12),
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptBtnText: {
    fontSize: ms(16),
    fontWeight: '700',
    color: '#FFF',
  },
  footerContainer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: ms(13),
    fontWeight: '600',
    color: '#1D4ED8',
  }
});