import React from 'react';
import { CommonIconP } from '@/core/ui/icons/types';

// The flag of Spain: red / yellow (twice as tall) / red, the same rounded 28×20 frame as the other flags
export const SpanishFlag: React.FC<CommonIconP> = ({ width, height, className }) => {
  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox="0 -4 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g clipPath="url(#clip0_spanish_flag)">
        <rect
          x="0.25"
          y="0.25"
          width="27.5"
          height="19.5"
          rx="1.75"
          fill="#FFDA44"
          stroke="#F5F5F5"
          strokeWidth="0.5"
        />
        <mask
          id="mask0_spanish_flag"
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
        <g mask="url(#mask0_spanish_flag)">
          <path fillRule="evenodd" clipRule="evenodd" d="M0 5H28V0H0V5Z" fill="#D80027" />
          <path fillRule="evenodd" clipRule="evenodd" d="M0 20H28V15H0V20Z" fill="#D80027" />
        </g>
      </g>
      <defs>
        <clipPath id="clip0_spanish_flag">
          <rect width="28" height="20" rx="2" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
};
