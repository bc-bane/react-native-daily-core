package com.daily.reactlibrary

import android.widget.FrameLayout
import co.daily.view.VideoView
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class DailyVideoHostView(context: ThemedReactContext) : FrameLayout(context) {
  private val videoView = VideoView(context)
  private var clientId: Int = 0
  private var participantId: String = ""
  private var videoSource: String = "camera"

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

  fun update(clientId: Int, participantId: String, videoSource: String) {
    this.clientId = clientId
    this.participantId = participantId
    this.videoSource = videoSource
    refresh()
  }

  fun refresh() {
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

class DailyVideoViewManager : SimpleViewManager<DailyVideoHostView>() {
  override fun getName(): String = "DailyVideoView"

  override fun createViewInstance(reactContext: ThemedReactContext): DailyVideoHostView {
    return DailyVideoHostView(reactContext)
  }

  @ReactProp(name = "clientId")
  fun setClientId(view: DailyVideoHostView, clientId: Int) {
    view.setTag(R.id.client_id, clientId)
    apply(view)
  }

  @ReactProp(name = "participantId")
  fun setParticipantId(view: DailyVideoHostView, participantId: String?) {
    view.setTag(R.id.participant_id, participantId ?: "")
    apply(view)
  }

  @ReactProp(name = "videoSource")
  fun setVideoSource(view: DailyVideoHostView, videoSource: String?) {
    view.setTag(R.id.video_source, videoSource ?: "camera")
    apply(view)
  }

  @ReactProp(name = "mirror", defaultBoolean = false)
  fun setMirror(view: DailyVideoHostView, mirror: Boolean) {
    view.setMirror(mirror)
  }

  @ReactProp(name = "objectFit")
  fun setObjectFit(view: DailyVideoHostView, objectFit: String?) {
    view.setFit(objectFit == "contain")
  }

  private fun apply(view: DailyVideoHostView) {
    val clientId = view.getTag(R.id.client_id) as? Int ?: return
    val participantId = view.getTag(R.id.participant_id) as? String ?: return
    val videoSource = view.getTag(R.id.video_source) as? String ?: "camera"
    view.update(clientId, participantId, videoSource)
  }
}
