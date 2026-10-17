import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {call} from './theme';

export function ControlBar({
  microphoneOn,
  cameraOn,
  screenSharing,
  chatUnread,
  onToggleMicrophone,
  onToggleCamera,
  onToggleScreenShare,
  onOpenCamera,
  onOpenChat,
  onOpenMore,
  onLeave,
}: {
  microphoneOn: boolean;
  cameraOn: boolean;
  screenSharing: boolean;
  chatUnread: boolean;
  onToggleMicrophone: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onOpenCamera: () => void;
  onOpenChat: () => void;
  onOpenMore: () => void;
  onLeave: () => void;
}): React.ReactElement {
  return (
    <View style={styles.bar}>
      <Round
        label={microphoneOn ? 'Mute' : 'Unmute'}
        icon={microphoneOn ? 'mic' : 'mic-off'}
        active={microphoneOn}
        onPress={onToggleMicrophone}
      />
      <Round
        label={cameraOn ? 'Stop video' : 'Start video'}
        icon={cameraOn ? 'videocam' : 'videocam-off'}
        active={cameraOn}
        onPress={onToggleCamera}
      />
      <Round
        label="Camera"
        icon="options"
        active={false}
        onPress={onOpenCamera}
      />
      <Round
        label={screenSharing ? 'Stop share' : 'Share'}
        icon="phone-portrait"
        active={screenSharing}
        onPress={onToggleScreenShare}
      />
      <Round label="Chat" icon="chatbubble" active={false} badge={chatUnread} onPress={onOpenChat} />
      <Round label="More" icon="ellipsis-horizontal" active={false} onPress={onOpenMore} />
      <Round label="Leave" icon="call" danger onPress={onLeave} />
    </View>
  );
}

function Round({
  label,
  icon,
  active,
  danger,
  badge,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  danger?: boolean;
  badge?: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.item}>
      <View style={[styles.button, danger && styles.danger, active === false && styles.off]}>
        <Ionicons name={icon} size={22} color="#fff" />
        {badge ? <View style={styles.badge} /> : null}
      </View>
      <Text style={styles.caption}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 4,
    zIndex: 2,
  },
  item: {alignItems: 'center', flex: 1, gap: 4},
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2c3646',
    alignItems: 'center',
    justifyContent: 'center',
  },
  off: {backgroundColor: '#3a4456'},
  danger: {backgroundColor: call.danger},
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: call.accent,
  },
  caption: {color: call.muted, fontSize: 10},
});
