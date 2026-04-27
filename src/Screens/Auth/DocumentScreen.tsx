import React, { useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { RootState } from '../../redux/store';
import { Text } from '../../Components';
import Button from '../../Components/Button';
import {
  useSubmitDocumentsMutation,
  useGetDriverDocumentsQuery,
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
    },
    {
      key: 'Pan_Card',
      backendType: 'pan_card',
      labelKey: 'pan_card',
      Logo: PanCard,
      typeKey: 'docs_front_only',
      hintKey: 'docs_hint_pan',
      side: ['front'],
    },
    {
      key: 'Aadhar_Card',
      backendType: 'aadhaar_card',
      labelKey: 'aadhar_card',
      Logo: AadharCard,
      typeKey: 'docs_front_back',
      hintKey: 'docs_hint_aadhar',
      side: ['front', 'back'],
    },
    {
      key: 'Police_Verification',
      backendType: 'police_verification',
      labelKey: 'police_verification',
      Logo: PoliceVerification,
      typeKey: 'docs_certificate',
      hintKey: 'docs_hint_police',
      side: ['front'],
    },
    {
      key: 'Profile_Selfie',
      backendType: 'profile_selfie',
      labelKey: 'profile_selfie',
      Logo: () => <Ionicons name="person-circle-outline" size={34} color="#1D4ED8" />,
      typeKey: 'docs_headshot',
      hintKey: 'docs_hint_selfie',
      side: ['front'],
    },
  ], []);

  const [submitDocuments, { isLoading: isSubmitting }] = useSubmitDocumentsMutation();

  const user = useSelector((state: RootState) => state.userSlice.user);
  const { data: remoteDocs, refetch, isFetching } = useGetDriverDocumentsQuery(user?.driverId || '', {
    skip: !user?.driverId,
    refetchOnMountOrArgChange: true,
  });


  const isWaitingForAdmin = user?.onboarding_status === 'DOCS_SUBMITTED';

  /* ---------------- PROGRESS ---------------- */

  const getDocState = React.useCallback((doc: DocumentItem) => {
    const docsArray = Array.isArray(remoteDocs) ? remoteDocs : (remoteDocs?.data ?? []);
    const remoteDoc = docsArray.find((d: any) => d.document_type === doc.backendType);
    if (remoteDoc) {
      return {
        status: remoteDoc.status, 
        preview: remoteDoc.document_url?.front || remoteDoc.document_url,
        rejection_reason: remoteDoc.rejection_reason || remoteDoc.remarks,
      };
    }
    const docs = user?.documents || {};
    return docs?.[doc.key] || {};
  }, [remoteDocs, user?.documents]);

  const uploadedCount = useMemo(() => {
    return DOCUMENTS.filter(doc => {
      const state = getDocState(doc);
      return state.status === 'UPLOADED' || state.status === 'pending' || state.status === 'verified';
    }).length;
  }, [getDocState, DOCUMENTS]);

  const progress = Math.round(
    (uploadedCount / DOCUMENTS.length) * 100
  );

  const allUploaded = uploadedCount === DOCUMENTS.length;

  const handleSubmit = async () => {
    if (!user?.driverId) { return; }

    try {
      await submitDocuments(user.driverId).unwrap();
      dispatch(setUser({ onboarding_status: 'DOCS_SUBMITTED' }));
      showAlert({
        title: t('success'),
        message: t('docs_submit_success'),
        singleButton: true,
        icon: 'checkmark-circle-outline',
        onConfirm: () => {
          navigation.replace(Dashboard_Nav);
        }
      });
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
      {/* --- WAITING MODAL --- */}
      <Modal visible={isWaitingForAdmin} animationType="slide">
        <View style={styles.waitingContainer}>
          <Ionicons name="time-outline" size={80} color={colors.primary} />
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
          <Button 
            style={{ width: '80%', marginTop: 30 }} 
            onPress={() => navigation.replace(Dashboard_Nav)}
          >
            {t('skip_to_dashboard')}
          </Button>
        </View>
      </Modal>

      <ScrollView 
        contentContainerStyle={{ padding: 20 }}
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

        {/* PROGRESS BAR */}
        <View style={styles.progressCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={[fonts.medium, { color: colors.text }]}>
              {uploadedCount} / {DOCUMENTS.length} {t('uploaded')}
            </Text>
            <Text style={[fonts.bold, { color: colors.primary }]}>{progress}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: colors.primary }]} />
          </View>
        </View>

        {/* LIST */}
        {DOCUMENTS.map((doc) => {
          const state = getDocState(doc);
          const isDone = state.status === 'UPLOADED' || state.status === 'pending' || state.status === 'verified';
          const isRejected = state.status === 'rejected' || state.status === 'REJECTED';

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
                  {t(doc.labelKey)}
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
  progressCard: {
    padding: 15,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
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
});
