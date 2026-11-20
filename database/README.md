# AgroCare Database

This folder contains the persistent SQLite database, reference schema, sourced crop seed and existing disease seed.

- `agrocare.db` is created and updated by `backend/app.py` and is ignored by Git.
- `seed/crops.json` and `seed/diseases.json` are inserted with `INSERT OR IGNORE` when the server starts. The current seeds provide 13 crop/group entries and 20 disease records.
- `schema.sql` documents `crops`, `crop_aliases`, `diseases`, `crop_diseases`, `disease_references`, and detection history.
- Existing disease rows are retained and backfilled into the relationship tables. No per-disease references were included in the original disease seed; those records are explicitly marked as lacking citations.
- `detection_history` stores model classifications and an optional image reference. Images are only retained when the user explicitly opts in.

## Importing additional data

From the repository root, use:

```bat
python database\import_data.py --crops C:\data\crops.json --diseases C:\data\diseases.json
```

Either option may be used alone. Files are JSON arrays. Crop records require a stable `id`, canonical `name`, `category`, and an HTTP(S) `source_url` with a `source` label; they may also include `scientific_name` and string-array `aliases`. Disease records use the existing seed fields, must include a source label and at least one HTTP(S) reference with `title`, `url`, and optional `note`, and may specify multiple crop names in `crops`. Referenced crops must already exist. Imports run transactionally and reject invalid references or crop links; duplicate IDs/names do not replace existing records.

The current 13 crop/group entries are genuine names from the existing AgroCare catalogue, paired with botanical taxonomy references (the broad Pulses group is referenced to FAO and has no single scientific name). This is not a 1,000-crop dataset. Do not inflate the count with generated entries; source a larger dataset and import its real records. The 20 legacy disease guides need independent per-record citation review before being treated as verified agronomic advice.
