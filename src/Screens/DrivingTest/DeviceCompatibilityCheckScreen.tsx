import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../context/ThemeContext';
import { Text } from '../../Components';
import DualCameraService, { DeviceCompatibilityReport } from '../../services/DualCameraService';
import { LiveDrivingTest_Nav } from '../../Navigations/navigations';

interface DiagnosticItem {
  id: string;
  title: string;
  description: string;
  status: 'PENDING' | 'CHECKING' | 'PASSED' | 'FAILED' | 'WARNING';
  icon: string;
  detailText?: string;
}

const DeviceCompatibilityCheckScreen = ({ navigation }: any) => {
  const { theme, isDark } = useAppTheme();
  const fonts = theme.fonts as any;
  const { t } = useTranslation();

  const [isEvaluating, setIsEvaluating] = useState(true);
  const [report, setReport] = useState<DeviceCompatibilityReport | null>(null);
  const [canProceed, setCanProceed] = useState(false);

  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([
    {
      id: 'front_camera',
      title: t('front_cam_check', 'Front Camera Check'),
      description: t('front_cam_desc', 'Verifying driver cabin camera sensor'),
      status: 'CHECKING',
      icon: 'camera-outline',
    },
    {
      id: 'rear_camera',
      title: t('rear_cam_check', 'Rear Camera Check'),
      description: t('rear_cam_desc', 'Verifying forward road camera sensor'),
      status: 'PENDING',
      icon: 'videocam-outline',
    },
    {
      id: 'concurrent_recording',
      title: t('concurrent_check', 'Simultaneous Dual Camera Support'),
      description: t('concurrent_desc', 'Hardware concurrent capture validation'),
      status: 'PENDING',
      icon: 'hardware-chip-outline',
    },
    {
      id: 'gps_accuracy',
      title: t('gps_check', 'GPS & Location Accuracy'),
      description: t('gps_desc', 'Satellite navigation and speed sensors'),
      status: 'PENDING',
      icon: 'navigate-circle-outline',
    },
    {
      id: 'storage_check',
      title: t('storage_check', 'Internal Storage Space'),
      description: t('storage_desc', 'Requires >= 800MB free space for video buffering'),
      status: 'PENDING',
      icon: 'disc-outline',
    },
    {
      id: 'battery_level',
      title: t('battery_check', 'Battery & Power Status'),
      description: t('battery_desc', 'Minimum 20% battery or connected to car charger'),
      status: 'PENDING',
      icon: 'battery-charging-outline',
    },
  ]);

  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    setIsEvaluating(true);
    try {
      const rep = await DualCameraService.checkCompatibility();
      setReport(rep);

      // Staged step updates for visual feedback
      setDiagnostics((prev) =>
        prev.map((item) => {
          switch (item.id) {
            case 'front_camera':
              return {
                ...item,
                status: rep.camera.hasFrontCamera ? 'PASSED' : 'FAILED',
                detailText: rep.camera.hasFrontCamera ? 'Detected & Operational' : 'Sensor Not Detected',
              };
            case 'rear_camera':
              return {
                ...item,
                status: rep.camera.hasBackCamera ? 'PASSED' : 'FAILED',
                detailText: rep.camera.hasBackCamera ? 'Detected & Operational' : 'Sensor Not Detected',
              };
            case 'concurrent_recording':
              return {
                ...item,
                status: rep.camera.supportsConcurrentCamera ? 'PASSED' : 'WARNING',
                detailText: rep.camera.supportsConcurrentCamera
                  ? 'Hardware Supported'
                  : 'Concurrent ISP Stream Unavailable',
              };
            case 'gps_accuracy':
              return {
                ...item,
                status: rep.location.isGpsEnabled ? 'PASSED' : 'FAILED',
                detailText: rep.location.isGpsEnabled ? 'GPS Active (High Precision)' : 'Location Disabled',
              };
            case 'storage_check':
              return {
                ...item,
                status: rep.storage.isStorageSufficient ? 'PASSED' : 'FAILED',
                detailText: `${rep.storage.availableGB.toFixed(1)} GB Available`,
              };
            case 'battery_level':
              return {
                ...item,
                status: rep.battery.isBatterySufficient ? 'PASSED' : 'WARNING',
                detailText: `${rep.battery.batteryLevel}% ${rep.battery.isCharging ? '(Charging)' : ''}`,
              };
            default:
              return item;
          }
        })
      );

      // Driving test can proceed if camera sensors, storage, and GPS pass
      const allCriticalPassed =
        rep.camera.hasFrontCamera &&
        rep.camera.hasBackCamera &&
        rep.location.isGpsEnabled &&
        rep.storage.isStorageSufficient;

      setCanProceed(allCriticalPassed);
    } catch (e) {
      console.error('[DeviceCompatibility] Diagnostics error:', e);
      Alert.alert('Diagnostics Error', 'Unable to probe device hardware. Please retry.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const getStatusIcon = (status: DiagnosticItem['status']) => {
    switch (status) {
      case 'PASSED':
        return <Ionicons name="checkmark-circle" size={22} color="#10B981" />;
      case 'FAILED':
        return <Ionicons name="close-circle" size={22} color="#EF4444" />;
      case 'WARNING':
        return <Ionicons name="alert-circle" size={22} color="#F59E0B" />;
      case 'CHECKING':
        return <ActivityIndicator size="small" color="#2563EB" />;
      default:
        return <Ionicons name="time-outline" size={22} color="#94A3B8" />;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[fonts.bold, styles.headerTitle, { color: theme.colors.text }]}>
          {t('device_diagnostics', 'Device Compatibility')}
        </Text>
        <TouchableOpacity onPress={runDiagnostics} disabled={isEvaluating} style={styles.backBtn}>
          <Ionicons name="refresh" size={22} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.topInfo}>
          <Text style={[fonts.bold, styles.mainTitle, { color: theme.colors.text }]}>
            {t('preflight_title', 'Pre-Flight Hardware Diagnostics')}
          </Text>
          <Text style={[styles.mainSub, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            {t('preflight_desc', 'Verifying video encoders, camera concurrency, storage, and sensors.')}
          </Text>
        </View>

        {/* DIAGNOSTICS LIST */}
        {diagnostics.map((item) => (
          <View key={item.id} style={[styles.checkCard, { backgroundColor: theme.colors.card }]}>
            <View style={[styles.iconBox, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
              <Ionicons name={item.icon} size={22} color="#2563EB" />
            </View>
            <View style={styles.cardDetails}>
              <Text style={[fonts.bold, styles.cardTitle, { color: theme.colors.text }]}>{item.title}</Text>
              <Text style={[styles.cardDesc, { color: isDark ? '#94A3B8' : '#6B7280' }]}>{item.description}</Text>
              {item.detailText ? (
                <Text style={[styles.cardDetailText, { color: item.status === 'PASSED' ? '#10B981' : item.status === 'FAILED' ? '#EF4444' : '#F59E0B' }]}>
                  {item.detailText}
                </Text>
              ) : null}
            </View>
            <View style={styles.statusBox}>{getStatusIcon(item.status)}</View>
          </View>
        ))}

        {/* CONCURRENT CAMERA NOTICE IF UNSUPPORTED */}
        {report && !report.camera.supportsConcurrentCamera && (
          <View style={[styles.warningBanner, { backgroundColor: isDark ? '#3E2723' : '#FFFBEB', borderColor: '#F59E0B' }]}>
            <Ionicons name="information-circle" size={24} color="#D97706" style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={[fonts.bold, { fontSize: 13, color: isDark ? '#FCD34D' : '#92400E', marginBottom: 3 }]}>
                {t('concurrent_unavailable_title', 'Concurrent Dual Camera Note')}
              </Text>
              <Text style={{ fontSize: 12, lineHeight: 18, color: isDark ? '#FDE68A' : '#78350F' }}>
                {t(
                  'concurrent_unavailable_msg',
                  'Your device does not support concurrent hardware video capture. You may pair a secondary device, visit an onboarding hub, or proceed with verified road camera capture if permitted by admin.'
                )}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* BOTTOM BUTTON */}
      <View style={[styles.bottomBar, { borderTopColor: isDark ? '#334155' : '#E2E8F0' }]}>
        <TouchableOpacity
          style={[
            styles.proceedBtn,
            (!canProceed || isEvaluating) && { backgroundColor: isDark ? '#475569' : '#CBD5E1' },
          ]}
          disabled={!canProceed || isEvaluating}
          onPress={() =>
            navigation.navigate(LiveDrivingTest_Nav, {
              supportsConcurrentCamera: report?.camera?.supportsConcurrentCamera ?? false,
              deviceModel: report?.deviceModel || 'android',
            })
          }
          activeOpacity={0.85}
        >
          {isEvaluating ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={[fonts.bold, styles.proceedBtnText]}>
                {canProceed ? t('start_driving_test', 'Ready — Start Driving Test') : t('resolve_issues', 'Resolve Issues to Continue')}
              </Text>
              {canProceed && <Ionicons name="speedometer" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />}
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default DeviceCompatibilityCheckScreen;

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
  topInfo: {
    marginTop: 6,
    marginBottom: 16,
  },
  mainTitle: {
    fontSize: 18,
    marginBottom: 4,
  },
  mainSub: {
    fontSize: 13,
    lineHeight: 18,
  },
  checkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardDetails: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    marginBottom: 2,
  },
  cardDesc: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  cardDetailText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  statusBox: {
    marginLeft: 8,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
    marginBottom: 10,
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
  },
  proceedBtn: {
    flexDirection: 'row',
    height: 50,
    borderRadius: 12,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  proceedBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});
