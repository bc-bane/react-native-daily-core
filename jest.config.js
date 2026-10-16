module.exports = {
  watchman: false,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  modulePathIgnorePatterns: ['<rootDir>/example', '<rootDir>/dist'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          strict: true,
          jsx: 'react-native',
          types: ['jest', 'node'],
        },
      },
    ],
  },
};
