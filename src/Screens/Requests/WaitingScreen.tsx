import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useFocusEffect, StackActions } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../redux/store';
import { useAppTheme } from '../../context/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import { useHaptic } from '../../hooks/useHaptic';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useStartReturnTripMutation } from '../../service/driverApi';
import SwipeButton from '../Dashboard/dashComponents/SwipeButton';
import { mS as ms, vS as vs } from '../../lib/scale';
import { ChatScreen_Nav } from '../../Navigations/navigations';

const WaitingScreen = ({ route }: any) => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { theme, isDark } = useAppTheme();
  const { showAlert } = useAlert();
  const { triggerHaptic } = useHaptic();

  const rideFromStore = useSelector((state: RootState) => state.ride.currentRide);
  const ride = rideFromStore || route?.params?.ride || {};
  const trip_id = ride?.trip_id || ride?.id;
  const user = useSelector((state: RootState) => state.userSlice?.user);

  const [startReturnTripApi, { isLoading }] = useStartReturnTripMutation();

  const [waitingSeconds, setWaitingSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        showAlert({
          title: t('waiting'),
          message: t('cannot_go_back_waiting', 'You cannot go back while waiting for the round trip.'),
          singleButton: true,
          icon: 'information-circle-outline',
        });
        return true;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      navigation.setOptions({ gestureEnabled: false });
      return () => {
        subscription.remove();
        navigation.setOptions({ gestureEnabled: true });
      };
    }, [navigation, showAlert, t])
  );

  useEffect(() => {
    // Start local timer
    timerRef.current = setInterval(() => {
      setWaitingSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartReturnTrip = async () => {
    try {
      if (!trip_id) return;
      await startReturnTripApi(trip_id.toString()).unwrap();
      triggerHaptic?.(HapticFeedbackTypes.notificationSuccess);
      navigation.dispatch(StackActions.replace('ReturnTripMapScreen', { ride }));
    } catch (error: any) {
      triggerHaptic?.(HapticFeedbackTypes.notificationError);
      showAlert({
        title: t('error'),
        message: error?.data?.message || t('failed_to_start_return_trip', 'Failed to start the return trip. Please try again.'),
        singleButton: true,
        icon: 'alert-circle-outline',
      });
    }
  };

  const handleChatPress = () => {
    navigation.navigate(ChatScreen_Nav, {
      rideId: trip_id,
      userId: user?.driverId,
      userName: ride?.passenger_details?.name || ride?.user_details?.full_name || t('rider'),
      userImage: ride?.passenger_details?.image,
      userPhone: ride?.phone || ride?.passenger_phone,
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Ionicons name="time-outline" size={ms(60)} color={theme.colors.primary} />
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {t('waiting_at_destination', 'Waiting at Destination')}
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            {t('waiting_for_rider_return', 'Waiting for the rider to complete their work before returning.')}
          </Text>
        </View>

        <View style={[styles.timerContainer, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
          <Text style={[styles.timerLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            {t('waiting_time', 'Waiting Time')}
          </Text>
          <Text style={[styles.timerValue, { color: theme.colors.primary }]}>
            {formatTime(waitingSeconds)}
          </Text>
        </View>

        <View style={[styles.contactCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.riderInfo}>
                <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.primary + '20' }]}>
                    <Ionicons name="person" size={ms(24)} color={theme.colors.primary} />
                </View>
                <View style={styles.riderDetails}>
                    <Text style={[styles.riderName, { color: theme.colors.text }]}>
                        {ride?.passenger_details?.name || ride?.user_details?.full_name || t('rider')}
                    </Text>
                    <Text style={[styles.riderSub, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                        {t('contact_rider_if_needed', 'Contact rider if needed')}
                    </Text>
                </View>
            </View>
            <View style={styles.actionButtons}>
                <TouchableOpacity onPress={handleChatPress} style={[styles.iconBtn, { backgroundColor: theme.colors.primary + '15' }]}>
                    <Ionicons name="chatbubble-ellipses" size={ms(20)} color={theme.colors.primary} />
                </TouchableOpacity>
            </View>
        </View>

      </View>

      <View style={[styles.footer, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border }]}>
        {isLoading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} />
        ) : (
          <SwipeButton
            title={t('start_return_trip', 'Swipe to Start Return')}
            onSwipeSuccess={handleStartReturnTrip}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: ms(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: vs(40),
  },
  title: {
    fontSize: ms(24),
    fontWeight: '700',
    marginTop: vs(16),
    marginBottom: vs(8),
    textAlign: 'center',
  },
  subtitle: {
    fontSize: ms(16),
    textAlign: 'center',
    paddingHorizontal: ms(20),
  },
  timerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: vs(30),
    paddingHorizontal: ms(40),
    borderRadius: ms(20),
    marginBottom: vs(40),
    width: '100%',
  },
  timerLabel: {
    fontSize: ms(16),
    fontWeight: '600',
    marginBottom: vs(8),
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  timerValue: {
    fontSize: ms(48),
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: ms(16),
    borderRadius: ms(16),
    borderWidth: 1,
  },
  riderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarPlaceholder: {
    width: ms(48),
    height: ms(48),
    borderRadius: ms(24),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: ms(12),
  },
  riderDetails: {
    flex: 1,
  },
  riderName: {
    fontSize: ms(16),
    fontWeight: '700',
    marginBottom: vs(4),
  },
  riderSub: {
    fontSize: ms(14),
  },
  actionButtons: {
    flexDirection: 'row',
    gap: ms(12),
  },
  iconBtn: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: ms(20),
    paddingBottom: vs(30),
    paddingTop: vs(20),
    borderTopWidth: 1,
    width: '100%',
  },
});

export default WaitingScreen;
