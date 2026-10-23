/** Portable derived data, independent of inference availability. */
export type EmbeddingProfileT = {
  model: string;
  revision: string;
  dimensions: number;
  normalization: 'l2';
  document_format: string;
  query_format: string;
};
export type EmbeddingManifestT = {
  format: 1;
  profiles: Array<EmbeddingProfileT & { id: string }>;
};
export type MeaningEmbeddingLineT = {
  meaning_sync_id: string;
  profile_id: string;
  input_hash: string;
  embedding: number[];
};
