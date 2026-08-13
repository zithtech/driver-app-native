import {
  View,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  StyleSheet,
  Platform,
} from 'react-native';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTheme } from '@react-navigation/native';
import ImagePicker from 'react-native-image-crop-picker';
import DocumentScanner from 'react-native-document-scanner-plugin';
import { pick, types } from '@react-native-documents/picker';
import { useDispatch, useSelector } from 'react-redux';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Svg, { Circle } from 'react-native-svg';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Styles } from '../../lib/styles';
import { Text } from '../../Components';
import Button from '../../Components/Button';
import { setUser } from '../../redux/userSlice';
import { useGetDocUploadUrlMutation, useSaveDocumentMutation } from '../../service/driverApi';
import { documentApi } from '../../api/documentApi';
import AppStatusBar from '../../Components/AppStatusBar';
import { useAlert } from '../../context/AlertContext';
import { useToast } from '../../context/ToastContext';
import { useAppTheme } from '../../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import DocGuidelines from '../../Components/DocGuidelines';
import { useHaptic } from '../../hooks/useHaptic';
import ImageZoomModal from '../../Components/ImageZoomModal';
import { ImageSourcePicker, DocSubmissionResultModal } from '../../Components';
import type { ImageSourcePickerRef } from '../../Components/ImageSourcePicker';
import type { OCRErrorCode } from '../../Components/DocSubmissionResultModal';
import { checkCameraPermission, checkPhotoLibraryPermission, goToSettings } from '../../utils/permissionUtils';

/* ================= IMAGE VALIDATION ================= */

const MIN_FILE_SIZE = 50 * 1024; // 50KB
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/* ================= SCREEN ================= */

const DocumentUploadScreen: React.FC<any> = ({ navigation, route }) => {
  const { doc } = route.params; // We now pass the full doc object
  const { side, labelKey, backendType, key: docKey } = doc;

  const { colors, fonts } = useTheme() as any;
  const { theme, isDark } = useAppTheme();
  const { showAlert } = useAlert();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { triggerHaptic } = useHaptic();
  const user = useSelector((state: any) => state.userSlice.user);

  const [images, setImages] = useState<Record<string, string>>({});
  const [uploadingSide, setUploadingSide] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentlyUploading, setCurrentlyUploading] = useState<Record<string, boolean>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [successfulUploads, setSuccessfulUploads] = useState<Record<string, string>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, boolean>>({});
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [submissionStatus, setSubmissionStatus] = useState<'success' | 'failed' | null>(null);
  const [ocrErrorCode, setOcrErrorCode] = useState<OCRErrorCode | null>(null);
  const [ocrErrorMessage, setOcrErrorMessage] = useState<string | null>(null);
  const [uploadStage, setUploadStage] = useState<'uploading' | 'verifying' | 'saving' | null>(null);

  const imagePickerRef = useRef<ImageSourcePickerRef>(null);

  const [getUploadUrl] = useGetDocUploadUrlMutation();
  const [saveDocument] = useSaveDocumentMutation();

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Rotation animation for the scan ring
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    ).start();
  }, [pulseAnim, rotateAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  /* ---------------- PICK IMAGE ---------------- */
  const pickImage = async (sideName: string, fromCamera = false) => {
    if (!ImagePicker) {
      showAlert({
        title: t('error'),
        message: 'Image Picker module is not available.',
        singleButton: true,
        icon: 'alert-circle-outline',
      });
      return;
    }

    // --- PERMISSION CHECK ---
    const hasPermission = fromCamera
      ? await checkCameraPermission()
      : await checkPhotoLibraryPermission();

    if (!hasPermission) {
      showAlert({
        title: t(fromCamera ? 'camera_permission' : 'gallery_permission') || 'Permission Required',
        message: t(fromCamera ? 'camera_permission_msg' : 'gallery_permission_msg') || 'Please enable access to continue.',
        confirmText: t('go_to_settings') || 'Settings',
        onConfirm: () => goToSettings(),
        cancelText: t('cancel') || 'Cancel',
      });
      return;
    }

    try {
      setUploadingSide(sideName);

      const isSelfie = docKey === 'Profile_Selfie';
      let rawPath = '';

      if (fromCamera && !isSelfie) {
        // Document Scan Flow
        const { scannedImages } = await DocumentScanner.scanDocument({
          maxNumDocuments: 1,
          croppedImageQuality: 100,
        });

        if (scannedImages && scannedImages.length > 0) {
          rawPath = scannedImages[0];
        } else {
          // User cancelled scanner
          setUploadingSide(null);
          return;
        }
      } else if (fromCamera && isSelfie) {
        // Smart Selfie Flow
        setUploadingSide(null);
        navigation.navigate('SmartSelfieScreen', {
          onCapture: (photoPath: string) => {
            const finalPath = photoPath.startsWith('http') || photoPath.startsWith('file://') || photoPath.startsWith('content://')
              ? photoPath
              : 'file://' + photoPath;

            setImages(prev => ({
              ...prev,
              [sideName]: finalPath,
            }));
            setUploadErrors(prev => ({ ...prev, [sideName]: false }));
            setSuccessfulUploads(prev => ({ ...prev, [sideName]: '' }));
            triggerHaptic(HapticFeedbackTypes.impactLight);
          }
        });
        return;
      } else {
        // Fallback / Gallery Flow
        const pickerConfig: any = {
          cropping: true,
          compressImageQuality: 0.8,
          useFrontCamera: false,
          cropperCircleOverlay: false,
          freeStyleCropEnabled: true,
          avoidEmptySpaceAroundImage: true,
          includeExif: true,
          forceJpg: true,
          mediaType: 'photo',
        };

        const res = (fromCamera
          ? await ImagePicker.openCamera(pickerConfig)
          : await ImagePicker.openPicker(pickerConfig)) as any;

        rawPath = res.path;
      }

      const path = rawPath.startsWith('http') || rawPath.startsWith('file://') || rawPath.startsWith('content://')
        ? rawPath
        : 'file://' + rawPath;

      setImages(prev => ({
        ...prev,
        [sideName]: path,
      }));
      setUploadErrors(prev => ({ ...prev, [sideName]: false }));
      setSuccessfulUploads(prev => ({ ...prev, [sideName]: '' }));
      triggerHaptic(HapticFeedbackTypes.impactLight);
    } catch (error: any) {
      console.log('Picker Error:', error);
      // If error is related to permissions (rare with our check above but possible)
      if (error?.message?.includes('permission')) {
        showAlert({
          title: t('permission_denied'),
          message: t('permission_denied_msg'),
          singleButton: true,
          icon: 'alert-circle',
        });
      }
    } finally {
      setUploadingSide(null);
    }
  };

  /* ---------------- SOURCE SELECT ---------------- */
  const chooseSource = (sideName: string) => {
    if (docKey === 'Profile_Selfie') {
      pickImage(sideName, true);
    } else {
      // Open the new premium bottom sheet instead of standard alert
      imagePickerRef.current?.present(sideName);
    }
  };

  const currentStatus = useMemo(() => {
    const docsArray = Array.isArray(user?.documents_data) ? user.documents_data : [];
    return docsArray.find((d: any) => d.document_type === backendType);
  }, [user?.documents_data, backendType]);

  const rejectionReason = currentStatus?.rejection_reason || currentStatus?.remarks;

  /* ---------------- IMAGE PRE-VALIDATION ---------------- */
  const validateImageLocally = async (filePath: string): Promise<{ valid: boolean; error?: string }> => {
    try {
      // Check file size via fetch (works for file:// URIs)
      const response = await fetch(filePath);
      const blob = await response.blob();
      const fileSize = blob.size;

      if (fileSize < MIN_FILE_SIZE) {
        return {
          valid: false,
          error: t('image_too_small', 'Image quality is too low. Please capture a clearer photo.'),
        };
      }

      if (fileSize > MAX_FILE_SIZE) {
        return {
          valid: false,
          error: t('image_too_large', 'Image file is too large. Please use a lower resolution.'),
        };
      }

      return { valid: true };
    } catch (err) {
      // If pre-validation fails, allow the upload anyway — backend OCR will catch issues
      console.warn('[PreValidation] Could not validate image locally:', err);
      return { valid: true };
    }
  };

  /* ---------------- CONTINUE ---------------- */
  const handleContinue = async () => {
    if (Object.keys(images).length !== side.length) {
      showAlert({
        title: t('upload_incomplete'),
        message: t('upload_incomplete_msg'),
        singleButton: true,
        icon: 'information-circle-outline',
      });
      return;
    }

    if (!user?.driverId) {
      showAlert({
        title: t('error'),
        message: 'Driver ID missing',
        singleButton: true,
        icon: 'alert-circle-outline',
      });
      return;
    }

    // Reset OCR error state
    setOcrErrorCode(null);
    setOcrErrorMessage(null);

    try {
      setIsSubmitting(true);

      // --- Stage 0: Client-side pre-validation ---
      for (const s of side) {
        if (images[s]) {
          const { valid, error } = await validateImageLocally(images[s]);
          if (!valid) {
            setIsSubmitting(false);
            showAlert({
              title: t('image_quality_issue', 'Image Quality Issue'),
              message: error || t('image_quality_generic', 'Please re-capture the document.'),
              singleButton: true,
              icon: 'image-outline',
            });
            return;
          }
        }
      }

      // --- Stage 1: Upload to S3 ---
      setUploadStage('uploading');
      const documentUrl: Record<string, string> = {};

      const uploadPromises = side.map(async (s: string) => {
        // Skip if already successfully uploaded
        if (successfulUploads[s]) {
          documentUrl[s] = successfulUploads[s];
          return;
        }

        setCurrentlyUploading(prev => ({ ...prev, [s]: true }));
        setUploadErrors(prev => ({ ...prev, [s]: false }));

        try {
          const filePath = images[s];
          const mime = 'image/jpeg';

          const { data: uploadData } = await getUploadUrl({
            driverId: user.driverId,
            documentType: backendType,
            contentType: mime,
          }).unwrap();

          let uploadUrl = uploadData.uploadUrl;
          const fileUrl = uploadData.fileUrl || uploadUrl.split('?')[0];

          if (Platform.OS === 'android' && uploadUrl.includes('localhost')) {
            uploadUrl = uploadUrl.replace('localhost', '10.0.2.2');
          }

          await documentApi.uploadToS3(
            uploadUrl,
            filePath,
            mime,
            (progress) => {
              setUploadProgress(prev => ({ ...prev, [s]: progress }));
            }
          );

          documentUrl[s] = fileUrl;
          setSuccessfulUploads(prev => ({ ...prev, [s]: fileUrl }));
        } catch (err) {
          setUploadErrors(prev => ({ ...prev, [s]: true }));
          throw err;
        } finally {
          setCurrentlyUploading(prev => ({ ...prev, [s]: false }));
        }
      });

      await Promise.all(uploadPromises);

      // --- Stage 2: Save & AI Verification ---
      setUploadStage('verifying');

      const saveResult = await saveDocument({
        driverId: user.driverId,
        documentType: backendType,
        documentUrl,
      }).unwrap();

      // --- Stage 3: Saving ---
      setUploadStage('saving');

      // Update local state
      const updatedDocs = { ...(user.documents || {}) };
      const localPreview = images.front || images.photo || Object.values(images)[0];
      const s3Url = documentUrl.front || Object.values(documentUrl)[0];

      updatedDocs[docKey] = {
        status: 'pending',
        preview: localPreview,
      };

      const profileUpdate: any = { documents: updatedDocs };

      if (docKey === 'Profile_Selfie' || backendType === 'profile_selfie') {
        profileUpdate.profile_picture = localPreview;
        profileUpdate.profile_pic_url = s3Url;
      }

      dispatch(setUser(profileUpdate));
      setIsSubmitting(false);
      setUploadStage(null);

      showToast({
        type: 'success',
        message: t('upload_successful_msg', 'Your document uploaded successfully.'),
        duration: 3000,
      });

      setTimeout(() => {
        navigation.goBack();
      }, 1500);
    } catch (error: any) {
      setIsSubmitting(false);
      setUploadStage(null);
      console.error('Upload Error:', JSON.stringify(error, null, 2));

      // --- Handle OCR validation errors from backend ---
      // RTK Query .unwrap() error shapes:
      // 1. { status: 400, data: { errorCode, message, ... } }  — FetchBaseQueryError
      // 2. { data: { errorCode, message } }                     — direct
      // 3. { errorCode, message }                                — re-thrown from service
      const errorBody =
        error?.data?.errorCode ? error.data :
          error?.error?.data?.errorCode ? error.error.data :
            error?.errorCode ? error :
              null;

      if (errorBody?.errorCode && ['BLURRY', 'WRONG_DOCUMENT', 'EXPIRED', 'INSUFFICIENT_TEXT'].includes(errorBody.errorCode)) {
        setOcrErrorCode(errorBody.errorCode as OCRErrorCode);
        setOcrErrorMessage(errorBody.message || null);
        // Clear uploads AND images so the user MUST re-capture
        setSuccessfulUploads({});
        setImages({});
        setUploadProgress({});
        setUploadErrors({});
        setSubmissionStatus('failed');
        triggerHaptic(HapticFeedbackTypes.notificationError);
      } else {
        setSubmissionStatus('failed');
      }
    }
  };

  /* ---------------- HELPERS ---------------- */
  const getSideLabel = (s: string) => {
    if (s === 'front') return t('front_side');
    if (s === 'back') return t('back_side');
    return t('photo');
  };

  const getTip = () => {
    if (docKey === 'Driving_License') return t('tip_driving');
    if (docKey === 'Aadhar_Card') return t('tip_aadhar');
    if (docKey === 'Pan_Card') return t('tip_pan');
    return t('tip_default');
  };

  /* ================= UI ================= */
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppStatusBar />
      <View style={[Styles.flex, styles.container]}>
        {/* HEADER SECTION */}
        <View style={styles.headerSection}>
          <View style={styles.headerTextContainer}>
            <Text style={[styles.headerTitle, { color: isDark ? '#FFF' : '#111827' }]} adjustsFontSizeToFit numberOfLines={1}>
              {docKey === 'Aadhar_Card' ? 'Aadhaar Card' : docKey === 'Pan_Card' ? 'PAN Card' : docKey === 'Driving_License' ? 'Driving License' : t(labelKey)}
            </Text>
            {docKey === 'Aadhar_Card' ? (
              <Text style={[styles.headerSubtitle, { color: isDark ? '#9CA3AF' : '#4B5563', lineHeight: 22 }]}>
                Upload clear images of your Aadhaar card.
              </Text>
            ) : docKey === 'Pan_Card' ? (
              <Text style={[styles.headerSubtitle, { color: isDark ? '#9CA3AF' : '#4B5563', lineHeight: 22 }]}>
                Upload clear images of your PAN card.
              </Text>
            ) : docKey === 'Driving_License' ? (
              <Text style={[styles.headerSubtitle, { color: isDark ? '#9CA3AF' : '#4B5563', lineHeight: 22 }]}>
                Upload clear images of your Driving License.
              </Text>
            ) : (
              <Text style={[styles.headerSubtitle, { color: isDark ? '#9CA3AF' : '#4B5563' }]}>
                {getTip()}
              </Text>
            )}
          </View>
          <Image
            source={
              docKey === 'Profile_Selfie'
                ? require('../../assets/images/profileTop.png')
                : require('../../assets/images/documents.png')
            }
            style={styles.headerImage}
          />
        </View>


        {/* REJECTION REASON */}
        {rejectionReason && (
          <View style={[styles.rejectionBox, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2', borderColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FCA5A5' }]}>
            <Ionicons name="alert-circle" size={20} color="#DC2626" />
            <Text style={[styles.rejectionText, { color: isDark ? '#FCA5A5' : '#B91C1C' }]}>
              <Text style={[fonts.bold, { color: isDark ? '#FCA5A5' : '#DC2626' }]}>{t('rejection_reason')}: </Text>
              {rejectionReason}
            </Text>
          </View>
        )}

        {/* UPLOAD BOXES */}
        <View
          style={[
            styles.row,
            docKey === 'Profile_Selfie' && styles.selfieRow,
            (docKey === 'Driving_License' || docKey === 'Aadhar_Card' || docKey === 'Pan_Card' || docKey === 'Police_Verification') && { flexDirection: 'column', gap: 20 }
          ]}
        >
          {side.map((s: string) => {
            const hasImage = !!images[s];
            const isUploading = uploadingSide === s;
            const isSelfie = docKey === 'Profile_Selfie';
            const isVerticalLayout = docKey === 'Driving_License' || docKey === 'Aadhar_Card' || docKey === 'Pan_Card' || docKey === 'Police_Verification';

            return (
              <View
                key={s}
                style={[
                  !isVerticalLayout && styles.col,
                  isSelfie && styles.selfieCol,
                  isVerticalLayout && { width: '100%' }
                ]}
              >
                {!isSelfie && !isVerticalLayout && <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.sideLabel, { color: isDark ? '#D1D5DB' : '#6B7280' }]}>{getSideLabel(s)}</Text>}

                {isSelfie ? (
                  <View style={styles.selfieDetailedContainer}>
                    <View style={[styles.selfieCircleWrapper, { borderColor: isDark ? '#3B82F6' : '#2563EB' }]}>
                      <View style={[styles.selfiePlaceholderCircle, hasImage && styles.selfieHasImage, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
                        {hasImage ? (
                          <Image source={{ uri: images[s] }} style={styles.selfieCapturedImage} />
                        ) : (
                          <Ionicons name="person" size={60} color={isDark ? '#4B5563' : '#D1D5DB'} />
                        )}

                        {isSubmitting && currentlyUploading[s] && (
                          <View style={[styles.uploadOverlay, { borderRadius: 100 }]}>
                            <View style={styles.progressCircleContainer}>
                              <Svg width="60" height="60" viewBox="0 0 100 100">
                                <Circle cx="50" cy="50" r="45" stroke="#FFFFFF33" strokeWidth="8" fill="transparent" />
                                <Circle cx="50" cy="50" r="45" stroke="#10B981" strokeWidth="8" fill="transparent" strokeDasharray={`${2 * Math.PI * 45}`} strokeDashoffset={`${2 * Math.PI * 45 * (1 - (uploadProgress[s] || 0))}`} strokeLinecap="round" transform="rotate(-90 50 50)" />
                              </Svg>
                              <View style={styles.percentageTextContainer}>
                                <Text style={styles.percentageText}>{Math.round((uploadProgress[s] || 0) * 100)}%</Text>
                              </View>
                            </View>
                          </View>
                        )}
                        {uploadErrors[s] && !currentlyUploading[s] && (
                          <View style={[styles.uploadOverlay, { borderRadius: 100, backgroundColor: 'rgba(220, 38, 38, 0.7)' }]}>
                            <Ionicons name="alert-circle-outline" size={30} color="#fff" />
                            <TouchableOpacity style={styles.errorRetryBtn} onPress={() => handleContinue()}>
                              <Text style={styles.errorRetryText} numberOfLines={1} adjustsFontSizeToFit>{t('retry') || 'Retry'}</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                        {successfulUploads[s] && !currentlyUploading[s] && (
                          <View style={[styles.successBadge, { top: 10, right: 10 }]}>
                            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                          </View>
                        )}
                      </View>
                    </View>

                    <Text style={[styles.selfieTitle, { color: isDark ? '#FFF' : '#111827' }]}>Take a Selfie</Text>
                    <Text style={[styles.selfieSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                      Position your face in the frame{"\n"}and take a clear selfie.
                    </Text>

                    <TouchableOpacity
                      style={styles.selfieCaptureButtonWrapper}
                      onPress={() => chooseSource(s)}
                      disabled={isSubmitting}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.selfieCaptureRing, { borderColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF' }]}>
                        <View style={[styles.selfieCaptureButton, { backgroundColor: '#2563EB' }]}>
                          <Ionicons name="camera" size={20} color="#FFF" />
                        </View>
                      </View>
                    </TouchableOpacity>

                    <Text style={[styles.selfieCaptureTitle, { color: isDark ? '#FFF' : '#111827' }]}>{hasImage ? 'Retake Selfie' : 'Capture Selfie'}</Text>
                    <Text style={[styles.selfieCaptureSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Tap to open camera</Text>

                    <View style={[styles.selfieTipsContainer, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }]}>
                      <View style={styles.selfieTipsHeader}>
                        <Ionicons name="bulb-outline" size={20} color="#2563EB" />
                        <Text style={[styles.selfieTipsTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Tips for a perfect selfie</Text>
                      </View>

                      <View style={styles.selfieTipsGrid}>
                        <View style={styles.selfieTipsCol}>
                          <View style={styles.selfieTipsListItem}>
                            <Ionicons name="checkmark-circle-outline" size={12} color="#2563EB" />
                            <Text style={[styles.selfieTipsListText, { color: isDark ? '#CBD5E1' : '#334155' }]}>Look straight into the camera</Text>
                          </View>
                          <View style={styles.selfieTipsListItem}>
                            <Ionicons name="checkmark-circle-outline" size={12} color="#2563EB" />
                            <Text style={[styles.selfieTipsListText, { color: isDark ? '#CBD5E1' : '#334155' }]}>Ensure good lighting</Text>
                          </View>
                        </View>
                        <View style={styles.selfieTipsCol}>
                          <View style={styles.selfieTipsListItem}>
                            <Ionicons name="checkmark-circle-outline" size={12} color="#2563EB" />
                            <Text style={[styles.selfieTipsListText, { color: isDark ? '#CBD5E1' : '#334155' }]}>Remove sunglasses, mask or hat</Text>
                          </View>
                          <View style={styles.selfieTipsListItem}>
                            <Ionicons name="checkmark-circle-outline" size={12} color="#2563EB" />
                            <Text style={[styles.selfieTipsListText, { color: isDark ? '#CBD5E1' : '#334155' }]}>Keep your face within the frame</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                ) : isVerticalLayout ? (
                  <View style={[styles.detailedCard, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF', borderColor: isDark ? '#374151' : '#F3F4F6' }]}>
                    <View style={styles.detailedCardContent}>
                      <Text style={[styles.detailedCardTitle, { color: isDark ? '#FFF' : '#111827' }]}>
                        {s === 'front' ? 'Upload Front Side' : 'Upload Back Side'}
                      </Text>
                      <Text style={[styles.detailedCardSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                        Capture a clear photo of the{'\n'}
                        {s === 'front' ? 'front side' : 'back side'} of your document.
                      </Text>

                      <View style={styles.actionButtonGroup}>
                        <TouchableOpacity
                          style={styles.primaryButton}
                          onPress={() => pickImage(s, true)}
                          disabled={isSubmitting}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="camera" size={16} color="#FFF" style={{ marginRight: 4 }} />
                          <Text style={styles.primaryButtonText} numberOfLines={1} adjustsFontSizeToFit>Camera</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.secondaryButton, { borderColor: isDark ? '#3B82F6' : '#2563EB' }]}
                          onPress={() => pickImage(s, false)}
                          disabled={isSubmitting}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="image-outline" size={16} color={isDark ? '#3B82F6' : '#2563EB'} style={{ marginRight: 4 }} />
                          <Text style={[styles.secondaryButtonText, { color: isDark ? '#3B82F6' : '#2563EB' }]} numberOfLines={1} adjustsFontSizeToFit>Gallery</Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.fileInfoText}>JPG, PNG or PDF • Max size 5MB</Text>
                    </View>

                    <View style={styles.detailedCardImageContainer}>
                      <View style={[styles.scannerBracket, styles.bracketTopLeft, { borderColor: isDark ? '#3B82F6' : '#2563EB' }]} />
                      <View style={[styles.scannerBracket, styles.bracketTopRight, { borderColor: isDark ? '#3B82F6' : '#2563EB' }]} />
                      <View style={[styles.scannerBracket, styles.bracketBottomLeft, { borderColor: isDark ? '#3B82F6' : '#2563EB' }]} />
                      <View style={[styles.scannerBracket, styles.bracketBottomRight, { borderColor: isDark ? '#3B82F6' : '#2563EB' }]} />

                      <View style={styles.mockImageWrapper}>
                        {hasImage ? (
                          <>
                            <Image source={{ uri: images[s] }} style={styles.uploadedDetailedImage} />

                            {isSubmitting && currentlyUploading[s] && (
                              <View style={[styles.uploadOverlay, { borderRadius: 12 }]}>
                                <View style={styles.progressCircleContainer}>
                                  <Svg width="60" height="60" viewBox="0 0 100 100">
                                    <Circle cx="50" cy="50" r="45" stroke="#FFFFFF33" strokeWidth="8" fill="transparent" />
                                    <Circle
                                      cx="50" cy="50" r="45" stroke="#10B981" strokeWidth="8" fill="transparent"
                                      strokeDasharray={`${2 * Math.PI * 45}`}
                                      strokeDashoffset={`${2 * Math.PI * 45 * (1 - (uploadProgress[s] || 0))}`}
                                      strokeLinecap="round" transform="rotate(-90 50 50)"
                                    />
                                  </Svg>
                                  <View style={styles.percentageTextContainer}>
                                    <Text style={styles.percentageText}>{Math.round((uploadProgress[s] || 0) * 100)}%</Text>
                                  </View>
                                </View>
                              </View>
                            )}

                            {uploadErrors[s] && !currentlyUploading[s] && (
                              <View style={[styles.uploadOverlay, { borderRadius: 12, backgroundColor: 'rgba(220, 38, 38, 0.7)' }]}>
                                <Ionicons name="alert-circle-outline" size={30} color="#fff" />
                                <TouchableOpacity style={styles.errorRetryBtn} onPress={() => handleContinue()}>
                                  <Text style={styles.errorRetryText} numberOfLines={1} adjustsFontSizeToFit>{t('retry') || 'Retry'}</Text>
                                </TouchableOpacity>
                              </View>
                            )}

                            {successfulUploads[s] && !currentlyUploading[s] && (
                              <View style={[styles.successBadge, { top: 4, right: 4 }]}>
                                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                              </View>
                            )}
                          </>
                        ) : (
                          <Image
                            source={
                              docKey === 'Aadhar_Card'
                                ? (s === 'front' ? require('../../assets/images/aadhar.png') : require('../../assets/images/aadhar_back.png'))
                                : docKey === 'Pan_Card'
                                  ? require('../../assets/images/pan.png')
                                  : docKey === 'Driving_License'
                                    ? require('../../assets/images/dl.png')
                                    : require('../../assets/images/documents.png')
                            }
                            style={styles.mockImage}
                          />
                        )}
                      </View>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => chooseSource(s)}
                    disabled={isSubmitting}
                    style={[
                      styles.uploadBox,
                      isSelfie && styles.selfieBox,
                      {
                        backgroundColor: isDark ? '#374151' : '#F9FAFB',
                        borderColor: hasImage
                          ? '#2E7D32'
                          : (isDark ? '#4B5563' : '#E5E7EB'),
                      },
                    ]}
                  >
                    {hasImage ? (
                      <>
                        <Image
                          source={{ uri: images[s] }}
                          style={[styles.image, isSelfie ? styles.selfieImage : { resizeMode: 'contain' }]}
                        />

                        {isSubmitting && currentlyUploading[s] && (
                          <View style={[styles.uploadOverlay, isSelfie && { borderRadius: 75 }]}>
                            <View style={styles.progressCircleContainer}>
                              <Svg width="60" height="60" viewBox="0 0 100 100">
                                {/* Background Circle */}
                                <Circle
                                  cx="50"
                                  cy="50"
                                  r="45"
                                  stroke="#FFFFFF33"
                                  strokeWidth="8"
                                  fill="transparent"
                                />
                                {/* Progress Circle */}
                                <Circle
                                  cx="50"
                                  cy="50"
                                  r="45"
                                  stroke="#10B981"
                                  strokeWidth="8"
                                  fill="transparent"
                                  strokeDasharray={`${2 * Math.PI * 45}`}
                                  strokeDashoffset={`${2 * Math.PI * 45 * (1 - (uploadProgress[s] || 0))}`}
                                  strokeLinecap="round"
                                  transform="rotate(-90 50 50)"
                                />
                              </Svg>
                              <View style={styles.percentageTextContainer}>
                                <Text style={styles.percentageText}>
                                  {Math.round((uploadProgress[s] || 0) * 100)}%
                                </Text>
                              </View>
                            </View>
                          </View>
                        )}

                        {/* ERROR & RETRY */}
                        {uploadErrors[s] && !currentlyUploading[s] && (
                          <View style={[styles.uploadOverlay, isSelfie && { borderRadius: 75 }, { backgroundColor: 'rgba(220, 38, 38, 0.7)' }]}>
                            <Ionicons name="alert-circle-outline" size={30} color="#fff" />
                            <TouchableOpacity
                              style={styles.errorRetryBtn}
                              onPress={() => handleContinue()}
                            >
                              <Text style={styles.errorRetryText} numberOfLines={1} adjustsFontSizeToFit>{t('retry') || 'Retry'}</Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        {/* SUCCESS BADGE */}
                        {successfulUploads[s] && !currentlyUploading[s] && (
                          <View style={[styles.successBadge, isSelfie && { top: 5, right: 5 }]}>
                            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                          </View>
                        )}

                        {/* ACTION BUTTONS (View & Retake) - Non-Selfie stays inside */}
                        {!isSubmitting && !isSelfie && (
                          <View style={styles.actionButtonsRow}>

                            <TouchableOpacity
                              style={[styles.actionButton, styles.retakeButton]}
                              onPress={() => chooseSource(s)}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="camera-reverse-outline" size={16} color="#fff" />
                              <Text style={styles.actionButtonText} numberOfLines={1} adjustsFontSizeToFit>{t('retake') || 'Retake'}</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </>
                    ) : (
                      <View style={styles.placeholder}>
                        {isUploading ? (
                          <ActivityIndicator color={colors.primary} />
                        ) : (
                          <>

                            <View>
                              <Ionicons
                                name={isSelfie ? "person-outline" : "camera-outline"}
                                size={isSelfie ? 40 : 26}
                                color={isSelfie ? colors.primary : colors.border}
                                style={isSelfie && { opacity: 0.8 }}
                              />
                            </View>
                            <Text style={[styles.placeholderText, { color: isDark ? '#6B7280' : '#9CA3AF' }]} numberOfLines={1} adjustsFontSizeToFit>
                              {isSelfie ? t('profile_selfie') : t('tap_to_upload')}
                            </Text>
                            {isSelfie && (
                              <Text style={[styles.placeholderText, { fontSize: 12, marginTop: 4, color: colors.primary }]} numberOfLines={1} adjustsFontSizeToFit>
                                {t('tap_to_upload')}
                              </Text>
                            )}
                          </>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        {/* TIPS SECTION */}
        {docKey !== 'Profile_Selfie' && (
          <View style={[styles.tipsCardContainer, { backgroundColor: isDark ? '#1E293B' : '#F0F5FF' }]}>
            <View style={styles.tipsIconContainer}>
              <Ionicons name="shield-checkmark" size={28} color="#2563EB" />
            </View>

            <View style={styles.tipsContentContainer}>
              <Text style={[styles.tipsTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                Tips for a successful upload
              </Text>

              <View style={styles.tipsListItem}>
                <Ionicons name="checkmark-circle-outline" size={14} color="#2563EB" />
                <Text style={[styles.tipsListText, { color: isDark ? '#CBD5E1' : '#334155', flex: 1, flexWrap: 'wrap' }]}>
                  Capture all corners of the document
                </Text>
              </View>

              <View style={styles.tipsListItem}>
                <Ionicons name="checkmark-circle-outline" size={14} color="#2563EB" />
                <Text style={[styles.tipsListText, { color: isDark ? '#CBD5E1' : '#334155', flex: 1, flexWrap: 'wrap' }]}>
                  The text and photo must be clearly visible
                </Text>
              </View>

              <View style={styles.tipsListItem}>
                <Ionicons name="checkmark-circle-outline" size={14} color="#2563EB" />
                <Text style={[styles.tipsListText, { color: isDark ? '#CBD5E1' : '#334155', flex: 1, flexWrap: 'wrap' }]}>
                  Avoid blur, glare or dark images
                </Text>
              </View>
            </View>

            <View style={styles.tipsRightImageWrapper}>
              <Image
                source={require('../../assets/images/clearImg.png')}
                style={styles.tipsRightImage}
                resizeMode="contain"
              />
            </View>
          </View>
        )}

        {/* FOOTER SECTION */}
        <View style={{ marginTop: 'auto' }}>
          {/* CONTINUE */}
          {Object.keys(images).length === side.length && (
            <Button
              disabled={isSubmitting}
              onPress={handleContinue}
              style={{ height: 48, borderRadius: 12, backgroundColor: '#2563EB', borderColor: '#2563EB' }}
            >
              {isSubmitting ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                    {uploadStage === 'uploading' ? t('uploading_doc', 'Uploading...') :
                      uploadStage === 'verifying' ? t('verifying_doc', 'Verifying document...') :
                        uploadStage === 'saving' ? t('saving_doc', 'Saving...') : t('processing', 'Processing...')}
                  </Text>
                </View>
              ) : t('save_continue')}
            </Button>
          )}

          {/* SECURITY */}
          <View style={styles.secureRow}>
            <Ionicons
              name="shield-checkmark-outline"
              size={16}
              color={colors.text}
            />
            <Text style={[styles.secureText, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
              {t('docs_secure_note')}
            </Text>
          </View>
        </View>
      </View>

      <ImageZoomModal
        visible={!!zoomImage}
        imageUris={zoomImage ? [zoomImage] : []}
        onClose={() => setZoomImage(null)}
      />

      <ImageSourcePicker
        ref={imagePickerRef}
        onCameraSelect={(side) => pickImage(side, true)}
        onGallerySelect={(side) => pickImage(side, false)}
      />

      <DocSubmissionResultModal
        visible={submissionStatus !== null}
        status={submissionStatus || 'failed'}
        ocrErrorCode={ocrErrorCode}
        message={ocrErrorMessage || undefined}
        onClose={() => {
          setSubmissionStatus(null);
          setOcrErrorCode(null);
          setOcrErrorMessage(null);
        }}
        onRetake={() => {
          setSubmissionStatus(null);
          setOcrErrorCode(null);
          setOcrErrorMessage(null);
          // Open camera directly for the first side
          const firstSide = side[0];
          if (firstSide) {
            chooseSource(firstSide);
          }
        }}
      />
    </SafeAreaView>
  );
};

export default DocumentUploadScreen;

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerTextContainer: {
    flex: 1,
    paddingRight: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  headerImage: {
    width: 140,
    height: 100,
    resizeMode: 'contain',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  col: {
    flex: 1,
  },
  selfieRow: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  selfieCol: {
    width: '100%',
    alignItems: 'center',
  },
  sideLabel: {
    fontSize: 13,
    marginBottom: 8,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
  },
  uploadBox: {
    height: 180,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  selfieBox: {
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: 'visible',
    alignSelf: 'center',
    backgroundColor: '#F9FAFB',
  },
  selfieImage: {
    width: 200,
    height: 200,
    borderRadius: 100,
    resizeMode: 'cover',
  },
  selfieActionRowOutside: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 20,
    marginBottom: 10,
  },
  selfieCircleBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    alignItems: 'center',
    padding: 20,
  },
  placeholderText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
    textAlign: 'center',
  },
  actionButtonsRow: {
    position: 'absolute',
    bottom: 12,
    flexDirection: 'row',
    gap: 8,
    alignSelf: 'center',
  },
  selfieActionRow: {
    bottom: -15,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(17, 24, 39, 0.8)',
  },
  selfieActionButton: {
    width: 44,
    height: 44,
    paddingHorizontal: 0,
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  viewButton: {
    backgroundColor: 'rgba(37, 99, 235, 0.9)',
  },
  retakeButton: {
    backgroundColor: 'rgba(17, 24, 39, 0.8)',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  secureText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  rejectionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  rejectionText: {
    marginLeft: 12,
    fontSize: 14,
    lineHeight: 20,
    color: '#B91C1C',
    flex: 1,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressCircleContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 60,
    height: 60,
  },
  percentageTextContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentageText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  errorRetryBtn: {
    marginTop: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
  errorRetryText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '800',
  },
  successBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#fff',
    borderRadius: 15,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  detailedCard: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  detailedCardContent: {
    flex: 1,
    paddingRight: 12,
  },
  detailedCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  detailedCardSubtitle: {
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 10,
  },
  actionButtonGroup: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  secondaryButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  fileInfoText: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  detailedCardImageContainer: {
    width: 120,
    height: 86,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockImageWrapper: {
    width: 100,
    height: 66,
    borderRadius: 6,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  mockImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  uploadedDetailedImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  scannerBracket: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderWidth: 2,
    borderColor: '#2563EB',
    zIndex: 10,
    borderRadius: 2,
  },
  bracketTopLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  bracketTopRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bracketBottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bracketBottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  tipsCardContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tipsIconContainer: {
    marginRight: 8,
  },
  tipsContentContainer: {
    flex: 1,
    paddingRight: 6,
  },
  tipsTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  tipsListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  tipsListText: {
    fontSize: 11,
    marginLeft: 4,
  },
  tipsRightImageWrapper: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipsRightImage: {
    width: '100%',
    height: '100%',
  },
  selfieDetailedContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 10,
  },
  selfieCircleWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  selfiePlaceholderCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  selfieHasImage: {
    backgroundColor: 'transparent',
  },
  selfieCapturedImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  selfieTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  selfieSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 20,
  },
  selfieCaptureButtonWrapper: {
    marginBottom: 12,
  },
  selfieCaptureRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selfieCaptureButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selfieCaptureTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  selfieCaptureSubtitle: {
    fontSize: 11,
    marginBottom: 20,
  },
  selfieTipsContainer: {
    width: '100%',
    borderRadius: 12,
    padding: 12,
  },
  selfieTipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  selfieTipsTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  selfieTipsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  selfieTipsCol: {
    flex: 1,
  },
  selfieTipsListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  selfieTipsListText: {
    fontSize: 10,
    marginLeft: 4,
    flexShrink: 1,
  },
});
