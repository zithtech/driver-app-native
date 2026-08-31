import React from 'react';
import { View, Text, TouchableOpacity, DeviceEventEmitter, Alert, ToastAndroid, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import DashBoardScreen from '../Screens/Dashboard';
import ScheduledRidesScreen from '../Screens/Requests/ScheduledRidesScreen';
import ProfileScreen from '../Screens/Profile';
import EarningsScreen from '../Screens/Profile/EarningsScreen';
import { useAppTheme } from '../context/ThemeContext';
import { vS as vs, mS as ms } from '../lib/scale';

import { useSelector } from 'react-redux';
import { useGetIncomingTripsQuery } from '../service/driverApi';
import { RootState } from '../redux/store';

const Tab = createBottomTabNavigator();

const CustomTabBarButton = ({ isOnline, theme, label }: any) => (
  <TouchableOpacity
    activeOpacity={0.8}
    style={{
      top: -vs(20),
      justifyContent: 'center',
      alignItems: 'center',
    }}
    onPress={() => {
      const msg = 'Please long press the button to ' + (isOnline ? 'go offline.' : 'go online.');
      if (Platform.OS === 'android') {
        ToastAndroid.show(msg, ToastAndroid.SHORT);
      } else {
        Alert.alert(isOnline ? 'Go Offline' : 'Go Online', msg);
      }
    }}
    onLongPress={() => {
      DeviceEventEmitter.emit('executeOfflineToggle');
    }}
  >
    <View style={{
      width: ms(56),
      height: ms(56),
      borderRadius: ms(28),
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.colors.primary,
      shadowOpacity: 0.3,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    }}>
      <Ionicons name="power" size={ms(28)} color="#FFFFFF" />
    </View>
     <Text style={{
       fontSize: ms(11),
       fontWeight: '600',
       marginTop: vs(6),
       color: theme.dark ? '#9CA3AF' : '#94A3B8',
       textAlign: 'center'
    }}>
      {label}
    </Text>
  </TouchableOpacity>
);

const TabBarIcon = ({ focused, color, routeName, theme }: any) => {
  let iconName: string = 'home-outline';

  if (routeName === 'Home') {
    iconName = focused ? 'home' : 'home-outline';
  }
  if (routeName === 'Requests') {
    iconName = focused ? 'car-sport' : 'car-sport-outline';
  }
  if (routeName === 'Earnings') {
    iconName = focused ? 'wallet' : 'wallet-outline';
  }
  if (routeName === 'Profile') {
    iconName = focused ? 'person' : 'person-outline';
  }

  return (
    <View style={{ alignItems: 'center', width: '100%' }}>
      {focused && (
        <View
          style={{
            position: 'absolute',
            top: -vs(10),
            width: ms(20),
            height: vs(3),
            backgroundColor: theme.colors.primary,
            borderRadius: ms(2),
          }}
        />
      )}
      <Ionicons
        name={iconName}
        size={focused ? 28 : 24}
        color={color}
      />
    </View>
  );
};

const getScreenOptions = (theme: any, isDark: boolean, insets: any) => ({ route }: any) => ({
  headerShown: false,

  // COLORS
  tabBarActiveTintColor: theme.colors.primary,
  tabBarInactiveTintColor: isDark ? '#9CA3AF' : (theme.colors.paragraphText || '#94A3B8'),

  // ✅ hide tabs when keyboard opens
  tabBarHideOnKeyboard: false, // Changed from true to prevent jumping

  // ✅ SAFE AREA + RESPONSIVE HEIGHT
  tabBarStyle: {
    backgroundColor: theme.colors.card,
    borderTopWidth: isDark ? 1 : 0,
    borderTopColor: isDark ? '#374151' : 'transparent',
    height: vs(65) + Math.max(insets.bottom, vs(10)),
    paddingBottom: Math.max(insets.bottom, vs(5)),
    paddingTop: vs(10),
  },

  tabBarLabelStyle: {
    fontSize: ms(11),
    fontWeight: '600' as any,
    marginBottom: vs(4),
  },

  // ✅ ICONS (focused / unfocused)
  tabBarIcon: ({ focused, color }: any) => (
    <TabBarIcon
      focused={focused}
      color={color}
      routeName={route.name}
      theme={theme}
    />
  ),
});

const DriverTabs = () => {
  const insets = useSafeAreaInsets(); // ✅ SAFE AREA
  const { theme, isDark } = useAppTheme();
  const user = useSelector((state: RootState) => state.userSlice.user);

  const { data: incomingTrips } = useGetIncomingTripsQuery('SCHEDULED', {
    skip: !user?.driverId,
    pollingInterval: 30000,
  });

  const requestCount = incomingTrips?.data?.length || 0;

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={getScreenOptions(theme, isDark, insets)}
    >
      {/* 🏠 HOME */}
      <Tab.Screen
        name="Home"
        component={DashBoardScreen}
      />

      {/* 🚗 REQUESTS */}
      <Tab.Screen
        name="Requests"
        component={ScheduledRidesScreen}
        options={{ 
          title: 'Requests', 
          tabBarBadge: requestCount > 0 ? '' : undefined,
          tabBarBadgeStyle: {
            backgroundColor: theme.colors.primary,
            minWidth: ms(10),
            minHeight: ms(10),
            maxWidth: ms(10),
            maxHeight: ms(10),
            borderRadius: ms(5),
            marginTop: vs(2),
          }
        }}
      />

      {/* ⚡ POWER ACTION */}
      <Tab.Screen
        name="PowerAction"
        component={View} // Dummy component
        options={{
          tabBarLabel: '',
          tabBarButton: () => (
            <CustomTabBarButton 
              isOnline={user?.isOnline} 
              theme={theme} 
              label={user?.isOnline ? 'Go Offline' : 'Go Online'} 
            />
          )
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
          }
        }}
      />

      {/* 💰 EARNINGS */}
      <Tab.Screen
        name="Earnings"
        component={EarningsScreen}
      />

      {/* 👤 PROFILE */}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
      />
    </Tab.Navigator>
  );
};

export default DriverTabs;
