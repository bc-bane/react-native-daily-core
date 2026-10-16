import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export interface Spec extends TurboModule {
  createClient(): Promise<number>;
  destroyClient(clientId: number): void;
  perform(
    clientId: number,
    action: string,
    payloadJson: string,
  ): Promise<string>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('DailyCallClient');
