# Data license

The **code** of Vocab Bloom Hub is released under the [MIT license](LICENSE). The **dictionary
data of the project** — the entries, meanings, examples, translations and inflected forms an
instance is born with, exported from the card of the dataset, served by the public `/api/v1` and
published as the HuggingFace dataset
[`Fristail27/vocab-bloom-hub-en`](https://huggingface.co/datasets/Fristail27/vocab-bloom-hub-en)
— is licensed separately, under the

**[Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)
(CC BY 4.0)**, SPDX identifier `CC-BY-4.0`.

Copyright (c) 2026 Aleksei Ryzhov.

You are free to copy, redistribute and adapt the data for any purpose, including commercially,
as long as you credit the source, link to the license and indicate whether you changed anything.
A sufficient attribution:

> Vocabulary data from the Vocab Bloom Hub English dataset (CC BY 4.0),
> https://huggingface.co/datasets/Fristail27/vocab-bloom-hub-en

The same terms travel with the data everywhere it goes:

- `manifest.json` of every export carries `license` (`"CC-BY-4.0"`), `license_url`,
  `attribution` and the `source`, and a `LICENSE` file lies next to it;
- `GET /api/v1/meta` returns `license`, `license_url`, `attribution` and `source`;
- the admin _Export dictionary_ page shows them next to the download;
- the HuggingFace dataset card declares `license: cc-by-4.0` and ships `LICENSE` and `NOTICE`.

The constant behind them is `apps/server/core/constants/data_license.ts`: the terms the
project's dataset is registered with on an instance.

## Datasets of other sources

This license covers the project's own dataset and nothing else. An instance may hold datasets
converted from public sources and datasets of its owner's own
([`docs/datasets.md`](docs/datasets.md)), and **each dataset keeps the license of its source**:

| Dataset                         | License                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| The project's own (`default`)   | CC BY 4.0, this file                                                                  |
| English Wiktionary (kaikki.org) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) — share-alike         |
| Open English WordNet            | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)                             |
| Princeton WordNet 3.x           | [WordNet license](https://wordnet.princeton.edu/license-and-commercial-use)           |
| OpenGloss 2.4                   | CC BY 4.0; additional Princeton WordNet 3.0 terms on words marked as derived from it  |
| CMU Pronouncing Dictionary      | BSD 2-Clause, the pronunciations of a WordNet dataset converted with them             |
| A dataset of the owner's own    | the license its owner chose: CC0, CC BY, CC BY-SA, CC BY-NC, ODbL or one of their own |

While such a dataset is the active one, everything above — the manifest of an export,
`/api/v1/meta`, the word pages — carries **its** terms, and whoever uses the data of that
instance is bound by them. Datasets are read separately, but **one word can have several
sources and licenses**, including the terms of contributions made in a fork. The
converters and the code that serves the data stay MIT: the license of a source binds the data,
not the program that reads it.

> [!WARNING]
> **Read the license of a source before you install its dataset**, and before you build on an
> instance that serves it. Wiktionary is share-alike: a product built on an instance that
> serves it, an export of it and the corrections readers send while it is served stay under
> CC BY-SA 4.0. Princeton WordNet is not an open license in the Creative Commons sense: its
> notice has to travel with every copy. The card of a dataset in the admin panel states the
> terms in full before anything is installed; the instance shows the attribution and the
> notices of the served dataset to its readers, and so must whoever takes the data further.

The WordNet license and the one of the CMU Pronouncing Dictionary ask that their notice is kept
**in full on every copy**. For the datasets that carry them the notices are stated in the code
(`apps/server/core/constants/dataset_notices.ts`) and travel as `license_text` of
`/api/v1/meta`, on the page `/dataset-terms` of the website and in the `LICENSE` file of an
export. Open English WordNet is derived from Princeton WordNet and carries its notice too.

OpenGloss 2.4 declares CC BY 4.0 in its
[dataset card](https://huggingface.co/datasets/mjbommar/opengloss-v2.4-senses#sources-and-licences).
Words marked `source: wordnet-3.0` also retain the
[Princeton WordNet 3.0 notice](https://github.com/mjbommar/opengloss-generator/blob/main/LICENSES/WordNet.txt).
The converter records that additional origin only for those words. This release does not
declare Wiktionary as a source. Its generated content and source notices remain visible;
the CC BY label alone is not the complete set of terms for every OpenGloss word.

## Multiple sources and contributions

The dataset's primary `license` describes its default terms and new contributions. It does
not replace the terms of borrowed material. Read a word's `origins[]`, `contributions[]`
and `licenses[]` together: `origin_id` associates each license with the source or contribution
that supplies its attribution, version, links and notices. `license_relation: "all"` means
cumulative terms; `"any"` records alternatives explicitly offered by that source.

Creating a fork or copying a word retains the original sources without assigning the
receiving dataset's license to unchanged material. An actual content edit in an own dataset
adds the contribution terms captured at that time. Changing the dataset's license or version
does not rewrite earlier snapshots. Manual transfers can be declared with their sources and
licenses; unknown versions stay unknown. These declarations and the software's compatibility
checks do not establish rights to material the user does not have permission to reuse.

Keep the complete export, including `manifest.json`, `dataset-format.json`, word origins,
the history with contribution snapshots, and `LICENSE`. The marker identifies the format;
it does not contain the licenses itself. See
[sources and licenses](docs/datasets.md#multiple-origins-and-word-licenses) and
[the portable format](docs/offline-import.md#provenance-export-format).

## Why CC BY 4.0

MIT is a software license: it is ambiguous for a database of facts and says nothing about
attribution of derived datasets. CC BY 4.0 is the standard choice for open lexical data — free
for any use, machine-readable, and it asks for exactly the one thing the project needs, credit
that leads users back to the source. Share-alike (CC BY-SA) would have kept derived datasets
open but discourages embedding the dictionary in products, which is what the public API is for;
CC0 would have dropped the attribution the project relies on to be found.

## Provenance

Most of the data is generated by language models and is not human-verified; every record says
which model produced it. What that means for using the data, the known limitations and how to
report errors are in [`docs/data.md`](docs/data.md). Pass the notice on: `GET /api/v1/meta`
returns it as `notice`, the dataset card and the word pages of the website show it.

The models are chosen so that this license can be honoured. A provider whose terms only bind
the customer — DeepSeek's Open Platform terms assign the output to the user and expressly allow
derivative products and training other models — is compatible with CC BY 4.0; a provider whose
terms make the customer prevent _third parties_ from training on the output (xAI's API terms
for Grok, as of August 2026) is not, because CC BY 4.0 grants every recipient exactly that
right. The published data is generated with models of the first kind; the check is repeated
before a new model joins the pipeline. The terms of DeepSeek also ask that the DeepSeek name is
used only factually, without logos or any suggestion of endorsement.

## Contributions to the data

An entry edited in the admin UI, a correction sent through _Report a mistake_ on a word page
and applied by the owner, and a dataset revision contributed through the repository are
licensed under the same CC BY 4.0 — the word pages say so next to the form, and
[`CONTRIBUTING.md`](CONTRIBUTING.md#licensing-of-contributions) records it for pull requests.

**A correction takes the license of the dataset it corrects.** On an instance that serves
another dataset, an edit or an applied correction becomes part of that dataset: under
CC BY-SA 4.0 for Wiktionary, under the license the dataset is registered with for any other.
The form on the word page names the license before the reader sends anything, and the admin UI
names it on the card of a word and in every dialog that edits one.

**Changes are indicated.** CC BY and CC BY-SA ask whoever shares modified material to say that
it was modified. An instance keeps a history of edits with every dataset
([`docs/datasets.md`](docs/datasets.md#editing-a-dataset-the-history-of-edits)): an entry that
was changed or added says so to its readers, what was changed is public with the values before
and after, and the history travels with an export — the manifest counts the modified entries.
Wiktionary and the WordNet datasets refuse generated content. OpenGloss explicitly declares
generated content and accepts it, as do the project's dataset and datasets of the owner's own.

**A contributor is named only when they ask.** A reader may give a name with a correction and
agree to have it published; it is then a part of the history and of its exports, and is removed
on request ([`docs/data.md`](docs/data.md#personal-data)).

## Using data that was changed on an instance

The owner of an instance may edit the data it serves, and the instance says where it did. Whoever
takes data from an instance — through the API, from an export, from a word page — takes it with
that indication and is asked to keep it:

| What the instance gives                                                         | Where                                                                                                                                                  |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Where an entry comes from                                                       | `source` on every word of `/api/v1`, on every part of one and on every edit of the history                                                             |
| Whether an entry was changed or added                                           | `modified` on every word of `/api/v1` and on every part of one: meanings, forms, translations, links                                                   |
| What was changed, with the values before and after, and who sent the correction | `GET /api/v1/words/{word}/history`                                                                                                                     |
| How many headwords differ from the source                                       | `modified_entries` of `GET /api/v1/meta`, and of `manifest.json` in an export                                                                          |
| The history itself, to travel with a copy                                       | `vocab-bloom-hub-en-changes.jsonl` of an export                                                                                                        |
| The license and the notices of the source                                       | `license`, `license_url`, `attribution`, `license_text` of `/api/v1/meta`; `LICENSE` of an export                                                      |
| The sources and contribution terms of a particular word                         | `origins`, `contributions`, `licenses` on word responses; origins in exported entry lines and contributions in the history file                        |
| The same for every dataset the instance holds, not only the one it serves       | the groups of `GET /api/v1/words/{word}/datasets`, each with its terms; the edits of one through `GET /api/v1/words/{word}/datasets/{dataset}/history` |

What to do with it, under every license a dataset can have:

1. **Credit the source**: show the `attribution` of `/api/v1/meta` and link to the license
   wherever you show the data, together with the attributions and notices of the word's
   original sources and contributions.
2. **Say that an entry was changed when it was.** An entry with `modified: true` is not, or not
   only, what its source published: do not present it as the words of Wiktionary, of WordNet or
   of the project's dataset without saying so. Passing the mark on — a line next to the entry, as
   the word pages do — is enough; the history is there for whoever wants to know what was changed.
3. **Retain inherited terms when adding your own contribution.** Editing or forking an entry
   does not relicense its original material. Contributions take the terms of the dataset
   where they were made, subject to the source's requirements. For Wiktionary-derived
   material those include CC BY-SA 4.0's ShareAlike requirement.
4. **Keep the notices in full where the license asks for it**: the WordNet license and the one of
   the CMU Pronouncing Dictionary want their text on every copy, a modified one included. It is
   `license_text` of `/api/v1/meta` and the `LICENSE` file of an export.
5. **Pass the indication on with a copy.** A dataset you redistribute keeps its `manifest.json`,
   its `dataset-format.json`, its `LICENSE`, word origins and its complete declared history;
   an instance that imports them retains the sources, contributions and modification marks.
6. **Do not suggest endorsement.** The names of the sources and of their authors are used to
   credit them, not to suggest that they stand behind a changed entry or behind your product.
7. **Keep the datasets apart when you read several.** `GET /api/v1/words/{word}/datasets` answers
   a group per dataset of the instance, and every group states its own `license`, `attribution`
   and `license_text`. An entry is used under the terms of the group it was taken from: credit
   each source for its own entries, keep the notices of each, and keep what you build on a
   share-alike group under that license. Entries of two groups merged into one text are a work
   under the terms of both.

An entry that was never edited (`modified: false`) is what the source published, as the converter
of the project read it ([`docs/datasets.md`](docs/datasets.md#public-sources)). `modified` goes
back to `false` when the owner takes a change back or when an update of the dataset replaces the
entry with the content of its source.

This is a description of what the licenses ask, written for the users of the software; it is
not legal advice, and the text of each license decides.

## Your own instance

A self-hosted instance ships the terms of its active dataset in its exports and its
`/api/v1/meta`, and the terms of every dataset it holds with the groups of
`GET /api/v1/words/{word}/datasets`: a dataset is public from the moment it is installed. The
terms of the datasets of the catalog — the project's own and the public sources — are stated in
the code (`apps/server/core/constants/dataset_catalog.ts`) and cannot be edited on an instance:
what you edit in such a dataset stays under the license of that dataset. Your own words go into
[a dataset of your own](docs/datasets.md#datasets-of-the-instances-own), created empty under a
license you choose; its license can be changed later, but a license that was given is not taken
back — whoever took the data under it keeps that right, and the change is journaled. A public
source that is not in the catalog is added with its converter
([`apps/server/src/converters/README.md`](apps/server/src/converters/README.md)).
