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

const Page5 = () => {
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
          source={require('../../../assets/images/page5.png')}
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
        {t('ob_how_to_register')}
      </Animated.Text>

      {/* STEPS */}
      <Animated.View
        entering={FadeInDown.duration(600).delay(300)}
        style={styles.list}
      >
        <View style={styles.item}>
          <View style={styles.circle}>
            <Text style={styles.circleText}>1</Text>
          </View>
          <View style={styles.itemContent}>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.itemTitle}>{t('ob_step_personal')}</Text>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.itemSub}>
              {t('ob_step_personal_sub')}
            </Text>
          </View>
          <Icon name="user" size={mS(20)} color="#64B5F6" />
        </View>

        <View style={styles.item}>
          <View style={styles.circle}>
            <Text style={styles.circleText}>2</Text>
          </View>
          <View style={styles.itemContent}>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.itemTitle}>{t('ob_step_documents')}</Text>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.itemSub}>
              {t('ob_step_documents_sub')}
            </Text>
          </View>
          <Icon name="file-text" size={mS(20)} color="#64B5F6" />
        </View>

        <View style={styles.item}>
          <View style={styles.circle}>
            <Text style={styles.circleText}>3</Text>
          </View>
          <View style={styles.itemContent}>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.itemTitle}>{t('ob_step_verify')}</Text>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.itemSub}>
              {t('ob_step_verify_sub')}
            </Text>
          </View>
          <Icon name="check-circle" size={mS(20)} color="#64B5F6" />
        </View>

        <View style={styles.item}>
          <View style={styles.circle}>
            <Text style={styles.circleText}>4</Text>
          </View>
          <View style={styles.itemContent}>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.itemTitle}>{t('ob_step_accept')}</Text>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.itemSub}>
              {t('ob_step_accept_sub')}
            </Text>
          </View>
          <MCIcon
            name="car-outline"
            size={mS(20)}
            color="#64B5F6"
          />
        </View>
      </Animated.View>
    </ScrollView>
  );
};

export default Page5;

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

  /* TITLE */
  title: {
    fontSize: mS(22),
    fontWeight: '700',
    color: '#111827',
    marginTop: vS(2),
  },

  list: {
    width: '100%',
    marginTop: vS(10),
  },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: vS(6),
    paddingHorizontal: hS(16),
    borderRadius: mS(14),
    marginBottom: vS(5),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },

  circle: {
    width: mS(28),
    height: mS(28),
    borderRadius: mS(28),
    backgroundColor: '#81C784',
    justifyContent: 'center',
    alignItems: 'center',
  },

  circleText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: mS(12),
  },

  itemContent: {
    flex: 1,
    marginLeft: hS(12),
  },

  itemTitle: {
    fontSize: mS(13),
    fontWeight: '700',
    color: '#111827',
  },

  itemSub: {
    fontSize: mS(11),
    color: '#6B7280',
    marginTop: vS(2),
  },
});
