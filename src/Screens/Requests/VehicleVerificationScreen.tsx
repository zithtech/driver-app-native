import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Image,
  BackHandler,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation, useFocusEffect, StackActions } from '@react-navigation/native';
import ImagePicker from 'react-native-image-crop-picker';
import { useSelector } from 'react-redux';
import Animated, {
  FadeInDown,
  ZoomIn,
} from 'react-native-reanimated';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useHaptic } from '../../hooks/useHaptic';

import { useAppTheme } from '../../context/ThemeContext';
import AppStatusBar from '../../Components/AppStatusBar';
import Button from '../../Components/Button';
import { useAlert } from '../../context/AlertContext';
import { vS as vs, mS as ms } from '../../lib/scale';
import { RootState } from '../../redux/store';
import { useGetDocUploadUrlMutation, useSubmitTripPhotosMutation, useGetTripVerificationStatusQuery } from '../../service/driverApi';
import { documentApi } from '../../api/documentApi';
import socketService from '../../service/socketService';
import { checkCameraPermission, goToSettings } from '../../utils/permissionUtils';
import { resolveImageUrl } from '../../utils/imageUtils';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';

type Status = 'COLLECTING' | 'VERIFYING' | 'APPROVED' | 'REJECTED';

const PRIMARY_COLOR = '#152D5E';
const SCREENSHOT_GREEN = '#32a852';
const SUBMIT_TIME_LIMIT = 10 * 60;

/* ================= SEQUENTIAL CAMERA MODAL ================= */

const SequentialCameraModal = ({ visible, onClose, onComplete }: any) => {
  const { t } = useTranslation();
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const camera = useRef<Camera>(null);
  const { triggerHaptic } = useHaptic();

  const steps = [
    { key: 'front', label: t('front_view') || 'Front' },
    { key: 'back', label: t('back_view') || 'Back' },
    { key: 'left', label: t('left_side') || 'Left' },
    { key: 'right', label: t('right_side') || 'Right' },
  ];

  const [stepIndex, setStepIndex] = useState(0);
  const [uris, setUris] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (visible && !hasPermission) {
      requestPermission();
    }
  }, [visible, hasPermission]);

  useEffect(() => {
    if (visible) {
      setStepIndex(0);
      setUris({});
      setIsProcessing(false);
    }
  }, [visible]);

  const takePhoto = async () => {
    if (!camera.current || isProcessing) return;
    try {
      setIsProcessing(true);
      triggerHaptic(HapticFeedbackTypes.selection);
      const photo = await camera.current.takePhoto({
        flash: 'off',
      });
      const fileUri = Platform.OS === 'android' ? `file://${photo.path}` : photo.path;

      const stepKey = steps[stepIndex].key;
      const newUris = { ...uris, [stepKey]: fileUri };
      setUris(newUris);

      if (stepIndex < steps.length - 1) {
        setStepIndex(stepIndex + 1);
        setIsProcessing(false);
      } else {
        triggerHaptic(HapticFeedbackTypes.notificationSuccess);
        onComplete(newUris);
      }
    } catch (e) {
      setIsProcessing(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {device ? (
          <Camera
            ref={camera}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={visible}
            photo={true}
          />
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#FFF" />
          </View>
        )}

        {/* Top Overlay: Stepper */}
        <SafeAreaView style={styles.camTopOverlay}>
          <View style={styles.camHeader}>
            <TouchableOpacity onPress={onClose} style={styles.camCloseBtn}>
              <Ionicons name="close" size={ms(28)} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.camTitle}>{t('vehicle_scan') || 'Vehicle Scan'}</Text>
            <View style={{ width: ms(28) }} />
          </View>

          {/* Horizontal Stepper UI matching user screenshot */}
          <View style={styles.stepperWrapper}>
            {steps.map((step, idx) => {
              const isActive = idx === stepIndex;
              const isPast = idx < stepIndex;
              // using a custom purple shade for premium look matching standard steppers
              const nodeColor = isActive || isPast ? '#6366F1' : 'transparent';
              const nodeBorder = isActive || isPast ? '#6366F1' : 'rgba(255,255,255,0.5)';
              const textColor = isActive || isPast ? '#FFF' : 'rgba(255,255,255,0.7)';

              return (
                <View key={step.key} style={styles.stepperNodeWrapper}>
                  <View style={styles.stepperNodeCol}>
                    <View style={[styles.stepperCircle, { backgroundColor: nodeColor, borderColor: nodeBorder }]}>
                      {isPast ? (
                        <Ionicons name="checkmark" size={ms(14)} color="#FFF" />
                      ) : (
                        <Text style={[styles.stepperCircleText, { color: textColor }]}>{idx + 1}</Text>
                      )}
                    </View>
                    <Text style={[styles.stepperLabel, { color: textColor, fontWeight: isActive ? '700' : '500' }]}>
                      {step.label}
                    </Text>
                  </View>

                  {idx < steps.length - 1 && (
                    <View style={[styles.stepperLine, { backgroundColor: isPast ? '#6366F1' : 'rgba(255,255,255,0.3)' }]} />
                  )}
                </View>
              );
            })}
          </View>
        </SafeAreaView>

        {/* Bottom Overlay: Instruction & Shutter */}
        <SafeAreaView style={styles.camBottomOverlay}>
          <Text style={styles.camInstruction}>
            {t('capture') || 'Capture'} <Text style={{ fontWeight: '800' }}>{steps[stepIndex].label}</Text>
          </Text>
          <View style={styles.camShutterRow}>
            <TouchableOpacity onPress={takePhoto} disabled={isProcessing} style={styles.camShutterBtn}>
              {isProcessing ? (
                <ActivityIndicator color="#000" />
              ) : (
                <View style={styles.camShutterInner} />
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

/* ================= MAIN SCREEN ================= */

const VehicleVerificationScreen = ({ route }: any) => {
  const rideFromStore = useSelector((state: RootState) => state.ride.currentRide);
  const ride = rideFromStore || route.params?.ride || {};
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { isDark } = useAppTheme();
  const { showAlert } = useAlert();
  const { triggerHaptic } = useHaptic();
  const user = useSelector((state: RootState) => state.userSlice.user);

  useEffect(() => {
    if (!rideFromStore) {
      navigation.dispatch(StackActions.replace('DashboardScreen'));
    }
  }, [rideFromStore, navigation]);

  const [selfieTaken, setSelfieTaken] = useState(false);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);

  const [vehiclePhotos, setVehiclePhotos] = useState<Record<string, boolean>>({
    front: false, back: false, left: false, right: false,
  });
  const [vehicleUris, setVehicleUris] = useState<Record<string, string | null>>({
    front: null, back: null, left: null, right: null,
  });

  const [status, setStatus] = useState<Status>('COLLECTING');
  const [timeLeft, setTimeLeft] = useState(SUBMIT_TIME_LIMIT);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [showSequentialCamera, setShowSequentialCamera] = useState(false);

  const [getUploadUrl] = useGetDocUploadUrlMutation();
  const [submitTripPhotos, { isLoading: isSubmitting }] = useSubmitTripPhotosMutation();

  const bgColor = isDark ? '#121212' : '#FFFFFF';
  const cardBg = isDark ? '#1E1E1E' : '#FFF';
  const borderColorTheme = isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6';
  const activeColor = isDark ? '#3B82F6' : PRIMARY_COLOR;
  const textPrimary = isDark ? '#F9FAFB' : '#1F2937';
  const textSecondary = isDark ? '#9CA3AF' : '#6B7280';

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: verificationStatus, isLoading: isStatusLoading } = useGetTripVerificationStatusQuery(user?.driverId || '', {
    skip: !user?.driverId || (status !== 'COLLECTING' && status !== 'VERIFYING'),
    pollingInterval: status === 'VERIFYING' ? 3000 : 0,
  });

  useEffect(() => {
    if (verificationStatus?.data && (status === 'COLLECTING' || status === 'VERIFYING')) {
      const v = verificationStatus.data;
      const rideTripId = String(ride?.trip_id || ride?.id);
      const backendTripId = String(v.trip_id);
      const tripIdMatch = backendTripId === rideTripId;
      if (!tripIdMatch) return;

      if (v.status === 'pending') {
        if (status === 'COLLECTING') setStatus('VERIFYING');
      } else if (v.status === 'approved') {
        setStatus('APPROVED');
        triggerHaptic(HapticFeedbackTypes.notificationSuccess);
      } else if (v.status === 'rejected') {
        setStatus('COLLECTING');
        const rejectedImages = [];
        if (v.selfie_status === 'rejected') {
          rejectedImages.push(`Selfie (${v.selfie_remarks || 'No reason provided'})`);
          setSelfieTaken(false); setSelfieUri(null);
        }
        if (v.car_image_status === 'rejected') {
          rejectedImages.push(`Car Image (${v.car_image_remarks || 'No reason provided'})`);
          setVehiclePhotos({ front: false, back: false, left: false, right: false });
          setVehicleUris({ front: null, back: null, left: null, right: null });
        }
        if (rejectedImages.length > 0) {
          showAlert({
            title: t('verification_rejected'),
            message: `${t('please_reupload')}:\n- ${rejectedImages.join('\n- ')}`,
            singleButton: true, icon: 'alert-circle-outline',
          });
          triggerHaptic(HapticFeedbackTypes.notificationError);
        }
      }
    }
  }, [verificationStatus, ride?.trip_id, ride?.id, status]);

  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        showAlert({
          title: t('verification_required'),
          message: t('verification_required_msg'),
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
    }, [navigation])
  );

  useEffect(() => {
    const handleApproved = (data: any) => {
      if (status === 'VERIFYING') {
        setStatus('APPROVED');
        triggerHaptic(HapticFeedbackTypes.notificationSuccess);
      }
    };
    const handleRejected = (data: any) => {
      if (status === 'VERIFYING') {
        setStatus('COLLECTING');
        const rejectedImages = [];
        if (data.selfie_status === 'rejected') {
          rejectedImages.push(`Selfie (${data.selfie_remarks})`);
          setSelfieTaken(false); setSelfieUri(null);
        }
        if (data.car_image_status === 'rejected') {
          rejectedImages.push(`Car Image (${data.car_image_remarks})`);
          setVehiclePhotos({ front: false, back: false, left: false, right: false });
          setVehicleUris({ front: null, back: null, left: null, right: null });
        }
        showAlert({
          title: t('verification_rejected'),
          message: `${t('please_reupload')}:\n- ${rejectedImages.join('\n- ')}`,
          singleButton: true, icon: 'alert-circle-outline',
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
  }, [status]);

  useEffect(() => {
    if (status !== 'COLLECTING') return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        if (prev <= 60) triggerHaptic(HapticFeedbackTypes.selection);
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, triggerHaptic]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const vehicleCount = Object.values(vehiclePhotos).filter(Boolean).length;
  const totalSteps = 5;
  const completedSteps = (selfieTaken ? 1 : 0) + vehicleCount;
  const canSubmit = completedSteps === totalSteps && status === 'COLLECTING';

  const captureSelfie = () => {
    (navigation as any).navigate('SmartSelfieScreen', {
      onCapture: (photoPath: string) => {
        const finalPath = photoPath.startsWith('http') || photoPath.startsWith('file://') || photoPath.startsWith('content://')
          ? photoPath
          : 'file://' + photoPath;

        setSelfieTaken(true);
        setSelfieUri(finalPath);
        triggerHaptic(HapticFeedbackTypes.selection);
      }
    });
  };

  // Fallback for retaking individual photos in grid if they want
  const retakeSingleVehiclePhoto = async (key: string) => {
    try {
      const image = await ImagePicker.openCamera({ width: 1200, height: 1200, cropping: true }) as any;
      setVehiclePhotos(prev => ({ ...prev, [key]: true }));
      setVehicleUris(prev => ({ ...prev, [key]: image.path }));
      triggerHaptic(HapticFeedbackTypes.selection);
    } catch (e) { }
  };

  const uploadFile = async (uri: string, type: string) => {
    if (!user?.driverId) return null;
    try {
      const response = await getUploadUrl({
        driverId: user.driverId, documentType: type, contentType: 'image/jpeg',
      }).unwrap();
      const { uploadUrl, fileUrl } = response.data;
      await documentApi.uploadToS3(uploadUrl, uri, 'image/jpeg');
      return fileUrl;
    } catch (error) { throw error; }
  };

  const submitAction = async () => {
    if (!canSubmit) return;
    setStatus('VERIFYING');
    triggerHaptic(HapticFeedbackTypes.impactMedium);
    try {
      const selfieS3Url = await uploadFile(selfieUri!, 'trip_selfie');
      const carImagesS3Urls: string[] = [];
      const vehicleKeys = ['front', 'back', 'left', 'right'];
      for (const key of vehicleKeys) {
        if (vehicleUris[key]) {
          const s3Url = await uploadFile(vehicleUris[key] as string, `vehicle_car_image_${key}`);
          if (s3Url) carImagesS3Urls.push(s3Url);
        }
      }
      await submitTripPhotos({
        driverId: user?.driverId || '',
        selfie_url: selfieS3Url,
        car_image_url: carImagesS3Urls[0] || '',
        car_images: carImagesS3Urls,
        trip_id: ride?.trip_id,
      }).unwrap();
    } catch (error) {
      setStatus('COLLECTING');
      showAlert({
        title: t('upload_failed'),
        message: t('upload_failed_msg'),
        singleButton: true, icon: 'alert-circle-outline',
      });
    }
  };

  const startTripAction = async () => {
    navigation.replace('DropMapScreen', { ride });
  };

  if (isStatusLoading) {
    return (
      <View style={[styles.safe, { backgroundColor: bgColor, justifyContent: 'center', alignItems: 'center' }]}>
        <AppStatusBar />
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
      </View>
    );
  }

  if (status === 'VERIFYING') {
    return (
      <View style={[styles.fullCenter, { backgroundColor: bgColor }]}>
        <AppStatusBar />
        <Animated.View entering={ZoomIn.duration(800)} style={[styles.bigShieldSquare, { backgroundColor: SCREENSHOT_GREEN }]}>
          <Ionicons name="shield-checkmark" size={ms(48)} color="#FFF" />
        </Animated.View>
        <Text style={[styles.verifyMainTitle, { color: textPrimary }]}>{t('verifying_photos')}</Text>
        <Text style={[styles.verifySubText, { color: textSecondary }]}>{t('verifying_subtext')}</Text>
        <ActivityIndicator size="large" color={SCREENSHOT_GREEN} style={{ marginTop: vs(32) }} />
      </View>
    );
  }

  if (status === 'APPROVED') {
    return (
      <View style={[styles.fullCenter, { backgroundColor: bgColor }]}>
        <AppStatusBar />
        <Animated.View entering={ZoomIn}>
          <View style={[styles.bigShieldSquare, { backgroundColor: SCREENSHOT_GREEN }]}>
            <Ionicons name="checkmark-circle" size={ms(48)} color="#FFF" />
          </View>
        </Animated.View>
        <Text style={[styles.verifyMainTitle, { color: textPrimary }]}>{t('youve_been_verified')}</Text>
        <Text style={[styles.verifySubText, { color: textSecondary }]}>{t('verified_ready_subtext')}</Text>
        <TouchableOpacity onPress={startTripAction} style={styles.startTripBtn}>
          <Text style={styles.startTripBtnText}>{t('start_trip')}</Text>
          <Ionicons name="arrow-forward" size={ms(20)} color="#FFF" />
        </TouchableOpacity>
      </View>
    );
  }

  const renderUploadBox = (key: string, title: string) => {
    const isCompleted = vehiclePhotos[key];
    const uri = vehicleUris[key];

    const getIcon = () => {
      if (key === 'front') return 'car';
      if (key === 'back') return 'car-back';
      if (key === 'left' || key === 'right') return 'car-side';
      return 'car';
    };

    return (
      <TouchableOpacity
        key={key}
        activeOpacity={0.85}
        onPress={() => retakeSingleVehiclePhoto(key)}
        style={styles.uploadRowCard}
      >
        <View style={styles.uploadRowLeft}>
          <View style={{ width: ms(50), height: ms(50), justifyContent: 'center', alignItems: 'center', marginRight: ms(12) }}>
            <MaterialCommunityIcons 
              name={getIcon()} 
              size={ms(42)} 
              color={isCompleted ? activeColor : (isDark ? '#9CA3AF' : '#6B7280')} 
              style={key === 'right' ? { transform: [{ scaleX: -1 }] } : {}}
            />
          </View>
          <View style={styles.uploadRowTextCol}>
            <Text style={[styles.uploadRowTitle, { color: textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>{title}</Text>
            <Text style={[styles.uploadRowSub, { color: textSecondary }]}>{isCompleted ? (t('tap_to_retake') || 'Tap to retake photo') : (t('capture_now') || 'Capture now')}</Text>
          </View>
        </View>
        <View style={[styles.uploadRowRight, isDark && { borderColor: '#4B5563' }, isCompleted && { borderStyle: 'solid', borderColor: activeColor }]}>
          {isCompleted && uri ? (
            <Image source={{ uri }} style={[styles.uploadRowImage, { borderRadius: ms(8), width: '100%', height: '100%' }]} resizeMode="cover" />
          ) : (
            <Ionicons name="camera-outline" size={ms(32)} color={isDark ? '#4B5563' : '#D1D5DB'} />
          )}
          <View style={[styles.uploadRowPlus, isCompleted ? { backgroundColor: '#2E7D32' } : { backgroundColor: isDark ? '#4B5563' : '#D1D5DB' }]}>
            <Ionicons name={isCompleted ? "checkmark" : "add"} size={ms(16)} color="#FFF" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bgColor }]} edges={['top']}>
      <AppStatusBar />

      {/* Top Illustration Image (Fixed at top) */}
      <Animated.View entering={FadeInDown.delay(50).springify()} style={{ alignItems: 'center', marginTop: vs(8) }}>
        <Image
          source={require('../../assets/images/t2.png')}
          style={{ width: '100%', height: vs(150), resizeMode: 'contain' }}
        />
      </Animated.View>

      <View style={styles.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, paddingRight: ms(16) }}>
            <Text style={[styles.title, { color: textPrimary }]}>{t('verification') || 'Verification'}</Text>
            <Text style={[styles.headerSubtitle, { color: textSecondary }]} numberOfLines={1} adjustsFontSizeToFit>
              {t('verification_subtitle') || 'Add a selfie and photos of your vehicle.'}
            </Text>
          </View>
          <View style={[styles.timerBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6' }]}>
            <Ionicons name="time-outline" size={ms(14)} color={textPrimary} />
            <Text style={[styles.timerText, { color: textPrimary }]}>{formatTime(timeLeft)}</Text>
          </View>
        </View>

        <View style={styles.mainStepperContainer}>
          {[
            { key: 'photos', label: t('photos') || 'Photos' },
            { key: 'details', label: t('details') || 'Details' },
            { key: 'review', label: t('review') || 'Review' },
          ].map((step, index) => {
            const isActive = index === 0;
            const isPast = false;
            const nodeColor = isActive || isPast ? '#6366F1' : 'transparent';
            const nodeBorder = isActive || isPast ? '#6366F1' : (isDark ? '#4B5563' : '#D1D5DB');
            const textColor = isActive || isPast ? '#FFF' : (isDark ? '#9CA3AF' : '#6B7280');
            const labelColor = isActive || isPast ? '#6366F1' : (isDark ? '#9CA3AF' : '#6B7280');

            return (
              <React.Fragment key={step.key}>
                <View style={styles.mainStepperItem}>
                  <View style={[styles.mainStepperCircle, { backgroundColor: nodeColor, borderColor: nodeBorder }]}>
                    <Text style={[styles.mainStepperCircleText, { color: textColor }]}>{index + 1}</Text>
                  </View>
                  <Text style={[styles.mainStepperItemLabel, { color: labelColor }]}>{step.label}</Text>
                </View>
                {index < 2 && (
                  <View style={[styles.mainStepperLine, { backgroundColor: isDark ? '#4B5563' : '#E5E7EB' }]} />
                )}
              </React.Fragment>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={captureSelfie}
            style={styles.uploadRowCard}
          >
            <View style={styles.uploadRowLeft}>
              <View style={styles.uploadRowIconCircle}>
                {user?.profile_pic_url || user?.profile_picture ? (
                  <Image
                    source={{ uri: resolveImageUrl(user.profile_pic_url || user.profile_picture) || undefined }}
                    style={{ width: '100%', height: '100%', resizeMode: 'cover' }}
                  />
                ) : (
                  <Ionicons name="person-outline" size={ms(28)} color="#FFA500" />
                )}
              </View>
              <View style={styles.uploadRowTextCol}>
                <Text style={[styles.uploadRowTitle, { color: textPrimary }]}>{t('profile_photo') || 'Profile Photo'}</Text>
                <Text style={[styles.uploadRowSub, { color: textSecondary }]}>{t('upload_clear_photo') || 'Upload a clear photo of yourself'}</Text>
              </View>
            </View>
            <View style={[styles.uploadRowRight, isDark && { borderColor: '#4B5563' }, selfieTaken && { borderStyle: 'solid', borderColor: activeColor }]}>
              {selfieTaken && selfieUri ? (
                <Image source={{ uri: selfieUri }} style={[styles.uploadRowImage, { borderRadius: ms(8), width: '100%', height: '100%' }]} resizeMode="cover" />
              ) : (
                <Ionicons name="person" size={ms(48)} color={isDark ? '#4B5563' : '#D1D5DB'} />
              )}
              <View style={[styles.uploadRowPlus, selfieTaken && { backgroundColor: '#2E7D32' }]}>
                <Ionicons name={selfieTaken ? "checkmark" : "add"} size={ms(16)} color="#FFF" />
              </View>
            </View>
          </TouchableOpacity>

          {/* Main Content Area */}
          {vehicleCount === 0 ? (
            <TouchableOpacity style={styles.uploadRowCard} onPress={() => setShowSequentialCamera(true)}>
              <View style={styles.uploadRowLeft}>
                <View style={styles.uploadRowIconCircle}>
                  <Ionicons name="car-outline" size={ms(24)} color="#FFA500" />
                </View>
                <View style={styles.uploadRowTextCol}>
                  <Text style={[styles.uploadRowTitle, { color: textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>{t('car_upload_all_view') || 'Car - Upload all view'}</Text>
                  <Text style={[styles.uploadRowSub, { color: textSecondary }]}>{t('capture_all_sides_car') || 'Capture all sides of customer car'}</Text>
                </View>
              </View>
              <View style={[styles.uploadRowRight, isDark && { borderColor: '#4B5563' }]}>
                <Image source={require('../../assets/images/car.png')} style={styles.uploadRowImage} resizeMode="contain" />
                <View style={styles.uploadRowPlus}>
                  <Ionicons name="add" size={ms(16)} color="#FFF" />
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <View>
              <Text style={[styles.gridTitle, { color: textPrimary, textAlign: 'left' }]}>{t('captured_photos') || 'Captured Photos'}</Text>
              {renderUploadBox('front', t('front_view') || 'Front View')}
              {renderUploadBox('back', t('back_view') || 'Back View')}
              {renderUploadBox('left', t('left_side') || 'Left Side')}
              {renderUploadBox('right', t('right_side') || 'Right Side')}
            </View>
          )}

        </Animated.View>
        <View style={{ height: vs(120) }} />
      </ScrollView>

      {status === 'COLLECTING' && (
        <View style={[styles.footer, { backgroundColor: cardBg, borderTopColor: borderColorTheme }]}>
          <Button
            disabled={!canSubmit}
            loading={isSubmitting}
            onPress={submitAction}
          >
            {t('submit_verification') || 'Submit Verification'}
          </Button>
        </View>
      )}

      {/* Custom Sequential Camera Modal */}
      <SequentialCameraModal
        visible={showSequentialCamera}
        onClose={() => setShowSequentialCamera(false)}
        onComplete={(uris: Record<string, string>) => {
          setVehiclePhotos({ front: true, back: true, left: true, right: true });
          setVehicleUris(uris);
          setShowSequentialCamera(false);
        }}
      />

      {/* Guidelines Modal */}
      <Modal visible={showGuidelines} transparent animationType="slide" onRequestClose={() => setShowGuidelines(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: cardBg }]}>
            <View style={[styles.modalHeaderRow, { borderBottomColor: borderColorTheme }]}>
              <Text style={[styles.modalTitle, { color: textPrimary }]}>{t('photo_guidelines') || 'Guidelines'}</Text>
              <TouchableOpacity onPress={() => setShowGuidelines(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={ms(24)} color={textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: ms(20) }}>
              <View style={styles.guideRow}>
                <Ionicons name="sunny-outline" size={ms(24)} color="#F59E0B" />
                <View style={styles.guideTextCol}>
                  <Text style={[styles.guideTitle, { color: textPrimary }]}>{t('good_lighting')}</Text>
                  <Text style={[styles.guideSub, { color: textSecondary }]}>{t('natural_daylight')}</Text>
                </View>
              </View>
              <View style={styles.guideRow}>
                <Ionicons name="scan-outline" size={ms(24)} color="#3B82F6" />
                <View style={styles.guideTextCol}>
                  <Text style={[styles.guideTitle, { color: textPrimary }]}>{t('stay_steady')}</Text>
                  <Text style={[styles.guideSub, { color: textSecondary }]}>{t('hold_still_blur')}</Text>
                </View>
              </View>
              <View style={styles.guideRow}>
                <Ionicons name="car-outline" size={ms(24)} color={SCREENSHOT_GREEN} />
                <View style={styles.guideTextCol}>
                  <Text style={[styles.guideTitle, { color: textPrimary }]}>{t('full_vehicle')}</Text>
                  <Text style={[styles.guideSub, { color: textSecondary }]}>{t('capture_entire_car')}</Text>
                </View>
              </View>
              <View style={{ height: vs(40) }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: ms(20), paddingTop: vs(16), paddingBottom: vs(16) },
  title: { fontSize: ms(26), fontWeight: '900', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: ms(15), marginTop: vs(4), lineHeight: vs(20) },
  mainStepperContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', marginTop: vs(24) },
  mainStepperItem: { alignItems: 'center', width: ms(60) },
  mainStepperCircle: { width: ms(28), height: ms(28), borderRadius: ms(14), borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  mainStepperCircleText: { fontSize: ms(14), fontWeight: '700' },
  mainStepperItemLabel: { fontSize: ms(12), marginTop: vs(6), textAlign: 'center', fontWeight: '500' },
  mainStepperLine: { width: ms(40), height: 2, marginTop: ms(13), marginHorizontal: ms(-8) },
  timerBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: ms(10), paddingVertical: vs(4), borderRadius: ms(12), gap: ms(4) },
  timerText: { fontSize: ms(13), fontWeight: '700', fontVariant: ['tabular-nums'] },

  scroll: { flexGrow: 1, paddingHorizontal: ms(20) },

  sectionTitle: { fontSize: ms(16), fontWeight: '800', marginBottom: vs(12) },
  selfieListItem: { flexDirection: 'row', alignItems: 'center', padding: ms(16), borderRadius: ms(20), borderWidth: 1, marginBottom: vs(24) },
  selfieListIconBg: { width: ms(60), height: ms(60), borderRadius: ms(30), justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  selfieListImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  selfieListTextCol: { flex: 1, marginLeft: ms(16), marginRight: ms(8) },
  selfieListTitle: { fontSize: ms(16), fontWeight: '700' },
  selfieListSub: { fontSize: ms(14), marginTop: vs(4) },
  selfieListActionBtn: { width: ms(36), height: ms(36), borderRadius: ms(18), justifyContent: 'center', alignItems: 'center' },

  // Document Upload Style Grid
  row: { flexDirection: 'row', gap: ms(15), marginBottom: vs(15) },
  selfieRow: { justifyContent: 'center', marginBottom: vs(10) },
  col: { flex: 1 },
  selfieCol: { flex: 0, width: ms(150) },

  sideLabel: { fontSize: ms(14), fontWeight: '600', marginBottom: vs(8), textAlign: 'center' },
  uploadBox: { height: vs(140), borderRadius: ms(16), borderWidth: 2, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  selfieBox: { height: ms(150), borderRadius: ms(75) },
  image: { width: '100%', height: '100%', position: 'absolute' },
  selfieImage: { resizeMode: 'cover' },

  placeholder: { alignItems: 'center', justifyContent: 'center', padding: ms(10) },
  placeholderText: { fontSize: ms(14), fontWeight: '500', marginTop: vs(8), textAlign: 'center' },

  actionButtonsRow: { position: 'absolute', bottom: vs(8), flexDirection: 'row', gap: ms(8) },
  actionButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: vs(6), paddingHorizontal: ms(12), borderRadius: ms(20), backgroundColor: 'rgba(0,0,0,0.6)' },
  actionButtonText: { color: '#fff', fontSize: ms(12), fontWeight: '600', marginLeft: ms(4) },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: ms(20), paddingTop: vs(16), paddingBottom: vs(32), borderTopWidth: 1 },
  submitBtn: { height: vs(56), borderRadius: ms(28), justifyContent: 'center', alignItems: 'center' },
  submitBtnText: { fontSize: ms(16), fontWeight: '800' },

  fullCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: ms(24) },
  bigShieldSquare: { width: ms(80), height: ms(80), borderRadius: ms(24), justifyContent: 'center', alignItems: 'center' },
  verifyMainTitle: { fontSize: ms(24), fontWeight: '900', marginTop: vs(32), textAlign: 'center' },
  verifySubText: { fontSize: ms(15), marginTop: vs(12), textAlign: 'center', lineHeight: vs(24) },
  startTripBtn: { width: '100%', height: vs(56), backgroundColor: SCREENSHOT_GREEN, borderRadius: ms(28), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: ms(12), marginTop: vs(40) },
  startTripBtnText: { fontSize: ms(16), fontWeight: '800', color: '#FFF' },

  // Lock State & Scan Action (Kept for reference if needed, or if other parts use it)
  lockContainer: { alignItems: 'center', paddingVertical: vs(40), paddingHorizontal: ms(20) },
  lockTitle: { fontSize: ms(18), fontWeight: '700', marginTop: vs(16) },
  lockSub: { fontSize: ms(14), textAlign: 'center', marginTop: vs(8), lineHeight: vs(20) },

  scanActionContainer: { alignItems: 'center', paddingVertical: vs(30), paddingHorizontal: ms(10), borderRadius: ms(20), borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', backgroundColor: 'rgba(0,0,0,0.01)' },
  scanIconBg: { width: ms(80), height: ms(80), borderRadius: ms(40), justifyContent: 'center', alignItems: 'center' },
  scanTitle: { fontSize: ms(20), fontWeight: '800', marginTop: vs(20) },
  scanSub: { fontSize: ms(14), textAlign: 'center', marginTop: vs(8), marginBottom: vs(24), lineHeight: vs(20) },
  scanBtn: { backgroundColor: PRIMARY_COLOR, flexDirection: 'row', alignItems: 'center', paddingVertical: vs(14), paddingHorizontal: ms(24), borderRadius: ms(30), gap: ms(8) },
  scanBtnText: { color: '#FFF', fontSize: ms(16), fontWeight: '700' },

  // New Car Upload UI
  uploadRowCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: vs(10), marginBottom: vs(8) },
  uploadRowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: ms(16) },
  uploadRowIconCircle: { width: ms(52), height: ms(52), borderRadius: ms(26), borderWidth: 1, borderColor: PRIMARY_COLOR, justifyContent: 'center', alignItems: 'center', marginRight: ms(12), overflow: 'hidden' },
  uploadRowTextCol: { flex: 1 },
  uploadRowTitle: { fontSize: ms(16), fontWeight: '700' },
  uploadRowSub: { fontSize: ms(13), marginTop: vs(4) },
  uploadRowRight: { width: ms(110), height: ms(70), borderRadius: ms(12), borderWidth: 1.5, borderColor: '#D1D5DB', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  uploadRowImage: { width: '85%', height: '85%' },
  uploadRowPlus: { position: 'absolute', bottom: -ms(8), right: -ms(8), width: ms(22), height: ms(22), borderRadius: ms(11), backgroundColor: PRIMARY_COLOR, justifyContent: 'center', alignItems: 'center' },

  gridTitle: { fontSize: ms(18), fontWeight: '700', marginBottom: vs(16), marginTop: vs(10), textAlign: 'center' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: ms(32), borderTopRightRadius: ms(32), maxHeight: '80%' },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: ms(20), borderBottomWidth: 1 },
  modalTitle: { fontSize: ms(18), fontWeight: '800' },
  closeBtn: { padding: ms(4) },
  guideRow: { flexDirection: 'row', alignItems: 'center', marginBottom: vs(24) },
  guideTextCol: { marginLeft: ms(16), flex: 1 },
  guideTitle: { fontSize: ms(16), fontWeight: '700' },
  guideSub: { fontSize: ms(14), marginTop: vs(4) },

  // Custom Camera Styles
  camTopOverlay: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: ms(20), paddingTop: vs(10) },
  camHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  camCloseBtn: { width: ms(40), height: ms(40), borderRadius: ms(20), backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  camTitle: { color: '#FFF', fontSize: ms(18), fontWeight: '700' },

  // Custom Stepper
  stepperWrapper: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', marginTop: vs(16) },
  stepperNodeWrapper: { flexDirection: 'row', alignItems: 'flex-start' },
  stepperNodeCol: { alignItems: 'center', width: ms(50) },
  stepperCircle: { width: ms(26), height: ms(26), borderRadius: ms(13), borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  stepperCircleText: { fontSize: ms(13), fontWeight: '700' },
  stepperLabel: { fontSize: ms(11), marginTop: vs(6), textAlign: 'center', width: ms(60) },
  stepperLine: { width: ms(24), height: 2, marginTop: ms(12), marginHorizontal: ms(-2) },

  camBottomOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: vs(50), paddingTop: vs(20), alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  camInstruction: { color: '#FFF', fontSize: ms(18), marginBottom: vs(24) },
  camShutterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  camShutterBtn: { width: ms(72), height: ms(72), borderRadius: ms(36), borderWidth: 4, borderColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  camShutterInner: { width: ms(56), height: ms(56), borderRadius: ms(28), backgroundColor: '#FFF' },
});

export default VehicleVerificationScreen;
