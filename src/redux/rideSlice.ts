import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { TripStatus } from '../types/trip';

export interface Ride {
    id?: string | number;
    trip_id: string;
    trip_code?: string;
    user_id: string;
    vehicle_id: string | null;
    ride_type: string;
    service_type: string;
    trip_status: TripStatus | string;
    scheduled_start_time: string | Date;
    original_scheduled_start_time?: string | Date;
    pickup_lat: number;
    pickup_lng: number;
    pickup_address: string;
    drop_lat: number;
    drop_lng: number;
    drop_address: string;
    distance_km: number;
    base_fare: number;
    driver_allowance: number;
    platform_fee: number;
    total_fare: number;
    booking_type: string;
    otp?: string;
    passenger?: string; // Adding for UI compatibility if needed
    phone?: string;
    rating?: number;
    scheduled_status?: string;
    re_dispatch_count?: number;
    startTime?: number; // Added for UI compatibility (mapped from scheduled_start_time)
    paymentType?: string; // Added for UI compatibility
    lastTripRating?: {
        rating: number;
        feedback?: string;
    } | null;
}

interface RideSliceState {
    myAcceptedRideId: string | null;
    currentRide: Ride | null;
    lastTripRating: { rating: number; feedback?: string } | null;
}

const initialState: RideSliceState = {
    myAcceptedRideId: null,
    currentRide: null,
    lastTripRating: null,
};

const rideSlice = createSlice({
    name: 'rideSlice',
    initialState,
    reducers: {
        setMyAcceptedRideId: (state, action: PayloadAction<string | null>) => {
            state.myAcceptedRideId = action.payload;
        },
        setCurrentRide: (state, action: PayloadAction<Ride | null>) => {
            state.currentRide = action.payload;
        },
        clearAcceptedRide: (state) => {
            state.myAcceptedRideId = null;
            state.currentRide = null;
        },
        setLastTripRating: (state, action: PayloadAction<{ rating: number; feedback?: string } | null>) => {
            state.lastTripRating = action.payload;
        },
    },
});

export const { setMyAcceptedRideId, setCurrentRide, clearAcceptedRide, setLastTripRating } = rideSlice.actions;

export default rideSlice.reducer;
