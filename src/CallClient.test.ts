import type {Participant} from './types';

const listeners: Array<(event: {clientId: number; type: string; payload: unknown}) => void> = [];

const native = {
  createClient: jest.fn(async () => 7),
  destroyClient: jest.fn(),
  perform: jest.fn(
    async (_clientId: number, _action: string, _payloadJson: string) => '{}',
  ),
};

jest.mock('./NitroDailyCallClient', () => ({
  __esModule: true,
  getNativeDailyCallClientModule: () => native,
  subscribeDailyCallClientEvents: (
    handler: (event: {clientId: number; type: string; payload: unknown}) => void,
  ) => {
    listeners.push(handler);
    return {
      remove: () => {
        const index = listeners.indexOf(handler);
        if (index >= 0) {
          listeners.splice(index, 1);
        }
      },
    };
  },
  subscribeDailyAudioLevels: () => ({remove() {}}),
  subscribeDailyRemoteAudioLevels: () => ({remove() {}}),
}));

import {CallClient} from './CallClient';

function participant(id: string, userName: string): Participant {
  return {
    id,
    info: {isLocal: id === 'local', isOwner: false, userId: null, userName},
    media: null,
  };
}

function emit(clientId: number, type: string, payload: unknown): void {
  listeners.forEach(listener => listener({clientId, type, payload}));
}

async function createCall(): Promise<CallClient> {
  return CallClient.create();
}

describe('CallClient cache', () => {
  beforeEach(() => {
    listeners.splice(0, listeners.length);
    native.createClient.mockClear();
    native.destroyClient.mockClear();
    native.perform.mockReset();
    native.perform.mockResolvedValue('{}');
  });

  test('join and leave refetch participants; local stays an object after leave', async () => {
    const local = participant('local', 'Ada');
    let snapshotCalls = 0;
    native.perform.mockImplementation(async (_id: number, action: string) => {
      if (action === 'snapshot') {
        snapshotCalls += 1;
        if (snapshotCalls === 1) {
          return JSON.stringify({
            callState: 'initialized',
            participants: {local, all: {}},
          });
        }
        return JSON.stringify({
          callState: 'left',
          participants: {local, all: {local}},
        });
      }
      if (action === 'join') {
        return JSON.stringify({
          callState: 'joined',
          participants: {local, all: {local}},
        });
      }
      if (action === 'leave') {
        return JSON.stringify({});
      }
      return '{}';
    });

    const call = await createCall();
    expect(call.callState()).toBe('initialized');
    await call.join({url: 'https://example.daily.co/room'});
    expect(call.callState()).toBe('joined');
    expect(call.participants().all.local?.info.userName).toBe('Ada');

    await call.leave();
    expect(call.callState()).toBe('left');
    expect(call.participants().local?.info.userName).toBe('Ada');
    expect(call.subscriptions()).toEqual({});
  });

  test('participant events update participants().all', async () => {
    const call = await createCall();
    const remote = participant('remote', 'Grace');
    emit(call.id, 'participantJoined', remote);
    expect(call.participants().all.remote?.info.userName).toBe('Grace');

    emit(call.id, 'participantUpdated', participant('remote', 'Grace Hopper'));
    expect(call.participants().all.remote?.info.userName).toBe('Grace Hopper');

    emit(call.id, 'participantLeft', {
      participant: remote,
      reason: 'leftCall',
    });
    expect(call.participants().all.remote).toBeUndefined();
  });

  test('input, publishing, and subscription events update the getters', async () => {
    const call = await createCall();
    emit(call.id, 'inputsUpdated', {
      camera: {isEnabled: true},
      microphone: {isEnabled: false},
      screenVideo: {isEnabled: false},
    });
    expect(call.inputs().camera.isEnabled).toBe(true);

    emit(call.id, 'publishingUpdated', {
      camera: {isPublishing: true},
      microphone: {isPublishing: false},
      screenVideo: {isPublishing: false},
    });
    expect(call.publishing().camera.isPublishing).toBe(true);

    emit(call.id, 'subscriptionsUpdated', {
      remote: {
        profile: 'base',
        media: {camera: 'subscribed', microphone: 'unsubscribed'},
      },
    });
    expect(call.subscriptions().remote?.profile).toBe('base');
    expect(call.subscriptions().remote?.media.camera).toBe('subscribed');

    emit(call.id, 'subscriptionProfilesUpdated', {
      base: {camera: 'subscribed', microphone: 'staged'},
    });
    expect(call.subscriptionProfiles().base?.microphone).toBe('staged');
  });

  test('release ignores later events', async () => {
    const call = await createCall();
    const handler = listeners[0];
    call.release();
    expect(native.destroyClient).toHaveBeenCalledWith(call.id);
    handler?.({
      clientId: call.id,
      type: 'participantJoined',
      payload: participant('remote', 'Grace'),
    });
    expect(call.participants().all).toEqual({});
    expect(call.callState()).toBe('initialized');
  });

  test('release during in-flight perform rejects late snapshot application', async () => {
    const local = participant('local', 'Ada');
    let resolveJoin: ((value: string) => void) | undefined;
    native.perform.mockImplementation(
      (_id: number, action: string) =>
        new Promise<string>(resolve => {
          if (action === 'join') {
            resolveJoin = resolve;
            return;
          }
          resolve('{}');
        }),
    );

    const call = await createCall();
    const joinPromise = call.join({url: 'https://example.daily.co/room'});
    call.release();
    resolveJoin?.(
      JSON.stringify({
        callState: 'joined',
        participants: {local, all: {local}},
      }),
    );
    await expect(joinPromise).rejects.toThrow('CallClient has been released');
    expect(call.callState()).toBe('initialized');
  });

  test('perform after release throws', async () => {
    const call = await createCall();
    call.release();
    await expect(call.join({url: 'https://example.daily.co/room'})).rejects.toThrow(
      'CallClient has been released',
    );
  });

  test('native payload parity fixtures update cache consistently', async () => {
    const call = await createCall();
    emit(call.id, 'participantLeft', {
      participant: participant('remote', 'Grace'),
      reason: 'leftCall',
    });
    emit(call.id, 'transcriptionStopped', {stoppedByError: true});
    emit(call.id, 'callStateUpdated', {state: 'joined'});
    expect(call.callState()).toBe('joined');
  });
});
