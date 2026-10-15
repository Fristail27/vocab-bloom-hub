import { EntityManager } from 'typeorm';
import { ChangeActionE, ChangeDiffT, ChangeOriginE } from '../../../../../types';
import { NewChangeT, recordChange } from '../../utils/changes/recordChange';
import { withChangeSource } from '../../utils/changes/context';
import { ReconciliationSideT } from '../../../../../types/reconciliation';
import { equalSides, isSelection, missing, present } from './compare';

const at = (side: ReconciliationSideT, path: string[]): ReconciliationSideT => {
  for (const key of path) {
    if (
      !side.present ||
      !side.value ||
      typeof side.value !== 'object' ||
      Array.isArray(side.value) ||
      !Object.hasOwn(side.value, key)
    )
      return missing;
    side = present(side.value[key]);
  }
  return side;
};

/** Classify the actual changed field, not the presence of a custom decision elsewhere in the article. */
export function resolutionRecorder(
  sources: {
    baseline: ReconciliationSideT;
    local: ReconciliationSideT;
    incoming: ReconciliationSideT;
    result: ReconciliationSideT;
  },
  operation: { id: string; kind: string; source: string; revision: string },
  part: string,
) {
  return async (em: EntityManager, change: NewChangeT, path: string[] = ['common']) => {
    if (!change.diff) return;
    const groups: Record<'upstream' | 'selection' | 'authored', ChangeDiffT> = {
      upstream: {},
      selection: {},
      authored: {},
    };
    for (const [field, value] of Object.entries(change.diff)) {
      const fieldPath = ['parts', part, ...path, field];
      // Full word snapshots keep collections alongside common fields.
      if (
        path[0] === 'common' &&
        ['forms', 'meanings', 'short_translations', 'pronunciations', 'etymologies'].includes(field)
      )
        fieldPath.splice(2, 1);
      const result = at(sources.result, fieldPath);
      const local = at(sources.local, fieldPath);
      const incoming = at(sources.incoming, fieldPath);
      const baseline = at(sources.baseline, fieldPath);
      const kind =
        ['version', 'origins'].includes(field) || equalSides(result, local) || equalSides(result, incoming)
          ? 'upstream'
          : isSelection(result, [baseline, local, incoming])
            ? 'selection'
            : 'authored';
      groups[kind][field] = value;
    }
    const write = (kind: keyof typeof groups, diff: ChangeDiffT, action = change.action) =>
      withChangeSource(
        {
          origin: ChangeOriginE.admin,
          operation,
          ...(kind !== 'authored' && { contribution: null }),
          superseded: kind === 'upstream',
        },
        () => recordChange(em, { ...change, action, diff }),
      );
    if (change.action !== ChangeActionE.update) {
      // Keep complete creation/deletion snapshots. Applicable custom fields have their
      // own row, so replacing them later retires only their contribution terms.
      await write('upstream', change.diff);
      for (const kind of ['selection', 'authored'] as const)
        if (Object.keys(groups[kind]).length) await write(kind, groups[kind], ChangeActionE.update);
    } else {
      for (const kind of ['upstream', 'selection', 'authored'] as const)
        if (Object.keys(groups[kind]).length) await write(kind, groups[kind]);
    }
  };
}
