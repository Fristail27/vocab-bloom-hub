import type { DataSource } from 'typeorm';
import type { RecordedQueryT } from './query-recorder';

// A node of EXPLAIN (FORMAT JSON); only the fields the checks read
export type PlanNodeT = {
  'Node Type': string;
  'Relation Name'?: string;
  'Index Name'?: string;
  Plans?: PlanNodeT[];
};

export type SeqScanT = { relation: string; sql: string };

/** The tables large enough that a sequential scan on a hot path is a regression */
export const LARGE_TABLES = [
  'en_entries',
  'en_words',
  'en_meanings',
  'en_meanings_translations',
  'en_short_translations',
  'en_meaning_synonyms',
  'en_meaning_antonyms',
];

export const isExplainable = (sql: string): boolean => /^\s*(SELECT|WITH)\b/i.test(sql);

/** Runs EXPLAIN (FORMAT JSON) for a recorded statement with its parameters bound */
export const explainQuery = async (dataSource: DataSource, query: RecordedQueryT): Promise<PlanNodeT> => {
  const rows = (await dataSource.query(`EXPLAIN (FORMAT JSON) ${query.sql}`, query.parameters)) as Array<{
    'QUERY PLAN': Array<{ Plan: PlanNodeT }>;
  }>;
  return rows[0]['QUERY PLAN'][0].Plan;
};

export const walkPlan = (node: PlanNodeT, visit: (node: PlanNodeT) => void): void => {
  visit(node);
  node.Plans?.forEach((child) => walkPlan(child, visit));
};

/** Sequential scans over the given tables anywhere in a plan */
export const findSeqScans = (
  plan: PlanNodeT,
  sql: string,
  tables: readonly string[] = LARGE_TABLES,
): SeqScanT[] => {
  const found: SeqScanT[] = [];
  walkPlan(plan, (node) => {
    if (node['Node Type'] === 'Seq Scan' && node['Relation Name'] && tables.includes(node['Relation Name'])) {
      found.push({ relation: node['Relation Name'], sql });
    }
  });
  return found;
};

/** One line per scan node: the access method and the relation / index it touches */
export const summarizePlan = (plan: PlanNodeT): string[] => {
  const lines: string[] = [];
  walkPlan(plan, (node) => {
    if (node['Relation Name'] || node['Index Name']) {
      const target = node['Index Name'] ?? node['Relation Name'];
      lines.push(`${node['Node Type']} ${target}`);
    }
  });
  return lines;
};
