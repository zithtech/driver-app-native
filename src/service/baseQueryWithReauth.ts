import {
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import type { RootState } from '../redux/store';
import { setUser, clearUser } from '../redux/userSlice';
import { getDeviceId } from './utils/device';
import { logoutUser } from './utils/logoutHelper';
import { storage } from './utils/storage';
import { API_URL } from '../constant/config';

/* ================= BASE URL ================= */

const BASE_URL = `${API_URL}/api`;
/* ================= MUTEX (prevent parallel refresh calls) ================= */

let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

/* ================= RAW BASE QUERY ================= */

const rawBaseQuery = fetchBaseQuery({
  baseUrl: BASE_URL,

  prepareHeaders: (headers, { getState }) => {
    const state = getState() as RootState;
    const token = state.userSlice.user?.accessToken;

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    headers.set('Content-Type', 'application/json');
    return headers;
  },
});

/* ================= BASE QUERY WITH RE-AUTH ================= */

export const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {

  // ── 1. If a refresh is already in progress, wait for it ──
  if (isRefreshing && refreshPromise) {
    await refreshPromise;
  }

  // ── 2. Make the original request ──
  let result = await rawBaseQuery(args, api, extraOptions);

  // ── 3. Check for 401 with TOKEN_EXPIRED ──
  if (result.error && result.error.status === 401) {
    const errorData = result.error.data as any;
    const shouldRefresh =
      errorData?.code === 'TOKEN_EXPIRED' ||
      errorData?.error?.code === 'TOKEN_EXPIRED' ||
      errorData?.shouldRefresh === true;

    if (shouldRefresh) {
      // ── 4. Only one refresh at a time ──
      if (!isRefreshing) {
        isRefreshing = true;

        refreshPromise = (async () => {
          let retryCount = 0;
          const MAX_RETRIES = 3;

          while (retryCount < MAX_RETRIES) {
            try {
              const state = api.getState() as RootState;
              const refreshToken = state.userSlice.user?.refreshToken;

              if (!refreshToken) {
                await storage.clearAll();
                api.dispatch(clearUser());
                return;
              }

              const device_id = await getDeviceId();

              // ── 5. Call POST /auth/refresh-token ──
              const refreshResult = await rawBaseQuery(
                {
                  url: '/auth/refresh-token',
                  method: 'POST',
                  body: { refreshToken, device_id },
                },
                api,
                extraOptions
              );

              const refreshData = refreshResult.data as any;

              if (refreshData?.success && refreshData?.data?.accessToken) {
                // ── 6. SUCCESS: Store new access token ──
                const newAccessToken = refreshData.data.accessToken;

                // 🔐 SECURE STORAGE: Persist new token
                await storage.setAccessToken(newAccessToken);

                api.dispatch(
                  setUser({
                    accessToken: newAccessToken,
                  })
                );
                return; // Exit the loop and the promise
              }

              // ── 7. REFRESH FAILED ──
              const errorStatus = refreshResult.error?.status;

              if (errorStatus === 401 || errorStatus === 403) {
                // Refresh token is definitely invalid/expired -> logout immediately
                await logoutUser(api.dispatch);
                return;
              }

              // Server Error or Network Error -> Retry with backoff
              retryCount++;
              if (retryCount < MAX_RETRIES) {
                const delayMs = Math.pow(2, retryCount - 1) * 1000;
                await new Promise((resolve) => setTimeout(() => resolve(undefined), delayMs));
              }
            } catch (err) {
              retryCount++;
              if (retryCount < MAX_RETRIES) {
                const delayMs = Math.pow(2, retryCount - 1) * 1000;
                await new Promise((resolve) => setTimeout(() => resolve(undefined), delayMs));
              }
            }
          }

          // If we exhausted retries and never succeeded
          await logoutUser(api.dispatch);
        })();

        try {
          await refreshPromise;
        } finally {
          isRefreshing = false;
          refreshPromise = null;
        }
      } else if (refreshPromise) {
        // Another call triggered the refresh — just wait
        await refreshPromise;
      }

      // ── 7. Check if refresh succeeded (user still has a token) ──
      const updatedState = api.getState() as RootState;
      if (updatedState.userSlice.user?.accessToken) {
        // ── 8. Retry the original request with the new token ──
        result = await rawBaseQuery(args, api, extraOptions);
      }
    } else {
      // 401 but NOT token-expired (invalid token, etc.) → force logout
      await logoutUser(api.dispatch);
    }
  }

  return result;
};
