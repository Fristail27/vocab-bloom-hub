// The language dimension of the dictionary (issue #394). The source language
// is structural: the `en_` tables, modules and routes assume English, so a
// second one is a rewrite rather than a value. The translation languages are
// the members of AvailableTranslationLanguagesE (types/dictionaries); both are
// reported by GET /api/v1/meta so a consumer can discover what an instance
// serves instead of assuming it.
export const SOURCE_LANGUAGES = ['en'] as const;
