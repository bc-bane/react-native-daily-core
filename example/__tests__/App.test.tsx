/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  const NativeEventEmitter = jest.fn().mockImplementation(() => ({
    addListener: () => ({remove: () => undefined}),
  }));
  return new Proxy(actual, {
    get(target, prop, receiver) {
      if (prop === 'NativeEventEmitter') {
        return NativeEventEmitter;
      }
      return Reflect.get(target, prop, receiver);
    },
  });
});

jest.mock('../../src/DailyVideoViewNativeComponent', () => {
  const React = require('react');
  const {View} = require('react-native');
  return {
    __esModule: true,
    default: (props: object) => React.createElement(View, props),
  };
});

jest.mock('../../src/NativeDailyCallClient', () => ({
  __esModule: true,
  default: {
    createClient: () => 1,
    destroyClient: () => undefined,
    perform: () => Promise.resolve('{}'),
    addListener: () => undefined,
    removeListeners: () => undefined,
  },
}));

import App from '../App';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
