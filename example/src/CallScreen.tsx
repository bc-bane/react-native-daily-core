import React, {useEffect, useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {
  useCallState,
  useParticipants,
  useRemoteParticipants,
  type CallClient,
  type MediaDeviceInfo,
  type Participant,
} from 'react-native-daily-core';
import {CameraSheet} from './CameraSheet';
import {ChatSheet, type ChatLine} from './ChatSheet';
import {ControlBar} from './ControlBar';
import {MoreSheet} from './MoreSheet';
import {ParticipantStage} from './ParticipantStage';
import {call} from './theme';

type SheetName = 'camera' | 'chat' | 'more' | null;

export function CallScreen({
  client,
  onLeave,
}: {
  client: CallClient;
  onLeave: () => void;
}): React.ReactElement {
  const status = useCallState(client);
  const {local} = useParticipants(client);
  const remotes = useRemoteParticipants(client);
  const [banner, setBanner] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetName>(null);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(
    client.activeSpeaker()?.id ?? null,
  );
  const [levels, setLevels] = useState<{[id: string]: number}>({});
  const [devices, setDevices] = useState<MediaDeviceInfo[]>(audioOutputs(client));
  const [audioDeviceId, setAudioDeviceId] = useState<string | null>(client.audioDevice());
  const [network, setNetwork] = useState(client.networkStats());
  const [microphoneOn, setMicrophoneOn] = useState(client.inputs().microphone.isEnabled);
  const [cameraOn, setCameraOn] = useState(client.inputs().camera.isEnabled);
  const [screenSharing, setScreenSharing] = useState(client.publishing().screenVideo.isPublishing);
  const [messages, setMessages] = useState<ChatLine[]>([]);
  const [unread, setUnread] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [recordingId, setRecordingId] = useState<string | undefined>();
  const [streamId, setStreamId] = useState<string | undefined>();
  const [torch, setTorch] = useState(false);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [cameraNote, setCameraNote] = useState<string | null>(null);
  const [cloudStatus, setCloudStatus] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState(client.subscriptions());

  useEffect(() => {
    if (status !== 'joined') {
      return;
    }
    void client.startLocalAudioLevelObserver(200);
    void client.startRemoteParticipantsAudioLevelObserver(200);
    return () => {
      void client.stopLocalAudioLevelObserver();
      void client.stopRemoteParticipantsAudioLevelObserver();
    };
  }, [client, status]);

  useEffect(() => {
    const onError = (event: {message: string}) => setBanner(event.message);
    const onActive = (event: {participant: Participant | null}) => {
      setActiveSpeakerId(event.participant?.id ?? null);
    };
    const onLocalLevel = (event: {audioLevel: number}) => {
      const id = client.participants().local?.id;
      if (!id) {
        return;
      }
      setLevels(current => ({...current, [id]: event.audioLevel}));
    };
    const onRemoteLevel = (event: {[id: string]: number}) => {
      setLevels(current => ({...current, ...event}));
    };
    const onInputs = (event: {
      microphone: {isEnabled: boolean};
      camera: {isEnabled: boolean};
      screenVideo: {isEnabled: boolean};
    }) => {
      setMicrophoneOn(event.microphone.isEnabled);
      setCameraOn(event.camera.isEnabled);
      setScreenSharing(event.screenVideo.isEnabled || client.publishing().screenVideo.isPublishing);
    };
    const onPublishing = (event: {screenVideo: {isPublishing: boolean}}) => {
      setScreenSharing(event.screenVideo.isPublishing || client.inputs().screenVideo.isEnabled);
    };
    const onDevices = () => setDevices(audioOutputs(client));
    const onMessage = (event: {message: string; from: string}) => {
      const sender = client.participants().all[event.from];
      setMessages(current => [
        ...current,
        {
          id: `${Date.now()}-${current.length}`,
          name: sender?.info.userName || 'Guest',
          text: event.message,
        },
      ]);
      setUnread(true);
    };
    const onCaption = (event: {participantId: string; text: string}) => {
      const speaker = client.participants().all[event.participantId];
      const name = speaker?.info.userName || 'Guest';
      setCaption(`${name}: ${event.text}`);
    };
    const onRecordingStarted = (event: {streamId: string}) => {
      setRecording(true);
      setRecordingId(event.streamId);
      setCloudStatus('Recording');
    };
    const onRecordingStopped = () => {
      setRecording(false);
      setCloudStatus('Recording stopped');
    };
    const onRecordingError = (event: {message: string}) => setCloudStatus(event.message);
    const onLiveStarted = (event: {streamId: string}) => {
      setStreaming(true);
      setStreamId(event.streamId);
    };
    const onLiveStopped = () => setStreaming(false);
    const onLiveError = (event: {message: string}) => setBanner(event.message);
    const onTranscriptionStarted = () => {
      setTranscribing(true);
      setCloudStatus('Transcription on');
    };
    const onTranscriptionStopped = () => {
      setTranscribing(false);
      setCloudStatus('Transcription stopped');
    };
    const onTranscriptionError = (event: {message: string}) => setCloudStatus(event.message);
    client.on('error', onError);
    client.on('activeSpeakerChanged', onActive);
    client.on('localAudioLevel', onLocalLevel);
    client.on('remoteParticipantsAudioLevel', onRemoteLevel);
    client.on('inputsUpdated', onInputs);
    client.on('publishingUpdated', onPublishing);
    client.on('availableDevicesUpdated', onDevices);
    client.on('networkStatsUpdated', setNetwork);
    client.on('appMessage', onMessage);
    client.on('subscriptionsUpdated', setSubscriptions);
    client.on('recordingStarted', onRecordingStarted);
    client.on('recordingStopped', onRecordingStopped);
    client.on('recordingError', onRecordingError);
    client.on('liveStreamStarted', onLiveStarted);
    client.on('liveStreamStopped', onLiveStopped);
    client.on('liveStreamError', onLiveError);
    client.on('transcriptionStarted', onTranscriptionStarted);
    client.on('transcriptionStopped', onTranscriptionStopped);
    client.on('transcriptionError', onTranscriptionError);
    client.on('transcriptionMessage', onCaption);
    return () => {
      client.off('error', onError);
      client.off('activeSpeakerChanged', onActive);
      client.off('localAudioLevel', onLocalLevel);
      client.off('remoteParticipantsAudioLevel', onRemoteLevel);
      client.off('inputsUpdated', onInputs);
      client.off('publishingUpdated', onPublishing);
      client.off('availableDevicesUpdated', onDevices);
      client.off('networkStatsUpdated', setNetwork);
      client.off('appMessage', onMessage);
      client.off('subscriptionsUpdated', setSubscriptions);
      client.off('recordingStarted', onRecordingStarted);
      client.off('recordingStopped', onRecordingStopped);
      client.off('recordingError', onRecordingError);
      client.off('liveStreamStarted', onLiveStarted);
      client.off('liveStreamStopped', onLiveStopped);
      client.off('liveStreamError', onLiveError);
      client.off('transcriptionStarted', onTranscriptionStarted);
      client.off('transcriptionStopped', onTranscriptionStopped);
      client.off('transcriptionError', onTranscriptionError);
      client.off('transcriptionMessage', onCaption);
    };
  }, [client]);

  const stage = useMemo(() => {
    const speaking = remotes.find(person => person.id === activeSpeakerId);
    return speaking ?? remotes[0] ?? local;
  }, [activeSpeakerId, local, remotes]);
  const people = remotes.length + (local ? 1 : 0);
  const strip = people >= 3 && stage ? remotes.filter(person => person.id !== stage.id) : [];
  const selected = remotes.find(person => person.id === selectedId) ?? null;
  const subscribed = selected
    ? selected.media?.camera.subscribed !== 'unsubscribed'
    : true;
  const networkLabel = network
    ? `Network ${network.quality} · ${network.threshold}`
    : status;

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
    } catch (caught) {
      setBanner(caught instanceof Error ? caught.message : String(caught));
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <Text style={styles.network}>{networkLabel}</Text>
        <Text style={styles.status}>{status}</Text>
      </View>
      {banner ? (
        <Pressable onPress={() => setBanner(null)} style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </Pressable>
      ) : null}
      <ParticipantStage
        client={client}
        stage={stage}
        strip={strip}
        local={local}
        activeSpeakerId={activeSpeakerId}
        levels={levels}
        selectedId={selectedId}
        onSelect={id => setSelectedId(id === local?.id ? null : id)}
      />
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      <ControlBar
        microphoneOn={microphoneOn}
        cameraOn={cameraOn}
        screenSharing={screenSharing}
        chatUnread={unread && sheet !== 'chat'}
        onToggleMicrophone={() => {
          void run(() => client.setInputsEnabled({microphone: !microphoneOn}));
        }}
        onToggleCamera={() => {
          void run(() => client.setInputsEnabled({camera: !cameraOn}));
        }}
        onToggleScreenShare={() => {
          void run(() => (screenSharing ? client.stopScreenShare() : client.startScreenShare()));
        }}
        onOpenCamera={() => setSheet('camera')}
        onOpenChat={() => {
          setUnread(false);
          setSheet('chat');
        }}
        onOpenMore={() => setSheet('more')}
        onLeave={onLeave}
      />
      {sheet === 'camera' ? (
        <CameraSheet
          visible
          torch={torch}
          facing={facing}
          note={cameraNote}
          zoom={zoom}
          devices={devices}
          selectedDeviceId={audioDeviceId}
          onClose={() => setSheet(null)}
          onFacing={mode => {
            void (async () => {
              try {
                await client.updateInputs({camera: {facingMode: mode}});
                setFacing(mode);
                if (mode !== 'environment') {
                  setTorch(false);
                }
                setCameraNote(null);
              } catch (caught) {
                setCameraNote(caught instanceof Error ? caught.message : String(caught));
              }
            })();
          }}
          onTorch={enabled => {
            void (async () => {
              try {
                await client.setCameraTorch(enabled);
                setTorch(enabled);
                setCameraNote(null);
              } catch (caught) {
                setCameraNote(caught instanceof Error ? caught.message : String(caught));
              }
            })();
          }}
          onZoom={ratio => {
            setZoom(ratio);
            void run(() => client.setCameraZoom(ratio));
          }}
          onSelectDevice={deviceId => {
            setAudioDeviceId(deviceId);
            void run(() => client.setAudioDevice(deviceId));
          }}
        />
      ) : null}
      {sheet === 'chat' ? (
        <ChatSheet
          visible
          messages={messages}
          onClose={() => setSheet(null)}
          onSend={async text => {
            await client.sendAppMessage(text);
            setMessages(current => [...current, {id: `local-${current.length}`, name: 'You', text}]);
          }}
        />
      ) : null}
      {sheet === 'more' ? (
      <MoreSheet
        visible
        recording={recording}
        transcribing={transcribing}
        streaming={streaming}
        status={cloudStatus}
        owner={Boolean(local?.info.isOwner)}
        selectedName={selected ? selected.info.userName || 'Guest' : null}
        subscribed={subscribed}
        onClose={() => setSheet(null)}
        onToggleRecording={() => {
          void (async () => {
            setCloudStatus(recording ? 'Stopping recording…' : 'Starting recording…');
            try {
              if (recording) {
                await client.stopRecording(recordingId);
              } else {
                const started = await client.startRecording();
                if (started.streamId) {
                  setRecordingId(started.streamId);
                }
              }
            } catch (caught) {
              setCloudStatus(caught instanceof Error ? caught.message : String(caught));
            }
          })();
        }}
        onToggleTranscription={() => {
          void (async () => {
            setCloudStatus(transcribing ? 'Stopping transcription…' : 'Starting transcription…');
            try {
              if (transcribing) {
                await client.stopTranscription();
              } else {
                await client.startTranscription();
              }
            } catch (caught) {
              setCloudStatus(caught instanceof Error ? caught.message : String(caught));
            }
          })();
        }}
        onStartLiveStream={rtmpUrl => {
          if (!rtmpUrl) {
            setBanner('Enter an RTMP URL to start a live stream.');
            return;
          }
          void run(() => client.startLiveStream({rtmpUrls: [rtmpUrl]}));
        }}
        onStopLiveStream={() => {
          void run(() => client.stopLiveStream(streamId));
        }}
        onMuteSelected={() => {
          if (!selected) {
            return;
          }
          void run(() =>
            client.updateRemoteParticipants([
              {id: selected.id, inputsEnabled: {microphone: false}},
            ]),
          );
        }}
        onEjectSelected={() => {
          if (!selected) {
            return;
          }
          void run(() => client.ejectRemoteParticipants([selected.id]));
        }}
        onToggleSubscription={() => {
          if (!selected) {
            return;
          }
          const next = subscribed ? 'unsubscribed' : 'subscribed';
          void run(() =>
            client.setSubscriptionState(selected.id, {
              camera: next,
              microphone: next,
              screenVideo: next,
              screenAudio: next,
            }),
          );
        }}
      />
      ) : null}
    </SafeAreaView>
  );
}

function audioOutputs(client: CallClient): MediaDeviceInfo[] {
  const available = client.availableDevices();
  return [...available.speaker, ...available.audio];
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: call.background},
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  network: {color: call.text, fontWeight: '600'},
  status: {color: call.muted, textTransform: 'capitalize'},
  banner: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#3a2430',
    borderRadius: 10,
    padding: 10,
  },
  bannerText: {color: '#ffd7df'},
  caption: {
    color: call.text,
    textAlign: 'center',
    marginHorizontal: 24,
    marginBottom: 8,
  },
});
