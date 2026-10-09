import type { OriginT, PublicDatasetTermsV1T, PublicWordV1T } from '../../../types';

function originsText(origins: OriginT[], label: string): string[] {
  return origins.flatMap((origin) => [
    `${label}: ${origin.name} (${origin.id}); version: ${origin.version ?? 'unspecified'}`,
    `Scope: ${origin.scope}; license relation: ${origin.license_relation}`,
    ...(origin.url ? [origin.url] : []),
    ...(origin.record_url ? [origin.record_url] : []),
    origin.attribution,
    ...origin.notices,
    ...(origin.licenses.length
      ? origin.licenses.flatMap((license) => [
          `License: ${license.name}${license.spdx ? ` (${license.spdx})` : ''}`,
          license.url,
          ...(license.text ? [license.text] : []),
        ])
      : ['License information unavailable']),
  ]);
}
export function renderDataset(terms: PublicDatasetTermsV1T, language: string): string {
  return [
    terms.title,
    `Database: ${terms.dataset}`,
    `Language: ${language}`,
    `Source: ${terms.source}`,
    `Version: ${terms.dataset_version ?? 'unspecified'}`,
    terms.description ?? '',
    terms.attribution,
    terms.attribution_url ?? '',
    `License: ${terms.license}`,
    terms.license_url,
    terms.license_text ?? '',
    terms.notice,
    ...originsText(terms.origins ?? [], 'Dataset origin'),
  ]
    .filter(Boolean)
    .join('\n');
}
export function renderDefinition(word: PublicWordV1T, requested: string, database: string): string {
  const origins = word.origins ?? [],
    contributions = word.contributions ?? [];
  return [
    `${word.word} (${word.part_of_speech})`,
    ...(word.word !== requested ? [`Requested spelling: ${requested}`] : []),
    `Database: ${database}; source: ${word.source ?? database}`,
    `Modified on this instance: ${word.modified ? 'yes' : 'no'}`,
    word.description ?? '',
    ...(word.pronunciations ?? []).flatMap((pronunciation) => [
      ...(pronunciation.text
        ? [`${pronunciation.type.toUpperCase()}: ${pronunciation.text} (${pronunciation.area_variant})`]
        : []),
      ...(pronunciation.audio ?? []).flatMap((audio) => [
        `Audio: ${audio.url}`,
        audio.source_url ?? '',
        audio.attribution ?? '',
        ...audio.licenses.flatMap((license) => [license.name, license.url, license.text ?? '']),
      ]),
    ]),
    ...(word.alternatives?.length ? [`Alternative spellings: ${word.alternatives.join(', ')}`] : []),
    ...word.forms.map((form) => `Form: ${form.word} (${form.form_of_word})`),
    ...(word.etymologies ?? []).map((etymology) => `Etymology ${etymology.number}: ${etymology.text}`),
    ...word.meanings.flatMap((meaning, i) => [
      '',
      `${i + 1}. ${meaning.definition}`,
      ...(meaning.etymology_number ? [`Etymology: ${meaning.etymology_number}`] : []),
      ...meaning.examples.map((example) => `Example: ${example}`),
      ...(meaning.quotes ?? []).flatMap((q) => [`Quote: ${q.text}`, q.reference ?? '', q.source_url ?? '']),
      ...(meaning.synonyms.length ? [`Synonyms: ${meaning.synonyms.join(', ')}`] : []),
      ...(meaning.antonyms.length ? [`Antonyms: ${meaning.antonyms.join(', ')}`] : []),
      ...meaning.translations.map(
        (translation) => `${translation.language}: ${translation.variants_of_words.join(', ')}`,
      ),
    ]),
    '',
    'Terms for this entry:',
    ...(!origins.length && !contributions.length ? ['License information unavailable'] : []),
    ...originsText(origins, 'Origin'),
    ...originsText(contributions, 'Contribution'),
  ].join('\n');
}
