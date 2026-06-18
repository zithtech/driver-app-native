import { StyleSheet, TextInput, View, ViewStyle, Text, Pressable, Platform } from 'react-native';
import React, { useRef, useState, useEffect } from 'react';
import { Styles } from '../lib/styles';
import { useTheme } from '@react-navigation/native';
import { useAppTheme } from '../context/ThemeContext';

interface OTPInputProps {
  numberOfDigits?: number;
  onChangeText?: (value: string) => void;
  value?: string;
  containerStyle?: ViewStyle | ViewStyle[];
  hasError?: boolean;
  autoFocus?: boolean;
}

const OTPInput: React.FC<OTPInputProps> = ({
  numberOfDigits = 6,
  onChangeText = () => { },
  value = '',
  containerStyle,
  hasError = false,
  autoFocus = false,
}) => {
  const { colors: navColors, fonts } = useTheme() as any;
  const { theme, isDark } = useAppTheme();
  const colors = theme.colors;
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Auto-focus on mount if prop is set
  useEffect(() => {
    if (autoFocus) {
      const timeout = setTimeout(() => {
        inputRef.current?.focus();
      }, 500); // Small delay to ensure layout is ready
      return () => clearTimeout(timeout);
    }
  }, [autoFocus]);

  const handlePress = () => {
    inputRef.current?.focus();
  };

  const codeDigitsArray = new Array(numberOfDigits).fill('');

  const renderDigit = (_: any, index: number) => {
    const digit = value[index] || '';
    const isCurrentDigit = index === value.length;
    const isLastDigit = index === numberOfDigits - 1;
    const isCodeFull = value.length === numberOfDigits;
    const isFocusedDigit = isFocused && (isCurrentDigit || (isCodeFull && isLastDigit));

    return (
      <View
        key={index}
        style={[
          Styles.bw1,
          Styles.br2,
          styles.box,
          {
            borderColor: hasError
              ? '#EF4444'
              : isFocusedDigit
                ? colors.primary
                : colors.border || colors.primary + '40',
            backgroundColor: isFocusedDigit ? colors.primary + '05' : 'transparent',
          },
          index !== numberOfDigits - 1 && styles.gap,
        ]}
      >
        <Text style={[fonts.medium, Styles.fs16, { color: colors.text }]}>
          {digit}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <Pressable style={styles.inputsContainer} onPress={handlePress}>
        {codeDigitsArray.map(renderDigit)}
      </Pressable>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => {
          // Only allow numbers and limit length
          const cleanedText = text.replace(/[^0-9]/g, '').slice(0, numberOfDigits);
          onChangeText(cleanedText);
        }}
        maxLength={numberOfDigits}
        keyboardType="number-pad"
        returnKeyType="done"
        textContentType="oneTimeCode" // iOS SMS Auto-fill
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'} // Android/iOS Auto-fill
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={styles.hiddenInput}
        caretHidden={true}
        keyboardAppearance={isDark ? 'dark' : 'light'}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  box: {
    height: 48,
    width: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gap: {
    marginRight: 12,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});

export default React.memo(OTPInput);
