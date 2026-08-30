import { extractSection } from '../sections';

const README = `# Title

## 🚀 Overview

Intro line.

---

## 🗺️ Roadmap

Planned directions:

- Semantic search
- More languages

---

## 🤝 Contributing
`;

describe('extractSection (one ## section of a Markdown file)', () => {
  it('returns the body between the heading and the next section or rule', () => {
    expect(extractSection(README, /Roadmap/)).toBe(
      'Planned directions:\n\n- Semantic search\n- More languages',
    );
  });

  it('matches the heading text regardless of the emoji in front', () => {
    expect(extractSection(README, /^🚀 Overview$/)).toBe('Intro line.');
  });

  it('is null when there is no such heading', () => {
    expect(extractSection(README, /Changelog/)).toBeNull();
  });
});
