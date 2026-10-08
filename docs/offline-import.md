# Moving a dictionary between instances offline

The project's dataset can be downloaded from HuggingFace; other catalog datasets can be
downloaded on the server from their source links. Installations
without internet access — corporate networks, air-gapped labs, CI — and admins who edited an
exported dataset can load the same files from a local source instead:

- **files uploaded through the admin UI** — the zip that _Export_ on the card of a dataset produces (the
  _Archive_ tab), or the dataset files in their own slots with the manifest either as a file or
  typed by hand (the _Separate files_ tab);
- **a directory or zip on the server** — inside the folder named by `DICTIONARY_IMPORT_DIR`
  (a mounted volume, for instance).

Both go through the same import pipeline as the HuggingFace source; only the download stage is
skipped.

Source files such as OpenGloss's six Parquet shards use **How to install → Upload files
manually** on the source's card, not the archive import described below. The server converts
them before importing. To convert on another machine, use the
[converter CLI](../apps/server/src/converters/README.md#opengloss), then import its output into
the matching `opengloss` dataset. Source installation and manual multipart fields are documented
in [datasets](./datasets.md#installing-a-dataset).

## Dataset format

A dataset is the set of files the export writes, flat or inside a single wrapper folder:

```
manifest.json
dataset-format.json                                    # required by current exports with sources and licenses
LICENSE                                                # the license and the notices of the source, in full
vocab-bloom-hub-en-words.jsonl
vocab-bloom-hub-en-phrasal-verbs.jsonl
vocab-bloom-hub-en-grammar-patterns.jsonl
vocab-bloom-hub-en-phrases.jsonl
vocab-bloom-hub-en-meanings.jsonl
vocab-bloom-hub-en-meaning-translations.<lang>.jsonl   # one per language: .ru, .es, .fr, .de, .pt, .zh, .ar
vocab-bloom-hub-en-short-translations.<lang>.jsonl
vocab-bloom-hub-en-changes.jsonl                       # the history of edits, when the data was edited
```

The entry files (`words`, `phrases`, `grammar-patterns`) carry the entries themselves and their
forms; `phrasal-verbs` is the linking map of base verbs to their phrasal variants. The
collections are files of their own, one line per row next to the key of its parent:

| File                          | One line per                  | Key of the parent                                               |
| ----------------------------- | ----------------------------- | --------------------------------------------------------------- |
| `meanings`                    | meaning (with its links)      | `word`, `part_of_speech`                                        |
| `meaning-translations.<lang>` | translation of a meaning      | `word`, `part_of_speech`, `meaning_sort_order`, `meaning_title` |
| `short-translations.<lang>`   | short translation of an entry | `word`, `part_of_speech`                                        |

The translations are one file per language (`<lang>` is a member of `available_languages`), so a
file stays a manageable size and a language loads on its own; a language without rows has no
file. Exports made before this split wrote one combined `meaning-translations.jsonl` /
`short-translations.jsonl` for every language — the import still reads those.

Phrases and grammar patterns are keyed the same way, with `phrase` / `grammar_pattern` as the
part of speech. The lines follow the order of the entry files, then the natural keys of the rows,
so two exports of the same data are byte-identical. Datasets published before this layout nest
`meanings` and `short_translations` inside the entry lines; the import still reads them.

For **legacy files without structured origins**, only the `.jsonl` files you actually have
are needed — at least one of them — and `manifest.json` is optional. Current exports require
their manifest and format marker, and the complete history when declared; see
[sources and licenses](#provenance-export-format). The collection files are imported after the
entry files and go to the entries and meanings that exist by then, whether they came from this
dataset or were there before: a file of translations alone — one language, say — loads into a
dictionary that already holds the entries, and rows the dictionary already has (a meaning with the
same sort order and title, a translation in the same language with the same title, a short
translation in the same language with the same description) are skipped like duplicate entries.
When the manifest is present
its `version` is stored as _Your version_ after the import (and its synonym / antonym link counts
refine the progress bar); without it the version stays unknown. The terms an export writes into
the manifest — `source`, `license`, `license_url`, `attribution`, `attribution_url`, `notice`
([`DATA_LICENSE.md`](../DATA_LICENSE.md)) — say where the export was taken from. The terms of the dataset
the import fills must match the target: a manifest that names another `source` than that dataset is refused
(`dataset_source_mismatch`), and so is one that names another `license` than a dataset of the
owner's has: datasets are never mixed ([`datasets.md`](./datasets.md#datasets-are-never-mixed)). Line counts for the progress bar
are always taken from the files themselves, so a hand-assembled dataset needs no bookkeeping.
Catalog primary terms remain fixed. A current-format import restores dataset origins and,
for an own dataset or fork, its exported title, description, notice, attribution and license
details. This metadata restoration does not permit changing the target's primary license by import.

**The history of edits** travels with the data
([`datasets.md`](./datasets.md#editing-a-dataset-the-history-of-edits)): `changes` holds one
line per edit made on the instance the export was taken from — the headword and the part of
speech, what was edited, the values before and after, where the edit came from, the name of a
reader who asked to be credited — and `modified_entries` of the manifest counts the entries that
differ from their source by them. The licenses ask that an indication of earlier modifications
is kept, so the import reads the file last (stage 14) and merges it into the history of the
dataset it fills: a line the history already has is skipped, and an edit shows on the importing
instance only where the entry itself was taken from the copy — for an entry the instance kept
as it had it, the edit is recorded as past. The file is absent from an export of a dataset
nobody edited, and data that comes without it is taken to be clean: an import marks no entry as
changed on its own. `LICENSE` is written for whoever receives the files; the importer does not
parse it. Machine-readable terms come from the manifest, word origins and contribution snapshots.
Keep the notice file with the copy even though it is not the source of imported metadata.

> [!NOTE]
> Human-authored catalog datasets (Wiktionary and both WordNets) refuse entries marked
> `generated` (`generated_not_allowed`). OpenGloss, the project's dataset and own datasets
> accept generated entries.

> [!NOTE]
> The dataset is validated **before** the import starts and is rejected (`dataset_invalid`) when
> there is no `.jsonl` file at all, when `manifest.json` is malformed, or when the folder / archive
> contains any file with an unknown name. OS artefacts (`.DS_Store`, `__MACOSX/`) are ignored.

## Export on A → copy → import on B

> [!NOTE]
> **The version of the entries edited on the instance.** Every entry line carries a `version`:
> the one of the dataset it came from, or `custom_version` once the entry was edited in the admin
> UI. `custom_version` is a mark of the instance and says nothing to whoever takes the copy, so
> the export has a setting for it, _Version of the entries edited here_
> (`GET /api/en/dictionary/export?edited_version=2.1.0`): the edited entries are written under
> that version. The dictionary itself is not changed, and an export without the setting writes
> `custom_version` as before. An entry whose changes were all taken back carries the version of
> its dataset again and is exported under it. The version of the dataset as a whole is `version` of
> `manifest.json`.

1. On instance A open _Managing → Datasets → Export_ on the card of the dataset (or call `GET /api/en/dictionary/export`
   and download the archive from `GET /api/en/dictionary/export/download/:exportId`). You get
   `vocab-bloom-hub-en-export.zip`.
2. Copy the zip to a machine that can reach instance B.
3. On instance B open _Managing → Datasets → Import → Archive_ on the card of the dataset, drop the zip into the upload
   area and press _Start importing_. The progress stream is the same as for the HuggingFace
   import; the manifest version is stored as _Your version_ when the import completes.

   To load the files separately open the _Separate files_ tab instead: one slot per file (the
   slot decides what the file is, its own name does not matter), and the manifest either as
   `manifest.json` or filled in by hand (version, optional synonym / antonym link counts).

Equivalent API calls (the admin cookie or a Bearer token is required). The multipart fields are
`archive` for the whole zip, or `words`, `phrasal_verbs`, `grammar_patterns`, `phrases`,
`meanings`, `meaning_translations_<lang>`, `short_translations_<lang>` (one slot per language, e.g.
`short_translations_es`), `changes`, `manifest`, and `provenance` for `dataset-format.json`;
the text fields `version`, `synonym_links` and `antonym_links` stand in for (and override) a
manifest file:

Handwritten version/count fields are for legacy imports. For an export with sources and
licenses, upload its original manifest and marker rather than replacing them with text fields.

The examples use `localhost:3010`, the port of a start without Docker; under docker compose the
API is on `localhost:3240` by default.

```bash
# the whole archive
curl -N -b cookies.txt -F archive=@vocab-bloom-hub-en-export.zip \
  http://localhost:3010/api/en/dictionary/import/upload

# only the words, the version typed by hand
curl -N -b cookies.txt -F words=@my-words.jsonl -F version=1.4.0 \
  http://localhost:3010/api/en/dictionary/import/upload

# translations only, for entries the dictionary already has
curl -N -b cookies.txt -F short_translations_es=@es-short-translations.jsonl \
  -F meaning_translations_es=@es-meaning-translations.jsonl \
  http://localhost:3010/api/en/dictionary/import/upload

# an export of a WordNet dataset into the WordNet dataset of this instance (installed when it
# is not yet); the active one keeps serving
curl -N -b cookies.txt -F archive=@wordnet-export.zip -F dataset=wordnet \
  http://localhost:3010/api/en/dictionary/import/upload

# a complete OpenGloss export, retaining word sources, licenses and any edit history
curl -N -b cookies.txt -F archive=@opengloss-export.zip -F dataset=opengloss \
  http://localhost:3010/api/en/dictionary/import/upload
```

> [!NOTE]
> Each upload is limited to 512 MiB (the file of a public source on the datasets page: 2 GiB);
> the uploaded files are deleted from the server once the
> import has finished, whether or not it succeeded.

## Datasets on the server (`DICTIONARY_IMPORT_DIR`)

When the zip is already on the server — mounted into a container, copied by a deploy script —
point `DICTIONARY_IMPORT_DIR` at the folder holding it:

```dotenv
DICTIONARY_IMPORT_DIR=/data/dictionary-imports
```

The _Archive_ tab then also lists what the folder offers (zip archives and sub-folders
containing a `manifest.json`, one level deep) next to the upload area, and the request names
the pick relative to that folder:

```bash
curl -N -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"source":{"kind":"file","path":"vocab-bloom-hub-en-export.zip"}}' \
  http://localhost:3010/api/en/dictionary/import
```

> [!NOTE]
> Paths are resolved inside the import directory only: `..`, absolute paths and symlinks pointing
> elsewhere are rejected (`dataset_file_not_found`). Without the variable the request fails with
> `import_dir_not_configured` and the _Archive_ tab offers uploads only. The server never modifies
> or deletes the files in that folder.

`GET /api/en/dictionary/import/sources` returns the same listing the UI shows:

```json
{
  "import_dir_configured": true,
  "files": [
    {
      "path": "vocab-bloom-hub-en-export.zip",
      "kind": "zip",
      "size": 12345678,
      "modified_at": "2026-09-15T18:18:25.486Z"
    },
    { "path": "hand-assembled", "kind": "directory", "size": 0, "modified_at": "2026-09-15T18:18:25.486Z" }
  ],
  "revisions": ["v0.1.0"]
}
```

`revisions` are the version tags of the published dataset repository, newest first (the
_Dataset version_ selector of the HuggingFace tab; `[]` when the HuggingFace refs API is
unreachable).

## Notes

> [!IMPORTANT]
> Importing does not wipe the database first: records that already exist (same word, part of
> speech and form) are skipped, the same way the HuggingFace import behaves. To replace existing
> entries with the dataset content (keeping the entries you edited), run the import in update
> mode — see [operations.md](./operations.md#dataset-updates-vs-code-updates).

> [!TIP]
> With Docker Compose, mount the folder into the server container and set the variable to the
> mount point, e.g. `- ./imports:/data/dictionary-imports` and
> `DICTIONARY_IMPORT_DIR=/data/dictionary-imports`.

> [!NOTE]
> `pg_dump` / `pg_restore` remain the right tool for moving a **whole database** including ids;
> the dataset route is for the dictionary content in its portable, diffable form.

## Provenance export format

Current exports preserve dataset and word origins, associated licenses, full notices, and
inherited edit history. They use the **provenance-v1** metadata contract and keep the original
filenames listed above, for example `vocab-bloom-hub-en-words.jsonl` and
`vocab-bloom-hub-en-changes.jsonl`. The archive also contains `dataset-format.json` with
`{"format":1}` and its original `manifest.json`. Earlier archives with `provenance-v1.`
filename prefixes and the `provenance.v1.json` marker remain readable.

The on-disk manifest contains:

```json
{
  "version": { "format": "provenance-v1", "dataset": "2.0.0" },
  "provenance_format": 1,
  "provenance": {
    "title": "My dictionary",
    "notice": null,
    "description": null,
    "license_text": null,
    "origins": []
  },
  "files": {
    "vocab-bloom-hub-en-words.jsonl": { "lines": 1 }
  }
}
```

The ordinary manifest source and primary license/attribution fields are still present. The
`provenance` snapshot additionally retains the title, description, notice, custom license text,
origins, and attribution/link settings. Entry lines carry `origins`; `licenses[]` is derived
from them. Source snapshots include their `acquisitions[]` (copy/fork events, dates, and
revisions); repeated acquisitions do not repeat source terms. An acquisition's optional `via`
names an intermediate dataset without assigning its license to unchanged material. History lines retain
`inherited_from`, correction `reason`, and the `contribution` snapshot of the editing
dataset's terms when known. Active history supplies the word API's `contributions[]`
and their licenses; keep the history file with the words to preserve that attribution.
For provenance-v1 uploads, the declared history file must be present with the full line count
from the manifest, even when importing only a subset of the other files. A missing or truncated
history is rejected before importing words. Superseded edits retain their original terms in
history without imposing those terms on the current word or blocking a later license change.
The API's dataset
version remains a string or null; the envelope is only the portable file contract.

Keep the complete archive when transferring a dataset. With separate files, retain the exported
filenames and upload both the manifest and the **Sources and licenses** marker (`dataset-format.json`). A handwritten
legacy manifest is insufficient for files with structured origins. Imports reject missing
markers, mixed legacy/new names, and unsupported provenance formats. Legacy imports without
origins remain supported and acquire their target dataset's known defaults.

Upgrade the receiving server before importing these exports. Released local importers reject
the format marker and the manifest envelope before writing words. With the original filenames,
older remote importers can still download words after ignoring an unfamiliar manifest and may
lose source metadata. Keep those servers pinned to a compatible older dataset revision until
they are upgraded; matching filenames do not make the metadata backward-compatible.
Publish the complete new-format files together, and do not remove the format marker or strip
source metadata to force an old importer to accept an export.

OpenGloss conversion writes this format from the start, even before anyone edits the data.
Words with a WordNet source retain both OpenGloss and Princeton WordNet 3.0 snapshots; other
words retain the OpenGloss snapshot. Export/import preserves the converted dictionary, its
source versions, links and notices. It does not restore upstream Parquet fields that the
[converter deliberately leaves out](./datasets.md#opengloss-24).

## Alternative spelling links

Word, phrase and grammar-pattern lines may carry `alternatives: string[]`; form objects
may carry the same field for their own headword. Export repeats the headword's list for
every part of speech. Import unions supplied lists for a headword before resolving them,
so file/chunk/POS order does not affect the result. Links are reciprocal and use exact
spellings, never local IDs or part-of-speech qualifiers. Missing targets are skipped.

An omitted field in an older file preserves existing links. An explicitly empty list
can clear an imported headword's unprotected links in update mode, unless the reciprocal
endpoint explicitly requests the pair. Links involving a user-modified headword remain
protected. Export with a version that understands this field to preserve it on round-trip;
older importers may discard it. Alternative-only Wiktionary words retain the source gloss.

## Etymologies and flat meanings

Word, phrase and grammar-pattern lines may carry `etymologies: [{number, text}]`.
Numbers are positive integers unique within that word and part of speech; array order is
not significant. Meaning lines (including nested meanings) carry `etymology_number`,
which is nullable and must refer to a group on their own word. Database IDs never travel
in these files. Imports rebuild the references after creating each word's groups, so
an export can be installed in a database with different IDs. Unknown references and
repeated group numbers are rejected. Old files without these fields remain valid.

An update replaces the imported word's groups along with its meanings; user-modified
words retain both under the usual update protection. Export and history retain the
local numbers and associations. Use an importer that understands these optional fields
to preserve them on round-trip.

The admin word response includes group IDs. When replacing `etymologies` through the
common-word edit endpoint, send the existing ID to keep a group and its meaning links;
omit the ID to create a new group. Changing a kept group's number preserves its links.
Omitted groups are deleted and their meanings become unassigned, even if a new group
reuses the old number. Omit the entire field to leave the groups unchanged. The public
word response returns only `{number, text}`, and its flat meanings expose the nullable
`etymology_number`. History and reverting retain the associations without database IDs.
