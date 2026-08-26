import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'node:util';

// jsdom lacks some browser APIs that the app code and antd rely on
const g = globalThis as Record<string, unknown>;

if (!g.TextEncoder) g.TextEncoder = TextEncoder;
if (!g.TextDecoder) g.TextDecoder = TextDecoder;

if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// antd's Select (and, once it exists, React's scheduler) posts a macrotask
// through a MessageChannel, which jsdom does not provide. A timer-backed
// stand-in covers the `port1.onmessage` / `port2.postMessage` pair they use;
// Node's real ports would keep the jest worker alive after the tests
if (!g.MessageChannel) {
  type PortMessageT = { data: unknown };
  g.MessageChannel = class {
    port1: { onmessage: ((event: PortMessageT) => void) | null; close: () => void } = {
      onmessage: null,
      close: () => {},
    };
    port2 = {
      postMessage: (data: unknown) => {
        setTimeout(() => this.port1.onmessage?.({ data }), 0);
      },
      close: () => {},
    };
  };
}
