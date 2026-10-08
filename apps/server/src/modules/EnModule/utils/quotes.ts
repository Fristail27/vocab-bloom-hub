import { BadRequestException } from '@nestjs/common';
import type { MeaningQuoteT } from '../../../../types/dictionaries/en/quotes';

/** Preserve full text, reference and order; no example sentence length/count cap. */
export function normalizeQuotes(value: unknown): MeaningQuoteT[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new BadRequestException('Invalid quotes');
  return value.map((quote: unknown) => {
    if (!quote || typeof quote !== 'object' || Array.isArray(quote))
      throw new BadRequestException('Invalid quote');
    const q = quote as Record<string, unknown>;
    if (
      typeof q.text !== 'string' ||
      !q.text.trim() ||
      (q.reference != null && typeof q.reference !== 'string') ||
      (q.source_url != null && (typeof q.source_url !== 'string' || !isSourceUrl(q.source_url))) ||
      Object.keys(q).some((key) => !['text', 'reference', 'source_url'].includes(key))
    )
      throw new BadRequestException('Invalid quote text, reference or source URL');
    return {
      text: q.text,
      reference: (q.reference as string | null | undefined) ?? null,
      ...(q.source_url !== undefined && { source_url: q.source_url as string | null }),
    };
  });
}

function isSourceUrl(value: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
