import {requireNativeModule, requireNativeViewManager} from 'expo-modules-core';
import type {ComponentType} from 'react';
import type {StyleProp, ViewStyle} from 'react-native';

export interface DailyCallClientNativeModule {
  createClient(): Promise<number>;
  destroyClient(clientId: number): void;
  perform(clientId: number, action: string, payloadJson: string): Promise<string>;
  addListener(eventName: string, listener: (event: any) => void): {remove(): void};
}

export interface DailyVideoViewProps {
  clientId: number;
  participantId: string;
  videoSource: string;
  mirror?: boolean;
  objectFit?: string;
  pointerEvents?: 'none' | 'box-none' | 'box-only' | 'auto';
  style?: StyleProp<ViewStyle>;
}

let nativeModule: DailyCallClientNativeModule | null = null;

export function getNativeDailyCallClientModule(): DailyCallClientNativeModule {
  if (nativeModule === null) {
    nativeModule = requireNativeModule<DailyCallClientNativeModule>('DailyCallClient');
  }
  return nativeModule;
}

export function getDailyCallClientEventEmitter(): DailyCallClientNativeModule {
  return getNativeDailyCallClientModule();
}

export const DailyVideoView: ComponentType<DailyVideoViewProps> =
  requireNativeViewManager<DailyVideoViewProps>('DailyCallClient', 'DailyVideoView');
