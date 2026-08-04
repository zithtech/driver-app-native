import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppTheme } from '../../context/ThemeContext';
import AppStatusBar from '../../Components/AppStatusBar';

const PaymentFailedScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isDark } = useAppTheme();

  const amount = route.params?.amount || 0;
  const returnScreen = route.params?.returnScreen || 'WalletScreen';
  const customMessage = route.params?.errorReason;

  const handleCancel = () => {
    navigation.replace(returnScreen);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#111827' : '#FFFFFF' }]} edges={['top', 'bottom', 'left', 'right']}>
      <AppStatusBar forceLight={!isDark} />
      
      {/* Top Amount */}
      <View style={styles.topContainer}>
        <Text style={[styles.amountText, { color: isDark ? '#F9FAFB' : '#111827' }]}>
          ₹{Number(amount).toFixed(2)}
        </Text>
      </View>

      {/* Middle Content */}
      <View style={styles.middleContainer}>
        <View style={styles.iconContainer}>
          <Ionicons name="alert-circle-outline" size={60} color="#DC2626" />
        </View>
        <Text style={[styles.title, { color: isDark ? '#F9FAFB' : '#111827' }]}>
          Payment failed
        </Text>
        <Text style={[styles.subtitle, { color: isDark ? '#9CA3AF' : '#4B5563' }]}>
          {customMessage ? customMessage : 'The payment could not be completed.\nPlease try again.'}
        </Text>

        <Pressable 
          style={({ pressed }) => [
            styles.cancelButton,
            { backgroundColor: isDark ? '#374151' : '#F3F4F6' },
            pressed && { opacity: 0.7 }
          ]} 
          onPress={handleCancel}
        >
          <Text style={styles.cancelButtonText}>Cancel payment</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

export default PaymentFailedScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topContainer: {
    paddingTop: 60,
    alignItems: 'center',
  },
  amountText: {
    fontSize: 36,
    fontWeight: '700',
  },
  middleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  cancelButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600',
  }
});
