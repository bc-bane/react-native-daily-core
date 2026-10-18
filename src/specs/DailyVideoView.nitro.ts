import type {HybridView, HybridViewProps} from 'react-native-nitro-modules';

export interface DailyVideoViewProps extends HybridViewProps {
  clientId: number;
  participantId: string;
  videoSource: string;
  mirror?: boolean;
  objectFit?: string;
}

export type DailyVideoView = HybridView<DailyVideoViewProps>;
