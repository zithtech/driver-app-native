package com.driverclient.drivingtest

import android.graphics.SurfaceTexture
import android.view.TextureView
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext

/**
 * Holds the currently mounted TextureView & SurfaceTexture for the live Front Cabin PiP preview.
 */
object DualCameraSurfaceHolder {
    @Volatile
    var textureView: TextureView? = null

    @Volatile
    var surfaceTexture: SurfaceTexture? = null

    @Volatile
    var width: Int = 0

    @Volatile
    var height: Int = 0

    @Volatile
    var onSurfaceAvailableCallback: (() -> Unit)? = null

    @Volatile
    var onSurfaceDestroyedCallback: (() -> Unit)? = null
}

/**
 * Lightweight native TextureView manager exposed to React Native as "DualCameraPreview"
 * so Camera2 can render live Front Cabin PiP preview using the same hardware stream
 * being encoded into MP4 by DualCameraModule.
 */
class DualCameraPreviewManager : SimpleViewManager<TextureView>() {

    override fun getName(): String = "DualCameraPreview"

    override fun createViewInstance(reactContext: ThemedReactContext): TextureView {
        val textureView = TextureView(reactContext)
        textureView.surfaceTextureListener = object : TextureView.SurfaceTextureListener {
            override fun onSurfaceTextureAvailable(surface: SurfaceTexture, width: Int, height: Int) {
                DualCameraSurfaceHolder.textureView = textureView
                DualCameraSurfaceHolder.surfaceTexture = surface
                DualCameraSurfaceHolder.width = width
                DualCameraSurfaceHolder.height = height
                DualCameraSurfaceHolder.onSurfaceAvailableCallback?.invoke()
            }

            override fun onSurfaceTextureSizeChanged(surface: SurfaceTexture, width: Int, height: Int) {
                DualCameraSurfaceHolder.width = width
                DualCameraSurfaceHolder.height = height
            }

            override fun onSurfaceTextureDestroyed(surface: SurfaceTexture): Boolean {
                DualCameraSurfaceHolder.surfaceTexture = null
                DualCameraSurfaceHolder.textureView = null
                DualCameraSurfaceHolder.onSurfaceDestroyedCallback?.invoke()
                return true
            }

            override fun onSurfaceTextureUpdated(surface: SurfaceTexture) {
                // No-op per frame
            }
        }
        return textureView
    }
}
