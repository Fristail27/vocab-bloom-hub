import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityMetadata, FindOptionsRelations, SelectQueryBuilder } from 'typeorm';
import { EnWord } from './entities/en_word.entity';
import { EnEntry } from './entities/en_entry.entity';
import { EnMeaning } from './entities/en_meaning.entity';
import { EnMeaningTranslation } from './entities/en_meaning_translation.entity';
import { EnShortTranslation } from './entities/en_short_translation.entity';

type PlainT = Record<string, unknown>;
type RelationsT = FindOptionsRelations<EnWord>;

/**
 * Loads dictionary entries with their relations as plain objects shaped like
 * the entities (issue #424). `find({ relations, relationLoadStrategy: 'query' })`
 * sends the same statements — one per relation, `WHERE fk IN (...)` over the id
 * list — but then spends four times the database's time turning the rows into
 * entity instances (~220 ms of a 275 ms batch of 50 headwords). Here each
 * statement selects its columns explicitly, the driver converts the raw values
 * (booleans, enums, arrays, JSON, dates — `prepareHydratedValue`, the same
 * conversion hydration applies) and the collections are grouped by foreign key
 * in one pass. The result is what the mappers (`prepareWordFromDB`,
 * `toPublicWord`) read: the scalar columns of every row and the relations asked
 * for, each collection ordered by its natural key.
 */
@Injectable()
export class WordRowsService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private get escape(): (name: string) => string {
    return (name) => this.dataSource.driver.escape(name);
  }

  private column(alias: string, databaseName: string): string {
    return `${this.escape(alias)}.${this.escape(databaseName)}`;
  }

  /** The scalar (non-foreign-key) columns of an entity, selected under `alias_<column>` */
  private selectScalars<T extends object>(
    qb: SelectQueryBuilder<T>,
    meta: EntityMetadata,
    alias: string,
  ): void {
    for (const col of meta.columns) {
      if (col.relationMetadata) continue;
      qb.addSelect(this.column(alias, col.databaseName), `${alias}_${col.databaseName}`);
    }
  }

  /** A foreign-key column, selected under `alias_<column>` */
  private selectKey<T extends object>(qb: SelectQueryBuilder<T>, alias: string, databaseName: string): void {
    qb.addSelect(this.column(alias, databaseName), `${alias}_${databaseName}`);
  }

  private hydrate(meta: EntityMetadata, raw: PlainT, alias: string): PlainT {
    const row: PlainT = {};
    for (const col of meta.columns) {
      if (col.relationMetadata) continue;
      const value = raw[`${alias}_${col.databaseName}`];
      row[col.propertyName] =
        value === undefined ? undefined : this.dataSource.driver.prepareHydratedValue(value, col);
    }
    return row;
  }

  private fk(meta: EntityMetadata, relation: string): string {
    const found = meta.findRelationWithPropertyPath(relation);
    if (!found || found.joinColumns.length !== 1) throw new Error(`no single join column for ${relation}`);
    return found.joinColumns[0].databaseName;
  }

  private junction(meta: EntityMetadata, relation: string): { table: string; owner: string; inverse: string } {
    const found = meta.findRelationWithPropertyPath(relation);
    const junction = found?.junctionEntityMetadata;
    if (!found || !junction) throw new Error(`no junction table for ${relation}`);
    return {
      table: junction.tableName,
      owner: found.joinColumns[0].databaseName,
      inverse: found.inverseJoinColumns[0].databaseName,
    };
  }

  // whether a relation option asks for the headword row (`{ word: true }`) of its rows
  private wantsEntry(option: unknown): boolean {
    return typeof option === 'object' && option !== null && Boolean((option as { word?: unknown }).word);
  }

  private groupBy<T>(rows: T[], key: (row: T) => unknown): Map<unknown, T[]> {
    const groups = new Map<unknown, T[]>();
    for (const row of rows) {
      const k = key(row);
      const group = groups.get(k);
      if (group) group.push(row);
      else groups.set(k, [row]);
    }
    return groups;
  }

  /**
   * The entries with the given ids, in the order of `ids`, carrying the
   * relations of `relations` (the keys of FULL_WORD_RELATIONS are understood);
   * an unknown id is skipped
   */
  async load(ids: number[], relations: RelationsT): Promise<EnWord[]> {
    if (ids.length === 0) return [];
    const words = this.dataSource.getMetadata(EnWord);
    const entries = this.dataSource.getMetadata(EnEntry);
    const meanings = this.dataSource.getMetadata(EnMeaning);
    const translations = this.dataSource.getMetadata(EnMeaningTranslation);
    const shorts = this.dataSource.getMetadata(EnShortTranslation);
    const wordFk = this.fk(words, 'word');
    const baseFormFk = this.fk(words, 'base_form');
    const basePhrasalFk = this.fk(words, 'base_phrasal');

    // ---- the entries themselves, with the headword row and the phrasal base
    const qb = this.dataSource.createQueryBuilder(EnWord, 'w').select([]);
    this.selectScalars(qb, words, 'w');
    this.selectKey(qb, 'w', wordFk);
    if (relations.word) {
      qb.leftJoin('w.word', 'entry');
      this.selectScalars(qb, entries, 'entry');
    }
    const basePhrasalEntry = this.wantsEntry(relations.base_phrasal);
    if (relations.base_phrasal) {
      qb.leftJoin('w.base_phrasal', 'bp');
      this.selectScalars(qb, words, 'bp');
      this.selectKey(qb, 'bp', wordFk);
      if (basePhrasalEntry) {
        qb.leftJoin('bp.word', 'bpe');
        this.selectScalars(qb, entries, 'bpe');
      }
    }
    const rawWords = (await qb
      .where(`${this.column('w', 'id')} IN (:...ids)`, { ids })
      .getRawMany()) as PlainT[];
    const byId = new Map<number, PlainT>();
    for (const raw of rawWords) {
      const row = this.hydrate(words, raw, 'w');
      row.word = relations.word ? this.hydrate(entries, raw, 'entry') : { word: raw[`w_${wordFk}`] };
      if (relations.base_phrasal) {
        const id = raw['bp_id'];
        row.base_phrasal =
          id === null || id === undefined
            ? null
            : {
                ...this.hydrate(words, raw, 'bp'),
                word: basePhrasalEntry ? this.hydrate(entries, raw, 'bpe') : { word: raw[`bp_${wordFk}`] },
              };
      }
      byId.set(row.id as number, row);
    }
    const found = ids.map((id) => byId.get(id)).filter((row): row is PlainT => row !== undefined);
    const foundIds = found.map((row) => row.id as number);
    if (foundIds.length === 0) return [];

    // ---- forms: the rows whose base form is one of the entries
    if (relations.forms) {
      const formEntry = this.wantsEntry(relations.forms);
      const fq = this.dataSource.createQueryBuilder(EnWord, 'f').select([]);
      this.selectScalars(fq, words, 'f');
      this.selectKey(fq, 'f', wordFk);
      this.selectKey(fq, 'f', baseFormFk);
      if (formEntry) {
        fq.leftJoin('f.word', 'fe');
        this.selectScalars(fq, entries, 'fe');
      }
      const rawForms = (await fq
        .where(`${this.column('f', baseFormFk)} IN (:...ids)`, { ids: foundIds })
        .orderBy(this.column('f', 'id'), 'ASC')
        .getRawMany()) as PlainT[];
      const forms = rawForms.map((raw) => ({
        ...this.hydrate(words, raw, 'f'),
        word: formEntry ? this.hydrate(entries, raw, 'fe') : { word: raw[`f_${wordFk}`] },
        base: raw[`f_${baseFormFk}`],
      }));
      const groups = this.groupBy(forms, (form) => form.base);
      for (const row of found) row.forms = (groups.get(row.id) ?? []).map(({ base: _base, ...form }) => form);
    }

    // ---- meanings, with their translations and word links
    if (relations.meanings) {
      const meaningFk = this.fk(meanings, 'word');
      const mq = this.dataSource.createQueryBuilder(EnMeaning, 'm').select([]);
      this.selectScalars(mq, meanings, 'm');
      this.selectKey(mq, 'm', meaningFk);
      const rawMeanings = (await mq
        .where(`${this.column('m', meaningFk)} IN (:...ids)`, { ids: foundIds })
        .orderBy(this.column('m', 'sort_order'), 'ASC')
        .addOrderBy(this.column('m', 'id'), 'ASC')
        .getRawMany()) as PlainT[];
      const rows: Array<PlainT & { owner: unknown }> = rawMeanings.map((raw) => ({
        ...this.hydrate(meanings, raw, 'm'),
        owner: raw[`m_${meaningFk}`],
      }));
      const meaningIds = rows.map((row) => row.id as number);
      const nested = typeof relations.meanings === 'object' ? relations.meanings : {};
      const translationsOf = new Map<unknown, PlainT[]>();
      const linksOf: Record<'synonyms' | 'antonyms', Map<unknown, PlainT[]>> = {
        synonyms: new Map(),
        antonyms: new Map(),
      };
      if (meaningIds.length > 0) {
        if (nested.translations) {
          const translationFk = this.fk(translations, 'meaning');
          const tq = this.dataSource.createQueryBuilder(EnMeaningTranslation, 't').select([]);
          this.selectScalars(tq, translations, 't');
          this.selectKey(tq, 't', translationFk);
          const rawTranslations = (await tq
            .where(`${this.column('t', translationFk)} IN (:...ids)`, { ids: meaningIds })
            .orderBy(this.column('t', 'id'), 'ASC')
            .getRawMany()) as PlainT[];
          for (const [owner, group] of this.groupBy(rawTranslations, (raw) => raw[`t_${translationFk}`])) {
            translationsOf.set(
              owner,
              group.map((raw) => this.hydrate(translations, raw, 't')),
            );
          }
        }
        for (const kind of ['synonyms', 'antonyms'] as const) {
          if (!nested[kind]) continue;
          // the junction rows joined with the linked headword's entry row
          const { table, owner, inverse } = this.junction(meanings, kind);
          const lq = this.dataSource
            .createQueryBuilder()
            .select(this.column('j', owner), 'owner')
            .from(table, 'j')
            .leftJoin(entries.tableName, 'le', `${this.column('le', 'word')} = ${this.column('j', inverse)}`);
          this.selectScalars(lq, entries, 'le');
          const rawLinks = (await lq
            .where(`${this.column('j', owner)} IN (:...ids)`, { ids: meaningIds })
            .orderBy(this.column('j', inverse), 'ASC')
            .getRawMany()) as PlainT[];
          for (const [meaningId, group] of this.groupBy(rawLinks, (link) => link.owner)) {
            linksOf[kind].set(
              meaningId,
              group.map((raw) => this.hydrate(entries, raw, 'le')),
            );
          }
        }
      }
      const groups = this.groupBy(rows, (row) => row.owner);
      for (const row of found) {
        row.meanings = (groups.get(row.id) ?? []).map(({ owner: _owner, ...meaning }) => ({
          ...meaning,
          ...(nested.translations && { translations: translationsOf.get(meaning.id) ?? [] }),
          ...(nested.synonyms && { synonyms: linksOf.synonyms.get(meaning.id) ?? [] }),
          ...(nested.antonyms && { antonyms: linksOf.antonyms.get(meaning.id) ?? [] }),
        }));
      }
    }

    // ---- short translations
    if (relations.short_translations) {
      const shortFk = this.fk(shorts, 'word');
      const sq = this.dataSource.createQueryBuilder(EnShortTranslation, 's').select([]);
      this.selectScalars(sq, shorts, 's');
      this.selectKey(sq, 's', shortFk);
      const rawShorts = (await sq
        .where(`${this.column('s', shortFk)} IN (:...ids)`, { ids: foundIds })
        .orderBy(this.column('s', 'id'), 'ASC')
        .getRawMany()) as PlainT[];
      const groups = this.groupBy(rawShorts, (raw) => raw[`s_${shortFk}`]);
      for (const row of found) {
        row.short_translations = (groups.get(row.id) ?? []).map((raw) => this.hydrate(shorts, raw, 's'));
      }
    }

    // ---- phrasal variants: the rows whose phrasal base is one of the entries
    if (relations.phrasal_variants) {
      const variantEntry = this.wantsEntry(relations.phrasal_variants);
      const vq = this.dataSource.createQueryBuilder(EnWord, 'v').select([]);
      this.selectScalars(vq, words, 'v');
      this.selectKey(vq, 'v', wordFk);
      this.selectKey(vq, 'v', basePhrasalFk);
      if (variantEntry) {
        vq.leftJoin('v.word', 've');
        this.selectScalars(vq, entries, 've');
      }
      const rawVariants = (await vq
        .where(`${this.column('v', basePhrasalFk)} IN (:...ids)`, { ids: foundIds })
        .orderBy(this.column('v', 'id'), 'ASC')
        .getRawMany()) as PlainT[];
      const variants = rawVariants.map((raw) => ({
        ...this.hydrate(words, raw, 'v'),
        word: variantEntry ? this.hydrate(entries, raw, 've') : { word: raw[`v_${wordFk}`] },
        base: raw[`v_${basePhrasalFk}`],
      }));
      const groups = this.groupBy(variants, (variant) => variant.base);
      for (const row of found) {
        row.phrasal_variants = (groups.get(row.id) ?? []).map(({ base: _base, ...variant }) => variant);
      }
    }

    return found as unknown as EnWord[];
  }
}
