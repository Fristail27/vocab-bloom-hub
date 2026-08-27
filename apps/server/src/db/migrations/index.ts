import { Baseline1786903614082 } from './1786903614082-Baseline';
import { AddMeaningSynonyms1787504717645 } from './1787504717645-AddMeaningSynonyms';
import { AddMeaningAntonyms1787850000000 } from './1787850000000-AddMeaningAntonyms';
import { AddEntryWordCollateCIndex1788200000000 } from './1788200000000-AddEntryWordCollateCIndex';
import { AddWordFilterIndexes1788300000000 } from './1788300000000-AddWordFilterIndexes';
import { AddEntryWordTrigramIndex1788400000000 } from './1788400000000-AddEntryWordTrigramIndex';

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
];
