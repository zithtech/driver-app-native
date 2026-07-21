import { persistor } from '../../redux/store';
import { clearUser } from '../../redux/userSlice';
import { storage } from './storage';
import { driverApi } from '../driverApi';
import { userApi } from '../userApi';

export const logoutUser = async (dispatch: any) => {
  console.log('[logoutHelper] Starting logout process');
  
  // 1. Clear RTK Query caches first, then Redux State
  // This prevents useAuthBootstrap from reading stale cache when the user state becomes null
  try {
    dispatch(driverApi.util.resetApiState());
    dispatch(userApi.util.resetApiState());
    dispatch(clearUser());
    console.log('[logoutHelper] Caches and Redux state cleared');
  } catch (e) {
    console.error('[logoutHelper] Error clearing Redux/Caches:', e);
  }

  // 2. Clear secure tokens from Keychain and AsyncStorage
  try {
    await storage.clearAll();
    console.log('[logoutHelper] Storage cleared');
  } catch (error) {
    console.error('[logoutHelper] Error clearing storage:', error);
  }

  // 3. Purge persisted data from AsyncStorage
  try {
    await persistor.purge();
    console.log('[logoutHelper] Persistor purged');
  } catch (error) {
    console.error('[logoutHelper] Error purging persistor:', error);
  }
};
