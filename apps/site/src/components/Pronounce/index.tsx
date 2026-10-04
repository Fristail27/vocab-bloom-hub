'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { claimUtterance, pickEnglishVoice, releaseUtterance, stopIfOwner } from '@/core/speech';

import styles from './styles.module.scss';

type PronounceP = {
  /** The exact text to say: the headword or one inflected form */
  word: string;
  small?: boolean;
};

/**
 * A speaker button that pronounces the word with the browser's own speech
 * synthesis (issue #329): no backend, no audio files. Renders nothing until
 * an English voice is known to exist, so browsers without one (or without
 * the API) simply show no button
 */
export const Pronounce = ({ word, small }: PronounceP) => {
  const t = useTranslations('word');
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [speaking, setSpeaking] = useState(false);
  // Tracks the utterance this instance last started, so its cleanup can stop
  // only its own speech (issue #548) and late callbacks can skip setState
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    // Strict Mode re-runs this effect after invoking its cleanup once
    mountedRef.current = true;
    const load = () => setVoice(pickEnglishVoice(window.speechSynthesis.getVoices()));
    load();
    // Chrome populates the voice list asynchronously
    window.speechSynthesis.addEventListener('voiceschanged', load);

    return () => {
      mountedRef.current = false;
      window.speechSynthesis.removeEventListener('voiceschanged', load);
      if (utteranceRef.current) stopIfOwner(utteranceRef.current, window.speechSynthesis);
    };
  }, []);

  if (!voice) return null;

  const speak = () => {
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 0.9;
    utterance.onstart = () => {
      if (mountedRef.current) setSpeaking(true);
    };
    utterance.onend = () => {
      releaseUtterance(utterance);
      if (mountedRef.current) setSpeaking(false);
    };
    utterance.onerror = () => {
      releaseUtterance(utterance);
      if (mountedRef.current) setSpeaking(false);
    };
    utteranceRef.current = utterance;
    window.speechSynthesis.cancel();
    claimUtterance(utterance);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <button
      type="button"
      className={`${styles.button} ${small ? styles.small : ''}`}
      onClick={speak}
      aria-label={t('pronounce', { word })}
      title={t('pronounce', { word })}
      data-speaking={speaking || undefined}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 2.5a.5.5 0 0 0-.85-.35L4.29 5H2a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h2.29l2.86 2.85A.5.5 0 0 0 8 13.5v-11z" />
        <path d="M10.6 5.3a.5.5 0 0 0-.7.7 2.83 2.83 0 0 1 0 4 .5.5 0 1 0 .7.7 3.83 3.83 0 0 0 0-5.4z" />
        <path d="M12.4 3.2a.5.5 0 1 0-.7.7 5.66 5.66 0 0 1 0 8.2.5.5 0 1 0 .7.7 6.66 6.66 0 0 0 0-9.6z" />
      </svg>
    </button>
  );
};
