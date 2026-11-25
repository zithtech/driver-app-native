package com.driverclient.drivingtest

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.SurfaceTexture
import android.hardware.Sensor
import android.hardware.SensorManager
import android.hardware.camera2.*
import android.hardware.camera2.params.OutputConfiguration
import android.hardware.camera2.params.SessionConfiguration
import android.location.LocationManager
import android.media.MediaRecorder
import android.os.*
import android.util.Log
import android.util.Range
import android.util.Size
import android.view.Surface
import android.view.WindowManager
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executor
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.math.abs

class DualCameraModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext),
    LifecycleEventListener {

    companion object {
        private const val TAG = "DualCameraModule"
    }

    // Separate executor for sequential start/stop work (waits on latches) vs non-blocking Camera2 callback HandlerThread
    private val workerExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private var callbackThread: HandlerThread? = null
    private var callbackHandler: Handler? = null

    private var rearCamera: CameraDevice? = null
    private var rearSession: CameraCaptureSession? = null
    private var rearRecorder: MediaRecorder? = null
    private var rearOutputFile: File? = null

    private var frontCamera: CameraDevice? = null
    private var frontSession: CameraCaptureSession? = null
    private var frontRecorder: MediaRecorder? = null
    private var frontOutputFile: File? = null
    private var frontPreviewSurface: Surface? = null

    @Volatile
    private var isRecording = false

    @Volatile
    private var recordingStartTimeMs = 0L

    @Volatile
    private var isConcurrentModeActive = false

    init {
        reactContext.addLifecycleEventListener(this)
    }

    override fun getName(): String = "DualCameraModule"

    override fun onHostResume() {}
    override fun onHostPause() {}

    override fun onHostDestroy() {
        workerExecutor.execute {
            releaseAllInternal(deleteFiles = false)
        }
    }

    private fun ensureCallbackHandler(): Handler {
        if (callbackThread == null || callbackHandler == null) {
            callbackThread = HandlerThread("DualCameraCallbacks").apply { start() }
            callbackHandler = Handler(callbackThread!!.looper)
        }
        return callbackHandler!!
    }

    private fun stopCallbackThread() {
        try {
            callbackThread?.quitSafely()
            callbackThread?.join(1500)
        } catch (_: InterruptedException) {
        } finally {
            callbackThread = null
            callbackHandler = null
        }
    }

    @ReactMethod
    fun checkDeviceCompatibility(promise: Promise) {
        try {
            val context = reactApplicationContext
            val result = Arguments.createMap()

            // 1. Camera Capabilities
            val cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
            var hasFrontCamera = false
            var hasBackCamera = false
            var frontCameraId: String? = null
            var backCameraId: String? = null

            for (id in cameraManager.cameraIdList) {
                val chars = cameraManager.getCameraCharacteristics(id)
                val facing = chars.get(CameraCharacteristics.LENS_FACING)
                if (facing == CameraCharacteristics.LENS_FACING_FRONT) {
                    hasFrontCamera = true
                    if (frontCameraId == null) frontCameraId = id
                } else if (facing == CameraCharacteristics.LENS_FACING_BACK) {
                    hasBackCamera = true
                    if (backCameraId == null) backCameraId = id
                }
            }

            var supportsConcurrentCamera = false
            var concurrentSetsCount = 0

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                try {
                    val concurrentSets = cameraManager.concurrentCameraIds
                    concurrentSetsCount = concurrentSets.size
                    val pair = findConcurrentFrontBackPair(cameraManager)
                    if (pair != null) {
                        supportsConcurrentCamera = true
                        backCameraId = pair.first
                        frontCameraId = pair.second
                    }
                } catch (_: Exception) {
                    supportsConcurrentCamera = false
                }
            }

            val cameraMap = Arguments.createMap()
            cameraMap.putBoolean("hasFrontCamera", hasFrontCamera)
            cameraMap.putBoolean("hasBackCamera", hasBackCamera)
            cameraMap.putBoolean("supportsConcurrentCamera", supportsConcurrentCamera)
            cameraMap.putInt("concurrentSetsCount", concurrentSetsCount)
            cameraMap.putString("frontCameraId", frontCameraId)
            cameraMap.putString("backCameraId", backCameraId)
            result.putMap("camera", cameraMap)

            // 2. Storage Check
            val stat = StatFs(Environment.getDataDirectory().path)
            val bytesAvailable = stat.blockSizeLong * stat.availableBlocksLong
            val megabytesAvailable = bytesAvailable / (1024 * 1024)
            val gigabytesAvailable = megabytesAvailable / 1024.0

            val storageMap = Arguments.createMap()
            storageMap.putDouble("availableMB", megabytesAvailable.toDouble())
            storageMap.putDouble("availableGB", gigabytesAvailable)
            storageMap.putBoolean("isStorageSufficient", megabytesAvailable >= 500)
            result.putMap("storage", storageMap)

            // 3. Battery Check
            val ifilter = IntentFilter(Intent.ACTION_BATTERY_CHANGED)
            val batteryStatus = context.registerReceiver(null, ifilter)
            val level = batteryStatus?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
            val scale = batteryStatus?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
            val batteryPct = if (level >= 0 && scale > 0) (level * 100) / scale else 50
            val status = batteryStatus?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
            val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL

            val batteryMap = Arguments.createMap()
            batteryMap.putInt("batteryLevel", batteryPct)
            batteryMap.putBoolean("isCharging", isCharging)
            batteryMap.putBoolean("isBatterySufficient", batteryPct >= 15 || isCharging)
            result.putMap("battery", batteryMap)

            // 4. Sensors Check
            val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
            val sensorMap = Arguments.createMap()
            sensorMap.putBoolean("hasAccelerometer", sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) != null)
            sensorMap.putBoolean("hasGyroscope", sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE) != null)
            sensorMap.putBoolean("hasMagnetometer", sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD) != null)
            result.putMap("sensors", sensorMap)

            // 5. GPS Check
            val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
            val isGpsEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)
            val locationMap = Arguments.createMap()
            locationMap.putBoolean("isGpsEnabled", isGpsEnabled)
            locationMap.putBoolean("isNetworkLocationEnabled", locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER))
            result.putMap("location", locationMap)

            val isReady = hasFrontCamera && hasBackCamera && (megabytesAvailable >= 500) && (batteryPct >= 15 || isCharging) && isGpsEnabled
            result.putBoolean("isOverallReady", isReady)
            result.putInt("androidApiLevel", Build.VERSION.SDK_INT)
            result.putString("deviceModel", Build.MODEL)
            result.putString("deviceManufacturer", Build.MANUFACTURER)

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("COMPATIBILITY_CHECK_FAILED", e.message, e)
        }
    }

    /**
     * Starts simultaneous Dual Camera (Rear Road 720p@24fps + Front Cabin 480p@15fps) MP4 recording.
     * Automatically falls back to single-camera recording on devices without concurrent HAL support.
     */
    @ReactMethod
    fun startDualRecording(sessionId: String, promise: Promise) {
        val perm = ContextCompat.checkSelfPermission(reactApplicationContext, Manifest.permission.CAMERA)
        if (perm != PackageManager.PERMISSION_GRANTED) {
            promise.reject("CAMERA_PERMISSION_DENIED", "Camera permission is required to record driving test.")
            return
        }

        workerExecutor.execute {
            if (isRecording) {
                releaseAllInternal(deleteFiles = false)
            }
            val handler = ensureCallbackHandler()
            try {
                val context = reactApplicationContext
                val cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager

                val dir = File(context.filesDir, "driving_test_recordings").apply {
                    if (!exists()) mkdirs()
                }
                val safeId = sessionId.replace(Regex("[^a-zA-Z0-9_-]"), "_")
                val ts = System.currentTimeMillis()

                var backId: String? = null
                var frontId: String? = null
                for (id in cameraManager.cameraIdList) {
                    val facing = cameraManager.getCameraCharacteristics(id).get(CameraCharacteristics.LENS_FACING)
                    if (facing == CameraCharacteristics.LENS_FACING_BACK && backId == null) backId = id
                    if (facing == CameraCharacteristics.LENS_FACING_FRONT && frontId == null) frontId = id
                }

                val concurrentPair = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    findConcurrentFrontBackPair(cameraManager)
                } else null

                if (concurrentPair != null) {
                    backId = concurrentPair.first
                    frontId = concurrentPair.second
                }

                var rearStarted = false
                var frontStarted = false
                isConcurrentModeActive = false

                // Wait briefly (up to 600ms) for DualCameraPreview TextureView layout if mounting on screen entry
                if (DualCameraSurfaceHolder.surfaceTexture == null) {
                    val surfaceWaitLatch = CountDownLatch(1)
                    DualCameraSurfaceHolder.onSurfaceAvailableCallback = {
                        surfaceWaitLatch.countDown()
                    }
                    if (DualCameraSurfaceHolder.surfaceTexture != null) {
                        surfaceWaitLatch.countDown()
                    } else {
                        surfaceWaitLatch.await(600, TimeUnit.MILLISECONDS)
                    }
                    DualCameraSurfaceHolder.onSurfaceAvailableCallback = null
                }

                // Try Concurrent Dual Camera Mode first if hardware supports it
                if (concurrentPair != null && backId != null && frontId != null) {
                    try {
                        val rFile = File(dir, "rear_${safeId}_$ts.mp4")
                        val fFile = File(dir, "front_${safeId}_$ts.mp4")

                        startSingleCameraPipeline(
                            cameraManager = cameraManager,
                            cameraId = backId,
                            outputFile = rFile,
                            targetMaxWidth = 1280,
                            targetMaxHeight = 720,
                            preferredFps = 24,
                            bitRate = 1_500_000,
                            isFront = false,
                            previewSurfaceTexture = null,
                            handler = handler
                        )
                        rearOutputFile = rFile
                        rearStarted = true

                        startSingleCameraPipeline(
                            cameraManager = cameraManager,
                            cameraId = frontId,
                            outputFile = fFile,
                            targetMaxWidth = 640,
                            targetMaxHeight = 480,
                            preferredFps = 15,
                            bitRate = 700_000,
                            isFront = true,
                            previewSurfaceTexture = DualCameraSurfaceHolder.surfaceTexture,
                            handler = handler
                        )
                        frontOutputFile = fFile
                        frontStarted = true
                        isConcurrentModeActive = true
                    } catch (dualErr: Throwable) {
                        Log.w(TAG, "Concurrent dual camera start failed (${dualErr.message}), cleaning up & falling back to single camera...")
                        releaseAllInternal(deleteFiles = true)
                        rearStarted = false
                        frontStarted = false
                    }
                }

                // Single-camera fallback if concurrent wasn't supported or failed at HAL runtime
                if (!rearStarted && !frontStarted) {
                    if (backId != null) {
                        try {
                            val rFile = File(dir, "rear_${safeId}_$ts.mp4")
                            startSingleCameraPipeline(
                                cameraManager = cameraManager,
                                cameraId = backId,
                                outputFile = rFile,
                                targetMaxWidth = 1280,
                                targetMaxHeight = 720,
                                preferredFps = 24,
                                bitRate = 1_500_000,
                                isFront = false,
                                previewSurfaceTexture = null,
                                handler = handler
                            )
                            rearOutputFile = rFile
                            rearStarted = true
                        } catch (rearErr: Throwable) {
                            Log.w(TAG, "Single rear fallback failed: ${rearErr.message}")
                            releaseAllInternal(deleteFiles = true)
                        }
                    }

                    if (!rearStarted && frontId != null) {
                        val fFile = File(dir, "front_${safeId}_$ts.mp4")
                        startSingleCameraPipeline(
                            cameraManager = cameraManager,
                            cameraId = frontId,
                            outputFile = fFile,
                            targetMaxWidth = 640,
                            targetMaxHeight = 480,
                            preferredFps = 15,
                            bitRate = 700_000,
                            isFront = true,
                            previewSurfaceTexture = DualCameraSurfaceHolder.surfaceTexture,
                            handler = handler
                        )
                        frontOutputFile = fFile
                        frontStarted = true
                    }
                }

                if (!rearStarted && !frontStarted) {
                    throw IllegalStateException("No camera device could start video recording.")
                }

                isRecording = true
                recordingStartTimeMs = SystemClock.elapsedRealtime()

                val res = Arguments.createMap().apply {
                    putBoolean("rearActive", rearStarted)
                    putBoolean("frontActive", frontStarted)
                    putBoolean("simultaneousDualActive", rearStarted && frontStarted)
                    putString("rearFilePath", rearOutputFile?.absolutePath)
                    putString("frontFilePath", frontOutputFile?.absolutePath)
                }
                promise.resolve(res)
            } catch (e: Throwable) {
                Log.e(TAG, "startDualRecording failed", e)
                releaseAllInternal(deleteFiles = true)
                promise.reject("RECORDING_START_FAILED", e.message ?: "Failed to start camera recording", e)
            }
        }
    }

    /**
     * Stops active recordings cleanly on the camera background thread so MediaRecorder.stop()
     * flushes and writes the complete MP4 moov trailer before returning file paths & byte sizes.
     */
    @ReactMethod
    fun stopDualRecording(promise: Promise) {
        workerExecutor.execute {
            if (!isRecording && rearRecorder == null && frontRecorder == null) {
                val emptyRes = Arguments.createMap().apply {
                    putString("rearVideoPath", null)
                    putDouble("rearFileSizeBytes", 0.0)
                    putString("frontVideoPath", null)
                    putDouble("frontFileSizeBytes", 0.0)
                    putDouble("durationMs", 0.0)
                    putBoolean("simultaneousDualActive", false)
                }
                promise.resolve(emptyRes)
                return@execute
            }

            val elapsedMs = if (recordingStartTimeMs > 0L) {
                maxOf(0L, SystemClock.elapsedRealtime() - recordingStartTimeMs)
            } else 0L

            val rearFile = rearOutputFile
            val frontFile = frontOutputFile

            val rearStoppedOk = stopMediaRecorderSafely(rearRecorder, rearSession, rearCamera)
            val frontStoppedOk = stopMediaRecorderSafely(frontRecorder, frontSession, frontCamera)

            rearRecorder = null
            rearSession = null
            rearCamera = null

            frontRecorder = null
            frontSession = null
            frontCamera = null

            try {
                frontPreviewSurface?.release()
            } catch (_: Throwable) {}
            frontPreviewSurface = null

            isRecording = false
            recordingStartTimeMs = 0L

            val rearValid = rearStoppedOk && rearFile != null && rearFile.exists() && rearFile.length() > 2048L
            val frontValid = frontStoppedOk && frontFile != null && frontFile.exists() && frontFile.length() > 2048L

            if (!rearValid && rearFile != null && rearFile.exists()) {
                rearFile.delete()
            }
            if (!frontValid && frontFile != null && frontFile.exists()) {
                frontFile.delete()
            }

            rearOutputFile = null
            frontOutputFile = null

            val res = Arguments.createMap().apply {
                putString("rearVideoPath", if (rearValid) rearFile!!.absolutePath else null)
                putDouble("rearFileSizeBytes", if (rearValid) rearFile!!.length().toDouble() else 0.0)
                putString("frontVideoPath", if (frontValid) frontFile!!.absolutePath else null)
                putDouble("frontFileSizeBytes", if (frontValid) frontFile!!.length().toDouble() else 0.0)
                putDouble("durationMs", elapsedMs.toDouble())
                putBoolean("simultaneousDualActive", rearValid && frontValid)
            }

            Log.i(
                TAG,
                "stopDualRecording complete: duration=${elapsedMs}ms, rearValid=$rearValid (${if (rearValid) rearFile!!.length() else 0}B), frontValid=$frontValid (${if (frontValid) frontFile!!.length() else 0}B)"
            )

            stopCallbackThread()
            promise.resolve(res)
        }
    }

    @ReactMethod
    fun cancelDualRecording(promise: Promise) {
        workerExecutor.execute {
            releaseAllInternal(deleteFiles = true)
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun deleteLocalRecordingFile(filePath: String?, promise: Promise) {
        try {
            if (filePath.isNullOrBlank()) {
                promise.resolve(false)
                return
            }
            val cleanPath = filePath.removePrefix("file://")
            val file = File(cleanPath)
            val deleted = if (file.exists()) file.delete() else false
            promise.resolve(deleted)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun getRecordingStoragePath(promise: Promise) {
        try {
            val dir = File(reactApplicationContext.filesDir, "driving_test_recordings")
            if (!dir.exists()) {
                dir.mkdirs()
            }
            promise.resolve(dir.absolutePath)
        } catch (e: Exception) {
            promise.reject("STORAGE_PATH_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun clearOldRecordings(promise: Promise) {
        try {
            val dir = File(reactApplicationContext.filesDir, "driving_test_recordings")
            var deletedCount = 0
            if (dir.exists() && dir.isDirectory) {
                dir.listFiles()?.forEach { file ->
                    if (file.delete()) {
                        deletedCount++
                    }
                }
            }
            promise.resolve(deletedCount)
        } catch (e: Exception) {
            promise.reject("CLEAR_ERROR", e.message, e)
        }
    }

    private fun findConcurrentFrontBackPair(cameraManager: CameraManager): Pair<String, String>? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return null
        return try {
            for (set in cameraManager.concurrentCameraIds) {
                var backId: String? = null
                var frontId: String? = null
                for (id in set) {
                    val chars = cameraManager.getCameraCharacteristics(id)
                    val facing = chars.get(CameraCharacteristics.LENS_FACING)
                    if (facing == CameraCharacteristics.LENS_FACING_BACK && backId == null) backId = id
                    if (facing == CameraCharacteristics.LENS_FACING_FRONT && frontId == null) frontId = id
                }
                if (backId != null && frontId != null) {
                    return Pair(backId, frontId)
                }
            }
            null
        } catch (_: Throwable) {
            null
        }
    }

    @SuppressLint("MissingPermission")
    private fun startSingleCameraPipeline(
        cameraManager: CameraManager,
        cameraId: String,
        outputFile: File,
        targetMaxWidth: Int,
        targetMaxHeight: Int,
        preferredFps: Int,
        bitRate: Int,
        isFront: Boolean,
        previewSurfaceTexture: SurfaceTexture?,
        handler: Handler
    ) {
        val chars = cameraManager.getCameraCharacteristics(cameraId)
        val map = chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
            ?: throw IllegalStateException("No StreamConfigurationMap for camera $cameraId")

        val videoSize = chooseOptimalVideoSize(
            map.getOutputSizes(MediaRecorder::class.java),
            targetMaxWidth,
            targetMaxHeight
        )
        val fpsRange = chooseOptimalFpsRange(
            chars.get(CameraCharacteristics.CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES),
            preferredFps
        )
        val recorderFps = fpsRange?.upper ?: 30
        val orientationHint = computeOrientationHint(chars, isFront)

        val recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            MediaRecorder(reactApplicationContext)
        } else {
            @Suppress("DEPRECATION")
            MediaRecorder()
        }

        recorder.apply {
            setVideoSource(MediaRecorder.VideoSource.SURFACE)
            setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            setOutputFile(outputFile.absolutePath)
            setVideoEncoder(MediaRecorder.VideoEncoder.H264)
            setVideoSize(videoSize.width, videoSize.height)
            setVideoFrameRate(recorderFps)
            setVideoEncodingBitRate(bitRate)
            setOrientationHint(orientationHint)
            prepare()
        }

        val openLatch = CountDownLatch(1)
        var openedDevice: CameraDevice? = null
        var openError: Throwable? = null

        cameraManager.openCamera(cameraId, object : CameraDevice.StateCallback() {
            override fun onOpened(camera: CameraDevice) {
                openedDevice = camera
                openLatch.countDown()
            }

            override fun onDisconnected(camera: CameraDevice) {
                try { camera.close() } catch (_: Throwable) {}
                if (openError == null && openedDevice == null) {
                    openError = IllegalStateException("Camera $cameraId disconnected before opening")
                    openLatch.countDown()
                }
            }

            override fun onError(camera: CameraDevice, error: Int) {
                try { camera.close() } catch (_: Throwable) {}
                if (openError == null && openedDevice == null) {
                    openError = IllegalStateException("Camera $cameraId open error code: $error")
                    openLatch.countDown()
                }
            }
        }, handler)

        if (!openLatch.await(5, TimeUnit.SECONDS) || openedDevice == null) {
            try { recorder.release() } catch (_: Throwable) {}
            throw openError ?: IllegalStateException("Timed out opening camera $cameraId")
        }

        val device = openedDevice!!
        var targetSurfaces = mutableListOf(recorder.surface)
        var localPreviewSurface: Surface? = null

        if (isFront && previewSurfaceTexture != null) {
            try {
                previewSurfaceTexture.setDefaultBufferSize(videoSize.width, videoSize.height)
                localPreviewSurface = Surface(previewSurfaceTexture)
                targetSurfaces.add(localPreviewSurface)
            } catch (e: Throwable) {
                Log.w(TAG, "Could not attach preview SurfaceTexture: ${e.message}")
            }
        }

        var createdSession: CameraCaptureSession? = createSessionWithFallback(device, targetSurfaces, handler)
        if (createdSession == null && targetSurfaces.size > 1) {
            Log.w(TAG, "CaptureSession with preview surface failed on camera $cameraId; retrying recorder-only surface.")
            try { localPreviewSurface?.release() } catch (_: Throwable) {}
            localPreviewSurface = null
            targetSurfaces = mutableListOf(recorder.surface)
            createdSession = createSessionWithFallback(device, targetSurfaces, handler)
        }

        if (createdSession == null) {
            try { localPreviewSurface?.release() } catch (_: Throwable) {}
            try { device.close() } catch (_: Throwable) {}
            try { recorder.release() } catch (_: Throwable) {}
            throw IllegalStateException("Timed out or failed configuring CaptureSession for camera $cameraId")
        }

        val session = createdSession!!
        val captureBuilder = device.createCaptureRequest(CameraDevice.TEMPLATE_RECORD).apply {
            targetSurfaces.forEach { addTarget(it) }
            set(CaptureRequest.CONTROL_MODE, CameraMetadata.CONTROL_MODE_AUTO)
            set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_VIDEO)
            if (fpsRange != null) {
                set(CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE, fpsRange)
            }
        }

        session.setRepeatingRequest(captureBuilder.build(), null, handler)
        recorder.start()

        if (isFront) {
            frontCamera = device
            frontSession = session
            frontRecorder = recorder
            frontPreviewSurface = localPreviewSurface
        } else {
            rearCamera = device
            rearSession = session
            rearRecorder = recorder
        }

        Log.i(TAG, "Started camera $cameraId recording -> ${outputFile.name} (${videoSize.width}x${videoSize.height} @ ${recorderFps}fps, hint=$orientationHint)")
    }

    private fun createSessionWithFallback(
        device: CameraDevice,
        surfaces: List<Surface>,
        handler: Handler
    ): CameraCaptureSession? {
        val sessionLatch = CountDownLatch(1)
        var createdSession: CameraCaptureSession? = null

        val sessionCallback = object : CameraCaptureSession.StateCallback() {
            override fun onConfigured(session: CameraCaptureSession) {
                createdSession = session
                sessionLatch.countDown()
            }

            override fun onConfigureFailed(session: CameraCaptureSession) {
                sessionLatch.countDown()
            }
        }

        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                val outputConfigs = surfaces.map { OutputConfiguration(it) }
                val executor = Executor { runnable -> handler.post(runnable) }
                val config = SessionConfiguration(
                    SessionConfiguration.SESSION_REGULAR,
                    outputConfigs,
                    executor,
                    sessionCallback
                )
                device.createCaptureSession(config)
            } else {
                @Suppress("DEPRECATION")
                device.createCaptureSession(surfaces, sessionCallback, handler)
            }

            sessionLatch.await(5, TimeUnit.SECONDS)
            createdSession
        } catch (_: Throwable) {
            null
        }
    }

    private fun chooseOptimalVideoSize(sizes: Array<Size>?, maxW: Int, maxH: Int): Size {
        if (sizes.isNullOrEmpty()) return Size(640, 480)
        // Prefer exact match if available
        sizes.firstOrNull { it.width == maxW && it.height == maxH }?.let { return it }
        // Otherwise largest landscape size within maxW x maxH
        val candidates = sizes.filter { it.width <= maxW && it.height <= maxH }
        if (candidates.isNotEmpty()) {
            return candidates.maxByOrNull { it.width * it.height }!!
        }
        // Fallback smallest size available
        return sizes.minByOrNull { it.width * it.height }!!
    }

    private fun chooseOptimalFpsRange(ranges: Array<Range<Int>>?, targetFps: Int): Range<Int>? {
        if (ranges.isNullOrEmpty()) return null
        // Normalize in case vendor reports scaled * 1000 values (rare HAL bug) vs direct values
        val normalized = ranges.filter { it.upper <= 120 }
        if (normalized.isEmpty()) return null

        // Exact fixed range [target, target] e.g. [24, 24] or [15, 15]
        normalized.firstOrNull { it.lower == targetFps && it.upper == targetFps }?.let { return it }
        // Any range ending at targetFps or containing targetFps up to 30fps
        val containing = normalized.filter { it.lower <= targetFps && it.upper >= targetFps && it.upper <= 30 }
        if (containing.isNotEmpty()) {
            return containing.minByOrNull { it.upper - it.lower }
        }
        // Closest upper <= 30
        val under30 = normalized.filter { it.upper <= 30 }
        if (under30.isNotEmpty()) {
            return under30.minByOrNull { abs(it.upper - targetFps) }
        }
        return normalized.firstOrNull()
    }

    private fun computeOrientationHint(chars: CameraCharacteristics, isFront: Boolean): Int {
        val sensorOrientation = chars.get(CameraCharacteristics.SENSOR_ORIENTATION) ?: if (isFront) 270 else 90
        val wm = reactApplicationContext.getSystemService(Context.WINDOW_SERVICE) as? WindowManager
        @Suppress("DEPRECATION")
        val rotation = wm?.defaultDisplay?.rotation ?: Surface.ROTATION_0
        val deviceDegrees = when (rotation) {
            Surface.ROTATION_0 -> 0
            Surface.ROTATION_90 -> 90
            Surface.ROTATION_180 -> 180
            Surface.ROTATION_270 -> 270
            else -> 0
        }
        return if (isFront) {
            (sensorOrientation + deviceDegrees) % 360
        } else {
            (sensorOrientation - deviceDegrees + 360) % 360
        }
    }

    private fun stopMediaRecorderSafely(
        recorder: MediaRecorder?,
        session: CameraCaptureSession?,
        camera: CameraDevice?
    ): Boolean {
        try {
            session?.stopRepeating()
        } catch (_: Throwable) {}

        var stoppedCleanly = false
        if (recorder != null) {
            try {
                recorder.stop()
                stoppedCleanly = true
            } catch (e: RuntimeException) {
                Log.w(TAG, "MediaRecorder.stop() exception (short/empty capture): ${e.message}")
            } catch (e: Throwable) {
                Log.w(TAG, "MediaRecorder.stop() error: ${e.message}")
            }
            try { recorder.reset() } catch (_: Throwable) {}
            try { recorder.release() } catch (_: Throwable) {}
        }

        try { session?.close() } catch (_: Throwable) {}
        try { camera?.close() } catch (_: Throwable) {}

        return stoppedCleanly
    }

    private fun releaseAllInternal(deleteFiles: Boolean) {
        stopMediaRecorderSafely(rearRecorder, rearSession, rearCamera)
        stopMediaRecorderSafely(frontRecorder, frontSession, frontCamera)

        rearRecorder = null
        rearSession = null
        rearCamera = null
        frontRecorder = null
        frontSession = null
        frontCamera = null

        try { frontPreviewSurface?.release() } catch (_: Throwable) {}
        frontPreviewSurface = null

        if (deleteFiles) {
            try { rearOutputFile?.delete() } catch (_: Throwable) {}
            try { frontOutputFile?.delete() } catch (_: Throwable) {}
        }
        rearOutputFile = null
        frontOutputFile = null
        isRecording = false
        recordingStartTimeMs = 0L
        stopCallbackThread()
    }
}
