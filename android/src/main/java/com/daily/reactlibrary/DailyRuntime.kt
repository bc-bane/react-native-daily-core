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
    val pending = pendingScreenShare
    pendingScreenShare = null
    applicationContext?.let { DailyScreenShareForegroundService.stop(it) }
    pending?.callback?.invoke(null, "CallClient module invalidated")
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
    val pending = pendingScreenShare ?: return
    val appContext = applicationContextOrNull()
    if (resultCode != Activity.RESULT_OK || data == null) {
      pendingScreenShare = null
      appContext?.let { DailyScreenShareForegroundService.stop(it) }
      pending.callback(null, "Screen share permission was not granted")
      return
    }
    if (appContext == null) {
      pendingScreenShare = null
      pending.callback(null, "CallClient module invalidated")
      return
    }
    pending.captureIntent = data
    if (!DailyScreenShareForegroundService.start(appContext, data)) {
      pendingScreenShare = null
      pending.callback(null, "Screen share foreground service failed to start")
    }
  }
}
