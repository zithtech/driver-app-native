import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ImageBackground,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootState } from '../../redux/store';
import { useCreateWalletTopupOrderMutation, useVerifyWalletTopupPaymentMutation } from '../../service/driverApi';
import RazorpayCheckout from 'react-native-razorpay';
import Config from 'react-native-config';
import { useAlert } from '../../context/AlertContext';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../context/ThemeContext';
import AppStatusBar from '../../Components/AppStatusBar';

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000];

const AddMoneyScreen = ({ navigation, route }: any) => {
  const { isDark } = useAppTheme();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  
  const user = useSelector((state: RootState) => state.userSlice.user);
  const driverId = user?.driverId || '';
  
  // Accept balance passed from WalletScreen for fast display
  const balance = route.params?.balance || 0;

  const [topupAmount, setTopupAmount] = useState('');
  const [createOrder, { isLoading: isCreating }] = useCreateWalletTopupOrderMutation();
  const [verifyPayment, { isLoading: isVerifying }] = useVerifyWalletTopupPaymentMutation();

  const handleTopup = async () => {
    const amount = Number(topupAmount);
    if (amount < 100) {
      showAlert({ title: 'Minimum Amount', message: 'Minimum topup amount is ₹100', singleButton: true, icon: 'alert-circle-outline' });
      return;
    }
    
    try {
      const orderResult = await createOrder({ driverId, amount }).unwrap();
      const options = {
        description: 'Wallet Topup',
        image: Image.resolveAssetSource(require('../../assets/images/applogo.png')).uri,
        currency: orderResult.data?.currency || 'INR',
        key: Config.RAZORPAY_KEY_ID || 'rzp_test_SCjewpaZ96XBWa',
        amount: orderResult.data?.amount || String(amount * 100),
        name: 'T2drive',
        order_id: orderResult.data?.id,
        prefill: { email: user?.email || '', contact: user?.phone_number || '', name: user?.full_name || '' },
        theme: { color: '#2563eb' }
      };
      
      const data = await RazorpayCheckout.open(options);
      
      const verifyRes = await verifyPayment({
        driverId, 
        amount, 
        razorpay_order_id: data.razorpay_order_id || '', 
        razorpay_payment_id: data.razorpay_payment_id || '', 
        razorpay_signature: data.razorpay_signature || ''
      }).unwrap();
      
      if (verifyRes.success) {
        navigation.replace('WalletSuccessScreen', { 
            amount, 
            transactionId: data.razorpay_payment_id, 
            orderId: data.razorpay_order_id, 
            date: new Date().toISOString() 
        });
      }
    } catch (error: any) {
      const errorMsg = error?.message || error?.error?.description || error?.description || (typeof error === 'string' ? error : 'Payment cancelled or failed');
      navigation.replace('PaymentFailedScreen', { amount, returnScreen: 'AddMoneyScreen', errorReason: errorMsg });
    }
  };

  const isLoading = isCreating || isVerifying;

  return (
    <ImageBackground source={require('../../assets/images/walletback.png')} style={[styles.container, { backgroundColor: isDark ? '#111827' : '#fafafa' }]}>
      <AppStatusBar backgroundColor="transparent" barStyle={isDark ? "light-content" : "dark-content"} />
      
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={isDark ? "#ffffff" : "#0f172a"} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: isDark ? "#ffffff" : "#0f172a" }]}>Add Money</Text>
        </View>
        <Pressable>
          <Ionicons name="help-circle-outline" size={24} color={isDark ? "#ffffff" : "#0f172a"} />
        </Pressable>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
            contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
        >
          <View style={styles.heroSection}>
            <View style={[styles.balanceCard, { backgroundColor: isDark ? '#1F2937' : '#ffffff' }]}>
              <Text style={[styles.balanceLabel, { color: isDark ? '#9ca3af' : '#64748b' }]}>Wallet Balance</Text>
              <View style={styles.balanceValueContainer}>
                <Text style={[styles.currencySymbol, { color: isDark ? '#ffffff' : '#0f172a' }]}>₹</Text>
                <Text style={[styles.balanceValue, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                  {Math.floor(balance).toLocaleString('en-IN')}
                </Text>
                <Text style={[styles.balanceDecimal, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                  .{(balance % 1).toFixed(2).substring(2) || '00'}
                </Text>
              </View>
              
              <View style={styles.secureBadge}>
                <Ionicons name="shield-checkmark" size={12} color="#16a34a" />
                <Text style={styles.secureBadgeText}>100% Secure Payments</Text>
              </View>
            </View>
          </View>

          <View style={styles.contentSection}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>Enter Amount</Text>
            
            <View style={[styles.inputContainer, { backgroundColor: isDark ? '#1F2937' : '#ffffff', borderColor: isDark ? '#374151' : '#22c55e' }]}>
              <Text style={[styles.inputPrefix, { color: '#22c55e' }]}>₹</Text>
              <TextInput
                style={[styles.input, { color: isDark ? '#ffffff' : '#0f172a' }]}
                value={topupAmount}
                onChangeText={setTopupAmount}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={isDark ? '#6b7280' : '#94a3b8'}
              />
            </View>
            <Text style={[styles.minAmountText, { color: isDark ? '#9ca3af' : '#64748b' }]}>Minimum amount is ₹100</Text>

            <Text style={[styles.sectionTitle, { color: isDark ? '#ffffff' : '#0f172a', marginTop: 16 }]}>Quick Amount</Text>
            
            <View style={styles.quickGrid}>
              {QUICK_AMOUNTS.map((amt, idx) => {
                const isSelected = topupAmount === String(amt);
                return (
                  <Pressable
                    key={idx}
                    style={[
                      styles.quickBtn,
                      { backgroundColor: isDark ? '#1F2937' : '#ffffff', borderColor: isDark ? '#374151' : '#e2e8f0' },
                      isSelected && { backgroundColor: isDark ? 'rgba(34,197,94,0.1)' : '#f0fdf4', borderColor: '#22c55e' }
                    ]}
                    onPress={() => setTopupAmount(String(amt))}
                  >
                    <Text style={[
                      styles.quickBtnText, 
                      { color: isDark ? '#e5e7eb' : '#0f172a' },
                      isSelected && { color: '#16a34a' }
                    ]}>₹{amt.toLocaleString('en-IN')}</Text>
                  </Pressable>
                );
              })}
              
              <Pressable
                style={[styles.quickBtn, { backgroundColor: isDark ? '#1F2937' : '#ffffff', borderColor: isDark ? '#374151' : '#e2e8f0' }]}
              >
                <Ionicons name="pencil-outline" size={14} color="#16a34a" style={{ marginRight: 4 }} />
                <Text style={[styles.quickBtnText, { color: isDark ? '#e5e7eb' : '#0f172a' }]}>Other</Text>
              </Pressable>
            </View>
            
            <View style={[styles.footerBanner, { backgroundColor: isDark ? '#1F2937' : '#f0fdf4' }]}>
               <Ionicons name="shield-checkmark" size={24} color="#16a34a" />
               <View style={styles.footerBannerContent}>
                 <Text style={styles.footerBannerTitle}>100% Secure Payments</Text>
                 <Text style={[styles.footerBannerSub, { color: isDark ? '#9ca3af' : '#64748b' }]}>Your money is safe with us.</Text>
               </View>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.bottomAction, { paddingBottom: insets.bottom + 16, backgroundColor: isDark ? '#111827' : '#fafafa' }]}>
        <Pressable 
            style={({ pressed }) => [
                styles.primaryBtn,
                pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
            ]}
            onPress={handleTopup}
            disabled={isLoading}
        >
            <Text style={styles.primaryBtnText}>{isLoading ? 'Processing...' : 'Proceed to Pay'}</Text>
            {!isLoading && <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />}
        </Pressable>
      </View>
    </ImageBackground>
  );
};

export default AddMoneyScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    marginRight: 16,
    padding: 8,
    marginLeft: -8,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },
  balanceCard: {
    width: '90%',
    borderRadius: 16,
    padding: 12,
    marginTop: 65,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  balanceLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  balanceValueContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
    marginRight: 2,
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  balanceDecimal: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  secureBadgeText: {
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '600',
    marginLeft: 6,
  },
  contentSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
  },
  inputPrefix: {
    fontSize: 20,
    fontWeight: '600',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
  },
  minAmountText: {
    fontSize: 12,
    marginTop: 4,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  quickBtn: {
    width: '30%',
    height: 40,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  quickBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
  },
  footerBannerContent: {
    marginLeft: 12,
  },
  footerBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#16a34a',
    marginBottom: 2,
  },
  footerBannerSub: {
    fontSize: 13,
  },
  bottomAction: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  primaryBtn: {
    backgroundColor: '#65a30d',
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
