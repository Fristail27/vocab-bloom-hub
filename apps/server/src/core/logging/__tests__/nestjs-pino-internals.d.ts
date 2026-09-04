// nestjs-pino v5 fences its internals behind the package exports map, but the
// test-only reset of its root-logger singletons still ships in the dist. The
// logging e2e suite keeps using it: jest reaches the file through a
// moduleNameMapper (test/jest-e2e.json) and this declaration lets the
// TypeScript program accept the specifier.
declare module 'nestjs-pino/PinoLogger' {
  export function __resetOutOfContextForTests(): void;
}
