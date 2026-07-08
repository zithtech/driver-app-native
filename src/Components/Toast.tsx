import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import Animated, {
  FadeInUp,
  FadeOutUp,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useToast } from '../context/ToastContext';
import { hS as s, vS as vs, mS as ms } from '../lib/scale';

const Toast: React.FC = () => {
  const { isVisible, toastConfig, hideToast } = useToast();
  const insets = useSafeAreaInsets();

  if (!isVisible || !toastConfig) return null;

  const { message, type = 'info' } = toastConfig;

  const getToastStyles = () => {
    switch (type) {
      case 'success':
        return {
          icon: 'check-circle',
          iconColor: '#34C759', // Minimal green
        };
      case 'error':
        return {
          icon: 'alert-circle',
          iconColor: '#FF3B30', // Minimal red
        };
      case 'info':
      default:
        return {
          icon: 'information',
          iconColor: '#0A84FF', // Minimal blue
        };
    }
  };

  const config = getToastStyles();

  return (
    <Animated.View
      entering={FadeInUp.springify().damping(15)}
      exiting={FadeOutUp.duration(300)}
      style={[
        styles.container,
        {
          top: insets.top + vs(10),
        },
      ]}
    >
      <Pressable onPress={hideToast} style={styles.content}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons name={config.icon} size={ms(20)} color={config.iconColor} />
        </View>
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 9999,
    backgroundColor: 'rgba(28, 28, 30, 0.95)', // Sleek dark aesthetic
    borderRadius: 100, // Pill shape
    paddingVertical: vs(10),
    paddingHorizontal: ms(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    maxWidth: '90%', // Prevent it from stretching full width on long texts
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: ms(8),
  },
  message: {
    fontSize: ms(14),
    fontWeight: '600',
    color: '#FFFFFF', // Crisp white text
    lineHeight: vs(20),
  },
});

export default Toast;
