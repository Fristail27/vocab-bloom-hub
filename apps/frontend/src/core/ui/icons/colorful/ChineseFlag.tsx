import React from 'react';
import { CommonIconP } from '@/core/ui/icons/types';

// The flag of China: a red field with one large and four small gold stars in the canton, the same rounded 28×20 frame as the other flags
export const ChineseFlag: React.FC<CommonIconP> = ({ width, height, className }) => {
  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox="0 -4 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g clipPath="url(#clip0_chinese_flag)">
        <rect
          x="0.25"
          y="0.25"
          width="27.5"
          height="19.5"
          rx="1.75"
          fill="#DE2910"
          stroke="#F5F5F5"
          strokeWidth="0.5"
        />
        <mask
          id="mask0_chinese_flag"
          style={{ maskType: 'alpha' }}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="28"
          height="20"
        >
          <rect
            x="0.25"
            y="0.25"
            width="27.5"
            height="19.5"
            rx="1.75"
            fill="white"
            stroke="white"
            strokeWidth="0.5"
          />
        </mask>
        <g mask="url(#mask0_chinese_flag)" fill="#FFDE00">
          <path d="M4.667 3.2 5.55 5.92h2.86L6.1 7.6l.885 2.72-2.318-1.68-2.318 1.68L3.234 7.6.92 5.92h2.86z" />
          <path d="m9.9 1.8.35 1.04h1.1l-.89.66.34 1.05-.9-.65-.9.65.34-1.05-.89-.66h1.1z" />
          <path d="m12.1 4.2.35 1.04h1.1l-.89.66.34 1.05-.9-.65-.9.65.34-1.05-.89-.66h1.1z" />
          <path d="m12.1 7.2.35 1.04h1.1l-.89.66.34 1.05-.9-.65-.9.65.34-1.05-.89-.66h1.1z" />
          <path d="m9.9 9.6.35 1.04h1.1l-.89.66.34 1.05-.9-.65-.9.65.34-1.05-.89-.66h1.1z" />
        </g>
      </g>
      <defs>
        <clipPath id="clip0_chinese_flag">
          <rect width="28" height="20" rx="2" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
};
