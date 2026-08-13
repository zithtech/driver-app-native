import React from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Image, Dimensions } from 'react-native';
import Text from '../../Components/Text';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { Dashboard_Nav, HelpCenter_Nav } from '../../Navigations/navigations';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const VerificationSuccessScreen = () => {
  const { t } = useTranslation();
  const { theme, isDark } = useAppTheme();
  const fonts = theme.fonts as any; // Cast to any to avoid type complaints if fonts typing isn't fully robust, though theme.fonts should be fine. Actually let's just do `theme.fonts`.
  const navigation = useNavigation<any>();

  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[fonts.bold, styles.headerTitle, { color: theme.colors.text }]}>
          {t('verification_successful', 'Verification Successful')}
        </Text>
        <TouchableOpacity style={[styles.headerBtn, styles.supportBtn]} onPress={() => navigation.navigate(HelpCenter_Nav)}>
          <Ionicons name="headset-outline" size={20} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* HERO SECTION */}
        <Animated.View entering={FadeIn.duration(800)} style={styles.heroSection}>
          <Image 
            source={require('../../assets/images/verified.png')} 
            style={styles.heroImage} 
            resizeMode="contain" 
          />
          <Text style={[fonts.bold, styles.congratsText, { color: theme.colors.text }]}>
            {t('congratulations', 'Congratulations!')}
          </Text>
          <Text style={[styles.congratsSubtext, { color: isDark ? '#9CA3AF' : '#4B5563' }]}>
            {t('verified_desc_1', 'Your documents have been verified successfully.')}
            {'\n'}
            {t('verified_desc_2', 'You are now ready to start accepting rides.')}
          </Text>
        </Animated.View>

        {/* VERIFICATION SUMMARY */}
        <Animated.View entering={FadeInDown.duration(800).delay(100)} style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <View style={styles.cardHeader}>
            <Text style={[fonts.bold, styles.cardTitle, { color: theme.colors.text }]}>
              {t('verification_summary', 'Verification Summary')}
            </Text>
            <View style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={14} color={isDark ? '#9CA3AF' : '#6B7280'} />
              <Text style={[styles.dateText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                {t('verified_on', 'Verified on')} {today}
              </Text>
            </View>
          </View>
          
          <View style={styles.divider} />

          {/* Doc 1 */}
          <View style={styles.docRow}>
            <View style={[styles.docIconBg, { backgroundColor: isDark ? '#374151' : '#F0FDF4' }]}>
              <Ionicons name="card-outline" size={20} color="#10B981" />
            </View>
            <View style={styles.docTextCol}>
              <Text style={[fonts.medium, styles.docTitle, { color: theme.colors.text }]}>Aadhaar Card</Text>
              <Text style={[styles.docStatus, { color: '#10B981' }]}>Verified</Text>
            </View>
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
          </View>

          {/* Doc 2 */}
          <View style={styles.docRow}>
            <View style={[styles.docIconBg, { backgroundColor: isDark ? '#374151' : '#F0FDF4' }]}>
              <Ionicons name="car-sport-outline" size={20} color="#10B981" />
            </View>
            <View style={styles.docTextCol}>
              <Text style={[fonts.medium, styles.docTitle, { color: theme.colors.text }]}>Driving License</Text>
              <Text style={[styles.docStatus, { color: '#10B981' }]}>Verified</Text>
            </View>
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
          </View>

          {/* Doc 3 */}
          <View style={[styles.docRow, { borderBottomWidth: 0 }]}>
            <View style={[styles.docIconBg, { backgroundColor: isDark ? '#374151' : '#F0FDF4' }]}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#10B981" />
            </View>
            <View style={styles.docTextCol}>
              <Text style={[fonts.medium, styles.docTitle, { color: theme.colors.text }]}>
                Police Verification <Text style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>(Optional)</Text>
              </Text>
              <Text style={[styles.docStatus, { color: '#10B981' }]}>Verified</Text>
            </View>
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
          </View>
        </Animated.View>

        {/* ALL SET BANNER */}
        <Animated.View entering={FadeInDown.duration(800).delay(200)} style={[styles.allSetCard, { backgroundColor: isDark ? '#064E3B' : '#F0FDF4' }]}>
          <View style={styles.allSetTextCol}>
            <Text style={[fonts.bold, styles.allSetTitle, { color: isDark ? '#D1FAE5' : '#065F46' }]}>
              {t('you_are_all_set', 'You are all set!')}
            </Text>
            <Text style={[styles.allSetSub, { color: isDark ? '#A7F3D0' : '#047857' }]}>
              {t('all_set_desc', 'You can now go online and start receiving ride requests.')}
            </Text>
          </View>
          <Image source={require('../../assets/images/car.png')} style={styles.allSetImage} resizeMode="contain" />
        </Animated.View>

        {/* QUICK INFO GRID */}
        <Animated.View entering={FadeInDown.duration(800).delay(300)} style={[styles.card, { backgroundColor: theme.colors.card, flexDirection: 'row', padding: 16 }]}>
          
          <View style={styles.infoCol}>
            <View style={[styles.infoIconBg, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
              <Ionicons name="time-outline" size={20} color="#10B981" />
            </View>
            <Text style={[fonts.bold, styles.infoTitle, { color: theme.colors.text }]}>Go Online</Text>
            <Text style={[styles.infoSub, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Start accepting</Text>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoCol}>
            <View style={[styles.infoIconBg, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
              <Ionicons name="wallet-outline" size={20} color="#10B981" />
            </View>
            <Text style={[fonts.bold, styles.infoTitle, { color: theme.colors.text }]}>Earn More</Text>
            <Text style={[styles.infoSub, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Complete rides</Text>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoCol}>
            <View style={[styles.infoIconBg, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#10B981" />
            </View>
            <Text style={[fonts.bold, styles.infoTitle, { color: theme.colors.text }]}>Stay Safe</Text>
            <Text style={[styles.infoSub, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Your safety is first</Text>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoCol}>
            <View style={[styles.infoIconBg, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
              <Ionicons name="headset-outline" size={20} color="#10B981" />
            </View>
            <Text style={[fonts.bold, styles.infoTitle, { color: theme.colors.text }]}>24/7 Support</Text>
            <Text style={[styles.infoSub, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>We're here to help</Text>
          </View>

        </Animated.View>

      </ScrollView>

      {/* BOTTOM ACTION */}
      <View style={[styles.bottomSection, { backgroundColor: theme.colors.background }]}>
        <TouchableOpacity 
          style={styles.actionBtn} 
          activeOpacity={0.8}
          onPress={() => navigation.reset({
            index: 0,
            routes: [{ name: Dashboard_Nav }],
          })}
        >
          <Ionicons name="speedometer-outline" size={22} color="#FFF" style={{ position: 'absolute', left: 20 }} />
          <Text style={[fonts.bold, styles.actionBtnText]}>Go to Dashboard</Text>
          <Ionicons name="arrow-forward" size={22} color="#FFF" style={{ position: 'absolute', right: 20 }} />
        </TouchableOpacity>
        <Text style={[styles.bottomTagline, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Start your journey with us!</Text>
      </View>
    </SafeAreaView>
  );
};

export default VerificationSuccessScreen;

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
  headerBtn: {
    padding: 4,
  },
  supportBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(156, 163, 175, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 24,
  },
  heroImage: {
    width: width * 0.6,
    height: width * 0.5,
  },
  congratsText: {
    fontSize: 24,
    marginTop: 12,
    marginBottom: 8,
  },
  congratsSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    marginLeft: 4,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(156, 163, 175, 0.2)',
    marginBottom: 16,
    marginHorizontal: -16,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(156, 163, 175, 0.2)',
  },
  docIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  docTextCol: {
    flex: 1,
  },
  docTitle: {
    fontSize: 15,
    marginBottom: 2,
  },
  docStatus: {
    fontSize: 13,
    fontWeight: '600',
  },
  allSetCard: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  allSetTextCol: {
    flex: 1,
    zIndex: 2,
  },
  allSetTitle: {
    fontSize: 18,
    marginBottom: 6,
  },
  allSetSub: {
    fontSize: 13,
    lineHeight: 20,
    paddingRight: 10,
  },
  allSetImage: {
    width: 120,
    height: 80,
    position: 'absolute',
    right: -10,
    bottom: 0,
    opacity: 0.9,
  },
  infoCol: {
    flex: 1,
    alignItems: 'center',
  },
  infoIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
  },
  infoSub: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
  },
  infoDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(156, 163, 175, 0.2)',
    alignSelf: 'center',
  },
  bottomSection: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: 'rgba(156, 163, 175, 0.1)',
  },
  actionBtn: {
    flexDirection: 'row',
    backgroundColor: '#10B981', // Green for success
    height: 54,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 16,
  },
  bottomTagline: {
    textAlign: 'center',
    fontSize: 13,
  },
});
