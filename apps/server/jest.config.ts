export default {
  displayName: 'server',
  testMatch: ['<rootDir>/**/*.spec.ts'],
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
          types: ['jest', 'node'],
          rootDir: './', // ← фиксирует ошибку TS5011
          ignoreDeprecations: '6.0', // ← глушит предупреждения об устаревших опциях
        },
      },
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testEnvironment: 'node',
};
