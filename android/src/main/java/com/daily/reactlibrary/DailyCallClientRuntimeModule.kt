package com.daily.reactlibrary

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.ReactContextBaseJavaModule

class DailyCallClientRuntimeModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext),
  ActivityEventListener {

  init {
    DailyRuntime.attach(reactContext.applicationContext) { reactContext.currentActivity }
    reactContext.addActivityEventListener(this)
  }

  override fun getName(): String = NAME

  companion object {
    const val NAME = "DailyCallClientRuntime"
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != DailyRuntime.SCREEN_SHARE_REQUEST) {
      return
    }
    DailyRuntime.handleScreenShareResult(resultCode, data)
  }

  override fun onNewIntent(intent: Intent?) {}

  override fun invalidate() {
    DailyClientRegistry.destroyAll()
    DailyClientRegistry.clearEventListener()
    DailyRuntime.detach()
    reactApplicationContext.removeActivityEventListener(this)
    super.invalidate()
  }
}
