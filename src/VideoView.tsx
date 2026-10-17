import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {DailyVideoView} from './ExpoDailyCallClient';
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
    <DailyVideoView
      clientId={client.id}
      participantId={participantId}
      videoSource={videoSource}
      mirror={mirror}
      objectFit={objectFit}
      pointerEvents="none"
      style={style}
    />
  );
}
