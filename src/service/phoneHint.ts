import { NativeModules, Platform } from 'react-native';

const { PhoneNumberHintModule } = NativeModules;

export interface PhoneHintResult {
  success: boolean;
  phoneNumber?: string;
  error?: string;
}

/**
 * Validates whether a given mobile number is a valid 10-digit Indian mobile number
 * (Must start with 6, 7, 8, or 9 and have exactly 10 digits).
 */
export const isValidIndianMobile = (phone: string): boolean => {
  if (!phone) return false;
  const cleaned = phone.replace(/\D/g, '');
  return /^[6-9]\d{9}$/.test(cleaned);
};

/**
 * Sanitizes any raw phone number string into a clean 10-digit Indian mobile number.
 * Examples:
 *   "+919876543210" -> "9876543210"
 *   "09876543210"   -> "9876543210"
 *   "98765 43210"   -> "9876543210"
 *   "+91 98765-43210" -> "9876543210"
 */
export const sanitizePhoneNumber = (raw: string): string => {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');

  // 12 digits starting with India country code 91
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }

  // 11 digits starting with trunk prefix 0
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }

  // Exactly 10 digits
  if (digits.length === 10) {
    return digits;
  }

  // Fallback: take the trailing 10 digits if longer than 10
  if (digits.length > 10) {
    return digits.slice(-10);
  }

  return digits;
};

/**
 * Invokes the platform's device capability to retrieve the phone number.
 * - On Android: Triggers Google Play Services Phone Number Hint API (1-tap SIM picker).
 * - On iOS: Returns not supported (iOS relies on keyboard QuickType AutoFill).
 */
export const requestDevicePhoneNumber = async (): Promise<PhoneHintResult> => {
  if (Platform.OS !== 'android') {
    return { success: false, error: 'PLATFORM_NOT_SUPPORTED' };
  }

  if (!PhoneNumberHintModule || typeof PhoneNumberHintModule.requestPhoneNumberHint !== 'function') {
    return { success: false, error: 'MODULE_NOT_INITIALIZED' };
  }

  try {
    const rawNumber: string = await PhoneNumberHintModule.requestPhoneNumberHint();
    const cleanNumber = sanitizePhoneNumber(rawNumber);

    if (isValidIndianMobile(cleanNumber)) {
      return { success: true, phoneNumber: cleanNumber };
    }

    return {
      success: true,
      phoneNumber: cleanNumber, // Still return cleaned digits even if validation needs manual review
    };
  } catch (error: any) {
    // E_CANCELLED, E_PLAY_SERVICES, E_ACTIVITY_NULL
    return {
      success: false,
      error: error?.code || error?.message || 'PHONE_HINT_FAILED',
    };
  }
};
