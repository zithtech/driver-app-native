import React, { forwardRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TextStyle,
  ScrollView,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { Styles } from '../lib/styles';

interface InputProps extends TextInputProps {
  label?: string;
  labelStyle?: TextStyle | TextStyle[];
  containerStyle?: ViewStyle | ViewStyle[];
  inputContainerStyle?: ViewStyle | ViewStyle[];
  LeadingAccessory?: React.ReactNode;
  TailingAccessory?: React.ReactNode;
  error?: string;
  scrollable?: boolean;
}

const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      labelStyle,
      containerStyle,
      inputContainerStyle,
      LeadingAccessory,
      TailingAccessory,
      error,
      style: customStyle,
      scrollable,
      ...textInputProps
    },
    ref
  ) => {
    const { colors, fonts }: any = useTheme();

    return (
      <View style={[containerStyle, { backgroundColor: 'transparent' }]}>
        {label && (
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={[
              fonts.medium,
              Styles.mb2,
              { color: colors.primary },
              labelStyle,
            ]}
          >
            {label}
          </Text>
        )}

        <View
          style={[
            Styles.flexRow,
            Styles.alignItemsCenter,
            styles.container,
            {
              borderColor: error ? colors.error : colors.searchBorder,
              backgroundColor: 'transparent',
            },
            inputContainerStyle,
          ]}
        >
          {LeadingAccessory}
          {scrollable ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={Styles.flex} contentContainerStyle={{ flexGrow: 1, alignItems: 'center' }}>
              <TextInput
                ref={ref}
                style={[
                  styles.textInput,
                  { color: colors.text, backgroundColor: 'transparent', minWidth: '100%' },
                  customStyle,
                ]}
                placeholderTextColor={colors.border}
                underlineColorAndroid="transparent"
                {...textInputProps}
              />
            </ScrollView>
          ) : (
            <TextInput
              ref={ref}
              style={[
                Styles.flex,
                styles.textInput,
                { color: colors.text, backgroundColor: 'transparent' },
                customStyle,
              ]}
              placeholderTextColor={colors.border}
              underlineColorAndroid="transparent"
              {...textInputProps}
            />
          )}
          {TailingAccessory}
        </View>

        {error && (
          <Text style={[fonts.regular, Styles.mt2, { color: colors.error }]}>
            {error}
          </Text>
        )}
      </View>
    );
  }
);

export default React.memo(Input);

const styles = StyleSheet.create({
  container: {
    height: 53,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  textInput: {
    height: '100%',
    fontSize: 16,
  },
});
