import { Baseline1786903614082 } from './1786903614082-Baseline';
import { AddMeaningSynonyms1787504717645 } from './1787504717645-AddMeaningSynonyms';
import { AddMeaningAntonyms1787850000000 } from './1787850000000-AddMeaningAntonyms';
import { AddEntryWordCollateCIndex1788200000000 } from './1788200000000-AddEntryWordCollateCIndex';
import { AddWordFilterIndexes1788300000000 } from './1788300000000-AddWordFilterIndexes';
import { AddEntryWordTrigramIndex1788400000000 } from './1788400000000-AddEntryWordTrigramIndex';
import { AddAuditLog1788500000000 } from './1788500000000-AddAuditLog';
import { AddEntryUserModifiedFlag1788600000000 } from './1788600000000-AddEntryUserModifiedFlag';
import { AddSuggestions1788700000000 } from './1788700000000-AddSuggestions';
import { AddSuggestionEditPayload1788800000000 } from './1788800000000-AddSuggestionEditPayload';
import { AddSpanishTranslationLanguage1788900000000 } from './1788900000000-AddSpanishTranslationLanguage';

// Every migration class must be listed here: both the CLI DataSource and the
// runtime TypeORM options read this array. An explicit list (instead of a
// path glob) resolves identically from ts-node and from the compiled dist.
export const migrations = [
  Baseline1786903614082,
  AddMeaningSynonyms1787504717645,
  AddMeaningAntonyms1787850000000,
  AddEntryWordCollateCIndex1788200000000,
  AddWordFilterIndexes1788300000000,
  AddEntryWordTrigramIndex1788400000000,
  AddAuditLog1788500000000,
  AddEntryUserModifiedFlag1788600000000,
  AddSuggestions1788700000000,
  AddSuggestionEditPayload1788800000000,
  AddSpanishTranslationLanguage1788900000000,
];
