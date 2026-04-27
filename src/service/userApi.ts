import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from './baseQueryWithReauth';

/* ================================================================
   userApi — Auth · Subscriptions · Trips · S3
   Base: /api  (set in baseQueryWithReauth)
   ================================================================ */

export const userApi = createApi({
  reducerPath: 'userApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Profile', 'Subscription', 'Trips'],

  endpoints: (builder) => ({

    /* ─────────── AUTH (/auth) ─────────── */

    sendOtp: builder.mutation<any, { phone_number: string; role: string; device_id: string; allow_new_device?: boolean }>({
      query: (body) => ({
        url: '/auth/request-otp',
        method: 'POST',
        body,
      }),
    }),

    verifyOtp: builder.mutation<any, { phone_number: string; role: string; otp: string; device_id: string; allow_new_device?: boolean; referred_by?: string }>({
      query: (body) => ({
        url: '/auth/verify-otp',
        method: 'POST',
        body,
      }),
    }),

    getMe: builder.query<any, void>({
      query: () => '/auth/me',
      providesTags: ['Profile'],
    }),

    signOut: builder.mutation<any, string>({
      query: (id) => ({
        url: `/auth/signout/${id}`,
        method: 'GET',
      }),
      invalidatesTags: ['Profile'],
    }),

    /* ─────────── S3 (/s3) ─────────── */

    getPresignedUrl: builder.mutation<any, { key: string; contentType: string }>({
      query: (body) => ({
        url: '/s3/presigned-url',
        method: 'POST',
        body,
      }),
    }),

    /* ─────────── SUBSCRIPTIONS (/subscriptions) ─────────── */

    createSubscriptionOrder: builder.mutation<any, { plan_id: number; billing_cycle: 'day' | 'week' | 'month'; promo_code?: string; use_reward_balance?: boolean }>({
      query: (body) => ({
        url: '/subscriptions/create-order',
        method: 'POST',
        body,
      }),
    }),

    verifySubscriptionPayment: builder.mutation<any, { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }>({
      query: (body) => ({
        url: '/subscriptions/verify-payment',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Subscription', 'Profile'],
    }),

    getMySubscription: builder.query<any, void>({
      query: () => '/subscriptions/my-subscription',
      providesTags: ['Subscription'],
    }),

    getSubscriptionPlans: builder.query<any, void>({
      query: () => '/subscriptions',
      providesTags: ['Subscription'],
    }),

    /* ─────────── PROMOS (/promos) ─────────── */

    validatePromo: builder.mutation<any, { code: string; amount: number }>({
      query: (body) => ({
        url: '/promos/validate',
        method: 'POST',
        body,
      }),
    }),

    getAvailablePromos: builder.query<any, void>({
      query: () => '/promos/available',
    }),

    /* ─────────── TRIPS (/trip) ─────────── */

    getTrips: builder.query<any, void>({
      query: () => '/trips',
      providesTags: ['Trips'],
    }),

    getTripById: builder.query<any, string>({
      query: (id) => `/trips/${id}`,
      providesTags: ['Trips'],
    }),

    createTrip: builder.mutation<any, any>({
      query: (body) => ({
        url: '/trips/create',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Trips'],
    }),

    updateTrip: builder.mutation<any, { id: string; body: any }>({
      query: ({ id, body }) => ({
        url: `/trips/update/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Trips'],
    }),

    /* ─────────── PAYMENTS (/payment) ─────────── */

    createPaymentOrder: builder.mutation<any, { plan_id: number; billing_cycle: 'day' | 'week' | 'month'; promo_code?: string }>({
      query: (body) => ({
        url: '/payment/create-order',
        method: 'POST',
        body,
      }),
    }),

    verifyPayment: builder.mutation<any, { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }>({
      query: (body) => ({
        url: '/payment/verify-payment',
        method: 'POST',
        body,
      }),
    }),

    createGenericOrder: builder.mutation<any, { amount: number }>({
      query: (body) => ({
        url: '/payment/generic-order',
        method: 'POST',
        body,
      }),
    }),
  }),
});

export const {
  // Auth
  useSendOtpMutation,
  useVerifyOtpMutation,
  useGetMeQuery,
  useLazyGetMeQuery,
  useSignOutMutation,

  // S3
  useGetPresignedUrlMutation,

  // Subscriptions
  useCreateSubscriptionOrderMutation,
  useVerifySubscriptionPaymentMutation,
  useGetMySubscriptionQuery,
  useLazyGetMySubscriptionQuery,
  useGetSubscriptionPlansQuery,
  useLazyGetSubscriptionPlansQuery,

  // Promos
  useValidatePromoMutation,
  useGetAvailablePromosQuery,
  useLazyGetAvailablePromosQuery,

  // Trips
  useGetTripsQuery,
  useLazyGetTripsQuery,
  useGetTripByIdQuery,
  useLazyGetTripByIdQuery,
  useCreateTripMutation,
  useUpdateTripMutation,

  // Payments
  useCreatePaymentOrderMutation,
  useVerifyPaymentMutation,
  useCreateGenericOrderMutation,
} = userApi;
