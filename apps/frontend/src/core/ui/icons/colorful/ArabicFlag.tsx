import React from 'react';
import { CommonIconP } from '@/core/ui/icons/types';

// Arabic has no single country, so no state's flag: the letter ʿayn (ع) on a
// green field, the same rounded 28×20 frame as the flags (issue #464)
export const ArabicFlag: React.FC<CommonIconP> = ({ width, height, className }) => {
  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox="0 -4 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g clipPath="url(#clip0_arabic_flag)">
        <rect
          x="0.25"
          y="0.25"
          width="27.5"
          height="19.5"
          rx="1.75"
          fill="#1B7F4B"
          stroke="#F5F5F5"
          strokeWidth="0.5"
        />
        <text
          x="14"
          y="14.5"
          textAnchor="middle"
          fontSize="13"
          fontFamily="'Noto Naskh Arabic', 'Geeza Pro', 'Arial', sans-serif"
          fill="#FFFFFF"
        >
          ع
        </text>
      </g>
      <defs>
        <clipPath id="clip0_arabic_flag">
          <rect width="28" height="20" rx="2" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
};
