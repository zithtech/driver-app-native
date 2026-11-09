package com.driverclient

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader

import com.google.android.gms.maps.MapsInitializer
import com.google.android.gms.maps.MapsInitializer.Renderer
import com.google.android.gms.maps.OnMapsSdkInitializedCallback

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // Packages that cannot be autolinked yet can be added manually here, for example:
              // add(MyReactNativePackage())
              add(com.driverclient.floating.FloatingOverlayPackage())
              add(com.driverclient.notifications.CustomNotificationPackage())
            }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    android.util.Log.d("MainApplication", "Starting MainApplication.onCreate")
    SoLoader.init(this, OpenSourceMergedSoMapping)
    android.util.Log.d("MainApplication", "SoLoader initialized")

    // 🛡️ Force Legacy Google Maps Renderer to prevent LinkedList.isEmpty() crash on Android 12+
    try {
        MapsInitializer.initialize(applicationContext, Renderer.LEGACY, object : OnMapsSdkInitializedCallback {
            override fun onMapsSdkInitialized(renderer: Renderer) {
                android.util.Log.d("MainApplication", "Google Maps SDK initialized with renderer: $renderer")
            }
        })
    } catch (e: Exception) {
        android.util.Log.e("MainApplication", "Failed to initialize Maps", e)
    }

    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      android.util.Log.d("MainApplication", "Loading New Architecture")
      // If you opted-in for the New Architecture, we load the native entry point for this app.
      load()
      android.util.Log.d("MainApplication", "New Architecture loaded")
    }
  }
}
