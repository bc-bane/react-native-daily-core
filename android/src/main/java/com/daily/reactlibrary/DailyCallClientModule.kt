package com.daily.reactlibrary

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONObject

class DailyCallClientModule(reactContext: ReactApplicationContext) :
  NativeDailyCallClientSpec(reactContext) {

  init {
    sharedContext = reactContext
    DailyClientRegistry.eventSink = EventSink { clientId, type, payloadJson ->
      val body = com.facebook.react.bridge.Arguments.createMap()
      body.putDouble("clientId", clientId.toDouble())
      body.putString("type", type)
      body.putString("payloadJson", payloadJson)
      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("DailyCallClientEvent", body)
    }
    reactContext.addActivityEventListener(activityListener)
  }

  override fun getName(): String = NAME

  @ReactMethod
  override fun createClient(promise: Promise) {
    DailyClientRegistry.postToMain {
      try {
        promise.resolve(DailyClientRegistry.createOnMain().toDouble())
      } catch (error: Exception) {
        promise.reject("E_DAILY", error.message, error)
      }
    }
  }

  @ReactMethod
  override fun destroyClient(clientId: Double) {
    DailyClientRegistry.destroy(clientId.toInt())
  }

  @ReactMethod
  override fun perform(clientId: Double, action: String, payloadJson: String, promise: Promise) {
    val payload = if (payloadJson.isBlank()) JSONObject() else JSONObject(payloadJson)
    if (action == "startScreenShare") {
      val activity = reactApplicationContext.currentActivity
      if (activity == null) {
        promise.reject("E_NO_ACTIVITY", "Screen share needs a foreground activity")
        return
      }
      startScreenShareFromActivity(activity, clientId.toInt()) { json, error ->
        if (error != null) promise.reject("E_DAILY", error) else promise.resolve(json ?: "{}")
      }
      return
    }
    DailyClientRegistry.perform(clientId.toInt(), action, payload) { json, error ->
      if (error != null) promise.reject("E_DAILY", error) else promise.resolve(json ?: "{}")
    }
  }

  @ReactMethod
  override fun addListener(eventName: String) {}

  @ReactMethod
  override fun removeListeners(count: Double) {}

  override fun invalidate() {
    DailyClientRegistry.destroyAll()
    pendingScreenShare?.callback?.invoke(null, "CallClient module invalidated")
    pendingScreenShare = null
    reactApplicationContext.removeActivityEventListener(activityListener)
    DailyClientRegistry.eventSink = null
    sharedContext = null
    super.invalidate()
  }

  private val activityListener = object : com.facebook.react.bridge.ActivityEventListener {
    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
      if (requestCode != SCREEN_SHARE_REQUEST) return
      val pending = pendingScreenShare
      pendingScreenShare = null
      if (pending == null) return
      if (resultCode != Activity.RESULT_OK || data == null) {
        pending.callback(null, "Screen share permission was not granted")
        return
      }
      val client = DailyClientRegistry.client(pending.clientId)
      if (client == null) {
        pending.callback(null, "CallClient was released")
        return
      }
      val appContext = reactApplicationContext.applicationContext
      DailyScreenShareForegroundService.start(appContext)
      client.startScreenShare(data) { result ->
        val error = result.error?.msg
        if (error != null) {
          DailyScreenShareForegroundService.stop(appContext)
          pending.callback(null, error)
        } else {
          pending.callback("{}", null)
        }
      }
    }

    override fun onNewIntent(intent: Intent) {}
  }

  companion object {
    const val NAME = "DailyCallClient"
    const val SCREEN_SHARE_REQUEST = 44016
    var sharedContext: ReactApplicationContext? = null
    var pendingScreenShare: PendingScreenShare? = null
  }
}
