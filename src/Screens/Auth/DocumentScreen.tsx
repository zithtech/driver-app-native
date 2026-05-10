import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { RootState } from '../../redux/store';
import { Text } from '../../Components';
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
import { ActivityIndicator, Modal, RefreshControl, ScrollView } from 'react-native';
import AppStatusBar from '../../Components/AppStatusBar';
import { useTranslation } from 'react-i18next';

import {
  AadharCard,
  DrivingLicence,
  PanCard,
  PoliceVerification,
} from '../../assets/svg';

import {
  DocumentUploadScreen_Nav,
  Dashboard_Nav,
} from '../../Navigations/navigations';

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

/* ================= SCREEN ================= */

const DocumentScreen = ({ navigation }: any) => {
  const { colors, fonts } = useTheme() as any;
  const { showAlert } = useAlert();
  const dispatch = useDispatch();
  const { t } = useTranslation();

  /* ================= DOCUMENT CONFIG ================= */
  const DOCUMENTS: DocumentItem[] = useMemo(() => [
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
    {
      key: 'Profile_Selfie',
      backendType: 'profile_selfie',
      labelKey: 'profile_selfie',
      Logo: () => <Ionicons name="person-circle-outline" size={34} color="#1D4ED8" />,
      typeKey: 'docs_headshot',
      hintKey: 'docs_hint_selfie',
      side: ['front'],
      required: true,
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
    }
  }, [remoteDocs, dispatch]);

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
          } catch (_) {}
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
      navigation.replace(Dashboard_Nav);
    }
  }, [user?.onboarding_status, user?.status, user?.kyc_status, navigation]);

  /* ---------------- PROGRESS ---------------- */

  const getDocState = React.useCallback((doc: DocumentItem) => {
    const docsArray = Array.isArray(remoteDocs) ? remoteDocs : (remoteDocs?.data ?? []);
    let remoteDoc = docsArray.find((d: any) => d.document_type === doc.backendType);

    // If not in remoteDocs, check if user.documents is an array (from profile API)
    if (!remoteDoc && Array.isArray(user?.documents)) {
      remoteDoc = user?.documents.find((d: any) => d.document_type === doc.backendType || d.documentType === doc.backendType);
    }

    if (remoteDoc) {
      return {
        status: remoteDoc.status || remoteDoc.license_status || remoteDoc.licenseStatus, 
        preview: remoteDoc.document_url?.front || remoteDoc.document_url || remoteDoc.documentUrl,
        rejection_reason: remoteDoc.rejection_reason || remoteDoc.remarks,
      };
    }

    // Fallback for local redux state which uses dictionary format
    const docs = (!Array.isArray(user?.documents) ? user?.documents : {}) as Record<string, any>;
    return docs?.[doc.key] || {};
  }, [remoteDocs, user?.documents]);

  const requiredDocuments = useMemo(() => DOCUMENTS.filter(d => d.required), [DOCUMENTS]);

  const uploadedCount = useMemo(() => {
    return requiredDocuments.filter(doc => {
      const state = getDocState(doc);
      const currentStatus = (state.status || '').toLowerCase();
      return currentStatus === 'uploaded' || currentStatus === 'pending' || currentStatus === 'verified';
    }).length;
  }, [getDocState, requiredDocuments]);

  const progress = Math.round(
    (uploadedCount / requiredDocuments.length) * 100
  );

  const allUploaded = uploadedCount === requiredDocuments.length;

  const handleSubmit = async () => {
    if (!user?.driverId) { return; }

    try {
      await submitDocuments(user.driverId).unwrap();
      dispatch(setUser({ onboarding_status: 'DOCS_SUBMITTED' }));
      showAlert({
        title: t('success'),
        message: t('docs_submit_success') || 'Documents submitted successfully! Please wait while our team reviews them.',
        singleButton: true,
        icon: 'checkmark-circle-outline',
      });
      // The waiting modal will automatically appear since onboarding_status is now DOCS_SUBMITTED
    } catch (error: any) {
      console.error('Failed to submit docs:', error);
      showAlert({
        title: t('docs_submit_failed'),
        message: error?.data?.message || t('docs_mandatory_error'),
        singleButton: true,
        icon: 'alert-circle-outline',
      });
    }
  };

  /* ================= UI ================= */

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={['top', 'bottom']}
    >
      <AppStatusBar />
      {/* --- WAITING MODAL (No skip allowed) --- */}
      <Modal visible={isWaitingForAdmin} animationType="slide">
        <View style={styles.waitingContainer}>
          <View style={styles.waitingIconBg}>
            <Ionicons name="time-outline" size={60} color={colors.primary} />
          </View>
          <Text 
            adjustsFontSizeToFit 
            numberOfLines={1} 
            style={[fonts.bold, styles.waitingTitle]}
          >
            {t('docs_under_review')}
          </Text>
          <Text style={styles.waitingDesc}>
            {t('docs_review_desc')}
          </Text>
          <View style={styles.waitingInfoCard}>
            <Ionicons name="information-circle-outline" size={20} color="#6366F1" />
            <Text style={styles.waitingInfoText}>
              {t('docs_review_info') || 'You will be notified once your documents are verified. This usually takes 24-48 hours.'}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.contactSupportBtn}
            onPress={() => Linking.openURL('tel:+919043522612')}
          >
            <Ionicons name="call-outline" size={18} color={colors.primary} />
            <Text style={[fonts.medium, { color: colors.primary, marginLeft: 8 }]}>
              {t('contact_support') || 'Contact Support'}
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* PROGRESS HEADER */}
      <View style={styles.progressHeader}>
        <View style={styles.progressContainer}>
          {[1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[
                styles.progressBar,
                { backgroundColor: i <= 4 ? '#2563EB' : '#E5E7EB' }
              ]}
            />
          ))}
        </View>
        <View style={styles.progressLabelRow}>
          <Text style={styles.progressText}>
            {t('step_docs_label')} <Text style={styles.activeProgressText}>• {t('step_4_of_4')}</Text>
          </Text>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={{ padding: 20, paddingTop: 10 }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
      >
        <View style={{ marginBottom: 25 }}>
          <Text adjustsFontSizeToFit numberOfLines={1} style={[fonts.bold, { fontSize: 28, color: colors.text }]}>
            {t('docs_title')}
          </Text>
          <Text adjustsFontSizeToFit numberOfLines={1} style={{ fontSize: 16, color: colors.text, opacity: 0.6, marginTop: 5 }}>
            {t('docs_subtitle')}
          </Text>
        </View>

        {/* REJECTION BANNER */}
        {(isDocsRejected || user?.status === 'rejected' || user?.status === 'blocked') && (
          <View style={[styles.rejectionBanner, (user?.status === 'blocked' || user?.status === 'rejected') && { borderLeftColor: '#EF4444' }]}>
            <Ionicons name="warning-outline" size={22} color="#DC2626" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[fonts.bold, { color: '#DC2626', fontSize: 14 }]}>
                {user?.status === 'blocked' ? (t('account_restricted') || 'Account Restricted') : (t('docs_rejected_title') || 'Documents Need Correction')}
              </Text>
              <Text style={{ color: '#7F1D1D', fontSize: 12, marginTop: 2 }}>
                {user?.status_reason || t('docs_rejected_desc') || 'Some documents were rejected. Please re-upload the highlighted items below.'}
              </Text>
            </View>
          </View>
        )}



        {/* LIST */}
        {DOCUMENTS.map((doc) => {
          const state = getDocState(doc);
          const currentStatus = (state.status || '').toLowerCase();
          const isDone = currentStatus === 'uploaded' || currentStatus === 'pending' || currentStatus === 'verified';
          const isRejected = currentStatus === 'rejected';

          return (
            <TouchableOpacity
              key={doc.key}
              onPress={() => navigation.navigate(DocumentUploadScreen_Nav, { doc })}
              style={[
                styles.docItem,
                { borderColor: isRejected ? '#F87171' : isDone ? '#10B981' : colors.border }
              ]}
            >
              <View style={styles.docIconBox}>
                <doc.Logo width={30} height={30} />
              </View>

              <View style={{ flex: 1, marginLeft: 15 }}>
                <Text adjustsFontSizeToFit numberOfLines={1} style={[fonts.bold, { fontSize: 16, color: colors.text }]}>
                  {t(doc.labelKey)} {!doc.required && `(${t('optional')})`}
                </Text>
                <Text adjustsFontSizeToFit numberOfLines={1} style={{ fontSize: 12, color: colors.text, opacity: 0.5 }}>
                  {t(doc.typeKey)} • {t(doc.hintKey)}
                </Text>

                {isRejected && state.rejection_reason && (
                  <Text style={{ color: '#EF4444', fontSize: 11, marginTop: 4, fontWeight: '600' }}>
                    {t('rejected')}: {state.rejection_reason}
                  </Text>
                )}
              </View>

              <View style={[styles.statusBadge, { backgroundColor: isRejected ? '#FEE2E2' : isDone ? '#D1FAE5' : '#F3F4F6' }]}>
                <Ionicons
                  name={isRejected ? 'close-circle' : isDone ? 'checkmark-circle' : 'chevron-forward'}
                  size={18}
                  color={isRejected ? '#EF4444' : isDone ? '#10B981' : '#9CA3AF'}
                />
              </View>
            </TouchableOpacity>
          );
        })}

        <Button
          disabled={!allUploaded || isSubmitting}
          loading={isSubmitting}
          onPress={handleSubmit}
          style={{ marginTop: 20, height: 56, borderRadius: 16 }}
        >
          {t('submit_for_verification')}
        </Button>
      </ScrollView>
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
    marginBottom: 15,
    borderWidth: 1,
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
    backgroundColor: '#FFFFFF',
  },
  waitingTitle: {
    fontSize: 24,
    marginTop: 20,
    textAlign: 'center',
    color: '#111827',
  },
  waitingDesc: {
    fontSize: 16,
    textAlign: 'center',
    color: '#4B5563',
    marginTop: 15,
    lineHeight: 24,
  },
  waitingIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  waitingInfoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EEF2FF',
    padding: 16,
    borderRadius: 16,
    marginTop: 30,
    width: '100%',
  },
  waitingInfoText: {
    flex: 1,
    fontSize: 13,
    color: '#4338CA',
    marginLeft: 10,
    lineHeight: 20,
  },
  contactSupportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E0E7FF',
    backgroundColor: '#F5F3FF',
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
});
