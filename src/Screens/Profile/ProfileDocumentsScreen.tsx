import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import { useAlert } from '../../context/AlertContext';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../context/ThemeContext';
import AppStatusBar from '../../Components/AppStatusBar';

/* ================= TYPES ================= */

type DocumentStatus =
  | 'verified'
  | 'pending'
  | 'rejected'
  | 'expired'
  | 'missing';

type DriverDocument = {
  id: string;
  title: string;
  subtitle: string;
  required: boolean;
  status: DocumentStatus;
  expiryDate?: string;
  rejectionReason?: string;
};

/* ================= MOCK DATA ================= */

const INITIAL_DOCUMENTS: DriverDocument[] = [
  {
    id: 'dl',
    title: 'driving_license',
    subtitle: 'dl_subtitle',
    required: true,
    status: 'verified',
    expiryDate: '2026-03-12',
  },
  {
    id: 'pan',
    title: 'pan_card',
    subtitle: 'pan_subtitle',
    required: true,
    status: 'verified',
  },
  {
    id: 'aadhaar',
    title: 'aadhaar_card',
    subtitle: 'aadhaar_subtitle',
    required: true,
    status: 'verified',
  },
  {
    id: 'photo',
    title: 'profile_photo',
    subtitle: 'photo_subtitle',
    required: true,
    status: 'verified',
  },
  {
    id: 'police',
    title: 'police_verification',
    subtitle: 'police_subtitle',
    required: false,
    status: 'missing',
  },
];

/* ================= SCREEN ================= */

const ProfileDocumentsScreen: React.FC = ({ navigation }: any) => {
  const { theme, isDark } = useAppTheme();
  const { colors } = useTheme();
  const { showAlert } = useAlert();
  const { t } = useTranslation();
  const [documents, setDocuments] =
    useState<DriverDocument[]>(INITIAL_DOCUMENTS);

  /* ================= UPLOAD ================= */
  const handleUpload = (doc: DriverDocument) => {
    if (doc.status === 'verified' || doc.status === 'pending') { return; }

    showAlert({
      title: t('upload_document'),
      message: `${t(doc.title)}\n\n(${t('upload_simulated')})`,
      confirmText: t('upload'),
      cancelText: t('cancel'),
      onConfirm: () => {
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === doc.id
              ? { ...d, status: 'pending' }
              : d
          )
        );
      },
    });
  };

  /* ================= VIEW ================= */
  const handleView = () => {
    showAlert({
      title: t('view_document'),
      message: t('view_simulated'),
      singleButton: true,
      icon: 'document-text-outline',
    });
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <AppStatusBar />
      {/* ================= HEADER ================= */}
      <View style={[styles.header, { backgroundColor: theme.colors.background, borderBottomColor: isDark ? '#374151' : '#E5E7EB' }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={isDark ? '#FFFFFF' : '#111827'} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>{t('documents') || 'Documents'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* ================= INFO ================= */}
        <View style={[styles.infoCard, isDark && { backgroundColor: 'rgba(37, 99, 235, 0.1)' }]}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={isDark ? '#60A5FA' : '#2563EB'}
          />
          <Text style={[styles.infoText, isDark && { color: '#93C5FD' }]}>
            {t('doc_verified_info')}
          </Text>
        </View>

        {/* ================= REQUIRED ================= */}
        <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>{t('required_documents')}</Text>

        {documents
          .filter((d) => d.required)
          .map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              onUpload={handleUpload}
              onView={handleView}
            />
          ))}

        {/* ================= OPTIONAL ================= */}
        <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>{t('optional_documents')}</Text>

        {documents
          .filter((d) => !d.required)
          .map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              onUpload={handleUpload}
              onView={handleView}
            />
          ))}

        <Text style={[styles.footerNote, isDark && { color: '#9CA3AF' }]}>
          {t('police_verification_note')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileDocumentsScreen;

/* ================= DOCUMENT ROW ================= */

const DocumentRow = ({
  doc,
  onUpload,
  onView,
}: {
  doc: DriverDocument;
  onUpload: (doc: DriverDocument) => void;
  onView: () => void;
}) => {
  const { theme, isDark } = useAppTheme();
  const { t } = useTranslation();
  const statusColor =
    doc.status === 'verified'
      ? isDark ? '#34D399' : '#16A34A'
      : doc.status === 'pending'
        ? isDark ? '#FBBF24' : '#F59E0B'
        : doc.status === 'rejected' || doc.status === 'expired'
          ? isDark ? '#F87171' : '#DC2626'
          : isDark ? '#9CA3AF' : '#6B7280';

  const canUpload =
    doc.status === 'missing' ||
    doc.status === 'rejected' ||
    doc.status === 'expired';

  return (
    <View style={[styles.docCard, { backgroundColor: theme.colors.card }]}>
      <View style={styles.docLeft}>
        <Ionicons
          name={
            doc.status === 'verified'
              ? 'checkmark-circle'
              : doc.status === 'pending'
                ? 'time-outline'
                : 'document-outline'
          }
          size={22}
          color={statusColor}
        />

        <View style={{ marginLeft: 12 }}>
          <Text style={[styles.docTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>{t(doc.title)}</Text>
          <Text style={[styles.docSubtitle, isDark && { color: '#9CA3AF' }]}>{t(doc.subtitle)}</Text>

          {doc.expiryDate && (
            <Text style={[styles.expiryText, isDark && { color: '#FCD34D' }]}>
              {t('expires_on', { date: doc.expiryDate })}
            </Text>
          )}

          {doc.rejectionReason && (
            <Text style={[styles.rejectText, isDark && { color: '#F87171' }]}>
              {doc.rejectionReason}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        {doc.status === 'verified' && (
          <Pressable onPress={onView}>
            <Ionicons
              name="eye-outline"
              size={20}
              color={isDark ? '#60A5FA' : '#2563EB'}
            />
          </Pressable>
        )}

        {canUpload && (
          <Pressable
            style={[styles.uploadBtn, isDark && { backgroundColor: 'rgba(37, 99, 235, 0.1)' }]}
            onPress={() => onUpload(doc)}
          >
            <Ionicons
              name="cloud-upload-outline"
              size={16}
              color={isDark ? '#60A5FA' : '#2563EB'}
            />
            <Text style={[styles.uploadText, isDark && { color: '#60A5FA' }]}>{t('upload')}</Text>
          </Pressable>
        )}

        {doc.status === 'pending' && (
          <StatusChip label={t('under_review')} color={isDark ? '#FBBF24' : '#F59E0B'} isDark={isDark} />
        )}

        {doc.status === 'verified' && (
          <StatusChip label={t('verified')} color={isDark ? '#34D399' : '#16A34A'} isDark={isDark} />
        )}
      </View>
    </View>
  );
};

/* ================= CHIP ================= */

const StatusChip = ({
  label,
  color,
  isDark,
}: {
  label: string;
  color: string;
  isDark?: boolean;
}) => (
  <View style={[styles.statusChip, { backgroundColor: color + (isDark ? '30' : '20') }]}>
    <Text style={[styles.statusText, { color }]}>{label}</Text>
  </View>
);

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },

  backBtn: {
    paddingRight: 16,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },

  infoCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#EFF6FF',
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
  },

  infoText: {
    fontSize: 13,
    color: '#1E3A8A',
    flex: 1,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    marginTop: 12,
  },

  docCard: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  docLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  docTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },

  docSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },

  expiryText: {
    fontSize: 12,
    color: '#92400E',
    marginTop: 2,
  },

  rejectText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 2,
  },

  actions: {
    alignItems: 'flex-end',
    gap: 6,
  },

  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
  },

  uploadText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },

  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },

  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },

  footerNote: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center',
  },
});
