import { type Response } from 'express';
import { DatasetManifestT } from '../../../../../../types';

/**
 * Where the dataset files come from. The import pipeline only ever sees
 * local file paths: a source makes each jsonl file available on disk and
 * says whether the pipeline may delete it afterwards.
 */
export interface DatasetSource {
  /** The dataset manifest, or null when the source has none (HuggingFace may be unreachable) */
  readManifest(): Promise<DatasetManifestT | null>;
  /**
   * Makes the given dataset file available locally, streaming download
   * progress into `res` when it has to be fetched first
   */
  acquireFile(fileName: string, res: Response): Promise<AcquiredFileT>;
  /** Releases everything the source holds on disk (extracted archives, uploads) */
  dispose(): Promise<void>;
}

export type AcquiredFileT = {
  path: string;
  // true for files the source created itself (downloads); the pipeline
  // deletes those once they are imported, never the user's own files
  temporary: boolean;
};
