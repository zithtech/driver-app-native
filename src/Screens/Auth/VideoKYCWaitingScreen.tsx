import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  BackHandler,
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
  useRetryVideoKycMutation,
  useTimeoutVideoKycToScheduleMutation,
  useLazyGetScheduledKycAppointmentQuery,
} from '../../service/driverApi';
import { VideoKYCCall_Nav, DocumentScreen_Nav } from '../../Navigations/navigations';
import { requestVideoKycPermissions, goToSettings } from '../../utils/permissionUtils';
import { useResponsive } from '../../lib/scale';

export type KycWaitingPhase =
  | 'INITIAL_WAIT'        // Phase 1: 01:00 -> 00:00 (Initial connection attempt)
  | 'AUTO_RETRY'          // Phase 2: 01:00 -> 00:00 (Automatic retry after 1 minute)
  | 'DECISION_CHOICE'     // After Attempt 2: Driver chooses between "Schedule KYC" and "Retry"
  | 'PENDING_SCHEDULING'  // Phase 3: Driver selected schedule -> Admin scheduling desk
  | 'SCHEDULED';          // Phase 4: Admin confirmed date & time slot

const WAIT_PHASE_DURATION_SECONDS = 60; // 1 minute per attempt
const TOTAL_WAIT_DURATION_SECONDS = 120; // 2 minutes total across 2 attempts

export interface ScheduledAppointmentData {
  date: string;
  startTime: string;
  endTime: string;
  adminName?: string;
  adminId?: string;
  slotId?: string;
}

const VideoKYCWaitingScreen = ({ navigation }: any) => {
  const { colors, fonts } = useTheme() as any;
  const { isDark, theme } = useAppTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { triggerHaptic } = useHaptic();
  const dispatch = useDispatch();
  const { rs, rvs, rms, cs, selectByDevice, isSmallDevice, isLargeDevice, isTablet } = useResponsive();

  const user = useSelector((state: any) => state.userSlice.user);

  // Workflow Phases & Countdown
  const [phase, setPhase] = useState<KycWaitingPhase>('INITIAL_WAIT');
  const [countdown, setCountdown] = useState<number>(WAIT_PHASE_DURATION_SECONDS); // 60s (1 min per phase)
  const [totalElapsed, setTotalElapsed] = useState<number>(0);
  const [scheduledAppointment, setScheduledAppointment] = useState<ScheduledAppointmentData | null>(null);

  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [estimatedWaitMinutes, setEstimatedWaitMinutes] = useState<number>(1);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // API Mutations & Queries
  const [requestVideoKyc] = useRequestVideoKycMutation();
  const [cancelVideoKyc, { isLoading: isCancelling }] = useCancelVideoKycMutation();
  const [retryVideoKyc] = useRetryVideoKycMutation();
  const [timeoutVideoKycToSchedule] = useTimeoutVideoKycToScheduleMutation();
  const [getVideoKycStatus] = useLazyGetVideoKycStatusQuery();
  const [getScheduledKycAppointment] = useLazyGetScheduledKycAppointmentQuery();

  const hasNavigatedRef = useRef(false);
  const isAutoRetryingRef = useRef(false);
  const isTimingOutRef = useRef(false);

  // Radar Pulse Animation (Phase 1 & 2)
  const pulseAnim1 = useRef(new Animated.Value(0)).current;
  const pulseAnim2 = useRef(new Animated.Value(0)).current;
  const pulseAnim3 = useRef(new Animated.Value(0)).current;

  // Desk Calendar Pulse (Phase 3 & 4)
  const deskPulseAnim = useRef(new Animated.Value(1)).current;

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

    // Subtle breathing pulse for scheduled desk icon
    const deskLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(deskPulseAnim, {
          toValue: 1.08,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(deskPulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    deskLoop.start();

    return () => {
      pulse1.stop();
      pulse2.stop();
      pulse3.stop();
      deskLoop.stop();
    };
  }, [pulseAnim1, pulseAnim2, pulseAnim3, deskPulseAnim]);

  // Transition to Agora RTC Call Screen
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

  // 1. Initial Video KYC Request
  useEffect(() => {
    let isMounted = true;

    const initializeKyc = async () => {
      // Camera & Mic Permissions
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

      // Connect socket & rooms
      socketService.connect(user.driverId, 'DRIVER');
      socketService.joinDriverRoom(user.driverId);

      try {
        setIsInitializing(true);

        const res = await requestVideoKyc({ driverId: user.driverId }).unwrap();
        if (isMounted) {
          const sid = res?.sessionId || res?.data?.sessionId || `kyc_${user.driverId}_${Date.now()}`;
          setSessionId(sid);
          if (res?.position) setQueuePosition(res.position);

          // Check if server returned already scheduled appointment
          if (res?.scheduledSlot || res?.data?.scheduledSlot) {
            const slot = res?.scheduledSlot || res?.data?.scheduledSlot;
            setScheduledAppointment({
              date: slot.date,
              startTime: slot.startTime,
              endTime: slot.endTime,
              adminName: slot.adminName,
              adminId: slot.adminId,
            });
            setPhase('SCHEDULED');
            dispatch(setUser({ onboarding_status: 'VIDEO_KYC_SCHEDULED' }));
          } else {
            setPhase('INITIAL_WAIT');
            setCountdown(WAIT_PHASE_DURATION_SECONDS);
            dispatch(setUser({ onboarding_status: 'VIDEO_KYC_WAITING' }));
          }

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
          setPhase('INITIAL_WAIT');
          setCountdown(WAIT_PHASE_DURATION_SECONDS);
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

  // 2. Automatic Retry Trigger (at 1-minute mark)
  const triggerAutoRetry = useCallback(async () => {
    if (isAutoRetryingRef.current) return;
    isAutoRetryingRef.current = true;

    setPhase('AUTO_RETRY');
    setCountdown(WAIT_PHASE_DURATION_SECONDS);
    triggerHaptic(HapticFeedbackTypes.notificationWarning);
    showToast({
      message: t('video_kyc_auto_retrying', 'Officers are busy. Retrying connection... (Attempt 2 of 2)'),
      type: 'info',
    });
    dispatch(setUser({ onboarding_status: 'VIDEO_KYC_RETRYING' }));

    try {
      if (sessionId && user?.driverId) {
        await retryVideoKyc({ sessionId, driverId: user.driverId }).unwrap();
        socketService.emitKycRetry(sessionId, user.driverId);
      }
    } catch (e) {
      console.log('Retry API fallback:', e);
      if (sessionId) {
        socketService.emitKycRetry(sessionId, user?.driverId);
      }
    } finally {
      isAutoRetryingRef.current = false;
    }
  }, [sessionId, user?.driverId, retryVideoKyc, dispatch, triggerHaptic, showToast, t]);

  // 3. Move to Scheduling Trigger (at 4-minute mark or manual choice)
  const triggerTimeoutToSchedule = useCallback(async () => {
    if (isTimingOutRef.current) return;
    isTimingOutRef.current = true;

    setPhase('PENDING_SCHEDULING');
    triggerHaptic(HapticFeedbackTypes.notificationWarning);
    showToast({
      message: t('video_kyc_scheduling_desk_title', 'Forwarded to Scheduling Desk'),
      type: 'info',
    });
    dispatch(setUser({ onboarding_status: 'VIDEO_KYC_PENDING_SCHEDULING' }));

    try {
      if (sessionId && user?.driverId) {
        await timeoutVideoKycToSchedule({ sessionId, driverId: user.driverId }).unwrap();
        socketService.emitKycTimeoutToSchedule(sessionId, user.driverId);
      }
    } catch (e) {
      console.log('Timeout to schedule fallback:', e);
      if (sessionId) {
        socketService.emitKycTimeoutToSchedule(sessionId, user?.driverId);
      }
    } finally {
      isTimingOutRef.current = false;
    }
  }, [sessionId, user?.driverId, timeoutVideoKycToSchedule, dispatch, triggerHaptic, showToast, t]);

  // 4. Decision Choice Trigger (after 2 attempts / 4 minutes total)
  const triggerDecisionChoice = useCallback(() => {
    setPhase('DECISION_CHOICE');
    triggerHaptic(HapticFeedbackTypes.notificationWarning);
    showToast({
      message: t('video_kyc_after_attempts_title', 'All Officers Are Currently Busy'),
      type: 'info',
    });
  }, [triggerHaptic, showToast, t]);

  // Driver selects Option 1: Schedule Video KYC Appointment
  const handleSelectSchedule = useCallback(async () => {
    await triggerTimeoutToSchedule();
  }, [triggerTimeoutToSchedule]);

  // Driver selects Option 2: Retry Live Call Now
  const handleSelectRetry = useCallback(async () => {
    triggerHaptic(HapticFeedbackTypes.impactMedium);
    setPhase('AUTO_RETRY');
    setCountdown(WAIT_PHASE_DURATION_SECONDS);
    showToast({
      message: t('video_kyc_auto_retrying', 'Auto-retrying connection...'),
      type: 'info',
    });
    dispatch(setUser({ onboarding_status: 'VIDEO_KYC_RETRYING' }));

    try {
      if (sessionId && user?.driverId) {
        await retryVideoKyc({ sessionId, driverId: user.driverId }).unwrap();
        socketService.emitKycRetry(sessionId, user.driverId);
      }
    } catch (e) {
      console.log('Retry API fallback:', e);
      if (sessionId) {
        socketService.emitKycRetry(sessionId, user?.driverId);
      }
    }
  }, [sessionId, user?.driverId, retryVideoKyc, dispatch, triggerHaptic, showToast, t]);

  // 5. Two-Stage Countdown Timer Effect
  useEffect(() => {
    if (isInitializing || phase === 'DECISION_CHOICE' || phase === 'PENDING_SCHEDULING' || phase === 'SCHEDULED' || hasNavigatedRef.current) {
      return;
    }

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (phase === 'INITIAL_WAIT') {
            triggerAutoRetry();
            return WAIT_PHASE_DURATION_SECONDS;
          } else if (phase === 'AUTO_RETRY') {
            // After Attempt 2: Show Decision Options (Schedule or Retry)
            triggerDecisionChoice();
            return 0;
          }
          return 0;
        }
        return prev - 1;
      });

      setTotalElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isInitializing, phase, triggerAutoRetry, triggerDecisionChoice]);

  // 5. Socket Listeners (Call Accepted + Appointment Scheduled)
  useEffect(() => {
    // Queue updates
    const handleQueueUpdate = (data: { position: number; estimatedWaitSeconds: number }) => {
      if (data?.position !== undefined) setQueuePosition(data.position);
      if (data?.estimatedWaitSeconds) {
        setEstimatedWaitMinutes(Math.max(1, Math.ceil(data.estimatedWaitSeconds / 60)));
      }
    };

    // Admin scheduled appointment listener
    const handleAppointmentScheduled = (data: any) => {
      if (!data) return;
      triggerHaptic(HapticFeedbackTypes.notificationSuccess);
      showToast({
        message: t('video_kyc_appointment_confirmed', 'Video KYC Appointment Confirmed!'),
        type: 'success',
      });
      setScheduledAppointment({
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        adminName: data.adminName || data.officerName,
        adminId: data.adminId,
        slotId: data.slotId,
      });
      setPhase('SCHEDULED');
      dispatch(setUser({ onboarding_status: 'VIDEO_KYC_SCHEDULED' }));
    };

    socketService.onKycQueueUpdate(handleQueueUpdate);
    socketService.onKycCallAccepted(handleCallAccepted);
    socketService.onKycAppointmentScheduled(handleAppointmentScheduled);

    return () => {
      socketService.offKycQueueUpdate(handleQueueUpdate);
      socketService.offKycCallAccepted(handleCallAccepted);
      socketService.offKycAppointmentScheduled(handleAppointmentScheduled);
    };
  }, [handleCallAccepted, dispatch, triggerHaptic, showToast, t]);

  // 6. Fail-Safe Polling (Status & Scheduled Slot Check)
  useEffect(() => {
    if (!user?.driverId) return;

    let isMounted = true;
    const pollInterval = setInterval(async () => {
      if (hasNavigatedRef.current || !isMounted) return;

      try {
        const res = await getVideoKycStatus({ driverId: user.driverId }).unwrap();
        const statusData = res?.data || res;

        // A. If officer accepted live call
        if (!hasNavigatedRef.current && statusData?.status === 'IN_CALL' && statusData?.channelName && statusData?.token) {
          handleCallAccepted({
            sessionId: statusData.sessionId || sessionId || '',
            channelName: statusData.channelName,
            token: statusData.token,
            uid: statusData.uid || 0,
            adminName: statusData.adminName,
          });
          return;
        }

        // B. If appointment has been scheduled by admin
        if (statusData?.status === 'SCHEDULED' || statusData?.scheduledSlot) {
          const slot = statusData?.scheduledSlot || statusData?.slot;
          if (slot && isMounted) {
            setScheduledAppointment({
              date: slot.date,
              startTime: slot.startTime,
              endTime: slot.endTime,
              adminName: slot.adminName || statusData.adminName,
              adminId: slot.adminId,
            });
            setPhase('SCHEDULED');
            dispatch(setUser({ onboarding_status: 'VIDEO_KYC_SCHEDULED' }));
          }
        } else if (statusData?.position !== undefined && isMounted) {
          setQueuePosition(statusData.position);
        }
      } catch (e) {
        // Silently ignore polling hiccups
      }
    }, 2500);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [user?.driverId, sessionId, handleCallAccepted, getVideoKycStatus, dispatch]);

  // Handle Cancel Request
  const handleCancel = useCallback(() => {
    if (phase === 'PENDING_SCHEDULING' || phase === 'SCHEDULED') {
      navigation.goBack();
      return;
    }

    Alert.alert(
      t('video_kyc_cancel', 'Cancel Request'),
      t('video_kyc_cancel_confirm', 'Are you sure you want to cancel your Video KYC request?'),
      [
        { text: t('no', 'No'), style: 'cancel' },
        {
          text: t('yes', 'Yes'),
          style: 'destructive',
          onPress: async () => {
            triggerHaptic(HapticFeedbackTypes.notificationWarning);
            try {
              if (sessionId && user?.driverId) {
                await cancelVideoKyc({ sessionId, driverId: user.driverId }).unwrap();
                socketService.emitKycCancel(sessionId, user.driverId);
              }
            } catch (e) {
              console.warn('Cancel KYC error:', e);
            }
            dispatch(setUser({ onboarding_status: 'DOCS_SUBMITTED' }));
            showToast({
              message: t('video_kyc_cancelled', 'Video KYC request cancelled'),
              type: 'info',
            });
            navigation.goBack();
          },
        },
      ]
    );
  }, [phase, sessionId, user?.driverId, cancelVideoKyc, dispatch, navigation, triggerHaptic, showToast, t]);

  // Hardware Back Button Listener (Android)
  useEffect(() => {
    const onBackPress = () => {
      handleCancel();
      return true; // prevent default back navigation
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [handleCancel]);

  // Format Countdown: mm:ss
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Determine if Scheduled Call is Ready (within 5 minutes of slot or active)
  const isCallReadyNow = useMemo(() => {
    if (!scheduledAppointment?.startTime) return false;
    try {
      // In production, compare with slot time; allow instant test join if within slot
      return false;
    } catch {
      return false;
    }
  }, [scheduledAppointment]);

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
          {phase === 'SCHEDULED'
            ? t('video_kyc_appointment_confirmed', 'Appointment Confirmed')
            : phase === 'PENDING_SCHEDULING'
              ? t('video_kyc_scheduling_desk_title', 'Scheduling Desk')
              : phase === 'DECISION_CHOICE'
                ? t('video_kyc_after_attempts_title', 'All Officers Are Busy')
                : t('video_kyc_title', 'Video KYC Verification')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ─── SCENARIO A: LIVE WAITING (PHASE 1 & PHASE 2) ─── */}
        {(phase === 'INITIAL_WAIT' || phase === 'AUTO_RETRY') && (
          <>
            {/* PHASE STATUS BADGE */}
            <View
              style={[
                styles.phaseBadge,
                {
                  backgroundColor: phase === 'INITIAL_WAIT'
                    ? (isDark ? 'rgba(37, 99, 235, 0.2)' : '#EFF6FF')
                    : (isDark ? 'rgba(245, 158, 11, 0.2)' : '#FFFBEB'),
                  borderColor: phase === 'INITIAL_WAIT' ? '#3B82F6' : '#F59E0B',
                },
              ]}
            >
              <View
                style={[
                  styles.phaseDot,
                  { backgroundColor: phase === 'INITIAL_WAIT' ? '#2563EB' : '#D97706' },
                ]}
              />
              <Text
                style={[
                  styles.phaseBadgeText,
                  { color: phase === 'INITIAL_WAIT' ? (isDark ? '#93C5FD' : '#1D4ED8') : (isDark ? '#FCD34D' : '#B45309') },
                ]}
              >
                {phase === 'INITIAL_WAIT'
                  ? `${t('video_kyc_initial_attempt', 'Attempt 1 of 2')} • ${t('waiting_for_officer', 'Waiting for Admin')}`
                  : `${t('video_kyc_retry_attempt', 'Attempt 2 of 2')} • ${t('video_kyc_auto_retrying', 'Auto-Retrying...')}`}
              </Text>
            </View>

            {/* RADAR PULSE SECTION */}
            <View style={styles.radarContainer}>
              {[pulseAnim1, pulseAnim2, pulseAnim3].map((anim, idx) => (
                <Animated.View
                  key={idx}
                  style={[
                    styles.pulseCircle,
                    {
                      borderColor: phase === 'INITIAL_WAIT' ? colors.primary : '#F59E0B',
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

              <View
                style={[
                  styles.centerIconCircle,
                  { backgroundColor: phase === 'INITIAL_WAIT' ? colors.primary : '#F59E0B' },
                ]}
              >
                <Ionicons name="videocam" size={36} color="#FFF" />
              </View>
            </View>

            {/* STATUS TITLE */}
            <Text style={[styles.connectingTitle, { color: colors.text }]}>
              {phase === 'INITIAL_WAIT'
                ? t('video_kyc_connecting', 'Connecting you with a verification officer...')
                : t('video_kyc_phase2_title', 'Officers are busy. Retrying connection...')}
            </Text>

            {isInitializing ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.loadingText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                  Initializing secure session...
                </Text>
              </View>
            ) : (
              <>
                {/* TWO-STAGE COUNTDOWN CARD */}
                <View
                  style={[
                    styles.countdownCard,
                    {
                      backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
                    },
                  ]}
                >
                  <View style={styles.countdownHeaderRow}>
                    <Ionicons name="timer-outline" size={20} color={colors.primary} />
                    <Text style={[styles.countdownLabel, { color: isDark ? '#9CA3AF' : '#64748B' }]}>
                      {phase === 'INITIAL_WAIT'
                        ? t('video_kyc_auto_retry_in', 'Auto-retrying in')
                        : t('moving_to_schedule_in', 'Moving to appointment desk in')}
                    </Text>
                  </View>

                  <Text style={[styles.countdownValue, { color: colors.primary }]}>
                    {formatTime(countdown)}
                  </Text>

                  {/* PROGRESS BAR ACROSS TOTAL 2 MINUTES */}
                  <View style={[styles.progressBarTrack, { backgroundColor: isDark ? '#374151' : '#F1F5F9' }]}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min(100, Math.round((totalElapsed / TOTAL_WAIT_DURATION_SECONDS) * 100))}%`,
                          backgroundColor: phase === 'INITIAL_WAIT' ? colors.primary : '#F59E0B',
                        },
                      ]}
                    />
                  </View>

                  <Text style={[styles.progressBarHint, { color: isDark ? '#9CA3AF' : '#94A3B8' }]}>
                    {phase === 'INITIAL_WAIT'
                      ? 'Step 1 of 2: 1-minute initial officer connection check'
                      : 'Step 2 of 2: Final 1-minute retry before priority appointment desk'}
                  </Text>
                </View>

                {/* QUEUE METRICS CARD */}
                <View
                  style={[
                    styles.metricsCard,
                    {
                      backgroundColor: isDark ? theme.colors.card : '#F8FAFC',
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
                    },
                  ]}
                >
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
              </>
            )}

            {/* TIPS CARD */}
            <View
              style={[
                styles.tipsCard,
                {
                  backgroundColor: isDark ? theme.colors.card : '#F0FDF4',
                  borderColor: isDark ? 'rgba(34, 197, 94, 0.2)' : '#BBF7D0',
                },
              ]}
            >
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
          </>
        )}

        {/* ─── SCENARIO B: DECISION CHOICE AFTER 2 ATTEMPTS (SCHEDULE vs RETRY) ─── */}
        {phase === 'DECISION_CHOICE' && (
          <View style={{ width: '100%', alignItems: 'center', paddingVertical: 10 }}>
            {/* HERO ICON */}
            <View
              style={[
                styles.scheduledIconCircle,
                {
                  backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7',
                  borderColor: '#F59E0B',
                },
              ]}
            >
              <Ionicons name="time" size={44} color="#D97706" />
            </View>

            <View style={[styles.statusPill, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2', borderColor: '#EF4444' }]}>
              <View style={[styles.phaseDot, { backgroundColor: '#EF4444' }]} />
              <Text style={{ color: isDark ? '#FCA5A5' : '#B91C1C', fontSize: rms(11.5), fontWeight: '700' }}>
                {t('video_kyc_retry_attempt', 'Attempt 2 of 2 Completed')}
              </Text>
            </View>

            <Text style={[styles.scheduledMainTitle, { color: colors.text }]}>
              {t('video_kyc_after_attempts_title', 'All Officers Are Currently Busy')}
            </Text>

            <Text style={[styles.scheduledDescText, { color: isDark ? '#9CA3AF' : '#4B5563' }]}>
              {t(
                'video_kyc_after_attempts_desc',
                'We could not connect your call in 2 attempts (2 minutes). How would you like to proceed?'
              )}
            </Text>

            {/* OPTION 1: SCHEDULE APPOINTMENT */}
            <TouchableOpacity
              style={[
                styles.choiceCard,
                {
                  backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
                  borderColor: colors.primary,
                },
              ]}
              onPress={handleSelectSchedule}
              activeOpacity={0.88}
            >
              <View style={styles.choiceCardHeader}>
                <View style={[styles.choiceIconWrap, { backgroundColor: 'rgba(37, 99, 235, 0.12)' }]}>
                  <Ionicons name="calendar" size={24} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.choiceTitleRow}>
                    <Text style={[styles.choiceTitle, { color: colors.text }]}>
                      {t('video_kyc_option_schedule_title', 'Schedule Appointment')}
                    </Text>
                    <View style={styles.recommendedBadge}>
                      <Text style={styles.recommendedBadgeText}>RECOMMENDED</Text>
                    </View>
                  </View>
                  <Text style={[styles.choiceDesc, { color: isDark ? '#9CA3AF' : '#64748B' }]}>
                    {t(
                      'video_kyc_option_schedule_desc',
                      'Book or receive a confirmed time slot (e.g. 4:00 PM – 5:00 PM) with a dedicated officer.'
                    )}
                  </Text>
                </View>
              </View>

              <View style={[styles.choiceActionBtn, { backgroundColor: colors.primary }]}>
                <Ionicons name="calendar-outline" size={18} color="#FFF" />
                <Text style={styles.choiceActionBtnText}>
                  {t('video_kyc_btn_schedule', 'Schedule Video KYC')}
                </Text>
                <Ionicons name="arrow-forward" size={16} color="#FFF" />
              </View>
            </TouchableOpacity>

            {/* OPTION 2: RETRY LIVE CALL */}
            <TouchableOpacity
              style={[
                styles.choiceCard,
                {
                  backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
                  borderColor: isDark ? 'rgba(245, 158, 11, 0.4)' : '#FDE68A',
                },
              ]}
              onPress={handleSelectRetry}
              activeOpacity={0.88}
            >
              <View style={styles.choiceCardHeader}>
                <View style={[styles.choiceIconWrap, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                  <Ionicons name="refresh-circle" size={26} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.choiceTitle, { color: colors.text }]}>
                    {t('video_kyc_option_retry_title', 'Retry Live Call')}
                  </Text>
                  <Text style={[styles.choiceDesc, { color: isDark ? '#9CA3AF' : '#64748B' }]}>
                    {t(
                      'video_kyc_option_retry_desc',
                      'Wait another 1 minute to attempt connecting with an available officer immediately.'
                    )}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.choiceActionBtn,
                  {
                    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7',
                    borderWidth: 1,
                    borderColor: '#F59E0B',
                  },
                ]}
              >
                <Ionicons name="reload" size={17} color="#D97706" />
                <Text style={[styles.choiceActionBtnText, { color: isDark ? '#FCD34D' : '#92400E' }]}>
                  {t('video_kyc_btn_retry', 'Retry Live Call (1 min)')}
                </Text>
              </View>
            </TouchableOpacity>

            {/* CANCEL / EXIT */}
            <TouchableOpacity
              style={[styles.cancelBtn, { marginTop: 14, borderColor: isDark ? 'rgba(239, 68, 68, 0.4)' : '#FECACA' }]}
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
          </View>
        )}

        {/* ─── SCENARIO C: PENDING APPOINTMENT SCHEDULING (PHASE 3) ─── */}
        {phase === 'PENDING_SCHEDULING' && (
          <View style={{ width: '100%', alignItems: 'center', paddingVertical: 10 }}>
            {/* ANIMATED ICON */}
            <Animated.View
              style={[
                styles.scheduledIconCircle,
                {
                  backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : '#EEF2FF',
                  borderColor: '#6366F1',
                  transform: [{ scale: deskPulseAnim }],
                },
              ]}
            >
              <Ionicons name="calendar" size={44} color="#6366F1" />
            </Animated.View>

            <Text style={[styles.scheduledMainTitle, { color: colors.text }]}>
              {t('video_kyc_scheduling_desk_title', 'Forwarded to Scheduling Desk')}
            </Text>

            <View style={[styles.statusPill, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7', borderColor: '#F59E0B' }]}>
              <View style={[styles.phaseDot, { backgroundColor: '#D97706' }]} />
              <Text style={{ color: isDark ? '#FCD34D' : '#92400E', fontSize: rms(11.5), fontWeight: '700' }}>
                {t('video_kyc_waiting_admin_schedule', 'Waiting for Admin to Schedule Slot')}
              </Text>
            </View>

            <Text style={[styles.scheduledDescText, { color: isDark ? '#9CA3AF' : '#4B5563' }]}>
              {t(
                'video_kyc_scheduling_desk_desc',
                'All verification officers are currently assisting other drivers. Your request has been moved to our priority appointment desk. An officer will schedule a dedicated time slot for you shortly.'
              )}
            </Text>

            {/* WHAT HAPPENS NEXT CARD */}
            <View
              style={[
                styles.infoStepsCard,
                {
                  backgroundColor: isDark ? theme.colors.card : '#F8FAFC',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
                },
              ]}
            >
              <Text style={[styles.infoStepsHeading, { color: colors.text }]}>
                What happens next?
              </Text>

              <View style={styles.stepItemRow}>
                <View style={[styles.stepNumberBadge, { backgroundColor: colors.primary }]}>
                  <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 11 }}>1</Text>
                </View>
                <Text style={[styles.stepItemText, { color: isDark ? '#D1D5DB' : '#334155' }]}>
                  Admin selects an optimal time slot (e.g. 4:00 PM – 5:00 PM).
                </Text>
              </View>

              <View style={styles.stepItemRow}>
                <View style={[styles.stepNumberBadge, { backgroundColor: colors.primary }]}>
                  <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 11 }}>2</Text>
                </View>
                <Text style={[styles.stepItemText, { color: isDark ? '#D1D5DB' : '#334155' }]}>
                  You will receive a push notification and confirmed date & time here.
                </Text>
              </View>

              <View style={styles.stepItemRow}>
                <View style={[styles.stepNumberBadge, { backgroundColor: colors.primary }]}>
                  <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 11 }}>3</Text>
                </View>
                <Text style={[styles.stepItemText, { color: isDark ? '#D1D5DB' : '#334155' }]}>
                  The call button activates 5 minutes before your scheduled appointment.
                </Text>
              </View>
            </View>

            {/* ACTION BUTTON */}
            <TouchableOpacity
              style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate(DocumentScreen_Nav)}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryActionBtnText}>
                {t('video_kyc_done_for_now', 'Got It • Back to Documents')}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#FFF" />
            </TouchableOpacity>

            {/* RETRY LIVE CALL INSTEAD */}
            <TouchableOpacity
              style={[
                styles.retrySecondaryBtn,
                {
                  borderColor: isDark ? 'rgba(245, 158, 11, 0.4)' : '#FDE68A',
                  backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#FFFBEB',
                },
              ]}
              onPress={handleSelectRetry}
              activeOpacity={0.8}
            >
              <Ionicons name="reload" size={16} color="#D97706" />
              <Text style={[styles.retrySecondaryBtnText, { color: isDark ? '#FCD34D' : '#92400E' }]}>
                {t('video_kyc_retry_instead', 'Want to try again? Retry Live Call Now')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── SCENARIO D: APPOINTMENT CONFIRMED (PHASE 4: SCHEDULED BY ADMIN) ─── */}
        {phase === 'SCHEDULED' && scheduledAppointment && (
          <View style={{ width: '100%', alignItems: 'center', paddingVertical: 10 }}>
            {/* CONFIRMED HERO BADGE */}
            <View
              style={[
                styles.scheduledIconCircle,
                {
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5',
                  borderColor: '#10B981',
                },
              ]}
            >
              <Ionicons name="checkmark-circle" size={48} color="#10B981" />
            </View>

            <Text style={[styles.scheduledMainTitle, { color: colors.text }]}>
              {t('video_kyc_appointment_confirmed', 'Video KYC Appointment Confirmed')}
            </Text>

            <Text style={[styles.scheduledSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
              Your verification has been scheduled with our compliance team.
            </Text>

            {/* CONFIRMED DETAILS CARD */}
            <View
              style={[
                styles.confirmedDetailsCard,
                {
                  backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
                },
              ]}
            >
              <View style={styles.detailRow}>
                <View style={[styles.detailIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                  <Ionicons name="calendar-outline" size={20} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.detailLabel, { color: isDark ? '#9CA3AF' : '#64748B' }]}>
                    {t('video_kyc_scheduled_for', 'Scheduled Date')}
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {scheduledAppointment.date}
                  </Text>
                </View>
              </View>

              <View style={[styles.cardRowDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]} />

              <View style={styles.detailRow}>
                <View style={[styles.detailIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                  <Ionicons name="time-outline" size={20} color="#F59E0B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.detailLabel, { color: isDark ? '#9CA3AF' : '#64748B' }]}>
                    {t('video_kyc_time_slot', 'Time Slot')}
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {scheduledAppointment.startTime} – {scheduledAppointment.endTime}
                  </Text>
                </View>
              </View>

              <View style={[styles.cardRowDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]} />

              <View style={styles.detailRow}>
                <View style={[styles.detailIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                  <Ionicons name="person-circle-outline" size={20} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.detailLabel, { color: isDark ? '#9CA3AF' : '#64748B' }]}>
                    {t('video_kyc_officer_desk', 'Verification Desk')}
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {scheduledAppointment.adminName || 'Assigned Compliance Officer'}
                  </Text>
                </View>
              </View>
            </View>

            {/* CALL BUTTON OR TIMING HINT */}
            {isCallReadyNow ? (
              <TouchableOpacity
                style={[styles.primaryActionBtn, { backgroundColor: '#10B981' }]}
                onPress={() => {
                  // Direct join
                  if (sessionId) {
                    socketService.emitKycRequest(user.driverId);
                  }
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="videocam" size={20} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.primaryActionBtnText}>
                  {t('video_kyc_join_now', 'Join Video KYC Call Now')}
                </Text>
              </TouchableOpacity>
            ) : (
              <View
                style={[
                  styles.upcomingCallNotice,
                  {
                    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
                    borderColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#BFDBFE',
                  },
                ]}
              >
                <Ionicons name="information-circle-outline" size={18} color="#2563EB" />
                <Text style={[styles.upcomingNoticeText, { color: isDark ? '#93C5FD' : '#1E40AF' }]}>
                  {t(
                    'video_kyc_call_upcoming_hint',
                    'The call button will activate 5 minutes before your scheduled appointment time.'
                  )}
                </Text>
              </View>
            )}

            {/* BACK BUTTON */}
            <TouchableOpacity
              style={[styles.cancelBtn, { marginTop: 16, borderColor: isDark ? '#374151' : '#CBD5E1' }]}
              onPress={() => navigation.navigate(DocumentScreen_Nav)}
              activeOpacity={0.8}
            >
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: rms(13) }}>
                {t('video_kyc_done_for_now', 'Back to Documents')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

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
    fontSize: 17,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  phaseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 10,
  },
  phaseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  phaseBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  radarContainer: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 14,
  },
  pulseCircle: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 2,
  },
  centerIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  connectingTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 23,
    paddingHorizontal: 16,
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
  countdownCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginVertical: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  countdownHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  countdownLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  countdownValue: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 1,
    marginVertical: 4,
  },
  progressBarTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressBarHint: {
    fontSize: 10.5,
    textAlign: 'center',
    marginTop: 2,
  },
  metricsCard: {
    width: '100%',
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    fontSize: 17,
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
    marginBottom: 20,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  tipsTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  tipText: {
    fontSize: 12.5,
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
    fontSize: 13.5,
    fontWeight: '600',
  },

  // ─── STYLES FOR PHASES 3 & 4 (SCHEDULING) ───
  scheduledIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  scheduledMainTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  scheduledSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 18,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  scheduledDescText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  infoStepsCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  infoStepsHeading: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  stepItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  stepNumberBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  stepItemText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
  },
  confirmedDetailsCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  detailIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardRowDivider: {
    height: 1,
    width: '100%',
    marginVertical: 10,
  },
  upcomingCallNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  upcomingNoticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 6,
  },
  primaryActionBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  // ─── STYLES FOR DECISION CHOICE ───
  choiceCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  choiceCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  choiceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  choiceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  choiceTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  recommendedBadge: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recommendedBadgeText: {
    color: '#FFF',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  choiceDesc: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  choiceActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  choiceActionBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  retrySecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    gap: 8,
  },
  retrySecondaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
