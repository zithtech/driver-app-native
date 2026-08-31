import React from 'react';
import {
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  TouchableOpacityProps,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { Styles } from '../lib/styles';

interface ButtonProps extends TouchableOpacityProps {
  labelStyle?: TextStyle | TextStyle[];
  loading?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  labelStyle,
  style,
  disabled,
  onPress,
  loading,
  ...rest
}) => {
  const { colors }: any = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled || loading}
      onPress={disabled || loading ? undefined : onPress}
      style={[
        Styles.alignItemsCenter,
        Styles.justifyContentCenter,
        Styles.br2,
        styles.container,
        Styles.bw1,
        {
          backgroundColor: disabled || loading
            ? colors.border
            : colors.primary,
          borderColor: disabled || loading
            ? colors.border
            : colors.primary,
          opacity: disabled || loading ? 0.6 : 1,
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color="#FFF" />
      ) : (
        <Text
          style={[
            { color: '#FFF', fontWeight: 'bold' },
            labelStyle,
          ]}
        >
          {children}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 50,
  },
});

export default React.memo(Button);
