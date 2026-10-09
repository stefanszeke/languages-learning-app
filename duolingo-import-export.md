# Task: Improve the Lingo Study List JSON Importer for Duolingo Data

## Context

This is an existing Japanese/German study application. Please inspect the actual code and existing data before making changes.

Main files:
- `app.js` — frontend application and import logic
- `server.js` — local Node/Express backend
- `index.html` — user interface
- `styles.css` — styling
- `data/japanese-words.js`
- `data/japanese-sentences.js`
- `data/german-words.js`
- `data/german-sentences.js`

The application already has JSON file import, Paste JSON with preview, duplicate checking, OCR review, Japanese reading derivation, and German dictionary helpers.

**Extend these existing systems rather than implementing a completely separate importer.**

## Goal

Support a reliable workflow:

Duolingo JSON → preview → validate → enrich if needed → deduplicate → assign IDs → save to existing data files.

Four categories must be supported.

### Japanese word

```json
{
  "type": "word",
  "english": "wedding ceremony",
  "romaji": "kekkonshiki",
  "kanji": "結婚式",
  "kana": "けっこんしき",
  "pos": "noun",
  "id": 286
}
```

### Japanese sentence

```json
{
  "type": "sentence",
  "english": "boring wedding",
  "romaji": "tsumaranai kekkonshiki",
  "kanji": "つまらない結婚式",
  "kana": "つまらないけっこんしき",
  "id": 277
}
```

### German word

```json
{
  "type": "word",
  "english": "oven/ovens",
  "german": "der Ofen / die Öfen",
  "article": "der",
  "pos": "noun",
  "id": 231
}
```

### German sentence

```json
{
  "type": "sentence",
  "english": "Dad is fixing the oven and then we are leaving.",
  "german": "Papa repariert den Ofen und dann fahren wir.",
  "id": 271
}
```

These are examples of the existing permanent storage schema.

## Requirements

### 1. Improve the existing JSON importer

Support raw Duolingo exports with missing fields as well as fully enriched entries.

Keep using the existing import/preview infrastructure where practical.

Correct the current behavior where imported `pos` and `article` values are discarded. Preserve valid explicit values, and do not let automatic derivation overwrite authoritative user-supplied fields.

Support both file upload and Paste JSON.

### 2. Introduce proper staging and validation

Incoming records should first enter a review state, not automatically become permanent study records.

Each item should have a status:
- Complete — required fields populated
- Needs enrichment — missing information
- Duplicate — already in the collection or repeated in the incoming batch
- Invalid — structurally incorrect data

Allow users to edit fields, remove entries, and exclude specific entries from import.

The final commit operation must import only valid, selected, complete records.

Preserve incomplete entries in a temporary draft state if possible, without modifying the existing study datasets.

### 3. Required fields

For committing a Japanese word, require:
- english
- romaji
- kanji
- kana
- pos

For committing a Japanese sentence, require:
- english
- romaji
- kanji
- kana

For committing a German word, require:
- english
- german
- pos
- article only for nouns

For committing a German sentence, require:
- english
- german

These are stricter rules for the new reviewed-import workflow. Do not accidentally break existing legacy data or unrelated entry editing.

Validate German article values as `der`, `die`, or `das` where applicable.

### 4. Duplicate detection

Extend the existing duplicate detection to check both:
- Existing saved entries
- Other records inside the incoming batch

Use language-aware matching.

For Japanese, avoid treating homophones with different kanji as identical. Compare the appropriate canonical Japanese form.

For German, understand noun articles, plural forms and verb conjugation lists. For example, `Schreibtische` should be recognized as potentially already represented by `der Schreibtisch / die Schreibtische`.

Where duplicate equivalence is uncertain, flag a possible duplicate for user review rather than deleting it automatically.

Do not rely on English translations alone for deduplication.

### 5. IDs

IDs are independent for each language and category.

Existing incoming IDs may conflict with stored IDs.

Assign fresh sequential IDs at commit time, based on the highest ID in the selected category.

Show the proposed new IDs in the preview. Recalculate before committing, and prevent collisions.

Preserve the input order of accepted entries.

### 6. Improve the import review UI

Use a compact, readable layout consistent with the existing dark theme.

Provide:
- Total items
- Complete count
- Needs enrichment count
- Duplicate count
- Invalid count
- Editable language-specific fields
- Filter by status
- Select all complete
- Import selected complete entries
- Copy/download incomplete records as JSON
- Copy/download all reviewed records as JSON

Clearly indicate the source and the reason an item is incomplete or considered a duplicate.

### 7. Enrichment compatibility

The user will sometimes export unfinished records, paste them into ChatGPT for enrichment, and import the enriched JSON back into the app.

Make this workflow convenient.

The exporter and importer must support arrays of JSON objects with the four schemas shown above.

Raw export metadata can be retained in draft state, but permanent dictionary entries should follow the existing schema.

Do not make external AI services necessary for importing. The existing tokenizer and German dictionary helpers can continue providing local assistance, but their output must remain reviewable.

### 8. Data safety

The existing `data/*.js` files are the source of truth.

Maintain the existing local-server save mechanism.

Do not write unreviewed drafts to the permanent dictionaries.

Do not overwrite existing records when importing duplicates.

Preserve the existing GitHub Pages read-only behavior.

Do not unnecessarily modify the underlying data or replace any dictionaries.

### 9. Tests

Add targeted tests or a reproducible test harness for:

- All four schemas
- Missing required fields
- Incoming `pos` and `article` preservation
- Batch-internal duplicates
- Existing-collection duplicates
- German nouns with articles/plurals
- German verbs with conjugation lists
- Japanese homophones with different kanji
- Sequential IDs and conflicting input IDs
- Exclusion of incomplete/invalid entries
- Correct writes to the relevant data files

Also run the existing `npm run check`.

## Scope and implementation approach

First inspect and summarize how the current import and duplicate-detection code works.

Then implement the smallest coherent extension possible. Reuse existing helpers and UI components.

Avoid unnecessary refactoring of unrelated features, such as flashcards and vocabulary review.

After implementing, summarize:
1. Files changed
2. New import workflow
3. Any schema or validation decisions
4. Tests run and their results
5. Known limitations

The result should be usable for repeated small Duolingo imports and larger batches of 50–200 words without requiring manual JSON editing outside the app.