// Must be imported before the entities: checkIsPostgres() reads DATABASE_URL
// inside column decorators, while tests run on an in-memory sqlite DB
delete process.env.DATABASE_URL;
