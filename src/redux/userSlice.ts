import { createSlice, PayloadAction } from '@reduxjs/toolkit';

/* ================= DOCUMENT TYPE ================= */

export interface DocumentState {
  status: 'NONE' | 'PENDING' | 'UPLOADED' | 'FAILED' | 'pending' | 'verified' | 'rejected';
  preview?: string;
  rejection_reason?: string;
}

/* ================= USER TYPE ================= */

export interface UserState {
  userId?: string;
  driverId?: string;
  device_id?: string;

  /* Phone — backend sends phone_number */
  phone_number?: string;
  alternate_contact?: string | null;

  accessToken?: string;
  refreshToken?: string;
  isLoggedIn?: boolean;

  first_name?: string;
  last_name?: string;
  full_name?: string;

  email?: string | null;
  gender?: 'male' | 'female' | 'other' | string;
  date_of_birth?: string | null;

  /* Profile pic — backend sends profile_picture or profile_pic_url */
  profile_picture?: string;
  profile_pic_url?: string;

  bannerIndex?: number;

  role?: string;
  status?: 'active' | 'pending' | 'blocked' | string;
  status_reason?: string;
  status_updated_at?: string;
  rating?: number;
  total_trips?: number;

  isApproved?: boolean;
  isOnline?: boolean;
  driverStatus?: 'OFFLINE' | 'ONLINE' | 'ON_TRIP' | 'HAS_UPCOMING_SCHEDULED';
  subscription_active?: boolean;

  isProfileVerified?: boolean;
  isDocumentVerified?: boolean;
  isSelfieVerified?: boolean;
  isAddressVerified?: boolean;

  onboarding_status?:
  | 'PHONE_VERIFIED'
  | 'PROFILE_COMPLETED'
  | 'ADDRESS_COMPLETED'
  | 'DOCS_UPLOADING'
  | 'DOCS_REJECTED'
  | 'DOCS_SUBMITTED'
  | 'DOCUMENTS_APPROVED'
  | 'SUBSCRIPTION_ACTIVE'
  | 'ACTIVE'
  | string;
  onboarding_step?: number;
  onboarding_completed?: boolean;
  documents_submitted?: boolean;
  is_trip_verified?: boolean;
  kyc_status?: any;

  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    pincode?: string;
  };

  vehicle?: {
    vehicleNumber?: string;
    vehicleType?: string;
    vehicleModel?: string;
  };

  language?: string;

  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;

  /* ⭐ TRIP PREFERENCES */
  tripPreferences?: {
    local?: boolean;
    outstation?: boolean;
    roundTrip?: boolean;
    oneWay?: boolean;
    autoAccept?: boolean;
  };

  isVibrationEnabled?: boolean;

  /** Firebase Cloud Messaging device token */
  fcmToken?: string;

  /* ⭐ DOCUMENT STORAGE */
  documents?: Record<string, DocumentState>;
  
  /* Referral */
  referred_by?: string;
  
  /* Credit / Wallet */
  credit?: {
    limit: number;
    balance: number;
    totalRecharged: number;
    totalUsed: number;
    lastRechargeAt?: string | null;
  };

  /** Raw document metadata from backend */
  documents_data?: any[];
}

/* ================= REQUEST STATUS ================= */

interface RequestStatus {
  status: 'NONE' | 'PENDING' | 'SUCCESS' | 'FAILED';
  error?: string | null;
}

/* ================= DEFAULT FLAGS ================= */

const defaultFlags = {
  onboarding_completed: false,
  isProfileVerified: false,
  isDocumentVerified: false,
  isSelfieVerified: false,
  isAddressVerified: false,
};

/* ================= SLICE STATE ================= */

interface UserSliceState {
  user: UserState | null;
  profileUpdateRequest: RequestStatus;
}

/* ================= INITIAL STATE ================= */

const initialState: UserSliceState = {
  user: null,
  profileUpdateRequest: {
    status: 'NONE',
    error: null,
  },
};

/* ================= SLICE ================= */

const userSlice = createSlice({
  name: 'userSlice',
  initialState,

  reducers: {
    /* 🔥 SAFE MERGE USER — strips undefined values to prevent accidental overwrites */

    setUser: (state, action: PayloadAction<Partial<UserState>>) => {
      // Filter out keys with undefined values so they never overwrite existing data
      const cleanPayload = Object.fromEntries(
        Object.entries(action.payload).filter(([_, v]) => v !== undefined),
      );

      if (!state.user) {
        state.user = {
          ...defaultFlags,
          ...cleanPayload,
        };
      } else {
        Object.assign(state.user, cleanPayload);
      }
    },

    setOnlineStatus: (state, action: PayloadAction<boolean>) => {
      if (state.user) {
        state.user.isOnline = action.payload;
        state.user.driverStatus = action.payload ? 'ONLINE' : 'OFFLINE';
      }
    },

    setDriverStatus: (state, action: PayloadAction<'OFFLINE' | 'ONLINE' | 'ON_TRIP' | 'HAS_UPCOMING_SCHEDULED'>) => {
      if (state.user) {
        state.user.driverStatus = action.payload;
        if (action.payload === 'OFFLINE') {
          state.user.isOnline = false;
        } else {
          state.user.isOnline = true;
        }
      }
    },

    setAddress: (state, action: PayloadAction<UserState['address']>) => {
      if (state.user) { state.user.address = action.payload; }
    },

    setVehicle: (state, action: PayloadAction<UserState['vehicle']>) => {
      if (state.user) { state.user.vehicle = action.payload; }
    },

    setVerificationFlags: (
      state,
      action: PayloadAction<{
        profile?: boolean;
        document?: boolean;
        selfie?: boolean;
        address?: boolean;
      }>
    ) => {
      if (!state.user) { return; }

      if (action.payload.profile !== undefined) { state.user.isProfileVerified = action.payload.profile; }

      if (action.payload.document !== undefined) { state.user.isDocumentVerified = action.payload.document; }

      if (action.payload.selfie !== undefined) { state.user.isSelfieVerified = action.payload.selfie; }

      if (action.payload.address !== undefined) { state.user.isAddressVerified = action.payload.address; }
    },

    setOnboardingStep: (state, action: PayloadAction<number>) => {
      if (state.user) { state.user.onboarding_step = action.payload; }
    },

    setBannerIndex: (state, action: PayloadAction<number>) => {
      if (state.user) { state.user.bannerIndex = action.payload; }
    },

    /* ⭐ DOCUMENT UPDATE */

    setDocumentStatus: (
      state,
      action: PayloadAction<{
        key: string;
        status: DocumentState['status'];
        preview?: string;
      }>
    ) => {
      if (!state.user) { return; }

      if (!state.user.documents) {
        state.user.documents = {};
      }

      state.user.documents[action.payload.key] = {
        status: action.payload.status,
        preview: action.payload.preview,
      };
    },

    /* ⭐ PROFILE UPDATE STATUS */

    setProfileUpdateStatus: (
      state,
      action: PayloadAction<RequestStatus>
    ) => {
      state.profileUpdateRequest = action.payload;
    },

    /* ⭐ TRIP PREFERENCES */

    setTripPreferences: (
      state,
      action: PayloadAction<Partial<NonNullable<UserState['tripPreferences']>>>
    ) => {
      if (!state.user) { return; }
      state.user.tripPreferences = {
        ...state.user.tripPreferences,
        ...action.payload,
      };
    },

    /* ⭐ RESET USER */
    clearUser: () => initialState,
  },
});

/* ================= EXPORTS ================= */

export const {
  setUser,
  setOnlineStatus,
  setDriverStatus,
  setAddress,
  setVehicle,
  setVerificationFlags,
  setOnboardingStep,
  setBannerIndex,
  setDocumentStatus,
  setProfileUpdateStatus,
  setTripPreferences,
  clearUser,
} = userSlice.actions;

// Alias: syncProfile is used in TripVerificationScreen to merge API profile data
export const syncProfile = userSlice.actions.setUser;

export default userSlice.reducer;
