jest.mock('@/core/dictionary', () => ({ fetchRandomWord: jest.fn() }));

import { fetchRandomWord } from '@/core/dictionary';
import { GET } from '../route';

const context = (locale: string) => ({ params: Promise.resolve({ locale }) });

describe('/[locale]/word/random', () => {
  // behind a reverse proxy the standalone server sees its own address in the
  // request URL: an absolute Location built from it sent visitors to localhost
  it('redirects with a relative Location, whatever host the request names', async () => {
    (fetchRandomWord as jest.Mock).mockResolvedValue('give up');
    const res = await GET(new Request('http://localhost:3020/en/word/random'), context('en'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('/en/word/give%20up');
    expect(res.headers.get('location')).not.toContain('localhost');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('falls back to the word index of the locale when the API gives no word', async () => {
    (fetchRandomWord as jest.Mock).mockResolvedValue(null);
    const res = await GET(new Request('http://localhost:3020/ar/word/random'), context('ar'));

    expect(res.headers.get('location')).toBe('/ar/word');
  });
});
