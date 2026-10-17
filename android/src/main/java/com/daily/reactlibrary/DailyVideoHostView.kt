package com.daily.reactlibrary

import android.content.Context
import android.widget.FrameLayout
import co.daily.view.VideoView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

class DailyVideoHostView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val videoView = VideoView(context)
  var clientId: Int = 0
  var participantId: String = ""
  var videoSource: String = "camera"

  init {
    addView(videoView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    if (!instances.contains(this)) {
      instances.add(this)
    }
    refresh()
  }

  override fun onDetachedFromWindow() {
    instances.remove(this)
    videoView.track = null
    super.onDetachedFromWindow()
  }

  fun refresh() {
    if (clientId == 0 || participantId.isEmpty()) {
      videoView.track = null
      return
    }
    videoView.track = DailyClientRegistry.videoTrack(clientId, participantId, videoSource)
  }

  fun setMirror(enabled: Boolean) {
    videoView.mirrorHorizontally = enabled
  }

  fun setFit(contain: Boolean) {
    videoView.videoScaleMode = if (contain) {
      VideoView.VideoScaleMode.FIT
    } else {
      VideoView.VideoScaleMode.FILL
    }
  }

  companion object {
    private val instances = ArrayList<DailyVideoHostView>()

    fun refreshAll() {
      instances.forEach { it.refresh() }
    }
  }
}
