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

const Page6 = () => {
  const { t } = useTranslation();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {/* HERO */}
      <Animated.View
        entering={FadeInDown.duration(600).delay(100)}
        style={styles.heroWrapper}
      >
        <Image
          source={require('../../../assets/images/guied1.png')}
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
        {t('ob_important_guidelines')}
      </Animated.Text>
      <Animated.Text
        entering={FadeInDown.duration(600).delay(300)}
        style={styles.desc}
        adjustsFontSizeToFit
        numberOfLines={1}
      >
        {t('ob_important_guidelines_sub')}
      </Animated.Text>

      {/* GRID */}
      <Animated.View
        entering={FadeInDown.duration(600).delay(400)}
        style={styles.grid}
      >
        <View style={styles.card}>
          <Icon name="phone-call" size={mS(22)} color="#EF9A9A" />
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cardTitle}>{t('ob_emergency_support')}</Text>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cardSub}>{t('ob_emergency_support_sub')}</Text>
        </View>

        <View style={styles.card}>
          <MCIcon name="wallet-outline" size={mS(22)} color="#81C784" />
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cardTitle}>{t('ob_wallet_recharge')}</Text>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cardSub}>{t('ob_wallet_recharge_sub')}</Text>
        </View>

        <View style={styles.card}>
          <MCIcon name="headphones" size={mS(22)} color="#90CAF9" />
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cardTitle}>{t('ob_support_center')}</Text>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cardSub}>{t('ob_support_center_sub')}</Text>
        </View>

        <View style={styles.card}>
          <MCIcon name="shield-check" size={mS(22)} color="#A5D6A7" />
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cardTitle}>{t('ob_safety_features')}</Text>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cardSub}>{t('ob_safety_features_sub')}</Text>
        </View>

        <View style={styles.card}>
          <MCIcon
            name="alert-circle-outline"
            size={mS(22)}
            color="#FFF59D"
          />
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cardTitle}>{t('ob_issue_reporting')}</Text>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cardSub}>{t('ob_issue_reporting_sub')}</Text>
        </View>

        <View style={styles.card}>
          <MCIcon name="update" size={mS(22)} color="#81C784" />
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cardTitle}>{t('ob_app_updates')}</Text>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cardSub}>{t('ob_app_updates_sub')}</Text>
        </View>
      </Animated.View>

      {/* FOOTER TEXT */}
      <Animated.Text
        entering={FadeInDown.duration(600).delay(500)}
        style={styles.footerText}
      >
        {t('guidelines_footer')}
      </Animated.Text>
    </ScrollView>
  );
};

export default Page6;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: hS(20),
    paddingBottom: vS(20),
  },

  /* HERO */
  heroWrapper: {
    width: '100%',
    alignItems: 'center',
    marginVertical: vS(8),
  },

  heroImage: {
    width: '100%',
    height: vS(160),
  },

  /* TITLE */
  title: {
    fontSize: mS(18),
    fontWeight: '700',
    color: '#111827',
    marginTop: vS(1),
  },

  desc: {
    fontSize: mS(12),
    color: '#4B5563',
    marginTop: vS(1),
    textAlign: 'center',
  },

  /* GRID */
  grid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: vS(4),
  },

  card: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: mS(12),
    paddingVertical: vS(4),
    paddingHorizontal: hS(4),
    alignItems: 'center',
    marginBottom: vS(6),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },

  cardTitle: {
    fontSize: mS(12),
    color: '#111827',
    fontWeight: '700',
    marginTop: vS(1),
    textAlign: 'center',
  },

  cardSub: {
    fontSize: mS(9),
    textAlign: 'center',
    color: '#6B7280',
    marginTop: vS(1),
  },
  footerText: {
    fontSize: mS(11),
    color: '#6B7280',
    textAlign: 'center',
    marginTop: vS(12),
    paddingHorizontal: hS(10),
    lineHeight: mS(16),
    fontStyle: 'italic',
  },
});
