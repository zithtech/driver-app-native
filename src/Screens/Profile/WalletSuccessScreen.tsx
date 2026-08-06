import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, StatusBar, BackHandler } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import moment from 'moment';
import Share from 'react-native-share';
import RNPrint from 'react-native-print';
import { SuccessIcon } from '../../assets/svg';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';

const BG_COLOR = '#F9FAFB';
const BLUE_PRIMARY = '#1D7AF2';
const TEXT_DARK = '#0F172A';
const TEXT_MUTED = '#64748B';
const CARD_BG = '#FFFFFF';
const BORDER_COLOR = '#E2E8F0';

const WalletSuccessScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  
  const { amount = 0, transactionId = '', orderId = '', date = new Date().toISOString() } = route.params || {};

  const user = useSelector((state: RootState) => state.userSlice?.user);

  const displayAmount = Number(amount).toFixed(2);
  
  // Animations
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 40,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  useEffect(() => {
    const backAction = () => {
      navigation.replace('WalletScreen');
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => backHandler.remove();
  }, [navigation]);

  const handleShareReceipt = async () => {
    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; }
            .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
            .logo { font-size: 36px; font-weight: 800; color: #1D7AF2; letter-spacing: -1px; }
            .title { font-size: 16px; color: #64748B; margin-top: 10px; text-transform: uppercase; letter-spacing: 2px; }
            .content { width: 100%; max-width: 600px; margin: 0 auto; }
            .row { display: flex; justify-content: space-between; border-bottom: 1px solid #f0f0f0; padding: 18px 0; font-size: 16px; }
            .label { font-weight: 500; color: #64748B; }
            .value { font-weight: 700; color: #0F172A; text-align: right; }
            .amount-row { font-size: 20px; border-bottom: 2px solid #333; margin-top: 20px; }
            .amount-row .value { color: #1D7AF2; font-size: 28px; }
            .footer { text-align: center; margin-top: 60px; color: #94A3B8; font-size: 14px; line-height: 1.6; }
            .badge { background: #10B981; color: white; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
          </style>
        </head>
        <body>
          <div class="content">
            <div class="header">
              <div class="logo">T2drive</div>
              <div class="title">Wallet Recharge Receipt</div>
            </div>
            
            <div class="row" style="border: none; padding-bottom: 5px;">
              <span class="label">Status</span>
              <span class="value"><span class="badge">Recharge Successful</span></span>
            </div>

            <div class="row">
              <span class="label">Date</span>
              <span class="value">${moment(date).format('MMM D, YYYY, h:mm A')}</span>
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
              <span class="label">Billed To</span>
              <span class="value">${user?.full_name || 'Driver'}<br><span style="font-size:14px; color:#666; font-weight: 500;">${user?.phone_number || ''}</span></span>
            </div>
            <div class="row">
              <span class="label">Payment Method</span>
              <span class="value">Online</span>
            </div>
            
            <div class="row amount-row">
              <span class="label" style="color: #0F172A; align-self: center;">Amount Recharged</span>
              <span class="value">₹${displayAmount}</span>
            </div>
            
            <div class="footer">
              Thank you for recharging your T2drive wallet!<br>
              This is a computer generated receipt and does not require a physical signature.<br><br>
              <strong>Need help?</strong> Contact support in the T2drive app.
            </div>
          </div>
        </body>
        </html>
      `;
      
      await RNPrint.print({
        html: htmlContent,
        jobName: `T2drive_Wallet_Receipt_${transactionId || 'Recharge'}`,
      });
    } catch (error) {
      console.log('Print dismissed or failed', error);
    }
  };

  const handleGoToWallet = () => {
    navigation.replace('WalletScreen');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
        <View style={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        
        {/* Animated Checkmark */}
        <Animated.View style={[styles.animationContainer, { transform: [{ scale: scaleAnim }] }]}>
          <SuccessIcon width={120} height={120} />
        </Animated.View>

        {/* Header Texts */}
        <Animated.View style={[styles.headerTexts, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.title}>Payment successful</Text>
          <Text style={styles.subtitle}>
            Your wallet has been topped up successfully and a receipt has been sent to your email.
          </Text>
        </Animated.View>

        {/* Details Card */}
        <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          
          <View style={styles.cardHeader}>
            <Ionicons name="receipt-outline" size={18} color={TEXT_MUTED} />
            <Text style={styles.cardHeaderTitle}>Transaction details</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.amountSection}>
            <Text style={styles.amountLabel}>Amount paid</Text>
            <Text style={styles.amountValue}>₹{displayAmount}</Text>
          </View>

          <View style={styles.detailsList}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Merchant</Text>
              <Text style={styles.detailValue}>T2drive</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Transaction ID</Text>
              <Text style={styles.detailValue} selectable>{transactionId || 'N/A'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date & time</Text>
              <Text style={styles.detailValue}>{moment(date).format('MMM D, YYYY, h:mm A')} UTC</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Payment method</Text>
              <Text style={styles.detailValue}>Online</Text>
            </View>
          </View>

        </Animated.View>

        {/* Action Buttons */}
        <Animated.View style={[styles.actions, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          
          <Pressable 
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.8 }]} 
            onPress={handleGoToWallet}
          >
            <Ionicons name="wallet-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryBtnText}>Back to Wallet</Text>
          </Pressable>
          
          <Pressable 
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]} 
            onPress={handleShareReceipt}
          >
            <Ionicons name="share-social-outline" size={20} color={TEXT_DARK} style={{ marginRight: 8 }} />
            <Text style={styles.secondaryBtnText}>Share receipt</Text>
          </Pressable>

        </Animated.View>

        </View>
    </SafeAreaView>
  );
};

export default WalletSuccessScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_COLOR,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  animationContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTexts: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT_DARK,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: TEXT_MUTED,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderTitle: {
    marginLeft: 8,
    fontSize: 14,
    color: TEXT_MUTED,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: BORDER_COLOR,
    marginBottom: 16,
  },
  amountSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  amountLabel: {
    fontSize: 13,
    color: TEXT_MUTED,
    fontWeight: '500',
    marginBottom: 6,
  },
  amountValue: {
    fontSize: 30,
    fontWeight: '800',
    color: TEXT_DARK,
    letterSpacing: -1,
  },
  detailsList: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: TEXT_MUTED,
  },
  detailValue: {
    fontSize: 13,
    color: TEXT_DARK,
    fontWeight: '600',
  },
  actions: {
    gap: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    backgroundColor: BLUE_PRIMARY,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    flexDirection: 'row',
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: TEXT_DARK,
    fontSize: 16,
    fontWeight: '700',
  }
});
