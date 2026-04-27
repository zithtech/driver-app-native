import React from 'react';
import { View, StyleSheet, SafeAreaView, TouchableOpacity, Image } from 'react-native';
import AppStatusBar from '../../Components/AppStatusBar';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../redux/store';
import { Text } from '../../Components';
import colors from '../../constant/colors';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { clearUser } from '../../redux/userSlice';
import { useTranslation } from 'react-i18next';

const BlockedScreen = () => {
    const user = useSelector((state: RootState) => state.userSlice.user);
    const dispatch = useDispatch();
    const { t } = useTranslation();

    const isBlocked = user?.status === 'blocked';
    const reason = user?.status_reason || 'No specific reason provided by administrator.';

    const handleLogout = () => {
        dispatch(clearUser());
    };

    return (
        <SafeAreaView style={styles.container}>
            <AppStatusBar forceDark />
            <View style={styles.content}>
                <View style={[styles.iconContainer, { backgroundColor: isBlocked ? '#FEF2F2' : '#FFF7ED' }]}>
                    <Ionicons 
                        name={isBlocked ? "ban" : "time"} 
                        size={80} 
                        color={isBlocked ? colors.error : "#F97316"} 
                    />
                </View>

                <Text style={styles.title}>
                    {isBlocked ? 'Account Blocked' : 'Account Suspended'}
                </Text>

                <Text style={styles.description}>
                    {isBlocked 
                        ? 'Your access to the vDrive platform has been restricted due to account violations.' 
                        : 'Your account is temporarily under suspension and cannot perform activities.'}
                </Text>

                <View style={styles.reasonCard}>
                    <Text style={styles.reasonLabel}>Reason for Restriction:</Text>
                    <Text style={styles.reasonText}>{reason}</Text>
                </View>

                <View style={styles.infoBox}>
                    <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
                    <Text style={styles.infoText}>
                        If you believe this is a mistake, please contact our administrative support team.
                    </Text>
                </View>

                <View style={styles.buttonContainer}>
                    <TouchableOpacity 
                        style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                        onPress={() => {/* In real app, trigger support chat or phone call */}}
                    >
                        <Ionicons name="chatbubbles-outline" size={20} color="white" style={{ marginRight: 8 }} />
                        <Text style={styles.buttonText}>Contact Support</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.logoutButton}
                        onPress={handleLogout}
                    >
                        <Text style={styles.logoutText}>Logout</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    iconContainer: {
        width: 140,
        height: 140,
        borderRadius: 70,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        color: colors.text,
        marginBottom: 12,
        textAlign: 'center',
    },
    description: {
        fontSize: 16,
        color: colors.paragraphText,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    reasonCard: {
        width: '100%',
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 24,
    },
    reasonLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: colors.primary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
    },
    reasonText: {
        fontSize: 15,
        color: colors.text,
        lineHeight: 22,
        fontWeight: '500',
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EFF6FF',
        padding: 12,
        borderRadius: 12,
        marginBottom: 40,
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        color: colors.primary,
        marginLeft: 8,
    },
    buttonContainer: {
        width: '100%',
        gap: 16,
    },
    primaryButton: {
        width: '100%',
        height: 56,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    logoutButton: {
        width: '100%',
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoutText: {
        color: colors.error,
        fontSize: 15,
        fontWeight: '600',
    }
});

export default BlockedScreen;
