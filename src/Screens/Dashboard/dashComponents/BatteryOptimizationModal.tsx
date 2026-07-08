import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform, Linking, TouchableWithoutFeedback } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../../context/ThemeContext';
import { hS as s, vS as vs, mS as ms } from '../../../lib/scale';

interface Props {
    visible: boolean;
    onClose: () => void;
    onFix: () => void;
}

const BatteryOptimizationModal: React.FC<Props> = ({ visible, onClose, onFix }) => {
    const { theme, isDark } = useAppTheme();
    const { t } = useTranslation();

    const handleFix = () => {
        if (Platform.OS === 'android') {
            Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS').catch(() => {
                Linking.openSettings();
            });
            onFix();
        }
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                <TouchableWithoutFeedback>
                    <View style={[styles.modalContent, isDark && { backgroundColor: '#1E293B' }]}>
                        
                        <View style={[styles.batteryCard, isDark && { backgroundColor: '#450a0a', borderLeftColor: '#ef4444' }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: vs(8) }}>
                                <Ionicons name="battery-dead-outline" size={ms(24)} color="#EF4444" />
                                <View style={{ marginLeft: ms(8) }}>
                                    <Text style={[styles.batteryTitle, isDark && { color: '#FECACA' }]}>Background Priority</Text>
                                    <Text style={[styles.batterySub, isDark && { color: '#FCA5A5' }]}>App may reload in background</Text>
                                </View>
                            </View>
                            
                            <Text style={[styles.batteryText, isDark && { color: '#FEE2E2' }]}>
                                To receive ride requests reliably, please change the battery setting for vDrive to "Unrestricted" or "Don't Optimize".
                            </Text>
                            
                            <TouchableOpacity style={styles.batteryBtn} onPress={handleFix}>
                                <Text style={styles.batteryBtnText}>Fix Now</Text>
                            </TouchableOpacity>
                        </View>

                    </View>
                </TouchableWithoutFeedback>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: s(20),
    },
    modalContent: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: ms(16),
        overflow: 'hidden',
    },
    batteryCard: {
        backgroundColor: '#FFF4F4', // Light red background matching screenshot
        padding: ms(20),
        borderRadius: ms(16),
        // Removed borderLeftColor as screenshot doesn't show left border, it's a solid card
    },
    batteryTitle: {
        fontSize: ms(18),
        fontWeight: '700',
        color: '#991B1B',
    },
    batterySub: {
        fontSize: ms(13),
        color: '#B91C1C',
        marginTop: vs(2),
    },
    batteryText: {
        fontSize: ms(14),
        color: '#7F1D1D',
        marginTop: vs(12),
        lineHeight: 22,
    },
    batteryBtn: {
        backgroundColor: '#EF4444',
        paddingVertical: vs(12),
        borderRadius: ms(8),
        alignItems: 'center',
        marginTop: vs(16),
    },
    batteryBtnText: {
        color: '#FFFFFF',
        fontSize: ms(15),
        fontWeight: '700',
    },
});

export default BatteryOptimizationModal;
