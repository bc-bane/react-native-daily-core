import React, {useEffect, useState} from 'react';
import {PermissionsAndroid, Platform, StyleSheet, Text} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {CallClient, useCallState} from 'react-native-daily-core';
import preset from './daily.env.json';
import {CallScreen} from './src/CallScreen';
import {Lobby} from './src/Lobby';

export default function App(): React.ReactElement {
  return (
    <SafeAreaProvider>
      <CallApp />
    </SafeAreaProvider>
  );
}

function CallApp(): React.ReactElement {
  const [call, setCall] = useState<CallClient | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [url, setUrl] = useState(preset.url);
  const [token, setToken] = useState(preset.token);
  const [name, setName] = useState('Guest');
  const [cameraOn, setCameraOn] = useState(true);
  const [microphoneOn, setMicrophoneOn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = useCallState(call);
  const inCall = status === 'joining' || status === 'joined' || status === 'leaving';

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
    if (!call || url.trim().length === 0) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await ensurePermissions();
      await call.setUserName(name.trim() || 'Guest');
      await call.join({
        url: url.trim(),
        token: token.trim() || undefined,
        clientSettings: {camera: cameraOn, microphone: microphoneOn},
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (!call) {
      return;
    }
    try {
      await call.leave();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  if (initError) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.error}>{initError}</Text>
      </SafeAreaView>
    );
  }

  if (!call) {
    return (
      <SafeAreaView style={styles.center}>
        <Text>Starting CallClient…</Text>
      </SafeAreaView>
    );
  }

  if (inCall) {
    return <CallScreen client={call} onLeave={() => void leave()} />;
  }

  return (
    <Lobby
      url={url}
      token={token}
      name={name}
      cameraOn={cameraOn}
      microphoneOn={microphoneOn}
      busy={busy}
      error={error}
      onChangeUrl={setUrl}
      onChangeToken={setToken}
      onChangeName={setName}
      onChangeCamera={setCameraOn}
      onChangeMicrophone={setMicrophoneOn}
      onJoin={() => void join()}
    />
  );
}

const styles = StyleSheet.create({
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24},
  error: {color: '#b42318'},
});
