import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useAppTheme } from '../../context/ThemeContext';
import { Text } from '../../Components';
import { setUser } from '../../redux/userSlice';
import { Dashboard_Nav, DeviceCompatibilityCheck_Nav, DrivingTestResult_Nav, HelpCenter_Nav } from '../../Navigations/navigations';
import { useGetOnboardingFinalStatusQuery } from '../../service/driverApi';

export type FinalStatusType =
  | 'PENDING_ADMIN_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'RETEST_REQUIRED'
  | 'COMPLETED';

const OnboardingFinalStatusScreen = ({ navigation }: any) => {
  const { theme, isDark } = useAppTheme();
  const fonts = theme.fonts as any;
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const user = useSelector((state: any) => state.userSlice.user);
  const driverId = user?.id || user?._id || user?.driverId || '';

  const { data: statusData, refetch, isFetching } = useGetOnboardingFinalStatusQuery(
    { driverId },
    { skip: !driverId }
  );

  const [status, setStatus] = useState<FinalStatusType>('PENDING_ADMIN_APPROVAL');

  // Refetch latest status on screen focus / app reopen
  useFocusEffect(
    useCallback(() => {
      if (driverId) {
        refetch();
      }
    }, [driverId, refetch])
  );

  // Sync server onboarding status
  useEffect(() => {
    if (statusData) {
      const obStatus = (statusData.onboardingStatus || '').toUpperCase();
      const finalApproval = (statusData.stages?.finalApproval?.status || '').toUpperCase();

      if (obStatus === 'ACTIVE' || finalApproval === 'APPROVED') {
        setStatus('APPROVED');
      } else if (obStatus === 'REJECTED' || finalApproval === 'REJECTED') {
        setStatus('REJECTED');
      } else if (obStatus === 'DRIVING_TEST_RETEST_REQUIRED' || finalApproval === 'RETEST_REQUESTED') {
        setStatus('RETEST_REQUIRED');
      } else {
        setStatus('PENDING_ADMIN_APPROVAL');
      }
    }
  }, [statusData]);

  const handleRefresh = async () => {
    if (driverId) {
      await refetch();
    }
  };

  const handleGoToDashboard = () => {
    dispatch(setUser({ onboarding_status: 'ACTIVE', status: 'active' }));
    navigation.reset({
      index: 0,
      routes: [{ name: Dashboard_Nav }],
    });
  };

  const driveScore =
    statusData?.stages?.drivingTest?.score !== null &&
    statusData?.stages?.drivingTest?.score !== undefined
      ? statusData.stages.drivingTest.score
      : null;

  const getStatusConfig = () => {
    switch (status) {
      case 'APPROVED':
      case 'COMPLETED':
        return {
          title: t('onboarding_completed_title', 'Onboarding Completed!'),
          subtitle: t('onboarding_completed_desc', 'Your driver account and approved vehicle categories are active. You can now go online to accept rides.'),
          icon: 'checkmark-circle',
          color: '#10B981',
          bg: '#ECFDF5',
          ctaText: t('go_to_dashboard', 'Go to Driver Dashboard'),
          onCta: handleGoToDashboard,
        };
      case 'RETEST_REQUIRED':
        return {
          title: t('retest_required_title', 'Retest Required'),
          subtitle: t('retest_required_desc', 'Your driving assessment did not meet the safety score benchmark. You may retake the guided driving test.'),
          icon: 'refresh-circle',
          color: '#F59E0B',
          bg: '#FFFBEB',
          ctaText: t('retake_driving_test', 'Retake Driving Test'),
          onCta: () => navigation.navigate(DeviceCompatibilityCheck_Nav),
        };
      case 'REJECTED':
        return {
          title: t('onboarding_rejected_title', 'Application Not Approved'),
          subtitle: t('onboarding_rejected_desc', 'Your profile or driving assessment could not be approved. Please contact driver partner support for assistance.'),
          icon: 'close-circle',
          color: '#EF4444',
          bg: '#FEF2F2',
          ctaText: t('contact_support', 'Contact Partner Support'),
          onCta: () => navigation.navigate(HelpCenter_Nav),
        };
      case 'PENDING_ADMIN_APPROVAL':
      default:
        return {
          title: t('pending_admin_approval_title', 'Pending Final Admin Clearance'),
          subtitle: t(
            'pending_admin_approval_desc',
            `All verification stages and your practical driving test${driveScore !== null ? ` (Score: ${driveScore}/100)` : ''} are completed. Our safety operations desk is performing the final sign-off.`
          ),
          icon: 'time',
          color: '#2563EB',
          bg: '#EFF6FF',
          ctaText: t('refresh_status', 'Check Status'),
          onCta: handleRefresh,
        };
    }
  };

  const cfg = getStatusConfig();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {navigation.canGoBack() && (
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          )}
        </View>
        <Text style={[fonts.bold, styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1}>
          {t('onboarding_status', 'Onboarding Status')}
        </Text>
        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={[
              styles.reportTagBtn,
              {
                backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF',
                borderColor: isDark ? 'rgba(59, 130, 246, 0.35)' : '#BFDBFE',
              },
            ]}
            onPress={() => navigation.navigate(DrivingTestResult_Nav, { score: driveScore ?? undefined })}
            activeOpacity={0.8}
          >
            <Ionicons name="document-text-outline" size={14} color="#2563EB" style={{ marginRight: 4 }} />
            <Text style={[fonts.bold, styles.reportTagText, { color: isDark ? '#60A5FA' : '#2563EB' }]}>
              {t('report', 'Report')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.supportBtn}
            onPress={() => navigation.navigate(HelpCenter_Nav)}
            activeOpacity={0.8}
          >
            <Ionicons name="headset-outline" size={20} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* HERO STATUS CARD */}
        <View style={[styles.heroCard, { backgroundColor: theme.colors.card }]}>
          <View style={[styles.heroIconBox, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon} size={48} color={cfg.color} />
          </View>
          <Text style={[fonts.bold, styles.statusTitle, { color: theme.colors.text }]}>{cfg.title}</Text>
          <Text style={[styles.statusSubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>{cfg.subtitle}</Text>
        </View>

        {/* ONBOARDING STAGES CHECKLIST */}
        <Text style={[fonts.bold, styles.sectionTitle, { color: theme.colors.text }]}>
          {t('stage_progress', 'Onboarding Stages Summary')}
        </Text>

        {/* STAGE 1 */}
        <View style={[styles.stageCard, { backgroundColor: theme.colors.card }]}>
          <View style={styles.stageIconBox}>
            <Ionicons name="checkmark-circle" size={22} color="#10B981" />
          </View>
          <View style={styles.stageContent}>
            <Text style={[fonts.bold, styles.stageName, { color: theme.colors.text }]}>Stage 1: Driver Registration</Text>
            <Text style={[styles.stageStatus, { color: '#10B981' }]}>Completed & Verified</Text>
          </View>
        </View>

        {/* STAGE 2 */}
        <View style={[styles.stageCard, { backgroundColor: theme.colors.card }]}>
          <View style={styles.stageIconBox}>
            <Ionicons name="checkmark-circle" size={22} color="#10B981" />
          </View>
          <View style={styles.stageContent}>
            <Text style={[fonts.bold, styles.stageName, { color: theme.colors.text }]}>Stage 2: Document KYC</Text>
            <Text style={[styles.stageStatus, { color: '#10B981' }]}>Driving Licence & ID Approved</Text>
          </View>
        </View>

        {/* STAGE 3 */}
        <View style={[styles.stageCard, { backgroundColor: theme.colors.card }]}>
          <View style={styles.stageIconBox}>
            <Ionicons name="checkmark-circle" size={22} color="#10B981" />
          </View>
          <View style={styles.stageContent}>
            <Text style={[fonts.bold, styles.stageName, { color: theme.colors.text }]}>Stage 3: Video KYC</Text>
            <Text style={[styles.stageStatus, { color: '#10B981' }]}>Live Identity Verified</Text>
          </View>
        </View>

        {/* STAGE 4 */}
        <TouchableOpacity
          style={[styles.stageCard, { backgroundColor: theme.colors.card }]}
          onPress={() => navigation.navigate(DrivingTestResult_Nav, { score: driveScore ?? undefined })}
          activeOpacity={0.75}
        >
          <View style={styles.stageIconBox}>
            <Ionicons name="checkmark-circle" size={22} color="#10B981" />
          </View>
          <View style={styles.stageContent}>
            <Text style={[fonts.bold, styles.stageName, { color: theme.colors.text }]}>Stage 5: Practical Driving Test</Text>
            <Text style={[styles.stageStatus, { color: '#10B981' }]}>
              {driveScore !== null ? `Drive Score: ${driveScore} / 100 • View Report` : 'Assessment Submitted • View Report'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={isDark ? '#64748B' : '#94A3B8'} />
        </TouchableOpacity>

        {/* STAGE 5 */}
        <View style={[styles.stageCard, { backgroundColor: theme.colors.card }]}>
          <View style={styles.stageIconBox}>
            <Ionicons
              name={status === 'APPROVED' || status === 'COMPLETED' ? 'checkmark-circle' : 'time'}
              size={22}
              color={status === 'APPROVED' || status === 'COMPLETED' ? '#10B981' : '#2563EB'}
            />
          </View>
          <View style={styles.stageContent}>
            <Text style={[fonts.bold, styles.stageName, { color: theme.colors.text }]}>Stage 7: Final Admin Clearance</Text>
            <Text style={[styles.stageStatus, { color: status === 'APPROVED' ? '#10B981' : '#2563EB' }]}>
              {status === 'APPROVED' ? 'Approved & Activated' : 'Under Safety Desk Review'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* BOTTOM ACTION */}
      <View style={[styles.bottomBar, { borderTopColor: isDark ? '#334155' : '#E2E8F0' }]}>
        <TouchableOpacity
          style={[styles.mainCtaBtn, { backgroundColor: cfg.color }]}
          onPress={cfg.onCta}
          disabled={isFetching}
          activeOpacity={0.85}
        >
          {isFetching ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[fonts.bold, styles.mainCtaText]}>{cfg.ctaText}</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default OnboardingFinalStatusScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    minWidth: 28,
    justifyContent: 'center',
  },
  backBtn: {
    padding: 4,
    marginRight: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    marginLeft: 4,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reportTagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  reportTagText: {
    fontSize: 12,
  },
  supportBtn: {
    padding: 6,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  heroCard: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  heroIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 6,
  },
  statusSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 8,
  },
  sectionTitle: {
    fontSize: 15,
    marginBottom: 12,
  },
  stageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  stageIconBox: {
    marginRight: 12,
  },
  stageContent: {
    flex: 1,
  },
  stageName: {
    fontSize: 13.5,
    marginBottom: 2,
  },
  stageStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
  },
  mainCtaBtn: {
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainCtaText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});
