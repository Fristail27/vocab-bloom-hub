import type { PublicWordDatasetV1T, PublicWordV1T } from 'server/types';

import type { DatasetTermsT } from './datasetTerms';

// What a tab of a word page shows (issue #538): one dataset with its own
// spelling, entries and terms. Read by the server for the tab a page opens
// and by the browser for the others, so nothing here may name the catalog
// of the datasets — its notices are no part of a page

export type WordPanelT = {
  /** The name of the dataset on the instance: `default`, `wiktionary`, … */
  dataset: string;
  /** What a reader calls it: the title of the catalog, the name for a dataset the site does not know */
  title: string;
  /** Whether it is the dataset the API serves: the one the sitemap and the reports are about */
  active: boolean;
  terms: DatasetTermsT;
  /** The headword as this dataset spells it, and the spellings it holds that differ by case */
  word: string;
  variants: string[];
  entries: PublicWordV1T[];
};

export const termsOfGroup = (group: PublicWordDatasetV1T): DatasetTermsT => ({
  source: group.source,
  origins: group.origins ?? [],
  description: group.description ?? null,
  license: group.license,
  license_url: group.license_url,
  attribution: group.attribution,
  attribution_url: group.attribution_url ?? null,
  notice: group.notice,
  license_text: group.license_text ?? '',
});

/** A group of `GET /words/{word}/datasets` as a panel, under the title the page gives its dataset */
export const panelOfGroup = (group: PublicWordDatasetV1T, title: string): WordPanelT => ({
  dataset: group.dataset,
  title,
  active: group.active,
  terms: termsOfGroup(group),
  word: group.word,
  variants: group.variants,
  entries: group.entries,
});
