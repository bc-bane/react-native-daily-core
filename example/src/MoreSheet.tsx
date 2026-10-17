import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {Sheet} from './Sheet';
import {call} from './theme';

export function MoreSheet({
  visible,
  recording,
  transcribing,
  streaming,
  status,
  owner,
  selectedName,
  subscribed,
  onClose,
  onToggleRecording,
  onToggleTranscription,
  onStartLiveStream,
  onStopLiveStream,
  onMuteSelected,
  onEjectSelected,
  onToggleSubscription,
}: {
  visible: boolean;
  recording: boolean;
  transcribing: boolean;
  streaming: boolean;
  status: string | null;
  owner: boolean;
  selectedName: string | null;
  subscribed: boolean;
  onClose: () => void;
  onToggleRecording: () => void;
  onToggleTranscription: () => void;
  onStartLiveStream: (rtmpUrl: string) => void;
  onStopLiveStream: () => void;
  onMuteSelected: () => void;
  onEjectSelected: () => void;
  onToggleSubscription: () => void;
}): React.ReactElement {
  const [rtmpUrl, setRtmpUrl] = useState('');
  return (
    <Sheet title="More" visible={visible} onClose={onClose}>
      <Action label={recording ? 'Stop recording' : 'Start recording'} onPress={onToggleRecording} />
      <Action label={transcribing ? 'Stop transcription' : 'Start transcription'} onPress={onToggleTranscription} />
      {status ? <Text style={styles.status}>{status}</Text> : null}
      <Text style={styles.label}>Live stream</Text>
      <TextInput
        value={rtmpUrl}
        onChangeText={setRtmpUrl}
        autoCapitalize="none"
        placeholder="rtmp://..."
        placeholderTextColor={call.muted}
        style={styles.input}
      />
      <Action
        label={streaming ? 'Stop live stream' : 'Start live stream'}
        onPress={() => (streaming ? onStopLiveStream() : onStartLiveStream(rtmpUrl.trim()))}
      />
      {owner ? (
        <View style={styles.block}>
          <Text style={styles.label}>
            {selectedName ? `Selected: ${selectedName}` : 'Tap a remote tile to select them'}
          </Text>
          <Action label="Mute microphone" onPress={onMuteSelected} disabled={!selectedName} />
          <Action
            label={subscribed ? 'Unsubscribe' : 'Subscribe'}
            onPress={onToggleSubscription}
            disabled={!selectedName}
          />
          <Action label="Remove from call" onPress={onEjectSelected} disabled={!selectedName} danger />
        </View>
      ) : null}
    </Sheet>
  );
}

function Action({
  label,
  onPress,
  disabled,
  danger,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}): React.ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.action, danger && styles.danger, disabled && styles.disabled]}>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: {color: call.text, fontWeight: '600'},
  status: {color: call.text},
  input: {
    color: call.text,
    borderWidth: 1,
    borderColor: call.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  block: {gap: 10},
  action: {
    backgroundColor: '#2c3646',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  danger: {backgroundColor: call.danger},
  disabled: {opacity: 0.4},
  actionLabel: {color: '#fff', fontWeight: '700'},
});
