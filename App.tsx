import React, { useState, useEffect } from 'react';


import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
import { Provider, useSelector } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
// import { View } from 'react-native';

import RootNavigation from './src/Navigations/RootNavigation';
import { theme } from './src/constant/theme';
import { Styles } from './src/lib/styles';
import { RootProvider } from './src/context/RootCoontext';
import { ThemeProvider, useAppTheme } from './src/context/ThemeContext';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import AnimationWithImperativeApi from './src/Screens/Splash/SplashScreen';

import { store, persistor, RootState } from './src/redux/store';
import ReduxLanguageSync from './src/ReduxLanguageSync';
import {
  requestNotificationPermission,
  getFCMToken,
  setupForegroundHandler,
  setupNotificationOpenedHandler,
  onTokenRefresh,
} from './src/services/notificationService';
import { useSaveFcmTokenMutation } from './src/service/driverApi';
import { navigationRef, navigate } from './src/Navigations/navigationRef';
import { ToastProvider } from './src/context/ToastContext';
import { AlertProvider } from './src/context/AlertContext';
import { Toast, AlertModal, ConnectionStatus } from './src/Components';
import { SocketProvider } from './src/Socket/SocketProvider';




import socketService from './src/service/socketService';

import './src/i18n/i18n';

enableScreens(true);

/* ================= FCM INITIALIZER ================= */

const FCMInitializer = () => {
  const driverId = useSelector((state: RootState) => state.userSlice.user?.driverId);
  const accessToken = useSelector((state: RootState) => state.userSlice.user?.accessToken);
  const [saveFcmToken] = useSaveFcmTokenMutation();

  useEffect(() => {
    if (!driverId || !accessToken) return;

    let foregroundUnsub: (() => void) | undefined;
    let refreshUnsub: (() => void) | undefined;
    let openedAppUnsub: (() => void) | undefined;

    const initFCM = async () => {
      const hasPermission = await requestNotificationPermission();
      if (!hasPermission) return;

      const token = await getFCMToken();
      if (token) {
        try {
          await saveFcmToken({ driverId, fcmToken: token }).unwrap();
          console.log('✅ FCM token saved to backend');
        } catch (err) {
          console.warn('❌ Failed to save FCM token (token may be expired):', err);
        }
      }

      foregroundUnsub = setupForegroundHandler();
      openedAppUnsub = setupNotificationOpenedHandler(navigate);
      refreshUnsub = onTokenRefresh(async (newToken) => {
        console.log('🔄 FCM token refreshed:', newToken);
        try {
          await saveFcmToken({ driverId, fcmToken: newToken }).unwrap();
          console.log('✅ Refreshed FCM token saved');
        } catch (err) {
          console.warn('❌ Failed to save refreshed FCM token (token may be expired):', err);
        }
      });
    };

    initFCM();

    return () => {
      foregroundUnsub?.();
      refreshUnsub?.();
      openedAppUnsub?.();
    };
  }, [driverId, saveFcmToken, accessToken]);

  return null;
};

/* ================= SOCKET INITIALIZER ================= */

const SocketInitializer = () => {
  const driverId = useSelector((state: RootState) => state.userSlice.user?.driverId);
  const isOnline = useSelector((state: RootState) => state.userSlice.user?.isOnline);

  useEffect(() => {
    if (driverId && isOnline) {
      socketService.connect();

      return () => {
        socketService.disconnect();
      };
    }
  }, [driverId, isOnline]);

  return null;
};

const AppContent = () => {
  const { theme } = useAppTheme();

  return (
    <>
      {/* Redux → i18n Sync */}
      <ReduxLanguageSync />

      {/* Firebase Cloud Messaging */}
      <FCMInitializer />

      {/* Socket.IO Integration */}
      <SocketInitializer />

      <GestureHandlerRootView style={[Styles.flex, { backgroundColor: theme.colors.background }]}>
        <SafeAreaProvider
          style={[
            Styles.flex,
            { backgroundColor: theme.colors.background },
          ]}
        >
          <ConnectionStatus />
          <NavigationContainer ref={navigationRef} theme={theme}>
            <BottomSheetModalProvider>
              <ToastProvider>
                <AlertProvider>
                  <SocketProvider>
                    <RootProvider>
                       <RootNavigation />
                      <Toast />
                      <AlertModal />
                    </RootProvider>
                  </SocketProvider>
                </AlertProvider>
              </ToastProvider>
            </BottomSheetModalProvider>
          </NavigationContainer>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </>
  );
};

/* ================= APP ================= */

const App = () => {
  // Test Fast Refresh Connectivity
  const [rehydrated, setRehydrated] = useState(false);

  return (
    <Provider store={store}>
      <ThemeProvider>
        <PersistGate
          persistor={persistor}
          onBeforeLift={() => {
            // Redux state restored from AsyncStorage
            setRehydrated(true);
          }}
          loading={<AnimationWithImperativeApi />}
        >
          {/* Prevent UI from rendering before restore */}
          {rehydrated && <AppContent />}
        </PersistGate>
      </ThemeProvider>
    </Provider>
  );
};

export default App;
