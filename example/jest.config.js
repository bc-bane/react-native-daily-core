module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^react-native-daily-core$': '<rootDir>/../src/index.ts',
    '^react$': '<rootDir>/node_modules/react',
    '^react/(.*)$': '<rootDir>/node_modules/react/$1',
    '^react-native$': '<rootDir>/node_modules/react-native',
  },
};
