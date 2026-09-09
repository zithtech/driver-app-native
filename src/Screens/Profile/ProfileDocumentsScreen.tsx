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
import Svg, { Circle } from 'react-native-svg';

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
    Logo: () => <Image source={require('../../assets/images/3.png')} style={{ width: '100%', height: '100%' }} resizeMode="cover" />,
    side: ['front'],
    required: true,
  },
  {
    key: 'Driving_License',
    backendType: 'driving_license',
    labelKey: 'driving_license',
    subtitleKey: 'dl_subtitle',
    Logo: () => <Image source={require('../../assets/images/drivinglicense.png')} style={{ width: '100%', height: '100%' }} resizeMode="cover" />,
    side: ['front', 'back'],
    required: true,
  },
  {
    key: 'Pan_Card',
    backendType: 'pan_card',
    labelKey: 'pan_card',
    subtitleKey: 'pan_subtitle',
    Logo: () => <Image source={require('../../assets/images/1.png')} style={{ width: '100%', height: '100%' }} resizeMode="cover" />,
    side: ['front'],
    required: true,
  },
  {
    key: 'Aadhar_Card',
    backendType: 'aadhaar_card',
    labelKey: 'aadhar_card',
    subtitleKey: 'aadhaar_subtitle',
    Logo: () => <Image source={require('../../assets/images/oo.png')} style={{ width: '100%', height: '100%' }} resizeMode="cover" />,
    side: ['front', 'back'],
    required: true,
  },
  {
    key: 'Police_Verification',
    backendType: 'police_verification',
    labelKey: 'police_verification',
    subtitleKey: 'police_subtitle',
    Logo: () => <Image source={require('../../assets/images/2.png')} style={{ width: '100%', height: '100%' }} resizeMode="cover" />,
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

const OverallVerificationCard = ({ verifiedCount, totalCount, t, isDark, theme }: any) => {
  const progress = totalCount > 0 ? verifiedCount / totalCount : 0;
  const radius = 24;
  const strokeWidth = 5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <View style={[styles.overallCard, { backgroundColor: 'transparent', borderColor: isDark ? '#2C2C2E' : '#E5E7EB' }]}>
      <View style={styles.overallLeftSection}>
        <View style={styles.circularProgressContainer}>
          <Svg width={(radius + strokeWidth) * 2} height={(radius + strokeWidth) * 2}>
            <Circle
              stroke={isDark ? '#374151' : '#EFF6FF'}
              fill="none"
              cx={radius + strokeWidth}
              cy={radius + strokeWidth}
              r={radius}
              strokeWidth={strokeWidth}
            />
            <Circle
              stroke="#2563EB"
              fill="none"
              cx={radius + strokeWidth}
              cy={radius + strokeWidth}
              r={radius}
              strokeWidth={strokeWidth}
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              rotation="-90"
              origin={`${radius + strokeWidth}, ${radius + strokeWidth}`}
            />
          </Svg>
          <View style={styles.circularTextContainer}>
            <Text style={[styles.progressText, { color: isDark ? '#FFFFFF' : '#111827' }]}>
              {verifiedCount}/{totalCount}
            </Text>
            <Text style={[styles.verifiedLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
              {t('verified') || 'Verified'}
            </Text>
          </View>
        </View>

        <View style={[styles.cardDivider, { backgroundColor: isDark ? '#374151' : '#E5E7EB' }]} />
      </View>

      <View style={styles.overallMiddleSection}>
        <Text style={[styles.overallTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
          {t('overall_verification') || 'Overall Verification'}
        </Text>
        <Text style={[styles.overallSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
          {t('almost_there_desc') || "You're almost there! Complete remaining documents to start getting ride requests."}
        </Text>
        <View style={[styles.horizontalProgressBarBg, { backgroundColor: isDark ? '#374151' : '#EFF6FF' }]}>
          <View style={[styles.horizontalProgressBarFill, { width: `${progress * 100}%`, backgroundColor: '#2563EB' }]} />
        </View>
      </View>

      <View style={styles.overallRightSection}>
        <Image 
          source={require('../../assets/images/file.png')} 
          style={styles.fileIllustration} 
          resizeMode="contain" 
        />
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
          <View style={[styles.docIconBoxLarge, { borderColor: isDark ? '#374151' : '#E5E7EB', backgroundColor: isDark ? '#1F2937' : '#F9FAFB' }]}>
            {doc.key === 'Profile_Selfie' ? (
               <Image source={require('../../assets/images/3.png')} style={styles.thumbnailLarge} resizeMode="cover" />
            ) : doc.key === 'Aadhar_Card' ? (
               <Image source={require('../../assets/images/oo.png')} style={styles.thumbnailLarge} resizeMode="cover" />
            ) : doc.key === 'Driving_License' ? (
               <Image source={require('../../assets/images/drivinglicense.png')} style={styles.thumbnailLarge} resizeMode="cover" />
            ) : doc.key === 'Pan_Card' ? (
               <Image source={require('../../assets/images/1.png')} style={styles.thumbnailLarge} resizeMode="cover" />
            ) : doc.key === 'Police_Verification' ? (
               <Image source={require('../../assets/images/2.png')} style={styles.thumbnailLarge} resizeMode="cover" />
            ) : imageUri && !loadError ? (
              <Image 
                source={{ uri: imageUri }} 
                style={styles.thumbnailLarge} 
                onError={() => setLoadError(true)}
              />
            ) : (
              <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                 <doc.Logo width="100%" height="100%" preserveAspectRatio="xMidYMid slice" />
              </View>
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

const InfoCard = ({ t, isDark }: any) => (
  <View style={[styles.infoCard, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.1)' : '#EFF6FF' }]}>
    <Ionicons name="information-circle" size={20} color="#2563EB" style={styles.infoIcon} />
    <View style={styles.infoTextContainer}>
      <Text style={[styles.infoTitle, { color: isDark ? '#FFFFFF' : '#111827' }]} numberOfLines={1}>
        {t('why_verification_important', 'Why document verification is important?')}
      </Text>
      <Text style={[styles.infoSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]} numberOfLines={1}>
        {t('verification_reason', 'It helps us ensure your safety and build trust with riders.')}
      </Text>
    </View>
    <Image 
      source={require('../../assets/images/file.png')} 
      style={styles.infoImage} 
      resizeMode="contain" 
    />
  </View>
);

const SupportCard = ({ t, onPress }: any) => (
  <Pressable style={styles.supportCard} onPress={onPress}>
    <Ionicons name="headset" size={20} color="#FFFFFF" style={styles.supportIcon} />
    <View style={styles.supportTextContainer}>
      <Text style={styles.supportTitle}>
        {t('need_help', 'Need Help?')}
      </Text>
      <Text style={styles.supportSubtitle}>
        {t('contact_support_desc', 'Contact support for any document-related queries')}
      </Text>
    </View>
    <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
  </Pressable>
);

/* ================= SCREEN ================= */

const ProfileDocumentsScreen: React.FC = ({ navigation }: any) => {
  const { theme, isDark } = useAppTheme();
  const { t: originalT } = useTranslation();

  const t = (key: string, fallback?: string) => {
    if (!key) return '';
    const translated = originalT(key);
    if (translated === key) {
      if (fallback) return fallback;
      return key
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
    return translated;
  };
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
    
    const reason = apiDoc?.rejection_reason || apiDoc?.remarks || null;
    return { status, previews, preview: previews[0] || null, reason };
  };

  let verifiedCount = 0;
  DOCUMENTS_CONFIG.forEach(doc => {
    const { status } = getDocStatusData(doc.backendType, doc.key);
    if (status === 'verified' || status === 'approved') verifiedCount++;
  });
  const totalCount = DOCUMENTS_CONFIG.length;

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
        <OverallVerificationCard verifiedCount={verifiedCount} totalCount={totalCount} t={t} isDark={isDark} theme={theme} />
        
        <Section title={t('identity_documents', 'Identity & Verification')} isDark={isDark} theme={theme}>
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

        <InfoCard t={t} isDark={isDark} />
        <SupportCard t={t} onPress={() => {}} />
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
  
  // Overall Verification Card Styles
  overallCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 20,
    marginTop: 4,
  },
  overallLeftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  circularProgressContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circularTextContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '700',
  },
  verifiedLabel: {
    fontSize: 9,
    fontWeight: '500',
    marginTop: 0,
  },
  cardDivider: {
    width: 1,
    height: 36,
    marginHorizontal: 12,
  },
  overallMiddleSection: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 6,
  },
  overallTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  overallSubtitle: {
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 8,
  },
  horizontalProgressBarBg: {
    height: 5,
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
  },
  horizontalProgressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  overallRightSection: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  fileIllustration: {
    width: 60,
    height: 60,
  },
  sectionTitle: { fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 8, marginLeft: 8 },
  
  // Section Styles
  sectionContainer: { marginBottom: 16 },
  sectionContent: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  
  // Document Row Styles
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  docRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  docIconBoxLarge: {
    width: 52,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderRadius: 6,
    borderWidth: 1,
    overflow: 'hidden',
  },
  thumbnailLarge: { width: '100%', height: '100%', resizeMode: 'cover' },
  docInfo: { flex: 1 },
  docTitle: { fontSize: 14, fontWeight: '500', marginBottom: 1 },
  statusWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: { width: 5, height: 5, borderRadius: 2.5 },
  statusText: { fontSize: 11, fontWeight: '500', textTransform: 'capitalize' },
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
    paddingLeft: 92, // To align with docInfo
    paddingRight: 16,
    gap: 6,
  },
  rejectionReasonText: { fontSize: 12, color: '#EF4444', flex: 1, lineHeight: 18 },
  
  // Bottom Cards
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  infoIcon: {
    marginRight: 10,
  },
  infoTextContainer: {
    flex: 1,
    paddingRight: 10,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  infoSubtitle: {
    fontSize: 11,
    lineHeight: 14,
  },
  infoImage: {
    width: 40,
    height: 40,
  },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  supportIcon: {
    marginRight: 10,
  },
  supportTextContainer: {
    flex: 1,
    paddingRight: 10,
  },
  supportTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  supportSubtitle: {
    fontSize: 11,
    lineHeight: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  
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
