import { getTitle } from '../utils';

describe('FormsOfWordLine/getTitle', () => {
  it('заменяет подчёркивания пробелами и капитализирует первую букву', () => {
    expect(getTitle('past_simple')).toBe('Past simple');
    expect(getTitle('third_person_singular')).toBe('Third person singular');
  });

  it('не меняет уже готовое слово, кроме первой буквы', () => {
    expect(getTitle('object')).toBe('Object');
  });
});
