import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
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
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
    FadeInDown,
    Layout,
    FadeInRight
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
    ProfileDetails_Nav,
    ProfileDocuments_Nav,
} from '../../Navigations/navigations';
import { logoutUser } from '../../service/utils/logoutHelper';
import { useAppTheme } from '../../context/ThemeContext';
import { setUser, clearUser } from '../../redux/userSlice';
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

        // Persist to backend
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
        
        // Use a small delay to allow modal dismissal to start smoothly
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

    return (
        <View style={[styles.mainContainer, { backgroundColor: theme.colors.background }]}>
            <AppStatusBar forceLight />
            {/* PREMIUM GRADIENT HEADER */}
            <LinearGradient
                colors={isDark ? ['#1e293b', '#0f172a'] : ['#1e3a8a', '#1e40af']}
                style={[styles.premiumHeader, { paddingTop: insets.top + vs(10) }]}
            >
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        onPress={() => {
                            triggerHaptic();
                            navigation.goBack();
                        }}
                        style={styles.backButton}
                    >
                        <Ionicons name="chevron-back" size={ms(24)} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.premiumHeaderTitle}>{t('settings')}</Text>
                    <View style={{ width: ms(40) }} />
                </View>
            </LinearGradient>

            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + vs(40) }]}
                showsVerticalScrollIndicator={false}
            >
                {/* ACCOUNT SECTION */}
                <AnimatedSection title={t('account')} index={0}>
                    <Item
                        icon="person-outline"
                        label={t('profile_info')}
                        onPress={() => {
                            triggerHaptic();
                            navigation.navigate(ProfileDetails_Nav);
                        }}
                        theme={theme}
                        isDark={isDark}
                    />
                    <Item
                        icon="document-text-outline"
                        label={t('documents')}
                        onPress={() => {
                            triggerHaptic();
                            navigation.navigate(ProfileDocuments_Nav);
                        }}
                        theme={theme}
                        isDark={isDark}
                    />
                </AnimatedSection>

                {/* DRIVER PREFERENCES SECTION */}
                <AnimatedSection title={t('driver_preferences_text') || 'DRIVER PREFERENCES'} index={1}>
                    <SwitchItem
                        icon="pulse-outline"
                        label={t('driver_vibration_text') || 'Driver On/Off Vibration'}
                        value={isVibrationEnabled}
                        onChange={toggleVibration}
                        theme={theme}
                        isDark={isDark}
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
                    />
                </AnimatedSection>

                <View style={[styles.footer, { borderTopColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                    <Text style={[styles.versionText, { color: isDark ? '#FFFFFF' : theme.colors.paragraphText }]}>
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
                    <Text style={[styles.bottomSheetTitle, { color: isDark ? '#FFFFFF' : theme.colors.text }]}>
                        {t('select_language')}
                    </Text>
                    <View style={styles.languageList}>
                        {languagesList.map((lang) => (
                            <TouchableOpacity
                                key={lang.value}
                                style={[
                                    styles.languageItem,
                                    isDark && { backgroundColor: 'rgba(255,255,255,0.05)' },
                                    currentLanguage === lang.value && {
                                        backgroundColor: isDark ? theme.colors.primary + '20' : theme.colors.primary + '10',
                                        borderColor: theme.colors.primary,
                                    },
                                ]}
                                onPress={() => handleLanguageSelect(lang.value)}
                            >
                                <View>
                                    <Text style={[styles.langNative, { color: isDark ? '#FFFFFF' : theme.colors.text }]}>
                                        {lang.nativeName}
                                    </Text>
                                    <Text style={[styles.langLabel, { color: isDark ? '#FFFFFF' : theme.colors.paragraphText }]}>
                                        {lang.label}
                                    </Text>
                                </View>
                                {currentLanguage === lang.value && (
                                    <Ionicons name="checkmark-circle-outline" size={ms(24)} color={isDark ? '#FFFFFF' : theme.colors.primary} />
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
            <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : theme.colors.primary }]}>{title.toUpperCase()}</Text>
            <View style={styles.sectionContent}>
                {children}
            </View>
        </Animated.View>
    );
};

const Item = ({ icon, label, onPress, danger, theme, value, isDark }: any) => (
    <TouchableOpacity
        style={[styles.item, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
        onPress={onPress}
        activeOpacity={0.7}
    >
        <View style={styles.left}>
            <View style={[
                styles.iconContainer,
                {
                    backgroundColor: danger ? (isDark ? 'rgba(239,68,68,0.1)' : '#FEF2F2') : (isDark ? 'rgba(255,255,255,0.05)' : theme.colors.background),
                    borderColor: danger ? (isDark ? 'rgba(239,68,68,0.2)' : '#FEE2E2') : (isDark ? 'rgba(255,255,255,0.1)' : theme.colors.border + '30')
                }
            ]}>
                <Ionicons
                    name={icon}
                    size={ms(20)}
                    color={danger ? '#EF4444' : (isDark ? '#FFFFFF' : theme.colors.primary)}
                />
            </View>
            <View style={styles.textContainer}>
                <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={[
                        styles.itemText,
                        { color: isDark ? '#FFFFFF' : theme.colors.text },
                        danger && { color: '#EF4444', fontWeight: '600' },
                    ]}
                >
                    {label}
                </Text>
                {value && (
                    <Text 
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={[styles.itemSubText, { color: isDark ? '#FFFFFF' : theme.colors.paragraphText }]}
                    >
                        {value}
                    </Text>
                )}
            </View>
        </View>
        {!danger && (
            <Ionicons name="chevron-forward" size={ms(18)} color={isDark ? '#FFFFFF' : theme.colors.border} />
        )}
    </TouchableOpacity>
);

const SwitchItem = ({ icon, label, value, onChange, theme, isDark }: any) => (
    <View style={[styles.item, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
        <View style={styles.left}>
            <View style={[
                styles.iconContainer,
                {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.colors.background,
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : theme.colors.border + '30'
                }
            ]}>
                <Ionicons name={icon} size={ms(20)} color={isDark ? '#FFFFFF' : theme.colors.primary} />
            </View>
            <View style={styles.textContainer}>
                <Text 
                    numberOfLines={1} 
                    ellipsizeMode="tail"
                    style={[styles.itemText, { color: isDark ? '#FFFFFF' : theme.colors.text }]}
                >
                    {label}
                </Text>
            </View>
        </View>
        <Switch
            value={value}
            onValueChange={onChange}
            trackColor={{ false: isDark ? '#374151' : '#E5E7EB', true: theme.colors.primary }}
            thumbColor={value ? '#FFFFFF' : (isDark ? '#9CA3AF' : '#f4f3f4')}
            ios_backgroundColor={isDark ? '#374151' : '#3e3e3e'}
            style={{ transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] }}
        />
    </View>
);

/* ================= STYLES ================= */

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
    },
    premiumHeader: {
        width: width,
        paddingBottom: vs(20),
        borderBottomLeftRadius: ms(24),
        borderBottomRightRadius: ms(24),
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: ms(20),
        paddingTop: vs(20),
    },
    backButton: {
        width: ms(40),
        height: ms(40),
        borderRadius: ms(20),
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    premiumHeaderTitle: {
        fontSize: ms(22),
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: -0.5,
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
        fontSize: ms(12),
        fontWeight: '800',
        marginBottom: vs(12),
        marginLeft: ms(4),
        letterSpacing: 1.2,
        opacity: 0.6,
    },
    sectionContent: {
        // Premium list view - refined borders and separators
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: vs(14),
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.03)',
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: ms(42),
        height: ms(42),
        borderRadius: ms(14),
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        marginRight: ms(16),
    },
    textContainer: {
        flex: 1,
    },
    itemText: {
        fontSize: ms(16),
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    itemSubText: {
        fontSize: ms(13),
        marginTop: vs(2),
        fontWeight: '400',
    },
    footer: {
        alignItems: 'center',
        marginTop: vs(20),
        paddingTop: vs(20),
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.03)',
    },
    versionText: {
        fontSize: ms(12),
        fontWeight: '500',
        opacity: 0.4,
    },
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
