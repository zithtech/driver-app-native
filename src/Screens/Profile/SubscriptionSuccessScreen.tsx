import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useAppTheme } from '../../context/ThemeContext';
import { useGetMySubscriptionQuery } from '../../service/userApi';
import moment from 'moment';
import { useAlert } from '../../context/AlertContext';
import AppStatusBar from '../../Components/AppStatusBar';

const { width } = Dimensions.get('window');

const SubscriptionSuccessScreen = ({ navigation, route }: any) => {
  const { colors } = useTheme();
  const { isDark } = useAppTheme();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  
  // Passed from SubscriptionPlanScreen
  const { planName, planColor, amountPaid, duration, transactionId } = route.params || {};

  const { data: subscriptionData, isLoading } = useGetMySubscriptionQuery();
  const subscription = subscriptionData?.data?.subscription;

  const handleDownloadInvoice = () => {
    showAlert({
      title: 'Invoice',
      message: 'Downloading your invoice...',
      singleButton: true,
      icon: 'document-text-outline'
    });
  };

  const handleGoToDashboard = () => {
    navigation.popToTop(); // Go back to Dashboard / Tabs
  };

  const formatDuration = (dur: string) => {
    if (dur === 'daily' || dur === 'day') return 'Daily';
    if (dur === 'weekly' || dur === 'week') return 'Weekly';
    if (dur === 'monthly' || dur === 'month') return 'Monthly';
    return dur;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#111827' : '#FFFFFF' }]} edges={['top', 'bottom']}>
      <AppStatusBar forceLight={!isDark} />
      
      {/* Confetti Animation Layer */}
      <ConfettiCannon
        count={200}
        origin={{ x: width / 2, y: -20 }}
        autoStart={true}
        fadeOut={true}
        fallSpeed={2500}
        colors={['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6']}
      />

      <View style={styles.content}>
        {/* Header / Success Icon */}
        <View style={styles.headerArea}>
          <View style={[styles.iconWrapper, { backgroundColor: isDark ? '#1F2937' : '#F0FDF4' }]}>
            <Ionicons name="checkmark-sharp" size={48} color="#10B981" />
          </View>
          <Text style={[styles.successTitle, { color: isDark ? '#F3F4F6' : '#111827' }]}>Payment Successful</Text>
          <Text style={[styles.successSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            Your {planName || subscription?.plan?.plan_name || 'Premium'} plan is active.
          </Text>
        </View>

        {/* Dynamic Details Area */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary || '#1E3A8A'} />
          </View>
        ) : (
          <View style={styles.detailsWrapper}>
            {/* Amount & Plan Type */}
            <View style={[styles.amountCard, { backgroundColor: isDark ? '#1F2937' : '#F9FAFB' }]}>
              <Text style={[styles.amountText, { color: isDark ? '#FFFFFF' : '#111827' }]}>₹{amountPaid}</Text>
              <View style={[styles.planBadge, { backgroundColor: planColor || '#3B82F6' }]}>
                <Text style={styles.planBadgeText}>{formatDuration(duration || subscription?.billing_cycle)}</Text>
              </View>
            </View>

            {/* Subtle Key-Value List */}
            <View style={styles.listContainer}>
              <View style={styles.listRow}>
                <Text style={[styles.listLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Transaction ID</Text>
                <Text style={[styles.listValue, { color: isDark ? '#F3F4F6' : '#111827' }]}>{transactionId}</Text>
              </View>
              
              <View style={[styles.divider, { backgroundColor: isDark ? '#374151' : '#E5E7EB' }]} />

              <View style={styles.listRow}>
                <Text style={[styles.listLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Start Date</Text>
                <Text style={[styles.listValue, { color: isDark ? '#F3F4F6' : '#111827' }]}>
                  {subscription?.start_date ? moment(subscription.start_date).format('DD MMM YYYY') : '-'}
                </Text>
              </View>
              
              <View style={[styles.divider, { backgroundColor: isDark ? '#374151' : '#E5E7EB' }]} />

              <View style={styles.listRow}>
                <Text style={[styles.listLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>End Date</Text>
                <Text style={[styles.listValue, { color: isDark ? '#F3F4F6' : '#111827' }]}>
                  {subscription?.expiry_date ? moment(subscription.expiry_date).format('DD MMM YYYY') : '-'}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Action Buttons at Bottom */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <Pressable 
          style={[styles.downloadBtn, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]} 
          onPress={handleDownloadInvoice}
        >
          <Ionicons name="document-text-outline" size={18} color={isDark ? '#F9FAFB' : '#111827'} style={{ marginRight: 8 }} />
          <Text style={[styles.downloadBtnText, { color: isDark ? '#F9FAFB' : '#111827' }]}>Download Receipt</Text>
        </Pressable>
        
        <Pressable 
          style={[styles.dashboardBtn, { backgroundColor: isDark ? '#FFFFFF' : '#111827' }]} 
          onPress={handleGoToDashboard}
        >
          <Text style={[styles.dashboardBtnText, { color: isDark ? '#111827' : '#FFFFFF' }]}>Continue to Dashboard</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  headerArea: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  successSubtitle: {
    fontSize: 15,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsWrapper: {
    flex: 1,
  },
  amountCard: {
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    marginBottom: 32,
  },
  amountText: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: 12,
  },
  planBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  planBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  listContainer: {
    paddingHorizontal: 16,
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  listLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  listValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    opacity: 0.5,
  },
  footer: {
    paddingHorizontal: 24,
    gap: 16,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
  },
  downloadBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  dashboardBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
  },
  dashboardBtnText: {
    fontSize: 16,
    fontWeight: '700',
  }
});

export default SubscriptionSuccessScreen;
