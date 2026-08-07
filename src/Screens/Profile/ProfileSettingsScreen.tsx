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
    Platform,
    ToastAndroid,
} from 'react-native';

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
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
import { useSignOutMutation } from '../../service/userApi';
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
    const [signOut] = useSignOutMutation();

    const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);

    /* ================= HANDLERS ================= */

    const toggleLanguage = useCallback(async () => {
        triggerHaptic(HapticFeedbackTypes.notificationSuccess);
        
        const currentIndex = languagesList.findIndex(l => l.value === currentLanguage);
        const nextIndex = (currentIndex + 1) % languagesList.length;
        const nextLang = languagesList[nextIndex].value;

        dispatch(setUser({ language: nextLang }));
        i18n.changeLanguage(nextLang);
        
        if (Platform.OS === 'android') {
            ToastAndroid.show(t('language_changed'), ToastAndroid.SHORT);
        }

        if (user?.driverId) {
            try {
                await updateDriver({
                    id: user.driverId,
                    data: { language: nextLang }
                }).unwrap();
            } catch (err) {
                console.error('[Settings] Failed to persist language:', err);
            }
        }
    }, [currentLanguage, dispatch, triggerHaptic, t, user?.driverId, updateDriver]);

    const toggleVibration = useCallback(async (value: boolean) => {
        triggerHaptic(HapticFeedbackTypes.impactMedium);
        dispatch(setUser({ isVibrationEnabled: value }));
        
        if (Platform.OS === 'android') {
            ToastAndroid.show(value ? 'Vibration ON' : 'Vibration OFF', ToastAndroid.SHORT);
        }

        if (user?.driverId) {
            try {
                await updateDriver({
                    id: user.driverId,
                    data: { is_vibration_enabled: value }
                }).unwrap();
            } catch (err) {
            }
        }
    }, [dispatch, triggerHaptic, user?.driverId, updateDriver, t]);

    const handleLogout = () => {
        setIsLogoutModalVisible(true);
    };

    const confirmLogout = async () => {
        setIsLogoutModalVisible(false);
        setTimeout(async () => {
            try {
                if (user?.userId && user?.device_id) {
                    await signOut({ id: user.userId, device_id: user.device_id, role: 'driver' }).unwrap();
                }
                await logoutUser(dispatch);
                navigation.reset({
                    index: 0,
                    routes: [{ name: Auth_Nav }],
                });
            } catch (e) {
                console.error('[Settings] Error logging out', e);
            }
        }, 300);
    };

    const toggleTheme = () => {
        triggerHaptic(HapticFeedbackTypes.selection);
        const nextMode = themeMode === 'light' ? 'dark' : 'light';
        setThemeMode(nextMode);
        
        if (Platform.OS === 'android') {
            ToastAndroid.show(nextMode === 'dark' ? 'Dark Mode ON' : 'Dark Mode OFF', ToastAndroid.SHORT);
        }
    };
    
    // Screen background color
    const bgColor = theme.colors.background;

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
                        onPress={toggleLanguage}
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
            <View style={styles.sectionContent}>
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
                    size={ms(16)}
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
                <Animated.Text 
                    key={value} 
                    entering={FadeInDown.duration(300)}
                    numberOfLines={1} 
                    style={[styles.itemSubText, { color: isDark ? theme.colors.textMuted : '#6B7280' }]}
                >
                    {value}
                </Animated.Text>
            )}
            {!danger && (
                <Ionicons name="chevron-forward" size={ms(16)} color={isDark ? '#4B5563' : '#9CA3AF'} />
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
                <Ionicons name={icon} size={ms(16)} color={isDark ? '#FFFFFF' : '#4B5563'} />
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
        marginBottom: vs(16),
    },
    sectionTitle: {
        fontSize: ms(12),
        fontWeight: '600',
        marginBottom: vs(4),
        marginLeft: ms(12),
        textTransform: 'uppercase',
    },
    sectionContent: {
        overflow: 'hidden',
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: vs(8),
        paddingHorizontal: ms(12),
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: ms(28),
        height: ms(28),
        borderRadius: ms(6),
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: ms(10),
    },
    textContainer: {
        flex: 1,
    },
    itemText: {
        fontSize: ms(14),
        fontWeight: '500',
    },
    right: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ms(6),
    },
    itemSubText: {
        fontSize: ms(14),
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
});

export default ProfileSettingsScreen;
