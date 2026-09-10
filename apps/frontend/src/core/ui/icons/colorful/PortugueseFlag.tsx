import React from 'react';
import { CommonIconP } from '@/core/ui/icons/types';

// The flag of Portugal: green on the hoist (two fifths), red on the fly, the same rounded 28×20 frame as the other flags
export const PortugueseFlag: React.FC<CommonIconP> = ({ width, height, className }) => {
  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox="0 -4 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g clipPath="url(#clip0_portuguese_flag)">
        <rect
          x="0.25"
          y="0.25"
          width="27.5"
          height="19.5"
          rx="1.75"
          fill="#D80027"
          stroke="#F5F5F5"
          strokeWidth="0.5"
        />
        <mask
          id="mask0_portuguese_flag"
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
        <g mask="url(#mask0_portuguese_flag)">
          <path fillRule="evenodd" clipRule="evenodd" d="M0 20H11.2V0H0V20Z" fill="#046A38" />
          <circle cx="11.2" cy="10" r="3.2" fill="#F8D147" />
          <circle cx="11.2" cy="10" r="2" fill="#D80027" />
        </g>
      </g>
      <defs>
        <clipPath id="clip0_portuguese_flag">
          <rect width="28" height="20" rx="2" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
};
