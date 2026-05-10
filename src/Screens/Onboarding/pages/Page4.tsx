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

const Page4 = () => {
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
          source={require('../../../assets/images/page4.png')}
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
        {t('ob_rules_regulations')}
      </Animated.Text>

      {/* RULES DESCRIPTION / FOOTER */}
      <Animated.Text
        entering={FadeInDown.duration(600).delay(250)}
        style={styles.footerText}
      >
        {t('rules_footer')}
      </Animated.Text>

      {/* RULE LIST */}
      <Animated.View
        entering={FadeInDown.duration(600).delay(300)}
        style={styles.list}
      >
        <View style={styles.item}>
          <MCIcon
            name="alert-circle-outline"
            size={mS(20)}
            color="#FFD54F"
          />
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.itemText}>{t('ob_rule_traffic')}</Text>
          <Icon
            name="check-circle"
            size={mS(18)}
            color="#81C784"
          />
        </View>

        <View style={styles.item}>
          <MCIcon
            name="account-check-outline"
            size={mS(20)}
            color="#64B5F6"
          />
          <Text adjustsFontSizeToFit numberOfLines={2} style={styles.itemText}>
            {t('ob_rule_professional')}
          </Text>
          <Icon
            name="check-circle"
            size={mS(18)}
            color="#81C784"
          />
        </View>

        <View style={styles.item}>
          <MCIcon
            name="file-document-outline"
            size={mS(20)}
            color="#64B5F6"
          />
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.itemText}>
            {t('ob_rule_documents')}
          </Text>
          <Icon
            name="check-circle"
            size={mS(18)}
            color="#81C784"
          />
        </View>

        <View style={styles.item}>
          <MCIcon
            name="car-outline"
            size={mS(20)}
            color="#64B5F6"
          />
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.itemText}>
            {t('ob_rule_safe_drive')}
          </Text>
          <Icon
            name="check-circle"
            size={mS(18)}
            color="#81C784"
          />
        </View>
      </Animated.View>

    </ScrollView>
  );
};

export default Page4;

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

  title: {
    fontSize: mS(18),
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginTop: vS(1),
  },

  list: {
    width: '100%',
    marginTop: vS(12),
  },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: vS(8),
    paddingHorizontal: hS(12),
    borderRadius: mS(12),
    marginBottom: vS(8),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },

  itemText: {
    flex: 1,
    marginHorizontal: hS(8),
    fontSize: mS(12),
    color: '#4B5563',
    fontWeight: '500',
  },
  footerText: {
    fontSize: mS(11),
    color: '#6B7280',
    textAlign: 'center',
    marginTop: vS(4),
    paddingHorizontal: hS(10),
    lineHeight: mS(15),
    marginBottom: vS(8),
  },
});
