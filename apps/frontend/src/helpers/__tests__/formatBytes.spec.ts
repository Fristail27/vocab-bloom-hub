import { formatBytes } from '../formatBytes';

describe('formatBytes', () => {
  it('возвращает "0 B" для нуля', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('форматирует байты без масштабирования', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('масштабирует в KB/MB/GB', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1048576)).toBe('1 MB');
    expect(formatBytes(1073741824)).toBe('1 GB');
  });

  it('уважает параметр decimals', () => {
    expect(formatBytes(1555, 0)).toBe('2 KB');
    expect(formatBytes(1555, 3)).toBe('1.519 KB');
  });

  it('отбрасывает хвостовые нули после округления', () => {
    expect(formatBytes(1024, 2)).toBe('1 KB');
  });

  it('не добавляет единицу измерения при withCount=false', () => {
    expect(formatBytes(1536, 2, false)).toBe('1.5');
  });

  it('не выходит за пределы списка единиц на гигантских значениях', () => {
    expect(formatBytes(Math.pow(1024, 6))).toBe('1024 PB');
  });
});
