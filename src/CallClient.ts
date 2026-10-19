import {
  getNativeDailyCallClientModule,
  subscribeDailyAudioLevels,
  subscribeDailyCallClientEvents,
  subscribeDailyRemoteAudioLevels,
} from './NitroDailyCallClient';
import type {
  AvailableDevices,
  CallClientEventMap,
  CallClientEventName,
  CallState,
  ClientSettingsUpdate,
  InputSettingsPatch,
  IceConfig,
  InputSettings,
  JoinOptions,
  LiveStreamStartOptions,
  NetworkStats,
  Participant,
  ParticipantCounts,
  Participants,
  CallConfiguration,
  PublishingSettings,
  RecordingStartOptions,
  RemoteParticipantUpdate,
  SubscriptionProfiles,
  SubscriptionsByParticipant,
  SubscriptionMediaState,
  TrackSubscriptionState,
  TranscriptionSettings,
} from './types';

type Handler<T> = (payload: T) => void;

const emptyInputs = (): InputSettings => ({
  camera: {isEnabled: false},
  microphone: {isEnabled: false},
  screenVideo: {isEnabled: false},
});

const emptyPublishing = (): PublishingSettings => ({
  camera: {isPublishing: false},
  microphone: {isPublishing: false},
  screenVideo: {isPublishing: false},
});

export class CallClient {
  static async create(): Promise<CallClient> {
    const clientId = await getNativeDailyCallClientModule().createClient();
    const client = new CallClient(clientId);
    await client.seedFromNative();
    return client;
  }

  private readonly clientId: number;
  private destroyed = false;
  private performGeneration = 0;
  private callStateValue: CallState = 'initialized';
  private participantsValue: Participants = {local: null, all: {}};
  private countsValue: ParticipantCounts = {present: 0, hidden: 0};
  private inputsValue: InputSettings = emptyInputs();
  private publishingValue: PublishingSettings = emptyPublishing();
  private devicesValue: AvailableDevices = {
    camera: [],
    microphone: [],
    speaker: [],
    audio: [],
  };
  private audioDeviceValue: string | null = null;
  private activeSpeakerValue: Participant | null = null;
  private networkStatsValue: NetworkStats | null = null;
  private localAudioLevelValue = 0;
  private remoteAudioLevelsValue: {[id: string]: number} = {};
  private subscriptionsValue: SubscriptionsByParticipant = {};
  private subscriptionProfilesValue: SubscriptionProfiles = {};
  private readonly listeners = new Map<string, Set<Handler<never>>>();
  private readonly subscription;
  private readonly audioLevels;
  private readonly remoteAudioLevels;

  private constructor(clientId: number) {
    this.clientId = clientId;
    this.subscription = subscribeDailyCallClientEvents(event => {
      if (this.destroyed || event.clientId !== this.clientId || event.payload == null) {
        return;
      }
      this.applyEvent(event.type as CallClientEventName, event.payload);
      this.emit(event.type, event.payload);
    });
    this.audioLevels = subscribeDailyAudioLevels(level => {
      if (this.destroyed || level.clientId !== this.clientId || level.participantId) {
        return;
      }
      this.localAudioLevelValue = level.audioLevel;
    });
    this.remoteAudioLevels = subscribeDailyRemoteAudioLevels(update => {
      if (this.destroyed || update.clientId !== this.clientId) {
        return;
      }
      this.remoteAudioLevelsValue = update.levels;
    });
  }

  get id(): number {
    return this.clientId;
  }

  callState(): CallState {
    return this.callStateValue;
  }

  participants(): Participants {
    return this.participantsValue;
  }

  participantCounts(): ParticipantCounts {
    return this.countsValue;
  }

  inputs(): InputSettings {
    return this.inputsValue;
  }

  publishing(): PublishingSettings {
    return this.publishingValue;
  }

  availableDevices(): AvailableDevices {
    return this.devicesValue;
  }

  audioDevice(): string | null {
    return this.audioDeviceValue;
  }

  activeSpeaker(): Participant | null {
    return this.activeSpeakerValue;
  }

  networkStats(): NetworkStats | null {
    return this.networkStatsValue;
  }

  localAudioLevel(): number {
    return this.localAudioLevelValue;
  }

  remoteParticipantsAudioLevel(): {[id: string]: number} {
    return this.remoteAudioLevelsValue;
  }

  subscriptions(): SubscriptionsByParticipant {
    return this.subscriptionsValue;
  }

  subscriptionProfiles(): SubscriptionProfiles {
    return this.subscriptionProfilesValue;
  }

  on<E extends CallClientEventName>(
    event: E,
    handler: Handler<CallClientEventMap[E]>,
  ): void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(handler as Handler<never>);
    this.listeners.set(event, set);
  }

  off<E extends CallClientEventName>(
    event: E,
    handler: Handler<CallClientEventMap[E]>,
  ): void {
    this.listeners.get(event)?.delete(handler as Handler<never>);
  }

  async join(options: JoinOptions): Promise<void> {
    const generation = this.performGeneration;
    const result = await this.perform('join', {
      url: options.url,
      token: options.token ?? null,
      clientSettings: options.clientSettings ?? null,
    });
    if (!this.shouldApplyPerformResult(generation)) {
      return;
    }
    this.absorbSnapshot(result);
  }

  async leave(): Promise<void> {
    const generation = this.performGeneration;
    await this.perform('leave', {});
    if (!this.shouldApplyPerformResult(generation)) {
      return;
    }
    const snapshot = await this.perform('snapshot', {});
    if (!this.shouldApplyPerformResult(generation)) {
      return;
    }
    this.applyLeaveSnapshot(snapshot);
  }

  release(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.performGeneration += 1;
    this.subscription.remove();
    this.audioLevels.remove();
    this.remoteAudioLevels.remove();
    getNativeDailyCallClientModule().destroyClient(this.clientId);
  }

  callConfigFor(url: string, token?: string): Promise<CallConfiguration> {
    return this.perform('callConfigFor', {url, token: token ?? null}).then(
      result => result as CallConfiguration,
    );
  }

  setUserName(userName: string): Promise<void> {
    return this.perform('setUserName', {userName}).then(() => undefined);
  }

  setProxyUrl(proxyUrl: string | null): Promise<void> {
    return this.perform('setProxyUrl', {proxyUrl}).then(() => undefined);
  }

  setIceConfig(iceConfig: IceConfig | null): Promise<void> {
    return this.perform('setIceConfig', {iceConfig}).then(() => undefined);
  }

  setInputsEnabled(options: {
    camera?: boolean;
    microphone?: boolean;
  }): Promise<void> {
    return this.perform('setInputsEnabled', options).then(() => undefined);
  }

  updateInputs(update: InputSettingsPatch): Promise<void> {
    return this.perform('updateInputs', update).then(() => undefined);
  }

  setIsPublishing(options: {
    camera?: boolean;
    microphone?: boolean;
  }): Promise<void> {
    return this.perform('setIsPublishing', options).then(() => undefined);
  }

  setCameraTorch(enabled: boolean): Promise<void> {
    return this.perform('setCameraTorch', {enabled}).then(() => undefined);
  }

  setCameraZoom(ratio: number): Promise<void> {
    return this.perform('setCameraZoom', {ratio}).then(() => undefined);
  }

  setAudioDevice(deviceId: string): Promise<void> {
    return this.perform('setAudioDevice', {deviceId}).then(() => undefined);
  }

  setSubscriptionState(
    participantId: string,
    media: SubscriptionMediaState,
  ): Promise<void> {
    return this.perform('setSubscriptionState', {participantId, ...media}).then(
      () => undefined,
    );
  }

  setSubscriptionProfile(
    participantId: string,
    profile: TrackSubscriptionState,
  ): Promise<void> {
    return this.perform('setSubscriptionProfile', {participantId, profile}).then(
      () => undefined,
    );
  }

  updatePermissions(
    participantId: string,
    permissions: {
      hasPresence?: boolean;
      canSend?: Array<
        'camera' | 'microphone' | 'screenVideo' | 'screenAudio' | 'customVideo' | 'customAudio'
      >;
    },
  ): Promise<void> {
    return this.perform('updatePermissions', {participantId, ...permissions}).then(
      () => undefined,
    );
  }

  updateRemoteParticipants(
    updates: Array<RemoteParticipantUpdate & {id: string}>,
  ): Promise<void> {
    const payload: Record<string, RemoteParticipantUpdate> = {};
    for (const update of updates) {
      const {id, ...rest} = update;
      payload[id] = rest;
    }
    return this.perform('updateRemoteParticipants', payload).then(() => undefined);
  }

  ejectRemoteParticipants(ids: string[]): Promise<void> {
    return this.perform('ejectRemoteParticipants', {ids}).then(() => undefined);
  }

  sendAppMessage(message: string, to?: string): Promise<void> {
    return this.perform('sendAppMessage', {
      message,
      to: to ?? null,
    }).then(() => undefined);
  }

  startScreenShare(): Promise<void> {
    return this.perform('startScreenShare', {}).then(() => undefined);
  }

  stopScreenShare(): Promise<void> {
    return this.perform('stopScreenShare', {}).then(() => undefined);
  }

  startRecording(options?: RecordingStartOptions): Promise<{streamId: string}> {
    return this.perform('startRecording', options ?? {}).then(
      result => result as {streamId: string},
    );
  }

  stopRecording(streamId?: string): Promise<void> {
    return this.perform('stopRecording', {streamId: streamId ?? null}).then(
      () => undefined,
    );
  }

  startLiveStream(options: LiveStreamStartOptions): Promise<{streamId: string}> {
    return this.perform('startLiveStream', options).then(
      result => result as {streamId: string},
    );
  }

  stopLiveStream(streamId?: string): Promise<void> {
    return this.perform('stopLiveStream', {streamId: streamId ?? null}).then(
      () => undefined,
    );
  }

  addLiveStreamingEndpoints(options: {
    streamId?: string;
    preconfigured?: string[];
    rtmpUrls?: string[];
  }): Promise<void> {
    return this.perform('addLiveStreamingEndpoints', options).then(
      () => undefined,
    );
  }

  startTranscription(settings?: TranscriptionSettings): Promise<void> {
    return this.perform('startTranscription', settings ?? {}).then(
      () => undefined,
    );
  }

  stopTranscription(): Promise<void> {
    return this.perform('stopTranscription', {}).then(() => undefined);
  }

  startLocalAudioLevelObserver(intervalMs?: number): Promise<void> {
    return this.perform('startLocalAudioLevelObserver', {
      intervalMs: intervalMs ?? 0,
    }).then(() => undefined);
  }

  stopLocalAudioLevelObserver(): Promise<void> {
    return this.perform('stopLocalAudioLevelObserver', {}).then(() => undefined);
  }

  startRemoteParticipantsAudioLevelObserver(intervalMs?: number): Promise<void> {
    return this.perform('startRemoteParticipantsAudioLevelObserver', {
      intervalMs: intervalMs ?? 0,
    }).then(() => undefined);
  }

  stopRemoteParticipantsAudioLevelObserver(): Promise<void> {
    return this.perform('stopRemoteParticipantsAudioLevelObserver', {}).then(
      () => undefined,
    );
  }

  private async seedFromNative(): Promise<void> {
    try {
      const result = await this.perform('snapshot', {});
      this.absorbSnapshot(result);
    } catch {
      // Native snapshot is best-effort during construction.
    }
  }

  private shouldApplyPerformResult(generation: number): boolean {
    return !this.destroyed && generation === this.performGeneration;
  }

  private async perform(action: string, payload: unknown): Promise<unknown> {
    if (this.destroyed) {
      throw new Error('CallClient has been released');
    }
    const generation = this.performGeneration;
    const json = await getNativeDailyCallClientModule().perform(
      this.clientId,
      action,
      JSON.stringify(payload ?? {}),
    );
    if (this.destroyed || generation !== this.performGeneration) {
      throw new Error('CallClient has been released');
    }
    return json ? JSON.parse(json) : {};
  }

  private emit(type: string, payload: unknown): void {
    const handlers = this.listeners.get(type);
    if (!handlers) {
      return;
    }
    handlers.forEach(handler => handler(payload as never));
  }

  private applyEvent(type: CallClientEventName, payload: unknown): void {
    switch (type) {
      case 'callStateUpdated':
        this.callStateValue = (payload as {state: CallState}).state;
        break;
      case 'participantJoined':
      case 'participantUpdated': {
        const participant = payload as Participant;
        this.participantsValue = {
          local: participant.info.isLocal
            ? participant
            : this.participantsValue.local,
          all: {...this.participantsValue.all, [participant.id]: participant},
        };
        break;
      }
      case 'participantLeft': {
        const left = payload as {participant: Participant};
        const all = {...this.participantsValue.all};
        delete all[left.participant.id];
        this.participantsValue = {
          local: left.participant.info.isLocal
            ? left.participant
            : this.participantsValue.local,
          all,
        };
        break;
      }
      case 'participantCountsUpdated':
        this.countsValue = payload as ParticipantCounts;
        break;
      case 'activeSpeakerChanged':
        this.activeSpeakerValue = (payload as {participant: Participant | null})
          .participant;
        break;
      case 'inputsUpdated':
        this.inputsValue = payload as InputSettings;
        break;
      case 'publishingUpdated':
        this.publishingValue = payload as PublishingSettings;
        break;
      case 'availableDevicesUpdated':
        this.devicesValue = payload as AvailableDevices;
        break;
      case 'networkStatsUpdated':
        this.networkStatsValue = payload as NetworkStats;
        break;
      case 'localAudioLevel':
        this.localAudioLevelValue = (payload as {audioLevel: number}).audioLevel;
        break;
      case 'remoteParticipantsAudioLevel':
        this.remoteAudioLevelsValue = payload as {[id: string]: number};
        break;
      case 'subscriptionsUpdated':
        this.subscriptionsValue = payload as SubscriptionsByParticipant;
        break;
      case 'subscriptionProfilesUpdated':
        this.subscriptionProfilesValue = payload as SubscriptionProfiles;
        break;
      default:
        break;
    }
  }

  private applyLeaveSnapshot(result: unknown): void {
    const snapshot = result as {
      callState?: CallState;
      participants?: Participants;
      participantCounts?: ParticipantCounts;
    };
    if (snapshot.callState) {
      this.callStateValue = snapshot.callState;
    }
    if (snapshot.participants) {
      this.participantsValue = snapshot.participants;
    }
    if (snapshot.participantCounts) {
      this.countsValue = snapshot.participantCounts;
    }
  }

  private absorbSnapshot(result: unknown): void {
    const snapshot = result as {
      callState?: CallState;
      participants?: Participants;
      participantCounts?: ParticipantCounts;
      inputs?: InputSettings;
      publishing?: PublishingSettings;
      availableDevices?: AvailableDevices;
      audioDevice?: string | null;
    };
    if (snapshot.callState) {
      this.callStateValue = snapshot.callState;
    }
    if (snapshot.participants) {
      this.participantsValue = snapshot.participants;
    }
    if (snapshot.participantCounts) {
      this.countsValue = snapshot.participantCounts;
    }
    if (snapshot.inputs) {
      this.inputsValue = snapshot.inputs;
    }
    if (snapshot.publishing) {
      this.publishingValue = snapshot.publishing;
    }
    if (snapshot.availableDevices) {
      this.devicesValue = snapshot.availableDevices;
    }
    if (snapshot.audioDevice !== undefined) {
      this.audioDeviceValue = snapshot.audioDevice;
    }
  }
}
