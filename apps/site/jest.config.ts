export default {
  displayName: 'site',
  testMatch: ['<rootDir>/**/*.spec.tsx', '<rootDir>/**/*.spec.ts'],
  transform: {
    '^.+\\.(t|j)sx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          esModuleInterop: true,
          types: ['jest', 'node'],
          rootDir: './',
        },
      },
    ],
  },
  testEnvironment: 'node',
  // the standalone build output copies the traced files under .next
  testPathIgnorePatterns: ['/node_modules/', '/\\.next/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|scss|module\\.css|module\\.scss)$': 'identity-obj-proxy',
  },
};
