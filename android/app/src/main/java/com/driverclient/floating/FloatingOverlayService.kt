package com.driverclient.floating

import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.view.Gravity
import android.view.WindowManager
import com.driverclient.MainActivity
import com.facebook.react.modules.core.DeviceEventManagerModule

class FloatingOverlayService : Service() {

    private var windowManager: WindowManager? = null
    private var floatingView: FloatingButtonView? = null

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val state = intent?.getStringExtra("STATE") ?: "DEFAULT"
        val updateOnly = intent?.getBooleanExtra("UPDATE_ONLY", false) ?: false

        if (updateOnly && floatingView != null) {
            floatingView?.setState(state)
            return START_NOT_STICKY
        }

        if (floatingView == null) {
            createFloatingView(state)
        } else {
            floatingView?.setState(state)
        }

        return START_NOT_STICKY
    }

    private fun createFloatingView(initialState: String) {
        val layoutFlag: Int = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val params = WindowManager.LayoutParams(
            dpToPx(56),
            dpToPx(56),
            layoutFlag,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        )

        params.gravity = Gravity.TOP or Gravity.START
        params.x = 0
        params.y = dpToPx(100)

        floatingView = FloatingButtonView(this, windowManager!!) {
            handleTap()
        }
        floatingView?.setState(initialState)

        windowManager?.addView(floatingView, params)
    }

    private fun handleTap() {
        // Bring app to foreground
        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
        }
        startActivity(intent)

        // Emit event to React Native
        FloatingOverlayModule.reactContextInstance
            ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit("onFloatingButtonTapped", null)
    }

    override fun onDestroy() {
        super.onDestroy()
        if (floatingView != null) {
            windowManager?.removeView(floatingView)
            floatingView = null
        }
    }

    private fun dpToPx(dp: Int): Int {
        val density = resources.displayMetrics.density
        return (dp * density).toInt()
    }
}
