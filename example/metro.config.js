const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

// metro-config no longer exports this subpath; load the file directly.
const exclusionList = require(path.join(
  __dirname,
  'node_modules/metro-config/src/defaults/exclusionList.js',
)).default;

const libraryNodeModules = path.resolve(__dirname, '..', 'node_modules');

const config = {
  watchFolders: [path.resolve(__dirname, '..')],
  resolver: {
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
    extraNodeModules: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-native': path.resolve(__dirname, 'node_modules/react-native'),
    },
    blockList: exclusionList([
      new RegExp(`${libraryNodeModules}/react/.*`),
      new RegExp(`${libraryNodeModules}/react-native/.*`),
    ]),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
