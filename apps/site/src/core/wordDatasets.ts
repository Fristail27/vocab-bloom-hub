import { DATASET_CATALOG } from 'server/core/constants/dataset_catalog';
import type { PublicHeadwordV1ResT, PublicWordDatasetV1T } from 'server/types';

import { OWN_DATASET_SOURCE } from './datasetTerms';
import type { DatasetTermsT } from './datasetTerms';
import { panelOfGroup, WordPanelT } from './wordPanel';

// A word page shows a headword as every dataset of the instance has it, a
// tab per dataset (issue #538). The datasets are never merged: a tab is one
// dataset with its own spelling, entries and terms

/** The name of the only panel of a page whose instance did not say what its datasets are */
export const UNNAMED_DATASET = 'active';

export const datasetTitle = (name: string): string =>
  DATASET_CATALOG.find((entry) => entry.name === name)?.title ?? name;

/**
 * The name of the tab of a group: the title the instance gives the dataset
 * (issue #540) — a dataset of the instance's own is in no catalog — else
 * the one of the catalog, for an instance of 1.1 that sends none
 */
export const groupTitle = (group: Pick<PublicWordDatasetV1T, 'dataset' | 'title'>): string =>
  group.title || datasetTitle(group.dataset);

/** The same by what the public API calls the data: the instance that did not name its datasets still names the source */
export const sourceTitle = (source: string): string =>
  DATASET_CATALOG.find((entry) => entry.source === source)?.title ?? source;

type WordPanelsP = {
  /** The answer of the served dataset; null when it does not hold the headword */
  headword: PublicHeadwordV1ResT | null;
  /** The terms of the served dataset */
  terms: DatasetTermsT;
  /** The groups of `GET /words/{word}/datasets`; empty when the read gave nothing */
  groups: readonly PublicWordDatasetV1T[];
};

// the sources whose tabs come first, in this order: the dataset of the project, then Wiktionary
const TAB_ORDER: readonly string[] = [OWN_DATASET_SOURCE, 'wiktionary'];

/**
 * The tabs of a word page: the dataset of the project first, Wiktionary
 * second, then the other datasets that hold the headword, in the order of
 * the instance. The
 * panel of the served dataset is the answer of the headword read — what the
 * page showed before it had tabs, and what it shows when the read of every
 * dataset fails. No panel means no dataset holds the word.
 */
export const wordPanels = ({ headword, terms, groups }: WordPanelsP): WordPanelT[] => {
  const servedPanel = (dataset: string, title: string): WordPanelT[] =>
    headword
      ? [
          {
            dataset,
            title,
            active: true,
            terms,
            word: headword.meta.word,
            variants: headword.meta.variants ?? [],
            entries: headword.data,
          },
        ]
      : [];
  const panels = groups.some((group) => group.active)
    ? groups.flatMap((group): WordPanelT[] => {
        if (group.active) return servedPanel(group.dataset, groupTitle(group));
        if (group.entries.length === 0) return [];
        return [panelOfGroup(group, groupTitle(group))];
      })
    : servedPanel(UNNAMED_DATASET, terms.title || sourceTitle(terms.source));
  const place = (panel: WordPanelT): number => {
    const index = TAB_ORDER.indexOf(panel.terms.source);
    return index === -1 ? TAB_ORDER.length : index;
  };

  // a stable sort: the datasets the order does not name keep the order of the instance
  return [...panels].sort((a, b) => place(a) - place(b));
};

/**
 * The panel a page opens, and the one the server renders: the first tab.
 * The dataset of the project where it holds the headword, whichever
 * dataset the instance serves. The others are read by the browser when
 * their tab is pressed
 */
export const defaultPanel = (panels: readonly WordPanelT[]): WordPanelT | undefined => panels[0];
