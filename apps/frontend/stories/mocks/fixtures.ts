import { DATASET_CATALOG } from 'server/core/constants/dataset_catalog';
import type { DatasetT, DatasetsListT } from 'server/types';
import type {
  ReconciliationConflictT,
  ReconciliationItemT,
  ReconciliationObjectT,
  ReconciliationSideT,
  ReconciliationValueT,
} from 'server/types/reconciliation';

export const PLAN_ID = '83e6b7e4-5720-4cd9-bdf3-7c0278948f5a';
export const DATE = '2026-10-01T12:00:00.000Z';
export const present = (value: ReconciliationValueT): ReconciliationSideT => ({ present: true, value });
export const absent: ReconciliationSideT = { present: false };

export function ownDataset(name = 'study', title = 'Study dictionary'): DatasetT {
  return {
    name,
    title,
    own: true,
    installed: true,
    active: false,
    is_default: false,
    is_public: false,
    source: name,
    language: 'en',
    version: '1.0',
    license: 'CC-BY-4.0',
    license_url: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: 'Example editorial team',
    attribution_url: null,
    license_text: null,
    notice: null,
    created_at: DATE,
    imported_at: DATE,
  };
}

export function datasetList(supported = true): DatasetsListT {
  return {
    supported,
    active: 'default',
    datasets: [
      ...DATASET_CATALOG.map((entry): DatasetT => ({
        ...ownDataset(entry.name, entry.title),
        source: entry.source,
        own: false,
        installed: supported
          ? ['default', 'opengloss', 'wordnet'].includes(entry.name)
          : entry.name === 'default',
        active: entry.name === 'default',
        is_default: entry.name === 'default',
        is_public: entry.name === 'default',
        license: entry.license.spdx ?? entry.license.name,
        license_url: entry.license.url,
        attribution: entry.attribution,
        attribution_url: entry.homepage,
        version: entry.name === 'opengloss' ? '2.4' : '2026-09',
      })),
      ...(supported ? [ownDataset()] : []),
    ],
  };
}

export function article(headword: string, description: string): ReconciliationSideT {
  return present({ headword, parts: { noun: { common: { description }, meanings: {}, forms: {} } } });
}

const descriptionPath = ['parts', 'noun', 'common', 'description'];
export function conflictItem(
  kind: 'description' | 'translation' | 'deletion' | 'dependency' | 'long' = 'description',
): ReconciliationItemT {
  const headword = kind === 'deletion' ? 'obsolete-lamp' : 'lamp';
  let baseline = article(headword, 'A device that produces light.');
  let local = article(headword, 'A portable light for reading.');
  let incoming =
    kind === 'deletion' ? absent : article(headword, 'An electric device used to illuminate a room.');
  const conflict: ReconciliationConflictT = {
    path: descriptionPath,
    kind: 'edit',
    baseline: present('A device that produces light.'),
    local: present('A portable light for reading.'),
    incoming: present('An electric device used to illuminate a room.'),
  };
  if (kind === 'deletion') Object.assign(conflict, { path: [], kind: 'delete', baseline, local, incoming });
  if (kind === 'dependency') Object.assign(conflict, { kind: 'dependency', targets: ['lantern', 'light'] });
  if (kind === 'long') {
    for (const side of ['baseline', 'local', 'incoming'] as const) {
      const value = conflict[side];
      if (value.present)
        value.value = `${value.value}\n\n${'A detailed example with multilingual text: свет, Licht, ضوء. '.repeat(35)}`;
    }
  }
  if (kind === 'long') {
    baseline = article(headword, String(conflict.baseline.present && conflict.baseline.value));
    local = article(headword, String(conflict.local.present && conflict.local.value));
    incoming = article(headword, String(conflict.incoming.present && conflict.incoming.value));
  }
  const conflicts = [conflict];
  if (kind === 'translation') {
    const meaningId = '41643cb1-7c1c-46c4-86cb-f842de22e73c';
    const translationId = '52d9d8c1-4286-4af1-b054-0aa346bc683d';
    const path = ['parts', 'noun', 'meanings', meaningId, 'translations', translationId, 'translation'];
    for (const [side, translation] of [
      [baseline, 'lampe'],
      [local, 'lampe de lecture'],
      [incoming, 'luminaire'],
    ] as const) {
      if (!side.present) continue;
      const noun = ((side.value as ReconciliationObjectT).parts as ReconciliationObjectT)
        .noun as ReconciliationObjectT;
      noun.meanings = {
        [meaningId]: {
          title: 'A light source',
          definition: 'A device producing light.',
          translations: { [translationId]: { language: 'fr', translation } },
        },
      };
    }
    conflicts.push({
      path,
      kind: 'edit',
      baseline: present('lampe'),
      local: present('lampe de lecture'),
      incoming: present('luminaire'),
    });
  }
  return {
    plan: PLAN_ID,
    headword,
    category: 'conflicts',
    baseline,
    local,
    incoming,
    comparison: { category: 'conflicts', result: local, conflicts },
    result: local,
    decisions: [],
    remaining: conflicts.length,
    version: 0,
  };
}

export function automaticItems(): ReconciliationItemT[] {
  return (['added', 'deleted', 'changed', 'local_only', 'unchanged'] as const).map((category, index) => {
    const headword = ['lantern', 'old-word', 'light', 'notebook', 'sun'][index];
    const baseline = category === 'added' ? absent : article(headword, 'Original definition.');
    const local =
      category === 'added'
        ? absent
        : article(headword, category === 'local_only' ? 'Our editorial definition.' : 'Original definition.');
    const incoming =
      category === 'deleted'
        ? absent
        : article(
            headword,
            ['local_only', 'unchanged'].includes(category) ? 'Original definition.' : 'Updated definition.',
          );
    const result = ['local_only', 'unchanged'].includes(category) ? local : incoming;
    return {
      plan: PLAN_ID,
      headword,
      category,
      baseline,
      local,
      incoming,
      result,
      comparison: { category, result, conflicts: [] },
      decisions: [],
      remaining: 0,
      version: 0,
    };
  });
}
