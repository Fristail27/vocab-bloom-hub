import type { EntityManager } from 'typeorm';

/** Only origin objects change; quoted source text and grammatical articles do not. */
export const normalizeWordOriginScopes = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalizeWordOriginScopes);
  if (!value || typeof value !== 'object') return value;
  const object = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(object).map(([key, item]) => [
      key,
      key === 'scope' && item === 'article' && Array.isArray(object.licenses)
        ? 'word'
        : normalizeWordOriginScopes(item),
    ]),
  );
};

/** Bounded batches, including origin snapshots kept in the field history. */
export const normalizeStoredWordOrigins = async (em: EntityManager): Promise<void> => {
  const postgres = em.connection.options.type === 'postgres';
  const parameter = (index: number) => (postgres ? `$${index}` : '?');
  const tables = [
    { table: postgres ? '"public"."datasets"' : '"datasets"', columns: ['origins'] },
    { table: '"en_words"', columns: ['origins'] },
    { table: '"en_changes"', columns: ['inherited_from', 'diff'] },
  ];
  for (const { table, columns } of tables) {
    let after = 0;
    while (true) {
      const rows = (await em.query(
        `SELECT "id", ${columns.map((column) => `CAST("${column}" AS text) AS "${column}"`).join(', ')} FROM ${table}
         WHERE "id" > ${parameter(1)} AND (${columns.map((column) => `CAST("${column}" AS text) LIKE '%article%'`).join(' OR ')})
         ${postgres && table === '"public"."datasets"' ? 'AND "schema" = current_schema()' : ''}
         ORDER BY "id" LIMIT 100`,
        [after],
      )) as Array<{ id: number } & Record<string, string | number | null>>;
      if (!rows.length) break;
      for (const row of rows) {
        for (const column of columns) {
          if (row[column] == null) continue;
          const before: unknown = JSON.parse(row[column] as string);
          const next = JSON.stringify(normalizeWordOriginScopes(before));
          if (next === JSON.stringify(before)) continue;
          await em.query(`UPDATE ${table} SET "${column}" = ${parameter(1)} WHERE "id" = ${parameter(2)}`, [
            next,
            row.id,
          ]);
        }
      }
      after = rows.at(-1)!.id;
    }
  }
};
