import { pickEnglishVoice } from '../speech';

const voice = (lang: string, localService = true, name = lang) => ({ lang, localService, name });

describe('pickEnglishVoice (issue #329)', () => {
  it('prefers en-US, then en-GB, then any other English', () => {
    expect(pickEnglishVoice([voice('ru-RU'), voice('en-AU'), voice('en-GB'), voice('en-US')])?.lang).toBe(
      'en-US',
    );
    expect(pickEnglishVoice([voice('ru-RU'), voice('en-AU'), voice('en-GB')])?.lang).toBe('en-GB');
    expect(pickEnglishVoice([voice('ru-RU'), voice('en-AU')])?.lang).toBe('en-AU');
  });

  it('prefers a locally installed voice within the same language', () => {
    const local = voice('en-US', true, 'local');
    const network = voice('en-US', false, 'network');
    expect(pickEnglishVoice([network, local])?.name).toBe('local');
    // but a preferred language beats a local voice of a less preferred one
    expect(pickEnglishVoice([voice('en-GB', true), voice('en-US', false)])?.lang).toBe('en-US');
  });

  it('handles underscore and case variants some engines report', () => {
    expect(pickEnglishVoice([voice('ru_RU'), voice('EN_us')])?.lang).toBe('EN_us');
  });

  it('is null without an English voice — the button then stays hidden', () => {
    expect(pickEnglishVoice([])).toBeNull();
    expect(pickEnglishVoice([voice('ru-RU'), voice('de-DE')])).toBeNull();
  });
});
