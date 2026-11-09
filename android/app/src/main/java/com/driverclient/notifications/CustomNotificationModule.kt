package com.driverclient.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.driverclient.MainActivity
import com.driverclient.R

class CustomNotificationModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        var initialTripId: String? = null
    }

    override fun getName(): String {
        return "CustomNotificationModule"
    }

    @ReactMethod
    fun getInitialRideRequest(promise: com.facebook.react.bridge.Promise) {
        if (initialTripId != null) {
            val map = com.facebook.react.bridge.Arguments.createMap()
            map.putString("trip_id", initialTripId)
            map.putString("type", "NEW_RIDE_REQUEST")
            promise.resolve(map)
            initialTripId = null // clear after reading
        } else {
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun displayCustomNotification(data: ReadableMap) {
        val context = reactApplicationContext
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val channelId = "ride_requests"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Ride Requests",
                NotificationManager.IMPORTANCE_HIGH
            )
            notificationManager.createNotificationChannel(channel)
        }

        val tripId = if (data.hasKey("tripId")) data.getString("tripId") else "1"
        val distance = if (data.hasKey("distance")) data.getString("distance") else "0 km"
        val fare = if (data.hasKey("fare")) data.getString("fare") else "₹0"
        
        // RemoteViews for custom layout
        val remoteViews = RemoteViews(context.packageName, R.layout.custom_ride_notification)
        remoteViews.setTextViewText(R.id.pickup_distance, distance)
        remoteViews.setTextViewText(R.id.estimated_fare, fare)

        // Intent to launch app when tapped (e.g., clicking the notification or VIEW RIDE button)
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("trip_id", tripId)
            putExtra("tripId", tripId)
            putExtra("type", "NEW_RIDE_REQUEST")
            
            val iterator = data.keySetIterator()
            while (iterator.hasNextKey()) {
                val key = iterator.nextKey()
                try {
                    putExtra(key, data.getString(key))
                } catch (e: Exception) {}
            }
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            tripId.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        remoteViews.setOnClickPendingIntent(R.id.view_ride_button, pendingIntent)

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setStyle(NotificationCompat.DecoratedCustomViewStyle())
            .setCustomContentView(remoteViews)
            .setCustomBigContentView(remoteViews)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setFullScreenIntent(pendingIntent, true)
            .build()

        notificationManager.notify(tripId.hashCode(), notification)
    }

    @ReactMethod
    fun cancelNotification(tripId: String) {
        val context = reactApplicationContext
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.cancel(tripId.hashCode())
    }
}
