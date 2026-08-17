// Must run before the entities are imported: checkIsPostgres() reads DATABASE_URL
// inside column decorators. An explicit in-memory sqlite keeps the e2e suite
// off both Postgres and the developer's dev.sqlite (issue #217).
process.env.DATABASE_URL = 'sqlite::memory:';
