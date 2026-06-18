import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from './baseQueryWithReauth';

/* ================================================================
   driverApi — Drivers · Documents · Trip Verification
   Base: /api  (set in baseQueryWithReauth)
   ================================================================ */

export const driverApi = createApi({
  reducerPath: 'driverApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Driver', 'Documents', 'TripVerification', 'Referral', 'Support'],

  endpoints: (builder) => ({

    /* ─────────── DRIVERS (/drivers) ─────────── */

    // PUBLIC — create new driver shell
    createDriver: builder.mutation<any, any>({
      query: (body) => ({
        url: '/drivers',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Driver'],
    }),

    // PUBLIC — admin verify driver
    adminVerifyDriver: builder.mutation<any, string>({
      query: (id) => ({
        url: `/drivers/admin-verify/${id}`,
        method: 'POST',
      }),
    }),

    // 🔒 PROTECTED — get my driver profile
    getDriverProfile: builder.query<any, void>({
      query: () => '/drivers/me',
      providesTags: ['Driver'],
    }),

    // 🔒 PROTECTED — delete my account
    deleteMyAccount: builder.mutation<any, void>({
      query: () => ({
        url: '/drivers/me',
        method: 'DELETE',
      }),
      invalidatesTags: ['Driver'],
    }),

    // 🔒 PROTECTED — reset my profile
    resetProfile: builder.mutation<any, void>({
      query: () => ({
        url: '/drivers/me/reset',
        method: 'POST',
      }),
      invalidatesTags: ['Driver'],
    }),

    // 🔒 PROTECTED — get driver by ID
    getDriverById: builder.query<any, string>({
      query: (id) => `/drivers/${id}`,
      providesTags: ['Driver'],
    }),
    goOnline: builder.mutation<any, string>({
      query: (id) => ({
        url: `/drivers/${id}/go-online`,
        method: 'POST',
      }),
      invalidatesTags: ['Driver'],
    }),
    goOffline: builder.mutation<any, string>({
      query: (id) => ({
        url: `/drivers/${id}/go-offline`,
        method: 'POST',
      }),
      invalidatesTags: ['Driver'],
    }),
    // 🔒 PROTECTED — update driver
    updateDriver: builder.mutation<any, { id: string; data: any }>({
      query: ({ id, data }) => ({
        url: `/drivers/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['Driver'],
    }),

    /* ─────────── DRIVER DOCUMENTS (/drivers/documents) ─────────── */

    // Get all documents for a driver
    getDriverDocuments: builder.query<any, string>({
      query: (driverId) => `/drivers/documents/driver/${driverId}`,
      providesTags: ['Documents'],
    }),

    // Get S3 upload URL for document
    getDocUploadUrl: builder.mutation<any, { driverId: string; documentType: string; contentType: string }>({
      query: ({ driverId, ...body }) => ({
        url: `/drivers/documents/upload-url/${driverId}`,
        method: 'POST',
        body,
      }),
    }),

    // Save document after upload
    saveDocument: builder.mutation<any, { driverId: string; documentType: string; documentUrl: Record<string, string> }>({
      query: ({ driverId, ...body }) => ({
        url: `/drivers/documents/save/${driverId}`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Documents', 'Driver'],
    }),

    // Submit all documents for review
    submitDocuments: builder.mutation<any, string>({
      query: (driverId) => ({
        url: `/drivers/documents/submit/${driverId}`,
        method: 'POST',
      }),
      invalidatesTags: ['Documents', 'Driver'],
    }),

    /* ─────────── TRIP VERIFICATION (/drivers/trip-verification) ─────────── */

    // Submit trip photos (selfie + multiple car images)
    submitTripPhotos: builder.mutation<any, {
      driverId: string;
      selfie_url: string;
      car_images: string[];
      car_image_url?: string;
      trip_id?: string;
    }>({
      query: ({ driverId, ...body }) => ({
        url: `/drivers/trip-verification/submit/${driverId}`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['TripVerification', 'Driver'],
    }),

    /* ─────────── TRIP LIFECYCLE (/trip) ─────────── */

    getIncomingTrips: builder.query<any, string | undefined>({
      query: (bookingType) => (bookingType ? `/trips/all?booking_type=${bookingType}` : '/trips/all'),
      providesTags: ['Driver'],
    }),

    getActiveTrip: builder.query<any, string>({
      query: (driverId) => `/trips/active?driver_id=${driverId}`,
      providesTags: ['Driver'],
    }),

    acceptTrip: builder.mutation<any, { tripId: string; driverId: string }>({
      query: ({ tripId, driverId }) => ({
        url: `/trips/${tripId}/accept`,
        method: 'POST',
        body: { driver_id: driverId },
      }),
      invalidatesTags: ['Driver'],
    }),

    startTrip: builder.mutation<any, string>({
      query: (tripId) => ({
        url: `/trips/${tripId}/start`,
        method: 'POST',
      }),
      invalidatesTags: ['Driver'],
    }),

    arrivedTrip: builder.mutation<any, string>({
      query: (tripId) => ({
        url: `/trips/${tripId}/arrived`,
        method: 'POST',
      }),
      invalidatesTags: ['Driver'],
    }),

    arrivingTrip: builder.mutation<any, string>({
      query: (tripId) => ({
        url: `/trips/${tripId}/arriving`,
        method: 'POST',
      }),
      invalidatesTags: ['Driver'],
    }),

    destinationReachedTrip: builder.mutation<any, string>({
      query: (tripId) => ({
        url: `/trips/${tripId}/destination-reached`,
        method: 'POST',
      }),
      invalidatesTags: ['Driver'],
    }),

    cancelTrip: builder.mutation<any, { tripId: string; cancel_reason: string; cancel_by: string; notes?: string }>({
      query: ({ tripId, ...body }) => ({
        url: `/trips/cancel/${tripId}`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Driver'],
    }),

    completeTrip: builder.mutation<any, { tripId: string; distance_km?: number; trip_duration_minutes?: number }>({
      query: ({ tripId, ...body }) => ({
        url: `/trips/${tripId}/complete`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Driver'],
    }),

    skipTrip: builder.mutation<any, string>({
      query: (tripId) => ({
        url: `/trips/${tripId}/skip`,
        method: 'POST',
      }),
      invalidatesTags: ['Driver'],
    }),

    // Get latest trip verification status
    getTripVerificationStatus: builder.query<any, string>({
      query: (driverId) => `/drivers/trip-verification/status/${driverId}`,
      providesTags: ['TripVerification'],
    }),

    /* ─────────── PERFORMANCE (/drivers/performance) ─────────── */

    getDriverPerformance: builder.query<any, { driverId: string; period?: string }>({
      query: ({ driverId, period }) => {
        let url = `/drivers/performance/${driverId}`;
        if (period) { url += `?period=${period}`; }
        return url;
      },
      providesTags: ['Driver'],
    }),

    /* ─────────── EARNINGS (/drivers/earnings) ─────────── */

    getEarningsSummary: builder.query<any, { driverId: string; from?: string; to?: string }>({
      query: ({ driverId, from, to }) => {
        let url = `/drivers/earnings/${driverId}/summary`;
        const params: string[] = [];
        if (from) { params.push(`from=${from}`); }
        if (to) { params.push(`to=${to}`); }
        if (params.length) { url += `?${params.join('&')}`; }
        return url;
      },
      providesTags: ['Driver'],
    }),

    // Get earnings transactions
    getEarningsTransactions: builder.query<any, { driverId: string; limit?: number; offset?: number; from?: string; to?: string }>({
      query: ({ driverId, limit = 20, offset = 0, from, to }) => {
        let url = `/drivers/earnings/${driverId}/transactions?limit=${limit}&offset=${offset}`;
        if (from) { url += `&from=${from}`; }
        if (to) { url += `&to=${to}`; }
        return url;
      },
      providesTags: ['Driver'],
    }),

    /* ─────────── WALLET (/drivers/wallet) ─────────── */

    // Get wallet balance
    getWalletBalance: builder.query<any, string>({
      query: (driverId) => `/drivers/wallet/${driverId}/balance`,
      providesTags: ['Driver'],
    }),

    // Get wallet transactions
    getWalletTransactions: builder.query<any, { driverId: string; limit?: number; offset?: number }>({
      query: ({ driverId, limit = 20, offset = 0 }) => `/drivers/wallet/${driverId}/transactions?limit=${limit}&offset=${offset}`,
      providesTags: ['Driver'],
    }),

    /* ─────────── RIDE ACTIVITY (/drivers/activity) ─────────── */

    // Get ride activity history
    /* ─────────── FCM TOKEN (/drivers/:id/fcm-token) ─────────── */

    saveFcmToken: builder.mutation<any, { driverId: string; fcmToken: string }>({
      query: ({ driverId, fcmToken }) => ({
        url: `/drivers/${driverId}/fcm-token`,
        method: 'PATCH',
        body: { fcm_token: fcmToken },
      }),
    }),

    getRideActivity: builder.query<any, { driverId: string; limit?: number; offset?: number; from?: string; to?: string; status?: string }>({
      query: ({ driverId, limit, offset, from, to, status }) => {
        let url = `/drivers/activity/${driverId}`;
        const params: string[] = [];
        if (limit) { params.push(`limit=${limit}`); }
        if (offset) { params.push(`offset=${offset}`); }
        if (from) { params.push(`from=${from}`); }
        if (to) { params.push(`to=${to}`); }
        if (status) { params.push(`status=${status}`); }
        if (params.length) { url += `?${params.join('&')}`; }
        return url;
      },
      providesTags: ['Driver'],
    }),
    getTripById: builder.query<any, string>({
      query: (tripId) => `/trips/bytripid/${tripId}`,
      providesTags: ['Driver'],
    }),
    getTodayOverview: builder.query<any, string>({
      query: (driverId) => `/drivers/today-overview/${driverId}`,
      providesTags: ['Driver'],
    }),

    /* ─────────── SOS (/sos) ─────────── */
    triggerSos: builder.mutation<any, { trip_id?: string }>({
      query: (body) => ({
        url: `/sos/trigger`,
        method: 'POST',
        body,
      }),
    }),

    /* ─────────── REFERRAL (/drivers/referral) ─────────── */

    getMyReferralCode: builder.query<any, void>({
      query: () => '/drivers/referral/code',
      providesTags: ['Referral'],
    }),

    getMyReferralStats: builder.query<any, void>({
      query: () => '/drivers/referral/stats',
      providesTags: ['Referral'],
    }),

    applyReferralCode: builder.mutation<any, { code: string }>({
      query: (body) => ({
        url: '/drivers/referral/apply',
        method: 'POST',
        body,
      }),
    }),

    /* ─────────── SUPPORT (/support) ─────────── */

    // Get active FAQs for Help Center
    getSupportFaqs: builder.query<any, void>({
      query: () => '/support/faqs',
      providesTags: ['Support'],
    }),

    // Create a support ticket
    createSupportTicket: builder.mutation<any, { driver_id: string; subject: string; description: string; priority?: string; category?: string }>({
      query: (body) => ({
        url: '/support/tickets',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Support'],
    }),

    // Get driver's own tickets
    getMyTickets: builder.query<any, string>({
      query: (driverId) => `/support/tickets/driver/${driverId}`,
      providesTags: ['Support'],
    }),

    // Get messages for a specific ticket
    getTicketMessages: builder.query<any, string>({
      query: (ticketId) => `/support/tickets/${ticketId}/messages`,
      providesTags: ['Support'],
    }),
  }),
});

export const {
  // Drivers
  useCreateDriverMutation,
  useAdminVerifyDriverMutation,
  useGetDriverProfileQuery,
  useLazyGetDriverProfileQuery,
  useDeleteMyAccountMutation,
  useResetProfileMutation,
  useGetDriverByIdQuery,
  useLazyGetDriverByIdQuery,
  useUpdateDriverMutation,

  // Documents
  useGetDriverDocumentsQuery,
  useLazyGetDriverDocumentsQuery,
  useGetDocUploadUrlMutation,
  useSaveDocumentMutation,
  useSubmitDocumentsMutation,

  // Trip Verification
  useSubmitTripPhotosMutation,
  useGetTripVerificationStatusQuery,
  useLazyGetTripVerificationStatusQuery,

  // Performance
  useGetDriverPerformanceQuery,
  useLazyGetDriverPerformanceQuery,

  // Earnings
  useGetEarningsSummaryQuery,
  useLazyGetEarningsSummaryQuery,
  useGetEarningsTransactionsQuery,
  useLazyGetEarningsTransactionsQuery,

  // Wallet
  useGetWalletBalanceQuery,
  useLazyGetWalletBalanceQuery,
  useGetWalletTransactionsQuery,
  useLazyGetWalletTransactionsQuery,

  // FCM Token
  useSaveFcmTokenMutation,

  // Ride Activity
  useGetRideActivityQuery,
  useLazyGetRideActivityQuery,

  // Trip Details
  useGetTripByIdQuery,
  useLazyGetTripByIdQuery,

  // Online Status
  useGoOnlineMutation,
  useGoOfflineMutation,

  // Trip Lifecycle
  useGetIncomingTripsQuery,
  useLazyGetIncomingTripsQuery,
  useGetActiveTripQuery,
  useLazyGetActiveTripQuery,
  useAcceptTripMutation,
  useStartTripMutation,
  useArrivingTripMutation,
  useArrivedTripMutation,
  useDestinationReachedTripMutation,
  useCancelTripMutation,
  useSkipTripMutation,
  useCompleteTripMutation,

  // Today Overview
  useGetTodayOverviewQuery,
  useLazyGetTodayOverviewQuery,

  // SOS
  useTriggerSosMutation,

  // Referral
  useGetMyReferralCodeQuery,
  useLazyGetMyReferralCodeQuery,
  useGetMyReferralStatsQuery,
  useLazyGetMyReferralStatsQuery,
  useApplyReferralCodeMutation,

  // Support
  useGetSupportFaqsQuery,
  useLazyGetSupportFaqsQuery,
  useCreateSupportTicketMutation,
  useGetMyTicketsQuery,
  useLazyGetMyTicketsQuery,
  useGetTicketMessagesQuery,
  useLazyGetTicketMessagesQuery,
} = driverApi;

