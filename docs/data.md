# Dictionary data: provenance and quality

What the dictionary is made of, where it comes from, what is known to be wrong with it and how
to report errors. The terms of use are in [`DATA_LICENSE.md`](../DATA_LICENSE.md): the data is
**CC BY 4.0**, the code is MIT. The published copy of the data is the HuggingFace dataset
[`Fristail27/vocab-bloom-hub-en`](https://huggingface.co/datasets/Fristail27/vocab-bloom-hub-en);
its dataset card is the full, revision-specific version of this page (counts per model, field
statistics, content notes).

## Where the data comes from

Every entry is produced by an **LLM-assisted pipeline** — a model is asked for the entry
(transcription, CEFR level, senses with definitions and examples, Russian translations,
inflected forms), the answer is stored in the Hub database, and the database is what gets
exported and published. Nothing is scraped or copied from other dictionaries.

Two columns on every base-form word record the provenance:

| Field                | Meaning                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| `generated`          | `true` when the entry was produced by a model; `false` for entries authored by hand in the admin  |
| `generated_by_model` | The model behind the entry, as an OpenRouter-style id (`deepseek/deepseek-v4-flash`); may be null |

Both are exported into the dataset files (`words`, `phrases`, `grammar-patterns`). The bulk of
the published revision comes from DeepSeek v4 Flash, with smaller batches from
`deepseek/deepseek-v4-pro` and `x-ai/grok-4.1-fast`; early batches were labelled by hand, so the
same model can appear under several spellings, and a few hundred records carry no label. The
exact numbers for a revision are on the dataset card.

**Human review** so far is spot-checking and targeted fixes through the admin UI; there is no
systematic reviewed subset yet, so treat every entry as machine-generated. A review pass over
the A1–B2 vocabulary is on the roadmap.

## Known limitations

- **Not a lexicographic authority.** Definitions, examples, CEFR levels, register and domain
  labels are model judgements. Hallucinated senses and invented examples are possible; do not
  use the data as ground truth for evaluating other dictionaries or as a citable source of
  English usage.
- **Translations are generated too** and have not been reviewed by a translator. Russian is the
  only translation language populated.
- **Entry-level `language_register` is unreliable on words** — almost every word says `formal`
  because the field defaulted that way during generation. The per-sense register inside
  `meanings` is the meaningful one.
- **No frequency data.** CEFR levels are model judgements, not corpus-derived; there is no
  frequency ranking or attestation.
- **`""` means "not set"** for every enum field (level, transitivity, phrasal object pattern).
- **Offensive vocabulary is included** — the word list aims at broad coverage, so it contains
  slurs and vulgar and outdated terms, described rather than endorsed. Applications that surface
  random entries should filter on `language_register`, `is_obsolete` and their sense-level
  equivalents; a dedicated sensitivity flag does not exist yet.
- **Bias.** Model-generated text inherits the biases of the generating models, most visibly in
  which senses are listed first and in the connotations attached to social, political and
  religious vocabulary.

The data contains no personal information.

## Reporting errors

Fixes land in the Hub database, never in the published JSONL files (they are overwritten by the
next export):

- A wrong definition, translation, level or missing word →
  [open an issue](https://github.com/Fristail27/vocab-bloom-hub/issues) with the bug template,
  quoting the headword, the field and what it should be.
- On your own instance, fix it in the admin UI and re-export.

## Where the terms are exposed

| Place                           | What it carries                                                     |
| ------------------------------- | ------------------------------------------------------------------- |
| `manifest.json` of every export | `license: "CC-BY-4.0"`, `attribution`                               |
| `GET /api/v1/meta`              | `license`, `license_url`, `attribution` (see [`api.md`](api.md))    |
| Admin → _Export dictionary_     | License name, link and attribution line next to the download        |
| HuggingFace dataset card        | `license: cc-by-4.0` front matter, `LICENSE`, `NOTICE`, this notice |

All of them read `DATA_LICENSE` from `apps/server/core/constants/data_license.ts`.
