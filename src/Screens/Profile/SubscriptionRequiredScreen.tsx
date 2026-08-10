import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { useTranslation } from 'react-i18next';
import { ms, vs } from '../../lib/scale';
import { Text } from '../../Components';
import { useAppTheme } from '../../context/ThemeContext';
import AppStatusBar from '../../Components/AppStatusBar';
import { SafeAreaView } from 'react-native-safe-area-context';

const SubscriptionRequiredScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { theme, isDark } = useAppTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? theme.colors.background : '#FFFFFF' }]}>
      <AppStatusBar />
      {/* Floating Back Button */}
      <TouchableOpacity
        style={[styles.backButton, { top: insets.top + vs(10) }]}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="chevron-back" size={ms(28)} color={isDark ? '#FFFFFF' : '#111827'} />
      </TouchableOpacity>

      {/* Floating Support Button */}
      <TouchableOpacity
        style={[styles.supportButton, { top: insets.top + vs(10) }]}
        onPress={() => navigation.navigate('HelpCenterScreen')}
      >
        <Ionicons name="headset-outline" size={ms(18)} color={isDark ? '#FFFFFF' : '#111827'} />
        <Text style={[styles.supportText, { color: isDark ? '#FFFFFF' : '#111827' }]}>Support</Text>
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: vs(40) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Image */}
        <Image
          source={require('../../assets/images/notactive.png')}
          style={styles.heroImage}
          resizeMode="contain"
        />

        <Text style={[styles.title, { color: theme.colors.text }]}>
          {t('subscription_required', 'Subscription Required')}
        </Text>

        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          {t('subscription_required_desc', 'You need an active subscription to receive\nride requests and go online.')}
        </Text>

        {/* Why Subscribe Card */}
        <View style={[styles.card, { borderColor: isDark ? '#374151' : '#E5E7EB', backgroundColor: 'transparent' }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
            {t('why_subscribe', 'Why Subscribe?')}
          </Text>
          <View style={styles.featuresRow}>
            <View style={styles.featureItem}>
              <View style={[styles.iconWrapper, { borderColor: '#E5E7EB', borderWidth: 1 }]}>
                <Ionicons name="shield-checkmark-outline" size={ms(20)} color="#2563EB" />
              </View>
              <Text style={[styles.featureText, { color: theme.colors.text }]}>
                Get Ride{'\n'}Requests
              </Text>
            </View>
            <View style={styles.verticalDivider} />
            <View style={styles.featureItem}>
              <View style={[styles.iconWrapper, { borderColor: '#E5E7EB', borderWidth: 1 }]}>
                <Ionicons name="wallet-outline" size={ms(20)} color="#2563EB" />
              </View>
              <Text style={[styles.featureText, { color: theme.colors.text }]}>
                Increase{'\n'}Earnings
              </Text>
            </View>
            <View style={styles.verticalDivider} />
            <View style={styles.featureItem}>
              <View style={[styles.iconWrapper, { borderColor: '#E5E7EB', borderWidth: 1 }]}>
                <Ionicons name="time-outline" size={ms(20)} color="#2563EB" />
              </View>
              <Text style={[styles.featureText, { color: theme.colors.text }]}>
                Priority{'\n'}Support
              </Text>
            </View>
            <View style={styles.verticalDivider} />
            <View style={styles.featureItem}>
              <View style={[styles.iconWrapper, { borderColor: '#E5E7EB', borderWidth: 1 }]}>
                <Ionicons name="ribbon-outline" size={ms(20)} color="#2563EB" />
              </View>
              <Text style={[styles.featureText, { color: theme.colors.text }]}>
                Premium{'\n'}Benefits
              </Text>
            </View>
          </View>
        </View>

        {/* Date Image & Plan Card container */}
        <View style={styles.planContainer}>
          {/* Blue background card */}
          <View style={styles.blueCard}>
            <View style={styles.blueCardContent}>
              <View style={styles.dateImageContainer}>
                <Image
                  source={require('../../assets/images/date.png')}
                  style={styles.dateImage}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.blueCardTextContainer}>
                <Text style={styles.blueCardTitle}>Stay Online. Earn More.</Text>
                <Text style={styles.blueCardDesc}>
                  Choose a plan that works best for you and start getting more rides.
                </Text>
                <TouchableOpacity
                  style={styles.browseButton}
                  onPress={() => navigation.navigate('RechargePlanScreen')}
                >
                  <Text style={styles.browseButtonText}>Browse Recharge Plans</Text>
                  <Ionicons name="chevron-forward" size={ms(16)} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.cancelRenewContainer}>
              <Ionicons name="lock-closed" size={ms(12)} color="#6B7280" />
              <Text style={styles.cancelRenewText}>You can cancel or renew anytime.</Text>
            </View>
          </View>
        </View>

        {/* Why it matters separator */}
        <View style={styles.separatorContainer}>
          <View style={[styles.separatorLine, { backgroundColor: isDark ? '#374151' : '#E5E7EB' }]} />
          <Text style={[styles.separatorText, { color: '#2563EB' }]}>Why it matters?</Text>
          <View style={[styles.separatorLine, { backgroundColor: isDark ? '#374151' : '#E5E7EB' }]} />
        </View>

        {/* 3 reasons row */}
        <View style={styles.reasonsRow}>
          <View style={styles.reasonItem}>
            <View style={[styles.reasonIconWrapper, { backgroundColor: isDark ? '#1E3A8A' : '#EFF6FF' }]}>
              <Ionicons name="stats-chart" size={ms(24)} color="#2563EB" />
            </View>
            <View style={styles.reasonTextContainer}>
              <Text style={[styles.reasonTitle, { color: theme.colors.text }]}>More Rides</Text>
              <Text style={[styles.reasonDesc, { color: theme.colors.textMuted }]}>Get more ride opportunities</Text>
            </View>
          </View>

          <View style={styles.reasonItem}>
            <View style={[styles.reasonIconWrapper, { backgroundColor: isDark ? '#064E3B' : '#ECFDF5' }]}>
              <Ionicons name="shield-checkmark" size={ms(24)} color="#10B981" />
            </View>
            <View style={styles.reasonTextContainer}>
              <Text style={[styles.reasonTitle, { color: theme.colors.text }]}>Stay Active</Text>
              <Text style={[styles.reasonDesc, { color: theme.colors.textMuted }]}>Go online and stay visible</Text>
            </View>
          </View>

          <View style={styles.reasonItem}>
            <View style={[styles.reasonIconWrapper, { backgroundColor: isDark ? '#78350F' : '#FFFBEB' }]}>
              <FontAwesome name="rupee" size={ms(20)} color="#F59E0B" />
            </View>
            <View style={styles.reasonTextContainer}>
              <Text style={[styles.reasonTitle, { color: theme.colors.text }]}>Higher Earnings</Text>
              <Text style={[styles.reasonDesc, { color: theme.colors.textMuted }]}>More trips, more earnings</Text>
            </View>
          </View>
        </View>

        {/* Secure Payments Card */}
        <View style={[styles.infoCard, { backgroundColor: theme.colors.card }]}>
          <View style={[styles.infoIconWrapper, { backgroundColor: '#3B82F6' }]}>
            <Ionicons name="lock-closed" size={ms(18)} color="#FFFFFF" />
          </View>
          <View style={[styles.infoTextContainer, { paddingRight: ms(80) }]}>
            <Text style={[styles.infoTitle, { color: theme.colors.text }]}>Secure Payments</Text>
            <Text style={[styles.infoDesc, { color: theme.colors.textMuted }]}>Your payment information is safe with us.</Text>
          </View>
          <Image 
            source={require('../../assets/images/bank.png')}
            style={styles.paymentLogos}
            resizeMode="contain"
          />
        </View>

        {/* Need Help Card */}
        <View style={[styles.infoCard, { backgroundColor: theme.colors.card, marginBottom: vs(40) }]}>
          <View style={[styles.infoIconWrapper, { backgroundColor: isDark ? '#1E3A8A' : '#EFF6FF' }]}>
            <Ionicons name="headset-outline" size={ms(20)} color="#2563EB" />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={[styles.infoTitle, { color: theme.colors.text }]}>Need Help?</Text>
            <Text style={[styles.infoDesc, { color: theme.colors.textMuted }]}>Our support team is here for you 24/7.</Text>
          </View>
          <TouchableOpacity 
            style={styles.contactButton}
            onPress={() => navigation.navigate('HelpCenterScreen')}
          >
            <Text style={styles.contactButtonText}>Contact Support</Text>
            <Ionicons name="chevron-forward" size={ms(14)} color="#2563EB" />
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    left: ms(10),
    padding: ms(10),
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  supportButton: {
    position: 'absolute',
    right: ms(12),
    padding: ms(8),
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  supportText: {
    fontSize: ms(14),
    fontWeight: '600',
    marginLeft: ms(4),
  },
  scrollContent: {
    paddingHorizontal: ms(16),
    alignItems: 'center',
  },
  heroImage: {
    width: ms(240),
    height: vs(140),
    marginBottom: vs(12),
  },
  title: {
    fontSize: ms(20),
    fontWeight: '800',
    marginBottom: vs(4),
    textAlign: 'center',
  },
  subtitle: {
    fontSize: ms(12),
    textAlign: 'center',
    lineHeight: ms(18),
    marginBottom: vs(16),
  },
  card: {
    width: '100%',
    borderRadius: ms(12),
    padding: ms(12),
    marginBottom: vs(16),
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: ms(14),
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: vs(12),
  },
  featuresRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  featureItem: {
    alignItems: 'center',
    flex: 1,
  },
  iconWrapper: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(16),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: vs(6),
  },
  featureText: {
    fontSize: ms(10),
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: ms(14),
  },
  verticalDivider: {
    width: 1,
    height: ms(32),
    backgroundColor: '#F3F4F6',
    marginTop: ms(8),
  },
  planContainer: {
    width: '100%',
    marginBottom: vs(16),
    marginTop: vs(4),
  },
  blueCard: {
    backgroundColor: '#F0F5FF',
    borderRadius: ms(12),
    padding: ms(12),
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  blueCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: vs(8),
  },
  dateImageContainer: {
    width: ms(80),
    height: ms(80),
    marginRight: ms(8),
  },
  dateImage: {
    width: '100%',
    height: '100%',
    marginLeft: -ms(10),
  },
  blueCardTextContainer: {
    flex: 1,
  },
  blueCardTitle: {
    fontSize: ms(14),
    fontWeight: '800',
    color: '#111827',
    marginBottom: vs(2),
  },
  blueCardDesc: {
    fontSize: ms(11),
    color: '#4B5563',
    lineHeight: ms(16),
    marginBottom: vs(8),
  },
  browseButton: {
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: vs(8),
    paddingHorizontal: ms(10),
    borderRadius: ms(8),
  },
  browseButtonText: {
    color: '#FFFFFF',
    fontSize: ms(12),
    fontWeight: '700',
    marginRight: ms(4),
  },
  cancelRenewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: vs(8),
  },
  cancelRenewText: {
    fontSize: ms(11),
    color: '#6B7280',
    marginLeft: ms(4),
  },
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: vs(16),
  },
  separatorLine: {
    flex: 1,
    height: 1,
  },
  separatorText: {
    marginHorizontal: ms(12),
    fontSize: ms(12),
    fontWeight: '600',
  },
  reasonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: vs(16),
  },
  reasonItem: {
    alignItems: 'center',
    flex: 1,
  },
  reasonIconWrapper: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(18),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: vs(6),
  },
  reasonTextContainer: {
    alignItems: 'center',
  },
  reasonTitle: {
    fontSize: ms(11),
    fontWeight: '700',
    marginBottom: vs(2),
    textAlign: 'center',
  },
  reasonDesc: {
    fontSize: ms(9),
    textAlign: 'center',
    lineHeight: ms(12),
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    padding: ms(12),
    borderRadius: ms(12),
    marginBottom: vs(10),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  infoIconWrapper: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(8),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: ms(10),
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: ms(13),
    fontWeight: '700',
    marginBottom: vs(2),
  },
  infoDesc: {
    fontSize: ms(10),
  },
  paymentLogos: {
    position: 'absolute',
    right: -ms(-6),
    top: -vs(24),
    width: ms(120),
    height: vs(90),
    opacity: 0.9,
  },
  contactButton: {
    backgroundColor: '#EFF6FF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: vs(6),
    paddingHorizontal: ms(12),
    borderRadius: ms(16),
  },
  contactButtonText: {
    color: '#2563EB',
    fontSize: ms(12),
    fontWeight: '600',
    marginRight: ms(2),
  },
});

export default SubscriptionRequiredScreen;
