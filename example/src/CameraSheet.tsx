import React from 'react';
import {Pressable, StyleSheet, Switch, Text, View} from 'react-native';
import Slider from '@react-native-community/slider';
import type {MediaDeviceInfo} from 'react-native-daily-core';
import {Sheet} from './Sheet';
import {call} from './theme';

export function CameraSheet({
  visible,
  torch,
  facing,
  note,
  zoom,
  devices,
  selectedDeviceId,
  onClose,
  onFacing,
  onTorch,
  onZoom,
  onSelectDevice,
}: {
  visible: boolean;
  torch: boolean;
  facing: 'user' | 'environment';
  note: string | null;
  zoom: number;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string | null;
  onClose: () => void;
  onFacing: (mode: 'user' | 'environment') => void;
  onTorch: (enabled: boolean) => void;
  onZoom: (ratio: number) => void;
  onSelectDevice: (deviceId: string) => void;
}): React.ReactElement {
  const rear = facing === 'environment';
  return (
    <Sheet title="Camera and audio" visible={visible} onClose={onClose}>
      <Text style={styles.label}>Camera</Text>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onFacing('user')}
          style={[styles.choice, !rear && styles.choiceSelected]}>
          <Text style={styles.choiceLabel}>Front</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => onFacing('environment')}
          style={[styles.choice, rear && styles.choiceSelected]}>
          <Text style={styles.choiceLabel}>Rear</Text>
        </Pressable>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Torch</Text>
        <Switch value={torch} disabled={!rear} onValueChange={onTorch} />
      </View>
      <Text style={styles.muted}>
        {rear ? 'Torch uses the rear camera.' : 'Switch to the rear camera before turning the torch on.'}
      </Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      <View style={styles.block}>
        <Text style={styles.label}>Zoom {zoom.toFixed(1)}x</Text>
        <Slider
          minimumValue={1}
          maximumValue={4}
          step={0.1}
          value={zoom}
          minimumTrackTintColor={call.accent}
          maximumTrackTintColor={call.line}
          onSlidingComplete={onZoom}
        />
      </View>
      <Text style={styles.label}>Audio output</Text>
      {devices.length === 0 ? <Text style={styles.muted}>No devices reported yet.</Text> : null}
      {devices.map(device => {
        const selected = device.deviceId === selectedDeviceId;
        return (
          <Pressable
            key={device.deviceId}
            onPress={() => onSelectDevice(device.deviceId)}
            style={[styles.device, selected && styles.deviceSelected]}>
            <Text style={styles.deviceLabel}>{device.label}</Text>
            <Text style={styles.muted}>{device.kind}</Text>
          </Pressable>
        );
      })}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8},
  choice: {
    flex: 1,
    borderWidth: 1,
    borderColor: call.line,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  choiceSelected: {borderColor: call.accent},
  choiceLabel: {color: call.text, fontWeight: '700'},
  note: {color: '#ffd7df'},
  block: {gap: 6},
  label: {color: call.text, fontWeight: '600'},
  muted: {color: call.muted},
  device: {
    borderWidth: 1,
    borderColor: call.line,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  deviceSelected: {borderColor: call.accent},
  deviceLabel: {color: call.text},
});
