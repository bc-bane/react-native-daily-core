import React from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {lobby} from './theme';

export function Lobby({
  url,
  token,
  name,
  cameraOn,
  microphoneOn,
  busy,
  error,
  onChangeUrl,
  onChangeToken,
  onChangeName,
  onChangeCamera,
  onChangeMicrophone,
  onJoin,
}: {
  url: string;
  token: string;
  name: string;
  cameraOn: boolean;
  microphoneOn: boolean;
  busy: boolean;
  error: string | null;
  onChangeUrl: (value: string) => void;
  onChangeToken: (value: string) => void;
  onChangeName: (value: string) => void;
  onChangeCamera: (value: boolean) => void;
  onChangeMicrophone: (value: boolean) => void;
  onJoin: () => void;
}): React.ReactElement {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.kicker}>react-native-daily-core</Text>
        <Text style={styles.title}>Join a call</Text>
        <Text style={styles.copy}>
          Enter a Daily room. Your name, camera, and microphone are sent with join.
        </Text>
        <Field label="Display name" value={name} onChangeText={onChangeName} placeholder="Ada" />
        <Field
          label="Room URL"
          value={url}
          onChangeText={onChangeUrl}
          placeholder="https://your-team.daily.co/room"
          autoCapitalize="none"
        />
        <Field
          label="Meeting token"
          value={token}
          onChangeText={onChangeToken}
          placeholder="Optional"
          autoCapitalize="none"
        />
        <Toggle label="Camera on" value={cameraOn} onValueChange={onChangeCamera} />
        <Toggle label="Microphone on" value={microphoneOn} onValueChange={onChangeMicrophone} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          disabled={busy || url.trim().length === 0}
          onPress={onJoin}
          style={[styles.join, (busy || url.trim().length === 0) && styles.joinDisabled]}>
          <Text style={styles.joinLabel}>{busy ? 'Joining…' : 'Join'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Field({
  label,
  ...input
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  autoCapitalize?: 'none' | 'sentences';
}): React.ReactElement {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={lobby.muted} style={styles.input} {...input} />
    </View>
  );
}

function Toggle({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}): React.ReactElement {
  return (
    <View style={styles.toggle}>
      <Text style={styles.label}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: lobby.background,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: lobby.card,
    borderRadius: 20,
    padding: 20,
    gap: 14,
  },
  kicker: {color: lobby.accent, fontWeight: '700', letterSpacing: 0.3},
  title: {color: lobby.text, fontSize: 28, fontWeight: '700'},
  copy: {color: lobby.muted, lineHeight: 20},
  field: {gap: 6},
  label: {color: lobby.text, fontWeight: '600'},
  input: {
    borderWidth: 1,
    borderColor: lobby.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: lobby.text,
  },
  toggle: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  error: {color: lobby.danger},
  join: {
    backgroundColor: lobby.accent,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 14,
  },
  joinDisabled: {opacity: 0.5},
  joinLabel: {color: '#fff', fontWeight: '700', fontSize: 16},
});
