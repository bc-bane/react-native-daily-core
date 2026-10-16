import React, {useEffect, useState} from 'react';
import {
  Button,
  FlatList,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  CallClient,
  VideoView,
  useCallState,
  useParticipants,
  type Participant,
} from 'react-native-daily-core';
import preset from './daily.env.json';

export default function App() {
  const [call, setCall] = useState<CallClient | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [url, setUrl] = useState(preset.url);
  const [token, setToken] = useState(preset.token);
  const [error, setError] = useState<string | null>(null);

  const status = useCallState(call);
  const {all: participantsMap} = useParticipants(call);
  const participants = Object.values(participantsMap);

  useEffect(() => {
    let active = true;
    let client: CallClient | null = null;
    void CallClient.create()
      .then(created => {
        if (!active) {
          created.release();
          return;
        }
        client = created;
        setCall(created);
      })
      .catch(caught => {
        if (active) {
          setInitError(caught instanceof Error ? caught.message : String(caught));
        }
      });
    return () => {
      active = false;
      client?.release();
    };
  }, []);

  useEffect(() => {
    if (!call) {
      return;
    }
    const onError = (event: {message: string}) => setError(event.message);
    call.on('error', onError);
    return () => {
      call.off('error', onError);
    };
  }, [call]);

  async function ensurePermissions() {
    if (Platform.OS !== 'android') {
      return;
    }
    await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    ]);
  }

  async function join() {
    if (!call) {
      return;
    }
    setError(null);
    await ensurePermissions();
    try {
      await call.join({url: url.trim(), token: token.trim() || undefined});
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function leave() {
    if (!call) {
      return;
    }
    setError(null);
    try {
      await call.leave();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  function renderParticipant({item}: {item: Participant}) {
    if (!call) {
      return null;
    }
    return (
      <View style={styles.tile}>
        <VideoView
          client={call}
          participantId={item.id}
          videoSource="camera"
          style={styles.video}
          objectFit="cover"
        />
        <Text style={styles.name}>{item.info.userName ?? item.id}</Text>
      </View>
    );
  }

  if (initError) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.error}>{initError}</Text>
      </SafeAreaView>
    );
  }

  if (!call) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Starting CallClient…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.status}>Status: {status}</Text>
      <TextInput
        style={styles.input}
        value={url}
        onChangeText={setUrl}
        placeholder="Room URL"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        value={token}
        onChangeText={setToken}
        placeholder="Meeting token (optional)"
        autoCapitalize="none"
      />
      <View style={styles.row}>
        <Button title="Join" onPress={join} />
        <Button title="Leave" onPress={leave} />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={participants}
        keyExtractor={item => item.id}
        renderItem={renderParticipant}
        numColumns={2}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, padding: 16, gap: 8},
  status: {fontSize: 16, fontWeight: '600'},
  input: {borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8},
  row: {flexDirection: 'row', gap: 12, justifyContent: 'space-around'},
  error: {color: '#b00020'},
  tile: {flex: 1, margin: 4, aspectRatio: 3 / 4},
  video: {flex: 1, backgroundColor: '#111', borderRadius: 8},
  name: {textAlign: 'center', marginTop: 4},
});
