package com.daily.reactlibrary

import android.app.Activity
import android.content.Context
import android.content.Intent

internal object DailyRuntime {
  const val SCREEN_SHARE_REQUEST = 44016

  var pendingScreenShare: PendingScreenShare? = null

  private var applicationContext: Context? = null
  private var currentActivity: (() -> Activity?)? = null

  fun attach(applicationContext: Context, currentActivity: () -> Activity?) {
    this.applicationContext = applicationContext.applicationContext
    this.currentActivity = currentActivity
  }

  fun detach() {
    pendingScreenShare?.callback?.invoke(null, "CallClient module invalidated")
    pendingScreenShare = null
    applicationContext = null
    currentActivity = null
  }

  fun applicationContext(): Context {
    return applicationContext
      ?: throw IllegalStateException("DailyCallClientModule is not initialized")
  }

  fun applicationContextOrNull(): Context? = applicationContext

  fun currentActivity(): Activity? = currentActivity?.invoke()

  fun handleScreenShareResult(resultCode: Int, data: Intent?) {
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
    val appContext = applicationContextOrNull()
    if (appContext == null) {
      pending.callback(null, "CallClient module invalidated")
      return
    }
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
}
