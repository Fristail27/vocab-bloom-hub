export type PendingExport = {
  filePath: string;
  createdAt: number;
  timeout: NodeJS.Timeout;
};

// A meaning → linked words (synonyms or antonyms) record collected while
// saving the dataset; the links are written once every file is imported, so
// they can point at entries from any file
export type PendingWordLinkT = {
  meaningId: number;
  headword: string;
  words: string[];
};
