export type CallState =
  | 'initialized'
  | 'joining'
  | 'joined'
  | 'leaving'
  | 'left';

export type MediaStateName =
  | 'blocked'
  | 'off'
  | 'receivable'
  | 'loading'
  | 'playable'
  | 'interrupted';

export type TrackSubscriptionState = 'subscribed' | 'staged' | 'unsubscribed';

export type VideoSource = 'camera' | 'screenVideo';

export interface ParticipantMediaInfo {
  state: MediaStateName;
  subscribed: TrackSubscriptionState;
}

export interface ParticipantInfo {
  isLocal: boolean;
  isOwner: boolean;
  userId: string | null;
  userName: string | null;
}

export interface ParticipantMedia {
  camera: ParticipantMediaInfo;
  microphone: ParticipantMediaInfo;
  screenVideo: ParticipantMediaInfo;
  screenAudio: ParticipantMediaInfo;
}

export interface Participant {
  id: string;
  info: ParticipantInfo;
  media: ParticipantMedia | null;
}

export interface Participants {
  local: Participant | null;
  all: {[id: string]: Participant};
}

export interface ParticipantCounts {
  present: number;
  hidden: number;
}

export interface MediaEnabledState {
  isEnabled: boolean;
}

export interface InputSettings {
  camera: MediaEnabledState;
  microphone: MediaEnabledState;
  screenVideo: MediaEnabledState;
}

export interface PublishingTrackState {
  isPublishing: boolean;
}

export interface PublishingSettings {
  camera: PublishingTrackState;
  microphone: PublishingTrackState;
  screenVideo: PublishingTrackState;
}

export interface MediaDeviceInfo {
  deviceId: string;
  groupId: string;
  kind: string;
  label: string;
}

export interface AvailableDevices {
  camera: MediaDeviceInfo[];
  microphone: MediaDeviceInfo[];
  speaker: MediaDeviceInfo[];
  audio: MediaDeviceInfo[];
}

export interface NetworkStats {
  quality: number;
  threshold: string;
  previousThreshold: string | null;
}

export interface ClientSettingsUpdate {
  camera?: boolean;
  microphone?: boolean;
}

export type CameraFacingMode = 'user' | 'environment';

export interface InputSettingsPatch {
  camera?: {
    isEnabled?: boolean;
    facingMode?: CameraFacingMode;
  };
  microphone?: {
    isEnabled?: boolean;
  };
  screenVideo?: {
    isEnabled?: boolean;
  };
}

export interface JoinOptions {
  url: string;
  token?: string;
  clientSettings?: ClientSettingsUpdate;
}

export interface IceServer {
  urls: string[];
  username?: string;
  credential?: string;
}

export interface IceConfig {
  iceServers: IceServer[];
}

export interface TranscriptionSettings {
  language?: string;
  model?: string;
  profanityFilter?: boolean;
  punctuate?: boolean;
  includeRawResponse?: boolean;
}

export interface LiveStreamStartOptions {
  rtmpUrls?: string[];
  preconfigured?: string[];
  streamId?: string;
  forceNew?: boolean;
}

export interface RecordingStartOptions {
  streamId?: string;
  forceNew?: boolean;
}

export interface SubscriptionMediaState {
  camera?: TrackSubscriptionState;
  microphone?: TrackSubscriptionState;
  screenVideo?: TrackSubscriptionState;
  screenAudio?: TrackSubscriptionState;
}

export interface SubscriptionSummary {
  profile: string | null;
  media: SubscriptionMediaState;
}

export interface SubscriptionsByParticipant {
  [participantId: string]: SubscriptionSummary;
}

export interface SubscriptionProfiles {
  [profile: string]: SubscriptionMediaState;
}

export interface CallConfiguration {
  roomName: string;
  isOwner: boolean;
  initialCameraEnabled: boolean;
  initialMicrophoneEnabled: boolean;
  recordingMode: string;
  ejectAtRoomExpiration: boolean;
  ejectAtTokenExpiration: boolean;
  terseLoggingEnabled: boolean;
  initialUserName: string | null;
  userId: string | null;
  roomExpiration: number | null;
  tokenExpiration: number | null;
  roomNotBefore: number | null;
  tokenNotBefore: number | null;
  permissionsOnJoin: {
    hasPresence: boolean;
    canSend: string[];
    canAdmin: string[];
    canReceive: {
      base: {
        camera: boolean;
        microphone: boolean;
        screenVideo: boolean;
        screenAudio: boolean;
      };
    };
  };
}

export interface RemoteParticipantUpdate {
  permissions?: {
    hasPresence?: boolean;
    canSend?: Array<
      'camera' | 'microphone' | 'screenVideo' | 'screenAudio' | 'customVideo' | 'customAudio'
    >;
  };
  inputsEnabled?: {
    camera?: boolean;
    microphone?: boolean;
  };
}

export type CallClientEventName =
  | 'callStateUpdated'
  | 'participantJoined'
  | 'participantUpdated'
  | 'participantLeft'
  | 'participantCountsUpdated'
  | 'activeSpeakerChanged'
  | 'inputsUpdated'
  | 'publishingUpdated'
  | 'subscriptionsUpdated'
  | 'subscriptionProfilesUpdated'
  | 'availableDevicesUpdated'
  | 'appMessage'
  | 'appMessageFromRestApi'
  | 'error'
  | 'networkStatsUpdated'
  | 'networkConnectionStatusUpdated'
  | 'localAudioLevel'
  | 'remoteParticipantsAudioLevel'
  | 'recordingStarted'
  | 'recordingStopped'
  | 'recordingError'
  | 'liveStreamStarted'
  | 'liveStreamStopped'
  | 'liveStreamError'
  | 'liveStreamWarning'
  | 'transcriptionStarted'
  | 'transcriptionStopped'
  | 'transcriptionMessage'
  | 'transcriptionError'
  | 'systemBroadcastStarted'
  | 'systemBroadcastStopped';

export interface CallClientEventMap {
  callStateUpdated: {state: CallState};
  participantJoined: Participant;
  participantUpdated: Participant;
  participantLeft: {participant: Participant; reason: string};
  participantCountsUpdated: ParticipantCounts;
  activeSpeakerChanged: {participant: Participant | null};
  inputsUpdated: InputSettings;
  publishingUpdated: PublishingSettings;
  subscriptionsUpdated: SubscriptionsByParticipant;
  subscriptionProfilesUpdated: SubscriptionProfiles;
  availableDevicesUpdated: AvailableDevices;
  appMessage: {message: string; from: string};
  appMessageFromRestApi: {message: string};
  error: {message: string};
  networkStatsUpdated: NetworkStats;
  networkConnectionStatusUpdated: Record<string, unknown>;
  localAudioLevel: {audioLevel: number};
  remoteParticipantsAudioLevel: {[participantId: string]: number};
  recordingStarted: {streamId: string};
  recordingStopped: {streamId: string};
  recordingError: {streamId: string; message: string};
  liveStreamStarted: {streamId: string};
  liveStreamStopped: {streamId: string};
  liveStreamError: {streamId: string; message: string};
  liveStreamWarning: {streamId: string; message: string};
  transcriptionStarted: Record<string, unknown>;
  transcriptionStopped: {stoppedByError: boolean};
  transcriptionMessage: {participantId: string; text: string; timestamp: string};
  transcriptionError: {message: string};
  systemBroadcastStarted: Record<string, never>;
  systemBroadcastStopped: Record<string, never>;
}
