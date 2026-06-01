'use client';

import React from 'react';
import { Breadcrumb as AntdBreadcrumb } from 'antd';

export const Breadcrumb: React.FC<React.ComponentProps<typeof AntdBreadcrumb>> = (props) => {
  return <Breadcrumb {...props} />;
};
