import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';

import { Text } from '../../Components';
import AppStatusBar from '../../Components/AppStatusBar';
import { useAppTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { useHaptic } from '../../hooks/useHaptic';
import { setUser } from '../../redux/userSlice';
import socketService from '../../service/socketService';
import {
  useRequestVideoKycMutation,
  useCancelVideoKycMutation,
  useLazyGetVideoKycStatusQuery,
} from '../../service/driverApi';
import { VideoKYCCall_Nav } from '../../Navigations/navigations';
import { requestVideoKycPermissions, goToSettings } from '../../utils/permissionUtils';

const VideoKYCWaitingScreen = ({ navigation }: any) => {
  const { colors, fonts } = useTheme() as any;
  const { isDark, theme } = useAppTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { triggerHaptic } = useHaptic();
  const dispatch = useDispatch();

  const user = useSelector((state: any) => state.userSlice.user);

  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [estimatedWaitMinutes, setEstimatedWaitMinutes] = useState<number>(3);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const [requestVideoKyc] = useRequestVideoKycMutation();
  const [cancelVideoKyc, { isLoading: isCancelling }] = useCancelVideoKycMutation();
  const [getVideoKycStatus] = useLazyGetVideoKycStatusQuery();

  const hasNavigatedRef = useRef(false);

  // Radar Pulse Animation
  const pulseAnim1 = useRef(new Animated.Value(0)).current;
  const pulseAnim2 = useRef(new Animated.Value(0)).current;
  const pulseAnim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createPulse = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const pulse1 = createPulse(pulseAnim1, 0);
    const pulse2 = createPulse(pulseAnim2, 800);
    const pulse3 = createPulse(pulseAnim3, 1600);

    pulse1.start();
    pulse2.start();
    pulse3.start();

    return () => {
      pulse1.stop();
      pulse2.stop();
      pulse3.stop();
    };
  }, [pulseAnim1, pulseAnim2, pulseAnim3]);

  // Request Video KYC on screen load
  useEffect(() => {
    let isMounted = true;

    const initializeKyc = async () => {
      // 1. Verify Camera & Microphone Permissions
      const perms = await requestVideoKycPermissions();
      if (!perms.allGranted) {
        Alert.alert(
          t('permission_required', 'Permissions Required'),
          t('video_kyc_permission_required', 'Camera and microphone permissions are required for Video KYC.'),
          [
            { text: t('cancel', 'Cancel'), onPress: () => navigation.goBack(), style: 'cancel' },
            { text: t('go_to_settings', 'Settings'), onPress: () => { goToSettings(); navigation.goBack(); } },
          ]
        );
        return;
      }

      if (!user?.driverId) {
        showToast({ message: 'Driver ID not found', type: 'error' });
        navigation.goBack();
        return;
      }

      // 🛡️ Ensure socket is authenticated and connected to driver rooms
      socketService.connect(user.driverId, 'DRIVER');
      socketService.joinDriverRoom(user.driverId);

      try {
        setIsInitializing(true);

        // 2. REST API Request
        const res = await requestVideoKyc({ driverId: user.driverId }).unwrap();
        if (isMounted) {
          const sid = res?.sessionId || res?.data?.sessionId || `kyc_${user.driverId}_${Date.now()}`;
          setSessionId(sid);
          if (res?.position) setQueuePosition(res.position);

          dispatch(setUser({ onboarding_status: 'VIDEO_KYC_WAITING' }));

          // 3. Join session rooms & emit socket event
          socketService.joinKycSession(sid, user.driverId);
          socketService.emitKycRequest(user.driverId);
          setIsInitializing(false);
        }
      } catch (err: any) {
        console.warn('Video KYC request error (fallback to local session):', err);
        if (isMounted) {
          const sid = `kyc_${user.driverId}_${Date.now()}`;
          setSessionId(sid);
          setQueuePosition(1);
          socketService.joinKycSession(sid, user.driverId);
          socketService.emitKycRequest(user.driverId);
          setIsInitializing(false);
        }
      }
    };

    initializeKyc();

    return () => {
      isMounted = false;
    };
  }, [user?.driverId]);

  // 2. Admin Accepted Callback -> Transition to Call
  const handleCallAccepted = useCallback((data: {
    sessionId: string;
    channelName: string;
    token: string;
    uid: number;
    adminName?: string;
  }) => {
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;

    triggerHaptic(HapticFeedbackTypes.notificationSuccess);
    showToast({
      message: `${data.adminName || t('video_kyc_officer', 'KYC Officer')} has connected!`,
      type: 'success',
    });

    dispatch(setUser({ onboarding_status: 'VIDEO_KYC_IN_PROGRESS' }));

    navigation.replace(VideoKYCCall_Nav, {
      sessionId: data.sessionId || sessionId,
      channelName: data.channelName,
      token: data.token,
      uid: data.uid,
      adminName: data.adminName,
    });
  }, [navigation, sessionId, dispatch, triggerHaptic, showToast, t]);

  // 3. Socket Listeners
  useEffect(() => {
    // Queue Update Listener
    const handleQueueUpdate = (data: { position: number; estimatedWaitSeconds: number }) => {
      if (data?.position !== undefined) {
        setQueuePosition(data.position);
      }
      if (data?.estimatedWaitSeconds) {
        setEstimatedWaitMinutes(Math.max(1, Math.ceil(data.estimatedWaitSeconds / 60)));
      }
    };

    socketService.onKycQueueUpdate(handleQueueUpdate);
    socketService.onKycCallAccepted(handleCallAccepted);

    return () => {
      socketService.offKycQueueUpdate(handleQueueUpdate);
      socketService.offKycCallAccepted(handleCallAccepted);
    };
  }, [handleCallAccepted]);

  // 4. ⚡ Fail-Safe Polling: Poll session status every 2 seconds to guarantee transition even if socket drops
  useEffect(() => {
    if (!user?.driverId) return;

    let isMounted = true;
    const pollInterval = setInterval(async () => {
      if (hasNavigatedRef.current || !isMounted) return;

      try {
        const res = await getVideoKycStatus({ driverId: user.driverId }).unwrap();
        const statusData = res?.data || res;
        if (!hasNavigatedRef.current && statusData?.status === 'IN_CALL' && statusData?.channelName && statusData?.token) {
          console.log('⚡ [VideoKYCWaiting] Detected IN_CALL status via polling! Transitioning to call screen...');
          handleCallAccepted({
            sessionId: statusData.sessionId || sessionId || '',
            channelName: statusData.channelName,
            token: statusData.token,
            uid: statusData.uid || 0,
            adminName: statusData.adminName,
          });
        } else if (statusData?.position !== undefined && isMounted) {
          setQueuePosition(statusData.position);
        }
      } catch (e) {
        // Silently ignore polling hiccups
      }
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [user?.driverId, sessionId, handleCallAccepted, getVideoKycStatus]);

  // Handle Cancel Request
  const handleCancel = () => {
    Alert.alert(
      t('video_kyc_cancel', 'Cancel Request'),
      t('video_kyc_cancel_confirm', 'Are you sure you want to cancel your Video KYC request?'),
      [
        { text: t('no', 'No'), style: 'cancel' },
        {
          text: t('yes', 'Yes'),
          style: 'destructive',
          onPress: async () => {
            try {
              if (sessionId && user?.driverId) {
                await cancelVideoKyc({ sessionId, driverId: user.driverId }).unwrap();
                socketService.emitKycCancel(sessionId);
              }
            } catch (e) {
              console.warn('Cancel KYC error:', e);
            }
            dispatch(setUser({ onboarding_status: 'DOCS_SUBMITTED' }));
            navigation.goBack();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <AppStatusBar />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleCancel}
          style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {t('video_kyc_title', 'Video KYC Verification')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* RADAR PULSE SECTION */}
        <View style={styles.radarContainer}>
          {[pulseAnim1, pulseAnim2, pulseAnim3].map((anim, idx) => (
            <Animated.View
              key={idx}
              style={[
                styles.pulseCircle,
                {
                  borderColor: colors.primary,
                  transform: [
                    {
                      scale: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.8, 2.4],
                      }),
                    },
                  ],
                  opacity: anim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.8, 0.4, 0],
                  }),
                },
              ]}
            />
          ))}

          <View style={[styles.centerIconCircle, { backgroundColor: colors.primary }]}>
            <Ionicons name="videocam" size={36} color="#FFF" />
          </View>
        </View>

        {/* STATUS TEXT */}
        <Text style={[styles.connectingTitle, { color: colors.text }]}>
          {t('video_kyc_connecting', 'Connecting you with a verification officer...')}
        </Text>

        {isInitializing ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.loadingText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
              Initializing secure session...
            </Text>
          </View>
        ) : (
          /* QUEUE METRICS CARD */
          <View style={[styles.metricsCard, { backgroundColor: isDark ? theme.colors.card : '#F8FAFC', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0' }]}>
            <View style={styles.metricItem}>
              <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                <Ionicons name="people" size={20} color="#2563EB" />
              </View>
              <Text style={[styles.metricLabel, { color: isDark ? '#9CA3AF' : '#64748B' }]}>
                {t('video_kyc_queue_position', 'Queue Position')}
              </Text>
              <Text style={[styles.metricValue, { color: colors.text }]}>
                #{queuePosition !== null ? queuePosition : 1}
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0' }]} />

            <View style={styles.metricItem}>
              <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                <Ionicons name="time" size={20} color="#F59E0B" />
              </View>
              <Text style={[styles.metricLabel, { color: isDark ? '#9CA3AF' : '#64748B' }]}>
                {t('video_kyc_est_wait', 'Estimated Wait')}
              </Text>
              <Text style={[styles.metricValue, { color: colors.text }]}>
                ~{estimatedWaitMinutes} {t('video_kyc_minutes', 'mins')}
              </Text>
            </View>
          </View>
        )}

        {/* TIPS CARD */}
        <View style={[styles.tipsCard, { backgroundColor: isDark ? theme.colors.card : '#F0FDF4', borderColor: isDark ? 'rgba(34, 197, 94, 0.2)' : '#BBF7D0' }]}>
          <View style={styles.tipsHeader}>
            <Ionicons name="shield-checkmark" size={20} color="#16A34A" />
            <Text style={[styles.tipsTitle, { color: isDark ? '#86EFAC' : '#15803D' }]}>
              {t('video_kyc_tips_title', 'Tips While You Wait')}
            </Text>
          </View>

          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
            <Text style={[styles.tipText, { color: isDark ? '#D1D5DB' : '#374151' }]}>
              {t('video_kyc_tip_docs', 'Keep your original Driving License & PAN Card ready')}
            </Text>
          </View>

          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
            <Text style={[styles.tipText, { color: isDark ? '#D1D5DB' : '#374151' }]}>
              {t('video_kyc_tip_light', 'Sit in a well-lit area with a clear background')}
            </Text>
          </View>

          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
            <Text style={[styles.tipText, { color: isDark ? '#D1D5DB' : '#374151' }]}>
              {t('video_kyc_tip_internet', 'Ensure a stable internet connection')}
            </Text>
          </View>

          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
            <Text style={[styles.tipText, { color: isDark ? '#D1D5DB' : '#374151' }]}>
              {t('video_kyc_tip_permissions', 'Keep camera & microphone permissions enabled')}
            </Text>
          </View>
        </View>

        {/* CANCEL BUTTON */}
        <TouchableOpacity
          style={[styles.cancelBtn, { borderColor: isDark ? 'rgba(239, 68, 68, 0.4)' : '#FECACA' }]}
          onPress={handleCancel}
          disabled={isCancelling}
          activeOpacity={0.8}
        >
          {isCancelling ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <>
              <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
              <Text style={styles.cancelText}>
                {t('video_kyc_cancel', 'Cancel Request')}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default VideoKYCWaitingScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  radarContainer: {
    width: 220,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  pulseCircle: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
  },
  centerIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  connectingTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 13,
  },
  metricsCard: {
    width: '100%',
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginVertical: 16,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  divider: {
    width: 1,
    height: '80%',
    alignSelf: 'center',
  },
  tipsCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  tipText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  cancelText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
});

