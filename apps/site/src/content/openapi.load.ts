import 'server-only';

import { OpenApiSpecT, PUBLIC_SPEC_FILE } from './openapi';
import { readRepoFile } from './repo';

/** The committed public contract, read at build time */
export const loadPublicSpec = (): OpenApiSpecT => JSON.parse(readRepoFile(PUBLIC_SPEC_FILE)) as OpenApiSpecT;
