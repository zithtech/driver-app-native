import React from 'react';
import { View, StyleSheet, Modal, Pressable, TouchableWithoutFeedback } from 'react-native';
import Text from './Text';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';

/* ================================================================
   OCR Error Code Types
   ================================================================ */

export type OCRErrorCode = 'BLURRY' | 'WRONG_DOCUMENT' | 'EXPIRED' | 'INSUFFICIENT_TEXT';

interface DocSubmissionResultModalProps {
  visible: boolean;
  status: 'success' | 'failed';
  title?: string;
  message?: string;
  buttonText?: string;
  ocrErrorCode?: OCRErrorCode | null;
  onClose: () => void;
  onRetake?: () => void;
}

/* ================================================================
   Error Code → UI Mapping
   ================================================================ */

const OCR_ERROR_CONFIG: Record<OCRErrorCode, {
  icon: string;
  color: string;
  bgColor: string;
  titleKey: string;
  defaultTitle: string;
}> = {
  BLURRY: {
    icon: 'image-outline',
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.1)',
    titleKey: 'ocr_blurry_title',
    defaultTitle: 'Blurry Image',
  },
  WRONG_DOCUMENT: {
    icon: 'swap-horizontal',
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.1)',
    titleKey: 'ocr_wrong_doc_title',
    defaultTitle: 'Wrong Document',
  },
  EXPIRED: {
    icon: 'calendar-outline',
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.1)',
    titleKey: 'ocr_expired_title',
    defaultTitle: 'Document Expired',
  },
  INSUFFICIENT_TEXT: {
    icon: 'scan-outline',
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.1)',
    titleKey: 'ocr_incomplete_title',
    defaultTitle: 'Incomplete Capture',
  },
};

/* ================================================================
   Component
   ================================================================ */

const DocSubmissionResultModal: React.FC<DocSubmissionResultModalProps> = ({
  visible,
  status,
  title,
  message,
  buttonText,
  ocrErrorCode,
  onClose,
  onRetake,
}) => {
  const { theme, isDark } = useAppTheme();
  const { t } = useTranslation();

  const isSuccess = status === 'success';

  // Determine the visual config based on OCR error code
  const ocrConfig = ocrErrorCode ? OCR_ERROR_CONFIG[ocrErrorCode] : null;

  const iconColor = ocrConfig ? ocrConfig.color : (isSuccess ? '#10B981' : '#EF4444');
  const iconName = ocrConfig ? ocrConfig.icon : (isSuccess ? 'checkmark-circle' : 'close-circle');
  
  const defaultTitle = ocrConfig
    ? t(ocrConfig.titleKey, ocrConfig.defaultTitle)
    : isSuccess
      ? t('upload_successful', 'Uploaded Successfully')
      : t('docs_submit_failed', 'Submission Failed');

  const defaultMessage = isSuccess 
    ? t('upload_success_msg', 'Your documents have been uploaded successfully and are now under review.')
    : t('submission_failed_msg', "We couldn't verify your documents. Please check the details and try again.");

  const defaultButtonText = isSuccess
    ? t('continue', 'Continue')
    : ocrErrorCode
      ? t('retake_photo', 'Retake Photo')
      : t('review_resubmit', 'Review & Resubmit');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <TouchableWithoutFeedback>
          <View style={[styles.modalContainer, { backgroundColor: isDark ? theme.colors.card : '#FFFFFF' }]}>
            
            {/* Icon with colored background circle */}
            <View style={[styles.iconCircle, { backgroundColor: ocrConfig?.bgColor || (isSuccess ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)') }]}>
              <Ionicons name={iconName} size={40} color={iconColor} />
            </View>

            <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#111827' }]}>
              {title || defaultTitle}
            </Text>
            
            <Text style={[styles.message, { color: isDark ? '#9CA3AF' : '#4B5563' }]}>
              {message || defaultMessage}
            </Text>

            {/* Primary action button */}
            <Pressable 
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: isSuccess ? theme.colors.primary : iconColor },
                pressed && { opacity: 0.8 }
              ]}
              onPress={ocrErrorCode && onRetake ? onRetake : onClose}
            >
              <Ionicons 
                name={ocrErrorCode ? 'camera-outline' : (isSuccess ? 'checkmark' : 'refresh')} 
                size={18} 
                color="#FFFFFF" 
                style={{ marginRight: 8 }}
              />
              <Text style={styles.buttonText}>
                {buttonText || defaultButtonText}
              </Text>
            </Pressable>

            {/* Secondary dismiss button for OCR errors */}
            {ocrErrorCode && (
              <Pressable 
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: isDark ? '#374151' : '#E5E7EB' },
                  pressed && { opacity: 0.6 }
                ]}
                onPress={onClose}
              >
                <Text style={[styles.secondaryButtonText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                  {t('dismiss', 'Dismiss')}
                </Text>
              </Pressable>
            )}

          </View>
        </TouchableWithoutFeedback>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  button: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default DocSubmissionResultModal;
