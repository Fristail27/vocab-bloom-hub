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
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|scss|module\\.css|module\\.scss)$': 'identity-obj-proxy',
  },
};
