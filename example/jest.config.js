module.exports = {
  preset: 'react-native',
  moduleNameMapper: {
    '^react-native-daily-core$': '<rootDir>/../src/index.ts',
    '^react-native$': '<rootDir>/node_modules/react-native',
    '^react$': '<rootDir>/node_modules/react',
  },
};
