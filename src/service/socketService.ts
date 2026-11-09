import { io, Socket } from 'socket.io-client';
import { API_URL } from '../constant/config';
import { storage } from './utils/storage';
import Geolocation from 'react-native-geolocation-service';

interface RoomContext {
  tripId: string;
  userId?: string;
  role?: string;
}

class SocketService {
  private socket: Socket | null = null;
  private onTripUpdateCallback: ((data: any) => void) | null = null;
  private currentRoomContext: RoomContext | null = null;
  private persistentListeners: Map<string, Set<(data: any) => void>> = new Map();
  private connectionListeners: ((connected: boolean) => void)[] = [];
  public isConnected: boolean = false;
  private locationWatchId: number | null = null;
  private driverId: string | null = null;
  private lastSocketError: string | null = null;
  private lastSocketErrorTime: number = 0;

  async connect(userId?: string, role?: string) {
    if (userId) {
      this.driverId = userId;
    }

    if (this.socket?.connected) {
      if (this.driverId) {
        this.joinDriverRoom(this.driverId);
      }
      return;
    }

    const token = await storage.getAccessToken();

    this.socket = io(API_URL, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      auth: {
        token: token || '',
        userId: userId || this.driverId,
        role: role || 'DRIVER',
      },
    });

    // 🛡️ Re-apply persistent listeners to the new socket instance
    this.persistentListeners.forEach((callbacks, event) => {
      callbacks.forEach(callback => {
        console.log(`🔗 Re-attaching persistent listener for: [${event}]`);
        this.socket?.on(event, callback);
      });
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      console.log('✅ Socket Connected | Session:', this.socket?.id);
      this.notifyConnectionListeners(true);

      // 🛡️ Auto Re-join Room on Reconnect
      if (this.currentRoomContext) {
        console.log('🔄 Re-joining trip room:', this.currentRoomContext.tripId);
        this.joinTripRoom(
          this.currentRoomContext.tripId, 
          this.currentRoomContext.userId, 
          this.currentRoomContext.role
        );
      }

      if (this.driverId) {
        console.log('🔄 Re-joining driver rooms:', this.driverId);
        this.socket?.emit('JOIN_DRIVER_ROOM', this.driverId);
        this.socket?.emit('join', `driver_${this.driverId}`);
        this.socket?.emit('join', `kyc_${this.driverId}`);
      }
    });

    this.socket.on('disconnect', (reason: string) => {
      this.isConnected = false;
      console.log('❌ Socket Disconnected | Reason:', reason);
      this.notifyConnectionListeners(false);
      
      // If server disconnected us, reconnection is handled by the client automatically 
      // if reason is "io server disconnect", we might need to manual reconnect
      if (reason === 'io server disconnect') {
        this.socket?.connect();
      }
    });

    this.socket.on('connect_error', async (error: any) => {
      this.isConnected = false;
      this.notifyConnectionListeners(false);

      const now = Date.now();
      // Only log the same error once every 30 seconds to reduce console spam
      if (error.message !== this.lastSocketError || (now - this.lastSocketErrorTime > 30000)) {
        console.warn('⚠️ Socket Connection Error:', error.message);
        this.lastSocketError = error.message;
        this.lastSocketErrorTime = now;
      }

      if (error.message === 'Token expired' || error.message === 'Invalid token' || error.message === 'Authentication error') {
        console.log('🔄 refreshing token for socket...');
        const freshToken = await storage.getAccessToken();
        if (this.socket && freshToken) {
          this.socket.auth = { ...this.socket.auth, token: freshToken };
          this.socket.connect();
        }
      }
    });

    this.socket.on('trip_updated', (data: any) => {
      if (this.onTripUpdateCallback) {
        this.onTripUpdateCallback(data);
      }
    });

    // NOTE: NEW_TRIP_REQUEST is handled via persistent listeners registered
    // by useRideFeed (socketService.on). Do NOT add a hardcoded listener here
    // to avoid duplicate processing.
  }

  joinTripRoom(tripId: string, userId?: string, role?: string) {
    if (!tripId) return;
    
    // 💾 Store context for automatic re-join
    this.currentRoomContext = { tripId, userId, role };

    if (this.socket?.connected) {
      console.log('📡 Emitting join room:', `trip_${tripId}`);
      this.socket.emit('join', `trip_${tripId}`);
    } else {
      console.log('⏳ Socket not connected, room join will happen on connect:', `trip_${tripId}`);
    }
  }

  leaveTripRoom() {
    if (!this.currentRoomContext) return;
    
    const { tripId } = this.currentRoomContext;
    if (this.socket?.connected) {
      console.log('📡 Emitting leave room:', `trip_${tripId}`);
      this.socket.emit('leave', `trip_${tripId}`);
    }
    
    this.currentRoomContext = null;
  }

  joinDriverRoom(driverId: string) {
    if (!driverId) return;
    this.driverId = driverId;
    if (this.socket?.connected) {
      console.log('📡 Emitting JOIN_DRIVER_ROOM & join kyc:', driverId);
      this.socket.emit('JOIN_DRIVER_ROOM', driverId);
      this.socket.emit('join', `driver_${driverId}`);
      this.socket.emit('join', `kyc_${driverId}`);
    } else {
      console.log('⏳ Socket not connected, JOIN_DRIVER_ROOM will happen on connect:', driverId);
    }
  }

  joinKycSession(sessionId?: string, driverId?: string) {
    if (driverId) {
      this.joinDriverRoom(driverId);
    }
    if (sessionId && this.socket?.connected) {
      console.log('📡 Emitting JOIN_KYC_SESSION:', sessionId);
      this.socket.emit('JOIN_KYC_SESSION', { sessionId, driverId: driverId || this.driverId });
      this.socket.emit('join', `kyc_session_${sessionId}`);
    }
  }

  emit(event: string, data: any, callback?: (res: any) => void) {
    if (this.socket?.connected) {
      this.socket.emit(event, data, callback);
    } else {
      console.log(`⏳ Socket busy, could not emit ${event}`);
    }
  }

  on(event: string, callback: (data: any) => void) {
    if (!this.persistentListeners.has(event)) {
      this.persistentListeners.set(event, new Set());
    }
    this.persistentListeners.get(event)?.add(callback);
    
    // Attach to current socket if available
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (data: any) => void) {
    if (callback) {
      this.persistentListeners.get(event)?.delete(callback);
      if (this.persistentListeners.get(event)?.size === 0) {
        this.persistentListeners.delete(event);
      }
      this.socket?.off(event, callback);
    } else {
      this.persistentListeners.delete(event);
      this.socket?.off(event);
    }
  }

  onTripUpdate(callback: (data: any) => void) {
    this.onTripUpdateCallback = callback;
  }

  offTripUpdate() {
    this.onTripUpdateCallback = null;
  }
  
  onTripRated(callback: (data: any) => void) {
    this.socket?.on('TRIP_RATED', callback);
  }

  offTripRated() {
    this.socket?.off('TRIP_RATED');
  }

  // ✅ Trip Verification listeners
  onTripVerificationApproved(callback: (data: any) => void) {
    this.on('TRIP_VERIFICATION_APPROVED', callback);
  }

  offTripVerificationApproved(callback?: (data: any) => void) {
    this.off('TRIP_VERIFICATION_APPROVED', callback);
  }

  onTripVerificationRejected(callback: (data: any) => void) {
    this.on('TRIP_VERIFICATION_REJECTED', callback);
  }

  offTripVerificationRejected(callback?: (data: any) => void) {
    this.off('TRIP_VERIFICATION_REJECTED', callback);
  }

  emitLocationUpdate(
    rideId: string, 
    latitude: number, 
    longitude: number, 
    heading: number = 0, 
    eta: number = 0, 
    distance: number = 0
  ) {
    if (!this.socket?.connected) {
      console.warn('⚠️ Socket not connected, could not emit location update');
      return;
    }

    const payload = {
      rideId,
      latitude,
      longitude,
      heading,
      eta,
      distance,
      timestamp: Date.now(),
    };

    console.log(`📡 [SocketService] Emitting Location Update: [${latitude.toFixed(5)}, ${longitude.toFixed(5)}] | ETA: ${eta} | Dist: ${distance} for ride: ${rideId}`);
    this.socket.emit('updateDriverLocation', payload);
  }
   
  /**
   * ✅ Notify rider that driver is heading to pickup
   */
  emitEnRoute(rideId: string, driverId: string) {
    if (!this.socket?.connected) {
      console.warn('⚠️ Socket not connected, could not emit en-route status');
      return;
    }

    const payload = {
      rideId,
      driverId,
      status: 'EN_ROUTE',
      timestamp: Date.now(),
    };

    console.log(`📡 Emitting En-Route Status for trip: ${rideId}`);
    this.socket.emit('DRIVER_HEADING_TO_PICKUP', payload);
  }

  // DEPRECATED: Favor useLocationTracker hook for unified tracking
  startSendingLocation(rideId: string) {
    console.warn('⚠️ startSendingLocation is deprecated. Use useLocationTracker hook instead.');
  }

  // ✅ Driver: Stop sending location
  stopSendingLocation() {
    if (this.locationWatchId !== null) {
      Geolocation.clearWatch(this.locationWatchId);
      this.locationWatchId = null;
      console.log('Stopped sending location');
    }
  }

  // Optional: Calculate ETA (you can use Google Distance Matrix API)
  private calculateETA(lat: number, lng: number): number {
    // Implement your ETA calculation logic
    return 300; // placeholder: 5 minutes in seconds
  }

  // ✅ User: Listen for driver location updates
  onLocationUpdate(callback: (data: {
    latitude: number;
    longitude: number;
    heading?: number;
    eta?: number;
  }) => void) {
    this.socket?.on('locationUpdate', callback);
  }

  // Cleanup listener
  offLocationUpdate() {
    this.socket?.off('locationUpdate');
  }

  // ─── VIDEO KYC SOCKET METHODS ─────────────────────────

  /** Emit: Driver requests video KYC */
  emitKycRequest(driverId: string, location?: { latitude: number; longitude: number }) {
    this.emit('KYC_REQUEST_VIDEO', { driverId, location });
  }

  /** Emit: Driver cancels pending KYC request */
  emitKycCancel(sessionId: string) {
    this.emit('KYC_CANCEL_REQUEST', { sessionId });
  }

  /** Emit: Driver joined the Agora call */
  emitKycDriverJoined(sessionId: string) {
    this.emit('KYC_DRIVER_JOINED', { sessionId });
  }

  /** Emit: Driver left or hung up */
  emitKycDriverLeft(sessionId: string) {
    this.emit('KYC_DRIVER_LEFT', { sessionId });
  }

  /** Listen: Queue position updates */
  onKycQueueUpdate(callback: (data: { position: number; estimatedWaitSeconds: number }) => void) {
    this.on('KYC_QUEUE_UPDATE', callback);
  }
  offKycQueueUpdate(callback?: (data: any) => void) {
    this.off('KYC_QUEUE_UPDATE', callback);
  }

  /** Listen: Admin accepted — time to join call */
  onKycCallAccepted(callback: (data: {
    sessionId: string;
    channelName: string;
    token: string;
    uid: number;
    adminName?: string;
  }) => void) {
    this.on('KYC_CALL_ACCEPTED', callback);
  }
  offKycCallAccepted(callback?: (data: any) => void) {
    this.off('KYC_CALL_ACCEPTED', callback);
  }

  /** Listen: Admin sends an instruction during call */
  onKycAdminPrompt(callback: (data: { promptText: string }) => void) {
    this.on('KYC_ADMIN_PROMPT', callback);
  }
  offKycAdminPrompt(callback?: (data: any) => void) {
    this.off('KYC_ADMIN_PROMPT', callback);
  }

  /** Listen: Admin ended call & submitted verdict */
  onKycResult(callback: (data: {
    sessionId: string;
    status: 'APPROVED' | 'REJECTED';
    remarks?: string;
    rejectionReasons?: string[];
  }) => void) {
    this.on('KYC_RESULT', callback);
  }
  offKycResult(callback?: (data: any) => void) {
    this.off('KYC_RESULT', callback);
  }

  /** Listen: Admin disconnected mid-call (network issue) */
  onKycAdminDisconnected(callback: (data: { sessionId: string }) => void) {
    this.on('KYC_ADMIN_DISCONNECTED', callback);
  }
  offKycAdminDisconnected(callback?: (data: any) => void) {
    this.off('KYC_ADMIN_DISCONNECTED', callback);
  }


  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.currentRoomContext = null;
      this.notifyConnectionListeners(false);
    }
  }

  addConnectionListener(listener: (connected: boolean) => void) {
    this.connectionListeners.push(listener);
    listener(this.isConnected);
  }

  removeConnectionListener(listener: (connected: boolean) => void) {
    this.connectionListeners = this.connectionListeners.filter(l => l !== listener);
  }

  private notifyConnectionListeners(connected: boolean) {
    this.connectionListeners.forEach(listener => listener(connected));
  }
}

export default new SocketService();
