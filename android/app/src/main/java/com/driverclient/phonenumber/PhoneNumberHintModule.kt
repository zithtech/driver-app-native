package com.driverclient.phonenumber

import android.app.Activity
import android.content.Intent
import android.content.IntentSender
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.gms.auth.api.identity.GetPhoneNumberHintIntentRequest
import com.google.android.gms.auth.api.identity.Identity

class PhoneNumberHintModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    private var hintPromise: Promise? = null
    private val REQUEST_CODE_PHONE_HINT = 4281

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName(): String = "PhoneNumberHintModule"

    @ReactMethod
    fun requestPhoneNumberHint(promise: Promise) {
        val currentAct = reactApplicationContext.currentActivity
        if (currentAct == null) {
            promise.reject("E_ACTIVITY_NULL", "Activity is null or not in foreground")
            return
        }

        // Clean up any previously unresolved promise
        hintPromise?.reject("E_CANCELLED", "New phone hint requested before previous completed")
        hintPromise = promise

        try {
            val request = GetPhoneNumberHintIntentRequest.builder().build()
            Identity.getSignInClient(currentAct)
                .getPhoneNumberHintIntent(request)
                .addOnSuccessListener { pendingIntent ->
                    try {
                        currentAct.startIntentSenderForResult(
                            pendingIntent.intentSender,
                            REQUEST_CODE_PHONE_HINT,
                            null,
                            0,
                            0,
                            0
                        )
                    } catch (e: IntentSender.SendIntentException) {
                        hintPromise?.reject("E_START_INTENT", e.localizedMessage ?: "Failed to launch intent sender", e)
                        hintPromise = null
                    }
                }
                .addOnFailureListener { e ->
                    hintPromise?.reject("E_PLAY_SERVICES", e.localizedMessage ?: "Play Services failed to provide hint", e)
                    hintPromise = null
                }
        } catch (e: Exception) {
            hintPromise?.reject("E_UNKNOWN", e.localizedMessage ?: "Unexpected error", e)
            hintPromise = null
        }
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == REQUEST_CODE_PHONE_HINT) {
            val currentPromise = hintPromise ?: return
            hintPromise = null

            if (resultCode == Activity.RESULT_OK && data != null) {
                try {
                    val phoneNumber = Identity.getSignInClient(reactContext)
                        .getPhoneNumberFromIntent(data)
                    if (!phoneNumber.isNullOrEmpty()) {
                        currentPromise.resolve(phoneNumber)
                    } else {
                        currentPromise.reject("E_EMPTY_NUMBER", "Retrieved empty phone number")
                    }
                } catch (e: Exception) {
                    currentPromise.reject("E_PARSING", e.localizedMessage ?: "Failed to parse phone number from intent", e)
                }
            } else {
                currentPromise.reject("E_CANCELLED", "User cancelled or closed phone hint dialog")
            }
        }
    }

    override fun onNewIntent(intent: Intent) {}
}
