import colors from './colors';
import fonts from './fonts';

export const theme = {
  colors: colors,
  fonts: fonts,
  dark: false,

  paragraphText: '#9aa4ad',
  rectangle: '#161b22',
};

export const AppLightTheme = {
  ...theme,
  dark: false,
  colors: {
    ...colors,
    background: '#FFFFFF',
    text: '#000000',
    card: '#FFFFFF',
    border: '#ADADAD',
    textMuted: '#767676',
  },
};

export const AppDarkTheme = {
  ...theme,
  dark: true,
  colors: {
    ...colors,
    background: '#0B1320',
    text: '#FFFFFF',
    card: '#1A2438',
    border: '#2E3B52',
    textMuted: '#94A3B8',
  },
};
