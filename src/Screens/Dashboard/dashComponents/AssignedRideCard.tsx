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
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useHaptic } from '../../../hooks/useHaptic';
import { useTranslation } from 'react-i18next';
import { Text } from '../../../Components';
import SoundPlayer from 'react-native-sound-player';
import LinearGradient from 'react-native-linear-gradient';
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
  noVibrate?: boolean;
};

type Props = {
  item: RideItem;
  onAccept: () => void;
  onReject: () => void;
};

/* ================= HELPERS / COMPONENTS ================= */

const TripTypeBadge = ({ type }: { type: string }) => {
  let color = '#3b82f6'; 
  let bgColor = '#eff6ff';

  if (type === 'OUTSTATION') {
    color = '#8b5cf6'; 
    bgColor = '#f5f3ff';
  } else if (type === 'RENTAL') {
    color = '#f59e0b'; 
    bgColor = '#fffbeb';
  }

  return (
    <View style={[styles.tripTypeBadge, { backgroundColor: bgColor, borderColor: color }]}>
      <Text style={[styles.tripTypeText, { color: color }]} numberOfLines={1}>{type}</Text>
    </View>
  );
};

/* ================= COMPONENT ================= */
const AssignedRideCard: React.FC<Props> = ({ item, onAccept, onReject }) => {
  const { theme, isDark } = useAppTheme();
  const slideAnim = useRef(new RNAnimated.Value(SCREEN_WIDTH)).current;
  const scaleAnim = useRef(new RNAnimated.Value(0.8)).current;
  const { triggerHaptic } = useHaptic();
  const { t } = useTranslation();
  const [showCancel, setShowCancel] = useState(false);

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

  // Pulse animation for the "ASSIGNED" badge
  const badgePulse = useRef(new RNAnimated.Value(1)).current;
  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(badgePulse, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
        RNAnimated.timing(badgePulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, [badgePulse]);

  /* ---------- SOUND + VIBRATION ---------- */
  /* ---------- SOUND + VIBRATION ---------- */
  useEffect(() => {
    // User requested NO vibration for assigned request card show
    if (item.noVibrate) {
      console.log('Skipping initial alert for notification ride');
      return;
    }

    const playSound = () => {
      try {
        SoundPlayer.playSoundFile('notification', 'mp3');
        // Vibration.vibrate([0, 500, 200, 500], true); // Disabled as per user request
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
    triggerHaptic(HapticFeedbackTypes.impactHeavy);
    onAccept();
  }, [onAccept, triggerHaptic]);

  const handleReject = useCallback(() => {
    SoundPlayer.stop();
    Vibration.cancel();
    triggerHaptic(HapticFeedbackTypes.impactLight);
    onReject();
  }, [onReject, triggerHaptic]);

  return (
    <RNAnimated.View
      style={[
        styles.cardWrapper,
        {
          transform: [
            { translateX: slideAnim },
            { scale: scaleAnim },
          ],
          marginBottom: vs(16),
        },
      ]}
    >
      <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
        {/* PREMIUM HEADER */}
        <LinearGradient
          colors={['#4338CA', '#312E81']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.cardHeaderGradient}
        >
          <View style={styles.cardHeader}>
            <View style={{ flex: 1, marginRight: s(10) }}>
              <View style={styles.assignmentLabelRow}>
                <Ionicons name="ribbon" size={ms(16)} color="#FBBF24" style={{ marginRight: s(4) }} />
                <Text style={styles.assignmentLabelText} numberOfLines={1}>EXCLUSIVE ASSIGNMENT</Text>
              </View>
              <Text style={styles.cardHeaderText} numberOfLines={2}>New Direct Request</Text>
              <View style={styles.badgeRow}>
                {item.ride_type && <TripTypeBadge type={item.ride_type} />}
                <View style={styles.priorityTag}>
                  <Text style={styles.priorityTagText} numberOfLines={1}>HIGH PRIORITY</Text>
                </View>
              </View>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.price}>{item.price}</Text>
              <RNAnimated.View style={{ transform: [{ scale: badgePulse }] }}>
                 <View style={styles.assignedBadge}>
                    <Text style={styles.assignedBadgeText} numberOfLines={1}>ASSIGNED</Text>
                 </View>
              </RNAnimated.View>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.contentPadding}>
          {/* PASSENGER INFO */}
          <View style={styles.passengerRow}>
            <View style={[styles.avatar, isDark && { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <Ionicons name="person" size={s(20)} color="#818CF8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.passengerName, { color: theme.colors.text }]}>{item.passenger || 'Passenger'}</Text>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={ms(12)} color="#FBBF24" />
                <Text style={[styles.ratingText, isDark && { color: theme.colors.textMuted }]}>{item.rating || '5.0'}</Text>
              </View>
            </View>
            <View style={styles.confirmedBadge}>
               <Ionicons name="shield-checkmark" size={ms(14)} color="#10B981" />
               <Text style={styles.confirmedText} numberOfLines={1}>VERIFIED</Text>
            </View>
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
               <View style={styles.infoIconContainer}>
                  <Ionicons name="navigate-outline" size={ms(20)} color="#818CF8" />
               </View>
              <View style={{ marginLeft: s(8) }}>
                <Text style={styles.infoLabel}>{t('distance_label')}</Text>
                <Text style={[styles.infoValue, { color: theme.colors.text }]}>{item.distance || '—'}</Text>
              </View>
            </View>

            <View style={[styles.infoCard, isDark && { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
               <View style={styles.infoIconContainer}>
                  <Ionicons name="time-outline" size={ms(20)} color="#FBBF24" />
               </View>
              <View style={{ marginLeft: s(8) }}>
                <Text style={styles.infoLabel}>{t('eta_caps')}</Text>
                <Text style={[styles.infoValue, { color: theme.colors.text }]}>{item.eta || '—'}</Text>
              </View>
            </View>
          </View>

          {/* ACTIONS */}
          <View style={styles.actionRow}>
            {!showCancel ? (
              <Pressable 
                style={styles.declineTrigger} 
                onPress={() => {
                  triggerHaptic(HapticFeedbackTypes.impactLight);
                  setShowCancel(true);
                }}
              >
                <Text style={styles.declineTriggerText}>{t('decline', 'Decline?')}</Text>
              </Pressable>
            ) : (
              <Pressable style={[styles.passBtn, isDark && { backgroundColor: theme.colors.card }]} onPress={handleReject}>
                <Ionicons name="close-circle" size={ms(22)} color="#EF4444" />
                <Text style={styles.passText}>{t('pass')}</Text>
              </Pressable>
            )}

            <Pressable style={[styles.acceptBtn, !showCancel && { flex: 1 }]} onPress={handleAccept}>
              <LinearGradient
                colors={['#4F46E5', '#3730A3']}
                style={styles.acceptGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="flash" size={ms(18)} color="#fff" />
                <Text style={styles.acceptText}>ACCEPT ASSIGNMENT</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </RNAnimated.View>
  );
};

export default AssignedRideCard;

const styles = StyleSheet.create({
  cardWrapper: { width: SCREEN_WIDTH - s(40), alignSelf: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: ms(8),
    overflow: 'hidden',
    elevation: 25,
    shadowColor: '#4F46E5',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 12 },
  },
  contentPadding: { padding: s(20) },
  cardHeaderGradient: { paddingHorizontal: s(20), paddingVertical: vs(24) },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  assignmentLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: vs(4) },
  assignmentLabelText: { fontSize: ms(10), color: '#FBBF24', fontWeight: '900', letterSpacing: 1 },
  cardHeaderText: { fontSize: getLanguageScaledSize(18), color: '#fff', fontWeight: '800' },
  price: { fontSize: ms(26), fontWeight: '900', color: '#fff', letterSpacing: s(-0.5) },
  badgeRow: { flexDirection: 'row', marginTop: vs(8), gap: s(8) },
  tripTypeBadge: { paddingHorizontal: s(10), paddingVertical: vs(4), borderRadius: ms(8), borderWidth: 1 },
  tripTypeText: { fontSize: ms(10), fontWeight: '800' },
  priorityTag: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: s(10), paddingVertical: vs(4), borderRadius: ms(8) },
  priorityTagText: { fontSize: ms(10), fontWeight: '700', color: '#fff' },
  assignedBadge: { backgroundColor: '#FBBF24', paddingHorizontal: s(12), paddingVertical: vs(4), borderRadius: ms(20), marginTop: vs(8) },
  assignedBadgeText: { fontSize: ms(10), fontWeight: '900', color: '#312E81' },
  passengerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: vs(16) },
  avatar: { width: s(44), height: s(44), borderRadius: ms(22), backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginRight: s(12), borderWidth: 1, borderColor: '#C7D2FE' },
  passengerName: { fontSize: getLanguageScaledSize(17), fontWeight: '800', color: '#1E1B4B' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: s(4), marginTop: vs(2) },
  ratingText: { fontSize: ms(13), color: '#64748B', fontWeight: '600' },
  confirmedBadge: { flexDirection: 'row', alignItems: 'center', gap: s(4), backgroundColor: '#ECFDF5', paddingHorizontal: s(8), paddingVertical: vs(4), borderRadius: ms(8) },
  confirmedText: { fontSize: ms(10), fontWeight: '800', color: '#10B981' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: vs(20) },
  locationRow: { flexDirection: 'row', marginBottom: vs(24) },
  locationIcons: { alignItems: 'center', marginRight: s(16), marginTop: vs(6) },
  pickupCircle: { width: s(12), height: s(12), backgroundColor: '#10B981', borderRadius: ms(6), borderWidth: 2, borderColor: '#fff' },
  locationLine: { width: 1.5, height: vs(34), backgroundColor: '#E2E8F0', marginVertical: vs(4) },
  dropCircle: { width: s(12), height: s(12), backgroundColor: '#F43F5E', borderRadius: ms(6), borderWidth: 2, borderColor: '#fff' },
  locationLabel: { fontSize: ms(11), color: '#94A3B8', fontWeight: '700' },
  locationAddress: { fontSize: getLanguageScaledSize(15), fontWeight: '700', color: '#1E293B', marginTop: vs(2) },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: vs(24), gap: s(12) },
  infoCard: { flex: 1, padding: s(10), borderRadius: ms(16), backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9', flexDirection: 'row', alignItems: 'center' },
  infoIconContainer: { width: s(36), height: s(36), borderRadius: ms(10), backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 2 },
  infoLabel: { fontSize: ms(10), color: '#94A3B8', fontWeight: '700' },
  infoValue: { fontSize: ms(13), fontWeight: '800', color: '#1E293B' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: s(12) },
  declineTrigger: {
    paddingHorizontal: s(12),
    paddingVertical: vs(8),
  },
  declineTriggerText: {
    color: '#94A3B8',
    fontSize: ms(13),
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  passBtn: { 
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    paddingHorizontal: s(16), 
    paddingVertical: vs(12), 
    borderRadius: ms(14), 
    backgroundColor: '#FEE2E2', 
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  passText: { color: '#EF4444', fontWeight: '800', fontSize: ms(13) },
  acceptBtn: {
    borderRadius: ms(18),
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  acceptGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: vs(18),
    width: '100%',
  },
  acceptText: {
    color: '#fff',
    fontSize: ms(12),
    fontWeight: '900',
    marginLeft: s(8),
    letterSpacing: 0.5,
  },
});
