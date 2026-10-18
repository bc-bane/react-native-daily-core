import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const {View} = require('react-native');
  return {
    SafeAreaProvider: ({children}: {children?: React.ReactNode}) =>
      React.createElement(View, null, children),
    SafeAreaView: ({children, ...props}: {children?: React.ReactNode}) =>
      React.createElement(View, props, children),
    useSafeAreaInsets: () => ({top: 0, right: 0, bottom: 0, left: 0}),
  };
});

jest.mock('../../src/NitroDailyCallClient', () => {
  const React = require('react');
  const {View} = require('react-native');
  return {
    __esModule: true,
    DailyVideoView: (props: object) => React.createElement(View, props),
    getNativeDailyCallClientModule: () => ({
      createClient: () => Promise.resolve(1),
      destroyClient: () => undefined,
      perform: () => Promise.resolve('{}'),
    }),
    subscribeDailyCallClientEvents: () => ({remove: () => undefined}),
  };
});

import App from '../App';

test('renders the lobby', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  const json = JSON.stringify(tree!.toJSON());
  expect(json).toContain('Join');
});
