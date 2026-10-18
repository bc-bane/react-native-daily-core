# Migrating from `@daily-co/react-native-daily-js` to react-native-daily-core

`react-native-daily-core` is a separate package. It is not a new version of [`@daily-co/react-native-daily-js`](https://github.com/daily-co/react-native-daily-js). That library stays Daily's React Native client and continues to wrap `daily-js`. This one implements `CallClient` on the Daily iOS and Android SDKs.

This package requires React Native 0.82 or newer. React Native 0.82 is New Architecture only, and there is no legacy bridge. Web apps stay on `daily-js`. React Native code that used to share a `DailyCall` with web has to call `CallClient` instead.

## Install

Remove the packages the daily-js wrapper needed:

- `@daily-co/react-native-webrtc` (install it with `--save-exact` today; delete that dependency)
- `@react-native-async-storage/async-storage`, unless your own app uses it
- `react-native-background-timer`
- `react-native-get-random-values`

`base-64` and `react-native-url-polyfill` were dependencies of `@daily-co/react-native-daily-js`. This package does not install them. Add them yourself only if your app imported them.

```bash
npm uninstall @daily-co/react-native-daily-js @daily-co/react-native-webrtc @react-native-async-storage/async-storage react-native-background-timer react-native-get-random-values
npm install react-native-daily-core
```

Peer dependencies are `react` >= 19 and `react-native` >= 0.82 (New Architecture). This package depends on `react-native-nitro-modules`, so the app does not install that package itself. The example app uses Expo SDK 58 (React Native 0.88).

### iOS Podfile

The old install set the app platform to iOS 12 because of `react-native-webrtc`, or iOS 14 when the app sent a screen share:

```ruby
platform :ios, '12.0'
```

The Daily iOS SDK supports iOS 14. This package’s podspec requires iOS 16.4, which matches Expo SDK 58. Set the app platform to at least 16.4:

```ruby
platform :ios, '16.4'
```

Do not add `pod 'Daily'` or `pod 'DailySystemBroadcast'` to the app target. This package's podspec depends on both at 0.40.0, and autolinking pulls them in. Run `pod install` after upgrading.

Remove the `ReactNativeDailyJSScreenShareExtension` target and the setup from [rn-screen-share-extension](https://github.com/daily-co/rn-screen-share-extension/). Android screen share is `startScreenShare()` while the app is in the foreground. iOS screen share is one command from the app root, then `pod install`:

```bash
npx react-native-daily-core setup-ios-screen-share
cd ios && pod install
```

That adds the broadcast upload extension and an App Group of `group.<bundle id>`. Confirm the App Group for that bundle id in Signing & Capabilities. The command also adds `DailySystemBroadcast` to the extension target only.

`Info.plist` is unchanged: `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, and `UIBackgroundModes` = `voip`.

### Android

`minSdkVersion` stays 24. The library manifest merges camera, microphone, wake lock, notifications, and the ongoing-call foreground service (`DailyOngoingMeetingForegroundService`, including `mediaProjection`). You can delete the copy of that `<service>` and those `<uses-permission>` entries from the app manifest if they only existed for this package.

React Native 0.82 and newer have no legacy architecture switch.

## Expo apps and vanilla React Native apps

`CallClient` and `VideoView` are implemented with [Nitro Modules](https://nitro.margelo.com/). JavaScript uses JSI HybridObjects and a Nitro HybridView. `react-native-nitro-modules` is a dependency of this package. You do **not** need `expo-modules-core` or `npx install-expo-modules` for this library.

**Vanilla React Native.**

```bash
npm install react-native-daily-core
cd ios && pod install
```

Rebuild both apps. The config plugin is optional and only applies to Expo prebuild. In a vanilla app, set `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, and `UIBackgroundModes` = `voip` in `Info.plist` yourself. The Android library manifest merges the call permissions.

**Expo app.** Add the config plugin in `app.json` (or `app.config.js`):

```json
{
  "plugins": ["react-native-daily-core"]
}
```

Then prebuild or run `npx expo run:ios` / `npx expo run:android`. The plugin writes the usage strings and Android permissions.

### Monorepo / local package install

With **pnpm**, use a **`link:`** dependency to the library root so `ios/`, `android/`, and `nitro.json` are present:

```json
"react-native-daily-core": "link:../../../AltCode/react-native-daily-js"
```

Add the library path to Metro **`watchFolders`** when it lives outside the app repo. The example sets `experiments.autolinkingModuleResolution` so Metro resolves this package from the app, not from a second copy of `react-native` inside the library.

### Expo config plugin (managed / prebuild)

`@daily-co/config-plugin-rn-daily-js` configured the WebRTC stack and the old screen-share extension. Do not use it with this package. The config plugin shipped here is `app.plugin.js`. It adds the camera and microphone usage strings, the iOS `voip` background mode, and the Android call permissions.

## What you import

```ts
// daily-js wrapper
import Daily, {DailyMediaView} from '@daily-co/react-native-daily-js';
import {mediaDevices, RTCView} from '@daily-co/react-native-daily-js';

// CallClient
import {CallClient, VideoView} from 'react-native-daily-core';
```

`Daily`, `DailyMediaView`, and every `react-native-webrtc` re-export (`mediaDevices`, `RTCView`, `RTCPeerConnection`, `MediaStream`, `MediaStreamTrack`, `registerGlobals`) are gone. Importing this package no longer installs WebRTC or browser globals.

## Call setup

```ts
const call = Daily.createCallObject();
await call.join({url, token});
await call.destroy();
```

becomes:

```ts
const call = await CallClient.create();
await call.join({
  url,
  token,
  clientSettings: {camera: true, microphone: true},
});
await call.leave();
call.release();
```

`leave()` only leaves the room. `release()` frees the native client. `destroy()` did both.

`Daily.getCallInstance()` is gone. There is no singleton. More than one `CallClient` can exist. The camera is still exclusive to one of them. `isDestroyed()` is gone; don't use a client after `release()`.

`join` no longer accepts `startVideoOff`, `startAudioOff`, `subscribeToTracksAutomatically`, or a daily-js `DailyCallOptions` object. Camera and microphone start state go in `clientSettings`.

## Participant fields

`participants()` is still synchronous. The object is not a daily-js participant.

| daily-js | CallClient |
| --- | --- |
| `participant.local` | `participant.info.isLocal` |
| `participant.user_name` | `participant.info.userName` |
| `participant.user_id` | `participant.info.userId` |
| `participant.owner` | `participant.info.isOwner` |
| `participant.session_id` | `participant.id` |
| `participant.videoTrack` / `tracks.video` | `participant.media.camera` (`state`, `subscribed`). No `MediaStreamTrack`. |
| `participant.audioTrack` / `tracks.audio` | `participant.media.microphone`. Audio plays inside the SDK. |
| `participant.screenVideoTrack` | `participant.media.screenVideo` |
| `participant.tracks.screenAudio` | `participant.media.screenAudio` |
| `participants.local` | `participants().local` |
| `participants[sessionId]` | `participants().all[id]` |

`meetingState()` is `callState()`. The values change:

| `meetingState()` | `callState()` |
| --- | --- |
| `new` | `initialized` |
| `joining-meeting` | `joining` |
| `joined-meeting` | `joined` |
| `left-meeting` | `left` |
| `loading`, `loaded`, `error` | no equivalent. Errors arrive on the `error` event. |

`participantCounts()` remains, with `present` and `hidden`.

## Events

Listeners move off daily-js kebab-case strings. There is no `action` field on the payload.

| daily-js `on('...')` | `call.on('...')` |
| --- | --- |
| `joining-meeting` | `callStateUpdated` with `state: 'joining'` |
| `joined-meeting` | `callStateUpdated` with `state: 'joined'` |
| `left-meeting` | `callStateUpdated` with `state: 'left'` |
| `participant-joined` | `participantJoined` (payload is the participant) |
| `participant-updated` | `participantUpdated` |
| `participant-left` | `participantLeft` (`{participant, reason}`) |
| `participant-counts-updated` | `participantCountsUpdated` |
| `active-speaker-change` | `activeSpeakerChanged` (`{participant}`) |
| `app-message` | `appMessage` (`{message, from}`) |
| `error` | `error` (`{message}`) |
| `network-connection` | `networkConnectionStatusUpdated` |
| `network-quality-change` | `networkStatsUpdated` |
| `recording-started` | `recordingStarted` (`{streamId}`) |
| `recording-stopped` | `recordingStopped` |
| `recording-error` | `recordingError` |
| `live-streaming-started` | `liveStreamStarted` |
| `live-streaming-stopped` | `liveStreamStopped` |
| `live-streaming-error` | `liveStreamError` |
| `transcription-started` | `transcriptionStarted` |
| `transcription-stopped` | `transcriptionStopped` |
| `transcription-message` | `transcriptionMessage` |
| `transcription-error` | `transcriptionError` |
| `available-devices-updated` | `availableDevicesUpdated` |
| `local-audio-level` | `localAudioLevel` |
| `remote-participants-audio-level` | `remoteParticipantsAudioLevel` |
| `send-settings-updated` | `publishingUpdated` |
| `receive-settings-updated` | `subscriptionsUpdated` |
| `local-screen-share-started` / `stopped` | `publishingUpdated`, and on iOS `systemBroadcastStarted` / `systemBroadcastStopped` |

`track-started` and `track-stopped` are gone. Read `participant.media` from `participantUpdated`.

These events are gone because the feature is gone: `loading`, `loaded`, `load-attempt-failed`, `started-camera`, `camera-error`, `call-instance-destroyed`, `nonfatal-error`, `recording-stats`, `test-completed`, `cpu-load-change`, `access-state-updated`, `waiting-participant-added`, `waiting-participant-updated`, `waiting-participant-removed`, `meeting-session-summary-updated`, `meeting-session-state-updated`, `remote-media-player-started`, `remote-media-player-stopped`, `remote-media-player-updated`, `live-streaming-updated`, `dialin-*`, `dialout-*`.

## Methods that moved

| daily-js | CallClient |
| --- | --- |
| `setLocalAudio(false)` | `setInputsEnabled({microphone: false})` |
| `setLocalVideo(false)` | `setInputsEnabled({camera: false})` |
| `localAudio()` / `localVideo()` | `inputs().microphone.isEnabled` / `inputs().camera.isEnabled` |
| `localScreenVideo()` / `localScreenAudio()` | `inputs().screenVideo` and `publishing().screenVideo` |
| `updateInputSettings` | `setInputsEnabled` or `updateInputs` |
| `updateSendSettings` / `getSendSettings` | `setIsPublishing` / `updatePublishing` / `publishing()` |
| `updateReceiveSettings` / `getReceiveSettings` | `setSubscriptionState(participantId, {camera: 'unsubscribed'})` |
| `setSubscribeToTracksAutomatically` | removed. Set each participant with `setSubscriptionState` or `setSubscriptionProfile`. |
| `startScreenShare` / `stopScreenShare` | same names. `updateScreenShare` is removed. |
| `setAudioDevice` | `setAudioDevice(deviceId)` |
| `enumerateDevices` / `getInputDevices` | `availableDevices()` |
| `setCameraTorch` / `setCameraZoom` | same names |
| `setUserName` | `setUserName` |
| `setProxyUrl` / `setIceConfig` | same names. Both return promises. |
| `sendAppMessage(data, to)` | `sendAppMessage(message, to)`. `to` is one participant id. An array of recipients is not accepted. |
| `startLocalAudioLevelObserver` / `stopLocalAudioLevelObserver` | same names |
| `startRemoteParticipantsAudioLevelObserver` / `stopRemoteParticipantsAudioLevelObserver` | same names |
| `getLocalAudioLevel` | `localAudioLevel()` |
| `getRemoteParticipantsAudioLevel` | `remoteParticipantsAudioLevel()` |
| `getNetworkStats` | `networkStats()` |
| `room` / `preAuth` / `load` | `callConfigFor(url, token)` |
| `updateParticipant` / `updateParticipants` | `updateRemoteParticipants` |
| `startRecording` / `updateRecording` / `stopRecording` | same names. `instanceId` is `streamId`. Layout and streaming-option objects from daily-js are not accepted. `startRecording` resolves to the stream id. |
| `startLiveStreaming` | `startLiveStream({rtmpUrls, preconfigured, streamId, forceNew})` |
| `updateLiveStreaming` | `updateLiveStream({streamId})` |
| `stopLiveStreaming` | `stopLiveStream(streamId)` |
| `addLiveStreamingEndpoints` / `removeLiveStreamingEndpoints` | same names. Only preconfigured endpoints are accepted. An RTMP URL cannot be added or removed on a stream that is already running. |
| `startTranscription` / `stopTranscription` | same names |
| `participants` / `participantCounts` / `activeSpeaker` | `participants()` / `participantCounts()` / `activeSpeaker()` |

To stop sending a track while leaving the camera on, call `setIsPublishing({camera: false})`. `setInputsEnabled({camera: false})` turns the camera off.

## Rendering

```tsx
<DailyMediaView videoTrack={participant.videoTrack} mirror={participant.local} />
```

becomes:

```tsx
<VideoView
  client={call}
  participantId={participant.id}
  videoSource="camera"
  mirror={participant.info.isLocal}
  objectFit="cover"
/>
```

Screen share video uses `videoSource="screenVideo"`. There is no audio view. `objectFit` is `"cover"` or `"contain"`.

## Removed

These daily-js methods are not on the iOS or Android `CallClient` in SDK 0.40.0, so they are not in this package. Owner actions that Daily exposes on the REST API, such as starting a dial-out, belong on your backend.

- `startDialOut`, `stopDialOut`, `startDialIn`, `sendDTMF`, `sipCallTransfer`, `sipRefer`
- `waitingParticipants`, `updateWaitingParticipant`, `updateWaitingParticipants`, `requestAccess`, `accessState`
- `startRemoteMediaPlayer`, `stopRemoteMediaPlayer`, `updateRemoteMediaPlayer`
- `testWebsocketConnectivity`, `abortTestWebsocketConnectivity`, `testNetworkConnectivity`, `abortTestNetworkConnectivity`, `testPeerToPeerCallQuality`, `stopTestPeerToPeerCallQuality`, `getCpuLoadStats`
- `meetingSessionSummary`, `meetingSessionState`, `setMeetingSessionData`
- `setUserData`
- `geo`
- `updateTranscription`
- `setNativeInCallAudioMode`, `nativeInCallAudioMode`
- `startCamera`
- `cycleCamera`, `setCamera`, `getCameraFacingMode`
- `getCameraZoom`, `isCameraTorchAvailable`
- `isLocalAudioLevelObserverRunning`, `isRemoteParticipantsAudioLevelObserverRunning`
- `supportedBrowser`
- iframe and prebuilt methods (`load`, `join` with a Daily Prebuilt iframe, `startCamera` as a prejoin step)

`reactNativeConfig.disableAutoDeviceManagement` is not reimplemented. The native SDK owns the audio session and does not expose that switch.

## Pre-merge QA (mobile video call)

Run on **iOS and Android** for **Tinker** and **TechTalk** before merging a `react-native-daily-core` upgrade. Web (`@daily-co/daily-js`) is unchanged.

### Build / install smoke

1. `pnpm install` at monorepo root (use **`link:`** to the library so the Expo module sources are present).
2. Confirm the app config lists the `react-native-daily-core` plugin, then prebuild or run the Expo native build.
3. Android: clean rebuild after a dependency change.

### Runtime matrix

| Area | What to verify |
| --- | --- |
| Join | Enter a scheduled or matched call; remote and local video render. |
| Audio / video | Mute and unmute mic; turn camera off and on; flip camera (where supported). |
| Chat | Send and receive in-call app messages; remote participant list updates. |
| Leave | End call from in-call UI; no crash; `leave()` + `release()` cleanup. |
| Home tab | After leave, no stale “rejoin” state; active call batch id clears; can start a new request. |
| Background | Optional: brief background/foreground during call; AV recovers or fails gracefully. |
| TechTalk | Same join/leave path via shared `VideoCall` layout. |

If Nitro fails at runtime (for example `NitroModules.createHybridObject` throws), confirm New Architecture is enabled and you ran `pod install` plus a clean native rebuild after upgrading. `react-native-nitro-modules` is installed with this package.
