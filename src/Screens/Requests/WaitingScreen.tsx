import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  BackHandler,
  Switch,
  Modal,
  Linking,
  TouchableWithoutFeedback,
  ImageBackground,
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
import { useStartReturnTripMutation, useToggleDayHaltMutation } from '../../service/driverApi';
import { useLocationTracker } from '../../hooks/useLocationTracker';
import SwipeButton from '../Dashboard/dashComponents/SwipeButton';
import { mS as ms, vS as vs } from '../../lib/scale';
import { ChatScreen_Nav, HelpCenter_Nav } from '../../Navigations/navigations';
import { setCurrentRide } from '../../redux/rideSlice';
import LinearGradient from 'react-native-linear-gradient';

const WaitingScreen = ({ route }: any) => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { theme, isDark } = useAppTheme();
  const { showAlert } = useAlert();
  const { triggerHaptic } = useHaptic();
  const dispatch = useDispatch();

  const rideFromStore = useSelector((state: RootState) => state.ride.currentRide);
  const ride = rideFromStore || route?.params?.ride || {};
  const trip_id = ride?.trip_id || ride?.id;
  const user = useSelector((state: RootState) => state.userSlice?.user);

  const [startReturnTripApi, { isLoading }] = useStartReturnTripMutation();
  const [toggleDayHaltApi, { isLoading: isToggling }] = useToggleDayHaltMutation();

  const [waitingSeconds, setWaitingSeconds] = useState(0);
  const [isDayHaltModalVisible, setIsDayHaltModalVisible] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isTripDetailsModalVisible, setIsTripDetailsModalVisible] = useState(false);
  const [isReturnTripModalVisible, setIsReturnTripModalVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isOutstationRoundTrip = ride?.ride_type === 'OUTSTATION_ROUND_TRIP';
  const isDayHalt = ride?.trip_status === 'DAY_HALT';

  useLocationTracker({
    driverId: user?.driverId,
    isTracking: !isDayHalt,
    tripId: trip_id,
    mode: 'idle',
  });

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

  const handleSwipeSuccess = () => {
    setIsReturnTripModalVisible(true);
  };

  const confirmReturnTrip = () => {
    setIsReturnTripModalVisible(false);
    handleStartReturnTrip();
  };

  const handleToggleChange = (value: boolean) => {
    if (value) {
      setIsDayHaltModalVisible(true);
    } else {
      toggleDayHalt(false);
    }
  };

  const toggleDayHalt = async (is_day_halt: boolean) => {
    try {
      if (!trip_id) return;
      const result = await toggleDayHaltApi({ tripId: trip_id.toString(), is_day_halt }).unwrap();
      if (result?.data) {
        dispatch(setCurrentRide(result.data));
      }
      setIsDayHaltModalVisible(false);
      triggerHaptic?.(HapticFeedbackTypes.notificationSuccess);
    } catch (error: any) {
      triggerHaptic?.(HapticFeedbackTypes.notificationError);
      showAlert({
        title: t('error'),
        message: error?.data?.message || t('failed_to_update', 'Failed to update. Please try again.'),
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
      userPhone: ride?.phone || ride?.passenger_phone || ride?.user_details?.phone_number || ride?.passenger_details?.phone,
    });
  };

  const handleCallPress = () => {
    const phone = ride?.phone || ride?.passenger_phone || ride?.user_details?.phone_number || ride?.passenger_details?.phone;
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    } else {
      showAlert({
        title: t('error') || 'Error',
        message: t('phone_number_not_found') || 'Passenger phone number is not available.',
        singleButton: true,
      });
    }
  };

  const handleHelpCenter = () => {
    setShowMenu(false);
    navigation.navigate(HelpCenter_Nav);
  };

  const handleViewTrip = () => {
    setShowMenu(false);
    setIsTripDetailsModalVisible(true);
  };

  return (
    <ImageBackground 
      source={require('../../assets/images/map6.png')} 
      style={styles.backgroundContainer}
      resizeMode="cover"
    >
      <LinearGradient 
        colors={isDark ? ['rgba(18, 18, 18, 0.8)', 'rgba(18, 18, 18, 1)'] : ['rgba(255, 255, 255, 0.75)', 'rgba(255, 255, 255, 1)']}
        style={styles.gradientOverlay}
      >
        <SafeAreaView style={styles.safeArea}>
          <TouchableWithoutFeedback onPress={() => showMenu && setShowMenu(false)}>
            <View style={styles.container}>
              
              <View style={styles.headerContainer}>
                <TouchableOpacity style={styles.iconBtnMinimal} onPress={() => {}}>
                  {/* Empty space for balance */}
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                  <View style={[styles.statusBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                    <View style={[styles.dotIndicator, { backgroundColor: theme.colors.primary }]} />
                    <Text style={[styles.statusText, { color: theme.colors.primary }]}>{t('waiting', 'Waiting')}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setShowMenu(!showMenu)} style={styles.iconBtnMinimal}>
                  <Ionicons name="ellipsis-vertical" size={ms(24)} color={theme.colors.text} />
                </TouchableOpacity>
              </View>

              {showMenu && (
                <View style={[styles.dropdownMenu, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                  <TouchableOpacity style={styles.dropdownItem} onPress={handleViewTrip}>
                    <Ionicons name="map-outline" size={ms(20)} color={theme.colors.text} />
                    <Text style={[styles.dropdownText, { color: theme.colors.text }]}>{t('view_trip', 'View Trip')}</Text>
                  </TouchableOpacity>
                  <View style={[styles.dropdownDivider, { backgroundColor: theme.colors.border }]} />
                  <TouchableOpacity style={styles.dropdownItem} onPress={handleHelpCenter}>
                    <Ionicons name="help-circle-outline" size={ms(20)} color={theme.colors.text} />
                    <Text style={[styles.dropdownText, { color: theme.colors.text }]}>{t('help_center', 'Help Center')}</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.content}>
                
                <View style={[styles.mainCard, { 
                  backgroundColor: isDark ? 'rgba(30, 30, 30, 0.7)' : 'rgba(255, 255, 255, 0.9)', 
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  shadowColor: isDark ? '#000' : '#888' 
                }]}>
                  <View style={styles.timerHeader}>
                    <Ionicons name="hourglass-outline" size={ms(20)} color={theme.colors.primary} />
                    <Text style={[styles.timerTitle, { color: theme.colors.text }]}>
                      {t('waiting_at_destination', 'Waiting at Destination')}
                    </Text>
                  </View>

                  <Text style={[styles.timerValue, { color: theme.colors.primary }]}>
                    {formatTime(waitingSeconds)}
                  </Text>
                  <Text style={[styles.timerLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                    {t('waiting_time', 'ELAPSED TIME')}
                  </Text>

                  <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]} />

                  <View style={styles.riderInfoCompact}>
                    <View style={styles.riderAvatar}>
                      <Ionicons name="person" size={ms(20)} color={theme.colors.primary} />
                    </View>
                    <View style={styles.riderDetails}>
                      <Text style={[styles.riderName, { color: theme.colors.text }]} numberOfLines={1}>
                        {ride?.passenger_details?.name || ride?.user_details?.full_name || t('rider')}
                      </Text>
                      <Text style={[styles.riderSub, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                        {t('contact_rider_if_needed', 'Contact if needed')}
                      </Text>
                    </View>
                    <View style={styles.actionButtons}>
                      <TouchableOpacity onPress={handleCallPress} style={styles.compactBtn}>
                        <Ionicons name="call" size={ms(20)} color="#10B981" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleChatPress} style={styles.compactBtn}>
                        <Ionicons name="chatbubble-ellipses" size={ms(20)} color={theme.colors.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {isOutstationRoundTrip && (
                    <View style={[styles.toggleContainer, { backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)' }]}>
                      <View style={styles.toggleTextContainer}>
                        <Text style={[styles.toggleTitle, { color: theme.colors.text }]}>
                          {t('day_halt', 'Day Halt')}
                        </Text>
                        <Text style={[styles.toggleSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                          {t('day_halt_desc', 'Pause trip for the day')}
                        </Text>
                      </View>
                      <Switch
                        trackColor={{ false: '#767577', true: theme.colors.primary }}
                        thumbColor="#f4f3f4"
                        ios_backgroundColor="#3e3e3e"
                        onValueChange={handleToggleChange}
                        value={isDayHalt}
                        style={{ transform: [{ scale: 0.9 }] }}
                      />
                    </View>
                  )}
                </View>

              </View>

              <View style={styles.footer}>
                {isLoading ? (
                  <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginVertical: vs(20) }} />
                ) : isDayHalt ? (
                  <View style={styles.dayHaltActiveContainer}>
                    <Ionicons name="pause" size={ms(20)} color="#EAB308" />
                    <Text style={[styles.dayHaltActiveText, { color: '#EAB308' }]}>
                      {t('day_halt_active', 'Day Halt Active - Return Disabled')}
                    </Text>
                  </View>
                ) : (
                  <SwipeButton
                    title={t('start_return_trip', 'Swipe to Start Return')}
                    onSwipeSuccess={handleSwipeSuccess}
                  />
                )}
              </View>

            </View>
          </TouchableWithoutFeedback>

          {/* Return Trip Confirmation Modal */}
          <Modal
            visible={isReturnTripModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setIsReturnTripModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContentCompact, { backgroundColor: theme.colors.card }]}>
                <View style={[styles.modalIconWrapper, { backgroundColor: theme.colors.primary + '15' }]}>
                  <Ionicons name="arrow-undo-circle" size={ms(40)} color={theme.colors.primary} />
                </View>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                  {t('confirm_return', 'Start Return Trip?')}
                </Text>
                <Text style={[styles.modalDesc, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                  {t('confirm_return_desc', 'Are you sure you want to start the return trip? This action cannot be undone.')}
                </Text>
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.modalBtnSecondary, { borderColor: theme.colors.border }]}
                    onPress={() => setIsReturnTripModalVisible(false)}
                  >
                    <Text style={[styles.modalBtnText, { color: theme.colors.text }]}>{t('cancel', 'Cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.modalBtnPrimary, { backgroundColor: theme.colors.primary }]}
                    onPress={confirmReturnTrip}
                  >
                    <Text style={[styles.modalBtnText, { color: '#fff' }]}>{t('confirm', 'Confirm')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* Trip Details Modal */}
          <Modal
            visible={isTripDetailsModalVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setIsTripDetailsModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
                <View style={[styles.modalIconWrapper, { backgroundColor: theme.colors.primary + '20' }]}>
                  <Ionicons name="map" size={ms(32)} color={theme.colors.primary} />
                </View>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                  {t('trip_details', 'Trip Details')}
                </Text>
                <View style={{ width: '100%', marginBottom: vs(24), gap: vs(16) }}>
                    <View style={styles.tripDetailRow}>
                       <Ionicons name="location" size={ms(20)} color={theme.colors.primary} style={{ marginTop: vs(2) }} />
                       <View style={{ flex: 1, marginLeft: ms(12) }}>
                         <Text style={{fontSize: ms(12), color: isDark ? '#9CA3AF' : '#6B7280'}}>{t('pickup', 'Pickup Location')}</Text>
                         <Text style={{fontSize: ms(14), color: theme.colors.text, fontWeight: '600', marginTop: vs(2)}}>{ride?.pickup_address || t('na', 'N/A')}</Text>
                       </View>
                    </View>
                    <View style={styles.tripDetailRow}>
                       <Ionicons name="pin" size={ms(20)} color="#F43F5E" style={{ marginTop: vs(2) }} />
                       <View style={{ flex: 1, marginLeft: ms(12) }}>
                         <Text style={{fontSize: ms(12), color: isDark ? '#9CA3AF' : '#6B7280'}}>{t('drop', 'Drop Location')}</Text>
                         <Text style={{fontSize: ms(14), color: theme.colors.text, fontWeight: '600', marginTop: vs(2)}}>{ride?.drop_address || t('na', 'N/A')}</Text>
                       </View>
                    </View>
                </View>
                <TouchableOpacity
                    style={[styles.modalBtn, styles.modalBtnPrimary, { backgroundColor: theme.colors.primary, width: '100%' }]}
                    onPress={() => setIsTripDetailsModalVisible(false)}
                >
                    <Text style={[styles.modalBtnText, { color: '#fff' }]}>{t('close', 'Close')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Day Halt Modal */}
          <Modal
            visible={isDayHaltModalVisible}
            transparent
            animationType="slide"
            onRequestClose={() => !isToggling && setIsDayHaltModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
                <View style={[styles.modalIconWrapper, { backgroundColor: theme.colors.primary + '20' }]}>
                  <Ionicons name="pause-circle" size={ms(40)} color={theme.colors.primary} />
                </View>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                  {t('confirm_day_halt', 'Confirm Day Halt')}
                </Text>
                <Text style={[styles.modalDesc, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                  {t('confirm_day_halt_desc', 'Turning on day halt will pause location sharing and hold the trip until you resume.')}
                </Text>
                
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.modalBtnSecondary, { borderColor: theme.colors.border }]}
                    onPress={() => setIsDayHaltModalVisible(false)}
                    disabled={isToggling}
                  >
                    <Text style={[styles.modalBtnText, { color: theme.colors.text }]}>{t('cancel', 'Cancel')}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.modalBtnPrimary, { backgroundColor: theme.colors.primary }]}
                    onPress={() => toggleDayHalt(true)}
                    disabled={isToggling}
                  >
                    {isToggling ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={[styles.modalBtnText, { color: '#fff' }]}>{t('confirm', 'Confirm')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

        </SafeAreaView>
      </LinearGradient>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: ms(20),
    paddingTop: vs(12),
    paddingBottom: vs(8),
  },
  iconBtnMinimal: {
    width: ms(40),
    height: ms(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ms(12),
    paddingVertical: vs(6),
    borderRadius: ms(20),
    gap: ms(6),
  },
  dotIndicator: {
    width: ms(8),
    height: ms(8),
    borderRadius: ms(4),
  },
  statusText: {
    fontSize: ms(13),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dropdownMenu: {
    position: 'absolute',
    top: vs(60),
    right: ms(20),
    width: ms(160),
    borderRadius: ms(12),
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 100,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: ms(12),
    gap: ms(10),
  },
  dropdownText: {
    fontSize: ms(14),
    fontWeight: '500',
  },
  dropdownDivider: {
    height: 1,
    width: '100%',
  },
  content: {
    flex: 1,
    paddingHorizontal: ms(20),
    justifyContent: 'center',
  },
  mainCard: {
    width: '100%',
    borderRadius: ms(24),
    padding: ms(20),
    borderWidth: 1,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
    alignItems: 'center',
  },
  timerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
    marginBottom: vs(16),
  },
  timerTitle: {
    fontSize: ms(18),
    fontWeight: '700',
  },
  timerValue: {
    fontSize: ms(56),
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    lineHeight: ms(64),
  },
  timerLabel: {
    fontSize: ms(12),
    fontWeight: '600',
    marginTop: vs(4),
    marginBottom: vs(24),
    letterSpacing: 1,
  },
  divider: {
    width: '100%',
    height: 1,
    marginBottom: vs(20),
  },
  riderInfoCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: vs(8),
  },
  riderAvatar: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(22),
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: ms(12),
  },
  riderDetails: {
    flex: 1,
    paddingRight: ms(8),
  },
  riderName: {
    fontSize: ms(16),
    fontWeight: '700',
    marginBottom: vs(2),
  },
  riderSub: {
    fontSize: ms(12),
  },
  actionButtons: {
    flexDirection: 'row',
    gap: ms(8),
  },
  compactBtn: {
    width: ms(38),
    height: ms(38),
    borderRadius: ms(19),
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: ms(14),
    borderRadius: ms(16),
    marginTop: vs(16),
  },
  toggleTextContainer: {
    flex: 1,
    paddingRight: ms(12),
  },
  toggleTitle: {
    fontSize: ms(15),
    fontWeight: '600',
    marginBottom: vs(2),
  },
  toggleSubtitle: {
    fontSize: ms(13),
  },
  footer: {
    paddingHorizontal: ms(20),
    paddingBottom: vs(30),
    paddingTop: vs(10),
    width: '100%',
  },
  dayHaltActiveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: ms(16),
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    borderRadius: ms(30),
    gap: ms(8),
  },
  dayHaltActiveText: {
    fontSize: ms(15),
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContentCompact: {
    width: '85%',
    borderRadius: ms(24),
    padding: ms(24),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalContent: {
    width: '100%',
    borderTopLeftRadius: ms(24),
    borderTopRightRadius: ms(24),
    padding: ms(24),
    alignItems: 'center',
    position: 'absolute',
    bottom: 0,
  },
  modalIconWrapper: {
    width: ms(64),
    height: ms(64),
    borderRadius: ms(32),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(16),
  },
  modalTitle: {
    fontSize: ms(20),
    fontWeight: '700',
    marginBottom: vs(12),
    textAlign: 'center',
  },
  modalDesc: {
    fontSize: ms(15),
    textAlign: 'center',
    marginBottom: vs(24),
    lineHeight: vs(22),
  },
  modalActions: {
    flexDirection: 'row',
    gap: ms(12),
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    height: vs(50),
    borderRadius: ms(25),
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnSecondary: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  modalBtnPrimary: {
  },
  modalBtnText: {
    fontSize: ms(16),
    fontWeight: '600',
  },
  tripDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
});

export default WaitingScreen;
