import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  Animated,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import { useAlert } from '../../context/AlertContext';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../context/ThemeContext';
import AppStatusBar from '../../Components/AppStatusBar';
import { useSelector, useDispatch } from 'react-redux';
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
import LinearGradient from 'react-native-linear-gradient';
import { resolveImageUrl, resolveAllImageUrls } from '../../utils/imageUtils';

const { width } = Dimensions.get('window');

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
    key: 'Profile_Selfie',
    backendType: 'profile_selfie',
    labelKey: 'profile_selfie',
    subtitleKey: 'photo_subtitle',
    Logo: () => <Ionicons name="person-circle-outline" size={32} color="#2563EB" />,
    side: ['front'],
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
    // Find the LAST step that includes this status for better visual progress
    for (let i = steps.length - 1; i >= 0; i--) {
      if (steps[i].status.includes(normalizedStatus)) return i;
    }
    return 0;
  }, [status]);
  
  return (
    <View style={[styles.roadmapContainer, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
      <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#111827', marginTop: 0 }]} numberOfLines={1} adjustsFontSizeToFit>
        {t('verification_plan') || 'Verification Roadmap'}
      </Text>
      <View style={styles.roadmapRow}>
        {steps.map((step, index) => {
          const isActive = index <= currentStepIndex;
          const isProcessing = index === currentStepIndex && status === 'DOCS_SUBMITTED' && index === 1;
          
          return (
            <React.Fragment key={step.key}>
              <View style={styles.roadmapStep}>
                <View style={[
                  styles.roadmapIconCircle, 
                  { backgroundColor: isActive ? '#10B981' : (isDark ? theme.colors.border : '#F3F4F6') }
                ]}>
                  <Ionicons 
                    name={step.icon} 
                    size={20} 
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
                  { backgroundColor: index < currentStepIndex ? '#10B981' : (isDark ? theme.colors.border : '#E5E7EB') }
                ]} />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
};

const SmartSuggestions = ({ t, isDark, theme }: { t: any; isDark: boolean; theme: any }) => (
  <View style={[styles.suggestionsContainer, { 
    backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
    borderColor: isDark ? theme.colors.border : '#E5E7EB',
    borderWidth: 1,
  }]}>
    <View style={styles.suggestionsHeader}>
      <View style={[styles.bulbBg, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF' }]}>
        <Ionicons name="bulb" size={18} color="#3B82F6" />
      </View>
      <Text style={[styles.suggestionsTitle, { color: isDark ? '#F3F4F6' : '#111827' }]} numberOfLines={1} adjustsFontSizeToFit>{t('smart_suggestions') || 'Tips for Fast Approval'}</Text>
    </View>
    <View style={styles.suggestionsList}>
      {SUGGESTIONS.map((s, i) => (
        <View key={i} style={styles.suggestionItem}>
          <View style={[styles.suggestionDot, { backgroundColor: '#3B82F6' }]} />
          <Text style={[styles.suggestionText, { color: isDark ? '#9CA3AF' : '#4B5563' }]}>{t(s.textKey)}</Text>
        </View>
      ))}
    </View>
  </View>
);

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

  useEffect(() => {
    if (remoteDocs) {
      const docsArray = Array.isArray(remoteDocs) ? remoteDocs : (remoteDocs?.data ?? []);
      dispatch(setUser({ documents_data: docsArray }));
    }
  }, [remoteDocs, dispatch]);

  const getDocStatusData = (backendType: string, docKey: string) => {
    // SOURCE 1: Local Redux state (set by DocumentUploadScreen with LOCAL file paths)
    // These previews are displayable immediately — they are local file:// paths
    const localDoc = user?.documents?.[docKey];
    
    // SOURCE 2: API response (set by useGetDriverDocumentsQuery)
    // These may contain S3 URLs which are private and often fail to load
    const docsArray = Array.isArray(user?.documents_data) ? user.documents_data : [];
    const apiDoc = docsArray.find((d: any) => d.document_type === backendType);
    
    // 🔍 DEBUG: Log what we find from each source
    console.log(`[ProfileDocs] ${backendType} (${docKey}):`, {
      hasLocalDoc: !!localDoc,
      localPreview: localDoc?.preview ? localDoc.preview.substring(0, 80) + '...' : null,
      localStatus: localDoc?.status,
      hasApiDoc: !!apiDoc,
      apiDocUrl: apiDoc?.document_url ? JSON.stringify(apiDoc.document_url).substring(0, 100) : null,
      apiStatus: apiDoc?.status,
      profilePic: user?.profile_picture ? user.profile_picture.substring(0, 80) + '...' : null,
      profilePicUrl: user?.profile_pic_url ? user.profile_pic_url.substring(0, 80) + '...' : null,
    });
    
    // Determine status: prefer API status (most authoritative), then local
    let status: DocumentStatus = 'missing';
    if (apiDoc) {
      status = (apiDoc.status || apiDoc.license_status || apiDoc.licenseStatus || 'missing').toLowerCase() as DocumentStatus;
    } else if (localDoc?.status) {
      status = localDoc.status.toLowerCase() as DocumentStatus;
    }
    
    // Determine preview: prefer LOCAL preview (always loadable), then API URL
    let previews: string[] = [];
    
    // Priority 1: Local file preview from DocumentUploadScreen
    // localDoc.preview could be a string or an object depending on DocumentUploadScreen
    if (localDoc?.preview) {
      previews = resolveAllImageUrls(localDoc.preview);
    }
    
    // Priority 2: API document URL (various possible field names)
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
    
    // Priority 3: Profile picture fallback for selfie
    if (previews.length === 0 && backendType === 'profile_selfie') {
      const profilePic = user?.profile_pic_url || user?.profile_picture;
      if (profilePic) {
        const resolvedProfilePic = resolveImageUrl(profilePic);
        if (resolvedProfilePic) previews = [resolvedProfilePic];
      }
    }

    // If we found no doc at all but have a profile pic for selfie, mark as verified
    if (!apiDoc && !localDoc && backendType === 'profile_selfie' && previews.length > 0) {
      status = 'verified';
    }

    // 🔍 DEBUG: Final resolved preview
    console.log(`[ProfileDocs] ${backendType} RESOLVED:`, {
      status,
      previews: previews.map(p => p.substring(0, 100) + '...'),
    });

    const reason = apiDoc?.rejection_reason || apiDoc?.remarks || null;

    return { status, previews, preview: previews[0] || null, reason };
  };

  const onRefresh = () => {
    refetch();
  };

  // Dynamically calculate the onboarding status based on the latest document statuses
  // This ensures the roadmap updates immediately even if user.onboarding_status is stale
  const calculateDisplayStatus = () => {
    const currentStatus = user?.onboarding_status || 'PENDING';
    if (currentStatus === 'ACTIVE' || currentStatus === 'SUBSCRIPTION_ACTIVE') {
      return currentStatus;
    }

    let allApproved = true;
    let allSubmitted = true;
    const docStatuses: Record<string, string> = {};

    DOCUMENTS_CONFIG.forEach(doc => {
      if (!doc.required) return;
      const { status } = getDocStatusData(doc.backendType, doc.key);
      docStatuses[doc.key] = status;
      
      const normalizedStatus = status.toLowerCase();
      if (normalizedStatus !== 'verified' && normalizedStatus !== 'approved') {
        allApproved = false;
      }
      if (normalizedStatus === 'missing' || normalizedStatus === 'rejected') {
        allSubmitted = false;
      }
    });

    console.log('[ProfileDocs] Dynamic Status Calculation:', {
      userOnboardingStatus: currentStatus,
      docStatuses,
      allApproved,
      allSubmitted
    });

    if (allApproved) return 'DOCUMENTS_APPROVED';
    if (allSubmitted) return 'DOCS_SUBMITTED';
    return currentStatus;
  };

  const displayStatus = calculateDisplayStatus();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <AppStatusBar />
      <View style={[styles.header, { borderBottomColor: isDark ? theme.colors.border : '#E5E7EB' }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={isDark ? '#FFFFFF' : '#111827'} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: isDark ? '#FFFFFF' : '#111827' }]} numberOfLines={1} adjustsFontSizeToFit>{t('documents')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={onRefresh} tintColor="#2563EB" />}
      >
        <VerificationRoadmap status={displayStatus} t={t} isDark={isDark} theme={theme} />
        
        <Text style={[styles.sectionLabel, { color: isDark ? '#FFFFFF' : '#111827' }]} numberOfLines={1} adjustsFontSizeToFit>{t('identity_documents') || 'Identity & Verification'}</Text>

        {DOCUMENTS_CONFIG.map((doc) => {
          const { status, previews, reason } = getDocStatusData(doc.backendType, doc.key);
          
          return (
            <DocumentCard
              key={doc.key}
              doc={doc}
              status={status}
              previews={previews}
              reason={reason}
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

        <View style={styles.securityNote}>
          <Ionicons name="shield-checkmark" size={16} color="#10B981" />
          <Text style={styles.securityNoteText}>{t('docs_secure_note')}</Text>
        </View>
      </ScrollView>

      <ImageZoomModal
        visible={!!zoomData}
        onClose={() => setZoomData(null)}
        imageUris={zoomData?.uris || []}
        title={zoomData?.title}
      />
    </SafeAreaView>
  );
};

const DocumentCard = ({ doc, status, previews, reason, onUpload, onView, t, isDark, theme }: any) => {
  const [loadError, setLoadError] = useState(false);
  
  // Reset error state if the preview URL changes (e.g. after a re-upload or refresh)
  React.useEffect(() => {
    setLoadError(false);
  }, [previews]);

  const imageUri = previews && previews.length > 0 ? previews[0] : null; // Use first image for thumbnail

  const isDone = status === 'verified' || status === 'approved' || status === 'pending' || status === 'uploaded';
  const isRejected = status === 'rejected';
  
  const statusColors: any = {
    verified: { bg: '#D1FAE5', text: '#059669', icon: 'checkmark-circle' },
    approved: { bg: '#D1FAE5', text: '#059669', icon: 'checkmark-circle' },
    pending: { bg: '#FEF3C7', text: '#D97706', icon: 'time' },
    uploaded: { bg: '#FEF3C7', text: '#D97706', icon: 'time' },
    rejected: { bg: '#FEE2E2', text: '#DC2626', icon: 'close-circle' },
    missing: { bg: isDark ? theme.colors.border : '#F3F4F6', text: isDark ? theme.colors.textMuted : '#6B7280', icon: 'document-outline' },
  };

  const activeStatus = statusColors[status] || statusColors.missing;

  return (
    <Pressable 
      onPress={isDone ? onView : onUpload}
      style={[
        styles.docCard, 
        { backgroundColor: isDark ? theme.colors.card : '#FFFFFF' },
        isRejected && { borderColor: '#FCA5A5', borderWidth: 1 }
      ]}
    >
      <View style={styles.docMainRow}>
        <View style={[styles.docIconBox, { backgroundColor: isDark ? theme.colors.border : '#F8FAFC' }]}>
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
          <Text style={[styles.docTitle, { color: isDark ? '#FFFFFF' : '#111827' }]} numberOfLines={1} adjustsFontSizeToFit>
            {t(doc.labelKey)} {!doc.required && `(${t('optional')})`}
          </Text>
          <Text style={[styles.docSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            {t(doc.subtitleKey)}
          </Text>
          
          <View style={[styles.statusChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : activeStatus.bg }]}>
            <Ionicons name={activeStatus.icon} size={12} color={activeStatus.text} />
            <Text style={[styles.statusChipText, { color: activeStatus.text }]}>
              {t(status)}
            </Text>
          </View>
        </View>

        <View style={styles.docRight}>
          {!imageUri ? (
            <Pressable 
              onPress={onUpload}
              style={[styles.uploadCircle, { backgroundColor: isDark ? theme.colors.border : '#EFF6FF' }]}
            >
              <Ionicons name="cloud-upload" size={20} color="#2563EB" />
            </Pressable>
          ) : (
            <Ionicons 
              name="chevron-forward" 
              size={20} 
              color={isDark ? '#4B5563' : '#9CA3AF'} 
            />
          )}
        </View>
      </View>

      {isRejected && reason && (
        <View style={styles.rejectionReasonBox}>
          <Ionicons name="alert-circle" size={14} color="#DC2626" />
          <Text style={styles.rejectionReasonText}>{reason}</Text>
        </View>
      )}

      {!isDone && (
        <Pressable onPress={onUpload} style={styles.actionFooter}>
          <Text style={styles.actionFooterText} numberOfLines={1} adjustsFontSizeToFit>{t('tap_to_upload') || 'Tap to Upload'}</Text>
          <Ionicons name="chevron-forward" size={14} color="#2563EB" />
        </Pressable>
      )}
      
      {isRejected && (
        <Pressable onPress={onUpload} style={[styles.actionFooter, { borderTopColor: '#FEE2E2' }]}>
          <Text style={[styles.actionFooterText, { color: '#DC2626' }]} numberOfLines={1} adjustsFontSizeToFit>{t('reupload') || 'Re-upload Document'}</Text>
          <Ionicons name="refresh" size={14} color="#DC2626" />
        </Pressable>
      )}
    </Pressable>
  );
};

export default ProfileDocumentsScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  roadmapContainer: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 20 },
  roadmapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  roadmapStep: { alignItems: 'center', flex: 1 },
  roadmapIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  roadmapStepText: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  roadmapLine: { height: 2, flex: 1, marginBottom: 25 },
  suggestionsContainer: {
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 16,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  bulbBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  suggestionsTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  suggestionsList: {
    gap: 12,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 10,
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  sectionLabel: { fontSize: 15, fontWeight: '700', marginBottom: 16, marginTop: 8 },
  docCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  docMainRow: { flexDirection: 'row', alignItems: 'center' },
  docIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  docInfo: { flex: 1, marginLeft: 16 },
  docTitle: { fontSize: 15, fontWeight: '700' },
  docSubtitle: { fontSize: 12, marginTop: 2, opacity: 0.8 },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 8,
    gap: 4,
  },
  statusChipText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  docRight: { marginLeft: 12 },
  previewContainer: {
    width: 60,
    height: 60,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  thumbnail: { width: '100%', height: '100%', resizeMode: 'cover' },
  zoomIconOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 2,
    borderTopLeftRadius: 4,
  },
  uploadCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectionReasonBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.05)',
    padding: 10,
    borderRadius: 10,
    marginTop: 12,
    gap: 8,
  },
  rejectionReasonText: { fontSize: 12, color: '#DC2626', fontWeight: '500', flex: 1 },
  actionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  actionFooterText: { fontSize: 13, fontWeight: '600', color: '#2563EB' },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
    opacity: 0.6,
  },
  securityNoteText: { fontSize: 11, color: '#6B7280', fontWeight: '500' },
});
