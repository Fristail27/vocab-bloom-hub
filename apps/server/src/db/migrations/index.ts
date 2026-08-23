import { Baseline1786903614082 } from './1786903614082-Baseline';
import { AddMeaningSynonyms1787504717645 } from './1787504717645-AddMeaningSynonyms';

// Every migration class must be listed here: both the CLI DataSource and the
// runtime TypeORM options read this array. An explicit list (instead of a
// path glob) resolves identically from ts-node and from the compiled dist.
export const migrations = [Baseline1786903614082, AddMeaningSynonyms1787504717645];
