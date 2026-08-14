export default {
  displayName: 'frontend',
  testMatch: ['<rootDir>/**/*.spec.tsx', '<rootDir>/**/*.spec.ts'],
  transform: {
    '^.+\\.(t|j)sx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          esModuleInterop: true,
          types: ['jest', 'node'],
          rootDir: './', // fixes TS5011, same as in the server config
        },
      },
    ],
  },
  testEnvironment: 'jsdom', // ← для React компонентов
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1', // алиас Next.js
    // @ant-design/icons requires the ESM build of colors from CJS; point it to the CJS build
    '^@ant-design/colors/es/(.*)$': '@ant-design/colors/lib/$1',
    '\\.(css|scss|module\\.css|module\\.scss)$': 'identity-obj-proxy', // мок стилей
  },
};
