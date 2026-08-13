import React, { forwardRef, useImperativeHandle, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
  BottomSheetBackgroundProps,
} from '@gorhom/bottom-sheet';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { BlurView } from '@react-native-community/blur';
import { useTranslation } from 'react-i18next';
import { useHaptic } from '../hooks/useHaptic';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useAppTheme } from '../context/ThemeContext';
import { ms, vs } from '../lib/scale';

const { width } = Dimensions.get('window');

export interface ImageSourcePickerRef {
  present: (sideName: string) => void;
  dismiss: () => void;
}

interface ImageSourcePickerProps {
  onCameraSelect: (sideName: string) => void;
  onGallerySelect: (sideName: string) => void;
  allowFile?: boolean;
  onFileSelect?: (sideName: string) => void;
}

const ImageSourcePicker = forwardRef<ImageSourcePickerRef, ImageSourcePickerProps>(
  ({ onCameraSelect, onGallerySelect, allowFile, onFileSelect }, ref) => {
    const { t } = useTranslation();
    const { theme, isDark } = useAppTheme();
    const { triggerHaptic } = useHaptic();
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);

    const [currentSide, setCurrentSide] = React.useState<string>('');

    useImperativeHandle(ref, () => ({
      present: (sideName: string) => {
        setCurrentSide(sideName);
        triggerHaptic(HapticFeedbackTypes.impactLight);
        bottomSheetModalRef.current?.present();
      },
      dismiss: () => {
        bottomSheetModalRef.current?.dismiss();
      },
    }));

    const handleCameraPress = () => {
      triggerHaptic(HapticFeedbackTypes.selection);
      bottomSheetModalRef.current?.dismiss();
      setTimeout(() => {
        onCameraSelect(currentSide);
      }, 150);
    };

    const handleGalleryPress = () => {
      triggerHaptic(HapticFeedbackTypes.selection);
      bottomSheetModalRef.current?.dismiss();
      setTimeout(() => {
        onGallerySelect(currentSide);
      }, 150);
    };

    const handleFilePress = () => {
      triggerHaptic(HapticFeedbackTypes.selection);
      bottomSheetModalRef.current?.dismiss();
      setTimeout(() => {
        if (onFileSelect) onFileSelect(currentSide);
      }, 150);
    };

    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.4}
        />
      ),
      []
    );

    const CustomBackground = useCallback(
      ({ style }: BottomSheetBackgroundProps) => (
        <View style={[style, styles.backgroundContainer]}>
          {Platform.OS === 'ios' ? (
            <BlurView
              style={StyleSheet.absoluteFill}
              blurType={isDark ? "dark" : "light"}
              blurAmount={20}
              reducedTransparencyFallbackColor={isDark ? "rgba(17, 24, 39, 0.95)" : "rgba(255, 255, 255, 0.98)"}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: isDark ? "rgba(17, 24, 39, 0.98)" : "rgba(255, 255, 255, 0.98)" },
              ]}
            />
          )}
        </View>
      ),
      [isDark]
    );

    return (
      <BottomSheetModal
        ref={bottomSheetModalRef}
        index={0}
        snapPoints={['40%']}
        backdropComponent={renderBackdrop}
        backgroundComponent={CustomBackground}
        handleIndicatorStyle={{ backgroundColor: isDark ? '#4B5563' : '#D1D5DB', width: 40, marginTop: 10 }}
      >
        <BottomSheetView style={styles.contentContainer}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {t('choose_source')}
          </Text>

          <View style={styles.cardsRow}>
            {/* Camera Card */}
            <TouchableOpacity
              style={styles.cardWrapper}
              activeOpacity={0.8}
              onPress={handleCameraPress}
            >
              <View style={[styles.card, { backgroundColor: isDark ? 'rgba(31, 41, 55, 0.8)' : '#FFFFFF' }]}>
                <LinearGradient
                  colors={isDark ? ['rgba(59, 130, 246, 0.2)', 'transparent'] : ['#E0F2FE', '#FFFFFF']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 0.6 }}
                  style={[StyleSheet.absoluteFillObject, { borderRadius: ms(20) }]}
                />

                <View style={styles.iconWrapper}>
                  <Ionicons name="camera" size={ms(54)} color={isDark ? "#60A5FA" : "#3B82F6"} style={styles.iconShadow} />
                </View>

                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                  {t('camera')}
                </Text>
                <Text style={[styles.cardSubtitle, { color: isDark ? '#9CA3AF' : '#4B5563' }]}>
                  {t('capture_doc')}
                </Text>
                <Text style={[styles.cardSmallText, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
                  {t('high_quality_desc')}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Gallery Card */}
            <TouchableOpacity
              style={styles.cardWrapper}
              activeOpacity={0.8}
              onPress={handleGalleryPress}
            >
              <View style={[styles.card, { backgroundColor: isDark ? 'rgba(31, 41, 55, 0.8)' : '#FFFFFF' }]}>
                <LinearGradient
                  colors={isDark ? ['rgba(16, 185, 129, 0.2)', 'transparent'] : ['#D1FAE5', '#FFFFFF']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 0.6 }}
                  style={[StyleSheet.absoluteFillObject, { borderRadius: ms(20) }]}
                />

                <View style={styles.iconWrapper}>
                  <Ionicons name="images" size={ms(54)} color={isDark ? "#34D399" : "#10B981"} style={styles.iconShadow} />
                </View>

                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                  {t('gallery')}
                </Text>
                <Text style={[styles.cardSubtitle, { color: isDark ? '#9CA3AF' : '#4B5563' }]}>
                  {t('pick_from_photos')}
                </Text>
                <Text style={[styles.cardSmallText, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
                  {t('high_res_desc')}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Document Card (Conditional) */}
            {allowFile && (
              <TouchableOpacity
                style={styles.cardWrapper}
                activeOpacity={0.8}
                onPress={handleFilePress}
              >
                <View style={[styles.card, { backgroundColor: isDark ? 'rgba(31, 41, 55, 0.8)' : '#FFFFFF' }]}>
                  <LinearGradient
                    colors={isDark ? ['rgba(245, 158, 11, 0.2)', 'transparent'] : ['#FEF3C7', '#FFFFFF']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 0.6 }}
                    style={[StyleSheet.absoluteFillObject, { borderRadius: ms(20) }]}
                  />
                  
                  <View style={styles.iconWrapper}>
                    <Ionicons name="document-text" size={ms(54)} color={isDark ? "#FBBF24" : "#F59E0B"} style={styles.iconShadow} />
                  </View>

                  <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                    {t('document', 'Files')}
                  </Text>
                  <Text style={[styles.cardSubtitle, { color: isDark ? '#9CA3AF' : '#4B5563' }]}>
                    {t('upload_pdf', 'Upload PDF')}
                  </Text>
                  <Text style={[styles.cardSmallText, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
                    {t('pdf_only_desc', 'Select from files')}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);

ImageSourcePicker.displayName = 'ImageSourcePicker';

const styles = StyleSheet.create({
  backgroundContainer: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: ms(24),
    paddingTop: vs(20),
    paddingBottom: vs(32),
    alignItems: 'center',
  },
  title: {
    fontSize: ms(20),
    fontWeight: '800',
    marginBottom: vs(32),
    letterSpacing: -0.5,
  },
  cardsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    gap: ms(16),
  },
  cardWrapper: {
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  card: {
    borderRadius: ms(20),
    paddingVertical: vs(24),
    paddingHorizontal: ms(12),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    height: '100%',
  },
  iconWrapper: {
    marginBottom: vs(20),
  },
  iconShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  cardTitle: {
    fontSize: ms(18),
    fontWeight: '800',
    marginBottom: vs(4),
  },
  cardSubtitle: {
    fontSize: ms(13),
    fontWeight: '500',
    marginBottom: vs(8),
    textAlign: 'center',
  },
  cardSmallText: {
    fontSize: ms(11),
    textAlign: 'center',
    lineHeight: ms(16),
  },
});

export default ImageSourcePicker;
