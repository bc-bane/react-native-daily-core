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
  payloadJson: string;
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
let eventListenerInstalled = false;

function getBridge(): DailyCallClientBridge {
  if (bridge === null) {
    bridge = NitroModules.createHybridObject<DailyCallClientBridge>('DailyCallClientBridge');
    ensureEventListener();
  }
  return bridge;
}

function ensureEventListener(): void {
  if (eventListenerInstalled) {
    return;
  }
  getBridge().setEventListener(event => {
    eventSubscribers.forEach(handler => handler(event));
  });
  eventListenerInstalled = true;
}

export function getNativeDailyCallClientModule(): DailyCallClientNativeModule {
  return getBridge();
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
