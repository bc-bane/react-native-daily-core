import type {ViewProps} from 'react-native';
import type {Int32} from 'react-native/Libraries/Types/CodegenTypes';
import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';

export interface NativeProps extends ViewProps {
  clientId: Int32;
  participantId: string;
  videoSource: string;
  mirror?: boolean;
  objectFit?: string;
}

export default codegenNativeComponent<NativeProps>('DailyVideoView');
