import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../context/ThemeContext';
import { Text } from '../../Components';
import { OnboardingFinalStatus_Nav, DeviceCompatibilityCheck_Nav } from '../../Navigations/navigations';
import { storage } from '../../service/utils/storage';

interface ScoreItem {
  key: string;
  label: string;
  score: number;
  maxScore: number;
  icon: string;
}

const DrivingTestResultScreen = ({ navigation, route }: any) => {
  const { theme, isDark } = useAppTheme();
  const fonts = theme.fonts as any;
  const { t } = useTranslation();

  const [reportData, setReportData] = useState<{ score: number; verdict?: string; breakdown?: any }>({
    score: route.params?.score ?? 84,
    verdict: route.params?.verdict,
    breakdown: route.params?.breakdown,
  });

  useEffect(() => {
    if (route.params?.score === undefined) {
      storage.get('LAST_DRIVING_TEST_RESULT').then((cached) => {
        if (cached && typeof cached.score === 'number') {
          setReportData(cached);
        }
      });
    }
  }, [route.params?.score]);

  const score = reportData.score;
  const breakdown = reportData.breakdown;
  const isPass = score >= 80;
  const isReview = score >= 60 && score < 80;

  const scoreCategories: ScoreItem[] = [
    { key: 'braking', label: t('braking_perf', 'Braking Smoothness'), score: breakdown?.braking ?? 14, maxScore: 15, icon: 'stop-circle-outline' },
    { key: 'accel', label: t('accel_ctrl', 'Acceleration Control'), score: breakdown?.acceleration ?? 10, maxScore: 10, icon: 'speedometer-outline' },
    { key: 'turning', label: t('turning_perf', 'Turning & Lane Discipline'), score: breakdown?.turning ?? 13, maxScore: 15, icon: 'git-branch-outline' },
    { key: 'speed', label: t('speed_mgmt', 'Speed Limit Compliance'), score: breakdown?.speed ?? 13, maxScore: 15, icon: 'flash-outline' },
    { key: 'route', label: t('route_comp', 'Route & Waypoint Adherence'), score: breakdown?.route ?? 15, maxScore: 15, icon: 'navigate-outline' },
    { key: 'parking', label: t('parking_perf', 'Reverse Parking Test'), score: breakdown?.parking ?? 14, maxScore: 15, icon: 'car-outline' },
    { key: 'signal', label: t('signal_comp', 'Traffic Signal Discipline'), score: breakdown?.signal ?? 15, maxScore: 15, icon: 'warning-outline' },
  ];

  const getVerdictDetails = () => {
    if (isPass) {
      return {
        badge: t('verdict_recommended', 'Recommended for Approval'),
        badgeColor: '#10B981',
        bg: '#ECFDF5',
        subtext: t('verdict_pass_desc', 'Great driving performance! Your automated score meets platform safety standards. Sent to operations for final clearance.'),
      };
    } else if (isReview) {
      return {
        badge: t('verdict_review', 'Manual Admin Review'),
        badgeColor: '#F59E0B',
        bg: '#FFFBEB',
        subtext: t('verdict_review_desc', 'Your driving performance is under review by our safety operations desk. Recordings will be audited within 24 hours.'),
      };
    } else {
      return {
        badge: t('verdict_retest', 'Retest Recommended'),
        badgeColor: '#EF4444',
        bg: '#FEF2F2',
        subtext: t('verdict_fail_desc', 'Score fell below acceptable thresholds. You may review instructions and schedule a retest.'),
      };
    }
  };

  const verdict = getVerdictDetails();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate(OnboardingFinalStatus_Nav);
            }
          }}
        >
          <Ionicons name="close" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[fonts.bold, styles.headerTitle, { color: theme.colors.text }]}>
          {t('driving_score_report', 'Driving Assessment Report')}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* SCORE HERO DIAL */}
        <View style={[styles.heroCard, { backgroundColor: theme.colors.card }]}>
          <View style={[styles.scoreCircle, { borderColor: verdict.badgeColor }]}>
            <Text style={[fonts.bold, styles.scoreValue, { color: verdict.badgeColor }]}>{score}</Text>
            <Text style={[styles.scoreMax, { color: isDark ? '#94A3B8' : '#64748B' }]}>/ 100</Text>
          </View>

          <View style={[styles.verdictBadge, { backgroundColor: verdict.bg }]}>
            <Text style={[styles.verdictBadgeText, { color: verdict.badgeColor }]}>{verdict.badge}</Text>
          </View>

          <Text style={[styles.verdictDesc, { color: isDark ? '#94A3B8' : '#6B7280' }]}>
            {verdict.subtext}
          </Text>
        </View>

        {/* SECTION: PERFORMANCE BREAKDOWN */}
        <Text style={[fonts.bold, styles.sectionTitle, { color: theme.colors.text }]}>
          {t('score_breakdown', 'Detailed Performance Breakdown')}
        </Text>

        {scoreCategories.map((item) => (
          <View key={item.key} style={[styles.categoryRow, { backgroundColor: theme.colors.card }]}>
            <View style={[styles.categoryIconBox, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
              <Ionicons name={item.icon} size={20} color="#2563EB" />
            </View>
            <View style={styles.categoryInfo}>
              <View style={styles.categoryHeaderRow}>
                <Text style={[styles.categoryLabel, { color: theme.colors.text }]}>{item.label}</Text>
                <Text style={[fonts.bold, styles.categoryScore, { color: theme.colors.text }]}>
                  {item.score} / {item.maxScore}
                </Text>
              </View>
              {/* MINI PROGRESS BAR */}
              <View style={styles.miniBarTrack}>
                <View
                  style={[
                    styles.miniBarFill,
                    {
                      width: `${(item.score / item.maxScore) * 100}%`,
                      backgroundColor: item.score === item.maxScore ? '#10B981' : '#2563EB',
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        ))}

        {/* AUDIT NOTE */}
        <View style={styles.retentionNoticeBox}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#10B981" style={{ marginRight: 8 }} />
          <Text style={[styles.retentionNoticeText, { color: isDark ? '#94A3B8' : '#6B7280' }]}>
            Camera recordings and sensor telemetry have been linked to Session #
            {((route.params?.sessionId || (reportData as any)?.sessionId || '—') as string).substring(0, 8)}.
          </Text>
        </View>
      </ScrollView>

      {/* BOTTOM ACTION */}
      <View style={[styles.bottomBar, { borderTopColor: isDark ? '#334155' : '#E2E8F0', backgroundColor: theme.colors.background }]}>
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => navigation.navigate(OnboardingFinalStatus_Nav)}
          activeOpacity={0.85}
        >
          <Text style={[fonts.bold, styles.doneBtnText]}>
            {t('view_onboarding_status', 'View Final Onboarding Status')}
          </Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
        </TouchableOpacity>

        {!isPass && (
          <TouchableOpacity
            style={[styles.retestBtn, { borderColor: isDark ? '#475569' : '#CBD5E1' }]}
            onPress={() => navigation.navigate(DeviceCompatibilityCheck_Nav)}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh-outline" size={17} color={theme.colors.text} style={{ marginRight: 6 }} />
            <Text style={[fonts.semiBold, styles.retestBtnText, { color: theme.colors.text }]}>
              {t('request_retest', 'Retake Driving Test')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

export default DrivingTestResultScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  heroCard: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  scoreCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  scoreValue: {
    fontSize: 36,
  },
  scoreMax: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: -4,
  },
  verdictBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 10,
  },
  verdictBadgeText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  verdictDesc: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  sectionTitle: {
    fontSize: 15,
    marginBottom: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  categoryIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  categoryLabel: {
    fontSize: 13,
  },
  categoryScore: {
    fontSize: 13,
  },
  miniBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  miniBarFill: {
    height: '100%',
  },
  retentionNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    marginTop: 10,
  },
  retentionNoticeText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    borderTopWidth: 1,
    gap: 10,
  },
  doneBtn: {
    width: '100%',
    flexDirection: 'row',
    height: 50,
    borderRadius: 14,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  retestBtn: {
    width: '100%',
    flexDirection: 'row',
    height: 48,
    borderRadius: 14,
    borderWidth: 1.2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  retestBtnText: {
    fontSize: 14,
  },
});
