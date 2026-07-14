import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Switch,
    ScrollView,
    TouchableOpacity,
    Dimensions,
} from 'react-native';

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import {
    BottomSheetModal,
    BottomSheetView,
    BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import Animated, {
    FadeInDown,
} from 'react-native-reanimated';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import AppStatusBar from '../../Components/AppStatusBar';
import ConfirmationModal from '../../Components/ConfirmationModal';
import { useHaptic } from '../../hooks/useHaptic';

import {
    Auth_Nav,
    HelpCenter_Nav,
    EmergencySupport_Nav,
    LegalAgreements_Nav,
    AboutApp_Nav,
} from '../../Navigations/navigations';
import { logoutUser } from '../../service/utils/logoutHelper';
import { useAppTheme } from '../../context/ThemeContext';
import { setUser } from '../../redux/userSlice';
import { useUpdateDriverMutation } from '../../service/driverApi';
import i18n from '../../i18n/i18n';
import { languagesList } from '../../constant/language';
import { RootState } from '../../redux/store';
import { RootContext } from '../../context/RootCoontext';
import { vs, ms } from '../../lib/scale';

const { width } = Dimensions.get('window');

const hapticOptions = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
};

const ProfileSettingsScreen = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const navigation = useNavigation<any>();
    const { theme, isDark, themeMode, setThemeMode } = useAppTheme();
    const insets = useSafeAreaInsets();

    const user = useSelector((state: RootState) => state.userSlice.user);
    const currentLanguage = user?.language || 'en';
    const isVibrationEnabled = user?.isVibrationEnabled ?? true;

    const { triggerHaptic } = useHaptic();
    const [updateDriver] = useUpdateDriverMutation();
    const { showSuccessPopup } = React.useContext(RootContext);

    const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);

    /* ================= REF ================= */
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);

    /* ================= SNAP POINTS ================= */
    const snapPoints = useMemo(() => ['40%'], []);

    /* ================= HANDLERS ================= */

    const handlePresentModalPress = useCallback(() => {
        triggerHaptic(HapticFeedbackTypes.selection);
        bottomSheetModalRef.current?.present();
    }, [triggerHaptic]);

    const handleLanguageSelect = useCallback(async (lang: string) => {
        triggerHaptic(HapticFeedbackTypes.notificationSuccess);
        dispatch(setUser({ language: lang }));
        i18n.changeLanguage(lang);
        bottomSheetModalRef.current?.dismiss();
        showSuccessPopup(t('language_changed'));

        if (user?.driverId) {
            try {
                await updateDriver({
                    id: user.driverId,
                    data: { language: lang }
                }).unwrap();
            } catch (err) {
                console.error('[Settings] Failed to persist language:', err);
            }
        }
    }, [dispatch, triggerHaptic, showSuccessPopup, t, user?.driverId, updateDriver]);

    const toggleVibration = useCallback(async (value: boolean) => {
        triggerHaptic(HapticFeedbackTypes.impactMedium);
        dispatch(setUser({ isVibrationEnabled: value }));
        showSuccessPopup(value ? t('vibration_enabled') : t('vibration_disabled'));

        if (user?.driverId) {
            try {
                await updateDriver({
                    id: user.driverId,
                    data: { is_vibration_enabled: value }
                }).unwrap();
            } catch (err) {
            }
        }
    }, [dispatch, triggerHaptic, user?.driverId, updateDriver, showSuccessPopup, t]);

    const handleLogout = () => {
        setIsLogoutModalVisible(true);
    };

    const confirmLogout = async () => {
        setIsLogoutModalVisible(false);
        setTimeout(async () => {
            try {
                await logoutUser(dispatch);
                navigation.reset({
                    index: 0,
                    routes: [{ name: Auth_Nav }],
                });
            } catch (e) {
            }
        }, 300);
    };

    const toggleTheme = () => {
        triggerHaptic(HapticFeedbackTypes.selection);
        const nextMode = themeMode === 'light' ? 'dark' : 'light';
        setThemeMode(nextMode);
    };

    const renderBackdrop = useCallback(
        (props: any) => (
            <BottomSheetBackdrop
                {...props}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
            />
        ),
        []
    );
    
    // Grouped list background color
    const bgColor = isDark ? theme.colors.background : '#F2F2F7';

    return (
        <View style={[styles.mainContainer, { backgroundColor: bgColor }]}>
            <AppStatusBar />
            
            {/* MINIMAL HEADER */}
            <View style={[styles.header, { paddingTop: insets.top + vs(10), backgroundColor: bgColor }]}>
                <TouchableOpacity
                    onPress={() => {
                        triggerHaptic();
                        navigation.goBack();
                    }}
                    style={styles.backButton}
                >
                    <Ionicons name="chevron-back" size={ms(24)} color={isDark ? '#FFFFFF' : '#111827'} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: isDark ? '#FFFFFF' : '#111827' }]} numberOfLines={1}>{t('settings')}</Text>
                <View style={{ width: ms(40) }} />
            </View>

            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + vs(40) }]}
                showsVerticalScrollIndicator={false}
            >

                {/* DRIVER PREFERENCES SECTION */}
                <AnimatedSection title={t('driver_preferences_text') || 'DRIVER PREFERENCES'} index={1}>
                    <SwitchItem
                        icon="pulse-outline"
                        label={t('driver_vibration_text') || 'Driver On/Off Vibration'}
                        value={isVibrationEnabled}
                        onChange={toggleVibration}
                        theme={theme}
                        isDark={isDark}
                        isLast
                    />
                </AnimatedSection>

                {/* APP PREFERENCES SECTION */}
                <AnimatedSection title={t('app_preferences')} index={2}>
                    <SwitchItem
                        icon={isDark ? 'moon-outline' : 'sunny-outline'}
                        label={t('dark_mode')}
                        value={isDark}
                        onChange={toggleTheme}
                        theme={theme}
                        isDark={isDark}
                    />
                    <Item
                        icon="language-outline"
                        label={t('language')}
                        onPress={handlePresentModalPress}
                        theme={theme}
                        value={languagesList.find(l => l.value === currentLanguage)?.nativeName}
                        isDark={isDark}
                        isLast
                    />
                </AnimatedSection>

                {/* SUPPORT SECTION */}
                <AnimatedSection title={t('support_legal')} index={3}>
                    <Item
                        icon="help-circle-outline"
                        label={t('help_center')}
                        onPress={() => navigation.navigate(HelpCenter_Nav)}
                        theme={theme}
                        isDark={isDark}
                    />
                    <Item
                        icon="alert-circle-outline"
                        label={t('emergency_support')}
                        onPress={() => navigation.navigate(EmergencySupport_Nav)}
                        theme={theme}
                        isDark={isDark}
                    />
                    <Item
                        icon="shield-checkmark-outline"
                        label={t('legal_agreements', 'Legal Agreements')}
                        onPress={() => navigation.navigate(LegalAgreements_Nav)}
                        theme={theme}
                        isDark={isDark}
                    />
                    <Item
                        icon="information-circle-outline"
                        label={t('about_app')}
                        onPress={() => navigation.navigate(AboutApp_Nav)}
                        theme={theme}
                        isDark={isDark}
                        isLast
                    />
                </AnimatedSection>

                {/* SESSION SECTION */}
                <AnimatedSection title={t('session')} index={4}>
                    <Item
                        icon="log-out-outline"
                        label={t('logout')}
                        danger
                        onPress={handleLogout}
                        theme={theme}
                        isDark={isDark}
                        isLast
                    />
                </AnimatedSection>

                <View style={styles.footer}>
                    <Text style={[styles.versionText, { color: isDark ? theme.colors.textMuted : '#9CA3AF' }]}>
                        {t('version')} 1.0.4 (Production)
                    </Text>
                </View>
            </ScrollView>

            <ConfirmationModal
                isVisible={isLogoutModalVisible}
                onClose={() => setIsLogoutModalVisible(false)}
                onConfirm={confirmLogout}
                title={t('logout')}
                message={t('logout_confirm')}
                confirmText={t('logout')}
                isDestructive
                icon="log-out-outline"
            />

            {/* LANGUAGE BOTTOM SHEET */}
            <BottomSheetModal
                ref={bottomSheetModalRef}
                index={0}
                snapPoints={snapPoints}
                backdropComponent={renderBackdrop}
                backgroundStyle={{ backgroundColor: theme.colors.card }}
                handleIndicatorStyle={{ backgroundColor: theme.colors.border }}
            >
                <BottomSheetView style={[styles.bottomSheetContent, { backgroundColor: theme.colors.card }]}>
                    <Text style={[styles.bottomSheetTitle, { color: theme.colors.text }]}>
                        {t('select_language')}
                    </Text>
                    <View style={styles.languageList}>
                        {languagesList.map((lang) => (
                            <TouchableOpacity
                                key={lang.value}
                                style={[
                                    styles.languageItem,
                                    isDark && { backgroundColor: theme.colors.background },
                                    currentLanguage === lang.value && {
                                        backgroundColor: isDark ? theme.colors.primary + '20' : theme.colors.primary + '10',
                                        borderColor: theme.colors.primary,
                                    },
                                ]}
                                onPress={() => handleLanguageSelect(lang.value)}
                            >
                                <View>
                                    <Text style={[styles.langNative, { color: theme.colors.text }]}>
                                        {lang.nativeName}
                                    </Text>
                                    <Text style={[styles.langLabel, { color: theme.colors.textMuted }]}>
                                        {lang.label}
                                    </Text>
                                </View>
                                {currentLanguage === lang.value && (
                                    <Ionicons name="checkmark-circle-outline" size={ms(24)} color={theme.colors.primary} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </BottomSheetView>
            </BottomSheetModal>
        </View>
    );
};

/* ================= SUB COMPONENTS ================= */

const AnimatedSection = ({ title, children, index }: any) => {
    const { theme, isDark } = useAppTheme();
    return (
        <Animated.View
            entering={FadeInDown.delay(index * 100).duration(500)}
            style={styles.section}
        >
            <Text style={[styles.sectionTitle, { color: isDark ? theme.colors.textMuted : '#6B7280' }]}>{title.toUpperCase()}</Text>
            <View style={[styles.sectionContent, { backgroundColor: isDark ? theme.colors.card : '#FFFFFF', borderColor: isDark ? '#2C2C2E' : '#E5E7EB' }]}>
                {children}
            </View>
        </Animated.View>
    );
};

const Item = ({ icon, label, onPress, danger, theme, value, isDark, isLast }: any) => (
    <TouchableOpacity
        style={[styles.item, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? '#2C2C2E' : '#E5E7EB' }]}
        onPress={onPress}
        activeOpacity={0.7}
    >
        <View style={styles.left}>
            <View style={[
                styles.iconContainer,
                { backgroundColor: danger ? (isDark ? 'rgba(239,68,68,0.1)' : '#FEF2F2') : (isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6') }
            ]}>
                <Ionicons
                    name={icon}
                    size={ms(18)}
                    color={danger ? '#EF4444' : (isDark ? '#FFFFFF' : '#4B5563')}
                />
            </View>
            <View style={styles.textContainer}>
                <Text
                    numberOfLines={1}
                    style={[
                        styles.itemText,
                        { color: isDark ? '#FFFFFF' : '#111827' },
                        danger && { color: '#EF4444' },
                    ]}
                >
                    {label}
                </Text>
            </View>
        </View>
        <View style={styles.right}>
            {value && (
                <Text numberOfLines={1} style={[styles.itemSubText, { color: isDark ? theme.colors.textMuted : '#6B7280' }]}>
                    {value}
                </Text>
            )}
            {!danger && (
                <Ionicons name="chevron-forward" size={ms(18)} color={isDark ? '#4B5563' : '#9CA3AF'} />
            )}
        </View>
    </TouchableOpacity>
);

const SwitchItem = ({ icon, label, value, onChange, theme, isDark, isLast }: any) => (
    <View style={[styles.item, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? '#2C2C2E' : '#E5E7EB' }]}>
        <View style={styles.left}>
            <View style={[
                styles.iconContainer,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6' }
            ]}>
                <Ionicons name={icon} size={ms(18)} color={isDark ? '#FFFFFF' : '#4B5563'} />
            </View>
            <View style={styles.textContainer}>
                <Text numberOfLines={1} style={[styles.itemText, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                    {label}
                </Text>
            </View>
        </View>
        <Switch
            value={value}
            onValueChange={onChange}
            trackColor={{ false: isDark ? theme.colors.border : '#E5E7EB', true: '#34C759' }}
            thumbColor={'#FFFFFF'}
            ios_backgroundColor={isDark ? theme.colors.border : '#E5E7EB'}
            style={{ transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] }}
        />
    </View>
);

/* ================= STYLES ================= */

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: ms(16),
        paddingBottom: vs(12),
    },
    backButton: {
        width: ms(40),
        height: ms(40),
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: ms(18),
        fontWeight: '600',
        textAlign: 'center',
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: ms(16),
        paddingTop: vs(16),
        paddingBottom: vs(24),
    },
    section: {
        marginBottom: vs(24),
    },
    sectionTitle: {
        fontSize: ms(13),
        fontWeight: '600',
        marginBottom: vs(8),
        marginLeft: ms(16),
        textTransform: 'uppercase',
    },
    sectionContent: {
        borderRadius: ms(12),
        borderWidth: 1,
        overflow: 'hidden',
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: vs(12),
        paddingHorizontal: ms(16),
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: ms(32),
        height: ms(32),
        borderRadius: ms(8),
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: ms(12),
    },
    textContainer: {
        flex: 1,
    },
    itemText: {
        fontSize: ms(15),
        fontWeight: '500',
    },
    right: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ms(8),
    },
    itemSubText: {
        fontSize: ms(15),
        fontWeight: '400',
    },
    footer: {
        alignItems: 'center',
        marginTop: vs(10),
        marginBottom: vs(20),
    },
    versionText: {
        fontSize: ms(12),
        fontWeight: '500',
    },
    
    // Bottom Sheet
    bottomSheetContent: {
        flex: 1,
        padding: ms(24),
    },
    bottomSheetTitle: {
        fontSize: ms(20),
        fontWeight: '800',
        marginBottom: vs(24),
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    languageList: {
        gap: vs(12),
    },
    languageItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: ms(16),
        borderRadius: ms(18),
        borderWidth: 1.5,
        borderColor: 'transparent',
        backgroundColor: 'rgba(0,0,0,0.02)',
    },
    langNative: {
        fontSize: ms(16),
        fontWeight: '700',
    },
    langLabel: {
        fontSize: ms(13),
        marginTop: vs(2),
        opacity: 0.7,
    },
});

export default ProfileSettingsScreen;
