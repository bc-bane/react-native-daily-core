# Native API frozen for the CallClient build

Pinned SDKs: `co.daily:client` 0.40.0 and Daily iOS CocoaPod 0.40.0.

React Native ships the methods that exist on both. The JavaScript names match the native listener and method names.

## Shipped

- Lifecycle: `join`, `leave`, `release`, `callState`, `callConfigFor`
- Participants: `participants`, `participantCounts`, `participantJoined`, `participantUpdated`, `participantLeft`, `activeSpeaker`
- Inputs and publishing: `inputs`, `publishing`, `setInputsEnabled`, `setIsPublishing`, `updateInputs`, `updatePublishing`, `setCameraTorch`, `setCameraZoom`, `setAudioDevice`, `availableDevices`
- Subscriptions: `setSubscriptionState`, `setSubscriptionProfile`
- Admin: `updatePermissions`, `updateRemoteParticipants`, `ejectRemoteParticipants`
- Messages: `sendAppMessage`
- Screen share: `startScreenShare`, `stopScreenShare`
- Cloud: recording, live streaming, transcription start/stop, audio level observers
- Stats: `networkStats`, `networkConnectionStatusUpdated`
- Video: `VideoView` with `participantId` and `videoSource` (`camera` or `screenVideo`)

## Not shipped

Confirmed absent from the 0.40.0 iOS and Android `CallClient` references:

- Dial-in, dial-out, DTMF, SIP transfer, SIP refer
- Waiting room and knocking
- Remote media player
- Pre-call websocket, network, and peer-to-peer tests
- CPU load stats
- Meeting session summary, state, and data
- `setUserData` during a call
- `geo()`
- Updating an in-progress transcription

Custom audio and video track sources stay out of this pass. The native SDKs have them; the React Native API does not take a raw WebRTC source.
