import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSelector, useDispatch } from 'react-redux';

import { useAppTheme } from '../../context/ThemeContext';
import AppStatusBar from '../../Components/AppStatusBar';
import { RootState } from '../../redux/store';
import { useGetDriverDocumentsQuery } from '../../service/driverApi';
import { setUser } from '../../redux/userSlice';
import { Text } from '../../Components';
import {
  AadharCard,
  DrivingLicence,
  PanCard,
  PoliceVerification,
} from '../../assets/svg';
import { DocumentUploadScreen_Nav } from '../../Navigations/navigations';
import ImageZoomModal from '../../Components/ImageZoomModal';
import { resolveImageUrl, resolveAllImageUrls } from '../../utils/imageUtils';

/* ================= TYPES ================= */

type DocumentStatus = 'verified' | 'pending' | 'rejected' | 'missing' | 'uploaded' | 'approved';

interface DocumentItem {
  key: string;
  backendType: string;
  labelKey: string;
  subtitleKey: string;
  Logo: React.ComponentType<any>;
  side: ('front' | 'back')[];
  required: boolean;
}

/* ================= CONSTANTS ================= */

const DOCUMENTS_CONFIG: DocumentItem[] = [
  {
    key: 'Profile_Selfie',
    backendType: 'profile_selfie',
    labelKey: 'profile_selfie',
    subtitleKey: 'photo_subtitle',
    Logo: ({ width }: any) => <Ionicons name="person-add-outline" size={width || 28} color="#2563EB" />,
    side: ['front'],
    required: true,
  },
  {
    key: 'Driving_License',
    backendType: 'driving_license',
    labelKey: 'driving_license',
    subtitleKey: 'dl_subtitle',
    Logo: DrivingLicence,
    side: ['front', 'back'],
    required: true,
  },
  {
    key: 'Pan_Card',
    backendType: 'pan_card',
    labelKey: 'pan_card',
    subtitleKey: 'pan_subtitle',
    Logo: PanCard,
    side: ['front'],
    required: true,
  },
  {
    key: 'Aadhar_Card',
    backendType: 'aadhaar_card',
    labelKey: 'aadhar_card',
    subtitleKey: 'aadhaar_subtitle',
    Logo: AadharCard,
    side: ['front', 'back'],
    required: true,
  },
  {
    key: 'Police_Verification',
    backendType: 'police_verification',
    labelKey: 'police_verification',
    subtitleKey: 'police_subtitle',
    Logo: PoliceVerification,
    side: ['front'],
    required: false,
  },
];

const SUGGESTIONS = [
  { icon: 'sunny-outline', textKey: 'tip_lighting' },
  { icon: 'flash-off-outline', textKey: 'tip_avoid_glare' },
  { icon: 'scan-outline', textKey: 'tip_readable' },
];

/* ================= COMPONENTS ================= */

const VerificationRoadmap = ({ status, t, isDark, theme }: { status: string | undefined; t: any; isDark: boolean; theme: any }) => {
  const steps = [
    { 
      key: 'Submitted', 
      icon: 'cloud-done', 
      status: ['DOCS_SUBMITTED', 'DOCUMENTS_SUBMITTED', 'DOCUMENTS_APPROVED', 'DOCS_VERIFIED', 'VERIFIED', 'SUBSCRIPTION_ACTIVE', 'ACTIVE'] 
    },
    { 
      key: 'Under Review', 
      icon: 'time', 
      status: ['DOCS_SUBMITTED', 'DOCUMENTS_SUBMITTED'] 
    },
    { 
      key: 'Activated', 
      icon: 'checkmark-circle', 
      status: ['DOCUMENTS_APPROVED', 'DOCS_VERIFIED', 'VERIFIED', 'SUBSCRIPTION_ACTIVE', 'ACTIVE'] 
    },
  ];

  const currentStepIndex = useMemo(() => {
    if (!status) return 0;
    const normalizedStatus = status.toUpperCase();
    for (let i = steps.length - 1; i >= 0; i--) {
      if (steps[i].status.includes(normalizedStatus)) return i;
    }
    return 0;
  }, [status]);
  
  return (
    <View style={styles.roadmapContainer}>
      <Text style={[styles.sectionTitle, { color: isDark ? theme.colors.textMuted : '#6B7280' }]} numberOfLines={1} adjustsFontSizeToFit>
        {t('verification_plan') || 'Verification Progress'}
      </Text>
      <View style={styles.roadmapRow}>
        {steps.map((step, index) => {
          const isActive = index <= currentStepIndex;
          
          return (
            <React.Fragment key={step.key}>
              <View style={styles.roadmapStep}>
                <View style={[
                  styles.roadmapIconCircle, 
                  { backgroundColor: isActive ? '#10B981' : (isDark ? '#2C2C2E' : '#F3F4F6') }
                ]}>
                  <Ionicons 
                    name={step.icon} 
                    size={16} 
                    color={isActive ? '#FFFFFF' : (isDark ? '#9CA3AF' : '#9CA3AF')} 
                  />
                </View>
                <Text style={[
                  styles.roadmapStepText, 
                  { color: isActive ? (isDark ? '#34D399' : '#059669') : (isDark ? '#9CA3AF' : '#6B7280') }
                ]}>
                  {t(step.key.toLowerCase().replace(/ /g, '_')) || step.key}
                </Text>
              </View>
              {index < steps.length - 1 && (
                <View style={[
                  styles.roadmapLine, 
                  { backgroundColor: index < currentStepIndex ? '#10B981' : (isDark ? '#2C2C2E' : '#E5E7EB') }
                ]} />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
};

const Section = ({ title, children, isDark, theme }: any) => (
  <View style={styles.sectionContainer}>
    {title && <Text style={[styles.sectionTitle, { color: isDark ? theme.colors.textMuted : '#6B7280' }]}>{title.toUpperCase()}</Text>}
    <View style={[styles.sectionContent, { backgroundColor: isDark ? theme.colors.card : '#FFFFFF', borderColor: isDark ? '#2C2C2E' : '#E5E7EB' }]}>
      {children}
    </View>
  </View>
);

const DocumentRow = ({ doc, status, previews, reason, onUpload, onView, t, isDark, theme, isLast }: any) => {
  const [loadError, setLoadError] = useState(false);
  
  useEffect(() => {
    setLoadError(false);
  }, [previews]);

  const imageUri = previews && previews.length > 0 ? previews[0] : null;
  const isDone = status === 'verified' || status === 'approved' || status === 'pending' || status === 'uploaded';
  const isRejected = status === 'rejected';
  
  const statusColors: any = {
    verified: { dot: '#10B981', text: isDark ? '#34D399' : '#059669' },
    approved: { dot: '#10B981', text: isDark ? '#34D399' : '#059669' },
    pending: { dot: '#F59E0B', text: isDark ? '#FBBF24' : '#D97706' },
    uploaded: { dot: '#F59E0B', text: isDark ? '#FBBF24' : '#D97706' },
    rejected: { dot: '#EF4444', text: isDark ? '#F87171' : '#DC2626' },
    missing: { dot: isDark ? '#4B5563' : '#D1D5DB', text: isDark ? '#9CA3AF' : '#6B7280' },
  };

  const activeStatus = statusColors[status] || statusColors.missing;

  return (
    <View>
      <Pressable 
        onPress={isDone ? onView : onUpload}
        style={[
          styles.docRow,
          !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? '#2C2C2E' : '#E5E7EB' },
          isRejected && { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.05)' : 'rgba(239, 68, 68, 0.05)' }
        ]}
      >
        <View style={styles.docRowLeft}>
          <View style={styles.docIconBox}>
            {imageUri && !loadError ? (
              <Image 
                source={{ uri: imageUri }} 
                style={styles.thumbnail} 
                onError={() => setLoadError(true)}
              />
            ) : (
              <doc.Logo width={28} height={28} />
            )}
          </View>

          <View style={styles.docInfo}>
            <Text style={[styles.docTitle, { color: isDark ? '#FFFFFF' : '#111827' }]} numberOfLines={1}>
              {t(doc.labelKey)} {!doc.required && `(${t('optional')})`}
            </Text>
            
            <View style={styles.statusWrapper}>
              <View style={[styles.statusDot, { backgroundColor: activeStatus.dot }]} />
              <Text style={[styles.statusText, { color: activeStatus.text }]}>
                {t(status)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.docRowRight}>
          {isRejected ? (
             <Text style={[styles.reuploadText, { color: '#EF4444' }]}>{t('reupload') || 'Re-upload'}</Text>
          ) : !imageUri ? (
             <Text style={[styles.uploadText, { color: theme.colors.primary }]}>{t('upload') || 'Upload'}</Text>
          ) : null}
          <Ionicons name="chevron-forward" size={18} color={isDark ? '#4B5563' : '#9CA3AF'} />
        </View>
      </Pressable>
      
      {isRejected && reason && (
        <View style={[styles.rejectionReasonBox, { 
          borderBottomWidth: !isLast ? StyleSheet.hairlineWidth : 0, 
          borderBottomColor: isDark ? '#2C2C2E' : '#E5E7EB',
          backgroundColor: isDark ? 'rgba(239, 68, 68, 0.05)' : 'rgba(239, 68, 68, 0.05)'
        }]}>
          <Ionicons name="alert-circle" size={14} color="#EF4444" />
          <Text style={styles.rejectionReasonText}>{reason}</Text>
        </View>
      )}
    </View>
  );
};

/* ================= SCREEN ================= */

const ProfileDocumentsScreen: React.FC = ({ navigation }: any) => {
  const { theme, isDark } = useAppTheme();
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.userSlice.user);
  
  const { data: remoteDocs, refetch, isFetching } = useGetDriverDocumentsQuery(user?.driverId || '', {
    skip: !user?.driverId,
  });

  const [zoomData, setZoomData] = useState<{ uris: string[]; title: string } | null>(null);
  const [showTips, setShowTips] = useState(false);

  useEffect(() => {
    if (remoteDocs) {
      const docsArray = Array.isArray(remoteDocs) ? remoteDocs : (remoteDocs?.data ?? []);
      dispatch(setUser({ documents_data: docsArray }));
    }
  }, [remoteDocs, dispatch]);

  const getDocStatusData = (backendType: string, docKey: string) => {
    const localDoc = user?.documents?.[docKey];
    const docsArray = Array.isArray(user?.documents_data) ? user.documents_data : [];
    const apiDoc = docsArray.find((d: any) => d.document_type === backendType);
    
    let status: DocumentStatus = 'missing';
    if (apiDoc) {
      status = (apiDoc.status || apiDoc.license_status || apiDoc.licenseStatus || 'missing').toLowerCase() as DocumentStatus;
    } else if (localDoc?.status) {
      status = localDoc.status.toLowerCase() as DocumentStatus;
    }
    
    let previews: string[] = [];
    if (localDoc?.preview) {
      previews = resolveAllImageUrls(localDoc.preview);
    }
    
    if (previews.length === 0 && apiDoc) {
      previews = resolveAllImageUrls(
        apiDoc.document_url || 
        apiDoc.documentUrl || 
        apiDoc.file_url || 
        apiDoc.image_url || 
        apiDoc.photo_url || 
        apiDoc.file_path || 
        apiDoc.url ||
        apiDoc.uri
      );
    }
    
    if (previews.length === 0 && backendType === 'profile_selfie') {
      const profilePic = user?.profile_pic_url || user?.profile_picture;
      if (profilePic) {
        const resolvedProfilePic = resolveImageUrl(profilePic);
        if (resolvedProfilePic) previews = [resolvedProfilePic];
      }
    }

    if (!apiDoc && !localDoc && backendType === 'profile_selfie' && previews.length > 0) {
      status = 'verified';
    }

    const reason = apiDoc?.rejection_reason || apiDoc?.remarks || null;
    return { status, previews, preview: previews[0] || null, reason };
  };

  const calculateDisplayStatus = () => {
    const currentStatus = user?.onboarding_status || 'PENDING';
    if (currentStatus === 'ACTIVE' || currentStatus === 'SUBSCRIPTION_ACTIVE') return currentStatus;

    let allApproved = true;
    let allSubmitted = true;
    DOCUMENTS_CONFIG.forEach(doc => {
      if (!doc.required) return;
      const { status } = getDocStatusData(doc.backendType, doc.key);
      const normalizedStatus = status.toLowerCase();
      if (normalizedStatus !== 'verified' && normalizedStatus !== 'approved') allApproved = false;
      if (normalizedStatus === 'missing' || normalizedStatus === 'rejected') allSubmitted = false;
    });

    if (allApproved) return 'DOCUMENTS_APPROVED';
    if (allSubmitted) return 'DOCS_SUBMITTED';
    return currentStatus;
  };

  const displayStatus = calculateDisplayStatus();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: isDark ? theme.colors.background : '#FFFFFF' }]}>
      <AppStatusBar />
      <View style={[styles.header, { backgroundColor: isDark ? theme.colors.background : '#FFFFFF' }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={isDark ? '#FFFFFF' : '#111827'} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: isDark ? '#FFFFFF' : '#111827' }]} numberOfLines={1}>{t('documents')}</Text>
        <Pressable onPress={() => setShowTips(true)} style={styles.tipsBtn}>
           <Ionicons name="bulb-outline" size={22} color={isDark ? '#F3F4F6' : '#111827'} />
        </Pressable>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={theme.colors.primary} />}
      >
        <VerificationRoadmap status={displayStatus} t={t} isDark={isDark} theme={theme} />
        
        <Section title={t('identity_documents') || 'Identity & Verification'} isDark={isDark} theme={theme}>
          {DOCUMENTS_CONFIG.map((doc, index) => {
            const { status, previews, reason } = getDocStatusData(doc.backendType, doc.key);
            const isLast = index === DOCUMENTS_CONFIG.length - 1;
            
            return (
              <DocumentRow
                key={doc.key}
                doc={doc}
                status={status}
                previews={previews}
                reason={reason}
                isLast={isLast}
                onUpload={() => navigation.navigate(DocumentUploadScreen_Nav, { doc })}
                onView={() => {
                  if (previews && previews.length > 0) {
                     setZoomData({ uris: previews, title: t(doc.labelKey) });
                  }
                }}
                t={t}
                isDark={isDark}
                theme={theme}
              />
            );
          })}
        </Section>

        <View style={styles.securityNote}>
          <Ionicons name="shield-checkmark" size={16} color="#10B981" />
          <Text style={[styles.securityNoteText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>{t('docs_secure_note') || 'Your documents are encrypted and securely stored'}</Text>
        </View>
      </ScrollView>

      <ImageZoomModal
        visible={!!zoomData}
        onClose={() => setZoomData(null)}
        imageUris={zoomData?.uris || []}
        title={zoomData?.title}
      />

      <Modal visible={showTips} transparent={true} animationType="fade" onRequestClose={() => setShowTips(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? theme.colors.card : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Ionicons name="bulb" size={20} color="#F59E0B" style={{ marginRight: 8 }} />
                <Text style={[styles.modalTitle, { color: isDark ? '#F3F4F6' : '#111827' }]}>{t('smart_suggestions') || 'Tips for Fast Approval'}</Text>
              </View>
              <Pressable onPress={() => setShowTips(false)}>
                <Ionicons name="close" size={24} color={isDark ? '#F3F4F6' : '#111827'} />
              </Pressable>
            </View>
            <View style={styles.suggestionsList}>
              {SUGGESTIONS.map((s, i) => (
                <View key={i} style={styles.suggestionItem}>
                  <View style={[styles.suggestionDot, { backgroundColor: theme.colors.primary }]} />
                  <Text style={[styles.suggestionText, { color: isDark ? '#9CA3AF' : '#4B5563' }]}>{t(s.textKey)}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default ProfileDocumentsScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '600', textAlign: 'center' },
  tipsBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  
  // Roadmap Styles
  roadmapContainer: {
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  sectionTitle: { fontSize: 13, fontWeight: '600', marginBottom: 12, marginTop: 12, marginLeft: 8 },
  roadmapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  roadmapStep: { alignItems: 'center', flex: 1 },
  roadmapIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  roadmapStepText: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  roadmapLine: { height: 2, flex: 1, marginBottom: 20 },
  
  // Section Styles
  sectionContainer: { marginBottom: 24 },
  sectionContent: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  
  // Document Row Styles
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  docRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  docIconBox: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumbnail: { width: '100%', height: '100%', resizeMode: 'cover' },
  docInfo: { flex: 1 },
  docTitle: { fontSize: 15, fontWeight: '500', marginBottom: 2 },
  statusWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '500', textTransform: 'capitalize' },
  docRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
  uploadText: { fontSize: 14, fontWeight: '500' },
  reuploadText: { fontSize: 14, fontWeight: '500' },
  
  rejectionReasonBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    paddingLeft: 68,
    paddingRight: 16,
    gap: 6,
  },
  rejectionReasonText: { fontSize: 12, color: '#EF4444', flex: 1, lineHeight: 18 },
  
  // Misc
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 6,
  },
  securityNoteText: { fontSize: 12, fontWeight: '500' },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 16, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  modalTitle: { fontSize: 16, fontWeight: '600' },
  suggestionsList: { gap: 12 },
  suggestionItem: { flexDirection: 'row', alignItems: 'center' },
  suggestionDot: { width: 6, height: 6, borderRadius: 3, marginRight: 10 },
  suggestionText: { fontSize: 14, fontWeight: '500', flex: 1 },
});
