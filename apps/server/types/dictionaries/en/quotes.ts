/** A sourced quotation, in authored array order. Missing attribution is explicit. */
export type MeaningQuoteT = {
  text: string;
  reference: string | null;
  source_url?: string | null;
};
