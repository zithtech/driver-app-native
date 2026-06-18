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
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useHaptic } from '../../hooks/useHaptic';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { mS, vS, hS } from '../../lib/scale';
import FaqChatbotModal from './FaqChatbotModal';
import { useGetSupportFaqsQuery } from '../../service/driverApi';

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
            size={mS(16)}
            color={isExpanded ? colors.primary : colors.text}
            style={{ opacity: isExpanded ? 1 : 0.5 }}
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
  const snapPoints = useMemo(() => ['75%', '95%'], []);

  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [chatVisible, setChatVisible] = useState(false);

  // Fetch FAQs from API (with local fallback)
  const { data: faqResponse } = useGetSupportFaqsQuery();

  const LOCAL_FAQS = [
    { q: 'How do I upload my documents?', a: 'Go to the Document Verification screen and tap on the document you want to upload.' },
    { q: 'Why was my document rejected?', a: 'Documents are usually rejected if they are blurry, expired, or do not match your profile.' },
    { q: 'How long does approval take?', a: 'Approval typically takes 24 to 48 hours after all documents are uploaded.' },
    { q: 'How do I accept a ride?', a: 'Toggle your status to Online. When a ride request appears, tap Accept.' },
    { q: 'How do payouts work?', a: 'Payouts are processed weekly to your registered bank account.' },
  ];

  const FAQS = useMemo(() => {
    const serverFaqs = faqResponse?.data;
    if (serverFaqs && Array.isArray(serverFaqs) && serverFaqs.length > 0) {
      return serverFaqs.map((f: any) => ({ q: f.question, a: f.answer }));
    }
    return LOCAL_FAQS;
  }, [faqResponse]);

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
    <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
  ), []);

  const supportOptions = [
    { label: 'Call Us', icon: 'call', color: colors.primary, action: () => Linking.openURL('tel:+919043522612') },
    { label: 'WhatsApp', icon: 'logo-whatsapp', color: '#25D366', action: () => Linking.openURL('https://wa.me/919043522612') },
  ];

  return (
    <>
      <BottomSheetModal
        ref={bottomSheetModalRef}
        index={0}
        snapPoints={snapPoints}
        onChange={handleSheetChanges}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.background, borderRadius: mS(24) }}
        handleIndicatorStyle={{ backgroundColor: colors.border, width: mS(30), height: vS(4) }}
      >
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Text style={[styles.headerTitle, { color: colors.text, ...fonts.bold }]} numberOfLines={1} adjustsFontSizeToFit>{t('help_center', 'Help Center')}</Text>
            <TouchableOpacity 
              style={[styles.closeButton, { backgroundColor: dark ? colors.card : '#F3F4F6' }]} 
              onPress={() => bottomSheetModalRef.current?.dismiss()}
            >
              <Ionicons name="close" size={mS(20)} color={colors.text} />
            </TouchableOpacity>
          </View>

          <BottomSheetScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: vS(20) }}>
            
            {/* Layer 3: AI Chat Entry */}
            <TouchableOpacity
              style={[styles.aiBanner, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}
              activeOpacity={0.8}
              onPress={() => {
                triggerHaptic(HapticFeedbackTypes.impactMedium);
                setChatVisible(true);
              }}
            >
              <View style={[styles.aiIconWrapper, { backgroundColor: colors.primary }]}>
                <Ionicons name="sparkles" size={mS(20)} color="#FFF" />
              </View>
              <View style={styles.aiTextWrapper}>
                <Text style={[styles.aiTitle, { color: colors.primary, ...fonts.bold }]} numberOfLines={1} adjustsFontSizeToFit>Chat with AI Assistant</Text>
                <Text style={[styles.aiSubtitle, { color: colors.text, opacity: 0.7, ...fonts.regular }]} numberOfLines={1} adjustsFontSizeToFit>Get instant answers to your questions</Text>
              </View>
              <Ionicons name="chevron-forward" size={mS(20)} color={colors.primary} />
            </TouchableOpacity>

            {/* Layer 2: Searchable FAQ */}
            <View style={[styles.sectionContainer, { marginTop: vS(16) }]}>
              <Text style={[styles.sectionTitle, { color: colors.text, ...fonts.bold }]} numberOfLines={1} adjustsFontSizeToFit>Frequently Asked Questions</Text>
              <View style={[styles.searchBar, { backgroundColor: dark ? colors.card : '#F3F4F6' }]}>
                <Ionicons name="search" size={mS(16)} color={colors.text} style={{ opacity: 0.5 }} />
                <BottomSheetTextInput
                  placeholder={t('search_help', 'Search for help...')}
                  value={search}
                  onChangeText={setSearch}
                  style={[styles.searchInput, { color: colors.text, ...fonts.medium }]}
                  placeholderTextColor={dark ? '#777' : '#999'}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')}>
                    <Ionicons name="close-circle" size={mS(16)} color={colors.text} style={{ opacity: 0.5 }} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={[styles.faqSection, { backgroundColor: dark ? colors.card : '#FFF', borderColor: colors.border }]}>
                {filteredFaqs.length > 0 ? (
                  filteredFaqs.map((item, index) => (
                    <FaqItem 
                      key={index} 
                      item={item} 
                      searchQuery={search} 
                      isExpanded={openIndex === index} 
                      onPress={() => setOpenIndex(openIndex === index ? null : index)} 
                    />
                  ))
                ) : (
                  <View style={styles.noResultsContainer}>
                    <Ionicons name="search-outline" size={mS(32)} color={colors.text} style={{ opacity: 0.3, marginBottom: vS(8) }} />
                    <Text style={[styles.noResultsText, { color: colors.text, opacity: 0.6 }]}>No results found</Text>
                  </View>
                )}
              </View>
            </View>

          </BottomSheetScrollView>

          {/* Layer 4: Human Escalation */}
          <View style={[styles.supportFooter, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, vS(16)) }]}>
            <Text style={[styles.supportFooterTitle, { color: colors.text, ...fonts.bold }]} numberOfLines={1} adjustsFontSizeToFit>Still need help?</Text>
            <View style={styles.supportOptionsRow}>
              {supportOptions.map((opt, i) => (
                <TouchableOpacity 
                  key={i} 
                  style={[styles.supportItem, { backgroundColor: opt.color + '15', borderColor: opt.color + '30' }]} 
                  onPress={() => { triggerHaptic(HapticFeedbackTypes.impactLight); opt.action(); }}
                >
                  <View style={[styles.iconCircle, { backgroundColor: opt.color }]}>
                    <Ionicons name={opt.icon} size={mS(14)} color="#FFF" />
                  </View>
                  <Text style={[styles.supportText, { color: colors.text, ...fonts.bold }]} numberOfLines={1} adjustsFontSizeToFit>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </BottomSheetModal>
      
      <FaqChatbotModal visible={chatVisible} onClose={() => setChatVisible(false)} />
    </>
  );
};

const styles = StyleSheet.create({
  content: { flex: 1 },
  headerRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: vS(12),
    paddingHorizontal: hS(20),
  },
  headerTitle: { fontSize: mS(18) },
  closeButton: {
    width: mS(32),
    height: mS(32),
    borderRadius: mS(16),
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionContainer: {
    paddingHorizontal: hS(20),
    marginTop: vS(10),
  },
  sectionTitle: {
    fontSize: mS(16),
    marginBottom: vS(12),
  },
  aiBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: hS(20),
    marginTop: vS(12),
    padding: mS(16),
    borderRadius: mS(16),
    borderWidth: 1,
  },
  aiIconWrapper: {
    width: mS(44),
    height: mS(44),
    borderRadius: mS(22),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: hS(12),
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  aiTextWrapper: {
    flex: 1,
  },
  aiTitle: {
    fontSize: mS(15),
    marginBottom: vS(2),
  },
  aiSubtitle: {
    fontSize: mS(12),
  },
  searchBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderRadius: mS(12), 
    paddingHorizontal: hS(12), 
    height: vS(44), 
    marginBottom: vS(12) 
  },
  searchInput: { 
    flex: 1, 
    marginLeft: hS(8), 
    fontSize: mS(14), 
    paddingVertical: 0 
  },
  faqSection: { 
    borderRadius: mS(16),
    borderWidth: 1,
    overflow: 'hidden',
  },
  faqRowContainer: { 
    borderBottomWidth: 1, 
    borderBottomColor: 'rgba(0,0,0,0.05)' 
  },
  faqHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: vS(16),
    paddingHorizontal: hS(16),
  },
  faqQuestion: { 
    fontSize: mS(14), 
    flex: 1, 
    paddingRight: hS(16) 
  },
  faqAnswerContainer: { 
    overflow: 'hidden' 
  },
  faqAnswerWrapper: { 
    position: 'absolute', 
    width: '100%', 
    paddingBottom: vS(16),
    paddingHorizontal: hS(16),
  },
  faqAnswer: { 
    fontSize: mS(13), 
    lineHeight: vS(20) 
  },
  noResultsContainer: {
    padding: mS(24),
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsText: {
    fontSize: mS(14),
  },
  supportFooter: { 
    paddingVertical: vS(16), 
    paddingHorizontal: hS(20),
    borderTopWidth: 1,
    backgroundColor: 'transparent',
  },
  supportFooterTitle: {
    fontSize: mS(14),
    marginBottom: vS(12),
    textAlign: 'center',
  },
  supportOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  supportItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: hS(16), 
    paddingVertical: vS(10),
    borderRadius: mS(24),
    borderWidth: 1,
    marginHorizontal: hS(6),
    minWidth: hS(120),
    justifyContent: 'center',
  },
  iconCircle: {
    width: mS(24),
    height: mS(24),
    borderRadius: mS(12),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: hS(8),
  },
  supportText: { fontSize: mS(13) },
  highlightText: { fontWeight: '800' },
});

export default HelpCenterModal;
