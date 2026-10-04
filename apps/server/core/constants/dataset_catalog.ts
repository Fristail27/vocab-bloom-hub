import { DATA_LICENSE, LICENSE_URLS } from './data_license';
import {
  CMUDICT_NOTICE,
  OPEN_ENGLISH_WORDNET_NOTICE,
  WORDNET_3_0_NOTICE,
  WORDNET_3_1_NOTICE,
} from './dataset_notices';
import { OPENGLOSS_FILES, OPENGLOSS_VERSION } from './opengloss';
import { findStandardLicense } from './data_licenses';
import { DEFAULT_DATASET_NAME, OWN_DATASET_SOURCE } from './datasets';

// The datasets an instance can hold (issue #527): the project's own and the
// public sources the code can read. The list is closed and its terms are
// stated here, not typed by an admin — what a license asks for is a fact
// about the source, and the instance has to show it as it is. A new source
// is a converter (src/converters/README.md) and an entry here.
//
// No imports but constants: the admin UI reads this file too.

/** What an entry of a dataset carries; the datasets page shows them as tags */
export enum DatasetFeatureE {
  definitions = 'definitions',
  examples = 'examples',
  pronunciation = 'pronunciation',
  forms = 'forms',
  links = 'links',
  translations = 'translations',
  levels = 'levels',
  registers = 'registers',
}

export type DatasetLicenseT = {
  /** SPDX identifier, or the name the source gives its own license */
  spdx: string;
  name: string;
  url: string;
};

/** A notice a source asks to be kept, word for word, with every copy of its data */
export type DatasetNoticeT = {
  /** Whose notice it is */
  title: string;
  text: string;
  /** Conditional terms: retained in dataset exports; the adapter attaches them only to applicable words. */
  scope?: 'dataset';
};

/** A source file downloaded on the server or attached to a manual install request. */
export type DatasetCatalogFileT = {
  /** The multipart field of `POST /api/en/datasets/{name}/install` */
  field: 'file' | 'pronunciations' | (typeof OPENGLOSS_FILES)[number]['field'];
  required: boolean;
  /** What the file is, in a few words */
  title: string;
  /** Related files share a section in the installation dialog. */
  group?: 'senses' | 'lexicon';
  /** The file as its source names it */
  file_name: string;
  /** The direct download */
  url: string;
  /** The page of the source that lists its downloads */
  page_url: string;
  /** Megabytes, rounded: what to expect, not a limit */
  size_mb: number;
  /** The terms of the file when they are not the dataset's own */
  license?: DatasetLicenseT;
};

/**
 * How an instance learns that the source has published a newer file (issue
 * #530). What is asked, and of whom, is stated here like the other facts of
 * a source — the server makes no request the catalog does not name.
 */
export type DatasetUpdateCheckT =
  /** Nothing to ask: a source that is frozen, a dataset that is checked elsewhere */
  | { kind: 'none' }
  /**
   * The file itself says when it was made: a `HEAD` request for its
   * `Last-Modified`. A file that is made again every few days is told of
   * when it is `notice_after_days` newer than the installed one
   */
  | { kind: 'last_modified'; url: string; notice_after_days: number }
  /**
   * The source publishes releases: the latest one of the GitHub API, its
   * edition read from the tag by `tag_pattern` (the first group)
   */
  | { kind: 'latest_release'; api_url: string; tag_pattern: string };

export type DatasetCatalogEntryT = {
  /** The name of the dataset on an instance, and the tail of its schema */
  name: string;
  /** What the data is called in the public API: `source` of a word and of `/meta` */
  source: string;
  title: string;
  /** The language of the headwords */
  language: string;
  homepage: string;
  license: DatasetLicenseT;
  /** Derived data must stay under the same license */
  share_alike: boolean;
  /** The line a consumer of the data has to show */
  attribution: string;
  attribution_url: string;
  /** The provenance notice to pass on to readers; '' when the source asks for none */
  notice: string;
  /**
   * The texts that have to travel with the data (issue #531): shown to
   * readers, written into the LICENSE file of an export. A license that is
   * named by its link — Creative Commons — needs none
   */
  notices: DatasetNoticeT[];
  /** This external source itself contains model-generated content. */
  generated?: boolean;
  features: DatasetFeatureE[];
  /** Base entries and senses of the revision that was measured, megabytes in Postgres, minutes to install */
  size: { entries: number; senses: number; database_mb: number; minutes: number; revision: string };
  /**
   * How the data gets in: the project's dataset through the import page
   * (HuggingFace, an export), a public source through its converter — the
   * adapter of src/converters and the files it reads
   */
  install:
    | { kind: 'import' }
    | { kind: 'convert'; adapter: string; options: Record<string, string>; files: DatasetCatalogFileT[] };
  /** Where a newer file of the source is looked for; the installation stays a step of the admin */
  update_check: DatasetUpdateCheckT;
};

const CMUDICT: DatasetCatalogFileT = {
  field: 'pronunciations',
  required: false,
  title: 'CMU Pronouncing Dictionary',
  file_name: 'cmudict.dict',
  url: 'https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict',
  page_url: 'https://github.com/cmusphinx/cmudict',
  size_mb: 4,
  license: { spdx: 'BSD-2-Clause', name: 'BSD 2-Clause License', url: LICENSE_URLS['BSD-2-Clause'] },
};

// WordNet has no pronunciations of its own; the line is part of the terms
// whether or not the file was attached, so the terms stay what the code says
const WITH_CMUDICT = 'pronunciations, where given, from the CMU Pronouncing Dictionary (BSD 2-Clause)';
const CMUDICT_NOTICE_OF_A_DATASET: DatasetNoticeT = {
  title: 'CMU Pronouncing Dictionary — the pronunciations, where given',
  text: CMUDICT_NOTICE,
};

export const DATASET_CATALOG: readonly DatasetCatalogEntryT[] = [
  {
    name: DEFAULT_DATASET_NAME,
    source: OWN_DATASET_SOURCE,
    title: 'Vocab Bloom Hub English dataset',
    language: 'en',
    homepage: 'https://huggingface.co/datasets/Fristail27/vocab-bloom-hub-en',
    license: { spdx: DATA_LICENSE.spdx, name: DATA_LICENSE.name, url: DATA_LICENSE.url },
    share_alike: false,
    attribution: DATA_LICENSE.attribution,
    attribution_url: 'https://huggingface.co/datasets/Fristail27/vocab-bloom-hub-en',
    notice: DATA_LICENSE.notice,
    notices: [],
    features: [
      DatasetFeatureE.definitions,
      DatasetFeatureE.examples,
      DatasetFeatureE.pronunciation,
      DatasetFeatureE.forms,
      DatasetFeatureE.links,
      DatasetFeatureE.translations,
      DatasetFeatureE.levels,
      DatasetFeatureE.registers,
    ],
    size: { entries: 115_000, senses: 161_000, database_mb: 900, minutes: 10, revision: 'v0.2.0' },
    install: { kind: 'import' },
    // the import page compares the version with the published dataset of the project
    update_check: { kind: 'none' },
  },
  {
    name: 'wiktionary',
    source: 'wiktionary',
    title: 'English Wiktionary',
    language: 'en',
    homepage: 'https://en.wiktionary.org',
    license: {
      spdx: 'CC-BY-SA-4.0',
      name: 'Creative Commons Attribution-ShareAlike 4.0 International',
      url: LICENSE_URLS['CC-BY-SA-4.0'],
    },
    share_alike: true,
    attribution:
      'Wiktionary contributors (https://en.wiktionary.org), CC BY-SA 4.0; extracted by wiktextract (https://kaikki.org)',
    attribution_url: 'https://en.wiktionary.org',
    notice: '',
    notices: [],
    features: [
      DatasetFeatureE.definitions,
      DatasetFeatureE.examples,
      DatasetFeatureE.pronunciation,
      DatasetFeatureE.forms,
      DatasetFeatureE.links,
      DatasetFeatureE.translations,
      DatasetFeatureE.registers,
    ],
    size: { entries: 787_000, senses: 1_072_000, database_mb: 1400, minutes: 10, revision: '2026-09-25' },
    install: {
      kind: 'convert',
      adapter: 'wiktionary',
      options: {},
      files: [
        {
          field: 'file',
          required: true,
          title: 'The English extract of Wiktionary',
          file_name: 'kaikki.org-dictionary-English.jsonl.gz',
          url: 'https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl.gz',
          page_url: 'https://kaikki.org/dictionary/English/',
          size_mb: 500,
        },
      ],
    },
    // the extract is made again every few days: a month is what is worth a notice
    update_check: {
      kind: 'last_modified',
      url: 'https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl.gz',
      notice_after_days: 30,
    },
  },
  {
    name: 'wordnet',
    source: 'wordnet',
    title: 'Open English WordNet',
    language: 'en',
    homepage: 'https://en-word.net',
    license: {
      spdx: 'CC-BY-4.0',
      name: 'Creative Commons Attribution 4.0 International',
      url: LICENSE_URLS['CC-BY-4.0'],
    },
    share_alike: false,
    attribution: `Open English WordNet (https://en-word.net), CC BY 4.0, derived from Princeton WordNet; ${WITH_CMUDICT}`,
    attribution_url: 'https://en-word.net',
    notice: '',
    notices: [
      { title: 'Open English WordNet and the WordNet it is derived from', text: OPEN_ENGLISH_WORDNET_NOTICE },
      CMUDICT_NOTICE_OF_A_DATASET,
    ],
    features: [
      DatasetFeatureE.definitions,
      DatasetFeatureE.examples,
      DatasetFeatureE.pronunciation,
      DatasetFeatureE.links,
    ],
    size: { entries: 135_000, senses: 185_000, database_mb: 170, minutes: 2, revision: '2025' },
    install: {
      kind: 'convert',
      adapter: 'wordnet',
      options: {},
      files: [
        {
          field: 'file',
          required: true,
          title: 'The 2025 edition in the WordNet database format',
          file_name: 'english-wordnet-2025.zip',
          url: 'https://github.com/globalwordnet/english-wordnet/releases/download/2025-edition/english-wordnet-2025.zip',
          page_url: 'https://github.com/globalwordnet/english-wordnet/releases',
          size_mb: 10,
        },
        CMUDICT,
      ],
    },
    // an edition a year, tagged `2025-edition`
    update_check: {
      kind: 'latest_release',
      api_url: 'https://api.github.com/repos/globalwordnet/english-wordnet/releases/latest',
      tag_pattern: '^(\\d{4})-edition$',
    },
  },
  {
    name: 'wordnet_princeton',
    source: 'princeton-wordnet',
    title: 'Princeton WordNet 3.1',
    language: 'en',
    homepage: 'https://wordnet.princeton.edu',
    license: { spdx: 'WordNet', name: 'WordNet 3.0 license', url: LICENSE_URLS.WordNet },
    share_alike: false,
    attribution: `WordNet, Copyright Princeton University (https://wordnet.princeton.edu); ${WITH_CMUDICT}`,
    attribution_url: 'https://wordnet.princeton.edu',
    notice: '',
    notices: [{ title: 'WordNet 3.1', text: WORDNET_3_1_NOTICE }, CMUDICT_NOTICE_OF_A_DATASET],
    features: [
      DatasetFeatureE.definitions,
      DatasetFeatureE.examples,
      DatasetFeatureE.pronunciation,
      DatasetFeatureE.links,
    ],
    size: { entries: 155_000, senses: 207_000, database_mb: 190, minutes: 2, revision: '3.1' },
    install: {
      kind: 'convert',
      adapter: 'wordnet',
      options: { edition: 'princeton' },
      files: [
        {
          field: 'file',
          required: true,
          title: 'The database files of WordNet 3.1',
          file_name: 'wn3.1.dict.tar.gz',
          url: 'https://wordnetcode.princeton.edu/wn3.1.dict.tar.gz',
          page_url: 'https://wordnet.princeton.edu/download/current-version',
          size_mb: 16,
        },
        CMUDICT,
      ],
    },
    // frozen since 2011
    update_check: { kind: 'none' },
  },
  {
    name: 'opengloss',
    source: 'opengloss',
    title: 'OpenGloss',
    language: 'en',
    homepage: 'https://huggingface.co/collections/mjbommar/opengloss-2x',
    license: {
      spdx: 'CC-BY-4.0',
      name: 'Creative Commons Attribution 4.0 International',
      url: LICENSE_URLS['CC-BY-4.0'],
    },
    share_alike: false,
    generated: true,
    attribution:
      'OpenGloss by Michael J. Bommarito II (CC BY 4.0). Entries marked source: wordnet-3.0 also derive from Princeton WordNet 3.0, Copyright 2006 by Princeton University. All rights reserved.',
    attribution_url: 'https://huggingface.co/datasets/mjbommar/opengloss-v2.4-senses',
    notice:
      'OpenGloss contains model-generated definitions, examples, forms and relations that may contain errors. Words marked source: wordnet-3.0 also carry the Princeton WordNet license. Converted from the senses and lexicon tables; reading grades are not CEFR levels. Only canonical definitions and neutral, plain examples are included. Text containing damaged control characters is omitted.',
    notices: [
      {
        title: 'Princeton WordNet 3.0 — only words marked source: wordnet-3.0',
        text: WORDNET_3_0_NOTICE,
        scope: 'dataset',
      },
    ],
    features: [
      DatasetFeatureE.definitions,
      DatasetFeatureE.examples,
      DatasetFeatureE.forms,
      DatasetFeatureE.links,
    ],
    size: { entries: 194_373, senses: 300_710, database_mb: 700, minutes: 4, revision: OPENGLOSS_VERSION },
    install: {
      kind: 'convert',
      adapter: 'opengloss',
      options: {},
      files: OPENGLOSS_FILES.map((file) => ({
        field: file.field,
        required: true,
        title: `OpenGloss ${OPENGLOSS_VERSION} ${file.table} · ${file.file_name}`,
        group: file.table,
        file_name: file.file_name,
        url: file.url,
        page_url: file.page_url,
        size_mb: Math.ceil(file.bytes / 1_000_000),
      })),
    },
    // A pinned release spanning two repositories, not a rolling extract.
    update_check: { kind: 'none' },
  },
];

export const findCatalogEntry = (name: string): DatasetCatalogEntryT | undefined =>
  DATASET_CATALOG.find((entry) => entry.name === name);

/**
 * Whether a name is the catalog's (issue #540): a dataset of the instance's
 * own takes neither the name of a dataset of the catalog nor the name of a
 * source — its `source` in the public API is its name, and data of a public
 * source is never served under the terms of another
 */
export const isReservedDatasetName = (name: string): boolean =>
  DATASET_CATALOG.some((entry) => entry.name === name || entry.source === name);

/**
 * An external catalog source, installed from its own files. The own mark
 * takes precedence if an administrator used the name before its reservation.
 */
export const isPublicSourceDataset = (dataset: { name: string; own?: boolean }): boolean =>
  !dataset.own && findCatalogEntry(dataset.name)?.install.kind === 'convert';

/** Keep human-authored sources free of generated data; OpenGloss declares it explicitly. */
export const isHumanAuthoredDataset = (dataset: { name: string; own?: boolean }): boolean =>
  isPublicSourceDataset(dataset) && !findCatalogEntry(dataset.name)?.generated;

/** The terms of a catalog entry as a dataset and a manifest carry them */
export const catalogTerms = (entry: DatasetCatalogEntryT) => ({
  source: entry.source,
  language: entry.language,
  license: entry.license.spdx,
  license_url: entry.license.url,
  attribution: entry.attribution,
  attribution_url: entry.attribution_url,
  notice: entry.notice,
});

/** The notices of a dataset as one text, each under the name of its owner; '' when it has none */
export const noticesText = (entry: DatasetCatalogEntryT): string =>
  entry.notices.map((notice) => `${notice.title}\n\n${notice.text}`).join('\n\n\n');

/** What an export and a converted dataset say about their modifications */
export type LicenseFileOptionsT = {
  /** Entries that were changed or added where the copy was made */
  modified_entries?: number;
};

/** What the LICENSE file of a copy states: the terms of a dataset of the catalog or of the owner's */
type LicenseFileTermsT = {
  title: string;
  homepage: string | null;
  /** The SPDX identifier is left out for a license of the owner's own, whose name is all it has */
  license: { spdx: string | null; name: string; url: string };
  attribution: string;
  share_alike: boolean;
  notice: string;
  /** The texts that travel in full: the notices of a source, the text of a license of the owner's own */
  texts: string;
};

const licenseFile = (terms: LicenseFileTermsT, options: LicenseFileOptionsT): string =>
  [
    `${terms.title}`,
    ...(terms.homepage ? [`Source: ${terms.homepage}`] : []),
    `License: ${terms.license.name}${terms.license.spdx ? ` (${terms.license.spdx})` : ''}, ${terms.license.url}`,
    `Attribution: ${terms.attribution}`,
    ...(terms.share_alike
      ? ['Share-alike: what is made from this data has to stay under the same license.']
      : []),
    ...(terms.notice ? [`Notice: ${terms.notice}`] : []),
    ...(options.modified_entries
      ? [
          '',
          `This copy differs from its source: ${options.modified_entries} of its entries were changed or added ` +
            'on the instance it was exported from. The modified entries are the ones the history of edits ' +
            'of the dataset names.',
        ]
      : []),
    ...(terms.texts ? ['', '', terms.texts] : []),
    '',
  ].join('\n');

/**
 * The LICENSE file of a copy of a dataset: the terms the catalog states and
 * the notices of the source in full. A copy that was edited says so — the
 * Creative Commons licenses ask that modifications are indicated.
 */
export const licenseFileOf = (entry: DatasetCatalogEntryT, options: LicenseFileOptionsT = {}): string =>
  licenseFile(
    {
      title: entry.title,
      homepage: entry.homepage,
      license: entry.license,
      attribution: entry.attribution,
      share_alike: entry.share_alike,
      notice: entry.notice,
      texts: noticesText(entry),
    },
    options,
  );

/** The terms of a dataset of the instance's own as the registry keeps them */
export type OwnDatasetTermsT = {
  title: string;
  license: string;
  license_url: string;
  license_text: string | null;
  attribution: string;
  attribution_url: string | null;
  notice: string | null;
};

/**
 * The LICENSE file of a copy of a dataset of the instance's own (issue
 * #540): the terms its owner stated, the text of a license of their own in
 * full under its name
 */
export const licenseFileOfOwn = (terms: OwnDatasetTermsT, options: LicenseFileOptionsT = {}): string => {
  const standard = findStandardLicense(terms.license);
  return licenseFile(
    {
      title: terms.title,
      homepage: terms.attribution_url,
      license: standard ?? { spdx: null, name: terms.license, url: terms.license_url },
      attribution: terms.attribution,
      share_alike: standard?.share_alike ?? false,
      notice: terms.notice ?? '',
      texts: terms.license_text ? `${terms.license}\n\n${terms.license_text}` : '',
    },
    options,
  );
};

/** The name of the file the terms of a dataset travel in */
export const LICENSE_FILE_NAME = 'LICENSE';

/** The catalog entry an adapter of src/converters writes, by the options it was run with */
export const findCatalogEntryOfAdapter = (
  adapter: string,
  options: Record<string, string>,
): DatasetCatalogEntryT | undefined =>
  DATASET_CATALOG.find(
    (entry) =>
      entry.install.kind === 'convert' &&
      entry.install.adapter === adapter &&
      (entry.install.options.edition ?? '') === (options.edition ?? ''),
  );

// The source files are large: the English extract of Wiktionary is half a
// gigabyte compressed and grows with the wiki
export const MAX_SOURCE_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;
