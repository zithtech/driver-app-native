import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../context/ThemeContext';
import { Text } from '../../Components';
import { useResponsive } from '../../lib/scale';
import { DeviceCompatibilityCheck_Nav } from '../../Navigations/navigations';

const DrivingTestIntroScreen = ({ navigation }: any) => {
  const { theme, isDark } = useAppTheme();
  const fonts = theme.fonts as any;
  const { t } = useTranslation();
  const { rs, rvs, rms, selectByDevice } = useResponsive();

  const [hasConsented, setHasConsented] = useState(false);

  const handleProceed = () => {
    if (!hasConsented) {
      Alert.alert(
        t('consent_required', 'Consent Required'),
        t('consent_msg', 'Please accept the recording and data retention terms before proceeding to the driving assessment.')
      );
      return;
    }
    navigation.navigate(DeviceCompatibilityCheck_Nav);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[fonts.bold, styles.headerTitle, { color: theme.colors.text }]}>
          {t('driving_test_title', 'Guided Driving Test')}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* HERO BADGE */}
        <View style={[styles.heroCard, { backgroundColor: isDark ? '#1E293B' : '#EFF6FF', borderColor: isDark ? '#334155' : '#DBEAFE' }]}>
          <View style={styles.heroIconBadge}>
            <Ionicons name="car-sport" size={28} color="#2563EB" />
          </View>
          <View style={styles.heroTextCol}>
            <Text style={[fonts.bold, styles.heroTitle, { color: theme.colors.text }]}>
              {t('onboarding_stage_5', 'Stage 5: Practical Driving Test')}
            </Text>
            <Text style={[styles.heroSub, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              {t('driving_test_sub', '15–20 Minute Automated Route Assessment')}
            </Text>
          </View>
        </View>

        {/* SECTION: ESSENTIAL REQUIREMENTS */}
        <Text style={[fonts.bold, styles.sectionHeader, { color: theme.colors.text }]}>
          {t('preparation_guidelines', 'Mounting & Setup Requirements')}
        </Text>

        {/* ITEM 1: MOUNTING */}
        <View style={[styles.infoCard, { backgroundColor: theme.colors.card }]}>
          <View style={[styles.infoIconBox, { backgroundColor: '#EEF2FF' }]}>
            <Ionicons name="phone-portrait-outline" size={22} color="#4F46E5" />
          </View>
          <View style={styles.infoContent}>
            <Text style={[fonts.bold, styles.infoTitle, { color: theme.colors.text }]}>
              {t('phone_mount_title', 'Secure Mobile Mount')}
            </Text>
            <Text style={[styles.infoDesc, { color: isDark ? '#94A3B8' : '#6B7280' }]}>
              {t('phone_mount_desc', 'Mount phone securely on the windshield or dashboard. It must remain stationary throughout the test.')}
            </Text>
          </View>
        </View>

        {/* ITEM 2: CAMERAS */}
        <View style={[styles.infoCard, { backgroundColor: theme.colors.card }]}>
          <View style={[styles.infoIconBox, { backgroundColor: '#ECFDF5' }]}>
            <Ionicons name="videocam-outline" size={22} color="#059669" />
          </View>
          <View style={styles.infoContent}>
            <Text style={[fonts.bold, styles.infoTitle, { color: theme.colors.text }]}>
              {t('dual_cam_title', 'Dual Camera Views')}
            </Text>
            <Text style={[styles.infoDesc, { color: isDark ? '#94A3B8' : '#6B7280' }]}>
              {t('dual_cam_desc', 'Rear camera must clearly capture the road and lanes ahead. Front camera must clearly frame the driver and steering wheel.')}
            </Text>
          </View>
        </View>

        {/* ITEM 3: AUDIO GUIDANCE */}
        <View style={[styles.infoCard, { backgroundColor: theme.colors.card }]}>
          <View style={[styles.infoIconBox, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="volume-high-outline" size={22} color="#D97706" />
          </View>
          <View style={styles.infoContent}>
            <Text style={[fonts.bold, styles.infoTitle, { color: theme.colors.text }]}>
              {t('voice_nav_title', 'Zero-Touch Voice Guidance')}
            </Text>
            <Text style={[styles.infoDesc, { color: isDark ? '#94A3B8' : '#6B7280' }]}>
              {t('voice_nav_desc', 'Turn-by-turn prompts are spoken in your chosen language (English/Tamil). Do NOT touch or hold the phone while driving.')}
            </Text>
          </View>
        </View>

        {/* ITEM 4: GPS & ROUTE */}
        <View style={[styles.infoCard, { backgroundColor: theme.colors.card }]}>
          <View style={[styles.infoIconBox, { backgroundColor: '#F3E8FF' }]}>
            <Ionicons name="navigate-outline" size={22} color="#9333EA" />
          </View>
          <View style={styles.infoContent}>
            <Text style={[fonts.bold, styles.infoTitle, { color: theme.colors.text }]}>
              {t('gps_route_title', 'Assigned Route Adherence')}
            </Text>
            <Text style={[styles.infoDesc, { color: isDark ? '#94A3B8' : '#6B7280' }]}>
              {t('gps_route_desc', 'Follow the mapped checkpoints including left/right turns, signal halts, and reverse parking test.')}
            </Text>
          </View>
        </View>

        {/* SECTION: DATA RETENTION & CONSENT */}
        <View style={[styles.consentBox, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : '#F8FAFC', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
          <TouchableOpacity
            style={styles.checkboxRow}
            activeOpacity={0.8}
            onPress={() => setHasConsented(!hasConsented)}
          >
            <Ionicons
              name={hasConsented ? 'checkbox' : 'square-outline'}
              size={24}
              color={hasConsented ? '#10B981' : isDark ? '#94A3B8' : '#9CA3AF'}
            />
            <View style={styles.checkboxTextCol}>
              <Text style={[styles.consentText, { color: theme.colors.text }]}>
                {t(
                  'consent_agreement',
                  'I consent to simultaneous front and rear video recording, GPS telemetry logging, and driving behaviour analysis for onboarding assessment.'
                )}
              </Text>
              <Text style={[styles.retentionNotice, { color: isDark ? '#94A3B8' : '#6B7280' }]}>
                {t(
                  'retention_policy_notice',
                  'Privacy Note: Video files are encrypted and automatically deleted following verification according to our Data Retention Policy.'
                )}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* BOTTOM ACTION */}
      <View style={[styles.bottomBar, { borderTopColor: isDark ? '#334155' : '#E2E8F0' }]}>
        <TouchableOpacity
          style={[styles.startBtn, !hasConsented && { backgroundColor: isDark ? '#475569' : '#CBD5E1' }]}
          disabled={!hasConsented}
          onPress={handleProceed}
          activeOpacity={0.85}
        >
          <Text style={[fonts.bold, styles.startBtnText]}>
            {t('proceed_to_device_check', 'Check Device & Continue')}
          </Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default DrivingTestIntroScreen;

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
    paddingBottom: 30,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
    marginTop: 4,
  },
  heroIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  heroTextCol: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 15,
    marginBottom: 2,
  },
  heroSub: {
    fontSize: 12,
  },
  sectionHeader: {
    fontSize: 15,
    marginBottom: 12,
  },
  infoCard: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    alignItems: 'flex-start',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  infoIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  infoDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  consentBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 14,
    marginBottom: 10,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkboxTextCol: {
    flex: 1,
    marginLeft: 10,
  },
  consentText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  retentionNotice: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
  },
  startBtn: {
    flexDirection: 'row',
    height: 50,
    borderRadius: 12,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  startBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});
