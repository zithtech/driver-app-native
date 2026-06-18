import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Image,
  BackHandler,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation, useFocusEffect, StackActions } from '@react-navigation/native';
import ImagePicker from 'react-native-image-crop-picker';
import { useSelector, useDispatch } from 'react-redux';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  withDelay,
  FadeInDown,
  Layout,
  ZoomIn,
} from 'react-native-reanimated';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useHaptic } from '../../hooks/useHaptic';
import LinearGradient from 'react-native-linear-gradient';
// import { interpolate, Extrapolate } from 'react-native-reanimated';

import { useAppTheme } from '../../context/ThemeContext';
import AppStatusBar from '../../Components/AppStatusBar';
import { useAlert } from '../../context/AlertContext';
import { vS as vs, mS as ms } from '../../lib/scale';
import { RootState } from '../../redux/store';
import { useGetDocUploadUrlMutation, useSubmitTripPhotosMutation, useGetTripVerificationStatusQuery, useStartTripMutation } from '../../service/driverApi';
import { documentApi } from '../../api/documentApi';
import { clearAcceptedRide } from '../../redux/rideSlice';
import socketService from '../../service/socketService';
import audioService from '../../utils/audioService';
import { checkCameraPermission, goToSettings } from '../../utils/permissionUtils';

// const { width } = Dimensions.get('window');

/* ================= TYPES ================= */

type PhotoKey = 'front' | 'back' | 'left' | 'right';

type Status =
  | 'COLLECTING'
  | 'VERIFYING'
  | 'APPROVED'
  | 'REJECTED';

/* ================= CONSTANTS ================= */

const PRIMARY_COLOR = '#152D5E';
const SCREENSHOT_GREEN = '#32a852';
// const SUCCESS_LIGHT_BG = '#F9FAFB'; // Lite neutral gray instead of green
// const SUCCESS_BORDER = '#E5E7EB';
const SUBMIT_TIME_LIMIT = 10 * 60;


/* ================= SCREEN ================= */

const VehicleVerificationScreen = ({ route }: any) => {
  const rideFromStore = useSelector((state: RootState) => state.ride.currentRide);
  const ride = rideFromStore || route.params?.ride || {};
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { theme, isDark } = useAppTheme();
  const { showAlert } = useAlert();
  const { triggerHaptic } = useHaptic();
  const user = useSelector((state: RootState) => state.userSlice.user);
  const dispatch = useDispatch();

  // 🛡️ Guard: Exit screen if ride is cleared from Redux (e.g. by global cancellation)
  useEffect(() => {
    if (!rideFromStore) {
      console.log('[VehicleVerification] ❌ Active ride cleared from Redux, exiting...');
      navigation.dispatch(StackActions.replace('DashboardScreen'));
    } else {
      console.log('[VehicleVerification] ✅ Active ride present in Redux. Status:', rideFromStore?.trip_status);
    }
  }, [rideFromStore, navigation]);


  /* ================= STATE ================= */

  const [selfieTaken, setSelfieTaken] = useState(false);

  // 🛡️ Navigation Guard: Prevent back button during verification
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        showAlert({
          title: t('verification_required'),
          message: t('verification_required_msg'),
          singleButton: true,
          icon: 'information-circle-outline',
        });
        return true; // Prevent default behavior
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      navigation.setOptions({ gestureEnabled: false });

      return () => {
        subscription.remove();
        navigation.setOptions({ gestureEnabled: true });
      };
    }, [navigation])
  );
  const [vehiclePhotos, setVehiclePhotos] = useState<Record<string, boolean>>({
    front: false,
    back: false,
    left: false,
    right: false,
  });

  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [vehicleUris, setVehicleUris] = useState<Record<string, string | null>>({
    front: null,
    back: null,
    left: null,
    right: null,
  });

  const [status, setStatus] = useState<Status>('COLLECTING');
  const [timeLeft, setTimeLeft] = useState(SUBMIT_TIME_LIMIT);
  const [showGuidelines, setShowGuidelines] = useState(false);

  // API Mutations (moved below state because of 'status' dependency)
  const [getUploadUrl] = useGetDocUploadUrlMutation();
  const [submitTripPhotos] = useSubmitTripPhotosMutation();

  // Theme-aware colors
  const bgColor = isDark ? '#121212' : '#F9FBFE';
  const cardBg = isDark ? '#1E1E1E' : '#FFF';
  const borderColorTheme = isDark ? '#2D2D2D' : '#F3F4F6';
  const textPrimary = isDark ? '#F9FAFB' : '#1F2937';
  const textSecondary = isDark ? '#9CA3AF' : '#6B7280';
  const subBg = isDark ? '#2D2D2D' : '#F9FAFB';
  const dividerColor = isDark ? '#2D2D2D' : '#E5E7EB';

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 🛡️ State Recovery: Check if there's already a pending verification for this trip
  const { data: verificationStatus, isLoading: isStatusLoading } = useGetTripVerificationStatusQuery(user?.driverId || '', {
    skip: !user?.driverId || (status !== 'COLLECTING' && status !== 'VERIFYING'),
    pollingInterval: status === 'VERIFYING' ? 3000 : 0, // Poll every 3s while verifying
  });

  useEffect(() => {
    if (verificationStatus?.data && (status === 'COLLECTING' || status === 'VERIFYING')) {
      const v = verificationStatus.data;
      const tripIdMatch = v.trip_id === ride?.trip_id;
      
      if (!tripIdMatch) return;

      if (v.status === 'pending') {
        if (status === 'COLLECTING') {
          console.log('[VehicleVerification] Recovered pending status, moving to VERIFYING');
          setStatus('VERIFYING');
        }
      } else if (v.status === 'approved') {
        console.log('[VehicleVerification] Verification approved via polling');
        setStatus('APPROVED');
        triggerHaptic(HapticFeedbackTypes.notificationSuccess);
      } else if (v.status === 'rejected') {
        console.log('[VehicleVerification] Verification rejected via polling');
        setStatus('COLLECTING');
        
        const rejectedImages = [];
        if (v.selfie_status === 'rejected') {
          rejectedImages.push(`Selfie (${v.selfie_remarks || 'No reason provided'})`);
          setSelfieTaken(false);
          setSelfieUri(null);
        }
        if (v.car_image_status === 'rejected') {
          rejectedImages.push(`Car Image (${v.car_image_remarks || 'No reason provided'})`);
          setVehiclePhotos((prev) => ({ ...prev, front: false, back: false, left: false, right: false }));
          setVehicleUris((prev) => ({ ...prev, front: null, back: null, left: null, right: null }));
        }

        if (rejectedImages.length > 0) {
          showAlert({
            title: t('verification_rejected'),
            message: `${t('please_reupload')}:\n- ${rejectedImages.join('\n- ')}`,
            singleButton: true,
            icon: 'alert-circle-outline',
          });
          triggerHaptic(HapticFeedbackTypes.notificationError);
        }
      }
    }
  }, [verificationStatus, ride?.trip_id, status, t, showAlert, triggerHaptic]);

  // --- SOCKET LISTENERS ---
  useEffect(() => {
    const handleApproved = (data: any) => {
      console.log('[VehicleVerification] Received APPROVED socket event', data);
      if (status === 'VERIFYING') {
        setStatus('APPROVED');
        triggerHaptic(HapticFeedbackTypes.notificationSuccess);
      }
    };

    const handleRejected = (data: any) => {
      console.log('[VehicleVerification] Received REJECTED socket event', data);
      if (status === 'VERIFYING') {
        setStatus('COLLECTING');
        const rejectedImages = [];
        if (data.selfie_status === 'rejected') {
          rejectedImages.push(`Selfie (${data.selfie_remarks})`);
          setSelfieTaken(false);
          setSelfieUri(null);
        }
        if (data.car_image_status === 'rejected') {
          rejectedImages.push(`Car Image (${data.car_image_remarks})`);
          setVehiclePhotos((prev) => ({ ...prev, front: false, back: false, left: false, right: false }));
          setVehicleUris((prev) => ({ ...prev, front: null, back: null, left: null, right: null }));
        }

        showAlert({
          title: t('verification_rejected'),
          message: `${t('please_reupload')}:\n- ${rejectedImages.join('\n- ')}`,
          singleButton: true,
          icon: 'alert-circle-outline',
        });
        triggerHaptic(HapticFeedbackTypes.notificationError);
      }
    };

    socketService.onTripVerificationApproved(handleApproved);
    socketService.onTripVerificationRejected(handleRejected);

    return () => {
      socketService.offTripVerificationApproved(handleApproved);
      socketService.offTripVerificationRejected(handleRejected);
    };
  }, [status, t, showAlert, triggerHaptic]);

  /* ================= TIMER ================= */

  useEffect(() => {
    if (status !== 'COLLECTING') { return; }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) { clearInterval(timerRef.current); }
          return 0;
        }
        // Haptic feedback for the last 60 seconds
        if (prev <= 60) {
          triggerHaptic(HapticFeedbackTypes.selection);
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); }
    };
  }, [status, triggerHaptic]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m < 10 ? '0' : ''}${m} : ${s < 10 ? '0' : ''}${s}`;
  };

  /* ================= HELPERS ================= */

  const vehicleCount = Object.values(vehiclePhotos).filter(Boolean).length;
  const totalSteps = 5; // Selfie + 4 Car Images
  const completedSteps = (selfieTaken ? 1 : 0) + vehicleCount;
  const donePercent = Math.round((completedSteps / totalSteps) * 100);
  const canSubmit = completedSteps === totalSteps && status === 'COLLECTING';

  /* ================= ACTIONS ================= */

  const captureSelfie = async () => {
    if (!ImagePicker) {
      showAlert({
        title: t('common.error'),
        message: t('camera_not_available'),
        singleButton: true,
        icon: 'alert-circle-outline',
      });
      return;
    }

    // --- PERMISSION CHECK ---
    const hasPermission = await checkCameraPermission();
    if (!hasPermission) {
      showAlert({
        title: t('camera_permission') || 'Camera Required',
        message: t('camera_permission_msg') || 'Please enable camera access to capture your selfie.',
        confirmText: t('go_to_settings') || 'Settings',
        onConfirm: () => goToSettings(),
        cancelText: t('cancel') || 'Cancel',
      });
      return;
    }

    try {
      const image = await ImagePicker.openCamera({
        width: 1200,
        height: 1200,
        cropping: true,
        useFrontCamera: true,
      }) as any;

      setSelfieTaken(true);
      setSelfieUri(image.path);
      triggerHaptic(HapticFeedbackTypes.selection);
    } catch (error) {
      console.log('User cancelled image picker');
    }
  };

  const captureVehicle = async (key: string) => {
    if (!selfieTaken) return;
    if (!ImagePicker) {
      showAlert({
        title: t('common.error'),
        message: t('camera_not_available'),
        singleButton: true,
        icon: 'alert-circle-outline',
      });
      return;
    }

    // --- PERMISSION CHECK ---
    const hasPermission = await checkCameraPermission();
    if (!hasPermission) {
      showAlert({
        title: t('camera_permission') || 'Camera Required',
        message: t('camera_permission_msg') || 'Please enable camera access to capture vehicle photos.',
        confirmText: t('go_to_settings') || 'Settings',
        onConfirm: () => goToSettings(),
        cancelText: t('cancel') || 'Cancel',
      });
      return;
    }

    try {
      const image = await ImagePicker.openCamera({
        width: 1200,
        height: 1200,
        cropping: true,
      }) as any;

      setVehiclePhotos(prev => ({ ...prev, [key]: true }));
      setVehicleUris(prev => ({ ...prev, [key]: image.path }));
      triggerHaptic(HapticFeedbackTypes.selection);
    } catch (error) {
      console.log('User cancelled image picker');
    }
  };

  const uploadFile = async (uri: string, type: string) => {
    if (!user?.driverId) return null;
    console.log(`[VehicleVerification] Starting upload for ${type}...`);
    try {
      // 1. Get Presigned URL
      const response = await getUploadUrl({
        driverId: user.driverId,
        documentType: type,
        contentType: 'image/jpeg',
      }).unwrap();

      const { uploadUrl, fileUrl } = response.data;

      // 2. Upload to S3
      await documentApi.uploadToS3(uploadUrl, uri, 'image/jpeg');
      console.log(`[VehicleVerification] Successfully uploaded ${type} to S3`);

      return fileUrl;
    } catch (error) {
      console.error(`Upload failed for ${type}:`, error);
      throw error;
    }
  };

  const submitAction = async () => {
    if (!user?.driverId) {
      showAlert({
        title: t('common.system_error'),
        message: t('driver_id_missing'),
        singleButton: true,
        icon: 'alert-circle-outline',
      });
      return;
    }
    if (!canSubmit) {
      const missing = [];
      if (!selfieTaken) missing.push('Driver Selfie');
      if (vehicleCount < 4) missing.push(`All 4 sides of vehicle`);
      showAlert({
        title: t('common.incomplete'),
        message: `${t('complete_all_steps')}\n- ${missing.join('\n- ')}`,
        singleButton: true,
        icon: 'information-circle-outline',
      });
      return;
    }

    setStatus('VERIFYING');
    triggerHaptic(HapticFeedbackTypes.impactMedium);
    console.log('[VehicleVerification] Starting final submission process...');

    try {
      // 1. Upload Selfie
      const selfieS3Url = await uploadFile(selfieUri!, 'trip_selfie');

      // 2. Upload Vehicle Photos
      const carImagesS3Urls: string[] = [];
      const vehicleKeys = ['front', 'back', 'left', 'right'];
      for (const key of vehicleKeys) {
        if (vehicleUris[key]) {
          const s3Url = await uploadFile(vehicleUris[key] as string, `vehicle_car_image_${key}`);
          if (s3Url) carImagesS3Urls.push(s3Url);
        }
      }

      // 3. Submit to backend
      await submitTripPhotos({
        driverId: user.driverId,
        selfie_url: selfieS3Url,
        car_image_url: carImagesS3Urls[0] || '', // Fallback to first image
        car_images: carImagesS3Urls,
        trip_id: ride?.trip_id,
      }).unwrap();
      console.log('[VehicleVerification] Submission to backend successful');

      console.log('[VehicleVerification] Submission to backend successful, waiting for admin approval via socket');

    } catch (error) {
      console.error('Final submission failed:', error);
      setStatus('COLLECTING');
      showAlert({
        title: t('upload_failed'),
        message: t('upload_failed_msg'),
        singleButton: true,
        icon: 'alert-circle-outline',
      });
    }
  };

  const startTripAction = async () => {
    navigation.replace('DropMapScreen', { ride });
  };

  /* ================= ANIMATIONS ================= */

  const glowValue = useSharedValue(0.2);
  useEffect(() => {
    glowValue.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500 }),
        withTiming(0.2, { duration: 1500 })
      ),
      -1,
      true
    );
  }, [glowValue]);

  const glowStyle = useAnimatedStyle(() => ({
    borderColor: withTiming(glowValue.value > 0.5 ? '#CBD5E1' : '#F3F4F6', { duration: 1000 }),
    backgroundColor: '#FFF', // Keep strictly white
  }));

  /* ================= RENDER ================= */
  if (isStatusLoading) {
    return (
      <View style={[styles.safe, { backgroundColor: bgColor, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
      </View>
    );
  }

  if (status === 'VERIFYING') {
    return (
      <VerifyingView
        isDark={isDark}
        bgColor={bgColor}
        textPrimary={textPrimary}
        textSecondary={textSecondary}
        subBg={subBg}
        borderColorTheme={borderColorTheme}
        cardBg={cardBg}
      />
    );
  }

  if (status === 'APPROVED') {
    return (
      <VerifiedView
        startTripAction={startTripAction}
        isDark={isDark}
        bgColor={bgColor}
        textPrimary={textPrimary}
        textSecondary={textSecondary}
        cardBg={cardBg}
        borderColorTheme={borderColorTheme}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bgColor }]} edges={['top']}>
      <AppStatusBar />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <Header
            cardBg={cardBg}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            donePercent={donePercent}
            completedSteps={completedSteps}
            totalSteps={totalSteps}
            dividerColor={dividerColor}
            borderColorTheme={borderColorTheme}
            isDark={isDark}
            t={t}
            navigation={navigation}
            ride={ride}
          />
        </Animated.View>

        <View style={styles.content}>
          <Animated.View entering={FadeInDown.delay(300).springify()}>
            <View style={[styles.timerCard, { backgroundColor: cardBg, borderColor: borderColorTheme }]}>
              <View style={[styles.timerIconBox, { backgroundColor: subBg }]}>
                <Ionicons name="timer-outline" size={ms(24)} color={textPrimary} />
              </View>
              <View style={styles.timerTextCol}>
                <Text style={[styles.timerLabel, { color: textSecondary }]} numberOfLines={1} adjustsFontSizeToFit>{t('time_remaining')}</Text>
                <Text style={[styles.timerValue, { color: textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>{formatTime(timeLeft)}</Text>
              </View>
            </View>
          </Animated.View>

          {/* MAIN ACTION CONTAINER */}
          <Animated.View entering={FadeInDown.delay(500).springify()}>
            <View style={[styles.mainActionCard, { backgroundColor: cardBg, borderColor: borderColorTheme }]}>
              {/* STEP 1: SELFIE */}
              <Animated.View style={[styles.stepSection, { backgroundColor: cardBg, borderColor: borderColorTheme }, !selfieTaken && styles.stepActive, !selfieTaken && glowStyle]}>
                <View style={styles.stepHeader}>
                  <View style={[styles.stepNumber, { backgroundColor: borderColorTheme }, selfieTaken && { backgroundColor: SCREENSHOT_GREEN }]}>
                    {selfieTaken ? (
                      <Ionicons name="checkmark" size={ms(16)} color="#FFF" />
                    ) : (
                      <Text style={[styles.stepNumberText, { color: textPrimary }]}>1</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.stepTitle, { color: textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>{t('driver_selfie')}</Text>
                    <Text style={[styles.stepSubtitle, { color: textSecondary }]}>{t('confirm_selfie_desc')}</Text>
                  </View>
                  {selfieTaken && (
                    <View style={[styles.donePillBadge, { backgroundColor: borderColorTheme }]}>
                      <Ionicons name="checkmark" size={ms(12)} color={SCREENSHOT_GREEN} />
                      <Text style={styles.donePillText}>{t('done_pill')}</Text>
                    </View>
                  )}
                </View>

                {selfieTaken ? (
                  <TouchableOpacity onPress={captureSelfie} style={[styles.successCaptureBox, { backgroundColor: subBg, borderColor: borderColorTheme }]}>
                    <View style={[styles.successAvatarCircle, { backgroundColor: cardBg }]}>
                      {selfieUri ? (
                        <Image source={{ uri: selfieUri }} style={{ width: '100%', height: '100%', borderRadius: ms(24) }} />
                      ) : (
                        <Ionicons name="person-outline" size={ms(24)} color={PRIMARY_COLOR} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.successCaptureTitle} numberOfLines={1} adjustsFontSizeToFit>{t('selfie_captured')}</Text>
                      <Text style={[styles.successCaptureSubtitle, { color: textSecondary }]}>{t('tap_to_retake')}</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={captureSelfie} style={[styles.circularCaptureCard, { backgroundColor: cardBg, borderColor: borderColorTheme }]}>
                    <View style={[styles.innerCameraIconBg, { backgroundColor: dividerColor }]}>
                      <Ionicons name="camera" size={ms(40)} color={textSecondary} />
                    </View>
                    <Text style={[styles.innerActionText, { color: textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>{t('tap_to_take_selfie')}</Text>
                    <Text style={[styles.innerSubtitleText, { color: textSecondary }]}>{t('make_sure_face_visible')}</Text>
                  </TouchableOpacity>
                )}
              </Animated.View>

              {/* THEN DIVIDER */}
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: dividerColor }]} />
                <Text style={[styles.dividerText, { color: isDark ? '#4B5563' : '#D1D5DB' }]}>{t('then_divider')}</Text>
                <View style={[styles.dividerLine, { backgroundColor: dividerColor }]} />
              </View>

              {/* STEP 2: VEHICLE PHOTOS */}
              <Animated.View style={[styles.stepSection, { backgroundColor: cardBg, borderColor: borderColorTheme }, selfieTaken && vehicleCount < 4 && styles.stepActive, selfieTaken && vehicleCount < 4 && glowStyle]}>
                <View style={styles.stepHeader}>
                  <View style={[styles.stepNumber, { backgroundColor: borderColorTheme }, vehicleCount === 4 && { backgroundColor: SCREENSHOT_GREEN }]}>
                    {vehicleCount === 4 ? (
                      <Ionicons name="checkmark" size={ms(16)} color="#FFF" />
                    ) : (
                      <Text style={[styles.stepNumberText, { color: textPrimary }]}>2</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.stepTitle, { color: textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>{t('vehicle_photos')}</Text>
                    <Text style={[styles.stepSubtitle, { color: textSecondary }]}>
                      {selfieTaken ? t('Live car photo') : t('complete_selfie_first')}
                    </Text>
                  </View>
                  {vehicleCount === 4 && (
                    <View style={[styles.donePillBadge, { backgroundColor: borderColorTheme }]}>
                      <Ionicons name="checkmark" size={ms(12)} color={SCREENSHOT_GREEN} />
                      <Text style={styles.donePillText}>Done</Text>
                    </View>
                  )}
                </View>

                {!selfieTaken ? (
                  <View style={[styles.pillLockBox, { backgroundColor: subBg }]}>
                    <Ionicons name="lock-closed" size={ms(18)} color={textSecondary} />
                    <Text style={[styles.pillLockText, { color: textSecondary }]} numberOfLines={1} adjustsFontSizeToFit>{t('take_selfie_unlock')}</Text>
                  </View>
                ) : (
                  <View style={styles.gridContainer}>
                    <View style={styles.gridRow}>
                      <PhotoItem
                        label={t('front_view') || 'Front'}
                        icon="car"
                        lib="MCI"
                        success={vehiclePhotos.front}
                        photoUri={vehicleUris.front}
                        onPress={() => captureVehicle('front')}
                        isDark={isDark}
                      />
                      <PhotoItem
                        label={t('back_view') || 'Back'}
                        icon="car"
                        lib="MCI"
                        success={vehiclePhotos.back}
                        photoUri={vehicleUris.back}
                        onPress={() => captureVehicle('back')}
                        isDark={isDark}
                      />
                    </View>
                    <View style={styles.gridRow}>
                      <PhotoItem
                        label={t('left_side') || 'Left'}
                        icon="car-side"
                        lib="MCI"
                        success={vehiclePhotos.left}
                        photoUri={vehicleUris.left}
                        onPress={() => captureVehicle('left')}
                        scaleX={-1}
                        isDark={isDark}
                      />
                      <PhotoItem
                        label={t('right_side') || 'Right'}
                        icon="car-side"
                        lib="MCI"
                        success={vehiclePhotos.right}
                        photoUri={vehicleUris.right}
                        onPress={() => captureVehicle('right')}
                        isDark={isDark}
                      />
                    </View>
                  </View>
                )}
              </Animated.View>
            </View>
          </Animated.View>

          {/* TIPS BUTTON */}
          <Animated.View entering={FadeInDown.delay(700).springify()}>
            <TouchableOpacity onPress={() => setShowGuidelines(true)} style={[styles.tipsFloatingButton, { backgroundColor: cardBg }]}>
              <View style={styles.tipsIconWrapper}>
                <Ionicons name="bulb" size={ms(18)} color="#F59E0B" />
              </View>
              <Text style={[styles.tipsTextTitle, { color: textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>{t('tips_for_faster_approval')}</Text>
            </TouchableOpacity>
          </Animated.View>

          <View style={{ height: vs(120) }} />
        </View>
      </ScrollView>

      {status === 'COLLECTING' && (
        <GlassFooter
          isDark={isDark}
          submitAction={submitAction}
          canSubmit={canSubmit}
          status={status}
          completedSteps={completedSteps}
          totalSteps={totalSteps}
          textSecondary={textSecondary}
          t={t}
        />
      )}

      {/* GUIDELINES MODAL */}
      <Modal visible={showGuidelines} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: cardBg }]}>
            <View style={[styles.modalDrag, { backgroundColor: dividerColor }]} />
            <View style={styles.modalHeaderRow}>
              <View style={[styles.modalTipIcon, { backgroundColor: isDark ? '#2D2D2D' : '#FFFBEB' }]}>
                <Ionicons name="bulb-outline" size={ms(20)} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>{t('photo_guidelines')}</Text>
                <Text style={[styles.modalSubtitle, { color: textSecondary }]}>{t('follow_for_instant_approval')}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowGuidelines(false)} style={styles.closeModalBtn}>
                <Ionicons name="close" size={ms(20)} color={textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.guidelineItems}>
              <View style={[styles.guideRow, { backgroundColor: subBg }]}>
                <View style={[styles.guideIconMain, { backgroundColor: cardBg }]}><Ionicons name="sunny-outline" size={ms(20)} color="#F59E0B" /></View>
                <View>
                  <Text style={[styles.guideLabelText, { color: textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>{t('good_lighting')}</Text>
                  <Text style={[styles.guideInfoText, { color: textSecondary }]}>{t('natural_daylight')}</Text>
                </View>
              </View>
              <View style={[styles.guideRow, { backgroundColor: subBg }]}>
                <View style={[styles.guideIconMain, { backgroundColor: cardBg }]}><Ionicons name="scan-outline" size={ms(20)} color="#3B82F6" /></View>
                <View>
                  <Text style={[styles.guideLabelText, { color: textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>{t('stay_steady')}</Text>
                  <Text style={[styles.guideInfoText, { color: textSecondary }]}>{t('hold_still_blur')}</Text>
                </View>
              </View>
              <View style={[styles.guideRow, { backgroundColor: subBg }]}>
                <View style={[styles.guideIconMain, { backgroundColor: cardBg }]}><Ionicons name="car-outline" size={ms(20)} color={SCREENSHOT_GREEN} /></View>
                <View>
                  <Text style={[styles.guideLabelText, { color: textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>{t('full_vehicle')}</Text>
                  <Text style={[styles.guideInfoText, { color: textSecondary }]}>{t('capture_entire_car')}</Text>
                </View>
              </View>
            </View>

            <View style={[styles.modalBottomTip, { backgroundColor: SCREENSHOT_GREEN + '15' }]}>
              <Text style={[styles.modalBottomTipText, { color: SCREENSHOT_GREEN }]}>✨ {t('lighting_tip_footer')}</Text>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

/* ================= COMPONENT PARTS ================= */

const Header = ({ cardBg, textPrimary, textSecondary, donePercent, completedSteps, totalSteps, dividerColor, borderColorTheme, isDark, t, navigation, ride }: any) => (
  <View style={[styles.header, { backgroundColor: cardBg }]}>
    <View style={styles.headerTopRow}>
      <View style={[styles.shieldIcon, { backgroundColor: SCREENSHOT_GREEN }]}>
        <Ionicons name="shield-checkmark" size={ms(24)} color="#FFF" />
      </View>
      <View style={styles.headerTextCol}>
        <Text style={[styles.headerTitle, { color: textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>{t('vehicle_check')}</Text>
        <Text style={[styles.headerSubtitle, { color: textSecondary }]}>{t('quick_verification_subtitle')}</Text>
      </View>
      <View style={[styles.stepBadge, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
        <Text style={[styles.stepBadgeText, { color: textPrimary }]}>{completedSteps} <Text style={{ color: textSecondary, fontWeight: '400' }}>/ {totalSteps}</Text></Text>
      </View>
    </View>


    <View style={[styles.fullProgressBarBg, { backgroundColor: borderColorTheme }]}>
      <Animated.View
        layout={Layout.springify()}
        style={[styles.fullProgressBarFill, { width: `${donePercent}%`, backgroundColor: SCREENSHOT_GREEN }]}
      />
    </View>

    <View style={styles.progressSection}>
      <View style={styles.dotsRow}>
        {[1, 2].map(i => (
          <View key={i} style={[styles.dot, { backgroundColor: i <= completedSteps ? SCREENSHOT_GREEN : dividerColor }]} />
        ))}
      </View>
      <Text style={[styles.doneText, { color: textSecondary }]}>{t('percent_done', { percent: donePercent })}</Text>
    </View>
  </View>
);

const Dot = ({ delay }: { delay: number }) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    scale.value = withDelay(delay, withRepeat(withSequence(withTiming(1.4, { duration: 400 }), withTiming(1, { duration: 400 })), -1));
    opacity.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 400 }), withTiming(0.4, { duration: 400 })), -1));
  }, [delay, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.loadingDot, animatedStyle, { backgroundColor: SCREENSHOT_GREEN }]} />;
};

const VerifyingView = ({ _isDark, bgColor, textPrimary, textSecondary, subBg, borderColorTheme, cardBg }: any) => {
  const { t } = useTranslation();
  return (
    <View style={[styles.fullCenter, { backgroundColor: bgColor }]}>
      <Animated.View entering={ZoomIn.duration(800)} style={[styles.bigShieldSquare, { backgroundColor: SCREENSHOT_GREEN }]}>
        <Ionicons name="shield-checkmark" size={ms(48)} color="#FFF" />
      </Animated.View>
      <Text style={[styles.verifyMainTitle, { color: textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>{t('verifying_photos')}</Text>
      <Text style={[styles.verifySubText, { color: textSecondary }]}>{t('verifying_subtext')}</Text>

      <View style={styles.loadingDotsContainer}>
        {[0, 1, 2].map((i) => (
          <Dot key={i} delay={i * 200} />
        ))}
      </View>

      <View style={[styles.summaryStatsRow, { paddingHorizontal: ms(20), marginTop: vs(60) }]}>
        <SkeletonLoader style={[styles.statCard, { height: vs(90), backgroundColor: subBg, borderColor: borderColorTheme }]} />
        <SkeletonLoader style={[styles.statCard, { height: vs(90), backgroundColor: subBg, borderColor: borderColorTheme }]} />
        <SkeletonLoader style={[styles.statCard, { height: vs(90), backgroundColor: subBg, borderColor: borderColorTheme }]} />
      </View>

      <View style={[styles.encryptionBadge, { backgroundColor: cardBg, borderColor: borderColorTheme }]}>
        <MaterialCommunityIcons name="fingerprint" size={ms(18)} color={SCREENSHOT_GREEN} />
        <Text style={[styles.encryptionText, { color: textSecondary }]} numberOfLines={1} adjustsFontSizeToFit>{t('secured_encryption')}</Text>
      </View>
    </View>
  );
};

const VerifiedView = ({ startTripAction, isDark, bgColor, textPrimary, textSecondary, cardBg, borderColorTheme }: any) => {
  const { t } = useTranslation();
  return (
    <View style={[styles.fullCenter, { backgroundColor: bgColor }]}>
      <Animated.View entering={ZoomIn}>
        <View style={[styles.bigShieldSquare, { backgroundColor: SCREENSHOT_GREEN }]}>
          <Ionicons name="checkmark-circle" size={ms(48)} color="#FFF" />
        </View>
      </Animated.View>

      <Text style={[styles.verifyMainTitle, { color: textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>{t('youve_been_verified')}</Text>
      <Text style={[styles.verifySubText, { color: textSecondary }]}>{t('verified_ready_subtext')}</Text>

      <View style={styles.summaryStatsRow}>
        <View style={[styles.statCard, { backgroundColor: cardBg, borderColor: borderColorTheme }]}>
          <Text style={[styles.statValue, { color: textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>5</Text>
          <Text style={[styles.statLabel, { color: textSecondary }]}>{t('photos_stat')}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: cardBg, borderColor: borderColorTheme }]}>
          <Text style={[styles.statValue, { color: textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>3s</Text>
          <Text style={[styles.statLabel, { color: textSecondary }]}>{t('verified_stat')}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: cardBg, borderColor: borderColorTheme }]}>
          <Ionicons name="checkmark" size={ms(18)} color={SCREENSHOT_GREEN} />
          <Text style={[styles.statLabel, { color: SCREENSHOT_GREEN, fontWeight: '900', marginTop: vs(4) }]}>{t('approved_stat')}</Text>
        </View>
      </View>

      <TouchableOpacity onPress={startTripAction} style={styles.startTripBtn}>
        <Text style={styles.startTripBtnText} numberOfLines={1} adjustsFontSizeToFit>{t('start_trip')}</Text>
        <Ionicons name="arrow-forward" size={ms(20)} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
};

const SkeletonLoader = ({ style }: any) => {
  const pulse = useSharedValue(0.4);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 800 }), withTiming(0.4, { duration: 800 })),
      -1,
      true
    );
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Animated.View style={[style, { backgroundColor: '#F3F4F6' }, pulseStyle]} />;
};

const PhotoItem = ({ label, icon, lib, success, onPress, scaleX, photoUri, isDark }: any) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.7}
    style={[styles.gridItem, success && styles.gridItemSuccess, { backgroundColor: isDark ? '#1E1E1E' : '#FFF', borderColor: isDark ? '#2D2D2D' : '#F3F4F6' }]}
  >
    <View style={[styles.gridIconCircle, { backgroundColor: isDark ? '#2D2D2D' : '#F9FAFB' }]}>
      {success && photoUri ? (
        <Image source={{ uri: photoUri }} style={{ width: '100%', height: '100%', borderRadius: ms(22) }} />
      ) : lib === 'MCI' ? (
        <MaterialCommunityIcons name={icon} size={ms(24)} color={isDark ? '#9CA3AF' : '#9CA3AF'} style={{ transform: [{ scaleX: scaleX || 1 }] }} />
      ) : (
        <Ionicons name={icon} size={ms(24)} color={isDark ? '#9CA3AF' : '#9CA3AF'} />
      )}
    </View>
    <Text
      style={[styles.gridLabel, { color: isDark ? '#F9FAFB' : '#1F2937' }]}
      adjustsFontSizeToFit
      numberOfLines={1}
    >
      {label}
    </Text>
    {success && (
      <View style={styles.itemReflectCheck}>
        <Ionicons name="checkmark-circle" size={ms(18)} color={SCREENSHOT_GREEN} />
      </View>
    )}
  </TouchableOpacity>
);

const GlassFooter = ({ isDark, submitAction, _canSubmit, status, _completedSteps, _totalSteps, textSecondary, t }: any) => (
  <View style={styles.glassFooterContainer}>
    <LinearGradient
      colors={isDark ? ['rgba(18,18,18,0)', 'rgba(18,18,18,0.92)', '#121212'] : ['rgba(240,249,254,0)', 'rgba(255,255,255,0.92)', '#FFFFFF']}
      style={styles.glassGradient}
    />
    <View style={styles.footerInner}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={submitAction}
        style={[styles.submitBtn, { backgroundColor: PRIMARY_COLOR }]}
      >
        {status === 'VERIFYING' ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <View style={styles.btnContentRow}>
            <Ionicons name="shield-checkmark" size={ms(20)} color={'#FFF'} style={{ marginRight: ms(10) }} />
            <Text style={[styles.submitBtnText, { color: '#FFF' }]} numberOfLines={1} adjustsFontSizeToFit>
              {t('verify_and_submit')}
            </Text>
            {<Ionicons name="arrow-forward" size={ms(20)} color="#FFF" style={{ marginLeft: ms(10) }} />}
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.footerStatusBar}>
        <Ionicons name="flash" size={ms(14)} color="#F59E0B" />
        <Text style={[styles.footerHelp, { color: textSecondary }]}>{t('verification_time_hint')}</Text>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1 },
  header: { padding: ms(20) },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: vs(12) },
  shieldIcon: { width: ms(48), height: ms(48), borderRadius: ms(16), justifyContent: 'center', alignItems: 'center' },
  headerTextCol: { flex: 1, marginLeft: ms(12) },
  headerTitle: { fontSize: ms(22), fontWeight: '900', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: ms(14), fontWeight: '500' },
  stepBadge: { paddingHorizontal: ms(12), paddingVertical: vs(5), borderRadius: ms(16) },
  stepBadgeText: { fontSize: ms(13), fontWeight: '800' },
  progressSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: vs(8) },
  dotsRow: { flexDirection: 'row', gap: ms(6) },
  dot: { width: ms(8), height: ms(8), borderRadius: ms(4) },
  doneText: { fontSize: ms(13), fontWeight: '900' },
  fullProgressBarBg: { height: vs(10), borderRadius: vs(5), overflow: 'hidden' },
  fullProgressBarFill: { height: '100%', borderRadius: vs(5) },

  content: { padding: ms(12) },
  timerCard: { padding: ms(8), borderRadius: ms(24), flexDirection: 'row', alignItems: 'center', marginBottom: vs(12), borderWidth: 1 },
  timerIconBox: { width: ms(44), height: ms(44), borderRadius: ms(22), justifyContent: 'center', alignItems: 'center' },
  timerTextCol: { marginLeft: ms(16) },
  timerLabel: { fontSize: ms(11), fontWeight: '800', letterSpacing: 1 },
  timerValue: { fontSize: ms(24), fontWeight: '900' },

  mainActionCard: { borderRadius: ms(32), paddingHorizontal: ms(18), paddingVertical: vs(12), borderWidth: 1 },
  stepSection: { paddingVertical: vs(16), paddingHorizontal: ms(12), borderRadius: ms(24), marginVertical: vs(4), borderWidth: 1 },
  stepActive: { borderColor: '#CBD5E1' }, // Only border for active state now
  stepHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: vs(16) },
  stepNumber: { width: ms(32), height: ms(32), borderRadius: ms(16), justifyContent: 'center', alignItems: 'center', marginRight: ms(16) },
  stepNumberText: { fontSize: ms(15), fontWeight: '900' },
  stepTitle: { fontSize: ms(18), fontWeight: '900' },
  stepSubtitle: { fontSize: ms(14), marginTop: vs(2) },
  donePillBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: ms(10), paddingVertical: vs(4), borderRadius: ms(20), gap: ms(4) },
  donePillText: { fontSize: ms(13), fontWeight: '800', color: SCREENSHOT_GREEN },

  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: vs(20) },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { marginHorizontal: ms(16), fontSize: ms(12), fontWeight: '800', color: '#D1D5DB', letterSpacing: 1 },

  circularCaptureCard: { width: ms(160), height: ms(160), borderRadius: ms(80), borderWidth: 1, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  successCaptureBox: { borderStyle: 'solid', borderWidth: 1, borderRadius: ms(24), padding: ms(16), flexDirection: 'row', alignItems: 'center', gap: ms(16), marginVertical: vs(10) },
  innerCameraIconBg: { width: ms(54), height: ms(54), borderRadius: ms(27), justifyContent: 'center', alignItems: 'center', marginBottom: vs(10) },
  innerActionText: { fontSize: ms(15), fontWeight: '900', textAlign: 'center' },
  innerSubtitleText: { fontSize: ms(11), marginTop: vs(2), textAlign: 'center', paddingHorizontal: ms(15) },

  successAvatarCircle: { width: ms(48), height: ms(48), borderRadius: ms(24), justifyContent: 'center', alignItems: 'center' },
  successCaptureTitle: { fontSize: ms(17), fontWeight: '900', color: PRIMARY_COLOR },
  successCaptureSubtitle: { fontSize: ms(14), marginTop: vs(2) },

  pillLockBox: { borderRadius: ms(24), paddingHorizontal: ms(24), paddingVertical: vs(18), flexDirection: 'row', alignItems: 'center', gap: ms(12) },
  pillLockText: { fontSize: ms(15), fontWeight: '600' },

  gridContainer: { gap: vs(12) },
  gridRow: { flexDirection: 'row', gap: ms(16) },
  gridItem: { flex: 1, borderWidth: 1, borderRadius: ms(24), padding: ms(4), alignItems: 'center' },
  gridItemSuccess: { borderStyle: 'solid' },
  gridIconCircle: { width: ms(44), height: ms(44), borderRadius: ms(22), justifyContent: 'center', alignItems: 'center', marginBottom: vs(12) },
  gridLabel: { fontSize: ms(14), fontWeight: '800', textAlign: 'center' },
  itemReflectCheck: { position: 'absolute', top: ms(10), right: ms(10) },
  tipsFloatingButton: { marginTop: vs(16), alignSelf: 'center', paddingHorizontal: ms(18), paddingVertical: vs(12), borderRadius: ms(40), flexDirection: 'row', alignItems: 'center', gap: ms(12) },
  tipsIconWrapper: { width: ms(32), height: ms(32), borderRadius: ms(16), justifyContent: 'center', alignItems: 'center' },
  tipsTextTitle: { fontSize: ms(16), fontWeight: '900' },

  glassFooterContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, height: vs(160), justifyContent: 'flex-end', zIndex: 100 },
  glassGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  footerInner: { paddingHorizontal: ms(20), paddingBottom: vs(32), paddingTop: vs(20) },

  submitBtn: { height: vs(54), borderRadius: ms(32), justifyContent: 'center', alignItems: 'center' },
  btnContentRow: { flexDirection: 'row', alignItems: 'center' },
  submitBtnText: { fontSize: ms(18), fontWeight: '900' },
  remainingText: { fontSize: ms(15), fontWeight: '600' },
  footerStatusBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: vs(14), gap: ms(6) },
  footerHelp: { fontSize: ms(14), fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: ms(40), borderTopRightRadius: ms(40), padding: ms(24), paddingBottom: vs(48) },
  modalDrag: { width: ms(48), height: vs(5), borderRadius: vs(3), alignSelf: 'center', marginBottom: vs(24) },
  modalHeaderRow: { flexDirection: 'row', gap: ms(16), alignItems: 'center', marginBottom: vs(32) },
  modalTipIcon: { width: ms(48), height: ms(48), borderRadius: ms(24), justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontSize: ms(22), fontWeight: '900' },
  modalSubtitle: { fontSize: ms(15) },
  closeModalBtn: { padding: ms(8) },
  guidelineItems: { gap: vs(16) },
  guideRow: { flexDirection: 'row', alignItems: 'center', gap: ms(16), padding: ms(16), borderRadius: ms(24) },
  guideIconMain: { width: ms(44), height: ms(44), borderRadius: ms(22), justifyContent: 'center', alignItems: 'center' },
  guideLabelText: { fontSize: ms(17), fontWeight: '900' },
  guideInfoText: { fontSize: ms(14) },
  modalBottomTip: { marginTop: vs(32), padding: ms(16), borderRadius: ms(16), alignItems: 'center' },
  modalBottomTipText: { fontSize: ms(14), fontWeight: '800' },

  fullCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: ms(24) },
  bigShieldSquare: { width: ms(100), height: ms(100), borderRadius: ms(32), justifyContent: 'center', alignItems: 'center' },
  verifyMainTitle: { fontSize: ms(26), fontWeight: '900', marginTop: vs(32), textAlign: 'center' },
  verifySubText: { fontSize: ms(16), marginTop: vs(12), textAlign: 'center', lineHeight: vs(24) },
  loadingDotsContainer: { flexDirection: 'row', gap: ms(8), marginTop: vs(40) },
  loadingDot: { width: ms(10), height: ms(10), borderRadius: ms(5), backgroundColor: SCREENSHOT_GREEN },
  encryptionBadge: { flexDirection: 'row', alignItems: 'center', gap: ms(8), paddingHorizontal: ms(16), paddingVertical: vs(10), borderRadius: ms(20), position: 'absolute', bottom: vs(48), borderWidth: 1 },
  encryptionText: { fontSize: ms(13), fontWeight: '600' },
  summaryStatsRow: { flexDirection: 'row', gap: ms(12), marginTop: vs(40), width: '100%' },
  statCard: { flex: 1, padding: ms(16), borderRadius: ms(24), alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  statValue: { fontSize: ms(20), fontWeight: '900' },
  statLabel: { fontSize: ms(13), fontWeight: '700', marginTop: vs(2) },
  startTripBtn: { width: '100%', height: vs(64), backgroundColor: SCREENSHOT_GREEN, borderRadius: ms(32), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: ms(12), marginTop: vs(48) },
  startTripBtnText: { fontSize: ms(18), fontWeight: '900', color: '#FFF' },
});

export default VehicleVerificationScreen;
