module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?expo(nent)?|@expo(nent)?/.*|expo-modules-core|expo-router|@react-native|react-native|@react-navigation/.*|@testing-library/react-native|@react-native-async-storage/async-storage)/',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
};
