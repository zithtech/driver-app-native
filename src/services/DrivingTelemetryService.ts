import Geolocation from 'react-native-geolocation-service';
import { Platform } from 'react-native';

export interface RouteCheckpoint {
  id: string;
  sequenceOrder: number;
  checkpointType: 'START' | 'LEFT_TURN' | 'RIGHT_TURN' | 'TRAFFIC_SIGNAL' | 'REVERSE_PARK' | 'DESTINATION';
  latitude: number;
  longitude: number;
  radiusMeters: number;
  speedLimitKmh: number;
  voicePromptEn: string;
  voicePromptTa: string;
  mandatoryStopDurationSec: number;
  reached?: boolean;
  reachedAt?: number;
}

export interface TelemetryPoint {
  timestamp: number;
  latitude: number;
  longitude: number;
  speedKmh: number;
  heading: number;
  accuracy: number;
  accelX?: number;
  accelY?: number;
  accelZ?: number;
  flaggedEvent?: string;
}

export interface DrivingEvent {
  id: string;
  type: 'HARSH_BRAKE' | 'RAPID_ACCEL' | 'OVERSPEED' | 'CHECKPOINT_REACHED' | 'GPS_LOST';
  timestamp: number;
  speedKmh: number;
  details: string;
}

class DrivingTelemetryService {
  private watchId: number | null = null;
  private isTracking = false;
  private currentCheckpoints: RouteCheckpoint[] = [];
  private activeCheckpointIndex = 0;
  private telemetryBuffer: TelemetryPoint[] = [];
  private recentPoints: TelemetryPoint[] = [];
  private eventLogs: DrivingEvent[] = [];

  // Listeners
  private locationListeners: Array<(point: TelemetryPoint) => void> = [];
  private checkpointListeners: Array<(cp: RouteCheckpoint, index: number) => void> = [];
  private eventListeners: Array<(ev: DrivingEvent) => void> = [];

  // Development Auto-Simulation State
  private simInterval: ReturnType<typeof setInterval> | null = null;
  private isSimulating = false;
  private simSpeedMultiplier = 1;
  private simCurrentLat = 13.0827;
  private simCurrentLng = 80.2707;
  private simTargetCpIndex = 0;
  private simStepProgress = 0; // 0 to 1 between checkpoints
  private simSignalWaitRemaining = 0;

  /**
   * Initializes the active route checkpoints for the driving session
   */
  setRouteCheckpoints(checkpoints: RouteCheckpoint[]) {
    this.currentCheckpoints = checkpoints.map((cp) => ({ ...cp, reached: false }));
    this.activeCheckpointIndex = 0;
    this.telemetryBuffer = [];
    this.recentPoints = [];
    this.eventLogs = [];

    if (checkpoints.length > 0) {
      this.simCurrentLat = checkpoints[0].latitude;
      this.simCurrentLng = checkpoints[0].longitude;
      this.simTargetCpIndex = 0;
      this.simStepProgress = 0;
    }
  }

  getCurrentCheckpoint(): RouteCheckpoint | null {
    if (this.activeCheckpointIndex < this.currentCheckpoints.length) {
      return this.currentCheckpoints[this.activeCheckpointIndex];
    }
    return null;
  }

  getAllCheckpoints(): RouteCheckpoint[] {
    return [...this.currentCheckpoints];
  }

  onLocationUpdate(listener: (point: TelemetryPoint) => void) {
    this.locationListeners.push(listener);
    return () => {
      this.locationListeners = this.locationListeners.filter((l) => l !== listener);
    };
  }

  onCheckpointReached(listener: (cp: RouteCheckpoint, index: number) => void) {
    this.checkpointListeners.push(listener);
    return () => {
      this.checkpointListeners = this.checkpointListeners.filter((l) => l !== listener);
    };
  }

  onEventTriggered(listener: (ev: DrivingEvent) => void) {
    this.eventListeners.push(listener);
    return () => {
      this.eventListeners = this.eventListeners.filter((l) => l !== listener);
    };
  }

  startTracking() {
    if (this.isTracking) return;
    this.isTracking = true;

    this.watchId = Geolocation.watchPosition(
      (position) => {
        const coords = position.coords;
        const speedKmh = Math.max(0, (coords.speed || 0) * 3.6); // convert m/s to km/h

        const point: TelemetryPoint = {
          timestamp: position.timestamp || Date.now(),
          latitude: coords.latitude,
          longitude: coords.longitude,
          speedKmh: Math.round(speedKmh * 10) / 10,
          heading: Math.round(coords.heading || 0),
          accuracy: Math.round(coords.accuracy || 5),
        };

        this.processPoint(point);
      },
      (error) => {
        console.warn('[DrivingTelemetryService] GPS Tracking error:', error);
        this.emitEvent({
          id: `${Date.now()}_gps_loss`,
          type: 'GPS_LOST',
          timestamp: Date.now(),
          speedKmh: 0,
          details: error.message || 'GPS signal unavailable',
        });
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 1, // update every 1 meter
        interval: 1000, // 1 second
        fastestInterval: 500,
        showsBackgroundLocationIndicator: true,
      }
    );
  }

  private processPoint(point: TelemetryPoint) {
    // 1. Maintain a 3-second sliding window for acceleration / deceleration detection
    this.recentPoints.push(point);
    if (this.recentPoints.length > 5) {
      this.recentPoints.shift();
    }

    let detectedEvent: string | undefined;

    // 2. Fused Harsh Braking check: speed dropped by >= 15 km/h in <= 1.5 seconds
    if (this.recentPoints.length >= 2) {
      const olderPoint = this.recentPoints[0];
      const timeDeltaSec = (point.timestamp - olderPoint.timestamp) / 1000;
      if (timeDeltaSec > 0.5 && timeDeltaSec <= 2.0) {
        const speedDrop = olderPoint.speedKmh - point.speedKmh;
        if (speedDrop >= 15 && olderPoint.speedKmh > 20) {
          detectedEvent = 'HARSH_BRAKE';
          this.emitEvent({
            id: `${point.timestamp}_brake`,
            type: 'HARSH_BRAKE',
            timestamp: point.timestamp,
            speedKmh: point.speedKmh,
            details: `Sudden deceleration: -${Math.round(speedDrop)} km/h in ${timeDeltaSec.toFixed(1)}s`,
          });
        } else if (-speedDrop >= 18) {
          detectedEvent = 'RAPID_ACCEL';
          this.emitEvent({
            id: `${point.timestamp}_accel`,
            type: 'RAPID_ACCEL',
            timestamp: point.timestamp,
            speedKmh: point.speedKmh,
            details: `Rapid acceleration: +${Math.round(-speedDrop)} km/h in ${timeDeltaSec.toFixed(1)}s`,
          });
        }
      }
    }

    // 3. Overspeeding Check against Current Checkpoint Speed Limit
    const targetCp = this.getCurrentCheckpoint();
    const speedLimit = targetCp?.speedLimitKmh || 40;
    if (point.speedKmh > speedLimit + 6) {
      detectedEvent = detectedEvent || 'OVERSPEED';
      // Debounce overspeed events so we don't spam every second
      const lastOverspeed = this.eventLogs.filter((e) => e.type === 'OVERSPEED').pop();
      if (!lastOverspeed || point.timestamp - lastOverspeed.timestamp > 10000) {
        this.emitEvent({
          id: `${point.timestamp}_speed`,
          type: 'OVERSPEED',
          timestamp: point.timestamp,
          speedKmh: point.speedKmh,
          details: `Speed ${point.speedKmh} km/h exceeded limit of ${speedLimit} km/h`,
        });
      }
    }

    point.flaggedEvent = detectedEvent;
    this.telemetryBuffer.push(point);

    // 4. Notify location listeners
    this.locationListeners.forEach((l) => l(point));

    // 5. Evaluate Checkpoint Proximity
    this.checkCheckpointArrival(point);
  }

  private checkCheckpointArrival(point: TelemetryPoint) {
    const cp = this.getCurrentCheckpoint();
    if (!cp || cp.reached) return;

    const distMeters = this.calculateDistanceMeters(
      point.latitude,
      point.longitude,
      cp.latitude,
      cp.longitude
    );

    const radius = cp.radiusMeters || 25;
    if (distMeters <= radius) {
      cp.reached = true;
      cp.reachedAt = point.timestamp;

      this.emitEvent({
        id: `${point.timestamp}_cp_${cp.sequenceOrder}`,
        type: 'CHECKPOINT_REACHED',
        timestamp: point.timestamp,
        speedKmh: point.speedKmh,
        details: `Reached Checkpoint ${cp.sequenceOrder}: ${cp.checkpointType}`,
      });

      this.checkpointListeners.forEach((l) => l(cp, this.activeCheckpointIndex));
      this.activeCheckpointIndex++;
    }
  }

  private emitEvent(ev: DrivingEvent) {
    this.eventLogs.push(ev);
    this.eventListeners.forEach((l) => l(ev));
  }

  /**
   * Haversine formula to compute distance in meters between two lat/lng coordinates
   */
  calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  flushTelemetryBatch(): TelemetryPoint[] {
    const batch = [...this.telemetryBuffer];
    this.telemetryBuffer = [];
    return batch;
  }

  getEventLogs(): DrivingEvent[] {
    return [...this.eventLogs];
  }

  stopTracking() {
    this.stopSimulation();
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isTracking = false;
  }

  /* ================= AUTO SIMULATION (DEV / TESTING) ================= */

  /**
   * Starts automatic vehicle movement simulation along route checkpoints.
   * Interpolates coordinates, simulates realistic speeds, pauses at mandatory stops, and emits telemetry.
   */
  startSimulation(speedMultiplier = 1) {
    if (this.isSimulating) {
      this.simSpeedMultiplier = speedMultiplier;
      return;
    }

    this.isSimulating = true;
    this.simSpeedMultiplier = speedMultiplier;

    if (this.currentCheckpoints.length === 0) return;

    if (this.simTargetCpIndex >= this.currentCheckpoints.length) {
      this.simTargetCpIndex = 0;
      this.simStepProgress = 0;
      this.simCurrentLat = this.currentCheckpoints[0].latitude;
      this.simCurrentLng = this.currentCheckpoints[0].longitude;
    }

    const TICK_MS = 400;

    this.simInterval = setInterval(() => {
      if (!this.isSimulating || this.currentCheckpoints.length === 0) return;

      // Handle mandatory stop at traffic signal
      if (this.simSignalWaitRemaining > 0) {
        this.simSignalWaitRemaining -= (TICK_MS / 1000) * this.simSpeedMultiplier;
        this.processPoint({
          timestamp: Date.now(),
          latitude: this.simCurrentLat,
          longitude: this.simCurrentLng,
          speedKmh: 0,
          heading: 0,
          accuracy: 2,
        });
        return;
      }

      const totalCps = this.currentCheckpoints.length;
      const fromCp = this.currentCheckpoints[this.simTargetCpIndex] || this.currentCheckpoints[0];
      const nextIdx = Math.min(this.simTargetCpIndex + 1, totalCps - 1);
      const toCp = this.currentCheckpoints[nextIdx];

      // If already at destination
      if (this.simTargetCpIndex >= totalCps - 1 && this.simStepProgress >= 1) {
        this.stopSimulation();
        return;
      }

      // Compute step delta based on speed multiplier
      const stepIncrement = 0.035 * this.simSpeedMultiplier;
      this.simStepProgress += stepIncrement;

      if (this.simStepProgress >= 1) {
        // Checkpoint reached!
        this.simStepProgress = 0;
        this.simCurrentLat = toCp.latitude;
        this.simCurrentLng = toCp.longitude;
        this.simTargetCpIndex = nextIdx;

        // Check if mandatory stop required (e.g. Traffic Signal 5s stop)
        if (toCp.mandatoryStopDurationSec > 0 && !toCp.reached) {
          this.simSignalWaitRemaining = toCp.mandatoryStopDurationSec;
        }

        const heading = this.calculateHeading(fromCp.latitude, fromCp.longitude, toCp.latitude, toCp.longitude);

        this.processPoint({
          timestamp: Date.now(),
          latitude: toCp.latitude,
          longitude: toCp.longitude,
          speedKmh: toCp.mandatoryStopDurationSec > 0 ? 0 : Math.round(toCp.speedLimitKmh * 0.7),
          heading,
          accuracy: 3,
        });
      } else {
        // Interpolate position along line segment
        this.simCurrentLat = fromCp.latitude + (toCp.latitude - fromCp.latitude) * this.simStepProgress;
        this.simCurrentLng = fromCp.longitude + (toCp.longitude - fromCp.longitude) * this.simStepProgress;

        const heading = this.calculateHeading(fromCp.latitude, fromCp.longitude, toCp.latitude, toCp.longitude);

        // Realistic cruising speed
        const baseSpeed = toCp.speedLimitKmh || 35;
        let speed = Math.round(baseSpeed * (0.8 + Math.sin(this.simStepProgress * Math.PI) * 0.2));
        if (toCp.mandatoryStopDurationSec > 0 && this.simStepProgress > 0.75) {
          // Slowing down for red signal
          speed = Math.max(5, Math.round(speed * (1 - this.simStepProgress)));
        }

        this.processPoint({
          timestamp: Date.now(),
          latitude: this.simCurrentLat,
          longitude: this.simCurrentLng,
          speedKmh: speed,
          heading,
          accuracy: 3,
        });
      }
    }, TICK_MS);
  }

  setSimulationSpeed(speedMultiplier: number) {
    this.simSpeedMultiplier = Math.max(1, Math.min(10, speedMultiplier));
  }

  getSimulationSpeed(): number {
    return this.simSpeedMultiplier;
  }

  isSimActive(): boolean {
    return this.isSimulating;
  }

  pauseSimulation() {
    this.isSimulating = false;
    if (this.simInterval !== null) {
      clearInterval(this.simInterval);
      this.simInterval = null;
    }
  }

  stopSimulation() {
    this.isSimulating = false;
    if (this.simInterval !== null) {
      clearInterval(this.simInterval);
      this.simInterval = null;
    }
    this.simStepProgress = 0;
    this.simSignalWaitRemaining = 0;
  }

  /**
   * Instantly teleports the simulated vehicle directly into the next checkpoint radius
   */
  skipToNextCheckpoint() {
    const nextIdx = Math.min(this.activeCheckpointIndex, this.currentCheckpoints.length - 1);
    const targetCp = this.currentCheckpoints[nextIdx];
    if (targetCp) {
      this.simCurrentLat = targetCp.latitude;
      this.simCurrentLng = targetCp.longitude;
      this.simStepProgress = 1;
      this.simTargetCpIndex = nextIdx;

      this.processPoint({
        timestamp: Date.now(),
        latitude: targetCp.latitude,
        longitude: targetCp.longitude,
        speedKmh: targetCp.mandatoryStopDurationSec > 0 ? 0 : Math.round(targetCp.speedLimitKmh * 0.7),
        heading: 0,
        accuracy: 2,
      });
    }
  }

  /**
   * Injects an intentional driving violation (e.g., Overspeed, Harsh Brake, Rapid Accel)
   * to test voice alarms, event toasts, and automated score deduction in the engine.
   */
  triggerSimulatedViolation(type: 'HARSH_BRAKE' | 'OVERSPEED' | 'RAPID_ACCEL') {
    const now = Date.now();
    if (type === 'OVERSPEED') {
      this.processPoint({
        timestamp: now,
        latitude: this.simCurrentLat,
        longitude: this.simCurrentLng,
        speedKmh: 65, // Exceeds 40 km/h limit
        heading: 0,
        accuracy: 3,
      });
    } else if (type === 'HARSH_BRAKE') {
      // Injects prior point at 48 km/h, then immediate drop to 10 km/h
      this.processPoint({
        timestamp: now - 800,
        latitude: this.simCurrentLat,
        longitude: this.simCurrentLng,
        speedKmh: 48,
        heading: 0,
        accuracy: 3,
      });
      this.processPoint({
        timestamp: now,
        latitude: this.simCurrentLat,
        longitude: this.simCurrentLng,
        speedKmh: 10, // -38 km/h in 0.8s
        heading: 0,
        accuracy: 3,
      });
    } else if (type === 'RAPID_ACCEL') {
      this.processPoint({
        timestamp: now - 800,
        latitude: this.simCurrentLat,
        longitude: this.simCurrentLng,
        speedKmh: 5,
        heading: 0,
        accuracy: 3,
      });
      this.processPoint({
        timestamp: now,
        latitude: this.simCurrentLat,
        longitude: this.simCurrentLng,
        speedKmh: 36, // +31 km/h in 0.8s
        heading: 0,
        accuracy: 3,
      });
    }
  }

  private calculateHeading(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
    const y = Math.sin(deltaLambda) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
    const theta = Math.atan2(y, x);
    return Math.round(((theta * 180) / Math.PI + 360) % 360);
  }
}

export default new DrivingTelemetryService();
