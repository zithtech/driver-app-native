import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Image,
  Linking,
  Animated,
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { RootState } from '../../redux/store';
import { Text, DocSubmissionResultModal } from '../../Components';
import Button from '../../Components/Button';
import {
  useSubmitDocumentsMutation,
  useGetDriverDocumentsQuery,
  useLazyGetDriverProfileQuery,
} from '../../service/driverApi';
import { useAppTheme } from '../../context/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import { useDispatch, useSelector } from 'react-redux';
import { setUser } from '../../redux/userSlice';
import AppStatusBar from '../../Components/AppStatusBar';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';

import {
  AadharCard,
  DrivingLicence,
  PanCard,
  PoliceVerification,
} from '../../assets/svg';

import { DocumentUploadScreen_Nav, Dashboard_Nav } from '../../Navigations/navigations';
import { useHaptic } from '../../hooks/useHaptic';
import ImageZoomModal from '../../Components/ImageZoomModal';
import { resolveImageUrl, resolveAllImageUrls } from '../../utils/imageUtils';
import WaitingForApprovalModal from './components/WaitingForApprovalModal';

/* ================= TYPES ================= */

interface DocumentItem {
  key: 'Driving_License' | 'Pan_Card' | 'Aadhar_Card' | 'Police_Verification' | 'Profile_Selfie';
  backendType: 'driving_license' | 'pan_card' | 'aadhaar_card' | 'police_verification' | 'profile_selfie';
  labelKey: string;
  Logo: React.ComponentType<any>;
  typeKey: string;
  hintKey: string;
  side: ('front' | 'back')[];
  required?: boolean;
}

/* ================= ANIMATED TIPS ================= */

const TIPS = [
  { icon: 'flash-off-outline', key: 'tip_avoid_glare' },
  { icon: 'eye-outline', key: 'tip_readable' },
  { icon: 'sunny-outline', key: 'tip_lighting' },
];

const AnimatedTips = ({ t, fonts }: { t: any; fonts: any }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const tipAnims = useRef(TIPS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // Container fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start(() => {
      // Then stagger each tip
      Animated.stagger(
        150,
        tipAnims.map(anim =>
          Animated.spring(anim, {
            toValue: 1,
            tension: 60,
            friction: 8,
            useNativeDriver: true,
          }),
        ),
      ).start();
    });
  }, []);

  return (
    <Animated.View style={[styles.tipsContainer, { opacity: fadeAnim }]}>
      <View style={styles.tipsHeader}>
        <Ionicons name="bulb" size={18} color="#F59E0B" />
        <Text style={[fonts.bold, styles.tipsTitle]} numberOfLines={1} adjustsFontSizeToFit>{t('docs_tips_title')}</Text>
      </View>
      <View style={styles.tipsList}>
        {TIPS.map((tip, index) => (
          <Animated.View
            key={tip.key}
            style={[
              styles.tipItem,
              {
                opacity: tipAnims[index],
                transform: [
                  {
                    translateY: tipAnims[index].interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Ionicons name={tip.icon} size={16} color="#6B7280" />
            <Text style={styles.tipText} numberOfLines={1} adjustsFontSizeToFit>{t(tip.key)}</Text>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
};

/* ================= TIMELINE COMPONENT ================= */



/* ================= SCREEN ================= */

const DocumentScreen = ({ navigation }: any) => {
  const { colors, fonts } = useTheme() as any;
  const { theme, isDark } = useAppTheme();
  const { showAlert } = useAlert();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { triggerHaptic } = useHaptic();
  const { showToast } = useToast();
  const prevDocsStatus = useRef<Record<string, string>>({});
  const [zoomData, setZoomData] = React.useState<{ uris: string[]; title: string } | null>(null);
  const [submissionStatus, setSubmissionStatus] = React.useState<'success' | 'failed' | null>(null);
  const [showTips, setShowTips] = React.useState(false);
  const [hideRejectedModal, setHideRejectedModal] = React.useState(false);


  /* ================= DOCUMENT CONFIG ================= */
  const DOCUMENTS: DocumentItem[] = useMemo(() => [
    {
      key: 'Profile_Selfie',
      backendType: 'profile_selfie',
      labelKey: 'profile_selfie',
      Logo: ({ width }: any) => <Ionicons name="person-add-outline" size={width || 30} color="#1D4ED8" />,
      typeKey: 'docs_headshot',
      hintKey: 'docs_hint_selfie',
      side: ['front'],
      required: true,
    },
    {
      key: 'Driving_License',
      backendType: 'driving_license',
      labelKey: 'driving_license',
      Logo: DrivingLicence,
      typeKey: 'docs_front_back',
      hintKey: 'docs_hint_dl',
      side: ['front', 'back'],
      required: true,
    },
    {
      key: 'Pan_Card',
      backendType: 'pan_card',
      labelKey: 'pan_card',
      Logo: PanCard,
      typeKey: 'docs_front_only',
      hintKey: 'docs_hint_pan',
      side: ['front'],
      required: true,
    },
    {
      key: 'Aadhar_Card',
      backendType: 'aadhaar_card',
      labelKey: 'aadhar_card',
      Logo: AadharCard,
      typeKey: 'docs_front_back',
      hintKey: 'docs_hint_aadhar',
      side: ['front', 'back'],
      required: true,
    },
    {
      key: 'Police_Verification',
      backendType: 'police_verification',
      labelKey: 'police_verification',
      Logo: PoliceVerification,
      typeKey: 'docs_certificate',
      hintKey: 'docs_hint_police',
      side: ['front'],
      required: false,
    },
  ], []);

  const [submitDocuments, { isLoading: isSubmitting }] = useSubmitDocumentsMutation();
  const [fetchProfile] = useLazyGetDriverProfileQuery();

  const user = useSelector((state: RootState) => state.userSlice.user);
  const { data: remoteDocs, refetch, isFetching } = useGetDriverDocumentsQuery(user?.driverId || '', {
    skip: !user?.driverId,
    refetchOnMountOrArgChange: true,
  });

  const isWaitingForAdmin = user?.onboarding_status === 'DOCS_SUBMITTED';
  const isDocsRejected = user?.onboarding_status === 'DOCS_REJECTED';

  // Poll for status changes while on the waiting screen
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (remoteDocs) {
      const docsArray = Array.isArray(remoteDocs) ? remoteDocs : (remoteDocs?.data ?? []);
      dispatch(setUser({ documents_data: docsArray }));

      // --- REAL-TIME STATUS NOTIFICATIONS ---
      docsArray.forEach((doc: any) => {
        const type = doc.document_type;
        const status = (doc.status || doc.license_status || doc.licenseStatus || '').toLowerCase();
        const prevStatus = prevDocsStatus.current[type];

        if (prevStatus && prevStatus !== status) {
          const docLabel = DOCUMENTS.find(d => d.backendType === type)?.labelKey || type;
          if (status === 'verified' || status === 'approved') {
            triggerHaptic(HapticFeedbackTypes.notificationSuccess);
          } else if (status === 'rejected') {
            showToast({
              message: `${t(docLabel)} ${t('rejected_msg') || 'Rejected. Please check reason.'}`,
              type: 'error',
            });
            triggerHaptic(HapticFeedbackTypes.notificationError);
          }
        }
        prevDocsStatus.current[type] = status;
      });
    }
  }, [remoteDocs, dispatch, t, showToast, triggerHaptic, DOCUMENTS]);

  useFocusEffect(
    useCallback(() => {
      if (isWaitingForAdmin && user?.driverId) {
        // Poll every 10s to check if admin approved/rejected
        pollRef.current = setInterval(async () => {
          try {
            await refetch();
            // Re-fetch driver profile to get latest onboarding_status
            const profileResult = await fetchProfile().unwrap();
            const profile = profileResult?.data || profileResult;
            if (profile?.onboarding_status && profile.onboarding_status !== user?.onboarding_status) {
              // Sync whole profile to get status, status_reason, etc.
              dispatch(setUser(profile));
            }
          } catch (_) { }
        }, 10000);
      }
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }, [isWaitingForAdmin, user?.driverId])
  );

  // 🛡️ Navigate away if onboarding status changes to complete (e.g. via Socket or Polling)
  useEffect(() => {
    const status = user?.onboarding_status;
    const accountStatus = user?.status;
    const kycStatus = user?.kyc_status;
    const kycStatusStr = typeof kycStatus === 'object' ? kycStatus?.overallStatus : kycStatus;

    if (
      status === 'DOCUMENTS_APPROVED' ||
      status === 'DOCUMENTS_VERIFIED' ||
      status === 'ONBOARDING_COMPLETED' ||
      status === 'ACTIVE' ||
      accountStatus === 'active' ||
      kycStatusStr === 'verified'
    ) {
      if (pollRef.current) clearInterval(pollRef.current);
      navigation.replace(Dashboard_Nav, { showVerificationSuccess: true });
    }
  }, [user?.onboarding_status, user?.status, user?.kyc_status, navigation]);

  /* ---------------- PROGRESS ---------------- */

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

  const getDocState = useCallback((doc: DocumentItem) => {
    // 1. Check local Redux state (preferred for immediate feedback after upload)
    const localDocs = (!Array.isArray(user?.documents) ? user?.documents : {}) as Record<string, any>;
    const localDoc = localDocs?.[doc.key];

    // 2. Check remote documents (from API or bootstrap)
    const docsArray = Array.isArray(remoteDocs) ? remoteDocs : (remoteDocs?.data ?? []);
    let remoteDoc = docsArray.find((d: any) => d.document_type === doc.backendType);

    if (!remoteDoc && Array.isArray(user?.documents_data)) {
      remoteDoc = user?.documents_data.find((d: any) => d.document_type === doc.backendType);
    }

    if (!remoteDoc && Array.isArray(user?.documents)) {
       remoteDoc = user?.documents.find((d: any) => d.document_type === doc.backendType || d.documentType === doc.backendType);
    }

    // Determine Status: prefer remote, then local
    const status = remoteDoc?.status || remoteDoc?.license_status || remoteDoc?.licenseStatus || localDoc?.status;

    // Determine Preview: prefer LOCAL then remote
    let finalPreview = null;
    if (localDoc?.preview) {
      finalPreview = localDoc.preview;
    } else if (remoteDoc) {
      finalPreview = remoteDoc.document_url || remoteDoc.documentUrl || remoteDoc.file_url;
    }

    return {
      status,
      preview: resolveImageUrl(finalPreview),
      rejection_reason: remoteDoc?.rejection_reason || remoteDoc?.remarks || localDoc?.rejection_reason,
    };
  }, [remoteDocs, user?.documents, user?.documents_data]);

  const requiredDocuments = useMemo(() => DOCUMENTS.filter(d => d.required), [DOCUMENTS]);

  const uploadedCount = useMemo(() => {
    return requiredDocuments.filter(doc => {
      const state = getDocState(doc);
      const currentStatus = (state.status || '').toLowerCase();
      return (
        currentStatus === 'uploaded' ||
        currentStatus === 'pending' ||
        currentStatus === 'verified' ||
        currentStatus === 'approved'
      );
    }).length;
  }, [getDocState, requiredDocuments]);

  const progress = Math.round(
    (uploadedCount / requiredDocuments.length) * 100
  );

  const { otherDocs } = useMemo(() => {
    return { otherDocs: DOCUMENTS };
  }, [DOCUMENTS]);

  const allUploaded = uploadedCount === requiredDocuments.length;

  const rejectedDocs = useMemo(() => {
    return otherDocs.filter(doc => getDocState(doc).status?.toLowerCase() === 'rejected');
  }, [otherDocs, getDocState]);

  const rejectionReasonsText = useMemo(() => {
    return rejectedDocs.map(doc => `• ${t(doc.labelKey)}: ${getDocState(doc).rejection_reason || t('invalid_document', 'Invalid document')}`).join('\n');
  }, [rejectedDocs, getDocState, t]);

  const handleSubmit = async () => {
    if (!user?.driverId) { return; }

    try {
      await submitDocuments(user.driverId).unwrap();
      // Delaying the dispatch until the success modal is closed to prevent iOS Modal overlap
      triggerHaptic(HapticFeedbackTypes.notificationSuccess);
      setSubmissionStatus('success');
    } catch (error: any) {
      console.error('Failed to submit docs:', error);
      setSubmissionStatus('failed');
    }
  };

  /* ================= UI ================= */

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={['top', 'bottom']}
    >
      <AppStatusBar />
      {/* --- WAITING MODAL --- */}
      <WaitingForApprovalModal
        visible={(isWaitingForAdmin || isDocsRejected) && !hideRejectedModal}
        status={isDocsRejected ? 'rejected' : 'review'}
        rejectionReasons={rejectionReasonsText}
        onReupload={() => {
          setHideRejectedModal(true);
        }}
        fonts={fonts}
        onCheckStatus={() => {
          refetch();
          fetchProfile();
          showToast({ message: t('check_status') || 'Refreshing...', type: 'info' });
        }}
        onContactSupport={() => {
          Linking.openURL('tel:+919043522612');
        }}
      />


      {/* PROGRESS HEADER */}
      <View style={styles.progressHeader}>
        <View style={styles.progressContainer}>
          {requiredDocuments.map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressBar,
                { backgroundColor: i < uploadedCount ? '#10B981' : (isDark ? '#374151' : '#E5E7EB') }
              ]}
            />
          ))}
        </View>
        <View style={styles.progressLabelRow}>
          <Text style={styles.progressText}>
            {t('step_docs_label')} <Text style={styles.activeProgressText}>• {uploadedCount} {t('of')} {requiredDocuments.length} {t('completed')}</Text>
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 10, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
      >
        {isFetching && !remoteDocs ? (
          <View style={{ gap: 15 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <View key={i} style={[styles.docItem, { opacity: 0.5, backgroundColor: isDark ? theme.colors.card : '#FFFFFF' }]}>
                <View style={[styles.docIconBox, { backgroundColor: isDark ? '#374151' : '#E5E7EB' }]} />
                <View style={{ flex: 1, marginLeft: 15, gap: 8 }}>
                  <View style={{ height: 16, width: '60%', backgroundColor: isDark ? '#374151' : '#E5E7EB', borderRadius: 4 }} />
                  <View style={{ height: 12, width: '40%', backgroundColor: isDark ? '#374151' : '#E5E7EB', borderRadius: 4 }} />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <>
            <View style={{ marginBottom: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, paddingRight: 15 }}>
                <Text adjustsFontSizeToFit numberOfLines={1} style={[fonts.bold, { fontSize: 28, color: colors.text }]}>
                  {t('docs_title')}
                </Text>
                <Text adjustsFontSizeToFit numberOfLines={1} style={{ fontSize: 16, color: colors.text, opacity: 0.6, marginTop: 5 }}>
                  {t('docs_subtitle')}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowTips(true)} style={{ padding: 10 }}>
                 <Ionicons name="bulb" size={24} color="#F59E0B" />
              </TouchableOpacity>
            </View>

            {/* REJECTION BANNER */}
            {(isDocsRejected || user?.status === 'rejected' || user?.status === 'blocked') && (
              <View style={[styles.rejectionBanner, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2', borderColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FECACA' }, (user?.status === 'blocked' || user?.status === 'rejected') && { borderLeftColor: '#EF4444' }]}>
                <Ionicons name="warning-outline" size={22} color="#DC2626" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[fonts.bold, { color: isDark ? '#FCA5A5' : '#DC2626', fontSize: 14 }]}>
                    {user?.status === 'blocked' ? t('account_restricted', 'Account Restricted') : t('docs_rejected_title', 'Documents Need Correction')}
                  </Text>
                  <Text style={{ color: isDark ? '#FECACA' : '#7F1D1D', fontSize: 12, marginTop: 2 }}>
                    {user?.status_reason || t('docs_rejected_desc', 'Some documents were rejected. Please re-upload the highlighted items below.')}
                  </Text>
                </View>
              </View>
            )}



            {/* LIST */}
            {otherDocs.map((doc) => {
              const state = getDocState(doc);
              const currentStatus = (state.status || '').toLowerCase();
              const isDone = currentStatus === 'uploaded' || currentStatus === 'pending' || currentStatus === 'verified';
              const isRejected = currentStatus === 'rejected';

              return (
                <TouchableOpacity
                  key={doc.key}
                  onPress={() => {
                    triggerHaptic(HapticFeedbackTypes.impactLight);
                    navigation.navigate(DocumentUploadScreen_Nav, { doc });
                  }}
                  style={[
                    styles.docItem,
                    { backgroundColor: isDark ? theme.colors.card : '#FFFFFF' },
                    isDone && { borderLeftWidth: 4, borderLeftColor: '#10B981' },
                    isRejected && { borderLeftWidth: 4, borderLeftColor: '#EF4444', backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FFF5F5' }
                  ]}
                >
                  <View style={[styles.docIconBox, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.1)' : '#F3F7FF' }, doc.key === 'Profile_Selfie' && { borderRadius: 25, overflow: 'hidden' }]}>
                    {doc.key === 'Profile_Selfie' && state.preview ? (
                       <Image source={{ uri: resolveImageUrl(state.preview) }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                    ) : (
                       <doc.Logo width={30} height={30} />
                    )}
                  </View>

                  <View style={{ flex: 1, marginLeft: 15 }}>
                    <Text adjustsFontSizeToFit numberOfLines={1} style={[fonts.bold, { fontSize: 16, color: colors.text }]}>
                      {t(doc.labelKey)} {!doc.required && `(${t('optional')})`}
                    </Text>
                    <Text adjustsFontSizeToFit numberOfLines={1} style={{ fontSize: 12, color: colors.text, opacity: 0.5 }}>
                      {t(doc.typeKey)} • {t(doc.hintKey)}
                    </Text>

                    {!isDone && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                        <Ionicons name="cloud-upload-outline" size={16} color="#10B981" />
                        <Text style={{ color: '#10B981', fontSize: 13, marginLeft: 6, fontWeight: '600' }}>
                          {t('tap_to_upload') || 'Tap to upload'}
                        </Text>
                      </View>
                    )}

                    {isDone && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 12 }}>

                        <TouchableOpacity
                          onPress={() => navigation.navigate(DocumentUploadScreen_Nav, { doc })}
                          style={[styles.actionBtn, { backgroundColor: isDark ? '#374151' : '#F3F4F6', borderColor: isDark ? '#4B5563' : '#E5E7EB' }]}
                        >
                          <Ionicons name="camera-outline" size={14} color={isDark ? '#D1D5DB' : '#6B7280'} />
                          <Text style={[styles.actionText, { color: isDark ? '#D1D5DB' : '#6B7280' }]} numberOfLines={1} adjustsFontSizeToFit>{t('retake') || 'Retake'}</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {isRejected && state.rejection_reason && (
                      <Text style={{ color: '#EF4444', fontSize: 11, marginTop: 4, fontWeight: '600' }}>
                        {t('rejected')}: {state.rejection_reason}
                      </Text>
                    )}
                  </View>

                  <View style={[
                    styles.statusBadge,
                    {
                      backgroundColor: isRejected ? '#EF4444' : isDone ? '#10B981' : (isDark ? '#374151' : '#F3F4F6'),
                      borderWidth: isDone || isRejected ? 0 : 1,
                      borderColor: isDark ? '#4B5563' : '#E5E7EB'
                    }
                  ]}>
                    <Ionicons
                      name={isRejected ? 'close' : isDone ? 'checkmark' : 'chevron-forward'}
                      size={isDone ? 20 : 18}
                      color={isDone || isRejected ? '#FFFFFF' : '#9CA3AF'}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}



          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: isDark ? theme.colors.background : '#FFFFFF', borderTopColor: isDark ? '#374151' : '#F3F4F6' }]}>
        <Button
          disabled={!allUploaded || isSubmitting}
          loading={isSubmitting}
          onPress={() => {
            triggerHaptic(HapticFeedbackTypes.impactMedium);
            handleSubmit();
          }}
          style={[
            { height: 56, borderRadius: 16 },
            allUploaded && !isSubmitting && { backgroundColor: '#10B981', borderColor: '#10B981' }
          ]}
        >
          {allUploaded && !isSubmitting ? t('ready_to_submit') : t('submit_for_verification')}
        </Button>
      </View>

      <ImageZoomModal
        visible={!!zoomData}
        onClose={() => setZoomData(null)}
        imageUris={zoomData?.uris || []}
        title={zoomData?.title}
      />

      <DocSubmissionResultModal
        visible={submissionStatus !== null}
        status={submissionStatus || 'failed'}
        onClose={() => {
          if (submissionStatus === 'success') {
            dispatch(setUser({ onboarding_status: 'DOCS_SUBMITTED' }));
          }
          setSubmissionStatus(null);
        }}
      />

      <Modal visible={showTips} transparent={true} animationType="fade" onRequestClose={() => setShowTips(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: isDark ? theme.colors.card : colors.background, borderRadius: 20, padding: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="bulb" size={24} color="#F59E0B" />
                <Text style={[fonts.bold, { fontSize: 18, color: colors.text, marginLeft: 8 }]}>{t('docs_tips_title') || 'Tips for fast approval'}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowTips(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={{ gap: 16 }}>
              {TIPS.map((tip) => (
                <View key={tip.key} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? '#374151' : '#F3F4F6', justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name={tip.icon} size={20} color={isDark ? '#D1D5DB' : "#6B7280"} />
                  </View>
                  <Text style={[fonts.medium, { fontSize: 14, color: colors.text, marginLeft: 12, flex: 1 }]}>
                    {t(tip.key)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default DocumentScreen;

const styles = StyleSheet.create({
  progressHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 6,
    height: 4,
  },
  progressBar: {
    flex: 1,
    height: '100%',
    borderRadius: 2,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeProgressText: {
    color: '#2563EB',
  },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  docIconBox: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: '#F3F7FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  rejectionBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  /* --- NEW WAITING UI STYLES --- */
  waitingIconWrapper: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  scanRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: '#2563EB',
    borderStyle: 'dashed',
    opacity: 0.3,
  },
  waitingIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  waitingTitle: {
    fontSize: 26,
    color: '#111827',
    textAlign: 'center',
  },
  waitingDesc: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
  },
  timelineContainer: {
    width: '100%',
    paddingHorizontal: 40,
    marginTop: 40,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 0,
    minHeight: 60,
  },
  timelineIconColumn: {
    alignItems: 'center',
    width: 30,
  },
  timelineCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  timelineCircleActive: {
    backgroundColor: '#2563EB',
    transform: [{ scale: 1.1 }],
    elevation: 4,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  timelineCircleCompleted: {
    backgroundColor: '#10B981',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 4,
  },
  timelineLineCompleted: {
    backgroundColor: '#10B981',
  },
  timelineContent: {
    marginLeft: 15,
    paddingTop: 2,
  },
  timelineLabel: {
    fontSize: 15,
    color: '#9CA3AF',
  },
  timelineSublabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  waitingActionRow: {
    width: '100%',
    paddingHorizontal: 30,
    marginTop: 50,
    gap: 12,
  },
  checkStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  checkStatusText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 10,
  },
  waitingSupportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  waitingFooter: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 30,
    textAlign: 'center',
  },
  profileUploadWrapper: {
    alignItems: 'center',
    marginBottom: 30,
  },
  profileUploadContainer: {
    position: 'relative',
    marginBottom: 10,
  },
  profileCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  addIconBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileLabel: {
    fontSize: 16,
    color: '#374151',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  tipsContainer: {
    backgroundColor: '#FFFBEB',
    borderRadius: 20,
    padding: 16,
    marginTop: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tipsTitle: {
    fontSize: 15,
    color: '#92400E',
    marginLeft: 8,
  },
  tipsList: {
    gap: 8,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tipText: {
    fontSize: 13,
    color: '#4B5563',
    marginLeft: 10,
    lineHeight: 18,
  },
});
