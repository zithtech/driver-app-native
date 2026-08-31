import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Text from '../../Components/Text';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { Dashboard_Nav, HelpCenter_Nav } from '../../Navigations/navigations';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import { isTamilLanguage } from '../../utils/languageSizings';

const { width } = Dimensions.get('window');

const VerificationSuccessScreen = () => {
  const { t } = useTranslation();
  const { theme, isDark } = useAppTheme();
  const fonts = theme.fonts as any; // Cast to any to avoid type complaints if fonts typing isn't fully robust, though theme.fonts should be fine. Actually let's just do `theme.fonts`.
  const navigation = useNavigation<any>();
  const isTamil = isTamilLanguage();

  const user = useSelector((state: RootState) => state.userSlice.user);

  const docsList = Array.isArray(user?.documents_data) && user.documents_data.length > 0 
    ? user.documents_data.filter((doc: any) => {
        const status = doc.status || doc.license_status || doc.licenseStatus || '';
        return status === 'verified' || status === 'approved' || status === 'uploaded' || status === 'pending';
      })
    : [
        { document_type: 'aadhaar_card', status: 'verified' },
        { document_type: 'driving_license', status: 'verified' },
      ];

  const getDocDetails = (type: string, trans: any) => {
    switch(type) {
      case 'aadhaar_card': return { title: trans('aadhar_card', 'Aadhaar Card'), icon: 'card-outline' };
      case 'driving_license': return { title: trans('driving_license', 'Driving License'), icon: 'car-sport-outline' };
      case 'pan_card': return { title: trans('pan_card', 'PAN Card'), icon: 'card-outline' };
      case 'police_verification': return { title: trans('police_verification', 'Police Verification'), icon: 'shield-checkmark-outline' };
      case 'profile_selfie': return { title: trans('profile_selfie', 'Profile Selfie'), icon: 'person-outline' };
      default: return { title: type ? type.replace(/_/g, ' ') : 'Document', icon: 'document-outline' };
    }
  };

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

          {docsList.map((doc: any, index: number) => {
            const { title, icon } = getDocDetails(doc.document_type || doc.documentType, t);
            const isLast = index === docsList.length - 1;
            const status = doc.status || doc.license_status || doc.licenseStatus || 'verified';
            const isVerified = status === 'verified' || status === 'approved';
            
            return (
              <View key={index} style={[styles.docRow, isLast && { borderBottomWidth: 0 }]}>
                <View style={[styles.docIconBg, { backgroundColor: isDark ? '#374151' : (isVerified ? '#F0FDF4' : '#FFFBEB') }]}>
                  <Ionicons name={icon} size={20} color={isVerified ? "#10B981" : "#F59E0B"} />
                </View>
                <View style={styles.docTextCol}>
                  <Text style={[fonts.medium, styles.docTitle, { color: theme.colors.text }]}>
                    {title}
                  </Text>
                  <Text style={[styles.docStatus, { color: isVerified ? '#10B981' : '#F59E0B' }]}>
                    {isVerified ? t('verified', 'Verified') : t('uploaded', 'Uploaded')}
                  </Text>
                </View>
                <Ionicons name={isVerified ? "checkmark-circle" : "time-outline"} size={24} color={isVerified ? "#10B981" : "#F59E0B"} />
              </View>
            );
          })}
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
          <Image source={isDark ? require('../../assets/images/dashboraddarkcar.png') : require('../../assets/images/dashboradcar.png')} style={styles.allSetImage} resizeMode="contain" />
        </Animated.View>

        {/* QUICK INFO GRID */}
        <Animated.View entering={FadeInDown.duration(800).delay(300)} style={[styles.card, { backgroundColor: theme.colors.card, flexDirection: 'row', padding: 16 }]}>
          
          <View style={styles.infoCol}>
            <View style={[styles.infoIconBg, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
              <Ionicons name="time-outline" size={20} color="#10B981" />
            </View>
            <Text style={[fonts.bold, styles.infoTitle, { color: theme.colors.text, fontSize: isTamil ? 10 : 12 }]} numberOfLines={1} adjustsFontSizeToFit>{t('go_online', 'Go Online')}</Text>
            <Text style={[styles.infoSub, { color: isDark ? '#9CA3AF' : '#6B7280', fontSize: isTamil ? 8 : 10 }]} numberOfLines={1} adjustsFontSizeToFit>{t('start_accepting', 'Start accepting')}</Text>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoCol}>
            <View style={[styles.infoIconBg, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
              <Ionicons name="wallet-outline" size={20} color="#10B981" />
            </View>
            <Text style={[fonts.bold, styles.infoTitle, { color: theme.colors.text, fontSize: isTamil ? 10 : 12 }]} numberOfLines={1} adjustsFontSizeToFit>{t('earn_more', 'Earn More')}</Text>
            <Text style={[styles.infoSub, { color: isDark ? '#9CA3AF' : '#6B7280', fontSize: isTamil ? 8 : 10 }]} numberOfLines={1} adjustsFontSizeToFit>{t('complete_rides', 'Complete rides')}</Text>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoCol}>
            <View style={[styles.infoIconBg, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#10B981" />
            </View>
            <Text style={[fonts.bold, styles.infoTitle, { color: theme.colors.text, fontSize: isTamil ? 10 : 12 }]} numberOfLines={1} adjustsFontSizeToFit>{t('stay_safe', 'Stay Safe')}</Text>
            <Text style={[styles.infoSub, { color: isDark ? '#9CA3AF' : '#6B7280', fontSize: isTamil ? 8 : 10 }]} numberOfLines={1} adjustsFontSizeToFit>{t('safety_first', 'Your safety is first')}</Text>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoCol}>
            <View style={[styles.infoIconBg, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
              <Ionicons name="headset-outline" size={20} color="#10B981" />
            </View>
            <Text style={[fonts.bold, styles.infoTitle, { color: theme.colors.text, fontSize: isTamil ? 10 : 12 }]} numberOfLines={1} adjustsFontSizeToFit>{t('24_7_support', '24/7 Support')}</Text>
            <Text style={[styles.infoSub, { color: isDark ? '#9CA3AF' : '#6B7280', fontSize: isTamil ? 8 : 10 }]} numberOfLines={1} adjustsFontSizeToFit>{t('here_to_help', "We're here to help")}</Text>
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
          <Text style={[fonts.bold, styles.actionBtnText, { fontSize: isTamil ? 14 : 16 }]}>{t('go_to_dashboard', 'Go to Dashboard')}</Text>
          <Ionicons name="arrow-forward" size={22} color="#FFF" style={{ position: 'absolute', right: 20 }} />
        </TouchableOpacity>
        <Text style={[styles.bottomTagline, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>{t('start_journey', 'Start your journey with us!')}</Text>
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
    paddingBottom: 20,
  },
  heroSection: {
    alignItems: 'center',
    marginTop: 0,
    marginBottom: 8,
  },
  heroImage: {
    width: width * 0.35,
    height: width * 0.25,
  },
  congratsText: {
    fontSize: 20,
    marginTop: 4,
    marginBottom: 4,
  },
  congratsSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  card: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
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
    fontSize: 14,
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
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(156, 163, 175, 0.2)',
  },
  docIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  docTextCol: {
    flex: 1,
  },
  docTitle: {
    fontSize: 14,
    marginBottom: 2,
  },
  docStatus: {
    fontSize: 13,
    fontWeight: '600',
  },
  allSetCard: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    marginBottom: 10,
    overflow: 'hidden',
  },
  allSetTextCol: {
    flex: 1,
    zIndex: 2,
  },
  allSetTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  allSetSub: {
    fontSize: 12,
    lineHeight: 18,
    paddingRight: 10,
  },
  allSetImage: {
    width: 90,
    height: 60,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
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
    height: 30,
    backgroundColor: 'rgba(156, 163, 175, 0.2)',
    alignSelf: 'center',
  },
  bottomSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(156, 163, 175, 0.1)',
  },
  actionBtn: {
    flexDirection: 'row',
    backgroundColor: '#10B981', // Green for success
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
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
