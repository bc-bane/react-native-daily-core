package com.daily.reactlibrary

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Handler
import android.os.Looper
import co.daily.CallClient
import co.daily.CallClientListener
import co.daily.model.AvailableDevices
import co.daily.model.CallConfiguration
import co.daily.model.CallState
import co.daily.model.RecordingMode
import co.daily.model.MediaDeviceInfo
import co.daily.model.MeetingToken
import co.daily.model.NetworkConnectionStatusUpdate
import co.daily.model.NetworkStats
import co.daily.model.Participant
import co.daily.model.ParticipantCounts
import co.daily.model.ParticipantId
import co.daily.model.ParticipantLeftReason
import co.daily.model.Recipient
import co.daily.model.RemoteInputsEnabledUpdate
import co.daily.model.RemoteParticipantUpdate
import co.daily.model.RequestListener
import co.daily.model.RequestListenerWithData
import co.daily.model.livestream.LiveStreamEndpoints
import co.daily.model.livestream.LiveStreamStatus
import co.daily.model.recording.RecordingStatus
import co.daily.model.streaming.StreamId
import co.daily.model.streaming.StreamingStartMode
import co.daily.model.transcription.StartTranscriptionProperties
import co.daily.model.transcription.TranscriptionMessageData
import co.daily.model.transcription.TranscriptionStatus
import co.daily.settings.BitRate
import co.daily.settings.CameraInputSettingsUpdate
import co.daily.settings.ClientSettingsUpdate
import co.daily.settings.Disable
import co.daily.settings.Enable
import co.daily.settings.FacingModeUpdate
import co.daily.settings.FrameRate
import co.daily.settings.InputSettings
import co.daily.settings.InputSettingsUpdate
import co.daily.settings.MicrophoneInputSettingsUpdate
import co.daily.settings.PublishingSettingsUpdate
import co.daily.settings.Scale
import co.daily.settings.ScreenVideoInputSettingsUpdate
import co.daily.settings.ScreenVideoPublishingSettingsUpdate
import co.daily.settings.VideoEncodingSettingsUpdate
import co.daily.settings.VideoEncodingsSettingsUpdate
import co.daily.settings.VideoMaxQualityUpdate
import co.daily.settings.VideoMediaTrackSettingsUpdate
import co.daily.settings.VideoSendSettingsUpdate
import co.daily.settings.PublishingSettings
import co.daily.settings.subscription.MediaSubscriptionSettings
import co.daily.settings.subscription.SubscriptionProfile
import co.daily.settings.subscription.SubscriptionProfileSettings
import co.daily.settings.subscription.SubscriptionSettings
import co.daily.settings.subscription.SubscriptionState
import co.daily.model.ice_config.IceConfig
import co.daily.model.ice_config.IceServers
import co.daily.model.CanSendPermission
import co.daily.model.ParticipantPermissionsUpdate
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.atomic.AtomicInteger

internal fun interface EventSink {
  fun emit(clientId: Int, type: String, payloadJson: String)
}

internal fun interface AudioLevelSink {
  fun emit(clientId: Int, audioLevel: Double, participantId: String)
}

internal fun interface RemoteAudioLevelsSink {
  fun emit(clientId: Int, levelsJson: String)
}

internal class OnceCallback(
  private val handler: Handler,
  callback: (String?, String?) -> Unit,
) {
  private val callback = java.util.concurrent.atomic.AtomicReference(callback)
  private val timeout = Runnable {
    call(null, "CallClient action did not finish")
  }

  init {
    handler.postDelayed(timeout, 30_000L)
  }

  fun call(json: String?, error: String?) {
    handler.removeCallbacks(timeout)
    callback.getAndSet(null)?.invoke(json, error)
  }
}

internal object DailyClientRegistry {
  private val main = Handler(Looper.getMainLooper())
  private val nextId = AtomicInteger(1)
  private val clients = HashMap<Int, ClientBox>()
  var eventSink: EventSink? = null
  private var eventListenerOwner: Any? = null
  var audioLevelSink: AudioLevelSink? = null
  private var audioLevelOwner: Any? = null
  var remoteAudioLevelsSink: RemoteAudioLevelsSink? = null
  private var remoteAudioLevelsOwner: Any? = null

  fun setEventListener(owner: Any, sink: EventSink) {
    postToMain {
      eventListenerOwner = owner
      eventSink = sink
    }
  }

  fun clearEventListener(owner: Any) {
    postToMain {
      if (eventListenerOwner === owner) {
        eventListenerOwner = null
        eventSink = null
      }
    }
  }

  fun clearEventListener() {
    postToMain {
      eventListenerOwner = null
      eventSink = null
      audioLevelOwner = null
      audioLevelSink = null
      remoteAudioLevelsOwner = null
      remoteAudioLevelsSink = null
    }
  }

  fun setAudioLevelListener(owner: Any, sink: AudioLevelSink) {
    postToMain {
      audioLevelOwner = owner
      audioLevelSink = sink
    }
  }

  fun clearAudioLevelListener(owner: Any) {
    postToMain {
      if (audioLevelOwner === owner) {
        audioLevelOwner = null
        audioLevelSink = null
      }
      if (remoteAudioLevelsOwner === owner) {
        remoteAudioLevelsOwner = null
        remoteAudioLevelsSink = null
      }
    }
  }

  fun setRemoteAudioLevelsListener(owner: Any, sink: RemoteAudioLevelsSink) {
    postToMain {
      remoteAudioLevelsOwner = owner
      remoteAudioLevelsSink = sink
    }
  }

  fun createOnMain(): Int {
    val id = nextId.getAndIncrement()
    val client = CallClient(appContext())
    val box = ClientBox(id, client)
    client.addListener(box)
    clients[id] = box
    return id
  }

  fun destroy(clientId: Int) {
    main.post {
      destroyOnMain(clientId)
    }
  }

  fun destroyAll() {
    main.post {
      val ids = clients.keys.toList()
      ids.forEach { destroyOnMain(it) }
      cancelPendingScreenShare(null)
    }
  }

  private fun destroyOnMain(clientId: Int) {
    cancelPendingScreenShare(clientId)
    clients.remove(clientId)?.client?.release()
    scheduleRefreshAll()
    syncOngoingCall()
  }

  fun cancelPendingScreenShare(clientId: Int?, reason: String = "CallClient was released") {
    val pending = DailyRuntime.pendingScreenShare ?: return
    if (clientId != null && pending.clientId != clientId) {
      return
    }
    DailyRuntime.pendingScreenShare = null
    DailyRuntime.applicationContextOrNull()?.let { DailyScreenShareForegroundService.stop(it) }
    pending.callback(null, reason)
  }

  fun onScreenShareServiceStarted(ok: Boolean): Boolean {
    val pending = DailyRuntime.pendingScreenShare
    if (!ok || pending == null) {
      if (pending != null) {
        DailyRuntime.pendingScreenShare = null
        pending.callback(null, "Screen share foreground service failed to start")
      }
      return false
    }
    DailyRuntime.pendingScreenShare = null
    val capture = pending.captureIntent
    if (capture == null) {
      pending.callback(null, "Screen share foreground service failed to start")
      return false
    }
    startScreenShare(pending.clientId, capture, pending.callback)
    return true
  }

  fun scheduleRefreshAll() {
    main.post { DailyVideoHostView.refreshAll() }
  }

  fun postToMain(block: () -> Unit) {
    main.post(block)
  }

  fun client(clientId: Int): CallClient? = clients[clientId]?.client

  fun startScreenShare(clientId: Int, intent: Intent, callback: (String?, String?) -> Unit) {
    val once = OnceCallback(main, callback)
    val box = clients[clientId]
    if (box == null) {
      DailyRuntime.applicationContextOrNull()?.let { DailyScreenShareForegroundService.stop(it) }
      once.call(null, "CallClient was released")
      return
    }
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q &&
      !DailyScreenShareForegroundService.isForegroundActive()
    ) {
      DailyRuntime.applicationContextOrNull()?.let { DailyScreenShareForegroundService.stop(it) }
      once.call(null, "Screen share foreground service failed to start")
      return
    }
    box.startScreenShare(intent) { json, error ->
      if (error != null) {
        DailyRuntime.applicationContextOrNull()?.let { DailyScreenShareForegroundService.stop(it) }
      }
      once.call(json, error)
    }
  }

  fun videoTrack(clientId: Int, participantId: String, source: String): co.daily.model.MediaStreamTrack? {
    val client = client(clientId) ?: return null
    val participant = client.participants().all.values.firstOrNull { it.id.uuid.toString() == participantId }
    val media = participant?.media ?: return null
    return if (source == "screenVideo") media.screenVideo.track else media.camera.track
  }

  fun perform(clientId: Int, action: String, payload: JSONObject, callback: (String?, String?) -> Unit) {
    val once = OnceCallback(main, callback)
    main.post {
      val box = clients[clientId]
      if (box == null) {
        once.call(null, "Unknown CallClient $clientId")
        return@post
      }
      try {
        box.perform(action, payload, once::call)
      } catch (error: Exception) {
        once.call(null, error.message ?: error.toString())
      }
    }
  }

  fun syncOngoingCall() {
    val context = DailyRuntime.applicationContextOrNull() ?: return
    val joined = clients.values.any { it.client.callState() == CallState.joined }
    if (!joined) {
      DailyOngoingMeetingForegroundService.stop(context)
      return
    }
    val activity = DailyRuntime.currentActivity() ?: return
    DailyOngoingMeetingForegroundService.start(
      activity.javaClass,
      "In a call",
      "You're in a call. Tap to open it.",
      null,
      context,
    )
  }

  private fun appContext(): Context = DailyRuntime.applicationContext()

}

private class ClientBox(
  private val clientId: Int,
  val client: CallClient,
) : CallClientListener {
  fun perform(action: String, payload: JSONObject, callback: (String?, String?) -> Unit) {
    when (action) {
      "join" -> join(payload, callback)
      "leave" -> client.leave { finish(it.error?.msg, callback) { snapshot() } }
      "callConfigFor" -> callConfigFor(payload, callback)
      "setUserName" -> client.setUserName(payload.getString("userName")) { finish(it.error?.msg, callback) }
      "setProxyUrl" -> client.setProxyUrl(payload.optStringOrNull("proxyUrl")) { finish(it.error?.msg, callback) }
      "setIceConfig" -> client.setIceConfig(iceConfig(payload.optJSONObject("iceConfig"))) { finish(it.error?.msg, callback) }
      "setInputsEnabled" -> client.setInputsEnabled(
        camera = payload.optBooleanOrNull("camera"),
        microphone = payload.optBooleanOrNull("microphone"),
      ) { finish(it.error?.msg, callback) { snapshot() } }
      "updateInputs" -> updateInputs(payload, callback)
      "setIsPublishing" -> client.setIsPublishing(
        camera = payload.optBooleanOrNull("camera"),
        microphone = payload.optBooleanOrNull("microphone"),
      ) { finish(it.error?.msg, callback) { snapshot() } }
      "setCameraTorch" -> client.setCameraTorch(payload.getBoolean("enabled")) { finish(it.error?.msg, callback) }
      "setCameraZoom" -> client.setCameraZoom(payload.getDouble("ratio")) { finish(it.error?.msg, callback) }
      "setAudioDevice" -> client.setAudioDevice(payload.getString("deviceId")) { finish(it.error?.msg, callback) }
      "setSubscriptionState" -> setSubscription(payload, callback)
      "setSubscriptionProfile" -> client.setSubscriptionProfile(
        participantId(payload.getString("participantId")),
        SubscriptionProfile(payload.getString("profile")),
      ) { finish(it.error?.msg, callback) }
      "updatePermissions" -> updatePermissions(payload, callback)
      "updateRemoteParticipants" -> updateRemotes(payload, callback)
      "ejectRemoteParticipants" -> client.ejectRemoteParticipants(idList(payload.getJSONArray("ids"))) { finish(it.error?.msg, callback) }
      "sendAppMessage" -> client.sendAppMessage(jsonForAppMessage(payload.getString("message")), recipient(payload)) { finish(it.error?.msg, callback) }
      "stopScreenShare" -> client.stopScreenShare {
        DailyRuntime.applicationContextOrNull()?.let { ctx ->
          DailyScreenShareForegroundService.stop(ctx)
        }
        finish(it.error?.msg, callback)
      }
      "startRecording" -> client.startRecording(
        streamId = streamId(payload.optStringOrNull("streamId")),
        forceNew = if (payload.optBoolean("forceNew", false)) StreamingStartMode.forceNew else StreamingStartMode.onlyIfNotAlreadyStreaming,
      ) { result ->
        val error = result.error?.msg
        if (error != null) callback(null, error) else callback(JSONObject().put("streamId", result.success?.id?.toString() ?: "").toString(), null)
      }
      "stopRecording" -> client.stopRecording(streamId(payload.optStringOrNull("streamId"))) { finish(it.error?.msg, callback) }
      "startLiveStream" -> startLiveStream(payload, callback)
      "stopLiveStream" -> client.stopLiveStream(streamId(payload.optStringOrNull("streamId"))) { finish(it.error?.msg, callback) }
      "addLiveStreamingEndpoints" -> {
        val endpoints = endpoints(payload)
        if (endpoints !is LiveStreamEndpoints.Preconfigured) {
          callback(null, "addLiveStreamingEndpoints only accepts preconfigured endpoints")
        } else {
          client.addLiveStreamingEndpoints(endpoints, streamId(payload.optStringOrNull("streamId"))) { finish(it.error?.msg, callback) }
        }
      }
      "removeLiveStreamingEndpoints" -> {
        val endpoints = endpoints(payload)
        if (endpoints !is LiveStreamEndpoints.Preconfigured) {
          callback(null, "removeLiveStreamingEndpoints only accepts preconfigured endpoints")
        } else {
          client.removeLiveStreamingEndpoints(endpoints, streamId(payload.optStringOrNull("streamId"))) { finish(it.error?.msg, callback) }
        }
      }
      "startTranscription" -> client.startTranscription(transcription(payload)) { finish(it.error?.msg, callback) }
      "stopTranscription" -> client.stopTranscription { finish(it.error?.msg, callback) }
      "startLocalAudioLevelObserver" -> client.startLocalAudioLevelObserver(interval(payload)) { finish(it.error?.msg, callback) }
      "stopLocalAudioLevelObserver" -> client.stopLocalAudioLevelObserver { finish(it.error?.msg, callback) }
      "startRemoteParticipantsAudioLevelObserver" -> client.startRemoteParticipantsAudioLevelObserver(interval(payload)) { finish(it.error?.msg, callback) }
      "stopRemoteParticipantsAudioLevelObserver" -> client.stopRemoteParticipantsAudioLevelObserver { finish(it.error?.msg, callback) }
      "snapshot" -> callback(snapshot(), null)
      else -> callback(null, "Unsupported action $action")
    }
  }

  fun startScreenShare(intent: Intent, callback: (String?, String?) -> Unit) {
    client.updatePublishing(screenSharePublishing()) {
      client.startScreenShare(intent) { finish(it.error?.msg, callback) }
    }
  }

  private fun updateInputs(payload: JSONObject, callback: (String?, String?) -> Unit) {
    val camera = payload.optJSONObject("camera")?.let { cameraUpdate(it) }
    val microphone = payload.optJSONObject("microphone")?.takeIf { it.has("isEnabled") }?.let {
      MicrophoneInputSettingsUpdate.Builder().withEnabled(it.getBoolean("isEnabled")).build()
    }
    val screenVideo = payload.optJSONObject("screenVideo")?.takeIf { it.has("isEnabled") }?.let {
      ScreenVideoInputSettingsUpdate(isEnabled = if (it.getBoolean("isEnabled")) Enable() else Disable())
    }
    client.updateInputs(
      InputSettingsUpdate(camera = camera, microphone = microphone, screenVideo = screenVideo),
    ) { finish(it.error?.msg, callback) { snapshot() } }
  }

  private fun cameraUpdate(camera: JSONObject): CameraInputSettingsUpdate? {
    val builder = CameraInputSettingsUpdate.Builder()
    var changed = false
    if (camera.has("isEnabled")) {
      builder.withEnabled(camera.getBoolean("isEnabled"))
      changed = true
    }
    camera.optStringOrNull("facingMode")?.let { facing ->
      val mode = if (facing == "environment") FacingModeUpdate.environment else FacingModeUpdate.user
      builder.withSettings(VideoMediaTrackSettingsUpdate.Builder().withFacingMode(mode).build())
      changed = true
    }
    return if (changed) builder.build() else null
  }

  private fun join(payload: JSONObject, callback: (String?, String?) -> Unit) {
    val token = payload.optStringOrNull("token")?.let { MeetingToken(it) }
    val settingsJson = payload.optJSONObject("clientSettings")
    val settings = settingsJson?.let {
      val inputs = InputSettingsUpdate.Builder()
      if (it.has("camera")) inputs.withCamera(it.getBoolean("camera"))
      if (it.has("microphone")) inputs.withMicrophone(it.getBoolean("microphone"))
      ClientSettingsUpdate(inputSettings = inputs.build())
    }
    client.join(payload.getString("url"), token, settings, RequestListenerWithData { result ->
      val error = result.error?.msg
      if (error != null) callback(null, error) else callback(snapshot(), null)
    })
  }

  private fun callConfigFor(payload: JSONObject, callback: (String?, String?) -> Unit) {
    val token = payload.optStringOrNull("token")?.let { MeetingToken(it) }
    client.callConfigFor(payload.getString("url"), token) { result ->
      val error = result.error?.msg
      if (error != null) {
        callback(null, error)
      } else {
        val config = result.success
        if (config == null) callback(null, "Call configuration was empty") else callback(callConfigJson(config), null)
      }
    }
  }

  private fun setSubscription(payload: JSONObject, callback: (String?, String?) -> Unit) {
    val id = participantId(payload.getString("participantId"))
    if (payload.has("state")) {
      client.setSubscriptionState(id, subscriptionState(payload.getString("state"))) { finish(it.error?.msg, callback) }
      return
    }
    client.setSubscriptionState(
      participantId = id,
      camera = payload.optStringOrNull("camera")?.let { subscriptionState(it) },
      microphone = payload.optStringOrNull("microphone")?.let { subscriptionState(it) },
      screenVideo = payload.optStringOrNull("screenVideo")?.let { subscriptionState(it) },
      screenAudio = payload.optStringOrNull("screenAudio")?.let { subscriptionState(it) },
    ) { finish(it.error?.msg, callback) }
  }

  private fun updatePermissions(payload: JSONObject, callback: (String?, String?) -> Unit) {
    val id = payload.optStringOrNull("participantId")
    if (id == null) {
      callback(null, "A participant id is required")
      return
    }
    val localId = client.participants().local.id.uuid.toString()
    if (id.equals(localId, ignoreCase = true)) {
      client.updatePermissions(permissions(payload)) { finish(it.error?.msg, callback) }
      return
    }
    client.updateRemoteParticipants(
      mapOf(participantId(id) to RemoteParticipantUpdate(permissions(payload), null)),
    ) { finish(it.error?.msg, callback) }
  }

  private fun updateRemotes(payload: JSONObject, callback: (String?, String?) -> Unit) {
    val updates = HashMap<ParticipantId, RemoteParticipantUpdate>()
    val keys = payload.keys()
    while (keys.hasNext()) {
      val key = keys.next()
      val value = payload.getJSONObject(key)
      val permissions = value.optJSONObject("permissions")?.let { permissions(it) }
      val inputs = value.optJSONObject("inputsEnabled")?.let {
        RemoteInputsEnabledUpdate(
          microphone = it.optBooleanOrNull("microphone"),
          camera = it.optBooleanOrNull("camera"),
        )
      }
      updates[participantId(key)] = RemoteParticipantUpdate(permissions, inputs)
    }
    client.updateRemoteParticipants(updates) { finish(it.error?.msg, callback) }
  }

  private fun startLiveStream(payload: JSONObject, callback: (String?, String?) -> Unit) {
    client.startLiveStream(
      endpoints = endpoints(payload),
      streamId = streamId(payload.optStringOrNull("streamId")),
      forceNew = if (payload.optBoolean("forceNew", false)) StreamingStartMode.forceNew else StreamingStartMode.onlyIfNotAlreadyStreaming,
    ) { result ->
      val error = result.error?.msg
      if (error != null) callback(null, error) else callback(JSONObject().put("streamId", result.success?.id?.toString() ?: "").toString(), null)
    }
  }

  private fun snapshot(): String {
    val participants = client.participants()
    val json = JSONObject()
    json.put("callState", client.callState().toJsValue())
    json.put("participants", participantsJson(participants.local, participants.all.values))
    json.put("participantCounts", countsJson(client.participantCounts()))
    json.put("inputs", inputsJson(client.inputs()))
    json.put("publishing", publishingJson(client.publishing()))
    json.put("availableDevices", devicesJson(client.availableDevices()))
    json.put("audioDevice", client.audioDevice() ?: JSONObject.NULL)
    return json.toString()
  }

  private fun emit(type: String, payload: JSONObject) {
    DailyClientRegistry.eventSink?.emit(clientId, type, payload.toString())
    if (type == "participantJoined" || type == "participantUpdated" || type == "participantLeft") {
      DailyClientRegistry.scheduleRefreshAll()
    }
    if (type == "callStateUpdated") {
      DailyClientRegistry.syncOngoingCall()
    }
  }

  override fun onCallStateUpdated(state: CallState) {
    emit("callStateUpdated", JSONObject().put("state", state.toJsValue()))
  }

  override fun onParticipantJoined(participant: Participant) {
    emit("participantJoined", participantJson(participant))
  }

  override fun onParticipantUpdated(participant: Participant) {
    emit("participantUpdated", participantJson(participant))
  }

  override fun onParticipantLeft(participant: Participant, reason: ParticipantLeftReason) {
    emit("participantLeft", JSONObject().put("participant", participantJson(participant)).put("reason", reason.name))
  }

  override fun onParticipantCountsUpdated(newParticipantCounts: ParticipantCounts) {
    emit("participantCountsUpdated", countsJson(newParticipantCounts))
  }

  override fun onActiveSpeakerChanged(activeSpeaker: Participant?) {
    emit("activeSpeakerChanged", JSONObject().put("participant", if (activeSpeaker == null) JSONObject.NULL else participantJson(activeSpeaker)))
  }

  override fun onInputsUpdated(inputSettings: InputSettings) {
    emit("inputsUpdated", inputsJson(inputSettings))
  }

  override fun onPublishingUpdated(publishingSettings: PublishingSettings) {
    emit("publishingUpdated", publishingJson(publishingSettings))
  }

  override fun onAvailableDevicesUpdated(availableDevices: AvailableDevices) {
    emit("availableDevicesUpdated", devicesJson(availableDevices))
  }

  override fun onError(message: String) {
    emit("error", JSONObject().put("message", message))
  }

  override fun onAppMessage(message: String, from: ParticipantId) {
    emit("appMessage", JSONObject().put("message", appMessageText(message)).put("from", from.uuid.toString()))
  }

  override fun onAppMessageFromRestApi(message: String) {
    emit("appMessageFromRestApi", JSONObject().put("message", appMessageText(message)))
  }

  override fun onNetworkStatsUpdated(newNetworkStatistics: NetworkStats) {
    emit("networkStatsUpdated", JSONObject()
      .put("quality", newNetworkStatistics.quality)
      .put("threshold", newNetworkStatistics.threshold.name)
      .put("previousThreshold", newNetworkStatistics.previousThreshold?.name ?: JSONObject.NULL))
  }

  override fun onNetworkConnectionStatusUpdated(status: NetworkConnectionStatusUpdate) {
    emit("networkConnectionStatusUpdated", JSONObject().put("description", status.toString()))
  }

  override fun onLocalAudioLevel(audioLevel: Float) {
    DailyClientRegistry.audioLevelSink?.emit(clientId, audioLevel.toDouble(), "")
  }

  override fun onRemoteParticipantsAudioLevel(participantsAudioLevel: Map<ParticipantId, Float>) {
    val json = JSONObject()
    participantsAudioLevel.forEach { (id, level) ->
      json.put(id.uuid.toString(), level.toDouble())
    }
    DailyClientRegistry.remoteAudioLevelsSink?.emit(clientId, json.toString())
  }

  override fun onSubscriptionsUpdated(subscriptions: Map<ParticipantId, SubscriptionSettings>) {
    val json = JSONObject()
    subscriptions.forEach { (id, settings) ->
      json.put(
        id.uuid.toString(),
        JSONObject()
          .put("profile", settings.profile.id ?: JSONObject.NULL)
          .put("media", subscriptionMediaJson(settings.media)),
      )
    }
    emit("subscriptionsUpdated", json)
  }

  override fun onSubscriptionProfilesUpdated(subscriptionProfiles: Map<SubscriptionProfile, SubscriptionProfileSettings>) {
    val json = JSONObject()
    subscriptionProfiles.forEach { (profile, settings) ->
      json.put(profile.id ?: "base", subscriptionMediaJson(settings))
    }
    emit("subscriptionProfilesUpdated", json)
  }

  override fun onRecordingStarted(status: RecordingStatus) {
    emit("recordingStarted", JSONObject().put("streamId", status.streamId.id.toString()))
  }

  override fun onRecordingStopped(streamId: StreamId) {
    emit("recordingStopped", JSONObject().put("streamId", streamId.id.toString()))
  }

  override fun onRecordingError(streamId: StreamId, message: String) {
    emit("recordingError", JSONObject().put("streamId", streamId.id.toString()).put("message", message))
  }

  override fun onLiveStreamStarted(status: LiveStreamStatus) {
    emit("liveStreamStarted", JSONObject().put("streamId", status.streamId.id.toString()))
  }

  override fun onLiveStreamStopped(streamId: StreamId) {
    emit("liveStreamStopped", JSONObject().put("streamId", streamId.id.toString()))
  }

  override fun onLiveStreamError(streamId: StreamId, message: String) {
    emit("liveStreamError", JSONObject().put("streamId", streamId.id.toString()).put("message", message))
  }

  override fun onLiveStreamWarning(streamId: StreamId, message: String) {
    emit("liveStreamWarning", JSONObject().put("streamId", streamId.id.toString()).put("message", message))
  }

  override fun onTranscriptionStarted(status: TranscriptionStatus) {
    emit("transcriptionStarted", JSONObject().put("started", true))
  }

  override fun onTranscriptionStopped(updatedBy: ParticipantId?, stoppedByError: Boolean) {
    emit("transcriptionStopped", JSONObject().put("stoppedByError", stoppedByError))
  }

  override fun onTranscriptionMessage(data: TranscriptionMessageData) {
    emit("transcriptionMessage", JSONObject()
      .put("participantId", data.participantId.uuid.toString())
      .put("text", data.text)
      .put("timestamp", data.timestamp))
  }

  override fun onTranscriptionError(message: String) {
    emit("transcriptionError", JSONObject().put("message", message))
  }
}

private fun screenSharePublishing() = PublishingSettingsUpdate(
  screenVideo = ScreenVideoPublishingSettingsUpdate(
    sendSettings = VideoSendSettingsUpdate(
      maxQuality = VideoMaxQualityUpdate.high,
      encodings = VideoEncodingsSettingsUpdate(
        mapOf(
          VideoMaxQualityUpdate.high to VideoEncodingSettingsUpdate(
            maxBitrate = BitRate(1_500_000),
            maxFramerate = FrameRate(15),
            scaleResolutionDownBy = Scale(2f),
          ),
        ),
      ),
    ),
  ),
)

private fun jsonForAppMessage(message: String): String {
  val trimmed = message.trim()
  val alreadyJson = try {
    when {
      trimmed.startsWith("{") -> {
        JSONObject(trimmed)
        true
      }
      trimmed.startsWith("[") -> {
        JSONArray(trimmed)
        true
      }
      trimmed.startsWith("\"") -> {
        JSONArray("[$trimmed]").getString(0)
        true
      }
      else -> false
    }
  } catch (_: Exception) {
    false
  }
  return if (alreadyJson) message else JSONObject.quote(message)
}

private fun appMessageText(message: String): String {
  val trimmed = message.trim()
  if (!trimmed.startsWith("\"")) {
    return message
  }
  return try {
    JSONArray("[$trimmed]").getString(0)
  } catch (_: Exception) {
    message
  }
}

private fun finish(error: String?, callback: (String?, String?) -> Unit, success: () -> String = { "{}" }) {
  if (error != null) callback(null, error) else callback(success(), null)
}

private fun participantId(id: String) = ParticipantId(UUID.fromString(id))

private fun streamId(id: String?) = id?.let { StreamId(UUID.fromString(it)) }

private fun subscriptionState(name: String) = SubscriptionState.valueOf(name)

private fun interval(payload: JSONObject): Long? {
  val value = payload.optLong("intervalMs", 0L)
  return if (value <= 0L) null else value
}

private fun idList(array: JSONArray): List<ParticipantId> {
  val ids = ArrayList<ParticipantId>()
  for (index in 0 until array.length()) {
    ids.add(participantId(array.getString(index)))
  }
  return ids
}

private fun recipient(payload: JSONObject): Recipient {
  val to = payload.optStringOrNull("to") ?: return Recipient.All
  return Recipient.Participant(participantId(to))
}

private fun permissions(json: JSONObject): ParticipantPermissionsUpdate {
  val canSend = if (json.has("canSend")) {
    val array = json.getJSONArray("canSend")
    val values = HashSet<CanSendPermission>()
    for (index in 0 until array.length()) {
      values.add(CanSendPermission.valueOf(array.getString(index)))
    }
    values
  } else {
    null
  }
  return ParticipantPermissionsUpdate(
    hasPresence = json.optBooleanOrNull("hasPresence"),
    canSend = canSend,
  )
}

private fun iceConfig(json: JSONObject?): IceConfig? {
  if (json == null) return null
  val serversJson = json.optJSONArray("iceServers") ?: JSONArray()
  val servers = ArrayList<IceServers>()
  for (index in 0 until serversJson.length()) {
    val server = serversJson.getJSONObject(index)
    val urls = ArrayList<String>()
    val urlArray = server.getJSONArray("urls")
    for (urlIndex in 0 until urlArray.length()) {
      urls.add(urlArray.getString(urlIndex))
    }
    servers.add(IceServers(server.optStringOrNull("username"), server.optStringOrNull("credential"), urls))
  }
  return IceConfig(iceServers = servers)
}

private fun endpoints(payload: JSONObject): LiveStreamEndpoints {
  val preconfigured = payload.optJSONArray("preconfigured")
  if (preconfigured != null) {
    val values = ArrayList<String>()
    for (index in 0 until preconfigured.length()) values.add(preconfigured.getString(index))
    return LiveStreamEndpoints.Preconfigured(values)
  }
  val rtmp = payload.optJSONArray("rtmpUrls") ?: JSONArray()
  val values = ArrayList<String>()
  for (index in 0 until rtmp.length()) values.add(rtmp.getString(index))
  return LiveStreamEndpoints.RTMPUrls(values)
}

private fun transcription(payload: JSONObject) = StartTranscriptionProperties(
  language = payload.optStringOrNull("language"),
  model = payload.optStringOrNull("model"),
  profanityFilter = payload.optBooleanOrNull("profanityFilter"),
  punctuate = payload.optBooleanOrNull("punctuate"),
  includeRawResponse = payload.optBooleanOrNull("includeRawResponse"),
)

private fun callConfigJson(config: CallConfiguration): String {
  val permissions = config.permissionsOnJoin
  val base = permissions.canReceive.base
  val canSend = JSONArray()
  permissions.canSend.forEach { canSend.put(it.name) }
  val canAdmin = JSONArray()
  permissions.canAdmin.forEach { canAdmin.put(it.name) }
  return JSONObject()
    .put("roomName", config.roomName)
    .put("isOwner", config.isOwner)
    .put("initialCameraEnabled", config.initialCameraEnabled)
    .put("initialMicrophoneEnabled", config.initialMicrophoneEnabled)
    .put("recordingMode", recordingModeName(config.recordingMode))
    .put("ejectAtRoomExpiration", config.ejectAtRoomExpiration)
    .put("ejectAtTokenExpiration", config.ejectAtTokenExpiration)
    .put("terseLoggingEnabled", config.terseLoggingEnabled)
    .put("initialUserName", config.initialUserName ?: JSONObject.NULL)
    .put("userId", config.userId ?: JSONObject.NULL)
    .put("roomExpiration", config.roomExpiration ?: JSONObject.NULL)
    .put("tokenExpiration", config.tokenExpiration ?: JSONObject.NULL)
    .put("roomNotBefore", config.roomNotBefore ?: JSONObject.NULL)
    .put("tokenNotBefore", config.tokenNotBefore ?: JSONObject.NULL)
    .put(
      "permissionsOnJoin",
      JSONObject()
        .put("hasPresence", permissions.hasPresence)
        .put("canSend", canSend)
        .put("canAdmin", canAdmin)
        .put(
          "canReceive",
          JSONObject().put(
            "base",
            JSONObject()
              .put("camera", base.camera)
              .put("microphone", base.microphone)
              .put("screenVideo", base.screenVideo)
              .put("screenAudio", base.screenAudio),
          ),
        ),
    )
    .toString()
}

private fun recordingModeName(mode: RecordingMode): String = when (mode) {
  RecordingMode.cloud -> "cloud"
  RecordingMode.cloudAudioOnly -> "cloud-audio-only"
  RecordingMode.rawTracks -> "raw-tracks"
  RecordingMode.local -> "local"
  RecordingMode.off -> "off"
}

private fun subscriptionMediaJson(media: MediaSubscriptionSettings) = JSONObject()
  .put("camera", media.camera.subscriptionState.name)
  .put("microphone", media.microphone.subscriptionState.name)
  .put("screenVideo", media.screenVideo.subscriptionState.name)
  .put("screenAudio", media.screenAudio.subscriptionState.name)

private fun participantsJson(local: Participant, all: Collection<Participant>): JSONObject {
  val allJson = JSONObject()
  all.forEach { allJson.put(it.id.uuid.toString(), participantJson(it)) }
  return JSONObject().put("local", participantJson(local)).put("all", allJson)
}

private fun participantJson(participant: Participant): JSONObject {
  val info = JSONObject()
    .put("isLocal", participant.info.isLocal)
    .put("isOwner", participant.info.isOwner)
    .put("userId", participant.info.userId ?: JSONObject.NULL)
    .put("userName", participant.info.userName ?: JSONObject.NULL)
  val media = participant.media?.let {
    JSONObject()
      .put("camera", trackJson(it.camera.state.name, it.camera.subscribed.name))
      .put("microphone", trackJson(it.microphone.state.name, it.microphone.subscribed.name))
      .put("screenVideo", trackJson(it.screenVideo.state.name, it.screenVideo.subscribed.name))
      .put("screenAudio", trackJson(it.screenAudio.state.name, it.screenAudio.subscribed.name))
  }
  return JSONObject()
    .put("id", participant.id.uuid.toString())
    .put("info", info)
    .put("media", media ?: JSONObject.NULL)
}

private fun trackJson(state: String, subscribed: String) =
  JSONObject().put("state", state).put("subscribed", subscribed)

private fun countsJson(counts: ParticipantCounts) =
  JSONObject().put("present", counts.present).put("hidden", counts.hidden)

private fun inputsJson(inputs: InputSettings) = JSONObject()
  .put("camera", JSONObject().put("isEnabled", inputs.camera.isEnabled))
  .put("microphone", JSONObject().put("isEnabled", inputs.microphone.isEnabled))
  .put("screenVideo", JSONObject().put("isEnabled", inputs.screenVideo.isEnabled))

private fun publishingJson(publishing: PublishingSettings) = JSONObject()
  .put("camera", JSONObject().put("isPublishing", publishing.camera.isPublishing))
  .put("microphone", JSONObject().put("isPublishing", publishing.microphone.isPublishing))
  .put("screenVideo", JSONObject().put("isPublishing", publishing.screenVideo.isPublishing))

private fun devicesJson(devices: AvailableDevices): JSONObject {
  fun list(items: List<MediaDeviceInfo>): JSONArray {
    val array = JSONArray()
    items.forEach {
      array.put(JSONObject()
        .put("deviceId", it.deviceId)
        .put("groupId", it.groupId)
        .put("kind", it.kind)
        .put("label", it.label))
    }
    return array
  }
  return JSONObject()
    .put("camera", list(devices.camera))
    .put("microphone", list(devices.microphone))
    .put("speaker", list(devices.speaker))
    .put("audio", list(devices.audio))
}

private fun JSONObject.optStringOrNull(key: String): String? {
  if (!has(key) || isNull(key)) return null
  return getString(key)
}

private fun JSONObject.optBooleanOrNull(key: String): Boolean? {
  if (!has(key) || isNull(key)) return null
  return getBoolean(key)
}

internal fun startScreenShareFromActivity(activity: Activity, clientId: Int, callback: (String?, String?) -> Unit) {
  DailyClientRegistry.postToMain {
    val superseded = DailyRuntime.pendingScreenShare
    if (superseded != null) {
      superseded.callback(null, "Superseded by another screen share request")
    }
    if (DailyRuntime.applicationContextOrNull() == null) {
      callback(null, "CallClient module is not initialized")
      return@postToMain
    }
    DailyRuntime.pendingScreenShare = PendingScreenShare(clientId, callback, null)
    val manager = activity.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    activity.startActivityForResult(
      manager.createScreenCaptureIntent(),
      DailyRuntime.SCREEN_SHARE_REQUEST,
    )
  }
}

private fun CallState.toJsValue(): String = when (this) {
  CallState.initialized -> "initialized"
  CallState.joining -> "joining"
  CallState.joined -> "joined"
  CallState.leaving -> "leaving"
  CallState.left -> "left"
}

data class PendingScreenShare(
  val clientId: Int,
  val callback: (String?, String?) -> Unit,
  var captureIntent: Intent?,
)
