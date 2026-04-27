export enum TripStatus {
  REQUESTED = 'REQUESTED',
  ASSIGNED = 'ASSIGNED',
  ACCEPTED = 'ACCEPTED',
  ARRIVING = 'ARRIVING',
  ARRIVED = 'ARRIVED',
  LIVE = 'LIVE',
  DESTINATION_REACHED = 'DESTINATION_REACHED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  MID_CANCELLED = 'MID_CANCELLED',
}

export interface RecentActivityItem {
  id: string;
  route: string;
  timeAgo: string;
  amount: string;
  status: 'completed' | 'cancelled' | 'pending';
}

export interface Ride {
  trip_id: string;
  user_id: string;
  driver_id: string | null;
  vehicle_id: string | null;
  ride_type: 'ONE_WAY' | 'OUTSTATION' | 'ROUND_TRIP';
  service_type: string;
  trip_status: TripStatus | string;
  original_scheduled_start_time: string;
  scheduled_start_time: string;
  actual_pickup_time: string | null;
  actual_drop_time: string | null;
  pickup_lat: string;
  pickup_lng: string;
  pickup_address: string;
  drop_lat: string;
  drop_lng: string;
  drop_address: string;
  distance_km: string;
  trip_duration_minutes: number;
  waiting_time_minutes: number; 
  base_fare: string;
  waiting_charges: string;
  driver_allowance: string;
  platform_fee: string;
  total_fare: string;
  paid_amount: string;
  payment_status: 'PENDING' | 'PAID';
  cancel_reason: string | null;
  cancel_by: string | null;
  notes: string | null;
  rating: number | null;
  re_route_id: string | null;
  feedback: string | null;
  assigned_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
  booking_type: 'LIVE' | 'SCHEDULED';
  is_for_self: boolean;
  otp?: string; 
  trip_code?: string;
  user_details?: {
    id: string;
    full_name: string;
    profile_url: string;
    rating: number;
    phone_number?: string;
    email?: string;
  };
}

