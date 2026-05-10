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

const Page1 = () => {
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
          source={require('../../../assets/images/page1.png')}
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
        {t('ob_about_vdrive')}
      </Animated.Text>

      {/* DESCRIPTION */}
      <Animated.Text
        entering={FadeInDown.duration(600).delay(300)}
        style={styles.desc}
        adjustsFontSizeToFit
        numberOfLines={3}
      >
        {t('ob_about_vdrive_desc')}
      </Animated.Text>

      {/* ICON ROW */}
      <Animated.View
        entering={FadeInDown.duration(600).delay(400)}
        style={styles.row}
      >
        <View style={styles.iconBox}>
          <Icon name="cpu" size={mS(22)} color="#64B5F6" />
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.iconLabel}>{t('ob_tech_driven')}</Text>
        </View>

        <View style={styles.iconBox}>
          <MCIcon name="shield-check" size={mS(22)} color="#64B5F6" />
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.iconLabel}>{t('ob_safe_secure')}</Text>
        </View>

        <View style={styles.iconBox}>
          <MCIcon name="map-marker-radius" size={mS(22)} color="#64B5F6" />
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.iconLabel}>{t('ob_wide_coverage')}</Text>
        </View>
      </Animated.View>

      {/* PAGE 2 STYLE CARDS */}
      <Animated.View
        entering={FadeInDown.duration(600).delay(500)}
        style={styles.grid}
      >
        <View style={styles.card}>
          <Text style={styles.cardValue}>{t('stat_active_drivers')}</Text>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cardText}>{t('ob_active_drivers')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardValue}>{t('stat_support')}</Text>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cardText}>{t('ob_driver_support')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardValue}>{t('stat_payouts')}</Text>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cardText}>{t('ob_payouts')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardValue}>{t('stat_transparency')}</Text>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.cardText}>{t('ob_transparency')}</Text>
        </View>
      </Animated.View>

      {/* FOOTER TEXT */}
      <Animated.Text
        entering={FadeInDown.duration(600).delay(600)}
        style={styles.footerText}
      >
        {t('about_footer')}
      </Animated.Text>
    </ScrollView>
  );
};

export default Page1;

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
    marginTop: vS(8),
  },

  desc: {
    marginTop: vS(8),
    fontSize: mS(12),
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: mS(18),
  },

  /* ICON ROW */
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: vS(12),
  },

  iconBox: {
    alignItems: 'center',
    flex: 1,
  },

  iconLabel: {
    fontSize: mS(10),
    marginTop: vS(2),
    color: '#6B7280',
  },

  /* GRID */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: vS(10),
  },

  card: {
    width: '48%',
    height: vS(50),
    backgroundColor: '#FFFFFF',
    borderRadius: mS(12),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vS(8),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },

  cardValue: {
    fontSize: mS(14),
    fontWeight: '700',
    color: '#111827',
  },

  cardText: {
    marginTop: vS(2),
    fontSize: mS(9),
    color: '#6B7280',
    fontWeight: '600',
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
