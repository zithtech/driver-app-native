/**
 * Centralized configuration constants.
 *
 * The Google Maps API key is used by:
 * - useLocation.ts (Geocoding API calls)
 * - AndroidManifest.xml (Maps SDK — set via manifestPlaceholders in build.gradle)
 * - AppDelegate.swift (Maps SDK — set via .xcode.env)
 *
 * All values are loaded from .env via react-native-config.
 * Copy .env.example to .env and fill in your values.
 */

import Config from 'react-native-config';

export const GOOGLE_MAPS_API_KEY = Config.GOOGLE_MAPS_API_KEY || '';

const LOCAL_BACKEND = 'http://10.0.2.2:1234';

export const API_URL = Config.API_URL || (__DEV__ ? LOCAL_BACKEND : '');

export const AGORA_APP_ID = Config.AGORA_APP_ID || '41cadf2ab272451eb97b6b3915f3e016';
