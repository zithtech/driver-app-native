import React from 'react';
import { View, Text, StyleSheet, Pressable, StatusBar, Dimensions, ImageBackground } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../context/ThemeContext';
import { Dashboard_Nav } from '../../Navigations/navigations';

const RED_COLOR = '#E53935';
const LIGHT_RED = '#FFF0F0';
const { width } = Dimensions.get('window');

const PaymentFailedScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { theme, isDark } = useAppTheme();

  const styles = getStyles(theme, isDark);

  const amount = route.params?.amount || 0;
  const planName = route.params?.planName;
  const returnScreen = route.params?.returnScreen || 'WalletScreen';
  const transactionId = route.params?.transactionId;
  
  const [isRetrying, setIsRetrying] = React.useState(false);

  const handleTryAgain = async () => {
    if (route.params?.onRetry) {
      setIsRetrying(true);
      try {
        await route.params.onRetry();
      } catch (e) {
        setIsRetrying(false);
      }
    } else {
      navigation.replace(returnScreen);
    }
  };

  const handleBackToHome = () => {
    if (route.params?.onRetry) {
      navigation.goBack();
    } else {
      navigation.reset({
        index: 0,
        routes: [{ name: Dashboard_Nav }],
      });
    }
  };

  // Format current date exactly as in mockup: 05 Aug 2025, 09:41 AM
  const now = new Date();
  const day = now.getDate().toString().padStart(2, '0');
  const month = now.toLocaleString('en-US', { month: 'short' });
  const year = now.getFullYear();
  const time = now.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const dateStr = `${day} ${month} ${year}, ${time}`;

  return (
    <ImageBackground 
      source={require('../../assets/images/faild.png')} 
      style={styles.container}
      resizeMode="cover"
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      
      <View 
        style={[styles.content, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 12) }]}
      >
        {/* Animated/Layered Icon */}
        <View style={styles.iconSection}>
          <View style={styles.circleOuter}>
            <View style={styles.circleMiddle}>
              <View style={styles.circleInner}>
                <View style={styles.iconCircle}>
                  <Ionicons name="close" size={24} color="#FFF" />
                </View>
              </View>
            </View>
          </View>
          
          {/* Floating decorative elements */}
          {/* Left side */}
          <Ionicons name="ellipse" size={6} color={RED_COLOR} style={{ position: 'absolute', top: 20, left: '26%' }} />
          <Ionicons name="close" size={10} color="#FFBDBD" style={{ position: 'absolute', top: '45%', left: '16%' }} />
          <Ionicons name="close" size={8} color="#FFBDBD" style={{ position: 'absolute', bottom: 20, left: '28%' }} />
          
          {/* Right side */}
          <Ionicons name="close" size={12} color="#FFBDBD" style={{ position: 'absolute', top: 20, right: '24%' }} />
          <Ionicons name="ellipse" size={8} color={RED_COLOR} style={{ position: 'absolute', top: '45%', right: '16%' }} />
          <Ionicons name="ellipse" size={4} color="#FFBDBD" style={{ position: 'absolute', bottom: 30, right: '30%' }} />
        </View>

        {/* Title & Subtitle */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>
            {t('Payment ')}<Text style={{ color: RED_COLOR }}>{t('Failed')}</Text>
          </Text>
          <Text style={styles.subtitle}>
            {t("We couldn't complete your payment.\nPlease try again or choose another payment method.")}
          </Text>
        </View>

        {/* Details Card */}
        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('Amount')}</Text>
            <Text style={styles.detailValue}>₹{Number(amount).toFixed(2)}</Text>
          </View>
          
          {!!planName && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('Plan')}</Text>
              <Text style={styles.detailValue}>{planName}</Text>
            </View>
          )}

          <View style={[styles.detailRow, !transactionId && { borderBottomWidth: 0, paddingBottom: 0 }]}>
            <Text style={styles.detailLabel}>{t('Date & Time')}</Text>
            <Text style={styles.detailValue}>{dateStr}</Text>
          </View>

          {!!transactionId && (
            <View style={[styles.detailRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
              <Text style={styles.detailLabel}>{t('Transaction ID')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.detailValue, { color: RED_COLOR, marginRight: 6 }]}>{transactionId}</Text>
                <Ionicons name="copy-outline" size={14} color={RED_COLOR} />
              </View>
            </View>
          )}
        </View>

        {/* Alert Box */}
        <View style={styles.alertBox}>
          <View style={styles.alertIconContainer}>
            <Ionicons name="shield-outline" size={20} color={RED_COLOR} />
          </View>
          <View style={styles.alertTextContainer}>
            <Text style={styles.alertTitle}>{t('Why did this happen?')}</Text>
            <Text style={styles.alertSubtitle}>
              {t('Your bank may have declined the transaction, insufficient balance, or a temporary issue. Please check and try again.')}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <Pressable 
            style={({ pressed }) => [styles.primaryButton, (pressed || isRetrying) && { opacity: 0.8 }]} 
            onPress={handleTryAgain}
            disabled={isRetrying}
          >
            <Ionicons name="refresh-outline" size={18} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={styles.primaryButtonText}>{isRetrying ? t('Retrying...') : t('Try Again')}</Text>
          </Pressable>
          
          <Pressable 
            style={({ pressed }) => [styles.tertiaryButton, pressed && { opacity: 0.8 }]} 
            onPress={handleBackToHome}
          >
            <Ionicons name="arrow-back" size={16} color={RED_COLOR} style={{ marginRight: 6 }} />
            <Text style={styles.tertiaryButtonText}>{route.params?.onRetry ? t('Go Back to Subscriptions') : t('Go Back to Home')}</Text>
          </Pressable>
        </View>
      </View>
    </ImageBackground>
  );
};

export default PaymentFailedScreen;

const getStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDark ? '#111217' : '#FAFAFA',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  iconSection: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
    marginBottom: 10,
  },
  circleOuter: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(239, 68, 68, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleMiddle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: RED_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: RED_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: isDark ? '#FFF' : '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  detailsCard: {
    backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0 : 0.04,
    shadowRadius: 12,
    elevation: isDark ? 0 : 2,
    borderWidth: 1,
    borderColor: isDark ? theme.colors.border : 'rgba(0,0,0,0.03)',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  },
  detailLabel: {
    color: isDark ? '#9CA3AF' : '#6B7280',
    fontSize: 13,
    fontWeight: '500',
  },
  detailValue: {
    color: isDark ? '#FFF' : '#1A1A1A',
    fontSize: 13,
    fontWeight: '600',
  },
  alertBox: {
    flexDirection: 'row',
    backgroundColor: isDark ? '#2A1A1E' : LIGHT_RED,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  alertIconContainer: {
    marginRight: 10,
    marginTop: 2,
    position: 'relative',
  },

  alertTextContainer: {
    flex: 1,
  },
  alertTitle: {
    color: RED_COLOR,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  alertSubtitle: {
    color: isDark ? '#D1D5DB' : '#4B5563',
    fontSize: 12,
    lineHeight: 16,
  },
  actionsContainer: {
    marginTop: 4,
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: RED_COLOR,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  tertiaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  tertiaryButtonText: {
    color: RED_COLOR,
    fontSize: 14,
    fontWeight: '600',
  }
});
