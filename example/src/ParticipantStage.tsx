import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {VideoView, type CallClient} from 'react-native-daily-core';
import type {Participant} from 'react-native-daily-core';
import {call} from './theme';

export function ParticipantStage({
  client,
  stage,
  strip,
  local,
  activeSpeakerId,
  levels,
  selectedId,
  onSelect,
}: {
  client: CallClient;
  stage: Participant | null;
  strip: Participant[];
  local: Participant | null;
  activeSpeakerId: string | null;
  levels: {[id: string]: number};
  selectedId: string | null;
  onSelect: (id: string) => void;
}): React.ReactElement {
  return (
    <View style={styles.stage}>
      {stage ? (
        <Tile
          client={client}
          participant={stage}
          large
          speaking={stage.id === activeSpeakerId || (levels[stage.id] ?? 0) > 0.08}
          selected={stage.id === selectedId}
          onPress={() => onSelect(stage.id)}
        />
      ) : (
        <View style={styles.waiting}>
          <Text style={styles.waitingText}>Waiting for others to join</Text>
        </View>
      )}
      {local && stage?.id !== local.id ? (
        <View style={styles.pip}>
          <Tile client={client} participant={local} mirror speaking={local.id === activeSpeakerId} />
        </View>
      ) : null}
      {strip.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={styles.stripContent}>
          {strip.map(participant => (
            <Pressable key={participant.id} style={styles.stripItem} onPress={() => onSelect(participant.id)}>
              <Tile
                client={client}
                participant={participant}
                speaking={participant.id === activeSpeakerId}
                selected={participant.id === selectedId}
              />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

function Tile({
  client,
  participant,
  large,
  mirror,
  speaking,
  selected,
  onPress,
}: {
  client: CallClient;
  participant: Participant;
  large?: boolean;
  mirror?: boolean;
  speaking?: boolean;
  selected?: boolean;
  onPress?: () => void;
}): React.ReactElement {
  const screenOn = participant.media?.screenVideo.state === 'playable';
  const cameraOff = participant.media?.camera.state === 'off' || participant.media?.camera.state === 'blocked';
  const micOff = participant.media?.microphone.state === 'off';
  const name = participant.info.userName || (participant.info.isLocal ? 'You' : 'Guest');
  return (
    <Pressable onPress={onPress} style={[styles.tile, large && styles.tileLarge, speaking && styles.speaking, selected && styles.selected]}>
      {cameraOff && !screenOn ? (
        <View style={styles.placeholder}>
          <Text style={styles.initial}>{name.slice(0, 1).toUpperCase()}</Text>
        </View>
      ) : screenOn && participant.info.isLocal ? (
        <View style={styles.placeholder}>
          <Text style={styles.sharing}>Sharing your screen</Text>
        </View>
      ) : (
        <VideoView
          client={client}
          participantId={participant.id}
          videoSource={screenOn ? 'screenVideo' : 'camera'}
          mirror={Boolean(mirror && participant.info.isLocal && !screenOn)}
          objectFit={screenOn ? 'contain' : 'cover'}
          style={styles.video}
        />
      )}
      <View style={styles.nameRow}>
        {micOff ? <Ionicons name="mic-off" size={12} color="#fff" /> : null}
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stage: {flex: 1, overflow: 'hidden', zIndex: 0},
  waiting: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  waitingText: {color: call.muted, fontSize: 16},
  tile: {
    flex: 1,
    backgroundColor: call.tile,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tileLarge: {margin: 12},
  speaking: {borderColor: call.good},
  selected: {borderColor: call.accent},
  video: {flex: 1},
  placeholder: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  initial: {color: call.text, fontSize: 42, fontWeight: '700'},
  sharing: {color: call.text, fontSize: 16, fontWeight: '600', textAlign: 'center', paddingHorizontal: 16},
  nameRow: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  name: {color: '#fff', fontWeight: '600', maxWidth: 140},
  pip: {
    position: 'absolute',
    right: 16,
    top: 16,
    width: 112,
    height: 156,
  },
  strip: {maxHeight: 120, marginBottom: 8},
  stripContent: {paddingHorizontal: 12, gap: 8},
  stripItem: {width: 88, height: 112},
});
