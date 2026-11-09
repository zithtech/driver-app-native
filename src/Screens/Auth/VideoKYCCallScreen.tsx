import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';

import createAgoraRtcEngine, {
  ChannelProfileType,
  ClientRoleType,
  IRtcEngine,
  RtcSurfaceView,
  RenderModeType,
  IRtcEngineEventHandler,
  QualityType,
} from 'react-native-agora';

import { Text } from '../../Components';
import AppStatusBar from '../../Components/AppStatusBar';
import { useToast } from '../../context/ToastContext';
import { useHaptic } from '../../hooks/useHaptic';
import { setUser } from '../../redux/userSlice';
import socketService from '../../service/socketService';
import { AGORA_APP_ID } from '../../constant/config';
import { useLazyGetVideoKycStatusQuery } from '../../service/driverApi';
import { requestVideoKycPermissions, goToSettings } from '../../utils/permissionUtils';
import { VerificationSuccessScreen_Nav, DocumentScreen_Nav, VideoKYCWaiting_Nav } from '../../Navigations/navigations';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const VideoKYCCallScreen = ({ navigation, route }: any) => {
  const routeParams = route?.params || {};
  const { sessionId: paramSessionId, channelName: paramChannelName, token: paramToken, uid: paramUid, adminName: paramAdminName } = routeParams;

  const { colors, fonts } = useTheme() as any;
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { triggerHaptic } = useHaptic();
  const dispatch = useDispatch();

  const user = useSelector((state: any) => state.userSlice.user);

  // Active Session Credentials (from navigation params or restored from server)
  const [activeSession, setActiveSession] = useState<{
    sessionId: string;
    channelName: string;
    token: string;
    uid: number;
    adminName?: string;
  } | null>(() => {
    if (paramSessionId && paramToken && paramChannelName) {
      return {
        sessionId: paramSessionId,
        channelName: paramChannelName,
        token: paramToken,
        uid: typeof paramUid === 'number' ? paramUid : 0,
        adminName: paramAdminName,
      };
    }
    return null;
  });

  const [isRestoringSession, setIsRestoringSession] = useState(!activeSession);
  const [fetchKycStatus] = useLazyGetVideoKycStatusQuery();

  // Call States
  const [isJoined, setIsJoined] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isUsingFrontCamera, setIsUsingFrontCamera] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [networkQuality, setNetworkQuality] = useState<number>(1); // 1 = Excellent, 2 = Good, etc.
  const [adminPrompt, setAdminPrompt] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'ended'>('connecting');
  const [verdictModal, setVerdictModal] = useState<{ status: 'APPROVED' | 'REJECTED'; remarks?: string } | null>(null);

  const engineRef = useRef<IRtcEngine | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const promptFadeAnim = useRef(new Animated.Value(0)).current;

  // Format Call Duration mm:ss
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Prevent hardware back button during call without confirmation
  useEffect(() => {
    const backAction = () => {
      confirmEndCall();
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [activeSession]);

  // Session Restoration for Cold Start / App Reopening (onboarding_status === 'VIDEO_KYC_IN_PROGRESS')
  useEffect(() => {
    let isMounted = true;

    const restoreActiveSession = async () => {
      if (activeSession) return;

      if (!user?.driverId) {
        showToast({ message: 'Driver session not found', type: 'error' });
        navigation.replace(DocumentScreen_Nav);
        return;
      }

      // Check Camera & Mic permissions
      const perms = await requestVideoKycPermissions();
      if (!perms.allGranted) {
        Alert.alert(
          t('permission_required', 'Permissions Required'),
          t('video_kyc_permission_required', 'Camera and microphone permissions are required for Video KYC.'),
          [
            { text: t('cancel', 'Cancel'), onPress: () => navigation.replace(DocumentScreen_Nav), style: 'cancel' },
            { text: t('go_to_settings', 'Settings'), onPress: () => { goToSettings(); navigation.replace(DocumentScreen_Nav); } },
          ]
        );
        return;
      }

      try {
        setIsRestoringSession(true);
        const res = await fetchKycStatus({ driverId: user.driverId }).unwrap();
        const data = res?.data || res;

        if (!isMounted) return;

        if (data?.status === 'IN_CALL' && data?.token && data?.channelName) {
          console.log('🔄 [VideoKYCCall] Restored active session from server:', data.sessionId);
          setActiveSession({
            sessionId: data.sessionId,
            channelName: data.channelName,
            token: data.token,
            uid: typeof data.uid === 'number' ? data.uid : 0,
            adminName: data.adminName,
          });
          setIsRestoringSession(false);
        } else if (data?.status === 'COMPLETED' || data?.status === 'APPROVED') {
          console.log('✅ [VideoKYCCall] Session already approved on server');
          dispatch(setUser({ onboarding_status: 'DOCUMENTS_VERIFIED', kyc_status: 'verified' }));
          navigation.replace(VerificationSuccessScreen_Nav);
        } else if (data?.status === 'REJECTED') {
          console.log('❌ [VideoKYCCall] Session was rejected on server');
          dispatch(setUser({ onboarding_status: 'DOCS_REJECTED', kyc_status: 'rejected' }));
          showToast({ message: data.remarks || 'Video KYC was rejected.', type: 'error' });
          navigation.replace(DocumentScreen_Nav);
        } else if (data?.status === 'QUEUED') {
          console.log('⏳ [VideoKYCCall] Session still queued, returning to waiting room');
          dispatch(setUser({ onboarding_status: 'VIDEO_KYC_WAITING' }));
          navigation.replace(VideoKYCWaiting_Nav);
        } else {
          console.log('⚠️ [VideoKYCCall] No active in-progress call found, returning to documents');
          dispatch(setUser({ onboarding_status: 'DOCS_SUBMITTED' }));
          navigation.replace(DocumentScreen_Nav);
        }
      } catch (err: any) {
        console.error('Failed to restore active Video KYC session:', err);
        if (isMounted) {
          showToast({ message: 'Could not restore Video KYC session.', type: 'error' });
          navigation.replace(DocumentScreen_Nav);
        }
      }
    };

    restoreActiveSession();

    return () => {
      isMounted = false;
    };
  }, [user?.driverId]);

  // Initialize Agora Engine & Join Channel once activeSession is available
  useEffect(() => {
    if (!activeSession) return;

    let engine: IRtcEngine | null = null;
    let isCleanedUp = false;

    const setupAgora = async () => {
      try {
        if (!AGORA_APP_ID) {
          Alert.alert('Configuration Error', 'Agora App ID is missing.');
          navigation.goBack();
          return;
        }

        engine = createAgoraRtcEngine();
        engineRef.current = engine;

        // Initialize engine
        engine.initialize({
          appId: AGORA_APP_ID,
          channelProfile: ChannelProfileType.ChannelProfileCommunication,
        });

        // Register event handler callbacks
        const eventHandler: IRtcEngineEventHandler = {
          onJoinChannelSuccess: (connection, elapsed) => {
            console.log('✅ [Agora] Successfully joined channel:', connection.channelId);
            if (!isCleanedUp) {
              setIsJoined(true);
              setCallStatus('connecting');
              socketService.emitKycDriverJoined(activeSession.sessionId);
            }
          },
          onUserJoined: (connection, rUid, elapsed) => {
            console.log('👤 [Agora] Remote user (Admin) joined:', rUid);
            if (!isCleanedUp) {
              setRemoteUid(rUid);
              setCallStatus('connected');
              triggerHaptic(HapticFeedbackTypes.notificationSuccess);

              // Start call timer
              if (!callTimerRef.current) {
                callTimerRef.current = setInterval(() => {
                  setCallDuration(prev => prev + 1);
                }, 1000);
              }
            }
          },
          onUserOffline: (connection, rUid, reason) => {
            console.log('⚠️ [Agora] Remote user went offline:', rUid, 'reason:', reason);
            if (!isCleanedUp) {
              setRemoteUid(null);
              setCallStatus('reconnecting');
            }
          },
          onNetworkQuality: (connection, rUid, txQuality, rxQuality) => {
            const worstQuality = Math.max(txQuality, rxQuality);
            if (!isCleanedUp && worstQuality > 0) {
              setNetworkQuality(worstQuality);
            }
          },
          onError: (err, msg) => {
            console.warn('⚠️ [Agora] Engine Error:', err, msg);
          },
          onTokenPrivilegeWillExpire: (connection, currentToken) => {
            console.warn('⚠️ [Agora] Token will expire soon');
          },
        };

        engine.registerEventHandler(eventHandler);

        // Enable video & audio
        engine.enableVideo();
        engine.enableAudio();
        engine.startPreview();

        // Join channel
        const rtcUid = typeof activeSession.uid === 'number' ? activeSession.uid : 0;
        engine.joinChannel(activeSession.token, activeSession.channelName, rtcUid, {
          clientRoleType: ClientRoleType.ClientRoleBroadcaster,
          autoSubscribeVideo: true,
          autoSubscribeAudio: true,
        });
      } catch (e) {
        console.error('Failed to setup Agora:', e);
        Alert.alert('Call Error', 'Failed to initialize video call.');
        navigation.goBack();
      }
    };

    setupAgora();

    return () => {
      isCleanedUp = true;
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
      if (engineRef.current) {
        try {
          engineRef.current.leaveChannel();
          engineRef.current.release();
        } catch (e) {
          console.warn('Agora cleanup error:', e);
        }
        engineRef.current = null;
      }
      if (activeSession.sessionId) {
        socketService.emitKycDriverLeft(activeSession.sessionId);
      }
    };
  }, [activeSession]);

  // Socket Listeners (Admin Prompts, Verification Results)
  useEffect(() => {
    // 1. Admin Prompt Banner
    const handleAdminPrompt = (data: { promptText: string }) => {
      if (data?.promptText) {
        triggerHaptic(HapticFeedbackTypes.impactMedium);
        setAdminPrompt(data.promptText);

        Animated.sequence([
          Animated.timing(promptFadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.delay(6000),
          Animated.timing(promptFadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start(() => setAdminPrompt(null));
      }
    };

    // 2. Verification Result
    const handleKycResult = (data: {
      sessionId: string;
      status: 'APPROVED' | 'REJECTED';
      remarks?: string;
      rejectionReasons?: string[];
    }) => {
      console.log('📋 [VideoKYC] Verdict received:', data);
      setCallStatus('ended');

      if (data.status === 'APPROVED') {
        triggerHaptic(HapticFeedbackTypes.notificationSuccess);
        setVerdictModal({ status: 'APPROVED', remarks: data.remarks });
        dispatch(setUser({ onboarding_status: 'DOCUMENTS_VERIFIED' }));

        setTimeout(() => {
          navigation.replace(VerificationSuccessScreen_Nav);
        }, 3000);
      } else {
        triggerHaptic(HapticFeedbackTypes.notificationError);
        const reasons = data.rejectionReasons?.join('\n') || data.remarks || 'Verification incomplete';
        setVerdictModal({ status: 'REJECTED', remarks: reasons });
        dispatch(setUser({ onboarding_status: 'DOCS_REJECTED' }));
      }
    };

    // 3. Admin Disconnected / Ended Call
    const handleAdminDisconnected = (data?: any) => {
      console.log('⚠️ [VideoKYC] Officer disconnected / ended call:', data);
      if (data?.action === 'HANGUP' || data?.action === 'CANCELLED') {
        showToast({
          message: data?.message || t('video_kyc_call_ended', 'Officer ended the verification call.'),
          type: 'info',
        });
        dispatch(setUser({ onboarding_status: 'DOCS_SUBMITTED' }));
        navigation.replace(DocumentScreen_Nav);
        return;
      }
      setCallStatus('reconnecting');
      showToast({ message: t('video_kyc_admin_disconnected', 'Officer disconnected. Reconnecting...'), type: 'info' });
    };

    socketService.onKycAdminPrompt(handleAdminPrompt);
    socketService.onKycResult(handleKycResult);
    socketService.onKycAdminDisconnected(handleAdminDisconnected);

    return () => {
      socketService.offKycAdminPrompt(handleAdminPrompt);
      socketService.offKycResult(handleKycResult);
      socketService.offKycAdminDisconnected(handleAdminDisconnected);
    };
  }, [dispatch, navigation, promptFadeAnim, triggerHaptic, showToast, t]);

  // Actions
  const toggleMute = () => {
    if (engineRef.current) {
      const nextMute = !isMuted;
      engineRef.current.muteLocalAudioStream(nextMute);
      setIsMuted(nextMute);
      triggerHaptic(HapticFeedbackTypes.impactLight);
    }
  };

  const switchCamera = () => {
    if (engineRef.current) {
      engineRef.current.switchCamera();
      setIsUsingFrontCamera(prev => !prev);
      setIsTorchOn(false); // Reset torch when switching
      triggerHaptic(HapticFeedbackTypes.impactLight);
    }
  };

  const toggleTorch = () => {
    if (engineRef.current) {
      const nextTorch = !isTorchOn;
      engineRef.current.setCameraTorchOn(nextTorch);
      setIsTorchOn(nextTorch);
      triggerHaptic(HapticFeedbackTypes.impactLight);
    }
  };

  const confirmEndCall = () => {
    Alert.alert(
      t('video_kyc_end_call', 'End Call'),
      t('video_kyc_end_confirm', 'Are you sure you want to end this verification call?'),
      [
        { text: t('no', 'No'), style: 'cancel' },
        {
          text: t('yes', 'Yes'),
          style: 'destructive',
          onPress: () => {
            const sid = activeSession?.sessionId || paramSessionId;
            if (sid) socketService.emitKycDriverLeft(sid);
            dispatch(setUser({ onboarding_status: 'DOCS_SUBMITTED' }));
            navigation.replace(DocumentScreen_Nav);
          },
        },
      ]
    );
  };

  // Network Quality Indicator
  const renderNetworkIndicator = () => {
    let color = '#16A34A'; // Green
    let label = t('video_kyc_network_excellent', 'Excellent');

    if (networkQuality === 2 || networkQuality === 3) {
      color = '#F59E0B'; // Amber
      label = t('video_kyc_network_good', 'Good');
    } else if (networkQuality >= 4) {
      color = '#EF4444'; // Red
      label = t('video_kyc_network_poor', 'Poor');
    }

    return (
      <View style={styles.networkBadge}>
        <View style={[styles.networkDot, { backgroundColor: color }]} />
        <Text style={styles.networkText}>{label}</Text>
      </View>
    );
  };

  if (!activeSession) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#0B0F19', justifyContent: 'center', alignItems: 'center' }]} edges={['top', 'bottom']}>
        <AppStatusBar />
        <View style={{ alignItems: 'center', padding: 24 }}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={[fonts.bold, { color: '#FFFFFF', fontSize: 18, marginTop: 20 }]}>
            {t('video_kyc_reconnecting', 'Restoring Video KYC...')}
          </Text>
          <Text style={{ color: '#94A3B8', fontSize: 13, marginTop: 8, textAlign: 'center' }}>
            {t('video_kyc_reconnecting_desc', 'Re-joining your live verification session with the verification officer.')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <AppStatusBar />

      {/* FULL-SCREEN REMOTE VIDEO (OFFICER) */}
      <View style={styles.remoteVideoContainer}>
        {remoteUid ? (
          <RtcSurfaceView
            style={StyleSheet.absoluteFill}
            canvas={{
              uid: remoteUid,
              renderMode: RenderModeType.RenderModeHidden,
            }}
          />
        ) : (
          <View style={styles.waitingRemoteBox}>
            <ActivityIndicator size="large" color="#FFF" />
            <Text style={styles.waitingRemoteTitle}>
              {callStatus === 'reconnecting'
                ? t('video_kyc_reconnecting', 'Reconnecting with officer...')
                : t('video_kyc_connecting', 'Waiting for officer video stream...')}
            </Text>
            <Text style={styles.waitingRemoteSubtitle}>
              {activeSession.adminName || paramAdminName || t('video_kyc_officer', 'KYC Officer')}
            </Text>
          </View>
        )}
      </View>

      {/* FLOATING LOCAL PREVIEW (DRIVER) */}
      {isJoined && (
        <View style={styles.localPreviewCard}>
          <RtcSurfaceView
            style={StyleSheet.absoluteFill}
            zOrderMediaOverlay={true}
            canvas={{
              uid: 0, // 0 = local user
              renderMode: RenderModeType.RenderModeHidden,
            }}
          />
          <View style={styles.localLabelBadge}>
            <Text style={styles.localLabelText}>You</Text>
          </View>
        </View>
      )}

      {/* TOP OVERLAY HEADER */}
      <View style={styles.topHeader}>
        <View style={styles.officerInfoRow}>
          <View style={styles.officerAvatar}>
            <Ionicons name="shield-checkmark" size={16} color="#FFF" />
          </View>
          <View>
            <Text style={styles.officerName}>
              {activeSession.adminName || paramAdminName || t('video_kyc_officer', 'KYC Officer')}
            </Text>
            <Text style={styles.callTimer}>
              {formatDuration(callDuration)}
            </Text>
          </View>
        </View>

        {renderNetworkIndicator()}
      </View>

      {/* ADMIN GUIDANCE PROMPT BANNER */}
      {adminPrompt && (
        <Animated.View style={[styles.adminPromptBanner, { opacity: promptFadeAnim }]}>
          <Ionicons name="information-circle" size={20} color="#F59E0B" />
          <Text style={styles.adminPromptText}>
            {adminPrompt}
          </Text>
        </Animated.View>
      )}

      {/* BOTTOM CONTROL BAR */}
      <View style={styles.bottomControlBar}>
        {/* Flip Camera */}
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={switchCamera}
          activeOpacity={0.8}
        >
          <View style={[styles.controlIconCircle, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Ionicons name="camera-reverse" size={24} color="#FFF" />
          </View>
          <Text style={styles.controlBtnLabel}>
            {t('video_kyc_flip_camera', 'Flip')}
          </Text>
        </TouchableOpacity>

        {/* Torch (useful when rear camera is pointing at physical ID) */}
        {!isUsingFrontCamera && (
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={toggleTorch}
            activeOpacity={0.8}
          >
            <View style={[styles.controlIconCircle, { backgroundColor: isTorchOn ? '#F59E0B' : 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name={isTorchOn ? 'flash' : 'flash-outline'} size={24} color="#FFF" />
            </View>
            <Text style={styles.controlBtnLabel}>
              {t('video_kyc_torch', 'Torch')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Mute Mic */}
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={toggleMute}
          activeOpacity={0.8}
        >
          <View style={[styles.controlIconCircle, { backgroundColor: isMuted ? '#EF4444' : 'rgba(255,255,255,0.2)' }]}>
            <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color="#FFF" />
          </View>
          <Text style={styles.controlBtnLabel}>
            {isMuted ? t('video_kyc_unmute', 'Unmute') : t('video_kyc_mute', 'Mute')}
          </Text>
        </TouchableOpacity>

        {/* End Call */}
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={confirmEndCall}
          activeOpacity={0.8}
        >
          <View style={[styles.controlIconCircle, { backgroundColor: '#EF4444' }]}>
            <Ionicons name="call" size={26} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
          </View>
          <Text style={styles.controlBtnLabel}>
            {t('video_kyc_end_call', 'End')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* VERDICT MODAL (APPROVED / REJECTED) */}
      {verdictModal && (
        <View style={styles.verdictOverlay}>
          <View style={styles.verdictCard}>
            <View
              style={[
                styles.verdictIconCircle,
                { backgroundColor: verdictModal.status === 'APPROVED' ? '#DCFCE7' : '#FEE2E2' },
              ]}
            >
              <Ionicons
                name={verdictModal.status === 'APPROVED' ? 'checkmark-circle' : 'close-circle'}
                size={56}
                color={verdictModal.status === 'APPROVED' ? '#16A34A' : '#EF4444'}
              />
            </View>

            <Text style={styles.verdictTitle}>
              {verdictModal.status === 'APPROVED'
                ? t('video_kyc_approved', 'Verification Successful!')
                : t('video_kyc_rejected', 'Verification Unsuccessful')}
            </Text>

            <Text style={styles.verdictSubtitle}>
              {verdictModal.status === 'APPROVED'
                ? t('video_kyc_approved_desc', 'Your identity has been verified via Video KYC.')
                : verdictModal.remarks || t('video_kyc_rejected_desc', 'Please check the remarks and try again.')}
            </Text>

            {verdictModal.status === 'REJECTED' && (
              <TouchableOpacity
                style={styles.verdictActionBtn}
                onPress={() => navigation.replace(DocumentScreen_Nav)}
              >
                <Text style={styles.verdictActionText}>Back to Documents</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

export default VideoKYCCallScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  remoteVideoContainer: {
    flex: 1,
    backgroundColor: '#111827',
  },
  waitingRemoteBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  waitingRemoteTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
  waitingRemoteSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 6,
  },
  localPreviewCard: {
    position: 'absolute',
    top: 90,
    right: 16,
    width: 105,
    height: 145,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFF',
    backgroundColor: '#1E293B',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  localLabelBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  localLabelText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  topHeader: {
    position: 'absolute',
    top: 20,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 30,
  },
  officerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  officerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  officerName: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  callTimer: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '600',
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  networkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  networkText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  adminPromptBanner: {
    position: 'absolute',
    top: 140,
    left: 16,
    right: 130,
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    elevation: 8,
  },
  adminPromptText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
  },
  bottomControlBar: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  controlBtn: {
    alignItems: 'center',
    gap: 6,
  },
  controlIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlBtnLabel: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  verdictOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 100,
  },
  verdictCard: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  verdictIconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  verdictTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  verdictSubtitle: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  verdictActionBtn: {
    backgroundColor: '#111827',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
  },
  verdictActionText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
