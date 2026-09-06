export * from './en';
export * from './en/EnApiTypes';

export enum LanguageRegisterE {
  formal = 'formal',
  informal = 'informal',
  slang = 'slang',
}

export enum WordLevelE {
  A1 = 'A1',
  A2 = 'A2',
  B1 = 'B1',
  B2 = 'B2',
  C1 = 'C1',
  C2 = 'C2',
}

export enum CategoryE {
  scientific = 'scientific',
  technical = 'technical',
  medical = 'medical',
  legal = 'legal',
  business = 'business',
  IT = 'IT',
  art = 'art',
  political = 'political',
  sport = 'sport',
  culinary = 'culinary',
}

// The languages a translation may carry (issue #410 added Spanish; #394 made
// every consumer treat the value as data). Adding one: a Postgres migration
// widening both `..._language_enum` types, a flag + label in the admin
// (TranslationLanguageSelect), the spec and both SDKs regenerated
export enum AvailableTranslationLanguagesE {
  ru = 'ru',
  es = 'es',
}
