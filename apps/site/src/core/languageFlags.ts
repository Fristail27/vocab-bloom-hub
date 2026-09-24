// The flag shown next to a translation (issue #520): the same choice as the
// README's language links — a country's flag where the language has an
// obvious one, the globe for Arabic, which is spoken under many
const LANGUAGE_FLAGS: Record<string, string> = {
  en: '🇺🇸',
  ru: '🇷🇺',
  es: '🇪🇸',
  fr: '🇫🇷',
  de: '🇩🇪',
  pt: '🇵🇹',
  zh: '🇨🇳',
  ar: '🌐',
};

/** The flag of a language code; the globe for one the dictionary may add later */
export const flagOf = (language: string): string => LANGUAGE_FLAGS[language] ?? '🌐';
