// Must run before the entities are imported: checkIsPostgres() reads DATABASE_URL
// inside column decorators, while e2e tests run on the local sqlite fallback
delete process.env.DATABASE_URL;
