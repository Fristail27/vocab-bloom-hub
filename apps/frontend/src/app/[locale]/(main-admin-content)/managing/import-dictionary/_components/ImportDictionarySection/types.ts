import { UploadFileFieldT } from 'server/src/modules/EnModule/modules/EnImportDictionary/constants';

// Where the next import reads from (issue #269)
export enum ImportSourceTabE {
  huggingface = 'huggingface',
  archive = 'archive',
  files = 'files',
}

// One file per upload slot; a slot left empty is simply not sent
export type SlotFilesT = Partial<Record<UploadFileFieldT, File>>;

// The manifest typed by hand on the "separate files" tab
export type ManualManifestT = { version: string; synonym_links: string; antonym_links: string };

export enum ManifestModeE {
  file = 'file',
  manual = 'manual',
}
