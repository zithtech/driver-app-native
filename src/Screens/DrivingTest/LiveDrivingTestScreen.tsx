import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
  AppState,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Gesture,
  GestureDetector,
  TouchableOpacity as GHTouchableOpacity,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useIsFocused } from '@react-navigation/native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { useAppTheme } from '../../context/ThemeContext';
import { Text } from '../../Components';
import VoiceGuidanceService, { VoiceLanguage } from '../../services/VoiceGuidanceService';
import DualCameraService, { DualCameraPreview } from '../../services/DualCameraService';
import DrivingTelemetryService, {
  RouteCheckpoint,
  TelemetryPoint,
  DrivingEvent,
} from '../../services/DrivingTelemetryService';
import { DrivingTestCompletion_Nav, DrivingTestIntro_Nav } from '../../Navigations/navigations';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../redux/store';
import { setUser } from '../../redux/userSlice';
import { storage } from '../../service/utils/storage';
import {
  useStartDrivingTestSessionMutation,
  useSendDrivingTelemetryBatchMutation,
  useRecordCheckpointArrivalMutation,
} from '../../service/driverApi';

const PIP_WIDTH = 105;
const PIP_HEIGHT = 140;
const PIP_MIN_WIDTH = 76;
const PIP_MIN_HEIGHT = 36;
const PIP_EDGE_MARGIN = 12;
const PIP_POS_STORAGE_KEY = 'PIP_CAMERA_POSITION';

// Default Route Checkpoints for the Driving Test
const MOCK_CHECKPOINTS: RouteCheckpoint[] = [
  {
    id: 'cp_1',
    sequenceOrder: 1,
    checkpointType: 'START',
    latitude: 13.0827,
    longitude: 80.2707,
    radiusMeters: 30,
    speedLimitKmh: 40,
    voicePromptEn: 'Start your driving test. Maintain a safe driving speed.',
    voicePromptTa: 'உங்கள் ஓட்டுநர் சோதனையைத் தொடங்குங்கள். பாதுகாப்பான வேகத்தை பராமரிக்கவும்.',
    mandatoryStopDurationSec: 0,
  },
  {
    id: 'cp_2',
    sequenceOrder: 2,
    checkpointType: 'LEFT_TURN',
    latitude: 13.085,
    longitude: 80.272,
    radiusMeters: 25,
    speedLimitKmh: 35,
    voicePromptEn: 'In 100 meters, take the next left turn safely. Use indicators.',
    voicePromptTa: 'அடுத்த இடதுபுறம் திரும்பவும். இன்டிகேட்டரை பயன்படுத்தவும்.',
    mandatoryStopDurationSec: 0,
  },
  {
    id: 'cp_3',
    sequenceOrder: 3,
    checkpointType: 'TRAFFIC_SIGNAL',
    latitude: 13.088,
    longitude: 80.275,
    radiusMeters: 20,
    speedLimitKmh: 30,
    voicePromptEn: 'Approaching traffic signal. Bring vehicle to a complete stop at the stop line.',
    voicePromptTa: 'போக்குவரத்து சிக்னல் வருகிறது. நிறுத்தக் கோட்டில் முழுமையாக நிறுத்தவும்.',
    mandatoryStopDurationSec: 5,
  },
  {
    id: 'cp_4',
    sequenceOrder: 4,
    checkpointType: 'RIGHT_TURN',
    latitude: 13.091,
    longitude: 80.273,
    radiusMeters: 25,
    speedLimitKmh: 40,
    voicePromptEn: 'Take the next right turn safely.',
    voicePromptTa: 'அடுத்த வலதுபுறம் பாதுகாப்பாக திரும்பவும்.',
    mandatoryStopDurationSec: 0,
  },
  {
    id: 'cp_5',
    sequenceOrder: 5,
    checkpointType: 'REVERSE_PARK',
    latitude: 13.094,
    longitude: 80.271,
    radiusMeters: 20,
    speedLimitKmh: 15,
    voicePromptEn: 'Perform reverse parking between marked boundaries safely.',
    voicePromptTa: 'குறிக்கப்பட்ட எல்லைகளுக்கு இடையே ரிவர்ஸ் பார்க்கிங் செய்யவும்.',
    mandatoryStopDurationSec: 10,
  },
  {
    id: 'cp_6',
    sequenceOrder: 6,
    checkpointType: 'DESTINATION',
    latitude: 13.097,
    longitude: 80.269,
    radiusMeters: 30,
    speedLimitKmh: 20,
    voicePromptEn: 'You have reached the final destination. Bring vehicle to a complete halt.',
    voicePromptTa: 'இறுதி இலக்கை அடைந்துவிட்டீர்கள். வாகனத்தை முழுமையாக நிறுத்தவும்.',
    mandatoryStopDurationSec: 0,
  },
];

const LiveDrivingTestScreen = ({ navigation, route }: any) => {
  const { theme, isDark } = useAppTheme();
  const fonts = theme.fonts as any;
  const { t } = useTranslation();

  const mapRef = useRef<MapView>(null);
  const isFocused = useIsFocused();
  const [isAppForeground] = useState(true);

  // Dual Camera & Video Recording States (Native Android Camera2 + iOS VisionCamera fallback)
  const frontDevice = useCameraDevice('front');
  const frontCameraRef = useRef<Camera>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [frontRecActive, setFrontRecActive] = useState(false);
  const [rearRecActive, setRearRecActive] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const isRecordingRef = useRef(false);
  const isCompletingRef = useRef(false);
  const iosFinalizeResolverRef = useRef<((path: string | null) => void) | null>(null);
  const recordedVideoPathRef = useRef<string | null>(null);
  const [isPipMinimized, setIsPipMinimized] = useState(false);

  // Draggable Front Camera PiP Position & Bounds (UI-thread Reanimated + Gesture Handler)
  const insets = useSafeAreaInsets();
  const windowDims = useWindowDimensions();
  const [containerSize, setContainerSize] = useState({
    width: windowDims.width,
    height: windowDims.height,
  });

  const defaultPipX = 16;
  const defaultPipY = Math.max(insets.top + 92, 138);

  const pipX = useSharedValue(defaultPipX);
  const pipY = useSharedValue(defaultPipY);
  const pipStartX = useSharedValue(defaultPipX);
  const pipStartY = useSharedValue(defaultPipY);
  const isPipDragging = useSharedValue(false);

  const getPipBounds = useCallback(
    (minimized: boolean) => {
      const w = minimized ? PIP_MIN_WIDTH : PIP_WIDTH;
      const h = minimized ? PIP_MIN_HEIGHT : PIP_HEIGHT;
      const minX = PIP_EDGE_MARGIN;
      const maxX = Math.max(minX, containerSize.width - w - PIP_EDGE_MARGIN);
      const minY = Math.max(insets.top + 8, PIP_EDGE_MARGIN);
      const maxY = Math.max(minY, containerSize.height - insets.bottom - h - PIP_EDGE_MARGIN);
      return { minX, maxX, minY, maxY };
    },
    [containerSize.width, containerSize.height, insets.top, insets.bottom]
  );

  const pipBounds = useSharedValue(getPipBounds(false));

  useEffect(() => {
    const bounds = getPipBounds(isPipMinimized);
    pipBounds.value = bounds;

    const clampedX = Math.min(Math.max(pipX.value, bounds.minX), bounds.maxX);
    const clampedY = Math.min(Math.max(pipY.value, bounds.minY), bounds.maxY);
    if (clampedX !== pipX.value) {
      pipX.value = withSpring(clampedX, { damping: 20, stiffness: 220 });
    }
    if (clampedY !== pipY.value) {
      pipY.value = withSpring(clampedY, { damping: 20, stiffness: 220 });
    }
  }, [isPipMinimized, getPipBounds, pipBounds, pipX, pipY]);

  useEffect(() => {
    let mounted = true;
    storage.get(PIP_POS_STORAGE_KEY).then((saved) => {
      if (!mounted) return;
      if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
        const bounds = getPipBounds(isPipMinimized);
        pipX.value = Math.min(Math.max(saved.x, bounds.minX), bounds.maxX);
        pipY.value = Math.min(Math.max(saved.y, bounds.minY), bounds.maxY);
      }
    });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistPipPosition = useCallback((x: number, y: number) => {
    storage.set(PIP_POS_STORAGE_KEY, { x: Math.round(x), y: Math.round(y) });
  }, []);

  const pipPanGesture = Gesture.Pan()
    .minDistance(8)
    .onStart(() => {
      pipStartX.value = pipX.value;
      pipStartY.value = pipY.value;
      isPipDragging.value = true;
    })
    .onUpdate((event) => {
      const bounds = pipBounds.value;
      const nextX = pipStartX.value + event.translationX;
      const nextY = pipStartY.value + event.translationY;
      pipX.value = Math.min(Math.max(nextX, bounds.minX), bounds.maxX);
      pipY.value = Math.min(Math.max(nextY, bounds.minY), bounds.maxY);
    })
    .onEnd(() => {
      const bounds = pipBounds.value;
      const finalX = Math.min(Math.max(pipX.value, bounds.minX), bounds.maxX);
      const finalY = Math.min(Math.max(pipY.value, bounds.minY), bounds.maxY);
      pipX.value = finalX;
      pipY.value = finalY;
      runOnJS(persistPipPosition)(finalX, finalY);
    })
    .onFinalize(() => {
      isPipDragging.value = false;
    });

  const pipAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: pipX.value },
      { translateY: pipY.value },
      { scale: withSpring(isPipDragging.value ? 1.04 : 1, { damping: 18, stiffness: 250 }) },
    ],
    borderColor: isPipDragging.value ? '#3B82F6' : 'rgba(255, 255, 255, 0.28)',
  }));

  // Test State
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const sessionStartMsRef = useRef<number>(Date.now());
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<TelemetryPoint>({
    timestamp: Date.now(),
    latitude: 13.0827,
    longitude: 80.2707,
    speedKmh: 0,
    heading: 0,
    accuracy: 5,
  });

  const [activeCheckpoint, setActiveCheckpoint] = useState<RouteCheckpoint | null>(MOCK_CHECKPOINTS[0]);
  const [activeCheckpointIndex, setActiveCheckpointIndex] = useState(0);
  const [language, setLanguage] = useState<VoiceLanguage>('en');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [showAbortModal, setShowAbortModal] = useState(false);

  const user = useSelector((state: RootState) => state.userSlice.user);
  const driverId = user?.id || user?._id || user?.driverId || '';
  const dispatch = useDispatch();

  const [startSession] = useStartDrivingTestSessionMutation();
  const [sendTelemetry] = useSendDrivingTelemetryBatchMutation();
  const [recordCheckpoint] = useRecordCheckpointArrivalMutation();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Request Camera Permission on mount
  useEffect(() => {
    (async () => {
      try {
        const camPerm = await Camera.requestCameraPermission();
        setHasCameraPermission(camPerm === 'granted');
      } catch (e) {
        console.warn('[LiveDrivingTest] Camera permission error:', e);
      }
    })();
  }, []);

  // Start Native Dual Camera Recording once permission + sessionId are ready on Android
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (!hasCameraPermission || !sessionId || isRecordingRef.current || isCompletingRef.current) return;

    let cancelled = false;
    (async () => {
      try {
        isRecordingRef.current = true;
        const startRes = await DualCameraService.startDualRecording(sessionId);
        if (cancelled) {
          await DualCameraService.cancelDualRecording();
          return;
        }
        if (startRes) {
          setIsRecordingVideo(true);
          setRearRecActive(Boolean(startRes.rearActive));
          setFrontRecActive(Boolean(startRes.frontActive));
          setRecordingError(null);
          console.log('[LiveDrivingTest] 📹 Native dual recording active:', startRes);
        }
      } catch (err: any) {
        isRecordingRef.current = false;
        setIsRecordingVideo(false);
        setRearRecActive(false);
        setFrontRecActive(false);
        setRecordingError(err?.message || 'Camera failed to start');
        console.warn('[LiveDrivingTest] Native dual recording start failed:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasCameraPermission, sessionId]);

  // iOS VisionCamera recording starter (Android uses DualCameraService above)
  const startIosVideoRecording = async () => {
    if (Platform.OS === 'android') return;
    if (frontCameraRef.current && !isRecordingRef.current && hasCameraPermission) {
      try {
        isRecordingRef.current = true;
        setIsRecordingVideo(true);
        setFrontRecActive(true);
        frontCameraRef.current.startRecording({
          fileType: 'mp4',
          videoCodec: 'h264',
          onRecordingFinished: (video) => {
            console.log('[LiveDrivingTest] 📹 iOS cabin video recorded:', video.path);
            recordedVideoPathRef.current = video.path;
            if (iosFinalizeResolverRef.current) {
              iosFinalizeResolverRef.current(video.path);
              iosFinalizeResolverRef.current = null;
            }
          },
          onRecordingError: (err) => {
            console.warn('[LiveDrivingTest] iOS video recording error:', err);
            isRecordingRef.current = false;
            setIsRecordingVideo(false);
            setFrontRecActive(false);
            if (iosFinalizeResolverRef.current) {
              iosFinalizeResolverRef.current(null);
              iosFinalizeResolverRef.current = null;
            }
          },
        });
      } catch (err) {
        console.warn('[LiveDrivingTest] Could not start iOS video recording:', err);
        isRecordingRef.current = false;
        setIsRecordingVideo(false);
        setFrontRecActive(false);
      }
    }
  };

  // Simulation Controller States (Dev / QA Testing)
  const [isSimulating, setIsSimulating] = useState(false);
  const [simSpeedMultiplier, setSimSpeedMultiplier] = useState(1);
  const [isSimOverlayExpanded, setIsSimOverlayExpanded] = useState(false);

  const handleToggleSimulation = () => {
    if (isSimulating) {
      DrivingTelemetryService.pauseSimulation();
      setIsSimulating(false);
    } else {
      DrivingTelemetryService.startSimulation(simSpeedMultiplier);
      setIsSimulating(true);
    }
  };

  const handleChangeSimSpeed = (multiplier: number) => {
    setSimSpeedMultiplier(multiplier);
    DrivingTelemetryService.setSimulationSpeed(multiplier);
    if (!isSimulating) {
      DrivingTelemetryService.startSimulation(multiplier);
      setIsSimulating(true);
    }
  };

  const handleSkipToNextCheckpoint = () => {
    DrivingTelemetryService.skipToNextCheckpoint();
  };

  const handleSimulateViolation = (type: 'HARSH_BRAKE' | 'OVERSPEED' | 'RAPID_ACCEL') => {
    DrivingTelemetryService.triggerSimulatedViolation(type);
  };

  const handleFastForwardComplete = () => {
    DrivingTelemetryService.stopSimulation();
    setIsSimulating(false);
    handleCompleteTest();
  };

  // AppState monitoring: when app returns from background, keep GPS & elapsed timer synchronized
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        DrivingTelemetryService.startTracking();
        storage.get('ACTIVE_DRIVING_TEST_SESSION').then((savedSession) => {
          if (savedSession?.startTime) {
            const actualElapsed = Math.max(0, Math.floor((Date.now() - savedSession.startTime) / 1000));
            setElapsedSeconds(actualElapsed);
          }
        });
      }
    });
    return () => subscription.remove();
  }, []);

  // Initialize Route & Telemetry Service with Cold Start Session Rehydration
  useEffect(() => {
    let currentSessionId = '';

    // Initialize or rehydrate remote session on backend
    const initRemoteSession = async () => {
      if (!driverId) return;

      try {
        // 1. Check if an active session was already in-progress before app close/reopen
        const cachedSession = await storage.get('ACTIVE_DRIVING_TEST_SESSION');
        if (cachedSession?.sessionId && cachedSession?.driverId === driverId) {
          console.log('[LiveDrivingTest] 🔄 Rehydrated existing in-progress driving session:', cachedSession.sessionId);
          currentSessionId = cachedSession.sessionId;
          sessionIdRef.current = cachedSession.sessionId;
          setSessionId(cachedSession.sessionId);
          if (cachedSession.startTime) {
            sessionStartMsRef.current = cachedSession.startTime;
            const resumedElapsed = Math.max(0, Math.floor((Date.now() - cachedSession.startTime) / 1000));
            setElapsedSeconds(resumedElapsed);
          }
          dispatch(setUser({ onboarding_status: 'DRIVING_TEST_IN_PROGRESS' }));
          return;
        }

        // 2. Determine concurrency dynamically (or use compatibility check param)
        let concurrentSupported = route?.params?.supportsConcurrentCamera;
        let deviceModel = route?.params?.deviceModel || Platform.OS;
        if (concurrentSupported === undefined) {
          try {
            const compat = await DualCameraService.checkCompatibility();
            concurrentSupported = compat.camera.supportsConcurrentCamera;
            deviceModel = compat.deviceModel || deviceModel;
          } catch {
            concurrentSupported = false;
          }
        }

        // 3. Start fresh session if none cached
        const nowMs = Date.now();
        sessionStartMsRef.current = nowMs;
        const res = await startSession({
          driverId,
          routeId: 'f208aa3e-184f-482f-aace-e96f29a312a1',
          deviceModel,
          simultaneousCameraSupported: Boolean(concurrentSupported),
        }).unwrap();

        if (res?.sessionId) {
          currentSessionId = res.sessionId;
          sessionIdRef.current = res.sessionId;
          setSessionId(res.sessionId);
          await storage.set('ACTIVE_DRIVING_TEST_SESSION', {
            sessionId: res.sessionId,
            driverId,
            routeId: res.session?.route_id || 'f208aa3e-184f-482f-aace-e96f29a312a1',
            startTime: nowMs,
          });
          dispatch(setUser({ onboarding_status: 'DRIVING_TEST_IN_PROGRESS' }));
        }
      } catch (e) {
        console.warn('[LiveDrivingTest] Could not start remote session, running local mode:', e);
      }
    };
    initRemoteSession();

    DrivingTelemetryService.setRouteCheckpoints(MOCK_CHECKPOINTS);
    DrivingTelemetryService.startTracking();

    // Telemetry streaming interval: sends batch to backend every 5 seconds
    const telemetryInterval = setInterval(() => {
      const activeId = sessionIdRef.current || currentSessionId;
      if (activeId) {
        const batch = DrivingTelemetryService.flushTelemetryBatch();
        if (batch.length > 0) {
          sendTelemetry({ sessionId: activeId, telemetryPoints: batch });
        }
      }
    }, 5000);

    // Initial voice instruction
    const initialPrompt =
      language === 'ta' ? MOCK_CHECKPOINTS[0].voicePromptTa : MOCK_CHECKPOINTS[0].voicePromptEn;
    VoiceGuidanceService.speak(initialPrompt, { force: true });

    // Listen to GPS location updates
    const removeLocationListener = DrivingTelemetryService.onLocationUpdate((point) => {
      setCurrentLocation(point);
      setCurrentSpeed(point.speedKmh);

      // Animate map camera smoothly
      mapRef.current?.animateCamera({
        center: { latitude: point.latitude, longitude: point.longitude },
        heading: point.heading,
        pitch: 45,
        zoom: 17,
      });
    });

    // Listen to Checkpoint Reached events
    const removeCheckpointListener = DrivingTelemetryService.onCheckpointReached((cp, nextIndex) => {
      setActiveCheckpointIndex(nextIndex + 1);

      // Record Checkpoint on backend
      const activeId = sessionIdRef.current || currentSessionId;
      if (activeId) {
        recordCheckpoint({
          sessionId: activeId,
          checkpointId: cp.id,
          reachedAt: cp.reachedAt || Date.now(),
          speedKmh: Math.round(pointSpeedRef.current),
        });
      }

      const nextCp = MOCK_CHECKPOINTS[nextIndex + 1];
      if (nextCp) {
        setActiveCheckpoint(nextCp);
        const prompt = language === 'ta' ? nextCp.voicePromptTa : nextCp.voicePromptEn;
        VoiceGuidanceService.speak(prompt, { force: true });
      } else {
        // All checkpoints completed!
        VoiceGuidanceService.speak(
          language === 'ta'
            ? 'அனைத்து சோதனைகளும் நிறைவடைந்தது. சோதனை வெற்றிகரமாக முடிந்தது.'
            : 'All test checkpoints completed. Finalizing driving assessment.',
          { force: true }
        );
        setTimeout(() => {
          handleCompleteTestRef.current();
        }, 2000);
      }
    });

    // Listen to Driving Violation Events
    const removeEventListener = DrivingTelemetryService.onEventTriggered((ev: DrivingEvent) => {
      if (ev.type === 'OVERSPEED') {
        VoiceGuidanceService.speak(
          language === 'ta' ? 'வேக வரம்பை மீறாதீர்கள். வேகத்தை குறைக்கவும்.' : 'Please reduce speed. You are exceeding the speed limit.'
        );
      } else if (ev.type === 'HARSH_BRAKE') {
        VoiceGuidanceService.speak(
          language === 'ta' ? 'திடீர் பிரேக் பதிவு செய்யப்பட்டது.' : 'Harsh braking detected. Maintain smooth deceleration.'
        );
      }
    });

    // Timer Interval
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(timer);
      clearInterval(telemetryInterval);
      removeLocationListener();
      removeCheckpointListener();
      removeEventListener();
      DrivingTelemetryService.stopSimulation();
      DrivingTelemetryService.stopTracking();
      VoiceGuidanceService.stop();
      if (!isCompletingRef.current && Platform.OS === 'android') {
        DualCameraService.cancelDualRecording();
      }
    };
  }, []);

  const pointSpeedRef = useRef(0);
  pointSpeedRef.current = currentSpeed;

  const toggleLanguage = () => {
    const nextLang = language === 'en' ? 'ta' : 'en';
    setLanguage(nextLang);
    VoiceGuidanceService.setLanguage(nextLang);
  };

  const toggleAudio = () => {
    const nextMuted = !isAudioMuted;
    setIsAudioMuted(nextMuted);
    VoiceGuidanceService.setMuted(nextMuted);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCompleteTest = async () => {
    if (isCompletingRef.current) return;
    isCompletingRef.current = true;

    DrivingTelemetryService.stopTracking();
    VoiceGuidanceService.stop();

    const activeId = sessionIdRef.current || sessionId;
    if (activeId) {
      try {
        const remainingBatch = DrivingTelemetryService.flushTelemetryBatch();
        if (remainingBatch.length > 0) {
          await sendTelemetry({ sessionId: activeId, telemetryPoints: remainingBatch });
        }
      } catch (e) {
        console.warn('[LiveDrivingTest] Final telemetry flush warning:', e);
      }
    }

    let rearVideoPath: string | null = null;
    let rearFileSizeBytes = 0;
    let frontVideoPath: string | null = null;
    let frontFileSizeBytes = 0;
    let recordingDurationMs = 0;

    if (Platform.OS === 'android') {
      try {
        const recResult = await DualCameraService.stopDualRecording();
        if (recResult) {
          rearVideoPath = recResult.rearVideoPath;
          rearFileSizeBytes = recResult.rearFileSizeBytes || 0;
          frontVideoPath = recResult.frontVideoPath;
          frontFileSizeBytes = recResult.frontFileSizeBytes || 0;
          recordingDurationMs = recResult.durationMs || 0;
        }
      } catch (e) {
        console.warn('[LiveDrivingTest] Native stopDualRecording error:', e);
      }
    } else if (frontCameraRef.current && isRecordingRef.current) {
      try {
        const finalizedPath = await new Promise<string | null>((resolve) => {
          iosFinalizeResolverRef.current = resolve;
          setTimeout(() => {
            if (iosFinalizeResolverRef.current === resolve) {
              iosFinalizeResolverRef.current = null;
              resolve(recordedVideoPathRef.current);
            }
          }, 5000);
          frontCameraRef.current?.stopRecording().catch(() => {
            resolve(recordedVideoPathRef.current);
          });
        });
        frontVideoPath = finalizedPath || recordedVideoPathRef.current;
      } catch (e) {
        console.warn('[LiveDrivingTest] iOS stopRecording error:', e);
      }
    }

    isRecordingRef.current = false;
    setIsRecordingVideo(false);
    setFrontRecActive(false);
    setRearRecActive(false);

    const actualElapsedSeconds = Math.max(
      1,
      Math.floor((Date.now() - sessionStartMsRef.current) / 1000)
    );

    await storage.remove('ACTIVE_DRIVING_TEST_SESSION');
    navigation.replace(DrivingTestCompletion_Nav, {
      sessionId: activeId,
      driverId,
      elapsedSeconds: actualElapsedSeconds,
      checkpointsCompleted: DrivingTelemetryService.getAllCheckpoints(),
      events: DrivingTelemetryService.getEventLogs(),
      rearVideoPath,
      rearFileSizeBytes,
      frontVideoPath,
      frontFileSizeBytes,
      recordingDurationMs: recordingDurationMs || actualElapsedSeconds * 1000,
    });
  };

  const handleCompleteTestRef = useRef(handleCompleteTest);
  handleCompleteTestRef.current = handleCompleteTest;

  const handleConfirmAbort = async () => {
    setShowAbortModal(false);
    isCompletingRef.current = true;
    DrivingTelemetryService.stopTracking();
    VoiceGuidanceService.stop();

    if (Platform.OS === 'android') {
      await DualCameraService.cancelDualRecording();
    } else if (frontCameraRef.current && isRecordingRef.current) {
      try {
        await frontCameraRef.current.stopRecording();
      } catch (e) {
        console.warn('[LiveDrivingTest] Stop recording error on abort:', e);
      }
    }

    isRecordingRef.current = false;
    setIsRecordingVideo(false);
    setFrontRecActive(false);
    setRearRecActive(false);

    await storage.remove('ACTIVE_DRIVING_TEST_SESSION');
    dispatch(setUser({ onboarding_status: 'DRIVING_TEST_INTRO' }));
    navigation.navigate(DrivingTestIntro_Nav);
  };

  return (
    <SafeAreaView
      style={styles.container}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) {
          setContainerSize((prev) =>
            prev.width === width && prev.height === height ? prev : { width, height }
          );
        }
      }}
    >
      {/* FULL-SCREEN LIVE MAP */}
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        }}
        showsUserLocation
        followsUserLocation
        showsCompass={false}
      >
        {/* ROUTE POLYLINE */}
        <Polyline
          coordinates={MOCK_CHECKPOINTS.map((cp) => ({
            latitude: cp.latitude,
            longitude: cp.longitude,
          }))}
          strokeColor="#2563EB"
          strokeWidth={5}
        />

        {/* CHECKPOINT MARKERS */}
        {MOCK_CHECKPOINTS.map((cp, idx) => (
          <Marker
            key={cp.id}
            coordinate={{ latitude: cp.latitude, longitude: cp.longitude }}
            title={`Checkpoint ${idx + 1}`}
            description={cp.checkpointType}
            pinColor={idx < activeCheckpointIndex ? '#10B981' : idx === activeCheckpointIndex ? '#2563EB' : '#94A3B8'}
          />
        ))}
      </MapView>

      {/* TOP FLOATING HUD: CAMERA RECORDING STATUS & TIMER */}
      <View style={styles.topHud}>
        {/* DUAL CAMERA STATUS PILLS */}
        <View style={styles.recordingPillsRow}>
          <View
            style={[
              styles.recBadge,
              !frontRecActive && { borderColor: '#64748B', opacity: 0.75 },
            ]}
          >
            <View
              style={[
                styles.recDot,
                !frontRecActive && { backgroundColor: '#94A3B8' },
              ]}
            />
            <Text style={styles.recText}>{frontRecActive ? 'FRONT REC' : 'FRONT OFF'}</Text>
          </View>
          <View
            style={[
              styles.recBadge,
              { marginLeft: 8 },
              !rearRecActive && { borderColor: '#64748B', opacity: 0.75 },
            ]}
          >
            <View
              style={[
                styles.recDot,
                !rearRecActive && { backgroundColor: '#94A3B8' },
              ]}
            />
            <Text style={styles.recText}>{rearRecActive ? 'REAR REC' : 'REAR OFF'}</Text>
          </View>
        </View>

        {/* DURATION TIMER & CONTROLS */}
        <View style={styles.timerControlsRow}>
          <View style={styles.timerBadge}>
            <Ionicons name="time-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.timerText}>{formatTime(elapsedSeconds)}</Text>
          </View>

          {/* AUDIO LANGUAGE TOGGLE */}
          <TouchableOpacity style={styles.hudActionBtn} onPress={toggleLanguage}>
            <Text style={styles.langToggleText}>{language.toUpperCase()}</Text>
          </TouchableOpacity>

          {/* AUDIO MUTE TOGGLE */}
          <TouchableOpacity style={styles.hudActionBtn} onPress={toggleAudio}>
            <Ionicons name={isAudioMuted ? 'volume-mute' : 'volume-high'} size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 🛠️ DEV / QA AUTO-SIMULATION OVERLAY (TEMPORARY DEV TOOLBAR) */}
      <View style={styles.devSimOverlayContainer} pointerEvents="box-none">
        {!isSimOverlayExpanded ? (
          <TouchableOpacity
            style={[styles.devSimPill, isSimulating && styles.devSimPillActive]}
            activeOpacity={0.8}
            onPress={() => setIsSimOverlayExpanded(true)}
          >
            <View style={[styles.devSimDot, { backgroundColor: isSimulating ? '#10B981' : '#F59E0B' }]} />
            <Ionicons name="car-sport" size={13} color="#FFF" style={{ marginRight: 4 }} />
            <Text style={styles.devSimPillText}>
              {isSimulating ? `SIM AUTO-DRIVE (${simSpeedMultiplier}x)` : 'TEST SIMULATOR'}
            </Text>
            <Ionicons name="chevron-down" size={13} color="#94A3B8" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        ) : (
          <View style={[styles.devSimCard, { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(30, 41, 59, 0.96)' }]}>
            {/* Header */}
            <View style={styles.devSimCardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="speedometer" size={15} color="#10B981" style={{ marginRight: 6 }} />
                <Text style={styles.devSimTitle}>Driving Test Simulator (QA/Dev)</Text>
              </View>
              <TouchableOpacity onPress={() => setIsSimOverlayExpanded(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Status Info */}
            <Text style={styles.devSimStatusText}>
              Target: CP {activeCheckpointIndex + 1}/{MOCK_CHECKPOINTS.length} ({activeCheckpoint?.checkpointType})
            </Text>

            {/* Row 1: Play/Pause & Speed Buttons */}
            <View style={styles.devSimRow}>
              <TouchableOpacity
                style={[styles.devSimBtn, isSimulating ? styles.devSimPauseBtn : styles.devSimPlayBtn]}
                onPress={handleToggleSimulation}
                activeOpacity={0.8}
              >
                <Ionicons name={isSimulating ? 'pause' : 'play'} size={13} color="#FFF" style={{ marginRight: 4 }} />
                <Text style={styles.devSimBtnText}>{isSimulating ? 'Pause Drive' : 'Auto Drive'}</Text>
              </TouchableOpacity>

              <View style={styles.devSpeedGroup}>
                {[1, 2, 5].map((spd) => (
                  <TouchableOpacity
                    key={spd}
                    style={[styles.devSpeedChip, simSpeedMultiplier === spd && styles.devSpeedChipActive]}
                    onPress={() => handleChangeSimSpeed(spd)}
                  >
                    <Text style={[styles.devSpeedText, simSpeedMultiplier === spd && styles.devSpeedTextActive]}>
                      {spd}x
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Row 2: Checkpoint Jump & Instant Finish */}
            <View style={[styles.devSimRow, { marginTop: 8 }]}>
              <TouchableOpacity
                style={[styles.devSimActionBtn, { backgroundColor: 'rgba(59, 130, 246, 0.25)', borderColor: '#3B82F6' }]}
                onPress={handleSkipToNextCheckpoint}
              >
                <Ionicons name="play-forward" size={13} color="#60A5FA" style={{ marginRight: 4 }} />
                <Text style={[styles.devSimActionText, { color: '#60A5FA' }]}>Skip to Next CP</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.devSimActionBtn, { backgroundColor: 'rgba(16, 185, 129, 0.25)', borderColor: '#10B981' }]}
                onPress={handleFastForwardComplete}
              >
                <Ionicons name="checkmark-done" size={13} color="#34D399" style={{ marginRight: 4 }} />
                <Text style={[styles.devSimActionText, { color: '#34D399' }]}>Instant Finish</Text>
              </TouchableOpacity>
            </View>

            {/* Row 3: Violation Injections */}
            <View style={[styles.devSimRow, { marginTop: 8 }]}>
              <TouchableOpacity
                style={[styles.devSimViolationBtn, { borderColor: '#F59E0B' }]}
                onPress={() => handleSimulateViolation('OVERSPEED')}
              >
                <Text style={[styles.devSimViolationText, { color: '#FBBF24' }]}>+25km/h Speed</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.devSimViolationBtn, { borderColor: '#EF4444' }]}
                onPress={() => handleSimulateViolation('HARSH_BRAKE')}
              >
                <Text style={[styles.devSimViolationText, { color: '#F87171' }]}>Harsh Brake</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.devSimViolationBtn, { borderColor: '#A855F7' }]}
                onPress={() => handleSimulateViolation('RAPID_ACCEL')}
              >
                <Text style={[styles.devSimViolationText, { color: '#C084FC' }]}>Rapid Accel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* FLOATING DRAGGABLE FRONT CAMERA (CABIN VIEW) PiP */}
      <GestureDetector gesture={pipPanGesture}>
        <Animated.View
          style={[
            styles.pipContainer,
            isPipMinimized && styles.pipContainerMinimized,
            pipAnimatedStyle,
          ]}
        >
          {Platform.OS === 'android' ? (
            hasCameraPermission && DualCameraPreview ? (
              <DualCameraPreview
                style={isPipMinimized ? { width: 1, height: 1, opacity: 0 } : StyleSheet.absoluteFill}
              />
            ) : (
              <View style={styles.pipFallbackBox}>
                <Ionicons name="videocam-outline" size={22} color="#94A3B8" />
                <Text style={styles.pipFallbackText}>
                  {recordingError ? 'Cam Err' : 'Cabin Cam'}
                </Text>
              </View>
            )
          ) : frontDevice && hasCameraPermission ? (
            <Camera
              ref={frontCameraRef}
              style={StyleSheet.absoluteFill}
              device={frontDevice}
              isActive={isFocused && isAppForeground}
              video={true}
              audio={false}
              onInitialized={() => {
                console.log('[LiveDrivingTest] iOS Front camera initialized');
                startIosVideoRecording();
              }}
              onError={(err) => {
                console.warn('[LiveDrivingTest] iOS Front camera error:', err);
              }}
            />
          ) : (
            <View style={styles.pipFallbackBox}>
              <Ionicons name="videocam-outline" size={22} color="#94A3B8" />
              <Text style={styles.pipFallbackText}>Cabin Cam</Text>
            </View>
          )}

          {/* Fallback overlay if dual camera is single-rear only mode */}
          {Platform.OS === 'android' && isRecordingVideo && !frontRecActive && !isPipMinimized && (
            <View style={styles.pipFallbackBox} pointerEvents="none">
              <Ionicons name="videocam-off-outline" size={20} color="#94A3B8" />
              <Text style={styles.pipFallbackText}>Rear Mode Only</Text>
            </View>
          )}

          {/* PiP Header Pill */}
          <View style={styles.pipHeader}>
            <View style={styles.pipRecPill}>
              <View style={[styles.pipRecDot, frontRecActive && styles.pipRecDotActive]} />
              <Text style={styles.pipRecText}>
                {isPipMinimized
                  ? isRecordingVideo
                    ? 'REC'
                    : 'CAM'
                  : frontRecActive
                  ? 'CABIN (REC)'
                  : rearRecActive
                  ? 'ROAD (REC)'
                  : 'CABIN'}
              </Text>
            </View>
            <GHTouchableOpacity
              style={styles.pipMinBtn}
              onPress={() => setIsPipMinimized((prev) => !prev)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isPipMinimized ? 'scan-outline' : 'contract-outline'}
                size={12}
                color="#FFF"
              />
            </GHTouchableOpacity>
          </View>

          {/* Subtle bottom drag handle indicator when expanded */}
          {!isPipMinimized && (
            <View style={styles.pipDragHandleContainer} pointerEvents="none">
              <View style={styles.pipDragHandleBar} />
            </View>
          )}
        </Animated.View>
      </GestureDetector>

      {/* CENTER RIGHT: SPEEDOMETER GAUGE */}
      <View style={styles.speedometerContainer}>
        <Text style={[fonts.bold, styles.speedValue]}>{Math.round(currentSpeed)}</Text>
        <Text style={styles.speedUnit}>KM/H</Text>
        <View style={styles.speedLimitBadge}>
          <Text style={styles.speedLimitText}>LIMIT {activeCheckpoint?.speedLimitKmh || 40}</Text>
        </View>
      </View>

      {/* BOTTOM FLOATING INSTRUCTION CARD */}
      <View style={styles.bottomHud}>
        <View style={[styles.instructionCard, { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)' }]}>
          {/* STEP NUMBER & ICON */}
          <View style={styles.instructionTopRow}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>
                CHECKPOINT {activeCheckpointIndex + 1}/{MOCK_CHECKPOINTS.length}
              </Text>
            </View>
            <TouchableOpacity style={styles.abortBtn} onPress={() => setShowAbortModal(true)}>
              <Ionicons name="power" size={16} color="#EF4444" style={{ marginRight: 4 }} />
              <Text style={styles.abortBtnText}>Emergency Stop</Text>
            </TouchableOpacity>
          </View>

          {/* INSTRUCTION TEXT */}
          <Text style={[fonts.bold, styles.instructionTitle, { color: theme.colors.text }]}>
            {language === 'ta' ? activeCheckpoint?.voicePromptTa : activeCheckpoint?.voicePromptEn}
          </Text>

          {/* PROGRESS BAR */}
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${((activeCheckpointIndex + 1) / MOCK_CHECKPOINTS.length) * 100}%` },
              ]}
            />
          </View>
        </View>
      </View>

      {/* EMERGENCY STOP MODAL */}
      <Modal visible={showAbortModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <Ionicons name="alert-circle" size={48} color="#EF4444" style={{ alignSelf: 'center', marginBottom: 12 }} />
            <Text style={[fonts.bold, styles.modalTitle, { color: theme.colors.text }]}>
              {t('emergency_stop_title', 'Emergency Stop Driving Test?')}
            </Text>
            <Text style={[styles.modalDesc, { color: isDark ? '#94A3B8' : '#6B7280' }]}>
              {t(
                'emergency_stop_desc',
                'Please bring the vehicle to a safe, complete stop on the side of the road before exiting the test.'
              )}
            </Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowAbortModal(false)}>
                <Text style={styles.modalCancelText}>{t('resume', 'Resume Test')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalAbortBtn} onPress={handleConfirmAbort}>
                <Text style={styles.modalAbortText}>{t('abort_test', 'End Test')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default LiveDrivingTestScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  topHud: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  pipContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: PIP_WIDTH,
    height: PIP_HEIGHT,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 10,
  },
  pipContainerMinimized: {
    width: PIP_MIN_WIDTH,
    height: PIP_MIN_HEIGHT,
  },
  pipDragHandleContainer: {
    position: 'absolute',
    bottom: 5,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
  pipDragHandleBar: {
    width: 28,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
  },
  pipFallbackBox: {
    flex: 1,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pipFallbackText: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
  },
  pipHeader: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  pipRecPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 10,
  },
  pipRecDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94A3B8',
    marginRight: 4,
  },
  pipRecDotActive: {
    backgroundColor: '#EF4444',
  },
  pipRecText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  pipMinBtn: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    padding: 3,
    borderRadius: 10,
  },
  recordingPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 6,
  },
  recText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  timerControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  timerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  hudActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  langToggleText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  speedometerContainer: {
    position: 'absolute',
    right: 16,
    top: 120,
    width: 80,
    height: 90,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderWidth: 1.5,
    borderColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  speedValue: {
    color: '#FFFFFF',
    fontSize: 28,
  },
  speedUnit: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '700',
    marginTop: -2,
  },
  speedLimitBadge: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#EF4444',
  },
  speedLimitText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
  },
  bottomHud: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  instructionCard: {
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  instructionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stepBadgeText: {
    color: '#4F46E5',
    fontSize: 10,
    fontWeight: '700',
  },
  abortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
  },
  abortBtnText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '600',
  },
  instructionTitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  progressBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    padding: 20,
    borderRadius: 16,
  },
  modalTitle: {
    fontSize: 17,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  modalCancelText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  modalAbortBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  modalAbortText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  devSimOverlayContainer: {
    position: 'absolute',
    top: 96,
    left: 16,
    right: 16,
    zIndex: 15,
  },
  devSimPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  devSimPillActive: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(6, 78, 59, 0.88)',
  },
  devSimDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  devSimPillText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  devSimCard: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  devSimCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  devSimTitle: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  devSimStatusText: {
    color: '#94A3B8',
    fontSize: 11,
    marginBottom: 8,
  },
  devSimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  devSimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  devSimPlayBtn: {
    backgroundColor: '#2563EB',
  },
  devSimPauseBtn: {
    backgroundColor: '#D97706',
  },
  devSimBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  devSpeedGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  devSpeedChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  devSpeedChipActive: {
    backgroundColor: '#2563EB',
  },
  devSpeedText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  devSpeedTextActive: {
    color: '#FFF',
  },
  devSimActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  devSimActionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  devSimViolationBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  devSimViolationText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
