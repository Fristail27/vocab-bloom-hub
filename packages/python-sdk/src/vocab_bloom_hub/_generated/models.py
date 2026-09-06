# Generated from apps/server/openapi/public-v1.json by scripts/generate_models.py — do not edit.
# ruff: noqa
# mypy: ignore-errors

from __future__ import annotations

from enum import Enum
from pydantic import BaseModel, Field
from typing import Any


class TargetType(Enum):
    word = "word"
    meaning = "meaning"
    meaning_translation = "meaning_translation"
    short_translation = "short_translation"


class SuggestionEditV1DTO(BaseModel):
    target_type: TargetType
    target_id: float = Field(..., description="Id of the targeted row, from the word answers")
    changes: dict[str, Any] = Field(
        ...,
        description='The proposed field values, e.g. { "definition": "…" }. The accepted fields depend on target_type; unknown fields, empty values and values equal to the current ones are rejected',
    )


class Kind(Enum):
    report = "report"
    edit = "edit"


class CreateSuggestionV1ReqDTO(BaseModel):
    headword: str = Field(..., description="The headword the report is about; must exist in the dictionary")
    word_id: dict[str, Any] | None = Field(
        None, description="Id of the entry (part of speech) the report points at, from the word answers"
    )
    kind: Kind = "report"
    message: dict[str, Any] | None = Field(
        None,
        description="What is wrong and, ideally, what would be right. Required for a report; an optional comment on an edit",
    )
    edits: list[SuggestionEditV1DTO] | None = Field(
        None, description="Edit flow: every touched target of the word form with its proposed values"
    )


class Type(Enum):
    """
    Restrict the answer to one entry type
    """

    word = "word"
    grammar_pattern = "grammar_pattern"
    phrase = "phrase"


class SearchV1ReqDTO(BaseModel):
    search: str = Field(..., max_length=256, min_length=1)
    type: Type | None = Field(None, description="Restrict the answer to one entry type")
    limit: int = Field(10, ge=1, le=100)


class TranslationLanguage(Enum):
    ru = "ru"


class SearchDetailedV1ReqDTO(BaseModel):
    search: str = Field(..., max_length=256, min_length=1)
    type: Type | None = Field(None, description="Restrict the answer to one entry type")
    limit: int = Field(10, ge=1, le=20)
    page: int = Field(1, ge=1, le=20)
    with_meanings: bool = Field(
        False, description="Join the meanings (with translations, synonyms, antonyms) of every item"
    )
    with_translations: bool = Field(False, description="Join the short translations of every item")
    translation_languages: list[TranslationLanguage] | None = Field(
        None, description="Keep only these translation languages; no value means all of them"
    )


class WordsBatchV1ReqDTO(BaseModel):
    words: list[str] = Field(
        ...,
        description="Headword spellings, 50 at most, each matched like GET /words/{word} (case-insensitively; an inflected form resolves to its base entry)",
        examples=[["run", "ran", "put up with"]],
        max_length=50,
        min_length=1,
    )


class PublicSearchV1MetaT(BaseModel):
    count: int
    fuzzy: bool
    short_term: bool


class WordLevelE(Enum):
    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"
    C2 = "C2"


class EnAreaVariantsE(Enum):
    common = "common"
    british = "british"
    american = "american"
    australian = "australian"


class CategoryE(Enum):
    scientific = "scientific"
    technical = "technical"
    medical = "medical"
    legal = "legal"
    business = "business"
    IT = "IT"
    art = "art"
    political = "political"
    sport = "sport"
    culinary = "culinary"


class LanguageRegisterE(Enum):
    formal = "formal"
    informal = "informal"
    slang = "slang"


class EnPartOfSpeechE(Enum):
    noun = "noun"
    verb = "verb"
    modal_verb = "modal_verb"
    adjective = "adjective"
    adverb = "adverb"
    pronoun = "pronoun"
    numeral = "numeral"
    numeral_fractional = "numeral_fractional"
    determiner = "determiner"
    interjection = "interjection"
    article = "article"
    preposition = "preposition"
    conjunction = "conjunction"
    letter = "letter"
    phrase = "phrase"
    grammar_pattern = "grammar_pattern"


class EnWordFormsE(Enum):
    base_form = "base_form"
    plural_form = "plural_form"
    possessive_singular_form = "possessive_singular_form"
    possessive_plural_form = "possessive_plural_form"
    past_simple = "past_simple"
    past_participle = "past_participle"
    present_participle = "present_participle"
    third_person_singular = "third_person_singular"
    comparative_form = "comparative_form"
    superlative_form = "superlative_form"
    object = "object"
    possessive_adjective = "possessive_adjective"
    possessive_pronoun = "possessive_pronoun"
    reflexive = "reflexive"
    ordinal = "ordinal"
    multiplicative = "multiplicative"


class EnVerbTransitivityE(Enum):
    transitive = "transitive"
    intransitive = "intransitive"
    both = "both"


class EnPhrasalObjectPatternE(Enum):
    no_object = "no_object"
    inseparable = "inseparable"
    separable = "separable"
    separable_pronoun_only = "separable_pronoun_only"


class EnWordFormT(BaseModel):
    word: str
    area_variant: EnAreaVariantsE
    id: int
    transcription: str | None = None
    form_of_word: EnWordFormsE
    is_obsolete: bool | None = None


class PublicSearchDetailedV1MetaT(BaseModel):
    page: int
    limit: int
    has_more: bool
    fuzzy: bool
    short_term: bool


class AvailableTranslationLanguagesE(Enum):
    ru = "ru"


class EnShortTranslationT(BaseModel):
    id: int
    description: str
    language: AvailableTranslationLanguagesE
    variants_of_words: list[str]


class PublicHeadwordV1MetaT(BaseModel):
    word: str
    count: int


class PublicWordFormV1T(BaseModel):
    word_id: int
    part_of_speech: EnPartOfSpeechE
    word: str
    area_variant: EnAreaVariantsE
    id: int
    transcription: str | None = None
    form_of_word: EnWordFormsE
    is_obsolete: bool | None = None


class PublicHeadwordFormsV1ResT(BaseModel):
    data: list[PublicWordFormV1T]
    meta: PublicHeadwordV1MetaT


class PublicShortTranslationV1T(BaseModel):
    word_id: int
    part_of_speech: EnPartOfSpeechE
    id: int
    description: str
    language: AvailableTranslationLanguagesE
    variants_of_words: list[str]


class PublicMeaningTranslationV1T(BaseModel):
    meaning_id: int
    word_id: int
    part_of_speech: EnPartOfSpeechE
    id: int
    language: AvailableTranslationLanguagesE
    title: str
    definition: str
    variants_of_words: list[str]


class PublicHeadwordTranslationsV1T(BaseModel):
    short_translations: list[PublicShortTranslationV1T]
    meaning_translations: list[PublicMeaningTranslationV1T]


class PublicHeadwordTranslationsV1ResT(BaseModel):
    meta: PublicHeadwordV1MetaT
    data: PublicHeadwordTranslationsV1T


class PublicWordsBatchV1MetaT(BaseModel):
    count: int
    not_found: list[str]


class PublicWordsV1MetaT(BaseModel):
    limit: int
    has_more: bool
    next_cursor: str | None = Field(...)


class PublicDatasetCountsV1T(BaseModel):
    entries: int
    words: int
    phrases: int
    grammar_patterns: int
    word_forms: int
    meanings: int
    meaning_translations: int
    short_translations: int


class PublicAvailableLanguagesV1T(BaseModel):
    source: list[str]
    translations: list[AvailableTranslationLanguagesE]


class PublicSuggestionCreatedV1T(BaseModel):
    id: int
    status: str


class PublicSuggestionCreatedV1ResT(BaseModel):
    data: PublicSuggestionCreatedV1T


class PublicApiErrorT(BaseModel):
    statusCode: float
    message: str
    error: bool


class EnSearchWordT(BaseModel):
    id: int
    generated: bool | None = None
    generated_by_model: str | None = None
    is_obsolete: bool | None = None
    is_abbreviation: bool | None = None
    word_level: WordLevelE | None = None
    area_variant: EnAreaVariantsE | None = None
    categories: list[CategoryE] | None = None
    language_register: LanguageRegisterE | None = None
    part_of_speech: EnPartOfSpeechE
    form_of_word: EnWordFormsE
    description: str | None = None
    transcription: str | None = None
    pattern: list[str] | None = None
    noun___irregular_plural: bool | None = None
    noun___uncountable: bool | None = None
    noun___is_proper: bool | None = None
    noun___always_plural: bool | None = None
    verb___is_irregular: bool | None = None
    verb___transitivity: EnVerbTransitivityE | None = None
    verb___is_phrasal: bool | None = None
    verb___phrasal_object_pattern: EnPhrasalObjectPatternE | None = None
    version: str
    word: str
    forms: list[EnWordFormT]
    phrasal_variants: list[str] | None = None
    base_phrasal: str | None = None
    base_form: dict[str, Any] | None = None
    similarity: float | None = None
    user_modified: bool | None = None


class EnMeaningTranslationT(BaseModel):
    id: int
    language: AvailableTranslationLanguagesE
    title: str
    definition: str
    variants_of_words: list[str]


class PublicMeaningV1T(BaseModel):
    word_id: int
    part_of_speech: EnPartOfSpeechE
    translations: list[EnMeaningTranslationT]
    synonyms: list[str]
    antonyms: list[str]
    id: int
    categories: list[CategoryE] | None = None
    meaning_level: WordLevelE | None = None
    area_variant: EnAreaVariantsE
    language_register: LanguageRegisterE | None = None
    sort_order: int
    title: str
    definition: str
    is_obsolete: bool
    examples: list[str]


class PublicHeadwordMeaningsV1ResT(BaseModel):
    data: list[PublicMeaningV1T]
    meta: PublicHeadwordV1MetaT


class PublicMetaV1T(BaseModel):
    api_version: str
    app_version: str
    dataset_version: str | None = Field(...)
    license: str
    license_url: str
    attribution: str
    counts: PublicDatasetCountsV1T
    available_languages: PublicAvailableLanguagesV1T


class PublicMetaV1ResT(BaseModel):
    data: PublicMetaV1T


class PublicSearchV1ResT(BaseModel):
    data: list[EnSearchWordT]
    meta: PublicSearchV1MetaT


class EnMeaningT(BaseModel):
    translations: list[EnMeaningTranslationT]
    synonyms: list[str]
    antonyms: list[str]
    id: int
    categories: list[CategoryE] | None = None
    meaning_level: WordLevelE | None = None
    area_variant: EnAreaVariantsE
    language_register: LanguageRegisterE | None = None
    sort_order: int
    title: str
    definition: str
    is_obsolete: bool
    examples: list[str]


class EnWordT(BaseModel):
    word: str
    meanings: list[EnMeaningT]
    short_translations: list[EnShortTranslationT]
    forms: list[EnWordFormT]
    phrasal_variants: list[str] | None = None
    base_phrasal: str | None = None
    base_form: dict[str, Any] | None = None
    similarity: float | None = None
    user_modified: bool | None = None
    id: int
    generated: bool | None = None
    generated_by_model: str | None = None
    is_obsolete: bool | None = None
    is_abbreviation: bool | None = None
    word_level: WordLevelE | None = None
    area_variant: EnAreaVariantsE | None = None
    categories: list[CategoryE] | None = None
    language_register: LanguageRegisterE | None = None
    part_of_speech: EnPartOfSpeechE
    form_of_word: EnWordFormsE
    description: str | None = None
    transcription: str | None = None
    pattern: list[str] | None = None
    noun___irregular_plural: bool | None = None
    noun___uncountable: bool | None = None
    noun___is_proper: bool | None = None
    noun___always_plural: bool | None = None
    verb___is_irregular: bool | None = None
    verb___transitivity: EnVerbTransitivityE | None = None
    verb___is_phrasal: bool | None = None
    verb___phrasal_object_pattern: EnPhrasalObjectPatternE | None = None
    version: str


class PublicWordV1ResT(BaseModel):
    data: EnWordT


class PublicHeadwordV1ResT(BaseModel):
    data: list[EnWordT]
    meta: PublicHeadwordV1MetaT


class PublicWordsBatchItemV1T(BaseModel):
    word: str
    count: int
    entries: list[EnWordT]


class PublicWordsBatchV1ResT(BaseModel):
    data: list[PublicWordsBatchItemV1T]
    meta: PublicWordsBatchV1MetaT


class PublicWordsV1ResT(BaseModel):
    data: list[EnWordT]
    meta: PublicWordsV1MetaT


class PublicSearchDetailedV1ResT(BaseModel):
    data: list[EnWordT]
    meta: PublicSearchDetailedV1MetaT
