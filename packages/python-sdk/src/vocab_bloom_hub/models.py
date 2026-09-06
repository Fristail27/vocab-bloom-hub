"""The public contract under readable names.

Everything here is derived from the generated pydantic models
(``vocab_bloom_hub._generated.models``, produced from the server's
``openapi/public-v1.json``), so it cannot drift from the API. The generated
module stays importable for anything not aliased.
"""

from __future__ import annotations

from ._generated import models as _g

# ------------------------------------------------------------- entities
Word = _g.EnWordT
SearchWord = _g.EnSearchWordT
Meaning = _g.PublicMeaningV1T
WordForm = _g.PublicWordFormV1T
ShortTranslation = _g.PublicShortTranslationV1T
MeaningTranslation = _g.PublicMeaningTranslationV1T
HeadwordTranslations = _g.PublicHeadwordTranslationsV1T
Meta = _g.PublicMetaV1T
DatasetCounts = _g.PublicDatasetCountsV1T
AvailableLanguages = _g.PublicAvailableLanguagesV1T
ApiError = _g.PublicApiErrorT

# ----------------------------------------------------------------- enums
PartOfSpeech = _g.EnPartOfSpeechE
WordLevel = _g.WordLevelE
LanguageRegister = _g.LanguageRegisterE
Category = _g.CategoryE
AreaVariant = _g.EnAreaVariantsE
WordFormKind = _g.EnWordFormsE
VerbTransitivity = _g.EnVerbTransitivityE
PhrasalObjectPattern = _g.EnPhrasalObjectPatternE
TranslationLanguage = _g.AvailableTranslationLanguagesE

# ------------------------------------------------------------- responses
SearchResponse = _g.PublicSearchV1ResT
DetailedSearchResponse = _g.PublicSearchDetailedV1ResT
WordResponse = _g.PublicWordV1ResT
HeadwordResponse = _g.PublicHeadwordV1ResT
MeaningsResponse = _g.PublicHeadwordMeaningsV1ResT
TranslationsResponse = _g.PublicHeadwordTranslationsV1ResT
FormsResponse = _g.PublicHeadwordFormsV1ResT
WordsResponse = _g.PublicWordsV1ResT
MetaResponse = _g.PublicMetaV1ResT
SuggestionCreatedResponse = _g.PublicSuggestionCreatedV1ResT

__all__ = [
    "ApiError",
    "AreaVariant",
    "AvailableLanguages",
    "Category",
    "DatasetCounts",
    "DetailedSearchResponse",
    "FormsResponse",
    "HeadwordResponse",
    "HeadwordTranslations",
    "LanguageRegister",
    "Meaning",
    "MeaningTranslation",
    "MeaningsResponse",
    "Meta",
    "MetaResponse",
    "PartOfSpeech",
    "PhrasalObjectPattern",
    "SearchResponse",
    "SearchWord",
    "ShortTranslation",
    "SuggestionCreatedResponse",
    "TranslationLanguage",
    "TranslationsResponse",
    "VerbTransitivity",
    "Word",
    "WordForm",
    "WordFormKind",
    "WordLevel",
    "WordResponse",
    "WordsResponse",
]
