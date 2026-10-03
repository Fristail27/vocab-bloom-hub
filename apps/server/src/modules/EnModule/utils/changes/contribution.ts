import { createHash } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import type { ChangeDiffT, OriginT } from '../../../../../types';
import { datasetOrigin } from '../../../../../core/utils/provenance';
import { originSnapshotKey } from '../../../../../core/utils/origin_acquisitions';
import { currentDataset } from '../../../../core/utils/dataset-scope';
import { Dataset } from '../../../DatasetsModule/entities/dataset.entity';

const METADATA_FIELDS = new Set(['origins', 'version', 'generated', 'generated_by_model', 'user_modified']);

/** A snapshot belongs to the edit, so reverting it also retires its contribution terms. */
export const captureContribution = async (em: EntityManager, diff: ChangeDiffT): Promise<OriginT | null> => {
  if (!currentDataset().own || !Object.keys(diff).some((field) => !METADATA_FIELDS.has(field))) return null;
  const dataset = await em.findOneOrFail(Dataset, { where: { name: currentDataset().name } });
  const origin = datasetOrigin(dataset);
  const revision = createHash('sha256').update(originSnapshotKey(origin)).digest('hex');
  return { ...origin, id: `contribution:${dataset.source}:${revision}` };
};
