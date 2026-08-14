import { getInputStatus } from '../utils';
import { StatusOfWordPresenceE } from '../../../types';

describe('CheckingBasePhrasalVerb/getInputStatus', () => {
  it('возвращает "error" для отсутствующего слова', () => {
    expect(getInputStatus(StatusOfWordPresenceE.absent)).toBe('error');
  });

  it('возвращает undefined для остальных статусов', () => {
    expect(getInputStatus(StatusOfWordPresenceE.present)).toBeUndefined();
  });
});
