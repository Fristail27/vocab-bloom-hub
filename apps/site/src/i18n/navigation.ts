import { createNavigation } from 'next-intl/navigation';

import { routing } from './routing';

// Locale-aware Link / redirect / usePathname: `/docs` renders as `/en/docs`
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
