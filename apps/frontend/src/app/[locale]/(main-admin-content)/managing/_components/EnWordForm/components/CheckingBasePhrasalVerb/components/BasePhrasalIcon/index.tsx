import React from 'react';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { StatusOfWordPresenceE } from '../../../../types';

type BasePhrasalIconP = {
  status: StatusOfWordPresenceE;
};

export const BasePhrasalIcon: React.FC<BasePhrasalIconP> = ({ status }) => {
  if (status === StatusOfWordPresenceE.absent) {
    return <CloseCircleOutlined />;
  }
  if (status === StatusOfWordPresenceE.present) {
    return <CheckCircleOutlined />;
  }
  return;
};
