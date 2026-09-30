import { LICENSE_URLS } from './data_license';

// The licenses a dataset of the instance's own may come under (issue #540):
// a closed list of the standard ones, so a license that has an SPDX
// identifier is chosen, not typed and spelled in many ways. When none of
// them fits, the owner states a license of their own — its name, a link and
// its text in full.
//
// No imports but constants: the admin UI reads this file too.

export type StandardDataLicenseT = {
  /** SPDX identifier, what `license` of the public API carries */
  spdx: string;
  name: string;
  url: string;
  /** What is made from the data has to stay under the same license */
  share_alike: boolean;
};

export const STANDARD_DATA_LICENSES: readonly StandardDataLicenseT[] = [
  {
    spdx: 'CC0-1.0',
    name: 'Creative Commons Zero v1.0 Universal',
    url: LICENSE_URLS['CC0-1.0'] as string,
    share_alike: false,
  },
  {
    spdx: 'CC-BY-4.0',
    name: 'Creative Commons Attribution 4.0 International',
    url: LICENSE_URLS['CC-BY-4.0'] as string,
    share_alike: false,
  },
  {
    spdx: 'CC-BY-SA-4.0',
    name: 'Creative Commons Attribution-ShareAlike 4.0 International',
    url: LICENSE_URLS['CC-BY-SA-4.0'] as string,
    share_alike: true,
  },
  {
    spdx: 'CC-BY-NC-4.0',
    name: 'Creative Commons Attribution-NonCommercial 4.0 International',
    url: 'https://creativecommons.org/licenses/by-nc/4.0/',
    share_alike: false,
  },
  {
    spdx: 'ODbL-1.0',
    name: 'Open Data Commons Open Database License v1.0',
    url: 'https://opendatacommons.org/licenses/odbl/1-0/',
    share_alike: true,
  },
];

export const findStandardLicense = (spdx: string): StandardDataLicenseT | undefined =>
  STANDARD_DATA_LICENSES.find((license) => license.spdx === spdx);

// The limits of what an owner states about their dataset; the columns of
// the registry take them
export const DATASET_TITLE_MAX_LENGTH = 120;
/** The name of a license of the owner's own: it is `license` of the public API */
export const CUSTOM_LICENSE_NAME_MAX_LENGTH = 64;
export const CUSTOM_LICENSE_TEXT_MAX_LENGTH = 100_000;
export const DATASET_ATTRIBUTION_MAX_LENGTH = 1000;
