import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import DailyVideoViewNativeComponent from './DailyVideoViewNativeComponent';
import type {CallClient} from './CallClient';
import type {VideoSource} from './types';

export interface VideoViewProps {
  client: CallClient;
  participantId: string;
  videoSource?: VideoSource;
  mirror?: boolean;
  objectFit?: 'cover' | 'contain';
  style?: StyleProp<ViewStyle>;
}

export function VideoView({
  client,
  participantId,
  videoSource = 'camera',
  mirror = false,
  objectFit = 'cover',
  style,
}: VideoViewProps): React.ReactElement {
  return (
    <DailyVideoViewNativeComponent
      clientId={client.id}
      participantId={participantId}
      videoSource={videoSource}
      mirror={mirror}
      objectFit={objectFit}
      style={style}
    />
  );
}
