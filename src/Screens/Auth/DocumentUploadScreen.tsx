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
import { useAppTheme } from '../../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import DocGuidelines from '../../Components/DocGuidelines';
import { useHaptic } from '../../hooks/useHaptic';
import ImageZoomModal from '../../Components/ImageZoomModal';
import { ImageSourcePicker } from '../../Components';
import type { ImageSourcePickerRef } from '../../Components/ImageSourcePicker';
import { checkCameraPermission, checkPhotoLibraryPermission, goToSettings } from '../../utils/permissionUtils';

/* ================= SCREEN ================= */

const DocumentUploadScreen: React.FC<any> = ({ navigation, route }) => {
  const { doc } = route.params; // We now pass the full doc object
  const { side, labelKey, backendType, key: docKey } = doc;

  const { colors, fonts } = useTheme() as any;
  const { theme } = useAppTheme();
  const { showAlert } = useAlert();
  const dispatch = useDispatch();
  const { t } = useTranslation();
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
    // Open the new premium bottom sheet instead of standard alert
    imagePickerRef.current?.present(sideName);
  };

  const currentStatus = useMemo(() => {
    const docsArray = Array.isArray(user?.documents_data) ? user.documents_data : [];
    return docsArray.find((d: any) => d.document_type === backendType);
  }, [user?.documents_data, backendType]);

  const rejectionReason = currentStatus?.rejection_reason || currentStatus?.remarks;

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

    try {
      setIsSubmitting(true);
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
          throw err; // Re-throw to stop the overall handleContinue from finishing
        } finally {
          setCurrentlyUploading(prev => ({ ...prev, [s]: false }));
        }
      });

      await Promise.all(uploadPromises);

      await saveDocument({
        driverId: user.driverId,
        documentType: backendType,
        documentUrl,
      }).unwrap();

      // Update local state
      const updatedDocs = { ...(user.documents || {}) };
      // Use LOCAL file path for preview (displayable immediately)
      // S3 URLs are private and won't load in Image component without signing
      const localPreview = images.front || images.photo || Object.values(images)[0];
      const s3Url = documentUrl.front || Object.values(documentUrl)[0];

      updatedDocs[docKey] = {
        status: 'pending',
        preview: localPreview,
      };

      const profileUpdate: any = { documents: updatedDocs };

      // 🛡️ Sync profile picture immediately if this is a selfie
      if (docKey === 'Profile_Selfie' || backendType === 'profile_selfie') {
        profileUpdate.profile_picture = localPreview;
        profileUpdate.profile_pic_url = s3Url; // Keep S3 URL for backend reference
      }

      dispatch(setUser(profileUpdate));
      setIsSubmitting(false);
      navigation.goBack();
    } catch (error) {
      setIsSubmitting(false);
      console.error('Upload Error:', error);
      showAlert({
        title: t('docs_submit_failed'),
        message: t('upload_failed_msg'),
        singleButton: true,
        icon: 'close-circle-outline',
      });
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
        {/* HEADER */}
        <View style={{ marginBottom: 20 }}>
          <Text adjustsFontSizeToFit numberOfLines={1} style={[fonts.bold, styles.title, { color: colors.text }]}>
            {t('upload_doc')} {t(labelKey)}
          </Text>
          <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.subtitle, { color: colors.text }]}>{getTip()}</Text>
        </View>

        {/* GUIDELINES */}
        {docKey !== 'Profile_Selfie' && <DocGuidelines docKey={docKey} />}

        {/* REJECTION REASON */}
        {rejectionReason && (
          <View style={styles.rejectionBox}>
            <Ionicons name="alert-circle" size={20} color="#DC2626" />
            <Text style={styles.rejectionText}>
              <Text style={[fonts.bold, { color: '#DC2626' }]}>{t('rejection_reason')}: </Text>
              {rejectionReason}
            </Text>
          </View>
        )}

        {/* UPLOAD BOXES */}
        <View style={[styles.row, docKey === 'Profile_Selfie' && styles.selfieRow]}>
          {side.map((s: string) => {
            const hasImage = !!images[s];
            const isUploading = uploadingSide === s;
            const isSelfie = docKey === 'Profile_Selfie';

            return (
              <View key={s} style={[styles.col, isSelfie && styles.selfieCol]}>
                {!isSelfie && <Text adjustsFontSizeToFit numberOfLines={1} style={styles.sideLabel}>{getSideLabel(s)}</Text>}

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => chooseSource(s)}
                  disabled={isSubmitting}
                  style={[
                    styles.uploadBox,
                    isSelfie && styles.selfieBox,
                    {
                      borderColor: hasImage
                        ? '#2E7D32'
                        : colors.border,
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
                          {isSelfie && (
                            <View
                              style={[
                                StyleSheet.absoluteFill,
                                {
                                  borderRadius: 100,
                                  borderWidth: 2,
                                  borderColor: colors.primary,
                                  borderStyle: 'dashed',
                                  opacity: 0.4
                                }
                              ]}
                            />
                          )}
                          <View>
                            <Ionicons
                              name={isSelfie ? "person-outline" : "camera-outline"}
                              size={isSelfie ? 40 : 26}
                              color={isSelfie ? colors.primary : colors.border}
                              style={isSelfie && { opacity: 0.8 }}
                            />
                          </View>
                          <Text style={styles.placeholderText} numberOfLines={1} adjustsFontSizeToFit>
                            {isSelfie ? t('profile_selfie') : t('tap_to_upload')}
                          </Text>
                        </>
                      )}
                    </View>
                  )}
                </TouchableOpacity>

                {/* SELFIE ACTION BUTTONS - Rendered outside the circle */}
                {hasImage && isSelfie && !isSubmitting && (
                  <View style={styles.selfieActionRowOutside}>

                    <TouchableOpacity
                      style={[styles.selfieCircleBtn, { backgroundColor: '#374151' }]}
                      onPress={() => chooseSource(s)}
                    >
                      <Ionicons name="camera-reverse-outline" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* SECURITY */}
        <View style={styles.secureRow}>
          <Ionicons
            name="shield-checkmark-outline"
            size={16}
            color={colors.border}
          />
          <Text style={[styles.secureText, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
            {t('docs_secure_note')}
          </Text>
        </View>

        {/* CONTINUE */}
        <Button
          disabled={Object.keys(images).length !== side.length || isSubmitting}
          onPress={handleContinue}
          style={{ height: 56, borderRadius: 16 }}
        >
          {isSubmitting ? <ActivityIndicator color="#fff" /> : t('save_continue')}
        </Button>
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
    </SafeAreaView>
  );
};

export default DocumentUploadScreen;

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  title: {
    fontSize: 22,
    marginBottom: 6,
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.6,
    marginBottom: 20,
    color: '#4B5563',
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
    flex: 0,
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
    borderWidth: 2,
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
    backgroundColor: '#F3F4F6',
    borderStyle: 'solid',
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
    backgroundColor: '#F3F4F6',
    paddingVertical: 8,
    borderRadius: 12,
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
});
