import React, { useState, useMemo } from 'react';
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import ImagePicker from 'react-native-image-crop-picker';
import { useDispatch, useSelector } from 'react-redux';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { Styles } from '../../lib/styles';
import { Text } from '../../Components';
import Button from '../../Components/Button';
import { setUser } from '../../redux/userSlice';
import { useGetDocUploadUrlMutation, useSaveDocumentMutation } from '../../service/driverApi';
import { documentApi } from '../../api/documentApi';
import { Platform } from 'react-native';
import AppStatusBar from '../../Components/AppStatusBar';
import { useAlert } from '../../context/AlertContext';
import { useAppTheme } from '../../context/ThemeContext';
import { useTranslation } from 'react-i18next';

/* ================= SCREEN ================= */

const DocumentUploadScreen: React.FC<any> = ({ navigation, route }) => {
  const { doc } = route.params; // We now pass the full doc object
  const { side, labelKey, backendType, key: docKey } = doc;
  
  const { colors, fonts } = useTheme() as any;
  const { theme } = useAppTheme();
  const { showAlert } = useAlert();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const user = useSelector((state: any) => state.userSlice.user);

  const [images, setImages] = useState<Record<string, string>>({});
  const [uploadingSide, setUploadingSide] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [getUploadUrl] = useGetDocUploadUrlMutation();
  const [saveDocument] = useSaveDocumentMutation();

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
    try {
      setUploadingSide(sideName);

      const res = fromCamera
        ? await ImagePicker.openCamera({
          width: 900,
          height: 1200,
          cropping: true,
          compressImageQuality: 0.8,
          useFrontCamera: docKey === 'Profile_Selfie',
        })
        : await ImagePicker.openPicker({
          width: 900,
          height: 1200,
          cropping: true,
          compressImageQuality: 0.8,
        });

      setImages(prev => ({
        ...prev,
        [sideName]: res.path,
      }));
    } catch {
      // cancelled
    } finally {
      setUploadingSide(null);
    }
  };

  /* ---------------- SOURCE SELECT ---------------- */
  const chooseSource = (sideName: string) => {
    showAlert({
      title: t('upload_doc'),
      message: t('choose_source'),
      confirmText: t('camera'),
      cancelText: t('gallery'),
      onConfirm: () => pickImage(sideName, true),
      onCancel: () => pickImage(sideName, false),
      icon: 'camera-outline',
    });
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

    try {
      setIsSubmitting(true);
      const documentUrl: Record<string, string> = {};

      for (const s of side) {
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

        await documentApi.uploadToS3(uploadUrl, filePath, mime);
        documentUrl[s] = fileUrl;
      }

      await saveDocument({
        driverId: user.driverId,
        documentType: backendType,
        documentUrl,
      }).unwrap();

      const updatedDocs = { ...(user.documents || {}) };
      updatedDocs[docKey] = {
        status: 'UPLOADED',
        preview: documentUrl.front || documentUrl.back || images.front || images.photo,
      };

      dispatch(setUser({ documents: updatedDocs }));
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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppStatusBar />
      <View style={[Styles.flex, styles.container]}>
        {/* HEADER */}
        <Text adjustsFontSizeToFit numberOfLines={1} style={[fonts.bold, styles.title]}>
          {t('upload_doc')} {t(labelKey)}
        </Text>

        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.subtitle}>{getTip()}</Text>

        {/* UPLOAD BOXES */}
        <View style={styles.row}>
          {side.map((s: string) => {
            const hasImage = !!images[s];
            const isUploading = uploadingSide === s;

            return (
              <View key={s} style={styles.col}>
                <Text adjustsFontSizeToFit numberOfLines={1} style={styles.sideLabel}>{getSideLabel(s)}</Text>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => chooseSource(s)}
                  style={[
                    styles.uploadBox,
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
                        source={{ uri: 'file://' + images[s] }}
                        style={styles.image}
                      />

                      {/* RETAKE */}
                      <TouchableOpacity
                        style={styles.retake}
                        onPress={() => chooseSource(s)}
                      >
                        <Ionicons name="refresh" size={18} color="#fff" />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <View style={styles.placeholder}>
                      {isUploading ? (
                        <ActivityIndicator color={colors.primary} />
                      ) : (
                        <>
                          <Ionicons
                            name="camera-outline"
                            size={26}
                            color={colors.border}
                          />
                          <Text style={styles.placeholderText}>
                            {t('tap_to_upload')}
                          </Text>
                        </>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
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
          <Text style={styles.secureText}>
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
    </View>
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
  sideLabel: {
    fontSize: 13,
    marginBottom: 6,
    opacity: 0.7,
    color: '#374151',
  },
  uploadBox: {
    height: 220,
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 13,
    opacity: 0.6,
    color: '#6B7280',
  },
  retake: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    backgroundColor: '#000000AA',
    padding: 8,
    borderRadius: 20,
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  secureText: {
    marginLeft: 6,
    fontSize: 12,
    opacity: 0.6,
    color: '#6B7280',
  },
});
