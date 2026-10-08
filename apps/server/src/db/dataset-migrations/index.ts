import { AddWordPronunciations1791700000000 } from './1791700000000-AddWordPronunciations';
import { AddMeaningQuotes1791600000000 } from './1791600000000-AddMeaningQuotes';
import { AddWordEtymologies1791500000000 } from './1791500000000-AddWordEtymologies';
import { AddWordOrigins1790200000000 } from './1790200000000-AddWordOrigins';
import { NormalizeWordOrigins1790200001000 } from './1790200001000-NormalizeWordOrigins';
import { AddChangeContribution1790200003000 } from './1790200003000-AddChangeContribution';
import { DatasetBaseline1789500000000 } from './1789500000000-DatasetBaseline';
import { AddChanges1789700000000 } from './1789700000000-AddChanges';
import { AddSuggestionAuthor1789800000000 } from './1789800000000-AddSuggestionAuthor';
import { ChangesCarryValues1789900000000 } from './1789900000000-ChangesCarryValues';

// The migrations of one dataset's tables (issue #527), run in every dataset
// schema at start and when a dataset is created — `public` included, where
// the baseline is marked as applied. They name no schema: the connection's
// search_path decides where they land. A change to a dictionary table goes
// here, not into ../migrations (docs/migrations.md).
import { AddEntryAlternatives1791400000000 } from './1791400000000-AddEntryAlternatives';

export const datasetMigrations = [
  DatasetBaseline1789500000000,
  AddChanges1789700000000,
  AddSuggestionAuthor1789800000000,
  ChangesCarryValues1789900000000,
  AddWordOrigins1790200000000,
  NormalizeWordOrigins1790200001000,
  AddChangeContribution1790200003000,
  AddEntryAlternatives1791400000000,
  AddWordEtymologies1791500000000,
  AddMeaningQuotes1791600000000,
  AddWordPronunciations1791700000000,
];

/** The table each dataset schema records its applied migrations in */
export const DATASET_MIGRATIONS_TABLE = 'dataset_migrations';
