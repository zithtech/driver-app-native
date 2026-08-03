import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ConfettiCannon from 'react-native-confetti-cannon';
import RNPrint from 'react-native-print';
import AppStatusBar from '../../Components/AppStatusBar';
import { useAppTheme } from '../../context/ThemeContext';

const { width } = Dimensions.get('window');

const WalletSuccessScreen = ({ route, navigation }: any) => {
  const { theme, isDark } = useAppTheme();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  
  const { amount = 0, transactionId = '', orderId = '', date = new Date().toISOString() } = route.params || {};

  const handleDownloadReceipt = async () => {
    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #1e293b; background-color: #f8fafc; }
            .receipt-card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; }
            .header { text-align: center; margin-bottom: 30px; }
            .logo-text { font-size: 28px; font-weight: 800; color: #1e3a8a; letter-spacing: -1px; }
            .success-text { color: #10b981; font-size: 24px; font-weight: bold; margin-top: 10px; }
            .amount { font-size: 48px; font-weight: bold; text-align: center; margin: 20px 0; color: #0f172a; }
            .divider { border-top: 2px dashed #cbd5e1; margin: 30px 0; }
            .row { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 16px; }
            .label { color: #64748b; }
            .value { font-weight: 600; color: #0f172a; }
            .footer { text-align: center; margin-top: 40px; color: #94a3b8; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="receipt-card">
            <div class="header">
              <div class="logo-text">T2drive</div>
              <div class="success-text">Payment Successful</div>
              <div style="color: #64748b; margin-top: 8px;">Your wallet has been topped up</div>
            </div>
            
            <div class="amount">₹${Number(amount).toLocaleString('en-IN')}</div>
            
            <div class="divider"></div>
            
            <div class="row">
              <span class="label">Date & Time</span>
              <span class="value">${new Date(date).toLocaleString()}</span>
            </div>
            <div class="row">
              <span class="label">Transaction ID</span>
              <span class="value">${transactionId || 'N/A'}</span>
            </div>
            <div class="row">
              <span class="label">Order ID</span>
              <span class="value">${orderId || 'N/A'}</span>
            </div>
            <div class="row">
              <span class="label">Payment Method</span>
              <span class="value">Online (Razorpay)</span>
            </div>
            
            <div class="footer">
              <p>Thank you for driving with T2drive!</p>
              <p>If you have any questions, please contact our support.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    try {
      await RNPrint.print({
        html,
        jobName: `T2drive_Receipt_${transactionId}`
      });
    } catch (error) {
      console.log('Error printing receipt', error);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <AppStatusBar />
      
      <ConfettiCannon
        count={150}
        origin={{ x: width / 2, y: -20 }}
        autoStart={true}
        fadeOut={true}
        fallSpeed={2500}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: isDark ? '#FFFFFF' : '#0f172a' }]}>Success</Text>
        </View>

        <View style={[styles.receiptCard, { backgroundColor: theme.colors.card, shadowColor: isDark ? '#000' : '#cbd5e1' }]}>
          {/* Top Section */}
          <View style={styles.cardTop}>
            <View style={styles.successIconWrap}>
              <Ionicons name="checkmark-sharp" size={40} color="#10B981" />
            </View>
            <Text style={[styles.successTitle, { color: isDark ? '#FFFFFF' : '#0f172a' }]}>Topup Successful!</Text>
            <Text style={[styles.successSubtitle, { color: isDark ? '#9CA3AF' : '#64748b' }]}>Your wallet balance has been updated.</Text>
            
            <Text style={[styles.amountText, { color: isDark ? '#FFFFFF' : '#0f172a' }]}>
              ₹{Number(amount).toLocaleString('en-IN')}
            </Text>
          </View>

          {/* Dashed Divider with Cutouts */}
          <View style={styles.dividerContainer}>
            <View style={[styles.cutout, styles.cutoutLeft, { backgroundColor: theme.colors.background }]} />
            <View style={styles.dashedLine} />
            <View style={[styles.cutout, styles.cutoutRight, { backgroundColor: theme.colors.background }]} />
          </View>

          {/* Bottom Section */}
          <View style={styles.cardBottom}>
            <Text style={[styles.detailsTitle, { color: isDark ? '#E5E7EB' : '#1e293b' }]}>Transaction Details</Text>
            
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: isDark ? '#9CA3AF' : '#64748b' }]}>Date</Text>
              <Text style={[styles.detailValue, { color: isDark ? '#F3F4F6' : '#0f172a' }]}>{new Date(date).toLocaleString()}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: isDark ? '#9CA3AF' : '#64748b' }]}>Transaction ID</Text>
              <Text style={[styles.detailValue, { color: isDark ? '#F3F4F6' : '#0f172a' }]} selectable>{transactionId || 'N/A'}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: isDark ? '#9CA3AF' : '#64748b' }]}>Order ID</Text>
              <Text style={[styles.detailValue, { color: isDark ? '#F3F4F6' : '#0f172a' }]} selectable>{orderId || 'N/A'}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: isDark ? '#9CA3AF' : '#64748b' }]}>Status</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>Completed</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.actionsContainer}>
          <Pressable 
            style={({ pressed }) => [styles.downloadBtn, isDark && { borderColor: '#4B5563' }, pressed && { opacity: 0.7 }]} 
            onPress={handleDownloadReceipt}
          >
            <Ionicons name="download-outline" size={20} color={isDark ? '#FFFFFF' : '#1e3a8a'} style={{ marginRight: 8 }} />
            <Text style={[styles.downloadBtnText, { color: isDark ? '#FFFFFF' : '#1e3a8a' }]}>Download Receipt</Text>
          </Pressable>

          <Pressable 
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.8 }]} 
            onPress={() => navigation.navigate('WalletScreen')}
          >
            <Text style={styles.primaryBtnText}>Back to Wallet</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default WalletSuccessScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  receiptCard: {
    borderRadius: 16,
    marginTop: 20,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  cardTop: {
    padding: 32,
    alignItems: 'center',
  },
  successIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  amountText: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 1,
    marginVertical: 10,
    position: 'relative',
    overflow: 'visible',
  },
  dashedLine: {
    flex: 1,
    height: 1,
    borderTopWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    marginHorizontal: 16,
    opacity: 0.5,
  },
  cutout: {
    width: 24,
    height: 24,
    borderRadius: 12,
    position: 'absolute',
    top: -12,
    zIndex: 10,
  },
  cutoutLeft: {
    left: -12,
  },
  cutoutRight: {
    right: -12,
  },
  cardBottom: {
    padding: 32,
    paddingTop: 24,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#16a34a',
    fontSize: 12,
    fontWeight: '700',
  },
  actionsContainer: {
    marginTop: 40,
    gap: 16,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: 'transparent',
  },
  downloadBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
