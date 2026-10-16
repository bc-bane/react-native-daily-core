import Daily
import UIKit

private typealias Completion = (String?, String?) -> Void

@objc(DailyVideoHost)
public class DailyVideoHost: UIView {
  private let videoView = VideoView(frame: .zero)
  @objc public var clientId: Int = 0
  @objc public var participantId: String = ""
  @objc public var videoSource: String = "camera"

  public override init(frame: CGRect) {
    super.init(frame: frame)
    videoView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    videoView.frame = bounds
    addSubview(videoView)
    DailyClientRegistry.shared.track(host: self)
  }

  public required init?(coder: NSCoder) {
    return nil
  }

  @objc public func refreshTrack() {
    let apply = {
      self.videoView.track = DailyClientRegistry.shared.videoTrack(
        clientId: self.clientId,
        participantId: self.participantId,
        source: self.videoSource
      )
    }
    if Thread.isMainThread {
      MainActor.assumeIsolated(apply)
    } else {
      DispatchQueue.main.async { MainActor.assumeIsolated(apply) }
    }
  }

  @objc public func clearTrack() {
    let apply = { self.videoView.track = nil }
    if Thread.isMainThread {
      MainActor.assumeIsolated(apply)
    } else {
      DispatchQueue.main.async { MainActor.assumeIsolated(apply) }
    }
  }

  @objc public func setMirrored(_ mirrored: Bool) {
    videoView.transform = mirrored ? CGAffineTransform(scaleX: -1, y: 1) : .identity
  }

  @objc public func setObjectFit(_ objectFit: String) {
    videoView.videoScaleMode = objectFit == "contain" ? .fit : .fill
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    videoView.frame = bounds
  }
}

@objc(DailyClientRegistry)
@MainActor
public class DailyClientRegistry: NSObject {
  @objc public static let shared = DailyClientRegistry()
  @objc public var eventSink: ((NSNumber, NSString, NSString) -> Void)?

  private override init() {
    super.init()
    NotificationCenter.default.addObserver(
      forName: CallClient.NotificationName.didJoinFirstCall,
      object: nil,
      queue: .main
    ) { _ in
      UIApplication.shared.isIdleTimerDisabled = true
    }
    NotificationCenter.default.addObserver(
      forName: CallClient.NotificationName.didLeaveLastCall,
      object: nil,
      queue: .main
    ) { _ in
      UIApplication.shared.isIdleTimerDisabled = false
    }
  }

  private var nextId = 1
  private var boxes: [Int: CallBox] = [:]
  private let hosts = NSHashTable<DailyVideoHost>.weakObjects()

  @objc public func createOnMain() -> Int {
    let id = nextId
    nextId += 1
    let box = CallBox(clientId: id)
    boxes[id] = box
    return id
  }

  @objc public func destroy(_ clientId: Int) {
    onMain {
      self.destroyOnMain(clientId)
    }
  }

  @objc public func destroyAll() {
    onMain {
      let ids = Array(self.boxes.keys)
      for id in ids {
        self.destroyOnMain(id)
      }
    }
  }

  private func destroyOnMain(_ clientId: Int) {
    guard let box = boxes.removeValue(forKey: clientId) else {
      return
    }
    box.teardown()
    clearHostTracks(for: clientId)
    updateIdleTimer()
  }

  func updateIdleTimer() {
    let joined = boxes.values.contains { $0.client.callState == .joined }
    UIApplication.shared.isIdleTimerDisabled = joined
  }

  private func clearHostTracks(for clientId: Int) {
    for host in hosts.allObjects where host.clientId == clientId {
      host.clearTrack()
    }
  }

  @objc public func perform(_ clientId: Int, action: String, payloadJson: String, completion: @escaping (String?, String?) -> Void) {
    onMain {
      guard let box = self.boxes[clientId] else {
        completion(nil, "Unknown CallClient \(clientId)")
        return
      }
      box.perform(action: action, payloadJson: payloadJson, completion: completion)
    }
  }

  func videoTrack(clientId: Int, participantId: String, source: String) -> VideoTrack? {
    guard let box = boxes[clientId], let participantId = ParticipantID(uuidString: participantId) else {
      return nil
    }
    let participant = box.client.participants.all[participantId]
    if source == "screenVideo" {
      return participant?.media?.screenVideo.track
    }
    return participant?.media?.camera.track
  }

  func track(host: DailyVideoHost) {
    hosts.add(host)
  }

  func untrack(host: DailyVideoHost) {
    hosts.remove(host)
  }

  func refreshHosts() {
    for host in hosts.allObjects {
      host.refreshTrack()
    }
  }

  fileprivate func emit(clientId: Int, type: String, payload: String) {
    eventSink?(NSNumber(value: clientId), type as NSString, payload as NSString)
  }

  fileprivate func box(_ clientId: Int) -> CallBox? {
    boxes[clientId]
  }

  private func onMain(_ work: @escaping @MainActor () -> Void) {
    if Thread.isMainThread {
      MainActor.assumeIsolated(work)
    } else {
      DispatchQueue.main.async { MainActor.assumeIsolated(work) }
    }
  }

}

@MainActor
private final class CallBox: NSObject, CallClientDelegate {
  let clientId: Int
  let client: CallClient

  init(clientId: Int) {
    self.clientId = clientId
    self.client = CallClient()
    super.init()
    client.delegate = self
  }

  func teardown() {
    client.delegate = nil
  }

  func perform(action: String, payloadJson: String, completion: @escaping Completion) {
    let payload = jsonObject(payloadJson)
    switch action {
    case "join":
      join(payload, completion)
    case "leave":
      client.leave { result in self.finish(result, completion) { self.snapshot() } }
    case "callConfigFor":
      callConfig(payload, completion)
    case "setUserName":
      client.set(username: payload["userName"] as? String) { result in self.finish(result, completion) }
    case "setProxyUrl":
      client.set(proxyUrl: payload["proxyUrl"] as? String) { result in self.finish(result, completion) }
    case "setIceConfig":
      client.set(iceConfig: iceConfig(payload["iceConfig"] as? [String: Any])) { result in self.finish(result, completion) }
    case "setInputsEnabled":
      setInputs(payload, completion)
    case "setIsPublishing":
      setPublishing(payload, completion)
    case "setCameraTorch":
      client.setCameraTorch((payload["enabled"] as? Bool) ?? false) { result in self.finish(result, completion) }
    case "setCameraZoom":
      client.setCameraZoom((payload["ratio"] as? NSNumber)?.doubleValue ?? 1) { result in self.finish(result, completion) }
    case "setAudioDevice":
      setAudioDevice(payload, completion)
    case "setSubscriptionState":
      setSubscription(payload, completion)
    case "setSubscriptionProfile":
      setProfile(payload, completion)
    case "updatePermissions":
      client.updatePermissions(permissions(payload)) { result in self.finish(result, completion) }
    case "updateRemoteParticipants":
      updateRemotes(payload, completion)
    case "ejectRemoteParticipants":
      eject(payload, completion)
    case "sendAppMessage":
      sendMessage(payload, completion)
    case "startScreenShare":
      client.startScreenShare { result in self.finish(result, completion) }
    case "stopScreenShare":
      client.stopScreenShare { result in self.finish(result, completion) }
    case "startRecording":
      client.startRecording(streamID: streamId(payload["streamId"] as? String), forceNew: payload["forceNew"] as? Bool) { result in
        self.hop {
          switch result {
          case .success(let id): completion("{\"streamId\":\"\(id.uuidString)\"}", nil)
          case .failure(let error): completion(nil, error.localizedDescription)
          }
        }
      }
    case "stopRecording":
      client.stopRecording(streamID: streamId(payload["streamId"] as? String)) { result in self.finish(result, completion) }
    case "updateRecording":
      client.updateRecording(streamingSettings: StreamingSettingsUpdate(), streamID: streamId(payload["streamId"] as? String)) { result in self.finish(result, completion) }
    case "startLiveStream":
      startLiveStream(payload, completion)
    case "stopLiveStream":
      client.stopLiveStream(streamID: streamId(payload["streamId"] as? String)) { result in self.finish(result, completion) }
    case "updateLiveStream":
      client.updateLiveStream(streamingSettings: StreamingSettingsUpdate(), streamID: streamId(payload["streamId"] as? String)) { result in self.finish(result, completion) }
    case "addLiveStreamingEndpoints":
      guard let endpoints = preconfigured(payload) else {
        completion(nil, "addLiveStreamingEndpoints only accepts preconfigured endpoints")
        return
      }
      client.addLiveStreamingEndpoints(endpoints: endpoints, streamID: streamId(payload["streamId"] as? String)) { result in self.finish(result, completion) }
    case "removeLiveStreamingEndpoints":
      guard let endpoints = preconfigured(payload) else {
        completion(nil, "removeLiveStreamingEndpoints only accepts preconfigured endpoints")
        return
      }
      client.removeLiveStreamingEndpoints(endpoints: endpoints, streamID: streamId(payload["streamId"] as? String)) { result in self.finish(result, completion) }
    case "startTranscription":
      client.startTranscription(withSettings: transcription(payload)) { result in self.finish(result, completion) }
    case "stopTranscription":
      client.stopTranscription { result in self.finish(result, completion) }
    case "startLocalAudioLevelObserver":
      client.startLocalAudioLevelObserver(intervalMs: interval(payload)) { result in self.finish(result, completion) }
    case "stopLocalAudioLevelObserver":
      client.stopLocalAudioLevelObserver { result in self.finish(result, completion) }
    case "startRemoteParticipantsAudioLevelObserver":
      client.startRemoteParticipantsAudioLevelObserver(intervalMs: interval(payload)) { result in self.finish(result, completion) }
    case "stopRemoteParticipantsAudioLevelObserver":
      client.stopRemoteParticipantsAudioLevelObserver { result in self.finish(result, completion) }
    case "snapshot":
      completion(snapshot(), nil)
    default:
      completion(nil, "Unsupported action \(action)")
    }
  }

  private func join(_ payload: [String: Any], _ completion: @escaping Completion) {
    guard let urlString = payload["url"] as? String, let url = URL(string: urlString) else {
      completion(nil, "A room URL is required")
      return
    }
    let token = (payload["token"] as? String).map { MeetingToken(stringValue: $0) }
    let finish: (Result<CallJoinData, CallClientError>) -> Void = { result in
      self.hop {
        switch result {
        case .success:
          DailyClientRegistry.shared.updateIdleTimer()
          completion(self.snapshot(), nil)
        case .failure(let error):
          completion(nil, error.localizedDescription)
        }
      }
    }
    if let inputs = payload["clientSettings"] as? [String: Any] {
      var settings = ClientSettingsUpdate()
      var update = InputSettingsUpdate()
      if let camera = inputs["camera"] as? Bool {
        update.camera = .set(.enabled(camera))
      }
      if let microphone = inputs["microphone"] as? Bool {
        update.microphone = .set(.enabled(microphone))
      }
      settings.inputs = .set(update)
      client.join(url: url, token: token, settings: settings, completion: finish)
    } else {
      client.join(url: url, token: token, completion: finish)
    }
  }

  private func callConfig(_ payload: [String: Any], _ completion: @escaping Completion) {
    guard let urlString = payload["url"] as? String, let url = URL(string: urlString) else {
      completion(nil, "A room URL is required")
      return
    }
    let token = (payload["token"] as? String).map { MeetingToken(stringValue: $0) }
    client.callConfigFor(url: url, token: token) { result in
      self.hop {
        switch result {
        case .success(let config): completion(callConfigJson(config), nil)
        case .failure(let error): completion(nil, error.localizedDescription)
        }
      }
    }
  }

  private func setInputs(_ payload: [String: Any], _ completion: @escaping Completion) {
    var values: [OutboundMediaType: Bool] = [:]
    if let camera = payload["camera"] as? Bool { values[.camera] = camera }
    if let microphone = payload["microphone"] as? Bool { values[.microphone] = microphone }
    client.setInputsEnabled(values) { result in self.finish(result, completion) { self.snapshot() } }
  }

  private func setPublishing(_ payload: [String: Any], _ completion: @escaping Completion) {
    var values: [OutboundMediaType: Bool] = [:]
    if let camera = payload["camera"] as? Bool { values[.camera] = camera }
    if let microphone = payload["microphone"] as? Bool { values[.microphone] = microphone }
    client.setIsPublishing(values) { result in self.finish(result, completion) { self.snapshot() } }
  }

  private func setAudioDevice(_ payload: [String: Any], _ completion: @escaping Completion) {
    guard let deviceId = payload["deviceId"] as? String, let device = AudioDeviceType(deviceID: deviceId) else {
      completion(nil, "Unknown audio device")
      return
    }
    client.set(preferredAudioDevice: device) { result in self.finish(result, completion) }
  }

  private func setSubscription(_ payload: [String: Any], _ completion: @escaping Completion) {
    guard let id = participant(payload["participantId"] as? String) else {
      completion(nil, "A participant id is required")
      return
    }
    if let stateName = payload["state"] as? String, let state = SubscriptionState(rawValue: stateName) {
      client.setSubscriptionState(for: id, state) { result in self.finish(result, completion) }
      return
    }
    var media: [InboundMediaType: SubscriptionState] = [:]
    if let value = payload["camera"] as? String, let state = SubscriptionState(rawValue: value) { media[.video] = state }
    if let value = payload["microphone"] as? String, let state = SubscriptionState(rawValue: value) { media[.audio] = state }
    if let value = payload["screenVideo"] as? String, let state = SubscriptionState(rawValue: value) { media[.screenVideo] = state }
    if let value = payload["screenAudio"] as? String, let state = SubscriptionState(rawValue: value) { media[.screenAudio] = state }
    client.setSubscriptionState(for: id, media) { result in self.finish(result, completion) }
  }

  private func setProfile(_ payload: [String: Any], _ completion: @escaping Completion) {
    guard let id = participant(payload["participantId"] as? String), let name = payload["profile"] as? String else {
      completion(nil, "A participant id and profile are required")
      return
    }
    guard let data = "\"\(name)\"".data(using: .utf8), let profile = try? JSONDecoder().decode(SubscriptionProfile.self, from: data) else {
      completion(nil, "Unknown subscription profile")
      return
    }
    client.setSubscriptionProfile(for: id, profile) { result in self.finish(result, completion) }
  }

  private func updateRemotes(_ payload: [String: Any], _ completion: @escaping Completion) {
    var updates: [ParticipantID: RemoteParticipantUpdate] = [:]
    for (key, value) in payload {
      guard let id = ParticipantID(uuidString: key), let body = value as? [String: Any] else { continue }
      var update = RemoteParticipantUpdate()
      if let permissionsJson = body["permissions"] as? [String: Any] {
        update.permissions = permissions(permissionsJson)
      }
      if let inputs = body["inputsEnabled"] as? [String: Any] {
        update.inputsEnabled = RemoteInputsEnabledUpdate(
          microphone: inputs["microphone"] as? Bool,
          camera: inputs["camera"] as? Bool
        )
      }
      updates[id] = update
    }
    client.updateRemoteParticipants(updates) { result in self.finish(result, completion) }
  }

  private func eject(_ payload: [String: Any], _ completion: @escaping Completion) {
    let ids = ((payload["ids"] as? [String]) ?? []).compactMap { ParticipantID(uuidString: $0) }
    client.ejectRemoteParticipants(ids) { result in self.finish(result, completion) }
  }

  private func sendMessage(_ payload: [String: Any], _ completion: @escaping Completion) {
    let message = (payload["message"] as? String) ?? ""
    let data = Data(message.utf8)
    let recipient: AppMessageRecipient
    if let to = payload["to"] as? String, let id = ParticipantID(uuidString: to) {
      recipient = .participant(id)
    } else {
      recipient = .all
    }
    client.sendAppMessage(json: data, to: recipient) { result in self.finish(result, completion) }
  }

  private func startLiveStream(_ payload: [String: Any], _ completion: @escaping Completion) {
    let endpoints: LiveStreamEndpoints
    if let names = payload["preconfigured"] as? [String] {
      endpoints = .preconfigured(PreconfiguredEndpoints(preconfiguredEndpoints: names))
    } else {
      let urls = ((payload["rtmpUrls"] as? [String]) ?? []).compactMap { URL(string: $0) }
      endpoints = .rtmpURLs(RTMPURLEndpoints(rtmpURLs: urls))
    }
    client.startLiveStream(endpoints: endpoints, streamID: streamId(payload["streamId"] as? String), forceNew: payload["forceNew"] as? Bool) { result in
      self.hop {
        switch result {
        case .success(let id): completion("{\"streamId\":\"\(id.uuidString)\"}", nil)
        case .failure(let error): completion(nil, error.localizedDescription)
        }
      }
    }
  }

  private func snapshot() -> String {
    let participants = client.participants
    let body: [String: Any] = [
      "callState": client.callState.rawValue,
      "participants": participantsJson(participants),
      "participantCounts": ["present": client.participantCounts.present, "hidden": client.participantCounts.hidden],
      "inputs": inputsJson(client.inputs),
      "publishing": publishingJson(client.publishing),
      "availableDevices": devicesJson(client.availableDevices),
      "audioDevice": client.audioDevice.deviceID,
    ]
    return stringify(body)
  }

  private func finish(
    _ result: Result<(), CallClientError>,
    _ completion: @escaping Completion,
    success: @escaping () -> String = { "{}" }
  ) {
    hop {
      switch result {
      case .success: completion(success(), nil)
      case .failure(let error): completion(nil, error.localizedDescription)
      }
    }
  }

  nonisolated private func hop(_ work: @escaping @MainActor () -> Void) {
    if Thread.isMainThread {
      MainActor.assumeIsolated(work)
    } else {
      DispatchQueue.main.async {
        MainActor.assumeIsolated(work)
      }
    }
  }

  private func emit(_ type: String, _ payload: [String: Any]) {
    DailyClientRegistry.shared.emit(clientId: clientId, type: type, payload: stringify(payload))
    if type == "participantJoined" || type == "participantUpdated" || type == "participantLeft" {
      DailyClientRegistry.shared.refreshHosts()
    }
  }

  nonisolated func callClient(_ callClient: CallClient, callStateUpdated state: CallState) {
    hop {
      DailyClientRegistry.shared.updateIdleTimer()
      self.emit("callStateUpdated", ["state": state.rawValue])
    }
  }

  nonisolated func callClient(_ callClient: CallClient, participantJoined participant: Participant) {
    hop {
      self.emit("participantJoined", participantJson(participant))
    }
  }

  nonisolated func callClient(_ callClient: CallClient, participantUpdated participant: Participant) {
    hop {
      self.emit("participantUpdated", participantJson(participant))
    }
  }

  nonisolated func callClient(_ callClient: CallClient, participantLeft participant: Participant, withReason reason: ParticipantLeftReason) {
    hop {
      self.emit("participantLeft", ["participant": participantJson(participant), "reason": reason.rawValue])
    }
  }

  nonisolated func callClient(_ callClient: CallClient, participantCountsUpdated participantCounts: ParticipantCounts) {
    hop {
      self.emit("participantCountsUpdated", ["present": participantCounts.present, "hidden": participantCounts.hidden])
    }
  }

  nonisolated func callClient(_ callClient: CallClient, activeSpeakerChanged activeSpeaker: Participant?) {
    hop {
      self.emit("activeSpeakerChanged", ["participant": activeSpeaker.map { participantJson($0) } ?? NSNull()])
    }
  }

  nonisolated func callClient(_ callClient: CallClient, inputsUpdated inputs: InputSettings) {
    hop {
      self.emit("inputsUpdated", inputsJson(inputs))
    }
  }

  nonisolated func callClient(_ callClient: CallClient, publishingUpdated publishing: PublishingSettings) {
    hop {
      self.emit("publishingUpdated", publishingJson(publishing))
    }
  }

  nonisolated func callClient(_ callClient: CallClient, availableDevicesUpdated availableDevices: Devices) {
    hop {
      self.emit("availableDevicesUpdated", devicesJson(availableDevices))
    }
  }

  nonisolated func callClient(_ callClient: CallClient, error: CallClientError) {
    hop {
      self.emit("error", ["message": error.localizedDescription])
    }
  }

  nonisolated func callClient(_ callClient: CallClient, appMessageAsJson jsonData: Data, from participantID: ParticipantID) {
    hop {
      self.emit("appMessage", ["message": String(data: jsonData, encoding: .utf8) ?? "", "from": participantID.uuidString])
    }
  }

  nonisolated func callClient(_ callClient: CallClient, appMessageFromRestApiAsJson jsonData: Data) {
    hop {
      self.emit("appMessageFromRestApi", ["message": String(data: jsonData, encoding: .utf8) ?? ""])
    }
  }

  nonisolated func callClient(_ callClient: CallClient, networkStatsUpdated networkStats: NetworkStats) {
    hop {
      self.emit("networkStatsUpdated", [
        "quality": networkStats.quality,
        "threshold": networkStats.threshold.rawValue,
        "previousThreshold": networkStats.previousThreshold?.rawValue ?? NSNull(),
      ])
    }
  }

  nonisolated func callClient(_ callClient: CallClient, networkConnectionStatusUpdated status: NetworkConnectionStatusUpdate) {
    hop {
      let description: String
      if let data = try? JSONEncoder().encode(status),
         let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
         let encoded = json["description"] as? String {
        description = encoded
      } else if let data = try? JSONEncoder().encode(status),
                let string = String(data: data, encoding: .utf8) {
        description = string
      } else {
        description = "{}"
      }
      self.emit("networkConnectionStatusUpdated", ["description": description])
    }
  }

  nonisolated func callClient(_ callClient: CallClient, localAudioLevel audioLevel: Float) {
    hop {
      self.emit("localAudioLevel", ["audioLevel": audioLevel])
    }
  }

  nonisolated func callClient(_ callClient: CallClient, remoteParticipantsAudioLevel participantsAudioLevel: [ParticipantID: Float]) {
    hop {
      var levels: [String: Float] = [:]
      participantsAudioLevel.forEach { levels[$0.key.uuidString] = $0.value }
      self.emit("remoteParticipantsAudioLevel", levels)
    }
  }

  nonisolated func callClient(_ callClient: CallClient, subscriptionsUpdated subscriptions: SubscriptionSettingsByID) {
    hop {
      var body: [String: Any] = [:]
      for id in subscriptions.keys {
        guard let settings = subscriptions[id] else { continue }
        body[id.uuidString] = [
          "profile": settings.profile.stringValue,
          "media": mediaSubscriptionJson(settings.media),
        ]
      }
      self.emit("subscriptionsUpdated", body)
    }
  }

  nonisolated func callClient(_ callClient: CallClient, subscriptionProfilesUpdated subscriptionProfiles: SubscriptionProfileSettingsByProfile) {
    hop {
      var body: [String: Any] = [:]
      for profile in subscriptionProfiles.keys {
        guard let settings = subscriptionProfiles[profile] else { continue }
        body[profile.stringValue] = mediaSubscriptionJson(settings)
      }
      self.emit("subscriptionProfilesUpdated", body)
    }
  }

  nonisolated func callClient(_ callClient: CallClient, recordingStartedWithStatus status: RecordingStatus) {
    hop {
      self.emit("recordingStarted", ["streamId": status.streamID.uuidString])
    }
  }

  nonisolated func callClient(_ callClient: CallClient, recordingStoppedForStreamWithID streamID: StreamID) {
    hop {
      self.emit("recordingStopped", ["streamId": streamID.uuidString])
    }
  }

  nonisolated func callClient(_ callClient: CallClient, recordingError error: String, forStreamWithID streamID: StreamID) {
    hop {
      self.emit("recordingError", ["streamId": streamID.uuidString, "message": error])
    }
  }

  nonisolated func callClient(_ callClient: CallClient, liveStreamStartedWithStatus status: LiveStreamStatus) {
    hop {
      self.emit("liveStreamStarted", ["streamId": status.streamID.uuidString])
    }
  }

  nonisolated func callClient(_ callClient: CallClient, liveStreamStoppedForStreamWithID streamID: StreamID) {
    hop {
      self.emit("liveStreamStopped", ["streamId": streamID.uuidString])
    }
  }

  nonisolated func callClient(_ callClient: CallClient, liveStreamError error: String, forStreamWithID streamID: StreamID) {
    hop {
      self.emit("liveStreamError", ["streamId": streamID.uuidString, "message": error])
    }
  }

  nonisolated func callClient(_ callClient: CallClient, liveStreamWarning warning: String, forStreamWithID streamID: StreamID) {
    hop {
      self.emit("liveStreamWarning", ["streamId": streamID.uuidString, "message": warning])
    }
  }

  nonisolated func callClient(_ callClient: CallClient, transcriptionStarted status: TranscriptionStatus) {
    hop {
      self.emit("transcriptionStarted", ["started": true])
    }
  }

  nonisolated func callClient(_ callClient: CallClient, transcriptionStoppedBy trigger: TranscriptionStopTrigger?) {
    hop {
      self.emit("transcriptionStopped", ["stoppedByError": trigger != nil])
    }
  }

  nonisolated func callClient(_ callClient: CallClient, transcriptionMessage: TranscriptionMessage) {
    hop {
      self.emit("transcriptionMessage", [
        "participantId": transcriptionMessage.participantID.uuidString,
        "text": transcriptionMessage.text,
        "timestamp": ISO8601DateFormatter().string(from: transcriptionMessage.timestamp),
      ])
    }
  }

  nonisolated func callClient(_ callClient: CallClient, transcriptionError error: String) {
    hop {
      self.emit("transcriptionError", ["message": error])
    }
  }

  nonisolated func callClientDidDetectStartOfSystemBroadcast(_ callClient: CallClient) {
    hop {
      self.emit("systemBroadcastStarted", [:])
    }
  }

  nonisolated func callClientDidDetectEndOfSystemBroadcast(_ callClient: CallClient) {
    hop {
      self.emit("systemBroadcastStopped", [:])
    }
  }
}

private func callConfigJson(_ config: CallConfiguration) -> String {
  let permissions = config.permissionsOnJoin
  let base = permissions.canReceive.base
  let body: [String: Any] = [
    "roomName": config.roomName,
    "isOwner": config.isOwner,
    "initialCameraEnabled": config.initialCameraEnabled,
    "initialMicrophoneEnabled": config.initialMicrophoneEnabled,
    "recordingMode": recordingModeName(config.recordingMode),
    "ejectAtRoomExpiration": config.ejectAtRoomExpiration,
    "ejectAtTokenExpiration": config.ejectAtTokenExpiration,
    "terseLoggingEnabled": config.terseLoggingEnabled,
    "initialUserName": config.initialUserName ?? NSNull(),
    "userId": config.userID ?? NSNull(),
    "roomExpiration": config.roomExpiration ?? NSNull(),
    "tokenExpiration": config.tokenExpiration ?? NSNull(),
    "roomNotBefore": config.roomNotBefore ?? NSNull(),
    "tokenNotBefore": config.tokenNotBefore ?? NSNull(),
    "permissionsOnJoin": [
      "hasPresence": permissions.hasPresence,
      "canSend": permissions.canSend.map { $0.rawValue },
      "canAdmin": permissions.canAdmin.map { $0.rawValue },
      "canReceive": [
        "base": [
          "camera": base.camera,
          "microphone": base.microphone,
          "screenVideo": base.screenVideo,
          "screenAudio": base.screenAudio,
        ],
      ],
    ],
  ]
  return stringify(body)
}

private func recordingModeName(_ mode: RecordingMode) -> String {
  switch mode {
  case .cloud: return "cloud"
  case .cloudAudioOnly: return "cloud-audio-only"
  case .rawTracks: return "raw-tracks"
  case .local: return "local"
  case .off: return "off"
  }
}

private func mediaSubscriptionJson(_ media: MediaSubscriptionSettings) -> [String: String] {
  [
    "camera": media.camera.subscriptionState.rawValue,
    "microphone": media.microphone.subscriptionState.rawValue,
  ]
}

private func jsonObject(_ raw: String) -> [String: Any] {
  guard let data = raw.data(using: .utf8),
        let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
    return [:]
  }
  return object
}

private func stringify(_ object: Any) -> String {
  guard JSONSerialization.isValidJSONObject(object),
        let data = try? JSONSerialization.data(withJSONObject: object),
        let string = String(data: data, encoding: .utf8) else {
    return "{}"
  }
  return string
}

private func participant(_ id: String?) -> ParticipantID? {
  guard let id else { return nil }
  return ParticipantID(uuidString: id)
}

private func streamId(_ id: String?) -> StreamID? {
  guard let id else { return nil }
  return StreamID(uuidString: id)
}

private func interval(_ payload: [String: Any]) -> UInt64? {
  let value = (payload["intervalMs"] as? NSNumber)?.uint64Value ?? 0
  return value == 0 ? nil : value
}

private func permissions(_ json: [String: Any]) -> ParticipantPermissionsUpdate {
  let canSend = (json["canSend"] as? [String])?.compactMap { CanSendPermission(rawValue: $0) }
  return ParticipantPermissionsUpdate(
    hasPresence: json["hasPresence"] as? Bool,
    canSend: canSend.map { Set($0) }
  )
}

private func iceConfig(_ json: [String: Any]?) -> IceConfig? {
  guard let servers = json?["iceServers"] as? [[String: Any]] else { return nil }
  let iceServers = servers.map { server in
    IceServers(
      username: server["username"] as? String,
      credential: server["credential"] as? String,
      urls: server["urls"] as? [String] ?? []
    )
  }
  return IceConfig(iceServers: iceServers)
}

private func preconfigured(_ payload: [String: Any]) -> PreconfiguredEndpoints? {
  guard let names = payload["preconfigured"] as? [String] else { return nil }
  return PreconfiguredEndpoints(preconfiguredEndpoints: names)
}

private func transcription(_ payload: [String: Any]) -> TranscriptionSettings {
  TranscriptionSettings(
    language: payload["language"] as? String,
    model: payload["model"] as? String,
    profanityFilter: payload["profanityFilter"] as? Bool,
    punctuate: payload["punctuate"] as? Bool,
    includeRawResponse: payload["includeRawResponse"] as? Bool
  )
}

private func participantJson(_ participant: Participant) -> [String: Any] {
  let info: [String: Any] = [
    "isLocal": participant.info.isLocal,
    "isOwner": participant.info.isOwner,
    "userId": participant.info.userID ?? NSNull(),
    "userName": participant.info.username ?? NSNull(),
  ]
  var body: [String: Any] = [
    "id": participant.id.uuidString,
    "info": info,
  ]
  if let media = participant.media {
    body["media"] = [
      "camera": trackJson(media.camera),
      "microphone": trackJson(media.microphone),
      "screenVideo": trackJson(media.screenVideo),
      "screenAudio": trackJson(media.screenAudio),
    ]
  } else {
    body["media"] = NSNull()
  }
  return body
}

private func participantsJson(_ participants: Participants) -> [String: Any] {
  var all: [String: Any] = [:]
  participants.all.forEach { all[$0.key.uuidString] = participantJson($0.value) }
  return ["local": participantJson(participants.local), "all": all]
}

private func trackJson(_ info: ParticipantVideoInfo) -> [String: String] {
  ["state": mediaState(info.state), "subscribed": info.subscribed.rawValue]
}

private func trackJson(_ info: ParticipantAudioInfo) -> [String: String] {
  ["state": mediaState(info.state), "subscribed": info.subscribed.rawValue]
}

private func mediaState(_ state: MediaState) -> String {
  switch state {
  case .blocked: return "blocked"
  case .off: return "off"
  case .receivable: return "receivable"
  case .loading: return "loading"
  case .playable: return "playable"
  case .interrupted: return "interrupted"
  }
}

private func inputsJson(_ inputs: InputSettings) -> [String: Any] {
  [
    "camera": ["isEnabled": inputs.camera.isEnabled],
    "microphone": ["isEnabled": inputs.microphone.isEnabled],
    "screenVideo": ["isEnabled": inputs.screenVideo.isEnabled],
  ]
}

private func publishingJson(_ publishing: PublishingSettings) -> [String: Any] {
  [
    "camera": ["isPublishing": publishing.camera.isPublishing],
    "microphone": ["isPublishing": publishing.microphone.isPublishing],
    "screenVideo": ["isPublishing": publishing.screenVideo.isPublishing],
  ]
}

private func devicesJson(_ devices: Devices) -> [String: Any] {
  func list(_ devices: [Device]) -> [[String: String]] {
    devices.map { ["deviceId": $0.deviceID, "groupId": $0.groupID, "kind": $0.kind.rawValue, "label": $0.label] }
  }
  return [
    "camera": list(devices.camera),
    "microphone": list(devices.microphone),
    "speaker": list(devices.speaker),
    "audio": list(devices.audio),
  ]
}
