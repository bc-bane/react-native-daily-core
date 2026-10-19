import {getHostComponent, NitroModules} from 'react-native-nitro-modules';
import type {ComponentType} from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import type {DailyCallClientBridge} from './specs/DailyCallClientBridge.nitro';
import type {DailyVideoViewProps} from './specs/DailyVideoView.nitro';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import DailyVideoViewConfig from '../nitrogen/generated/shared/json/DailyVideoViewConfig.json';

export interface DailyCallClientEvent {
  clientId: number;
  type: string;
  payload: unknown;
}

export interface DailyAudioLevel {
  clientId: number;
  audioLevel: number;
  participantId: string;
}

export interface DailyCallClientNativeModule {
  createClient(): Promise<number>;
  destroyClient(clientId: number): void;
  perform(clientId: number, action: string, payloadJson: string): Promise<string>;
}

export interface DailyVideoViewComponentProps extends DailyVideoViewProps {
  pointerEvents?: 'none' | 'box-none' | 'box-only' | 'auto';
  style?: StyleProp<ViewStyle>;
}

let bridge: DailyCallClientBridge | null = null;
const eventSubscribers = new Set<(event: DailyCallClientEvent) => void>();
const audioLevelSubscribers = new Set<(level: DailyAudioLevel) => void>();
const remoteAudioLevelSubscribers = new Set<
  (update: {clientId: number; levels: {[id: string]: number}}) => void
>();
let eventListenerInstalled = false;
let audioLevelListenerInstalled = false;
let remoteAudioLevelsListenerInstalled = false;

function getBridge(): DailyCallClientBridge {
  if (bridge === null) {
    bridge = NitroModules.createHybridObject<DailyCallClientBridge>('DailyCallClientBridge');
    ensureEventListener();
    ensureAudioLevelListener();
    ensureRemoteAudioLevelsListener();
  }
  return bridge;
}

function ensureEventListener(): void {
  if (eventListenerInstalled) {
    return;
  }
  getBridge().setEventListener(event => {
    let payload: unknown = {};
    try {
      payload = event.payloadJson ? JSON.parse(event.payloadJson) : {};
    } catch {
      return;
    }
    const parsed = {clientId: event.clientId, type: event.type, payload};
    eventSubscribers.forEach(handler => {
      try {
        handler(parsed);
      } catch {
        // One subscriber must not drop the event for the others.
      }
    });
  });
  eventListenerInstalled = true;
}

function ensureAudioLevelListener(): void {
  if (audioLevelListenerInstalled) {
    return;
  }
  getBridge().setAudioLevelListener((clientId, audioLevel, participantId) => {
    const level = {clientId, audioLevel, participantId};
    audioLevelSubscribers.forEach(handler => {
      try {
        handler(level);
      } catch {
        // One subscriber must not drop the level for the others.
      }
    });
  });
  audioLevelListenerInstalled = true;
}

function ensureRemoteAudioLevelsListener(): void {
  if (remoteAudioLevelsListenerInstalled) {
    return;
  }
  getBridge().setRemoteAudioLevelsListener((clientId, levelsJson) => {
    let levels: {[id: string]: number} = {};
    try {
      levels = levelsJson ? (JSON.parse(levelsJson) as {[id: string]: number}) : {};
    } catch {
      return;
    }
    const update = {clientId, levels};
    remoteAudioLevelSubscribers.forEach(handler => {
      try {
        handler(update);
      } catch {
        // One subscriber must not drop the batch for the others.
      }
    });
  });
  remoteAudioLevelsListenerInstalled = true;
}

export function getNativeDailyCallClientModule(): DailyCallClientNativeModule {
  return getBridge();
}

export function subscribeDailyAudioLevels(
  handler: (level: DailyAudioLevel) => void,
): {remove(): void} {
  ensureAudioLevelListener();
  audioLevelSubscribers.add(handler);
  return {
    remove: () => {
      audioLevelSubscribers.delete(handler);
    },
  };
}

export function subscribeDailyRemoteAudioLevels(
  handler: (update: {clientId: number; levels: {[id: string]: number}}) => void,
): {remove(): void} {
  ensureRemoteAudioLevelsListener();
  remoteAudioLevelSubscribers.add(handler);
  return {
    remove: () => {
      remoteAudioLevelSubscribers.delete(handler);
    },
  };
}

export function subscribeDailyCallClientEvents(
  handler: (event: DailyCallClientEvent) => void,
): {remove(): void} {
  ensureEventListener();
  eventSubscribers.add(handler);
  return {
    remove: () => {
      eventSubscribers.delete(handler);
    },
  };
}

export const DailyVideoView: ComponentType<DailyVideoViewComponentProps> =
  getHostComponent<DailyVideoViewComponentProps, Record<string, never>>(
    'DailyVideoView',
    () => DailyVideoViewConfig,
  );
