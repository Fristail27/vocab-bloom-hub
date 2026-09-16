import { extractSection } from '../sections';

const readme = [
  '# Project',
  '',
  'Intro.',
  '',
  '## 📖 What it is',
  '',
  'Text.',
  '',
  '## ⚡ Getting started',
  '',
  '### Quick start with Docker',
  '',
  'Docker text.',
  '',
  '#### A sub-subsection',
  '',
  '### Native start',
  '',
  'Native text.',
  '',
  '## 🤝 Contributing',
  '',
  'Contributing text.',
].join('\n');

describe('extractSection (a README section as a docs page, issue #440)', () => {
  it('cuts the section out and promotes its headings one level', () => {
    expect(extractSection(readme, /^## ⚡ /)).toBe(
      [
        '# ⚡ Getting started',
        '',
        '## Quick start with Docker',
        '',
        'Docker text.',
        '',
        '### A sub-subsection',
        '',
        '## Native start',
        '',
        'Native text.',
      ].join('\n'),
    );
  });

  it('runs to the end of the file when the section is the last one', () => {
    expect(extractSection(readme, /^## 🤝 /)).toBe('# 🤝 Contributing\n\nContributing text.');
  });

  it('answers null when no heading matches', () => {
    expect(extractSection(readme, /^## Roadmap/)).toBeNull();
  });
});
