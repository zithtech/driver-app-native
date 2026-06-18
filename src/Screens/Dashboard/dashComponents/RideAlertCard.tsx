import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated as RNAnimated,
  Dimensions,
  Vibration,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useHaptic } from '../../../hooks/useHaptic';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Text } from '../../../Components';
import SoundPlayer from 'react-native-sound-player';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { s, vs, ms } from '../../../lib/scale';
import { useAppTheme } from '../../../context/ThemeContext';
import { getLanguageScaledSize } from '../../../utils/languageSizings';

const SCREEN_WIDTH = Dimensions.get('window').width;

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

/* ================= HELPERS / COMPONENTS ================= */

const TripTypeBadge = ({ type }: { type: string }) => {
  let color = '#3b82f6'; // Local - Blue
  let bgColor = '#eff6ff';

  if (type === 'OUTSTATION') {
    color = '#8b5cf6'; // Purple
    bgColor = '#f5f3ff';
  } else if (type === 'RENTAL') {
    color = '#f59e0b'; // Amber
    bgColor = '#fffbeb';
  }

  return (
    <View style={[styles.tripTypeBadge, { backgroundColor: bgColor, borderColor: color }]}>
      <Text style={[styles.tripTypeText, { color: color }]}>{type}</Text>
    </View>
  );
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const CircularTimer = ({ remaining, total }: { remaining: number; total: number }) => {
  const size = s(44);
  const strokeWidth = ms(3);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = useSharedValue(remaining / total);

  useEffect(() => {
    progress.value = withTiming(remaining / total, {
      duration: 1000,
      easing: Easing.linear,
    });
  }, [remaining, total, progress]);

  const animatedProps = useAnimatedProps(() => {
    const strokeDashoffset = circumference * (1 - progress.value);
    return {
      strokeDashoffset,
    };
  });

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#fff"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          strokeLinecap="round"
          fill="transparent"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ position: 'absolute' }}>
        <Text style={{ color: '#fff', fontSize: ms(12), fontWeight: '800' }}>{remaining}</Text>
      </View>
    </View>
  );
};

/* ================= COMPONENT ================= */
const RideAlertCard: React.FC<Props> = ({ item, onAccept, onReject }) => {
  const { theme, isDark } = useAppTheme();
  const slideAnim = useRef(new RNAnimated.Value(SCREEN_WIDTH)).current;
  const scaleAnim = useRef(new RNAnimated.Value(0.8)).current; // Start slightly smaller
  const { triggerHaptic } = useHaptic();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();


  /* ---------- ENTRANCE ---------- */
  useEffect(() => {
    RNAnimated.parallel([
      RNAnimated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 18,
        stiffness: 120,
      }),
      RNAnimated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 15,
        stiffness: 100,
      }),
    ]).start();

    triggerHaptic(HapticFeedbackTypes.notificationSuccess);
  }, [slideAnim, scaleAnim, triggerHaptic]);

  // Pulse animation for header
  const headerPulse = useRef(new RNAnimated.Value(1)).current;
  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(headerPulse, { toValue: 1.05, duration: 800, useNativeDriver: true }),
        RNAnimated.timing(headerPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [headerPulse]);

  const totalTime = useRef(item.remaining || 15).current;

  /* ---------- SOUND + VIBRATION ---------- */
  useEffect(() => {
    if (item.noVibrate) {
        console.log('Skipping sound/vibration for notification-triggered ride');
        return;
    }

    const playSound = () => {
      try {
        SoundPlayer.playSoundFile('incoming', 'mp3');
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
      } catch (e) {
        console.log('Sound/Vibration stop error:', e);
      }
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
    if (item.remaining <= 0) {
      handleReject();
    }
  }, [item.remaining, handleReject]);



  return (
    <RNAnimated.View
      style={[
        styles.cardWrapper,
        {
          transform: [
            { translateX: slideAnim },
            { scale: scaleAnim },
          ],
          marginBottom: vs(16), // Use a standard small margin for multiple stacked cards
        },
      ]}
    >
      <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
        {/* HEADER */}
        <LinearGradient
          colors={['#0b2e61', '#1e40af']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.cardHeaderGradient}
        >
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <RNAnimated.View style={{ transform: [{ scale: headerPulse }] }}>
                <Text style={styles.cardHeaderText}>{t('new_ride_request')}</Text>
                <View style={styles.badgeRow}>
                  {item.ride_type && <TripTypeBadge type={item.ride_type} />}
                  <View style={styles.instantTag}>
                    <Text style={styles.instantTagText}>{item.booking_type || 'INSTANT'}</Text>
                  </View>
                </View>
              </RNAnimated.View>
            </View>

            <View style={{ alignItems: 'center', flexDirection: 'row', gap: s(15) }}>
              <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                <Text style={styles.price}>{item.price}</Text>
                {/* Surge removed for now as it's not in backend data yet */}
              </View>
              <CircularTimer remaining={item.remaining} total={totalTime} />
            </View>
          </View>
        </LinearGradient>

        {/* PASSENGER INFO */}
        <View style={styles.contentPadding}>
          <View style={styles.passengerRow}>
            <View style={[styles.avatar, isDark && { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <Ionicons name="person" size={s(20)} color={isDark ? '#60A5FA' : '#0b2e61'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.passengerName, { color: theme.colors.text }]}>{item.passenger || 'Passenger'}</Text>
              {item.rating && (
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={ms(12)} color="#f59e0b" />
                  <Text style={[styles.ratingText, isDark && { color: theme.colors.textMuted }]}>{item.rating}</Text>
                </View>
              )}
            </View>
            {/* Priority removed for now */}
          </View>

          <View style={[styles.divider, isDark && { backgroundColor: theme.colors.border }]} />

          {/* LOCATIONS */}
          <View style={styles.locationRow}>
            <View style={styles.locationIcons}>
              <View style={[styles.pickupCircle, isDark && { borderColor: theme.colors.card }]} />
              <View style={[styles.locationLine, isDark && { backgroundColor: theme.colors.border }]} />
              <View style={[styles.dropCircle, isDark && { borderColor: theme.colors.card }]} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.locationLabel}>{t('pickup_caps')}</Text>
              <Text style={[styles.locationAddress, { color: theme.colors.text }]}>{item.pickup}</Text>

              <Text style={[styles.locationLabel, { marginTop: vs(14) }]}>
                {t('drop_caps')}
              </Text>
              <Text style={[styles.locationAddress, { color: theme.colors.text }]}>{item.drop}</Text>
            </View>
          </View>

          {/* INFO */}
          <View style={styles.infoRow}>
            <View style={[styles.infoCard, isDark && { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <LinearGradient
                colors={isDark ? ['#1E1B4B', '#312E81'] : ['#E0E7FF', '#C7D2FE']}
                style={styles.infoIconBg}
              >
                <Ionicons name="navigate" size={ms(24)} color={isDark ? '#818CF8' : '#312E81'} />
              </LinearGradient>
              <View style={{ marginLeft: s(12) }}>
                <Text style={[styles.infoLabel, isDark && { color: '#6366F1' }]}>{t('distance_label')}</Text>
                <Text style={[styles.infoValue, { color: theme.colors.text }]}>{item.distance || '—'}</Text>
              </View>
            </View>

            <View style={[styles.infoCard, isDark && { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <LinearGradient
                colors={isDark ? ['#451A03', '#92400E'] : ['#FEF3C7', '#FDE68A']}
                style={styles.infoIconBg}
              >
                <Ionicons name="time" size={ms(24)} color={isDark ? '#FBBF24' : '#92400E'} />
              </LinearGradient>
              <View style={{ marginLeft: s(12) }}>
                <Text style={[styles.infoLabel, isDark && { color: '#F59E0B' }]}>{t('eta_caps')}</Text>
                <Text style={[styles.infoValue, { color: theme.colors.text }]}>{item.eta || '—'}</Text>
              </View>
            </View>
          </View>

          {/* PASSENGER MESSAGE */}
          {item.notes && (
            <View style={[styles.notesContainer, isDark && { backgroundColor: '#451A03', borderColor: '#92400E' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: vs(4) }}>
                <Ionicons name="chatbubble-ellipses" size={ms(14)} color={isDark ? '#FBBF24' : '#b45309'} style={{ marginRight: s(4) }} />
                <Text style={[styles.noteTitle, isDark && { color: '#FBBF24' }]}>Passenger Message:</Text>
              </View>
              <Text style={[styles.noteText, isDark && { color: '#FED7AA' }]}>{item.notes}</Text>
            </View>
          )}

          {/* ACTIONS */}
          <View style={styles.actionRow}>
            <Pressable style={[styles.passBtn, isDark && { backgroundColor: theme.colors.card }]} onPress={handleReject}>
              <Text style={[styles.passText, isDark && { color: theme.colors.textMuted }]}>{t('pass')}</Text>
            </Pressable>

            <Pressable style={styles.acceptBtn} onPress={handleAccept}>
              <LinearGradient
                colors={['#0b2e61', '#1e3a8a']}
                style={styles.acceptGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="checkmark-circle" size={ms(20)} color="#fff" />
                <Text style={styles.acceptText}>{t('accept_ride')}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </RNAnimated.View>
  );
};

export default RideAlertCard;

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  cardWrapper: { marginHorizontal: s(8) },

  card: {
    backgroundColor: '#fff',
    borderRadius: ms(12),
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
  },

  contentPadding: {
    padding: s(24),
  },

  cardHeaderGradient: {
    paddingHorizontal: s(26),
    paddingVertical: vs(24),
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  cardHeaderText: {
    fontSize: getLanguageScaledSize(14),
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: s(1.5),
  },

  price: {
    fontSize: ms(28),
    fontWeight: '900',
    color: '#fff',
    letterSpacing: s(-0.5),
  },

  badgeRow: { flexDirection: 'row', marginTop: vs(6), gap: s(8) },

  tripTypeBadge: {
    paddingHorizontal: s(10),
    paddingVertical: vs(4),
    borderRadius: ms(8),
    borderWidth: 1,
  },

  tripTypeText: { fontSize: ms(10), fontWeight: '800' },

  instantTag: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: s(10),
    paddingVertical: vs(4),
    borderRadius: ms(8),
  },

  instantTagText: { fontSize: ms(10), fontWeight: '700', color: '#fff' },

  surgeBadge: {
    marginTop: vs(4),
    backgroundColor: '#FEF3C7',
    paddingHorizontal: s(8),
    paddingVertical: vs(2),
    borderRadius: ms(6),
  },

  surgeText: { fontSize: ms(10), fontWeight: '800', color: '#92400E' },

  priorityText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 8,
  },

  priorityBadge: {
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(8),
    paddingVertical: vs(4),
    borderRadius: ms(6),
    gap: s(4),
  },

  priorityBadgeText: { fontSize: ms(9), fontWeight: '900', color: '#fff' },

  miniMap: { width: '100%', height: vs(90), borderRadius: ms(12), marginBottom: vs(10) },

  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: vs(16),
  },

  avatar: {
    width: s(44),
    height: s(44),
    borderRadius: ms(22),
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: s(12),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  passengerName: { fontSize: getLanguageScaledSize(17), fontWeight: '800', color: '#0F172A' },

  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: s(4), marginTop: vs(2) },

  ratingText: { fontSize: ms(13), color: '#64748B', fontWeight: '600' },

  divider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: vs(20) },

  locationRow: { flexDirection: 'row', marginBottom: vs(24) },

  locationIcons: { alignItems: 'center', marginRight: s(16), marginTop: vs(6) },

  pickupCircle: { width: s(12), height: s(12), backgroundColor: '#22C55E', borderRadius: ms(6), borderWidth: 2, borderColor: '#fff', elevation: 2 },

  locationLine: { width: 1.5, height: vs(34), backgroundColor: '#E2E8F0', marginVertical: vs(4) },

  dropCircle: { width: s(12), height: s(12), backgroundColor: '#EF4444', borderRadius: ms(6), borderWidth: 2, borderColor: '#fff', elevation: 2 },

  locationLabel: { fontSize: ms(11), color: '#94A3B8', fontWeight: '700' },

  locationAddress: { fontSize: getLanguageScaledSize(15), fontWeight: '700', color: '#1E293B', marginTop: vs(2) },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: vs(24), gap: s(12) },

  infoCard: {
    flex: 1,
    padding: s(12),
    borderRadius: ms(16),
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
  },

  infoIconBg: {
    width: s(52),
    height: s(52),
    borderRadius: ms(14),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },

  infoLabel: { fontSize: ms(10), color: '#64748B', fontWeight: '700' },

  infoValue: { fontSize: getLanguageScaledSize(14), fontWeight: '800', color: '#0F172A' },

  notesContainer: {
    padding: s(14),
    backgroundColor: '#FFFBEB',
    borderRadius: ms(16),
    borderWidth: 1,
    borderColor: '#FEF3C7',
    marginBottom: vs(24),
  },

  noteTitle: { fontSize: ms(12), fontWeight: '800', color: '#92400E' },

  noteText: { fontSize: ms(13), color: '#B45309', lineHeight: ms(18) },

  timerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: vs(14) },
  timerText: { marginLeft: s(6), fontSize: ms(12), color: '#b91c1c', fontWeight: '600' },

  actionRow: { flexDirection: 'row', justifyContent: 'space-between', gap: s(12) },

  passBtn: {
    width: '30%',
    paddingVertical: vs(16),
    borderRadius: ms(18),
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  passText: { color: '#64748B', fontWeight: '800', fontSize: ms(14) },

  acceptBtn: {
    width: '66%',
    borderRadius: ms(18),
    overflow: 'hidden',
  },

  acceptGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: vs(16),
    width: '100%',
  },

  acceptText: {
    color: '#fff',
    fontSize: getLanguageScaledSize(16),
    fontWeight: '700',
    marginLeft: s(6),
  },

  timerContainer: {
    marginBottom: 20,
    paddingHorizontal: 16,
  },

  progressBarContainer: {
    height: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },

  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
});
