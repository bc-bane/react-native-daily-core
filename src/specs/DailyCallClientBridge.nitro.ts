import type {HybridObject} from 'react-native-nitro-modules';

export interface DailyCallClientEvent {
  clientId: number;
  type: string;
  payloadJson: string;
}

export interface DailyCallClientBridge
  extends HybridObject<{ios: 'swift'; android: 'kotlin'}> {
  createClient(): Promise<number>;
  destroyClient(clientId: number): void;
  perform(
    clientId: number,
    action: string,
    payloadJson: string,
  ): Promise<string>;
  setEventListener(listener: (event: DailyCallClientEvent) => void): void;
}
