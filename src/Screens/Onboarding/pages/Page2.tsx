import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Feather';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { hS, vS, mS } from '../../../lib/scale';
import { useTranslation } from 'react-i18next';

const Page2 = () => {
  const { t } = useTranslation();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {/* IMAGE */}
      <Animated.View
        entering={FadeInDown.duration(600).delay(100)}
        style={styles.imageWrapper}
      >
        <Image
          source={require('../../../assets/images/page2.png')}
          style={styles.heroImage}
          resizeMode="contain"
        />
      </Animated.View>

      {/* TITLE */}
      <Animated.Text
        entering={FadeInDown.duration(600).delay(200)}
        style={styles.title}
        adjustsFontSizeToFit
        numberOfLines={1}
      >
        {t('ob_how_app_helps')}
      </Animated.Text>

      {/* DESCRIPTION */}
      <Animated.Text
        entering={FadeInDown.duration(600).delay(300)}
        style={styles.desc}
        adjustsFontSizeToFit
        numberOfLines={3}
      >
        {t('ob_how_app_helps_desc')}
      </Animated.Text>

      {/* FEATURES */}
      <Animated.View
        entering={FadeInDown.duration(600).delay(400)}
        style={styles.grid}
      >
        <View style={styles.card}>
          <Icon name="check-circle" size={mS(22)} color="#64B5F6" />
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cardTitle}>{t('ob_accept_rides')}</Text>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cardSub}>{t('ob_instant_requests')}</Text>
        </View>

        <View style={styles.card}>
          <Icon name="trending-up" size={mS(22)} color="#64B5F6" />
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cardTitle}>{t('ob_track_trips')}</Text>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cardSub}>{t('ob_live_monitoring')}</Text>
        </View>

        <View style={styles.card}>
          <MCIcon name="cash" size={mS(22)} color="#64B5F6" />
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cardTitle}>{t('ob_view_earnings')}</Text>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cardSub}>{t('ob_daily_weekly')}</Text>
        </View>

        <View style={styles.card}>
          <MCIcon name="calendar-check" size={mS(22)} color="#64B5F6" />
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cardTitle}>{t('ob_manage_bookings')}</Text>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cardSub}>{t('ob_all_rides_one')}</Text>
        </View>
      </Animated.View>

      {/* FOOTER TEXT */}
      <Animated.Text
        entering={FadeInDown.duration(600).delay(500)}
        style={styles.footerText}
      >
        {t('app_helps_footer')}
      </Animated.Text>
    </ScrollView>
  );
};

export default Page2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: hS(20),
    paddingBottom: vS(20),
  },

  /* IMAGE */
  imageWrapper: {
    width: '100%',
    alignItems: 'center',
    marginTop: vS(2),
  },

  heroImage: {
    width: '100%',
    height: vS(200),
  },

  /* TEXT */
  title: {
    fontSize: mS(18),
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginTop: vS(2),
  },

  desc: {
    textAlign: 'center',
    fontSize: mS(12),
    color: '#4B5563',
    marginTop: vS(12),
    lineHeight: mS(18),
  },

  /* GRID */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: vS(14),
  },

  card: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: mS(14),
    alignItems: 'center',
    paddingVertical: vS(6),
    marginBottom: vS(16),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },

  cardTitle: {
    marginTop: vS(2),
    fontSize: mS(12),
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },

  cardSub: {
    fontSize: mS(9),
    color: '#6B7280',
    marginTop: vS(1),
    textAlign: 'center',
  },
  footerText: {
    fontSize: mS(11),
    color: '#6B7280',
    textAlign: 'center',
    marginTop: vS(8),
    paddingHorizontal: hS(10),
    lineHeight: mS(16),
    fontStyle: 'italic',
  },
});
