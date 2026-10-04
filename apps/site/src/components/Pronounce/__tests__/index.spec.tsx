/**
 * @jest-environment jsdom
 */

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

// react-dom warns without this, since it defaults to assuming a non-test environment
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
}));

import { Pronounce } from '../index';

class FakeUtterance {
  text: string;
  voice: unknown = null;
  lang = '';
  rate = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

const makeSpeechSynthesis = () => ({
  getVoices: () => [{ lang: 'en-US', localService: true, name: 'Test Voice' }],
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  cancel: jest.fn(),
  speak: jest.fn((utterance: FakeUtterance) => utterance.onstart?.()),
});

describe('Pronounce (issue #548)', () => {
  let container: HTMLDivElement;
  let root: Root;
  let speechSynthesis: ReturnType<typeof makeSpeechSynthesis>;

  beforeEach(() => {
    (window as unknown as { SpeechSynthesisUtterance: typeof FakeUtterance }).SpeechSynthesisUtterance =
      FakeUtterance;
    speechSynthesis = makeSpeechSynthesis();
    Object.defineProperty(window, 'speechSynthesis', {
      value: speechSynthesis,
      writable: true,
      configurable: true,
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('stops speech owned by a component that is removed before it finishes', () => {
    act(() => {
      root.render(<Pronounce word="hello" />);
    });

    const button = container.querySelector('button');
    expect(button).not.toBeNull();

    act(() => {
      button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    // the click itself cancels whatever else might be speaking, then speaks
    expect(speechSynthesis.cancel).toHaveBeenCalledTimes(1);
    expect(speechSynthesis.speak).toHaveBeenCalledTimes(1);

    const cancelCallsBeforeRemoval = speechSynthesis.cancel.mock.calls.length;

    // Simulates client-side navigation away from the word page while speech
    // started by this button is still ongoing
    act(() => {
      root.unmount();
    });

    expect({
      stoppedSpeechOnRemoval: speechSynthesis.cancel.mock.calls.length > cancelCallsBeforeRemoval,
    }).toEqual({ stoppedSpeechOnRemoval: true });
  });

  it('keeps reporting its speaking state after Strict Mode double-invokes the mount effect', () => {
    act(() => {
      root.render(
        <React.StrictMode>
          <Pronounce word="hello" />
        </React.StrictMode>,
      );
    });

    const button = container.querySelector('button');
    expect(button).not.toBeNull();

    act(() => {
      button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // In development, Strict Mode mounts, cleans up and mounts the effect
    // again right away; the "mounted" flag the cleanup relies on must come
    // back to true, or the speaking indicator breaks for the rest of the
    // component's life (issue #548)
    expect(button!.getAttribute('data-speaking')).toBe('true');
  });

  it('ignores a late utterance callback that fires after the component is removed', () => {
    let utterance: FakeUtterance | undefined;
    speechSynthesis.speak.mockImplementationOnce((u: FakeUtterance) => {
      utterance = u;
      u.onstart?.();
    });

    act(() => {
      root.render(<Pronounce word="hello" />);
    });
    const button = container.querySelector('button');

    act(() => {
      button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(button!.getAttribute('data-speaking')).toBe('true');

    act(() => {
      root.unmount();
    });
    expect(speechSynthesis.cancel).toHaveBeenCalledTimes(2);

    // A late 'end' event, e.g. fired by the browser after the component's
    // own cleanup already ran, must not throw, update any still-mounted
    // component, or cancel speech again (ownership was already released)
    expect(() => act(() => utterance!.onend?.())).not.toThrow();
    expect(speechSynthesis.cancel).toHaveBeenCalledTimes(2);
  });

  it('does not cancel speech owned by another pronunciation button on unmount', () => {
    const containerA = document.createElement('div');
    const containerB = document.createElement('div');
    document.body.append(containerA, containerB);
    const rootA = createRoot(containerA);
    const rootB = createRoot(containerB);

    act(() => {
      rootA.render(<Pronounce word="hello" />);
      rootB.render(<Pronounce word="world" />);
    });

    const buttonA = containerA.querySelector('button');
    const buttonB = containerB.querySelector('button');
    expect(buttonA).not.toBeNull();
    expect(buttonB).not.toBeNull();

    // B starts speaking first, then A takes over the shared speech synthesis
    act(() => {
      buttonB!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    act(() => {
      buttonA!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(speechSynthesis.speak).toHaveBeenCalledTimes(2);
    expect(speechSynthesis.cancel).toHaveBeenCalledTimes(2);

    // B's section of the page goes away while A is still speaking
    act(() => {
      rootB.unmount();
    });
    expect(speechSynthesis.cancel).toHaveBeenCalledTimes(2);

    // A is still the owner, so its own removal does stop speech
    act(() => rootA.unmount());
    expect(speechSynthesis.cancel).toHaveBeenCalledTimes(3);

    containerA.remove();
    containerB.remove();
  });
});
