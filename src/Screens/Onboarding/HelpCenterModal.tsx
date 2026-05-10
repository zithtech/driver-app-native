import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useHaptic } from '../../hooks/useHaptic';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { mS, vS, hS } from '../../lib/scale';

/* ================= COMPONENT ================= */

const FaqItem = ({ item, isExpanded, onPress, searchQuery }: any) => {
  const { colors, fonts }: any = useTheme();
  const [contentHeight, setContentHeight] = useState(0);
  const { triggerHaptic } = useHaptic();

  const animatedBodyStyle = useAnimatedStyle(() => ({
    height: withTiming(isExpanded ? contentHeight : 0, { duration: 300 }),
    opacity: withTiming(isExpanded ? 1 : 0, { duration: 250 }),
  }));

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(isExpanded ? '180deg' : '0deg') }],
  }));

  const highlightText = (text: string, query: string) => {
    if (!query || !query.trim()) {
      return <Text>{text}</Text>;
    }
    try {
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapedQuery})`, 'gi');
      const parts = text.split(regex);
      return parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <Text key={i} style={[styles.highlightText, { color: colors.primary }]}>
            {part}
          </Text>
        ) : (
          <Text key={i} style={{ color: colors.text }}>{part}</Text>
        )
      );
    } catch (e) {
      return <Text>{text}</Text>;
    }
  };

  return (
    <View style={styles.faqRowContainer}>
      <TouchableOpacity
        style={styles.faqHeader}
        activeOpacity={0.7}
        onPress={() => {
          triggerHaptic(HapticFeedbackTypes.impactLight);
          onPress();
        }}
      >
        <Text style={[styles.faqQuestion, { color: colors.text, ...fonts.medium }, isExpanded && { color: colors.primary }]}>
          {highlightText(item.q, searchQuery)}
        </Text>
        <Animated.View style={arrowStyle}>
          <Ionicons
            name="chevron-down"
            size={mS(14)}
            color={isExpanded ? colors.primary : colors.text}
          />
        </Animated.View>
      </TouchableOpacity>

      <Animated.View style={[animatedBodyStyle, styles.faqAnswerContainer]}>
        <View
          style={styles.faqAnswerWrapper}
          onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}
        >
          <Text style={[styles.faqAnswer, { color: colors.text, opacity: 0.7, ...fonts.regular }]}>
            {highlightText(item.a, searchQuery)}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
};

const HelpCenterModal = ({ visible, onClose }: any) => {
  const { colors, fonts, dark }: any = useTheme();
  const { t } = useTranslation();
  const { triggerHaptic } = useHaptic();
  const insets = useSafeAreaInsets();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['60%', '95%'], []);

  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const FAQS = useMemo(() => [
    { q: t('faq_reg_1_q'), a: t('faq_reg_1_a') },
    { q: t('faq_reg_2_q'), a: t('faq_reg_2_a') },
    { q: t('faq_reg_3_q'), a: t('faq_reg_3_a') },
    { q: t('faq_reg_4_q'), a: t('faq_reg_4_a') },
    { q: t('faq_earn_1_q'), a: t('faq_earn_1_a') },
    { q: t('faq_earn_2_q'), a: t('faq_earn_2_a') },
    { q: t('faq_earn_3_q'), a: t('faq_earn_3_a') },
    { q: t('faq_earn_4_q'), a: t('faq_earn_4_a') },
    { q: t('faq_drive_1_q'), a: t('faq_drive_1_a') },
    { q: t('faq_drive_2_q'), a: t('faq_drive_2_a') },
    { q: t('faq_drive_3_q'), a: t('faq_drive_3_a') },
    { q: t('faq_drive_4_q'), a: t('faq_drive_4_a') },
    { q: t('faq_app_1_q'), a: t('faq_app_1_a') },
    { q: t('faq_app_2_q'), a: t('faq_app_2_a') },
  ], [t]);

  const filteredFaqs = useMemo(() => {
    return FAQS.filter((item) => {
      const qText = search.trim().toLowerCase();
      return !qText || item.q.toLowerCase().includes(qText) || item.a.toLowerCase().includes(qText);
    });
  }, [search, FAQS]);

  useEffect(() => {
    if (visible) bottomSheetModalRef.current?.present();
    else bottomSheetModalRef.current?.dismiss();
  }, [visible]);

  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) onClose();
  }, [onClose]);

  const renderBackdrop = useCallback((props: any) => (
    <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.3} />
  ), []);

  const supportOptions = [
    { label: 'Call', icon: 'call', color: colors.primary, action: () => Linking.openURL('tel:+919043522612') },
    { label: 'WhatsApp', icon: 'logo-whatsapp', color: '#25D366', action: () => Linking.openURL('https://wa.me/919043522612') },
    { label: 'Gmail', icon: 'mail', color: '#EA4335', action: () => Linking.openURL('mailto:support@vdrive.com') },
  ];

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      index={0}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.background, borderRadius: mS(16) }}
      handleIndicatorStyle={{ backgroundColor: colors.border, width: mS(25), height: vS(3) }}
    >
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: colors.text, ...fonts.bold }]}>{t('help_center', 'Help Center')}</Text>
          <TouchableOpacity onPress={() => bottomSheetModalRef.current?.dismiss()}>
            <Ionicons name="close" size={mS(20)} color={colors.text} style={{ opacity: 0.4 }} />
          </TouchableOpacity>
        </View>

        <View style={[styles.searchBar, { backgroundColor: dark ? colors.card : '#F3F4F6' }]}>
          <Ionicons name="search" size={mS(14)} color={colors.text} style={{ opacity: 0.4 }} />
          <BottomSheetTextInput
            placeholder={t('search_help', 'Search...')}
            value={search}
            onChangeText={setSearch}
            style={[styles.searchInput, { color: colors.text, ...fonts.medium }]}
            placeholderTextColor={dark ? '#555' : '#AAA'}
          />
        </View>

        <BottomSheetScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: vS(10) }}>
          <View style={styles.faqSection}>
            {filteredFaqs.map((item, index) => (
              <FaqItem key={index} item={item} searchQuery={search} isExpanded={openIndex === index} onPress={() => setOpenIndex(openIndex === index ? null : index)} />
            ))}
          </View>
        </BottomSheetScrollView>

        <View style={[styles.supportFooter, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, vS(12)) }]}>
          {supportOptions.map((opt, i) => (
            <TouchableOpacity 
              key={i} 
              style={[styles.supportItem, { backgroundColor: opt.color + '10' }]} 
              onPress={() => { triggerHaptic(HapticFeedbackTypes.impactLight); opt.action(); }}
            >
              <View style={[styles.iconCircle, { backgroundColor: opt.color }]}>
                <Ionicons name={opt.icon} size={mS(14)} color="#FFF" />
              </View>
              <Text style={[styles.supportText, { color: colors.text, ...fonts.bold }]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: hS(12) },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: vS(6) },
  headerTitle: { fontSize: mS(16) },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: mS(8), paddingHorizontal: hS(10), height: vS(32), marginBottom: vS(8) },
  searchInput: { flex: 1, marginLeft: hS(6), fontSize: mS(13), paddingVertical: 0 },
  faqSection: { marginTop: vS(2) },
  faqRowContainer: { borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.05)' },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: vS(10) },
  faqQuestion: { fontSize: mS(13), flex: 1, paddingRight: hS(8) },
  faqAnswerContainer: { overflow: 'hidden' },
  faqAnswerWrapper: { position: 'absolute', width: '100%', paddingBottom: vS(10) },
  faqAnswer: { fontSize: mS(12), lineHeight: vS(16) },
  supportFooter: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingVertical: vS(12), 
    paddingHorizontal: hS(12),
    borderTopWidth: 1,
  },
  supportItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: hS(10), 
    paddingVertical: vS(6),
    borderRadius: mS(20),
    flex: 1,
    marginHorizontal: hS(4),
    justifyContent: 'center',
  },
  iconCircle: {
    width: mS(22),
    height: mS(22),
    borderRadius: mS(11),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: hS(6),
  },
  supportText: { fontSize: mS(10) },
  highlightText: { fontWeight: '700' },
});

export default HelpCenterModal;
