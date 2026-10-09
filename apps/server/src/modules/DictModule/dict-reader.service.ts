import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatasetsService, titleOf } from '../DatasetsModule/datasets.service';
import { Dataset } from '../DatasetsModule/entities/dataset.entity';
import { EnEntry } from '../EnModule/entities/en_entry.entity';
import { foldedWord } from '../EnModule/utils/foldedWord';
import { escapeLike } from '../EnModule/modules/EnSearch/utils/escapeLike';
import { HeadwordReader } from '../PublicApiModule/utils/headword-reader';
import { PublicMetaService } from '../PublicApiModule/public-meta.service';
import { DICT_LIMITS } from './config';
import { DictError } from './wire';
import { renderDataset, renderDefinition } from './render';

export type DictDefinition = { word: string; database: string; description: string; text: string };
export type DictMatch = { database: string; word: string };

@Injectable()
export class DictReaderService {
  constructor(
    private readonly datasets: DatasetsService,
    private readonly meta: PublicMetaService,
  ) {}

  /** Hold the same gate as HTTP for the entire command, including inactive readers. */
  async read<T>(work: () => Promise<T>): Promise<T> {
    await this.datasets.gate.enter();
    try {
      return await work();
    } finally {
      this.datasets.gate.leave();
    }
  }
  async databases(): Promise<Dataset[]> {
    const installed = await this.datasets.installed();
    return installed.sort((a, b) =>
      a.name === 'default' ? -1 : b.name === 'default' ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    );
  }
  private async selected(name: string): Promise<Dataset[]> {
    const all = await this.databases();
    if (name === '*' || name === '!') return all;
    const database = all.find((item) => item.name === name);
    if (!database) throw new DictError(550, 'Invalid database; use SHOW DB');
    return [database];
  }
  async info(name: string): Promise<string> {
    if (name === '*' || name === '!') throw new DictError(550, 'Invalid database; use SHOW DB');
    const [dataset] = await this.selected(name);
    return renderDataset(await this.meta.termsOf(dataset), dataset.language);
  }
  private async spellings(db: DataSource, word: string, strategy: string, limit: number): Promise<string[]> {
    if (word.length > 128) return [];
    const column = foldedWord('entry.word');
    const query = db
      .getRepository(EnEntry)
      .createQueryBuilder('entry')
      .leftJoin('entry.entries', 'own')
      .leftJoin('entry.alternatives', 'alternative')
      .leftJoin('alternative.entries', 'linked')
      .select('entry.word', 'word')
      .distinct(true)
      .where('(own.id IS NOT NULL OR linked.id IS NOT NULL)');
    if (strategy === 'exact') query.andWhere(`${column} = :word`, { word: word.toLowerCase() });
    else query.andWhere(`${column} LIKE :prefix ESCAPE '\\'`, { prefix: `${escapeLike(word.toLowerCase())}%` });
    const rows = await query.orderBy('entry.word', 'ASC').limit(limit).getRawMany<{ word: string }>();
    return rows.map((row) => row.word);
  }
  async matches(selector: string, strategy: string, word: string): Promise<DictMatch[]> {
    if (!['exact', 'prefix'].includes(strategy)) throw new DictError(551, 'Invalid strategy; use SHOW STRAT');
    const matches: DictMatch[] = [];
    for (const dataset of await this.selected(selector)) {
      const spellings = await this.spellings(
        await this.datasets.reader(dataset),
        word,
        strategy,
        DICT_LIMITS.matches + 1 - matches.length,
      );
      matches.push(...spellings.map((spelling) => ({ database: dataset.name, word: spelling })));
      if (matches.length > DICT_LIMITS.matches) throw new DictError(420, 'Too many matches; narrow the prefix');
      if (selector === '!' && matches.length) break;
    }
    return matches;
  }
  async definitions(selector: string, word: string): Promise<DictDefinition[]> {
    const definitions: DictDefinition[] = [];
    let bytes = 0;
    for (const dataset of await this.selected(selector)) {
      const db = await this.datasets.reader(dataset);
      const reader = HeadwordReader.on(db, dataset.source);
      const resolved = word.length <= 128 ? await reader.resolve(word) : undefined;
      let ids = resolved?.ids ?? [];
      if (!ids.length && word.length <= 128) {
        const aliases = await this.spellings(db, word, 'exact', DICT_LIMITS.definitions + 1);
        if (aliases.length > DICT_LIMITS.definitions) throw new DictError(420, 'Too many definitions');
        if (aliases.length) {
          const linked = await db
            .getRepository(EnEntry)
            .createQueryBuilder('entry')
            .innerJoin('entry.alternatives', 'alternative')
            .innerJoin('alternative.entries', 'w')
            .leftJoin('w.base_form', 'base')
            .select('COALESCE(base.id, w.id)', 'id')
            .where('entry.word IN (:...aliases)', { aliases })
            .distinct(true)
            .limit(DICT_LIMITS.definitions + 1)
            .getRawMany<{ id: number }>();
          ids = linked.map((row) => Number(row.id));
        }
      }
      if (definitions.length + ids.length > DICT_LIMITS.definitions)
        throw new DictError(420, 'Too many definitions');
      const rows = await reader.loadFull(ids);
      for (const entry of rows) {
        const text = renderDefinition(entry, word, dataset.name);
        bytes += Buffer.byteLength(text);
        if (bytes > DICT_LIMITS.responseBytes)
          throw new DictError(420, 'Response too large; choose one database');
        definitions.push({ word: entry.word, database: dataset.name, description: titleOf(dataset), text });
      }
      if (selector === '!' && definitions.length) break;
    }
    return definitions;
  }
}
