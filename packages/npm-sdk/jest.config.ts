// The SDK suite boots the real server (apps/server AppModule on an in-memory
// SQLite database) and drives the client against it, so the transform needs
// the decorator options of the server suite
export default {
  displayName: 'sdk',
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test/setup.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'CommonJS',
          moduleResolution: 'node',
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          esModuleInterop: true,
          resolveJsonModule: true,
          types: ['jest', 'node'],
          rootDir: '../../',
          ignoreDeprecations: '6.0',
        },
      },
    ],
  },
};
