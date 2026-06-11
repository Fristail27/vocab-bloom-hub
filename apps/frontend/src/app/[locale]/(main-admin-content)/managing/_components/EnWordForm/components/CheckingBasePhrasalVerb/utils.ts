import { StatusOfWordPresenceE } from '../../types';

export const getInputStatus = (status: StatusOfWordPresenceE) => {
  if (status === StatusOfWordPresenceE.absent) {
    return 'error';
  }
};
