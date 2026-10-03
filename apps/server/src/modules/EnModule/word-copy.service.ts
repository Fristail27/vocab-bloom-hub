import { assertOrigins } from '../../core/utils/provenance';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { EntityManager, IsNull } from 'typeorm';
import { DatasetsService } from '../DatasetsModule/datasets.service';
import { Dataset } from '../DatasetsModule/entities/dataset.entity';
import { datasetOrigin, defaultOrigins } from '../../../core/utils/provenance';
import { inheritOrigin } from '../../../core/utils/origin_acquisitions';
import { contributionsOf } from '../../../core/utils/word_contributions';
import { ErrorCodes } from '../../../core/constants/error_codes';
import type { CopyWordSourceT, EnWordT, OriginT, OriginAcquisitionT } from '../../../types';
import { EnWord } from './entities/en_word.entity';
import { EnChange } from './entities/en_change.entity';
import { WORD_CHANGE_RELATIONS } from './utils/changes/words';
import { fullWordSnapshot, canonical } from './utils/changes/snapshots';
import { prepareWordFromDB } from './utils/prepareWordFromDB';
import { DICTIONARY_ENTITIES } from './entities/dictionary-entities';

export type CopiedWordT = {
  row: EnWord;
  history: EnChange[];
  origin: OriginT;
  acquisitionId: string;
  revision: string;
  origins: OriginT[];
};

@Injectable()
export class WordCopyService {
  constructor(private readonly datasets: DatasetsService) {}

  private async load(em: EntityManager, dataset: Dataset, id: number): Promise<CopiedWordT> {
    const row = await em.findOne(EnWord, {
      where: { id, base_form: IsNull() },
      relations: WORD_CHANGE_RELATIONS,
      relationLoadStrategy: 'query',
    });
    if (!row) throw new NotFoundException(ErrorCodes.word_doesnt_found);
    const history = await em.find(EnChange, {
      where: [
        { headword: row.word.word, part_of_speech: row.part_of_speech },
        { headword: row.word.word, part_of_speech: IsNull() },
      ],
      order: { id: 'ASC' },
    });
    const original = row.origins ?? defaultOrigins(dataset);
    const terms = datasetOrigin(dataset);
    const revision = createHash('sha256')
      .update(
        JSON.stringify(
          canonical({
            word: fullWordSnapshot(row),
            history,
            terms,
            origins: original,
          }),
        ),
      )
      .digest('hex');
    const acquisition: OriginAcquisitionT = {
      id: `copy:${dataset.name}:${id}:${revision}`,
      method: 'copy',
      recorded_at: null,
      revision,
    };
    const { origins, origin } = inheritOrigin(
      original,
      { ...terms, id: `source:${acquisition.id}` },
      acquisition,
      !dataset.own,
    );
    row.contributions = contributionsOf(
      origins,
      history.flatMap((change) => (!change.superseded_at && change.contribution ? [change.contribution] : [])),
    );
    assertOrigins(origins);
    return { row, history, origin, acquisitionId: acquisition.id, origins, revision };
  }

  async preview(datasetName: string, id: number): Promise<EnWordT & { copy_source: CopyWordSourceT }> {
    const dataset = await this.datasets.find(datasetName);
    const connection = await this.datasets.reader(dataset);
    const read = async (em: EntityManager) => {
      const snapshot = await this.load(em, dataset, id);
      return {
        ...prepareWordFromDB({ ...snapshot.row, origins: snapshot.origins }),
        copy_source: { dataset: dataset.name, id, revision: snapshot.revision },
      };
    };
    return this.datasets.supported
      ? connection.transaction('REPEATABLE READ', read)
      : connection.transaction(read);
  }

  /** Keep the source fixed from revision validation until the target commits. */
  async withSource<T>(source: CopyWordSourceT, work: (snapshot: CopiedWordT) => Promise<T>): Promise<T> {
    const dataset = await this.datasets.find(source.dataset);
    const connection = await this.datasets.reader(dataset);
    return connection.transaction('REPEATABLE READ', async (em) => {
      const tables = DICTIONARY_ENTITIES.map((entity) => connection.getMetadata(entity));
      const names = [
        ...tables,
        ...tables.flatMap((meta) =>
          meta.ownRelations.filter((r) => r.isManyToManyOwner).map((r) => r.junctionEntityMetadata!),
        ),
      ].map((meta) => connection.driver.escape(meta.tableName));
      await em.query(`LOCK TABLE ${names.join(', ')} IN SHARE MODE`);
      const captured = await em.findOneOrFail(Dataset, {
        where: { id: dataset.id },
        lock: { mode: 'pessimistic_read' },
      });
      const snapshot = await this.load(em, captured, source.id);
      if (snapshot.revision !== source.revision) throw new ConflictException(ErrorCodes.copy_source_changed);
      return work(snapshot);
    });
  }
}
