# Datasets: several dictionaries in one instance

An instance is born with one dictionary, the project's own dataset. It can hold more — the
English Wiktionary, Open English WordNet, Princeton WordNet, OpenGloss, and
[dictionaries of the owner's own](#datasets-of-the-instances-own) — each one complete and
separate, **one of them served at a time**. Datasets are never mixed: an answer of the API comes
from one dataset (or separate dataset groups) and carries its terms. Within a dataset,
a word can retain [several sources and licenses](#multiple-origins-and-word-licenses).

|                     |                                                                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Needs               | PostgreSQL. On SQLite (development) there is the default dataset only and the page says so                                                    |
| Where               | Admin → **Managing → Datasets**; `/api/en/datasets` of the admin API                                                                          |
| Which datasets      | the ones the code knows — a closed catalog, with the license and the attribution of each stated in it — and the owner's own                   |
| A dataset is        | a Postgres schema with the dictionary tables in it, plus a row in the registry                                                                |
| The default dataset | `default`, the tables in `public` an instance always had. It cannot be deleted                                                                |
| Switching           | a click; the server re-opens its database connection on the other schema — no restart, no failed request                                      |
| Upgrading to this   | nothing to do: the migration registers the existing dictionary as `default` and leaves it in place                                            |
| Editing             | every dataset, [served or not](#the-dataset-that-is-edited); what was changed is kept as [a history](#editing-a-dataset-the-history-of-edits) |

## The catalog

The datasets page shows every dataset the instance can hold, installed or not:

| Dataset               | Name                | Source in the API   | License                                     | Installed from                                   |
| --------------------- | ------------------- | ------------------- | ------------------------------------------- | ------------------------------------------------ |
| The project's own     | `default`           | `vocab-bloom-hub`   | CC BY 4.0                                   | its card: HuggingFace or an export               |
| English Wiktionary    | `wiktionary`        | `wiktionary`        | CC BY-SA 4.0, **share-alike**               | `kaikki.org-dictionary-English.jsonl.gz`, 0.5 GB |
| Open English WordNet  | `wordnet`           | `wordnet`           | CC BY 4.0                                   | `english-wordnet-2025.zip`, 10 MB                |
| Princeton WordNet 3.1 | `wordnet_princeton` | `princeton-wordnet` | WordNet license                             | `wn3.1.dict.tar.gz`, 16 MB                       |
| OpenGloss 2.4         | `opengloss`         | `opengloss`         | CC BY 4.0 + WordNet license on marked words | Six Parquet shards, 1.32 GB                      |

The terms of a dataset — license, attribution line, the notice for readers — are **stated in
the code** (`apps/server/core/constants/dataset_catalog.ts`) and nowhere typed in: what a license
asks for is a fact about the source, and the instance shows it as it is. A new version of the
code that corrects an attribution line corrects it on every instance at its next start. A new
source is a converter and an entry of the catalog
([converters' README](../apps/server/src/converters/README.md#adding-a-source)); a dictionary of
one's own is [a dataset of the instance's own](#datasets-of-the-instances-own), next to the
catalog.

### OpenGloss 2.4

OpenGloss is a synthetic dictionary by Michael J. Bommarito II. The
[2.4 dataset card](https://huggingface.co/datasets/mjbommar/opengloss-v2.4-senses#sources-and-licences)
declares CC BY 4.0, including commercial use with attribution. The 40,643 lexemes
marked `source: wordnet-3.0` additionally retain the
[Princeton WordNet 3.0 license](https://github.com/mjbommar/opengloss-generator/blob/main/LICENSES/WordNet.txt).
Its copyright notice and disclaimer travel in full. The current release does not
declare Wiktionary as a source.

Choose **Download on the server** to fetch and install **all six files**: three
`senses` shards and three `lexicon` shards, about 1.32 GB in total. The manual
upload fallback groups them by table because the two tables use the same filenames;
attach each to the slot in its table’s section. Download links are pinned to
verified repository revisions. The converter recognizes version `2.4` by the
SHA-256 of all six files; otherwise it records the conversion date, as with other
undated inputs. It rejects mismatched tables, missing shards and unknown source
markers. Automatic checks for later OpenGloss releases are not available yet.

Every word retains an OpenGloss source snapshot; only marked WordNet-derived words
get an additional Princeton WordNet 3.0 snapshot. Dataset terms explain the mixed
origin and generated content. The converter includes canonical definitions,
neutral/plain examples, supported inflections, synonyms and antonyms of the same
part of speech. Inflections with unchanged spelling (such as `cut` → `cut`) are
retained; a shared form belongs to every base word that lists it and inherits
that base's sources and licenses.

OpenGloss also publishes some inflected verbs as separate articles with the same
complete verb paradigm as their lemma. The converter groups those paradigms before
writing entries: `ran`, `running` and `runs` become forms of `run`, and their verb
definitions and examples are merged into `run`. Their other parts of speech remain
independent entries. A group is folded only when the source contains one live base
matching the third-person singular, and the form is explicitly in that same paradigm.
Missing/incomplete or ambiguous paradigms are kept. Irregular homographs with other
live parts of speech are also kept: OpenGloss mixes the two verbs in `saw` under
the morphology of `see`. WordNet-derived entries are not folded by this rule.

**Previously installed OpenGloss:** an ordinary update preserves entries absent from
the new conversion, so it will retain old standalone `ran`-style articles. Apply this
correction with a fresh installation of the dataset after updating the server. Export
first if the dataset has edits you need to retain; do not restore the old complete
export over the fresh installation, as it contains the same erroneous base entries.

Word links preserve the target's capitalization.
They point to headwords that exist in the imported dictionary, not to individual
source senses; self-links and an antonym already listed as a synonym are omitted.
Retired lexemes are omitted. Reading grades are not converted to
CEFR; no pronunciation or translation is invented. Encyclopedia articles, graded
rewrites, etymologies, training queries and other relations are outside this import.
Source lexeme/sense IDs, domain tags, frequency/ranking metadata and example spans
are not represented in the project's dictionary format either: this is a conversion
of the supported dictionary content, not a lossless archive of the Parquet tables.
Malformed definitions, examples and forms containing NUL or other damaged control
characters are omitted without guessing their spelling; the conversion reports
them as `malformed`. Other valid senses of the word remain. In the verified 2.4
files, 77 of the 300,787 definitions contain damaged text, leaving 300,710 usable definitions
before inflection normalization. Repeated definitions merged into one lemma are kept once.
Generated flags and the recorded model names are preserved. Forks, edits and
export/import use the same source and license rules as every other dataset.

## Installing a dataset

On the card of a dataset that is not installed, **How to install** opens its instruction:

1. **Download on the server** is selected by default. Press _Start_ to fetch the files directly
   from the links in the catalog. For WordNet, select the optional CMU Pronouncing Dictionary
   (`cmudict.dict`, BSD 2-Clause) to include pronunciations. Progress covers downloading,
   conversion and import; the dialog reports success only after import completes.
2. **Upload files manually** is the fallback for a server without internet access or a failed
   download. Download from the direct links or source pages, attach each file to its slot without
   unpacking it, then press _Start_. Both modes validate the same files and import the same data
   into a separate schema. **The active dataset keeps serving meanwhile.**
3. **Activate it** on its card when the installation is done to serve it through the main API.
   Installed datasets are already visible through the all-datasets read and word-page tabs;
   activation changes which dataset the ordinary reads and search serve.

The instruction also states the license with its link, the attribution line to show, and what
to know before serving the data: that a share-alike license binds what is built on it, that
edits and corrections take the license of the dataset, how much space it needs.

Measured on a laptop, Postgres in Docker, the upload included:

| Dataset                        | Entries | Senses    | Translations | Installs in | In the database |
| ------------------------------ | ------- | --------- | ------------ | ----------- | --------------- |
| English Wiktionary, 2026-09-25 | 787 000 | 1 072 000 | 515 000      | 9 min       | 1.4 GB          |
| Open English WordNet 2025      | 135 000 | 185 000   | —            | 70 s        | 170 MB          |
| Princeton WordNet 3.1          | 155 000 | 207 000   | —            | 80 s        | 190 MB          |
| OpenGloss 2.4                  | 194 373 | 300 710   | —            | 3–4 min     | ~700 MB         |

The OpenGloss measurements above predate verb-inflection normalization; normalized
imports contain fewer base entries and may merge repeated definitions.

The public reads of the full Wiktionary — a headword, the search with its typo tolerance, a
page of the list — answer in under 10 ms, as they do on the project's dataset: every dataset
has the same indexes.

**Updating.** A source publishes newer files; installation still requires the admin to start it. On the card of
an installed dataset _Update from a newer file_ opens the same instruction: the entries are
replaced with the ones of the newer file, the entries you edited are kept, entries that are
gone from the source are not deleted. When the source has a file that is worth installing, the
card says so ([below](#versions-and-newer-files-of-a-source)). Server downloads use the catalog’s
links, which may pin a release; use manual upload for a newer release not yet linked in the catalog.

> [!NOTE]
> Manual uploads send all files in one request (up to 2 GiB per file); server downloads also limit
> each file to 2 GiB. A reverse proxy must allow the combined request size for manual uploads ([`deployment/reverse-proxy.md`](./deployment/reverse-proxy.md)), and
> both modes need free space for the source and converted files while installation runs —
> allow space for both, in addition to the final database.

The same over the API (an admin session in `cookies.txt`,
[`authentication.md`](./authentication.md)); the progress streams back as NDJSON, the
download (when selected), conversion, then the stages of the import:

```bash
curl -b cookies.txt http://localhost:3010/api/en/datasets                          # the catalog, what is installed

curl -N -b cookies.txt -H 'Content-Type: application/json' -d '{}' \
  http://localhost:3010/api/en/datasets/opengloss/install/download
curl -N -b cookies.txt -H 'Content-Type: application/json' -d '{"pronunciations":true}' \
  http://localhost:3010/api/en/datasets/wordnet/install/download

curl -N -b cookies.txt -F file=@kaikki.org-dictionary-English.jsonl.gz \
  http://localhost:3010/api/en/datasets/wiktionary/install
curl -N -b cookies.txt -F file=@english-wordnet-2025.zip -F pronunciations=@cmudict.dict \
  http://localhost:3010/api/en/datasets/wordnet/install

# OpenGloss manual upload: keep the identically named shards in separate table folders
curl -N -b cookies.txt \
  -F file=@senses/train-00000.parquet \
  -F senses_1=@senses/train-00001.parquet \
  -F senses_2=@senses/train-00002.parquet \
  -F lexicon=@lexicon/train-00000.parquet \
  -F lexicon_1=@lexicon/train-00001.parquet \
  -F lexicon_2=@lexicon/train-00002.parquet \
  http://localhost:3010/api/en/datasets/opengloss/install

curl -b cookies.txt -X POST http://localhost:3010/api/en/datasets/wiktionary/activate
curl -b cookies.txt -X DELETE http://localhost:3010/api/en/datasets/wordnet       # not the active one, not `default`
```

| Route                                           | What it does                                                                                                                                                   |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/en/datasets`                          | `{ supported, active, datasets: [...] }`: the catalog with `installed`, `active`, `version`                                                                    |
| `GET /api/en/datasets/updates`                  | `{ enabled, datasets: [{ name, installed, latest, url, comparable, update_available, checked_at }] }`: what the sources of the installed datasets have now     |
| `POST /api/en/datasets/{name}/install`          | installs or updates from the file of the source. `400 dataset_source_invalid` for another file                                                                 |
| `POST /api/en/datasets/{name}/install/download` | downloads the required catalog files and installs or updates them; optional JSON `pronunciations: true` includes CMUdict for WordNet. No custom URLs accepted. |
| `POST /api/en/datasets/{name}/activate`         | makes it the one the instance serves                                                                                                                           |
| `DELETE /api/en/datasets/{name}`                | drops the dataset with its schema. `409 dataset_is_active` / `dataset_is_default`                                                                              |

Downloads make up to three attempts for interrupted transfers and stop an attempt after 60 seconds
without data. Temporary downloads are deleted on success or failure.
Validation and conversion finish before dictionary rows are imported. A structural conversion
failure closes pending output files and publishes no completed manifest; installation reports
the original error instead of success. The CLI can leave partial output files, which are not
a completed dataset. A failure during the later database import may leave imported rows;
installation is not one transaction over the entire dictionary.

One import or installation runs at a time, including its download, and no dataset is activated or deleted while one
runs (`409 import_in_progress`, `409 datasets_busy`). On SQLite the routes that change the set
of datasets answer `409 datasets_not_supported`.

**A dataset of another instance.** An export is a dataset in the project's format and goes in
through _Import_ on the card of the dataset it belongs to; `dataset` of the import request names
it, a dataset of the catalog being installed when it is not
([`offline-import.md`](./offline-import.md)).

**Everything done with a dataset starts on its card** (issue #540): _Activate_, _Edit its
words_ (chooses it in [the switch of the header](#the-dataset-that-is-edited) and opens
_Managing_), _Import_ — the published dataset of the project, an archive or the files of a
dataset; a dataset of a public source is updated from the file of its source instead — _Export_,
_Edit the terms_ of a dataset of the owner's and _Delete_. A line says what the dataset is; what
it holds and its terms in full open under _Details_. The old addresses of the import and the
export pages lead to the datasets page.

## Versions and newer files of a source

**The version of a catalog dataset is derived from its source files.** It is read when the dataset is
installed, from the file as it was downloaded; the source is not asked, so an instance without
internet access records the same version as one with it, and two instances that installed the
same file report the same `dataset_version`.

| Dataset              | Where the file says it                                       | Version      |
| -------------------- | ------------------------------------------------------------ | ------------ |
| English Wiktionary   | the header of the gzip: the day the extract was made, in UTC | `2026.09.25` |
| Open English WordNet | the folder of the archive, `oewn2025/`                       | `2025`       |
| Princeton WordNet    | the name of its build log, `dict/log.grind.3.1`              | `3.1`        |
| OpenGloss            | all six files match the catalog's pinned SHA-256 hashes      | `2.4`        |
| the project's own    | `version` of the manifest of the published dataset           | `1.0.0`      |

- **Attach the file as it is.** An extract that was unpacked and packed again has lost its date,
  an archive packed without its folder its edition: the dataset is then recorded by **the day of
  the installation**, as every dataset was before the versions were read from the files.
- **The pronunciations of CMUdict have no version** and are not a part of the version of a
  WordNet dataset.
- **An installation takes no version from the admin.** Like the license and the attribution,
  the version of a file is a fact of the source. Two other ways into a dataset do carry a version
  that somebody wrote: an export of another instance, imported through the card of a dataset, brings the
  version of its manifest, and a manifest filled in by hand there brings the one that was typed
  ([`offline-import.md`](./offline-import.md)). The registry keeps what was installed and
  `GET /api/v1/meta` reports it; the settings field `en_dataset_version` mirrors the version of
  the active dataset for the readers of the settings and is not edited by hand — a version is
  what the file said for a catalog dataset. Own datasets and forks have an
  [editable version](#datasets-of-the-instances-own), which also updates that mirror when active.
- **A dataset installed by an earlier version of the server** keeps the day of its installation
  until it is installed again: the server does not have the file any more.
- The version is written into every entry of the dataset, into the registry and the manifest of
  an export, and is what `GET /api/v1/meta` and the groups of `GET /api/v1/words/{word}/datasets`
  report. It is a string a client shows, not one it computes with.

**A newer file of the source** is told on the card of the dataset: what is installed, what the
source has now, and a notice when the difference is worth an installation.

| Dataset              | What is asked, once a day at most                                       | The notice appears                                          |
| -------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------- |
| English Wiktionary   | `HEAD` of the extract on kaikki.org, for its `Last-Modified`            | when the extract of the source is **30 days or more** newer |
| Open English WordNet | the latest release of `globalwordnet/english-wordnet` on the GitHub API | when its edition is newer than the installed one            |
| Princeton WordNet    | nothing: frozen since 2011                                              | never                                                       |
| OpenGloss            | nothing: the catalog pins the verified 2.4 release                      | no automatic newer-release notice                           |
| the project's own    | nothing here: its import compares it with the published dataset         | in the import of its card                                   |

- **A notice, not an update.** The admin starts installation, choosing a server download from
  the catalog or a manual upload; the link of the notice leads to the page of the source.
- **Wiktionary is made again every few days**, so a notice for every new extract would never go
  away; the card shows the day of the extract of the source at any time.
- **Only installed datasets are asked about**, and only by an instance that may: with
  `UPDATE_CHECK=false` no update-check request leaves the server ([`environment.md`](./environment.md)).
  Explicit installation downloads and the first-start dictionary import still work. What
  is asked is stated in the catalog of datasets, next to the terms of the source. The answers are
  kept in memory for a day, a failure for half an hour; nothing is written to the database.
- **What is sent**: an anonymous request with a `User-Agent` of `vocab-bloom-hub/<version>`,
  nothing about the instance or its data. The file itself is not downloaded.
- **A version that cannot be compared gets no notice**: a dataset recorded by the day of its
  installation does not say which edition it holds, and nothing is guessed. The card says so and
  asks to install the dataset again from the file of its source (`comparable: false`).
- **An older file can be installed over a newer one**: the version becomes the one of the file
  that was attached, and the notice of a newer file appears again.
- `GET /api/en/datasets/updates` (admin) answers what the card shows. Nothing of it is a part of
  the public API.

## Datasets of the instance's own

Next to the catalog an instance holds dictionaries of its owner: rows of the registry marked `own`. The mark is kept, not derived from the catalog: an entry a later version adds to the catalog under the name of a dataset of the owner's does not take it over — its terms stay the owner's, and the source is never installed into it (`409 dataset_already_exists`). The catalog stays closed — nothing about its five datasets becomes
editable — and a dataset of one's own is where one's own words go, instead of into a dataset of
a public source, where they would be served under the name and the license of somebody else.

**Creating one.** _Managing → Datasets → Datasets of this instance → Create a dataset_, or
`POST /api/en/datasets`:

```json
{
  "name": "my_words",
  "title": "My words",
  "version": "1.0.0",
  "license": { "spdx": "CC-BY-4.0" },
  "attribution": "Words collected by the owner of this site",
  "attribution_url": "https://example.org/words"
}
```

- `name` is lower-case latin, digits and `_`, 2 to 40 characters; it becomes the schema
  `ds_<name>` and **the `source` of the data in the public API**. The names of the catalog — of
  its datasets and of its sources — are refused (`409 dataset_name_reserved`), and so is a name
  that is taken (`409 dataset_already_exists`).
- The dataset is created **empty**: a schema with the dictionary tables and the dataset
  migrations, a row in the registry. It is filled by choosing it as
  [the dataset that is edited](#the-dataset-that-is-edited), or by an import of an export of it.
- Any number of them. Activating and deleting work as for a dataset of the catalog.

**The version** is an optional label of up to 64 characters, set when creating or forking a
dataset and editable through _Edit the terms_ or `PATCH /api/en/datasets/{name}` with
`{ "version": "1.1.0" }`. A fork has its own version; its parent's version remains in the
source snapshot. Omit the field in a PATCH to keep it, or send `null` or an empty string to
clear it. Surrounding whitespace is trimmed. The registry, public dataset terms and export
manifest use this version. Changing it is journaled and applies to future word contributions;
existing word origins and history retain the versions captured at the time of their creation,
including an unknown version. An import with a manifest can subsequently set the version
from that manifest. A provenance-v1 snapshot that explicitly has no version clears the target's
previous version. Versions of catalog datasets continue to come from their source files.

**The license** is one of a closed list — `CC0-1.0`, `CC-BY-4.0`, `CC-BY-SA-4.0`,
`CC-BY-NC-4.0`, `ODbL-1.0` (`apps/server/core/constants/data_licenses.ts`, shared with the admin
UI) — named by its SPDX identifier, or **a license of the owner's own** when none of them fits:

```json
{ "license": { "name": "House License 1.0", "url": "https://example.org/license", "text": "…" } }
```

The text of such a license is served in full as `license_text` — by `/api/v1/meta` while the
dataset is active, in its group of `/api/v1/words/{word}/datasets`, on `/dataset-terms` of the
website — and written into the `LICENSE` file of an export, the way the notice of WordNet is. A
request that mixes the two, names a license the list does not have or leaves a part out answers
`400 dataset_license_invalid`.

**Correcting the terms.** _Edit the terms_ on the card, or `PATCH /api/en/datasets/{name}` with
any of the fields above but `name`. The title and the attribution are corrections. **The license
can be changed too, behind a warning** the dialog shows and asks to confirm:

- whoever took the data keeps the right to use it under the license it was taken under — a
  license that was given is not taken back;
- the corrections of readers were accepted under the license the report form named when they
  were sent;
- the API, the word pages and the exports carry the new license from then on;
- the change is written to the audit journal with the license before and after.

A dataset of the catalog answers `409 dataset_terms_fixed`: its terms are the catalog's.

What follows from a dataset of one's own:

- **`title`** names it for readers: `/api/v1/meta` and every group of the read of every dataset
  carry it, and the website names the tab of a word page by it.
- **Generated entries are allowed.** A human-authored public source refuses what a language model
  generated (`generated_not_allowed`); OpenGloss, the project's dataset and a dataset of the owner's take it —
  the owner states whatever notice their readers need in the attribution.
- **An export** names the dataset as its `source` in the manifest, with its license, and writes
  the terms into `LICENSE`; **an import** into the dataset takes data of that source under that
  license only (`409 dataset_source_mismatch` otherwise): data given under another license is not
  relicensed by an import.
- **"Modified"** means what it means for every dataset: an entry with edits in the history. For a
  dataset of one's own every entry is the owner's; the history still tells what changed when.

## What a switch changes

- **Every read of the public API** goes to the tables of the new active dataset: the words, the
  search, the list, the suggestions of the readers. The one exception is the read of a headword
  from every dataset ([below](#reading-every-dataset-at-once)), which answers from all of them
  whichever is active. The admin UI works on
  [the dataset that is edited](#the-dataset-that-is-edited) — the active one, unless its switch
  names another.
- **`GET /api/v1/meta`** reports the dataset (`dataset`, `source`, `dataset_version`) and its
  terms (`license`, `license_url`, `attribution`, `attribution_url`, `notice`, and `license_text`
  — the notices of the source in full, where its license asks for them); every word of the public API names its `source`, and so does every part of a word served on its own and every edit of the history. The word pages of the website print the license and the
  attribution of the dataset and lead to `/dataset-terms`, the page with the terms in full; the
  form _Report a mistake_ names the license a correction is sent under.
- **Caches are invalidated**: the `ETag` and `Last-Modified` of the public API change with the
  switch, so a client that revalidates gets the new data. The website keeps a rendered word page
  for up to an hour; rebuild or restart it to show the new dataset everywhere at once.
- **Case may tell two words apart.** The project's dataset writes its headwords in lower case;
  Wiktionary and WordNet hold `Polish` next to `polish`. Where a dataset holds both, each is a
  word of its own in the API and a page of its own on the website
  ([`api.md`](./api.md#spellings-that-differ-by-case)).
- **Ids are per dataset.** The entry with id 42 of one dataset has nothing to do with id 42 of
  another: a client that stored ids re-reads them by headword after a switch.
- **The history of edits is per dataset** too: the _History_ page lists the edits of the dataset
  that is edited, and says of every event of the instance which dataset it was about.
- **The moderation queue is per dataset**: a report about an entry stays with the dataset the
  entry belongs to — a report is filed in the active one — and is moderated while that dataset
  is the one that is edited.
- **The automatic first-start import** (`DICTIONARY_AUTO_IMPORT`) fills `default` only, and only
  while `default` is the active dataset.

## The dataset that is edited

The admin edits any dataset the instance holds without serving it: an empty dataset is filled
while the public API and the website go on serving the active one.

- **One switch in the header of the admin UI**: the dataset that is edited. The active dataset
  by default, any installed dataset on a choice; the choice is kept while the admin moves between
  pages (a cookie), and falls back to the active dataset when the chosen one is deleted or
  becomes the active one.
- It applies to **everything the admin does with the dictionary**: adding and editing words,
  meanings, translations and forms, deleting, the search, the lists, the statistics, the history
  of edits and the queue of suggestions. The import and the export name the dataset of their
  card.
  The datasets page, the settings and the journal of the instance are no part of one dataset.
- **Under the switch**, what the chosen dataset is: its title, source and license, the number of
  its entries, whether it is the one that is served, whether it is a dataset of the catalog or
  the owner's. For a dataset of a public source it reminds that an edit marks the entry as
  modified.

**In the API.** The admin routes of the dictionary (`/api/en/*` but `/api/en/datasets`,
`/api/en/dictionary/import` and `/api/en/audit`) take an optional `?dataset=<name>`. Without it
they work on the active dataset, as before; with another dataset they work on it through a
connection on its schema — the one the [read of every dataset](#reading-every-dataset-at-once)
keeps — and no statement names two schemas. The search of the admin UI is
`GET /api/en/search`, the flat search of the public API on the dataset the request names; the
public search serves the active dataset only. A name that is no dataset answers
`400 dataset_name_invalid`, a dataset the instance does not hold `404 dataset_not_found`.

- An edit leaves its row in `en_changes` **of the dataset it was made in**. Content edits are
  not duplicated in the audit journal; dataset operations such as changing terms are recorded there.
- **An edit of a dataset that is not served is public at once** on the tab of that dataset of a
  word page (`GET /api/v1/words/{word}/datasets`), and counts into the `Last-Modified` of the
  reads of every dataset; nothing the active dataset serves changes.
- "Report a mistake" is offered on the tab of the served dataset only: a report is filed in the
  active dataset.

## Reading every dataset at once

The public API serves the active dataset. One read answers from all of them:
`GET /api/v1/words/{word}/datasets` gives the headword as every dataset of the instance has it,
**a group per dataset** with the terms of that dataset, and
`GET /api/v1/words/{word}/datasets/{dataset}/history` gives what was changed in one of them
([`api.md`](./api.md#a-headword-in-every-dataset)). Nothing is activated for it and nothing is
merged: an entry stays in the group of its dataset, under the license of its source.

- **A connection per dataset.** A dataset that is not the active one is read through a small
  pool of its own (four connections at most, closed when idle like the ones of the application's
  pool), opened by the first such read and kept until the dataset is deleted or becomes the
  active one. With `N` datasets an instance may hold `DB_POOL_SIZE + 4 × (N − 1)` connections
  for its reads; count them against the connection limit of a managed Postgres.
- **No statement names two schemas**: each group is a read of one dataset, the ones the active
  dataset is answered with.
- **The search and the list stay on the active dataset.** So do the reports of the readers: a
  report is filed in the active dataset, and the ids of an entry of another group mean nothing
  there.
- **A word page of the website has a tab per dataset.** The page of a headword shows this read
  as tabs, one for every dataset that holds the word — the dataset of the project first,
  Wiktionary second, the others in the order of the instance; a headword one dataset holds has
  no tabs. A tab is a dataset on its own: the terms it comes under, its spelling, its entries
  and the history of its edits. The page that is sent holds the first tab only, whichever
  dataset is the active one: that is what the server renders, what is cached and what a search
  engine reads. The dataset of another tab is read by the browser from this route when the tab
  is pressed; the choice is no part of the URL. The sitemap and the index of words are the
  headwords of the active dataset, and a headword the active dataset does not hold is a page
  that is kept out of the search index. "Report a mistake" is offered on the tab of the active
  dataset only.
- **Each tab has its own word graph.** Open **Word connections** and choose a part-of-speech
  tab. Switch to **Translations by meaning** to see meaning-specific
  translations in the language selected by the page’s translation picker: individual translation variants in the same language share a node when their spelling matches
  (the title is used when no variants are recorded), with their definitions
  available on selection. Translations do not trigger English neighbor lookups. Each tab shows only that part of speech in a vertical canvas: the word at the top, then
  its meanings, synonyms and antonyms below. Selecting a direct neighbor loads its meanings
  and links from the same dataset and part of speech, one extra level only; missing entries
  never fall back to another dataset. Shared words join branches, while antonyms use dashed
  lines. Drag to pan, use the
  zoom controls, or select nodes through the keyboard-accessible selector and connection list.
  The view is bounded to 12 meanings per word, 24 direct neighbors and 150 nodes and says when
  it omits data; the full entries remain below. Neighbor reads start only on selection, use
  the public API rate limit, and can be retried after a failure.
- **An installed dataset is public.** Before this read existed a dataset was seen by nobody
  until it was activated; now its entries, the history of its edits and the names credited in
  it are read from the moment it is installed — half imported, if the import is still running.
  The datasets page of the admin says so. A dataset that must not be read yet is one that is
  not installed yet.
- **A connection that is not on its schema is refused.** A connection pooler that drops the
  `search_path` startup option would leave the connection of a dataset on `public`, and the
  default dataset would be answered under the terms of another. The server checks
  `current_schema()` when it opens the connection: the read fails with `500` and the log names
  the dataset ([`database.md`](./database.md#datasets-a-schema-each)).
- **`Last-Modified` costs a lookup per dataset**: the newest change of five tables in every
  schema, a sort without an index, at most once a minute and only while these routes are read
  ([`performance.md`](./performance.md)).

## Editing a dataset: the history of edits

Every dataset can be edited in the admin UI, a dataset of a public source like the project's
own. The licenses allow it, and each asks for something in return:

| Dataset                                 | License                                  | What an edit obliges to                                                        |
| --------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------ |
| The project's own, Open English WordNet | CC BY 4.0                                | keep the attribution, **indicate that the data was modified**                  |
| English Wiktionary                      | CC BY-SA 4.0                             | the same, and the modified entry stays under CC BY-SA                          |
| Princeton WordNet                       | WordNet license                          | the full notice with its disclaimer on every copy, modifications included      |
| OpenGloss                               | CC BY 4.0; WordNet terms on marked words | retain each word's sources and notices and indicate changes                    |
| CMU Pronouncing Dictionary              | BSD 2-Clause                             | keep the copyright notice (it travels with the WordNet datasets that carry it) |

What the instance does about it:

- **Every edit leaves a row in the history of its dataset** — the table `en_changes`, in the
  schema of the dataset, next to the entries it is about. A row holds what was edited (the
  entry, a form, a meaning, a translation), what was done (added, changed, deleted) and **the
  values before and after**, field by field; a record that was added or deleted is kept whole.
  Rows name an entry by its spelling and part of speech, never by an id: ids change when a
  dataset is updated and differ between instances.
- **A reader is told.** A word of the public API carries `modified: true` while it has edits
  that show in what is served — in every answer that carries an entry or a part of one, the
  searches and the partial reads included — and `/api/v1/meta` counts such headwords
  (`modified_entries`). The word page says _changed or added by the owner of this site_ under
  the part of speech, and `GET /api/v1/words/{word}/history` — the section _What was changed on
  this site_ of the word page — lists the edits with their values.
- **The admin is told before the edit**: the card of a word and every dialog of it name the
  dataset being edited and its license.
- **The notices of a source travel in full**: `license_text` of `/api/v1/meta`, the page
  `/dataset-terms` of the website, the instruction of the dataset in the admin UI and a
  `LICENSE` file in every export.
- **An export says how it differs from its source**: `modified_entries` in `manifest.json`, and
  the history itself as a file of the dataset
  ([`offline-import.md`](./offline-import.md#dataset-format)). An instance that imports the
  copy shows the same entries as modified.
- **Human-authored public sources refuse generated content**: Wiktionary and the WordNet
  datasets hold what people wrote and carry no notice about generated text. The forms offer
  no _generated_ switch there, the API answers `400 generated_not_allowed`, and an import that
  carries generated entries is refused. OpenGloss explicitly declares generated content and accepts it.

**What shows and what does not.** A row of the history _shows_ while the edit it records is a
part of what the instance serves. It stops showing — `superseded_at` is set, the row stays —
when an update of the dataset replaces the entry with the content of its source (after _Return
to the official version_), or when the change is taken back. An entry is `modified` exactly
while it has rows that show: there is no flag to keep in step with the table. Readers are shown
the rows that show; the admin sees all of them. History is never erased.

**Taking a change back.** _Take back_ on a row of the history restores the values the change
replaced: an edit gets its old values, a record that was added is removed, one that was deleted
comes back with everything it said. A history is undone from its end — when the record was
edited again after the change, the later change goes first (`409 change_outdated`). What is
restored is written to the history as a row of its own, and an entry with no change left is
what its source says again: an update of the dataset may replace it, and it carries the version
of its dataset instead of `custom_version` — the history records the version an entry had when
it became the owner's, and the last change taken back returns it. An entry edited before the
history recorded versions keeps `custom_version`: nothing is guessed. A change that no longer
shows cannot be taken back (`409 change_not_revertible`).

**The author of a correction.** A reader who sends a correction through _Report a mistake_ may
give a name, with an explicit consent to have it shown and exported; the name goes into the
history when the admin applies the correction and is shown on the word page. A name is personal
data ([`data.md`](./data.md#personal-data)): _Take a name out of the history_ on the _History_
page removes it from the history and the reports of **every dataset of the instance**; the
edits stay.

| Route                                | What it does                                                                                                                                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/words/{word}/history`   | public: the edits of a headword that show, the latest first ([`api.md`](./api.md#the-history-of-a-headword))                                                                                              |
| `GET /api/en/changes`                | admin: the whole history of the dataset a request names (`dataset`, the active one without it); `headword`, `part_of_speech`, `search`, `author`, `entity`, `action`, `origin`, `active`, `page`, `limit` |
| `POST /api/en/changes/{id}/revert`   | admin: takes one change back. `409 change_outdated`, `409 change_not_revertible`                                                                                                                          |
| `POST /api/en/changes/forget-author` | admin: `{ "author": "…" }` — takes a name out of every dataset; answers how many rows named it                                                                                                            |

The history is a part of the data, and the _History_ page keeps it apart from the journal of
the instance: **edits of the dictionary** on one tab — kept for good, exported with the dataset
— and **events of the instance** on the other: imports, settings, switches of the dataset,
verdicts on reports (`audit_log`, kept for `AUDIT_RETENTION_DAYS`). An edit is written to the
history only.

> [!NOTE]
> **A dataset is clean until an edit is recorded.** The history starts empty: on an instance
> that is upgraded, in a dataset that is installed, after an import of data that carries no
> history file. Nothing is guessed about what was edited before — `user_modified` still keeps
> such an entry through an update, and says nothing to a reader. From the first version with
> the history on, every edit is recorded and travels with an export.

## Datasets are never mixed

An import is refused with `409 dataset_source_mismatch` when the data names another source than
the dataset it would go into: an export of a Wiktionary dataset does not land in the project's
dataset because the target was left on _the active dataset_, and the published dataset of the
project does not land in an active Wiktionary. A dataset without a `source` in its manifest (an
export of an older version, files assembled by hand) is taken for what the target holds. An
installation cannot mix at all: the file of a source goes into the dataset of that source. A
[dataset of the instance's own](#datasets-of-the-instances-own) takes the exports of itself
under the license it has now, and nothing else.

> [!WARNING]
> **One server process per database.** A switch re-opens the connection of the process that
> handled the request; another server process on the same database keeps serving the dataset it
> started with until it is restarted. Run one, as the deployment guide asks
> ([`deployment/README.md`](./deployment/README.md)), or restart the others after a switch.

## Public sources

| Source                     | Where it comes from                                                                                                                                  | License                                  | Updated                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------- |
| English Wiktionary         | <https://kaikki.org/dictionary/English/>, the extract wiktextract makes of the wiki                                                                  | CC BY-SA 4.0                             | every few days                            |
| Open English WordNet       | <https://github.com/globalwordnet/english-wordnet/releases>                                                                                          | CC BY 4.0                                | an edition a year                         |
| Princeton WordNet 3.1      | <https://wordnet.princeton.edu>                                                                                                                      | WordNet license                          | not since 2011                            |
| OpenGloss 2.4              | [senses](https://huggingface.co/datasets/mjbommar/opengloss-v2.4-senses), [lexicon](https://huggingface.co/datasets/mjbommar/opengloss-v2.4-lexicon) | CC BY 4.0; WordNet terms on marked words | pinned release; no automatic update check |
| CMU Pronouncing Dictionary | <https://github.com/cmusphinx/cmudict>, the pronunciations of a WordNet dataset                                                                      | BSD 2-Clause                             | a correction at times                     |

What each source has and what a converted entry looks like — the titles derived from the
definitions, the forms folded into their base word, the translations of Wiktionary — is in the
[converters' README](../apps/server/src/converters/README.md), together with how to add a
source. The converters also run from a checkout, without an instance
(`yarn workspace server convert wordnet --input english-wordnet-2025.zip --out ./wordnet-en`):
the folder they write is a dataset like an export.

> [!IMPORTANT]
> **The license of a source binds the instance that serves it.** Wiktionary is share-alike: what
> the instance serves, exports and accepts as corrections while that dataset is active is under
> CC BY-SA 4.0, and a product built on it has to say so and keep derived data under the same
> license. Show the `attribution` of `GET /api/v1/meta` wherever you show the data. GPL sources
> (GCIDE) have no converter on purpose.

## On SQLite

SQLite has no schemas, and it is the database of development only: the instance holds the
default dataset, the datasets page shows the catalog and every instruction, and nothing can be
installed or created — the page says why, and the switch of the dataset that is edited lists the
one dataset. A dataset of a public source, and one of the owner's, needs PostgreSQL.

## In the database

```
public                 settings, datasets, audit_log, migrations, dataset_migrations,
                       the enum types — and the tables of the `default` dataset
ds_wiktionary          en_entries, en_words, en_meanings, …, en_changes, suggestions,
                       dataset_migrations
ds_wordnet             the same tables, other rows
ds_opengloss           the same tables, converted OpenGloss words and their origins
ds_my_words            a dataset of the instance's own: the same tables
```

The connection of the server carries `search_path = ds_<name>, public`: the dictionary tables
resolve to the active dataset, the shared tables to `public`. How the schemas are migrated,
backed up and what a connection pooler has to pass through:
[`database.md`](./database.md#datasets-a-schema-each) and
[`migrations.md`](./migrations.md#shared-and-dataset-migrations).

## Not there yet

- A search across datasets: the headword read answers from every dataset
  ([above](#reading-every-dataset-at-once)), the search from the active one (the admin UI: from
  the dataset that is edited).
- _Report a mistake_ on the tab of a dataset that is not served: a report is filed in the active
  dataset.
- Automatic updates of forks from their parents, merging words and a separate comparison
  with the original version. A fork already has its own contribution license and edit history.
- Datasets of other headword languages: the registry records the language of a dataset, the
  tables are the English ones.

## Multiple origins and word licenses

Each base word (headword and part of speech) keeps `origins[]`: immutable snapshots of
inherited sources and editable declarations of manually transferred material. Every source has
its own name, nullable version, optional source/word links, attribution, required notices,
and one or more licenses. `license_relation` distinguishes cumulative terms (`all`) from
alternatives offered by the source (`any`). The word's `licenses[]` retains an `origin_id`
for each license; two contributors using the same license remain separate.

An unchanged word in a fork retains only its original terms, including when another fork
is made or the word is copied again. A content edit in an own dataset records a
`contribution` snapshot in its history: the dataset's name, version (or null), links,
attribution, notices, and license terms at that moment. Repeated edits under the same
terms share a snapshot ID. Renaming the dataset or changing its version or license does not rewrite
earlier contributions; a later edit records the new terms.

Word reads expose the distinct snapshots of edits that still show as `contributions[]`.
Their `licenses[]` includes both original and contribution licenses; `origin_id` refers
to either collection. Forms and partial reads carry the same contributions as the base
word. Terms already present in its original sources are not repeated. The word page
labels the contributing dataset and its license separately from the original sources.
Reverting all applicable edits removes their contribution from the current word while
keeping the snapshots in its history. Inherited edits preserve their contribution terms
through copying, forking, and export/import.

Transfers through an unchanged own dataset still retain an acquisition event. Its optional
`via` field names that intermediate dataset, its version and link without adding its license
to the word. One existing source carries this event; the word's original terms stay intact.

This starts with newly recorded content edits. Earlier history has no contribution
snapshot: the migration leaves it unknown instead of assuming today's dataset terms
were in force then. Saving without changes, correcting provenance declarations, and
changing editorial flags do not create a content contribution.

Copying and forking record events in source snapshots' `acquisitions[]`, with an
ID, method (`copy` or `fork`), date, and revision. If the source snapshot already matches,
its ID and terms are retained and only the event is added. Different versions or terms
remain separate sources; manual declarations are preserved. Acquisition events travel
with word and dataset origins in the API and exports and cannot be removed by ordinary editing.
The dataset registry retains the full fork lineage. A word copied through an own dataset
does not acquire that dataset's current terms merely by passing through it; its actual
contributions are carried by the history instead.

A word created from scratch receives the dataset's current default terms. Sources marked
`scope: dataset` also apply by default, with an explanation that their distribution between
words is unknown. An import that supplies word-specific origins keeps those exact
origins; unrelated dataset sources are not added. Forms and partial API reads inherit the base
word's terms. Legacy rows receive only the known dataset terms; unknown dates and versions
stay unknown and the migration creates no historical edits.

The dataset's primary license remains its default/contribution license. It does not replace
borrowed terms, and changing it does not rewrite existing word snapshots. The supported
ShareAlike licenses require the same contribution license; a source explicitly offering
alternatives can satisfy that check with a compatible alternative. Custom terms are stored in
full and are not automatically verified for compatibility.

In **Edit sources and licenses**, add a source with its licenses or correct a manual declaration.
A correction needs a reason and records the previous and new values in the word's history.
Automatically inherited sources cannot be removed or changed here. Manual information is
identified as user-provided. A custom license needs its name, URL, and full text.

Own dataset settings also have a description, a notice displayed for every word, and multiple
origins. Required inherited notices are inside protected source records, separate from the
editable description and general notice. Dataset setting changes appear in the audit journal.

## Copying words and creating forks

Select an own dataset in the admin header and open **Add word → Prefill from another dataset**.
Choose an installed dataset, search for a headword, select a part of speech, and inspect the
preview. Save the populated form, optionally after editing. Repeat for other parts of speech.
The server captures both the published version and a revision of the actual installed word.
If the source changed since the preview, reopen it before saving. A word already present in
the destination is a conflict; there is no implicit overwrite or merge. For a phrasal verb, copy
its base verb first if the destination does not contain it. Lexical links use records local to
the destination.

A pure copy records its source without inventing changes to every field. Edits made in the
prefilled form are recorded relative to that source, field by field, and support the usual
reverts. Available source history is retained and labeled as inherited; inherited history cannot
be reverted in the receiving dataset. Unknown earlier history is not reconstructed.

On an installed dataset's card, **Create fork** makes a complete independent own dataset on
PostgreSQL. Set a unique name, title, description, and terms for contributions. Content,
relationships, origins, notices, and history are copied in one consistent database snapshot.
Progress reports copied tables. The new dataset appears only after the transaction commits;
a failed operation rolls back its schema and can be retried. It is not activated automatically.
Progress is held in memory; after a server restart, consult the dataset list for a completed
fork. An interrupted, uncommitted fork leaves no registered dataset or partial schema.

A fork states its immediate parent and retains earlier origins. Parent updates, renames, and
deletion do not alter the saved chain. A fork is not synchronized with its parent: updating,
rebasing, merging words, and a separate original/current comparison screen are future work.
SQLite still supports word attribution, but cannot hold a second dataset or create a fork.

The editor of a catalog dataset, including the project's published dataset, recommends a fork.
**Continue editing** keeps direct edits available and acknowledges the warning for that dataset
in the current browser session. The reminder remains visible in the editor.

### Provenance endpoints

All mutation routes require admin authentication:

| Endpoint                                    | Result                                                                     |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| `GET /api/en/copy-preview/{source}/{id}`    | Word content, origins, and `copy_source` revision for the add-word request |
| `POST /api/en/add/word?dataset={own}`       | Create normally, or copy using the preview's `copy_source` and origins     |
| `PATCH /api/en/{id}/origins?dataset={name}` | Save `{origins, reason}`; inherited terms are protected                    |
| `POST /api/en/datasets/{parent}/fork`       | Accept a create-dataset payload; return `202` and initial progress         |
| `GET /api/en/datasets/{name}/fork-status`   | `copying`, `completed`, or `failed`, with table counts and a failure code  |

See [the portable format](./offline-import.md#provenance-export-format) before moving these
records to another instance or publishing them on Hugging Face.

## Alternative spellings

Alternative spellings belong to the headword (`EnEntry`), shared by all its parts of
speech. Word and form responses expose sorted `alternatives: string[]`. Links are
reciprocal, preserve case, omit self-links, and do not imply transitive equivalence.
They point only to headwords that exist in the same dataset.

The Wiktionary converter reads `forms` tagged `alternative` and senses with `alt_of`.
Alternative-only records keep their source definition, rather than copying the target's
meanings. Import resolves links after loading all words, phrases and forms. Reconvert
and reinstall the source to recover alternatives discarded by older converters.
