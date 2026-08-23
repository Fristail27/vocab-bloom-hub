export type PendingExport = {
  filePath: string;
  createdAt: number;
  timeout: NodeJS.Timeout;
};

// A meaning → synonyms link collected while saving the dataset; the links are
// written once every file is imported, so they can point at entries from any file
export type PendingSynonymLinkT = {
  meaningId: number;
  headword: string;
  synonyms: string[];
};
