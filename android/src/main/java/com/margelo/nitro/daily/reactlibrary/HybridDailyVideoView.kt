package com.margelo.nitro.daily.reactlibrary

import android.view.View
import com.daily.reactlibrary.DailyVideoHostView
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.uimanager.ThemedReactContext

@DoNotStrip
class HybridDailyVideoView(private val reactContext: ThemedReactContext) : HybridDailyVideoViewSpec() {
  private val host = DailyVideoHostView(reactContext)

  override val view: View
    get() = host

  override var clientId: Double = 0.0
    set(value) {
      field = value
      host.clientId = value.toInt()
    }

  override var participantId: String = ""
    set(value) {
      field = value
      host.participantId = value
    }

  override var videoSource: String = "camera"
    set(value) {
      field = value
      host.videoSource = value
    }

  override var mirror: Boolean? = false
    set(value) {
      field = value
      host.setMirror(value ?: false)
    }

  override var objectFit: String? = "cover"
    set(value) {
      field = value
      host.setFit(value == "contain")
    }

  override fun afterUpdate() {
    host.refresh()
  }

  override fun onDropView() {
    host.clearTrack()
  }
}
