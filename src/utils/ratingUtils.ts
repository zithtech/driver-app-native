/**
 * Calculates the average rating from a list of ride activity items.
 * Filters for COMPLETED rides with a valid numeric rating.
 * 
 * @param rides Array of ride objects from the API
 * @returns Average rating rounded to 2 decimal places, or null if no ratings found.
 */
export const calculateAverageRating = (rides: any[]): number | null => {
  if (!Array.isArray(rides) || rides.length === 0) {
    return null;
  }

  const ratedRides = rides.filter((ride: any) => {
    // Standardize status checks for both 'Completed' (common UI form) 
    // and 'COMPLETED' (backend enum).
    const isCompleted = 
        ride.status?.toUpperCase() === 'COMPLETED' || 
        ride.trip_status?.toUpperCase() === 'COMPLETED';
    
    const rating = parseFloat(ride.driver_rating || ride.passenger_rating || ride.customer_rating || 0);
    return isCompleted && !isNaN(rating) && rating > 0;
  });

  if (ratedRides.length === 0) {
    return null;
  }

  const totalRating = ratedRides.reduce((sum: number, ride: any) => {
    const rating = parseFloat(ride.driver_rating || ride.passenger_rating || ride.customer_rating || 0);
    return sum + rating;
  }, 0);

  return parseFloat((totalRating / ratedRides.length).toFixed(2));
};
