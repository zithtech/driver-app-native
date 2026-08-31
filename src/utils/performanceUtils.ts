/**
 * Performance Utils for Driver Performance Metrics
 */

export interface PerformanceMetrics {
  completionRate: number;
  acceptanceRate: number;
  cancellationRate: number;
  onTimeRate: number;
  rating: number;
  totalTrips: number;
  completedTrips: number;
  cancelledTrips: number;
  rejectedTrips: number;
  totalEarnings: number;
  onlineMinutes: number;
}

/**
 * Calculates performance metrics from a list of ride objects.
 * 
 * @param rides Array of ride objects from the API
 * @returns Object with calculated rates and counts
 */
export const calculatePerformanceMetrics = (rides: any[]): PerformanceMetrics => {
  if (!Array.isArray(rides) || rides.length === 0) {
    return {
      completionRate: 0,
      acceptanceRate: 0,
      cancellationRate: 0,
      onTimeRate: 0,
      rating: 0,
      totalTrips: 0,
      completedTrips: 0,
      cancelledTrips: 0,
      rejectedTrips: 0,
      totalEarnings: 0,
      onlineMinutes: 0,
    };
  }

  // 1. Filter for valid trips (excluding REQUESTED if they were never accepted/rejected)
  // Actually, for acceptance rate, we need ALL trips that were assigned to the driver.
  
  const totalTrips = rides.length;
  
  const completedRides = rides.filter(r => 
    r.status?.toUpperCase() === 'COMPLETED' || 
    r.trip_status?.toUpperCase() === 'COMPLETED'
  );
  
  const completedTrips = completedRides.length;

  const cancelledTrips = rides.filter(r => 
    r.status?.toUpperCase() === 'CANCELLED' || 
    r.trip_status?.toUpperCase() === 'CANCELLED'
  ).length;

  // Accepted Trips: Anything that wasn't outright rejected or expired at REQUESTED state.
  // In most systems, if it's Completed, Arrived, Started, or Cancelled (by driver later), it was Accepted.
  const acceptedTrips = rides.filter(r => 
    ['ACCEPTED', 'ARRIVED', 'STARTED', 'COMPLETED', 'CANCELLED', 'DESTINATION_REACHED'].includes((r.status || r.trip_status || '').toUpperCase())
  ).length;

  // 2. Acceptance Rate: (Accepted / Total)
  const acceptanceRate = totalTrips > 0 ? (acceptedTrips / totalTrips) * 100 : 0;

  // 3. Completion Rate: (Completed / Accepted)
  // We only count completion against trips that were actually accepted.
  const completionRate = acceptedTrips > 0 ? (completedTrips / acceptedTrips) * 100 : 0;

  // 4. Average Rating: (Sum of Ratings / Rated Trips)
  const ratedRides = rides.filter(r => {
    const rval = parseFloat(r.rating || r.user_rating || r.trip_rating || r.passenger_rating || 0);
    return !isNaN(rval) && rval > 0;
  });
  
  const totalRating = ratedRides.reduce((sum, r) => {
    const val = parseFloat(r.rating || r.user_rating || r.trip_rating || r.passenger_rating || 0);
    return sum + val;
  }, 0);
  
  const rating = ratedRides.length > 0 ? totalRating / ratedRides.length : 0;

  // 5. Total Earnings: Sum of amount from completed rides
  const totalEarnings = completedRides.reduce((sum, r) => {
    const amt = typeof r.amount === 'string' ? parseFloat(r.amount) : (r.amount || r.fare || 0);
    return sum + amt;
  }, 0);

  // 6. Online Time (Simplified from trips): Sum of trip_duration_minutes + waiting_time_minutes
  const onlineMinutes = rides.reduce((sum, r) => {
    const duration = r.trip_duration_minutes || r.duration || 0;
    const waiting = r.waiting_time_minutes || 0;
    const wasActive = ['STARTED', 'COMPLETED', 'ARRIVED', 'DESTINATION_REACHED'].includes((r.status || r.trip_status || '').toUpperCase());
    return wasActive ? sum + (duration + waiting) : sum;
  }, 0);

  // 7. On-time Rate: For completed rides, check if driver arrived within a reasonable window.
  // Uses arrived_at vs scheduled_at/estimated_pickup_at with a 5-min grace period.
  // Returns -1 when no real timestamp data is available (sentinel for "unavailable").
  let onTimeCount = 0;
  let onTimeEligible = 0;
  completedRides.forEach(r => {
    const arrivedAt = r.arrived_at || r.driver_arrived_at || r.pickup_time;
    const scheduledAt = r.scheduled_at || r.estimated_pickup_at || r.created_at;
    if (arrivedAt && scheduledAt) {
      onTimeEligible++;
      const arrived = new Date(arrivedAt).getTime();
      const scheduled = new Date(scheduledAt).getTime();
      const GRACE_MINUTES = 5;
      if (arrived <= scheduled + (GRACE_MINUTES * 60 * 1000)) {
        onTimeCount++;
      }
    }
  });
  const onTimeRate = onTimeEligible > 0
    ? Math.round((onTimeCount / onTimeEligible) * 100)
    : -1; // -1 = no real data available

  return {
    completionRate: Math.round(completionRate),
    acceptanceRate: Math.round(acceptanceRate),
    cancellationRate: totalTrips > 0 ? Math.round((cancelledTrips / totalTrips) * 100) : 0,
    onTimeRate,
    rating: parseFloat(rating.toFixed(1)),
    totalTrips,
    completedTrips,
    cancelledTrips,
    rejectedTrips: totalTrips - acceptedTrips,
    totalEarnings,
    onlineMinutes,
  };
};

/**
 * Generates personalized insights based on current performance metrics.
 */
export const getDynamicPerformanceInsights = (metrics: PerformanceMetrics, t: any) => {
  const insights = [];

  // Acceptance Rate Insights
  if (metrics.acceptanceRate > 90) {
    insights.push({
      text: t('insight_acceptance_high', 'Excellent! Your high acceptance rate makes you a preferred driver.'),
      icon: 'trending-up',
      color: '#10B981',
    });
  } else if (metrics.acceptanceRate < 60) {
    insights.push({
      text: t('insight_acceptance_low', 'Your acceptance rate is lower than average; try to be more responsive to requests.'),
      icon: 'bulb-outline',
      color: '#F59E0B',
    });
  }

  // Rating Insights
  if (metrics.rating >= 4.8) {
    insights.push({
      text: t('insight_rating_high', 'Great job! Your rating is in the top 5% of drivers this week.'),
      icon: 'star',
      color: '#EAB308',
    });
  } else if (metrics.rating < 4.2 && metrics.rating > 0) {
    insights.push({
      text: t('insight_rating_low', 'Maintain a clean vehicle and be polite to buyers to improve your 5-star rating.'),
      icon: 'chatbubble-outline',
      color: '#3B82F6',
    });
  }

  // Completion Rate Insights
  if (metrics.completionRate < 85 && metrics.totalTrips > 2) {
    insights.push({
      text: t('insight_completion_low', 'Avoid cancelling accepted rides to maintain your shift priority and incentives.'),
      icon: 'alert-circle-outline',
      color: '#EF4444',
    });
  } else if (metrics.completionRate >= 98 && metrics.completedTrips > 0) {
    insights.push({
      text: t('insight_completion_high', 'You are a highly reliable driver! Top completion rates lead to better earnings.'),
      icon: 'ribbon-outline',
      color: '#8B5CF6',
    });
  }

  // Default if list is empty
  if (insights.length === 0) {
    insights.push({
      text: t('insight_default', 'Try driving during peak hours (6 PM - 9 PM) to increase earnings by 15%.'),
      icon: 'bulb-outline',
      color: '#3B82F6',
    });
  }

  return insights.slice(0, 3); // Return top 3 insights
};

/**
 * Calculates current tier, next tier, and the roadmap to achieve it.
 */
export const getTierRoadmapData = (period: 'Today' | 'Week' | 'Month', metrics: PerformanceMetrics | null, t: any) => {
  const thresholds = {
    Today: { Silver: 2, Gold: 5, Platinum: 10 },
    Week: { Silver: 10, Gold: 30, Platinum: 60 },
    Month: { Silver: 40, Gold: 120, Platinum: 240 },
  };

  const activeThresholds = thresholds[period] || thresholds.Week;
  
  const tiers = [
    { name: t('tier_partner', 'Partner'), threshold: 0, color: '#94A3B8' },
    { name: t('tier_silver', 'Silver'), threshold: activeThresholds.Silver, color: '#CBD5E1' },
    { name: t('tier_gold', 'Gold'), threshold: activeThresholds.Gold, color: '#FBBF24' },
    { name: t('tier_platinum', 'Platinum'), threshold: activeThresholds.Platinum, color: '#3B82F6' },
  ];

  const completedRides = metrics?.completedTrips || 0;

  let currentTierIndex = 0;
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (completedRides >= tiers[i].threshold) {
      currentTierIndex = i;
      break;
    }
  }

  const currentTier = tiers[currentTierIndex];
  const nextTier = tiers[currentTierIndex + 1] || null;

  let ridesNeeded = 0;
  let progress = 100;
  let tasks = [];

  if (nextTier) {
    ridesNeeded = nextTier.threshold - completedRides;
    const tierRange = nextTier.threshold - currentTier.threshold;
    const ridesInTier = completedRides - currentTier.threshold;
    progress = Math.min((ridesInTier / tierRange) * 100, 100);

    // 1. Core Rides Completed Task
    tasks.push(t('tasks_rides_needed', `{{count}} more rides needed to reach {{tier}}`, { count: ridesNeeded, tier: nextTier.name }));
    
    // 2. Dynamic Performance Based Tasks
    if (metrics) {
      // Suggest improving acceptance if low
      if (metrics.acceptanceRate < 80) {
        tasks.push(t('tasks_improve_acceptance', 'Maintain an acceptance rate above 80% to earn more points.'));
      }
      
      // Suggest improving rating if below target
      if (metrics.rating < 4.7 && metrics.rating > 0) {
        tasks.push(t('tasks_improve_rating', 'Providing a great rider experience can boost your rating.'));
      }
      
      // Suggest improving completion if low
      if (metrics.completionRate < 90 && metrics.completedTrips > 0) {
        tasks.push(t('tasks_improve_completion', 'Avoiding cancellations helps you reach the next tier faster.'));
      }

      // Tier Specific Gamification (Partner Tier)
      if (currentTierIndex === 0) {
        tasks.push(t('tasks_peak_hour_bonus', 'Drive during peak hours (6 PM - 9 PM) to maximize your points.'));
      }

      // Silver and above high-performance task
      if (currentTierIndex >= 1 && metrics.rating >= 4.5) {
        tasks.push(t('tasks_maintain_high_rating', 'Maintain a 4.8+ rating for maximum rewards.'));
      }
    } else {
        // Fallback for when metrics aren't available yet
        if (currentTierIndex >= 1) {
            tasks.push(t('tasks_maintain_rating', 'Maintain 4.5+ Rating'));
        }
    }
  }

  // 3. Dynamic Rating Growth Plan
  let ratingPlan = t('plan_rating_excellent', 'Maintain your excellent service quality.');
  if (metrics) {
    if (metrics.rating < 3.0 && metrics.rating > 0) {
      ratingPlan = t('plan_rating_low', 'URGENT Plan: Improve service immediately to keep your account active.');
    } else if (metrics.rating < 4.2 && metrics.rating > 0) {
      ratingPlan = t('plan_rating_average', 'Action Plan: Focus on professional behavior to improve rating.');
    } else if (metrics.rating < 4.8 && metrics.rating > 0) {
      ratingPlan = t('plan_rating_good', 'Keep it up! A clean car and polite greeting can push you to 5 stars.');
    }
  }

  return {
    currentTier,
    nextTier,
    ridesNeeded,
    pointsNeeded: ridesNeeded, // for compatibility
    progress,
    tasks: tasks.slice(0, 3), // Show top 3 most relevant tasks
    ratingPlan,
  };
};


/**
 * Calculates a weighted Overall Performance Score (0–100) from individual metrics.
 *
 * Weights:
 *   Rating (normalized 0–5 → 0–100): 30%
 *   Acceptance Rate:                  25%
 *   Completion Rate:                  25%
 *   On-time Rate:                     10%
 *   Low-Cancellation (inverted):      10%
 */
export interface OverallScoreResult {
  score: number;
  label: string;
  percentile: number;
}

export const calculateOverallScore = (metrics: PerformanceMetrics, t: any): OverallScoreResult => {
  // If no trips at all, return zero gracefully
  if (metrics.totalTrips === 0) {
    return { score: 0, label: t('label_no_data', 'No Data'), percentile: 0 };
  }

  const ratingNorm = (metrics.rating / 5) * 100;
  const cancelInverted = 100 - metrics.cancellationRate;
  const hasOnTimeData = metrics.onTimeRate >= 0;

  // When on-time data is unavailable (-1), redistribute its 10% weight
  // equally to acceptance and completion (each gets +5%)
  let score: number;
  if (hasOnTimeData) {
    score = Math.round(
      (ratingNorm * 0.30) +
      (metrics.acceptanceRate * 0.25) +
      (metrics.completionRate * 0.25) +
      (metrics.onTimeRate * 0.10) +
      (cancelInverted * 0.10)
    );
  } else {
    score = Math.round(
      (ratingNorm * 0.30) +
      (metrics.acceptanceRate * 0.30) +
      (metrics.completionRate * 0.30) +
      (cancelInverted * 0.10)
    );
  }

  // Clamp between 0 and 100
  const clampedScore = Math.max(0, Math.min(100, score));

  let label: string;
  if (clampedScore >= 90) label = 'Excellent';
  else if (clampedScore >= 80) label = 'Great';
  else if (clampedScore >= 70) label = 'Good';
  else if (clampedScore >= 60) label = 'Fair';
  else label = 'Needs Improvement';

  // Rough percentile: assumes a normal-ish distribution with mean ~75
  // score 90+ → top 10%, 80+ → top 25%, 70+ → top 40%, etc.
  let percentile: number;
  if (clampedScore >= 95) percentile = 95;
  else if (clampedScore >= 90) percentile = 90;
  else if (clampedScore >= 85) percentile = 85;
  else if (clampedScore >= 80) percentile = 75;
  else if (clampedScore >= 70) percentile = 60;
  else if (clampedScore >= 60) percentile = 40;
  else percentile = 20;

  return { score: clampedScore, label, percentile };
};

/**
 * Generates up to 3 dynamic tips based on the driver's weakest metrics.
 * Tips are ordered by severity — worst area first.
 */
export interface PerformanceTip {
  text: string;
  icon: string;
  color: string;
}

export const getDynamicTips = (metrics: PerformanceMetrics, t: any): PerformanceTip[] => {
  if (metrics.totalTrips === 0) {
    return [
      { text: t('tip_first_ride', 'Complete your first ride to start building your performance score!'), icon: 'car-sport-outline', color: '#3B82F6' },
      { text: t('tip_peak_hours', 'Stay online during peak hours (6–9 PM) for more ride requests.'), icon: 'time-outline', color: '#F59E0B' },
      { text: t('tip_gps_charged', 'Keep your phone charged and GPS on for best results.'), icon: 'battery-charging-outline', color: '#10B981' },
    ];
  }

  // Build a list of weaknesses sorted by severity
  const weaknesses: { priority: number; tip: PerformanceTip }[] = [];

  // Acceptance Rate
  if (metrics.acceptanceRate < 60) {
    weaknesses.push({ priority: 1, tip: { text: t('tip_acceptance_crit', 'Your acceptance rate is critically low. Accept more ride requests to avoid account restrictions.'), icon: 'alert-circle-outline', color: '#EF4444' } });
  } else if (metrics.acceptanceRate < 80) {
    weaknesses.push({ priority: 3, tip: { text: t('tip_acceptance_warn', 'Try accepting more ride requests to boost your acceptance rate above 80%.'), icon: 'checkmark-circle-outline', color: '#F59E0B' } });
  }

  // Rating
  if (metrics.rating > 0 && metrics.rating < 4.0) {
    weaknesses.push({ priority: 1, tip: { text: 'Your rating needs urgent attention. Focus on cleanliness, politeness, and safe driving.', icon: 'alert-circle-outline', color: '#EF4444' } });
  } else if (metrics.rating > 0 && metrics.rating < 4.5) {
    weaknesses.push({ priority: 3, tip: { text: 'Maintain a clean vehicle and greet riders politely to improve your rating.', icon: 'star-outline', color: '#F59E0B' } });
  }

  // Completion Rate
  if (metrics.completionRate < 80) {
    weaknesses.push({ priority: 2, tip: { text: 'Avoid cancelling accepted rides — low completion rates affect your earnings and ranking.', icon: 'close-circle-outline', color: '#EF4444' } });
  } else if (metrics.completionRate < 90) {
    weaknesses.push({ priority: 4, tip: { text: 'Complete more rides to push your completion rate above 90%.', icon: 'flag-outline', color: '#F59E0B' } });
  }

  // Cancellation Rate
  if (metrics.cancellationRate > 10) {
    weaknesses.push({ priority: 2, tip: { text: 'Your cancellation rate is high. Reduce cancellations to improve your overall score.', icon: 'shield-outline', color: '#EF4444' } });
  } else if (metrics.cancellationRate > 5) {
    weaknesses.push({ priority: 5, tip: { text: 'Keep your cancellation rate below 5% for the best performance standing.', icon: 'shield-checkmark-outline', color: '#F59E0B' } });
  }

  // On-time Rate — only show tips when real data is available (>= 0)
  if (metrics.onTimeRate >= 0 && metrics.onTimeRate < 70) {
    weaknesses.push({ priority: 2, tip: { text: 'Arrive at pickup locations on time — punctuality directly impacts rider satisfaction.', icon: 'time-outline', color: '#EF4444' } });
  } else if (metrics.onTimeRate >= 0 && metrics.onTimeRate < 85) {
    weaknesses.push({ priority: 5, tip: { text: 'Try to reach pickup points earlier to improve your on-time score.', icon: 'navigate-outline', color: '#F59E0B' } });
  }

  // Sort by priority (lower = more urgent)
  weaknesses.sort((a, b) => a.priority - b.priority);

  // If all metrics are strong, give congratulatory tips
  if (weaknesses.length === 0) {
    return [
      { text: 'Outstanding performance! Keep up the great work to maintain your top standing.', icon: 'trophy-outline', color: '#10B981' },
      { text: 'Drive during peak hours (6–9 PM) to maximize your earnings.', icon: 'trending-up-outline', color: '#3B82F6' },
      { text: 'Refer other drivers to earn referral bonuses!', icon: 'people-outline', color: '#8B5CF6' },
    ];
  }

  return weaknesses.slice(0, 3).map(w => w.tip);
};
