// Picking a voice for the pronunciation button (issue #329). Pure, so the
// preference order is testable without a browser

export type SpeechVoiceT = Pick<SpeechSynthesisVoice, 'lang' | 'localService' | 'name'>;

// some engines report en_US or EN-us
const normalize = (lang: string): string => lang.replace(/_/g, '-').toLowerCase();

const PREFERRED_LANGS = ['en-us', 'en-gb'];

/**
 * The voice to pronounce English with: en-US, then en-GB, then any other
 * English; a locally installed voice over a network one within the same
 * language. Null when the browser offers no English voice at all
 */
export const pickEnglishVoice = <T extends SpeechVoiceT>(voices: readonly T[]): T | null => {
  const english = voices.filter((voice) => normalize(voice.lang).startsWith('en'));
  if (english.length === 0) return null;

  const rank = (voice: T): number => {
    const lang = normalize(voice.lang);
    const preference = PREFERRED_LANGS.indexOf(lang);

    return (preference === -1 ? PREFERRED_LANGS.length : preference) * 2 + (voice.localService ? 0 : 1);
  };

  return [...english].sort((a, b) => rank(a) - rank(b))[0];
};
