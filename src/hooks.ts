import {useEffect, useState} from 'react';
import type {CallClient} from './CallClient';
import type {CallState, Participant, Participants} from './types';

/** Subscribe to call state for React Compiler–friendly function components. */
export function useCallState(call: CallClient | null): CallState {
  const [state, setState] = useState<CallState>(
    () => call?.callState() ?? 'initialized',
  );

  useEffect(() => {
    if (!call) {
      return;
    }
    const refresh = () => setState(call.callState());
    refresh();
    call.on('callStateUpdated', refresh);
    return () => {
      call.off('callStateUpdated', refresh);
    };
  }, [call]);

  return state;
}

/** Subscribe to participants for React Compiler–friendly function components. */
export function useParticipants(call: CallClient | null): Participants {
  const [participants, setParticipants] = useState<Participants>(
    () => call?.participants() ?? {local: null, all: {}},
  );

  useEffect(() => {
    if (!call) {
      return;
    }
    const refresh = () => setParticipants(call.participants());
    refresh();
    call.on('callStateUpdated', refresh);
    call.on('participantJoined', refresh);
    call.on('participantUpdated', refresh);
    call.on('participantLeft', refresh);
    return () => {
      call.off('callStateUpdated', refresh);
      call.off('participantJoined', refresh);
      call.off('participantUpdated', refresh);
      call.off('participantLeft', refresh);
    };
  }, [call]);

  return participants;
}

/** Remote participant list derived from {@link useParticipants}. */
export function useRemoteParticipants(call: CallClient | null): Participant[] {
  const {all} = useParticipants(call);
  return Object.values(all).filter(p => !p.info.isLocal);
}
