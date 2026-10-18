# react-native-daily-core

A React Native `CallClient` for Daily, implemented on the official iOS and Android SDKs. It is a separate library from [`@daily-co/react-native-daily-js`](https://github.com/daily-co/react-native-daily-js), which wraps `daily-js`. This package does not import `daily-js` or `react-native-webrtc`.

The API follows [daily-client-ios](https://reference-ios.daily.co/documentation/daily/callclient), [daily-client-android](https://reference-android.daily.co/daily-android/co.daily/-call-client/index.html), and `daily-flutter`.

Install it in a React Native app that already has `ios/` and `android/` projects. Native bindings use [Nitro Modules](https://nitro.margelo.com/), which this package depends on. Requires React Native 0.82 or newer with the New Architecture enabled.

## Why this library exists

[`@daily-co/react-native-daily-js`](https://github.com/daily-co/react-native-daily-js) runs Daily’s JavaScript client and a pinned [`react-native-webrtc`](https://github.com/react-native-webrtc/react-native-webrtc) fork inside React Native. That works, but it is not the same stack Daily ships for native mobile. Daily built [iOS and Android SDKs on a shared Rust core](https://www.daily.co/blog/introducing-dailys-native-mobile-libraries/) (`daily-core`) so call logic stays consistent and new features land on every platform together—see [How and why Daily is using Rust](https://www.daily.co/blog/how-and-why-daily-is-using-rust-for-our-webrtc-api-platform/) for why they moved away from “load `daily-js` in a WebView or JS runtime” as the mobile story.

**react-native-daily-core** is a thin React Native layer on those official SDKs (`CallClient`, native `VideoView`). You get the same API shape as Swift, Kotlin, and Flutter, without bundling the call-machine JavaScript or WebRTC polyfills.

In practice that means:

- **Native media path** — Video renders in the SDK’s `VideoView`; audio plays inside the SDK. Less work on the JS thread and no `MediaStreamTrack` plumbing through the bridge.
- **Same releases as mobile SDKs** — You depend on `Daily` / `co.daily:client` (currently 0.40.0), including current libwebrtc, Android [16 KB page-size](https://developer.android.com/guide/practices/page-sizes)–aligned binaries, and fixes that apply to native clients first.
- **iOS-only capabilities** — Features such as [Daily Adaptive HEVC](https://www.daily.co/blog/introducing-daily-adaptive-hevc-for-ios-native-video/) (hardware H.265 plus H.264 fallback for cross-platform calls) live in the native iOS SDK, not in `daily-js`. This package is the path to use that stack from React Native when you expose the native publishing APIs you need.
- **Simpler install** — No `@daily-co/react-native-webrtc`, background timer, or get-random-values peers. Android screen share is `startScreenShare()`. iOS screen share is one setup command, then the same call.

Web apps should keep using [`daily-js`](https://docs.daily.co/reference/daily-js). Use this library when your React Native app should behave like a Daily native mobile client. For API differences from the old wrapper, see [MIGRATION.md](MIGRATION.md).

## Requirements

- Node >= 22.13 (see `.nvmrc`)
- React Native >= 0.82 with New Architecture enabled
- `react-native-nitro-modules` 0.37.1 (installed with this package)
- iOS deployment target >= 16.4
- Android `minSdkVersion` >= 24
- Android Gradle Plugin 8.5.1 or newer and NDK r28 or newer when you compile native code
- `co.daily:client` 0.40.0 (pulled in by this package) and the `Daily` 0.40.0 CocoaPod

## Installation

```bash
npm install react-native-daily-core
cd ios && pod install
```

Rebuild the iOS and Android apps. Autolinking includes this package and its Nitro dependency. Set permissions in the app:

- `Info.plist`: `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, and `UIBackgroundModes` = `voip` when audio should continue in the background
- Android: the library manifest already merges camera, microphone, notification, and foreground-service permissions

Screen sharing does not require the Daily native installation guides.

On Android, call `startScreenShare()` while the app is in the foreground. This package merges the media-projection permission and foreground service, and it handles the capture permission result.

On iOS, ReplayKit needs a broadcast upload extension in the app target. From the app root, run this once:

```bash
npx react-native-daily-core setup-ios-screen-share
cd ios && pod install
```

The command adds a `DailyScreenCaptureExtension` target, an App Group of `group.<bundle id>`, and the Info.plist keys `startScreenShare()` reads. Confirm that App Group exists for the bundle id in Xcode (**Signing & Capabilities**) or the Apple Developer portal. Signing uses the development team already set on the app target. Then call `startScreenShare()`.

Apps moving off `@daily-co/react-native-daily-js` should read [MIGRATION.md](MIGRATION.md). That package remains Daily's maintained React Native client.

Setup guides: [iOS installation](https://docs.daily.co/docs/ios/installation), [Android installation](https://docs.daily.co/docs/android/installation).

## Lifecycle

Construct a client with `CallClient.create()`, join a room, read getters, subscribe with `on`, call `leave()` to reuse the same client, and `release()` when you are done with the native instance. `leave()` does not destroy the client; `release()` does. Do not use a client after `release()`.

`participants().local` is always an object while the client exists (including after `leave`). Subscription objects on `subscriptions()` describe camera and microphone profile state; screen subscribe state lives on `participant.media`.

```tsx
import {CallClient, VideoView, useCallState, useParticipants} from 'react-native-daily-core';

const call = await CallClient.create();

call.on('participantJoined', () => {
  console.log(call.participants());
});

await call.join({url: 'https://your-team.daily.co/hello'});

await call.setInputsEnabled({microphone: false});

<VideoView client={call} participantId={participant.id} videoSource="camera" />;

await call.leave();
call.release();
```

For React Compiler–friendly function components, use `useCallState(call)` and `useParticipants(call)` instead of reading `call.callState()` or `call.participants()` during render.

Native failures reject the promise with an `Error` message. Android screen share with no foreground activity rejects with `Screen share needs a foreground activity`.

## Exports

- `CallClient` — call session (class)
- `VideoView` — native video renderer
- `useCallState`, `useParticipants`, `useRemoteParticipants` — React hooks over the cache
- Types in `src/types.ts` (re-exported from the package)

`@daily-co/react-native-daily-js` APIs that are not here include `Daily.createCallObject`, `DailyMediaView`, `setLocalAudio`, and `setLocalVideo`. See [MIGRATION.md](MIGRATION.md).

Features not shipped in this package (absent from both native SDKs at 0.40.0) are listed under **Not shipped** in [docs/native-api.md](docs/native-api.md) (dial-in/out, waiting room, custom track injection, and similar).

---

## CallClient reference

Native parity: [iOS CallClient](https://reference-ios.daily.co/documentation/daily/callclient) · [Android CallClient](https://reference-android.daily.co/daily-android/co.daily/-call-client/index.html)

### Construction

| API | Description |
| --- | --- |
| `CallClient.create()` | Creates the native client on the main thread, seeds the JavaScript cache from a snapshot, and returns `CallClient`. |

### Lifecycle and room

| Method / getter | Arguments | Returns | Cache / events |
| --- | --- | --- | --- |
| `join(options)` | `url`, optional `token`, optional `clientSettings` | `Promise<void>` | Snapshot after join updates getters. Also `callStateUpdated`, participant events. |
| `leave()` | — | `Promise<void>` | Refetches participants via snapshot; does not clear subscriptions. |
| `release()` | — | `void` | Destroys native client; later `perform` throws. |
| `callState()` | — | `CallState` | `callStateUpdated` |
| `callConfigFor(url, token?)` | Room URL and optional token | `Promise<CallConfiguration>` | Does not mutate cache. |

### Participants

| Method / getter | Returns | Events |
| --- | --- | --- |
| `participants()` | `{ local, all }` | `participantJoined`, `participantUpdated`, `participantLeft`, join/leave snapshots |
| `participantCounts()` | counts | `participantCountsUpdated` |
| `activeSpeaker()` | `Participant \| null` | `activeSpeakerChanged` |

`participantLeft` includes `reason` when the platform sends it (`hidden`, `leftCall` on iOS).

### Inputs, publishing, devices

| Method / getter | Notes |
| --- | --- |
| `inputs()`, `publishing()` | Updated by snapshots and `inputsUpdated` / `publishingUpdated`. |
| `setInputsEnabled({ camera?, microphone? })` | Native SDK: [iOS](https://reference-ios.daily.co/documentation/daily/callclient/setinputsenabled(_:completion:)) · [Android](https://reference-android.daily.co/daily-android/co.daily/-call-client/set-inputs-enabled.html) |
| `setIsPublishing({ camera?, microphone? })` | Same pattern as inputs. |
| `setCameraTorch(enabled)`, `setCameraZoom(ratio)` | Camera controls. |
| `setAudioDevice(deviceId)` | Prefer updating from `inputsUpdated`; the getter is not set optimistically. |
| `availableDevices()`, `audioDevice()` | `availableDevicesUpdated`; snapshot may include `audioDevice`. |

### Subscriptions and permissions

| Method | Notes |
| --- | --- |
| `subscriptions()`, `subscriptionProfiles()` | Seeded at create when the SDK emits them; updated by `subscriptionsUpdated` / `subscriptionProfilesUpdated`. Camera and microphone on the subscription object; screen on participant media. |
| `setSubscriptionState(participantId, media)` | `media`: `camera`, `microphone`, `screenVideo`, etc. |
| `setSubscriptionProfile(participantId, profile)` | Profile name string. |
| `updatePermissions(participantId, { canSend?, canAdmin? })` | Admin updates may be ignored on native side for some fields. |
| `updateRemoteParticipants(updates)` | Batch remote input updates. |
| `ejectRemoteParticipants(ids)` | Remove remote participants. |

### Messages and screen share

| Method | Notes |
| --- | --- |
| `sendAppMessage(message, to?)` | `message` must already be JSON text (same as native). Optional `to` participant id; omit to broadcast. |
| `startScreenShare()` | iOS: ReplayKit system picker after `setup-ios-screen-share`; may emit `systemBroadcastStarted` / `systemBroadcastStopped`. Android: media projection prompt while the app is in the foreground. |
| `stopScreenShare()` | Android stops the projection foreground service when sharing ends. |

### Recording, live streaming, transcription

| Methods | Events |
| --- | --- |
| `startRecording`, `stopRecording`, `updateRecording` | `recordingStarted`, `recordingStopped`, `recordingError` |
| `startLiveStream`, `stopLiveStream`, `updateLiveStream`, `addLiveStreamingEndpoints` | `liveStreamStarted`, `liveStreamStopped`, `liveStreamError`, `liveStreamWarning` |
| `startTranscription`, `stopTranscription` | `transcriptionStarted`, `transcriptionStopped`, `transcriptionMessage`, `transcriptionError` |

### Audio levels and network

| Method / getter | Notes |
| --- | --- |
| `startLocalAudioLevelObserver(intervalMs?)`, `stopLocalAudioLevelObserver()` | Emits `localAudioLevel`; opt-in. |
| `startRemoteParticipantsAudioLevelObserver(intervalMs?)`, `stopRemoteParticipantsAudioLevelObserver()` | Emits `remoteParticipantsAudioLevel`. |
| `localAudioLevel()`, `remoteParticipantsAudioLevel()` | Read latest values; do not push high-frequency levels into React state. |
| `networkStats()` | `networkStatsUpdated` |
| — | `networkConnectionStatusUpdated` carries a `description` string (encoded status). |

### Events (`on` / `off`)

Register with `call.on(event, handler)` and remove with `call.off(event, handler)` using the **same function reference**. Payload shapes match `CallClientEventMap` in the published types. All events are filtered per client id.

Common events: `callStateUpdated`, `participantJoined`, `participantUpdated`, `participantLeft`, `participantCountsUpdated`, `activeSpeakerChanged`, `inputsUpdated`, `publishingUpdated`, `availableDevicesUpdated`, `subscriptionsUpdated`, `subscriptionProfilesUpdated`, `appMessage`, `appMessageFromRestApi`, `error`, recording/livestream/transcription events, `networkStatsUpdated`, `networkConnectionStatusUpdated`, `localAudioLevel`, `remoteParticipantsAudioLevel`, and on iOS `systemBroadcastStarted` / `systemBroadcastStopped`.

---

## VideoView

Renders one participant track from a `CallClient`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `client` | `CallClient` | required | Client that owns the room. |
| `participantId` | `string` | required | Participant id from `participants().all`. |
| `videoSource` | `'camera' \| 'screenVideo'` | `'camera'` | Which track to show. |
| `mirror` | `boolean` | `false` | Mirror local preview horizontally. |
| `objectFit` | `'cover' \| 'contain'` | `'cover'` | Scale mode. |
| `style` | `ViewStyle` | — | Layout style for the native view. |

The native view refreshes when participant media changes. After `release()`, detach or unmount views for that client.

---

## Example

`example/` is the manual test app: join, leave, local and remote video, microphone, and camera. It needs Node 22.13 or newer.

```bash
cd example
npm install
npm run ios
npm run android
```

Those scripts generate the native projects. Copy `example/daily.env.json.example` to `example/daily.env.json` and set `url` (and optional `token`). For an iOS device build, choose your Apple Development team in Xcode (**Signing & Capabilities**). That choice stays in the generated `example/ios` project and is not committed.
