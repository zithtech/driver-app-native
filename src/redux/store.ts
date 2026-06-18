import { configureStore, combineReducers } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  persistReducer,
  persistStore,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';

import { setupListeners } from '@reduxjs/toolkit/query';

/* ================= SLICE IMPORTS ================= */

import userSliceReducer from './userSlice';
import planReducer from './planSlice';
import rideReducer from './rideSlice';
import chatReducer from './chatSlice';

import { userApi } from '../service/userApi';
import { driverApi } from '../service/driverApi';

/* ================= ROOT REDUCER ================= */
const userPersistConfig = {
  key: 'userSlice',
  storage: AsyncStorage,
  blacklist: ['isOnline', 'driverStatus'], // 🛡️ Never persist volatile session state
};

const appReducer = combineReducers({
  userSlice: persistReducer(userPersistConfig, userSliceReducer),
  plan: planReducer,
  ride: rideReducer,
  chat: chatReducer,

  [userApi.reducerPath]: userApi.reducer,
  [driverApi.reducerPath]: driverApi.reducer,
});

const rootReducer = (state: any, action: any) => {
  if (action.type === 'userSlice/clearUser') {
    // We pass undefined to appReducer to reset all slices to their initial state,
    // including all RTK Query caches!
    return appReducer(undefined, action);
  }
  return appReducer(state, action);
};

/* ================= PERSIST CONFIG ================= */

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,

  whitelist: [
    'plan',
    'ride',
    'chat',
  ],

  blacklist: [
    userApi.reducerPath,
    driverApi.reducerPath,
  ],
};

/* ================= PERSISTED REDUCER ================= */

const persistedReducer = persistReducer(
  persistConfig,
  rootReducer
);

/* ================= STORE ================= */

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(userApi.middleware, driverApi.middleware),
});

/* ================= PERSISTOR ================= */

export const persistor = persistStore(store);

/* ================= LISTENERS ================= */

setupListeners(store.dispatch);

/* ================= TYPES ================= */

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
