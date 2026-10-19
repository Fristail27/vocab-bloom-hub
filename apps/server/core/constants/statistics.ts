import { EnIssueInterpretationT, EnStatisticsIssueKeyT } from '../../types';
import { DatasetFeatureE, findCatalogEntry } from './dataset_catalog';

/** Catalog capabilities describe available data, never a completeness guarantee. */
export const issueInterpretation = (
  key: EnStatisticsIssueKeyT,
  dataset: { name: string; own: boolean },
): EnIssueInterpretationT => {
  if (key.startsWith('empty_')) return 'empty';
  const catalog = dataset.own ? undefined : findCatalogEntry(dataset.name);
  if (!catalog) return 'informational';
  const feature: Partial<Record<EnStatisticsIssueKeyT, DatasetFeatureE>> = {
    words_without_meanings: DatasetFeatureE.definitions,
    words_without_short_translations: DatasetFeatureE.translations,
    words_without_level: DatasetFeatureE.levels,
    words_without_transcription: DatasetFeatureE.pronunciation,
    meanings_without_translations: DatasetFeatureE.translations,
    meanings_without_examples: DatasetFeatureE.examples,
  };
  const capability = feature[key];
  if (!capability) return 'informational';
  return catalog.features.includes(capability) ? 'missing' : 'source_omission';
};
