import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { hS, vS, mS } from '../../../lib/scale';
import { useTranslation } from 'react-i18next';

const Page3 = () => {
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
          source={require('../../../assets/images/page3.png')}
          style={styles.heroImage}
          resizeMode="contain"
        />
      </Animated.View>

      {/* CONTENT */}
      <View style={styles.content}>
        <Animated.Text
          entering={FadeInDown.duration(600).delay(200)}
          style={styles.title}
          adjustsFontSizeToFit
          numberOfLines={1}
        >
          {t('ob_recharge_plans')}
        </Animated.Text>

        <Animated.Text
          entering={FadeInDown.duration(600).delay(300)}
          style={styles.desc}
          adjustsFontSizeToFit
          numberOfLines={3}
        >
          {t('ob_recharge_plans_desc')}
        </Animated.Text>

        <Animated.View
          entering={FadeInDown.duration(600).delay(400)}
          style={styles.grid}
        >
          <View style={styles.card}>
            <MCIcon name="calendar-today" size={mS(20)} color="#64B5F6" />
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cardTitle}>{t('ob_daily_plans')}</Text>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cardSub}>{t('ob_flexible_options')}</Text>
          </View>

          <View style={styles.card}>
            <MCIcon name="shield-check" size={mS(20)} color="#64B5F6" />
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cardTitle}>{t('ob_no_hidden_fees')}</Text>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cardSub}>{t('ob_full_transparency')}</Text>
          </View>

          <View style={styles.card}>
            <MCIcon
              name="credit-card-outline"
              size={mS(20)}
              color="#64B5F6"
            />
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cardTitle}>{t('ob_easy_payment')}</Text>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cardSub}>{t('ob_multiple_methods')}</Text>
          </View>

          <View style={styles.card}>
            <MCIcon name="autorenew" size={mS(20)} color="#64B5F6" />
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cardTitle}>{t('ob_auto_renewal')}</Text>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cardSub}>{t('ob_never_miss_day')}</Text>
          </View>
        </Animated.View>

        {/* FOOTER TEXT */}
        <Animated.Text
          entering={FadeInDown.duration(600).delay(500)}
          style={styles.footerText}
        >
          {t('recharge_footer')}
        </Animated.Text>
      </View>
    </ScrollView>
  );
};

export default Page3;

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

  /* CONTENT */
  content: {
    flex: 1,
    alignItems: 'center',
  },

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
    marginTop: vS(8),
    lineHeight: mS(18),
  },

  /* GRID */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: vS(12),
  },

  card: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: mS(12),
    alignItems: 'center',
    paddingVertical: vS(4),
    marginBottom: vS(14),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },

  cardTitle: {
    marginTop: vS(4),
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
    marginTop: vS(2),
    paddingHorizontal: hS(10),
    lineHeight: mS(16),
    fontStyle: 'italic',
  },
});
