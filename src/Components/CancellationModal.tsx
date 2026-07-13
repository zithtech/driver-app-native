import React, { useState, useEffect, useRef } from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Pressable,
    Dimensions,
    TextInput,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../context/ThemeContext';
import { useHaptic } from '../hooks/useHaptic';
import { ms, vs } from '../lib/scale';

const { height } = Dimensions.get('window');

export interface CancellationReason {
    id: string;
    label: string;
}

interface CancellationModalProps {
    isVisible: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    isSubmitting?: boolean;
    hiddenReasonIds?: string[];
}

const REASONS: CancellationReason[] = [
    { id: 'PERSONAL_EMERGENCY', label: 'reason_personal_emergency' },
    { id: 'VEHICLE_PROBLEM', label: 'reason_vehicle_problem' },
    { id: 'PICKUP_TOO_FAR', label: 'reason_pickup_too_far' },
    { id: 'RIDER_NOT_RESPONDING', label: 'reason_rider_not_responding' },
    { id: 'RIDER_ASKED_TO_CANCEL', label: 'reason_rider_asked_to_cancel' },
    { id: 'TECHNICAL_ISSUE', label: 'reason_technical_issue' },
    { id: 'OTHER', label: 'reason_other' },
];

const CancellationModal: React.FC<CancellationModalProps> = ({
    isVisible,
    onClose,
    onConfirm,
    isSubmitting = false,
    hiddenReasonIds = [],
}) => {
    const { t } = useTranslation();
    const { theme, isDark } = useAppTheme();
    const { triggerHaptic } = useHaptic();
    const [selectedReason, setSelectedReason] = useState<string | null>(null);
    const [customReason, setCustomReason] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    
    const flatListRef = useRef<FlatList>(null);

    // Filter reasons based on hiddenReasonIds
    const filteredReasons = REASONS.filter(reason => !hiddenReasonIds.includes(reason.id));

    useEffect(() => {
        if (isVisible) {
            triggerHaptic(HapticFeedbackTypes.impactLight);
        } else {
            setSelectedReason(null);
            setCustomReason('');
        }
    }, [isVisible, triggerHaptic]);

    useEffect(() => {
        if (selectedReason !== 'OTHER') {
            setCustomReason('');
        } else {
            // Scroll to the bottom when OTHER is selected to display the text box
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [selectedReason]);

    const isOtherInvalid = selectedReason === 'OTHER' && customReason.trim().length < 5;
    const isConfirmDisabled = !selectedReason || isSubmitting || isOtherInvalid;

    const handleConfirm = () => {
        if (selectedReason && !isConfirmDisabled) {
            triggerHaptic(HapticFeedbackTypes.notificationSuccess);
            const finalReason = selectedReason === 'OTHER' ? customReason.trim() : selectedReason;
            onConfirm(finalReason);
        }
    };

    const renderFooter = () => {
        if (selectedReason !== 'OTHER') return null;

        const SUGGESTIONS = [
            { id: 'traffic', label: t('reason_chip_traffic') },
            { id: 'road_closed', label: t('reason_chip_road_closed') },
            { id: 'vehicle_issue', label: t('reason_chip_vehicle_issue') },
        ];

        return (
            <View style={styles.customInputContainer}>
                <Text style={[styles.customInputTitle, { color: theme.colors.text }]}>
                    {t('tell_us_more')}
                </Text>
                <TextInput
                    multiline
                    numberOfLines={3}
                    value={customReason}
                    onChangeText={setCustomReason}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder={t('reason_other_placeholder')}
                    placeholderTextColor={theme.colors.textMuted}
                    style={[
                        styles.customTextInput,
                        { 
                            color: theme.colors.text,
                            borderColor: isFocused
                                ? theme.colors.primary
                                : customReason.trim().length >= 5
                                    ? (theme.colors.success || '#10B981')
                                    : theme.colors.border + '40',
                            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                        }
                    ]}
                    maxLength={150}
                />

                <View style={styles.chipsContainer}>
                    {SUGGESTIONS.map((chip) => (
                        <TouchableOpacity
                            key={chip.id}
                            style={[
                                styles.chip,
                                {
                                    borderColor: theme.colors.border + '40',
                                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0,0,0,0.03)',
                                }
                            ]}
                            onPress={() => {
                                triggerHaptic(HapticFeedbackTypes.selection);
                                setCustomReason(chip.label);
                            }}
                        >
                            <Text style={[styles.chipText, { color: theme.colors.text }]}>
                                {chip.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.counterRow}>
                    <Text style={[
                        styles.counterText,
                        { color: customReason.trim().length >= 5 ? theme.colors.success || '#10B981' : theme.colors.textMuted }
                    ]}>
                        {customReason.trim().length}/150
                    </Text>
                    {customReason.trim().length > 0 && customReason.trim().length < 5 && (
                        <Text style={[styles.validationText, { color: '#EF4444' }]}>
                            {t('reason_min_length')}
                        </Text>
                    )}
                </View>
            </View>
        );
    };

    return (
        <Modal
            visible={isVisible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
            statusBarTranslucent
            navigationBarTranslucent
        >
            <View style={styles.overlay}>
                <Pressable style={styles.background} onPress={onClose} />
                
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? vs(20) : 0}
                    style={{ width: '100%' }}
                >
                    <View style={[styles.content, { backgroundColor: theme.colors.card }]}>
                        <View style={styles.handleContainer}>
                            <View style={[styles.handle, { backgroundColor: isDark ? '#333' : '#E2E8F0' }]} />
                        </View>

                        <View style={styles.header}>
                            <Text style={[styles.title, { color: theme.colors.text }]}>
                                {t('cancel_trip')}
                            </Text>
                            <TouchableOpacity onPress={onClose} style={{ padding: ms(4) }}>
                                <Text style={{ fontSize: ms(14), fontWeight: '600', color: theme.colors.textMuted, textTransform: 'uppercase' }}>
                                    {t('close', 'CLOSE')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                        
                        <Text style={[styles.subtitle, { color: theme.colors.paragraphText }]}>
                            {t('select_reason')}
                        </Text>

                        <FlatList
                            ref={flatListRef}
                            data={filteredReasons}
                            keyExtractor={(item) => item.id}
                            keyboardShouldPersistTaps="handled"
                            ListFooterComponent={renderFooter()}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    style={[
                                        styles.reasonItem,
                                        {
                                            backgroundColor: 'transparent', 
                                            borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', 
                                            borderBottomWidth: 1 
                                        },
                                        selectedReason === item.id && {
                                            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC',
                                            borderColor: 'transparent',
                                            borderBottomColor: 'transparent',
                                        },
                                    ]}
                                    onPress={() => {
                                        triggerHaptic(HapticFeedbackTypes.selection);
                                        setSelectedReason(item.id);
                                    }}
                                    disabled={isSubmitting}
                                >
                                    <Text style={[
                                        styles.reasonLabel,
                                        { color: theme.colors.text },
                                        selectedReason === item.id && { fontWeight: '700' }
                                    ]}>
                                        {t(item.label)}
                                    </Text>
                                    <View style={[
                                        styles.radioButton,
                                        { borderColor: isDark ? theme.colors.border : '#CBD5E1' },
                                        selectedReason === item.id && { borderColor: '#EF4444' }
                                    ]}>
                                        {selectedReason === item.id && (
                                            <View style={[styles.radioInner, { backgroundColor: '#EF4444' }]} />
                                        )}
                                    </View>
                                </TouchableOpacity>
                            )}
                            style={styles.list}
                            showsVerticalScrollIndicator={false}
                        />

                        <View style={styles.footer}>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={handleConfirm}
                                disabled={isConfirmDisabled}
                                style={[
                                    styles.confirmButton,
                                    { backgroundColor: isConfirmDisabled ? theme.colors.border : '#EF4444' }
                                ]}
                            >
                                <Text style={styles.confirmButtonText}>
                                    {isSubmitting ? t('processing') : t('cancel_trip')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    background: {
        ...StyleSheet.absoluteFillObject,
    },
    handleContainer: {
        alignItems: 'center',
        paddingTop: vs(12),
        paddingBottom: vs(16),
    },
    handle: {
        width: ms(40),
        height: vs(4),
        borderRadius: ms(2),
    },
    content: {
        borderTopLeftRadius: ms(24),
        borderTopRightRadius: ms(24),
        paddingHorizontal: ms(20),
        paddingBottom: vs(32),
        maxHeight: height * 0.85,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: vs(8),
    },
    title: {
        fontSize: ms(20),
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: ms(14),
        marginBottom: vs(20),
    },
    list: {
        marginBottom: vs(15),
    },
    reasonItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: ms(16),
        borderRadius: ms(12),
        borderWidth: 1,
        borderColor: 'transparent',
    },
    reasonLabel: {
        fontSize: ms(15),
    },
    radioButton: {
        width: ms(20),
        height: ms(20),
        borderRadius: ms(10),
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: ms(12),
    },
    radioInner: {
        width: ms(10),
        height: ms(10),
        borderRadius: ms(5),
    },
    footer: {
        marginTop: vs(5),
    },
    confirmButton: {
        width: '100%',
        height: vs(52),
        borderRadius: ms(16),
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmButtonText: {
        color: '#FFFFFF',
        fontSize: ms(16),
        fontWeight: '700',
    },
    customInputContainer: {
        marginTop: vs(10),
        paddingHorizontal: ms(4),
        width: '100%',
        marginBottom: vs(15),
    },
    customInputTitle: {
        fontSize: ms(15),
        fontWeight: '600',
        marginBottom: vs(8),
    },
    customTextInput: {
        borderRadius: ms(16),
        borderWidth: 1.5,
        paddingHorizontal: ms(16),
        paddingVertical: vs(12),
        fontSize: ms(15),
        minHeight: vs(80),
        textAlignVertical: 'top',
    },
    counterRow: {
        flexDirection: 'row-reverse',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: vs(6),
        paddingHorizontal: ms(2),
    },
    counterText: {
        fontSize: ms(12),
        fontWeight: '600',
    },
    validationText: {
        fontSize: ms(12),
        fontWeight: '500',
    },
    chipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: ms(8),
        marginTop: vs(10),
        marginBottom: vs(4),
    },
    chip: {
        paddingHorizontal: ms(12),
        paddingVertical: vs(6),
        borderRadius: ms(20),
        borderWidth: 1.5,
    },
    chipText: {
        fontSize: ms(12),
        fontWeight: '600',
    },
});

export default CancellationModal;
