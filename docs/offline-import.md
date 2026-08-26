# Moving a dictionary between instances offline

The dictionary import normally downloads the published dataset from HuggingFace. Installations
without internet access — corporate networks, air-gapped labs, CI — and admins who edited an
exported dataset can load the same files from a local source instead (issue #269):

- **files uploaded through the admin UI** — the zip that _Export dictionary_ produces (the
  _Archive_ tab), or the dataset files in their own slots with the manifest either as a file or
  typed by hand (the _Separate files_ tab);
- **a directory or zip on the server** — inside the folder named by `DICTIONARY_IMPORT_DIR`
  (a mounted volume, for instance).

Both go through the same import pipeline as the HuggingFace source; only the download stage is
skipped.

## Dataset format

A dataset is the set of files the export writes, flat or inside a single wrapper folder:

```
manifest.json
vocab-bloom-hub-en-words.jsonl
vocab-bloom-hub-en-phrasal-verbs.jsonl
vocab-bloom-hub-en-grammar-patterns.jsonl
vocab-bloom-hub-en-phrases.jsonl
```

Only the `.jsonl` files you actually have are needed — at least one of them; phrases, grammar
patterns and phrasal verbs are optional, and so is `manifest.json`. When the manifest is present
its `version` is stored as _Your version_ after the import (and its synonym / antonym link counts
refine the progress bar); without it the version stays unknown. Line counts for the progress bar
are always taken from the files themselves, so a hand-assembled dataset needs no bookkeeping.

The dataset is validated **before** the import starts and is rejected (`dataset_invalid`) when
there is no `.jsonl` file at all, when `manifest.json` is malformed, or when the folder / archive
contains any file with an unknown name. OS artefacts (`.DS_Store`, `__MACOSX/`) are ignored.

## Export on A → copy → import on B

1. On instance A open _Managing → Export dictionary_ (or call `GET /api/en/dictionary/export`
   and download the archive from `GET /api/en/dictionary/export/download/:exportId`). You get
   `vocab-bloom-hub-en-export.zip`.
2. Copy the zip to a machine that can reach instance B.
3. On instance B open _Managing → Import dictionary → Archive_, drop the zip into the upload
   area and press _Start importing_. The progress stream is the same as for the HuggingFace
   import; the manifest version is stored as _Your version_ when the import completes.

   To load the files separately open the _Separate files_ tab instead: one slot per file (the
   slot decides what the file is, its own name does not matter), and the manifest either as
   `manifest.json` or filled in by hand (version, optional synonym / antonym link counts).

Equivalent API calls (the admin cookie or a Bearer token is required). The multipart fields are
`archive` for the whole zip, or `words`, `phrasal_verbs`, `grammar_patterns`, `phrases` and
`manifest` for the separate files; the text fields `version`, `synonym_links` and
`antonym_links` stand in for (and override) a manifest file:

```bash
# the whole archive
curl -N -b cookies.txt -F archive=@vocab-bloom-hub-en-export.zip \
  http://localhost:3010/api/en/dictionary/import/upload

# only the words, the version typed by hand
curl -N -b cookies.txt -F words=@my-words.jsonl -F version=1.4.0 \
  http://localhost:3010/api/en/dictionary/import/upload
```

Each upload is limited to 512 MiB; the uploaded files are deleted from the server once the
import has finished, whether or not it succeeded.

## Datasets on the server (`DICTIONARY_IMPORT_DIR`)

When the zip is already on the server — mounted into a container, copied by a deploy script —
point `DICTIONARY_IMPORT_DIR` at the folder holding it:

```dotenv
DICTIONARY_IMPORT_DIR=/data/dictionary-imports
```

The _From file_ tab then lists what the folder offers (zip archives and sub-folders containing a
`manifest.json`, one level deep), and the request names the pick relative to that folder:

```bash
curl -N -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"source":{"kind":"file","path":"vocab-bloom-hub-en-export.zip"}}' \
  http://localhost:3010/api/en/dictionary/import
```

Paths are resolved inside the import directory only: `..`, absolute paths and symlinks pointing
elsewhere are rejected (`dataset_file_not_found`). Without the variable the request fails with
`import_dir_not_configured` and the UI offers uploads only. The server never modifies or deletes
the files in that folder.

`GET /api/en/dictionary/import/sources` returns the same listing the UI shows:

```json
{
  "import_dir_configured": true,
  "files": [{ "path": "vocab-bloom-hub-en-export.zip", "kind": "zip", "size": 12345678 }]
}
```

## Notes

- Importing does not wipe the database first: records that already exist (same word, part of
  speech and form) are skipped, the same way the HuggingFace import behaves.
- With Docker Compose, mount the folder into the server container and set the variable to the
  mount point, e.g. `- ./imports:/data/dictionary-imports` and
  `DICTIONARY_IMPORT_DIR=/data/dictionary-imports`.
- `pg_dump` / `pg_restore` remain the right tool for moving a **whole database** including ids;
  the dataset route is for the dictionary content in its portable, diffable form.
