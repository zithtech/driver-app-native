import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  ScrollView,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetFooter,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useHaptic } from '../../hooks/useHaptic';
import Animated, {
  useAnimatedStyle,
  withTiming,
  FadeIn,
} from 'react-native-reanimated';

import { useTheme } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

/* ================= FAQ DATA ================= */

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
      // Escape special regex characters to avoid crashes
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
            size={20}
            color={isExpanded ? colors.primary : colors.text}
          />
        </Animated.View>
      </TouchableOpacity>

      <Animated.View style={[animatedBodyStyle, styles.faqAnswerContainer]}>
        <View
          style={styles.faqAnswerWrapper}
          onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}
        >
          <Text style={[styles.faqAnswer, { color: colors.text, opacity: 0.8, ...fonts.regular }]}>
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
  const snapPoints = useMemo(() => ['60%', '90%'], []);

  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('cat_all');

  const CATEGORIES = useMemo(() => [
    { key: 'cat_all', label: t('cat_all') },
    { key: 'cat_registration', label: t('cat_registration') },
    { key: 'cat_earnings', label: t('cat_earnings') },
    { key: 'cat_driving', label: t('cat_driving') },
    { key: 'cat_app_issues', label: t('cat_app_issues') },
  ], [t]);

  const FAQS = useMemo(() => [
    {
      q: t('faq_reg_1_q'),
      a: t('faq_reg_1_a'),
      category: 'cat_registration',
    },
    {
      q: t('faq_reg_2_q'),
      a: t('faq_reg_2_a'),
      category: 'cat_registration',
    },
    {
      q: t('faq_reg_3_q'),
      a: t('faq_reg_3_a'),
      category: 'cat_registration',
    },
    {
      q: t('faq_earn_1_q'),
      a: t('faq_earn_1_a'),
      category: 'cat_earnings',
    },
    {
      q: t('faq_earn_2_q'),
      a: t('faq_earn_2_a'),
      category: 'cat_earnings',
    },
    {
      q: t('faq_earn_3_q'),
      a: t('faq_earn_3_a'),
      category: 'cat_earnings',
    },
    {
      q: t('faq_drive_1_q'),
      a: t('faq_drive_1_a'),
      category: 'cat_driving',
    },
    {
      q: t('faq_drive_2_q'),
      a: t('faq_drive_2_a'),
      category: 'cat_driving',
    },
    {
      q: t('faq_drive_3_q'),
      a: t('faq_drive_3_a'),
      category: 'cat_driving',
    },
    {
      q: t('faq_app_1_q'),
      a: t('faq_app_1_a'),
      category: 'cat_app_issues',
    },
    {
      q: t('faq_app_2_q'),
      a: t('faq_app_2_a'),
      category: 'cat_app_issues',
    },
  ], [t]);

  const filteredFaqs = useMemo(() => {
    return FAQS.filter((item) => {
      const matchCategory = category === 'cat_all' || item.category === category;
      const qText = search.trim().toLowerCase();
      const matchSearch =
        !qText ||
        (item.q && item.q.toLowerCase().includes(qText)) ||
        (item.a && item.a.toLowerCase().includes(qText));
      return matchCategory && matchSearch;
    });
  }, [search, category, FAQS]);

  // Sparkle + Magnifying Glass Animations for Empty State
  const magnifyingGlassStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withTiming(
          filteredFaqs.length === 0 && search.length > 0 ? 1.1 : 1,
          { duration: 600 },
        ),
      },
    ],
  }));

  const sparkleStyle1 = useAnimatedStyle(() => ({
    opacity: withTiming(
      filteredFaqs.length === 0 && search.length > 0 ? 1 : 0,
      { duration: 800 },
    ),
    transform: [
      {
        translateY: withTiming(
          filteredFaqs.length === 0 && search.length > 0 ? -15 : 0,
          { duration: 800 },
        ),
      },
      {
        scale: withTiming(
          filteredFaqs.length === 0 && search.length > 0 ? 1 : 0,
          { duration: 800 },
        ),
      },
    ],
  }));

  const sparkleStyle2 = useAnimatedStyle(() => ({
    opacity: withTiming(
      filteredFaqs.length === 0 && search.length > 0 ? 1 : 0,
      { duration: 1200 },
    ),
    transform: [
      {
        translateY: withTiming(
          filteredFaqs.length === 0 && search.length > 0 ? 10 : 0,
          { duration: 1200 },
        ),
      },
      {
        scale: withTiming(
          filteredFaqs.length === 0 && search.length > 0 ? 1 : 0,
          { duration: 1200 },
        ),
      },
    ],
  }));

  // Trigger modal presentation
  useEffect(() => {
    if (visible) {
      bottomSheetModalRef.current?.present();
    } else {
      bottomSheetModalRef.current?.dismiss();
    }
  }, [visible]);

  const handleSheetChanges = useCallback(
    (index: number) => {
      if (index === -1) {
        onClose(); // Cleanup when dismissed
      }
    },
    [onClose]
  );

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
      />
    ),
    []
  );


  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };


  const supportOptions = [
    {
      labelKey: 'email_support',
      icon: 'mail',
      color: dark ? '#60A5FA' : '#1E3A8A',
      bg: dark ? 'rgba(96, 165, 250, 0.15)' : '#DBEAFE',
      action: () => Linking.openURL('mailto:support@vdrive.com'),
    },
    {
      labelKey: 'whatsapp_support',
      icon: 'logo-whatsapp',
      color: dark ? '#4ADE80' : '#16A34A',
      bg: dark ? 'rgba(74, 222, 128, 0.15)' : '#DCFCE7',
      action: () => Linking.openURL('https://wa.me/919876543210'),
    },
    {
      labelKey: 'call_support',
      icon: 'call',
      color: colors.primary,
      bg: dark ? `${colors.primary}20` : '#E0E7FF',
      action: () => Linking.openURL('tel:+919876543210'),
    },
  ];

  const renderFooter = useCallback(
    (props: any) => (
      <BottomSheetFooter {...props} bottomInset={0}>
        <View style={[styles.footerContainer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.supportOptionsRow}>
            {supportOptions.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.supportButton}
                onPress={() => {
                  triggerHaptic(HapticFeedbackTypes.impactMedium);
                  item.action();
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.supportIconBox, { backgroundColor: item.bg, shadowColor: dark ? 'transparent' : '#000' }]}>
                  <Ionicons name={item.icon} size={22} color={item.color} />
                </View>
                <Text adjustsFontSizeToFit numberOfLines={2} style={[styles.supportLabel, { color: colors.text, ...fonts.medium }]}>{t(item.labelKey)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </BottomSheetFooter>
    ),
    [supportOptions, insets.bottom, t, triggerHaptic]
  );

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      index={0}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      backdropComponent={renderBackdrop}
      footerComponent={renderFooter}
      backgroundStyle={[styles.bottomSheetBackground, { backgroundColor: colors.background }]}
      handleIndicatorStyle={styles.handleIndicator}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
    >
      <BottomSheetScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.heading, { color: colors.text, ...fonts.bold }]}>{t('help_center')}</Text>
          <Text style={[styles.subHeading, { color: colors.text, opacity: 0.6, ...fonts.regular }]}>
            {t('help_modal_subtitle')}
          </Text>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchBox, { backgroundColor: dark ? colors.card : '#F9FAFB', borderColor: colors.border, shadowColor: dark ? 'transparent' : '#000' }]}>
          <Ionicons name="search" size={20} color={colors.text} style={{ opacity: 0.5 }} />
          <BottomSheetTextInput
            placeholder={t('search_help')}
            value={search}
            onChangeText={(text) => {
              setSearch(text);
              setOpenIndex(null);
            }}
            style={[styles.searchInput, { color: colors.text, ...fonts.medium }]} 
            placeholderTextColor={dark ? 'rgba(255,255,255,0.4)' : '#9CA3AF'}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={20} color={colors.text} style={{ opacity: 0.5 }} />
            </TouchableOpacity>
          )}
        </View>

        {/* Horizontal Category Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryContainer}
          contentContainerStyle={styles.categoryScrollContent}
        >
          {CATEGORIES.map((cat, idx) => {
            const isActive = category === cat.key;
            return (
              <TouchableOpacity
                key={idx}
                style={[styles.categoryPill, { backgroundColor: dark ? colors.card : '#E5E7EB' }, isActive && { backgroundColor: colors.primary }]}
                onPress={() => {
                  triggerHaptic(HapticFeedbackTypes.selection);
                  setCategory(cat.key);
                  setOpenIndex(null);
                }}
              >
                <Text
                  style={[
                    styles.categoryText,
                    { color: dark ? '#E5E7EB' : '#4B5563', ...fonts.medium },
                    isActive && styles.categoryTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Contact Support Pinned to Footer */}

        {/* FAQ Section */}
        <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.sectionTitle, { color: colors.text, ...fonts.bold }]}>{t('common_questions')}</Text>

        <View style={[styles.faqCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: dark ? 'transparent' : '#000' }]}>
          {filteredFaqs.length === 0 ? (
            <Animated.View style={styles.emptyState}>
              <View style={[styles.magnifyingGlassContainer, { backgroundColor: dark ? colors.background : '#F3F4F6' }]}>
                <Animated.View style={magnifyingGlassStyle}>
                  <Ionicons name="search" size={48} color={dark ? 'rgba(255,255,255,0.2)' : "#D1D5DB"} />
                </Animated.View>
                <Animated.View style={[styles.floatingSparkle, sparkleStyle1]}>
                  <Ionicons name="sparkles" size={16} color="#60A5FA" />
                </Animated.View>
                <Animated.View style={[styles.floatingSparkle2, sparkleStyle2]}>
                  <Ionicons name="sparkles" size={12} color="#FBBF24" />
                </Animated.View>
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text, ...fonts.bold }]}>{t('no_results_title')}</Text>
              <Text style={[styles.emptyText, { color: colors.text, opacity: 0.6, ...fonts.regular }]}>{t('no_results_desc', { search: search })}</Text>
            </Animated.View>
          ) : (
            filteredFaqs.map((item, index) => (
              <View key={index}>
                <FaqItem
                  item={item}
                  searchQuery={search}
                  isExpanded={openIndex === index}
                  onPress={() => toggleFAQ(index)}
                />
                {index < filteredFaqs.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                )}
              </View>
            ))
          )}
        </View>
      </BottomSheetScrollView>

    </BottomSheetModal>
  );
};

export default HelpCenterModal;

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  bottomSheetBackground: {
    backgroundColor: '#FAFAFA',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleIndicator: {
    backgroundColor: '#D1D5DB',
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  header: {
    marginTop: 10,
    marginBottom: 20,
  },
  heading: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
  },
  subHeading: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    lineHeight: 20,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 2,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#111827',
  },
  categoryContainer: {
    marginBottom: 24,
  },
  categoryScrollContent: {
    paddingRight: 20,
  },
  categoryPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    marginRight: 10,
  },
  categoryActive: {
    backgroundColor: '#2563EB',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  categoryTextActive: {
    color: '#FFFFFF',
  },
  footerContainer: {
    backgroundColor: '#FAFAFA',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  supportOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  supportButton: {
    alignItems: 'center',
    flex: 1,
  },
  supportIconBox: {
    height: 54,
    width: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  supportLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    color: '#111827',
  },
  faqCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  faqRowContainer: {
    width: '100%',
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    paddingRight: 12,
    lineHeight: 22,
  },
  faqQuestionActive: {
    color: '#2563EB',
  },
  faqAnswerContainer: {
    overflow: 'hidden',
  },
  faqAnswerWrapper: {
    position: 'absolute',
    width: '100%',
    paddingBottom: 18,
    paddingTop: 4,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
  },
  highlightText: {
    color: '#2563EB',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  backdropBlur: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  magnifyingGlassContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  floatingSparkle: {
    position: 'absolute',
    top: -5,
    right: -10,
  },
  floatingSparkle2: {
    position: 'absolute',
    bottom: 5,
    left: -15,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});
