package com.driverclient.floating

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class FloatingOverlayModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        var reactContextInstance: ReactApplicationContext? = null
    }

    init {
        reactContextInstance = reactContext
    }

    override fun getName(): String {
        return "FloatingOverlayModule"
    }

    @ReactMethod
    fun checkPermission(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            promise.resolve(Settings.canDrawOverlays(reactContext))
        } else {
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun requestPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(reactContext)) {
                val intent = Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:${reactContext.packageName}")
                )
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactContext.startActivity(intent)
            }
        }
    }

    @ReactMethod
    fun startOverlay(state: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(reactContext)) {
            return
        }
        val intent = Intent(reactContext, FloatingOverlayService::class.java)
        intent.putExtra("STATE", state)
        reactContext.startService(intent)
    }

    @ReactMethod
    fun updateState(state: String) {
        val intent = Intent(reactContext, FloatingOverlayService::class.java)
        intent.putExtra("STATE", state)
        intent.putExtra("UPDATE_ONLY", true)
        reactContext.startService(intent)
    }

    @ReactMethod
    fun stopOverlay() {
        val intent = Intent(reactContext, FloatingOverlayService::class.java)
        reactContext.stopService(intent)
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Keep: Required for RN built-in Event Emitter Calls
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Keep: Required for RN built-in Event Emitter Calls
    }
}
