import type { ReconciliationSideT } from '../../../../../types/reconciliation';
import { equalContentSides, equalSides, present } from './compare';
import { alignDocument } from './snapshot';

/** Uniquely unchanged legacy records may have different synchronization IDs. */
export const equalDocumentSides = (
  a: ReconciliationSideT,
  b: ReconciliationSideT,
  path: readonly string[] = [],
): boolean =>
  equalSides(a, b) ||
  equalContentSides(a, a.present && b.present ? present(alignDocument(a.value, b.value)) : b, path);
