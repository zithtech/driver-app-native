import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { storage } from '../service/utils/storage';
import { useGetDriverByIdQuery, useGetActiveTripQuery } from '../service/driverApi';
import { useGetMeQuery } from '../service/userApi';
import { setUser, clearUser } from '../redux/userSlice';
import { setCurrentRide } from '../redux/rideSlice';
import { RootState } from '../redux/store';

export const useAuthBootstrap = () => {
    const dispatch = useDispatch();
    const mountedRef = useRef(true);

    const [isBootstrapping, setIsBootstrapping] = useState(true);
    const [profileProcessed, setProfileProcessed] = useState(false);
    const [tripProcessed, setTripProcessed] = useState(false);
    const [minTimeElapsed, setMinTimeElapsed] = useState(false);

    // Cleanup on unmount
    useEffect(() => {
        return () => { mountedRef.current = false; };
    }, []);

    // Enforce minimum splash screen display time
    useEffect(() => {
        const timer = setTimeout(() => {
            if (mountedRef.current) { setMinTimeElapsed(true); }
        }, 500);

        // 🛡️ Safety fallback: Force unlock after 10s if the API hangs
        const maxTimer = setTimeout(() => {
            if (mountedRef.current && (!profileProcessed || isBootstrapping)) {
                console.warn('[AuthBootstrap] ⏰ API timed out after 10s, forcing unlock');
                setProfileProcessed(true);
                setIsBootstrapping(false);
            }
        }, 10000);

        return () => {
            clearTimeout(timer);
            clearTimeout(maxTimer);
        };
    }, [profileProcessed, isBootstrapping]);

    // Phase 1: Load tokens from secure storage into Redux
    useEffect(() => {
        const bootstrap = async () => {
            try {
                const accessToken = await storage.getAccessToken();
                const refreshToken = await storage.getRefreshToken();
                const storedDriverId = await storage.getDriverId();

                console.log('[AuthBootstrap] Phase 1 — Storage read:',
                    'hasAccessToken:', !!accessToken,
                    '| hasRefreshToken:', !!refreshToken,
                    '| storedDriverId:', storedDriverId || 'NULL',
                );

                if (!mountedRef.current) { return; }

                if (accessToken) {
                    // 🛡️ Only include fields that have actual values — never pass undefined
                    const payload: Record<string, any> = { accessToken };
                    if (refreshToken) { payload.refreshToken = refreshToken; }
                    if (storedDriverId) { payload.driverId = storedDriverId; }

                    dispatch(setUser(payload));
                } else {
                    console.log('[AuthBootstrap] No accessToken → clearing user');
                    dispatch(clearUser());
                    setIsBootstrapping(false);
                }
            } catch (e) {
                console.error('[AuthBootstrap] Storage read failed:', e);
                if (!mountedRef.current) { return; }
                dispatch(clearUser());
                setIsBootstrapping(false);
            }
        };
        bootstrap();
    }, [dispatch]);

    // Track token — reset profileProcessed on token change (handles re-login)
    const reduxToken = useSelector((state: RootState) => state.userSlice.user?.accessToken);
    const prevTokenRef = useRef(reduxToken);

    useEffect(() => {
        if (prevTokenRef.current !== reduxToken) {
            prevTokenRef.current = reduxToken;
            if (reduxToken) {
                setProfileProcessed(false);
            }
        }
    }, [reduxToken]);

    // Profile rehydration logic
    const user = useSelector((state: RootState) => state.userSlice.user);
    const driverIdFromRedux = user?.driverId;
    const existingLanguage = user?.language;
    
    // 🛡️ Track current language in a Ref to avoid dependency loops in profile effects
    const languageRef = useRef(existingLanguage);
    useEffect(() => {
        if (existingLanguage) {
            languageRef.current = existingLanguage;
        }
    }, [existingLanguage]);

    // 🛡️ Log only once per mount/change to reduce console noise
    useEffect(() => {
        if (driverIdFromRedux) {
            console.log('[AuthBootstrap] Driver ID detected:', driverIdFromRedux);
        }
    }, [driverIdFromRedux]);

    // Fallback: If driverId is missing, try getMe to retrieve it
    const { data: meData, isSuccess: isMeSuccess, error: meError } = useGetMeQuery(undefined, {
        skip: !reduxToken || !!driverIdFromRedux,
    });

    /**
     * 🛡️ PRODUCTION-READY NORMALIZATION
     * Standardizes all fields to match the backend (snake_case) exactly.
     */
    const normalizeProfile = (raw: any): Record<string, any> => {
        if (!raw) return {};

        const resolveImageUrl = (img: any): string | undefined => {
            if (!img) return undefined;
            if (typeof img === 'string') {
                const trimmed = img.trim();
                if (trimmed === '' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') {
                    return undefined;
                }
                if (trimmed.startsWith('{')) {
                    try {
                        const parsed = JSON.parse(trimmed);
                        return parsed.url || parsed.front || trimmed;
                    } catch (e) { return trimmed; }
                }
                return trimmed;
            }
            if (typeof img === 'object') {
                return img.url || img.front || undefined;
            }
            return undefined;
        };

        // 1. Resolve driver_id
        const driver_id = raw.driverId || raw.driver_id || raw.id || activeDriverId;

        // 2. Resolve Profile Picture (check all possible variants)
        let profile_picture = resolveImageUrl(
            raw.profile_picture || 
            raw.profile_pic_url || 
            raw.profilePicUrl || 
            raw.profileImage || 
            raw.avatar
        );

        // 3. Resolve Availability (isOnline / driverStatus)
        const isOnline = 
            raw.availability?.online === true || 
            raw.is_online === true || 
            raw.isOnline === true || 
            false;
        
        const driverStatus = raw.availability?.status || (isOnline ? 'ONLINE' : 'OFFLINE');

        // 4. Resolve Address
        const address = {
            street: raw.address?.street || '',
            city: raw.address?.city || '',
            district: raw.address?.district || '',
            state: raw.address?.state || '',
            country: raw.address?.country || 'India',
            pincode: raw.address?.pincode || '',
        };

        // 5. Resolve Documents (Convert array to Record for easy UI access)
        const documents: Record<string, any> = {};
        if (Array.isArray(raw.documents)) {
            raw.documents.forEach((doc: any) => {
                const type = doc.document_type || doc.documentType;
                if (type) {
                    documents[type] = {
                        status: doc.status || doc.license_status || doc.licenseStatus,
                        preview: resolveImageUrl(doc.document_url || doc.documentUrl),
                        rejection_reason: doc.rejection_reason || doc.remarks || doc.status_reason
                    };
                }
            });
        }

        // Final fallback for profile_picture from documents if still missing
        if (!profile_picture) {
            profile_picture = 
                documents.profile_selfie?.preview || 
                documents.PROFILE_SELFIE?.preview ||
                documents.Profile_Selfie?.preview || 
                documents['Profile Selfie']?.preview ||
                documents.profileSelfie?.preview;
        }

        const normalized: Record<string, any> = {
            ...raw,
            driverId: driver_id, 
            driver_id: driver_id,
            profile_picture: profile_picture || raw.profile_picture || raw.profile_pic_url || raw.profilePicUrl,
            profile_pic_url: profile_picture || raw.profile_picture || raw.profile_pic_url || raw.profilePicUrl,
            isOnline,
            driverStatus,
            address,
            documents,
            // 🛡️ PRODUCTION-READY MAPPING: Resolve camelCase vs snake_case conflicts
            first_name: raw.first_name || raw.firstName || '',
            last_name: raw.last_name || raw.lastName || '',
            full_name: raw.full_name || raw.fullName || `${raw.first_name || ''} ${raw.last_name || ''}`.trim() || '',
            onboarding_status: raw.onboarding_status || raw.onboardingStatus || 'PHONE_VERIFIED',
            phone_number: raw.phone_number || raw.phoneNumber || '',
            rating: raw.rating || raw.driver_rating || 0,
            total_trips: raw.total_trips || raw.trips_count || 0,
        };

        console.log(`[AuthBootstrap] Normalized profile for ${normalized.driverId}:`, {
            full_name: normalized.full_name,
            profile_picture: normalized.profile_picture,
            hasDocuments: Object.keys(normalized.documents).length > 0
        });

        // 🛡️ DEBUG LOG: Log resolved profile info
        console.log('[AuthBootstrap] Normalized profile:', {
            id: normalized.driverId,
            name: normalized.full_name,
            hasImage: !!normalized.profile_picture
        });
        
        return normalized;
    };


    useEffect(() => {
        if (meError && __DEV__) {
            const errorMessage = 'data' in meError ? JSON.stringify(meError.data) : 'Unknown Error';
            console.warn('[AuthBootstrap] /auth/me failed status:', (meError as any)?.status, '| data:', errorMessage);
        }

        if (isMeSuccess && meData) {
            const raw = meData?.data?.userData || meData?.data;
            const normalized = normalizeProfile(raw);

            console.log('[AuthBootstrap] /auth/me normalized:', JSON.stringify(normalized));

            if (normalized.driverId) {
                // 🛡️ Ensure we don't overwrite a locally selected language with a backend default during onboarding
                dispatch(setUser({ 
                    ...normalized, 
                    language: languageRef.current || normalized.language 
                }));
                if (!driverIdFromRedux) {
                    storage.setDriverId(normalized.driverId);
                }
            }
        }
    }, [isMeSuccess, meData, meError, driverIdFromRedux, dispatch]);

    const bootstrapRaw = meData?.data?.userData || meData?.data;
    const activeDriverId = driverIdFromRedux || bootstrapRaw?.driverId || bootstrapRaw?.driver_id || bootstrapRaw?.id;

    const { data, error, isSuccess } = useGetDriverByIdQuery(activeDriverId as string, {
        skip: !reduxToken || !activeDriverId,
        refetchOnMountOrArgChange: true,
    });

    useEffect(() => {
        if (!mountedRef.current) { return; }

        if (isSuccess && data?.data) {
            const normalized = normalizeProfile(data.data);
            console.log('[AuthBootstrap] ✅ Profile normalized → driverId:', normalized.driverId, '| status:', normalized.onboarding_status);

            // 🛡️ Ensure we don't overwrite a locally selected language with a backend default during onboarding
            dispatch(setUser({ 
                ...normalized, 
                language: languageRef.current || normalized.language 
            }));

            if (normalized.driverId) {
                storage.setDriverId(normalized.driverId);
            }

            setProfileProcessed(true);
            setIsBootstrapping(false);
        } else if (error) {
            const isNetworkError = 'status' in error && error.status === 'FETCH_ERROR';
            if (isNetworkError) {
                console.warn('[AuthBootstrap] ❌ Backend unreachable (FETCH_ERROR)');
            } else {
                const safeErr: any = { status: (error as any)?.status };
                if ((error as any)?.data) safeErr.data = (error as any).data;
                console.error('[AuthBootstrap] ❌ Profile fetch error:', JSON.stringify(safeErr));
            }

            setProfileProcessed(true);
            setIsBootstrapping(false);
        }
    }, [data, error, isSuccess, dispatch, activeDriverId]);

    /* ================= TRIP REHYDRATION ================= */
    const { 
        data: activeTripData, 
        isSuccess: isActiveTripSuccess,
        isError: isActiveTripError,
        isFetching: isActiveTripFetching
    } = useGetActiveTripQuery(activeDriverId as string, {
        skip: !reduxToken || !activeDriverId || !profileProcessed,
    });

    const currentRide = useSelector((state: RootState) => state.ride.currentRide);
    const currentRideRef = useRef(currentRide);
    useEffect(() => { currentRideRef.current = currentRide; }, [currentRide]);

    useEffect(() => {
        if (isActiveTripSuccess && activeTripData?.data) {
            console.log('[AuthBootstrap] 🚖 Active trip found:', activeTripData.data.trip_id);
            dispatch(setCurrentRide(activeTripData.data));
            setTripProcessed(true);
        } else if (isActiveTripError || (isActiveTripSuccess && !activeTripData?.data)) {
            // 🛡️ RECOVERY FIX: Only clear currentRide if it's NOT a scheduled ride.
            // Scheduled rides should persist in Redux even if not currently "active" in the backend's eyes.
            const isPersistedScheduled = 
                currentRideRef.current?.booking_type === 'SCHEDULED' || 
                (currentRideRef.current as any)?.is_scheduled;
            
            if (!activeTripData?.data && !isPersistedScheduled) {
                console.log('[AuthBootstrap] No active trip found on backend, clearing non-scheduled currentRide');
                dispatch(setCurrentRide(null));
            } else if (isPersistedScheduled) {
                console.log('[AuthBootstrap] Preserving scheduled ride state during bootstrap');
            }

            setTripProcessed(true);
        }
    }, [isActiveTripSuccess, isActiveTripError, activeTripData, dispatch]);

    // Ensure tripProcessed is reset if profile is re-processed (e.g. login)
    useEffect(() => {
        if (!profileProcessed) {
            setTripProcessed(false);
        }
    }, [profileProcessed]);


    return {
        isBootstrapping: !minTimeElapsed || (!!reduxToken && !profileProcessed) || (!!reduxToken && profileProcessed && !tripProcessed),
    };
};
