# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# React Native Reanimated v4 & JSI
-keep class com.swmansion.reanimated.** { *; }
-keep interface com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.react.bridge.NativeModule { *; }
-keep class com.facebook.react.bridge.JavaScriptModule { *; }

# Worklets-core (Required for Reanimated v4 and VisionCamera)
-keep class com.margelo.worklets.** { *; }
-keep interface com.margelo.worklets.** { *; }

# VisionCamera v4
-keep class com.mrousavy.camera.** { *; }
-keep interface com.mrousavy.camera.** { *; }

# JSI and SoLoader (Native stability)
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.soloader.** { *; }
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.hermes.unicode.** { *; }

# Ensure native methods are not stripped
-keepclasseswithmembernames class * {
    native <methods>;
}

# New Architecture entry points
-keep class com.facebook.react.defaults.** { *; }
-keep class com.facebook.react.fabric.** { *; }
-keep class com.facebook.react.uimanager.** { *; }

# Firebase & Notifee
-keep class com.google.firebase.** { *; }
-keep class io.invertase.notifee.** { *; }

# React Navigation & Gesture Handler
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.th3rdwave.safeareacontext.** { *; }

# Nightly/Experimental compatibility
-dontwarn com.swmansion.reanimated.**
-dontwarn com.margelo.worklets.**
-dontwarn com.mrousavy.camera.**

# App custom native modules, services, and packages
-keep class com.driverclient.** { *; }
-keepclassmembers class * extends com.facebook.react.bridge.ReactContextBaseJavaModule {
    @com.facebook.react.bridge.ReactMethod *;
}

# Agora RTC SDK
-keep class io.agora.** { *; }
-dontwarn io.agora.**

# Razorpay Checkout
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.razorpay.** { *; }
-dontwarn com.razorpay.**

# VisionCamera Face Detector & ML Kit
-keep class com.visioncamerafacedetector.** { *; }
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**

# Background Actions & Google Play Services
-keep class com.asterinet.react.bgactions.** { *; }
-keep class com.google.android.gms.** { *; }
