import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useTheme } from '@react-navigation/native';

import {
  WelcomeScreen_Nav,
  PersonalDetails_Nav,
  AddressDetails_Nav,
  DocumentScreen_Nav,
  DocumentUploadScreen_Nav,
} from './navigations';

import WelcomeScreen from '../Screens/Auth/WelcomeScreen';
import OTPScreen from '../Screens/Auth/OTPScreen';
import PersonalDetails from '../Screens/Auth/PersonalDetails';
import AddressDetails from '../Screens/Auth/AddressDetails';
import DocumentScreen from '../Screens/Auth/DocumentScreen';
import DocumentUploadScreen from '../Screens/Auth/DocumentUploadScreen';
import { LeftArrow } from '../assets/svg';

const Stack = createStackNavigator();

const BackButton = () => <LeftArrow width={24} height={24} />;

const AuthNavigation = () => {
  const { colors } = useTheme();

  /* ---------- DEFAULT HEADER (WITH BACK) ---------- */
  const headerWithBack = {
    headerShown: false,
    headerTitle: '',
    headerBackImage: BackButton,
    headerStyle: {
      backgroundColor: colors.background,
      shadowColor: colors.background,
      elevation: 0,
    },
  };

  /* ---------- NO BACK HEADER ---------- */
  const headerNoBack = {
    headerShown: false,
  };

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* WELCOME */}
      <Stack.Screen
        name={WelcomeScreen_Nav}
        component={WelcomeScreen}
      />

      {/* OTP (BACK ALLOWED) */}
      <Stack.Screen
        name="OTPScreen"
        component={OTPScreen}
        options={{
          headerShown: false, // ✅ hides back arrow & header
        }}
      />


      {/* 🔒 PERSONAL DETAILS (NO BACK — VERY IMPORTANT) */}
      <Stack.Screen
        name={PersonalDetails_Nav}
        component={PersonalDetails}
        options={headerNoBack}
      />

      {/* ADDRESS (BACK ALLOWED) */}
      <Stack.Screen
        name={AddressDetails_Nav}
        component={AddressDetails}
        options={headerWithBack}
      />

      {/* DOCUMENT LIST */}
      <Stack.Screen
        name={DocumentScreen_Nav}
        component={DocumentScreen}
        options={headerWithBack}

      />

      {/* DOCUMENT UPLOAD */}
      <Stack.Screen
        name={DocumentUploadScreen_Nav}
        component={DocumentUploadScreen}
        options={headerWithBack}
      />




    </Stack.Navigator>
  );
};

export default AuthNavigation;
